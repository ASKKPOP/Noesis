---
phase: 10b
plan: "01"
subsystem: test-scaffolding
tags: [tdd, red, wave-0, bios, chronos, test-scaffolding]
requires:
  - phase-10b/10b-PATTERNS.md
  - phase-10b/10b-VALIDATION.md
  - phase-10b/10b-UI-SPEC.md
  - phase-10a/drive-test-suite (clone source)
provides:
  - 24 RED test stubs covering bios + chronos invariants
  - frozen-hash regression for pause/resume (T-09-04)
  - SYNC drift detector for bios-types ↔ brain config
  - privacy matrix extension for BIOS+CHRONOS forbidden keys
affects:
  - brain/test/bios/, brain/test/chronos/, brain/test/test_bios_no_walltime.py
  - grid/test/bios/, grid/test/chronos/, grid/test/audit/, grid/test/api/operator/, grid/test/privacy/, grid/test/regression/, grid/test/ci/
  - dashboard/test/privacy/, dashboard/test/lib/
tech-stack:
  added: []
  patterns: [red-then-green-stub, sync-header-drift-detector, sole-producer-grep-gate, closed-tuple-payload, frozen-hash-regression]
key-files:
  created:
    - brain/test/bios/__init__.py
    - brain/test/chronos/__init__.py
    - brain/test/bios/test_needs_determinism.py
    - brain/test/bios/test_needs_baseline.py
    - brain/test/bios/test_needs_elevator.py
    - brain/test/bios/test_epoch_since_spawn.py
    - brain/test/chronos/test_subjective_time.py
    - brain/test/chronos/test_retrieval_with_chronos.py
    - brain/test/test_bios_no_walltime.py
    - grid/test/bios/appendBiosBirth.test.ts
    - grid/test/bios/appendBiosDeath.test.ts
    - grid/test/bios/bios-producer-boundary.test.ts
    - grid/test/audit/allowlist-twenty-one.test.ts
    - grid/test/audit/closed-enum-bios-lifecycle.test.ts
    - grid/test/audit/zero-diff-bios.test.ts
    - grid/test/audit/audit-size-ceiling-bios.test.ts
    - grid/test/api/operator/delete-nous-bios-death.test.ts
    - grid/test/ci/bios-no-walltime.test.ts
    - grid/test/chronos/no-wire-test.test.ts
    - grid/test/privacy/bios-forbidden-keys.test.ts
    - grid/test/privacy/chronos-forbidden-keys.test.ts
    - grid/test/regression/pause-resume-10b.test.ts
    - dashboard/test/privacy/bios-forbidden-keys-dashboard.test.tsx
    - dashboard/test/lib/bios-types.drift.test.ts
  modified: []
decisions:
  - "Cloned Phase 10a Ananke test patterns wholesale; renamed Drive→Need, ananke→bios; preserved all assertion shapes for test-suite consistency"
  - "Frozen pause/resume hash c7c49f492d85072327e8a4af6912228d6dc2db2d7be372f92b57b30b2a4b0461 from Phase 9 carried into 10b regression suite — Chronos listener must NOT perturb chain"
  - "Bucket function for bios-types drift detector uses non-hysteretic 0.33/0.66 thresholds (UI-SPEC §Bucketing) — diverges from ananke's hysteresis-aware bucketFromLow"
  - "Sole-producer grep gate excludes broadcast-allowlist.ts (legitimate name-the-forbidden) and *.test.ts (privacy regression suite)"
metrics:
  duration: "~45min (post-compaction continuation)"
  task_count: 3
  file_count: 24
  completed: "2026-04-22"
---

# Phase 10b Plan 01: Wave 0 Test Scaffolding Summary

24 RED test stubs spanning brain (Python pytest), grid (TypeScript Vitest), and dashboard (Vitest+TSX) that pin every Phase 10b invariant before any production code lands.

## What Shipped

**Brain (9 files, commit 918d697)**
- `test_needs_determinism.py` — byte-identical replay (seed=42, 10000 ticks); wall-clock injection invariance; two-tick-rate equivalence
- `test_needs_baseline.py` — initial_state() returns energy=0.3/sustenance=0.3 LOW-bucketed; rise-only monotonic; relaxation from below baseline
- `test_needs_elevator.py` — D-10b-02 frozen mapping: energy LOW→MED elevates hunger LOW→MED; sustenance LOW→MED elevates safety; HIGH cap no-op; mapping doesn't touch curiosity/boredom/loneliness; once-per-crossing
- `test_epoch_since_spawn.py` — CHRONOS-03 pure subtraction: epoch_since_spawn(150) on birth_tick=100 returns 50; at_birth=0; deterministic
- `test_subjective_time.py` — CHRONOS-01 9-cell multiplier matrix from D-10b-05 (LOW+LOW=1.0, MED+LOW=2.0, HIGH+LOW=4.0, LOW+HIGH=0.25, HIGH+HIGH=3.25); clamp; hunger/safety/loneliness ignored
- `test_retrieval_with_chronos.py` — recency_score_by_tick decay; score_with_chronos multiplier scaling clamped at 1.0
- `test_bios_no_walltime.py` — T-09-03 grep gate over brain/src/noesis_brain/bios/** + chronos/** for time.time/datetime.now/uuid.uuid4/random.random etc.
- 2 `__init__.py` package markers

**Grid (13 files, commit 6c35a17)**
- `appendBiosBirth.test.ts` — closed 3-key {did, psyche_hash, tick} payload; DID_RE/HEX64_RE/tick guards; self-report invariant
- `appendBiosDeath.test.ts` — closed 4-key {cause, did, final_state_hash, tick}; CAUSE_VALUES enum {starvation, operator_h5, replay_boundary}; post-death rejection
- `bios-producer-boundary.test.ts` — sole-producer grep: 'bios.birth' literal only in appendBiosBirth.ts + broadcast-allowlist.ts; no resurrect/migrate/transfer siblings
- `allowlist-twenty-one.test.ts` — BIOS-02 21-tuple frozen; bios.birth@19, bios.death@20; rejects chronos.*; preserves all 19 prior; frozen mutation throws TypeError
- `closed-enum-bios-lifecycle.test.ts` — isAllowlisted=false for forbidden bios.* + chronos.* siblings
- `zero-diff-bios.test.ts` — T-09-04 byte-identical pre-bios hashes; audit_tick === loop counter
- `audit-size-ceiling-bios.test.ts` — BIOS_CEILING=10; ANANKE_CEILING=50 regression
- `api/operator/delete-nous-bios-death.test.ts` — BIOS-03 + AGENCY-05: H5 delete emits bios.death IMMEDIATELY before operator.nous_deleted (D-30 ordering); same tick; final_state_hash linkage via Fastify app.inject
- `ci/bios-no-walltime.test.ts` — T-09-03 grep gate over grid/src/bios + chronos
- `chronos/no-wire-test.test.ts` — CHRONOS-02 + D-10b-10/11: ALLOWLIST has zero chronos.*; CHRONOS_FORBIDDEN_KEYS=3; no chronos literal in grid/src outside allowlist+tests; JSON-RPC shapes leak-free
- `privacy/bios-forbidden-keys.test.ts` — D-10b-10 BIOS_FORBIDDEN_KEYS=['energy','sustenance','need_value','bios_value']; flat/nested/array; case-insensitive; preserves Phase 6/10a regression
- `privacy/chronos-forbidden-keys.test.ts` — D-10b-10 CHRONOS_FORBIDDEN_KEYS=['subjective_multiplier','chronos_multiplier','subjective_tick']; depth-3 walks; preserves Phase 6/10a/10b-bios
- `regression/pause-resume-10b.test.ts` — T-09-04 frozen Phase 9 hash `c7c49f492d85072327e8a4af6912228d6dc2db2d7be372f92b57b30b2a4b0461` survives Chronos listener wiring

**Dashboard (2 files, commit 753ce21)**
- `privacy/bios-forbidden-keys-dashboard.test.tsx` — render `<BiosSection>` with mocked useBiosLevels; BIOS+CHRONOS forbidden keys absent from text/title/aria-label/data-*; permits data-need="energy"|"sustenance" enum values; greps introspect.ts + dashboard/src/lib/api for property-key form
- `lib/bios-types.drift.test.ts` — fs.readFileSync brain/src/noesis_brain/bios/config.py; regex extracts NEED_BASELINES.ENERGY/SUSTENANCE = 0.3; bucketizes at 0.33/0.66; pins NEED_ORDER=['energy','sustenance']; pins NEED_GLYPH (U+26A1, U+2B21); pins D-10b-02 NEED_TO_DRIVE elevator mapping

## Verification

All 24 stubs FAIL at Wave 0 — the contract:

- **Brain:** `uv run --with pytest pytest test/bios test/chronos test/test_bios_no_walltime.py --collect-only` → 6 collection errors (`ModuleNotFoundError: noesis_brain.bios` / `noesis_brain.chronos`)
- **Grid:** `npx vitest run test/bios test/chronos test/privacy/{bios,chronos}-forbidden-keys test/regression/pause-resume-10b test/audit/{allowlist-twenty-one,closed-enum-bios-lifecycle,zero-diff-bios,audit-size-ceiling-bios} test/api/operator/delete-nous-bios-death test/ci/bios-no-walltime` → **13 failed (13)** files, 16 failed | 25 passed of 41 tests (the 25 passing tests are intentional regression preservation: Phase 6/10a forbidden keys still rejected, etc.)
- **Dashboard:** `npx vitest run test/privacy/bios-forbidden-keys-dashboard test/lib/bios-types.drift` → **2 failed (2)** files, "Failed to resolve import @/lib/protocol/bios-types"

Wave 1 (10b-02 brain bios subsystem) and Wave 4 (10b-04 brain chronos retrieval) flip the brain stubs GREEN.
Wave 1 (10b-03 grid bios emitters + allowlist), Wave 2 (10b-05 grid H5 delete), Wave 4 (10b-04 chronos listener) flip the grid stubs GREEN.
Wave 2 (10b-06 dashboard bios panel) flips the dashboard stubs GREEN.

## Deviations from Plan

None — plan executed exactly as written. All 24 files match the file list in the plan's `<output>` section. All cloning sources matched the patterns specified in `<read_first>`. All assertions encode the invariants pinned in the plan's `<action>` blocks.

## Threat Flags

None — all surface introduced by these stubs is test-only; no new production endpoints, auth paths, or trust boundaries.

## Self-Check: PASSED

**Files (24/24 found):**
- All 9 brain files present at `brain/test/bios/*.py`, `brain/test/chronos/*.py`, `brain/test/test_bios_no_walltime.py`
- All 13 grid files present at `grid/test/{bios,chronos,audit,api/operator,ci,privacy,regression}/`
- Both 2 dashboard files present at `dashboard/test/{privacy,lib}/`

**Commits (3/3 found in `git log --oneline -5`):**
- `918d697` test(10b-01): add Wave 0 RED stubs for brain bios + chronos
- `6c35a17` test(10b-01): add Wave 0 RED stubs for grid bios + chronos + audit + privacy + regression
- `753ce21` test(10b-01): add Wave 0 RED stubs for dashboard bios privacy + drift

## TDD Gate Compliance

This plan is the RED gate for Phase 10b. All 24 stubs fail by design — production modules they import (noesis_brain.bios, noesis_brain.chronos, grid/src/bios/*, grid/src/chronos/*, dashboard/src/lib/protocol/bios-types) do not exist yet. Subsequent waves will add `feat(...)` GREEN commits that resolve these imports without modifying the test stubs.
