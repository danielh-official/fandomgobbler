import { createSignal, For, Show } from 'solid-js';
import { createAo3Category, saveAo3Work, type Ao3WorkInput } from '@/utils/library';
import { STATUS_LABELS, STATUSES, type Ao3Work, type Category, type Status } from '@/utils/models';

const CATEGORY_COLORS = ['#7c3aed', '#db2777', '#dc2626', '#d97706', '#16a34a', '#0891b2', '#2563eb', '#4f46e5', '#d946ef', '#6b7280'];
const categoryColor = (n: number) => CATEGORY_COLORS[n % CATEGORY_COLORS.length] ?? '#6b7280';
// 'lost' is set by the availability checker, not picked by hand.
const PICKABLE = STATUSES.filter((s) => s !== 'lost');

const num = (n: number | null | undefined) => (n == null ? null : n.toLocaleString());
const day = (t: number | null | undefined) => (t == null ? null : new Date(t).toLocaleDateString());

export function WorkView(props: { work: Ao3WorkInput; tracked?: Ao3Work; categories: Category[] }) {
  const w = () => props.work;
  const status = () => props.tracked?.status ?? '';
  const cats = () => props.tracked?.customCats ?? [];

  // Clicking the current status clears it; with no category left that untracks the work.
  const pickStatus = (s: Status) => saveAo3Work({ ...w(), status: status() === s ? '' : s });

  const toggleCategory = (id: string) =>
    saveAo3Work({ ...w(), customCats: cats().includes(id) ? cats().filter((c) => c !== id) : [...cats(), id] });

  const [newName, setNewName] = createSignal('');
  const [newColor, setNewColor] = createSignal(categoryColor(props.categories.length));
  async function addCategory(e: SubmitEvent) {
    e.preventDefault();
    if (!newName().trim()) return;
    const category = await createAo3Category(newName(), newColor());
    await saveAo3Work({ ...w(), customCats: [...cats(), category.id] });
    setNewName('');
    setNewColor(categoryColor(props.categories.length + 1));
  }

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

      <div>
        <h2>Categories</h2>
        <div class="chips" style={{ 'margin-bottom': '8px' }}>
          <For each={props.categories}>
            {(c) => (
              <button class="chip" aria-pressed={cats().includes(c.id)} onClick={() => toggleCategory(c.id)}>
                <span class="dot" style={{ background: c.color }} />
                {c.name}
              </button>
            )}
          </For>
        </div>
        <form class="new-category" onSubmit={addCategory}>
          <input
            type="color"
            value={newColor()}
            onInput={(e) => setNewColor(e.currentTarget.value)}
            aria-label="Category colour"
          />
          <input
            type="text"
            placeholder="New category"
            value={newName()}
            onInput={(e) => setNewName(e.currentTarget.value)}
          />
          <button disabled={!newName().trim()}>Add</button>
        </form>
      </div>

      <Show when={props.tracked}>
        <p class="muted" style={{ margin: 0, 'font-size': '12px' }}>
          In your library since {day(props.tracked!.addedAt)}.
        </p>
      </Show>
    </section>
  );
}
