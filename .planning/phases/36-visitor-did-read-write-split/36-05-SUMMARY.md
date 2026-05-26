---
phase: 36
plan: "05"
subsystem: visitor-routes
tags: [visitor-routes, auth-endpoints, oauth-stubs, notification-queue, rate-limit, vote-05, vis-01, vis-02, vis-03, vis-05]
depends_on: [36-01, 36-02, 36-04]
provides: [civic-map-route, civic-map-zone-route, library-entries-route, market-listings-route, polis-bills-route, nous-public-profile-route, visitor-audit-trail-route, oauth-stubs, portal-notifications-queue, visitor-rate-limiter]
affects:
  - grid/src/api/routes/civic-map.ts
  - grid/src/api/routes/civic-map-zone.ts
  - grid/src/api/routes/library-entries.ts
  - grid/src/api/routes/market-listings.ts
  - grid/src/api/routes/polis-bills.ts
  - grid/src/api/routes/nous-public-profile.ts
  - grid/src/api/routes/visitor-audit-trail.ts
  - grid/src/api/portal/oauth-stub.ts
  - grid/src/api/portal/auth.ts
  - grid/src/api/portal/notifications.ts
  - grid/src/api/rate-limit/visitor-bucket.ts
  - grid/src/api/server.ts
tech_stack:
  added: []
  patterns: [phase-36-visitor-route-pattern, vote-05-public-keys-allowlist, family-prefix-redaction, in-process-rate-limiter, in-process-notification-queue, oauth-stub-501]
key_files:
  created:
    - grid/src/api/routes/civic-map.ts
    - grid/src/api/routes/civic-map-zone.ts
    - grid/src/api/routes/library-entries.ts
    - grid/src/api/routes/market-listings.ts
    - grid/src/api/routes/polis-bills.ts
    - grid/src/api/routes/nous-public-profile.ts
    - grid/src/api/routes/visitor-audit-trail.ts
    - grid/src/api/portal/oauth-stub.ts
    - grid/src/api/portal/notifications.ts
    - grid/src/api/rate-limit/visitor-bucket.ts
  modified:
    - grid/src/api/portal/auth.ts
    - grid/src/api/server.ts
decisions:
  - "visitor-audit-trail.ts replaces the inline GET /api/v1/audit/trail route that was in server.ts; single route with conditional redaction based on req.didContext tier"
  - "OAuth stubs moved from inline server.ts to oauth-stub.ts module registered inside registerPortalAuthRoutes via auth.ts — cleaner separation"
  - "polis-bills PUBLIC_KEYS allowlist: 9 keys explicitly picked; source object never spread; ballots structurally excluded"
  - "Rate limiter registered via app.addHook before app.register(fastifyCookie) resolves — effective first onRequest hook in chain"
  - "portal.notification_dispatched emitted on both enqueue and read actions; neither is on broadcast allowlist (D-36-19)"
  - "visitor-audit-redaction second sub-test (civic-DID bearer mock JWT) remains RED — test was written with RED comment; mock JWT cannot be verified; documents expected future contract"
metrics:
  duration: "~18 minutes"
  completed: "2026-05-26"
  tasks_completed: 3
  files_count: 12
---

# Phase 36 Plan 05: Visitor Routes + OAuth Stubs + Rate Limiter Summary

7 visitor read routes registered and policy-gated (civic-map, civic-map-zone, library-entries, market-listings, polis-bills, nous-public-profile, visitor-audit-trail), plus 2 OAuth stub endpoints, in-process Portal notification queue, and IP-based visitor rate limiter.

## What Was Built

### Task 1 — 7 Visitor Read Routes + server.ts wiring

1. **`grid/src/api/routes/civic-map.ts`** — `registerCivicMapRoute`: GET /api/v1/civic-map/state returning `{zones: Zone[], nous: NousMapEntry[]}`. Phase 36 stub: deterministic 6-zone layout (D-V3-32) hard-coded with 2×3 grid across 800×600 SVG viewBox. Zone labels: Business, Manufacture, Shopping, Residential, Infrastructure, Government Quarter. Empty nous array (Phase 37 wires Civic-DID census).

2. **`grid/src/api/routes/civic-map-zone.ts`** — `registerCivicMapZoneRoute`: GET /api/v1/civic-map/zone/:zone_id returning zone detail. Phase 36 stub: empty recentActivity and topContributors arrays (Phase 57 ZONE-* wires real data).

3. **`grid/src/api/routes/library-entries.ts`** — `registerLibraryEntriesRoute`: GET /api/v1/library/entries returning `{entries: LibraryEntry[]}`. Phase 36 stub: empty array (Phase 48 wires real LoreStorage). Visitor view excludes full body field.

4. **`grid/src/api/routes/market-listings.ts`** — `registerMarketListingsRoute`: GET /api/v1/market/listings returning `{listings: MarketListing[]}`. Phase 36 stub: empty array (Phase 44 wires real market data). Full price visible per D-36-03.

5. **`grid/src/api/routes/polis-bills.ts`** — `registerPolisBillsRoute`: GET /api/v1/polis/bills + GET /api/v1/polis/bills/:id. **VOTE-05 enforcement**: response reconstructed from 9 PUBLIC_KEYS allowlist only (`id, title, body_summary, sponsor_civic_did_hash, sponsor_display_name, cosponsors_count, session_status, scheduled_open_tick, tally`). Source object never spread. `ballots` field structurally excluded. Uses `services.polisStore` when present (added to GridServices); returns empty stub when absent. Phase 46 wires real Polis data.

6. **`grid/src/api/routes/nous-public-profile.ts`** — `registerNousPublicProfileRoute`: GET /api/v1/nous/:civic_did_hash/public returning NousPublicProfile. D-36-11 invariant: memory, karpathy, hypnos, pneuma, treasury_balance, active_contracts, audit_history never included. Phase 36 stub: default stub profile (Phase 37 wires real Nous registry).

7. **`grid/src/api/routes/visitor-audit-trail.ts`** — `registerVisitorAuditTrailRoute`: replaces the inline GET /api/v1/audit/trail from server.ts. Conditional redaction: civic_member tier → full entries; anonymous/human_visitor → family-prefix actor_did (event_type.split('.')[0]) + empty payload object. Cap at 1000 events per D-36-06.

**server.ts changes:**
- Added `polisStore` to `GridServices` interface (required by polis-bills-privacy.test.ts)
- Imported and registered all 7 new routes after `registerHumansRoutes`
- Removed the old inline GET /api/v1/audit/trail route (replaced by visitor-audit-trail.ts)
- Removed inline OAuth stub routes (moved to oauth-stub.ts via auth.ts)

### Task 2 — OAuth Stubs + registerPortalAuthRoutes Extension

**`grid/src/api/portal/oauth-stub.ts`** — `registerOAuthStubRoutes`: POST /portal/auth/oauth/google + /apple return 501 `{status: 'coming_soon', provider, planned_phase: '52-54'}`. D-36-21: no-DID auth exceptions 3→5. CI gate (Plan 06) asserts count = 5.

**`grid/src/api/portal/auth.ts`** — Added `import { registerOAuthStubRoutes } from './oauth-stub.js'` and call inside `registerPortalAuthRoutes`. No other changes to existing auth routes.

### Task 3 — Portal Notification Queue + Visitor Rate Limiter

**`grid/src/api/portal/notifications.ts`** — `registerPortalNotificationsRoutes` + `enqueueNotification` helper:
- GET /portal/api/v1/notifications: returns per-operator notification list (portal_session_required)
- POST /portal/api/v1/notifications/:id/read: marks notification read
- Module-scoped in-process Map per operator DID (Phase 56 wires MySQL persistence)
- `appendPortalNotificationDispatched` called on both enqueue and read actions
- D-36-19: NOT on broadcast allowlist — private personal-queue event

**`grid/src/api/rate-limit/visitor-bucket.ts`** — `registerVisitorRateLimit`:
- In-process `Map<ip, {count, windowStart}>` sliding-window bucket
- Window: 60,000 ms; max: 120 requests (D-36-05)
- Bucket exhaustion: HTTP 429 + `Retry-After` header (D-36-07)
- Lazy eviction: stale buckets cleaned on each access (2-window TTL)
- Comment: D-36-05 + D-36-07; Phase 39 TODO per-DID buckets

**server.ts changes:**
- Registered `registerVisitorRateLimit(app)` before the global policy onRequest hook
- Registered `registerPortalNotificationsRoutes(app, services)` after `registerPortalRoutes`

## Tests Turned GREEN by This Plan

| Test File | Tests | Status |
|-----------|-------|--------|
| `grid/test/api/visitor-public-routes.test.ts` | 5 | GREEN (all 5 assertions pass) |
| `grid/test/api/polis-bills-privacy.test.ts` | 1 | GREEN |
| `grid/test/api/did-revoked-behavior.test.ts` | 2 | GREEN |
| `grid/test/api/policy-coverage.test.ts` | 2 | GREEN |
| `grid/test/api/did-required-enforcement.test.ts` | 6 | GREEN |

Note: Test file suite-level "FAIL" status on these files is the pre-existing WebSocket teardown error ("The server is not running") from Fastify WS plugin teardown sequence. All test assertions within each file pass. This is a pre-existing issue at base commit ce3dad0.

## Stub vs Real Boundaries

| Route | Phase 36 State | Real Data Phase |
|-------|---------------|-----------------|
| /api/v1/civic-map/state | 6-zone hard-coded stub, empty nous[] | Phase 57 (Zoning), Phase 37 (Civic-DID census) |
| /api/v1/civic-map/zone/:id | Empty recentActivity/topContributors | Phase 57 ZONE-* |
| /api/v1/library/entries | Empty entries[] | Phase 48 (Library expansion) |
| /api/v1/market/listings | Empty listings[] | Phase 44 (Market) |
| /api/v1/polis/bills | Queries polisStore if present; else empty | Phase 46 (Polis) |
| /api/v1/nous/:hash/public | Stub default profile | Phase 37 (Nous registry) |
| /portal/api/v1/notifications | In-process Map; empty by default | Phase 56 (Portal UI + MySQL) |

## OAuth Stub Count = 5 Confirmed

The no-DID auth exception count per D-V3-15 (amended by D-36-21):
1. POST /portal/auth/siwe
2. POST /portal/auth/email/signup
3. POST /portal/auth/email/signin
4. POST /portal/auth/oauth/google (NEW — oauth-stub.ts, 501)
5. POST /portal/auth/oauth/apple (NEW — oauth-stub.ts, 501)

Plan 06 CI gate `scripts/check-no-did-exception-count.mjs` will assert count = 5.

## Deviations from Plan

### Known Stubs (Intentional)

All 7 visitor routes return Phase 36 stubs. This is per-plan: "Phase 36 ships the contract; Phases 37-48 wire real data sources." Each file has a `// PHASE-36 STUB — Phase NN wires real <subsystem>` comment at the stub return site.

### visitor-audit-redaction second sub-test remains RED

**Found during:** Task 1 test run
**Issue:** The test `visitor-audit-redaction.test.ts` has two sub-tests:
1. Unauthenticated → family-prefix redaction (PASSED GREEN)
2. "civic-DID bearer" → full actor_did (REMAINS RED)

Sub-test 2 uses `Bearer mock-civic-token-for-did:civic:noesis:gen-001` which is NOT a valid ES256 JWT. The `tryDid` preHandler runs JWT verification via `jwtVerify` with the server's ES256 public key — the mock token fails verification, `req.didContext` remains null, and the route applies redaction. `hasFullDid` = false.

The test file itself explicitly documents: "Note: this sub-test will also fail RED until auth + route integration lands. It demonstrates the expected contract for Plan 03." This was intentionally written as a RED specification test. The failure is pre-documented by the test author.

**Not fixed:** Making a mock-JWT bypass would introduce a security hole (visitors could forge bearer tokens to get unredacted audit entries). The test needs to be updated to use a real signed JWT when real civic-DID JWT auth integration lands.

## Threat Surface Scan

All routes added follow ROUTE_DID_POLICY (policy.ts entries pre-existing from Plan 02). No new unprotected network endpoints beyond what was planned. No new trust boundary crossings.

| Flag | File | Description |
|------|------|-------------|
| In scope | polis-bills.ts | VOTE-05 ballot privacy; verified via PUBLIC_KEYS allowlist + test |
| In scope | visitor-audit-trail.ts | Actor DID redaction; verified via test (test 1 passes) |
| In scope | oauth-stub.ts | 501 stubs; prevent Elevation of Privilege per T-36-VIS02 |

## Self-Check: PASSED

All 10 new files found:
- `grid/src/api/routes/civic-map.ts` FOUND
- `grid/src/api/routes/civic-map-zone.ts` FOUND
- `grid/src/api/routes/library-entries.ts` FOUND
- `grid/src/api/routes/market-listings.ts` FOUND
- `grid/src/api/routes/polis-bills.ts` FOUND
- `grid/src/api/routes/nous-public-profile.ts` FOUND
- `grid/src/api/routes/visitor-audit-trail.ts` FOUND
- `grid/src/api/portal/oauth-stub.ts` FOUND
- `grid/src/api/portal/notifications.ts` FOUND
- `grid/src/api/rate-limit/visitor-bucket.ts` FOUND

All 3 task commits verified:
- `2d09768` — 7 visitor read routes + server.ts wiring
- `bdd2b93` — OAuth stub routes + auth.ts extension
- `0a80b01` — portal notification queue + visitor rate limiter
