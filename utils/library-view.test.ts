import { expect, test } from 'vitest';
import {
  authorsOf,
  inStatus,
  isOngoing,
  statusCounts,
  unreadChapters,
  valueCounts,
  viewLibrary,
  type LibraryFilter,
} from './library-view';
import type { Ao3Work } from './models';

const work = (id: string, extra: Partial<Ao3Work> = {}): Ao3Work => ({
  id,
  title: `Work ${id}`,
  author: 'A',
  authorUrl: null,
  url: '',
  status: 'want',
  addedAt: Number(id),
  movedAt: Number(id),
  ...extra,
});
const all: LibraryFilter = { status: 'all', query: '' };
const ids = (ws: Ao3Work[]) => ws.map((w) => w.id);

test('filters by status and query', () => {
  const works = [
    work('1', { status: 'progress', fandoms: ['Good Omens'] }),
    work('2', { notes: 'reread soon' }),
    work('3', { title: 'Omens Of Doom' }),
  ];
  expect(ids(viewLibrary(works, { ...all, status: 'progress' }))).toEqual(['1']);
  expect(ids(viewLibrary(works, { ...all, query: ' omens ' }))).toEqual(['3', '1']);
  expect(ids(viewLibrary(works, { ...all, query: 'REREAD' }))).toEqual(['2']);
});

test('statusCounts', () => {
  expect(statusCounts([work('1'), work('2'), work('3', { status: 'dnf' })])).toMatchObject({
    want: 2,
    dnf: 1,
    progress: 0,
  });
});

test('unread chapters and ongoing', () => {
  const started = work('1', { chaptersPosted: 10, chaptersTotal: null, furthestChapter: { num: 3 } });
  const unstarted = work('2', { chaptersPosted: 4, chaptersTotal: 4 });
  const unknown = work('3');
  expect([started, unstarted, unknown].map(unreadChapters)).toEqual([7, 4, null]);
  expect(isOngoing(started)).toBe(true);
  expect(isOngoing(unstarted)).toBe(false);
  expect(isOngoing(work('4', { chaptersPosted: 3, chaptersTotal: 10 }))).toBe(true);
});

test('fandom filter and counts', () => {
  const works = [work('1', { fandoms: ['B', 'A'] }), work('2', { fandoms: ['A'] }), work('3')];
  expect(ids(viewLibrary(works, { ...all, fandom: 'A' }))).toEqual(['2', '1']);
  expect(valueCounts(works, (w) => w.fandoms ?? [])).toEqual([
    ['A', 2],
    ['B', 1],
  ]);
});

test('author filter splits co-authors', () => {
  const works = [work('1', { author: 'one, two' }), work('2', { author: 'two' }), work('3', { author: 'three' })];
  expect(ids(viewLibrary(works, { ...all, author: 'two' }))).toEqual(['2', '1']);
  expect(valueCounts(works, authorsOf)).toEqual([
    ['two', 2],
    ['one', 1],
    ['three', 1],
  ]);
});

test('inStatus', () => {
  const works = [work('1'), work('2', { status: 'dnf' })];
  expect(ids(inStatus(works, 'dnf'))).toEqual(['2']);
  expect(inStatus(works, 'all')).toBe(works);
});
