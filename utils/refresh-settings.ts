import { browser } from 'wxt/browser';
import type { PlatformHealth } from './health';
import type { Platform } from './platforms';

// Background refresh pace: a small batch per alarm keeps platform load low (about 24 works
// an hour) and each run short enough for Chrome's background worker.
export const REFRESH_EVERY_MIN = 5;
export const REFRESH_BATCH = 2;

export type HealthByPlatform = Partial<Record<Platform, PlatformHealth>>;

// In extension storage rather than localStorage: the background worker has no localStorage.
// A platform that's absent is healthy.
const KEY = 'platformHealth';

export async function loadHealth(): Promise<HealthByPlatform> {
  return ((await browser.storage.local.get(KEY))[KEY] as HealthByPlatform | undefined) ?? {};
}

export async function saveHealth(health: HealthByPlatform): Promise<void> {
  await browser.storage.local.set({ [KEY]: health });
}
