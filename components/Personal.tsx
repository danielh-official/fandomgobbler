import { For, onCleanup, untrack } from 'solid-js';
import { saveAo3Work } from '@/utils/library';
import type { Ao3Work } from '@/utils/models';

// Notes, rating and chapter progress. Only for tracked works: untracked ones aren't stored.
// Render keyed on the work id: the notes field is uncontrolled so saves don't move the cursor.
export function Personal(props: { work: Ao3Work }) {
  const w = () => props.work;

  let notesTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingNotes: string | undefined;
  const flushNotes = () => {
    clearTimeout(notesTimer);
    if (pendingNotes !== undefined) saveAo3Work({ ...w(), notes: pendingNotes });
    pendingNotes = undefined;
  };
  onCleanup(flushNotes);

  const setRating = (n: number) => saveAo3Work({ ...w(), rating: w().rating === n ? undefined : n });

  const maxChapter = () => w().chaptersPosted ?? Infinity;
  const setChapter = (n: number) => {
    const num = Math.min(Math.max(0, Math.floor(n) || 0), maxChapter());
    saveAo3Work({ ...w(), furthestChapter: num ? { num, total: w().chaptersTotal ?? undefined } : undefined });
  };
  const chapter = () => w().furthestChapter?.num ?? 0;

  return (
    <>
      <div>
        <h2>Current chapter</h2>
        <div class="chapter-row">
          <input
            type="number"
            min="0"
            max={w().chaptersPosted ?? undefined}
            value={chapter() || ''}
            placeholder="–"
            aria-label="Current chapter"
            onChange={(e) => setChapter(e.currentTarget.valueAsNumber)}
          />
          <span class="muted">of {w().chaptersPosted ?? '?'}{w().chaptersTotal ? '' : ' (ongoing)'}</span>
          <button onClick={() => setChapter(chapter() + 1)} disabled={chapter() >= maxChapter()}>
            +1
          </button>
        </div>
      </div>

      <div>
        <h2>My rating</h2>
        <div class="stars" role="group" aria-label="My rating">
          <For each={[1, 2, 3, 4, 5]}>
            {(n) => (
              <button
                class="star"
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
        <h2>Notes</h2>
        <textarea
          class="notes"
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
