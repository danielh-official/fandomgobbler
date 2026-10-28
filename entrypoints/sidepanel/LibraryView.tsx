import { createEffect, createMemo, createSignal, For, Show } from 'solid-js';
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
import { STATUS_LABELS, STATUSES, type Ao3Work } from '@/utils/models';
import { formatDate, relativeDay } from '@/utils/time';
import { ChapterLink } from '@/components/ChapterLink';
import { linkButton, sectionHeading } from '@/components/ui';

const PREFS_KEY = 'fg-library-prefs';

type Prefs = { status: LibraryFilter['status']; fandom: string; author: string };

// Per-viewer convenience only, so localStorage is fine; it may be unavailable.
function loadPrefs(): Prefs {
  const prefs: Prefs = { status: 'all', fandom: '', author: '' };
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') ?? {};
    if (STATUSES.includes(saved.status)) prefs.status = saved.status;
    if (typeof saved.fandom === 'string') prefs.fandom = saved.fandom;
    if (typeof saved.author === 'string') prefs.author = saved.author;
  } catch {
    // Storage can be unavailable; remembered filters are only a convenience.
  }
  return prefs;
}

export function LibraryView(props: { works: Ao3Work[]; onOpen: (w: Ao3Work) => void }) {
  const prefs = loadPrefs();
  const [status, setStatus] = createSignal(prefs.status);
  const [fandom, setFandom] = createSignal(prefs.fandom);
  const [author, setAuthor] = createSignal(prefs.author);
  const [query, setQuery] = createSignal('');
  createEffect(() => {
    const next: Prefs = { status: status(), fandom: fandom(), author: author() };
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      // Storage can be unavailable; remembered filters are only a convenience.
    }
  });

  const counts = () => statusCounts(props.works);
  // Fandom and author options only cover works in the selected status.
  const fandoms = createMemo(() => valueCounts(inStatus(props.works, status()), (w) => w.fandoms ?? []));
  const authors = createMemo(() => valueCounts(inStatus(props.works, status()), authorsOf));
  // A status change can leave the chosen fandom or author with no works; fall back to all.
  // Skipped while the library is still loading (empty) so saved filters survive startup.
  createEffect(() => {
    if (!props.works.length) return;
    if (fandom() && !fandoms().some(([f]) => f === fandom())) setFandom('');
    if (author() && !authors().some(([a]) => a === author())) setAuthor('');
  });
  const shown = () =>
    viewLibrary(props.works, {
      status: status(),
      query: query(),
      fandom: fandom() || undefined,
      author: author() || undefined,
    });

  return (
    <div class="grid gap-2">
      <input
        type="text"
        placeholder="Search title, author, fandom, notes"
        value={query()}
        onInput={(e) => setQuery(e.currentTarget.value)}
      />

      <section>
        <h2 class={sectionHeading}>Filters</h2>
        <div class="grid grid-cols-2 gap-1.5">
          <select
            value={status()}
            onChange={(e) => setStatus(e.currentTarget.value as LibraryFilter['status'])}
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
          <select value={fandom()} onChange={(e) => setFandom(e.currentTarget.value)} aria-label="Fandom">
            <option value="">All fandoms</option>
            <For each={fandoms()}>
              {([f, n]) => (
                <option value={f}>
                  {f} ({n})
                </option>
              )}
            </For>
          </select>
          <select value={author()} onChange={(e) => setAuthor(e.currentTarget.value)} aria-label="Author">
            <option value="">All authors</option>
            <For each={authors()}>
              {([a, n]) => (
                <option value={a}>
                  {a} ({n})
                </option>
              )}
            </For>
          </select>
        </div>
      </section>

      <Show when={query() || status() !== 'all' || fandom() || author()}>
        <p class="text-xs text-muted">
          {shown().length} of {props.works.length} works
        </p>
      </Show>

      <ul class="grid gap-1.5">
        <For each={shown()} fallback={<li class="text-muted">No works match.</li>}>
          {(w) => (
            <li class="rounded-lg border bg-surface px-2.5 py-2">
              <button class={linkButton} onClick={() => props.onOpen(w)}>
                {w.title}
              </button>
              <div class="text-xs text-muted">by {w.author}</div>
              <div class="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                <span>{STATUS_LABELS[w.status]}</span>
                <Show when={w.chaptersPosted != null}>
                  <span>
                    Ch. {w.furthestChapter?.num ?? 0} / {w.chaptersPosted}
                    {isOngoing(w) ? ' (ongoing)' : ''} | {unreadChapters(w)} unread
                  </span>
                </Show>
                <Show when={w.rating}>{(r) => <span>{'★'.repeat(r())}</span>}</Show>
              </div>
              {/* Last-updated text on the left, chapter link pinned bottom right. */}
              <div class="mt-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-xs">
                <Show when={lastUpdated(w)}>
                  {(t) => (
                    <span class="text-muted">
                      Last updated: {formatDate(t())} ({relativeDay(t())})
                    </span>
                  )}
                </Show>
                <ChapterLink work={w} class="ml-auto" />
              </div>
            </li>
          )}
        </For>
      </ul>
    </div>
  );
}
