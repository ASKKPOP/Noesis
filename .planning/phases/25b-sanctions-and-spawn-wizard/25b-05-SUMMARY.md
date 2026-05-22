---
phase: 25b-sanctions-and-spawn-wizard
plan: "05"
subsystem: grid/operator
tags: [header-auth, security, operator, h2, memory-query]
dependency_graph:
  requires: []
  provides: [memory-query-header-auth]
  affects: [grid/src/api/operator/memory-query.ts, grid/test/operator/memory-query.test.ts, grid/test/api/operator/memory.test.ts]
tech_stack:
  added: []
  patterns: [header-trust-auth, OPERATOR_ID_REGEX, closed-tuple-audit]
key_files:
  modified:
    - grid/src/api/operator/memory-query.ts
    - grid/test/api/operator/memory.test.ts
  created:
    - grid/test/operator/memory-query.test.ts
decisions:
  - "Followed D-25b-NEW-1 header-trust pattern verbatim from cognitive-snapshot.ts"
  - "Pre-existing memory.test.ts WebSocket teardown failure is out-of-scope (pre-dates this plan)"
  - "Body QueryBody retains only query/limit; tier/operator_id body fields silently ignored"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-22T04:11:35Z"
  tasks_completed: 2
  files_modified: 3
---

# Phase 25b Plan 05: memory-query Header-Auth Migration (H2) Summary

Header-trust auth for `memory-query.ts` using `x-operator-tier` + `x-operator-id` headers, H2 gate, with 21 regression tests covering body-tier immunity (T-25b-05-01).

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Migrate memory-query.ts to header-auth (H2) | `ee7b258` | `grid/src/api/operator/memory-query.ts` |
| 2 | Regression tests for header-auth contract | `d7c79a3` | `grid/test/operator/memory-query.test.ts`, `grid/test/api/operator/memory.test.ts` |

## What Was Built

**Task 1 — Implementation:**
- Removed `validateTierBody` and `OperatorBody` imports from `_validation.js`
- Added `OPERATOR_ID_REGEX` import from `../types.js` (mirrors `cognitive-snapshot.ts:41`)
- Replaced body-trust tier gate with header-trust block: read `x-operator-tier` header, parse to int, reject if non-string (401 `tier_missing`) or non-finite (401 `tier_missing`) or `< 2` (403 `tier_too_low`)
- Added operator-id gate: read `x-operator-id` header, validate against `OPERATOR_ID_REGEX`, reject with 400 `invalid_operator_id` if invalid
- Set `const resolvedTier: 'H2' = 'H2'` and `const resolvedOperatorId = opIdHeader`
- Stripped `tier` and `operator_id` from `QueryBody` interface — body now carries only `query?: unknown` and `limit?: unknown`
- Updated audit emit to use `resolvedTier`/`resolvedOperatorId` (not `v.tier`/`v.operator_id`)
- Memory-shaping logic (query/limit) preserved exactly — only auth surface changed

**Task 2 — Tests:**
- New `grid/test/operator/memory-query.test.ts`: 21 tests covering:
  - Tier header gate: missing header → 401, non-numeric → 401, tier 1 → 403, tier 2 → 200, tier 5 → 200
  - Operator-id gate: missing header → 400, legacy form → 400
  - Body-tier immunity (T-25b-05-01): body `tier: 'H5'` with header `tier: 2` → 200, audit records `H2`
  - GAP-25a-1: audit `operator_id` sourced from header, not body
  - Query body fields: missing query → 400, non-numeric limit → 400, valid → 200 with entries
  - DID validation: malformed → 400, tombstoned → 410
  - Runner/brain: unknown_nous → 404, disconnected → 503, RPC throws → 503
  - Sole-producer: emits only on success, never on 401/404/503
- Updated `grid/test/api/operator/memory.test.ts`: 7 existing tests retrofitted from body-trust to header-trust — added `VALID_HEADERS` constant, sent `x-operator-tier`/`x-operator-id` headers, removed `tier`/`operator_id` from payloads

## Verification

- `npm --prefix grid run test -- run test/operator/memory-query.test.ts`: 21/21 pass
- `grep -n "validateTierBody" grid/src/api/operator/memory-query.ts`: returns nothing (confirmed)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Retrofitted pre-existing test file to header-trust contract**
- **Found during:** Task 2
- **Issue:** `grid/test/api/operator/memory.test.ts` tested the old body-trust contract, which now fails at the tier gate (401 instead of expected 200/400/404) because the endpoint no longer reads auth from the body
- **Fix:** Updated 7 existing tests: added `VALID_HEADERS`, send `x-operator-tier`/`x-operator-id` headers, remove `tier`/`operator_id` from payloads; Test 2 updated from `invalid_tier → 400` to `tier_missing → 401` (body tier is now ignored)
- **Files modified:** `grid/test/api/operator/memory.test.ts`
- **Commit:** `d7c79a3`

## Known Stubs

None — implementation is complete. The memory query body fields (query, limit) are fully wired.

## Threat Flags

None — no new network endpoints or trust boundaries introduced. This plan only hardens the auth model of an existing endpoint.

## Deferred Issues

**Pre-existing: `grid/test/api/operator/memory.test.ts` WebSocket teardown failure**
- All 7 tests in this file report "The server is not running" from `WebSocketServer` cleanup in `afterEach`
- This failure pre-dates Plan 25b-05 (confirmed via `git stash` — same failures on original code)
- Root cause: `buildServer()` starts a WebSocket server; the test's `afterEach` calls `app.close()` but Tests 6+7 manually close the app inside the test body and rebuild it, leaving the outer `afterEach` trying to close an already-closed server
- Out of scope for this plan — tracked for a future test-infra cleanup

## Self-Check: PASSED

- `grid/src/api/operator/memory-query.ts` — FOUND
- `grid/test/operator/memory-query.test.ts` — FOUND
- `25b-05-SUMMARY.md` — FOUND
- Commit `ee7b258` (feat) — FOUND
- Commit `d7c79a3` (test) — FOUND
- `validateTierBody` not present in `memory-query.ts` — CONFIRMED
