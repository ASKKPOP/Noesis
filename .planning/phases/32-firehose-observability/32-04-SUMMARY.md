---
phase: 32
plan: 04
subsystem: grid/api + grid/genesis
tags: [observability, route, wiring, launcher, health-detailed, OBS-06, OBS-07]
requirements: [OBS-06, OBS-07]

dependency_graph:
  requires:
    - Plan 01 (WsFirehoseHub.stats() + FirehoseStats interface)
    - Plan 03 (HealthWatchdog class + HealthDetailedPayload interface)
    - Phase 31 AuditReconcile getters (lastReconcileAt, persistedMaxId, lastPersistError)
  provides:
    - GenesisLauncher Phase 32 surface (_healthWatchdog field, healthWatchdog getter, attachHealthWatchdog, attachFirehoseHub)
    - registerHealthDetailedRoute (GET /health/detailed, 503 guard, pure-pull)
    - GridServices.launcher structural type extended with Phase 32 optional fields
    - buildServerWithHub Phase 32 wiring block (locked construction order)
  affects:
    - grid/src/genesis/launcher.ts (modified — Phase 32 surface added)
    - grid/src/api/server.ts (modified — GridServices.launcher type + wiring block)
    - grid/src/api/routes/health-detailed.ts (new — route handler)
    - grid/test/health-detailed-route.test.ts (new — 6 integration tests)
    - Phase 34 Steward /system cards (reads HealthDetailedPayload via /health/detailed)

tech_stack:
  added: []
  patterns:
    - One-shot setter pattern with throw-on-second-call (mirrors attachRelationshipStorage)
    - Structural type inline import form for GridServices.launcher extension (avoids top-level imports)
    - Guard-based Phase 32 wiring block (services.launcher.attachHealthWatchdog function check)
    - Pure-pull route handler: one-liner returning watchdog.snapshot() with 503 Pitfall-4 guard
    - app.inject() for deterministic p95 in-process latency testing (no network round-trip)

key_files:
  modified:
    - grid/src/genesis/launcher.ts
    - grid/src/api/server.ts
  created:
    - grid/src/api/routes/health-detailed.ts
    - grid/test/health-detailed-route.test.ts

decisions:
  - "Option A for GridServices.launcher extension: all Phase 32 fields are optional on the structural type — existing tests that omit them compile and run unchanged"
  - "Wiring block uses cast to GenesisLauncher after guard check — avoids polluting GridServices interface with GenesisLauncher-specific methods while keeping type safety inside the block"
  - "clockState lambda uses launcher.clock.currentTick + launcher.clock.running (WorldClock getters) not launcher.clock.state (ClockState lacks 'running' field — Plan 03 deviation note carried forward)"
  - "Test closed-key-set assertion updated to include persisted_max_id (Plan 04 plan spec omitted it; HealthDetailedPayload.audit includes it per Plan 03 interface)"

metrics:
  duration: ~30 minutes
  completed: "2026-05-25T17:30:00Z"
  tasks_completed: 4
  tasks_total: 4
  files_modified: 2
  files_created: 2
---

# Phase 32 Plan 04: Integration Wiring — GenesisLauncher + /health/detailed Summary

GenesisLauncher Phase 32 surface (private fields, getter, two idempotent setters) landed; GridServices.launcher type extended backward-compatibly (Option A); GET /health/detailed registered top-level with 503 guard; HealthWatchdog wired inside buildServerWithHub in mandatory construction order; 6 integration tests green covering shape, p95, and T-32-01 information-disclosure leak guard.

## What Was Built

**`grid/src/genesis/launcher.ts` — modified**

Two new type imports added:
- `import type { HealthWatchdog } from '../diagnostics/health-watchdog.js'`
- `import type { FirehoseStats } from '../audit/firehose-hub.js'`

Two private fields added after `normStorage`:
- `private _healthWatchdog: HealthWatchdog | undefined` — one-shot-settable HealthWatchdog. NOT readonly (construction deferred to buildServerWithHub).
- `private _firehoseHub: { stats(): FirehoseStats } | undefined` — typed as structural interface to avoid genesis→audit import direction issue (Pitfall 1 RESEARCH.md).

Public getter added after `normStorageRef`:
- `get healthWatchdog(): HealthWatchdog | undefined` — returns undefined during narrow startup window before `attachHealthWatchdog` is called.

Two attach methods added:
- `attachHealthWatchdog(wd: HealthWatchdog): void` — throws `'GenesisLauncher.attachHealthWatchdog called twice'` on second call.
- `attachFirehoseHub(hub: { stats(): FirehoseStats }): void` — throws on second call; internally calls `this._healthWatchdog?.attachFirehoseStats(() => hub.stats())`.

**`grid/src/api/routes/health-detailed.ts` — created (34 lines)**

New route file:
- `registerHealthDetailedRoute(app, _services, launcher)` — one-liner route handler.
- `app.get('/health/detailed', ...)` — returns `launcher.healthWatchdog.snapshot()` when wired; returns `{ error: 'watchdog_not_ready' }` with 503 when watchdog absent (Pitfall 4 guard).
- Zero audit emissions. Pure-pull — no DB I/O.

**`grid/src/api/server.ts` — modified**

Two imports added near route registration imports:
- `import { HealthWatchdog } from '../diagnostics/health-watchdog.js'`
- `import { registerHealthDetailedRoute } from './routes/health-detailed.js'`

`GridServices.launcher` structural type extended (Phase 28 original field preserved; Phase 32 fields all optional):
- `readonly healthWatchdog?: HealthWatchdog | undefined`
- `readonly auditReconcile?: AuditReconcile | undefined`
- `readonly clock?: { readonly currentTick: number; readonly running: boolean }`
- `attachHealthWatchdog?(wd: HealthWatchdog): void`
- `attachFirehoseHub?(hub: { stats(): FirehoseStats }): void`

Phase 32 wiring block inserted after `services.driftDetector = driftDetector` and before `registerDriftAlertsRoute` (line ~586 area):
- Guard: `services.launcher && typeof attachHealthWatchdog === 'function' && typeof attachFirehoseHub === 'function' && clock !== undefined`
- Construction order: `new HealthWatchdog` → `attachHealthWatchdog` → `attachFirehoseHub` → `registerHealthDetailedRoute`
- `clockState` lambda: `() => ({ tick: launcher.clock.currentTick, running: launcher.clock.running })` (uses WorldClock getters directly)
- `registerHealthDetailedRoute` placed at top level — NOT inside `app.register(async (instance) =>` WS scope
- Existing `/health` route at line 284 untouched

**`grid/test/health-detailed-route.test.ts` — created (230 lines, 6 tests)**

6 integration test cases (all pass GREEN):
1. 503 `watchdog_not_ready` when `attachWatchdog: false`.
2. Cold-start grace shape completeness — exactly 5 top-level keys `['audit', 'clock', 'firehose', 'status', 'timestamp']`, status='ok', audit timestamps null, clock.tick=5.
3. Healthy steady-state (tick>=60, recent reconcile) — status='ok', persisted_max_id=50, divergence=0.
4. Degraded when reconcile stale beyond multiplier (6×snapshotCadenceMs+1ms stale).
5. T-32-01 leak guard — audit block closed key set (`['divergence', 'divergence_threshold', 'in_memory_length', 'last_persist_attempt_at', 'last_persist_error', 'persisted_max_id']`); `last_persist_error` ONLY `{code, at}` — no `message`, no `stack`.
6. p95 latency over 100 sequential inject calls < 100ms (CI headroom; OBS-06 target 50ms).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test closed-key-set assertion missing `persisted_max_id`**

- **Found during:** Task 4 (first test run)
- **Issue:** The plan's test template listed only 5 keys in the audit block closed-key-set assertion (`['divergence', 'divergence_threshold', 'in_memory_length', 'last_persist_attempt_at', 'last_persist_error']`). The actual `HealthDetailedPayload.audit` interface (Plan 03 output) includes a 6th field: `persisted_max_id`. Test failed with `expected [...5 keys] to deeply equal [...6 keys including persisted_max_id]`.
- **Fix:** Added `'persisted_max_id'` to the expected key array in the closed-key-set test.
- **Files modified:** `grid/test/health-detailed-route.test.ts`
- **Commit:** 42f0ea8

**2. [Rule 1 - Bug] ClockState lacks `running` field — clockState lambda uses WorldClock getters directly**

- **Found during:** Task 3 (structural type definition)
- **Issue:** Plan specified `readonly clock?: { state: import('../clock/ticker.js').ClockState }` in GridServices.launcher. `ClockState` is defined in `clock/types.ts` (not re-exported from ticker.ts) and does NOT include a `running` field. The wiring block needs `running` for `ClockSnapshot`.
- **Fix:** Structural type uses `{ readonly currentTick: number; readonly running: boolean }` (matching WorldClock's getters). Wiring lambda: `() => ({ tick: launcher.clock.currentTick, running: launcher.clock.running })`. This exactly matches what Plan 03 SUMMARY noted: "callers will wire `() => ({ tick: launcher.clock.currentTick, running: launcher.clock.running })` at construction in Plan 04."
- **Files modified:** `grid/src/api/server.ts`
- **Commit:** d9d93e0

### Out-of-scope pre-existing failures

One test in `ws-integration.test.ts` (`GRID_WS_SECRET env gates the upgrade`) was already failing on the base commit before Plan 04 changes. Confirmed via `git stash` + rerun. Not caused by this plan. Logged to deferred items — out of scope per deviation rules.

## Verification Results

```
cd grid && npx tsc --noEmit                                              ✓ (exit 0)
cd grid && npx vitest run test/health-detailed-route.test.ts             ✓ 6/6 pass
cd grid && npx vitest run test/audit-reconcile.test.ts ...               ✓ 13/13 pass
grep -c "private _healthWatchdog: HealthWatchdog | undefined;" ...       = 1
grep -c "attachHealthWatchdog(wd: HealthWatchdog): void" ...             = 1
grep -c "attachFirehoseHub(hub:" src/genesis/launcher.ts                 = 1
grep -c "get healthWatchdog(): HealthWatchdog | undefined" ...           = 1
grep -c "GenesisLauncher.attachHealthWatchdog called twice" ...          = 1
grep -c "this._healthWatchdog?.attachFirehoseStats(() => hub.stats())"   = 1
grep -c "import { HealthWatchdog } from '../diagnostics/health-watchdog.js';" src/api/server.ts = 1
grep -c "registerHealthDetailedRoute(app, services" src/api/server.ts   = 1
/health route: app.get('/health', async () => { return { status: 'ok', timestamp: Date.now() }; }) UNCHANGED
registerHealthDetailedRoute line 608 < app.register(WS scope) line 622  ORDER OK
```

## Threat Model Coverage

| Threat | Mitigation Status |
|--------|------------------|
| T-32-01 Information Disclosure | Test 5 pins audit block to 6-key closed set; `last_persist_error` limited to `{code, at}` — no message/stack |
| T-32-02 Denial of Service | Route is one-liner O(1) pure-pull; p95 test asserts <100ms over 100 calls in-process |
| T-32-03 Tampering (construction order) | attachHealthWatchdog before attachFirehoseHub enforced in wiring block; both throw on second call |

## Cross-Phase Notes

- `/health/detailed` HTTP surface is now live at top level of `buildServerWithHub`.
- The existing `/health` Docker healthcheck route at server.ts:284 is unchanged — returns `{ status: 'ok', timestamp: Date.now() }` with no payload inspection.
- Phase 34 Steward `/system` cards consume this endpoint via `GET /health/detailed` → `HealthDetailedPayload`.
- `GenesisLauncher.attachFirehoseHub` wires `healthWatchdog.attachFirehoseStats` — Plan 01 `WsFirehoseHub.stats()` is now the live firehose metrics source for the route.

## Self-Check: PASSED

- FOUND: grid/src/genesis/launcher.ts
- FOUND: grid/src/api/routes/health-detailed.ts
- FOUND: grid/src/api/server.ts
- FOUND: grid/test/health-detailed-route.test.ts
- FOUND: commit d3a4d5e (feat — Task 1, GenesisLauncher surface)
- FOUND: commit dd69037 (feat — Task 2, health-detailed.ts route)
- FOUND: commit d9d93e0 (feat — Task 3, server.ts wiring)
- FOUND: commit 42f0ea8 (test — Task 4, integration tests)
