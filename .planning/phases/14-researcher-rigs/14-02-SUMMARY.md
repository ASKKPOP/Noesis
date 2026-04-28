---
phase: 14-researcher-rigs
plan: "02"
subsystem: researcher-rigs
tags: [rig, fixture-adapter, await-tick, schema-bootstrap, microbenchmark, wave-1]
dependency_graph:
  requires:
    - grid/src/rig/types.ts (Wave 0 — makeRigSchemaName)
    - brain/test/test_fixture_adapter.py (Wave 0 — RED test contract)
  provides:
    - brain/src/noesis_brain/llm/fixture.py (FixtureBrainAdapter — RIG-03)
    - grid/src/integration/grid-coordinator.ts (awaitTick — RIG-04, Open Question A4)
    - grid/src/rig/schema.ts (createRigSchema — RIG-02)
    - grid/test/rig/coordinator-await-tick.test.ts (GREEN — 3/3)
    - grid/test/rig/producer-bench.test.ts (GREEN — p99 gate T-10-15)
    - grid/test/rig/tarball-integrity.test.ts (RED — Wave 2 contract)
  affects:
    - brain/src/noesis_brain/llm/__init__.py (re-exports FixtureBrainAdapter)
tech_stack:
  added: []
  patterns:
    - "FixtureBrainAdapter: JSONL-keyed fixture replay implementing LLMAdapter ABC"
    - "awaitTick: Promise.all-based tick dispatch resolving Open Question A4"
    - "createRigSchema: CREATE SCHEMA IF NOT EXISTS + MigrationRunner.run() idempotent pattern"
    - "Producer-boundary microbenchmark: process.hrtime.bigint() p99 gate"
key_files:
  created:
    - brain/src/noesis_brain/llm/fixture.py
    - grid/src/rig/schema.ts
    - grid/test/rig/coordinator-await-tick.test.ts
    - grid/test/rig/producer-bench.test.ts
    - grid/test/rig/tarball-integrity.test.ts
  modified:
    - brain/src/noesis_brain/llm/__init__.py (added FixtureBrainAdapter export)
    - grid/src/integration/grid-coordinator.ts (added awaitTick method)
decisions:
  - "AuditChain listener attach via onAppend() (not subscribe()) — matches actual API"
  - "awaitTick placed after start() and before despawnNous to preserve existing method order"
  - "createRigSchema uses admin mysql.createConnection (not pool) for DDL then scoped DatabaseConnection for migrations"
  - "FixtureBrainAdapter raises FileNotFoundError (not RuntimeError) for missing fixture file"
  - "Duplicate key detection at construction time — defense-in-depth beyond Wave 0 contract"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-28T10:18:31Z"
  tasks: 3
  files_created: 5
  files_modified: 2
---

# Phase 14 Plan 02: Researcher Rigs Wave 1 — Core Primitives Summary

**One-liner:** FixtureBrainAdapter (Python LLMAdapter replay), GridCoordinator.awaitTick() (synchronous tick completion signal), rig MySQL schema bootstrap, and producer-boundary p99 microbenchmark gate — all Wave 0 brain RED tests now GREEN.

## What Was Built

### Task 1: FixtureBrainAdapter (Python)

`brain/src/noesis_brain/llm/fixture.py` — implements `LLMAdapter` ABC:

- **Key lookup (D-14-04):** Loads JSONL at construction; serves records by `GenerateOptions.purpose` key equality
- **Strict miss (D-14-05):** Raises `RuntimeError` with frozen message: `[FIXTURE ERROR] No fixture record for key "{key}". Run with --permissive to use stub.`
- **Permissive mode:** Returns `LLMResponse(text="[UNMATCHED FIXTURE]", usage={"completion_tokens": 0})` and logs miss to stderr
- **provider_name:** Returns `"fixture"` literal (T-14-W1-03 — tier mismatch detection at ModelRouter)
- **is_available():** Returns `True` when records loaded; `False` for empty fixture file
- **Tier validation:** Mismatch between adapter `tier=` constructor arg and record's `tier` field raises at `generate()` time
- **Duplicate key detection:** Raises `ValueError` at construction (defense-in-depth)
- **Valid tiers:** `SMALL`, `PRIMARY`, `LARGE` — invalid tier in JSONL raises at load time

`brain/src/noesis_brain/llm/__init__.py` updated to re-export `FixtureBrainAdapter` in `__all__`.

All 6 `brain/test/test_fixture_adapter.py` tests turned **GREEN** (were RED in Wave 0).

### Task 2: GridCoordinator.awaitTick() + Rig Schema Bootstrap

**`grid/src/integration/grid-coordinator.ts`** — new `awaitTick(tick, epoch): Promise<void>` method:

- Identical tick dispatch logic as `start()`: pulls `aggregator.drainPending()` per runner, dispatches with or without dialogue context
- Wraps all runner promises in `Promise.all()` — resolves only when EVERY runner's tick settles
- Per-runner errors caught and logged (outer promise never rejects)
- Existing `start()` behavior unchanged — regression test confirms `clock.onTick` still wires once

**Resolves Open Question A4 from RESEARCH.md:** `rig.mjs` can now `await coordinator.awaitTick(tick, epoch)` in a direct for-loop, guaranteeing all 50 Nous complete tick N before tick N+1 begins — no races.

**`grid/src/rig/schema.ts`** — `createRigSchema(opts): Promise<RigSchemaHandle>`:

- Opens admin `mysql.createConnection` (no database) to issue `CREATE SCHEMA IF NOT EXISTS \`rig_...\``
- Schema name derived via `makeRigSchemaName(configName, seed)` (validates charset + length before interpolation — T-14-W1-05)
- Connects scoped `DatabaseConnection` to the rig schema
- Runs `MigrationRunner.run()` applying same MIGRATIONS as production — idempotent
- Returns `{ schemaName, db, migrationsApplied }`

All 3 `grid/test/rig/coordinator-await-tick.test.ts` tests **GREEN**.

### Task 3: Producer-Boundary Microbenchmark + Tarball Integrity RED Stub

**`grid/test/rig/producer-bench.test.ts`** — T-10-15 gate, **GREEN**:

- 10,000 iterations of `audit.append()` with 5 listeners registered via `onAppend()`
- Listeners perform ~50 iterations of arithmetic to model realistic production fan-out
- 200-iteration warm-up to amortize JIT
- **Measured p50/p99/p999 on dev machine (Apple Silicon, 2026-04-28):**
  - Run 1: `p50=0.001ms p99=0.009ms p999=0.049ms`
  - Run 2: `p50=0.001ms p99=0.011ms p999=0.044ms`
- Hard gate: `p99 < 1ms` — passes with 100x headroom
- Timeout: 30s for CI headroom

**`grid/test/rig/tarball-integrity.test.ts`** — RIG-05 RED stub, **FAILS as intended**:

- Fails with `"Wave 2 must wire scripts/rig.mjs to call buildExportTarball; this test then asserts hash stability across 3 builds with the rig isolated chain"`
- Pseudocode reference for Wave 2 executor included in comments

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| `onAppend()` (not `subscribe()`) for AuditChain listener | Matches actual `AuditChain` public API — `subscribe` does not exist |
| `awaitTick()` placed after `start()`, before `despawnNous()` | Preserves existing method ordering; minimal diff to existing file |
| Admin `mysql.createConnection` (not pool) for DDL | DDL requires no-database connection; pool connects to specific database |
| `FixtureBrainAdapter` raises `FileNotFoundError` for missing path | More informative than generic `RuntimeError`; catches researcher authoring errors early |
| Duplicate key detection at construction | Defense-in-depth — fixture file authoring errors caught before any `generate()` call |

## Resolution of Open Question A4

RESEARCH.md §Open Questions §1 documented:

> "How does `rig.mjs` know when all 50 Nous have completed their tick work before advancing the next tick?"

**Resolution:** `GridCoordinator.awaitTick(tick, epoch)` added. Rigs call `addRunner()` for each NousRunner, then drive the tick loop with:

```typescript
for (let t = 0; t < tickBudget; t++) {
    const event = launcher.clock.advance();
    await coordinator.awaitTick(event.tick, event.epoch);
    // All 50 Nous have now settled — safe to advance next tick
}
```

The method reuses the exact same `drainPending` + sequential-context + `Promise.all` logic as `start()`, ensuring identical behavior to production tick dispatch.

## Wave 0 RED Tests — Status After Wave 1

| Test File | Wave 0 Status | Wave 1 Status | Wave Responsible |
|-----------|---------------|---------------|-----------------|
| brain/test/test_fixture_adapter.py | RED (6/6) | **GREEN (6/6)** | Wave 1 — DONE |
| grid/test/rig/coordinator-await-tick.test.ts | — (new) | **GREEN (3/3)** | Wave 1 — DONE |
| grid/test/rig/producer-bench.test.ts | — (new) | **GREEN (1/1)** | Wave 1 — DONE |
| grid/test/rig/tarball-integrity.test.ts | — (new) | RED (1/1 — intentional) | Wave 2 |
| grid/test/rig/schema-name.test.ts | GREEN (4/4) | GREEN (4/4) | N/A |
| grid/test/rig/rig-invariants-grep.test.ts | GREEN (5/5) | GREEN (5/5) | N/A |
| grid/test/rig/rig-closed-event.test.ts cases 1-2 | GREEN (2/2) | GREEN (2/2) | N/A |
| grid/test/rig/rig-closed-event.test.ts cases 3-4 | RED | RED | Wave 2 |
| grid/test/rig/toml-config.test.ts | RED (3/3) | RED (3/3) | Wave 2 |
| grid/test/rig/nested-rejection.test.ts | RED (2/2) | RED (2/2) | Wave 2 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] AuditChain listener API differs from plan template**

- **Found during:** Task 3
- **Issue:** Plan template used `chain.subscribe?.()` which does not exist on `AuditChain`. The correct API is `chain.onAppend(listener)`.
- **Fix:** Updated `producer-bench.test.ts` to use `chain.onAppend()` — matches the actual public method from `grid/src/audit/chain.ts`.
- **Files modified:** `grid/test/rig/producer-bench.test.ts`
- **Commit:** 830d113

## Known Stubs

One intentional RED stub: `grid/test/rig/tarball-integrity.test.ts` — explicitly marked as Wave 2 contract. This does not prevent this plan's goal from being achieved (Wave 1 delivers primitives; Wave 2 wires them).

## Threat Flags

None new. All STRIDE threats from the plan's threat model addressed:
- **T-14-W1-01** (FixtureBrainAdapter tampering): strict cache-miss raises by default; --permissive explicit
- **T-14-W1-03** (FixtureBrainAdapter spoofing): `provider_name = 'fixture'`; tier mismatch raises
- **T-14-W1-04** (awaitTick regressing start()): regression test asserts `clock.onTick` still wired
- **T-14-W1-05** (createRigSchema EoP): `makeRigSchemaName` validates charset before string interpolation; backtick-quoted in DDL

## Self-Check: PASSED

Files created verified:
- brain/src/noesis_brain/llm/fixture.py: EXISTS
- grid/src/rig/schema.ts: EXISTS
- grid/test/rig/coordinator-await-tick.test.ts: EXISTS
- grid/test/rig/producer-bench.test.ts: EXISTS
- grid/test/rig/tarball-integrity.test.ts: EXISTS

Commits verified:
- 49210c5: feat(14-02): FixtureBrainAdapter — implements LLMAdapter, turns brain RED tests GREEN
- 7828029: feat(14-02): GridCoordinator.awaitTick() + rig schema bootstrap helper
- 830d113: test(14-02): producer-boundary p99 microbenchmark GREEN + tarball-integrity RED stub
