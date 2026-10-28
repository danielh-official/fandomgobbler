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
- **Keep AO3 requests to a minimum.** AO3 rate-limits scraping. Prefer reading the tab
  the user already has open (no request) over fetching. Fetch only on an explicit user
  action (pasted URL, adult-content fallback), one page at a time. Anything that fetches
  many pages or runs on a schedule (M9, M10) must be rate-limited and confirmed with the
  user before it is built.
- **Tracked = has a status.** No custom categories for now; picking a status tracks a
  work, clearing it untracks.
- **Editions stay separate.** One library per platform (AO3, FF.net, ...). In Dexie that
  means one table per platform (e.g. `ao3Works`, `ffnetWorks`), not one table with a
  `platform` discriminator.
- **Styling:** Tailwind CSS v4. Theme colours and element defaults live in
  `assets/app.css`; reused class sets in `components/ui.ts`. No other stylesheets.
- **Code standards:** Prettier (+ Tailwind class sorting) and ESLint (typescript-eslint,
  eslint-plugin-solid). `pnpm check` runs format check, lint, typecheck and tests; GitHub
  Actions runs the same on every push and PR. Run it before reporting a milestone done.
- **TypeScript pinned to 6.0.** typescript-eslint doesn't support TypeScript 7 yet
  (needs <6.1). Revisit when it does.
- **UI state lives in localStorage**, not URL params: the last filters (shared by side
  panel and dashboard) and the dashboard's list/grid choice. Library data stays in Dexie.
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

Status: `todo` · `in progress` · `awaiting test` · `done` · `deferred` · `dropped`

| #   | Milestone                                                       | Status   |
| --- | --------------------------------------------------------------- | -------- |
| 0   | Branch `wxt-rewrite`, upstream moved to `.old/`, this plan      | done     |
| 1   | Scaffold                                                        | done     |
| 2   | Data layer + side panel shell                                   | done     |
| 3   | AO3 work parser + side panel work view                          | done     |
| 4   | Side panel library + notes, rating, chapter progress            | done     |
| 5   | Backup: export/import                                           | deferred |
| 6   | Side panel on AO3 listing pages                                 | dropped  |
| 7   | Dashboard: library                                              | done     |
| 7b  | Intermission: Tailwind, Prettier, ESLint, GitHub Actions CI     | done     |
| 7c  | Intermission: side panel layout, unread filter, default order   | done     |
| 8   | Dashboard: stats/charts                                         | deferred |
| 9   | AO3 imports: bookmarks, Marked for Later (manual, rate-limited) | done     |
| 10  | Background refresh from AO3 (interval, rate-limited)            | todo     |
| 11  | Extension theme: system, light, dark (done before M10)          | done     |
| 12  | FF.net edition                                                  | todo     |

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

### 6. Side panel on AO3 listing pages (dropped)

- Built, then dropped by the user on 2026-10-28: not needed, and a listing feature
  invites more AO3 scraping than is safe. The work is in git stash on `wxt-rewrite`
  ("!!GitHub_Desktop<wxt-rewrite>") if it's ever wanted.
- Replaces the old listing badges. When the active tab is an AO3 listing/search/bookmarks
  page, the panel lists the works on that page, marks which are tracked, and allows
  quick track. Nothing is changed on the AO3 page itself.

### 7. Dashboard: library

- Full-tab dashboard: browse, filter, sort, paginate, bulk actions, work detail.
- **Responsive** from phone width to wide desktop: filters move from a sidebar to the top,
  rows collapse to cards, work detail is a drawer on wide screens and full-width on narrow.
- Edition switcher waits for the FF.net edition (only AO3 exists).

### 7b. Intermission: tooling

- Tailwind CSS (v4, Vite plugin). Existing hand-written CSS converted to utilities; design
  tokens become the Tailwind theme.
- Prettier (with the Tailwind class-sorting plugin) and ESLint (typescript-eslint +
  eslint-plugin-solid). `.old/` excluded from both.
- GitHub Actions: format check, lint, typecheck, tests on push and PR.

### 7c. Intermission: side panel layout

- No tabs. The library is the main view (URL box, search, filters, list). Clicking a work
  opens a detail view with a "Library › Title" breadcrumb back; the list stays mounted so
  search and scroll survive.
- The active tab's work is pinned first in a highlighted "On this page" card, tracked or
  not, regardless of filters.
- "Unread chapters only" filter in side panel and dashboard.
- Filters (status, fandom, author, unread only) are one shared state for side panel and
  dashboard (`utils/library-filters.ts`): saved in localStorage and synced live between
  open pages via the `storage` event. Search text is per page and not saved. The
  dashboard's list/grid choice is saved too; no URL query params.
- Default order everywhere: last updated on AO3, newest first; undated works last.

### 8. Dashboard: stats/charts (deferred)

- Deferred by the user on 2026-10-28: not worth building yet. If revisited, the suggested
  set was status donut, added per month (last 12), top fandoms/authors (click sets the
  shared filter), ratings; skip pairing alias grouping.

- Visual stats (reference `.old/modules/dashboard/charts-controller.js`),
  relationship insights.

### 9. AO3 imports

- Bookmark import and Marked for Later import.
- **Manual only:** started by a button click, never scheduled. Pages fetched one at a
  time with a delay between requests, progress shown, cancellable.
- **Idempotent:** works already in the library are left completely untouched (status,
  chapter, flags, rating, notes, dates, metadata). Only new works are added, with the
  status chosen for the import. Test: running the same import twice changes nothing.
- No skip list for untracked works (an untracked work still in AO3 bookmarks comes back
  on the next import). Add one only if the user asks.

### 10. Refresh from AO3

- Refreshes tracked works' AO3 metadata (new chapters, stats) and marks deleted ones
  `lost` (keeping `lostFrom`). Renamed from "deleted-work checker" at the user's request.
- **Background trickle on an interval** (user's choice, replacing the manual button, which
  was built and then removed): an alarm refreshes a few of the least recently refreshed
  works per tick, ongoing first. Needs `alarms` + `offscreen` (DOMParser for the parsers),
  a `refreshedAt` field, and an on/off + interval setting. Only runs while Chrome is open.
- Already in place (uncommitted, tested): `runRefresh` in `utils/ao3-refresh.ts`
  (`REFRESH_DELAY_MS` 2s), `fetchAo3Paced` shared with imports, `markAo3WorkLost`.
- 404 = deleted. A page that loads refreshes the stored metadata (as viewing it would).
  Anything else (restricted while logged out, unrevealed) is counted as unchecked and left
  alone. Deleted works are not re-checked or restored automatically.
- Author watch: dropped by the user.
- Subscription refresh: undecided, not built unless the user asks.

### 11. Extension theme

- Follows the system theme by default; a "Theme" select (System theme / Light / Dark) in
  the dashboard and side panel headers pins it. Saved in localStorage (`fg-theme`) and
  synced live between pages; applied as `data-theme` on `<html>` before render.
- Every colour token is `light-dark(light, dark)` in `assets/app.css`, driven by
  `color-scheme`, so native controls (scrollbars, checkboxes) follow too.

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
- 2026-10-28: M6 dropped (not needed; AO3 rate-limit risk). Decision: keep AO3 requests minimal.
- 2026-10-28: M9/M10 made manual + rate-limited; author watch dropped; subscription refresh undecided. M7 started.
- 2026-10-28: M7 built: `dashboard.html` (status sidebar w/ counts, fandom filter, sort, search, 50/page, bulk status/remove, work drawer). Shared UI moved to `components/` + `assets/components.css`. Layout checked at 375/900/1440px.
- 2026-10-28: M7 change requests: dashboard sorts by clicking column headers (asc, desc, off) with a column-only sort select shown only in card mode; status/fandom/author selects; filters, sort and page in URL query params. Side panel library: "Filters" heading over a 2-column grid (status, fandom, author), separate "Sort" section.
- 2026-10-28: M7 change requests: sorting removed from dashboard and side panel (both list most recently added first; sort code deleted). Dashboard gets a List/Grid toggle (`view=grid` in the URL); rows are size containers so narrow rows and grid cards share one card layout.
- 2026-10-28: M7 change requests: works open in a native <dialog> modal (full-screen on phones) instead of a drawer; "+ Add work" in the dashboard fetches one pasted work URL (`utils/ao3-fetch.ts`, shared with the side panel).
- 2026-10-28: Fandom/author options (dashboard + side panel) limited to works in the selected status; an orphaned selection resets to all.
- 2026-10-28: "Ch. N ↗" link to the current chapter on AO3 (new tab): side panel library items bottom-right, dashboard "Read" column in list and bottom-right corner in grid. Parser stores `chapterIds` from the chapter dropdown; without them links fall back to the full-work page at `#chapter-N`.
- 2026-10-28: M7 approved. Intermission 7b (Tailwind, Prettier, ESLint, CI) started.
- 2026-10-28: 7b built: Tailwind v4 (all hand-written CSS converted), Prettier + ESLint, `pnpm check`, GitHub Actions CI. TypeScript pinned to 6.0 for typescript-eslint.
- 2026-10-28: 7b approved. Intermission 7c (side panel: library as main view, detail view with breadcrumb, current work pinned) started.
- 2026-10-28: 7c built: side panel library-first with detail + breadcrumb, pinned current work, unread-only filter, default order by last updated.
- 2026-10-28: 7c change request: filters shared between side panel and dashboard via localStorage (live sync), list/grid remembered, dashboard query params removed.
- 2026-10-28: Filter order: Unread chapters only, Status, divider, Fandom + Author. Fandom/author options narrowed by status and unread only (`firstTier`).
- 2026-10-28: Side panel filters in one column. 7c approved.
- 2026-10-28: Fandom + Author filters grouped in a padded card (replacing the divider) in side panel and dashboard.
- 2026-10-28: Side panel search moved below the filters.
- 2026-10-28: Side panel filters in a collapsible <details> (closed by default, open state in localStorage); collapsed title shows the active filters.
- 2026-10-28: "Not finished yet" checkbox on the last posted chapter (`lastChapterUnfinished`, cleared on chapter change); counts as 1 unread (shown and filtered) via `unreadChapters`.
- 2026-10-28: M8 (stats/charts) deferred.
- 2026-10-28: M9 decision: imports leave existing works untouched; no skip list for now.
- 2026-10-28: M9 built: dashboard "Import from AO3" (bookmarks or Marked for Later), username detected from AO3's header or typed (remembered), pages 3s apart with 15s/30s rate-limit backoff, saved page by page, cancellable; `addAo3WorksIfMissing` keeps existing works untouched. Pending after commit: detail view should show chapters like the cards ("Ch. 71 / 71 (ongoing)" style) instead of "71/?".
- 2026-10-28: M9 tested and done. Fixed "Illegal invocation" from calling native fetch as a method of the options object.
- 2026-10-28: M10 built: dashboard "Check for deleted" (selection or filtered works), paced via the shared `fetchAo3Paced`; 404 marks `lost` with `lostFrom`/`lostAt`, loaded pages refresh metadata.
- 2026-10-28: M10 renamed to "Refresh from AO3"; progress counts works with new chapters. Sped up: "Only ongoing works" checkbox (on by default) and 2s between works (`REFRESH_DELAY_MS`; imports stay at 3s). Next after commit: intermission for system theme compliance with a light/dark override.
- 2026-10-28: Manual refresh button removed at the user's request; M10 becomes a background refresh on an interval, after the theme. M11 (theme) built: system default, light/dark override.
- 2026-10-28: M11 tested and committed. "Unread chapters only" inverted to a "Show read" checkbox, off by default, so the library lists works with unread chapters unless asked (saved as `showRead`; an old saved `unreadOnly` is ignored).
- 2026-10-28: Intermission: toolbar icon opens a popup menu (add the tab's work with a status, open side panel, open dashboard); right-click "Add to library › status" on AO3 work pages via the background + an offscreen document (`DOM_PARSER`), with a ✓/! badge. Fixed saved fandom/author selects showing "All" after reload.
- 2026-10-28: Settings page removed at the user's request; the theme stays in the page headers.
- 2026-10-28: Toolbar ✓ badge on any page of a tracked work (chapters, index, ...), set on page load and on library changes (`utils/badge.ts`). Toolbar menu shows "Open in dashboard ↗" for tracked works, via `dashboard.html#work=<id>` (hash dropped after opening).
