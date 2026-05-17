---
phase: 21-culture-dashboard
plan: "02"
subsystem: grid-api
tags:
  - fastify
  - audit-chain
  - bfs-layout
  - culture-dashboard
  - skill-lineage
dependency_graph:
  requires:
    - "21-01"  # culture-lineage.test.ts stub created in Plan 01
    - "18"     # skill.taught / skill.inferred audit events exist
  provides:
    - "GET /api/v1/grid/culture/skills/lineage"
    - "registerCultureRoutes Fastify function"
  affects:
    - "grid/src/api/server.ts"
    - "grid/src/api/routes/culture.ts"
tech_stack:
  added: []
  patterns:
    - "registerLoreRoutes registration style (cloned → registerCultureRoutes)"
    - "audit.all() + array filter for dual eventType query (Pitfall 2 avoided)"
    - "BFS hierarchical layout server-side (D-9-08 / D-21-03)"
    - "void app.register(async (instance) => { dynamic import }) pattern"
key_files:
  created:
    - "grid/src/api/routes/culture.ts"
  modified:
    - "grid/src/__tests__/culture-lineage.test.ts"
    - "grid/src/api/server.ts"
decisions:
  - "Used audit.all() + filter (not audit.query()) to handle two event types in one pass — avoids Pitfall 2"
  - "BFS layout: roots = Nous with no incoming edges, y=50 for depth-0, y=depth*levelHeight for deeper nodes"
  - "skill.taught edge direction: teacher_did → skill_hash (taught type)"
  - "skill.inferred edge direction: skill_hash → learner_did (inferred type)"
  - "Empty state returned immediately without layout computation when entries.length === 0"
  - "Culture route registered unconditionally (no if(services.xxx) guard — audit is always present)"
metrics:
  duration_minutes: 3
  completed_date: "2026-05-17"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 2
---

# Phase 21 Plan 02: Skill Lineage Grid Endpoint Summary

**One-liner:** BFS hierarchical layout server-side at `GET /api/v1/grid/culture/skills/lineage` returning `{nodes, edges}` with server-computed `{x,y}` per D-9-08/D-21-03.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement GET /api/v1/grid/culture/skills/lineage (TDD) | fbf0132 | grid/src/api/routes/culture.ts (created), grid/src/__tests__/culture-lineage.test.ts (filled) |
| 2 | Register culture routes in grid/src/api/server.ts | 3da18c2 | grid/src/api/server.ts |

## What Was Built

`grid/src/api/routes/culture.ts` — `registerCultureRoutes(fastify, audit)` Fastify plugin:

1. Queries `audit.all()` and filters for `skill.taught` + `skill.inferred` in a single pass
2. Builds a deduplicated `Map<id, node>` for Nous and skill nodes
3. Constructs typed edges (`taught` / `inferred`) from each event's payload
4. Computes BFS hierarchical layout:
   - Roots = Nous nodes with no incoming edges
   - BFS assigns depth to each node
   - x = `(indexInGroup + 1) / (groupSize + 1) * 1000`
   - y = `50` for depth 0, `depth * levelHeight` for deeper nodes
5. Returns `{nodes, edges}` with numeric `{x, y}` per node
6. Empty state: immediate `{nodes:[], edges:[]}` response, no layout computation

Route registered in `server.ts` via `void app.register(async (instance) => { dynamic import })` unconditionally (audit is always present), after the lore block.

## Test Results

8 passing tests in `grid/src/__tests__/culture-lineage.test.ts`:

- Empty audit chain → `{nodes:[], edges:[]}` (200, not 404)
- `skill.taught` → nous node for teacher_did, skill node for skill_hash
- `skill.inferred` → skill node for skill_hash, nous node for learner_did
- Taught edge: `source=teacher_did`, `target=skill_hash`, `type="taught"`
- Inferred edge: `source=skill_hash`, `target=learner_did`, `type="inferred"`
- All nodes have numeric x and y fields
- Root Nous (no incoming edges) has minimum y value
- Root y < child skill y (monotonic depth ordering)

## Deviations from Plan

None — plan executed exactly as written.

The only minor adjustment: test assertion for skill label expected `'sha256:'` (7 chars) but `'sha256:abc123'.slice(0, 6)` = `'sha256'` (6 chars). Corrected the test expectation to match the spec (`slice(0,6)` on the raw hash string).

## Verification Checklist

- `grid/src/api/routes/culture.ts` exists and contains `registerCultureRoutes`: PASS
- `culture.ts` uses `audit.all()` (not `audit.query()`): PASS  
- `culture.ts` contains `'skill.taught'` and `'skill.inferred'`: PASS
- `culture.ts` has no banned imports (d3, recharts, cytoscape, react-flow, nivo): PASS
- `culture-lineage` tests pass (8/8): PASS
- `grep "registerCultureRoutes" grid/src/api/server.ts`: PASS
- `grep "import('./routes/culture.js')" grid/src/api/server.ts`: PASS
- `node scripts/check-relationship-graph-deps.mjs` exits 0: PASS

## Known Stubs

None.

## Threat Flags

None. Per threat model T-21-02-01: endpoint exposes only hashes and DIDs (no content, no rule text, no lore body). T-21-02-02: labels generated via `lastDIDSegment()` and `.slice(0,6)` on known-format fields — no user-supplied free-text. T-21-02-03: O(N) audit scan is same risk profile as Phase 9 relationships endpoint.

## Self-Check: PASSED

Files:
- `grid/src/api/routes/culture.ts` — FOUND
- `grid/src/__tests__/culture-lineage.test.ts` — FOUND
- `grid/src/api/server.ts` contains `registerCultureRoutes` — FOUND

Commits:
- `fbf0132` — FOUND
- `3da18c2` — FOUND
