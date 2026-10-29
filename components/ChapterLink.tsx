import type { Work } from '@/utils/models';
import { PLATFORMS } from '@/utils/platforms';
import { SITES } from '@/utils/sites';

// Opens the work's current chapter (chapter 1 if none is set) on its site in a new tab.
export function ChapterLink(props: {
  work: Pick<Work, 'platform' | 'id' | 'title' | 'chapterIds' | 'furthestChapter'>;
  class?: string;
}) {
  const n = () => Math.max(1, props.work.furthestChapter?.num ?? 1);
  return (
    <a
      class={`font-semibold whitespace-nowrap no-underline hover:underline ${props.class ?? ''}`}
      href={SITES[props.work.platform].chapterUrl(props.work)}
      target="_blank"
      rel="noopener"
      aria-label={`Open chapter ${n()} of ${props.work.title} on ${PLATFORMS[props.work.platform].label} in a new tab`}
    >
      Ch. {n()} ↗
    </a>
  );
}
