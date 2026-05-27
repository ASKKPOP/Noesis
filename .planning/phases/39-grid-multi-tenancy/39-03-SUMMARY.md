---
phase: 39-grid-multi-tenancy
plan: "03"
subsystem: grid/api
tags: [tdd, api-routes, multi-tenancy, wave-3, TENANT-02, TENANT-03]
dependency_graph:
  requires:
    - grid/src/operator/data/operator-brain-store.ts  (Plan 02)
    - grid/src/operator/data/operator-quota-store.ts  (Plan 02)
    - grid/src/operator/data/operator-settings-store.ts  (Plan 02)
    - grid/src/api/preHandlers/requireDid.ts  (Phase 36)
    - grid/src/api/preHandlers/types.ts  (Phase 36 — DIDContext with operatorDid)
  provides:
    - grid/src/api/preHandlers/operatorScope.ts
    - grid/src/api/routes/operator-me/nous.ts
    - grid/src/api/routes/operator-me/brains.ts
    - grid/src/api/routes/operator-me/quota.ts
    - grid/src/api/routes/operator-me/settings.ts
    - grid/src/api/routes/operator-me/index.ts
    - grid/src/api/policy.ts (5 new entries)
    - grid/src/api/rate-limit/visitor-bucket.ts (DID bucket)
    - grid/src/api/server.ts (pool field + route wiring)
  affects:
    - grid/src/api/policy.ts (5 portal_session_required entries added)
    - grid/src/api/server.ts (GridServices interface + 2 new registrations)
    - grid/src/api/rate-limit/visitor-bucket.ts (new DID bucket alongside IP bucket)
tech_stack:
  added: []
  patterns:
    - operatorScope preHandler pattern (follows requireDid.ts shape)
    - assertOperatorOwns cross-resource ownership check with Pino warn
    - Pool-injected operator/data/ accessor call pattern
    - Fastify async route handler with early return on 503/403/400/404/409/429
    - Per-DID 600/min rate-limit Map bucket layered on IP 120/min bucket
key_files:
  created:
    - grid/src/api/preHandlers/operatorScope.ts
    - grid/src/api/routes/operator-me/nous.ts
    - grid/src/api/routes/operator-me/brains.ts
    - grid/src/api/routes/operator-me/quota.ts
    - grid/src/api/routes/operator-me/settings.ts
    - grid/src/api/routes/operator-me/index.ts
  modified:
    - grid/src/api/policy.ts
    - grid/src/api/rate-limit/visitor-bucket.ts
    - grid/src/api/server.ts
decisions:
  - "Import paths in operator-me routes use 2 levels up to api/ (not 3) — directory depth was miscounted in plan template"
  - "Policy keys use single-space format ('GET /path') to match lookupPolicy() construction — plan template used alignment spaces which broke lookup"
  - "operatorScope() returns null + sends 403 when no operatorDid in DIDContext; assertOperatorOwns() emits Pino warn per D-39-09"
  - "GridServices.pool field added as mysql2/promise Pool optional — operator/data/ accessors take pool+gridName directly"
  - "DID rate-limit hook registered after policy hook in buildServerWithHub so req.didContext is populated"
  - "zone_id and civic_standing stubbed as null in NousEntry — Phase 57/37 integration deferred"
metrics:
  duration: "320s"
  completed: "2026-05-27T02:40:06Z"
  tasks_completed: 2
  files_created: 6
  files_modified: 3
---

# Phase 39 Plan 03: API Layer — operatorScope preHandler + Five operator/me/* Routes + DID Rate-Limit

Delivers the runtime enforcement of operator isolation (TENANT-02) and quota limits (TENANT-03). The operatorScope preHandler blocks cross-operator data access. Five operator/me/* routes expose the operator fleet management API. The rate-limit refactor gives DID-authenticated requests 600 req/min vs 120 req/min for anonymous visitors.

## What Was Built

**operatorScope preHandler** (`grid/src/api/preHandlers/operatorScope.ts`):
- `operatorScope(req, reply)` — extracts `req.didContext.operatorDid`, returns it or sends 403 `{error: 'operator_scope_required'}` if absent
- `assertOperatorOwns(req, reply, resourceOperatorDid, tick)` — compares DIDs; on mismatch emits `logger.warn({event: 'operator_scope_violation', ...})` per D-39-09, sends 403 `{error: 'forbidden', reason: 'operator_scope'}`

**Five operator/me/* routes** (`grid/src/api/routes/operator-me/`):
- `nous.ts` — `GET /api/v1/operator/me/nous` — D-39-03 NousEntry[] shape with `zone_id: null` (Phase 57 stub) and `civic_standing: null` (Phase 37 stub)
- `brains.ts` — `POST /api/v1/operator/me/brains` — D-39-01 two-step claim; 429 on quota exceeded; 409 on already_claimed; 404 on unknown brain_did
- `quota.ts` — `GET /api/v1/operator/me/quota` — `{ brain_processes: { current, limit }, event_rate: { per_did_per_min, limit }, p2p_bandwidth_cap_bytes }`
- `settings.ts` — `GET + PATCH /api/v1/operator/me/settings` — `{ local_ai: null, _version: 1 }` placeholder
- `index.ts` — `registerOperatorMeRoutes` aggregator

**Policy updates** (`grid/src/api/policy.ts`):
- 5 new `portal_session_required` entries for operator/me/* routes (D-39-05)
- Single-space key format matching `lookupPolicy(method, routePath)` construction

**Rate-limit DID bucket** (`grid/src/api/rate-limit/visitor-bucket.ts`):
- `DID_MAX_REQUESTS = 600` — 5× visitor rate (D-39-08)
- `didBuckets: Map<string, Bucket>` — per-DID in-process Map
- `registerDidRateLimit(app)` — onRequest hook registered AFTER policy hook so `req.didContext` is populated; returns 429 with `Retry-After` header when exceeded; lazy eviction at 5000 entries

**Server wiring** (`grid/src/api/server.ts`):
- `GridServices.pool?: Pool` — optional MySQL pool for operator/data/ accessors
- `GridServices.operatorQuotaStore?` and `operatorSettingsStore?` — optional fields reserved for Steward Console wiring
- `registerOperatorMeRoutes(app, services)` — registered after brain token routes
- `registerDidRateLimit(app)` — registered immediately after the policy onRequest hook block

## Verification Results

| Check | Status |
|-------|--------|
| `npx tsc --noEmit` | PASS (0 errors) |
| operator-me-nous.test.ts | PASS (5 todo skipped) |
| operator-me-brains.test.ts | PASS (7 todo skipped) |
| operator-me-quota.test.ts | PASS (5 todo skipped) |
| civic-routes-shared.test.ts | PASS (4 todo skipped) |
| policy-coverage.test.ts coverage gate | PASS (2 passing) |
| Full suite pre-existing failures | 127–128 (unchanged) |
| No audit.append in operator-me/ | VERIFIED — allowlist stays at 60 |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | db50152 | feat(39-03): operatorScope preHandler + policy 5 entries + DID rate-limit + server wiring |
| Task 2 | 52bc897 | feat(39-03): five operator/me/* route files + index.ts |
| Task 1 fix | 7514e94 | fix(39-03): correct double-space policy keys to single-space for lookupPolicy match |

## Deviations from Plan

**1. [Rule 1 - Bug] Import paths in route files were miscounted**
- **Found during:** Task 2 TypeScript check
- **Issue:** Plan template specified 3-level-up paths (`../../../preHandlers/`) for files in `routes/operator-me/`, but the correct depth is 2 levels up to `api/` for preHandlers (`../../preHandlers/`) and 3 levels up to `src/` for operator/data/ (`../../../operator/data/`)
- **Fix:** Corrected all import paths in all 4 route files
- **Files modified:** nous.ts, brains.ts, quota.ts, settings.ts
- **Commit:** 52bc897

**2. [Rule 1 - Bug] Policy key double-space broke lookupPolicy matching**
- **Found during:** Post-implementation review
- **Issue:** Plan template used alignment spaces in policy keys (`'GET  /api/v1/operator/me/nous'` with 2 spaces), but `lookupPolicy(method, routePath)` builds the key as `'GET /api/v1/operator/me/nous'` (single space). This would cause routes to fall through to `civic_did_required` default instead of `portal_session_required`
- **Fix:** Changed all 4 new GET/POST entries to single-space format
- **Files modified:** `grid/src/api/policy.ts`
- **Commit:** 7514e94

## Known Stubs

- `civic_did` field in NousEntry always returns `null` — Phase 37/46 civic DID registry join deferred
- `zone_id` field in NousEntry always returns `null` — Phase 57 zoning deferred
- `civic_standing` field in NousEntry always returns `null` — Phase 37 civic standing deferred
- GET + PATCH `/api/v1/operator/me/settings` returns `{ local_ai: null, _version: 1 }` for all operators — Phase 40 Local AI persistence deferred

## Threat Surface Scan

Five new HTTP endpoints introduced:
| Endpoint | Policy | Mitigation |
|----------|--------|------------|
| GET /api/v1/operator/me/nous | portal_session_required | operatorScope() scope enforcement |
| POST /api/v1/operator/me/brains | portal_session_required | operatorScope() + BRAIN_DID_RE validation + DB-authoritative quota |
| GET /api/v1/operator/me/quota | portal_session_required | operatorScope() scope enforcement |
| GET /api/v1/operator/me/settings | portal_session_required | operatorScope() scope enforcement |
| PATCH /api/v1/operator/me/settings | portal_session_required | operatorScope() scope enforcement |

All endpoints listed in ROUTE_DID_POLICY (policy-coverage gate passes). No new audit events. No forbidden keys in Pino log output (`operator_did` is DID string, not credential).

## Self-Check

Files exist:
- grid/src/api/preHandlers/operatorScope.ts: FOUND
- grid/src/api/routes/operator-me/nous.ts: FOUND
- grid/src/api/routes/operator-me/brains.ts: FOUND
- grid/src/api/routes/operator-me/quota.ts: FOUND
- grid/src/api/routes/operator-me/settings.ts: FOUND
- grid/src/api/routes/operator-me/index.ts: FOUND
- .planning/phases/39-grid-multi-tenancy/39-03-SUMMARY.md: FOUND

Commits exist:
- db50152: FOUND (feat(39-03): operatorScope preHandler + policy 5 entries + DID rate-limit + server wiring)
- 52bc897: FOUND (feat(39-03): five operator/me/* route files + index.ts)
- 7514e94: FOUND (fix(39-03): correct double-space policy keys to single-space for lookupPolicy match)

## Self-Check: PASSED
