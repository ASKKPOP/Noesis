# Phase 5 — Deferred Items (out-of-scope discoveries during execution)

## Discovered in Plan 05-03 (Task 1 — brain schema + hashing)

### Pre-existing grid tsc errors (NOT caused by Plan 05-03)

**Verified:** `git stash && npx tsc --noEmit` before any Plan 05-03 edits reproduces the same errors.

```
src/db/connection.ts(40,40): error TS2769: No overload matches this call.
src/db/connection.ts(46,25): error TS2769: No overload matches this call.
src/main.ts(72,41): error TS2339: Property 'fromConfig' does not exist on type 'typeof DatabaseConnection'.
src/main.ts(74,26): error TS2554: Expected 0 arguments, but got 1.
src/main.ts(75,37): error TS2554: Expected 1 arguments, but got 2.
```

**Scope decision:** OUT OF SCOPE for Plan 05-03 — these are pre-existing mysql2 type-compat and
`DatabaseConnection` constructor drift unrelated to the reviewer integration. Plan 05-03's
acceptance is `tsc --noEmit` exits 0 for the files this plan touches; global `tsc --noEmit` may
stay red until whoever broke db/connection.ts fixes it.

**Impact on verification:** `cd grid && npx vitest run` still works (vitest uses its own
transformer, does not block on tsc). All Plan 05-03 integration tests run cleanly.

**Recommended follow-up:** separate hot-fix plan for db/connection.ts + main.ts db wiring —
not a Plan 05-03 problem.
