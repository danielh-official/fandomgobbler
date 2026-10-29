// Health of a platform for the background refresh. When a platform stops answering (down,
// overloaded, rate-limiting), polling it stops; a single health check probes it again
// after a backoff that doubles each time it's still down, and the refresh resumes once
// it answers.

export interface PlatformHealth {
  failures: number;
  downSince: number;
  nextCheckAt: number;
  lastError: string;
}

const MINUTE = 60_000;
export const FIRST_BACKOFF = 15 * MINUTE;
export const MAX_BACKOFF = 6 * 60 * MINUTE;

export const backoffMs = (failures: number) => Math.min(FIRST_BACKOFF * 2 ** (failures - 1), MAX_BACKOFF);

export function recordFailure(prev: PlatformHealth | undefined, error: string, now: number): PlatformHealth {
  const failures = (prev?.failures ?? 0) + 1;
  return { failures, downSince: prev?.downSince ?? now, nextCheckAt: now + backoffMs(failures), lastError: error };
}

// Down and still waiting out the backoff: don't touch the platform.
export const isWaiting = (h: PlatformHealth | undefined, now: number) => !!h && now < h.nextCheckAt;

// Server trouble or rate limiting, as opposed to an answer about one work (404, restricted).
export const isUnresponsiveStatus = (status: number) => status === 429 || status >= 500;

// Thrown when a platform doesn't answer usefully, so the caller can pause polling it.
export class PlatformUnresponsiveError extends Error {
  override name = 'PlatformUnresponsiveError';
}

// Network failures and timeouts count as unresponsive too.
export const isUnresponsive = (e: unknown) =>
  e instanceof PlatformUnresponsiveError ||
  e instanceof TypeError ||
  (e instanceof DOMException && e.name === 'TimeoutError');
