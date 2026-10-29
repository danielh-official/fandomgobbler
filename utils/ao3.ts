import type { WorkInput } from './library';
import type { Work } from './models';

export const AO3_ORIGIN = 'https://archiveofourown.org';

// Work id from an AO3 work URL, e.g. /works/123 or /collections/x/works/123/chapters/4.
export function ao3WorkId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname !== 'archiveofourown.org') return null;
    return u.pathname.match(/\/works\/(\d+)/)?.[1] ?? null;
  } catch {
    return null;
  }
}

export function ao3WorkUrl(id: string): string {
  return `${AO3_ORIGIN}/works/${id}`;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// AO3 prints dates as 2024-03-09 on work pages and "09 Mar 2024" on listings. Anchor them
// at local midnight: Date.parse would use UTC midnight and show the previous day for
// anyone west of UTC.
export function parseAo3Date(text: string | undefined): number | null {
  const s = text?.trim() ?? '';
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])).getTime();
  const named = s.match(/^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$/);
  const month = MONTHS.indexOf(named?.[2]?.toLowerCase() ?? '');
  return named && month >= 0 ? new Date(Number(named[3]), month, Number(named[1])).getTime() : null;
}

const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
const count = (el: Element | null) => (el ? parseInt(text(el).replace(/,/g, ''), 10) || null : null);
const absolute = (href: string | null | undefined) => (href ? new URL(href, AO3_ORIGIN).href : null);

// Returns null when the HTML has no work on it, e.g. AO3's adult-content warning page.
export function parseAo3Work(html: string, id: string): WorkInput | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const title = text(doc.querySelector('h2.title'));
  if (!title) return null;

  const authors = [...doc.querySelectorAll('h3.byline a[rel="author"]')];
  const stats = doc.querySelector('dl.stats');
  const stat = (name: string) => stats?.querySelector(`dd.${name}`) ?? null;

  // The work summary, not a chapter summary: chapter pages have both.
  const summaryEl = doc.querySelector('#workskin > .preface .summary blockquote.userstuff');
  const summary = summaryEl ? [...summaryEl.children].map(text).filter(Boolean).join('\n\n') || text(summaryEl) : '';

  const series = doc.querySelector('dd.series span.position');
  const seriesLink = series?.querySelector('a[href*="/series/"]');

  const [posted, total] = text(stat('chapters')).split('/');
  const chaptersPosted = parseInt(posted ?? '', 10) || null;
  const chaptersTotal = parseInt(total ?? '', 10) || null;
  // Only on chapter-by-chapter pages; left out otherwise so stored ids aren't erased.
  const chapterIds = [...doc.querySelectorAll('select#selected_id option')].map((o) => o.getAttribute('value') ?? '');

  // The "status" stat is labelled "Updated:" on works in progress and "Completed:" once done.
  const statusDate = parseAo3Date(text(stat('status')));
  const isCompleteLabel = /^completed/i.test(text(stats?.querySelector('dt.status')));
  const publishedAt = parseAo3Date(text(stat('published')));
  const isComplete = chaptersPosted !== null && chaptersPosted === chaptersTotal;
  const completedAt = isCompleteLabel ? statusDate : null;

  // Subscribe form only exists when logged in. Its action ends in an id once subscribed.
  const subscribeForm = [...doc.querySelectorAll('form[action*="/subscriptions"]')].find((f) =>
    f.querySelector(`input[name="subscription[subscribable_id]"][value="${id}"]`),
  );

  return {
    platform: 'ao3',
    id,
    title,
    author: authors.map(text).join(', ') || 'Anonymous',
    authorUrl: absolute(authors[0]?.getAttribute('href')),
    url: ao3WorkUrl(id),
    summary,
    fandoms: [...doc.querySelectorAll('dd.fandom a.tag')].map(text),
    relationship: text(doc.querySelector('dd.relationship a.tag')),
    seriesTitle: text(seriesLink),
    seriesUrl: absolute(seriesLink?.getAttribute('href')),
    seriesPosition: text(series)
      .replace(text(seriesLink), '')
      .replace(/\s*of\s*$/, '')
      .trim(),
    wordCount: count(stat('words')),
    chaptersPosted,
    chaptersTotal,
    ...(chapterIds.length && chapterIds.every(Boolean) && { chapterIds }),
    kudosCount: count(stat('kudos')),
    bookmarksCount: count(stat('bookmarks')),
    hitsCount: count(stat('hits')),
    publishedAt,
    updatedAt: isCompleteLabel ? null : statusDate,
    completedAt,
    // One-shots never get a "Completed:" date; treat publishing as completing.
    inferredCompletedAt: !completedAt && isComplete ? (statusDate ?? publishedAt) : null,
    subscribedAtAo3: subscribeForm ? /\/subscriptions\/\d+/.test(subscribeForm.getAttribute('action') ?? '') : null,
  };
}

// AO3 link to the work's current chapter (chapter 1 if none is set). Chapter URLs need
// AO3's chapter id; without it, fall back to the full-work page at that chapter.
export function ao3ChapterUrl(w: Pick<Work, 'id' | 'chapterIds' | 'furthestChapter'>): string {
  const n = Math.max(1, w.furthestChapter?.num ?? 1);
  const chapterId = w.chapterIds?.[n - 1];
  if (chapterId) return `${ao3WorkUrl(w.id)}/chapters/${chapterId}`;
  return n === 1 ? ao3WorkUrl(w.id) : `${ao3WorkUrl(w.id)}?view_full_work=true#chapter-${n}`;
}

// The logged-in user's name from AO3's "Hi, name!" header, or null when logged out.
export function parseAo3Username(html: string): string | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const href = doc.querySelector('#greeting a[href^="/users/"]')?.getAttribute('href');
  const name = href?.match(/^\/users\/([^/?#]+)/)?.[1];
  return name && name !== 'login' ? name : null;
}

// AO3's throttling page instead of the content asked for.
export function looksRateLimited(html: string): boolean {
  return /retry later|too many requests|temporarily blocked|rate limit|slow down/i.test(html);
}

// One page of a work listing (bookmarks, Marked for Later, search, tags...). Bookmarks
// of series and external works are skipped. Listings show less than a work page, so
// fields a blurb doesn't have are left out rather than set.
export function parseAo3ListingPage(html: string): {
  works: WorkInput[];
  hasNext: boolean;
  lastPage: number | null;
} {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const works = new Map<string, WorkInput>();
  for (const blurb of doc.querySelectorAll('li.blurb')) {
    const titleLink = blurb.querySelector('h4.heading a[href^="/works/"]');
    const id = titleLink?.getAttribute('href')?.match(/^\/works\/(\d+)/)?.[1];
    if (!titleLink || !id || works.has(id)) continue;

    const authors = [...blurb.querySelectorAll('h4.heading a[rel="author"]')];
    const stat = (name: string) => blurb.querySelector(`dl.stats dd.${name}`);
    const [posted, total] = text(stat('chapters')).split('/');
    const chaptersPosted = parseInt(posted ?? '', 10) || null;
    const chaptersTotal = parseInt(total ?? '', 10) || null;
    const series = blurb.querySelector('ul.series li');
    const seriesLink = series?.querySelector('a[href*="/series/"]');
    const summaryEl = blurb.querySelector('blockquote.summary');

    // The blurb date is the latest revision: an update while in progress, completion for
    // a finished chaptered work, publication for a one-shot.
    const date = parseAo3Date(text(blurb.querySelector('p.datetime')));
    const done = chaptersPosted !== null && chaptersPosted === chaptersTotal;
    const dateField = !done ? 'updatedAt' : chaptersPosted > 1 ? 'completedAt' : 'publishedAt';

    works.set(id, {
      platform: 'ao3',
      id,
      title: text(titleLink),
      author: authors.map(text).join(', ') || 'Anonymous',
      authorUrl: absolute(authors[0]?.getAttribute('href')),
      url: ao3WorkUrl(id),
      fandoms: [...blurb.querySelectorAll('h5.fandoms a.tag')].map(text),
      relationship: text(blurb.querySelector('li.relationships a.tag')),
      summary: summaryEl ? [...summaryEl.children].map(text).filter(Boolean).join('\n\n') || text(summaryEl) : '',
      ...(seriesLink && {
        seriesTitle: text(seriesLink),
        seriesUrl: absolute(seriesLink.getAttribute('href')),
        seriesPosition: text(series)
          .replace(text(seriesLink), '')
          .replace(/\s*of\s*$/, '')
          .trim(),
      }),
      wordCount: count(stat('words')),
      chaptersPosted,
      chaptersTotal,
      kudosCount: count(stat('kudos')),
      bookmarksCount: count(stat('bookmarks')),
      hitsCount: count(stat('hits')),
      ...(date !== null && { [dateField]: date }),
    });
  }
  const pageNumbers = [...doc.querySelectorAll('ol.pagination a[href*="page="]')].map(
    (a) => Number(a.getAttribute('href')?.match(/[?&]page=(\d+)/)?.[1]) || 0,
  );
  return {
    works: [...works.values()],
    hasNext: !!doc.querySelector('ol.pagination li.next a, a[rel="next"]'),
    lastPage: Math.max(0, ...pageNumbers) || null,
  };
}
