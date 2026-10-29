import Dexie, { type Table } from 'dexie';
import type { Platform } from './platforms';
import type { Work } from './models';

// Opened from extension pages (side panel, dashboard, offscreen document) and the
// background worker. Never from a content script: there IndexedDB would belong to the
// host site, not the extension.
export const db = new Dexie('fandomgobbler') as Dexie & {
  works: Table<Work, [Platform, string]>;
};

db.version(1).stores({
  ao3Works: 'id, status, *customCats, addedAt, movedAt',
  ao3Categories: 'id, name',
});

// Categories removed for now: a work is tracked exactly when it has a status.
db.version(2)
  .stores({ ao3Works: 'id, status, addedAt, movedAt', ao3Categories: null })
  .upgrade((tx) =>
    tx
      .table('ao3Works')
      .toCollection()
      .modify((work, ref) => {
        if (!work.status) delete ref.value;
        else delete work.customCats;
      }),
  );

// One table for every platform, keyed by platform + id. AO3 works move over as is.
db.version(3)
  .stores({ works: '[platform+id], platform, status, addedAt, movedAt' })
  .upgrade(async (tx) => {
    const ao3 = await tx.table('ao3Works').toArray();
    await tx.table('works').bulkAdd(ao3.map((w) => ({ ...w, platform: 'ao3' })));
  });

// Dropped in its own version, after v3 has copied it.
db.version(4).stores({ ao3Works: null });
