import { browser } from 'wxt/browser';
import { getWork, saveWork, type WorkInput } from './library';
import type { WorkRef } from './models';
import { PLATFORM_NAMES, PLATFORMS } from './platforms';
import { SITES, workRefFromUrlOrLookup } from './sites';

// One request for one work. Sites rate-limit scraping, so only call this on an explicit
// user action (a pasted URL, AO3's adult-content fallback), never in a loop.
export async function fetchWork(ref: WorkRef): Promise<WorkInput> {
  const site = SITES[ref.platform];
  const label = PLATFORMS[ref.platform].label;
  const res = await fetch(site.fetchUrl(ref.id), { credentials: 'include' }).catch(async () => {
    // No response at all: usually Chrome blocking a site the extension has no access to.
    const allowed = await browser.permissions.contains({ origins: site.sitePages }).catch(() => true);
    throw new Error(
      allowed
        ? `Couldn’t reach ${label}. Check your connection, or open the work in a tab and add it from there.`
        : `The extension has no access to ${label}. Allow it in chrome://extensions → FandomGobbler (Fork) → Details → Site access, then try again.`,
    );
  });
  const html = await res.text();
  // FanFiction.net's Cloudflare check lands here unless the browser passed it recently.
  if (!site.looksLikeSite(html)) {
    throw new Error(`${label} didn’t let the extension in. Open the work in a tab and add it from there.`);
  }
  if (site.isGone(res.status, html)) throw new Error(`${label} says this work doesn’t exist.`);
  if (!res.ok) throw new Error(`${label} returned ${res.status}.`);
  const work = site.parse(html, ref.id);
  if (!work) throw new Error(`Could not read this work from ${label}.`);
  return work;
}

// Freshly read metadata replaces what a tracked work has stored; status and personal
// fields are kept. Untracked works are left alone.
export async function refreshIfTracked(work: WorkInput): Promise<void> {
  if (await getWork(work)) await saveWork({ ...work, refreshedAt: Date.now() });
}

// A work from page HTML already in hand (an open tab); falls back to one fetch when the
// page has no work on it, e.g. AO3's adult-content warning.
export async function parseOrFetchWork(html: unknown, ref: WorkRef): Promise<WorkInput> {
  return (typeof html === 'string' && SITES[ref.platform].parse(html, ref.id)) || fetchWork(ref);
}

// The work at a URL the user pasted: one fetch, refreshing it if it's tracked.
export async function readWorkUrl(url: string): Promise<WorkInput> {
  const ref = await workRefFromUrlOrLookup(url);
  if (!ref) throw new Error(`That isn’t a work URL from ${PLATFORM_NAMES}.`);
  const work = await fetchWork(ref);
  await refreshIfTracked(work);
  return work;
}
