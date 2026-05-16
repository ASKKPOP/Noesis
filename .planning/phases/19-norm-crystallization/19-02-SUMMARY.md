---
phase: 19-norm-crystallization
plan: "02"
subsystem: grid/db
tags: [mysql, migration, schema, norms]
requirements: [NORM-01, NORM-03]

dependency_graph:
  requires: [19-01]
  provides: [norm_candidates table DDL, norm_registry table DDL, version 7 migration]
  affects: [grid/src/db/schema.ts, MigrationRunner versioning]

tech_stack:
  added: []
  patterns: [MigrationRunner versioning, IF NOT EXISTS idempotent DDL, composite PK]

key_files:
  created:
    - grid/test/norms/norm-migration.test.ts
  modified:
    - grid/src/db/schema.ts

decisions:
  - "Used single version 7 entry with multi-statement up SQL — matches version 6 pattern (governance tables); DatabaseConnection.execute() handles multiple DDL statements"
  - "Migration test uses static SQL inspection (no live MySQL) — mirrors grid/test/db/migration-schema.test.ts; no MySQL test harness exists in this repo"

metrics:
  duration: "~10 minutes"
  completed: "2026-05-16T22:45:49Z"
  tasks_completed: 2
  files_changed: 2
---

# Phase 19 Plan 02: Norm Migration Schema Summary

MySQL schema version 7 migration adding norm_candidates (composite PK, mutable) and norm_registry (UUID PK, immutable append-only) tables via MigrationRunner, validated by 12 static schema tests.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add version 7 migration to schema.ts | e434f98 | grid/src/db/schema.ts |
| 2 | Write migration integration test | 22e9727 | grid/test/norms/norm-migration.test.ts |

## What Was Built

**Task 1 — Version 7 migration (grid/src/db/schema.ts)**

Appended a single version 7 entry to the `MIGRATIONS` array with:
- `norm_candidates` table: composite PRIMARY KEY `(fingerprint, grid_name)`, mutable candidate state, columns per D-19-04 exactly
- `norm_registry` table: PRIMARY KEY `norm_id`, indexes `idx_fingerprint (grid_name, fingerprint)` and `idx_crystallized (grid_name, crystallized_tick)`, `convergence_type ENUM('emergent','coincidental')`
- Multi-statement `up` (two CREATE TABLE IF NOT EXISTS) mirrors version 6's governance tables pattern
- `down` drops `norm_candidates` first, then `norm_registry`

**Task 2 — Migration schema test (grid/test/norms/norm-migration.test.ts)**

12 static SQL inspection tests, all passing:
- Version 7 entry existence and name
- norm_candidates columns (fingerprint, grid_name, participant_dids, first_seen_tick, last_updated_tick)
- norm_registry columns (norm_id, fingerprint, crystallized_tick, participant_count, convergence_type, event_hash, grid_name)
- Composite PK pattern via regex match
- norm_id PK on norm_registry
- Both indexes (idx_fingerprint, idx_crystallized) with correct column order
- ENUM values: 'emergent','coincidental'
- InnoDB + utf8mb4 on both tables (count=2 each)
- Down SQL drops norm_candidates before norm_registry
- IF NOT EXISTS idempotency (count=2)
- MIGRATIONS array versions remain sequential (1..7)

## Deviations from Plan

**1. [Rule 1 - Pattern] Test uses static SQL inspection instead of live MySQL integration**
- **Found during:** Task 2
- **Issue:** The plan template showed `new MigrationRunner(MIGRATIONS)` with a Pool and live DB queries, but the actual `MigrationRunner` constructor takes `DatabaseConnection` (not Pool, not MIGRATIONS). More critically, no MySQL test harness exists in this repo — the established pattern (confirmed by reading `grid/test/relationships/storage.test.ts` and `grid/test/db/migration-schema.test.ts`) is either in-memory mocks or static SQL inspection. No CI MySQL is available.
- **Fix:** Wrote static SQL inspection tests following the existing `migration-schema.test.ts` pattern. Tests validate the same properties the plan required (columns, PKs, indexes, idempotency) without requiring a live DB.
- **Files modified:** grid/test/norms/norm-migration.test.ts
- **Commit:** 22e9727

## Verification Results

```
grep -n "version: 7" grid/src/db/schema.ts  → line 144: version: 7
npx vitest run test/norms/norm-migration.test.ts → 12 tests passed
npx vitest run test/norms/ test/db/ → 67 tests passed (no regression)
npx tsc --noEmit → 14 pre-existing errors; zero new errors from Plan 02 changes
```

## Known Stubs

None. The migration DDL is complete and exact per D-19-04.

## Threat Flags

None. No new network endpoints or auth paths introduced.

## Self-Check: PASSED

- grid/src/db/schema.ts exists and contains `version: 7` at line 144
- grid/test/norms/norm-migration.test.ts exists with 12 passing tests
- Commits e434f98 and 22e9727 present in git log
- Zero new TypeScript errors introduced
