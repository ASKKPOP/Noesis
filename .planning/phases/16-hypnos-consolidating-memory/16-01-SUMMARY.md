---
phase: "16"
plan: "01"
subsystem: grid-sleep-emitters
tags: [hypnos, sleep, allowlist, emitters, red-stubs, privacy]
dependency_graph:
  requires: []
  provides:
    - grid/src/sleep/ sole-producer emitters for nous.sleep.entered/completed
    - HYPNOS_FORBIDDEN_KEYS + FORBIDDEN_KEY_PATTERN extended
    - ActionType.SLEEP_ENTERED/SLEEP_COMPLETED in brain rpc types
    - BrainAction union extended with sleep_entered|sleep_completed
    - RED test stubs for HYP-01..05 (brain), wall-clock grep gate, grid sleep tests
  affects:
    - grid/src/audit/broadcast-allowlist.ts (positions 31-32 corrected, HYPNOS_FORBIDDEN_KEYS added, FORBIDDEN_KEY_PATTERN extended)
    - brain/src/noesis_brain/rpc/types.py (ActionType extended)
    - protocol/src/noesis/bridge/types.ts (BrainAction union extended)
tech_stack:
  added: []
  patterns:
    - 8-step sole-producer validation (clone of append-drive-crossed.ts pattern)
    - pytest.importorskip RED stub pattern (skip until Wave 1 implements hypnos module)
key_files:
  created:
    - grid/src/sleep/types.ts
    - grid/src/sleep/appendNousSleepEntered.ts
    - grid/src/sleep/appendNousSleepCompleted.ts
    - grid/src/sleep/index.ts
    - brain/test/hypnos/__init__.py
    - brain/test/hypnos/test_working_memory.py
    - brain/test/hypnos/test_ltm_determinism.py
    - brain/test/hypnos/test_shy_boundedness.py
    - brain/test/hypnos/test_zero_diff.py
    - brain/test/hypnos/test_ltm_retrieval_perf.py
    - brain/test/test_hypnos_no_walltime.py
    - grid/test/sleep/sleep-producer-boundary.test.ts
    - grid/test/sleep/sleep-privacy.test.ts
  modified:
    - grid/src/audit/broadcast-allowlist.ts
    - brain/src/noesis_brain/rpc/types.py
    - protocol/src/noesis/bridge/types.ts
decisions:
  - "Allowlist positions 31-32 corrected: stub comments had wrong 2-key shapes; now carry {ltm_snapshot_hash, nous_did, tick} per D-16-05"
  - "HYPNOS_FORBIDDEN_KEYS uses Object.freeze() matching IRIS_FORBIDDEN_KEYS/GOVERNANCE_FORBIDDEN_KEYS pattern"
  - "sleep_entered|sleep_completed inserted in BrainAction union BEFORE iris entries to maintain phase chronological order"
  - "Pre-existing 7 allowlist test failures (hardcoded size=27 vs actual 36) are out-of-scope deferred items from earlier phases"
metrics:
  duration: "309 seconds"
  completed_date: "2026-05-15"
  tasks_completed: 2
  files_modified: 3
  files_created: 13
---

# Phase 16 Plan 01: Allowlist Correction + Sleep Emitters + RED Stubs Summary

Real sole-producer emitters for nous.sleep.entered/completed with corrected 3-key closed-tuple payload, HYPNOS_FORBIDDEN_KEYS privacy constant, extended FORBIDDEN_KEY_PATTERN, ActionType/BrainAction extensions, and RED test stubs for all 5 HYP requirements.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Correct allowlist stubs + sleep emitters + FORBIDDEN_KEY_PATTERN | 2b505e9 | broadcast-allowlist.ts (3 edits), sleep/types.ts, appendNousSleepEntered.ts, appendNousSleepCompleted.ts, sleep/index.ts |
| 2 | ActionType extension + BrainAction union + RED test stubs | 9ca67d0 | types.py, bridge/types.ts, 11 test files |

## Verification Results

- `cd grid && npm test`: 1401 passed / 6 skipped — 16 new sleep tests all green (8 producer boundary + 8 privacy). Pre-existing 7 failures unchanged (out-of-scope allowlist size assertions).
- `cd brain && uv run pytest test/hypnos/ -q`: 6 skipped — all stubs importable, skip cleanly on missing hypnos module.
- `cd brain && uv run pytest test/test_hypnos_no_walltime.py -q`: 1 skipped — wall-clock grep gate skips (hypnos module not yet implemented, correct behavior).

## Key grep verifications

- `grep "ltm_snapshot_hash" grid/src/audit/broadcast-allowlist.ts` — appears at positions 31 and 32
- `grep "ltm_content" grid/src/audit/broadcast-allowlist.ts` — appears in HYPNOS_FORBIDDEN_KEYS and FORBIDDEN_KEY_PATTERN
- `grep "HYPNOS_FORBIDDEN_KEYS" grid/src/audit/broadcast-allowlist.ts` — exported constant present
- `grep "SLEEP_ENTERED\|SLEEP_COMPLETED" brain/src/noesis_brain/rpc/types.py` — both entries confirmed
- `grep "sleep_entered\|sleep_completed" protocol/src/noesis/bridge/types.ts` — both union literals confirmed

## Deviations from Plan

None — plan executed exactly as written.

## Deferred Items

Pre-existing 7 grid test failures (hardcoded `ALLOWLIST.size === 27` vs actual 36 entries) were present before this plan executed. These are out-of-scope — the allowlist had already been extended by Phases 15-17 stub entries in earlier work. Logged to deferred-items for future cleanup.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. All new surface is internal audit chain emitters with no network exposure. FORBIDDEN_KEY_PATTERN extension is a narrowing (more restrictive), not an expansion.

## Self-Check

**Commits exist:**
- 2b505e9: feat(16-01): correct allowlist stubs + create sleep emitters + extend FORBIDDEN_KEY_PATTERN
- 9ca67d0: feat(16-01): ActionType extension + BrainAction union + RED test stubs

**Files exist:**
- grid/src/sleep/appendNousSleepEntered.ts: created
- grid/src/sleep/appendNousSleepCompleted.ts: created
- grid/src/sleep/types.ts: created
- grid/src/sleep/index.ts: created
- brain/test/hypnos/__init__.py: created
- brain/test/test_hypnos_no_walltime.py: created
- grid/test/sleep/sleep-producer-boundary.test.ts: created
- grid/test/sleep/sleep-privacy.test.ts: created

## Self-Check: PASSED
