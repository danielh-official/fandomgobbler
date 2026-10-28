import { render } from 'solid-js/web';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { ao3WorkId } from '@/utils/ao3';

// ponytail: milestone 1 stub that proves Solid renders inside a shadow root on AO3.
export default defineContentScript({
  matches: ['https://archiveofourown.org/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    const workId = ao3WorkId(location.href);
    const ui = await createShadowRootUi(ctx, {
      name: 'fandomgobbler-stub',
      position: 'overlay',
      alignment: 'bottom-right',
      onMount(container) {
        return render(
          () => (
            <div
              style={{
                margin: '16px',
                padding: '6px 12px',
                'border-radius': '999px',
                background: '#2f6f3e',
                color: 'white',
                font: '13px system-ui, sans-serif',
              }}
            >
              FandomGobbler (Fork) · {workId ? `work ${workId}` : 'not a work page'}
            </div>
          ),
          container,
        );
      },
      onRemove(dispose) {
        dispose?.();
      },
    });
    ui.mount();
  },
});
