import { browser } from 'wxt/browser';

// A ✓ on the toolbar icon while a tab shows a work in the library (any of its pages:
// chapters, index, comments). Per tab, so other tabs are unaffected.
// The tab can be gone by the time this runs (closed, or a prerendered page that was never
// shown); then there's no badge to set, so that error is ignored.
export async function setTrackedBadge(tabId: number, tracked: boolean): Promise<void> {
  try {
    await browser.action.setBadgeBackgroundColor({ tabId, color: '#2f6f3e' });
    await browser.action.setBadgeText({ tabId, text: tracked ? '✓' : '' });
  } catch {
    // See above.
  }
}
