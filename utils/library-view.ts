import { STATUSES, type Work, type Status } from './models';
import type { Platform } from './platforms';

// Posted chapters past the current chapter; null when the chapter count isn't known.
// A last chapter marked "not finished yet" still counts as 1.
export const unreadChapters = (w: Pick<Work, 'chaptersPosted' | 'furthestChapter' | 'lastChapterUnfinished'>) => {
  if (w.chaptersPosted == null) return null;
  const left = Math.max(0, w.chaptersPosted - (w.furthestChapter?.num ?? 0));
  return left === 0 && w.lastChapterUnfinished ? 1 : left;
};
// Latest of the platform dates: updated while in progress, completed once done, only
// published for one-shots.
export const lastUpdated = (w: Pick<Work, 'updatedAt' | 'completedAt' | 'publishedAt'>) =>
  w.updatedAt ?? w.completedAt ?? w.publishedAt ?? null;
export const isOngoing = (w: Pick<Work, 'chaptersPosted' | 'chaptersTotal'>) =>
  w.chaptersTotal == null || (w.chaptersPosted ?? 0) < w.chaptersTotal;

export interface LibraryFilter {
  status: Status | 'all';
  query: string;
  fandom?: string;
  author?: string;
  // Only works with at least one posted chapter past the current one.
  unreadOnly?: boolean;
  hiddenPlatforms?: Platform[];
}

// Co-authors are stored joined with ", " (as AO3 shows them; pseuds can't contain commas).
export const authorsOf = (w: Work) => w.author.split(', ');

// Filtered library, most recently updated on its platform first. Works without a known date go
// last, most recently added first.
export function viewLibrary(works: Work[], filter: LibraryFilter): Work[] {
  const q = filter.query.trim().toLowerCase();
  return works
    .filter(
      (w) =>
        !filter.hiddenPlatforms?.includes(w.platform) &&
        (filter.status === 'all' || w.status === filter.status) &&
        (!filter.fandom || (w.fandoms ?? []).includes(filter.fandom)) &&
        (!filter.author || authorsOf(w).includes(filter.author)) &&
        (!filter.unreadOnly || (unreadChapters(w) ?? 0) > 0) &&
        (!q ||
          [w.title, w.author, w.relationship, w.notes, ...(w.fandoms ?? [])].some((s) => s?.toLowerCase().includes(q))),
    )
    .sort((a, b) => (lastUpdated(b) ?? -Infinity) - (lastUpdated(a) ?? -Infinity) || b.addedAt - a.addedAt);
}

export function statusCounts(works: Work[]): Record<Status, number> {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  for (const w of works) counts[w.status]++;
  return counts;
}

// Values across the library with how many works have each, most works first.
export function valueCounts(works: Work[], valuesOf: (w: Work) => string[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const w of works) for (const v of valuesOf(w)) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export const inStatus = (works: Work[], status: Status | 'all') =>
  status === 'all' ? works : works.filter((w) => w.status === status);

// Works passing the first-tier filters (status, unread only); the fandom and author
// options are built from these.
export const firstTier = (works: Work[], status: Status | 'all', unreadOnly: boolean) =>
  inStatus(works, status).filter((w) => !unreadOnly || (unreadChapters(w) ?? 0) > 0);
