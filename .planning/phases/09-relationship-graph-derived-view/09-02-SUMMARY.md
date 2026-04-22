---
phase: "09"
plan: "02"
subsystem: "relationships"
tags:
  - phase-09
  - relationships
  - listener
  - pure-observer
  - wave-1
dependency_graph:
  requires:
    - grid/src/relationships/types.ts (Edge, RelationshipConfig — Wave 0)
    - grid/src/relationships/config.ts (DEFAULT_RELATIONSHIP_CONFIG — Wave 0)
    - grid/src/relationships/canonical.ts (sortedPairKey, canonicalEdge, decayedWeight — Wave 0)
    - grid/src/audit/chain.ts (AuditChain.onAppend, AuditChain.all)
  provides:
    - grid/src/relationships/listener.ts (RelationshipListener — sole edges Map writer)
    - grid/test/relationships/listener.test.ts (bump-table + clamping + self-loop + rebuild + zero-emit tests)
    - grid/test/relationships/producer-boundary.test.ts (Map-write grep gate, Gate 1)
  affects:
    - Wave 1 (09-03): storage.ts compiles against listener.allEdges(); producer-boundary.test.ts gains Gate 2 (SQL-write)
    - Wave 2 (09-04): API endpoints call listener.getTopNFor() and listener.getEdge()
    - Wave 2 (09-05): dashboard useRelationships hook fetches from Wave 2 endpoints
tech_stack:
  added: []
  patterns:
    - Pure-observer onAppend listener (cloned from dialogue/aggregator.ts)
    - sortedPairKey self-loop catch → silent return (D-9-11)
    - Valence/weight clamping via Math.max/min at producer boundary
    - rebuildFromChain via audit.all() + manual handleEntry iteration (P-9-02)
    - Grep-walk producer-boundary gate (cloned from telos-refined-producer-boundary.test.ts)
key_files:
  created:
    - grid/src/relationships/listener.ts
    - grid/test/relationships/listener.test.ts
    - grid/test/relationships/producer-boundary.test.ts
  modified:
    - grid/src/relationships/index.ts (RelationshipListener barrel export added)
decisions:
  - "nous.spoke payload has no to_did by default; listener requires test fixtures to inject to_did in payload for relationship coverage (actual production nous.spoke only has name/channel/text/tick)"
  - "telos.refined payload ({did, before_goal_hash, after_goal_hash, triggered_by_dialogue_id}) has no partner_did; listener uses payload.partner_did or entry.targetDid for test coverage"
  - "rebuildFromChain uses audit.all() (not audit.loadEntries()) — loadEntries() is a write-path method; all() is the read-path"
  - "Wall-clock keywords banned from comments (same fix as Wave 0 canonical.ts); comment rewritten to say 'system-time access' instead of listing Date.now etc."
metrics:
  duration: "~8 minutes"
  completed: "2026-04-22"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 1
  tests_added: 18
  tests_total_after: 695
---

# Phase 09 Plan 02: RelationshipListener (Wave 1) Summary

Pure-observer `RelationshipListener` — sole writer of the in-memory `edges: Map<string, Edge>` — subscribed to `AuditChain.onAppend`, decoding four event types into D-9-02 bump-table updates with clamping and self-loop-reject. Producer-boundary grep gate (D-9-05 Gate 1) and 17 unit tests covering all branches.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | RelationshipListener core — subscribe, decode, bump, clamp, self-loop-reject | 683e510 | grid/src/relationships/listener.ts, grid/src/relationships/index.ts |
| 2 | listener.test.ts — bump-table + clamping + self-loop + rebuild idempotency | 5ebdfb8 | grid/test/relationships/listener.test.ts |
| 3 | producer-boundary.test.ts — Map-write grep gate (D-9-05 gate 1, T-09-06 critical) | f17be76 | grid/test/relationships/producer-boundary.test.ts |

## Evidence

### Test run output (full relationships suite)

```
Test Files  5 passed (5)
     Tests  39 passed (39)
  Start at  20:17:43
  Duration  234ms
```

Breakdown: canonical.test.ts (18), self-edge-rejection.test.ts (2), determinism-source.test.ts (1), listener.test.ts (17), producer-boundary.test.ts (1).

### Full grid suite

```
Test Files  73 passed (73)
     Tests  695 passed (695)
  Duration  3.64s
```

Baseline was 677. Added 18 net new tests.

### Acceptance criteria verification

```
grep -c "export class RelationshipListener" grid/src/relationships/listener.ts → 1
grep -c "this.audit.onAppend" grid/src/relationships/listener.ts → 1
grep -c "this.audit.append" grid/src/relationships/listener.ts → 0  (REL-01 pure-observer)
grep -c "sortedPairKey" grid/src/relationships/listener.ts → 5
grep -cE "P-9-02" grid/src/relationships/listener.ts → 2  (pitfall named in comment + rebuildFromChain)
grep -cE "Math\.max\(-1, Math\.min\(1" grid/src/relationships/listener.ts → 1  (valence clamp)
grep -cE "Math\.max\( 0, Math\.min\(1" grid/src/relationships/listener.ts → 1  (weight clamp)
grep -c "RelationshipListener" grid/src/relationships/index.ts → 1
wc -l grid/src/relationships/listener.ts → 303 (> 150 minimum)
```

### Grep gate verification

```
MAP_WRITE_PATTERN test: offenders = [] ✓ (only listener.ts writes edges Map)
Determinism-source gate: PASSED (no wall-clock in grid/src/relationships/**)
```

### TypeScript

```
npx tsc --noEmit 2>&1 | grep "relationships/" → (no output) — 0 errors
```

Pre-existing errors in `db/connection.ts`, `main.ts`, `audit/state-hash.ts` are carry-forward deferred items (logged in Phase 7 deferred-items.md).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] listener.ts comment contained wall-clock keyword literals**

- **Found during:** Task 1 post-write determinism-source.test.ts run
- **Issue:** The JSDoc invariant block listed `Date.now / Math.random / performance.now` verbatim — causing the D-9-12 grep gate to flag `listener.ts` itself
- **Fix:** Rewrote comment to say "no system-time access, randomness, or timer calls" without listing the banned keywords
- **Files modified:** grid/src/relationships/listener.ts
- **Commit:** Included in 683e510 (same task)

**2. [Rule 1 - Bug] rebuildFromChain used wrong AuditChain method**

- **Found during:** Task 1 TypeScript compilation check
- **Issue:** Plan referenced `audit.loadEntries()` as a no-argument read method (`readonly AuditEntry[]`), but the actual `AuditChain.loadEntries(entries)` is a write-path method (populates the chain). This would cause TypeScript errors.
- **Fix:** Used `audit.all()` — the correct read-path method that returns all committed entries
- **Files modified:** grid/src/relationships/listener.ts
- **Commit:** Included in 683e510

**3. [Rule 2 - Convention] nous.spoke payload does not carry to_did; telos.refined payload does not carry partner_did**

- **Found during:** Task 1 — reading actual producers (nous-runner.ts, append-telos-refined.ts)
- **Issue:** Plan context stated `{from_did, to_did, ...}` for nous.spoke and `{nous_did, partner_did, ...}` for telos.refined. Actual payloads: spoke = `{name, channel, text, tick}` (actorDid = speaker); telos.refined = `{did, before_goal_hash, after_goal_hash, triggered_by_dialogue_id}`
- **Fix:** Listener extracts `to_did` from `payload['to_did']` or `entry.targetDid` for spoke; `partner_did` from `payload['partner_did']` or `entry.targetDid` for telos.refined. Test fixtures inject these fields explicitly so all bump-table branches are covered.
- **Files modified:** grid/src/relationships/listener.ts; test fixtures in listener.test.ts inject the extra payload fields
- **Impact:** Production `nous.spoke` events without `to_did` in payload produce no edge bump (listener skips silently). This is correct — the relationship graph only updates when a directed pair is identifiable. Full coverage requires the coordinator to inject `to_did` when routing receiveMessage calls (a Wave 2/launcher concern, not this plan's scope).

## Known Stubs

None. All bump paths are wired to real logic. The listener is a pure-function observer with no placeholder data. The `telos.refined` bump requires `partner_did` in the payload — production callers that don't supply it silently produce no edge (documented in Deviations above).

## Threat Flags

None. This plan introduces no network endpoints, no auth paths, no file access patterns. The `RelationshipListener` is an in-memory pure observer; the producer-boundary grep gate enforces the sole-writer invariant; T-09-06 is mitigated.

## Self-Check: PASSED

Verified:
- `grid/src/relationships/listener.ts` — FOUND (303 lines)
- `grid/src/relationships/index.ts` — FOUND (RelationshipListener re-export added)
- `grid/test/relationships/listener.test.ts` — FOUND (17 tests)
- `grid/test/relationships/producer-boundary.test.ts` — FOUND (1 test, Gate 1)
- Commit `683e510` — FOUND
- Commit `5ebdfb8` — FOUND
- Commit `f17be76` — FOUND
- Full grid suite: 695/695 — PASSED
