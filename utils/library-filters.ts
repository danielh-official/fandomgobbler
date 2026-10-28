import { createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { authorsOf, firstTier, statusCounts, valueCounts, viewLibrary, type LibraryFilter } from './library-view';
import { STATUSES, type Ao3Work } from './models';

const KEY = 'fg-library-filters';

export interface SavedFilters {
  status: LibraryFilter['status'];
  fandom: string;
  author: string;
  // Off by default: only works with unread chapters are listed.
  showRead: boolean;
}

// Anything missing or malformed falls back to "show everything".
export function parseFilters(json: string | null): SavedFilters {
  const filters: SavedFilters = { status: 'all', fandom: '', author: '', showRead: false };
  try {
    const saved = JSON.parse(json ?? 'null') ?? {};
    if (STATUSES.includes(saved.status)) filters.status = saved.status;
    if (typeof saved.fandom === 'string') filters.fandom = saved.fandom;
    if (typeof saved.author === 'string') filters.author = saved.author;
    filters.showRead = saved.showRead === true;
  } catch {
    // Unreadable saved state: start from the defaults.
  }
  return filters;
}

// localStorage can throw (blocked storage); saved filters are only a convenience.
function load(): SavedFilters {
  try {
    return parseFilters(localStorage.getItem(KEY));
  } catch {
    return parseFilters(null);
  }
}

// Library filters shared by the side panel and the dashboard. Both are extension pages
// on one origin, so they share localStorage: the last filters are restored on open, and
// a change in one page reaches the other live through the `storage` event. The search
// text is per page and not saved.
export function createLibraryFilters(works: () => Ao3Work[] | undefined) {
  const [filters, setFilters] = createSignal(load());
  const set = (patch: Partial<SavedFilters>) => setFilters({ ...filters(), ...patch });

  createEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(filters()));
    } catch {
      // See load().
    }
  });
  // Only fires for changes made by the other page; an unchanged value fires nothing,
  // so the two pages can't ping-pong.
  const onStorage = (e: StorageEvent) => e.key === KEY && setFilters(parseFilters(e.newValue));
  window.addEventListener('storage', onStorage);
  onCleanup(() => window.removeEventListener('storage', onStorage));

  const [query, setQuery] = createSignal('');
  const all = () => works() ?? [];
  const counts = createMemo(() => statusCounts(all()));
  // Fandom and author options only cover works that pass the first-tier filters: the
  // selected status and, unless "show read" is on, unread chapters.
  const narrowed = createMemo(() => firstTier(all(), filters().status, !filters().showRead));
  const fandoms = createMemo(() => valueCounts(narrowed(), (w) => w.fandoms ?? []));
  const authors = createMemo(() => valueCounts(narrowed(), authorsOf));
  // Changing those can leave the chosen fandom or author with no works; fall back to all.
  // Waits for the library to load so saved filters aren't cleared on startup.
  createEffect(() => {
    if (!works()) return;
    const { fandom, author } = filters();
    if (fandom && !fandoms().some(([f]) => f === fandom)) set({ fandom: '' });
    if (author && !authors().some(([a]) => a === author)) set({ author: '' });
  });

  const shown = createMemo(() => {
    const f = filters();
    return viewLibrary(all(), {
      status: f.status,
      query: query(),
      fandom: f.fandom || undefined,
      author: f.author || undefined,
      unreadOnly: !f.showRead,
    });
  });
  const active = () => {
    const f = filters();
    return !!(query() || f.status !== 'all' || f.fandom || f.author || !f.showRead);
  };

  return { filters, set, query, setQuery, counts, fandoms, authors, shown, active };
}

export type LibraryFilters = ReturnType<typeof createLibraryFilters>;
