import { expect, test } from 'vitest';
import { backoffMs, FIRST_BACKOFF, isWaiting, MAX_BACKOFF, recordFailure } from './health';

test('backoff doubles per failure, capped', () => {
  expect(backoffMs(1)).toBe(FIRST_BACKOFF);
  expect(backoffMs(2)).toBe(FIRST_BACKOFF * 2);
  expect(backoffMs(20)).toBe(MAX_BACKOFF);
});

test('failures accumulate and keep the first down time', () => {
  const first = recordFailure(undefined, 'AO3 returned 503', 1000);
  expect(first).toEqual({
    failures: 1,
    downSince: 1000,
    nextCheckAt: 1000 + FIRST_BACKOFF,
    lastError: 'AO3 returned 503',
  });
  const second = recordFailure(first, 'No response', 5000);
  expect(second).toMatchObject({ failures: 2, downSince: 1000, nextCheckAt: 5000 + FIRST_BACKOFF * 2 });
  expect(isWaiting(second, 5001)).toBe(true);
  expect(isWaiting(second, second.nextCheckAt)).toBe(false);
  expect(isWaiting(undefined, 0)).toBe(false);
});
