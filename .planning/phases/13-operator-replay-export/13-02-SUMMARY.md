---
phase: 13-operator-replay-export
plan: "02"
subsystem: replay-core
tags: [tdd, green-tests, replay, audit, read-only-chain, t-10-07, ci-gate]
dependency_graph:
  requires:
    - 13-01 (RED test scaffolding — readonly-chain.test.ts, replay-grid.test.ts, state-builder.test.ts)
  provides:
    - grid/src/replay/readonly-chain.ts (ReadOnlyAuditChain — T-10-07 runtime defense)
    - grid/src/replay/replay-grid.ts (ReplayGrid — isolated read-only harness)
    - grid/src/replay/state-builder.ts (buildStateAtTick — REPLAY-04 pure state snapshot)
    - grid/src/replay/index.ts (public barrel)
    - scripts/check-replay-readonly.mjs (CI gate — T-10-07 belt-and-suspenders)
  affects:
    - grid/package.json (lint:replay-readonly npm script added)
tech_stack:
  added: []
  patterns:
    - ReadOnlyAuditChain extends AuditChain (override append → never, per persistent-chain.ts template)
    - Construction order mirrors D-9-04 (audit → registry → logos → aggregator → relationships → governance)
    - chain.ts:74 silent-restore caveat encoded via explicit rebuildFromChain() call
    - CI grep gate pattern (mirrors check-wallclock-forbidden.mjs structure)
key_files:
  created:
    - grid/src/replay/readonly-chain.ts
    - grid/src/replay/replay-grid.ts
    - grid/src/replay/state-builder.ts
    - grid/src/replay/index.ts
    - scripts/check-replay-readonly.mjs
  modified:
    - grid/package.json (added lint:replay-readonly)
decisions:
  - "ReplayGrid constructor uses positional signature (entries, gridName) to match test expectations — ReplayGridOptions interface retained for plan API compatibility"
  - "buildStateAtTick exported as function name to match state-builder.test.ts import (plan used buildReplayState but tests import buildStateAtTick)"
  - "CI gate skips comment lines (// and block-comment *) to avoid false positives from documentation text mentioning the forbidden pattern"
  - "rebuildFromChain() exposed as public ReplayGrid method per test contract (replay-grid.test.ts line 96 calls it explicitly)"
  - "No GovernanceEngine proposal replay in rebuildFromChain (governance state reconstruction deferred to Wave 3 where proposal events are introduced)"
metrics:
  duration_seconds: 480
  completed_date: "2026-04-27"
  tasks_completed: 3
  tasks_total: 3
  files_created: 5
  files_modified: 1
---

# Phase 13 Plan 02: Wave 1 Implementation — Read-Only Chain + ReplayGrid Summary

**One-liner:** ReadOnlyAuditChain + ReplayGrid + buildStateAtTick turning 8 Wave 0 RED tests GREEN with three-layer T-10-07 defense (type, runtime, CI gate).

## What Was Built

Wave 1 turned the three Wave 0 RED test files GREEN by implementing the immutable substrate every other Phase 13 wave depends on. The core invariant: no replay code can ever write to the audit chain — enforced at the type system level, at runtime, and by a permanent CI grep gate.

### Files Created

| File | Purpose | Lines |
|------|---------|-------|
| `grid/src/replay/readonly-chain.ts` | ReadOnlyAuditChain — T-10-07 primary runtime defense | 92 |
| `grid/src/replay/replay-grid.ts` | ReplayGrid — isolated harness mirroring GenesisLauncher order | 159 |
| `grid/src/replay/state-builder.ts` | buildStateAtTick — pure state snapshot function (REPLAY-04) | 84 |
| `grid/src/replay/index.ts` | Public barrel re-exporting all three surfaces | 10 |
| `scripts/check-replay-readonly.mjs` | CI gate scanning grid/src/replay/** for chain-append calls | 77 |

### Files Modified

| File | Change |
|------|--------|
| `grid/package.json` | Added `"lint:replay-readonly": "cd .. && node scripts/check-replay-readonly.mjs"` to scripts block |

### Tests turned GREEN

| Test File | Tests | Status |
|-----------|-------|--------|
| `grid/test/replay/readonly-chain.test.ts` | 3 | GREEN |
| `grid/test/replay/replay-grid.test.ts` | 3 | GREEN |
| `grid/test/replay/state-builder.test.ts` | 2 | GREEN |
| **Total** | **8** | **8/8 pass** |

### Three-Layer T-10-07 Mitigation

The plan mandated a belt-and-suspenders approach to the CRITICAL risk "Replay engine shares state with live Grid":

**Layer 1 — Type system:** `ReadOnlyAuditChain.override append(): never` — any code holding a `ReadOnlyAuditChain` reference that calls `append()` without a cast is a compile-time error.

**Layer 2 — Runtime throw:** `append()` throws `TypeError` with message containing `'read-only'` and `'T-10-07'` BEFORE any super-class call. No mutation of chain state (`length`, `head`, `entries`) can occur.

**Layer 3 — CI gate:** `scripts/check-replay-readonly.mjs` scans `grid/src/replay/**/*.ts` (excluding test files, `.d.ts`, `node_modules/`, `dist/`) for code lines matching `/\.append\s*\(/`. Exits 0 on clean, exits 1 with `file:line:match` diagnostic on violation. Wired to `npm run lint:replay-readonly` in `grid/package.json`.

### Construction Order (D-9-04 mirror)

`ReplayGrid` constructor mirrors `GenesisLauncher` exactly with three substitutions:

```
1. audit: ReadOnlyAuditChain(entries)    ← was: new AuditChain()
2. registry: NousRegistry()
3. logos: LogosEngine()
4. aggregator: DialogueAggregator(audit)
5. relationships: RelationshipListener(audit)
6. governanceStore + governance: GovernanceEngine(audit, store, registry, logos)
   (no httpServer, no wsHub, no clock, no Brain bridges)
```

### chain.ts:74 Silent-Restore Caveat

`AuditChain.loadEntries()` does NOT fire `onAppend` listeners — this is by design (the "silent restore" path). Since `RelationshipListener` registers its `handleEntry` handler via `onAppend` at construction time, those handlers are dormant after `loadEntries`. The `rebuildFromChain()` call (exposed as a public method on `ReplayGrid` and called inside `buildStateAtTick`) explicitly walks `audit.all()` and feeds each entry through the listener's `handleEntry()` to reconstruct relationship edge state.

This caveat is:
1. Documented in `replay-grid.ts` constructor inline comments
2. Documented in `state-builder.ts` header docblock  
3. Tested: `state-builder.test.ts` test 2 verifies deterministic edge reconstruction across two independent `ReplayGrid` runs from the same entries

### npm Script Wiring

```json
"lint:replay-readonly": "cd .. && node scripts/check-replay-readonly.mjs"
```

Placed adjacent to the existing `lint` script in `grid/package.json`. The `cd ..` changes to the repo root (where `scripts/` lives) before running the gate.

## Git Commits

| Hash | Message |
|------|---------|
| `b881578` | `feat(13-02): Task 1 — ReadOnlyAuditChain + barrel export (T-10-07 defense)` |
| `f043acc` | `feat(13-02): Task 2 — ReplayGrid + buildStateAtTick (REPLAY-03, REPLAY-04)` |
| `e387bfe` | `feat(13-02): Task 3 — CI gate check-replay-readonly.mjs + npm wiring` |

## Deviations from Plan

**[Rule 1 - Adaptation] Constructor signature uses positional args, not ReplayGridOptions**
- **Found during:** Task 2, Step 2 (reading replay-grid.test.ts before implementing)
- **Issue:** The plan specified `new ReplayGrid(options: ReplayGridOptions)` but the Wave 0 RED tests call `new ReplayGrid([], 'test-grid')` — a two-argument positional form.
- **Fix:** Constructor uses `(entries: ReadonlyArray<AuditEntry>, gridName: string)`. The `ReplayGridOptions` interface was retained as an exported type for future API compatibility (referenced in plan D-13-03).
- **Files modified:** `grid/src/replay/replay-grid.ts`
- **Impact:** None — tests pass; interface is forward-compatible.

**[Rule 1 - Adaptation] Export named `buildStateAtTick`, not `buildReplayState`**
- **Found during:** Task 2, Step 1 (reading state-builder.test.ts)
- **Issue:** The plan specified `buildReplayState(entries, targetTick)` taking raw entries, but the Wave 0 test imports `buildStateAtTick` and calls `buildStateAtTick(replay, tick)` taking a `ReplayGrid` instance.
- **Fix:** Exported `buildStateAtTick(replay: ReplayGrid, tick: number): ReplayState`. The `index.ts` barrel re-exports it as `buildStateAtTick`. The `ReplayState` interface is structurally compatible with the plan spec (adds `tick` field, uses `relationshipEdges` matching test access pattern).
- **Files modified:** `grid/src/replay/state-builder.ts`, `grid/src/replay/index.ts`
- **Impact:** None — tests pass; the plan's interface was a design sketch superseded by the concrete test contract.

**[Rule 2 - CI gate comment-skipping] Added comment-line exclusion to grep gate**
- **Found during:** Task 3, local testing
- **Issue:** Documentation comments in `readonly-chain.ts` and `state-builder.ts` used phrases like "no append call" which, without exclusion, could cause the gate to produce false positives if phrased differently.
- **Fix:** Gate script skips lines where `trimmed.startsWith('//')` or `trimmed.startsWith('*')` or `trimmed.startsWith('/*')`. Enforces code-level violations only.
- **Impact:** The gate correctly catches actual code violations (verified via negative test at line 160) while ignoring documentation.

## Known Stubs

None — all production code paths are fully implemented. No placeholder data flows to any consumer.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. All files are pure in-memory TypeScript with no I/O surface.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `grid/src/replay/readonly-chain.ts` | FOUND |
| `grid/src/replay/replay-grid.ts` | FOUND |
| `grid/src/replay/state-builder.ts` | FOUND |
| `grid/src/replay/index.ts` | FOUND |
| `scripts/check-replay-readonly.mjs` | FOUND |
| Commit `b881578` | FOUND |
| Commit `f043acc` | FOUND |
| Commit `e387bfe` | FOUND |
| 8/8 Wave 0 replay tests GREEN | VERIFIED |
| CI gate exits 0 | VERIFIED |
| npm lint:replay-readonly exits 0 | VERIFIED |
| 0 `.append(` calls in grid/src/replay/*.ts | VERIFIED |
| 0 httpServer/wsHub references | VERIFIED |
| 0 wall-clock reads | VERIFIED |
| rebuildFromChain present in replay-grid.ts + state-builder.ts | VERIFIED |
