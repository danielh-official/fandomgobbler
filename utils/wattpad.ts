import type { WorkInput } from './library';
import type { Work } from './models';

// Wattpad. Its pages are drawn by scripts, so works are read from Wattpad's JSON API
// (undocumented but what its own site uses; checked live 2026-10-29). Reading pages are
// per part (wattpad.com/<partId>-slug); a part's story id is in the page's embedded data
// ("group":{"id":...}) or one API lookup away.

export const WATTPAD_ORIGIN = 'https://www.wattpad.com';

const STORY_FIELDS =
  'id,title,user(name,username),description,url,completed,numParts,createDate,lastPublishedPart(createDate),' +
  'voteCount,readCount,commentCount,tags,deleted,parts(id,wordCount)';

export const wattpadApiUrl = (id: string) => `${WATTPAD_ORIGIN}/api/v3/stories/${id}?fields=${STORY_FIELDS}`;
export const wattpadPartApiUrl = (partId: string) => `${WATTPAD_ORIGIN}/api/v3/story_parts/${partId}?fields=groupId`;

const isWattpad = (u: URL) => /^(www\.|m\.)?wattpad\.com$/.test(u.hostname);

// Story id from a story URL (/story/123-slug). Part URLs need the page or a lookup.
export function wattpadWorkId(url: string): string | null {
  try {
    const u = new URL(url);
    return isWattpad(u) ? (u.pathname.match(/^\/story\/(\d+)/)?.[1] ?? null) : null;
  } catch {
    return null;
  }
}

// Part id from a reading-page URL (/123-slug or /123).
export function wattpadPartId(url: string): string | null {
  try {
    const u = new URL(url);
    return isWattpad(u) ? (u.pathname.match(/^\/(\d+)(-|$)/)?.[1] ?? null) : null;
  } catch {
    return null;
  }
}

// The story id a reading page embeds in its data.
export const wattpadPageWorkId = (html: string) => html.match(/"group":\{"id":"(\d+)"/)?.[1] ?? null;

// Parts have their own ids, so a chapter link needs the stored part ids.
export function wattpadChapterUrl(w: Pick<Work, 'id' | 'chapterIds' | 'furthestChapter'>): string {
  const n = Math.max(1, w.furthestChapter?.num ?? 1);
  const partId = w.chapterIds?.[n - 1];
  return partId ? `${WATTPAD_ORIGIN}/${partId}` : `${WATTPAD_ORIGIN}/story/${w.id}`;
}

function json(body: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(body);
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// The API answered (any JSON, errors included), as opposed to an outage page.
export const looksLikeWattpad = (body: string) => json(body) !== null || /<meta[^>]+Wattpad/i.test(body);

// "Story not found" (error 1017, status 400) or a story flagged deleted.
export function isWattpadGone(body: string): boolean {
  const data = json(body);
  return data?.error_code === 1017 || data?.deleted === true;
}

interface ApiStory {
  id: string;
  title: string;
  user?: { name?: string; username?: string };
  description?: string;
  url?: string;
  completed?: boolean;
  numParts?: number;
  createDate?: string;
  lastPublishedPart?: { createDate?: string };
  voteCount?: number;
  readCount?: number;
  commentCount?: number;
  tags?: string[];
  parts?: { id: number; wordCount?: number }[];
}

const time = (s: string | undefined) => (s ? Date.parse(s) || null : null);

// Returns null for anything but a story from the API (an HTML page, an error).
export function parseWattpadWork(body: string, id: string): WorkInput | null {
  const s = json(body) as ApiStory | null;
  if (!s?.title || String(s.id) !== id) return null;
  const parts = s.parts ?? [];
  const chaptersPosted = s.numParts ?? parts.length;
  const lastPart = time(s.lastPublishedPart?.createDate);
  return {
    platform: 'wattpad',
    id,
    title: s.title,
    author: s.user?.name || s.user?.username || 'Anonymous',
    authorUrl: s.user?.username ? `${WATTPAD_ORIGIN}/user/${s.user.username}` : null,
    url: s.url ?? `${WATTPAD_ORIGIN}/story/${id}`,
    summary: s.description?.trim() ?? '',
    tags: s.tags ?? [],
    wordCount: parts.reduce((n, p) => n + (p.wordCount ?? 0), 0) || null,
    chaptersPosted,
    // No planned total on Wattpad: known only once the story is marked complete.
    chaptersTotal: s.completed ? chaptersPosted : null,
    chapterIds: parts.map((p) => String(p.id)),
    votesCount: s.voteCount ?? null,
    readsCount: s.readCount ?? null,
    commentsCount: s.commentCount ?? null,
    publishedAt: time(s.createDate),
    updatedAt: s.completed ? null : lastPart,
    completedAt: s.completed ? lastPart : null,
  };
}
