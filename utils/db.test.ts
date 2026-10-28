import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { expect, test } from 'vitest';

test('v2 upgrade drops categories and statusless works', async () => {
  const v1 = new Dexie('fandomgobbler');
  v1.version(1).stores({ ao3Works: 'id, status, *customCats, addedAt, movedAt', ao3Categories: 'id, name' });
  await v1.table('ao3Works').bulkAdd([
    { id: '1', status: 'want', customCats: ['c'] },
    { id: '2', status: '', customCats: ['c'] },
  ]);
  await v1.table('ao3Categories').add({ id: 'c', name: 'Faves' });
  v1.close();

  // Imported after the v1 database exists, so opening it runs the upgrade.
  const { db } = await import('./db');
  expect(await db.ao3Works.toArray()).toEqual([{ id: '1', status: 'want' }]);
  expect(db.tables.map((t) => t.name)).toEqual(['ao3Works']);
});
