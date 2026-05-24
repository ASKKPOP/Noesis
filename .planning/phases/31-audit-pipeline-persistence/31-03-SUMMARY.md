---
phase: 31-audit-pipeline-persistence
plan: "03"
subsystem: grid/db,grid/genesis
tags: [persistent-audit-chain, pino-logging, constructor-injection, zero-diff, OBS-01, OBS-03]
dependency_graph:
  requires: [31-01]
  provides: [grid/src/db/persistent-chain.ts, grid/src/db/index.ts, grid/src/genesis/launcher.ts, grid/src/main.ts, grid/test/audit-persistence-wiring.test.ts]
  affects: [31-04, 32-*]
tech_stack:
  added: []
  patterns: [constructor-injection, fire-and-forget, pino-child-logger, last-error-semantics]
key_files:
  created: [grid/test/audit-persistence-wiring.test.ts]
  modified:
    - grid/src/db/persistent-chain.ts
    - grid/src/db/index.ts
    - grid/src/genesis/launcher.ts
    - grid/src/main.ts
decisions:
  - "Option A logger spy: vi.spyOn(logger, 'warn') intercepts child.warn because Pino child shares the prototype warn reference (child.warn === base.warn confirmed at runtime)"
  - "TEST_CONFIG over GENESIS_CONFIG in tests: simpler config (2 regions, no network deps) keeps test fast and isolated"
  - "Constructor injection (D-31-A1) over post-construction setter: listeners bind synchronously in constructor, setter would leave them attached to stale plain AuditChain"
  - "lastPersistError never resets to null: last-error-ever semantics — operators need to know 'did we EVER fail', not 'are we currently failing'"
metrics:
  duration: "261s (~4m)"
  completed: "2026-05-24"
  tasks_completed: 4
  files_modified: 4
  files_created: 1
  lines_written: 231
---

# Phase 31 Plan 03: PersistentAuditChain Wiring Summary

PersistentAuditChain wired into production boot path via constructor injection; structured Pino logging replaces console.warn; lastPersistError getter added; R-31-01 zero-diff regression test pinned.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 3.1 | Pino logger + lastPersistError getter on PersistentAuditChain | 5df468b | grid/src/db/persistent-chain.ts |
| 3.2 | Export AuditStore from grid/src/db/index.ts | 17210ba | grid/src/db/index.ts |
| 3.3 | GenesisLauncherDeps + main.ts wiring | ad25d6b | grid/src/genesis/launcher.ts, grid/src/main.ts |
| 3.4 | audit-persistence-wiring.test.ts (4 vitest cases) | 8b40fc5 | grid/test/audit-persistence-wiring.test.ts |

## What Was Built

**Task 3.1 — PersistentAuditChain updated (77 lines):**
- Imports `logger as baseLogger` from `../util/logger.js`; creates module-scoped `log = baseLogger.child({ module: 'persistent-chain' })` singleton
- Adds `private _lastPersistError: { code: string; at: number } | null = null` field
- Exposes `get lastPersistError()` getter — Phase 32's `/health/detailed` reads this
- Replaces `console.warn(...)` with structured `log.warn({ event: 'audit_persist_failed', entry_id, event_type, error_message, error_code }, 'failed to persist audit entry')`
- `error_code` defaults to `'UNKNOWN'` when `err.code` is absent
- `_lastPersistError` is SET on failure, NEVER reset on success (last-error-ever semantics)
- `super.append()` call position preserved FIRST (R-31-01 invariant honored)
- Zero `console.*` calls in code lines; one comment-line reference (the CI gate pattern doc) is expected

**Task 3.2 — grid/src/db/index.ts updated (9 lines):**
- Added `export { AuditStore } from './stores/audit-store.js';` at line 1
- All 14 previously-exported symbols preserved unchanged

**Task 3.3 — GenesisLauncher + main.ts updated:**
- `GenesisLauncherDeps` interface exported from `launcher.ts` with `audit?: AuditChain` field
- Constructor signature changed to `constructor(config: GenesisConfig, deps?: GenesisLauncherDeps)`
- Audit field: `this.audit = deps?.audit ?? new AuditChain();`
- All listener constructions (DialogueAggregator, RelationshipListener, NormDetector, GovernanceEngine) unchanged — they bind to `this.audit` which now points to the injected chain
- `main.ts` imports `AuditStore, PersistentAuditChain` from `./db/index.js`
- `createGridApp` restructured: DB block runs FIRST, constructs `AuditStore` + `PersistentAuditChain` inside `if (config.db)`, then `GenesisLauncher` is constructed with `chain ? { audit: chain } : undefined`
- No-DB path unchanged — existing 40+ unit tests call `new GenesisLauncher(config)` and receive plain `AuditChain` as before

**Task 3.4 — audit-persistence-wiring.test.ts (145 lines, 4 tests):**
- **OBS-01 backwards-compat**: `new GenesisLauncher(baseConfig)` → `launcher.audit instanceof AuditChain` is true; `instanceof PersistentAuditChain` is false
- **OBS-01 injection**: `new GenesisLauncher(baseConfig, { audit: chain })` → `launcher.audit === chain` (identity check)
- **R-31-01 zero-diff**: 10 identical events appended to plain and persistent chains under `vi.useFakeTimers()` → `plain.head === persistent.head` (byte-identical)
- **OBS-03 persist failure**: `FailStore` rejects with `ER_LOCK_WAIT_TIMEOUT`; after `setImmediate`, `chain.lastPersistError` is `{ code: 'ER_LOCK_WAIT_TIMEOUT', at: number }`; `vi.spyOn(logger, 'warn')` confirms single call with closed shape `{ event, entry_id, event_type, error_message, error_code }` and message `'failed to persist audit entry'`

## Vitest Run Output

```
 ✓ test/audit-persistence-wiring.test.ts > OBS-01 PersistentAuditChain wiring > uses plain AuditChain when no deps supplied (backwards-compat)
 ✓ test/audit-persistence-wiring.test.ts > OBS-01 PersistentAuditChain wiring > uses injected PersistentAuditChain when deps.audit supplied
 ✓ test/audit-persistence-wiring.test.ts > R-31-01 zero-diff: chain head identical with vs without DB > produces byte-identical head hash after N identical appends
 ✓ test/audit-persistence-wiring.test.ts > OBS-03 persist failure: structured Pino + lastPersistError > records lastPersistError and emits logger.warn with closed shape

 Test Files  1 passed (1)
      Tests  4 passed (4)
   Duration  270ms
```

Broader regression check (8 test files, 122 tests): **122 passed, 0 failed.**

## Logger Spy Adaptation

**Option A selected** (least invasive, per plan): `vi.spyOn(logger, 'warn').mockImplementation(() => {})` on the base logger singleton.

Rationale: Pino child loggers share the exact same `warn` method reference from the prototype (`child.warn === base.warn` — confirmed at runtime via `node --input-type=module`). Therefore spying on the base logger intercepts all child calls without any modifications to `persistent-chain.ts`.

No Option B adaptation was needed (no export of the child logger from persistent-chain.ts).

## Deviations from Plan

None — plan executed exactly as written. The file body in Task 3.1 matches the plan's provided snippet with only cosmetic alignment differences (trailing whitespace, consistent indentation).

## Known Stubs

None. All wiring is complete:
- `launcher.audit` is `PersistentAuditChain` when `config.db` is present — confirmed by test and source inspection
- `lastPersistError` getter is implemented and tested — Phase 32 `/health/detailed` reads it
- Structured Pino log shape is implemented and asserted

## Threat Surface Scan

No new trust boundaries. The changes are:
- Internal constructor parameter addition (no new network surface)
- Module-scoped Pino child logger (stdout only, already covered by Plan 01's redact list)
- `lastPersistError` getter (read-only, internal state only — not exposed via any HTTP route in this plan)

The `error_code` field emitted in the Pino log may include mysql2 error codes (e.g. `ER_DUP_ENTRY`, `ER_LOCK_WAIT_TIMEOUT`) — these do not contain PII. Accepted per T-31-12 in the plan's threat model.

## Self-Check

### Created files exist:
- `grid/test/audit-persistence-wiring.test.ts` — FOUND (145 lines)

### Modified files exist:
- `grid/src/db/persistent-chain.ts` — FOUND (77 lines)
- `grid/src/db/index.ts` — FOUND (9 lines)
- `grid/src/genesis/launcher.ts` — FOUND (502 lines)
- `grid/src/main.ts` — FOUND (317 lines)

### Commits exist:
- `5df468b` — feat(31-03): add Pino logger + lastPersistError getter to PersistentAuditChain — FOUND
- `17210ba` — feat(31-03): export AuditStore from grid/src/db/index.ts — FOUND
- `ad25d6b` — feat(31-03): wire PersistentAuditChain into GenesisLauncher + main.ts — FOUND
- `8b40fc5` — test(31-03): add audit-persistence-wiring.test.ts — 4 vitest cases — FOUND

## Self-Check: PASSED
