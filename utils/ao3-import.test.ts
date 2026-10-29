// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { beforeEach, expect, test } from 'vitest';
import { BACKOFF_MS, PAGE_DELAY_MS, runImport, type ImportProgress } from './ao3-import';
import { db } from './db';
import bookmarksPage from './fixtures/ao3-bookmarks-page.html?raw';
import readingsLastPage from './fixtures/ao3-readings-last-page.html?raw';

beforeEach(() => db.works.clear());

// A fake AO3 that serves the given responses in order and records requests and waits.
function fakeAo3(responses: { status?: number; body: string }[]) {
  const urls: string[] = [];
  const waits: number[] = [];
  return {
    urls,
    waits,
    fetchFn: async (url: string) => {
      urls.push(url);
      const r = responses.shift();
      if (!r) throw new Error('unexpected request');
      return new Response(r.body, { status: r.status ?? 200 });
    },
    sleep: async (ms: number) => {
      waits.push(ms);
    },
  };
}

test('fetches pages in order with a pause between them, then stops on the last page', async () => {
  const ao3 = fakeAo3([{ body: bookmarksPage }, { body: readingsLastPage }]);
  const progress: ImportProgress[] = [];
  const result = await runImport({
    source: 'bookmarks',
    username: 'reader',
    status: 'want',
    onProgress: (p) => progress.push(p),
    ...ao3,
  });
  expect(ao3.urls).toEqual([
    'https://archiveofourown.org/users/reader/bookmarks?page=1',
    'https://archiveofourown.org/users/reader/bookmarks?page=2',
  ]);
  expect(ao3.waits).toEqual([PAGE_DELAY_MS]);
  expect(progress[1]).toMatchObject({ page: 1, lastPage: 7 });
  expect(result).toEqual({ page: 2, lastPage: 2, seen: 4, added: 4 });
  expect(progress.at(-1)).toEqual(result);
  expect(await db.works.count()).toBe(4);
  expect((await db.works.get(['ao3', '201']))?.status).toBe('want');
});

test('running the same import again adds nothing', async () => {
  await runImport({
    source: 'bookmarks',
    username: 'reader',
    status: 'want',
    ...fakeAo3([{ body: readingsLastPage }]),
  });
  const before = await db.works.toArray();
  const again = await runImport({
    source: 'bookmarks',
    username: 'reader',
    status: 'completed',
    ...fakeAo3([{ body: readingsLastPage }]),
  });
  expect(again.added).toBe(0);
  expect(await db.works.toArray()).toEqual(before);
});

test('backs off on a rate limit, then continues', async () => {
  const ao3 = fakeAo3([{ status: 429, body: '' }, { body: '<h2>Retry later</h2>' }, { body: readingsLastPage }]);
  const result = await runImport({ source: 'markedForLater', username: 'reader', status: 'want', ...ao3 });
  expect(ao3.waits).toEqual(BACKOFF_MS);
  expect(ao3.urls[0]).toBe('https://archiveofourown.org/users/reader/readings?show=to-read&page=1');
  expect(result.added).toBe(1);
});

test('gives up after the backoffs, keeping earlier pages', async () => {
  const limited = { status: 429, body: '' };
  const ao3 = fakeAo3([{ body: bookmarksPage }, limited, limited, limited]);
  await expect(runImport({ source: 'bookmarks', username: 'reader', status: 'want', ...ao3 })).rejects.toThrow(
    /rate-limiting/,
  );
  expect(await db.works.count()).toBe(3);
});

test('Marked for Later while logged out explains why it is empty', async () => {
  const ao3 = fakeAo3([{ body: '<div id="login"><a href="/users/login">Log In</a></div>' }]);
  await expect(runImport({ source: 'markedForLater', username: 'reader', status: 'want', ...ao3 })).rejects.toThrow(
    /Log in to AO3/,
  );
});
