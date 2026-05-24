---
phase: 25a
plan: 04
subsystem: grid-api
tags: [humans, tick-metrics, ring-buffer, observer-surfaces, read-only-endpoints]
dependency_graph:
  requires: [25a-01]
  provides: [OBS-HUMANS, OBS-BRAIN-HEALTH-family1]
  affects: [25a-06-steward-ui]
tech_stack:
  added: []
  patterns: [server-side-payload-filtering, ring-buffer-percentiles, HUMAN_DID_RE-validation]
key_files:
  created:
    - grid/src/api/routes/humans.ts
    - grid/src/api/routes/tick-metrics.ts
    - grid/test/api/humans.test.ts
    - grid/test/api/tick-metrics.test.ts
    - grid/test/integration/nous-runner-tick-latency.test.ts
  modified:
    - grid/src/api/server.ts
    - grid/src/integration/nous-runner.ts
decisions:
  - "Use HUMAN_DID_RE (not DID_REGEX) for human endpoint validation — DID_REGEX rejects colons in slug"
  - "Server-side payload filtering for human.transferred and nous.whispered (AuditChain.query cannot filter by payload field)"
  - "getTickMetrics() added as optional on InspectorRunner so legacy fakes compile without changes"
  - "Email excluded from profile response per T-25a-04-02 PII mitigation"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-21"
  tasks_completed: 2
  files_created: 5
  files_modified: 2
requirements: [OBS-HUMANS, OBS-BRAIN-HEALTH]
---

# Phase 25a Plan 04: Humans and Tick-Metrics Summary

**One-liner:** Human profile + history REST endpoints with server-side payload filtering, plus NousRunner tick-latency ring buffer (capacity 100) backing p50/p95 tick-metrics endpoint.

## What Was Built

### Three new route paths

**GET /api/v1/humans/:did**
```
200: { did, eth_address, grid_name, region, created_at, last_active, nous_count, transfer_count }
400: { error: 'invalid_did' }
404: { error: 'unknown_human' }
```
- Validates with `HUMAN_DID_RE` (not `DID_REGEX` — human DIDs contain colons in the slug)
- `last_active`: createdAt of the most recent audit entry where `actorDid === did`
- `nous_count`: count of `NousRegistry.active()` records where `humanOwner === did`
- `transfer_count`: count of `human.transferred` audit entries where `payload.human_did === did` (server-side payload filter)
- Email NOT included in response (T-25a-04-02 PII mitigation)

**GET /api/v1/humans/:did/history**
```
200: { siwe_sessions[], transfers[], whispers_sent[], regions_visited[] }  // each max 20, newest-first
400: { error: 'invalid_did' }
404: { error: 'unknown_human' }
```
- `siwe_sessions`: merged `portal.auth.login` + `portal.auth.register` entries for this DID
- `transfers`: `human.transferred` filtered server-side by `payload.human_did === did`
- `whispers_sent`: `nous.whispered` filtered server-side by `payload.from_did === did`; returns only `ciphertext_hash` (not body content — T-25a-04-01 mitigation)
- `regions_visited`: `nous.moved` entries for Nous DIDs whose `humanOwner === did`; empty array when no Nous owned

**GET /api/v1/nous/:did/tick-metrics**
```
200: { p50: number, p95: number, queue_depth: number, sample_count: number }  // durations in ms
400: { error: 'invalid_did' }
404: { error: 'unknown_nous' }
```
- Uses standard `DID_REGEX` (Nous DID format, no colons after prefix)
- `p50`/`p95`: computed from sorted ring buffer contents
- `queue_depth`: 0 (NousRunner has no pending-tick concept in Phase 25a)
- `sample_count`: current ring buffer size (max 100)

### NousRunner instrumentation surface

**`getTickMetrics()` signature:**
```typescript
getTickMetrics(): { p50: number; p95: number; queue_depth: number; sample_count: number }
```

**Ring buffer:** `private readonly tickLatencyBuffer = new RingBuffer<number>(100)`
- Capacity: 100 ticks; drop-oldest eviction
- Memory: <1KB per NousRunner
- Populated by: `bridge.sendTick()` wrapped in `performance.now()` try/finally in `tick()`

**`InspectorRunner` interface extended:** `getTickMetrics?()` added as optional method so legacy test fakes compile without modification.

## Confirmed Invariants

- **Zero new audit events** — both routes and NousRunner instrumentation are read-only
- **Audit chain unmodified** — no new event types, no `append()` calls added
- **Allowlist delta: 0** — no new `operator.*`, `nous.*`, or `trade.*` events
- **Email never in response** — explicit field allowlist in profile handler
- **Ciphertext not exposed** — `whispers_sent` returns only `ciphertext_hash` (already in payload shape)

## Decision IDs Implemented

- **D-25a-06 family #1** (tick latency p50/p95 + queue depth): SHIPPED via tick-metrics endpoint
- **D-25a-18** (humans drill-down profile + history): SHIPPED via humans endpoints
- **D-25a-06 families #2-4** (Brain health audit metrics): served by existing `/api/v1/audit/trail` filtered queries from Steward UI (Plan 06) — no Grid changes needed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used HUMAN_DID_RE instead of DID_REGEX for human endpoints**
- **Found during:** Task 1 GREEN phase — tests getting 400 for valid human DIDs
- **Issue:** `DID_REGEX = /^did:noesis:[a-z0-9_\-]+$/i` rejects human DIDs like `did:noesis:human:0x...` because the slug contains a colon
- **Fix:** Import and use `HUMAN_DID_RE` from `HumanRegistry.ts` for human route validation; keep `DID_REGEX` for tick-metrics (Nous DIDs have no colons)
- **Files modified:** `grid/src/api/routes/humans.ts`
- **Commit:** 97ef4d3

None — plan executed as written for Task 2.

## Test Coverage

| File | Tests | Result |
|------|-------|--------|
| `grid/test/api/humans.test.ts` | 15 | All pass |
| `grid/test/api/tick-metrics.test.ts` | 4 | All pass |
| `grid/test/integration/nous-runner-tick-latency.test.ts` | 4 | All pass |

**Total: 23 new tests, all passing**

## Known Stubs

None — all endpoints return live data from HumanRegistry, AuditChain, and NousRunner.tickLatencyBuffer.

## Threat Flags

None — no new network endpoints beyond those specified in the plan's threat model. The three new routes are covered by T-25a-04-01 through T-25a-04-07 in the plan.

## Self-Check: PASSED

All files present, all commits verified:
- `grid/src/api/routes/humans.ts` — FOUND
- `grid/src/api/routes/tick-metrics.ts` — FOUND
- `grid/test/api/humans.test.ts` — FOUND
- `grid/test/api/tick-metrics.test.ts` — FOUND
- `grid/test/integration/nous-runner-tick-latency.test.ts` — FOUND
- Commit 97ef4d3 (humans routes) — FOUND
- Commit e5794d6 (tick-metrics) — FOUND
