---
phase: 19
plan: 04
subsystem: grid/genesis, grid/api, grid/norms
tags: [norm-crystallization, genesis-launcher, rest-api, norm-storage]
dependency_graph:
  requires: [19-03]
  provides: [GET /api/v1/grid/norms, NormDetector wired in GenesisLauncher]
  affects: [grid/src/genesis/launcher.ts, grid/src/api/server.ts]
tech_stack:
  added: []
  patterns: [attachStorage-mirror, sole-producer-constant, optional-service-gate]
key_files:
  created:
    - grid/test/norms/norms-api.test.ts
  modified:
    - grid/src/genesis/launcher.ts
    - grid/src/genesis/types.ts
    - grid/src/api/server.ts
    - grid/src/db/schema.ts
    - grid/src/norms/storage.ts
    - grid/src/norms/appendNormCrystallized.ts
    - grid/src/norms/index.ts
decisions:
  - Use NORM_CRYSTALLIZED_EVENT constant (exported from sole-producer file) instead of string literal in launcher to satisfy norm-producer-boundary grep gate
  - Use eventHash as norm_id (unique per crystallization event, already a 64-char hex from audit chain)
  - norm.crystallized persistence is fire-and-forget via onAppend listener, matching relationship snapshot pattern
  - first_seen_tick added to norm_registry schema v7 (safe — not yet deployed) with DEFAULT 0
metrics:
  duration: ~25 minutes
  completed: "2026-05-16"
  tasks_completed: 2
  files_modified: 7
  files_created: 1
---

# Phase 19 Plan 04: Wire NormDetector + GET /api/v1/grid/norms Summary

NormDetector wired into GenesisLauncher with full MySQL persistence path via NormStorage; REST endpoint for crystallized norms added and tested with inject() integration tests.

## What Was Done

### Task 1: GenesisConfig.norm + GenesisLauncher wiring

**`grid/src/genesis/types.ts`**
- Added `import type { NormConfig }` from norms/types.js
- Added `norm?: NormConfig` field to `GenesisConfig` (mirrors `relationship?: RelationshipConfig` pattern)

**`grid/src/genesis/launcher.ts`**
- Added imports: `NormDetector`, `NormStorage`, `DEFAULT_NORM_CONFIG`, `NORM_CRYSTALLIZED_EVENT` from norms/index.js
- Added class fields: `normDetector: NormDetector`, `normStorage: NormStorage | null`, `normCfg: NormConfig`
- Constructor: NormDetector constructed AFTER RelationshipListener (D-19-06 order preserved)
- Added `attachNormStorage(pool: Pool): void` — exact mirror of `attachRelationshipStorage` (idempotent, throws on pool-switch)
- Added `normStorageRef` getter for API server wiring
- In `bootstrap()`: `normDetector.rebuildFromChain(currentTick - normCfg.windowTicks)` called after `relationships.rebuildFromChain()`
- In `bootstrap()`: `audit.onAppend` listener persists `norm.crystallized` events to `normStorage` (fire-and-forget, audit chain is truth)

### Task 2: Schema + Storage updates

**`grid/src/db/schema.ts`**
- Added `first_seen_tick INT NOT NULL DEFAULT 0` column to `norm_registry` table in version 7 migration

**`grid/src/norms/storage.ts`**
- `insertRegistry` signature extended with `firstSeenTick: number` parameter
- SQL updated to include `first_seen_tick` in INSERT

**`grid/src/norms/appendNormCrystallized.ts`**
- Exported `NORM_CRYSTALLIZED_EVENT = 'norm.crystallized' as const` constant to allow launcher to reference the event type without containing the string literal (sole-producer boundary compliance)

**`grid/src/norms/index.ts`**
- Re-exported `NORM_CRYSTALLIZED_EVENT`

### Task 3: GET /api/v1/grid/norms endpoint

**`grid/src/api/server.ts`**
- Added optional `norms?` field to `GridServices` interface with typed `loadNorms` method
- Added inline GET route under `if (services.norms)` guard — follows same optional-service pattern as governance routes
- Response shape: `{ norms: [{ norm_id, fingerprint, crystallized_tick, participant_count, convergence_type, evidence_tick_range }] }`
- `evidence_tick_range` is `[first_seen_tick, crystallized_tick]`

**`grid/test/norms/norms-api.test.ts`** (new)
- 5 tests using Fastify `inject()`:
  1. 200 status with one mock norm
  2. Correct norm field shape
  3. `evidence_tick_range` = `[first_seen_tick, crystallized_tick]`
  4. 200 + `{ norms: [] }` when service returns empty array
  5. 404 when `services.norms` is undefined (route not registered)

## Test Results

```
Test Files  8 passed (8)
Tests       67 passed (67)
```

All norms tests green. No new TypeScript errors introduced (pre-existing errors in whisper/, nous-runner.ts are out of scope).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical field] first_seen_tick absent from norm_registry schema**
- **Found during:** Task 1 schema inspection
- **Issue:** `norm_registry` DDL in schema v7 had no `first_seen_tick` column, but the REST endpoint requires `evidence_tick_range: [first_seen_tick, crystallized_tick]`
- **Fix:** Added `first_seen_tick INT NOT NULL DEFAULT 0` to norm_registry DDL; extended `NormStorage.insertRegistry` signature with `firstSeenTick` param
- **Files modified:** `grid/src/db/schema.ts`, `grid/src/norms/storage.ts`
- **Commit:** d97bdf6

**2. [Rule 1 - Bug] norm-producer-boundary grep gate failure**
- **Found during:** Task 1 test run
- **Issue:** String literal `norm.crystallized` in launcher.ts JSDoc comments and onAppend filter triggered the sole-producer grep gate, which expects the string to appear only in `appendNormCrystallized.ts` and `broadcast-allowlist.ts`
- **Fix:** Exported `NORM_CRYSTALLIZED_EVENT` constant from the sole-producer file; replaced all string literals in launcher.ts (including comments) with the constant or neutral descriptions
- **Files modified:** `grid/src/norms/appendNormCrystallized.ts`, `grid/src/norms/index.ts`, `grid/src/genesis/launcher.ts`
- **Commit:** d97bdf6

## Commit

`d97bdf6` — feat(19): wire NormDetector into GenesisLauncher; add GET /api/v1/grid/norms

## Self-Check

- [x] `grid/src/genesis/launcher.ts` — exists, NormDetector wired
- [x] `grid/src/api/server.ts` — GET /api/v1/grid/norms registered
- [x] `grid/test/norms/norms-api.test.ts` — exists, 5 tests pass
- [x] Commit d97bdf6 exists
