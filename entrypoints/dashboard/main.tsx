import '@/assets/tokens.css';
import '@/assets/components.css';
import './style.css';
import { liveQuery } from 'dexie';
import { createEffect, createMemo, createSignal, For, from, on, Show } from 'solid-js';
import { render } from 'solid-js/web';
import { db } from '@/utils/db';
import { removeAo3Works, setAo3Statuses } from '@/utils/library';
import {
  authorsOf,
  isOngoing,
  lastUpdated,
  statusCounts,
  unreadChapters,
  inStatus,
  valueCounts,
  viewLibrary,
  type LibraryFilter,
} from '@/utils/library-view';
import { STATUS_LABELS, STATUSES, type Ao3Work, type Status } from '@/utils/models';
import { formatDate, relativeDay } from '@/utils/time';
import { WorkModal, type ModalState } from './WorkModal';
import { ChapterLink } from '@/components/ChapterLink';

const PAGE_SIZE = 50;
const COLUMN_LABELS = ['Work', 'Status', 'Progress', 'Words', 'Rating', 'Last updated', 'Read'];

// Filters, layout and page live in the URL so a view can be bookmarked.
function readUrl() {
  const p = new URLSearchParams(location.search);
  const status = p.get('status') as Status | null;
  return {
    status: status && STATUSES.includes(status) ? status : ('all' as const),
    fandom: p.get('fandom') ?? '',
    author: p.get('author') ?? '',
    query: p.get('q') ?? '',
    grid: p.get('view') === 'grid',
    page: Math.max(0, (parseInt(p.get('page') ?? '', 10) || 1) - 1),
  };
}

function Dashboard() {
  const works = from(liveQuery(() => db.ao3Works.toArray()));
  const all = () => works() ?? [];

  const initial = readUrl();
  const [status, setStatus] = createSignal<LibraryFilter['status']>(initial.status);
  const [fandom, setFandom] = createSignal(initial.fandom);
  const [author, setAuthor] = createSignal(initial.author);
  const [query, setQuery] = createSignal(initial.query);
  const [grid, setGrid] = createSignal(initial.grid);
  const [page, setPage] = createSignal(initial.page);

  createEffect(() => {
    const p = new URLSearchParams();
    if (status() !== 'all') p.set('status', status());
    if (fandom()) p.set('fandom', fandom());
    if (author()) p.set('author', author());
    if (query()) p.set('q', query());
    if (grid()) p.set('view', 'grid');
    if (page() > 0) p.set('page', String(page() + 1));
    history.replaceState(null, '', p.size ? `?${p}` : location.pathname);
  });

  const counts = () => statusCounts(all());
  // Fandom and author options only cover works in the selected status.
  const fandoms = createMemo(() => valueCounts(inStatus(all(), status()), (w) => w.fandoms ?? []));
  const authors = createMemo(() => valueCounts(inStatus(all(), status()), authorsOf));
  // A status change can leave the chosen fandom or author with no works; fall back to all.
  // Waits for the library to load so a bookmarked filter isn't cleared on startup.
  createEffect(() => {
    if (!works()) return;
    if (fandom() && !fandoms().some(([f]) => f === fandom())) setFandom('');
    if (author() && !authors().some(([a]) => a === author())) setAuthor('');
  });
  const shown = createMemo(() =>
    viewLibrary(all(), {
      status: status(),
      query: query(),
      fandom: fandom() || undefined,
      author: author() || undefined,
    }),
  );

  const pages = () => Math.max(1, Math.ceil(shown().length / PAGE_SIZE));
  const pageWorks = () => shown().slice(page() * PAGE_SIZE, (page() + 1) * PAGE_SIZE);

  // Bulk actions only ever apply to works visible under the current filter.
  const [selected, setSelected] = createSignal(new Set<string>());
  createEffect(
    on(
      [status, fandom, author, query],
      () => {
        setPage(0);
        setSelected(new Set<string>());
      },
      { defer: true },
    ),
  );
  // Clamp a bookmarked page number once the library has loaded.
  createEffect(() => works() && page() >= pages() && setPage(pages() - 1));
  const toggle = (id: string) => {
    const next = new Set(selected());
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const pageAllSelected = () => pageWorks().length > 0 && pageWorks().every((w) => selected().has(w.id));
  const togglePage = () => {
    const next = new Set(selected());
    for (const w of pageWorks()) pageAllSelected() ? next.delete(w.id) : next.add(w.id);
    setSelected(next);
  };
  const [confirmRemove, setConfirmRemove] = createSignal(false);
  async function bulkStatus(s: Status) {
    await setAo3Statuses([...selected()], s);
    setSelected(new Set<string>());
  }
  async function bulkRemove() {
    await removeAo3Works([...selected()]);
    setSelected(new Set<string>());
    setConfirmRemove(false);
  }

  const [modal, setModal] = createSignal<ModalState>(null);

  return (
    <div class="dash">
      <header class="dash-header">
        <h1>FandomGobbler (Fork)</h1>
        <input
          type="search"
          class="dash-search"
          placeholder="Search title, author, fandom, notes"
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
        />
        <button class="primary" onClick={() => setModal({ kind: 'add' })}>
          + Add work
        </button>
      </header>

      <aside class="dash-filters" aria-label="Filters">
        <label class="field">
          <span>Status</span>
          <select value={status()} onChange={(e) => setStatus(e.currentTarget.value as LibraryFilter['status'])}>
            <option value="all">All statuses ({all().length})</option>
            <For each={STATUSES}>
              {(s) => (
                <option value={s}>
                  {STATUS_LABELS[s]} ({counts()[s]})
                </option>
              )}
            </For>
          </select>
        </label>
        <label class="field">
          <span>Fandom</span>
          <select value={fandom()} onChange={(e) => setFandom(e.currentTarget.value)}>
            <option value="">All fandoms</option>
            <For each={fandoms()}>{([f, n]) => <option value={f}>{f} ({n})</option>}</For>
          </select>
        </label>
        <label class="field">
          <span>Author</span>
          <select value={author()} onChange={(e) => setAuthor(e.currentTarget.value)}>
            <option value="">All authors</option>
            <For each={authors()}>{([a, n]) => <option value={a}>{a} ({n})</option>}</For>
          </select>
        </label>
      </aside>

      <main class="dash-main">
        <div class="bulk-bar">
          <label class="check">
            <input type="checkbox" checked={pageAllSelected()} onChange={togglePage} aria-label="Select all on this page" />
            <span>
              {selected().size ? `${selected().size} selected` : `${shown().length} of ${all().length} works`}
            </span>
          </label>
          <Show when={selected().size}>
            <select
              value=""
              onChange={(e) => {
                const s = e.currentTarget.value as Status;
                e.currentTarget.value = '';
                if (s) bulkStatus(s);
              }}
              aria-label="Set status for selected works"
            >
              <option value="">Set status…</option>
              <For each={STATUSES.filter((s) => s !== 'lost')}>{(s) => <option value={s}>{STATUS_LABELS[s]}</option>}</For>
            </select>
            <Show when={confirmRemove()} fallback={<button onClick={() => setConfirmRemove(true)}>Remove…</button>}>
              <button class="danger" onClick={bulkRemove}>
                Remove {selected().size}
              </button>
              <button onClick={() => setConfirmRemove(false)}>Cancel</button>
            </Show>
          </Show>
          <div class="view-toggle" role="group" aria-label="Layout">
            <button aria-pressed={!grid()} onClick={() => setGrid(false)}>
              List
            </button>
            <button aria-pressed={grid()} onClick={() => setGrid(true)}>
              Grid
            </button>
          </div>
        </div>

        <div class="rows" classList={{ 'grid-view': grid() }} role="list">
          <div class="row row-head" aria-hidden="true">
            <div class="row-inner">
              <span />
              <For each={COLUMN_LABELS}>{(label) => <span>{label}</span>}</For>
            </div>
          </div>
          <For each={pageWorks()} fallback={<p class="muted empty">No works match.</p>}>
            {(w) => (
              <Row
                work={w}
                selected={selected().has(w.id)}
                onToggle={() => toggle(w.id)}
                onOpen={() => setModal({ kind: 'edit', id: w.id })}
              />
            )}
          </For>
        </div>

        <Show when={pages() > 1}>
          <nav class="pager" aria-label="Pages">
            <button disabled={page() === 0} onClick={() => setPage(page() - 1)}>
              ← Previous
            </button>
            <span class="muted">
              Page {page() + 1} of {pages()}
            </span>
            <button disabled={page() >= pages() - 1} onClick={() => setPage(page() + 1)}>
              Next →
            </button>
          </nav>
        </Show>
      </main>

      <WorkModal state={modal()} library={all()} onClose={() => setModal(null)} />
    </div>
  );
}

// Each row is its own size container: wide rows lay out as table columns, narrow ones
// (small screens or grid view) as cards.
function Row(props: { work: Ao3Work; selected: boolean; onToggle: () => void; onOpen: () => void }) {
  const w = () => props.work;
  return (
    <div class="row" role="listitem" classList={{ selected: props.selected }}>
      <div class="row-inner">
        <input type="checkbox" checked={props.selected} onChange={props.onToggle} aria-label={`Select ${w().title}`} />
        <div class="cell-work">
          <button class="link" onClick={props.onOpen}>
            {w().title}
          </button>
          <div class="muted small">
            by {w().author}
            <Show when={w().fandoms?.[0]}>{(f) => <> · {f()}</>}</Show>
          </div>
        </div>
        <div class="cell-meta">
          <span class="cell-status">{STATUS_LABELS[w().status]}</span>
          <span class="cell-progress small">
            <Show when={w().chaptersPosted != null} fallback={<span class="muted none">–</span>}>
              Ch. {w().furthestChapter?.num ?? 0} / {w().chaptersPosted}
              {isOngoing(w()) ? ' (ongoing)' : ''}
              <span class="muted"> | {unreadChapters(w())} unread</span>
            </Show>
          </span>
          <span class="cell-words small">
            <Show when={w().wordCount} fallback={<span class="muted none">–</span>}>
              {(n) => (
                <>
                  {n().toLocaleString()}
                  <span class="unit"> words</span>
                </>
              )}
            </Show>
          </span>
          <span class="cell-rating small">
            <Show when={w().rating} fallback={<span class="muted none">–</span>}>
              {(r) => '★'.repeat(r())}
            </Show>
          </span>
          <span class="cell-updated small">
            <Show when={lastUpdated(w())} fallback={<span class="muted none">–</span>}>
              {(t) => (
                <>
                  <span class="unit">Updated </span>
                  {formatDate(t())} <span class="muted">({relativeDay(t())})</span>
                </>
              )}
            </Show>
          </span>
          <ChapterLink work={w()} class="cell-open small" />
        </div>
      </div>
    </div>
  );
}

render(() => <Dashboard />, document.getElementById('app')!);
