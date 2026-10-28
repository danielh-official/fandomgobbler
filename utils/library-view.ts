import { STATUSES, type Ao3Work, type Status } from './models';

// Posted chapters past the current chapter; null when the chapter count isn't known.
export const unreadChapters = (w: Ao3Work) =>
  w.chaptersPosted == null ? null : Math.max(0, w.chaptersPosted - (w.furthestChapter?.num ?? 0));
// AO3 shows "Updated" while in progress, "Completed" once done, only "Published" for one-shots.
export const lastUpdated = (w: Ao3Work) => w.updatedAt ?? w.completedAt ?? w.publishedAt ?? null;
export const isOngoing = (w: Ao3Work) => w.chaptersTotal == null || (w.chaptersPosted ?? 0) < w.chaptersTotal;

export interface LibraryFilter {
  status: Status | 'all';
  query: string;
  fandom?: string;
  author?: string;
}

// AO3 joins co-authors with ", "; pseuds can't contain commas.
export const authorsOf = (w: Ao3Work) => w.author.split(', ');

// Filtered library, most recently added first.
export function viewLibrary(works: Ao3Work[], filter: LibraryFilter): Ao3Work[] {
  const q = filter.query.trim().toLowerCase();
  return works
    .filter(
      (w) =>
        (filter.status === 'all' || w.status === filter.status) &&
        (!filter.fandom || (w.fandoms ?? []).includes(filter.fandom)) &&
        (!filter.author || authorsOf(w).includes(filter.author)) &&
        (!q ||
          [w.title, w.author, w.relationship, w.notes, ...(w.fandoms ?? [])].some((s) => s?.toLowerCase().includes(q))),
    )
    .sort((a, b) => b.addedAt - a.addedAt);
}

export function statusCounts(works: Ao3Work[]): Record<Status, number> {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  for (const w of works) counts[w.status]++;
  return counts;
}

// Values across the library with how many works have each, most works first.
export function valueCounts(works: Ao3Work[], valuesOf: (w: Ao3Work) => string[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const w of works) for (const v of valuesOf(w)) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export const inStatus = (works: Ao3Work[], status: Status | 'all') =>
  status === 'all' ? works : works.filter((w) => w.status === status);
