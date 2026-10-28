import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-solid'],
  imports: false,
  manifest: {
    name: 'FandomGobbler (Fork)',
    description: 'Local-first fanfiction library tracker (personal fork).',
  },
});
