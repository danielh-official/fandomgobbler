import { createEffect, createSignal, For, Show } from 'solid-js';
import { ChapterLink } from '@/components/ChapterLink';
import { card, linkButton } from '@/components/ui';
import type { Ao3WorkInput } from '@/utils/library';
import { createLibraryFilters } from '@/utils/library-filters';
import { isOngoing, lastUpdated, unreadChapters, type LibraryFilter } from '@/utils/library-view';
import { STATUS_LABELS, STATUSES, type Ao3Work } from '@/utils/models';
import { formatDate, relativeDay } from '@/utils/time';

const FILTERS_OPEN_KEY = 'fg-sidepanel-filters-open';

// Storage may be unavailable; collapsed is the default.
function loadFiltersOpen(): boolean {
  try {
    return localStorage.getItem(FILTERS_OPEN_KEY) === 'true';
  } catch {
    return false;
  }
}

// `current` is the work in the active tab: pinned first and highlighted, tracked or not,
// and regardless of filters. `works` is undefined until the library has loaded.
export function LibraryView(props: {
  works: Ao3Work[] | undefined;
  current?: Ao3WorkInput | null;
  onOpen: (w: Ao3WorkInput) => void;
}) {
  const lib = createLibraryFilters(() => props.works);
  const total = () => props.works?.length ?? 0;

  // Collapsed by default; whether it's open is remembered for next time.
  const [filtersOpen, setFiltersOpen] = createSignal(loadFiltersOpen());
  createEffect(() => {
    try {
      localStorage.setItem(FILTERS_OPEN_KEY, String(filtersOpen()));
    } catch {
      // See loadFiltersOpen().
    }
  });
  // Shown in the collapsed title so the active filters are visible without opening it.
  const filterSummary = () => {
    const f = lib.filters();
    const parts = [
      f.showRead && 'Showing read',
      f.status !== 'all' && STATUS_LABELS[f.status],
      f.fandom,
      f.author,
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'Unread only';
  };

  return (
    <div class="grid gap-2">
      <details open={filtersOpen()} onToggle={(e) => setFiltersOpen(e.currentTarget.open)}>
        <summary class="cursor-pointer truncate py-0.5 font-semibold">
          Filters
          <Show when={!filtersOpen()}>
            <span class="font-normal text-muted"> · {filterSummary()}</span>
          </Show>
        </summary>
        <div class="mt-1.5 grid gap-1.5">
          <label class="flex items-center gap-2">
            <input
              type="checkbox"
              checked={lib.filters().showRead}
              onChange={(e) => lib.set({ showRead: e.currentTarget.checked })}
            />
            Show read
          </label>

          <select
            value={lib.filters().status}
            onChange={(e) => lib.set({ status: e.currentTarget.value as LibraryFilter['status'] })}
            aria-label="Status"
          >
            <option value="all">All statuses ({total()})</option>
            <For each={STATUSES}>
              {(s) => (
                <option value={s}>
                  {STATUS_LABELS[s]} ({lib.counts()[s]})
                </option>
              )}
            </For>
          </select>

          <div class={card}>
            <select
              value={lib.filters().fandom}
              onChange={(e) => lib.set({ fandom: e.currentTarget.value })}
              aria-label="Fandom"
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
            <select
              value={lib.filters().author}
              onChange={(e) => lib.set({ author: e.currentTarget.value })}
              aria-label="Author"
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
          </div>
        </div>
      </details>

      <hr class="my-1" />

      <input
        type="text"
        placeholder="Search title, author, fandom, notes"
        value={lib.query()}
        onInput={(e) => lib.setQuery(e.currentTarget.value)}
      />

      <Show when={lib.active()}>
        <p class="text-xs text-muted">
          {lib.shown().length} of {total()} works
        </p>
      </Show>

      <ul class="grid gap-1.5">
        <Show when={props.current}>
          {(c) => (
            <WorkCard
              work={c()}
              tracked={props.works?.find((w) => w.id === c().id)}
              current
              onOpen={() => props.onOpen(c())}
            />
          )}
        </Show>
        <For
          each={lib.shown().filter((w) => w.id !== props.current?.id)}
          fallback={
            <Show when={!props.current}>
              <li class="text-muted">No works match.</li>
            </Show>
          }
        >
          {(w) => <WorkCard work={w} tracked={w} onOpen={() => props.onOpen(w)} />}
        </For>
      </ul>
    </div>
  );
}

function WorkCard(props: { work: Ao3WorkInput; tracked?: Ao3Work; current?: boolean; onOpen: () => void }) {
  // Tracked works show what's stored (status, progress, rating); otherwise the page's data.
  const w = () => props.tracked ?? props.work;
  return (
    <li class={`rounded-lg border px-2.5 py-2 ${props.current ? 'border-accent bg-accent-soft' : 'bg-surface'}`}>
      <Show when={props.current}>
        <div class="mb-0.5 text-[11px] font-semibold tracking-wider text-accent uppercase">On this page</div>
      </Show>
      <button class={linkButton} onClick={() => props.onOpen()}>
        {w().title}
      </button>
      <div class="text-xs text-muted">by {w().author}</div>
      <div class="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
        <span classList={{ 'text-muted': !props.tracked }}>
          {props.tracked ? STATUS_LABELS[props.tracked.status] : 'Not in your library'}
        </span>
        <Show when={w().chaptersPosted != null}>
          <span>
            Ch. {w().furthestChapter?.num ?? 0} / {w().chaptersPosted}
            {isOngoing(w()) ? ' (ongoing)' : ''} | {unreadChapters(w())} unread
          </span>
        </Show>
        <Show when={props.tracked?.rating}>{(r) => <span class="text-star">{'★'.repeat(r())}</span>}</Show>
      </div>
      {/* Last-updated text on the left, chapter link pinned bottom right. */}
      <div class="mt-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-xs">
        <Show when={lastUpdated(w())}>
          {(t) => (
            <span class="text-muted">
              Last updated: {formatDate(t())} ({relativeDay(t())})
            </span>
          )}
        </Show>
        <ChapterLink work={w()} class="ml-auto" />
      </div>
    </li>
  );
}
