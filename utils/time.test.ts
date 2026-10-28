import { expect, test } from 'vitest';
import { relativeDay, relativeTime } from './time';

const now = new Date(2026, 9, 28, 14, 30).getTime();
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();

test('relativeDay compares calendar days', () => {
  expect(relativeDay(day(2026, 10, 28), now)).toBe('today');
  expect(relativeDay(day(2026, 10, 27), now)).toBe('yesterday');
  expect(relativeDay(day(2026, 10, 25), now)).toBe('3 days ago');
  expect(relativeDay(day(2026, 10, 15), now)).toBe('last week');
  expect(relativeDay(day(2026, 10, 1), now)).toBe('3 weeks ago');
  expect(relativeDay(day(2026, 3, 9), now)).toBe('7 months ago');
  expect(relativeDay(day(2024, 3, 9), now)).toBe('2 years ago');
});

test('relativeTime goes down to minutes', () => {
  expect(relativeTime(now - 30e3, now)).toBe('this minute');
  expect(relativeTime(now - 5 * 6e4, now)).toBe('5 minutes ago');
  expect(relativeTime(now - 3 * 36e5, now)).toBe('3 hours ago');
  expect(relativeTime(now - 2 * 864e5, now)).toBe('2 days ago');
});
