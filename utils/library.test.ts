import 'fake-indexeddb/auto';
import { beforeEach, expect, test } from 'vitest';
import { db } from './db';
import { getAo3Work, removeAo3Work, saveAo3Work } from './library';

const base = { id: '1', title: 'T', author: 'A', url: 'https://archiveofourown.org/works/1' };

beforeEach(() => db.ao3Works.clear());

test('new work gets defaults and timestamps', async () => {
  const w = await saveAo3Work({ ...base, status: 'want' }, 100);
  expect(w).toMatchObject({ status: 'want', authorUrl: null, addedAt: 100, movedAt: 100 });
  expect(await getAo3Work('1')).toEqual(w);
});

test('movedAt changes only when status changes', async () => {
  await saveAo3Work({ ...base, status: 'want' }, 100);
  expect(await saveAo3Work({ ...base, notes: 'n' }, 200)).toMatchObject({ movedAt: 100, status: 'want' });
  expect(await saveAo3Work({ ...base, status: 'progress' }, 300)).toMatchObject({ movedAt: 300, addedAt: 100 });
});

test('finishedAt is stamped only on moving into completed', async () => {
  await saveAo3Work({ ...base, status: 'progress' }, 100);
  expect((await saveAo3Work({ ...base, status: 'completed' }, 200))?.finishedAt).toBe(200);
  expect((await saveAo3Work({ ...base, notes: 'x' }, 300))?.finishedAt).toBe(200);
});

test('a work without a status is not saved', async () => {
  expect(await saveAo3Work(base)).toBeNull();
  expect(await db.ao3Works.count()).toBe(0);
});

test('removeAo3Work', async () => {
  await saveAo3Work({ ...base, status: 'want' });
  await removeAo3Work('1');
  expect(await db.ao3Works.count()).toBe(0);
});
