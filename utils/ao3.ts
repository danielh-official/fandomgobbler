import type { Ao3WorkInput } from './library';
import type { Ao3Work } from './models';

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

// AO3 prints dates as YYYY-MM-DD. Anchor them at local midnight: Date.parse would use
// UTC midnight and show the previous day for anyone west of UTC.
export function parseAo3Date(text: string | undefined): number | null {
  const m = text?.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() : null;
}

const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
const count = (el: Element | null) => (el ? parseInt(text(el).replace(/,/g, ''), 10) || null : null);
const absolute = (href: string | null | undefined) => (href ? new URL(href, AO3_ORIGIN).href : null);

// Returns null when the HTML has no work on it, e.g. AO3's adult-content warning page.
export function parseAo3Work(html: string, id: string): Ao3WorkInput | null {
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
export function ao3ChapterUrl(w: Pick<Ao3Work, 'id' | 'chapterIds' | 'furthestChapter'>): string {
  const n = Math.max(1, w.furthestChapter?.num ?? 1);
  const chapterId = w.chapterIds?.[n - 1];
  if (chapterId) return `${ao3WorkUrl(w.id)}/chapters/${chapterId}`;
  return n === 1 ? ao3WorkUrl(w.id) : `${ao3WorkUrl(w.id)}?view_full_work=true#chapter-${n}`;
}
