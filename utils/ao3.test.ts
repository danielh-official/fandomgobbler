// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { ao3WorkId, parseAo3Date, parseAo3Work } from './ao3';
import chaptered from './fixtures/ao3-work-chaptered.html?raw';
import oneshot from './fixtures/ao3-work-oneshot.html?raw';

const local = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();

test('ao3WorkId', () => {
  expect(ao3WorkId('https://archiveofourown.org/works/123')).toBe('123');
  expect(ao3WorkId('https://archiveofourown.org/works/123/chapters/456')).toBe('123');
  expect(ao3WorkId('https://archiveofourown.org/collections/foo/works/789')).toBe('789');
  expect(ao3WorkId('https://archiveofourown.org/works?tag_id=x')).toBeNull();
  expect(ao3WorkId('https://archiveofourown.org/users/someone')).toBeNull();
  expect(ao3WorkId('https://example.com/works/123')).toBeNull();
  expect(ao3WorkId('not a url')).toBeNull();
});

test('parseAo3Date uses local midnight', () => {
  expect(parseAo3Date('2024-01-05')).toBe(local(2024, 1, 5));
  expect(parseAo3Date('')).toBeNull();
  expect(parseAo3Date('Jan 5')).toBeNull();
});

test('parseAo3Work: chaptered, in progress, logged in and subscribed', () => {
  expect(parseAo3Work(chaptered, '4242')).toEqual({
    id: '4242',
    title: 'A Chaptered Work',
    author: 'writer',
    authorUrl: 'https://archiveofourown.org/users/writer/pseuds/writer',
    url: 'https://archiveofourown.org/works/4242',
    summary: 'First paragraph.\n\nSecond paragraph.',
    fandoms: ['Fandom One', 'Fandom Two'],
    relationship: 'Character A/Character B',
    seriesTitle: 'The Series',
    seriesUrl: 'https://archiveofourown.org/series/777',
    seriesPosition: 'Part 2',
    wordCount: 12345,
    chaptersPosted: 3,
    chaptersTotal: null,
    kudosCount: 1234,
    bookmarksCount: 56,
    hitsCount: 78901,
    publishedAt: local(2024, 1, 5),
    updatedAt: local(2024, 3, 9),
    completedAt: null,
    inferredCompletedAt: null,
    subscribedAtAo3: true,
  });
});

test('parseAo3Work: anonymous logged-out one-shot', () => {
  expect(parseAo3Work(oneshot, '1')).toMatchObject({
    title: 'A One-Shot',
    author: 'Anonymous',
    authorUrl: null,
    summary: '',
    relationship: '',
    seriesTitle: '',
    seriesUrl: null,
    chaptersPosted: 1,
    chaptersTotal: 1,
    bookmarksCount: null,
    updatedAt: null,
    completedAt: null,
    inferredCompletedAt: local(2023, 7, 14),
    subscribedAtAo3: null,
  });
});

test('parseAo3Work: completed multi-chapter work, unsubscribed', () => {
  const html = chaptered
    .replace('<dt class="status">Updated:</dt>', '<dt class="status">Completed:</dt>')
    .replace('3</a>/?', '3</a>/3')
    .replace('/subscriptions/98765', '/subscriptions');
  expect(parseAo3Work(html, '4242')).toMatchObject({
    chaptersTotal: 3,
    updatedAt: null,
    completedAt: local(2024, 3, 9),
    inferredCompletedAt: null,
    subscribedAtAo3: false,
  });
});

test('parseAo3Work: multiple authors; warning page', () => {
  const html = `<h2 class="title">T</h2><h3 class="byline">
    <a rel="author" href="/users/one/pseuds/one">one</a>, <a rel="author" href="/users/two/pseuds/two">two</a></h3>`;
  expect(parseAo3Work(html, '5')).toMatchObject({ author: 'one, two' });
  expect(parseAo3Work('<p class="caution">This work could have adult content.</p>', '1')).toBeNull();
});
