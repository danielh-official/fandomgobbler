import { liveQuery } from 'dexie';
import { createResource, createSignal, For, from, Match, onCleanup, Show, Switch } from 'solid-js';
import { render } from 'solid-js/web';
import { browser } from 'wxt/browser';
import { ao3WorkId, ao3WorkUrl, parseAo3Work } from '@/utils/ao3';
import { db } from '@/utils/db';
import { removeAo3Work, saveAo3Work, type Ao3WorkInput } from '@/utils/library';

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
async function loadWork(target: Target): Promise<Ao3WorkInput | null> {
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
  const tracked = () => works()?.find((w) => w.id === work()?.id);

  function submitUrl(e: SubmitEvent) {
    e.preventDefault();
    const input = (e.currentTarget as HTMLFormElement).elements.namedItem('url') as HTMLInputElement;
    setTarget({ url: input.value.trim() });
  }

  return (
    <main style={{ padding: '16px', 'font-family': 'system-ui, sans-serif', 'font-size': '14px' }}>
      <h1 style={{ margin: '0 0 12px', 'font-size': '18px' }}>FandomGobbler (Fork)</h1>

      <form onSubmit={submitUrl} style={{ display: 'flex', gap: '6px', 'margin-bottom': '12px' }}>
        <input name="url" type="url" required placeholder="Paste an AO3 work URL" style={{ flex: 1 }} />
        <button>Open</button>
      </form>

      <section style={{ border: '1px solid #ddd', 'border-radius': '8px', padding: '12px', 'margin-bottom': '16px' }}>
        <Switch fallback={<p style={{ margin: 0 }}>Open an AO3 work, or paste its URL above.</p>}>
          <Match when={work.loading}>
            <p style={{ margin: 0 }}>Loading…</p>
          </Match>
          <Match when={work.error}>
            <p style={{ margin: 0, color: '#b00020' }}>{String(work.error)}</p>
          </Match>
          <Match when={work()}>
            {(w) => (
              <>
                <strong>{w().title}</strong>
                <div style={{ color: '#666', margin: '2px 0 10px' }}>by {w().author}</div>
                <Show
                  when={tracked()}
                  fallback={<button onClick={() => saveAo3Work({ ...w(), status: 'want' })}>Track</button>}
                >
                  {(t) => (
                    <>
                      Tracked · {t().status} <button onClick={() => removeAo3Work(t().id)}>Untrack</button>
                    </>
                  )}
                </Show>
              </>
            )}
          </Match>
        </Switch>
      </section>

      <h2 style={{ 'font-size': '15px', margin: '0 0 6px' }}>Library ({works()?.length ?? 0})</h2>
      <ul style={{ margin: 0, 'padding-left': '18px' }}>
        <For each={works()}>
          {(w) => (
            <li>
              <a href={w.url} target="_blank">{w.title}</a> by {w.author} · {w.status}
            </li>
          )}
        </For>
      </ul>
    </main>
  );
}

render(() => <App />, document.getElementById('app')!);
