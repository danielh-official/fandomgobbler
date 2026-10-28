import { For, Show } from 'solid-js';
import { removeAo3Work, saveAo3Work, type Ao3WorkInput } from '@/utils/library';
import { Personal } from './Personal';
import { STATUS_LABELS, STATUSES, type Ao3Work, type Status } from '@/utils/models';
import { formatDate, relativeDay, relativeTime } from '@/utils/time';

// 'lost' is set by the availability checker, not picked by hand.
const PICKABLE = STATUSES.filter((s) => s !== 'lost');

const num = (n: number | null | undefined) => (n == null ? null : n.toLocaleString());
// AO3 dates are calendar days, so their relative part is in days, not hours.
const day = (t: number | null | undefined) => (t == null ? null : `${formatDate(t)} (${relativeDay(t)})`);

export function WorkView(props: { work: Ao3WorkInput; tracked?: Ao3Work }) {
  const w = () => props.work;
  const status = () => props.tracked?.status;

  // Picking a status tracks the work; clicking the current one untracks it.
  const pickStatus = (s: Status) => (status() === s ? removeAo3Work(w().id) : saveAo3Work({ ...w(), status: s }));

  const stats = () =>
    [
      ['Words', num(w().wordCount)],
      ['Chapters', w().chaptersPosted == null ? null : `${w().chaptersPosted}/${w().chaptersTotal ?? '?'}`],
      ['Kudos', num(w().kudosCount)],
      ['Bookmarks', num(w().bookmarksCount)],
      ['Hits', num(w().hitsCount)],
      ['Published', day(w().publishedAt)],
      ['Updated', day(w().updatedAt)],
      ['Completed', day(w().completedAt)],
    ].filter((s): s is [string, string] => s[1] != null);

  return (
    <section class="card">
      <div>
        <a class="work-title" href={w().url} target="_blank">{w().title}</a>
        <div class="muted">
          by{' '}
          <Show when={w().authorUrl} fallback={w().author}>
            {(url) => <a href={url()} target="_blank">{w().author}</a>}
          </Show>
        </div>
      </div>

      <Show when={w().fandoms?.length || w().relationship || w().seriesTitle}>
        <div class="tags">
          <For each={w().fandoms}>{(f) => <span>{f}</span>}</For>
          <Show when={w().relationship}>
            <span class="muted">{w().relationship}</span>
          </Show>
          <Show when={w().seriesUrl}>
            {(url) => (
              <span class="muted">
                {w().seriesPosition} of <a href={url()} target="_blank">{w().seriesTitle}</a>
              </span>
            )}
          </Show>
        </div>
      </Show>

      <dl class="stats">
        <For each={stats()}>
          {([label, value]) => (
            <div>
              <dt>{label}:</dt>
              <dd>{value}</dd>
            </div>
          )}
        </For>
      </dl>

      <Show when={w().summary}>
        <details>
          <summary>Summary</summary>
          <p class="summary-text">{w().summary}</p>
        </details>
      </Show>

      <div>
        <h2>Status</h2>
        <div class="chips">
          <For each={PICKABLE}>
            {(s) => (
              <button class="chip" aria-pressed={status() === s} onClick={() => pickStatus(s)}>
                {STATUS_LABELS[s]}
              </button>
            )}
          </For>
          <Show when={status() === 'lost'}>
            <button class="chip" aria-pressed disabled>{STATUS_LABELS.lost}</button>
          </Show>
        </div>
      </div>

      <Show when={props.tracked?.id} keyed>
        {/* Keyed on id: Personal remounts per work because its notes field is uncontrolled. */}
        {(_id: string) => <Personal work={props.tracked!} />}
      </Show>

      <Show when={props.tracked}>
        {(t) => (
          <p class="muted small">
            In your library since {formatDate(t().addedAt)} ({relativeTime(t().addedAt)}).
          </p>
        )}
      </Show>
    </section>
  );
}
