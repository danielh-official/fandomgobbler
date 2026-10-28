import { ao3ChapterUrl } from '@/utils/ao3';
import type { Ao3Work } from '@/utils/models';

// Opens the work's current chapter (chapter 1 if none is set) on AO3 in a new tab.
export function ChapterLink(props: { work: Ao3Work; class?: string }) {
  const n = () => Math.max(1, props.work.furthestChapter?.num ?? 1);
  return (
    <a
      class={`font-semibold whitespace-nowrap no-underline hover:underline ${props.class ?? ''}`}
      href={ao3ChapterUrl(props.work)}
      target="_blank"
      rel="noopener"
      aria-label={`Open chapter ${n()} of ${props.work.title} on AO3 in a new tab`}
    >
      Ch. {n()} ↗
    </a>
  );
}
