import { browser } from 'wxt/browser';

// A ✓ on the toolbar icon while a tab shows a work in the library (any of its pages:
// chapters, index, comments). Per tab, so other tabs are unaffected.
export async function setTrackedBadge(tabId: number, tracked: boolean): Promise<void> {
  await browser.action.setBadgeBackgroundColor({ tabId, color: '#2f6f3e' });
  await browser.action.setBadgeText({ tabId, text: tracked ? '✓' : '' });
}
