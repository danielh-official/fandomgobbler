import { AO3_ORIGIN, looksRateLimited, parseAo3ListingPage, parseAo3Username } from './ao3';
import { addAo3WorksIfMissing } from './library';
import type { Status } from './models';

// Manual, user-started imports of AO3 lists. AO3 rate-limits scraping, so pages are
// fetched one at a time with a pause between them, and a rate-limit response gets a
// couple of long waits before giving up. Imports are idempotent (existing works are
// left untouched), so a cancelled or failed import is resumed by running it again.

export const IMPORT_SOURCES = {
  bookmarks: {
    label: 'Bookmarks',
    url: (user: string, page: number) => `${AO3_ORIGIN}/users/${encodeURIComponent(user)}/bookmarks?page=${page}`,
  },
  markedForLater: {
    label: 'Marked for Later',
    url: (user: string, page: number) =>
      `${AO3_ORIGIN}/users/${encodeURIComponent(user)}/readings?show=to-read&page=${page}`,
  },
} as const;

export type ImportSource = keyof typeof IMPORT_SOURCES;

export const PAGE_DELAY_MS = 3000;
export const BACKOFF_MS = [15000, 30000];

export interface ImportProgress {
  page: number;
  lastPage: number | null;
  seen: number;
  added: number;
  // Set while waiting out an AO3 rate limit.
  retryingInMs?: number;
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;
type Wait = (ms: number, signal?: AbortSignal) => Promise<void>;

export const wait: Wait = (ms, signal) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });

// One request to AO3's front page for the logged-in user's name.
export async function detectAo3Username(fetchFn: Fetch = fetch): Promise<string> {
  const res = await fetchFn(`${AO3_ORIGIN}/`, { credentials: 'include' });
  const name = res.ok ? parseAo3Username(await res.text()) : null;
  if (!name) throw new Error('You don’t seem to be logged in to AO3 in this browser. Log in, or type your username.');
  return name;
}

async function fetchPage(
  url: string,
  opts: { fetchFn: Fetch; sleep: Wait; signal?: AbortSignal; onWait: (ms: number) => void },
): Promise<string> {
  for (const backoff of [0, ...BACKOFF_MS]) {
    if (backoff) {
      opts.onWait(backoff);
      await opts.sleep(backoff, opts.signal);
    }
    const res = await opts.fetchFn(url, { credentials: 'include', signal: opts.signal });
    if (res.status === 429) continue;
    if (!res.ok) throw new Error(`AO3 returned ${res.status}.`);
    const html = await res.text();
    if (!looksRateLimited(html)) return html;
  }
  throw new Error('AO3 is rate-limiting requests. What was imported so far is saved; run the import again later.');
}

export async function runImport(opts: {
  source: ImportSource;
  username: string;
  status: Status;
  signal?: AbortSignal;
  onProgress?: (p: ImportProgress) => void;
  fetchFn?: Fetch;
  sleep?: Wait;
}): Promise<ImportProgress> {
  // Wrapped: native fetch throws "Illegal invocation" when called as a method of another object.
  const { fetchFn = (url, init) => fetch(url, init), sleep = wait, signal } = opts;
  const progress: ImportProgress = { page: 0, lastPage: null, seen: 0, added: 0 };
  const report = () => opts.onProgress?.({ ...progress });

  for (let page = 1; ; page++) {
    progress.page = page;
    report();
    const html = await fetchPage(IMPORT_SOURCES[opts.source].url(opts.username, page), {
      fetchFn,
      sleep,
      signal,
      onWait: (ms) => opts.onProgress?.({ ...progress, retryingInMs: ms }),
    });
    const { works, hasNext, lastPage } = parseAo3ListingPage(html);
    // An empty first page without AO3's logged-in header: Marked for Later is private.
    if (page === 1 && !works.length && !parseAo3Username(html) && opts.source === 'markedForLater') {
      throw new Error('Marked for Later is private. Log in to AO3 in this browser and try again.');
    }
    // On the last page AO3 only links back, so the current page is the last one.
    progress.lastPage = hasNext ? Math.max(progress.lastPage ?? 0, lastPage ?? 0) || null : page;
    progress.seen += works.length;
    // Saved page by page, so cancelling keeps everything fetched so far.
    progress.added += await addAo3WorksIfMissing(works, opts.status);
    report();
    if (!hasNext || !works.length) return progress;
    await sleep(PAGE_DELAY_MS, signal);
  }
}
