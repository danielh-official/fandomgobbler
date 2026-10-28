import { db } from './db';
import type { Ao3Work, Category } from './models';

export type Ao3WorkInput = Pick<Ao3Work, 'id' | 'title' | 'author' | 'url'> & Partial<Ao3Work>;

export async function getAo3Work(id: string): Promise<Ao3Work | null> {
  return (await db.ao3Works.get(id)) ?? null;
}

// Merges input over the stored work. A work with no status and no category isn't
// tracked, so saving it that way deletes it and returns null.
export async function saveAo3Work(input: Ao3WorkInput, now = Date.now()): Promise<Ao3Work | null> {
  return db.transaction('rw', db.ao3Works, async () => {
    const prev = await db.ao3Works.get(input.id);
    const work: Ao3Work = {
      status: '',
      authorUrl: null,
      addedAt: now,
      movedAt: now,
      ...prev,
      ...input,
      customCats: [...new Set(input.customCats ?? prev?.customCats ?? [])],
    };
    if (!work.status && !work.customCats.length) {
      await db.ao3Works.delete(work.id);
      return null;
    }
    const moved =
      !prev ||
      prev.status !== work.status ||
      prev.customCats.length !== work.customCats.length ||
      prev.customCats.some((c) => !work.customCats.includes(c));
    if (moved && prev) work.movedAt = now;
    if (work.status === 'completed' && prev?.status !== 'completed') work.finishedAt = now;
    await db.ao3Works.put(work);
    return work;
  });
}

export async function removeAo3Work(id: string): Promise<void> {
  await db.ao3Works.delete(id);
}

export async function createAo3Category(name: string, color: string, now = Date.now()): Promise<Category> {
  const category = { id: crypto.randomUUID(), name: name.trim(), color, createdAt: now };
  await db.ao3Categories.add(category);
  return category;
}
