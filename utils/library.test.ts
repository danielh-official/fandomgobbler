import 'fake-indexeddb/auto';
import { beforeEach, expect, test } from 'vitest';
import { db } from './db';
import {
  addAo3WorksIfMissing,
  getAo3Work,
  removeAo3Work,
  removeAo3Works,
  saveAo3Work,
  setAo3Statuses,
} from './library';

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

test('bulk status and remove', async () => {
  await saveAo3Work({ ...base, id: '1', status: 'want' }, 100);
  await saveAo3Work({ ...base, id: '2', status: 'completed' }, 100);
  await setAo3Statuses(['1', '2', 'missing'], 'completed', 200);
  expect(await getAo3Work('1')).toMatchObject({ status: 'completed', movedAt: 200, finishedAt: 200 });
  expect(await getAo3Work('2')).toMatchObject({ movedAt: 100 });
  expect(await getAo3Work('missing')).toBeNull();
  await removeAo3Works(['1', '2']);
  expect(await db.ao3Works.count()).toBe(0);
});

test('addAo3WorksIfMissing adds new works and leaves existing ones untouched', async () => {
  const mine = await saveAo3Work(
    { ...base, id: '1', status: 'progress', notes: 'mine', rating: 4, kudosCount: 5, furthestChapter: { num: 2 } },
    100,
  );
  const imported = [
    { ...base, id: '1', title: 'Renamed on AO3', kudosCount: 999 },
    { ...base, id: '2', kudosCount: 7 },
  ];
  expect(await addAo3WorksIfMissing(imported, 'want', 200)).toBe(1);
  expect(await getAo3Work('1')).toEqual(mine);
  expect(await getAo3Work('2')).toMatchObject({ status: 'want', addedAt: 200, movedAt: 200, kudosCount: 7 });

  // Running the same import again changes nothing.
  const before = await db.ao3Works.toArray();
  expect(await addAo3WorksIfMissing(imported, 'completed', 300)).toBe(0);
  expect(await db.ao3Works.toArray()).toEqual(before);
});
