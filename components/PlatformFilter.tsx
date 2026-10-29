import { For } from 'solid-js';
import type { LibraryFilters } from '@/utils/library-filters';
import { PLATFORM_IDS, PLATFORMS } from '@/utils/platforms';
import { card, sectionHeading } from './ui';

// One checkbox per platform, all ticked by default; unticking hides that platform's works.
export function PlatformFilter(props: { lib: LibraryFilters; class?: string }) {
  return (
    <section class={`${card} gap-1.5 ${props.class ?? ''}`} role="group" aria-labelledby="platforms-heading">
      <h2 id="platforms-heading" class={`${sectionHeading} mb-0`}>
        Platforms
      </h2>
      <For each={PLATFORM_IDS}>
        {(p) => (
          <label class="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={!props.lib.filters().hiddenPlatforms.includes(p)}
              onChange={(e) => props.lib.togglePlatform(p, e.currentTarget.checked)}
            />
            {PLATFORMS[p].label} ({props.lib.platformCounts()[p]})
          </label>
        )}
      </For>
    </section>
  );
}
