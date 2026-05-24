---
phase: 25b-sanctions-and-spawn-wizard
plan: "03"
subsystem: grid/operator
tags: [header-auth, security, operator, h4, telos-force, wave-0]
dependency_graph:
  requires: []
  provides: [telos-force header-auth H4]
  affects: [grid/src/api/operator/telos-force.ts, grid/test/operator/telos-force.test.ts]
tech_stack:
  added: []
  patterns: [header-trust auth, sole-producer audit emit, H4 tier gate]
key_files:
  modified:
    - grid/src/api/operator/telos-force.ts
  created:
    - grid/test/operator/telos-force.test.ts
decisions:
  - "Header-trust auth replaces body-trust: x-operator-tier/x-operator-id headers enforced; body tier/operator_id rejected"
  - "H4 tier gate: tierNum < 4 → 403 tier_too_low; resolvedTier = 'H4'"
  - "ForceTelosBody drops tier/operator_id fields; retains new_telos — body-level telos statement still parsed"
  - "Audit emit uses resolvedOperatorId (header) not body value — closes GAP D-25b-NEW-1"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-22T04:09:03Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 1
  files_created: 1
---

# Phase 25b Plan 03: telos-force Header-Auth (H4) Summary

**One-liner:** Migrated `telos-force.ts` from body-trust to header-trust H4 auth; 23 regression tests pin the contract.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Migrate telos-force.ts to header-auth (H4) | 6a4f9af | grid/src/api/operator/telos-force.ts |
| 2 | Regression tests for telos-force header-auth contract | 147be9d | grid/test/operator/telos-force.test.ts |

## What Was Built

### Task 1: telos-force.ts migration

Replaced `validateTierBody(body, 'H4')` with the canonical header-auth block from `cognitive-snapshot.ts`:

- `x-operator-tier` header → parsed → `< 4` gate → 403 `tier_too_low`
- `x-operator-id` header → `OPERATOR_ID_REGEX` validation → 400 `invalid_operator_id`
- `resolvedTier: 'H4'` and `resolvedOperatorId` flow into audit emit
- `validateTierBody` and `OperatorBody` imports removed
- `ForceTelosBody` no longer extends `OperatorBody`; only contains `new_telos?: unknown`
- All downstream audit emit references updated from `v.tier`/`v.operator_id` to `resolvedTier`/`resolvedOperatorId`

### Task 2: Regression tests

23 tests covering the full H4 header-auth contract:

- 401 `tier_missing`: no header, non-numeric header
- 403 `tier_too_low`: tier 3, tier 1 (below H4 threshold)
- 400 `invalid_operator_id`: legacy format, missing header
- Body tier field ignored (body `{tier:'H1'}` with valid headers → 200)
- `new_telos` body field still validated (missing/string/array → 400)
- Audit emit: operator_id sourced from header not body
- Sole-producer invariant: no emit on 404, 503 error paths
- 410 tombstoned DID

## Deviations from Plan

None — plan executed exactly as written. The TDD note says Task 2 is `tdd="true"`, but since Task 1 was implemented first (as required by the task ordering in the plan), tests were written after implementation and confirmed GREEN immediately.

## Verification

```
grep -n "validateTierBody" grid/src/api/operator/telos-force.ts
# Returns: (nothing — import removed)

grep -n "tierNum < 4" grid/src/api/operator/telos-force.ts
# Returns: 73:            if (tierNum < 4) {
```

All 23 tests passed: `vitest run test/operator/telos-force.test.ts` → 23/23.

## Threat Model Coverage

| Threat ID | Category | Status |
|-----------|----------|--------|
| T-25b-03-01 | Elevation of Privilege | Mitigated — H4 header gate + regression tests pin contract |

## Self-Check: PASSED

- `grid/src/api/operator/telos-force.ts` — EXISTS
- `grid/test/operator/telos-force.test.ts` — EXISTS
- Commit `6a4f9af` — EXISTS (feat: migrate telos-force.ts to header-auth)
- Commit `147be9d` — EXISTS (test: regression tests for telos-force)
