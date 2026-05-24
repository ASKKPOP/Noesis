---
phase: 29-community
plan: "01"
subsystem: grid
tags: [grid, migration, community, api, backend]
dependency_graph:
  requires: []
  provides:
    - grid/community_api
    - db/community_tables
    - db/ousia_on_humans
  affects:
    - grid/src/api/portal/index.ts
    - grid/src/api/portal/check-frozen.ts
tech_stack:
  added: []
  patterns:
    - humanPool query pattern (raw SQL, pool.query, unknown type cast)
    - JWT cookie auth via jwtVerify + COOKIE_NAME
    - Fastify route handlers with Pick<GridServices> injection
key_files:
  created:
    - grid/src/api/portal/community.ts
  modified:
    - grid/src/db/schema.ts
    - grid/src/api/portal/index.ts
    - grid/src/api/portal/check-frozen.ts
decisions:
  - "gridName accessed as string (GridServices.gridName: string) — no wrapper function needed in community.ts"
  - "humanPool typed as generic { query(): Promise<[unknown, unknown]> } — cast result headers for insertId"
  - "JWT payload uses payload['did'] key matching nous.ts pattern (not payload.sub)"
  - "Pre-existing test failures (39 files, 110 tests) confirmed unrelated to Phase 29 changes"
  - "DELETE method CORS gap in server.ts is pre-existing (governance-laws.ts also uses DELETE) — logged as deferred"
metrics:
  duration: "4 minutes"
  completed: "2026-05-23"
  tasks_completed: 3
  files_created: 1
  files_modified: 3
---

# Phase 29 Plan 01: Community Grid Backend Summary

DB migrations v18–v21 and 10 community API endpoints added to the Grid portal API, enabling the full social layer for Phase 29 community features.

## What Was Built

### Migrations (grid/src/db/schema.ts)

Four migrations appended after v17 (unique_nous_per_human):

| Version | Name | Change |
|---------|------|--------|
| v18 | add_ousia_to_human_users | `ALTER TABLE human_users ADD COLUMN ousia BIGINT NOT NULL DEFAULT 0` |
| v19 | create_community_posts | New table: id, grid_name, author_did, content, created_at; composite index on (grid_name, created_at DESC) |
| v20 | create_community_replies | New table with FK REFERENCES community_posts(id) ON DELETE CASCADE |
| v21 | create_user_follows | New table with composite PK (grid_name, follower_did, following_did) |

### API Endpoints (grid/src/api/portal/community.ts)

10 endpoints registered via `registerCommunityRoutes`:

| Method | Path | Feature | Auth |
|--------|------|---------|------|
| GET | `/api/v1/portal/community/users` | COM-01 User directory (top 100 by ousia DESC, LEFT JOIN nous_registry) | JWT required |
| GET | `/api/v1/portal/community/posts` | COM-02 Board listing (last 50 posts with reply_count) | JWT required |
| POST | `/api/v1/portal/community/posts` | COM-02 Create post (max 500 chars, trimmed) | JWT + freeze gate |
| GET | `/api/v1/portal/community/posts/:id/replies` | COM-02 Fetch replies for post | JWT required |
| POST | `/api/v1/portal/community/posts/:id/replies` | COM-02 Create reply (max 280 chars, post-exists check) | JWT + freeze gate |
| GET | `/api/v1/portal/community/leaderboard` | COM-03 Top 50 by ousia, secondary nous_score subquery | JWT required |
| POST | `/api/v1/portal/community/follow/:did` | COM-04 Follow user (INSERT IGNORE, self-follow rejected) | JWT + freeze gate |
| DELETE | `/api/v1/portal/community/follow/:did` | COM-04 Unfollow user | JWT + freeze gate |
| GET | `/api/v1/portal/community/following` | COM-04 List DIDs I follow | JWT required |
| GET | `/api/v1/portal/activity` | COM-05 Last 50 audit events (6 event types) | JWT required |

### Freeze Gate Extension (grid/src/api/portal/check-frozen.ts)

Three regex patterns added to `PORTAL_ACTION_PATTERNS`:
- `/^\/api\/v1\/portal\/community\/posts$/` — POST new post
- `/^\/api\/v1\/portal\/community\/posts\/\d+\/replies$/` — POST new reply
- `/^\/api\/v1\/portal\/community\/follow\//` — POST/DELETE follow

GET routes are read-only and intentionally excluded from the freeze gate.

### Portal Wiring (grid/src/api/portal/index.ts)

`registerCommunityRoutes` imported and called after `registerSpawnRoutes`, passing `{ humanPool, audit, gridName }` from services.

## Commits

| Hash | Message |
|------|---------|
| 82a7bcf | feat(29-01): add DB migrations v18-v21 for community features |
| 3d59ee0 | feat(29-01): create community.ts with 10 portal API endpoints |
| b5e6be0 | feat(29-01): wire community routes into portal barrel + freeze gate |

## Deviations from Plan

### Auto-adapted: gridName type

The plan template showed `services.gridName?.() ?? 'genesis'` (treating gridName as a function). The actual `GridServices.gridName` is a `string` field. Adapted `community.ts` to use `services.gridName` directly as a string. In `index.ts`, the registration passes `gridName: services.gridName` (the string value, not a wrapper function), matching the `Pick<GridServices, 'gridName'>` type which is `string`.

### Auto-adapted: humanPool type

The plan showed `pool.query<RowDataPacket[]>(...)` using mysql2 typed generics. The actual `GridServices.humanPool` interface is `{ query(sql: string, values?: unknown[]): Promise<[unknown, unknown]> }` — a simplified interface without generic support. Used type casts (`result as { insertId: number }` and `rows as unknown[]`) consistent with the existing pattern in `spawn.ts` and `nous.ts`.

### Auto-adapted: JWT payload key

The plan used `payload.sub` for the human DID. The actual auth pattern in `nous.ts` uses `payload['did']` (the DID is stored under the `did` key, not `sub`). Adapted to match the existing pattern.

### Observed: Pre-existing test failures

39 test files / 110 tests were already failing before Phase 29 changes (confirmed via git stash). My changes introduced zero new failures.

### Deferred: CORS DELETE method gap

`grid/src/api/server.ts` CORS config lists `methods: ['GET', 'POST', 'PATCH', 'OPTIONS']` — DELETE is missing. The unfollow route uses DELETE. This is a pre-existing gap (governance-laws.ts also uses DELETE with the same CORS config). Out of scope for this plan — logged for future CORS hardening phase.

## Known Stubs

None. All 10 endpoints are fully wired to real DB queries. No placeholder data.

## Threat Flags

None. All new routes are within the planned trust boundary (JWT-authenticated portal actions using humanPool). No new network endpoints, auth paths, or schema changes beyond what the plan's threat model covers.

## Self-Check: PASSED

- community.ts: FOUND
- schema.ts: FOUND
- 29-01-SUMMARY.md: FOUND
- Commit 82a7bcf: FOUND
- Commit 3d59ee0: FOUND
- Commit b5e6be0: FOUND
