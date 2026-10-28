# FandomGobbler (fork)

Rebuild of FandomGobbler as a WXT + SolidJS + TypeScript extension, with Dexie for storage.

- **Read `PLAN.md` first.** It holds the decisions, the milestone list and the working
  loop. Keep it updated when a milestone changes status or a decision is made.
- Work one milestone at a time. When it's done, stop and report so the user can test.
  Don't start the next milestone without an explicit go-ahead.
- Run `pnpm check` (format, lint, typecheck, tests) and `pnpm build` before reporting a
  milestone done. `pnpm format` fixes formatting.
- `.old/` is the upstream code, kept as reference only. Never import from it, build it,
  or edit it.
