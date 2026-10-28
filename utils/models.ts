export const STATUSES = ['want', 'progress', 'completed', 'rereading', 'onhold', 'dnf', 'lost'] as const;
export type Status = (typeof STATUSES)[number];

// 'lost' is set by the deleted-work check, not picked by hand.
export const PICKABLE_STATUSES = STATUSES.filter((s) => s !== 'lost');

export const STATUS_LABELS: Record<Status, string> = {
  want: 'For Later',
  progress: 'Reading',
  completed: 'Completed',
  rereading: 'Re-reading',
  onhold: 'On Hold',
  dnf: 'Did Not Finish',
  lost: 'Deleted',
};

export interface ChapterProgress {
  num: number;
  id?: string;
  total?: number;
  title?: string;
}

// Timestamps are epoch milliseconds.
export interface Ao3Work {
  id: string;
  title: string;
  author: string;
  authorUrl: string | null;
  url: string;
  status: Status;
  addedAt: number;
  movedAt: number;
  finishedAt?: number | null;
  summary?: string;
  notes?: string;
  rating?: number;
  fandoms?: string[];
  relationship?: string;
  seriesTitle?: string;
  seriesUrl?: string | null;
  seriesPosition?: string;
  wordCount?: number | null;
  chaptersPosted?: number | null;
  // null when AO3 shows the total as "?".
  chaptersTotal?: number | null;
  // AO3 chapter ids in reading order, from the chapter dropdown on a chapter page.
  chapterIds?: string[];
  kudosCount?: number | null;
  bookmarksCount?: number | null;
  hitsCount?: number | null;
  publishedAt?: number | null;
  updatedAt?: number | null;
  completedAt?: number | null;
  inferredCompletedAt?: number | null;
  subscribedAtAo3?: boolean | null;
  furthestChapter?: ChapterProgress;
  // Set by the user while on the last posted chapter without having finished it.
  // Cleared whenever the current chapter changes.
  lastChapterUnfinished?: boolean;
  // Last time the work's AO3 page was read (viewed, or by the background refresh).
  refreshedAt?: number;
  lostFrom?: Status;
  lostAt?: number;
}
