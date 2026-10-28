import { expect, test } from 'vitest';
import { ao3WorkId } from './ao3';

test('ao3WorkId', () => {
  expect(ao3WorkId('https://archiveofourown.org/works/123')).toBe('123');
  expect(ao3WorkId('https://archiveofourown.org/works/123/chapters/456')).toBe('123');
  expect(ao3WorkId('https://archiveofourown.org/collections/foo/works/789')).toBe('789');
  expect(ao3WorkId('https://archiveofourown.org/works?tag_id=x')).toBeNull();
  expect(ao3WorkId('https://archiveofourown.org/users/someone')).toBeNull();
});
