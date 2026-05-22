---
phase: 26-sophia-onboarding
plan: 01
subsystem: grid-backend
tags: [migration, auth, onboarding, db, api]
dependency_graph:
  requires: []
  provides: [migration-v14, get-me-onboarded, patch-me-onboarding-goal, humanPool-gridservices]
  affects: [grid/src/db/schema.ts, grid/src/api/portal/auth.ts, grid/src/api/server.ts, grid/src/main.ts]
tech_stack:
  added: []
  patterns: [fail-safe-db-query, pool-closure-injection, jwt-auth-guard, tdd-vitest]
key_files:
  created:
    - grid/test/db/schema-v14.test.ts
    - grid/test/portal/auth-me-onboarded.test.ts
    - grid/test/portal/auth-me-patch.test.ts
  modified:
    - grid/src/db/schema.ts
    - grid/src/api/portal/auth.ts
    - grid/src/api/server.ts
    - grid/src/main.ts
decisions:
  - "humanPool added as direct Pool reference in GridServices (not a store closure) — simpler than humanSanctionStore pattern since only raw SQL queries are needed"
  - "PATCH /me returns 500 on DB error (not non-blocking at backend) — frontend follows D-08 and ignores the error; backend still logs it"
  - "PATCH /me body validated with trim() check — empty/whitespace strings return 400"
metrics:
  duration: 6m
  completed: 2026-05-22T22:24:40Z
  tasks: 2
  files_modified: 7
---

# Phase 26 Plan 01: DB Migration v14 + GET/PATCH /me Endpoints Summary

Migration v14 (onboarding_goal TEXT column) applied on Grid boot, GET /me returns onboarded boolean via fail-safe DB query, PATCH /me stores onboarding goal with auth + validation.

## What Was Built

### Migration v14
Added `onboarding_goal TEXT NULL DEFAULT NULL` to `human_users` table as migration version 14 in `grid/src/db/schema.ts`. The `MigrationRunner` in `main.ts` auto-applies it on boot — no manual registration required.

### GridServices.humanPool
Added `humanPool` field to the `GridServices` interface in `grid/src/api/server.ts`:
```typescript
humanPool?: {
    query(sql: string, values?: unknown[]): Promise<[unknown, unknown]>;
};
```
Wired in `grid/src/main.ts` using `dbConn.getPool()` — same pattern as `humanSanctionStore` but simpler (direct pool reference, no closure wrapper).

### GET /me — onboarded field
Extended `GET /api/v1/portal/auth/me` to query `human_users.onboarding_goal` and return `onboarded: boolean`:
- `onboarded: true` when `onboarding_goal IS NOT NULL` and non-empty
- `onboarded: false` when `onboarding_goal IS NULL`
- `onboarded: false` (fail-safe) when DB query throws — logs `console.warn`, never returns 503

### PATCH /me — new endpoint
New `PATCH /api/v1/portal/auth/me` endpoint:
- JWT cookie auth guard (same pattern as GET /me)
- Validates body: `onboarding_goal` must be a non-empty string (trim-checked)
- Truncates at 2000 chars before storing
- `UPDATE human_users SET onboarding_goal = ? WHERE did = ?`
- Returns `{ ok: true }` on success, `400` for invalid input, `401` for auth failure

## Test Files Created

| File | Tests | Coverage |
|------|-------|----------|
| `grid/test/db/schema-v14.test.ts` | 6 | Migration version, name, up/down SQL, no collision, sequential |
| `grid/test/portal/auth-me-onboarded.test.ts` | 4 | onboarded false on null, true on non-null, fail-safe on error, fail-safe no pool |
| `grid/test/portal/auth-me-patch.test.ts` | 7 | 401 no cookie, 401 bad JWT, 400 missing body, 400 empty, 400 whitespace, 200 ok, 200 truncation |

All 17 tests pass. Pre-existing test suite baseline: 38 failed / 127 failed tests. After changes: 37 failed / 112 failed tests (net improvement, zero regressions).

## Exact Field Name Added to GridServices

`humanPool` — type `{ query(sql: string, values?: unknown[]): Promise<[unknown, unknown]> } | undefined`

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written.

### Implementation Notes

1. The plan suggested a `humanOnboardingStore` closure pattern matching `humanSanctionStore`. After reading the actual code, the simpler `humanPool` direct-pool approach was used instead. The store closure pattern in `humanSanctionStore` exists because that store needs multiple typed methods (`existsByDid`, `setBanned`, etc.). For onboarding, raw SQL queries via `pool.query()` are sufficient — no wrapper needed. This matches the spirit of the plan's "If GridServices already has a pool field, use it" instruction.

2. PATCH /me body validation uses `onboarding_goal.trim().length === 0` (whitespace-only strings also rejected) — stricter than the plan's `onboarding_goal.length === 0` check. This aligns with T-26-01 (Tampering mitigation).

3. Test teardown: `buildServer()` creates a WebSocket hub whose close sequence produces a known "server is not running" error in afterAll. This is a pre-existing pattern in the test suite (visible in `portal-auth-region.test.ts` baseline). All individual test assertions pass — the error is teardown noise only.

## Threat Model Coverage

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-26-01: onboarding_goal tampering | Non-empty validation, 2000-char truncation, stored as plain text | Implemented |
| T-26-02: attacker DID in GET /me | DID comes from verified JWT | Implemented (JWT already enforced) |
| T-26-03: DB unavailable on GET /me | Fail-safe: catch error, return onboarded: false, log warning | Implemented |
| T-26-04: Unauthenticated PATCH /me | JWT cookie check at top of handler, 401 if missing/invalid | Implemented |

## Known Stubs

None. All wiring is real code. `humanPool` is `undefined` in test environments without DB — GET /me handles this gracefully (returns `onboarded: false`).

## Threat Flags

None. No new network endpoints beyond the plan's spec. PATCH /me was explicitly planned. No new audit events introduced (ONBOARD-05 satisfied — no `audit.append()` call in either new handler).

## Self-Check: PASSED

All created files confirmed present. All task commits confirmed in git log:
- `4505b3f` test(26-01): RED phase schema-v14 tests
- `273d8ac` feat(26-01): migration v14 + humanPool (GREEN)
- `6f3b19e` test(26-01): RED phase GET/PATCH /me tests
- `25e33ac` feat(26-01): extended endpoints (GREEN)
