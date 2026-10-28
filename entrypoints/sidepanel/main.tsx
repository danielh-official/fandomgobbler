import '@/assets/tokens.css';
import './style.css';
import { liveQuery } from 'dexie';
import { createResource, createSignal, For, from, Match, onCleanup, Switch } from 'solid-js';
import { render } from 'solid-js/web';
import { browser } from 'wxt/browser';
import { ao3WorkId, ao3WorkUrl, parseAo3Work } from '@/utils/ao3';
import { db } from '@/utils/db';
import { getAo3Work, saveAo3Work, type Ao3WorkInput } from '@/utils/library';
import { STATUS_LABELS } from '@/utils/models';
import { WorkView } from './WorkView';

// What the panel is looking at: the active tab, or a URL the user pasted.
type Target = { url: string; tabId?: number };

async function activeTabTarget(): Promise<Target | null> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  // tab.url is only visible for sites we have host access to, i.e. AO3.
  return tab?.url ? { url: tab.url, tabId: tab.id } : null;
}

async function fetchWorkHtml(id: string): Promise<string> {
  const res = await fetch(`${ao3WorkUrl(id)}?view_adult=true`, { credentials: 'include' });
  if (!res.ok) throw new Error(`AO3 returned ${res.status}`);
  return res.text();
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
  const work = parseAo3Work(await fetchWorkHtml(id), id);
  if (!work) throw new Error('Could not read this work from AO3.');
  return work;
}

// Viewing a tracked work refreshes its stored metadata; status and categories are kept.
async function loadWork(target: Target): Promise<Ao3WorkInput | null> {
  const work = await readWork(target);
  if (work && (await getAo3Work(work.id))) await saveAo3Work(work);
  return work;
}

function App() {
  const [target, setTarget] = createSignal<Target | null>(null);
  const followTab = () => activeTabTarget().then(setTarget);
  followTab();

  const onActivated = () => followTab();
  const onUpdated = (_id: number, change: { status?: string }) => change.status === 'complete' && followTab();
  browser.tabs.onActivated.addListener(onActivated);
  browser.tabs.onUpdated.addListener(onUpdated);
  onCleanup(() => {
    browser.tabs.onActivated.removeListener(onActivated);
    browser.tabs.onUpdated.removeListener(onUpdated);
  });

  const [work] = createResource(target, loadWork);
  const works = from(liveQuery(() => db.ao3Works.orderBy('addedAt').reverse().toArray()));
  const categories = from(liveQuery(() => db.ao3Categories.orderBy('name').toArray()));

  function submitUrl(e: SubmitEvent) {
    e.preventDefault();
    const input = (e.currentTarget as HTMLFormElement).elements.namedItem('url') as HTMLInputElement;
    setTarget({ url: input.value.trim() });
  }

  return (
    <main class="panel">
      <h1>FandomGobbler (Fork)</h1>

      <form class="url-form" onSubmit={submitUrl}>
        <input name="url" type="url" required placeholder="Paste an AO3 work URL" />
        <button>Open</button>
      </form>

      <Switch fallback={<p class="card muted">Open an AO3 work, or paste its URL above.</p>}>
        <Match when={work.loading}>
          <p class="card muted">Loading…</p>
        </Match>
        <Match when={work.error}>
          <p class="card error">{String(work.error)}</p>
        </Match>
        <Match when={work()}>
          {(w) => (
            <WorkView
              work={w()}
              tracked={works()?.find((t) => t.id === w().id)}
              categories={categories() ?? []}
            />
          )}
        </Match>
      </Switch>

      <section>
        <h2>Library ({works()?.length ?? 0})</h2>
        <ul class="library">
          <For each={works()}>
            {(w) => (
              <li>
                <a href={w.url} target="_blank">{w.title}</a> <span class="muted">by {w.author}</span>
                <div class="muted">{w.status ? STATUS_LABELS[w.status] : 'No status'}</div>
              </li>
            )}
          </For>
        </ul>
      </section>
    </main>
  );
}

render(() => <App />, document.getElementById('app')!);
