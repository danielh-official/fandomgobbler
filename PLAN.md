# Rewrite Plan: FandomGobbler on WXT + SolidJS

Living plan for the rewrite. Read this at the start of every session and update it
when a milestone changes state or a decision is made.

## Decisions

- **Personal fork.** Not published to the Chrome Web Store or any other store. Install
  is local only: build, then load unpacked with Developer Mode enabled.
- **License:** GPL-3.0 (inherited from upstream). `LICENSE` stays at the repo root.
- **No rebrand.** Keep the FandomGobbler name and icons, but display it as
  "FandomGobbler (Fork)" so it is distinguishable from the original when both are installed.
- **Stack:** WXT + SolidJS + TypeScript. Dexie (IndexedDB) for library data.
  `chrome.storage` only for small settings/UI state, if at all.
- **Fresh build.** The upstream code lives in `.old/` as **reference only**. Nothing in
  `.old/` is imported, built, or shipped. Port behaviour, not code.
- **No Google Sheets sync.** Dropped for now. Revisit a sync solution after the core
  milestones (see Later).
- **Editions stay separate.** One library per platform (AO3, FF.net, ...). In Dexie that
  means one table per platform (e.g. `ao3Works`, `ffnetWorks`), not one table with a
  `platform` discriminator.
- **Package manager:** pnpm. Explicit imports (`imports: false` in `wxt.config.ts`), not
  WXT auto-imports.
- **Dexie lives in the extension origin.** IndexedDB in a content script would belong to
  the host site (e.g. archiveofourown.org), so content scripts never open Dexie directly.
  They talk to the background worker through typed messages; popup and dashboard
  (extension pages) can use Dexie directly.
- **Injected UI uses shadow DOM** (WXT `createShadowRootUi`), so host-page CSS and
  extension CSS don't collide. AO3 page theming is the exception: it has to restyle the
  host page, so it is injected as real CSS.
- **Design tokens** (CSS custom properties) shared by popup, dashboard and injected UI.
  UI redesign is a secondary goal, folded into each milestone instead of a big-bang pass.

## Working loop

1. Claude implements one milestone.
2. Claude reports it done, with how to load/test it and what to look at.
3. The user tests the extension locally and replies with change requests or a go-ahead.
4. Only on go-ahead does Claude start the next milestone.

Never start the next milestone without the go-ahead. Mark status below as work moves.

## Milestones

Status: `todo` · `in progress` · `awaiting test` · `done`

| # | Milestone | Status |
|---|---|---|
| 0 | Branch `wxt-rewrite`, upstream moved to `.old/`, this plan | done |
| 1 | Scaffold | done |
| 2 | Data layer | in progress |
| 3 | AO3 work page: track controls | todo |
| 4 | Popup | todo |
| 5 | Backup: export/import | todo |
| 6 | AO3 listing badges + hidden rules | todo |
| 7 | AO3 floating sidebar | todo |
| 8 | Dashboard: library | todo |
| 9 | Dashboard: stats/charts | todo |
| 10 | Chapter progress | todo |
| 11 | AO3 imports: bookmarks, Marked for Later | todo |
| 12 | Background checks: subscription refresh, author watch, availability | todo |
| 13 | Themes: extension theme + AO3 page theme | todo |
| 14 | FF.net edition | todo |

### 1. Scaffold
- WXT + Solid + TypeScript project at the repo root; package manager decided here.
- Manifest from `wxt.config.ts`: name, version, icons (copied from `.old/icons`),
  minimal permissions (add more only when a milestone needs them).
- Stub popup, stub background, stub AO3 content script that proves injection.
- Vitest set up with one passing test.
- README: build + "load unpacked" steps.
- Test: `npm run build` (or equivalent), load `.output/chrome-mv3` unpacked, popup opens,
  AO3 page logs/shows the stub.

### 2. Data layer
- Dexie schema: per-platform works tables, custom categories, settings.
- Typed models for a tracked work (port fields from `.old/docs/dev/storage-schema.md`
  and `.old/modules/tracked-works/core.js`).
- Schema versioning via Dexie `version()` upgrades.
- Unit tests with `fake-indexeddb`.
- Test: dev-only debug view or console helpers to add/list/delete works.

### 3. AO3 work page: track controls
- AO3 work-page parser (reference `.old/modules/ao3-page/core.js`), with tests on saved
  HTML fixtures.
- Shadow-DOM track control on work pages: track/untrack, status, category.

### 4. Popup
- Detect the current tab's work; quick track/edit.
- Library list with status filter, search, sort.
- Notes and rating editing.

### 5. Backup: export/import
- JSON export/import of the new format.
- Import of the **old extension's export file**. The new extension has a different
  extension ID and can't read the old one's `chrome.storage`, so this is the migration
  path for existing data.

### 6. AO3 listing badges + hidden rules
- Badges on search/listing/bookmark pages for tracked works.
- Hide rules (reference `.old/modules/hidden-rules/core.js`).

### 7. AO3 floating sidebar
- Floating button + sidebar on AO3, shadow DOM, position remembered.

### 8. Dashboard: library
- Full-tab dashboard: browse, filter, sort, paginate, bulk actions, work detail,
  edition switcher.

### 9. Dashboard: stats/charts
- Visual stats (reference `.old/modules/dashboard/charts-controller.js`),
  relationship insights.

### 10. Chapter progress
- Track read chapter per work; show progress in sidebar/popup/dashboard.

### 11. AO3 imports
- Bookmark import and Marked for Later import, fetched from AO3 with rate limiting.

### 12. Background checks
- Subscription refresh, author watch, deleted-work availability checker.
- `alarms` + `notifications` permissions added here. Fetching runs in the background
  worker behind typed messages.

### 13. Themes
- Extension theme (light/dark) via tokens.
- AO3 page theme toggle (reference `.old/modules/theme-css/`, `.old/dark-early.js`),
  including no-flash early injection at `document_start`.

### 14. FF.net edition
- Parser, track controls, listing badges, sidebar on FF.net, reusing the shared
  components; capability flags gate AO3-only features.

## Later (not scheduled)
- Sync solution (replacement for Google Sheets sync). Will need infrastructure.
- Wattpad / Tumblr editions.
- Firefox build (`wxt build -b firefox`).
- Side panel, keyboard shortcut, context-menu "Track this work".

## Log
- 2026-10-28: Plan created. Upstream v3.17.52 moved to `.old/` on branch `wxt-rewrite`.
- 2026-10-28: M0 approved. M1 scaffold built: WXT 0.21.5, Solid 1.9, TS 7, Vitest 5.
- 2026-10-28: M1 approved (display name "FandomGobbler (Fork)"). M2 started.
