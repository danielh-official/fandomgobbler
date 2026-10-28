// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import {
  ao3ChapterUrl,
  ao3WorkId,
  looksRateLimited,
  parseAo3Date,
  parseAo3ListingPage,
  parseAo3Username,
  parseAo3Work,
} from './ao3';
import chaptered from './fixtures/ao3-work-chaptered.html?raw';
import oneshot from './fixtures/ao3-work-oneshot.html?raw';
import bookmarksPage from './fixtures/ao3-bookmarks-page.html?raw';
import readingsLastPage from './fixtures/ao3-readings-last-page.html?raw';

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
  expect(parseAo3Date('09 Mar 2024')).toBe(local(2024, 3, 9));
  expect(parseAo3Date('9 Mar 2024')).toBe(local(2024, 3, 9));
  expect(parseAo3Date('Jan 5')).toBeNull();
  expect(parseAo3Date('09 Foo 2024')).toBeNull();
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
    chapterIds: ['9001', '9002', '9003'],
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

test('one-shot has no chapter ids', () => {
  expect(parseAo3Work(oneshot, '1')).not.toHaveProperty('chapterIds');
});

test('ao3ChapterUrl', () => {
  const base = 'https://archiveofourown.org/works/7';
  expect(ao3ChapterUrl({ id: '7', chapterIds: ['10', '11'], furthestChapter: { num: 2 } })).toBe(`${base}/chapters/11`);
  expect(ao3ChapterUrl({ id: '7', chapterIds: ['10', '11'] })).toBe(`${base}/chapters/10`);
  expect(ao3ChapterUrl({ id: '7', furthestChapter: { num: 3 } })).toBe(`${base}?view_full_work=true#chapter-3`);
  expect(ao3ChapterUrl({ id: '7' })).toBe(base);
});

test('parseAo3ListingPage: bookmarks page 1', () => {
  const { works, hasNext, lastPage } = parseAo3ListingPage(bookmarksPage);
  expect(works.map((w) => w.id)).toEqual(['101', '102', '103']);
  expect(works[0]).toEqual({
    id: '101',
    title: 'Ongoing Work',
    author: 'writer',
    authorUrl: 'https://archiveofourown.org/users/writer/pseuds/writer',
    url: 'https://archiveofourown.org/works/101',
    fandoms: ['Fandom One'],
    relationship: 'Character A/Character B',
    summary: 'One.\n\nTwo.',
    seriesTitle: 'The Series',
    seriesUrl: 'https://archiveofourown.org/series/777',
    seriesPosition: 'Part 2',
    wordCount: 12345,
    chaptersPosted: 3,
    chaptersTotal: null,
    kudosCount: 1234,
    bookmarksCount: 56,
    hitsCount: 78901,
    updatedAt: local(2024, 3, 9),
  });
  expect(works[1]).toMatchObject({ author: 'Anonymous', authorUrl: null, publishedAt: local(2023, 7, 14) });
  expect(works[1]).not.toHaveProperty('seriesTitle');
  expect(works[2]).toMatchObject({ completedAt: local(2022, 2, 1) });
  expect(works[2]).not.toHaveProperty('updatedAt');
  expect(hasNext).toBe(true);
  expect(lastPage).toBe(7);
});

test('parseAo3ListingPage: last page of Marked for Later', () => {
  const { works, hasNext } = parseAo3ListingPage(readingsLastPage);
  expect(works.map((w) => w.id)).toEqual(['201']);
  expect(hasNext).toBe(false);
});

test('parseAo3Username and looksRateLimited', () => {
  expect(parseAo3Username(bookmarksPage)).toBe('reader');
  // Logged out: a login dropdown instead of the greeting.
  expect(parseAo3Username('<div id="login"><a id="login-dropdown" href="/users/login">Log In</a></div>')).toBeNull();
  expect(parseAo3Username('<ul id="greeting"><li><a href="/users/login">Log In</a></li></ul>')).toBeNull();
  expect(parseAo3Username('<p>no header</p>')).toBeNull();
  expect(looksRateLimited('<h2>Retry later</h2>')).toBe(true);
  expect(looksRateLimited(bookmarksPage)).toBe(false);
});
