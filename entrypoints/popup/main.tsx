import '@/assets/app.css';
import { liveQuery } from 'dexie';
import { createResource, createSignal, For, from, Show } from 'solid-js';
import { render } from 'solid-js/web';
import { browser } from 'wxt/browser';
import { card, linkButton, primaryButton } from '@/components/ui';
import { readTabWork } from '@/utils/tab';
import { readLibrary, saveWork, type WorkInput } from '@/utils/library';
import { PICKABLE_STATUSES, STATUS_LABELS, workKey, type Status } from '@/utils/models';
import { setTrackedBadge } from '@/utils/badge';
import { applySavedTheme } from '@/utils/theme';

const menuItem = 'w-full border-0 bg-transparent px-2 py-1.5 text-left hover:bg-accent-soft';

// The toolbar icon's menu: add the work in the active tab, and open the other pages.
function Popup() {
  const [tab] = createResource(async () => (await browser.tabs.query({ active: true, currentWindow: true }))[0]);
  // A failed read just means no add card.
  const [work] = createResource(
    () => {
      const t = tab();
      return t?.url && t.id !== undefined ? { url: t.url, id: t.id } : null;
    },
    (t) => readTabWork(t).catch(() => null),
  );
  // The liveQuery callback isn't reactive to work(), so watch the library and look it up.
  const works = from(liveQuery(readLibrary));
  const tracked = () => works()?.find((t) => work() && workKey(t) === workKey(work()!));
  const [status, setStatus] = createSignal<Status>('want');

  async function add(w: WorkInput) {
    await saveWork({ ...w, status: status() });
    // The background also updates it when it's awake; this covers when it isn't.
    const tabId = tab()?.id;
    if (tabId !== undefined) await setTrackedBadge(tabId, true);
  }

  const go = (open: () => unknown) => {
    open();
    window.close();
  };

  return (
    <main class="grid w-72 gap-2 p-2">
      <Show when={work()}>
        {(w) => (
          <div class={`${card} gap-1.5 p-2.5`}>
            <div class="truncate font-semibold" title={w().title}>
              {w().title}
            </div>
            <Show
              when={tracked()}
              fallback={
                <div class="flex gap-1.5">
                  <select
                    class="flex-1"
                    value={status()}
                    onChange={(e) => setStatus(e.currentTarget.value as Status)}
                    aria-label="Status"
                  >
                    <For each={PICKABLE_STATUSES}>{(s) => <option value={s}>{STATUS_LABELS[s]}</option>}</For>
                  </select>
                  <button class={primaryButton} onClick={() => add(w())}>
                    Add work
                  </button>
                </div>
              }
            >
              {(t) => (
                <div class="flex flex-col gap-1 text-xs">
                  <span class="text-muted">In your library: {STATUS_LABELS[t().status]}</span>
                  <button
                    class={linkButton}
                    onClick={() =>
                      go(() =>
                        browser.tabs.create({ url: browser.runtime.getURL(`/dashboard.html#work=${workKey(t())}`) }),
                      )
                    }
                  >
                    Open in dashboard ↗
                  </button>
                </div>
              )}
            </Show>
          </div>
        )}
      </Show>
      <nav class="grid">
        <button
          class={menuItem}
          // Called straight from the click: Chrome only opens the side panel from a user gesture.
          onClick={() =>
            go(() => tab()?.windowId !== undefined && browser.sidePanel.open({ windowId: tab()!.windowId }))
          }
        >
          Open side panel
        </button>
        <button
          class={menuItem}
          onClick={() => go(() => browser.tabs.create({ url: browser.runtime.getURL('/dashboard.html') }))}
        >
          Open dashboard
        </button>
      </nav>
    </main>
  );
}

applySavedTheme();
render(() => <Popup />, document.getElementById('app')!);
