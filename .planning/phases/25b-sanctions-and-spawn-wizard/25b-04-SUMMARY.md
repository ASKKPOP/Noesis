---
phase: 25b-sanctions-and-spawn-wizard
plan: "04"
subsystem: grid-operator-auth
tags: [header-auth, security, operator, h5, delete-nous, wave-0]
dependency_graph:
  requires: []
  provides: [delete-nous-header-auth]
  affects: [grid/src/api/operator/delete-nous.ts]
tech_stack:
  added: []
  patterns: [header-trust-auth, fastify-inject-tests]
key_files:
  created:
    - grid/test/operator/delete-nous.test.ts
  modified:
    - grid/src/api/operator/delete-nous.ts
    - grid/test/api/delete-nous.test.ts
    - grid/test/api/operator/delete-nous-bios-death.test.ts
decisions:
  - "Use Fastify({ logger: false }) + registerDeleteNousRoute directly in tests (vs buildServer) to avoid WebSocket hub startup"
metrics:
  duration: ~12m
  completed: "2026-05-22T04:17:47Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 4
---

# Phase 25b Plan 04: delete-nous Header-Auth Migration (H5) Summary

Header-auth migration of `delete-nous.ts` from body-trust to header-trust authentication, preserving the ORDER-LOCKED bios.death → operator.nous_deleted audit emit sequence.

## What Was Built

Migrated `grid/src/api/operator/delete-nous.ts` (H5 Sovereign Operations) from `validateTierBody` / `OperatorBody` body-trust pattern to the 25a-07 canonical header-auth pattern per D-25b-NEW-1. The tier gate now requires `x-operator-tier >= 5` from a server-trusted header; the operator identity is sourced from `x-operator-id` header validated against `OPERATOR_ID_REGEX`. Both audit emit calls (`appendBiosDeath` and `appendNousDeleted`) now use `resolvedOperatorId` from the header. ORDER-LOCKED D-30 sequence fully preserved.

## Tasks

### Task 1: Migrate delete-nous.ts to header-auth (H5)
**Commit:** 7fb706d

- Removed `validateTierBody, type OperatorBody` from `_validation.js` import
- Added `OPERATOR_ID_REGEX` import from `../types.js`
- Replaced body-trust block with header-trust block (401 tier_missing / 403 tier_too_low / 400 invalid_operator_id)
- Body type changed to `never` (route body is now unused for auth)
- `const resolvedTier: 'H5' = 'H5'` and `const resolvedOperatorId = opIdHeader`
- Both `appendBiosDeath` and `appendNousDeleted` calls updated to use resolved values
- ORDER-LOCKED D-30 comment block updated to reflect 4-step sequence (tombstone → despawn → bios.death → nous_deleted)
- TypeScript compiles clean (`tsc --noEmit` returns 0)

### Task 2: Regression tests for header-auth + ORDER-LOCKED preservation
**Commit:** b51423d

Created `grid/test/operator/delete-nous.test.ts` (10 tests) pinning:
- 401 tier_missing: no headers + body `{tier:'H5'}` rejected
- 403 tier_too_low: `x-operator-tier: '4'` (< 5) rejected
- 400 invalid_operator_id: bad header format rejected
- 401 tier_missing: non-numeric header `'H5'` rejected
- 200 success: body tier field ignored, header tier used in audit payload
- ORDER-LOCKED: bios.death(cause=operator_h5) immediately precedes operator.nous_deleted
- operator_id in nous_deleted payload === header x-operator-id
- bios.death index < operator.nous_deleted index in chain
- bios.death.final_state_hash === operator.nous_deleted.pre_deletion_state_hash
- No audit events on Brain RPC failure (SC#3 invariant)

Updated existing tests at:
- `grid/test/api/delete-nous.test.ts` (13 tests): switched from `buildServer` to lightweight `Fastify({ logger: false }) + registerDeleteNousRoute` — the old tests were already broken pre-Phase-25b because `buildServer` starts a WebSocket hub that causes teardown errors when used in unit tests. Updated all inject calls to use headers instead of body.
- `grid/test/api/operator/delete-nous-bios-death.test.ts` (4 tests): same lightweight pattern fix + added operator_id header assertion.

Total: 27 delete-nous tests, all passing.

## Verification

```
grep -n "validateTierBody" grid/src/api/operator/delete-nous.ts
# → no output (clean)

grep -n "tierNum < 5" grid/src/api/operator/delete-nous.ts
# → 95: if (tierNum < 5) {

npx vitest run test/api/delete-nous.test.ts test/api/operator/delete-nous-bios-death.test.ts test/operator/delete-nous.test.ts
# → Test Files 3 passed (3), Tests 27 passed (27)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing test failures (buildServer WebSocket teardown)**
- **Found during:** Task 2
- **Issue:** Both `test/api/delete-nous.test.ts` and `test/api/operator/delete-nous-bios-death.test.ts` used `buildServer()` which starts the full WebSocket hub. On `app.close()`, the WS server teardown threw "The server is not running" for every test, causing all tests to fail. This was a pre-existing issue unrelated to my auth migration (confirmed by stashing my changes and seeing same failures).
- **Fix:** Switched both files to use `Fastify({ logger: false }) + registerDeleteNousRoute(app, services, deleteNousDeps)` (lightweight pattern from cognitive-snapshot.test.ts). Deps are passed directly rather than via `_deleteNousDeps` escape hatch.
- **Files modified:** `test/api/delete-nous.test.ts`, `test/api/operator/delete-nous-bios-death.test.ts`
- **Commits:** b51423d

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes were introduced. This plan only hardened an existing endpoint.

## Known Stubs

None.

## Self-Check: PASSED

Files created/modified exist on disk:
- grid/src/api/operator/delete-nous.ts: FOUND
- grid/test/operator/delete-nous.test.ts: FOUND
- grid/test/api/delete-nous.test.ts: FOUND
- grid/test/api/operator/delete-nous-bios-death.test.ts: FOUND

Commits exist:
- 7fb706d (feat): FOUND
- b51423d (test): FOUND
