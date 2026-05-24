---
phase: 31-audit-pipeline-persistence
plan: "02"
subsystem: scripts
tags: [backfill, audit-trail, mysql2, rest-pagination, idempotent, obs-04]
dependency_graph:
  requires: []
  provides: [scripts/backfill-audit-trail.mjs]
  affects: [audit_trail MySQL table]
tech_stack:
  added: [mysql2/promise (already installed at repo root node_modules)]
  patterns: [paginated-REST-fetch, INSERT-IGNORE-idempotency, env-credentials]
key_files:
  created:
    - scripts/backfill-audit-trail.mjs
  modified: []
decisions:
  - "mysql2/promise resolved from root node_modules (already present) — no install needed; fallback path to grid/node_modules documented in script JSDoc"
  - "236 lines — within 250-line CLAUDE.md §2 upper bound; no --watch, no CSV/JSON output flags added"
  - "Pagination page size set to 100 (polite to server); loop terminates when entries.length < PAGE"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-24T05:25:09Z"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
---

# Phase 31 Plan 02: Backfill Audit Trail CLI Summary

One-shot `scripts/backfill-audit-trail.mjs` Node ESM CLI that recovers in-memory audit entries from a live Grid via REST + writes missing rows to MySQL using `INSERT IGNORE` — idempotent, credential-safe, pagination-complete.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 2.1 | Create scripts/backfill-audit-trail.mjs | ec13a04 | scripts/backfill-audit-trail.mjs (+236 lines) |

## What Was Built

`scripts/backfill-audit-trail.mjs` is a production-ready CLI that:

1. **Paginates GET /api/v1/audit/trail** using `?limit=100&offset=` until the response batch is shorter than the page size (never fetches the same offset twice).

2. **Connects to MySQL** via `mysql2/promise`, reads `MAX(id)` and `COUNT(*)` from `audit_trail WHERE grid_name = ?`, then inserts only entries with `id > dbMaxId` via `INSERT IGNORE` — exact column order matches `grid/src/db/stores/audit-store.ts:15-33` verbatim.

3. **Reads all DB credentials from env** (`MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`) — never from CLI args, never logged.

4. **`--dry-run` mode** reports divergence (in_memory vs persisted delta) without writing any rows. Logs first/last missing entry's `id`, `eventType`, and ISO timestamp only — no payload dump.

5. **Idempotent second run**: after a full backfill, re-running without `--dry-run` yields `inserted=0, skipped=N` because `INSERT IGNORE` silently skips existing rows.

6. **Exit codes**: 0=success/dry-run, 1=REST failure, 2=MySQL connect failure, 3=divergence>--limit, 64=usage error.

## Acceptance Criteria Results

| Criterion | Result |
|-----------|--------|
| File exists and is executable (`test -x`) | PASS |
| `node --check` exits 0 | PASS |
| `--help` prints Usage line and exits 0 | PASS |
| No args exits 64 | PASS |
| `grep -F 'INSERT IGNORE INTO audit_trail'` exits 0 | PASS |
| All 4 exit codes documented in JSDoc (0, 1, 2, 64) | PASS |
| `process.env.MYSQL_*` references >= 4 | PASS (5 found) |
| No `console.*MYSQL_PASSWORD` | PASS |
| `u.protocol !== 'http:'` URL validation | PASS |
| Pagination with `limit=${PAGE}&offset=` | PASS |
| Line count >= 150 | PASS (236 lines) |

## Deviations from Plan

None — plan executed exactly as written.

The only minor discovery: `mysql2` was already available at `node_modules/mysql2` in the project root (not just `grid/node_modules/mysql2`), so the primary import path `mysql2/promise` resolves immediately. The fallback path to `../grid/node_modules/mysql2/promise.js` remains in the script for portability and is documented in the JSDoc header.

## Pagination Strategy

The REST endpoint at `GET /api/v1/audit/trail` returns `{ entries: AuditEntry[], total: number }` with server default limit=50. The script uses `limit=100` (more polite than unbounded). Loop terminates when `entries.length < PAGE` (i.e., last page reached). The `total` field is logged for visibility but not used for termination logic — this prevents off-by-one errors if entries are added concurrently.

## Smoke Test

Deferred to plan 06 HUMAN-UAT. The script cannot be smoke-tested in this plan because:
- No live Grid process is running during this wave execution
- MySQL connectivity requires production credentials not present in CI

Plan 06's HUMAN-UAT will run the first actual invocation:
```bash
node scripts/backfill-audit-trail.mjs \
  --grid genesis \
  --rest-url http://localhost:8080 \
  --dry-run
```
Then without `--dry-run`, then verify second invocation reports `inserted=0`.

## Known Stubs

None — script is fully wired. No hardcoded empty values, no placeholder data, no TODO/FIXME markers.

## Threat Flags

None — all STRIDE threats from the plan's threat model are mitigated within the script:
- T-31-04 (credential disclosure): credentials from env, not logged
- T-31-05 (SSRF): protocol validation rejects non-http(s) URLs
- T-31-06 (SQL injection): parameterized queries (`?` placeholders), no string concatenation
- T-31-07 (dry-run disclosure): only id/eventType/ISO timestamp logged, no payload bodies
- T-31-08 (DoS unbounded pagination): PAGE=100 cap, terminates on short batch

## Self-Check: PASSED

- `scripts/backfill-audit-trail.mjs` exists: FOUND
- Commit `ec13a04` exists: FOUND (`feat(31-02): add backfill-audit-trail.mjs CLI script`)
- All acceptance criteria: PASSED (11/11)
