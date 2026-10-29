import type { WorkInput } from './library';
import type { Work } from './models';

// FanFiction.net. Story pages repeat the story's header on every chapter page, so any
// chapter's HTML is enough to read the whole story's details.

export const FFNET_ORIGIN = 'https://www.fanfiction.net';

// Story id from a story URL: /s/123, /s/123/4, /s/123/4/Slug, on www. or m.
export function ffnetWorkId(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/^(www\.|m\.)?fanfiction\.net$/.test(u.hostname)) return null;
    return u.pathname.match(/^\/s\/(\d+)/)?.[1] ?? null;
  } catch {
    return null;
  }
}

export const ffnetWorkUrl = (id: string) => `${FFNET_ORIGIN}/s/${id}/1/`;

// Chapters are numbered in the URL, so the current chapter needs no stored ids.
export const ffnetChapterUrl = (w: Pick<Work, 'id' | 'furthestChapter'>) =>
  `${FFNET_ORIGIN}/s/${w.id}/${Math.max(1, w.furthestChapter?.num ?? 1)}/`;

// A real FanFiction.net page, as opposed to Cloudflare's "Just a moment" check or an
// outage page: every site page has the zmenu bar.
export const looksLikeFfnet = (html: string) => /class=["']?zmenu/.test(html) && !/<title>Just a moment/i.test(html);

// A deleted or hidden story is a normal 200 page with this warning.
export const isFfnetGone = (html: string) => /class="gui_warning"[^>]*>\s*Story Not Found/.test(html);

const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
const count = (s: string | undefined) => (s ? Number(s.replace(/,/g, '')) || null : null);

// Returns null when the HTML has no story on it.
export function parseFfnetWork(html: string, id: string): WorkInput | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const top = doc.querySelector('#profile_top');
  const title = text(top?.querySelector('b.xcontrast_txt'));
  if (!top || !title) return null;

  const authorLink = top.querySelector('a[href^="/u/"]');
  const statsEl = top.querySelector('span.xgray');
  // "Rated: Fiction T - English - Drama/Humor - Harry P., Hermione G. - Chapters: 122 - ..."
  const parts = text(statsEl)
    .split(' - ')
    .map((p) => p.trim());
  const field = (name: string) => parts.find((p) => p.startsWith(`${name}: `))?.slice(name.length + 2);
  // The unlabelled parts after the language: genres (optional, "A/B"), then characters.
  const unlabelled = parts.slice(2).filter((p) => !/^[A-Z][a-z]+: /.test(p));
  const genreLike = (p: string) => /^[A-Z][A-Za-z-]+(\/[A-Z][A-Za-z-]+)*$/.test(p);
  const genres = unlabelled[0] && genreLike(unlabelled[0]) ? unlabelled[0] : undefined;
  const characters = unlabelled.find((p) => p !== genres);

  // Dates carry exact epoch seconds; the visible text can be relative ("1m").
  const dates = [...(statsEl?.querySelectorAll('span[data-xutime]') ?? [])].map(
    (s) => Number(s.getAttribute('data-xutime')) * 1000,
  );
  const hasUpdated = parts.some((p) => p.startsWith('Updated: '));
  const updatedAt = hasUpdated ? (dates[0] ?? null) : null;
  const publishedAt = (hasUpdated ? dates[1] : dates[0]) ?? null;

  // One-shots have no "Chapters:" field. No planned total exists, so the total is only
  // known once the story is marked complete.
  const chaptersPosted = count(field('Chapters')) ?? 1;
  const complete = field('Status') === 'Complete';

  // Breadcrumb: "Books > Harry Potter", or one "Harry Potter + Naruto Crossover" link.
  const crumbs = [...doc.querySelectorAll('#pre_story_links a')].map(text);
  const last = crumbs.at(-1) ?? '';
  const fandoms = last.endsWith(' Crossover') ? last.slice(0, -' Crossover'.length).split(' + ') : last ? [last] : [];

  return {
    platform: 'ffnet',
    id,
    title,
    author: text(authorLink) || 'Anonymous',
    authorUrl: authorLink ? new URL(authorLink.getAttribute('href')!, FFNET_ORIGIN).href : null,
    url: `${FFNET_ORIGIN}/s/${id}/1/`,
    summary: text(top.querySelector('div.xcontrast_txt[style*="margin-top"]')),
    fandoms,
    genres,
    characters,
    wordCount: count(field('Words')),
    chaptersPosted,
    chaptersTotal: complete ? chaptersPosted : null,
    reviewsCount: count(field('Reviews')),
    favoritesCount: count(field('Favs')),
    followsCount: count(field('Follows')),
    publishedAt,
    updatedAt: complete ? null : updatedAt,
    completedAt: complete ? (updatedAt ?? publishedAt) : null,
  };
}
