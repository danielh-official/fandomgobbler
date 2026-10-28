import 'fake-indexeddb/auto';
import { beforeEach, expect, test } from 'vitest';
import { db } from './db';
import { getAo3Work, removeAo3Work, saveAo3Work } from './library';

const base = { id: '1', title: 'T', author: 'A', url: 'https://archiveofourown.org/works/1' };

beforeEach(() => db.ao3Works.clear());

test('new work gets defaults and timestamps', async () => {
  const w = await saveAo3Work({ ...base, status: 'want' }, 100);
  expect(w).toMatchObject({ status: 'want', customCats: [], authorUrl: null, addedAt: 100, movedAt: 100 });
  expect(await getAo3Work('1')).toEqual(w);
});

test('movedAt changes only when status or categories change', async () => {
  await saveAo3Work({ ...base, status: 'want' }, 100);
  expect((await saveAo3Work({ ...base, notes: 'n' }, 200))?.movedAt).toBe(100);
  expect((await saveAo3Work({ ...base, status: 'progress' }, 300))?.movedAt).toBe(300);
  expect((await saveAo3Work({ ...base, customCats: ['c', 'c'] }, 400))).toMatchObject({ movedAt: 400, customCats: ['c'], addedAt: 100 });
});

test('finishedAt is stamped only on moving into completed', async () => {
  await saveAo3Work({ ...base, status: 'progress' }, 100);
  expect((await saveAo3Work({ ...base, status: 'completed' }, 200))?.finishedAt).toBe(200);
  expect((await saveAo3Work({ ...base, notes: 'x' }, 300))?.finishedAt).toBe(200);
});

test('no status and no category deletes the work', async () => {
  await saveAo3Work({ ...base, status: 'want', customCats: ['c'] }, 100);
  expect(await saveAo3Work({ ...base, status: '' }, 200)).not.toBeNull();
  expect(await saveAo3Work({ ...base, customCats: [] }, 300)).toBeNull();
  expect(await getAo3Work('1')).toBeNull();
});

test('removeAo3Work', async () => {
  await saveAo3Work({ ...base, status: 'want' });
  await removeAo3Work('1');
  expect(await db.ao3Works.count()).toBe(0);
});
