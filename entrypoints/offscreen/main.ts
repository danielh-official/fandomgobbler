import { browser } from 'wxt/browser';
import { ao3WorkId } from '@/utils/ao3';
import { parseOrFetchAo3Work } from '@/utils/ao3-fetch';
import { refreshDueWorks, type RefreshProgress } from '@/utils/ao3-refresh';
import { isUnresponsive } from '@/utils/health';
import { saveWork } from '@/utils/library';
import type { Status } from '@/utils/models';

// A hidden page for the background script, which has no DOMParser to read AO3 pages with.
// It parses, fetches and saves; the background only triggers it and reports the result.

export interface AddWorkMessage {
  type: 'add-work';
  url: string;
  html: unknown;
  status: Status;
}
export type AddWorkResponse = { title: string } | { error: string };

export interface RefreshDueMessage {
  type: 'refresh-due';
  count: number;
}
// `unresponsive`: AO3 didn't answer usefully, so the background pauses polling it.
export type RefreshDueResponse = RefreshProgress | { error: string; unresponsive: boolean };

async function addWork(msg: AddWorkMessage): Promise<string> {
  const id = ao3WorkId(msg.url);
  if (!id) throw new Error('Not an AO3 work page.');
  const work = await parseOrFetchAo3Work(msg.html, id);
  await saveWork({ ...work, status: msg.status });
  return work.title;
}

// One batch at a time: a slow batch (AO3 rate-limiting) shouldn't overlap the next alarm.
let refreshing = false;
async function refreshDue(count: number): Promise<RefreshProgress> {
  if (refreshing) throw new Error('A refresh is already running.');
  refreshing = true;
  try {
    return await refreshDueWorks(count);
  } finally {
    refreshing = false;
  }
}

browser.runtime.onMessage.addListener((msg: AddWorkMessage | RefreshDueMessage, _sender, sendResponse) => {
  const fail = (e: Error) => sendResponse({ error: e.message });
  if (msg?.type === 'add-work') addWork(msg).then((title) => sendResponse({ title } satisfies AddWorkResponse), fail);
  else if (msg?.type === 'refresh-due') {
    refreshDue(msg.count).then(sendResponse, (e: Error) =>
      sendResponse({ error: e.message, unresponsive: isUnresponsive(e) } satisfies RefreshDueResponse),
    );
  } else return;
  return true; // Keeps the channel open for the async response.
});
