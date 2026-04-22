---
phase: "09"
plan: "03"
subsystem: "relationships"
tags:
  - phase-09
  - relationships
  - storage
  - snapshot
  - wave-1
dependency_graph:
  requires:
    - grid/src/relationships/types.ts (Edge — Wave 0)
    - grid/src/relationships/canonical.ts (canonicalEdge, sortedPairKey — Wave 0)
    - grid/src/relationships/listener.ts (allEdges(), size, getEdge() — Wave 1 Plan 02)
    - sql/009_relationships.sql (relationships table schema — Wave 0)
    - mysql2/promise (Pool, RowDataPacket)
  provides:
    - grid/src/relationships/storage.ts (RelationshipStorage — sole SQL writer of `relationships` table)
    - grid/test/relationships/storage.test.ts (6 round-trip + error-swallow tests)
    - grid/test/relationships/producer-boundary.test.ts (Gate 2 SQL-write boundary appended)
  affects:
    - Wave 2 (09-04): launcher wiring will call storage.scheduleSnapshot() per tick cadence
    - CI: both D-9-05 gates now active — Map-write (Gate 1) + SQL-write (Gate 2)
tech_stack:
  added: []
  patterns:
    - Batched REPLACE INTO with N value-tuple placeholders (OQ-7 full-snapshot decision)
    - fire-and-forget via setImmediate (OQ-2 — mirrors PersistentAuditChain.append pattern)
    - console.warn error logging for snapshot failures (same as persistent-chain.ts)
    - In-memory Pool mock for tests (no real MySQL in CI — mirrors InMemoryGridStore pattern)
    - canonicalEdge() for byte-identity assertions (not raw float equality — P-9-03 pitfall)
key_files:
  created:
    - grid/src/relationships/storage.ts
    - grid/test/relationships/storage.test.ts
  modified:
    - grid/src/relationships/index.ts (RelationshipStorage barrel export appended)
    - grid/test/relationships/producer-boundary.test.ts (Gate 2 SQL-write block appended)
decisions:
  - "Mock pool path chosen for storage.test.ts: no real-MySQL harness exists in this repo's test suite; InMemoryGridStore pattern (in-memory mock) is the established approach"
  - "comment wall-clock keywords banned: fixed same issue as Wave 0 canonical.ts and Wave 1 listener.ts — comments listing Date.now/setInterval/setTimeout keywords verbatim triggered the D-9-12 grep gate; rewrote to say 'wall-clock access' and 'blocking timer calls'"
  - "setImmediate is allowed (not in D-9-12 forbidden list); only banned: Date.now / performance.now / setInterval / setTimeout / Math.random"
  - "SQL_WRITE_PATTERN and ALLOWED_SQL_WRITER constants placed above describe() block (outside the describe, alongside imports) to share the all-files walk — no re-walk needed for Gate 2"
metrics:
  duration: "~12 minutes"
  completed: "2026-04-22"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 2
  tests_added: 7
  tests_total_after: 702
---

# Phase 09 Plan 03: RelationshipStorage (Wave 1) Summary

`RelationshipStorage` — sole writer of the `relationships` MySQL table (D-9-05 gate 2). Batched `REPLACE INTO` snapshot every N ticks (default 100, fire-and-forget via `setImmediate`), lossless `DECIMAL(4,3)` round-trip at the canonical-edge level, and both producer-boundary gates (Map-write + SQL-write) now fully active in CI.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | RelationshipStorage — batched snapshot + loadSnapshot + barrel | 3b7dad9 | grid/src/relationships/storage.ts, grid/src/relationships/index.ts |
| 2 | storage.test.ts — end-to-end round-trip via mock pool | 5de3d94 | grid/test/relationships/storage.test.ts |
| 3 | Append SQL-write gate to producer-boundary.test.ts (D-9-05 gate 2) | 3fe188a | grid/test/relationships/producer-boundary.test.ts |

## Evidence

### Test run output (full relationships suite)

```
Test Files  6 passed (6)
     Tests  46 passed (46)
  Start at  20:25:39
  Duration  250ms
```

Breakdown: canonical.test.ts (18), self-edge-rejection.test.ts (2), determinism-source.test.ts (1), listener.test.ts (17), producer-boundary.test.ts (2), storage.test.ts (6).

Baseline was 695 (Wave 0 + Wave 1 Plan 02). Added 7 net new tests (6 in storage.test.ts + 1 new gate-2 test in producer-boundary.test.ts).

### Acceptance criteria verification — Task 1

```
grep -c "export class RelationshipStorage" grid/src/relationships/storage.ts → 1
grep -cE "REPLACE\s+INTO\s+relationships" grid/src/relationships/storage.ts → 1
grep -cE "SELECT\s.*\sFROM\s+relationships" grid/src/relationships/storage.ts → 1
grep -c "audit.append" grid/src/relationships/storage.ts → 0
grep -c "RelationshipStorage" grid/src/relationships/index.ts → 1
determinism-source.test.ts → PASSED (no wall-clock in relationships/**)
npx tsc --noEmit → 0 errors in relationships/
```

### Acceptance criteria verification — Task 2

```
grep -c "canonicalEdge" grid/test/relationships/storage.test.ts → 4 (≥1 required)
grep -c "scheduleSnapshot\|setImmediate" grid/test/relationships/storage.test.ts → 6 (≥1 required)
6 describe/it groups covering: empty-load, round-trip, re-snapshot, updated-edge, empty-iter, error-swallow
No .skip or .todo markers
Mock path documented at file top ✓
```

### Acceptance criteria verification — Task 3

```
grep -c "SQL_WRITE_PATTERN" grid/test/relationships/producer-boundary.test.ts → 3 (declaration + uses)
grep -c "ALLOWED_SQL_WRITER" grid/test/relationships/producer-boundary.test.ts → 2
grep -c "it(" grid/test/relationships/producer-boundary.test.ts → 2 (Gate 1 + Gate 2)
grep -c "MAP_WRITE_PATTERN" grid/test/relationships/producer-boundary.test.ts → 2 (preserved from Plan 02)
Both gates GREEN: offenders arrays empty ✓
```

### Gate-2 SQL-write offender count

```
SQL_WRITE_PATTERN offenders: [] (0 offenders — only storage.ts matches the SQL pattern, and it is allowlisted)
```

### TypeScript compilation

```
npx tsc --noEmit 2>&1 | grep "relationships/" → (no output) — 0 errors
```

Pre-existing errors in db/connection.ts, main.ts, audit/state-hash.ts are carry-forward deferred items (logged in Phase 7 deferred-items.md).

### Mock path rationale (documented at storage.test.ts file top)

The repo's established test pattern uses `InMemoryGridStore` (not a real MySQL pool). `storage.test.ts` follows this pattern: a minimal in-memory `Pool` mock parses SQL strings and routes `REPLACE INTO` / `SELECT` to a `Map<string, Row>`. This validates shape equivalence, DECIMAL→string→parseFloat round-trip, and `scheduleSnapshot` error swallow without requiring a MySQL process in CI.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] storage.ts comment contained wall-clock keyword literals**

- **Found during:** Task 1 post-write determinism-source.test.ts run
- **Issue:** The module doc comment listed `Date.now / performance.now / setInterval / setTimeout / Math.random` verbatim — causing the D-9-12 grep gate to flag `storage.ts`
- **Fix:** Rewrote comment to say "no wall-clock access, randomness, or timer calls" without listing the banned keywords. Same fix applied to scheduleSnapshot() JSDoc.
- **Files modified:** grid/src/relationships/storage.ts
- **Commit:** Included in 3b7dad9

This is the same recurring pattern as Wave 0 (canonical.ts) and Wave 1 Plan 02 (listener.ts). The D-9-12 grep gate is strict — it fires on comments, not just code.

## Known Stubs

None. `RelationshipStorage` is a fully wired class with real SQL in `snapshot()` and `loadSnapshot()`. The mock in `storage.test.ts` is a test artifact, not a production stub. No placeholder data, hardcoded empty values, or TODO markers in shipped code.

## Threat Flags

None. This plan introduces no new network endpoints and no new auth paths. `RelationshipStorage` is an internal class — no HTTP surface. SQL injection is mitigated by parameterized `pool.query(sql, params)` bindings (T-09-15). The D-9-05 gate-2 grep fence is now active in CI (T-09-06 gate 2 mitigated).

## Self-Check: PASSED

Verified:
- `grid/src/relationships/storage.ts` — FOUND
- `grid/src/relationships/index.ts` — FOUND (RelationshipStorage export appended)
- `grid/test/relationships/storage.test.ts` — FOUND (6 tests)
- `grid/test/relationships/producer-boundary.test.ts` — FOUND (2 tests, Gate 1 + Gate 2)
- Commit `3b7dad9` — FOUND
- Commit `5de3d94` — FOUND
- Commit `3fe188a` — FOUND
- Full relationships suite: 46/46 — PASSED
