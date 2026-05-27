---
phase: 40-local-ai-integration
plan: 02
subsystem: grid-persistence
tags: [wave-1, local-ai, settings-store, brain-jwt, migration, tdd]
dependency_graph:
  requires:
    - grid/src/db/schema.ts (migration v28 — base)
    - grid/src/operator/data/ (operator data stores pattern)
    - grid/src/api/routes/operator-me/settings.ts (portal-session settings route)
    - grid/src/db/stores/brain-token-store.ts (Brain token verification)
    - grid/src/api/preHandlers/tryDid.ts (Brain JWT verification pattern)
  provides:
    - grid/src/db/schema.ts migration v29 (operator_settings table)
    - grid/src/operator/data/operator-settings-store.ts (real DB persistence)
    - grid/src/api/routes/operator-me/brain-settings.ts (Brain JWT settings endpoint)
  affects:
    - grid/src/api/policy.ts (new ROUTE_DID_POLICY entry)
    - grid/src/api/routes/operator-me/index.ts (new route registration)
    - grid/test/operator-me-settings.test.ts (stub → real tests)
tech_stack:
  added: []
  patterns:
    - MySQL INSERT ... ON DUPLICATE KEY UPDATE (upsert, from operator-quota-store pattern)
    - JSON column for flexible settings blob (from grid_config migration v5 pattern)
    - EdDSA JWT verification via jose (jwtVerify + importJWK, from tryDid.ts pattern)
    - TDD RED/GREEN cycle with vi.importActual for unit test isolation
key_files:
  created:
    - grid/src/api/routes/operator-me/brain-settings.ts
  modified:
    - grid/src/db/schema.ts (migration v29 appended)
    - grid/src/operator/data/operator-settings-store.ts (stub → real implementation)
    - grid/src/api/policy.ts (brain-settings route policy entry)
    - grid/src/api/routes/operator-me/index.ts (brain-settings registration)
    - grid/test/operator-me-settings.test.ts (it.todo stubs → 9 real tests)
decisions:
  - "migration v29: JSON column (not separate columns) per grid_config v5 pattern"
  - "getSettings() returns defaults without inserting — no write-on-read (Pitfall 3)"
  - "updateSettings() deep-merges local_ai sub-object so partial patches work correctly"
  - "brain-settings route marked 'public' in ROUTE_DID_POLICY with internal JWT verification"
  - "brain-settings extracts operatorDid from brain_tokens.operator_did (not from JWT iss)"
  - "TDD unit tests use vi.importActual to bypass vi.mock and test real store implementation"
metrics:
  duration: "6m"
  completed_date: "2026-05-27"
  task_count: 2
  file_count: 6
---

# Phase 40 Plan 02: Grid Persistence + Brain-JWT Settings Endpoint Summary

**One-liner:** MySQL migration v29 (operator_settings table) + real operator-settings-store with qwen3:4b defaults + Brain-JWT-authenticated settings endpoint resolving the Phase 38 auth gap.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Grid DB migration v29 + operator-settings-store.ts real implementation | e90368f | grid/src/db/schema.ts, grid/src/operator/data/operator-settings-store.ts, grid/test/operator-me-settings.test.ts |
| 2 | Brain-JWT settings endpoint (brain-settings.ts) for Brain startup auth gap | ba83e42 | grid/src/api/routes/operator-me/brain-settings.ts, grid/src/api/policy.ts, grid/src/api/routes/operator-me/index.ts, grid/test/operator-me-settings.test.ts |

## What Was Built

### Task 1 — Migration v29 + Real Settings Store

**`grid/src/db/schema.ts`** — Migration v29 appended to MIGRATIONS array:
```sql
CREATE TABLE IF NOT EXISTS operator_settings (
    grid_name    VARCHAR(63)  NOT NULL,
    operator_did VARCHAR(255) NOT NULL,
    settings     JSON         NOT NULL,
    updated_at   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (grid_name, operator_did)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
```

**`grid/src/operator/data/operator-settings-store.ts`** — Phase 39 stub replaced:
- Exports `LocalAiSettings` and `OperatorSettings` interfaces with `_version: 2`
- `getSettings()`: SELECT with default fallback — no write-on-read (Pitfall 3 mitigation)
- `updateSettings()`: deep-merges `local_ai` sub-object, persists via INSERT ... ON DUPLICATE KEY UPDATE
- Default: `{ small_model: 'qwen3:4b', primary_model: 'qwen3:4b', large_model: 'qwen3:4b', temperature: 0.7, max_tokens: 2048, _version: 2 }` (D-40-06)

**`grid/test/operator-me-settings.test.ts`** — 6 tests (it.todo → real tests):
- GET /settings returns 200 with LocalAiSettings shape + 401 without cookie
- PATCH /settings persists temperature update + returns updated shape + 401 without cookie
- `getSettings()` unit test via vi.importActual returns qwen3:4b defaults for empty DB
- `updateSettings()` unit test via vi.importActual merges patch correctly

### Task 2 — Brain-JWT Settings Endpoint

**`grid/src/api/routes/operator-me/brain-settings.ts`** — New route:
- `GET /api/v1/operator/me/brain-settings` — Brain startup settings fetch (D-40-01)
- Accepts `Authorization: Bearer <brain-jwt>` (EdDSA, Phase 38 format)
- Verifies JWT: decodes header → checks `alg=EdDSA` + `iss=did:noesis:nous:*`
- Looks up `brain_tokens` row by Brain DID, verifies EdDSA signature
- Extracts `rec.operatorDid` (human operator DID from Phase 39 ownership claim)
- Calls `getSettings(pool, gridName, operatorDid)` and returns LocalAiSettings
- Returns 401: no bearer, invalid token, revoked Brain, unknown Brain DID
- Returns 403: Brain registered but not yet claimed by operator

**`grid/src/api/policy.ts`** — Added:
```typescript
'GET /api/v1/operator/me/brain-settings': 'public',
```
(Route handles own EdDSA JWT verification — same pattern as `POST /brain/token/register`)

**`grid/test/operator-me-settings.test.ts`** — 3 new tests added:
- Valid Brain JWT with brainTokenStore returns 200 + LocalAiSettings shape
- No Authorization header → 401
- Portal session cookie (wrong auth type) → 401

## Verification Results

| Check | Result |
|-------|--------|
| `grep "version: 29" grid/src/db/schema.ts` | PASS |
| `grep "operator_settings" grid/src/operator/data/operator-settings-store.ts` | PASS |
| `grep "brain-settings" grid/src/api/routes/operator-me/index.ts` | PASS |
| `grep "qwen3:4b" grid/src/operator/data/operator-settings-store.ts` | PASS |
| `node scripts/check-operator-scope-typing.mjs` | PASS — all exported functions have operatorDid: string |
| `npm test -- operator-me-settings` | 9 passed (9) |
| Untracked files | None |

**Note on test suite reports:** The test runner reports "Failed Suites" due to a pre-existing WebSocket teardown error ("The server is not running") that appears after `app.close()`. This same error appears in Phase 39's `operator-me-quota.test.ts` (5 passed + same teardown error). All 9 tests pass; the suite-level "failure" is infrastructure noise, not test failures.

## Deviations from Plan

None — plan executed exactly as written.

The plan explicitly noted that `verifyBrainJwtAndExtractOperatorDid` in the skeleton was a placeholder and told the executor to read `tryDid.ts` and `brain-token-store.ts` before implementing. The implementation follows the exact verification pattern from `tryDid.ts` lines 73-93 and uses `rec.operatorDid` from the `BrainTokenRecord` as specified.

## Known Stubs

None. Both tasks implement real behavior (no stubs):
- `getSettings()` queries real MySQL (tested against mock pool)
- `updateSettings()` persists via real upsert (tested against mock pool)
- `brain-settings.ts` performs real EdDSA JWT verification (tested with real key pair)

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| T-40-02-01 mitigated | brain-settings.ts | EdDSA JWT verified against registered public key in brain_tokens; revoked tokens rejected; unknown Brain DIDs rejected |
| T-40-02-04 mitigated | brain-settings.ts | Route extracts operatorDid from brain_tokens.operator_did — Brain can only read settings for its claimed operator |

## TDD Gate Compliance

Task 1 TDD:
- RED: `it.todo` stubs → converted to real failing tests → confirmed 2 unit tests fail (store returns `_version: 1`, `local_ai: null`)
- GREEN: Real store implementation → all 6 tests pass

Task 2 TDD:
- RED: 3 new brain-settings tests → confirmed failing (route doesn't exist yet → 404)
- GREEN: `brain-settings.ts` + policy + registration → all 9 tests pass

## Self-Check: PASSED

Files exist:
- `grid/src/db/schema.ts`: FOUND (migration v29 present)
- `grid/src/operator/data/operator-settings-store.ts`: FOUND (LocalAiSettings, OperatorSettings, getSettings, updateSettings exported)
- `grid/src/api/routes/operator-me/brain-settings.ts`: FOUND
- `grid/src/api/policy.ts`: FOUND (brain-settings entry present)
- `grid/src/api/routes/operator-me/index.ts`: FOUND (brain-settings registered)

Commits exist:
- e90368f (Task 1): FOUND in git log
- ba83e42 (Task 2): FOUND in git log
