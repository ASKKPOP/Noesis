---
phase: 24-portal-shell
plan: "01"
subsystem: grid-backend
tags: [portal, auth, jwt, mysql, migration, region]
dependency_graph:
  requires: []
  provides: [migration-v10-region, human-record-region, jwt-region-created_at, me-endpoint-4-fields]
  affects: [grid/src/db/schema.ts, grid/src/human/types.ts, grid/src/human/HumanRegistry.ts, grid/src/api/portal/auth.ts]
tech_stack:
  added: []
  patterns: [TDD RED/GREEN, JWT payload extension, MySQL ALTER TABLE migration]
key_files:
  created:
    - grid/test/portal/human-region.test.ts
    - grid/test/portal/portal-auth-region.test.ts
  modified:
    - grid/src/db/schema.ts
    - grid/src/human/types.ts
    - grid/src/human/HumanRegistry.ts
    - grid/src/api/portal/auth.ts
decisions:
  - "JWT-only /me — region and created_at served from JWT payload without DB lookup (Option A from RESEARCH.md §3)"
  - "region defaults to 'agora' both in createHuman (Registry) and /me fallback for old tokens"
  - "created_at stored as ISO 8601 string in JWT; /me returns null for old tokens missing it"
metrics:
  duration: "215s"
  completed: "2026-05-21"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 4
  files_created: 2
---

# Phase 24 Plan 01: Region + created_at through portal auth layer Summary

Extend Grid backend to carry `region` and `created_at` through the portal auth layer. MySQL migration v10 adds a `region` column to `human_users`, `HumanRecord` gains a `readonly region: string` field, `createHuman` defaults region to `'agora'`, and the JWT payload now embeds both `region` and `created_at` so `GET /me` can return all four fields without a DB lookup.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Migration v10 + HumanRecord/Registry region field — tests | 10d7fb5 | grid/test/portal/human-region.test.ts |
| 1 (GREEN) | Migration v10 + HumanRecord/Registry region field — impl | 5bfeea7 | schema.ts, types.ts, HumanRegistry.ts |
| 2 (RED) | JWT + /me region+created_at — tests | 1bac291 | grid/test/portal/portal-auth-region.test.ts |
| 2 (GREEN) | JWT + /me region+created_at — impl | b2f0c80 | grid/src/api/portal/auth.ts |

## Verification

All plan acceptance criteria met:

```
grep -c "version: 10" grid/src/db/schema.ts        → 1 ✓
grep -c "readonly region: string" grid/src/human/types.ts → 1 ✓
grep -c "region: human.region" grid/src/api/portal/auth.ts → 1 ✓
grep -c "payload['region']" grid/src/api/portal/auth.ts   → 1 ✓
grep -rn "human.moved" grid/src/audit/             → 0 matches ✓ (allowlist at 45)
```

All 11 portal tests pass (6 Task 1 + 5 Task 2).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all fields wired end-to-end (DB migration → Registry → JWT → /me response).

## Threat Flags

No new threat surface beyond the plan's threat model. `jwtVerify` with ES256 public key rejects any tampered tokens (T-24-01-01 mitigated). Region value is non-sensitive (T-24-01-03 accepted).

## TDD Gate Compliance

- RED gate: `test(24-01)` commits exist for both tasks (10d7fb5, 1bac291)
- GREEN gate: `feat(24-01)` commits follow (5bfeea7, b2f0c80)

## Self-Check

Files exist:
- grid/src/db/schema.ts ✓
- grid/src/human/types.ts ✓
- grid/src/human/HumanRegistry.ts ✓
- grid/src/api/portal/auth.ts ✓
- grid/test/portal/human-region.test.ts ✓
- grid/test/portal/portal-auth-region.test.ts ✓

Commits verified in git log ✓

## Self-Check: PASSED
