import { browser } from 'wxt/browser';
import type { WorkInput } from './library';
import { platformOfUrl, workRefFromPage } from './sites';
import { parseOrFetchWork, refreshIfTracked } from './work-fetch';

// The work in a tab, read from the page itself so it costs the site nothing. Falls back to
// one fetch when the page has no work on it (AO3's adult-content warning). Viewing a
// tracked work refreshes its stored metadata; status and personal fields are kept.
export async function readTabWork(tab: { url: string; id: number }): Promise<WorkInput | null> {
  if (!platformOfUrl(tab.url)) return null;
  const html = await readTabHtml(tab.id);
  // Some pages only say which work they are in their HTML (Wattpad reading pages).
  const ref = workRefFromPage(tab.url, html);
  if (!ref) return null;
  const work = await parseOrFetchWork(html, ref);
  await refreshIfTracked(work);
  return work;
}

export async function readTabHtml(tabId: number): Promise<unknown> {
  const [frame] = await browser.scripting.executeScript({
    target: { tabId },
    func: () => document.documentElement.outerHTML,
  });
  return frame?.result;
}
