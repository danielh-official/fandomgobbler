import { ao3ChapterUrl, ao3WorkId, ao3WorkUrl, looksRateLimited, parseAo3Work } from './ao3';
import { ffnetChapterUrl, ffnetWorkId, ffnetWorkUrl, isFfnetGone, looksLikeFfnet, parseFfnetWork } from './ffnet';
import type { WorkInput } from './library';
import type { Work, WorkRef } from './models';
import { PLATFORM_IDS, type Platform } from './platforms';

// What the shared code needs from each platform's site: recognising its URLs, fetching
// and parsing a work page, and telling a deleted work or a blocked request apart.
export interface Site {
  // Match patterns: work pages (right-click menu) and the whole site (tabs, ✓ badge).
  workPages: string[];
  sitePages: string[];
  workId(url: string): string | null;
  fetchUrl(id: string): string;
  chapterUrl(w: Pick<Work, 'id' | 'chapterIds' | 'furthestChapter'>): string;
  parse(html: string, id: string): WorkInput | null;
  isGone(status: number, html: string): boolean;
  // A real page of the site, as opposed to an outage page or a bot check.
  looksLikeSite(html: string): boolean;
  // A rate-limit page served with status 200.
  rateLimited?(html: string): boolean;
}

export const SITES: Record<Platform, Site> = {
  ao3: {
    workPages: ['https://archiveofourown.org/works/*', 'https://archiveofourown.org/collections/*/works/*'],
    sitePages: ['https://archiveofourown.org/*'],
    workId: ao3WorkId,
    fetchUrl: (id) => `${ao3WorkUrl(id)}?view_adult=true`,
    chapterUrl: ao3ChapterUrl,
    parse: parseAo3Work,
    isGone: (status) => status === 404,
    looksLikeSite: (html) => html.includes('id="header"'),
    rateLimited: looksRateLimited,
  },
  ffnet: {
    workPages: ['https://www.fanfiction.net/s/*'],
    sitePages: ['https://www.fanfiction.net/*'],
    workId: ffnetWorkId,
    fetchUrl: ffnetWorkUrl,
    chapterUrl: ffnetChapterUrl,
    parse: parseFfnetWork,
    isGone: (_status, html) => isFfnetGone(html),
    looksLikeSite: looksLikeFfnet,
  },
};

// Which platform's work a URL points at, if any.
export function workRefFromUrl(url: string): WorkRef | null {
  for (const platform of PLATFORM_IDS) {
    const id = SITES[platform].workId(url);
    if (id) return { platform, id };
  }
  return null;
}
