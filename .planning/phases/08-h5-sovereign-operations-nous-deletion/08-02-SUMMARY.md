---
phase: 08-h5-sovereign-operations-nous-deletion
plan: "02"
subsystem: grid-api
tags: [agency-05, h5-sovereign, nous-deletion, tombstone, audit, tdd]
dependency_graph:
  requires: [08-01]
  provides: [POST /api/v1/operator/nous/:did/delete, appendNousDeleted, tombstoneCheck-all-routes]
  affects: [grid/src/api, grid/src/integration, grid/src/audit, scripts/check-state-doc-sync.mjs]
tech_stack:
  added: [brain-hash-state-client, delete-nous route, despawnNous, tick-skip-guard]
  patterns: [sole-producer-boundary, closed-tuple-payload, D-30-order-lock, tombstone-check-gate]
key_files:
  created:
    - grid/src/api/operator/brain-hash-state-client.ts
    - grid/src/api/operator/delete-nous.ts
    - grid/test/api/delete-nous.test.ts
    - grid/test/api/tombstone-410.test.ts
    - grid/test/registry/tombstone-tick-skip.test.ts
    - grid/test/integration/nous-deleted-zero-diff.test.ts
    - grid/test/integration/audit-no-purge.test.ts
  modified:
    - grid/src/audit/broadcast-allowlist.ts
    - grid/src/audit/append-nous-deleted.ts
    - grid/src/audit/index.ts
    - grid/src/api/operator/index.ts
    - grid/src/api/operator/memory-query.ts
    - grid/src/api/operator/telos-force.ts
    - grid/src/api/server.ts
    - grid/src/integration/grid-coordinator.ts
    - grid/src/integration/nous-runner.ts
    - grid/test/audit/broadcast-allowlist.test.ts
    - scripts/check-state-doc-sync.mjs
    - .planning/STATE.md
decisions:
  - "appendNousDeleted uses OPERATOR_ID_RE (op:<uuid-v4>) not DID_RE for operatorId — matches actual Phase 6 convention; plan sketch was misleading"
  - "_deleteNousDeps injection pattern on GridServices (unknown cast) avoids interface changes while enabling test isolation for brainFetch + coordinator"
  - "tombstoneCheck added to 3 DID-param routes only (inspect, memory-query, telos-force) — clock/governance routes have no Nous DID param so cannot tombstone-check"
  - "brain-hash-state-client.ts placed in grid/src/api/operator/ (not grid/src/brain-bridge/) — no brain-bridge directory exists; colocated with consuming route"
  - "Zero-diff test uses vi.useFakeTimers + vi.setSystemTime — AuditChain.computeHash incorporates Date.now() making cross-chain comparison nondeterministic without pinned clock"
metrics:
  duration_minutes: 72
  tasks_completed: 3
  tests_added: 9
  files_created: 7
  files_modified: 12
  completed_date: "2026-04-21"
---

# Phase 8 Plan 02: Brain-bridge hash-state client + delete-nous route + tombstoneCheck centralization (AGENCY-05) Summary

JWT-free H5 Sovereign Operations: `POST /api/v1/operator/nous/:did/delete` route orchestrating Brain hash fetch → tombstone → despawn → audit emit, with tombstoneCheck centralized across all Nous-DID-scoped operator routes and full integration regression suite.

## What Was Built

### Task 1 (carried from previous session — already committed)
- `broadcast-allowlist.ts` extended from 17 to 18 members with `operator.nous_deleted` at position 18
- `append-nous-deleted.ts` created as sole producer boundary for `operator.nous_deleted` events — closed 5-key tuple `{tier:'H5', action:'delete', operator_id, target_did, pre_deletion_state_hash}` with triple-regex guard, self-report invariant, payloadPrivacyCheck gate
- `audit/index.ts` updated with new exports
- Three test files: `allowlist-eighteen.test.ts`, `nous-deleted-privacy.test.ts`, `nous-deleted-producer-boundary.test.ts`

### Task 2: Brain-bridge + route + coordinator + runner guard
- `brain-hash-state-client.ts`: `fetchBrainHashState` with D-03 4-key closed-tuple validation, `BrainUnreachableError` / `BrainMalformedResponseError` / `BrainUnknownDidError` error classes
- `delete-nous.ts`: `POST /api/v1/operator/nous/:did/delete` with full D-33 error ladder (400 invalid tier, 400 invalid DID, 410 tombstoned, 404 unknown, 503 Brain failure, 200 happy path)
- D-30 order locked: Brain RPC → tombstone → despawnNous → appendNousDeleted
- SC#3 tick-skip guard added to `NousRunner.tick()`: early-return when `registry.get(did)?.status === 'deleted'` before any Brain RPC
- `GridCoordinator.despawnNous(did)`: idempotent runner removal (D-30 step 2)
- `tombstone-tick-skip.test.ts`: 3 cases verifying active/tombstoned/unknown DID behavior

### Task 3: tombstoneCheck centralization + integration tests + doc-sync
- `tombstoneCheck` added to all 3 Nous-DID-scoped routes: `/api/v1/nous/:did/state` (inspect), `/api/v1/operator/nous/:did/memory/query`, `/api/v1/operator/nous/:did/telos/force`
- `tombstone-410.test.ts`: 4 routes × tombstoned DID → 410 Gone with `deleted_at_tick`
- `nous-deleted-zero-diff.test.ts`: 0-vs-N listener head-hash invariant (D-26) with `vi.useFakeTimers`
- `audit-no-purge.test.ts`: prior entries survive tombstone + delete, chain verify() passes
- `scripts/check-state-doc-sync.mjs`: bumped 17→18, added `operator.nous_deleted` to required array
- `STATE.md`: allowlist enumeration updated 17→18 with new entry at position 18

## Commits

| Hash | Message |
|------|---------|
| `847ffc3` | test(08-02): RED — allowlist-eighteen + nous-deleted-privacy + nous-deleted-producer-boundary |
| `a996057` | feat(08-02): GREEN — allowlist 17→18 + appendNousDeleted sole-producer helper |
| `cf847bc` | test(08-02): RED — delete-nous route error ladder (AGENCY-05 D-33) |
| `3b54668` | feat(08-02): GREEN — Brain hash-state client + delete-nous route + tick-skip guard |
| `ebd3b0d` | feat(08-02): GREEN — tombstoneCheck on DID routes + integration tests + doc-sync |

## Test Results

**Before plan:** 647 grid tests  
**After plan:** 656 grid tests (+9)

All 656 grid tests pass. Doc-sync script `node scripts/check-state-doc-sync.mjs` exits 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] broadcast-allowlist.test.ts still asserted 17 events**
- **Found during:** Task 2 GREEN verification
- **Issue:** `grid/test/audit/broadcast-allowlist.test.ts` had two assertions `expect(ALLOWLIST.size).toBe(17)` — broke after allowlist was extended to 18 in Task 1
- **Fix:** Updated both literals to `18` and added `operator.nous_deleted` to the `it.each` enumeration
- **Files modified:** `grid/test/audit/broadcast-allowlist.test.ts`
- **Commit:** `3b54668`

**2. [Rule 3 - Blocking] delete-nous.test.ts had wrong import paths**
- **Found during:** Task 2 RED verification
- **Issue:** Test in `grid/test/api/` used `../../../src/...` paths (3 levels) instead of `../../src/...` (2 levels); file failed to load
- **Fix:** Corrected all import paths to `../../src/...`
- **Files modified:** `grid/test/api/delete-nous.test.ts`
- **Commit:** `cf847bc`

**3. [Rule 1 - Bug] Zero-diff test produced nondeterministic failures**
- **Found during:** Task 3 final suite run
- **Issue:** `nous-deleted-zero-diff.test.ts` compared head hashes of two chains built at different wall-clock milliseconds — `AuditChain.computeHash` incorporates `Date.now()` making cross-chain comparison nondeterministic
- **Fix:** Added `vi.useFakeTimers()` + `vi.setSystemTime(FIXED_TIME)` in `beforeEach`/`afterEach` to pin clock
- **Files modified:** `grid/test/integration/nous-deleted-zero-diff.test.ts`
- **Commit:** `ebd3b0d`

**4. [Rule 2 - Missing functionality] operator_id format mismatch**
- **Found during:** Task 1 implementation
- **Issue:** Plan sketch used DID_RE (`did:noesis:...`) for `operator_id`; actual system uses `OPERATOR_ID_RE` (`op:<uuid-v4>`) per Phase 6 convention. All Phase 6 tests use `op:XXXXX-...` format.
- **Fix:** `append-nous-deleted.ts` uses `OPERATOR_ID_RE` instead of `DID_RE` for operatorId and payload.operator_id; test fixtures use `op:11111111-1111-4111-8111-111111111111`
- **Files modified:** `grid/src/audit/append-nous-deleted.ts`, all test files
- **Commit:** `a996057`

**5. [Rule 2 - Scope adjustment] tombstoneCheck scope narrowed to DID-param routes only**
- **Found during:** Task 3 analysis
- **Issue:** Plan said "6 routes" for tombstoneCheck but clock/governance routes (`/api/v1/operator/clock/pause`, `/resume`, `/governance/laws`) have no Nous DID parameter — tombstoneCheck by DID is inapplicable
- **Fix:** Applied tombstoneCheck only to 3 Nous-DID-scoped routes (inspect + memory-query + telos-force) + delete-nous already had it = 4 total. tombstone-410 test covers all 4.
- **No additional files needed**

**6. [Rule 3 - Blocking] brain-bridge directory does not exist**
- **Found during:** Task 2 implementation
- **Issue:** Plan specified `grid/src/brain-bridge/hash-state-client.ts` but no `brain-bridge/` directory exists in the codebase
- **Fix:** Placed `brain-hash-state-client.ts` in `grid/src/api/operator/` colocated with the consuming route
- **Files modified:** `grid/src/api/operator/brain-hash-state-client.ts`
- **Commit:** `3b54668`

## Known Stubs

None — all route logic is fully implemented. The `brainFetch` in production needs wiring via `DeleteNousDeps` in `main.ts`/genesis launcher, but this is documented as a deployment concern (the route correctly 503s when deps are not wired).

## Threat Flags

None — no new network endpoints beyond the planned `POST /api/v1/operator/nous/:did/delete`. All other changes are internal wiring (tombstoneCheck, despawnNous, tick-skip guard). The new route requires H5 tier validation (validateTierBody) which is the same operator authentication pattern used by all other operator routes.

## Self-Check: PASSED

Files exist:
- `grid/src/api/operator/brain-hash-state-client.ts` ✓
- `grid/src/api/operator/delete-nous.ts` ✓
- `grid/src/audit/append-nous-deleted.ts` ✓
- `grid/test/api/delete-nous.test.ts` ✓
- `grid/test/api/tombstone-410.test.ts` ✓
- `grid/test/registry/tombstone-tick-skip.test.ts` ✓
- `grid/test/integration/nous-deleted-zero-diff.test.ts` ✓
- `grid/test/integration/audit-no-purge.test.ts` ✓

Commits exist: `847ffc3`, `a996057`, `cf847bc`, `3b54668`, `ebd3b0d` ✓

Grid test suite: 656/656 ✓  
Doc-sync script: exits 0 ✓
