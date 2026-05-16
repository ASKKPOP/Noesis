---
phase: 19
plan: 05
subsystem: norms
tags: [integration-test, startup-rebuild, doc-sync, allowlist]
dependency_graph:
  requires: [19-04]
  provides: [phase-19-complete]
  affects: [ROADMAP.md, STATE.md, MILESTONES.md]
tech_stack:
  added: []
  patterns: [pure-reader-rebuild, zero-emission-invariant]
key_files:
  created:
    - grid/test/norms/norm-startup-rebuild.test.ts
  modified:
    - grid/test/relationships/allowlist-frozen.test.ts
    - .planning/ROADMAP.md
    - .planning/STATE.md
    - .planning/MILESTONES.md
decisions:
  - rebuildFromChain confirmed as pure reader via chain-length delta assertion
  - allowlist-frozen baseline updated from 39 to 41 to reflect Phase 19 norm events
metrics:
  duration: "~15 minutes"
  completed: "2026-05-16"
---

# Phase 19 Plan 05: Startup Rebuild Integration Test + Doc-Sync Summary

**One-liner:** Startup rebuild integration test confirms `rebuildFromChain` is a zero-emission pure reader; Phase 19 complete with allowlist at 41.

## What Was Done

### Task 1: Startup Rebuild Integration Test

Created `grid/test/norms/norm-startup-rebuild.test.ts` with two tests:

1. **`produces same candidateMap observable as live accumulation`** — Drives a chain with `nous.self_model_revised` events via a live NormDetector, then attaches a second NormDetector and calls `rebuildFromChain(0)`. Asserts that `chain.all().length` did NOT increase during rebuild — no `AuditChain.append` calls were made. This is the core invariant: rebuild is a pure read.

2. **`rebuildFromChain respects fromTick filter`** — Appends 3 events at tick 1 (below threshold of 10) and 1 event at tick 15. Calls `rebuildFromChain(10)`. Confirms tick-1 events are filtered out (only 1 DID contributed the tick-15 fingerprint, which stays below threshold — no candidate emission). A subsequent live event for the old fingerprint only adds 1 raw SMR entry, not a norm candidate, confirming the rebuild state correctly ignored the old events.

The implementation confirmed that `NormDetector.applyEntry` (private, used by `rebuildFromChain`) does NOT call any emitters — only `handleEntry` (the live path) calls `appendNormCandidate` / `appendNormCrystallized`. The zero-emission invariant holds by construction.

### Task 2: Full Test Suite Gate

**Grid:** 1539 tests passed, 6 skipped, 0 failed (180 test files).

One regression found and fixed: `grid/test/relationships/allowlist-frozen.test.ts` had a hardcoded assertion `ALLOWLIST.size === 39` — the Phase 19 norm events brought the allowlist to 41. Updated the test description and assertion to `41` with the Phase 19 provenance comment.

**Brain:** 682 tests passed, 0 failed (via `uv run pytest`).

### Task 3: Atomic Doc-Sync

**ROADMAP.md:**
- Phase 19 summary line marked `[x]` with `(completed 2026-05-16)`
- All 5 plan lines (19-01 through 19-05) marked `[x]`
- Completion note added: `Phase 19 completed 2026-05-16 with 5 plans (19-01 through 19-05). Allowlist at 41 events.`

**STATE.md:**
- `stopped_at`: updated to `"Phase 19 complete — allowlist at 41 — ready for /gsd-plan-phase 20"`
- `## Current Position`: Phase 20, Status: "Phase 19 shipped — ready for Phase 20 planning"
- Broadcast allowlist section header updated from "v2.3 end-state — 36 events" to "v2.4 Phase 19 end-state — 41 events"
- Entries 37-41 added to the numbered allowlist (skill.taught, skill.inferred, skill.rejected from Phase 18; norm.candidate, norm.crystallized from Phase 19)
- Phase 19 row in the v2.4 allowlist budget table marked `complete`
- Session continuity block updated: next action is `/gsd-plan-phase 20 (Lore Commons)`

**MILESTONES.md:**
- Phase 18 (Skill Diffusion) shipped entry added
- Phase 19 (Norm Crystallization) shipped entry added with full artifact list and invariant summary

## Test Results

| Suite | Files | Tests | Passed | Failed | Skipped |
|-------|-------|-------|--------|--------|---------|
| grid (vitest) | 180 | 1545 | 1539 | 0 | 6 |
| brain (pytest) | — | 682 | 682 | 0 | 0 |

## Commit

`c46556e` — `feat(19): startup rebuild test — phase 19 complete`

Files in commit:
- `grid/test/norms/norm-startup-rebuild.test.ts` (new)
- `grid/test/relationships/allowlist-frozen.test.ts` (baseline 39→41)
- `.planning/ROADMAP.md` (Phase 19 marked complete)
- `.planning/STATE.md` (allowlist at 41, position updated to Phase 20)
- `.planning/MILESTONES.md` (Phase 18 + 19 shipped entries)

## Deviations from Plan

**1. [Rule 1 - Bug] allowlist-frozen.test.ts had stale count of 39**
- **Found during:** Task 2 (full suite gate)
- **Issue:** `grid/test/relationships/allowlist-frozen.test.ts` asserted `ALLOWLIST.size === 39` but Phase 19 norm events (norm.candidate, norm.crystallized) brought the count to 41. This was an expected update — the test is the freeze-point assertion and must be updated each time new events are admitted.
- **Fix:** Updated assertion to `toBe(41)` and added Phase 19 provenance comment in the test description.
- **Files modified:** `grid/test/relationships/allowlist-frozen.test.ts`
- **Commit:** `c46556e`

**2. stubRelationships pattern not used**
- The plan suggested `const stubRelationships = { getEdge: ... } as unknown as RelationshipListener` but the existing norm-detector.test.ts pattern uses a real `RelationshipListener` instance. Followed the established pattern for consistency with the test suite.

## Self-Check: PASSED

- `grid/test/norms/norm-startup-rebuild.test.ts` exists and passes (2/2 tests)
- `grid/test/relationships/allowlist-frozen.test.ts` passes (4/4 tests)
- Commit `c46556e` exists in git log
- ROADMAP.md Phase 19 marked `[x]`
- STATE.md allowlist has entries 40-41 (norm.candidate, norm.crystallized)
