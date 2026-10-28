import type { Ao3WorkInput } from './library';

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

// Returns null when the HTML has no work on it, e.g. AO3's adult-content warning page.
// ponytail: title and author only; milestone 3 fills in the rest of the metadata.
export function parseAo3Work(html: string, id: string): Ao3WorkInput | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const title = doc.querySelector('h2.title')?.textContent?.trim();
  if (!title) return null;
  const authors = [...doc.querySelectorAll('h3.byline a[rel="author"]')];
  const authorHref = authors[0]?.getAttribute('href');
  return {
    id,
    title,
    author: authors.map((a) => a.textContent?.trim()).join(', ') || 'Anonymous',
    authorUrl: authorHref ? new URL(authorHref, AO3_ORIGIN).href : null,
    url: ao3WorkUrl(id),
  };
}
