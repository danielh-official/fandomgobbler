import { createSignal, onCleanup, Show } from 'solid-js';
import { card } from '@/components/ui';
import {
  loadRefreshSettings,
  onRefreshSettingsChanged,
  REFRESH_BATCH,
  REFRESH_EVERY_MIN,
  saveRefreshSettings,
  type LastRefresh,
  type RefreshSettings,
} from '@/utils/refresh-settings';
import { relativeTime } from '@/utils/time';

const summary = (l: LastRefresh) =>
  l.error
    ? `failed: ${l.error}`
    : l.checked
      ? `${l.checked} refreshed${l.newChapters ? `, ${l.newChapters} with new chapters` : ''}${l.lost ? `, ${l.lost} deleted` : ''}`
      : 'nothing due';

// On/off switch for the background refresh, with what its last run did.
export function BackgroundRefresh(props: { class?: string }) {
  const [settings, setSettings] = createSignal<RefreshSettings | null>(null);
  loadRefreshSettings().then(setSettings);
  onCleanup(onRefreshSettingsChanged(setSettings));

  return (
    <Show when={settings()}>
      {(s) => (
        <section class={`${card} gap-1.5 text-sm ${props.class ?? ''}`}>
          <label class="flex items-center gap-2">
            <input
              type="checkbox"
              checked={s().enabled}
              onChange={(e) => saveRefreshSettings({ enabled: e.currentTarget.checked })}
            />
            Refresh from AO3 in the background
          </label>
          <p class="text-xs text-muted">
            {REFRESH_BATCH} works every {REFRESH_EVERY_MIN} minutes while Chrome is open, ongoing works first: new
            chapters, stats, deletions.
          </p>
          <Show when={s().last}>
            {(l) => (
              <p class="text-xs" classList={{ 'text-danger': !!l().error, 'text-muted': !l().error }}>
                Last run {relativeTime(l().at)}: {summary(l())}
              </p>
            )}
          </Show>
        </section>
      )}
    </Show>
  );
}
