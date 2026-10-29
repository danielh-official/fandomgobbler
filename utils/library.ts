import { db } from './db';
import { parseWorkKey, type Status, type Work, type WorkRef } from './models';

// A work as read from a page: enough to identify and show it, before it's tracked.
export type WorkInput = Pick<Work, 'platform' | 'id' | 'title' | 'author' | 'url'> & Partial<Work>;

const key = (w: WorkRef): [Work['platform'], string] => [w.platform, w.id];

export async function getWork(ref: WorkRef): Promise<Work | null> {
  return (await db.works.get(key(ref))) ?? null;
}

// The whole library, every platform. For liveQuery.
export const readLibrary = (): Promise<Work[]> => db.works.toArray();

// Merges input over the stored work. A work is tracked by giving it a status, so with no
// status in the input or the stored work nothing is saved and this returns null.
export async function saveWork(input: WorkInput, now = Date.now()): Promise<Work | null> {
  return db.transaction('rw', db.works, async () => {
    const prev = await db.works.get(key(input));
    const status = input.status ?? prev?.status;
    if (!status) return null;
    const work: Work = { authorUrl: null, addedAt: now, movedAt: now, ...prev, ...input, status };
    if (prev && prev.status !== status) work.movedAt = now;
    if (status === 'completed' && prev?.status !== 'completed') work.finishedAt = now;
    await db.works.put(work);
    return work;
  });
}

export async function removeWork(ref: WorkRef): Promise<void> {
  await db.works.delete(key(ref));
}

// Bulk actions take workKey()s, as the dashboard selection holds them.
export async function setStatuses(keys: string[], status: Status, now = Date.now()): Promise<void> {
  await db.transaction('rw', db.works, async () => {
    for (const w of await db.works.bulkGet(keys.map((k) => key(parseWorkKey(k))))) {
      if (w) await saveWork({ ...w, status }, now);
    }
  });
}

export async function removeWorks(keys: string[]): Promise<void> {
  await db.works.bulkDelete(keys.map((k) => key(parseWorkKey(k))));
}

// Adds the works that aren't in the library yet, with the given status. Works already in
// the library are left completely untouched, so running an import again changes nothing.
// Returns how many were added.
export async function addWorksIfMissing(works: WorkInput[], status: Status, now = Date.now()): Promise<number> {
  return db.transaction('rw', db.works, async () => {
    const existing = await db.works.bulkGet(works.map(key));
    const fresh = works
      .filter((_, i) => !existing[i])
      .map((w): Work => ({ authorUrl: null, ...w, status, addedAt: now, movedAt: now }));
    await db.works.bulkAdd(fresh);
    return fresh.length;
  });
}

// Marks a tracked work as deleted from its platform, remembering its status. Untracked or
// already-deleted works are left alone.
export async function markWorkLost(ref: WorkRef, now = Date.now()): Promise<boolean> {
  return db.transaction('rw', db.works, async () => {
    const w = await db.works.get(key(ref));
    if (!w || w.status === 'lost') return false;
    await db.works.put({ ...w, status: 'lost', lostFrom: w.status, lostAt: now, movedAt: now });
    return true;
  });
}

// Records that a work's page was read without anything else to save.
export async function touchRefreshed(ref: WorkRef, at: number): Promise<void> {
  await db.works.update(key(ref), { refreshedAt: at });
}
