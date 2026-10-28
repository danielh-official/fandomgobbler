import { STATUSES, type Ao3Work, type Status } from './models';

type Compare = (a: Ao3Work, b: Ao3Work) => number;
type NumberOf = (w: Ao3Work) => number | null | undefined;

const cmp = (a: number, b: number) => (a === b ? 0 : a < b ? -1 : 1);
// Missing values sort last in both directions.
const desc = (f: NumberOf): Compare => (a, b) => cmp(f(b) ?? -Infinity, f(a) ?? -Infinity);
const asc = (f: NumberOf): Compare => (a, b) => cmp(f(a) ?? Infinity, f(b) ?? Infinity);
const matchesFirst = (pred: (w: Ao3Work) => boolean): Compare => (a, b) => Number(!pred(a)) - Number(!pred(b));
const byTitle: Compare = (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
const chain = (...cs: Compare[]): Compare => (a, b) => {
  for (const c of cs) {
    const r = c(a, b);
    if (r) return r;
  }
  return 0;
};

const popularity = (w: Ao3Work) =>
  3 * Math.log1p(w.kudosCount ?? 0) + 4 * Math.log1p(w.bookmarksCount ?? 0) + Math.log1p(w.hitsCount ?? 0);
const unread = (w: Ao3Work) => !['completed', 'dnf', 'lost'].includes(w.status);
const added = desc((w) => w.addedAt);

// Posted chapters past the current chapter; null when the chapter count isn't known.
export const unreadChapters = (w: Ao3Work) =>
  w.chaptersPosted == null ? null : Math.max(0, w.chaptersPosted - (w.furthestChapter?.num ?? 0));
// AO3 shows "Updated" while in progress, "Completed" once done, only "Published" for one-shots.
export const lastUpdated = (w: Ao3Work) => w.updatedAt ?? w.completedAt ?? w.publishedAt ?? null;
export const isOngoing = (w: Ao3Work) => w.chaptersTotal == null || (w.chaptersPosted ?? 0) < w.chaptersTotal;

export const SORTS = {
  'recently-added': { label: 'Recently added', compare: chain(added, desc((w) => w.movedAt)) },
  'recently-moved': { label: 'Recently changed status', compare: chain(desc((w) => w.movedAt), added) },
  'recently-updated': { label: 'Recently updated on AO3', compare: chain(desc(lastUpdated), added) },
  title: { label: 'Title', compare: chain(byTitle, added) },
  'most-unread-chapters': { label: 'Most unread chapters', compare: chain(desc(unreadChapters), added) },
  'most-popular': { label: 'Most popular', compare: chain(desc(popularity), added) },
  'most-kudos': { label: 'Most kudos', compare: chain(desc((w) => w.kudosCount), added) },
  'most-bookmarked': { label: 'Most bookmarked', compare: chain(desc((w) => w.bookmarksCount), added) },
  'most-hits': { label: 'Most hits', compare: chain(desc((w) => w.hitsCount), added) },
  'oldest-for-later': {
    label: 'Oldest in For Later',
    compare: chain(matchesFirst((w) => w.status === 'want'), asc((w) => w.addedAt), byTitle),
  },
  'longest-unread': { label: 'Longest unread', compare: chain(matchesFirst(unread), desc((w) => w.wordCount), byTitle) },
  'shortest-unread': { label: 'Shortest unread', compare: chain(matchesFirst(unread), asc((w) => w.wordCount), byTitle) },
  'highest-rated': {
    label: 'Highest rated by me',
    compare: chain(desc((w) => w.rating), desc((w) => w.completedAt ?? w.inferredCompletedAt), added),
  },
} satisfies Record<string, { label: string; compare: Compare }>;

export type SortKey = keyof typeof SORTS;

export interface LibraryFilter {
  status: Status | 'all';
  query: string;
}

export function viewLibrary(works: Ao3Work[], filter: LibraryFilter, sort: SortKey): Ao3Work[] {
  const q = filter.query.trim().toLowerCase();
  return works
    .filter(
      (w) =>
        (filter.status === 'all' || w.status === filter.status) &&
        (!q ||
          [w.title, w.author, w.relationship, w.notes, ...(w.fandoms ?? [])].some((s) => s?.toLowerCase().includes(q))),
    )
    .sort(SORTS[sort].compare);
}

export function statusCounts(works: Ao3Work[]): Record<Status, number> {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  for (const w of works) counts[w.status]++;
  return counts;
}
