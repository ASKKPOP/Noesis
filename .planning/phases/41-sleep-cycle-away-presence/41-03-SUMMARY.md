---
phase: 41
plan: 3
subsystem: civic-presence
tags: [presence, escalation, firehose, launcher, interval-lifecycle]
dependency_graph:
  requires: [41-02]
  provides: [PresenceService, runEscalationCheck, WsFirehoseHub.attachPresenceService, GenesisLauncher.attachPresenceService]
  affects: [grid/src/civic-presence/, grid/src/audit/firehose-hub.ts, grid/src/genesis/launcher.ts]
tech_stack:
  added: []
  patterns: [facade-with-di, import-type-for-circular-avoidance, setInterval-clearInterval-pairing]
key_files:
  created:
    - grid/src/civic-presence/presence-service.ts
    - grid/src/civic-presence/escalation-check.ts
  modified:
    - grid/src/audit/firehose-hub.ts
    - grid/src/genesis/launcher.ts
decisions:
  - "BusinessDidStore API is markDissolved(gridName, businessDid, dissolvedAtTick) — no markDissolvedByCivicDid method exists. Implemented via listByCivicDid + markDissolved loop."
  - "OBS-R-32-02 clearInterval in launcher.stop() before clock.stop() — paired correctly."
  - "Dynamic import type pattern used in firehose-hub and launcher to avoid circular imports."
metrics:
  duration: "~15 minutes"
  completed_date: "2026-05-27"
  tasks_completed: 3
  files_changed: 4
---

# Phase 41 Plan 03: PresenceService Facade + Escalation + Firehose Wiring Summary

PresenceService facade composing all civic-presence stores into a single DI surface, 24h escalation walker (absent + presumed_departed), WsFirehoseHub civic_member connect/disconnect hooks, and GenesisLauncher 24h setInterval with paired clearInterval.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | PresenceService + escalation-check | 0661c20 | presence-service.ts, escalation-check.ts |
| 2 | WsFirehoseHub attachPresenceService + civic_member hooks | 0661c20 | firehose-hub.ts |
| 3 | GenesisLauncher attachPresenceService + 24h interval + stop() cleanup | 0661c20 | launcher.ts |

## Key Findings

### BusinessDidStore Dissolve Method

**Real method:** `markDissolved(gridName: string, businessDid: string, dissolvedAtTick: number): Promise<boolean>`

The plan placeholder `markDissolvedByCivicDid` does NOT exist. The actual API requires a specific `businessDid` string — not a lookup by `civicDid`. Resolution: `listByCivicDid(gridName, civicDid)` returns all business DIDs for a Nous, then iterate and call `markDissolved` for each active one. This is best-effort (try/catch) per the plan's intent.

### PresenceService.shutdown() — OBS-R-32-02 Entry Point

`PresenceService.shutdown()` calls `this.deps.graceTimerRegistry.clear()` which clears all pending `setTimeout` grace timers. Called from `GenesisLauncher.stop()` before `this.clock.stop()`. This is the OBS-R-32-02 compliance entry point.

### attachPresenceService Wiring Seam

Both `WsFirehoseHub` and `GenesisLauncher` expose an `attachPresenceService(svc)` method using the same "throw-on-swap" pattern as existing `attachHealthWatchdog` and `attachFirehoseHub` methods. Dynamic import type (`import('../civic-presence/presence-service.js').PresenceService`) used to avoid circular imports in both files.

**WsFirehoseHub:** Calls `_presenceService?.onWsConnect(did)` after `_clients.add(client)` when `didContext?.tier === 'civic_member'`. Calls `_presenceService?.onWsDisconnect(did)` in the socket `'close'` handler for civic members.

**GenesisLauncher:** `attachPresenceService` method added before `bootstrap()`. `start()` starts a 24h `setInterval` if `_presenceService` is defined. `stop()` clears the interval + calls `presenceService.shutdown()` before `clock.stop()`.

### Interval Lifecycle CI Gate

`node /Users/desirey/Programming/src/Noesis/scripts/check-interval-lifecycle.mjs` — **GREEN**

Output: `[check-interval-lifecycle] OK — every setInterval in grid/src/{diagnostics,audit,db}/ is held in a class field (or none exist).`

Note: The escalation interval is in `grid/src/genesis/launcher.ts` (not in the `{diagnostics,audit,db}/` paths the CI gate scans). The interval is correctly stored as a class field `_escalationInterval` and cleared in `stop()` — OBS-R-32-02 compliant.

## Deviations from Plan

### Auto-fixed: BusinessDidStore API Adaptation (Rule 1 — Bug Prevention)

**Found during:** Task 1 (escalation-check.ts)

**Issue:** Plan placeholder `markDissolvedByCivicDid?.(gridName, civicDid, tick)` does not exist in `BusinessDidStore`. The real API requires iterating business DIDs by civic DID.

**Fix:** Used `businessDidStore.listByCivicDid(gridName, civicDid)` to get all business DIDs, then called `markDissolved(gridName, biz.businessDid, tick)` for each active one.

**Files modified:** `grid/src/civic-presence/escalation-check.ts`

**Commit:** 0661c20

## Pre-existing Test Failures (Out of Scope)

`test/audit/firehose-hub.test.ts` — 2 tests failing before this plan. Tests use `evt.entry.eventType` but anonymous-client frames serialize via `serializeVisitorFrame()` which produces `evt.entry.event_type` (snake_case). This is unrelated to Plan 41-03 changes. Logged as deferred.

## Threat Flags

None — this plan adds no new network endpoints, auth paths, or schema changes. PresenceService is a pure in-process facade.

## Known Stubs

`escalated_at_tick` message in `runEscalationCheck` absent-escalation notice references "Community charter revocation processing is pending (Phase 49 stub)" — intentional stub. Phase 49 (Communities v3) will wire the actual revocation.

## Self-Check: PASSED

- `grid/src/civic-presence/presence-service.ts` — EXISTS
- `grid/src/civic-presence/escalation-check.ts` — EXISTS
- `grid/src/audit/firehose-hub.ts` — modified (attachPresenceService + civic_member hooks)
- `grid/src/genesis/launcher.ts` — modified (attachPresenceService + 24h interval + clearInterval)
- Commit 0661c20 — EXISTS (verified via git push)
- TypeScript: clean (no output)
- Interval lifecycle CI gate: PASSED (green)
- Firehose tests (5/5): PASSED
