import { db } from './db';
import type { Ao3Work, Status } from './models';

export type Ao3WorkInput = Pick<Ao3Work, 'id' | 'title' | 'author' | 'url'> & Partial<Ao3Work>;

export async function getAo3Work(id: string): Promise<Ao3Work | null> {
  return (await db.ao3Works.get(id)) ?? null;
}

// Merges input over the stored work. A work is tracked by giving it a status, so with no
// status in the input or the stored work nothing is saved and this returns null.
export async function saveAo3Work(input: Ao3WorkInput, now = Date.now()): Promise<Ao3Work | null> {
  return db.transaction('rw', db.ao3Works, async () => {
    const prev = await db.ao3Works.get(input.id);
    const status = input.status ?? prev?.status;
    if (!status) return null;
    const work: Ao3Work = { authorUrl: null, addedAt: now, movedAt: now, ...prev, ...input, status };
    if (prev && prev.status !== status) work.movedAt = now;
    if (status === 'completed' && prev?.status !== 'completed') work.finishedAt = now;
    await db.ao3Works.put(work);
    return work;
  });
}

export async function removeAo3Work(id: string): Promise<void> {
  await db.ao3Works.delete(id);
}

export async function setAo3Statuses(ids: string[], status: Status, now = Date.now()): Promise<void> {
  await db.transaction('rw', db.ao3Works, async () => {
    for (const w of await db.ao3Works.bulkGet(ids)) if (w) await saveAo3Work({ ...w, status }, now);
  });
}

export async function removeAo3Works(ids: string[]): Promise<void> {
  await db.ao3Works.bulkDelete(ids);
}

// Adds the works that aren't in the library yet, with the given status. Works already in
// the library are left completely untouched, so running an import again changes nothing.
// Returns how many were added.
export async function addAo3WorksIfMissing(works: Ao3WorkInput[], status: Status, now = Date.now()): Promise<number> {
  return db.transaction('rw', db.ao3Works, async () => {
    const existing = await db.ao3Works.bulkGet(works.map((w) => w.id));
    const fresh = works
      .filter((_, i) => !existing[i])
      .map((w): Ao3Work => ({ authorUrl: null, ...w, status, addedAt: now, movedAt: now }));
    await db.ao3Works.bulkAdd(fresh);
    return fresh.length;
  });
}
