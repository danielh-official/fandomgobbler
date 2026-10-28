export const STATUSES = ['want', 'progress', 'completed', 'rereading', 'onhold', 'dnf', 'lost'] as const;
export type Status = (typeof STATUSES)[number];

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
  // '' is allowed only while the work is in at least one custom category.
  status: Status | '';
  customCats: string[];
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
  kudosCount?: number | null;
  bookmarksCount?: number | null;
  hitsCount?: number | null;
  publishedAt?: number | null;
  updatedAt?: number | null;
  completedAt?: number | null;
  inferredCompletedAt?: number | null;
  subscribedAtAo3?: boolean | null;
  furthestChapter?: ChapterProgress;
  lostFrom?: Status | '';
  lostAt?: number;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}
