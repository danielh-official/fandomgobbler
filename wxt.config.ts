import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-solid'],
  imports: false,
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'FandomGobbler (Fork)',
    description: 'Local-first fanfiction library tracker (personal fork).',
    // unlimitedStorage keeps the IndexedDB library from being evicted under storage pressure.
    // scripting + site access let the side panel read the open work's tab and fetch works.
    // contextMenus: right-click "Add to library" on work pages. offscreen: a hidden page that
    // parses work pages for the background script, which has no DOMParser.
    // alarms + storage: the background refresh schedule and its on/off setting.
    permissions: ['unlimitedStorage', 'scripting', 'contextMenus', 'offscreen', 'alarms', 'storage'],
    host_permissions: ['https://archiveofourown.org/*', 'https://www.fanfiction.net/*', 'https://www.wattpad.com/*'],
    action: {},
  },
});
