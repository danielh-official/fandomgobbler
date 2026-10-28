// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { ao3WorkId, parseAo3Work } from './ao3';

test('ao3WorkId', () => {
  expect(ao3WorkId('https://archiveofourown.org/works/123')).toBe('123');
  expect(ao3WorkId('https://archiveofourown.org/works/123/chapters/456')).toBe('123');
  expect(ao3WorkId('https://archiveofourown.org/collections/foo/works/789')).toBe('789');
  expect(ao3WorkId('https://archiveofourown.org/works?tag_id=x')).toBeNull();
  expect(ao3WorkId('https://archiveofourown.org/users/someone')).toBeNull();
  expect(ao3WorkId('https://example.com/works/123')).toBeNull();
  expect(ao3WorkId('not a url')).toBeNull();
});

test('parseAo3Work reads title and authors', () => {
  const html = `
    <h2 class="title heading"> The Title </h2>
    <h3 class="byline heading">
      <a rel="author" href="/users/one/pseuds/one">one</a>, <a rel="author" href="/users/two/pseuds/two">two</a>
    </h3>`;
  expect(parseAo3Work(html, '5')).toEqual({
    id: '5',
    title: 'The Title',
    author: 'one, two',
    authorUrl: 'https://archiveofourown.org/users/one/pseuds/one',
    url: 'https://archiveofourown.org/works/5',
  });
});

test('parseAo3Work handles anonymous works and warning pages', () => {
  expect(parseAo3Work('<h2 class="title">T</h2><h3 class="byline">Anonymous</h3>', '1')).toMatchObject({
    author: 'Anonymous',
    authorUrl: null,
  });
  expect(parseAo3Work('<p class="caution">This work could have adult content.</p>', '1')).toBeNull();
});
