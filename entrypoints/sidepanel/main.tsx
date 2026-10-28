import '@/assets/tokens.css';
import '@/assets/components.css';
import './style.css';
import { liveQuery } from 'dexie';
import { createResource, createSignal, from, Match, onCleanup, Show, Switch } from 'solid-js';
import { render } from 'solid-js/web';
import { browser } from 'wxt/browser';
import { ao3WorkId, parseAo3Work } from '@/utils/ao3';
import { fetchAo3Work, refreshIfTracked } from '@/utils/ao3-fetch';
import { db } from '@/utils/db';
import { getAo3Work, type Ao3WorkInput } from '@/utils/library';
import { LibraryView } from './LibraryView';
import { WorkView } from '@/components/WorkView';

// What the work view shows: the active tab, a pasted URL, or a work opened from the library.
type Target = { url: string; tabId?: number; fromLibrary?: boolean };

async function activeTabTarget(): Promise<Target | null> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  // tab.url is only visible for sites we have host access to, i.e. AO3.
  return tab?.url ? { url: tab.url, tabId: tab.id } : null;
}

// Reads the open tab when we have one, so it costs AO3 nothing and sees what the user
// sees. Falls back to fetching, e.g. when the tab is on the adult-content warning.
async function readWork(target: Target): Promise<Ao3WorkInput | null> {
  const id = ao3WorkId(target.url);
  if (!id) return null;
  if (target.tabId !== undefined) {
    const [frame] = await browser.scripting.executeScript({
      target: { tabId: target.tabId },
      func: () => document.documentElement.outerHTML,
    });
    const work = typeof frame?.result === 'string' ? parseAo3Work(frame.result, id) : null;
    if (work) return work;
  }
  return fetchAo3Work(id);
}

// Library works open from storage, without touching AO3. Viewing a tracked work from a
// page refreshes its stored metadata; status and personal fields are kept.
async function loadWork(target: Target): Promise<Ao3WorkInput | null> {
  const id = ao3WorkId(target.url);
  if (target.fromLibrary && id) return getAo3Work(id);
  const work = await readWork(target);
  if (work) await refreshIfTracked(work);
  return work;
}

function App() {
  const [tab, setTab] = createSignal<'work' | 'library'>('work');
  const [target, setTarget] = createSignal<Target | null>(null);
  const followTab = () => activeTabTarget().then(setTarget);
  followTab();

  // Follow the active tab of this window only; background tabs loading shouldn't switch views.
  let windowId: number | undefined;
  browser.windows.getCurrent().then((w) => (windowId = w.id));
  const onActivated = (info: { windowId: number }) => info.windowId === windowId && followTab();
  const onUpdated = (_id: number, change: { status?: string }, t: { active: boolean; windowId: number }) =>
    change.status === 'complete' && t.active && t.windowId === windowId && followTab();
  browser.tabs.onActivated.addListener(onActivated);
  browser.tabs.onUpdated.addListener(onUpdated);
  onCleanup(() => {
    browser.tabs.onActivated.removeListener(onActivated);
    browser.tabs.onUpdated.removeListener(onUpdated);
  });

  const [work] = createResource(target, loadWork);
  const works = from(liveQuery(() => db.ao3Works.toArray()));

  function submitUrl(e: SubmitEvent) {
    e.preventDefault();
    const input = (e.currentTarget as HTMLFormElement).elements.namedItem('url') as HTMLInputElement;
    setTarget({ url: input.value.trim() });
  }

  return (
    <main class="panel">
      <header class="panel-header">
        <div class="panel-title">
          <h1>FandomGobbler (Fork)</h1>
          <button onClick={() => browser.tabs.create({ url: browser.runtime.getURL('/dashboard.html') })}>
            Dashboard ↗
          </button>
        </div>
        <nav class="tabs" role="tablist">
          <button role="tab" aria-selected={tab() === 'work'} onClick={() => setTab('work')}>Work</button>
          <button role="tab" aria-selected={tab() === 'library'} onClick={() => setTab('library')}>
            Library ({works()?.length ?? 0})
          </button>
        </nav>
      </header>

      <Show when={tab() === 'work'}>
        <form class="url-form" onSubmit={submitUrl}>
          <input name="url" type="url" required placeholder="Paste an AO3 work URL" />
          <button>Open</button>
        </form>

        <Show when={target()?.fromLibrary}>
          <button class="link small" onClick={followTab}>← Back to current tab</button>
        </Show>

        <Switch fallback={<p class="card muted">Open an AO3 work, or paste its URL above.</p>}>
          <Match when={work.loading}>
            <p class="card muted">Loading…</p>
          </Match>
          <Match when={work.error}>
            <p class="card error">{(work.error as Error).message}</p>
          </Match>
          <Match when={work()}>
            {(w) => (
              <WorkView work={w()} tracked={works()?.find((t) => t.id === w().id)} />
            )}
          </Match>
        </Switch>
      </Show>

      <Show when={tab() === 'library'}>
        <LibraryView
          works={works() ?? []}
          onOpen={(w) => {
            setTarget({ url: w.url, fromLibrary: true });
            setTab('work');
          }}
        />
      </Show>
    </main>
  );
}

render(() => <App />, document.getElementById('app')!);
