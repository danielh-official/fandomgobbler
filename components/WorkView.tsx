import { For, Show } from 'solid-js';
import { removeWork, saveWork, type WorkInput } from '@/utils/library';
import { Personal } from './Personal';
import { isOngoing } from '@/utils/library-view';
import { PICKABLE_STATUSES, STATUS_LABELS, type Work, type Status } from '@/utils/models';
import { formatDate, relativeDay, relativeTime } from '@/utils/time';
import { card, chip, sectionHeading } from './ui';

const num = (n: number | null | undefined) => (n == null ? null : n.toLocaleString());
// Platform dates are calendar days, so their relative part is in days, not hours.
const day = (t: number | null | undefined) => (t == null ? null : `${formatDate(t)} (${relativeDay(t)})`);

// "71 (ongoing)" with no planned total, "5/10 (ongoing)" or "10/10" with one.
const chapters = (w: WorkInput) =>
  w.chaptersPosted == null
    ? null
    : `${w.chaptersPosted}${w.chaptersTotal == null ? '' : `/${w.chaptersTotal}`}${isOngoing(w) ? ' (ongoing)' : ''}`;

export function WorkView(props: { work: WorkInput; tracked?: Work }) {
  const w = () => props.work;
  const status = () => props.tracked?.status;

  // Picking a status tracks the work; clicking the current one untracks it.
  const pickStatus = (s: Status) => (status() === s ? removeWork(w()) : saveWork({ ...w(), status: s }));

  const stats = () =>
    [
      ['Words', num(w().wordCount)],
      ['Chapters', chapters(w())],
      ['Kudos', num(w().kudosCount)],
      ['Bookmarks', num(w().bookmarksCount)],
      ['Hits', num(w().hitsCount)],
      ['Reviews', num(w().reviewsCount)],
      ['Favs', num(w().favoritesCount)],
      ['Follows', num(w().followsCount)],
      ['Published', day(w().publishedAt)],
      ['Updated', day(w().updatedAt)],
      ['Completed', day(w().completedAt)],
    ].filter((s): s is [string, string] => s[1] != null);

  return (
    <section class={card}>
      <div>
        <a class="text-base font-semibold text-text no-underline hover:underline" href={w().url} target="_blank">
          {w().title}
        </a>
        <div class="text-muted">
          by{' '}
          <Show when={w().authorUrl} fallback={w().author}>
            {(url) => (
              <a href={url()} target="_blank">
                {w().author}
              </a>
            )}
          </Show>
        </div>
      </div>

      <Show when={w().fandoms?.length || w().relationship || w().characters || w().genres || w().seriesTitle}>
        <div class="flex flex-wrap gap-x-2.5 gap-y-1 text-[13px]">
          <For each={w().fandoms}>{(f) => <span>{f}</span>}</For>
          <Show when={w().relationship}>
            <span class="text-muted">{w().relationship}</span>
          </Show>
          <Show when={w().characters}>
            <span class="text-muted">{w().characters}</span>
          </Show>
          <Show when={w().genres}>
            <span class="text-muted">{w().genres}</span>
          </Show>
          <Show when={w().seriesUrl}>
            {(url) => (
              <span class="text-muted">
                {w().seriesPosition} of{' '}
                <a href={url()} target="_blank">
                  {w().seriesTitle}
                </a>
              </span>
            )}
          </Show>
        </div>
      </Show>

      <dl class="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
        <For each={stats()}>
          {([label, value]) => (
            <div>
              <dt class="inline">{label}:</dt>
              <dd class="ml-1 inline text-text">{value}</dd>
            </div>
          )}
        </For>
      </dl>

      <Show when={w().summary}>
        <details>
          <summary class="cursor-pointer text-[13px] text-muted">Summary</summary>
          <p class="mt-1.5 whitespace-pre-line">{w().summary}</p>
        </details>
      </Show>

      <div>
        <h2 class={sectionHeading}>Status</h2>
        <div class="flex flex-wrap gap-1.5">
          <For each={PICKABLE_STATUSES}>
            {(s) => (
              <button class={chip} aria-pressed={status() === s} onClick={() => pickStatus(s)}>
                {STATUS_LABELS[s]}
              </button>
            )}
          </For>
          <Show when={status() === 'lost'}>
            <button class={chip} aria-pressed disabled>
              {STATUS_LABELS.lost}
            </button>
          </Show>
        </div>
      </div>

      <Show when={props.tracked?.id} keyed>
        {/* Keyed on id: Personal remounts per work because its notes field is uncontrolled. */}
        {(_id: string) => <Personal work={props.tracked!} />}
      </Show>

      <Show when={props.tracked}>
        {(t) => (
          <p class="text-xs text-muted">
            In your library since {formatDate(t().addedAt)} ({relativeTime(t().addedAt)}).
          </p>
        )}
      </Show>
    </section>
  );
}
