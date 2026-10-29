import '@/assets/app.css';
import { liveQuery } from 'dexie';
import { createEffect, createSignal, For, from, on, Show } from 'solid-js';
import { render } from 'solid-js/web';
import { readLibrary, removeWorks, setStatuses } from '@/utils/library';
import { isOngoing, lastUpdated, unreadChapters, type LibraryFilter } from '@/utils/library-view';
import { STATUS_LABELS, STATUSES, workKey, type Work, type Status } from '@/utils/models';
import { formatDate, relativeDay } from '@/utils/time';
import { WorkModal, type ModalState } from './WorkModal';
import { createLibraryFilters } from '@/utils/library-filters';
import { ChapterLink } from '@/components/ChapterLink';
import { PlatformFilter } from '@/components/PlatformFilter';
import { SiteAccess } from '@/components/SiteAccess';
import { ThemePicker } from '@/components/ThemePicker';
import { card, dangerButton, linkButton, pressed, primaryButton } from '@/components/ui';
import { PLATFORMS } from '@/utils/platforms';
import { applySavedTheme } from '@/utils/theme';

const PAGE_SIZE = 50;
const COLUMN_LABELS = ['Work', 'Platform', 'Status', 'Progress', 'Words', 'Rating', 'Last updated', 'Read'];

const VIEW_KEY = 'fg-dashboard-view';

// List or grid, remembered for next time. Storage may be unavailable; list is the default.
function loadGrid(): boolean {
  try {
    return localStorage.getItem(VIEW_KEY) === 'grid';
  } catch {
    return false;
  }
}

function Dashboard() {
  const works = from(liveQuery(readLibrary));
  const all = () => works() ?? [];
  // Filters are shared with the side panel; see createLibraryFilters.
  const lib = createLibraryFilters(works);
  const shown = lib.shown;

  const [grid, setGrid] = createSignal(loadGrid());
  createEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, grid() ? 'grid' : 'list');
    } catch {
      // See loadGrid().
    }
  });
  const [page, setPage] = createSignal(0);

  const pages = () => Math.max(1, Math.ceil(shown().length / PAGE_SIZE));
  const pageWorks = () => shown().slice(page() * PAGE_SIZE, (page() + 1) * PAGE_SIZE);

  // Bulk actions only ever apply to works visible under the current filter.
  const [selected, setSelected] = createSignal(new Set<string>());
  createEffect(
    on(
      [lib.filters, lib.query],
      () => {
        setPage(0);
        setSelected(new Set<string>());
      },
      { defer: true },
    ),
  );
  // Removing works can leave the current page past the end.
  createEffect(() => works() && page() >= pages() && setPage(pages() - 1));
  // Selection holds workKey()s: ids alone can repeat across platforms.
  const toggle = (key: string) => {
    const next = new Set(selected());
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };
  const pageAllSelected = () => pageWorks().length > 0 && pageWorks().every((w) => selected().has(workKey(w)));
  const togglePage = () => {
    const next = new Set(selected());
    const add = !pageAllSelected();
    for (const w of pageWorks()) {
      if (add) next.add(workKey(w));
      else next.delete(workKey(w));
    }
    setSelected(next);
  };
  const [confirmRemove, setConfirmRemove] = createSignal(false);
  async function bulkStatus(s: Status) {
    await setStatuses([...selected()], s);
    setSelected(new Set<string>());
  }
  async function bulkRemove() {
    await removeWorks([...selected()]);
    setSelected(new Set<string>());
    setConfirmRemove(false);
  }

  const [modal, setModal] = createSignal<ModalState>(null);
  // dashboard.html#work=<platform>:<id> (from the toolbar menu) opens that work once the library has
  // loaded; the modal closes itself for a work that isn't there. The hash is then dropped
  // so a reload doesn't reopen it.
  const linked = location.hash.match(/^#work=([a-z0-9]+:\d+)$/)?.[1];
  history.replaceState(null, '', location.pathname);
  let linkOpened = false;
  createEffect(() => {
    if (!linked || linkOpened || !works()) return;
    linkOpened = true;
    setModal({ kind: 'edit', key: linked });
  });

  return (
    <div class="mx-auto grid max-w-[1600px] gap-4 p-4 [grid-template-areas:'header'_'filters'_'main'] md:grid-cols-[220px_minmax(0,1fr)] md:px-6 md:py-5 md:[grid-template-areas:'header_header'_'filters_main']">
      <header class="flex flex-wrap items-center gap-x-5 gap-y-2.5 [grid-area:header]">
        <h1 class="text-lg font-bold">FandomGobbler (Fork)</h1>
        <input
          type="search"
          class="max-w-[520px] flex-[1_1_260px] px-2.5 py-[7px]"
          placeholder="Search title, author, fandom, notes"
          value={lib.query()}
          onInput={(e) => lib.setQuery(e.currentTarget.value)}
        />
        <button class={primaryButton} onClick={() => setModal({ kind: 'add' })}>
          + Add work
        </button>
        <button onClick={() => setModal({ kind: 'import' })}>Import from AO3</button>
        <ThemePicker class="ml-auto" />
        <div class="basis-full empty:hidden">
          <SiteAccess />
        </div>
      </header>

      <aside
        class="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] content-start gap-3 [grid-area:filters] md:sticky md:top-4 md:grid-cols-none md:self-start"
        aria-label="Filters"
      >
        <label class="col-span-full flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={lib.filters().showRead}
            onChange={(e) => lib.set({ showRead: e.currentTarget.checked })}
          />
          Show read
        </label>
        <label class={`${fieldClass} col-span-full`}>
          <span>Status</span>
          <select
            class="text-sm text-text"
            value={lib.filters().status}
            onChange={(e) => lib.set({ status: e.currentTarget.value as LibraryFilter['status'] })}
          >
            <option value="all">All statuses ({lib.shownTotal()})</option>
            <For each={STATUSES}>
              {(s) => (
                <option value={s}>
                  {STATUS_LABELS[s]} ({lib.counts()[s]})
                </option>
              )}
            </For>
          </select>
        </label>
        <div class={`${card} col-span-full sm:grid-cols-2 md:grid-cols-1`}>
          <label class={fieldClass}>
            <span>Fandom</span>
            <select
              class="text-sm text-text"
              value={lib.filters().fandom}
              onChange={(e) => lib.set({ fandom: e.currentTarget.value })}
            >
              <option value="">All fandoms</option>
              {/* `selected` per option: the select's value is set before the library loads, when
                  the saved option doesn't exist yet, so the browser would fall back to "All". */}
              <For each={lib.fandoms()}>
                {([f, n]) => (
                  <option value={f} selected={f === lib.filters().fandom}>
                    {f} ({n})
                  </option>
                )}
              </For>
            </select>
          </label>
          <label class={fieldClass}>
            <span>Author</span>
            <select
              class="text-sm text-text"
              value={lib.filters().author}
              onChange={(e) => lib.set({ author: e.currentTarget.value })}
            >
              <option value="">All authors</option>
              <For each={lib.authors()}>
                {([a, n]) => (
                  <option value={a} selected={a === lib.filters().author}>
                    {a} ({n})
                  </option>
                )}
              </For>
            </select>
          </label>
        </div>
        <PlatformFilter lib={lib} class="col-span-full text-sm" />
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
              {selected().size ? `${selected().size} selected` : `${shown().length} of ${lib.shownTotal()} works`}
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
                selected={selected().has(workKey(w))}
                onToggle={() => toggle(workKey(w))}
                onOpen={() => setModal({ kind: 'edit', key: workKey(w) })}
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
  'grid grid-cols-[20px_minmax(0,1fr)_100px_110px_190px_80px_70px_190px_60px] items-center gap-3 px-3.5 py-2.5 @max-[820px]:grid-cols-[20px_minmax(0,1fr)] @max-[820px]:gap-y-1.5';

// Placeholder for an empty cell; card layout hides cells that only hold one.
const Empty = () => (
  <span class="text-muted" data-empty>
    –
  </span>
);

// Each row is its own size container (@container), so it lays out by its own width.
function Row(props: { work: Work; grid: boolean; selected: boolean; onToggle: () => void; onOpen: () => void }) {
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
          <span class="text-xs text-muted">{PLATFORMS[w().platform].label}</span>
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

applySavedTheme();
render(() => <Dashboard />, document.getElementById('app')!);
