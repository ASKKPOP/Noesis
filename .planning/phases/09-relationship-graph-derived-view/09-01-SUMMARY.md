---
phase: "09"
plan: "01"
subsystem: "relationships"
tags:
  - phase-09
  - relationships
  - scaffolding
  - wave-0
  - pure-primitives
dependency_graph:
  requires: []
  provides:
    - grid/src/relationships/types.ts (Edge, RelationshipConfig, WarmthBucket, SpokeObservation)
    - grid/src/relationships/config.ts (DEFAULT_RELATIONSHIP_CONFIG frozen)
    - grid/src/relationships/canonical.ts (canonicalEdge, edgeHash, decayedWeight, warmthBucket, sortedPairKey)
    - grid/src/relationships/index.ts (barrel re-export)
    - sql/009_relationships.sql (relationships derived table)
    - dashboard/package.json + root package-lock.json (swr@^2.4.1 installed)
  affects:
    - Wave 1 (09-02): listener.ts + storage.ts compile against these types
    - Wave 3 (09-05): useRelationships hook can import swr
tech_stack:
  added:
    - swr@^2.4.1 (dashboard dependency, hoisted to root node_modules via npm workspaces)
  patterns:
    - Object.freeze for runtime-immutable config (cloned from broadcast-allowlist.ts)
    - NodeNext .js barrel exports (cloned from dialogue/index.ts)
    - Pure-function crypto helpers (cloned from dialogue/dialogue-id.ts)
    - Verbatim research reference for canonical.ts (RESEARCH.md §Code Examples lines 828-866)
    - Walk + readFileSync grep gate for determinism-source.test.ts
key_files:
  created:
    - grid/src/relationships/types.ts
    - grid/src/relationships/config.ts
    - grid/src/relationships/canonical.ts
    - grid/src/relationships/index.ts
    - sql/009_relationships.sql
    - grid/test/relationships/canonical.test.ts
    - grid/test/relationships/self-edge-rejection.test.ts
    - grid/test/relationships/determinism-source.test.ts
  modified:
    - dashboard/package.json (added swr dependency)
    - package-lock.json (root; swr added via npm workspaces hoisting)
decisions:
  - "Index.ts uses named exports (not export *) to satisfy grep-based acceptance criterion for sortedPairKey"
  - "swr installed as ^2.4.1 (npm resolved ^2.2.0 request to latest stable ^2.4.1)"
  - "Root package-lock.json is the authoritative lock file (npm workspaces monorepo — no dashboard-level lock)"
  - "canonical.ts comment avoids wall-clock keywords to pass D-9-12 grep gate cleanly"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-22"
  tasks_completed: 3
  tasks_total: 3
  files_created: 8
  files_modified: 2
  tests_added: 21
  tests_total_after: 677
---

# Phase 09 Plan 01: Relationship Primitives (Wave 0 Scaffold) Summary

Wave 0 scaffold for the relationship graph subsystem: pure TypeScript primitives (types, frozen config, canonical helpers), MySQL migration, swr dependency installation, and three regression test gates locking D-9-10/D-9-11/D-9-12 invariants.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Types, config, canonical primitives | 0a581d5 | grid/src/relationships/{types,config,canonical,index}.ts |
| 2 | MySQL migration + swr install | 7d8ec89 | sql/009_relationships.sql, dashboard/package.json, package-lock.json |
| 3 | Wave 0 regression tests | 6d4550e | grid/test/relationships/{canonical,self-edge-rejection,determinism-source}.test.ts |

## Evidence

### Test run output

```
Test Files  3 passed (3)
     Tests  21 passed (21)
  Start at  20:07:32
  Duration  235ms
```

Full grid suite: **677/677** tests passing.

### ls grid/src/relationships/

```
canonical.ts  config.ts  index.ts  types.ts
```

### swr version confirmation

```json
"swr": "^2.4.1"
```

Installed at root `node_modules/swr` (npm workspaces hoisting). `package-lock.json` has 1 `"swr"` entry.

### TypeScript compilation

```
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E 'relationships/'
→ (no output) — relationships module compiles clean
```

### Module self-containment

```
grep -r "import.*relationships" grid/src/
→ Zero hits — module is self-contained; no wiring yet
```

### Wall-clock grep gate

```
grep -rE "Date\.now|performance\.now|setInterval|setTimeout|Math\.random" grid/src/relationships/
→ No wall-clock violations
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] canonical.ts comment contained wall-clock keywords**

- **Found during:** Task 1 post-write verification
- **Issue:** The doc comment described what the module avoids using (Date.now, Math.random, etc.) verbatim — causing the D-9-12 grep gate to flag the source file itself
- **Fix:** Rewrote comment to say "wall-clock access" and "randomness" without using the banned keyword literals
- **Files modified:** grid/src/relationships/canonical.ts
- **Commit:** Included in 0a581d5

**2. [Rule 2 - Convention] Named barrel exports instead of export ***

- **Found during:** Task 1 acceptance-criteria check
- **Issue:** Plan action specified `export * from './canonical.js'` but acceptance criterion required `grep -c "sortedPairKey" grid/src/relationships/index.ts` → 1. The wildcard re-export would not contain the literal string.
- **Fix:** Used explicit named exports to satisfy both the intent (barrel) and the grep-based acceptance criterion
- **Files modified:** grid/src/relationships/index.ts
- **Commit:** Included in 0a581d5

**3. [Rule 3 - Deviation] dashboard/package-lock.json does not exist (npm workspaces)**

- **Found during:** Task 2 acceptance-criteria check
- **Issue:** Plan acceptance criterion specified `test -f dashboard/package-lock.json`. The project is an npm workspaces monorepo; the authoritative lock file is at the root (`package-lock.json`), not in dashboard/.
- **Fix:** Verified swr installation via root lock file (1 `"swr"` entry) and root `node_modules/swr` presence. No action needed beyond acknowledging the monorepo structure.
- **Impact:** Acceptance criterion strictly as written cannot pass (no dashboard-level lock exists in this repo). The spirit of the criterion (swr locked for reproducible installs) is fully met by the root lock file.

## Known Stubs

None. Wave 0 creates pure primitives only — no UI rendering, no data source wiring, no placeholders. The `swr` dependency is installed but not yet imported anywhere (intentional — Wave 3 will wire it).

## Threat Flags

None. Wave 0 introduces no network endpoints, no auth paths, no file access patterns, and no schema changes at trust boundaries. The SQL migration file is a schema-only DDL; it does not execute.

## Self-Check: PASSED

Verified:
- `grid/src/relationships/types.ts` — FOUND
- `grid/src/relationships/config.ts` — FOUND
- `grid/src/relationships/canonical.ts` — FOUND
- `grid/src/relationships/index.ts` — FOUND
- `sql/009_relationships.sql` — FOUND
- `grid/test/relationships/canonical.test.ts` — FOUND
- `grid/test/relationships/self-edge-rejection.test.ts` — FOUND
- `grid/test/relationships/determinism-source.test.ts` — FOUND
- Commit `0a581d5` — FOUND
- Commit `7d8ec89` — FOUND
- Commit `6d4550e` — FOUND
