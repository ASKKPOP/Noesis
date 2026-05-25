---
phase: 34-steward-system-health-surfaces
plan: 01
subsystem: diagnostics
tags: [grid, health-detailed, vitest, contract-test, phase-32-extension]

# Dependency graph
requires:
  - phase: 32-firehose-observability
    provides: HealthDetailedPayload interface + computeStatus() reasons[] + /health/detailed route handler (D-32-C1/C2/C3)
provides:
  - HealthDetailedPayload.reasons: readonly string[] (additive extension to D-32-C3 frozen contract)
  - 6-key payload shape locked by vitest contract test (audit, clock, firehose, reasons, status, timestamp)
  - persist_error_with_divergence AND-gate predicate test (new — pins computeStatus lines 119-125)
affects: [34-02-PLAN.md use-health-detailed hook consumes payload.reasons, 34-03-PLAN.md Audit Pipeline Health card renders reasons sub-line]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive interface extension to a frozen contract: insert new field, propagate single-line in return literal, extend contract test"

key-files:
  created: []
  modified:
    - grid/src/diagnostics/health-watchdog.ts
    - grid/test/health-detailed-route.test.ts

key-decisions:
  - "Insert reasons field BETWEEN status and timestamp in HealthDetailedPayload (alphabetical-stable + matches snapshot return order)"
  - "persist_error_with_divergence test pins the AND-gate predicate (divergence>0 AND lastPersistError set) by asserting the NOT-triggered branch — the fake-reconcile harness cannot synthesize divergence>0 directly because inMemoryLength derives from persistedMaxId in the Phase 32 minimum"

patterns-established:
  - "Frozen-contract additive extension: new readonly field declared in interface → propagated via single-line addition in return literal → locked by Object.keys().sort() exact-match test"

requirements-completed:
  - OBS-11
  - OBS-12

# Metrics
duration: 5min
completed: 2026-05-25
---

# Phase 34 Plan 01: Extend /health/detailed with reasons[] Summary

**HealthDetailedPayload extended additively with `readonly reasons: readonly string[]` so Steward /system cards can render WHY status is degraded without re-deriving the predicate client-side (D-34-B1).**

## Performance

- **Duration:** ~5 min (orchestrator-completed after subagent stopped mid-edit on test file)
- **Started:** 2026-05-25T18:14:00Z (subagent dispatched)
- **Completed:** 2026-05-25T18:19:29Z
- **Tasks:** 1 (single-task plan)
- **Files modified:** 2

## Accomplishments

- HealthDetailedPayload interface extended additively with `readonly reasons: readonly string[]` field
- snapshot() return literal propagates the existing `reasons` variable (already destructured from computeStatus at line 243)
- Contract test extended from 5-key shape to 6-key shape (`['audit', 'clock', 'firehose', 'reasons', 'status', 'timestamp']`)
- Three existing tests gained reasons-array assertions: ok→[], cold-start grace→['grace_period'], stale-reconcile→contains 'reconcile_stale'
- New test case added: persist_error_with_divergence AND-gate predicate (pins computeStatus lines 119-125)
- All 7 tests pass; `npx tsc --noEmit` clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend HealthDetailedPayload + propagate reasons + extend contract test** - `5c1f791` (feat)

## Files Created/Modified

- `grid/src/diagnostics/health-watchdog.ts` — Interface extension + single-line return-literal addition
- `grid/test/health-detailed-route.test.ts` — Top-level keys assertion updated + 3 reasons-array assertions added + 1 new persist_error_with_divergence test case (32 insertions, 3 deletions)

## Decisions Made

None — followed Plan 34-01 Steps 1-6 exactly. Test edits were completed by the dispatched subagent before it stopped; orchestrator finished Steps 1-2 (source-file changes), ran tests + tsc + acceptance grep, and committed atomically.

## Deviations from Plan

None — plan executed exactly as written. The dispatched subagent (a10b3feae3eebbaf7) returned mid-edit with the test file modified but uncommitted; orchestrator finished the source-file edits inline in the same worktree and committed atomically. No scope expansion, no additional files touched.

## Issues Encountered

- Subagent returned a completion signal with the message "(No browser preview needed — continuing with test file edits.)" while the test-file Edit was still in-flight and the source file untouched. Orchestrator (this agent) ran spot-checks (no SUMMARY.md, only 1 uncommitted test-file edit, source file unmodified) and finished the plan inline in the worktree. Future improvement: a more robust completion-signal contract or a fresh-agent resume pattern would prevent the orchestrator from having to complete work inline.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 34-02 use-health-detailed.ts hook can now safely consume `payload.reasons` (6-key shape locked by contract test)
- Plan 34-03 Audit Pipeline Health card reasons sub-line predicate `auditReasons.length > 0` works against the shipped contract
- Plan 34-04 firehose watchdog predicate uses the same payload (no new fields needed for OBS-14)
- Phase 32 frozen contracts (HEALTH_THRESHOLDS, computeStatus body, FirehoseStats, chain.ts zero-diff, /health/detailed route handler) all verified untouched via git diff + grep acceptance checks

---
*Phase: 34-steward-system-health-surfaces*
*Completed: 2026-05-25*
