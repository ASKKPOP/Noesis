---
phase: 14-researcher-rigs
plan: "01"
subsystem: researcher-rigs
tags: [rig, types, test-stubs, ci-gate, smol-toml, fixture-adapter, wave-0]
dependency_graph:
  requires: []
  provides:
    - grid/src/rig/types.ts (RigConfig, RigManifestEntry, RigExitReason, RigClosedPayload, makeRigSchemaName)
    - scripts/check-rig-invariants.mjs (T-10-12 + T-10-13 CI gate)
    - grid/test/rig/schema-name.test.ts (GREEN — makeRigSchemaName contract)
    - grid/test/rig/rig-closed-event.test.ts (type-shape GREEN; Wave 2 RED)
    - grid/test/rig/rig-invariants-grep.test.ts (GREEN — gate-logic tests)
    - grid/test/rig/toml-config.test.ts (RED — Wave 2 contract)
    - grid/test/rig/nested-rejection.test.ts (RED — Wave 2 contract)
    - brain/test/test_fixture_adapter.py (RED — Wave 1 contract)
  affects:
    - grid/package.json (smol-toml dependency added)
tech_stack:
  added:
    - smol-toml@1.6.1 (ESM-native TOML 1.0 parser, installed in grid workspace)
  patterns:
    - RED/GREEN TDD test stubs with Wave-N pointer messages
    - CI grep gate pattern (cloned from check-replay-readonly.mjs)
    - TypeScript interface-only module (no runtime logic in types.ts)
key_files:
  created:
    - grid/src/rig/types.ts
    - scripts/check-rig-invariants.mjs
    - grid/test/rig/schema-name.test.ts
    - grid/test/rig/rig-closed-event.test.ts
    - grid/test/rig/rig-invariants-grep.test.ts
    - grid/test/rig/toml-config.test.ts
    - grid/test/rig/nested-rejection.test.ts
    - brain/test/test_fixture_adapter.py
  modified:
    - grid/package.json (smol-toml@^1.6.1 added to dependencies)
    - package-lock.json (smol-toml install)
decisions:
  - "smol-toml@1.6.1 chosen over @iarna/toml (ESM-native, TOML 1.0 compliant, TypeScript types included)"
  - "check-rig-invariants.mjs is a single gate file covering both T-10-12 and T-10-13"
  - "FORBIDDEN_SYMBOLS_RE = /httpServer\\.listen|wsHub/g (verbatim per D-14-01)"
  - "BYPASS_FLAG_RE = /--skip-[a-z]|--bypass-[a-z]|--disable-[a-z]|--no-reviewer|--no-tier/g (verbatim per D-14-05)"
  - "--permissive is NOT in bypass ban list per D-14-05 (mode selector, not bypass)"
  - "RigClosedPayload is a readonly 5-key tuple (seed, tick, exit_reason, chain_entry_count, chain_tail_hash) per D-14-08"
  - "RigExitReason enum locked to 3 values: tick_budget_exhausted, all_nous_dead, operator_h5_terminate"
  - "makeRigSchemaName produces deterministic rig_{configName}_{seed8chars} per D-14-01"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-28T10:11:09Z"
  tasks: 3
  files_created: 8
  files_modified: 2
---

# Phase 14 Plan 01: Researcher Rigs Wave 0 — RED Test Scaffolding Summary

**One-liner:** RED test scaffolding locking all Phase 14 acceptance criteria + CI gate + smol-toml install + TypeScript rig types, with Wave-N pointer messages so downstream executors know exactly what to build.

## What Was Built

### Task 1: smol-toml + RigConfig Types
- Installed `smol-toml@^1.6.1` in `grid/` workspace (hoisted to root `node_modules`)
- Created `grid/src/rig/types.ts` with all Phase 14 type exports:
  - `RigManifestEntry` = `SeedNous` alias (zero-code-divergence per RIG-01)
  - `RigConfig` interface with `seed`, `configName`, `tickBudget`, `tickRateMs`, `operatorTierCap`, `llmFixturePath`, `permissive`, `nousManifest`/`nousManifestPath` (mutually exclusive per D-14-03)
  - `RigExitReason` union type locked to 3 values per D-14-08
  - `RigClosedPayload` readonly 5-key interface per D-14-08
  - `makeRigSchemaName(configName, seed)` deterministic schema name helper per D-14-01
- No errors in `grid/src/rig/types.ts` (pre-existing errors in api/whisper modules are unrelated)

### Task 2: CI Gate + Gate-Logic Tests
- Created `scripts/check-rig-invariants.mjs` (executable ESM CI gate)
  - Scans `scripts/rig.mjs` for `httpServer.listen`|`wsHub` (T-10-12)
  - Scans `scripts/rig.mjs` + `grid/src/rig/**` for bypass flags (T-10-13)
  - `--permissive` is NOT in ban list per D-14-05 (mode selector, not bypass)
  - Exits 0 when `rig.mjs` absent (gate is no-op until Wave 2 creates it)
- Created `grid/test/rig/rig-invariants-grep.test.ts` — 5 tests exercising gate with synthetic fixtures, all PASS

### Task 3: RED Test Stubs
- `grid/test/rig/schema-name.test.ts` — 4 tests, all PASS (makeRigSchemaName fully implemented)
- `grid/test/rig/rig-closed-event.test.ts` — 4 tests: 2 PASS (type-shape + exit_reason enum), 2 FAIL (Wave 2)
- `grid/test/rig/toml-config.test.ts` — 3 tests, all FAIL with "Wave 2 must implement loadRigConfigFromToml in scripts/rig-config-loader.mjs"
- `grid/test/rig/nested-rejection.test.ts` — 2 tests, all FAIL with "Wave 2 must create scripts/rig.mjs with NOESIS_RIG_PARENT guard at entry"
- `brain/test/test_fixture_adapter.py` — 6 tests, all FAIL with `ModuleNotFoundError: No module named 'noesis_brain.llm.fixture'` (Wave 1 creates the implementation)

## Frozen Invariants Locked in Tests

| Invariant | Locked In | Decision |
|-----------|-----------|---------|
| Schema name regex `^rig_[a-z0-9-]+_[0-9a-f]{8}$` | schema-name.test.ts | D-14-01 |
| Nested rig guard `NOESIS_RIG_PARENT` | nested-rejection.test.ts | D-14-02 |
| Mutually-exclusive `nous_manifest` / `nous_manifest_path` | toml-config.test.ts | D-14-03 |
| Strict cache-miss verbatim message: `'[FIXTURE ERROR] No fixture record for key "{key}". Run with --permissive to use stub.'` | test_fixture_adapter.py | D-14-05 |
| `--permissive` stub response: `'[UNMATCHED FIXTURE]'` with 0 tokens | test_fixture_adapter.py | D-14-05 |
| `chronos.rig_closed` 5-key tuple: `{seed, tick, exit_reason, chain_entry_count, chain_tail_hash}` | rig-closed-event.test.ts | D-14-08 |
| `exit_reason ∈ {tick_budget_exhausted, all_nous_dead, operator_h5_terminate}` | rig-closed-event.test.ts | D-14-08 |
| `FORBIDDEN_SYMBOLS_RE = /httpServer\.listen|wsHub/g` | check-rig-invariants.mjs + rig-invariants-grep.test.ts | T-10-12 |
| `BYPASS_FLAG_RE = /--skip-[a-z]|--bypass-[a-z]|--disable-[a-z]|--no-reviewer|--no-tier/g` | check-rig-invariants.mjs + rig-invariants-grep.test.ts | T-10-13 |
| `--permissive` NOT a bypass (exits 0 in gate) | rig-invariants-grep.test.ts | D-14-05 |
| `provider_name == 'fixture'` | test_fixture_adapter.py | D-14-04 |

## Wave Ownership for GREEN Conversion

| Test File | Status | Wave Responsible |
|-----------|--------|-----------------|
| schema-name.test.ts | GREEN (4/4) | N/A — already complete |
| rig-invariants-grep.test.ts | GREEN (5/5) | N/A — gate-logic tests for already-created gate |
| rig-closed-event.test.ts cases 1-2 | GREEN (2/2) | N/A — type-shape tests |
| rig-closed-event.test.ts cases 3-4 | RED | Wave 2 (scripts/rig.mjs creation) |
| toml-config.test.ts | RED (3/3) | Wave 2 (scripts/rig-config-loader.mjs) |
| nested-rejection.test.ts | RED (2/2) | Wave 2 (scripts/rig.mjs creation) |
| test_fixture_adapter.py | RED (6/6) | Wave 1 (brain/src/noesis_brain/llm/fixture.py) |

## Verification Status

All plan verification criteria satisfied:

1. `cd grid && npx tsc --noEmit` — no new errors in rig/types.ts (pre-existing errors in api/whisper are unrelated, documented in deferred-items.md from Phase 7)
2. `node scripts/check-rig-invariants.mjs` — exits 0 (rig.mjs absent, gate runs no-op)
3. `cd grid && npx vitest run test/rig/schema-name.test.ts test/rig/rig-closed-event.test.ts test/rig/rig-invariants-grep.test.ts` — 11/13 PASS (2 intentional RED stubs in rig-closed-event)
4. `cd grid && npx vitest run test/rig/toml-config.test.ts test/rig/nested-rejection.test.ts` — RED cases FAIL with "Wave 2 must..." messages
5. `cd brain && uv run pytest test/test_fixture_adapter.py` — 6/6 FAIL with ImportError on `noesis_brain.llm.fixture`
6. `node scripts/check-state-doc-sync.mjs` exits 0 — production allowlist count unchanged at 27

## Deviations from Plan

None — plan executed exactly as written.

The `pytestmark = pytest.mark.asyncio` warning on `test_fixture_module_exists` (synchronous function) is informational only; the test behavior is correct and all 6 cases fail as intended.

## Known Stubs

None. All stubs in the RED test files are intentional contract stubs with explicit "Wave N must..." failure messages, not stale placeholder code. The stubs serve as executable contracts for downstream wave executors.

## Threat Flags

None new. The threat model for this plan (T-14-W0-01 through T-14-W0-04) is fully addressed:
- T-14-W0-01 (gate regression): `rig-invariants-grep.test.ts` exercises the gate against synthetic fixtures
- T-14-W0-02 (test secrets): synthetic seed/keys used throughout, no real credentials
- T-14-W0-03 (type drift): `RigClosedPayload` is `readonly` 5-key; type-level test asserts shape in `rig-closed-event.test.ts`
- T-14-W0-04 (adapter spoofing): `provider_name == 'fixture'` assertion in `test_fixture_adapter.py`

## Self-Check: PASSED

Files created verified:
- grid/src/rig/types.ts: EXISTS
- scripts/check-rig-invariants.mjs: EXISTS
- grid/test/rig/schema-name.test.ts: EXISTS
- grid/test/rig/rig-closed-event.test.ts: EXISTS
- grid/test/rig/rig-invariants-grep.test.ts: EXISTS
- grid/test/rig/toml-config.test.ts: EXISTS
- grid/test/rig/nested-rejection.test.ts: EXISTS
- brain/test/test_fixture_adapter.py: EXISTS

Commits verified:
- 4b46db8: feat(14-01): install smol-toml + create rig types
- 90e6e93: feat(14-01): create check-rig-invariants.mjs + RED grep-gate test
- 7c6d7b9: test(14-01): RED test stubs for Waves 1-3 acceptance criteria
