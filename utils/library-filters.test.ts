import { expect, test } from 'vitest';
import { parseFilters } from './library-filters';

const defaults = { status: 'all', fandom: '', author: '', showRead: false };

test('parseFilters keeps valid values and drops the rest', () => {
  expect(parseFilters(null)).toEqual(defaults);
  expect(parseFilters('not json')).toEqual(defaults);
  expect(parseFilters('{"status":"dnf","fandom":"F","author":"A","showRead":true}')).toEqual({
    status: 'dnf',
    fandom: 'F',
    author: 'A',
    showRead: true,
  });
  expect(parseFilters('{"status":"nope","fandom":3,"showRead":"yes"}')).toEqual(defaults);
});
