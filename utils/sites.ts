import { ao3ChapterUrl, ao3WorkId, ao3WorkUrl, looksRateLimited, parseAo3Work } from './ao3';
import { ffnetChapterUrl, ffnetWorkId, ffnetWorkUrl, isFfnetGone, looksLikeFfnet, parseFfnetWork } from './ffnet';
import {
  isWattpadGone,
  looksLikeWattpad,
  parseWattpadWork,
  wattpadApiUrl,
  wattpadChapterUrl,
  wattpadPageWorkId,
  wattpadPartApiUrl,
  wattpadPartId,
  wattpadWorkId,
} from './wattpad';
import type { WorkInput } from './library';
import type { Work, WorkRef } from './models';
import { PLATFORM_IDS, type Platform } from './platforms';

// What the shared code needs from each platform's site: recognising its URLs, fetching
// and parsing a work page, and telling a deleted work or a blocked request apart.
export interface Site {
  // Match patterns: work pages (right-click menu) and the whole site (tabs, ✓ badge).
  workPages: string[];
  sitePages: string[];
  // Any page of the site, work or not.
  host: RegExp;
  // The work id when the URL itself carries it.
  workId(url: string): string | null;
  // The work id from a page's HTML, for pages whose URL doesn't carry it (Wattpad parts).
  pageWorkId?(html: string): string | null;
  // The work id for such a URL without the page: one request (a pasted Wattpad part link).
  lookupWorkId?(url: string): Promise<string | null>;
  fetchUrl(id: string): string;
  chapterUrl(w: Pick<Work, 'id' | 'chapterIds' | 'furthestChapter'>): string;
  parse(html: string, id: string): WorkInput | null;
  isGone(status: number, html: string): boolean;
  // A real answer from the site, as opposed to an outage page or a bot check.
  looksLikeSite(html: string): boolean;
  // A rate-limit page served with status 200.
  rateLimited?(html: string): boolean;
}

export const SITES: Record<Platform, Site> = {
  ao3: {
    workPages: ['https://archiveofourown.org/works/*', 'https://archiveofourown.org/collections/*/works/*'],
    sitePages: ['https://archiveofourown.org/*'],
    host: /^archiveofourown\.org$/,
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
    host: /^(www\.|m\.)?fanfiction\.net$/,
    workId: ffnetWorkId,
    fetchUrl: ffnetWorkUrl,
    chapterUrl: ffnetChapterUrl,
    parse: parseFfnetWork,
    isGone: (_status, html) => isFfnetGone(html),
    looksLikeSite: looksLikeFfnet,
  },
  wattpad: {
    // Reading pages are /<partId>-slug, which no match pattern tells apart from other pages.
    workPages: ['https://www.wattpad.com/*'],
    sitePages: ['https://www.wattpad.com/*'],
    host: /^(www\.|m\.)?wattpad\.com$/,
    workId: wattpadWorkId,
    pageWorkId: wattpadPageWorkId,
    async lookupWorkId(url) {
      const partId = wattpadPartId(url);
      if (!partId) return null;
      const res = await fetch(wattpadPartApiUrl(partId));
      const data: unknown = res.ok ? await res.json() : null;
      const groupId = (data as { groupId?: unknown } | null)?.groupId;
      return groupId ? String(groupId) : null;
    },
    fetchUrl: wattpadApiUrl,
    chapterUrl: wattpadChapterUrl,
    parse: parseWattpadWork,
    isGone: (_status, body) => isWattpadGone(body),
    looksLikeSite: looksLikeWattpad,
  },
};

// Which platform's site a URL is on, work page or not.
export function platformOfUrl(url: string): Platform | null {
  try {
    const host = new URL(url).hostname;
    return PLATFORM_IDS.find((p) => SITES[p].host.test(host)) ?? null;
  } catch {
    return null;
  }
}

// A work from a page in hand: its URL, or failing that the page itself.
export function workRefFromPage(url: string, html: unknown): WorkRef | null {
  const platform = platformOfUrl(url);
  if (!platform) return null;
  const site = SITES[platform];
  const id = site.workId(url) ?? (typeof html === 'string' ? site.pageWorkId?.(html) : null) ?? null;
  return id ? { platform, id } : null;
}

// A work from a URL alone, looking it up when the URL doesn't carry the id.
export async function workRefFromUrlOrLookup(url: string): Promise<WorkRef | null> {
  const platform = platformOfUrl(url);
  if (!platform) return null;
  const site = SITES[platform];
  const id = site.workId(url) ?? (await site.lookupWorkId?.(url)) ?? null;
  return id ? { platform, id } : null;
}

// Which platform's work a URL points at, if any.
export function workRefFromUrl(url: string): WorkRef | null {
  for (const platform of PLATFORM_IDS) {
    const id = SITES[platform].workId(url);
    if (id) return { platform, id };
  }
  return null;
}
