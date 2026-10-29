import 'fake-indexeddb/auto';
import { beforeEach, expect, test } from 'vitest';
import { db } from './db';
import { addWorksIfMissing, getWork, removeWork, removeWorks, saveWork, setStatuses } from './library';

const base = { platform: 'ao3' as const, id: '1', title: 'T', author: 'A', url: 'https://archiveofourown.org/works/1' };

beforeEach(() => db.works.clear());

test('new work gets defaults and timestamps', async () => {
  const w = await saveWork({ ...base, status: 'want' }, 100);
  expect(w).toMatchObject({ status: 'want', authorUrl: null, addedAt: 100, movedAt: 100 });
  expect(await getWork({ platform: 'ao3', id: '1' })).toEqual(w);
});

test('movedAt changes only when status changes', async () => {
  await saveWork({ ...base, status: 'want' }, 100);
  expect(await saveWork({ ...base, notes: 'n' }, 200)).toMatchObject({ movedAt: 100, status: 'want' });
  expect(await saveWork({ ...base, status: 'progress' }, 300)).toMatchObject({ movedAt: 300, addedAt: 100 });
});

test('finishedAt is stamped only on moving into completed', async () => {
  await saveWork({ ...base, status: 'progress' }, 100);
  expect((await saveWork({ ...base, status: 'completed' }, 200))?.finishedAt).toBe(200);
  expect((await saveWork({ ...base, notes: 'x' }, 300))?.finishedAt).toBe(200);
});

test('a work without a status is not saved', async () => {
  expect(await saveWork(base)).toBeNull();
  expect(await db.works.count()).toBe(0);
});

test('removeWork', async () => {
  await saveWork({ ...base, status: 'want' });
  await removeWork(base);
  expect(await db.works.count()).toBe(0);
});

test('bulk status and remove', async () => {
  await saveWork({ ...base, id: '1', status: 'want' }, 100);
  await saveWork({ ...base, id: '2', status: 'completed' }, 100);
  await setStatuses(['ao3:1', 'ao3:2', 'ao3:missing'], 'completed', 200);
  expect(await getWork({ platform: 'ao3', id: '1' })).toMatchObject({
    status: 'completed',
    movedAt: 200,
    finishedAt: 200,
  });
  expect(await getWork({ platform: 'ao3', id: '2' })).toMatchObject({ movedAt: 100 });
  expect(await getWork({ platform: 'ao3', id: 'missing' })).toBeNull();
  await removeWorks(['ao3:1', 'ao3:2']);
  expect(await db.works.count()).toBe(0);
});

test('addWorksIfMissing adds new works and leaves existing ones untouched', async () => {
  const mine = await saveWork(
    { ...base, id: '1', status: 'progress', notes: 'mine', rating: 4, kudosCount: 5, furthestChapter: { num: 2 } },
    100,
  );
  const imported = [
    { ...base, id: '1', title: 'Renamed on AO3', kudosCount: 999 },
    { ...base, id: '2', kudosCount: 7 },
  ];
  expect(await addWorksIfMissing(imported, 'want', 200)).toBe(1);
  expect(await getWork({ platform: 'ao3', id: '1' })).toEqual(mine);
  expect(await getWork({ platform: 'ao3', id: '2' })).toMatchObject({
    status: 'want',
    addedAt: 200,
    movedAt: 200,
    kudosCount: 7,
  });

  // Running the same import again changes nothing.
  const before = await db.works.toArray();
  expect(await addWorksIfMissing(imported, 'completed', 300)).toBe(0);
  expect(await db.works.toArray()).toEqual(before);
});
