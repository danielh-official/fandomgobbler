import type { Platform } from './platforms';

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

// A work in the library, from any platform. One table holds them all; a work is
// identified by its platform plus that platform's id (ids alone repeat across platforms).
// Fields a platform doesn't have stay unset. Timestamps are epoch milliseconds.
export interface Work {
  platform: Platform;
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
  // null when the platform shows no planned total (AO3's "?").
  chaptersTotal?: number | null;
  // AO3 only: chapter ids in reading order, from the chapter dropdown on a chapter page.
  chapterIds?: string[];
  kudosCount?: number | null;
  bookmarksCount?: number | null;
  hitsCount?: number | null;
  publishedAt?: number | null;
  updatedAt?: number | null;
  completedAt?: number | null;
  inferredCompletedAt?: number | null;
  // AO3 only.
  subscribedAtAo3?: boolean | null;
  furthestChapter?: ChapterProgress;
  // Set by the user while on the last posted chapter without having finished it.
  // Cleared whenever the current chapter changes.
  lastChapterUnfinished?: boolean;
  // Last time the work's page was read (viewed, or by the background refresh).
  refreshedAt?: number;
  lostFrom?: Status;
  lostAt?: number;
}

// What identifies a work: its platform and that platform's id.
export type WorkRef = Pick<Work, 'platform' | 'id'>;

// One string per work for selections, links and lookups.
export const workKey = (w: WorkRef) => `${w.platform}:${w.id}`;
export const parseWorkKey = (key: string): WorkRef => {
  const i = key.indexOf(':');
  return { platform: key.slice(0, i) as Platform, id: key.slice(i + 1) };
};
