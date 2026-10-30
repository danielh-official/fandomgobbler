import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { liveQuery } from 'dexie';
import { setTrackedBadge } from '@/utils/badge';
import { db } from '@/utils/db';
import { PICKABLE_STATUSES, STATUS_LABELS, type Status } from '@/utils/models';
import { isUnresponsiveStatus, isWaiting, recordFailure } from '@/utils/health';
import { PLATFORM_IDS, PLATFORMS, type Platform } from '@/utils/platforms';
import { platformOfUrl, SITES, workRefFromPage, workRefFromUrl } from '@/utils/sites';
import { readTabHtml } from '@/utils/tab';
import { loadHealth, REFRESH_BATCH, REFRESH_EVERY_MIN, saveHealth } from '@/utils/refresh-settings';
import type { AddWorkMessage, AddWorkResponse, RefreshDueMessage, RefreshDueResponse } from './offscreen/main';

const MENU = 'add-work';
const REFRESH_ALARM = 'refresh';
const WORK_PAGES = PLATFORM_IDS.flatMap((p) => SITES[p].workPages);
const SITE_PAGES = PLATFORM_IDS.flatMap((p) => SITES[p].sitePages);

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
    .createDocument({
      url,
      reasons: [browser.offscreen.Reason.DOM_PARSER],
      justification: 'Read fanfiction work pages',
    })
    .finally(() => (creating = undefined));
  await creating;
}

async function updateBadge(tabId: number, url: string | undefined) {
  if (!url) return setTrackedBadge(tabId, false);
  // Pages whose URL doesn't name the work (Wattpad parts) are read for it; reading a tab
  // costs the site nothing.
  const platform = platformOfUrl(url);
  const ref =
    workRefFromUrl(url) ??
    (platform && SITES[platform].pageWorkId ? workRefFromPage(url, await readTabHtml(tabId).catch(() => null)) : null);
  await setTrackedBadge(tabId, !!ref && !!(await db.works.get([ref.platform, ref.id])));
}

// Every open tab on a supported site; their URLs are visible thanks to the host permissions.
async function updateAllBadges() {
  for (const t of await browser.tabs.query({ url: SITE_PAGES })) {
    if (t.id !== undefined) await updateBadge(t.id, t.url);
  }
}

// A failed add shows "!" for a few seconds, then the tab's usual badge.
function flashError(tabId: number, url: string) {
  // Ignored when the tab is gone, as in setTrackedBadge.
  browser.action.setBadgeBackgroundColor({ tabId, color: '#b42318' }).catch(() => {});
  browser.action.setBadgeText({ tabId, text: '!' }).catch(() => {});
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

// Created only when missing: recreating it on every worker wake-up would restart its
// timer, so it might never fire.
async function ensureRefreshAlarm() {
  if (!(await browser.alarms.get(REFRESH_ALARM))) {
    await browser.alarms.create(REFRESH_ALARM, { delayInMinutes: 1, periodInMinutes: REFRESH_EVERY_MIN });
  }
}

// Platforms with a background refresh. Each is paused on its own while it's unresponsive.
const REFRESHED: Platform[] = PLATFORM_IDS;

// One request to the platform's home page: does it answer with its real site? Cookies
// are sent so a passed bot check (FanFiction.net's Cloudflare) counts.
async function healthCheck(platform: Platform): Promise<boolean> {
  try {
    const res = await fetch(PLATFORMS[platform].home, { credentials: 'include', signal: AbortSignal.timeout(20000) });
    return !isUnresponsiveStatus(res.status) && SITES[platform].looksLikeSite(await res.text());
  } catch {
    return false;
  }
}

// A few of the most overdue works per alarm; the offscreen document does the work. A
// platform that stops answering is left alone until a health check says it's back.
async function refreshInBackground() {
  const now = Date.now();
  const health = await loadHealth();
  for (const platform of REFRESHED) {
    const h = health[platform];
    if (isWaiting(h, now)) continue;
    if (h && !(await healthCheck(platform))) {
      health[platform] = recordFailure(h, 'Health check failed', now);
      continue;
    }
    try {
      await ensureOffscreen();
      const msg: RefreshDueMessage = { type: 'refresh-due', platform, count: REFRESH_BATCH };
      const res: RefreshDueResponse = await browser.runtime.sendMessage(msg);
      if (!('error' in res)) delete health[platform];
      else if (res.unresponsive) health[platform] = recordFailure(h, res.error, now);
      else console.warn(`Background refresh of ${platform} failed:`, res.error);
    } catch (e) {
      console.warn(`Background refresh of ${platform} failed:`, e);
    }
  }
  await saveHealth(health);
}

export default defineBackground(() => {
  // The toolbar icon opens the popup menu; the side panel opens from there. Set
  // explicitly because Chrome remembers the earlier "open side panel on click".
  browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });

  ensureRefreshAlarm();
  browser.alarms.onAlarm.addListener((alarm) => alarm.name === REFRESH_ALARM && refreshInBackground());

  // ✓ badge on tabs showing a tracked work. Chrome clears tab badges on navigation, so
  // each page load sets it again; library changes made elsewhere update all site tabs
  // (while this worker is awake; otherwise the next page load catches up).
  browser.tabs.onUpdated.addListener((tabId, change, tab) => {
    if (change.url || change.status === 'complete') updateBadge(tabId, tab.url);
  });
  liveQuery(() => db.works.toCollection().primaryKeys()).subscribe(() => updateAllBadges());

  // Right-click on a work page: "Add to library" › status.
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
