---
phase: 25b-sanctions-and-spawn-wizard
plan: "06"
subsystem: grid/operator
tags: [header-auth, security, operator, h5, export, wave-0]
requirements: [D-25b-NEW-1, D-25b-10]

dependency-graph:
  requires:
    - grid/src/api/operator/_validation.ts (removed import)
    - grid/src/api/types.ts (OPERATOR_ID_REGEX)
    - grid/src/audit/append-operator-exported.ts (sole-producer emitter)
  provides:
    - grid/src/api/operator/export-replay.ts (header-trust H5 auth)
    - grid/test/operator/export-replay.test.ts (regression tests)
  affects:
    - Wave 0 completion: all 6 operator routes now on header-trust auth

tech-stack:
  added: []
  patterns:
    - header-trust auth (cognitive-snapshot.ts analog, D-25b-NEW-1)
    - OPERATOR_ID_REGEX validation from ../types.js
    - resolvedOperatorId from x-operator-id header → audit emit

key-files:
  created:
    - grid/test/operator/export-replay.test.ts
  modified:
    - grid/src/api/operator/export-replay.ts

decisions:
  - "Body type simplified to {start_tick, end_tick} — OperatorBody removed; tier/operator_id no longer accepted from body"
  - "resolvedTier: 'H5' literal replaces v.tier from validateTierBody"
  - "resolvedOperatorId from x-operator-id header replaces v.operator_id in appendOperatorExported call"
  - "vi.mock factories use inline literals (not module-level consts) to avoid vitest hoisting error"

metrics:
  duration: "~15 minutes"
  completed: "2026-05-22"
  tasks-completed: 2
  tasks-total: 2
  files-modified: 1
  files-created: 1
---

# Phase 25b Plan 06: Export-Replay Header-Auth Migration Summary

**One-liner:** Migrated `export-replay.ts` from `validateTierBody` body-trust to H5 header-trust auth (`x-operator-tier`/`x-operator-id`), with `operator.exported` audit emit sourcing `operator_id` from the server-trusted header.

## What Was Built

### Task 1: Migrate export-replay.ts to header-auth (H5)

`grid/src/api/operator/export-replay.ts` was migrated following the canonical `cognitive-snapshot.ts` pattern (D-25b-NEW-1):

- **Removed:** `import { validateTierBody, type OperatorBody } from './_validation.js'`
- **Added:** `import { OPERATOR_ID_REGEX } from '../types.js'`
- **Tier gate:** Reads `x-operator-tier` header → `parseInt` → `if (tierNum < 5)` → 403 `tier_too_low`
- **Operator-id gate:** Reads `x-operator-id` header → `OPERATOR_ID_REGEX.test` → 400 `invalid_operator_id`
- **Resolved values:** `const resolvedTier: 'H5' = 'H5'` and `const resolvedOperatorId = opIdHeader`
- **Audit emit:** `appendOperatorExported` called with `resolvedOperatorId` (not body), closing T-25b-06-02
- **Body type:** `ExportReplayBody` simplified to `{start_tick?, end_tick?}` — `OperatorBody` extension dropped

### Task 2: Regression tests (TDD)

`grid/test/operator/export-replay.test.ts` created (15 tests, all passing):

**Header-gate tests:**
- No headers → 401 `tier_missing` (body-trust rejection)
- `x-operator-tier: 'H5'` (non-numeric) → 401 `tier_missing`
- `x-operator-tier: '4'` → 403 `tier_too_low`
- `x-operator-tier: '1'` → 403 `tier_too_low`
- Missing `x-operator-id` → 400 `invalid_operator_id`
- Invalid `x-operator-id` format → 400 `invalid_operator_id`

**Body-trust rejection:**
- Valid headers + `{tier: 'H1', start_tick, end_tick}` → 200 (body tier ignored)
- Valid headers + body without tier → 200

**Audit emit assertions (T-25b-06-02):**
- `operator.exported.operator_id === header value`, NOT body value
- `entry.actorDid === headerOpId`
- Emit only on success path (not on 401/403)
- Audit `tier` field is `'H5'`

**Response header assertions:**
- `X-Tarball-Hash` present on 200
- `Content-Type: application/octet-stream` on 200

## Verification

```
grep -n "validateTierBody" grid/src/api/operator/export-replay.ts  → (nothing — PASS)
grep -n "tierNum < 5" grid/src/api/operator/export-replay.ts       → line 79 (PASS)
npm --prefix grid run test -- run test/operator/export-replay.test.ts → 15/15 pass (PASS)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vi.mock hoisting — FAKE_TARBALL_BYTES referenced before initialization**
- **Found during:** Task 2 — first test run
- **Issue:** `vi.mock` factories are hoisted to top of file; referencing module-level `const FAKE_TARBALL_BYTES` inside the factory caused `ReferenceError: Cannot access 'FAKE_TARBALL_BYTES' before initialization`
- **Fix:** Replaced `FAKE_TARBALL_BYTES` reference with inline `Buffer.from('fake-tarball')` and `FAKE_TARBALL_HASH` with inline `'a'.repeat(64)` inside mock factories. Module-level `FAKE_TARBALL_HASH` kept for test body assertions.
- **Files modified:** `grid/test/operator/export-replay.test.ts`
- **Commit:** 20b3486

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 7a21aba | feat(25b-06) | migrate export-replay.ts to header-trust auth (H5) |
| 20b3486 | test(25b-06) | regression tests for export-replay header-auth + audit emit |

## Known Stubs

None. Export tarball generation pipeline unchanged for valid header-auth requests.

## Threat Surface Scan

No new network endpoints or auth paths introduced. This migration closes T-25b-06-01 (Elevation of Privilege) and T-25b-06-02 (Repudiation) from the plan's threat register.

## Self-Check: PASSED

- `grid/src/api/operator/export-replay.ts` — FOUND
- `grid/test/operator/export-replay.test.ts` — FOUND
- Commit `7a21aba` — FOUND
- Commit `20b3486` — FOUND
