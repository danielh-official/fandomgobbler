// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { beforeEach, expect, test } from 'vitest';
import { DUE_AFTER, pickDue, REFRESH_DELAY_MS, runRefresh } from './refresh';
import type { Work } from './models';
import { BACKOFF_MS } from './paced-fetch';
import { PlatformUnresponsiveError } from './health';
import { db } from './db';
import oneshot from './fixtures/ao3-work-oneshot.html?raw';
import ffnetComplete from './fixtures/ffnet-story-complete.html?raw';
import ffnetNotFound from './fixtures/ffnet-not-found.html?raw';
import { saveWork } from './library';

beforeEach(async () => {
  await db.works.clear();
  for (const id of ['1', '2', '3'])
    await saveWork(
      { platform: 'ao3', id, title: `Old ${id}`, author: 'a', url: `u${id}`, status: 'progress', rating: 4 },
      100,
    );
});

// AO3's 404 page still has its site header.
const AO3_PAGE = '<header id="header"></header>';

function fakeAo3(responses: { status?: number; body?: string }[]) {
  const urls: string[] = [];
  const waits: number[] = [];
  return {
    urls,
    waits,
    fetchFn: async (url: string) => {
      urls.push(url);
      const r = responses.shift();
      if (!r) throw new Error('unexpected request');
      return new Response(r.body ?? '', { status: r.status ?? 200 });
    },
    sleep: async (ms: number) => {
      waits.push(ms);
    },
  };
}

test('marks 404s deleted, refreshes works that load, leaves unreadable ones alone', async () => {
  const ao3 = fakeAo3([
    { status: 404, body: AO3_PAGE },
    { body: oneshot },
    { body: '<header id="header"></header><p>Restricted: log in</p>' },
  ]);
  const result = await runRefresh({
    refs: [
      { platform: 'ao3', id: '1' },
      { platform: 'ao3', id: '2' },
      { platform: 'ao3', id: '3' },
    ],
    ...ao3,
  });

  expect(ao3.urls[0]).toBe('https://archiveofourown.org/works/1?view_adult=true');
  expect(ao3.waits).toEqual([REFRESH_DELAY_MS, REFRESH_DELAY_MS]);
  expect(result).toEqual({ checked: 3, total: 3, newChapters: 1, lost: 1, unchecked: 1 });

  const [w1, w2, w3] = await db.works.bulkGet([
    ['ao3', '1'],
    ['ao3', '2'],
    ['ao3', '3'],
  ]);
  expect(w1).toMatchObject({ status: 'lost', lostFrom: 'progress', rating: 4 });
  expect(w2).toMatchObject({ status: 'progress', title: 'A One-Shot', rating: 4 });
  expect(w3).toMatchObject({ status: 'progress', title: 'Old 3' });
  // Unreadable still counts as checked, so it doesn't stay first in line.
  expect(w2?.refreshedAt).toBeGreaterThan(100);
  expect(w3?.refreshedAt).toBeGreaterThan(100);
});

test('a work already marked deleted keeps its original lostFrom', async () => {
  await runRefresh({ refs: [{ platform: 'ao3', id: '1' }], ...fakeAo3([{ status: 404, body: AO3_PAGE }]) });
  const again = await runRefresh({
    refs: [{ platform: 'ao3', id: '1' }],
    ...fakeAo3([{ status: 404, body: AO3_PAGE }]),
  });
  expect(again.lost).toBe(0);
  expect(await db.works.get(['ao3', '1'])).toMatchObject({ status: 'lost', lostFrom: 'progress' });
});

test('backs off on a rate limit, and gives up keeping what was checked', async () => {
  const limited = { status: 429 };
  const ao3 = fakeAo3([{ status: 404, body: AO3_PAGE }, limited, limited, limited]);
  await expect(
    runRefresh({
      refs: [
        { platform: 'ao3', id: '1' },
        { platform: 'ao3', id: '2' },
      ],
      ...ao3,
    }),
  ).rejects.toThrow(/rate-limiting/);
  expect(ao3.waits).toEqual([REFRESH_DELAY_MS, ...BACKOFF_MS]);
  expect((await db.works.get(['ao3', '1']))?.status).toBe('lost');
});

test('picks the most overdue works, completed ones far less often, never deleted ones', () => {
  const now = 100 * DUE_AFTER.completed;
  const work = (id: string, ago: number | null, done: boolean, status: Work['status'] = 'progress') =>
    ({
      platform: 'ao3',
      id,
      status,
      chaptersPosted: done ? 3 : 2,
      chaptersTotal: 3,
      refreshedAt: ago === null ? undefined : now - ago,
    }) as Work;
  const works = [
    work('fresh-ongoing', DUE_AFTER.ongoing / 2, false),
    work('due-ongoing', DUE_AFTER.ongoing * 2, false),
    work('never', null, false),
    work('done-recently', DUE_AFTER.ongoing * 3, true),
    work('done-long-ago', DUE_AFTER.completed * 3, true),
    work('deleted', null, false, 'lost'),
  ];
  expect(pickDue(works, now, 10).map((w) => w.id)).toEqual(['never', 'done-long-ago', 'due-ongoing']);
  expect(pickDue(works, now, 1).map((w) => w.id)).toEqual(['never']);
});

test('an unresponsive AO3 throws without marking anything refreshed', async () => {
  for (const response of [{ status: 503 }, { body: '<h1>Down for maintenance</h1>' }]) {
    const err = await runRefresh({ refs: [{ platform: 'ao3', id: '1' }], backoffs: [], ...fakeAo3([response]) }).catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(PlatformUnresponsiveError);
  }
  expect((await db.works.get(['ao3', '1']))?.refreshedAt).toBeUndefined();
});

test('FanFiction.net: refreshes, marks "Story Not Found" deleted, and treats a Cloudflare check as unresponsive', async () => {
  const story = (id: string) => ({
    platform: 'ffnet' as const,
    id,
    title: 'Old',
    author: 'a',
    url: 'u',
    status: 'progress' as const,
  });
  await saveWork(story('5782108'));
  await saveWork(story('2'));
  const ao3 = fakeAo3([{ body: ffnetComplete }, { body: ffnetNotFound }]);
  const result = await runRefresh({
    refs: [
      { platform: 'ffnet', id: '5782108' },
      { platform: 'ffnet', id: '2' },
    ],
    ...ao3,
  });
  expect(ao3.urls[0]).toBe('https://www.fanfiction.net/s/5782108/1/');
  expect(result).toMatchObject({ checked: 2, lost: 1, newChapters: 1 });
  expect(await db.works.get(['ffnet', '5782108'])).toMatchObject({ title: 'A Finished Story', chaptersPosted: 122 });
  expect(await db.works.get(['ffnet', '2'])).toMatchObject({ status: 'lost', lostFrom: 'progress' });

  const challenge = { status: 403, body: '<html><head><title>Just a moment...</title></head></html>' };
  const err = await runRefresh({
    refs: [{ platform: 'ffnet', id: '5782108' }],
    backoffs: [],
    ...fakeAo3([challenge]),
  }).catch((e) => e);
  expect(err).toBeInstanceOf(PlatformUnresponsiveError);
});
