---
phase: 09
plan: 07
subsystem: relationships
tags:
  - phase-09
  - relationships
  - launcher
  - gap-closure
  - wave-1
  - HI-01
  - ME-01
gap_closure: true
closes_gaps:
  - "REL-02 — Relationship edges stored in derived MySQL table (HI-01)"
  - "ME-01 — scheduleSnapshot iterator-consistency hazard"
requires:
  - Phase 9 plans 01-06 shipped (RelationshipListener + RelationshipStorage + schema migrations in place)
provides:
  - "GenesisLauncher.attachRelationshipStorage(pool) setter — makes MySQL snapshot path reachable in production"
  - "DatabaseConnection.getPool() — single-pool sharing between GridStore and RelationshipStorage"
  - "ME-01 fix: synchronous iterator materialization in scheduleSnapshot"
  - "End-to-end regression gate at the launcher level (launcher-snapshot.test.ts)"
affects:
  - grid/src/genesis/launcher.ts
  - grid/src/relationships/storage.ts
  - grid/src/db/connection.ts
  - grid/src/main.ts
tech-stack:
  added: []
  patterns:
    - "Setter-based optional subsystem injection (attachRelationshipStorage) for post-bootstrap DB wiring"
    - "Synchronous iterator materialization (Array.from) before setImmediate — prevents Map-mutation leakage"
key-files:
  created:
    - grid/test/relationships/launcher-snapshot.test.ts
  modified:
    - grid/src/genesis/launcher.ts
    - grid/src/relationships/storage.ts
    - grid/src/db/connection.ts
    - grid/src/main.ts
    - grid/src/audit/state-hash.ts
    - grid/test/relationships/storage.test.ts
decisions:
  - "attachRelationshipStorage is idempotent-by-reference — same pool no-ops, different pool throws (prevents accidental pool-switch mid-run)"
  - "RelationshipStorage.pool exposed as public readonly so the launcher can compare pool refs for idempotency without leaking write access"
  - "ME-01 fix materializes the iterator synchronously on the tick thread (Array.from) before setImmediate; snapshot captures tick-fire-time state, not post-mutation state"
  - "Rule 3 blocker fixes applied in-scope: main.ts (DatabaseConnection.fromConfig → new DatabaseConnection, runner.run(MIGRATIONS) → run(), GridStore 2-arg → 1-arg); connection.ts (as-never cast for mysql2 overload); state-hash.ts (unknown-cast bridge)"
metrics:
  tasks_completed: 3
  tests_added: 4   # 3 launcher-snapshot + 1 storage ME-01 case
  total_tests_in_phase: 744  # full grid suite (unchanged passing count, +4 new)
  files_created: 1
  files_modified: 6
completed: 2026-04-21
---

# Phase 09 Plan 07: REL-02 Launcher Storage Injection + ME-01 Iterator Race Summary

Closes HI-01 (RelationshipStorage instantiated but unreachable in production) by adding a post-construction `attachRelationshipStorage(pool)` setter on `GenesisLauncher`, a `DatabaseConnection.getPool()` accessor, and production wiring in `main.ts`. Fixes ME-01 (iterator race in `scheduleSnapshot`) in the same plan so the newly-reachable snapshot path is correct. End-to-end regression locked by a new launcher-level test.

## What Shipped

### Task 1 — Launcher setter (commit `0390215`)

- `grid/src/genesis/launcher.ts`
  - Added `import type { Pool } from 'mysql2/promise'`
  - Changed `private readonly relationshipStorage` → `private relationshipStorage` (mutable)
  - New method `attachRelationshipStorage(pool: Pool): void` — idempotent-by-reference; throws on pool-switch
- `grid/src/db/connection.ts`
  - New method `getPool(): mysql.Pool`
- `grid/src/relationships/storage.ts`
  - `constructor(private readonly pool: Pool)` → `constructor(public readonly pool: Pool)` for ref-equality checks

### Task 2 — ME-01 fix (commit `44a68a0`)

- `grid/src/relationships/storage.ts`
  - `scheduleSnapshot` now calls `Array.from(edges)` synchronously on the tick thread before `setImmediate`. The deferred `snapshot()` call consumes the materialized array, not the live Map iterator. Post-schedule Map mutations provably cannot leak into the snapshot.
- `grid/test/relationships/storage.test.ts`
  - New regression test: “scheduleSnapshot materializes the iterator synchronously — Map mutations after scheduleSnapshot do not leak into the snapshot (ME-01)”. Asserts captured `pool.query` params reflect pre-mutation valence (0.1), weight (0.2), recency_tick (5) — NOT the post-mutation canary values (0.999).

### Task 3 — Production wiring + E2E gate (commit `8d8aa78`)

- `grid/src/main.ts`
  - Hoisted `dbConn` out of the migrations `if`-block
  - `launcher.attachRelationshipStorage(dbConn.getPool())` called AFTER `launcher.bootstrap()` AND AFTER migrations (at `main.ts:90`)
  - `buildServer` gets `relationships: launcher.relationships` + `config: { relationship: config.genesisConfig.relationship }` so Phase 9 REL-04 endpoints see the listener
- `grid/test/relationships/launcher-snapshot.test.ts` (NEW, 3 cases)
  1. Tick listener skips snapshot when no pool is attached (no-op, no throw)
  2. Tick listener fires `scheduleSnapshot` on cadence boundary when pool is attached — asserts `pool.query('REPLACE INTO relationships …')` is called after `clock.advance(10)` + two `setImmediate` ticks
  3. `attachRelationshipStorage` is idempotent for same pool, throws on pool-switch

### Rule 3 blocker fixes (in-scope — files already modified by Tasks 1/3)

- `grid/src/main.ts`: `DatabaseConnection.fromConfig(config.db)` (non-existent method) → `new DatabaseConnection(config.db)`; `runner.run(MIGRATIONS)` → `runner.run()`; `new GridStore(conn, gridName)` → `new GridStore(conn)`
- `grid/src/db/connection.ts`: cast `values as never` on `pool.execute` to resolve mysql2 `ExecuteValues` overload mismatch
- `grid/src/audit/state-hash.ts`: `(components as Record<string, unknown>)[key]` → `(components as unknown as Record<string, unknown>)[key]` per compiler suggestion (safe widening)

All three were pre-existing tsc errors logged at `.planning/phases/archived/v2.1/07-peer-dialogue-telos-refinement/deferred-items.md`; they became in-scope the moment Plan 09-07 modified the same files, and the plan's verification requires `tsc --noEmit` exits 0.

## Verification

### Invariant gates (all green)

| Gate | File | Result |
| ---- | ---- | ------ |
| D-9-04 construction order | `test/relationships/listener-launcher-order.test.ts` | 5/5 pass |
| D-9-05 sole producer | `test/relationships/producer-boundary.test.ts` | 4/4 pass |
| No audit emit | `test/relationships/no-audit-emit.test.ts` | 2/2 pass |
| Allowlist frozen at 18 | `test/relationships/allowlist-frozen.test.ts` | 4/4 pass |
| Wall-clock ban (D-9-12) | `test/relationships/determinism-source.test.ts` | 1/1 pass |
| Zero-diff chain | `test/relationships/zero-diff.test.ts` | 2/2 pass |

### Acceptance criteria (all satisfied)

- `grep -n "private readonly relationshipStorage" grid/src/genesis/launcher.ts` → 0 matches ✓
- `grep -n "private relationshipStorage" grid/src/genesis/launcher.ts` → 1 match ✓
- `grep -n "attachRelationshipStorage" grid/src/genesis/launcher.ts` → 3 matches (≥ 2 required) ✓
- `grep -n "getPool" grid/src/db/connection.ts` → 1 match ✓
- `grep -n "public readonly pool" grid/src/relationships/storage.ts` → 1 match ✓
- `grep -n "Array.from(edges)" grid/src/relationships/storage.ts` → 1 match ✓
- `grep -n "ME-01" grid/src/relationships/storage.ts` → 2 matches (≥ 1 required) ✓
- `grep -n "scheduleSnapshot materializes the iterator synchronously" grid/test/relationships/storage.test.ts` → 1 match ✓
- `grep -n "attachRelationshipStorage" grid/src/main.ts` → 1 match (line 90) ✓
- `grep -n "dbConn.getPool" grid/src/main.ts` → 1 match ✓
- `grep -n "relationships: launcher.relationships" grid/src/main.ts` → 1 match ✓
- `test -f grid/test/relationships/launcher-snapshot.test.ts` → exists ✓
- `grep -c "it(" grid/test/relationships/launcher-snapshot.test.ts` → 3 (≥ 3 required) ✓
- `grep -n "REPLACE INTO relationships" grid/test/relationships/launcher-snapshot.test.ts` → 1 match ✓
- `cd grid && npx tsc --noEmit` → exits 0 ✓
- `cd grid && npm test` → 744/744 (82 files) ✓

### Key trace

- `main.ts:90` — `launcher.attachRelationshipStorage(dbConn.getPool());` (the HI-01 unlock)

## Invariant Impact

- **Broadcast allowlist:** unchanged at 18 events
- **Zero-diff chain:** unbroken — no new audit events emitted by this plan
- **D-9-12 wall-clock ban:** setImmediate still permitted (already in baseline grep gate); `Array.from` does not introduce any forbidden calls
- **D-9-05 sole-producer boundary:** unchanged — only `RelationshipStorage.snapshot` writes SQL `relationships` table; this plan adds a reachability path to that boundary, not a second writer

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] Fixed pre-existing `DatabaseConnection.fromConfig` missing method + arity mismatches**
- Found during: Task 3 (touching `main.ts`)
- Issue: `main.ts` referenced `DatabaseConnection.fromConfig` (doesn't exist), `runner.run(MIGRATIONS)` (0-arg signature), `new GridStore(conn, name)` (1-arg signature). These pre-existing tsc errors are documented in `.planning/phases/archived/v2.1/07-peer-dialogue-telos-refinement/deferred-items.md` but became in-scope the moment this plan modified `main.ts` and the plan verification demands `tsc --noEmit` exits 0.
- Fix: substituted with the existing valid APIs (`new DatabaseConnection`, `runner.run()`, `new GridStore(conn)`).
- Files modified: `grid/src/main.ts`
- Commit: `8d8aa78`

**2. [Rule 3 - Blocker] Fixed pre-existing `connection.ts` mysql2 execute overload mismatch**
- Found during: Task 1 (touching `connection.ts` to add `getPool()`)
- Issue: `pool.execute(sql, values)` with `values: unknown[]` fails the stricter mysql2 `ExecuteValues` overload. Pre-existing on master; tsc was never green on master for this file.
- Fix: `values as never` cast on both `pool.execute` call sites.
- Files modified: `grid/src/db/connection.ts`
- Commit: `8d8aa78`

**3. [Rule 3 - Blocker] Fixed pre-existing `state-hash.ts` Record cast**
- Found during: Final tsc verification
- Issue: `(components as Record<string, unknown>)[key]` — compiler rejects direct cast because `StateHashComponents` lacks index signature. Pre-existing; tsc emitted the suggestion inline.
- Fix: `(components as unknown as Record<string, unknown>)[key]` (safe widening via `unknown` bridge).
- Files modified: `grid/src/audit/state-hash.ts`
- Commit: `8d8aa78`
- Note: touched purely to satisfy the plan's tsc=0 verification requirement — not strictly part of Plan 09-07's gap scope.

### Plan adaptation: `launcher.clock.advance(N)` is single-tick, not N-tick

The plan prompt anticipated this — WorldClock.advance() only advances one tick. The launcher-snapshot test adds a local `advanceN(launcher, n)` helper that calls `launcher.clock.advance()` in a plain `for` loop. No wall-clock introduced (no `Date.now`/`setTimeout` in the test path).

## Known Stubs

None — this plan removes a stub (the dormant `null` `relationshipStorage` field that made the tick-driven snapshot branch dead code).

## Re-verification note

REL-02 should flip from **PARTIAL** to **ACHIEVED** on the next `/gsd-verify-phase` run because:
- HI-01 reachability gap is closed (setter + production wiring at `main.ts:90`)
- ME-01 iterator race is closed (synchronous materialization)
- End-to-end regression gate is in place (`launcher-snapshot.test.ts`) — prevents silent re-regression to the dormant-null state

## Commits

| Hash | Message |
| ---- | ------- |
| `0390215` | feat(09-07): add attachRelationshipStorage + getPool accessor |
| `44a68a0` | fix(09-07): materialize edge iterator synchronously in scheduleSnapshot (ME-01) |
| `8d8aa78` | feat(09-07): wire launcher.attachRelationshipStorage in main.ts + E2E launcher-snapshot gate |

## Self-Check: PASSED

- [x] `grid/src/genesis/launcher.ts` mutable field + `attachRelationshipStorage` — FOUND
- [x] `grid/src/db/connection.ts` `getPool()` — FOUND
- [x] `grid/src/relationships/storage.ts` `Array.from(edges)` (ME-01 fix) — FOUND
- [x] `grid/src/main.ts` `launcher.attachRelationshipStorage(dbConn.getPool())` — FOUND at line 90
- [x] `grid/test/relationships/launcher-snapshot.test.ts` — FOUND (3 it() cases)
- [x] commit `0390215` — FOUND
- [x] commit `44a68a0` — FOUND
- [x] commit `8d8aa78` — FOUND
- [x] `npm test` — 744/744 pass
- [x] invariant gates green (6 files, 13 tests)
