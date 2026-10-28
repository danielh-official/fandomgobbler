import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import solid from 'eslint-plugin-solid/configs/typescript';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['.old/', '.output/', '.wxt/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  { files: ['**/*.{ts,tsx}'], ...solid },
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Solid assigns `let el!: HTMLElement` through the JSX ref prop, which this rule can't see.
      'no-unassigned-vars': 'off',
    },
  },
);
