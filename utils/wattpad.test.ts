import { expect, test } from 'vitest';
import story from './fixtures/wattpad-story.json?raw';
import {
  isWattpadGone,
  looksLikeWattpad,
  parseWattpadWork,
  wattpadChapterUrl,
  wattpadPageWorkId,
  wattpadPartId,
  wattpadWorkId,
} from './wattpad';

test('story and part ids from URLs', () => {
  expect(wattpadWorkId('https://www.wattpad.com/story/404053457-a-wattpad-story')).toBe('404053457');
  expect(wattpadWorkId('https://www.wattpad.com/1589023894-part')).toBeNull();
  expect(wattpadPartId('https://www.wattpad.com/1589023894-part-one')).toBe('1589023894');
  expect(wattpadPartId('https://www.wattpad.com/1589023894')).toBe('1589023894');
  expect(wattpadPartId('https://www.wattpad.com/story/404053457')).toBeNull();
  expect(wattpadPartId('https://www.wattpad.com/user/writer')).toBeNull();
  expect(wattpadWorkId('https://www.fanfiction.net/story/1')).toBeNull();
});

test('a reading page embeds its story id', () => {
  expect(wattpadPageWorkId('..."group":{"id":"404053457","title":"x"}...')).toBe('404053457');
  expect(wattpadPageWorkId('<html></html>')).toBeNull();
});

test('parseWattpadWork reads the API story', () => {
  expect(parseWattpadWork(story, '404053457')).toEqual({
    platform: 'wattpad',
    id: '404053457',
    title: 'A Wattpad Story',
    author: 'Writer Name',
    authorUrl: 'https://www.wattpad.com/user/writer',
    url: 'https://www.wattpad.com/story/404053457-a-wattpad-story',
    summary: 'A summary.',
    tags: ['harrypotter', 'hogwarts'],
    wordCount: 2120,
    chaptersPosted: 3,
    chaptersTotal: null,
    chapterIds: ['1589023894', '1589029154', '1589048346'],
    votesCount: 46151,
    readsCount: 1354125,
    commentsCount: 16163,
    publishedAt: Date.parse('2025-11-13T17:35:45Z'),
    updatedAt: Date.parse('2026-02-21T22:48:45Z'),
    completedAt: null,
  });
  const done = parseWattpadWork(story.replace('"completed":false', '"completed":true'), '404053457');
  expect(done).toMatchObject({ chaptersTotal: 3, updatedAt: null, completedAt: Date.parse('2026-02-21T22:48:45Z') });
});

test('HTML pages, errors and deleted stories', () => {
  const notFound = '{"error_code":1017,"error_type":"NotFound","message":"Story not found"}';
  expect(parseWattpadWork('<html>page</html>', '1')).toBeNull();
  expect(parseWattpadWork(notFound, '1')).toBeNull();
  expect(isWattpadGone(notFound)).toBe(true);
  expect(isWattpadGone(story)).toBe(false);
  expect(isWattpadGone(story.replace('"deleted":false', '"deleted":true'))).toBe(true);
  expect(looksLikeWattpad(notFound)).toBe(true);
  expect(looksLikeWattpad('<html><title>502 Bad Gateway</title></html>')).toBe(false);
});

test('chapter links use part ids', () => {
  expect(wattpadChapterUrl({ id: '9', chapterIds: ['11', '22'], furthestChapter: { num: 2 } })).toBe(
    'https://www.wattpad.com/22',
  );
  expect(wattpadChapterUrl({ id: '9' })).toBe('https://www.wattpad.com/story/9');
});
