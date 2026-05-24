---
phase: 31-audit-pipeline-persistence
plan: "04"
subsystem: grid/db,grid/genesis
tags: [audit-reconcile, tick-cadence, replay-batch-cap, pino-logging, OBS-02, R-31-02]
dependency_graph:
  requires: [31-01, 31-03]
  provides: [grid/src/db/audit-reconcile.ts, grid/src/genesis/launcher.ts (auditReconcile field), grid/src/main.ts (AuditReconcile construction), grid/test/audit-reconcile.test.ts]
  affects: [31-05, 31-06, 32-*]
tech_stack:
  added: []
  patterns: [tick-driven-cadence, fire-and-forget, defense-in-depth-try-catch, last-error-semantics, INSERT-IGNORE-idempotency]
key_files:
  created:
    - grid/src/db/audit-reconcile.ts
    - grid/test/audit-reconcile.test.ts
  modified:
    - grid/src/genesis/launcher.ts
    - grid/src/main.ts
decisions:
  - "db.query<T>() used for SELECT COALESCE(MAX(id)) — plan skeleton used execute<T>() which returns void not T[], Rule 1 auto-fix applied"
  - "FakeDb.query<T>() wired in tests (not execute) to match real DatabaseConnection API"
  - "9 vitest cases (1 constants + 8 behavioral) — plan specified 8 but constants check warranted its own it()"
metrics:
  duration: "267s (~4m)"
  completed: "2026-05-23"
  tasks_completed: 4
  files_modified: 2
  files_created: 2
  lines_written: 437
---

# Phase 31 Plan 04: AuditReconcile Tick-Driven Loop Summary

Tick-cadenced AuditReconcile class wired into the single launcher onTick block; replays missing audit_trail entries via INSERT IGNORE at every 60 ticks, capped at 500 per cycle (R-31-02); structured Pino heartbeat emitted every cycle — silence is the alarm signal.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 4.1 | Create AuditReconcile class with run(), getters, REPLAY_BATCH_CAP=500 | 8892195 | grid/src/db/audit-reconcile.ts |
| 4.2 | Extend GenesisLauncherDeps + launcher field + onTick wire | 1a1b3e3 | grid/src/genesis/launcher.ts |
| 4.3 | Construct AuditReconcile in main.ts and inject via deps | 49d2190 | grid/src/main.ts |
| 4.4 | Write audit-reconcile.test.ts (9 vitest cases) | 0f465a4 | grid/test/audit-reconcile.test.ts |

## What Was Built

**Task 4.1 — AuditReconcile class (159 lines):**
- `export const REPLAY_BATCH_CAP = 500` — batch cap for R-31-02 mitigation
- `export const DIVERGENCE_WARN_THRESHOLD = 10` — log level switch threshold
- Three getters: `lastReconcileAt: number` (0 until first run), `persistedMaxId: number | null` (null until first run), `lastPersistError: { code, at } | null`
- `run()` algorithm: SELECT COALESCE(MAX(id), 0) via `db.query<T>()` (not `execute<T>()` which returns void), compute divergence, replay missing tail entries capped at 500, structured Pino heartbeat every cycle
- Outer try/catch wraps entire body (mirrors firehose-hub.ts defense-in-depth); inner per-entry try/catch so one failure does not abort the batch
- Heartbeat log: `{ event: 'audit_reconcile_ok' | 'audit_reconcile_replay', divergence, replayed, remaining }` at info level; escalates to warn when divergence > 10

**Task 4.2 — GenesisLauncher extended (25 lines added):**
- `import type { AuditReconcile }` added (type-only — launcher never instantiates)
- `GenesisLauncherDeps.auditReconcile?: AuditReconcile` added to interface
- `readonly auditReconcile: AuditReconcile | undefined` field added to class
- `this.auditReconcile = deps?.auditReconcile` added in constructor
- Reconcile cadence added INSIDE the existing single `clock.onTick` block: `if (this.auditReconcile && event.tick > 0 && event.tick % 60 === 0) { void this.auditReconcile.run(); }`
- `grep -c 'this\.clock\.onTick' src/genesis/launcher.ts` returns 1 (single subscription invariant preserved)

**Task 4.3 — main.ts extended (12 lines changed):**
- `import { AuditReconcile } from './db/audit-reconcile.js'`
- `let auditReconcile: AuditReconcile | undefined` declared in outer scope
- Constructed inside `if (config.db)` block after `PersistentAuditChain`: `new AuditReconcile(chain, auditStore, dbConn, gridName)`
- Launcher receives `{ audit: chain, auditReconcile }` when chain is present; no-DB path unchanged

**Task 4.4 — audit-reconcile.test.ts (278 lines, 9 tests):**
- `FakeDb` class with `query<T>()` returning pre-programmed `max_id` rows (matches real `DatabaseConnection.query()` API)
- `CapturingStore` with `failIds: Set<number>` for per-entry failure injection
- `fillChain(N)` using real `AuditChain.append()` so ids are 1..N and hashes are genuine

Test coverage:
1. **constants** — REPLAY_BATCH_CAP=500, DIVERGENCE_WARN_THRESHOLD=10 pinned
2. **getters initial state** — zero/null before first run
3. **happy path no divergence** — info heartbeat, zero appends
4. **replay batch cap** — 1000 divergence → exactly 500 appends, warn logged (R-31-02 pin)
5. **divergence threshold log level (low)** — divergence 7 → info, no warn for heartbeat
6. **divergence threshold log level (high)** — divergence 15 → warn (D-31-C1 pin)
7. **per-entry failure recovery** — entry 2 fails, entries 1+3 still persisted
8. **outer catch defense-in-depth** — db.query() throws → resolves.toBeUndefined(), log.error
9. **idempotency** — second run after DB catches up → zero new appends

## Vitest Run Output

```
 ✓ test/audit-reconcile.test.ts > AuditReconcile constants (D-31-C1/C2) > REPLAY_BATCH_CAP is 500 and DIVERGENCE_WARN_THRESHOLD is 10
 ✓ test/audit-reconcile.test.ts > AuditReconcile getters — initial state > reports zero/null before first run
 ✓ test/audit-reconcile.test.ts > AuditReconcile.run() — happy path no divergence > emits info heartbeat with divergence 0 and no store.append calls
 ✓ test/audit-reconcile.test.ts > AuditReconcile.run() — replay batch cap (R-31-02 / D-31-C2) > replays exactly 500 entries when divergence is 1000
 ✓ test/audit-reconcile.test.ts > AuditReconcile.run() — divergence threshold log level (D-31-C1) > logs at info when divergence <= DIVERGENCE_WARN_THRESHOLD (10)
 ✓ test/audit-reconcile.test.ts > AuditReconcile.run() — divergence threshold log level (D-31-C1) > logs at warn when divergence > DIVERGENCE_WARN_THRESHOLD (10)
 ✓ test/audit-reconcile.test.ts > AuditReconcile.run() — per-entry failure recovery > continues replay after one entry fails and records lastPersistError
 ✓ test/audit-reconcile.test.ts > AuditReconcile.run() — outer catch (defense-in-depth) > does not throw when db.query() rejects; logs error and updates lastReconcileAt
 ✓ test/audit-reconcile.test.ts > AuditReconcile.run() — idempotency across cycles (INSERT IGNORE) > second run is a no-op after first run catches up

 Test Files  1 passed (1)
      Tests  9 passed (9)
   Duration  205ms
```

Combined run with audit-persistence-wiring.test.ts: **13 passed / 0 failed** (281ms).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan skeleton used `execute<T>()` for SELECT query — must use `query<T>()`**
- **Found during:** Task 4.1 code review of `DatabaseConnection` API
- **Issue:** Plan's provided code skeleton called `this.db.execute<T>(...)` for the `SELECT COALESCE(MAX(id), 0)` query. The real `DatabaseConnection.execute()` returns `Promise<void>` (it is for DML/DDL: INSERT, UPDATE, DELETE, CREATE). `DatabaseConnection.query<T>()` is the SELECT method returning `Promise<T[]>`.
- **Fix:** Changed to `this.db.query<T>(...)` in `audit-reconcile.ts`. Also updated `FakeDb.query<T>()` in the test file to match.
- **Files modified:** `grid/src/db/audit-reconcile.ts` (line 78), `grid/test/audit-reconcile.test.ts` (FakeDb class)
- **Commit:** 8892195, 0f465a4

**2. [Rule 2 - Enhancement] 9 test cases instead of 8**
- **Found during:** Task 4.4 implementation
- **Issue:** Plan specified 7 behavioral `it()` blocks plus a constants check grouped as one block = 8 total. A separate constants `it()` within its own `describe()` is cleaner and more explicit for pinning D-31-C1/C2.
- **Fix:** Added the constants check as its own `it()` → 9 total (constants + 8 behavioral). All pass.
- **Files modified:** `grid/test/audit-reconcile.test.ts`
- **Commit:** 0f465a4

## Threat Surface Scan

No new trust boundaries introduced. All changes are:
- Internal class (`AuditReconcile`) — reads from MySQL via parameterized query (`gridName` param), writes via `store.append` (INSERT IGNORE already trusted)
- Launcher field addition — readonly, no new HTTP exposure
- main.ts construction — inside existing `if (config.db)` guard

T-31-14 (DOS replay burst) mitigated by REPLAY_BATCH_CAP=500, pinned in test.
T-31-15 (tick listener throw) mitigated by outer try/catch, pinned in test.
T-31-16 (wrong grid read) mitigated by parameterized query.
T-31-17 (error code in logs) accepted — mysql2 codes contain no PII.

## Known Stubs

None. All wiring is complete and exercised by tests.

## Self-Check

### Created files exist:
- `grid/src/db/audit-reconcile.ts` — FOUND (159 lines)
- `grid/test/audit-reconcile.test.ts` — FOUND (278 lines)

### Modified files exist:
- `grid/src/genesis/launcher.ts` — FOUND (modified)
- `grid/src/main.ts` — FOUND (modified)

### Commits exist:
- `8892195` — feat(31-04): create AuditReconcile class — FOUND
- `1a1b3e3` — feat(31-04): extend GenesisLauncherDeps + add auditReconcile field + onTick wire — FOUND
- `49d2190` — feat(31-04): construct AuditReconcile in main.ts and inject via deps — FOUND
- `0f465a4` — test(31-04): add audit-reconcile.test.ts — 9 vitest cases — FOUND

### Single onTick subscription invariant:
- `grep -c 'this\.clock\.onTick' grid/src/genesis/launcher.ts` returns `1` — CONFIRMED

### TypeScript compile:
- `cd grid && npx tsc --noEmit` — exits 0, zero errors — CONFIRMED

## Self-Check: PASSED
