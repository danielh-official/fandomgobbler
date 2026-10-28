import { expect, test } from 'vitest';
import { isOngoing, statusCounts, unreadChapters, viewLibrary, type LibraryFilter } from './library-view';
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
  expect(ids(viewLibrary(works, { ...all, status: 'progress' }, 'recently-added'))).toEqual(['1']);
  expect(ids(viewLibrary(works, { ...all, query: ' omens ' }, 'recently-added'))).toEqual(['3', '1']);
  expect(ids(viewLibrary(works, { ...all, query: 'REREAD' }, 'recently-added'))).toEqual(['2']);
});

test('numeric sorts put missing values last and fall back to recently added', () => {
  const works = [work('1', { kudosCount: 5 }), work('2'), work('3', { kudosCount: 9 }), work('4')];
  expect(ids(viewLibrary(works, all, 'most-kudos'))).toEqual(['3', '1', '4', '2']);
});

test('unread sorts put read works last', () => {
  const works = [
    work('1', { status: 'completed', wordCount: 1 }),
    work('2', { wordCount: 500 }),
    work('3', { wordCount: 100 }),
    work('4'),
  ];
  expect(ids(viewLibrary(works, all, 'shortest-unread'))).toEqual(['3', '2', '4', '1']);
  expect(ids(viewLibrary(works, all, 'longest-unread'))).toEqual(['2', '3', '4', '1']);
});

test('oldest in For Later', () => {
  const works = [work('1', { status: 'progress' }), work('3'), work('2')];
  expect(ids(viewLibrary(works, all, 'oldest-for-later'))).toEqual(['2', '3', '1']);
});

test('statusCounts', () => {
  expect(statusCounts([work('1'), work('2'), work('3', { status: 'dnf' })])).toMatchObject({ want: 2, dnf: 1, progress: 0 });
});

test('unread chapters and ongoing', () => {
  const started = work('1', { chaptersPosted: 10, chaptersTotal: null, furthestChapter: { num: 3 } });
  const unstarted = work('2', { chaptersPosted: 4, chaptersTotal: 4 });
  const unknown = work('3');
  expect([started, unstarted, unknown].map(unreadChapters)).toEqual([7, 4, null]);
  expect(isOngoing(started)).toBe(true);
  expect(isOngoing(unstarted)).toBe(false);
  expect(isOngoing(work('4', { chaptersPosted: 3, chaptersTotal: 10 }))).toBe(true);
  expect(ids(viewLibrary([unknown, unstarted, started], all, 'most-unread-chapters'))).toEqual(['1', '2', '3']);
});
