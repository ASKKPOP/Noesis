---
phase: "16"
plan: "05"
subsystem: brain-test-ci-doc-sync
tags: [hypnos, zero-diff, sleep-trigger, ci-gate, doc-sync, wall-clock]
dependency_graph:
  requires:
    - "16-01: ActionType.SLEEP_ENTERED/SLEEP_COMPLETED + allowlist stubs corrected"
    - "16-02: Brain hypnos/ module (WorkingMemory, LtmStore, consolidator)"
    - "16-03: HypnosRuntime + BrainHandler sleep wiring"
    - "16-04: build_system_prompt ltm_memories kwarg + ObservationalLearner"
  provides:
    - brain/test/hypnos/test_zero_diff.py — HYP-04 zero-diff integration test
    - brain/test/hypnos/test_sleep_trigger.py — T-16-02 asyncio.create_task discipline test
    - scripts/check-wallclock-forbidden.mjs — Tier A extended with hypnos/ path
    - .planning/STATE.md — Phase 16 Accumulated Context appended
    - .planning/ROADMAP.md — Phase 16 marked shipped with 5-plan list
    - .planning/MILESTONES.md — Phase 16 shipped entry appended
    - README.md — Phase 15/16/17 status paragraphs added
  affects:
    - brain/test/hypnos/test_zero_diff.py (RED stub → real integration test)
    - scripts/check-wallclock-forbidden.mjs (TIER_A_ROOTS extended)
tech_stack:
  added: []
  patterns:
    - Two-runtime zero-diff pattern (HypnosRuntime × 2, same episodes → same hash)
    - Source-inspection structural test (handler.py regex grep for discipline enforcement)
    - Tier A wall-clock gate extension (hypnos/ joins bios/chronos/whisper/governance)
    - CLAUDE.md doc-sync rule (5 planning docs + README in one atomic commit)
key_files:
  created:
    - brain/test/hypnos/test_sleep_trigger.py
  modified:
    - brain/test/hypnos/test_zero_diff.py
    - scripts/check-wallclock-forbidden.mjs
    - .planning/STATE.md
    - .planning/ROADMAP.md
    - .planning/MILESTONES.md
    - README.md
decisions:
  - "test_handler_source_does_not_await_run_sleep_directly_in_on_tick: regex targets 8-space-indented result_hash = await pattern at on_tick scope — avoids false-positive on inner _run() coroutine that legitimately awaits run_sleep"
  - "hypnos/ added to TIER_A_ROOTS (strict — any datetime word forbidden) not TIER_B (call-only): Hebbian/SHY modules have no legitimate use of datetime type annotations either"
  - "Grid suite 7 pre-existing failures confirmed pre-exist before Plan 16-05 (stash test): caused by Phase 17 allowlist count tests expecting 27 but broadcast-allowlist.ts now has 36"
metrics:
  duration: "365 seconds"
  completed_date: "2026-05-15"
  tasks_completed: 2
  files_modified: 7
  files_created: 1
---

# Phase 16 Plan 05: Zero-diff test + sleep-trigger discipline + CI gate + atomic doc-sync Summary

Zero-diff integration test (HYP-04) wired from RED stub to real test; asyncio.create_task discipline test (T-16-02) created; wall-clock CI grep gate extended to hypnos/ (T-16-03); Phase 16 doc-synced atomically across STATE.md, ROADMAP.md, MILESTONES.md, README.md per CLAUDE.md doc-sync rule.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Zero-diff test + sleep-trigger discipline test | 7f2fa68 | brain/test/hypnos/test_zero_diff.py, brain/test/hypnos/test_sleep_trigger.py |
| 2 | CI grep gate extension + atomic doc-sync | 7ce1dec | scripts/check-wallclock-forbidden.mjs, .planning/STATE.md, .planning/ROADMAP.md, .planning/MILESTONES.md, README.md |

## Verification Results

- `node scripts/check-wallclock-forbidden.mjs` — exits 0
- `node scripts/check-state-doc-sync.mjs` — exits 0
- `cd brain && pytest test/hypnos/test_zero_diff.py test/hypnos/test_sleep_trigger.py -x -q` — 5 passed
- `cd brain && pytest test/ -q` — 586 passed, 1 pre-existing failure (test_loader.py::test_action_type_drive_crossed_present — unrelated to Phase 16, same failure since Plan 03)
- Grid suite: 7 pre-existing failures confirmed pre-existing before Plan 16-05 changes (stash verification)
- `grep -n "hypnos" scripts/check-wallclock-forbidden.mjs` — shows hypnos in TIER_A_ROOTS
- `grep "Phase 16" .planning/ROADMAP.md` — shows [x] shipped 2026-05-15 + 5-plan list

## Key Grep Verifications

- `check-wallclock-forbidden.mjs`: `brain/src/noesis_brain/hypnos` in TIER_A_ROOTS (line 54) — confirmed
- `test_zero_diff.py`: `test_zero_diff_sleep_actions_are_additive` + `test_compute_snapshot_hash_stable_across_calls` — confirmed
- `test_sleep_trigger.py`: `test_handler_source_does_not_await_run_sleep_directly_in_on_tick` — confirmed
- `STATE.md`: `Phase 16 — Hypnos Consolidating Memory — shipped 2026-05-15` — confirmed
- `ROADMAP.md`: `[x]` status, 5-plan list with all [x] — confirmed
- `handler.py`: `create_task` present, no direct `await run_sleep` at on_tick scope — confirmed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] test_handler_source_does_not_await_run_sleep: false positive on inner coroutine**
- **Found during:** Task 1 — initial test regex `await\s+\S*run_sleep` matched `await rt.run_sleep` inside `_run()` inner coroutine (correct pattern), producing a false failure
- **Issue:** The handler correctly uses `asyncio.create_task(_run())` where `_run()` is an inner async def that contains `await rt.run_sleep(...)`. The broad regex matched inside the nested function body, not at on_tick scope
- **Fix:** Refined test to extract `on_tick` method body via regex, then check for direct `result_hash = await.*run_sleep` at 8-space indentation (on_tick scope level) only — inner coroutine awaits are allowed
- **Files modified:** brain/test/hypnos/test_sleep_trigger.py
- **Commit:** 7f2fa68

## Known Stubs

None — all tests are functional, all CI gates are real.

## Threat Surface Scan

No new network endpoints or auth paths introduced. All new surface is CI/test:
- `test_sleep_trigger.py` reads handler.py source at test time — no external network access
- `check-wallclock-forbidden.mjs` TIER_A extension adds one more Python directory to the scan — no new trust boundary

## Self-Check

**Commits exist:**
- 7f2fa68: feat(16-05): zero-diff + sleep-trigger discipline tests (HYP-04, T-16-02)
- 7ce1dec: feat(16-05): CI grep gate + atomic doc-sync for Phase 16 ship

**Files exist:**
- brain/test/hypnos/test_zero_diff.py: modified (real integration test replacing RED stub)
- brain/test/hypnos/test_sleep_trigger.py: created (T-16-02 discipline tests)
- scripts/check-wallclock-forbidden.mjs: modified (hypnos/ in TIER_A_ROOTS)
- .planning/STATE.md: modified (Phase 16 Accumulated Context appended)
- .planning/ROADMAP.md: modified (Phase 16 [x] shipped, 5/5 plans)
- .planning/MILESTONES.md: modified (Phase 16 shipped entry)
- README.md: modified (Phase 15/16/17 status paragraphs)

## Self-Check: PASSED

All commits exist, all files exist, CI gates pass, Brain test suite green (modulo pre-existing failure).
