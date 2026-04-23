---
phase: 10b
plan: 03
subsystem: grid/bios
tags: [bios, audit, allowlist, sole-producer, closed-tuple, tdd-green]
requires:
  - allowlist-frozen-invariant (SC#5)
  - appendNousDeleted sole-producer pattern (Phase 8)
  - append-drive-crossed sole-producer pattern (Phase 10a)
provides:
  - bios.birth audit event (sole producer: grid/src/bios/appendBiosBirth.ts)
  - bios.death audit event (sole producer: grid/src/bios/appendBiosDeath.ts)
  - BIOS_FORBIDDEN_KEYS privacy matrix
  - CHRONOS_FORBIDDEN_KEYS privacy matrix
  - closed-enum CAUSE_VALUES = ['starvation', 'operator_h5', 'replay_boundary']
  - tombstone gate on bios.death emission
affects:
  - grid/src/audit/broadcast-allowlist.ts (extended 19→21)
  - grid/src/genesis/launcher.ts (wired appendBiosBirth at both spawn sites)
  - test/relationships/allowlist-frozen.test.ts (baseline 19→21)
tech-stack:
  added: [closed-tuple validation, CAUSE literal-guard, tombstone gate, bootstrapPsycheHash]
  patterns: [sole-producer, belt-and-suspenders privacy, snake_case wire payloads]
key-files:
  created:
    - grid/src/bios/types.ts
    - grid/src/bios/appendBiosBirth.ts
    - grid/src/bios/appendBiosDeath.ts
    - grid/src/bios/index.ts
  modified:
    - grid/src/audit/broadcast-allowlist.ts
    - grid/src/genesis/launcher.ts
    - grid/test/audit/broadcast-allowlist.test.ts
    - grid/test/relationships/allowlist-frozen.test.ts
decisions:
  - Closed-tuple check MUST precede format/enum checks so missing-key cases yield structural "unexpected key set" diagnostic instead of misleading format errors.
  - assertCause error message uses literal "invalid cause:" to match Wave 0 test regex /unknown cause|invalid cause/.
  - Tombstone gate is caller-injected (optional registry param) — single-responsibility keeps emitter free of state management.
  - No 'bios.birth' or 'bios.death' string literals permitted outside the sole-producer files (enforced by bios-producer-boundary.test.ts).
metrics:
  duration: ~3 hours (with continuation from context-limit break)
  completed: 2026-04-22
  commits:
    - 25b9d1b feat(10b-03): extend allowlist 19→21 + bios/chronos forbidden keys + bios types
    - 7a9231a feat(10b-03): sole-producer emitters appendBiosBirth + appendBiosDeath
    - e9f7c38 feat(10b-03): wire appendBiosBirth into launcher spawn sites
---

# Phase 10b Plan 03: Grid Bios Emitters + Allowlist Extension Summary

Extends broadcast allowlist 19→21 (adding `bios.birth` and `bios.death`), creates two sole-producer emitters implementing 8-step validation discipline (DID regex, self-report invariant, closed-tuple, CAUSE literal-guard, tombstone gate, privacy belt-and-suspenders), and wires `appendBiosBirth` into both launcher spawn sites per locked D-30 ordering (nous.spawned → bios.birth within same tick).

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Allowlist extension + types | 25b9d1b | broadcast-allowlist.ts, bios/types.ts |
| 2 | Sole-producer emitters | 7a9231a | bios/appendBiosBirth.ts, bios/appendBiosDeath.ts, bios/index.ts |
| 3 | Launcher wiring | e9f7c38 | genesis/launcher.ts, allowlist-frozen.test.ts, broadcast-allowlist.test.ts |

## In-Scope Verification — ALL GREEN

```
✓ test/audit/broadcast-allowlist.test.ts (46 tests)
✓ test/relationships/allowlist-frozen.test.ts (4 tests)
✓ test/bios/bios-producer-boundary.test.ts (7 tests)
✓ test/bios/appendBiosBirth.test.ts (17 tests)
✓ test/bios/appendBiosDeath.test.ts (23 tests)

Tests  97 passed (97)
```

## TDD Gate Compliance

Plan type was GREEN-phase (turning Wave 0 RED stubs GREEN). RED gate was committed in Plan 10b-01 (`test(10b-01):` commits added failing stubs). GREEN gate satisfied by the three `feat(10b-03):` commits above. No REFACTOR commit needed — emitters are minimal.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Closed-tuple ordering inverted**
- **Found during:** Task 2 verification
- **Issue:** Initial emitter ordering had format/enum checks before the closed-tuple check, so missing-key cases threw "invalid psyche_hash" / "invalid cause: undefined" instead of the structural "unexpected key set" diagnostic Wave 0 tests expect.
- **Fix:** Reordered both emitters to validate the closed-tuple BEFORE format/enum validations.
- **Files:** grid/src/bios/appendBiosBirth.ts, grid/src/bios/appendBiosDeath.ts
- **Commit:** 7a9231a

**2. [Rule 1 - Bug] assertCause error message mismatch**
- **Found during:** Task 2 verification
- **Issue:** Initial message "invalid bios.death cause" contained the 'bios.death' literal, which (a) violated the producer-boundary invariant by placing the literal in types.ts, and (b) Wave 0 test regex is `/unknown cause|invalid cause/`.
- **Fix:** Shortened to "invalid cause: <json>".
- **Files:** grid/src/bios/types.ts
- **Commit:** 7a9231a

**3. [Rule 1 - Bug] Literal strings in launcher comments**
- **Found during:** Task 3 verification (bios-producer-boundary.test.ts)
- **Issue:** Launcher comments used 'bios.birth' literal, tripping the grep-based producer-boundary invariant test.
- **Fix:** Replaced with "the bios-birth event" phrasing.
- **Files:** grid/src/genesis/launcher.ts
- **Commit:** e9f7c38

## Deferred Issues

### Out-of-Scope Tests (dependencies on future plans)

Documented in `deferred-items.md`:

1. **test/regression/pause-resume-10b.test.ts** — Chronos wire-listener integration, depends on Plan 10b-04.
2. **test/ci/bios-no-walltime.test.ts** (chronos subtest) — Scans `grid/src/chronos/**`, which does not yet exist; belongs to Plan 10b-04.
3. **test/api/operator/delete-nous-bios-death.test.ts** — H5 delete wiring belongs to Plan 10b-05.

These RED stubs from Wave 0 remain RED until their respective wiring plans land.

## Threat Flags

| Flag | Files | Description |
|------|-------|-------------|
| threat_flag: regression_surface | grid/src/genesis/launcher.ts | **Significant regression surface: 52 pre-existing tests now fail because `appendBiosBirth`'s strict `DID_RE = /^did:noesis:[a-z0-9_\-]+$/i` rejects legacy `did:key:sophia`, `did:key:hermes` fixtures used throughout the codebase.** The plan explicitly mandates this regex (lines 201, 264) and mandates emission at both spawn sites. This is a **cross-plan architectural collision** — the plan locks `did:noesis:` per D-29, but `src/main.ts`, `src/genesis/presets.ts`, and dozens of test fixtures still use `did:key:*`. Plan 10b-03 alone cannot resolve this; it requires either (a) reconciling fixture DIDs to `did:noesis:` format across ~15+ test files, or (b) relaxing DID_RE in the emitters (contradicts D-29). Recommend this is addressed in Plan 10b-07 (integration-regression) per its existing mandate or escalated to an architectural decision. |

### Affected test files (52 failures, all same root cause)

- test/genesis.test.ts (13 tests)
- test/genesis/launcher.tick-audit.test.ts (5 tests)
- test/genesis/shops-wiring.test.ts (1 test)
- test/integration/e2e-messaging.test.ts (7 tests)
- test/integration/e2e-tick-cycle.test.ts (3 tests)
- test/db/snapshot-restore.test.ts (7 tests)
- test/docker/graceful-shutdown.test.ts (2 tests)
- test/docker/server-startup.test.ts (1 test)
- test/relationships/listener-launcher-order.test.ts (1 test)
- test/api/operator/delete-nous-bios-death.test.ts (3 tests — also out-of-scope per Plan 10b-05)
- test/ci/bios-no-walltime.test.ts (1 test — out-of-scope per Plan 10b-04)
- test/regression/pause-resume-10b.test.ts (1 test — out-of-scope per Plan 10b-04)

## Self-Check

Created files:
- FOUND: grid/src/bios/types.ts
- FOUND: grid/src/bios/appendBiosBirth.ts
- FOUND: grid/src/bios/appendBiosDeath.ts
- FOUND: grid/src/bios/index.ts

Commits:
- FOUND: 25b9d1b (allowlist extension)
- FOUND: 7a9231a (sole-producer emitters)
- FOUND: e9f7c38 (launcher wiring)

## Self-Check: PASSED (in-scope)

All plan-mandated tasks committed. All in-scope tests GREEN (97/97). The 52 out-of-plan regressions are fully disclosed under Threat Flags as a cross-plan architectural collision requiring resolution in Plan 10b-07 or an explicit architectural decision about DID format reconciliation.
