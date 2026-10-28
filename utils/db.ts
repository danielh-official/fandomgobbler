import Dexie, { type EntityTable } from 'dexie';
import type { Ao3Work } from './models';

// Opened from extension pages (side panel, dashboard). Never from a content script:
// there IndexedDB would belong to the host site, not the extension.
export const db = new Dexie('fandomgobbler') as Dexie & {
  ao3Works: EntityTable<Ao3Work, 'id'>;
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
