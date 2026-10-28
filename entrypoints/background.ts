import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { liveQuery } from 'dexie';
import { ao3WorkId } from '@/utils/ao3';
import { setTrackedBadge } from '@/utils/badge';
import { db } from '@/utils/db';
import { PICKABLE_STATUSES, STATUS_LABELS, type Status } from '@/utils/models';
import type { AddWorkMessage, AddWorkResponse } from './offscreen/main';

const MENU = 'add-work';
const WORK_PAGES = ['https://archiveofourown.org/works/*', 'https://archiveofourown.org/collections/*/works/*'];

// The background can't parse HTML, so the page is handed to the offscreen document.
let creating: Promise<void> | undefined;
async function ensureOffscreen() {
  const url = browser.runtime.getURL('/offscreen.html');
  const open = await browser.runtime.getContexts({
    contextTypes: [browser.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [url],
  });
  if (open.length) return;
  creating ??= browser.offscreen
    .createDocument({ url, reasons: [browser.offscreen.Reason.DOM_PARSER], justification: 'Read AO3 work pages' })
    .finally(() => (creating = undefined));
  await creating;
}

async function updateBadge(tabId: number, url: string | undefined) {
  const id = url ? ao3WorkId(url) : null;
  await setTrackedBadge(tabId, !!id && !!(await db.ao3Works.get(id)));
}

// Every open AO3 tab; their URLs are visible thanks to the AO3 host permission.
async function updateAllBadges() {
  for (const t of await browser.tabs.query({ url: 'https://archiveofourown.org/*' })) {
    if (t.id !== undefined) await updateBadge(t.id, t.url);
  }
}

// A failed add shows "!" for a few seconds, then the tab's usual badge.
function flashError(tabId: number, url: string) {
  browser.action.setBadgeBackgroundColor({ tabId, color: '#b42318' });
  browser.action.setBadgeText({ tabId, text: '!' });
  setTimeout(() => updateBadge(tabId, url), 4000);
}

async function addFromPage(tabId: number, url: string, status: Status) {
  try {
    const [frame] = await browser.scripting.executeScript({
      target: { tabId },
      func: () => document.documentElement.outerHTML,
    });
    await ensureOffscreen();
    const msg: AddWorkMessage = { type: 'add-work', url, html: frame?.result, status };
    const res: AddWorkResponse = await browser.runtime.sendMessage(msg);
    if ('error' in res) throw new Error(res.error);
    await setTrackedBadge(tabId, true);
  } catch (e) {
    console.error('Could not add work', e);
    flashError(tabId, url);
  }
}

export default defineBackground(() => {
  // The toolbar icon opens the popup menu; the side panel opens from there. Set
  // explicitly because Chrome remembers the earlier "open side panel on click".
  browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });

  // ✓ badge on tabs showing a tracked work. Chrome clears tab badges on navigation, so
  // each page load sets it again; library changes made elsewhere update all AO3 tabs
  // (while this worker is awake; otherwise the next page load catches up).
  browser.tabs.onUpdated.addListener((tabId, change, tab) => {
    if (change.url || change.status === 'complete') updateBadge(tabId, tab.url);
  });
  liveQuery(() => db.ao3Works.toCollection().primaryKeys()).subscribe(() => updateAllBadges());

  // Right-click on an AO3 work page: "Add to library" › status.
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: MENU,
      title: 'Add to library',
      contexts: ['page'],
      documentUrlPatterns: WORK_PAGES,
    });
    for (const s of PICKABLE_STATUSES) {
      browser.contextMenus.create({
        id: `${MENU}:${s}`,
        parentId: MENU,
        title: STATUS_LABELS[s],
        contexts: ['page'],
        documentUrlPatterns: WORK_PAGES,
      });
    }
  });
  browser.contextMenus.onClicked.addListener((info, tab) => {
    const status = String(info.menuItemId).split(':')[1] as Status | undefined;
    if (status && tab?.id !== undefined && info.pageUrl) addFromPage(tab.id, info.pageUrl, status);
  });
});
