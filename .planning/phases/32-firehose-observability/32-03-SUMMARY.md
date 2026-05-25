---
phase: 32
plan: 03
subsystem: grid/diagnostics
tags: [observability, health-watchdog, pure-pull, OBS-07]
requirements: [OBS-07]

dependency_graph:
  requires:
    - Plan 01 (FirehoseStats interface from grid/src/audit/firehose-hub.ts)
    - Phase 31 AuditReconcile getters (lastReconcileAt, persistedMaxId, lastPersistError)
  provides:
    - HealthWatchdog class (pure-pull snapshot computer, no timer)
    - HEALTH_THRESHOLDS frozen const (four locked threshold values)
    - computeStatus pure helper (grace → critical → degraded → ok evaluation)
    - HealthDetailedPayload interface (frozen cross-phase API contract)
    - ClockSnapshot local interface (tick + running fields consumed at snapshot time)
  affects:
    - Plan 04 /health/detailed route handler (consumes HealthWatchdog.snapshot())
    - Phase 34 Steward /system cards (reads HealthDetailedPayload via /health/detailed)

tech_stack:
  added: []
  patterns:
    - Pure-pull design — snapshot() invoked per request, zero timer/subscription overhead
    - Injectable now() + snapshotCadenceMs opts for deterministic testing without fake timers
    - Pino child logger with try/finally restoreAllMocks spy pattern (mirrors Phase 31)
    - attachFirehoseStats() idempotent one-shot setter (mirrors Phase 9 attachRelationshipStorage)
    - All-zeros firehose sentinel before attach (distinguishable from wired state)
    - Cold-start grace: tick < 60 gates staleness checks

key_files:
  created:
    - grid/src/diagnostics/health-watchdog.ts
    - grid/test/health-watchdog-transitions.test.ts

decisions:
  - "ClockSnapshot local interface defined (tick + running) — ClockState from clock/types.ts lacks 'running' field (WorldClock exposes it as a getter, not in ClockState); local interface avoids importing the wrong type"
  - "computeStatus exported (not private helper) — tests call it directly for threshold matrix verification without needing a full HealthWatchdog instance"
  - "Comment text avoids 'setInterval'/'onTick' keywords — acceptance criteria requires grep to return zero matches; explanatory text rephrased to 'no timer / no clock subscription'"

metrics:
  duration: ~25 minutes
  completed: "2026-05-25T00:22:50Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 0
  files_created: 2
---

# Phase 32 Plan 03: HealthWatchdog Pure-Pull Snapshot Computer Summary

Pure-pull `HealthWatchdog` class at `grid/src/diagnostics/health-watchdog.ts` with frozen HEALTH_THRESHOLDS, pure `computeStatus` helper, and full `HealthDetailedPayload` interface — 16 tests green covering threshold matrix, cold-start grace, state-transition logging, and idempotent attach.

## What Was Built

**`grid/src/diagnostics/health-watchdog.ts` — created (289 lines)**

New directory `grid/src/diagnostics/` created.

Exports:
- `HEALTH_THRESHOLDS` — `Object.freeze({ DIVERGENCE_DEGRADED: 10, DIVERGENCE_CRITICAL: 100, STALE_FRAME_MS: 60_000, RECONCILE_STALE_MULTIPLIER: 5 } as const)` — locked policy values, not deployment-tunable.
- `HealthStatus` — `'ok' | 'degraded' | 'critical'`
- `ClockSnapshot` — local interface `{ tick: number; running: boolean }` (HealthWatchdog reads only these two fields from the clock).
- `HealthDetailedPayload` — frozen cross-phase API contract consumed by Plan 04 and Phase 34.
- `computeStatus(input: ComputeStatusInput): ComputeStatusResult` — pure helper, evaluation order: grace → critical → degraded → ok. Reasons array surfaces which conditions triggered (used in transition log; not exposed in route payload).
- `HealthWatchdog` class — pure-pull, no timer, no clock subscription.

`HealthWatchdog` design:
- Constructor: `deps: { auditReconcile: AuditReconcile | undefined; clockState: () => ClockSnapshot }`, `opts?: { now?: () => number; snapshotCadenceMs?: number }`.
- `attachFirehoseStats(fn: () => FirehoseStats)`: idempotent one-shot; throws on second call.
- `snapshot()`: reads deps at call time, computes status, fires state-transition log if status changed, returns `HealthDetailedPayload`.
- Cold-start grace: `clock.tick < 60` returns `status: 'ok'` with `audit.divergence: null`, `audit.last_persist_attempt_at: null`.
- Logging: `logger.warn` on degrade, `logger.info` on recovery, silent on consecutive same-status.
- Firehose sentinel: all-zeros before `attachFirehoseStats` wired.

**`grid/test/health-watchdog-transitions.test.ts` — created (306 lines, 16 tests)**

Test coverage:
1. HEALTH_THRESHOLDS locked values (4 assertions via symbolic reference + Object.isFrozen check).
2. `computeStatus`: grace overrides all other inputs; divergence > 100 → critical; persistError + divergence > 0 → critical; divergence > 10 → degraded; clients with no frames → degraded; stale frames → degraded; reconcile stale → degraded; all-clean → ok.
3. Cold-start grace: tick=5 returns ok with null timestamps.
4. ok→degraded transition: `logger.warn` fires exactly once with `event: 'health_status_changed'`.
5. degraded→ok recovery: `logger.info` fires (not warn) with correct payload.
6. Consecutive ok→ok: neither warn nor info called.
7. `attachFirehoseStats` throws on second call.
8. All-zeros firehose sentinel before attach.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ClockSnapshot local interface instead of importing ClockState**

- **Found during:** Task 1 (typecheck)
- **Issue:** The plan's code imports `ClockState` from `../clock/ticker.js`, but `ClockState` is defined in `grid/src/clock/types.ts` (not re-exported from `ticker.ts`). More critically, `ClockState` does not have a `running` field — `running` is a getter on `WorldClock` class directly. The plan's `snapshot()` uses `clock.running`, so importing `ClockState` would cause a type error.
- **Fix:** Defined a local `ClockSnapshot` interface (`{ tick: number; running: boolean }`) and changed `deps.clockState` to return `ClockSnapshot`. This satisfies structural typing — callers pass `() => ({ tick: clock.tick, running: clock.running })` at the construction site (Plan 04). Tests pass `() => ({ tick: 200, running: true })` directly.
- **Files modified:** `grid/src/diagnostics/health-watchdog.ts`
- **Commit:** 6c14b6c

**2. [Rule 1 - Bug] Comment text avoids literal 'setInterval'/'onTick' keywords**

- **Found during:** Task 1 (acceptance criteria verification)
- **Issue:** Plan acceptance criteria requires `grep -c "setInterval" grid/src/diagnostics/health-watchdog.ts` to return `0`. The original plan comment text contained these keywords in the docblock explanation ("no setInterval, no clock.onTick subscription"). Grep matches comments too.
- **Fix:** Rephrased to "no timer, no clock subscription" and "interval lifecycle" — equivalent meaning, zero grep hits.
- **Files modified:** `grid/src/diagnostics/health-watchdog.ts`
- **Commit:** 6c14b6c

**3. [Rule 1 - Simplification] Test transition test restructured for clarity**

- **Found during:** Task 2 (test writing)
- **Issue:** The plan's degraded→ok recovery test had a multi-step structure that created intermediate `recovered` and `wd2` instances in a confusing sequence. The final working pattern uses a single `dynamicReconcile` object with a mutable `_t` field to simulate state change across two `snapshot()` calls on the same instance.
- **Fix:** Simplified to a clean two-snapshot pattern: snapshot 1 with `lastReconcileAt=1` (degraded), then mutate `dynamicReconcile._t = now - 1000`, snapshot 2 (ok). Same behavior, clearer intent.
- **Files modified:** `grid/test/health-watchdog-transitions.test.ts`
- **Commit:** 1f48ca0

## Verification Results

```
cd grid && npx tsc --noEmit                                                        ✓ (exit 0)
cd grid && npx vitest run test/health-watchdog-transitions.test.ts                 ✓ 16/16 pass
grep -c "setInterval\|onTick" grid/src/diagnostics/health-watchdog.ts             = 0 (pure-pull invariant)
grep -c "Object.freeze" grid/src/diagnostics/health-watchdog.ts                   = 1
grep -c "export const HEALTH_THRESHOLDS = Object.freeze" ...                       = 1
grep -c "export class HealthWatchdog" ...                                          = 1
grep -c "export function computeStatus" ...                                        = 1
grep -c "export interface HealthDetailedPayload" ...                               = 1
wc -l grid/src/diagnostics/health-watchdog.ts                                     = 289 (> 200 minimum)
```

## Cross-Phase Notes

- `HealthDetailedPayload` shape is **frozen as of this plan**. Plan 04 (`/health/detailed`) and Phase 34 (Steward `/system` cards) consume this contract. Additive changes only after Phase 32 ships.
- `ClockSnapshot` local interface is the correct abstraction — callers will wire `() => ({ tick: launcher.clock.currentTick, running: launcher.clock.running })` at construction in Plan 04.
- `attachFirehoseStats` idempotency rule matches `GenesisLauncher.attachFirehoseHub` pattern from D-32-E1 — both are one-shot setters that throw on re-call.

## Self-Check: PASSED

- FOUND: grid/src/diagnostics/health-watchdog.ts
- FOUND: grid/test/health-watchdog-transitions.test.ts
- FOUND: commit 6c14b6c (feat — Task 1)
- FOUND: commit 1f48ca0 (test — Task 2)
