import { defaultFetch, fetchPaced, wait, type Fetch, type Wait } from './paced-fetch';
import { isUnresponsiveStatus, PlatformUnresponsiveError } from './health';
import { getWork, markWorkLost, readLibrary, saveWork, touchRefreshed } from './library';
import { isOngoing } from './library-view';
import type { Work, WorkRef } from './models';
import { PLATFORMS, type Platform } from './platforms';
import { SITES } from './sites';

// Refresh of tracked works, run a few at a time by the background (see background.ts):
// one work page at a time, paced like the imports. A work that loads gets its stored
// metadata refreshed, as viewing it would, and counts as updated when it has more
// chapters than before. A deleted work (AO3's 404, FanFiction.net's "Story Not Found")
// is marked deleted. Anything else (restricted while logged out, unrevealed in a collection) is counted as
// unchecked and left alone.

// Shorter than the AO3 import's pause; the health checks cover a site asking to slow down.
export const REFRESH_DELAY_MS = 2000;

export interface RefreshProgress {
  checked: number;
  total: number;
  newChapters: number;
  lost: number;
  unchecked: number;
  retryingInMs?: number;
}

const HOUR = 3600_000;
// How stale a work must be before it's due again. Completed works rarely change beyond
// kudos and hits, but are still checked now and then so deletions are noticed.
export const DUE_AFTER = { ongoing: 12 * HOUR, completed: 7 * 24 * HOUR };

// The n works most overdue, ongoing and completed weighed by their own due times. Never
// refreshed counts as oldest. Deleted works are skipped.
export function pickDue(works: Work[], now: number, n: number): Work[] {
  const overdue = (w: Work) => (now - (w.refreshedAt ?? 0)) / (isOngoing(w) ? DUE_AFTER.ongoing : DUE_AFTER.completed);
  return works
    .filter((w) => w.status !== 'lost' && overdue(w) >= 1)
    .sort((a, b) => overdue(b) - overdue(a))
    .slice(0, n);
}

// For the background: one platform's most overdue works, no in-batch backoff. An
// unresponsive site throws so the health checks take over.
export async function refreshDueWorks(platform: Platform, n: number, now = Date.now()): Promise<RefreshProgress> {
  const due = pickDue(
    (await readLibrary()).filter((w) => w.platform === platform),
    now,
    n,
  );
  return runRefresh({ refs: due.map(({ platform, id }) => ({ platform, id })), backoffs: [] });
}

export async function runRefresh(opts: {
  refs: WorkRef[];
  signal?: AbortSignal;
  onProgress?: (p: RefreshProgress) => void;
  fetchFn?: Fetch;
  sleep?: Wait;
  backoffs?: number[];
}): Promise<RefreshProgress> {
  const { fetchFn = defaultFetch, sleep = wait, signal } = opts;
  const progress: RefreshProgress = { checked: 0, total: opts.refs.length, newChapters: 0, lost: 0, unchecked: 0 };
  const report = () => opts.onProgress?.({ ...progress });
  report();

  for (const [i, ref] of opts.refs.entries()) {
    if (i) await sleep(REFRESH_DELAY_MS, signal);
    const site = SITES[ref.platform];
    const { status, html } = await fetchPaced(site.fetchUrl(ref.id), {
      fetchFn,
      sleep,
      signal,
      onWait: (ms) => opts.onProgress?.({ ...progress, retryingInMs: ms }),
      backoffs: opts.backoffs,
      rateLimited: site.rateLimited,
    });
    // Thrown before anything is saved, so works aren't marked refreshed during an outage
    // or while a bot check blocks the extension.
    if (isUnresponsiveStatus(status) || !site.looksLikeSite(html)) {
      const label = PLATFORMS[ref.platform].label;
      throw new PlatformUnresponsiveError(
        `${label} returned ${status}${site.looksLikeSite(html) ? '' : ' without its site'}.`,
      );
    }
    const work = status === 200 ? site.parse(html, ref.id) : null;
    const refreshedAt = Date.now();
    // Saved work by work, so stopping keeps everything checked so far.
    if (site.isGone(status, html)) progress.lost += Number(await markWorkLost(ref));
    else if (work) {
      const prev = await getWork(ref);
      if (prev && (await saveWork({ ...work, refreshedAt }))) {
        if ((work.chaptersPosted ?? 0) > (prev.chaptersPosted ?? 0)) progress.newChapters++;
      }
    } else {
      progress.unchecked++;
      // Still counts as checked, so an unreadable work doesn't stay first in line.
      await touchRefreshed(ref, refreshedAt);
    }
    progress.checked++;
    report();
  }
  return progress;
}
