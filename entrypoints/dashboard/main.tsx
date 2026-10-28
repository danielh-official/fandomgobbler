import '@/assets/app.css';
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
import { dangerButton, linkButton, pressed, primaryButton } from '@/components/ui';

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
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  const pageAllSelected = () => pageWorks().length > 0 && pageWorks().every((w) => selected().has(w.id));
  const togglePage = () => {
    const next = new Set(selected());
    const add = !pageAllSelected();
    for (const w of pageWorks()) {
      if (add) next.add(w.id);
      else next.delete(w.id);
    }
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
    <div class="mx-auto grid max-w-[1600px] gap-4 p-4 [grid-template-areas:'header'_'filters'_'main'] md:grid-cols-[220px_minmax(0,1fr)] md:px-6 md:py-5 md:[grid-template-areas:'header_header'_'filters_main']">
      <header class="flex flex-wrap items-center gap-x-5 gap-y-2.5 [grid-area:header]">
        <h1 class="text-lg font-bold">FandomGobbler (Fork)</h1>
        <input
          type="search"
          class="max-w-[520px] flex-[1_1_260px] px-2.5 py-[7px]"
          placeholder="Search title, author, fandom, notes"
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
        />
        <button class={primaryButton} onClick={() => setModal({ kind: 'add' })}>
          + Add work
        </button>
      </header>

      <aside
        class="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] content-start gap-3 [grid-area:filters] md:sticky md:top-4 md:grid-cols-none md:self-start"
        aria-label="Filters"
      >
        <label class={fieldClass}>
          <span>Status</span>
          <select
            class="text-sm text-text"
            value={status()}
            onChange={(e) => setStatus(e.currentTarget.value as LibraryFilter['status'])}
          >
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
        <label class={fieldClass}>
          <span>Fandom</span>
          <select class="text-sm text-text" value={fandom()} onChange={(e) => setFandom(e.currentTarget.value)}>
            <option value="">All fandoms</option>
            <For each={fandoms()}>
              {([f, n]) => (
                <option value={f}>
                  {f} ({n})
                </option>
              )}
            </For>
          </select>
        </label>
        <label class={fieldClass}>
          <span>Author</span>
          <select class="text-sm text-text" value={author()} onChange={(e) => setAuthor(e.currentTarget.value)}>
            <option value="">All authors</option>
            <For each={authors()}>
              {([a, n]) => (
                <option value={a}>
                  {a} ({n})
                </option>
              )}
            </For>
          </select>
        </label>
      </aside>

      <main class="grid min-w-0 content-start gap-2.5 [grid-area:main]">
        <div class="flex min-h-[34px] flex-wrap items-center gap-2">
          <label class="mr-auto flex items-center gap-2 text-muted">
            <input
              type="checkbox"
              checked={pageAllSelected()}
              onChange={togglePage}
              aria-label="Select all on this page"
            />
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
              <For each={STATUSES.filter((s) => s !== 'lost')}>
                {(s) => <option value={s}>{STATUS_LABELS[s]}</option>}
              </For>
            </select>
            <Show when={confirmRemove()} fallback={<button onClick={() => setConfirmRemove(true)}>Remove…</button>}>
              <button class={dangerButton} onClick={bulkRemove}>
                Remove {selected().size}
              </button>
              <button onClick={() => setConfirmRemove(false)}>Cancel</button>
            </Show>
          </Show>
          <div class="flex" role="group" aria-label="Layout">
            <button class={`rounded-r-none ${pressed}`} aria-pressed={!grid()} onClick={() => setGrid(false)}>
              List
            </button>
            <button class={`-ml-px rounded-l-none ${pressed}`} aria-pressed={grid()} onClick={() => setGrid(true)}>
              Grid
            </button>
          </div>
        </div>

        <div
          class={
            grid()
              ? 'grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3'
              : 'overflow-hidden rounded-lg border bg-surface'
          }
          role="list"
        >
          <Show when={!grid()}>
            <div class="@container border-b" aria-hidden="true">
              <div class={`${rowGrid} text-xs tracking-wider text-muted uppercase @max-[820px]:hidden`}>
                <span />
                <For each={COLUMN_LABELS}>{(label) => <span>{label}</span>}</For>
              </div>
            </div>
          </Show>
          <For each={pageWorks()} fallback={<p class="px-3.5 py-6 text-muted">No works match.</p>}>
            {(w) => (
              <Row
                work={w}
                grid={grid()}
                selected={selected().has(w.id)}
                onToggle={() => toggle(w.id)}
                onOpen={() => setModal({ kind: 'edit', id: w.id })}
              />
            )}
          </For>
        </div>

        <Show when={pages() > 1}>
          <nav class="flex items-center justify-center gap-3" aria-label="Pages">
            <button disabled={page() === 0} onClick={() => setPage(page() - 1)}>
              ← Previous
            </button>
            <span class="text-muted">
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

const fieldClass = 'grid gap-1 text-xs text-muted';

// Table columns on wide rows; on rows narrower than 820px (small screens, grid cards)
// the same cells become a card: checkbox beside the title, details wrapping below.
const rowGrid =
  'grid grid-cols-[20px_minmax(0,1fr)_110px_190px_80px_70px_190px_60px] items-center gap-3 px-3.5 py-2.5 @max-[820px]:grid-cols-[20px_minmax(0,1fr)] @max-[820px]:gap-y-1.5';

// Placeholder for an empty cell; card layout hides cells that only hold one.
const Empty = () => (
  <span class="text-muted" data-empty>
    –
  </span>
);

// Each row is its own size container (@container), so it lays out by its own width.
function Row(props: { work: Ao3Work; grid: boolean; selected: boolean; onToggle: () => void; onOpen: () => void }) {
  const w = () => props.work;
  const bg = () => (props.selected ? 'bg-accent-soft' : props.grid ? 'bg-surface' : '');
  return (
    <div
      class={`@container ${bg()} ${props.grid ? 'relative rounded-lg border' : 'border-b last:border-b-0'}`}
      role="listitem"
    >
      {/* In grid view, room is reserved at the bottom for the corner chapter link. */}
      <div class={`${rowGrid} ${props.grid ? 'pb-[34px]' : ''}`}>
        <input
          type="checkbox"
          class="@max-[820px]:row-span-2 @max-[820px]:mt-[3px] @max-[820px]:self-start"
          checked={props.selected}
          onChange={() => props.onToggle()}
          aria-label={`Select ${w().title}`}
        />
        <div>
          <button class={linkButton} onClick={() => props.onOpen()}>
            {w().title}
          </button>
          <div class="text-xs text-muted">
            by {w().author}
            <Show when={w().fandoms?.[0]}>{(f) => <> · {f()}</>}</Show>
          </div>
        </div>
        {/* On wide rows this wrapper disappears and its cells become table columns. */}
        <div class="contents @max-[820px]:col-start-2 @max-[820px]:flex @max-[820px]:flex-wrap @max-[820px]:gap-x-3.5 @max-[820px]:gap-y-1 @max-[820px]:[&>span:has(>[data-empty])]:hidden">
          <span class="@max-[820px]:text-xs @max-[820px]:font-semibold">{STATUS_LABELS[w().status]}</span>
          <span class="text-xs">
            <Show when={w().chaptersPosted != null} fallback={<Empty />}>
              Ch. {w().furthestChapter?.num ?? 0} / {w().chaptersPosted}
              {isOngoing(w()) ? ' (ongoing)' : ''}
              <span class="text-muted"> | {unreadChapters(w())} unread</span>
            </Show>
          </span>
          <span class="text-xs tabular-nums">
            <Show when={w().wordCount} fallback={<Empty />}>
              {(n) => (
                <>
                  {n().toLocaleString()}
                  <span class="hidden @max-[820px]:inline"> words</span>
                </>
              )}
            </Show>
          </span>
          <span class="text-xs text-star tabular-nums">
            <Show when={w().rating} fallback={<Empty />}>
              {(r) => '★'.repeat(r())}
            </Show>
          </span>
          <span class="text-xs">
            <Show when={lastUpdated(w())} fallback={<Empty />}>
              {(t) => (
                <>
                  <span class="hidden @max-[820px]:inline">Updated </span>
                  {formatDate(t())} <span class="text-muted">({relativeDay(t())})</span>
                </>
              )}
            </Show>
          </span>
          <ChapterLink
            work={w()}
            class={`text-xs ${props.grid ? 'absolute right-3.5 bottom-2.5' : '@max-[820px]:ml-auto @max-[820px]:self-end'}`}
          />
        </div>
      </div>
    </div>
  );
}

render(() => <Dashboard />, document.getElementById('app')!);
