---
phase: 03-dashboard-v1-firehose-heartbeat-region-map
plan: 01
subsystem: api
tags: [fastify, cors, audit, heartbeat, spatial-map, dashboard-prep]

# Dependency graph
requires:
  - phase: 02-wshub-ws-events-endpoint
    provides: WsHub fanout + broadcast allowlist (tick already listed, now emitted)
provides:
  - "@fastify/cors registered with dev allowlist for http://localhost:3001 + :3000"
  - "GET /api/v1/grid/regions returns {regions, connections} in a single payload"
  - "SpatialMap.allConnections() public accessor returning a shallow copy"
  - "Deterministic tick audit emission wired into GenesisLauncher.bootstrap"
affects: [03-02-dashboard-scaffold, 03-03-ws-client, 03-04-stores, 03-06-region-map]

# Tech tracking
tech-stack:
  added: []  # @fastify/cors@^10.0.0 already in grid/package.json; no new deps
  patterns:
    - "Aggregate accessor returning .slice() copy to preserve encapsulation"
    - "Single onTick listener with ordered side effects (registry.touch → audit.append)"
    - "CORS registration BEFORE routes; disabled credentials; tight origin allowlist"

key-files:
  created:
    - grid/test/api/server.cors.test.ts
    - grid/test/api/server.regions.test.ts
    - grid/test/genesis/launcher.tick-audit.test.ts
  modified:
    - grid/src/api/server.ts
    - grid/src/space/map.ts
    - grid/src/genesis/launcher.ts
    - grid/test/space.test.ts

key-decisions:
  - "Extend /api/v1/grid/regions in-place to {regions, connections} rather than add a sibling /connections route — dashboard needs both together"
  - "Single clock.onTick subscription does registry.touch THEN audit.append so tick payload reflects post-touch state"
  - "CORS origin list is explicit literal ['http://localhost:3001', 'http://localhost:3000'] — no regex, no wildcards, credentials off"
  - "SpatialMap.allConnections returns this.connections.slice() to prevent external mutation through JSON serialization round-trips"

patterns-established:
  - "CORS registration occurs BEFORE any app.get route in buildServerWithHub"
  - "Audit producers emit primitives-only payloads; privacy allowlist is last-line defense"
  - "Unit tests pinned to insertion order for aggregate accessors to lock serialization semantics"

requirements-completed: [MAP-01, AUDIT-03]

# Metrics
duration: ~18min
completed: 2026-04-18
---

# Phase 3 Plan 01: Dashboard Prerequisites Summary

**CORS allowlist, aggregate {regions, connections} endpoint, and deterministic tick audit emission — three grid-side gaps closed so the Phase 3 dashboard can fetch, render edges, and show a heartbeat without additional Grid changes.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-04-18T04:05:52Z (baseline test run)
- **Completed:** 2026-04-18T04:08:58Z (final regression)
- **Tasks:** 3 (all TDD: RED → GREEN)
- **Files modified:** 3 source files + 4 test files (1 new unit test block appended to `grid/test/space.test.ts`, 3 new test files under `grid/test/api/` and `grid/test/genesis/`)

## Accomplishments

- Dashboard can now issue `fetch('http://localhost:8080/api/v1/grid/regions')` from `http://localhost:3001` without CORS errors
- Region map rendering receives regions AND edges in a single GET (no second request needed for connections)
- Every clock tick produces exactly one `tick` audit entry flowing through WsHub to the dashboard — heartbeat no longer needs to poll `/api/v1/grid/clock`
- Baseline test count increased from **289 → 303** (+14: 4 CORS, 3 regions, 2 allConnections, 5 tick-audit). All green.

## Task Commits

1. **Task 1: Register @fastify/cors with localhost:3001 allowlist** — `4c4ea6c` (feat)
2. **Task 2: Extend GET /regions to {regions, connections} + SpatialMap.allConnections** — `d1ee094` (feat)
3. **Task 3: Emit tick audit entries from GenesisLauncher.bootstrap** — `842ff8d` (feat)

## Files Created/Modified

- `grid/src/api/server.ts:9` — added `import cors from '@fastify/cors'`
- `grid/src/api/server.ts:41-49` — `void app.register(cors, { origin: ['http://localhost:3001', 'http://localhost:3000'], credentials: false, methods: ['GET','OPTIONS'] })` placed BEFORE the first route handler
- `grid/src/api/server.ts:81-84` — regions handler extended to return `{ regions, connections: services.space.allConnections() }`
- `grid/src/space/map.ts:29-33` — new `allConnections(): RegionConnection[]` public method returning `this.connections.slice()`
- `grid/src/genesis/launcher.ts:106-121` — single `clock.onTick` listener doing registry.touch then `audit.append('tick', 'system', {tick, epoch, tickRateMs, timestamp})`
- `grid/test/api/server.cors.test.ts` — 4 tests: preflight accept (:3001, :3000), reject disallowed origin, no-op on same-origin
- `grid/test/api/server.regions.test.ts` — 3 tests: populated shape, read-only invariant, empty space
- `grid/test/space.test.ts` (appended) — 2 tests: allConnections insertion order, copy-semantics
- `grid/test/genesis/launcher.tick-audit.test.ts` — 5 tests: exact tick count, payload shape, privacy check, observer-count idempotence, timer-driven emission

## Decisions Made

- **CORS origin literal** (not regex): Any future preview-deploy hostnames will be added explicitly; wildcards are a Phase-4 production-hardening decision, not a dev-convenience one.
- **Aggregate endpoint shape `{regions, connections}`**: Dashboard component contract is cleaner when both nodes and edges arrive together — a sibling `/connections` route would mean two fetches for every route change.
- **Single onTick listener**: One subscription with ordered side effects is easier to reason about than two parallel subscriptions. Registry.touch first ensures the audit entry reflects the post-touch world if an observer later correlates the two.
- **Shallow copy from allConnections**: Matches existing `allRegions()` pattern (spread from Map) and mirrors AuditChain.all(). Prevents JSON.stringify/parse round-trips from corrupting internal spatial state via accidental `body.connections.push(…)` in caller code.

## Deviations from Plan

### Auto-fixed Issues

**None** — plan executed exactly as written across all three tasks.

### Clarifications (not deviations)

- **Plan vs. 03-VALIDATION.md test paths disagree.** The plan specified `grid/test/api/server.cors.test.ts` while the Nyquist validation table referenced `tests/integration/cors.test.ts`. I followed the plan's paths since they match the existing `grid/test/` flat directory convention. The validation-table paths are a stale artifact from the original Nyquist draft — recommend future `/gsd-verify-work` references the plan's own acceptance criteria first.

- **Task 3's `<action>` note** stated "DO NOT edit `grid/src/audit/types.ts`". Honored — no audit/types.ts edits were needed. The payload shape is compatible with the existing `payload: Record<string, unknown>` contract.

---

**Total deviations:** 0
**Impact on plan:** None — straight-line TDD execution.

## Issues Encountered

- **Pre-existing build errors in `grid/src/main.ts`** surfaced by the final `npm run build` check. Confirmed via `git stash` + rebuild on HEAD-minus-my-changes that these errors (DatabaseConnection.fromConfig, wrong arg counts) existed before Plan 03-01. Logged to `.planning/phases/03-dashboard-v1-firehose-heartbeat-region-map/deferred-items.md` for a future grid cleanup plan. Does NOT affect test suite (Vitest uses esbuild per-file, not full tsc project build); 303/303 tests green.
- **Pre-existing lint config incompatibility** (ESLint v9 migration) — also pre-existing, also logged in deferred-items.md.

## Known Stubs

None. Every artifact declared in the plan's `must_haves.artifacts` is real, wired, and tested.

## User Setup Required

None — no external service configuration required.

## Self-Check: PASSED

**Files verified:**
- `grid/src/api/server.ts` — FOUND (cors import line 9, registration line 46, allConnections call line 83)
- `grid/src/space/map.ts` — FOUND (allConnections line 29)
- `grid/src/genesis/launcher.ts` — FOUND (audit.append('tick' line 115, exactly 1 clock.onTick call)
- `grid/test/api/server.cors.test.ts` — FOUND
- `grid/test/api/server.regions.test.ts` — FOUND
- `grid/test/genesis/launcher.tick-audit.test.ts` — FOUND

**Commits verified (in git log):** 4c4ea6c, d1ee094, 842ff8d

**Acceptance criteria:**
- `grep -n "@fastify/cors" grid/src/api/server.ts` — 1 match (line 9)
- `grep -n "origin: \['http://localhost:3001'" grid/src/api/server.ts` — matches
- `grep -n "app.register(cors" grid/src/api/server.ts` — line 46
- `grep -n "allConnections" grid/src/space/map.ts` — line 29
- `grep -n "connections: services.space.allConnections" grid/src/api/server.ts` — line 83
- `grep -n "audit.append('tick'" grid/src/genesis/launcher.ts` — 1 match (line 115)
- `grep -c "clock.onTick" grid/src/genesis/launcher.ts` — 1 (exactly one subscription)
- `cd grid && npm test -- --run` — **303 tests passed, 0 failed, 24 files**

## Next Phase Readiness

**Ready for Plan 03-02 (dashboard scaffold) onward:**
- Dashboard can fetch Grid REST without CORS interception
- Dashboard can render the region map from one GET
- Dashboard's HeartbeatStore can compute staleness from the WS firehose alone (no clock-poll fallback needed)
- Plan 03-02 runs in parallel to this per the wave config — its landing commit (`09df580`) is already on master from the concurrent worktree

**No blockers** for subsequent Phase 3 plans.

---
*Phase: 03-dashboard-v1-firehose-heartbeat-region-map*
*Completed: 2026-04-18*
