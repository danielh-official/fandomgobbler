import { createSignal, For, onCleanup, Show } from 'solid-js';
import { primaryButton } from '@/components/ui';
import {
  detectAo3Username,
  IMPORT_SOURCES,
  PAGE_DELAY_MS,
  runImport,
  type ImportProgress,
  type ImportSource,
} from '@/utils/ao3-import';
import { STATUS_LABELS, STATUSES, type Status } from '@/utils/models';

const USERNAME_KEY = 'fg-ao3-username';

// Storage may be unavailable; the username is only a convenience.
function loadUsername(): string {
  try {
    return localStorage.getItem(USERNAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveUsername(name: string) {
  try {
    localStorage.setItem(USERNAME_KEY, name);
  } catch {
    // See loadUsername().
  }
}

// Unmounting (closing the modal) cancels a running import; what's saved stays saved.
export function ImportFromAo3() {
  const [source, setSource] = createSignal<ImportSource>('bookmarks');
  const [status, setStatus] = createSignal<Status>('want');
  const [username, setUsername] = createSignal(loadUsername());
  const [progress, setProgress] = createSignal<ImportProgress | null>(null);
  const [running, setRunning] = createSignal(false);
  const [done, setDone] = createSignal(false);
  const [error, setError] = createSignal('');

  let controller: AbortController | undefined;
  onCleanup(() => controller?.abort());

  async function start(e: SubmitEvent) {
    e.preventDefault();
    controller = new AbortController();
    setRunning(true);
    setDone(false);
    setError('');
    setProgress(null);
    try {
      const name = username().trim() || (await detectAo3Username());
      setUsername(name);
      saveUsername(name);
      await runImport({
        source: source(),
        username: name,
        status: status(),
        signal: controller.signal,
        onProgress: setProgress,
      });
      setDone(true);
    } catch (err) {
      setError(controller.signal.aborted ? 'Cancelled. Works found so far are saved.' : (err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  const pageText = (p: ImportProgress) => `Page ${p.page}${p.lastPage ? ` of ${p.lastPage}` : ''}`;

  return (
    <form class="grid gap-3" onSubmit={start}>
      <h2 class="text-base font-bold">Import from AO3</h2>
      <p class="text-xs text-muted">
        Adds works from your AO3 list that aren't in your library yet. Works already in your library are left exactly as
        they are, so it's safe to run again. Pages are fetched one at a time, {PAGE_DELAY_MS / 1000} seconds apart, to
        stay within AO3's limits.
      </p>

      <fieldset class="grid gap-1.5" disabled={running()}>
        <label class="grid gap-1 text-xs text-muted">
          <span>List</span>
          <select
            class="text-sm text-text"
            value={source()}
            onChange={(e) => setSource(e.currentTarget.value as ImportSource)}
          >
            <For each={Object.entries(IMPORT_SOURCES)}>{([key, s]) => <option value={key}>{s.label}</option>}</For>
          </select>
        </label>
        <label class="grid gap-1 text-xs text-muted">
          <span>Status for new works</span>
          <select
            class="text-sm text-text"
            value={status()}
            onChange={(e) => setStatus(e.currentTarget.value as Status)}
          >
            <For each={STATUSES.filter((s) => s !== 'lost')}>
              {(s) => <option value={s}>{STATUS_LABELS[s]}</option>}
            </For>
          </select>
        </label>
        <label class="grid gap-1 text-xs text-muted">
          <span>AO3 username</span>
          <input
            type="text"
            class="text-sm text-text"
            placeholder="Detected from AO3 if left empty"
            value={username()}
            onInput={(e) => setUsername(e.currentTarget.value)}
          />
        </label>
      </fieldset>

      <div class="flex gap-2">
        <Show
          when={running()}
          fallback={
            <button class={primaryButton} type="submit">
              {done() || error() ? 'Run again' : 'Start import'}
            </button>
          }
        >
          <button type="button" onClick={() => controller?.abort()}>
            Cancel
          </button>
        </Show>
      </div>

      <Show when={progress()}>
        {(p) => (
          <p class="text-sm" role="status">
            <Show
              when={p().retryingInMs}
              fallback={
                <>
                  {pageText(p())} · {p().seen} works seen · <strong>{p().added} added</strong>
                </>
              }
            >
              {(ms) => <>AO3 asked to slow down. Retrying in {ms() / 1000} seconds…</>}
            </Show>
          </p>
        )}
      </Show>
      <Show when={done() && progress()}>
        {(p) => (
          <p class="text-sm text-accent">
            Done: {p().seen} works in your {IMPORT_SOURCES[source()].label}, {p().added} new added to your library.
          </p>
        )}
      </Show>
      <Show when={error()}>
        <p class="text-sm text-danger">{error()}</p>
      </Show>
    </form>
  );
}
