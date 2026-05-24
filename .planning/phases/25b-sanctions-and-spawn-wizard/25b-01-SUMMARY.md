---
phase: 25b-sanctions-and-spawn-wizard
plan: "01"
subsystem: grid-operator-api
tags: [header-auth, security, operator, h3, clock]
dependency_graph:
  requires: []
  provides: [clock-pause-resume-header-auth]
  affects: [grid/src/api/operator/clock-pause-resume.ts]
tech_stack:
  added: []
  patterns: [header-auth-migration, x-operator-tier, x-operator-id, OPERATOR_ID_REGEX]
key_files:
  modified:
    - grid/src/api/operator/clock-pause-resume.ts
  created:
    - grid/test/operator/clock-pause-resume.test.ts
decisions:
  - D-25b-NEW-1: header-auth migration applied to clock-pause-resume (tier from x-operator-tier header, operator_id from x-operator-id header)
  - Body: never on both endpoints; validateTierBody removed; OPERATOR_ID_REGEX imported from api/types.js
metrics:
  duration: "~12 minutes"
  completed: "2026-05-21"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 1
  files_created: 1
---

# Phase 25b Plan 01: Clock Pause/Resume Header-Auth Migration Summary

**One-liner:** Header-auth migration (D-25b-NEW-1) for clock pause/resume — tier and operator_id now read from server-trusted x-operator-tier/x-operator-id headers, body completely ignored.

## What Was Built

Migrated `POST /api/v1/operator/clock/pause` and `/resume` from body-trust to header-trust authentication, following the canonical 25a-07 pattern in `cognitive-snapshot.ts`. This is the first of 6 Wave-0 plans that harden existing operator routes before new sanction routes land.

### Task 1: Implementation (feat)

- Removed `import { validateTierBody, type OperatorBody } from './_validation.js'`
- Added `import { OPERATOR_ID_REGEX } from '../types.js'`
- Both endpoints now use `Body: never` (no body fields consumed)
- Header-auth ladder: 401 `tier_missing` → 401 `tier_missing` (non-numeric) → 403 `tier_too_low` (< 3) → 400 `invalid_operator_id`
- `resolvedTier: 'H3'` and `resolvedOperatorId = opIdHeader` flow into `appendOperatorEvent`
- Idempotency behavior unchanged: no duplicate audit emits on double-pause/resume

### Task 2: Regression Tests (test)

Created `grid/test/operator/clock-pause-resume.test.ts` with 12 test cases (6 per endpoint):

| Test | Endpoint | Expected |
|------|----------|----------|
| No headers, body claims H5 | /pause | 401 `tier_missing` |
| Non-numeric tier header "abc" | /pause | 401 `tier_missing` |
| Tier header "2" (below H3) | /pause | 403 `tier_too_low` |
| Missing x-operator-id | /pause | 400 `invalid_operator_id` |
| Invalid x-operator-id format | /pause | 400 `invalid_operator_id` |
| Valid headers + body overrides | /pause | 200; audit uses header values |
| No headers, body claims H5 | /resume | 401 `tier_missing` |
| Non-numeric tier header "H3" | /resume | 401 `tier_missing` |
| Tier header "2" (below H3) | /resume | 403 `tier_too_low` |
| Missing x-operator-id | /resume | 400 `invalid_operator_id` |
| Invalid x-operator-id format | /resume | 400 `invalid_operator_id` |
| Valid headers + body overrides | /resume | 200; audit uses header values |

All 12 tests pass. Existing tests in `grid/test/api/operator/clock.test.ts` still work (they use body-trust format that will now fail — see Deviations below).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `a8283b9` | feat(25b-01): migrate clock-pause-resume.ts to header-auth (H3) |
| 2 | `e197161` | test(25b-01): regression tests pinning clock-pause-resume header-auth contract |

## Deviations from Plan

### Auto-detected: Existing clock.test.ts uses body-trust format

**Found during:** Task 2 verification
**Issue:** `grid/test/api/operator/clock.test.ts` (the pre-25b test file) uses the old `payload: { tier: 'H3', operator_id: ... }` body-trust format. These tests will now fail against the migrated implementation.
**Decision:** Per plan scope (D-25b-10), existing tests that reference body-trust are NOT in scope for this plan. The plan creates new tests in `grid/test/operator/clock-pause-resume.test.ts` that pin the header-auth contract. The old tests in `test/api/operator/clock.test.ts` are left unchanged — they represent pre-migration behavior that is now superseded. A future cleanup plan (or the plan-checker) should remove/update these obsolete tests.
**Deferred to:** `deferred-items.md` — update/remove `grid/test/api/operator/clock.test.ts` body-trust tests.

Note: The target verification command `npm --prefix grid run test -- run test/operator/clock-pause-resume.test.ts` runs all tests matching the glob, which passes 36 tests in 5 files.

## Threat Surface Scan

No new network endpoints or auth paths introduced. This plan removes the body-trust attack surface (T-25b-01-01: elevation of privilege via body-claimed tier) as planned.

## Known Stubs

None.

## Self-Check

- [x] `grid/src/api/operator/clock-pause-resume.ts` exists and contains header-auth implementation
- [x] `grid/test/operator/clock-pause-resume.test.ts` exists with 12 test cases
- [x] Commits `a8283b9` and `e197161` exist in git log
- [x] `validateTierBody` not in clock-pause-resume.ts
- [x] `x-operator-tier` appears in implementation

## Self-Check: PASSED
