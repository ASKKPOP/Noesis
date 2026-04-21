# Deferred Items — Phase 7

Out-of-scope issues discovered during Plan 01 execution. NOT fixed — recorded for future phases.

## Pre-existing TypeScript errors (grid build)

Surfaced when running `cd grid && npm run build` during Plan 01 Task 1. Unrelated to dialogue work.

- `grid/src/db/connection.ts:46` — `mysql2.execute()` overload type mismatch; `ExecuteValues` type narrowing broken.
- `grid/src/main.ts:73,75,76` — `DatabaseConnection.fromConfig()` does not exist on class; constructor arity mismatch.

These do not affect test execution (`vitest run` uses isolated transform and does not require `tsc` to succeed). All 554 tests pass. Defer to a future maintenance plan.
