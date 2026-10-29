import { createResource, For, onCleanup, Show } from 'solid-js';
import { browser } from 'wxt/browser';
import { PLATFORM_IDS, PLATFORMS, type Platform } from '@/utils/platforms';
import { SITES } from '@/utils/sites';
import { primaryButton } from './ui';

// Chrome can hold back site access, e.g. one added by an update. Without it the extension
// can't read that site's tabs or fetch its works, so this says so and asks for it.
export function SiteAccess() {
  const [missing, { refetch }] = createResource(async () => {
    const out: Platform[] = [];
    for (const p of PLATFORM_IDS) {
      if (!(await browser.permissions.contains({ origins: SITES[p].sitePages }))) out.push(p);
    }
    return out;
  });
  browser.permissions.onAdded.addListener(refetch);
  browser.permissions.onRemoved.addListener(refetch);
  onCleanup(() => {
    browser.permissions.onAdded.removeListener(refetch);
    browser.permissions.onRemoved.removeListener(refetch);
  });

  // Straight from the click: Chrome only shows the permission prompt for a user gesture.
  const allow = () => browser.permissions.request({ origins: (missing() ?? []).flatMap((p) => SITES[p].sitePages) });

  return (
    <Show when={missing()?.length}>
      <div class="flex flex-wrap items-center gap-2 rounded-lg border border-danger px-3 py-2 text-sm">
        <span class="flex-1">
          No access to <For each={missing()}>{(p, i) => <>{(i() ? ', ' : '') + PLATFORMS[p].label}</>}</For>: its works
          can't be read or added.
        </span>
        <button class={primaryButton} onClick={allow}>
          Allow access
        </button>
      </div>
    </Show>
  );
}
