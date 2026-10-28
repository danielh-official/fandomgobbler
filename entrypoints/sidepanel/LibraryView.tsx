import { createSignal, For, Show } from 'solid-js';
import { isOngoing, lastUpdated, SORTS, statusCounts, unreadChapters, viewLibrary, type LibraryFilter, type SortKey } from '@/utils/library-view';
import { STATUS_LABELS, STATUSES, type Ao3Work } from '@/utils/models';
import { formatDate, relativeDay } from '@/utils/time';

const PREFS_KEY = 'fg-library-prefs';

// Per-viewer convenience only, so localStorage is fine; it may be unavailable.
function loadPrefs(): { status: LibraryFilter['status']; sort: SortKey } {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null');
    if (saved?.sort in SORTS && (saved.status === 'all' || STATUSES.includes(saved.status))) return saved;
  } catch {}
  return { status: 'all', sort: 'recently-added' };
}

export function LibraryView(props: { works: Ao3Work[]; onOpen: (w: Ao3Work) => void }) {
  const prefs = loadPrefs();
  const [status, setStatus] = createSignal(prefs.status);
  const [sort, setSort] = createSignal(prefs.sort);
  const [query, setQuery] = createSignal('');
  const savePrefs = () => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ status: status(), sort: sort() }));
    } catch {}
  };

  const counts = () => statusCounts(props.works);
  const shown = () => viewLibrary(props.works, { status: status(), query: query() }, sort());

  return (
    <div class="library-view">
      <input
        type="text"
        placeholder="Search title, author, fandom, notes"
        value={query()}
        onInput={(e) => setQuery(e.currentTarget.value)}
      />
      <div class="filters">
        <select
          value={status()}
          onChange={(e) => {
            setStatus(e.currentTarget.value as LibraryFilter['status']);
            savePrefs();
          }}
          aria-label="Status"
        >
          <option value="all">All statuses ({props.works.length})</option>
          <For each={STATUSES}>
            {(s) => (
              <option value={s}>
                {STATUS_LABELS[s]} ({counts()[s]})
              </option>
            )}
          </For>
        </select>
        <select
          value={sort()}
          onChange={(e) => {
            setSort(e.currentTarget.value as SortKey);
            savePrefs();
          }}
          aria-label="Sort"
        >
          <For each={Object.entries(SORTS)}>{([key, s]) => <option value={key}>{s.label}</option>}</For>
        </select>
      </div>

      <Show when={query()}>
        <p class="muted small">{shown().length} matching</p>
      </Show>

      <ul class="library">
        <For each={shown()} fallback={<li class="muted">No works match.</li>}>
          {(w) => (
            <li>
              <button class="link" onClick={() => props.onOpen(w)}>{w.title}</button>
              <div class="muted small">by {w.author}</div>
              <div class="item-meta small">
                <span>{STATUS_LABELS[w.status]}</span>
                <Show when={w.chaptersPosted != null}>
                  <span>
                    Ch. {w.furthestChapter?.num ?? 0} / {w.chaptersPosted}
                    {isOngoing(w) ? ' (ongoing)' : ''} | {unreadChapters(w)} unread
                  </span>
                </Show>
                <Show when={w.rating}>{(r) => <span>{'★'.repeat(r())}</span>}</Show>
              </div>
              <Show when={lastUpdated(w)}>
                {(t) => (
                  <div class="muted small">
                    Last updated: {formatDate(t())} ({relativeDay(t())})
                  </div>
                )}
              </Show>
            </li>
          )}
        </For>
      </ul>
    </div>
  );
}
