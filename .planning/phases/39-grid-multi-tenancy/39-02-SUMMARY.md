---
phase: 39-grid-multi-tenancy
plan: "02"
subsystem: grid/db
tags: [tdd, schema-migration, multi-tenancy, wave-1, TENANT-01, TENANT-03]
dependency_graph:
  requires:
    - grid/test/db/schema-v27-v28.test.ts  (Plan 01 RED stubs)
    - grid/test/db/brain-token-store-owner.test.ts  (Plan 01 GREEN stubs)
  provides:
    - grid/src/db/schema.ts (migrations v27, v28)
    - grid/src/db/stores/brain-token-store.ts (setOwner, findByOperator, countActiveByOperator)
    - grid/src/operator/data/operator-brain-store.ts
    - grid/src/operator/data/operator-quota-store.ts
    - grid/src/operator/data/operator-settings-store.ts
  affects:
    - grid/src/api/routes/brain-token.ts (minor: operatorDid: null added to upsert call)
tech_stack:
  added: []
  patterns:
    - Additive ALTER TABLE migration pattern (v27 — extends brain_tokens)
    - CREATE TABLE IF NOT EXISTS pattern (v28 — operator_quota_overrides)
    - "UPDATE WHERE col IS NULL" atomic first-claimer ownership pattern (D-39-01 / T-39-02-01)
    - INSERT ... ON DUPLICATE KEY UPDATE upsert pattern (setQuotaOverride)
    - operatorDid: string in every operator/data/ function signature (D-39-10 CI gate prep)
key_files:
  created:
    - grid/src/operator/data/operator-brain-store.ts
    - grid/src/operator/data/operator-quota-store.ts
    - grid/src/operator/data/operator-settings-store.ts
  modified:
    - grid/src/db/schema.ts
    - grid/src/db/stores/brain-token-store.ts
    - grid/src/api/routes/brain-token.ts
decisions:
  - "Migration SQL column alignment spaces removed to match regex patterns in test assertions"
  - "operatorDid added as required (not optional) on BrainTokenRecord — forces all callers to be explicit about ownership state"
  - "brain-token.ts upsert passes operatorDid: null per D-39-01 two-step claim model"
  - "operator-settings-store.ts is a placeholder (void operatorDid + default object) — Phase 40 will add DB persistence"
metrics:
  duration: "346s"
  completed: "2026-05-27T02:27:14Z"
  tasks_completed: 2
  files_created: 3
  files_modified: 3
---

# Phase 39 Plan 02: DB Layer — Migrations v27/v28 + BrainTokenStore Ownership Methods + operator/data/ Module

Establishes the data foundation for operator tenancy: schema extended with two new migrations, BrainTokenStore gains three ownership methods, and the new operator/data/ module provides CI-gate-ready typed data accessors.

## What Was Built

**Migration v27 — add_operator_did_to_brain_tokens** (`grid/src/db/schema.ts`):
- `ALTER TABLE brain_tokens ADD COLUMN operator_did VARCHAR(255) NULL DEFAULT NULL`
- `ADD INDEX idx_operator_did (grid_name, operator_did)`
- NULL = unclaimed Brain (functional but unowned per D-39-02)
- `operator_did IS NULL` check in setOwner is the atomic first-claimer guard (T-39-02-01)

**Migration v28 — create_operator_quota_overrides** (`grid/src/db/schema.ts`):
- New table: `operator_quota_overrides (grid_name, operator_did PK, brain_process_limit DEFAULT 3, event_rate_per_did_per_min DEFAULT 600, p2p_bandwidth_cap_bytes NULL)`
- If no row exists for operator → getQuotaLimit falls back to `grid_config 'quota.brain_processes_default'` → hard-coded default 3

**BrainTokenStore extensions** (`grid/src/db/stores/brain-token-store.ts`):
- `BrainTokenRecord.operatorDid: string | null` — new required field
- `setOwner(brainDid, operatorDid)` — `UPDATE WHERE operator_did IS NULL` (atomic, first claimer wins)
- `findByOperator(operatorDid)` — returns non-revoked tokens for operator
- `countActiveByOperator(operatorDid)` — for quota enforcement at claim time

**operator/data/ module** (3 files, all with `operatorDid: string` parameter for CI gate D-39-10):
- `operator-brain-store.ts` — standalone versions of findByOperator, countActiveByOperator, setOwner
- `operator-quota-store.ts` — getQuotaLimit, getEventRateLimit, getFullQuota, setQuotaOverride with override-then-fallback pattern
- `operator-settings-store.ts` — placeholder getSettings/updateSettings returning `{ local_ai: null, _version: 1 }` (Phase 40 will add persistence)

## Verification Results

| Test File | Status | Tests |
|-----------|--------|-------|
| schema-v27-v28.test.ts | PASS | 10/10 |
| brain-token-store-owner.test.ts | PASS | 9/9 |
| TypeScript `tsc --noEmit` | PASS | 0 errors |

Full suite: 127 pre-existing failures (unchanged), 0 new failures introduced.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 89b787f | feat(39-02): DB migrations v27 + v28 |
| Task 2 | 188df3b | feat(39-02): BrainTokenStore ownership methods + operator/data/ module |

## Deviations from Plan

**1. [Rule 1 - Bug] SQL column alignment spaces in v28 migration broke regex assertions**
- **Found during:** Task 1 GREEN phase
- **Issue:** Migration used aligned column declarations (`brain_process_limit           INT UNSIGNED   NOT NULL`) with extra spaces between type and constraints; test regex `/brain_process_limit\s+INT UNSIGNED NOT NULL DEFAULT 3/i` matched `\s+` for the space before `INT` but required single space between `INT UNSIGNED` and `NOT NULL`
- **Fix:** Removed extra alignment spaces so column definitions use single spaces between keywords
- **Files modified:** `grid/src/db/schema.ts`
- **Commit:** 89b787f

**2. [Rule 1 - Bug] TypeScript error: BrainTokenRecord.operatorDid required but brain-token.ts upsert omitted it**
- **Found during:** Task 2 TypeScript check
- **Issue:** Adding `operatorDid: string | null` as required field to BrainTokenRecord broke the existing `store.upsert({...})` call in `brain-token.ts` (Phase 38 route)
- **Fix:** Added `operatorDid: null` to the upsert call with comment explaining D-39-01 two-step claim model
- **Files modified:** `grid/src/api/routes/brain-token.ts`
- **Commit:** 188df3b

## Known Stubs

`operator-settings-store.ts` returns `{ local_ai: null, _version: 1 }` as a placeholder for all operators. The `operatorDid` parameter is accepted but unused (annotated with `void operatorDid` + comment). Phase 40 (Local AI) will add a settings persistence table and use operatorDid for DB lookup/write. This is an intentional stub per D-39-04 plan scope.

## Threat Surface Scan

No new network endpoints introduced. The `operator/data/` module is internal data access only — no HTTP routes. The `brain-token.ts` change is additive (adds `operatorDid: null` to an existing route, does not change behavior).

Migration v27 adds `operator_did VARCHAR(255) NULL` to `brain_tokens` — this is internal DB column, not exposed via any wire protocol or audit event (D-39-09, PORTAL_AUTH_FORBIDDEN_KEYS Phase 33 invariant preserved).

## Self-Check

Files exist check:
- grid/src/db/schema.ts: FOUND
- grid/src/db/stores/brain-token-store.ts: FOUND
- grid/src/operator/data/operator-brain-store.ts: FOUND
- grid/src/operator/data/operator-quota-store.ts: FOUND
- grid/src/operator/data/operator-settings-store.ts: FOUND
- .planning/phases/39-grid-multi-tenancy/39-02-SUMMARY.md: FOUND

Commits exist:
- 89b787f: FOUND (feat(39-02): add DB migrations v27 + v28)
- 188df3b: FOUND (feat(39-02): BrainTokenStore ownership methods + operator/data/ module)

## Self-Check: PASSED
