import { browser } from 'wxt/browser';
import { ao3WorkId } from './ao3';
import { parseOrFetchAo3Work, refreshIfTracked } from './ao3-fetch';
import type { Ao3WorkInput } from './library';

// The work in a tab, read from the page itself so it costs AO3 nothing. Falls back to one
// fetch when the tab is on the adult-content warning. Viewing a tracked work refreshes
// its stored metadata; status and personal fields are kept.
export async function readTabWork(tab: { url: string; id: number }): Promise<Ao3WorkInput | null> {
  const id = ao3WorkId(tab.url);
  if (!id) return null;
  const [frame] = await browser.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => document.documentElement.outerHTML,
  });
  const work = await parseOrFetchAo3Work(frame?.result, id);
  await refreshIfTracked(work);
  return work;
}
