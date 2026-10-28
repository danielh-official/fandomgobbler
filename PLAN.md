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
- **Tracked = has a status.** No custom categories for now; picking a status tracks a
  work, clearing it untracks.
- **Editions stay separate.** One library per platform (AO3, FF.net, ...). In Dexie that
  means one table per platform (e.g. `ao3Works`, `ffnetWorks`), not one table with a
  `platform` discriminator.
- **Package manager:** pnpm. Explicit imports (`imports: false` in `wxt.config.ts`), not
  WXT auto-imports.
- **No UI on AO3.** Nothing is injected into AO3 pages: no buttons, badges, sidebars,
  hiding or page theming. All UI lives in extension pages: the **side panel** (main
  surface, opened from the toolbar icon) and later a full-tab **dashboard**. There is no
  popup, because the toolbar click opens the side panel.
- **How the side panel reads a work.** For the active AO3 tab it reads the page HTML with
  `scripting.executeScript` (no extra AO3 request, sees what the user sees). For a pasted
  URL, or when the tab is on the adult-content warning, it fetches the work with
  `?view_adult=true`. Both paths feed the same parser (`utils/ao3.ts`).
- **No content scripts, no messaging layer.** Extension pages open Dexie directly. Dexie
  must never be opened from a content script (it would use the host site's IndexedDB).
- **Design tokens** (CSS custom properties) shared by side panel and dashboard. UI
  redesign is a secondary goal, folded into each milestone instead of a big-bang pass.

## Working loop

1. Claude implements one milestone.
2. Claude reports it done, with how to load/test it and what to look at.
3. The user tests the extension locally and replies with change requests or a go-ahead.
4. Only on go-ahead does Claude start the next milestone.

Never start the next milestone without the go-ahead. Mark status below as work moves.

## Milestones

Status: `todo` · `in progress` · `awaiting test` · `done` · `deferred`

| # | Milestone | Status |
|---|---|---|
| 0 | Branch `wxt-rewrite`, upstream moved to `.old/`, this plan | done |
| 1 | Scaffold | done |
| 2 | Data layer + side panel shell | done |
| 3 | AO3 work parser + side panel work view | done |
| 4 | Side panel library + notes, rating, chapter progress | done |
| 5 | Backup: export/import | deferred |
| 6 | Side panel on AO3 listing pages | todo |
| 7 | Dashboard: library | todo |
| 8 | Dashboard: stats/charts | todo |
| 9 | AO3 imports: bookmarks, Marked for Later | todo |
| 10 | Background checks: subscription refresh, author watch, availability | todo |
| 11 | Extension theme | todo |
| 12 | FF.net edition | todo |

### 1. Scaffold
- WXT + Solid + TypeScript project at the repo root; package manager decided here.
- Manifest from `wxt.config.ts`: name, version, icons (copied from `.old/icons`),
  minimal permissions (add more only when a milestone needs them).
- Stub popup, stub background, stub AO3 content script that proves injection.
- Vitest set up with one passing test.
- README: build + "load unpacked" steps.
- Test: `npm run build` (or equivalent), load `.output/chrome-mv3` unpacked, popup opens,
  AO3 page logs/shows the stub.

### 2. Data layer + side panel shell
- Dexie schema: `ao3Works` (per-platform tables added with each edition).
- Typed models for a tracked work (fields from `.old/docs/dev/storage-schema.md`
  and `.old/modules/tracked-works/core.js`).
- Schema versioning via Dexie `version()` upgrades.
- Unit tests with `fake-indexeddb`.
- Data API in `utils/library.ts` (`getAo3Work`, `saveAo3Work`, `removeAo3Work`).
- Side panel shell: follows the active tab, URL input, Track/Untrack, live library list.
  Parser reads title and author only.
- Change request: originally injected a pill on AO3 pages; replaced with the side panel.

### 3. AO3 work parser + side panel work view
- Full work parser (reference `.old/modules/ao3-page/core.js`): fandoms, relationship,
  summary, series, stats, dates, chapters. Tests on saved HTML fixtures.
- Work view in the side panel: status picker.
  Viewing a tracked work refreshes its stored metadata automatically.
- Fixtures in `utils/fixtures/` are hand-written from AO3 markup (AO3 was down when
  this was built). Replace or add real saved pages if the parser misreads something.

### 4. Side panel library + notes, rating, chapter progress
- Library list with status filter, search, sort.
- Notes and rating editing.
- Chapter progress, **manual only**: the user sets their current chapter in the work view
  (number input, bounded by chapters posted). Nothing is recorded from browsing. Shown in
  the work view and library list (e.g. "Ch. 4 / 12"), later the dashboard.
- Open a library work in the panel's work view.

### 5. Backup: export/import (deferred)
- Deferred by the user on 2026-10-28; not needed yet. Until it exists, the library lives
  only in this Chrome profile's IndexedDB: removing the extension deletes it.
- JSON export/import of the new format.
- Import of the **old extension's export file**. The new extension has a different
  extension ID and can't read the old one's `chrome.storage`, so this is the migration
  path for existing data.

### 6. Side panel on AO3 listing pages
- Replaces the old listing badges. When the active tab is an AO3 listing/search/bookmarks
  page, the panel lists the works on that page, marks which are tracked, and allows
  quick track. Nothing is changed on the AO3 page itself.

### 7. Dashboard: library
- Full-tab dashboard: browse, filter, sort, paginate, bulk actions, work detail,
  edition switcher.

### 8. Dashboard: stats/charts
- Visual stats (reference `.old/modules/dashboard/charts-controller.js`),
  relationship insights.

### 9. AO3 imports
- Bookmark import and Marked for Later import, fetched from AO3 with rate limiting.

### 10. Background checks
- Subscription refresh, author watch, deleted-work availability checker.
- `alarms` + `notifications` permissions added here. Fetching runs in the background
  worker.

### 11. Extension theme
- Light/dark theme for side panel and dashboard via tokens.

### 12. FF.net edition
- FF.net parser and work view in the side panel, `ffnetWorks` table, dashboard edition
  switcher; capability flags hide AO3-only features.

## Later (not scheduled)
- Sync solution (replacement for Google Sheets sync). Will need infrastructure.
- Wattpad / Tumblr editions.
- Firefox build (`wxt build -b firefox`).
- Keyboard shortcut, context-menu "Track this work".
- Custom categories. Built in M3, removed in M4 at the user's request. Dexie v2 dropped
  the `ao3Categories` table and `customCats`; bringing them back means a v3 upgrade with
  per-edition tables (`ao3Categories`), not one table shared across editions.
- "Set to this chapter" button in the work view when the active tab is on a chapter page
  (still a manual click, never automatic).
- Dropped by the no-UI-on-AO3 rule, listed so they aren't forgotten: hidden rules (hiding
  works on listing pages), AO3 page theme toggle, floating sidebar.

## Log
- 2026-10-28: Plan created. Upstream v3.17.52 moved to `.old/` on branch `wxt-rewrite`.
- 2026-10-28: M0 approved. M1 scaffold built: WXT 0.21.5, Solid 1.9, TS 7, Vitest 5.
- 2026-10-28: M1 approved (display name "FandomGobbler (Fork)"). M2 started.
- 2026-10-28: M2 built: Dexie 4 db (`ao3Works`, `ao3Categories`), `saveAo3Work` rules ported, typed messaging. `unlimitedStorage` permission added.
- 2026-10-28: M2 change request: no UI on AO3. Content script and messaging removed;
  side panel replaces popup and in-page UI. Milestones renumbered (now 13).
- 2026-10-28: M2 approved.
- 2026-10-28: M3 built: full AO3 parser with fixtures, work view (status chips, categories), design tokens in `assets/tokens.css`.
- 2026-10-28: Decision: chapter progress is set manually, never auto-tracked.
- 2026-10-28: M3 approved. Chapter progress moved into M4; milestones renumbered (now 12). One-click chapter shortcut backlogged. M4 started.
- 2026-10-28: M4 built: Work/Library tabs, filter/search/sort (`utils/library-view.ts`, old sorts minus Random), notes/rating/manual chapter, category rename/recolour/delete.
- 2026-10-28: M4 change requests: select caret padding, status counts in the filter, categories removed (Dexie v2 migration).
- 2026-10-28: M4 change requests: "Most unread chapters" sort; library shows "Ch. cur / posted (ongoing) | n unread".
- 2026-10-28: M4 change request: exact + relative dates (`utils/time.ts`) in library ("Last updated") and work view.
- 2026-10-28: M4 approved.
- 2026-10-28: M5 (backup, old-file import) deferred.
