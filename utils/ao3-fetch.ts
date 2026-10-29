import { ao3WorkUrl, parseAo3Work } from './ao3';
import { getWork, saveWork, type WorkInput } from './library';

// One request to AO3 for one work. AO3 rate-limits scraping, so only call this on an
// explicit user action (a pasted URL, the adult-content fallback), never in a loop.
export async function fetchAo3Work(id: string): Promise<WorkInput> {
  const res = await fetch(`${ao3WorkUrl(id)}?view_adult=true`, { credentials: 'include' });
  if (!res.ok) throw new Error(`AO3 returned ${res.status}`);
  const work = parseAo3Work(await res.text(), id);
  if (!work) throw new Error('Could not read this work from AO3.');
  return work;
}

// Freshly read metadata replaces what a tracked work has stored; status and personal
// fields are kept. Untracked works are left alone.
export async function refreshIfTracked(work: WorkInput): Promise<void> {
  if (await getWork(work)) await saveWork({ ...work, refreshedAt: Date.now() });
}

// A work from page HTML already in hand (an open tab); falls back to one fetch when the
// page has no work on it, e.g. AO3's adult-content warning.
export async function parseOrFetchAo3Work(html: unknown, id: string): Promise<WorkInput> {
  return (typeof html === 'string' && parseAo3Work(html, id)) || fetchAo3Work(id);
}
