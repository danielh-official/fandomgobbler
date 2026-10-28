import { browser } from 'wxt/browser';
import { ao3WorkId } from '@/utils/ao3';
import { parseOrFetchAo3Work } from '@/utils/ao3-fetch';
import { saveAo3Work } from '@/utils/library';
import type { Status } from '@/utils/models';

// A hidden page for the background script, which has no DOMParser to read AO3 pages with.
// It parses and saves; the background only collects the HTML and reports the result.

export interface AddWorkMessage {
  type: 'add-work';
  url: string;
  html: unknown;
  status: Status;
}
export type AddWorkResponse = { title: string } | { error: string };

async function addWork(msg: AddWorkMessage): Promise<string> {
  const id = ao3WorkId(msg.url);
  if (!id) throw new Error('Not an AO3 work page.');
  const work = await parseOrFetchAo3Work(msg.html, id);
  await saveAo3Work({ ...work, status: msg.status });
  return work.title;
}

browser.runtime.onMessage.addListener((msg: AddWorkMessage, _sender, sendResponse) => {
  if (msg?.type !== 'add-work') return;
  addWork(msg).then(
    (title) => sendResponse({ title } satisfies AddWorkResponse),
    (e: Error) => sendResponse({ error: e.message } satisfies AddWorkResponse),
  );
  return true; // Keeps the channel open for the async response.
});
