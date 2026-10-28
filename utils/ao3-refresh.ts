import { ao3WorkUrl, parseAo3Work } from './ao3';
import { defaultFetch, fetchAo3Paced, wait, type Fetch, type Wait } from './ao3-import';
import { db } from './db';
import { getAo3Work, markAo3WorkLost, saveAo3Work } from './library';
import { isOngoing } from './library-view';
import type { Ao3Work } from './models';

// Refresh of tracked works, run a few at a time by the background (see background.ts):
// one work page at a time, paced like the imports. A work that loads gets its stored
// metadata refreshed, as viewing it would, and
// counts as updated when it has more chapters than before. A 404 marks the work deleted.
// Anything else (restricted while logged out, unrevealed in a collection) is counted as
// unchecked and left alone.

// Shorter than the import's pause; the rate-limit backoff covers AO3 asking to slow down.
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
export function pickDue(works: Ao3Work[], now: number, n: number): Ao3Work[] {
  const overdue = (w: Ao3Work) =>
    (now - (w.refreshedAt ?? 0)) / (isOngoing(w) ? DUE_AFTER.ongoing : DUE_AFTER.completed);
  return works
    .filter((w) => w.status !== 'lost' && overdue(w) >= 1)
    .sort((a, b) => overdue(b) - overdue(a))
    .slice(0, n);
}

export async function refreshDueWorks(n: number, now = Date.now()): Promise<RefreshProgress> {
  return runRefresh({ ids: pickDue(await db.ao3Works.toArray(), now, n).map((w) => w.id) });
}

export async function runRefresh(opts: {
  ids: string[];
  signal?: AbortSignal;
  onProgress?: (p: RefreshProgress) => void;
  fetchFn?: Fetch;
  sleep?: Wait;
}): Promise<RefreshProgress> {
  const { fetchFn = defaultFetch, sleep = wait, signal } = opts;
  const progress: RefreshProgress = { checked: 0, total: opts.ids.length, newChapters: 0, lost: 0, unchecked: 0 };
  const report = () => opts.onProgress?.({ ...progress });
  report();

  for (const [i, id] of opts.ids.entries()) {
    if (i) await sleep(REFRESH_DELAY_MS, signal);
    const { status, html } = await fetchAo3Paced(`${ao3WorkUrl(id)}?view_adult=true`, {
      fetchFn,
      sleep,
      signal,
      onWait: (ms) => opts.onProgress?.({ ...progress, retryingInMs: ms }),
    });
    const work = status === 200 ? parseAo3Work(html, id) : null;
    const refreshedAt = Date.now();
    // Saved work by work, so stopping keeps everything checked so far.
    if (status === 404) progress.lost += Number(await markAo3WorkLost(id));
    else if (work) {
      const prev = await getAo3Work(id);
      if (prev && (await saveAo3Work({ ...work, refreshedAt }))) {
        if ((work.chaptersPosted ?? 0) > (prev.chaptersPosted ?? 0)) progress.newChapters++;
      }
    } else {
      progress.unchecked++;
      // Still counts as checked, so an unreadable work doesn't stay first in line.
      await db.ao3Works.update(id, { refreshedAt });
    }
    progress.checked++;
    report();
  }
  return progress;
}
