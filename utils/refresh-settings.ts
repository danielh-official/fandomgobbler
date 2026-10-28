import { browser } from 'wxt/browser';

// Background refresh pace: a small batch per alarm keeps AO3 load low (about 24 works an
// hour) and each run short enough for Chrome's background worker.
export const REFRESH_EVERY_MIN = 5;
export const REFRESH_BATCH = 2;

export interface LastRefresh {
  at: number;
  checked: number;
  newChapters: number;
  lost: number;
  error?: string;
}

export interface RefreshSettings {
  enabled: boolean;
  last?: LastRefresh;
}

// In extension storage rather than localStorage: the background worker has no localStorage.
const KEY = 'backgroundRefresh';
const withDefaults = (saved: Partial<RefreshSettings> | undefined): RefreshSettings => ({ enabled: true, ...saved });

export async function loadRefreshSettings(): Promise<RefreshSettings> {
  return withDefaults((await browser.storage.local.get(KEY))[KEY] as Partial<RefreshSettings> | undefined);
}

export async function saveRefreshSettings(patch: Partial<RefreshSettings>): Promise<void> {
  await browser.storage.local.set({ [KEY]: { ...(await loadRefreshSettings()), ...patch } });
}

// Calls back on every change from any extension page or the background. Returns an unsubscribe.
export function onRefreshSettingsChanged(fn: (s: RefreshSettings) => void): () => void {
  const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (area === 'local' && changes[KEY]) fn(withDefaults(changes[KEY].newValue as Partial<RefreshSettings>));
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
