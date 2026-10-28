import '@/assets/app.css';
import { liveQuery } from 'dexie';
import { createResource, createSignal, from, Match, onCleanup, Show, Switch } from 'solid-js';
import { render } from 'solid-js/web';
import { browser } from 'wxt/browser';
import { card, linkButton } from '@/components/ui';
import { WorkView } from '@/components/WorkView';
import { ao3WorkId, parseAo3Work } from '@/utils/ao3';
import { fetchAo3Work, refreshIfTracked } from '@/utils/ao3-fetch';
import { db } from '@/utils/db';
import type { Ao3WorkInput } from '@/utils/library';
import { LibraryView } from './LibraryView';

// The work in the active tab, read from the page itself so it costs AO3 nothing. Falls
// back to one fetch when the tab is on the adult-content warning. Viewing a tracked work
// refreshes its stored metadata; status and personal fields are kept.
async function readTabWork(tab: { url: string; id: number }): Promise<Ao3WorkInput | null> {
  const id = ao3WorkId(tab.url);
  if (!id) return null;
  const [frame] = await browser.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => document.documentElement.outerHTML,
  });
  const work = (typeof frame?.result === 'string' && parseAo3Work(frame.result, id)) || (await fetchAo3Work(id));
  await refreshIfTracked(work);
  return work;
}

// One fetch for a URL the user pasted.
async function readUrlWork(url: string): Promise<Ao3WorkInput> {
  const id = ao3WorkId(url);
  if (!id) throw new Error('That isn’t an AO3 work URL.');
  const work = await fetchAo3Work(id);
  await refreshIfTracked(work);
  return work;
}

// What the detail view shows: a work already in hand (library or current tab), or a
// pasted URL still to be fetched.
type Detail = { work: Ao3WorkInput } | { url: string };

function App() {
  const works = from(liveQuery(() => db.ao3Works.toArray()));
  const trackedOf = (id: string) => works()?.find((t) => t.id === id);

  // Follow the active tab of this window only; background tabs loading shouldn't count.
  const [tab, setTab] = createSignal<{ url: string; id: number } | null>(null);
  const followTab = async () => {
    const [t] = await browser.tabs.query({ active: true, currentWindow: true });
    // t.url is only visible for sites we have host access to, i.e. AO3.
    setTab(t?.url && t.id !== undefined ? { url: t.url, id: t.id } : null);
  };
  followTab();
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
  // A failed read (e.g. AO3 down) just means no pinned card; reading an errored
  // resource would throw.
  const [current] = createResource(tab, (t) => readTabWork(t).catch(() => null));

  // The library stays mounted under the detail view so search and scroll survive.
  const [detail, setDetail] = createSignal<Detail | null>(null);
  let libraryScroll = 0;
  const open = (d: Detail) => {
    libraryScroll = window.scrollY;
    setDetail(d);
    window.scrollTo(0, 0);
  };
  const back = () => {
    setDetail(null);
    window.scrollTo(0, libraryScroll);
  };
  const [urlWork] = createResource(() => {
    const d = detail();
    return d && 'url' in d ? d.url : null;
  }, readUrlWork);
  const detailWork = () => {
    const d = detail();
    if (d && 'work' in d) return d.work;
    return urlWork.error ? undefined : urlWork();
  };

  function submitUrl(e: SubmitEvent) {
    e.preventDefault();
    const input = (e.currentTarget as HTMLFormElement).elements.namedItem('url') as HTMLInputElement;
    open({ url: input.value.trim() });
    input.value = '';
  }

  return (
    <main class="grid gap-3.5 p-4">
      <header class="flex items-center justify-between gap-2">
        <h1 class="text-[17px] font-bold">FandomGobbler (Fork)</h1>
        <button onClick={() => browser.tabs.create({ url: browser.runtime.getURL('/dashboard.html') })}>
          Dashboard ↗
        </button>
      </header>

      <Show when={detail()}>
        <nav class="flex min-w-0 items-baseline gap-1.5 text-xs" aria-label="Breadcrumb">
          <button class={linkButton} onClick={back}>
            Library
          </button>
          <span class="text-muted" aria-hidden="true">
            ›
          </span>
          <span class="truncate text-muted" aria-current="page">
            {detailWork()?.title ?? 'Work'}
          </span>
        </nav>
        <Switch>
          <Match when={urlWork.loading}>
            <p class={`${card} text-muted`}>Loading from AO3…</p>
          </Match>
          <Match when={urlWork.error}>
            <p class={`${card} text-danger`}>{(urlWork.error as Error).message}</p>
          </Match>
          <Match when={detailWork()}>{(w) => <WorkView work={w()} tracked={trackedOf(w().id)} />}</Match>
        </Switch>
      </Show>

      <div class="grid gap-3.5" classList={{ hidden: !!detail() }}>
        <form class="flex gap-1.5" onSubmit={submitUrl}>
          <input class="flex-1" name="url" type="url" required placeholder="Paste an AO3 work URL" />
          <button>Add work</button>
        </form>

        <hr class="my-1" />

        <LibraryView works={works()} current={current()} onOpen={(work) => open({ work })} />
      </div>
    </main>
  );
}

render(() => <App />, document.getElementById('app')!);
