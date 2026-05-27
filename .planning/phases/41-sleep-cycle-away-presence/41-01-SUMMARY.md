---
phase: 41
plan: 01
subsystem: test-infrastructure
tags: [wave-0, nyquist, vitest, pytest, sleep-cycle, stubs]
dependency_graph:
  requires: []
  provides: [SLEEP-01-stubs, SLEEP-02-stubs, SLEEP-03-stubs, SLEEP-04-stubs, SLEEP-05-stubs]
  affects: [Plans 02-06 verify blocks]
tech_stack:
  added: []
  patterns: [skip-stub pattern (vitest it.skip), skip-stub pattern (pytest mark.skip)]
key_files:
  created:
    - grid/test/civic-presence/grace-timer.test.ts
    - grid/test/civic-presence/escalation.test.ts
    - grid/test/api/civic-presence.test.ts
    - grid/test/api/civic-inbox.test.ts
    - brain/test/test_wire_client_heartbeat.py
    - brain/test/test_wire_subscriber_since.py
    - brain/test/test_wire_queue_kv.py
  modified: []
decisions:
  - "Wave 0 stubs are pure scaffolding — no production code touched"
  - "civic-presence/ subdirectory created in grid/test/ for co-located presence tests"
metrics:
  duration_seconds: 269
  completed_date: "2026-05-27"
  tasks_completed: 2
  files_created: 7
---

# Phase 41 Plan 01: Wave 0 Nyquist Test Stubs Summary

**One-liner:** 7 skip-placeholder test files (4 Vitest + 3 pytest) covering SLEEP-01..05 and threat IDs T-41-01..05, satisfying the Nyquist rule before any implementation wave runs.

## Files Created

### Grid Vitest stubs

| File | Absolute Path | Skip Count | REQs / Threats |
|------|---------------|------------|----------------|
| grace-timer.test.ts | `/Users/desirey/Programming/src/Noesis/grid/test/civic-presence/grace-timer.test.ts` | 5 | SLEEP-01, T-41-03 |
| escalation.test.ts | `/Users/desirey/Programming/src/Noesis/grid/test/civic-presence/escalation.test.ts` | 7 | SLEEP-04, SLEEP-05, T-41-03, T-41-04 |
| civic-presence.test.ts | `/Users/desirey/Programming/src/Noesis/grid/test/api/civic-presence.test.ts` | 6 | SLEEP-01, SLEEP-03, T-41-01, T-41-04 |
| civic-inbox.test.ts | `/Users/desirey/Programming/src/Noesis/grid/test/api/civic-inbox.test.ts` | 9 | SLEEP-02, SLEEP-03, T-41-02, T-41-05 |

**Total Vitest skips: 27**

### Brain pytest stubs

| File | Absolute Path | Skip Count | REQs / Threats |
|------|---------------|------------|----------------|
| test_wire_client_heartbeat.py | `/Users/desirey/Programming/src/Noesis/brain/test/test_wire_client_heartbeat.py` | 4 | SLEEP-03 |
| test_wire_subscriber_since.py | `/Users/desirey/Programming/src/Noesis/brain/test/test_wire_subscriber_since.py` | 3 | SLEEP-03 |
| test_wire_queue_kv.py | `/Users/desirey/Programming/src/Noesis/brain/test/test_wire_queue_kv.py` | 4 | SLEEP-03 |

**Total pytest skips: 11**

**Grand total: 38 skipped tests across 7 files**

## Threat ID Distribution Map

| Threat ID | Description | Covered By |
|-----------|-------------|------------|
| T-41-01 | Fake heartbeat → Brain JWT required | civic-presence.test.ts |
| T-41-02 | Queue flood → max depth 1000 | civic-inbox.test.ts |
| T-41-03 | last_seen_at tampering → heartbeat-only write | grace-timer.test.ts, escalation.test.ts |
| T-41-04 | Frozen Civic-DID bypass | escalation.test.ts, civic-presence.test.ts |
| T-41-05 | since= cursor manipulation → scoped to own DID | civic-inbox.test.ts |

## Discovery Confirmation

### Vitest (Grid)
```
↓ test/api/civic-inbox.test.ts (9 tests | 9 skipped)
↓ test/civic-presence/escalation.test.ts (7 tests | 7 skipped)
↓ test/api/civic-presence.test.ts (6 tests | 6 skipped)
↓ test/civic-presence/grace-timer.test.ts (5 tests | 5 skipped)
```
All 4 files discovered. Zero new failures introduced. Pre-existing failures (63 unrelated test files) are unchanged.

### pytest (Brain)
```
11 skipped in 0.01s
```
All 3 files collected, 11 tests skipped, 0 failed.

## Deviations from Plan

None — plan executed exactly as written.

## Commit

`dd5aa17` — Phase 41 Wave 0 — Nyquist test stubs (7 files)

## Self-Check: PASSED

All 7 files verified on disk. Commit dd5aa17 verified in git log. Zero new test failures.
