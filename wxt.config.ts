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
    // scripting + AO3 host access let the side panel read the open AO3 tab and fetch works.
    permissions: ['unlimitedStorage', 'scripting'],
    host_permissions: ['https://archiveofourown.org/*'],
    action: {},
  },
});
