const DAY = 864e5;
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * DAY],
  ['month', 30 * DAY],
  ['week', 7 * DAY],
  ['day', DAY],
  ['hour', 36e5],
  ['minute', 6e4],
];

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
const startOfDay = (t: number) => new Date(t).setHours(0, 0, 0, 0);

// "3 weeks ago", "yesterday", "in 2 days". Rounds toward zero, so 13 days is "1 week ago".
function relative(diff: number, smallest: 'minute' | 'day'): string {
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms || unit === smallest) return rtf.format(Math.trunc(diff / ms), unit);
  }
  return rtf.format(0, smallest);
}

// For exact timestamps, e.g. when a work was added.
export const relativeTime = (t: number, now = Date.now()) => relative(t - now, 'minute');

// For AO3 dates, which are calendar days with no time: compare days, not hours.
export const relativeDay = (t: number, now = Date.now()) => relative(startOfDay(t) - startOfDay(now), 'day');

export const formatDate = (t: number) => new Date(t).toLocaleDateString(undefined, { dateStyle: 'medium' });
