# FandomGobbler (personal fork)

This is a personal fork of FandomGobbler, rebuilt on WXT, SolidJS and IndexedDB for my
own use. It is not published on the Chrome Web Store or any other store.

To use it, build it locally and load it unpacked in Chrome with Developer Mode enabled:

1. Install [pnpm](https://pnpm.io), then run `pnpm install` and `pnpm build`.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and choose `.output/chrome-mv3`.

After pulling changes, run `pnpm build` again and click the reload icon on the
extension's card. `pnpm dev` starts a development browser with hot reload instead.

Before committing, run `pnpm check` (formatting, lint, typecheck and tests); CI runs the
same checks. `pnpm format` fixes formatting.

Licensed under the GNU General Public License v3.0, the same as the original. See
`LICENSE`.
