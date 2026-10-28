// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { beforeEach, expect, test } from 'vitest';
import { DUE_AFTER, pickDue, REFRESH_DELAY_MS, runRefresh } from './ao3-refresh';
import type { Ao3Work } from './models';
import { BACKOFF_MS } from './ao3-import';
import { db } from './db';
import oneshot from './fixtures/ao3-work-oneshot.html?raw';
import { saveAo3Work } from './library';

beforeEach(async () => {
  await db.ao3Works.clear();
  for (const id of ['1', '2', '3'])
    await saveAo3Work({ id, title: `Old ${id}`, author: 'a', url: `u${id}`, status: 'progress', rating: 4 }, 100);
});

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
  const ao3 = fakeAo3([{ status: 404 }, { body: oneshot }, { body: '<p>Restricted: log in</p>' }]);
  const result = await runRefresh({ ids: ['1', '2', '3'], ...ao3 });

  expect(ao3.urls[0]).toBe('https://archiveofourown.org/works/1?view_adult=true');
  expect(ao3.waits).toEqual([REFRESH_DELAY_MS, REFRESH_DELAY_MS]);
  expect(result).toEqual({ checked: 3, total: 3, newChapters: 1, lost: 1, unchecked: 1 });

  const [w1, w2, w3] = await db.ao3Works.bulkGet(['1', '2', '3']);
  expect(w1).toMatchObject({ status: 'lost', lostFrom: 'progress', rating: 4 });
  expect(w2).toMatchObject({ status: 'progress', title: 'A One-Shot', rating: 4 });
  expect(w3).toMatchObject({ status: 'progress', title: 'Old 3' });
  // Unreadable still counts as checked, so it doesn't stay first in line.
  expect(w2?.refreshedAt).toBeGreaterThan(100);
  expect(w3?.refreshedAt).toBeGreaterThan(100);
});

test('a work already marked deleted keeps its original lostFrom', async () => {
  await runRefresh({ ids: ['1'], ...fakeAo3([{ status: 404 }]) });
  const again = await runRefresh({ ids: ['1'], ...fakeAo3([{ status: 404 }]) });
  expect(again.lost).toBe(0);
  expect(await db.ao3Works.get('1')).toMatchObject({ status: 'lost', lostFrom: 'progress' });
});

test('backs off on a rate limit, and gives up keeping what was checked', async () => {
  const limited = { status: 429 };
  const ao3 = fakeAo3([{ status: 404 }, limited, limited, limited]);
  await expect(runRefresh({ ids: ['1', '2'], ...ao3 })).rejects.toThrow(/rate-limiting/);
  expect(ao3.waits).toEqual([REFRESH_DELAY_MS, ...BACKOFF_MS]);
  expect((await db.ao3Works.get('1'))?.status).toBe('lost');
});

test('picks the most overdue works, completed ones far less often, never deleted ones', () => {
  const now = 100 * DUE_AFTER.completed;
  const work = (id: string, ago: number | null, done: boolean, status: Ao3Work['status'] = 'progress') =>
    ({
      id,
      status,
      chaptersPosted: done ? 3 : 2,
      chaptersTotal: 3,
      refreshedAt: ago === null ? undefined : now - ago,
    }) as Ao3Work;
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
