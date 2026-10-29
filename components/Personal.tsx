import { For, onCleanup, Show, untrack } from 'solid-js';
import { saveWork } from '@/utils/library';
import type { Work } from '@/utils/models';
import { sectionHeading } from './ui';

// Notes, rating and chapter progress. Only for tracked works: untracked ones aren't stored.
// Render keyed on the work id: the notes field is uncontrolled so saves don't move the cursor.
export function Personal(props: { work: Work }) {
  const w = () => props.work;

  let notesTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingNotes: string | undefined;
  const flushNotes = () => {
    clearTimeout(notesTimer);
    if (pendingNotes !== undefined) saveWork({ ...w(), notes: pendingNotes });
    pendingNotes = undefined;
  };
  onCleanup(flushNotes);

  const setRating = (n: number) => saveWork({ ...w(), rating: w().rating === n ? undefined : n });

  const maxChapter = () => w().chaptersPosted ?? Infinity;
  const setChapter = (n: number) => {
    const num = Math.min(Math.max(0, Math.floor(n) || 0), maxChapter());
    saveWork({
      ...w(),
      furthestChapter: num ? { num, total: w().chaptersTotal ?? undefined } : undefined,
      lastChapterUnfinished: undefined,
    });
  };
  const chapter = () => w().furthestChapter?.num ?? 0;

  return (
    <>
      <div>
        <h2 class={sectionHeading}>Current chapter</h2>
        <div class="flex items-center gap-2">
          <input
            class="w-16"
            type="number"
            min="0"
            max={w().chaptersPosted ?? undefined}
            value={chapter() || ''}
            placeholder="–"
            aria-label="Current chapter"
            onChange={(e) => setChapter(e.currentTarget.valueAsNumber)}
          />
          <span class="text-muted">
            of {w().chaptersPosted ?? '?'}
            {w().chaptersTotal ? '' : ' (ongoing)'}
          </span>
          <button onClick={() => setChapter(chapter() + 1)} disabled={chapter() >= maxChapter()}>
            +1
          </button>
        </div>
        <Show when={chapter() > 0 && chapter() === w().chaptersPosted}>
          <label class="mt-1.5 flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!w().lastChapterUnfinished}
              onChange={(e) => saveWork({ ...w(), lastChapterUnfinished: e.currentTarget.checked || undefined })}
            />
            Not finished yet
            <span class="text-xs text-muted">(still counts as unread)</span>
          </label>
        </Show>
      </div>

      <div>
        <h2 class={sectionHeading}>My rating</h2>
        <div class="flex gap-0.5" role="group" aria-label="My rating">
          <For each={[1, 2, 3, 4, 5]}>
            {(n) => (
              <button
                class="border-0 bg-transparent px-0.5 py-0 text-xl leading-none text-border aria-pressed:text-star"
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
                aria-pressed={(w().rating ?? 0) >= n}
                onClick={() => setRating(n)}
              >
                ★
              </button>
            )}
          </For>
        </div>
      </div>

      <div>
        <h2 class={sectionHeading}>Notes</h2>
        <textarea
          class="w-full resize-y"
          rows="4"
          value={untrack(() => props.work.notes ?? '')}
          placeholder="Private notes"
          onInput={(e) => {
            pendingNotes = e.currentTarget.value;
            clearTimeout(notesTimer);
            notesTimer = setTimeout(flushNotes, 400);
          }}
          onBlur={flushNotes}
        />
      </div>
    </>
  );
}
