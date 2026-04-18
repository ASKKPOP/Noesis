# Phase 03 — Deferred Items

Out-of-scope issues discovered during execution that are NOT fixed because they
were not introduced by the current plan. Tracked here for future cleanup.

## Pre-existing grid/src/main.ts build errors

**Discovered during:** Plan 03-01 execution (final `npm run build` check)

**Errors:**

```
src/main.ts(72,41): error TS2339: Property 'fromConfig' does not exist on type 'typeof DatabaseConnection'.
src/main.ts(74,26): error TS2554: Expected 0 arguments, but got 1.
src/main.ts(75,37): error TS2554: Expected 1 arguments, but got 2.
```

**Verification pre-existed:** `git stash` + `npm run build` on HEAD (pre-plan)
still produces these errors → NOT caused by Plan 03-01 edits.

**Impact on Plan 03-01:** None. Tests (303/303) pass because Vitest compiles
individual source files via vite/esbuild and does not require the full `tsc`
project build. The affected file (`grid/src/main.ts`) is the runtime entry
point, not covered by any tests.

**Scope:** Appears to be a Phase 1/2 DatabaseConnection API mismatch left in
`main.ts` after a refactor. Fix belongs to a follow-up grid cleanup plan; the
dashboard work in this phase does not exercise `main.ts`.

**Also affects lint:** `npm run lint` fails with ESLint v9 migration errors —
pre-existing config incompatibility, not a code-quality regression.
