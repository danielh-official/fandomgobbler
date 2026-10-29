import { browser } from 'wxt/browser';
import type { WorkInput } from './library';
import { workRefFromUrl } from './sites';
import { parseOrFetchWork, refreshIfTracked } from './work-fetch';

// The work in a tab, read from the page itself so it costs the site nothing. Falls back to
// one fetch when the page has no work on it (AO3's adult-content warning). Viewing a
// tracked work refreshes its stored metadata; status and personal fields are kept.
export async function readTabWork(tab: { url: string; id: number }): Promise<WorkInput | null> {
  const ref = workRefFromUrl(tab.url);
  if (!ref) return null;
  const [frame] = await browser.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => document.documentElement.outerHTML,
  });
  const work = await parseOrFetchWork(frame?.result, ref);
  await refreshIfTracked(work);
  return work;
}
