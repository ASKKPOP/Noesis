---
phase: 25a
plan: "02"
subsystem: grid/audit, grid/api/routes, grid/api/server
tags: [firehose, drift-detector, websocket, allowlist-monitor, ring-buffer, observer-only]
requires:
  - 25a-01 (RingBuffer.peek(), broadcast-allowlist isAllowlisted)
provides:
  - WsFirehoseHub: unfiltered AuditChain→WebSocket fan-out (allowlist gate only)
  - DriftDetector: runtime non-allowlisted event monitor with ring buffer snapshot
  - GET /api/v1/audit/firehose (WebSocket route)
  - GET /api/v1/audit/drift-alerts (REST route)
affects:
  - Plans 25a-04 through 25a-06 (Steward firehose page consumes WS endpoint)
tech-stack:
  added: []
  patterns:
    - AuditChain.onAppend observer pattern (single subscription, try/catch defense-in-depth)
    - RingBuffer<T> backpressure with drop-oldest eviction
    - Two-phase WebSocket close (Bye frame + setImmediate yield before socket.close)
    - ServerSocket adapter imported from ws-hub.ts (not redeclared)
    - fastify-websocket plugin scope registration (Pitfall 5 compliance)
key-files:
  created:
    - grid/src/audit/firehose-hub.ts
    - grid/src/audit/drift-detector.ts
    - grid/src/api/routes/audit-firehose.ts
    - grid/src/api/routes/audit-drift-alerts.ts
    - grid/test/audit/firehose-hub.test.ts
    - grid/test/audit/drift-detector.test.ts
    - grid/test/api/audit-firehose.test.ts
    - grid/test/api/drift-alerts.test.ts
  modified:
    - grid/src/api/server.ts (GridServices interface, buildServerWithHub, preClose hook)
decisions:
  - "D-25a-14: WsFirehoseHub is density-first — no sinceId replay, no DroppedFrame protocol, no per-client filters"
  - "D-25a-16: DriftDetector is observer-only — zero audit.append() calls, NEVER recursive"
  - "D-25a-17: Ring buffer capacity 256 for both WsFirehoseHub ClientConnection and DriftDetector"
  - "ServerSocket imported from ws-hub.ts rather than redeclared — reuse not duplication"
  - "GRID_WS_SECRET gate cloned verbatim from /ws/events handler for consistent auth posture"
metrics:
  duration: "~12 minutes"
  completed: "2026-05-21"
  tasks_completed: 2
  tasks_total: 2
  files_created: 8
  files_modified: 1
---

# Phase 25a Plan 02: Firehose and Drift Summary

**One-liner:** WsFirehoseHub (unfiltered AuditChain→WebSocket fan-out) + DriftDetector (runtime allowlist monitor) + two Grid routes wired with GRID_WS_SECRET gate and preClose lifecycle.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 (RED) | Failing tests for WsFirehoseHub + DriftDetector | c9979c1 | test/audit/firehose-hub.test.ts, test/audit/drift-detector.test.ts |
| 1 (GREEN) | Implement WsFirehoseHub and DriftDetector | 24b0a9d | grid/src/audit/firehose-hub.ts, grid/src/audit/drift-detector.ts |
| 2 (RED) | Failing integration tests for routes | d285910 | test/api/audit-firehose.test.ts, test/api/drift-alerts.test.ts |
| 2 (GREEN) | Wire routes + services into server.ts | 3d336d0 | audit-firehose.ts, audit-drift-alerts.ts, server.ts |

## Public APIs

### WsFirehoseHub (`grid/src/audit/firehose-hub.ts`)

```typescript
export class WsFirehoseHub {
    constructor(audit: AuditChain, gridName: string, bufferCapacity?: number, watermarkBytes?: number);
    onConnect(socket: ServerSocket): void;   // sends HelloFrame, wires close/error
    close(): Promise<void>;                  // two-phase: Bye + setImmediate + socket.close()
    get clientCount(): number;
}
```

**Behavior:** Subscribes once to `audit.onAppend`. On each allowlisted entry, fans out `{type:'event', entry}` to all connected clients. Non-allowlisted entries are dropped at the `isAllowlisted()` gate. Each client gets a `ClientConnection` with `RingBuffer<AuditEntry>(256)` for backpressure — oldest dropped on overflow. HelloFrame shape: `{type:'hello', serverTime, gridName}` (no `lastEntryId` — density-first design).

### DriftDetector (`grid/src/audit/drift-detector.ts`)

```typescript
export interface DriftAlert {
    event_type: string;
    actor_did: string;
    tick: number;       // from entry.payload.tick; fallback 0 if absent/non-numeric
    detected_at: number; // entry.createdAt (Unix ms)
}

export class DriftDetector {
    constructor(audit: AuditChain, capacity?: number);  // default 256
    snapshot(): readonly DriftAlert[];                   // non-destructive peek()
    close(): void;                                       // unsubscribes, idempotent
}
```

**Behavior:** Subscribes once to `audit.onAppend`. For each non-allowlisted entry, pushes a `DriftAlert` to the ring buffer. Allowlisted entries are silently skipped. `snapshot()` uses `RingBuffer.peek()` — idempotent, non-destructive. Observer-only: zero `audit.append()` calls.

### Route Paths

| Route | Type | Handler |
|-------|------|---------|
| `GET /api/v1/audit/firehose` | WebSocket | `registerAuditFirehoseRoute` (inside fastify-websocket scope) |
| `GET /api/v1/audit/drift-alerts` | REST GET | `registerDriftAlertsRoute` (top-level, no WS scope) |

### server.ts Wiring

**GridServices fields added:**
```typescript
firehoseHub?: WsFirehoseHub;   // Phase 25a OBS-FIREHOSE
driftDetector?: DriftDetector; // Phase 25a OBS-ALLOWLIST-MONITOR
```

**buildServerWithHub changes:**
1. Constructs `firehoseHub = new WsFirehoseHub(services.audit, services.gridName)` after `wsHub`
2. Constructs `driftDetector = new DriftDetector(services.audit)` after firehoseHub
3. Assigns both to `services` object for route handler access
4. `registerAuditFirehoseRoute(instance, firehoseHub)` called inside fastify-websocket plugin scope (Pitfall 5)
5. `registerDriftAlertsRoute(app, services)` called at top-level
6. preClose hook extended: `await firehoseHub.close(); driftDetector.close();`
7. Return type extended: `{ app, wsHub, firehoseHub, driftDetector }`

## Decision IDs Implemented

- **D-25a-14** (firehose density-first): No sinceId replay, no DroppedFrame protocol, no per-client filters. WsFirehoseHub is pure fan-out of allowlisted events to all connected clients.
- **D-25a-16** (drift detector observer-only): DriftDetector has zero `audit.append()` calls. Purely passive — reads from `onAppend`, writes only to its own ring buffer. No recursive risk.
- **D-25a-17** (ring buffer 256 default): Both WsFirehoseHub ClientConnection and DriftDetector use capacity 256 as the default. Drop-oldest eviction on overflow.

## Confirmed: Zero New Audit Events

Neither `WsFirehoseHub` nor `DriftDetector` calls `audit.append()`. Both are pure observers. Grep evidence:

```
grep -n "\.append(" grid/src/audit/firehose-hub.ts grid/src/audit/drift-detector.ts
# → No output (zero matches)
```

## Test Coverage

| File | Tests | Result |
|------|-------|--------|
| test/audit/firehose-hub.test.ts | 7 unit tests | PASS |
| test/audit/drift-detector.test.ts | 8 unit tests | PASS |
| test/api/audit-firehose.test.ts | 5 integration tests | PASS |
| test/api/drift-alerts.test.ts | 3 integration tests | PASS |
| **Total** | **23 tests** | **23/23 PASS** |

## Deviations from Plan

### Pre-existing test failures (not caused by this plan)

Multiple test files show "The server is not running" WebSocket teardown errors — pre-existing before this plan's commits. Verified via `git stash`: `test/api.test.ts`, `test/ws-integration.test.ts > GRID_WS_SECRET env gates the upgrade`, and related files all show the same error against the stashed (pre-plan-02) codebase. These are out of scope per CLAUDE.md Rule 3 boundary guidance.

Otherwise: plan executed exactly as written.

## Known Stubs

None — both services are fully wired to live AuditChain data. No UI or placeholder data.

## Threat Flags

All new threat surfaces are covered by the plan's `<threat_model>` (T-25a-02-01 through T-25a-02-07). No additional unplanned surfaces.

| Mitigation | Status |
|------------|--------|
| T-25a-02-01: GRID_WS_SECRET gate on firehose WS | Implemented (cloned from /ws/events verbatim) |
| T-25a-02-02: isAllowlisted() gate before fan-out | Implemented in WsFirehoseHub.onAuditEvent() |
| T-25a-02-03: DriftDetector listener wrapped in try/catch | Implemented |
| T-25a-02-04: ClientConnection RingBuffer capacity 256 | Implemented (drop-oldest) |
| T-25a-02-06: DriftDetector never calls audit.append() | Confirmed by grep |

## Self-Check: PASSED

All created files present on disk:
- FOUND: grid/src/audit/firehose-hub.ts
- FOUND: grid/src/audit/drift-detector.ts
- FOUND: grid/src/api/routes/audit-firehose.ts
- FOUND: grid/src/api/routes/audit-drift-alerts.ts

All task commits verified in git log:
- c9979c1 (RED: failing tests task 1)
- 24b0a9d (GREEN: implementations task 1)
- d285910 (RED: failing integration tests task 2)
- 3d336d0 (GREEN: routes + server wiring task 2)

## TDD Gate Compliance

- RED gate (task 1): commit c9979c1 — `test(25a-02): add failing tests for WsFirehoseHub and DriftDetector`
- GREEN gate (task 1): commit 24b0a9d — `feat(25a-02): implement WsFirehoseHub and DriftDetector services`
- RED gate (task 2): commit d285910 — `test(25a-02): add failing integration tests for firehose WS route and drift-alerts REST route`
- GREEN gate (task 2): commit 3d336d0 — `feat(25a-02): wire WsFirehoseHub + DriftDetector routes into server.ts`
