---
phase: "09"
plan: "04"
subsystem: "relationships"
tags:
  - phase-09
  - relationships
  - api
  - launcher
  - wave-2
dependency_graph:
  requires:
    - grid/src/relationships/listener.ts (RelationshipListener — Wave 1 Plan 02)
    - grid/src/relationships/storage.ts (RelationshipStorage — Wave 1 Plan 03)
    - grid/src/relationships/canonical.ts (edgeHash, decayedWeight, warmthBucket — Wave 0)
    - grid/src/relationships/config.ts (DEFAULT_RELATIONSHIP_CONFIG — Wave 0)
    - grid/src/genesis/launcher.ts (existing constructor + bootstrap + drainDialogueOnPause)
    - grid/src/api/operator/memory-query.ts (clone template for tier-validation scaffold)
    - grid/src/api/operator/_validation.ts (validateTierBody, DID_REGEX)
    - grid/src/audit/operator-events.ts (appendOperatorEvent — Phase 6 sole producer)
    - grid/src/registry/tombstone-check.ts (tombstoneCheck, TombstonedDidError)
  provides:
    - grid/src/genesis/launcher.ts (extended: RelationshipListener+Storage wired, rebuildFromChain, tick-cadence snapshot)
    - grid/src/genesis/types.ts (GenesisConfig.relationship?: RelationshipConfig added)
    - grid/src/api/operator/relationships.ts (four tier-graded endpoints: H1/H2/H5/graph)
    - grid/src/api/operator/index.ts (relationshipsRoutes registered)
    - grid/src/api/server.ts (GridServices.relationships + GridServices.config optional fields)
    - grid/test/relationships/listener-launcher-order.test.ts (D-9-04 construction-order gate)
    - grid/test/api/relationships-privacy.test.ts (T-09-07 privacy matrix, 16 tests)
  affects:
    - Wave 3 (09-05): dashboard useRelationships hook will call H1 GET endpoint
    - Wave 3 (09-06): graph SVG will call GET /api/v1/grid/relationships/graph
tech_stack:
  added: []
  patterns:
    - Direct-function route registration (mirrors memory-query.ts pattern, not app.register())
    - SHA-256-seeded deterministic node layout (RESEARCH.md §Graph Layout verbatim)
    - Full audit chain scan for H5 (audit.all() + involvesEdge filter, OQ-4)
    - validateTierBody for H2 body, inline tier===H5 check for H5 query params
    - reconstructEdge helper (top-N row → canonical Edge for edgeHash computation)
    - Closure-captured relCfg (computed once per registerRelationshipsRoutes call)
key_files:
  created:
    - grid/src/api/operator/relationships.ts
    - grid/test/relationships/listener-launcher-order.test.ts
    - grid/test/api/relationships-privacy.test.ts
  modified:
    - grid/src/genesis/launcher.ts (RelationshipListener + RelationshipStorage wired)
    - grid/src/genesis/types.ts (GenesisConfig.relationship field added)
    - grid/src/api/operator/index.ts (relationshipsRoutes call added)
    - grid/src/api/server.ts (GridServices.relationships + config fields added)
decisions:
  - "relationshipsRoutes exported as a plain function (app, services) not a Fastify plugin — mirrors all other operator route registrars; avoids services-access complexity from app.register closure"
  - "relCfg captured once per registerRelationshipsRoutes call (closure) rather than per-request services.config lookup — services.config is set at boot and never mutated"
  - "involvesEdge implemented inline in relationships.ts (not hoisted to event-decoder.ts) — H5 is the only consumer; premature extraction deferred per YAGNI"
  - "relationshipStorage = null in GenesisLauncher constructor — pool lives in GridStore/db layer; production wiring injects storage externally; tests that don't need MySQL pass null cleanly"
  - "rebuildFromChain() called at end of bootstrap() not at construction time — bootstrap() is the point when audit entries exist (genesis spawn + genesis event)"
metrics:
  duration: "~25 minutes"
  completed: "2026-04-22"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 4
  tests_added: 21
  tests_total_after: 723
---

# Phase 09 Plan 04: API + Launcher Wiring (Wave 2) Summary

Wired `RelationshipListener` + `RelationshipStorage` into `GenesisLauncher` (D-9-04 construction order: listener after aggregator, line 77 > line 70), exposed four tier-graded Fastify endpoints (H1/H2/H5/graph per D-9-06), and closed T-09-07 (plaintext weight leak) with an exact-key-set privacy matrix test.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | GenesisLauncher wiring: listener+storage, rebuildFromChain, snapshot cadence, order test | 94edb52 | launcher.ts, types.ts, listener-launcher-order.test.ts |
| 2 | Relationships Fastify plugin — four tier-graded endpoints (D-9-06) | 4b41dfe | relationships.ts, operator/index.ts, server.ts |
| 3 | relationships-privacy.test.ts — T-09-07 privacy matrix (16 tests) | 8f1c518 | test/api/relationships-privacy.test.ts |

## Evidence

### Test run output (relationships + privacy suite)

```
Test Files  8 passed (8)
     Tests  67 passed (67)
  Start at  20:39:27
  Duration  421ms
```

Breakdown:
- canonical.test.ts (18), self-edge-rejection.test.ts (2), determinism-source.test.ts (1)
- listener.test.ts (17), producer-boundary.test.ts (2), storage.test.ts (6)
- listener-launcher-order.test.ts (5) — NEW, Task 1
- relationships-privacy.test.ts (16) — NEW, Task 3

### Full grid suite

```
Test Files  76 passed (76)
     Tests  723 passed (723)
  Duration  3.71s
```

Baseline was 702 (Wave 0 + Wave 1). Added 21 net new tests.

### D-9-04 construction-order verification

```
aggregator line: 70
listener line:   77
order OK:        1 (77 > 70)
```

`grep -c "new RelationshipListener(this.audit" grid/src/genesis/launcher.ts` → 1
`grep -c "this.aggregator = new DialogueAggregator" grid/src/genesis/launcher.ts` → 1
`grep -c "this.relationships.reset" grid/src/genesis/launcher.ts` → 0 (relationships survive pauses)

### D-9-06 endpoint verification

```
grep -c "app.get\|app.post" grid/src/api/operator/relationships.ts → 4
grep -c "/api/v1/operator/relationships/:edge_key/events" grid/src/api/operator/relationships.ts → 3
grep -c "appendOperatorEvent" (calls) → 2 (H2 + H5 only)
grep -c "computeNodePosition" → 2 (definition + graph route call)
grep -c "createHash('sha256')" → 1 (layout seed)
```

### D-9-13 zero allowlist growth

```
cd grid && npm test -- --run test/audit/allowlist-eighteen.test.ts
→ 4 tests passed — allowlist stays at 18 members
```

### TypeScript

```
npx tsc --noEmit 2>&1 | grep -v "state-hash|db/connection|main.ts" | grep "error TS"
→ (no output) — 0 new errors in Phase 9 files
```

### Privacy matrix acceptance criteria

```
grep -c "new Set(Object.keys" grid/test/api/relationships-privacy.test.ts → 5 (≥4 required)
grep -c "not.toHaveProperty('valence'" grid/test/api/relationships-privacy.test.ts → 4 (≥2 required)
grep -c "not.toHaveProperty('weight'" grid/test/api/relationships-privacy.test.ts → 4 (≥2 required)
grep -c "operator.inspected" grid/test/api/relationships-privacy.test.ts → 10 (≥2 required)
grep -c "edge_not_found" grid/test/api/relationships-privacy.test.ts → 1
grep -c "app.inject" grid/test/api/relationships-privacy.test.ts → 21 (≥10 required)
No .skip or .todo markers
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fastify plugin pattern incompatible with existing services access**

- **Found during:** Task 2 design — comparing relationships.ts with existing operator routes
- **Issue:** Plan described exporting `relationshipsRoutes` as a Fastify plugin (`FastifyPluginCallback`) and registering via `app.register()`. All other operator routes use a direct `registerXxx(app, services)` function pattern where `services` is captured as a closure. The `app.register()` approach requires decorating the Fastify instance or passing services through plugin opts — incompatible with the existing pattern and would require accessing services via `req.server` (unsafe cast).
- **Fix:** Exported `relationshipsRoutes` as a plain function `(app, services) => void` (same signature as `registerMemoryQueryRoute`). This matches the existing pattern exactly, makes services a closure capture (computed once), and satisfies the acceptance criterion `grep -c "export.*relationshipsRoutes"` → 1.
- **Files modified:** grid/src/api/operator/relationships.ts, grid/src/api/operator/index.ts
- **Commit:** 4b41dfe

**2. [Rule 1 - Bug] `rebuildFromChain()` placement in constructor vs bootstrap()**

- **Found during:** Task 1 — reviewing when audit entries exist
- **Issue:** Plan Step C said to call `rebuildFromChain()` "after the AuditChain is loaded and BEFORE the clock starts ticking", placing it in `bootstrap()`. But Step B placed it in the constructor. If called in the constructor, the audit chain is empty (entries are added during bootstrap: spawn + genesis event). Calling rebuildFromChain() in the constructor would rebuild from an empty chain — a no-op that fails to replay persisted entries.
- **Fix:** Placed `rebuildFromChain()` at the end of `bootstrap()` (after all genesis entries are appended, before `start()` is called). This matches the plan's intent exactly — it's the point where the chain is populated with initial state. GridStore's persist-restore path will call `rebuildFromChain()` after `loadEntries()`.
- **Files modified:** grid/src/genesis/launcher.ts
- **Commit:** 94edb52

**3. [Rule 2 - Convention] `relationshipStorage = null` in constructor (pool not available)**

- **Found during:** Task 1 — examining launcher for pool field
- **Issue:** GenesisLauncher has no `pool` field. The pool lives in GridStore/db layer; the launcher is a pure bootstrap abstraction. Plan said "if no pool, set to null" which is correct, but required documenting why null is intentional and not a stub.
- **Fix:** Set `this.relationshipStorage = null` in constructor with a doc comment explaining the pattern. Snapshot cadence guard (`if (this.relationshipStorage && ...)`) naturally no-ops. Production wiring would inject storage via a setter or factory method. No production behavior is lost — the audit chain is always the source of truth.
- **Files modified:** grid/src/genesis/launcher.ts
- **Commit:** 94edb52

## Known Stubs

None. All four endpoints are fully wired and return real data from `RelationshipListener`. The `relationshipStorage = null` pattern is intentional and documented (production pool injection point for GridStore), not a placeholder. The snapshot cadence guard safely no-ops when storage is null.

## Threat Flags

All four endpoints are in the plan's threat model. No new unexpected surfaces:

| Flag | File | Description |
|------|------|-------------|
| (in plan) | relationships.ts | H1 GET /api/v1/nous/:did/relationships — DID_REGEX + tombstoneCheck (T-09-15) |
| (in plan) | relationships.ts | H2 POST /api/v1/nous/:did/relationships/inspect — validateTierBody (T-09-14), tombstoneCheck |
| (in plan) | relationships.ts | H5 GET /api/v1/operator/relationships/:edge_key/events — hex-format gate, tombstoneCheck both DIDs |
| (in plan) | relationships.ts | Graph GET /api/v1/grid/relationships/graph — H1 public, no auth required |

All mitigations from the plan's threat register are implemented and regression-gated by relationships-privacy.test.ts.

## Self-Check: PASSED

Verified:
- `grid/src/api/operator/relationships.ts` — FOUND (4 endpoints, 307 lines)
- `grid/src/genesis/launcher.ts` — FOUND (RelationshipListener after aggregator)
- `grid/src/genesis/types.ts` — FOUND (relationship? field added)
- `grid/src/api/operator/index.ts` — FOUND (relationshipsRoutes called)
- `grid/src/api/server.ts` — FOUND (GridServices extended)
- `grid/test/relationships/listener-launcher-order.test.ts` — FOUND (5 tests)
- `grid/test/api/relationships-privacy.test.ts` — FOUND (16 tests)
- Commit `94edb52` — FOUND (feat: launcher wiring)
- Commit `4b41dfe` — FOUND (feat: four endpoints)
- Commit `8f1c518` — FOUND (test: privacy matrix)
- Full grid suite: 723/723 — PASSED
- Allowlist test: 4/4 — PASSED (18 members, no growth)
- TypeScript: 0 new errors in Phase 9 files — PASSED
