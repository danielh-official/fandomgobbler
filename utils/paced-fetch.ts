import { PlatformUnresponsiveError } from './health';

export const BACKOFF_MS = [15000, 30000];
export const FETCH_TIMEOUT_MS = 20000;

export type Fetch = (url: string, init: RequestInit) => Promise<Response>;
export type Wait = (ms: number, signal?: AbortSignal) => Promise<void>;

export const wait: Wait = (ms, signal) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });

// One request, retried after a long wait when the site rate-limits it (429, or a
// rate-limit page `rateLimited` recognises). Other statuses are returned for the caller
// to judge (a 404 can mean a deleted work).
export async function fetchPaced(
  url: string,
  opts: {
    fetchFn: Fetch;
    sleep: Wait;
    signal?: AbortSignal;
    onWait: (ms: number) => void;
    // The background refresh passes [] and leaves waiting to the health checks.
    backoffs?: number[];
    rateLimited?: (html: string) => boolean;
  },
): Promise<{ status: number; html: string }> {
  for (const backoff of [0, ...(opts.backoffs ?? BACKOFF_MS)]) {
    if (backoff) {
      opts.onWait(backoff);
      await opts.sleep(backoff, opts.signal);
    }
    // A hung request counts as no answer (a TimeoutError), not as waiting forever.
    const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS);
    const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
    const res = await opts.fetchFn(url, { credentials: 'include', signal });
    if (res.status === 429) continue;
    const html = await res.text();
    if (!res.ok || !opts.rateLimited?.(html)) return { status: res.status, html };
  }
  throw new PlatformUnresponsiveError('The site is rate-limiting requests. Progress so far is saved; try again later.');
}

// Wrapped: native fetch throws "Illegal invocation" when called as a method of another object.
export const defaultFetch: Fetch = (url, init) => fetch(url, init);
