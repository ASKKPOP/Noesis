---
phase: 41
plan: 4
subsystem: grid-api
tags: [civic-presence, routes, policy, frozen-did, sleep-cycle]
dependency_graph:
  requires: [41-03-SUMMARY.md]
  provides: [civic-presence routes, civic-inbox routes, civic-message route, frozen-DID gate]
  affects: [grid/src/api/server.ts, grid/src/api/policy.ts, grid/src/api/preHandlers/requireDid.ts]
tech_stack:
  added: []
  patterns: [optional-service-guard 503, dynamic-import-type for circular-dep avoidance]
key_files:
  created:
    - grid/src/api/routes/civic-presence.ts
    - grid/src/api/routes/civic-inbox.ts
    - grid/src/api/routes/civic-message.ts
  modified:
    - grid/src/api/policy.ts
    - grid/src/api/server.ts
    - grid/src/api/preHandlers/requireDid.ts
decisions:
  - "RequireDidServices extends TryDidServices — frozen-DID check is additive, not a breaking change to existing callers"
  - "services.currentTick must be wired by launcher.ts as () => this.clock.currentTick before Phase 41 routes go live"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-27T19:27:54Z"
  tasks: 3
  files: 6
---

# Phase 41 Plan 4: Grid Routes + ROUTE_DID_POLICY + Frozen-DID Gate Summary

6 civic presence/inbox/message routes wired to ROUTE_DID_POLICY, requireDid extended with Phase 41 frozen-DID 409 gate.

## What Was Built

### Route Policy Table (6 new entries in ROUTE_DID_POLICY)

| Route | Policy | Rationale |
|-------|--------|-----------|
| `POST /api/v1/civic/presence` | `civic_did_required` | Brain JWT heartbeat (T-41-01) |
| `GET /api/v1/civic/presence` | `public` | Civic Map polling — no auth needed |
| `GET /api/v1/civic/presence/me` | `civic_did_required` | Brain JWT — own DID only |
| `GET /api/v1/civic/inbox` | `civic_did_required` | Brain JWT — scoped (T-41-05) |
| `PATCH /api/v1/civic/inbox/ack` | `civic_did_required` | Brain JWT — scoped (T-41-05) |
| `POST /api/v1/civic/message` | `civic_did_required` | Civic-DID send (T-41-02) |

### ROUTE_DID_POLICY CI Gate Result

`check-did-policy-coverage.mjs` — **green**: 53 inline routes covered, 128 total policy entries, 0 violations.

### Route Implementations

**`civic-presence.ts`** (SLEEP-01 + SLEEP-03):
- `POST /api/v1/civic/presence` — calls `svc.onHeartbeat(civicDid, tick)`, returns `{status, grace_timer_active, last_seen_tick}`. 503 if presenceService or currentTick absent.
- `GET /api/v1/civic/presence` — public polling, returns `{nous: [{civic_did, presence_status, last_seen_at}]}`.
- `GET /api/v1/civic/presence/me` — returns own full record including `frozen` flag, 404 if not registered.

**`civic-inbox.ts`** (SLEEP-03):
- `GET /api/v1/civic/inbox` — optional `?since=<tick>` cursor, returns `{messages, queue_depth}`. Validates `since` as non-negative finite integer.
- `PATCH /api/v1/civic/inbox/ack` — accepts `{message_ids: number[]}`, returns `{delivered_count}`. Validates array of positive integers.

**`civic-message.ts`** (SLEEP-02):
- `POST /api/v1/civic/message` — queue-aware send: 64KB body cap (413), 429 on queue full, 404 if recipient not registered, 202 on success.

### Frozen-DID Gate Location

**File:** `grid/src/api/preHandlers/requireDid.ts`
**Function:** `requireDid()`

After `tryDid` resolves to `civic_member` tier, if `services.presenceService` is wired, `isFrozen(ctx.did)` is awaited. Frozen DIDs receive `409 { error: 'civic_did_frozen' }` before any route handler runs.

`RequireDidServices` interface extends `TryDidServices` with:
```typescript
presenceService?: import('../../civic-presence/presence-service.js').PresenceService;
```
Dynamic import type prevents circular dependency (mirrors firehose-hub.ts pattern).

### GridServices Extensions

Two new optional fields in `GridServices` (server.ts):
- `presenceService?: PresenceService` — Phase 41 facade
- `currentTick?: () => number` — tick accessor for heartbeat handler

### server.ts Wiring

- 3 imports added at top (alongside other route imports)
- 3 `void registerCivic*` calls added after `registerOperatorMeRoutes`
- `requireDid` call site updated to pass `presenceService: services.presenceService`

## Commits

| Hash | Description |
|------|-------------|
| `1f5165f` | feat(41-04): add 6 ROUTE_DID_POLICY entries + GridServices.presenceService/currentTick |
| `1b18d8b` | feat(41-04): create civic presence/inbox/message route files + wire into server.ts |
| `2ed843e` | feat(41-04): requireDid 409 gate for frozen Civic-DIDs (T-41-04) |

## Carry-Forward

**CRITICAL**: `services.currentTick` must be wired by `grid/src/genesis/launcher.ts`. The heartbeat handler returns 503 `clock_unavailable` until this is done. Production wiring: `currentTick: () => this.clock.currentTick` in the `GridServices` object passed to `buildServer`.

Also: `services.presenceService` must be wired by launcher with a `PresenceService` instance for frozen-DID gate and all Phase 41 routes to be operational.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `grid/src/api/routes/civic-presence.ts` — FOUND
- `grid/src/api/routes/civic-inbox.ts` — FOUND
- `grid/src/api/routes/civic-message.ts` — FOUND
- Commit `1f5165f` — FOUND
- Commit `1b18d8b` — FOUND
- Commit `2ed843e` — FOUND
- ROUTE_DID_POLICY gate: 128 entries, 0 violations — PASSED
- TypeScript noEmit: clean — PASSED
- Test count: 129 failures (all pre-existing, same as baseline), 2521 passing — NO REGRESSIONS
