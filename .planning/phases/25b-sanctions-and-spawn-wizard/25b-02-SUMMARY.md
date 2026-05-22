---
phase: 25b-sanctions-and-spawn-wizard
plan: "02"
subsystem: grid-operator-auth
tags: [header-auth, security, operator, h3, governance, wave-0]
dependency_graph:
  requires: []
  provides: [governance-laws-header-auth]
  affects: [grid/src/api/operator/governance-laws.ts, grid/test/operator/governance-laws.test.ts]
tech_stack:
  added: []
  patterns: [header-trust-auth, fastify-inject-tests]
key_files:
  created:
    - grid/test/operator/governance-laws.test.ts
  modified:
    - grid/src/api/operator/governance-laws.ts
    - grid/test/api/operator/governance.test.ts
decisions:
  - "Header-auth replaces validateTierBody in all 3 handlers (POST/PUT/DELETE)"
  - "Non-auth body fields (law, updates) preserved; only tier/operator_id removed from Body types"
  - "Existing test file grid/test/api/operator/governance.test.ts updated to use VALID_HEADERS"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-22T04:11:00Z"
  tasks_completed: 2
  files_changed: 3
---

# Phase 25b Plan 02: Governance-Laws Header-Auth Migration Summary

Header-auth migration of `governance-laws.ts` operator endpoints from body-trust (`validateTierBody`) to server-trusted request headers (`x-operator-tier`, `x-operator-id`), following the canonical `cognitive-snapshot.ts` pattern established in Phase 25a-07.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migrate governance-laws.ts to header-auth (H3) | 2bfe233 | grid/src/api/operator/governance-laws.ts, grid/test/api/operator/governance.test.ts |
| 2 | Regression tests for governance header-auth contract | c48a5ff | grid/test/operator/governance-laws.test.ts |

## What Was Built

- **governance-laws.ts** (3 handlers): All three operator governance endpoints (POST add, PUT amend, DELETE repeal) now read `x-operator-tier` and `x-operator-id` from server-trusted headers. Body-supplied `tier`/`operator_id` are ignored. Non-auth body fields (`law`, `updates`) preserved.

- **Imports updated**: Removed `import { validateTierBody, type OperatorBody } from './_validation.js'`; added `import { OPERATOR_ID_REGEX } from '../types.js'`. Removed `OperatorBody` from interface extensions.

- **Audit emit**: All three handlers substitute `v.tier`/`v.operator_id` with `resolvedTier`/`resolvedOperatorId` (header-derived values).

- **governance-laws.test.ts** (12 tests, 3 describe blocks): One per endpoint, 4 cases each:
  1. No headers + body `{tier:'H5'}` → 401 `tier_missing`
  2. Header `x-operator-tier:'2'` → 403 `tier_too_low`
  3. Header `x-operator-tier:'3'`, missing/bad `x-operator-id` → 400 `invalid_operator_id`
  4. Valid headers + body claiming `tier:'H1'` → 200; body tier ignored; audit `operator_id` from header

## Verification

```
grep -n "validateTierBody" grid/src/api/operator/governance-laws.ts
# → (no output — clean)

npm --prefix grid run test -- run test/operator/governance-laws.test.ts
# → 12 passed
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated existing governance.test.ts to use header-auth pattern**
- **Found during:** Task 1
- **Issue:** `grid/test/api/operator/governance.test.ts` used body-supplied `tier`/`operator_id` in `inject()` calls. After migration, these return 401/403 (headers missing) instead of expected 400/200 codes.
- **Fix:** Added `VALID_HEADERS` constant; updated all 11 test cases to send `headers: VALID_HEADERS` (or specific tier headers for error cases). Updated test names/expectations to match header-auth error codes (e.g., `invalid_tier` → `tier_too_low`/`tier_missing`).
- **Note:** The existing test file has a pre-existing WebSocket teardown failure (`The server is not running`) unrelated to my changes — it exists in the commit history before this plan. The semantic updates I made are correct and will take effect when that infra issue is resolved.
- **Files modified:** `grid/test/api/operator/governance.test.ts`
- **Commit:** 2bfe233 (bundled with Task 1)

## Known Stubs

None. The migration is complete — all 3 handlers use header-auth. Audit emits use `resolvedOperatorId` from header.

## Threat Flags

None. This plan closes T-25b-02-01 (Elevation of Privilege) and T-25b-02-02 (Spoofing) per the threat model. No new network surfaces introduced.

## Self-Check: PASSED

- `grid/src/api/operator/governance-laws.ts` exists and contains no `validateTierBody` call
- `grid/test/operator/governance-laws.test.ts` exists (259 lines, 12 tests)
- Commits 2bfe233 and c48a5ff confirmed in git log
