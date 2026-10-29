// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import complete from './fixtures/ffnet-story-complete.html?raw';
import notFound from './fixtures/ffnet-not-found.html?raw';
import crossover from './fixtures/ffnet-story-ongoing-crossover.html?raw';
import { ffnetChapterUrl, ffnetWorkId, isFfnetGone, looksLikeFfnet, parseFfnetWork } from './ffnet';

test('ffnetWorkId reads story ids from www. and m. URLs', () => {
  expect(ffnetWorkId('https://www.fanfiction.net/s/5782108/1/Some-Slug')).toBe('5782108');
  expect(ffnetWorkId('https://m.fanfiction.net/s/42/3/')).toBe('42');
  expect(ffnetWorkId('https://www.fanfiction.net/s/42')).toBe('42');
  expect(ffnetWorkId('https://www.fanfiction.net/u/42/Name')).toBeNull();
  expect(ffnetWorkId('https://archiveofourown.org/works/42')).toBeNull();
});

test('parseFfnetWork: completed story', () => {
  expect(parseFfnetWork(complete, '5782108')).toEqual({
    platform: 'ffnet',
    id: '5782108',
    title: 'A Finished Story',
    author: 'Some Author',
    authorUrl: 'https://www.fanfiction.net/u/2269863/Some-Author',
    url: 'https://www.fanfiction.net/s/5782108/1/',
    summary: 'A short summary of the story.',
    fandoms: ['Harry Potter'],
    genres: 'Drama/Humor',
    characters: 'Harry P., Hermione G.',
    wordCount: 661619,
    chaptersPosted: 122,
    chaptersTotal: 122,
    reviewsCount: 37700,
    favoritesCount: 32534,
    followsCount: 23632,
    publishedAt: 1267344759000,
    updatedAt: null,
    completedAt: 1426348782000,
  });
});

test('parseFfnetWork: ongoing crossover without genres, reviews or updates', () => {
  expect(parseFfnetWork(crossover, '14596541')).toMatchObject({
    fandoms: ['Harry Potter', 'Naruto'],
    genres: undefined,
    characters: '[Draco M., Harry P.] Ron W.',
    chaptersPosted: 3,
    chaptersTotal: null,
    reviewsCount: null,
    publishedAt: 1793312919000,
    updatedAt: null,
    completedAt: null,
  });
});

test('deleted stories, Cloudflare checks and real pages are told apart', () => {
  expect(parseFfnetWork(notFound, '1')).toBeNull();
  expect(isFfnetGone(notFound)).toBe(true);
  expect(isFfnetGone(complete)).toBe(false);
  expect(looksLikeFfnet(notFound)).toBe(true);
  expect(looksLikeFfnet('<html><head><title>Just a moment...</title></head></html>')).toBe(false);
});

test('chapter links are numbered', () => {
  expect(ffnetChapterUrl({ id: '9', furthestChapter: { num: 4 } })).toBe('https://www.fanfiction.net/s/9/4/');
  expect(ffnetChapterUrl({ id: '9' })).toBe('https://www.fanfiction.net/s/9/1/');
});

test('hyphenated genres are genres, not characters', () => {
  const html = complete.replace('Drama/Humor', 'Sci-Fi/Hurt-Comfort');
  expect(parseFfnetWork(html, '1')).toMatchObject({
    genres: 'Sci-Fi/Hurt-Comfort',
    characters: 'Harry P., Hermione G.',
  });
});
