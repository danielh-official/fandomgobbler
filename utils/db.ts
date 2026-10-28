import Dexie, { type EntityTable } from 'dexie';
import type { Ao3Work, Category } from './models';

// Opened from extension pages (side panel, dashboard). Never from a content script:
// there IndexedDB would belong to the host site, not the extension.
export const db = new Dexie('fandomgobbler') as Dexie & {
  ao3Works: EntityTable<Ao3Work, 'id'>;
  ao3Categories: EntityTable<Category, 'id'>;
};

db.version(1).stores({
  ao3Works: 'id, status, *customCats, addedAt, movedAt',
  ao3Categories: 'id, name',
});
