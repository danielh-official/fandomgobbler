import { browser } from 'wxt/browser';
import { refreshDueWorks, type RefreshProgress } from '@/utils/refresh';
import { workRefFromPage } from '@/utils/sites';
import { parseOrFetchWork } from '@/utils/work-fetch';
import { isUnresponsive } from '@/utils/health';
import { saveWork } from '@/utils/library';
import type { Status } from '@/utils/models';
import type { Platform } from '@/utils/platforms';

// A hidden page for the background script, which has no DOMParser to read work pages with.
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
  platform: Platform;
  count: number;
}
// `unresponsive`: the site didn't answer usefully, so the background pauses polling it.
export type RefreshDueResponse = RefreshProgress | { error: string; unresponsive: boolean };

async function addWork(msg: AddWorkMessage): Promise<string> {
  const ref = workRefFromPage(msg.url, msg.html);
  if (!ref) throw new Error('Not a supported work page.');
  const work = await parseOrFetchWork(msg.html, ref);
  await saveWork({ ...work, status: msg.status });
  return work.title;
}

// One batch at a time: a slow batch (a site rate-limiting) shouldn't overlap the next one.
let refreshing = false;
async function refreshDue(platform: Platform, count: number): Promise<RefreshProgress> {
  if (refreshing) throw new Error('A refresh is already running.');
  refreshing = true;
  try {
    return await refreshDueWorks(platform, count);
  } finally {
    refreshing = false;
  }
}

browser.runtime.onMessage.addListener((msg: AddWorkMessage | RefreshDueMessage, _sender, sendResponse) => {
  const fail = (e: Error) => sendResponse({ error: e.message });
  if (msg?.type === 'add-work') addWork(msg).then((title) => sendResponse({ title } satisfies AddWorkResponse), fail);
  else if (msg?.type === 'refresh-due') {
    refreshDue(msg.platform, msg.count).then(sendResponse, (e: Error) =>
      sendResponse({ error: e.message, unresponsive: isUnresponsive(e) } satisfies RefreshDueResponse),
    );
  } else return;
  return true; // Keeps the channel open for the async response.
});
