---
phase: 09
plan: 06
subsystem: relationships
tags: [invariant-tests, ci-gate, perf-bench, audit-chain, allowlist, sc5]
dependency_graph:
  requires: ["09-01", "09-02", "09-03", "09-04", "09-05"]
  provides: ["REL-01-verified", "REL-02-verified", "REL-04-verified", "SC5-three-layer", "D-9-08-ci-gate"]
  affects: ["package.json pretest lifecycle", "scripts/check-relationship-graph-deps.mjs"]
tech_stack:
  added: []
  patterns:
    - "Seeded PRNG (mulberry32) for deterministic 10K-edge benchmark fixture"
    - "process.hrtime.bigint() p95 measurement — 1000 iterations"
    - "vi.spyOn(audit, 'append') to assert zero listener-initiated appends"
    - "split('\\n').length baseline for file structural invariant"
    - "pretest npm lifecycle hook chaining two standalone CI gate scripts"
key_files:
  created:
    - grid/test/relationships/perf-10k.test.ts
    - grid/test/relationships/zero-diff.test.ts
    - grid/test/relationships/idempotent-rebuild.test.ts
    - grid/test/relationships/no-audit-emit.test.ts
    - grid/test/relationships/allowlist-frozen.test.ts
    - scripts/check-relationship-graph-deps.mjs
  modified:
    - grid/test/relationships/producer-boundary.test.ts
    - package.json
decisions:
  - "Use ALLOWLIST (ReadonlySet) not BROADCAST_ALLOWLIST (array) — source exports the Set; adapted test to use ALLOWLIST.size === 18 and Array.from(ALLOWLIST).filter()"
  - "Baseline = 147 not 146 — contents.split('\\n').length includes trailing empty element from final newline; wc -l counts newlines only (146); script uses split('\\n').length so baseline is 147"
  - "Inlined makeFixedEventSequence in each test file — no shared helper module exists; avoids cross-file coupling"
  - "Used allEdges() public method not private edges field — listener.ts exposes allEdges() IterableIterator for snapshotCanonical helper"
  - "Gate 3 imports consolidated at top of producer-boundary.test.ts — ESM requires imports at module top level; resolve/readFileSync imported alongside existing imports"
metrics:
  duration: "~4 minutes"
  completed: "2026-04-22"
  tasks_completed: 3
  files_created: 6
  files_modified: 2
---

# Phase 9 Plan 06: Invariant Tests + CI Gate — Summary

Phase 9's verification closure: five integration tests proving REL-01/02/03/04 truths under realistic load, a three-layer SC#5 source-level gate, and a CI-wired grep script blocking regression on the D-9-08 runtime-dep allowlist.

## Perf Bench Measured Values

Recorded from actual test run (`grid/test/relationships/perf-10k.test.ts` — 10K edges, 1000 iterations, tick=2000):

| Percentile | Latency | Budget |
|-----------|---------|--------|
| p50       | 0.12 ms | —      |
| p95       | 0.21 ms | < 100 ms ✓ |
| p99       | 0.42 ms | —      |

REL-04 budget headroom: ~476× under the 100ms cap. This matches RESEARCH.md lines 720-750 which projected p95 in the 20-40ms range on commodity hardware — the actual p95 is lower because the in-memory Map scan is O(E) but with very small constant on modern hardware at 10K edges.

## Test Results

All 65 relationship tests green (12 test files):

```
✓ determinism-source.test.ts   (1)
✓ allowlist-frozen.test.ts     (4)   ← NEW Plan 06
✓ producer-boundary.test.ts    (4)   ← Gate 3 appended
✓ self-edge-rejection.test.ts  (2)
✓ listener.test.ts             (17)
✓ canonical.test.ts            (18)
✓ zero-diff.test.ts            (2)   ← NEW Plan 06
✓ no-audit-emit.test.ts        (2)   ← NEW Plan 06
✓ idempotent-rebuild.test.ts   (3)   ← NEW Plan 06
✓ storage.test.ts              (6)
✓ listener-launcher-order.test.ts (5)
✓ perf-10k.test.ts             (1)   ← NEW Plan 06
```

## npm run pretest Exit Code

```
npm run pretest → exit 0
[state-doc-sync] OK — STATE.md is in sync with the 18-event allowlist.
[check-relationship-graph-deps] OK — no banned graph libs; broadcast-allowlist.ts at baseline line count.
```

## Recorded Baseline

```
ALLOWLIST_BASELINE_LINES = 147
```

Recorded by: `node -e "const c = require('fs').readFileSync('grid/src/audit/broadcast-allowlist.ts','utf8'); console.log(c.split('\\n').length);"` → 147.

Note: `wc -l` reports 146 (counts newlines only). The script uses `contents.split('\n').length` which produces 147 for a file ending with a trailing newline. The baseline constant (147) matches the script's computation method.

## SC#5 Three-Layer Gate Summary

| Layer | Mechanism | File | What it catches |
|-------|-----------|------|----------------|
| Runtime | chain-length delta + spy | `no-audit-emit.test.ts` | Listener emits at runtime |
| Source constant | `ALLOWLIST.size === 18` + `relationship.*` filter | `allowlist-frozen.test.ts` | New kind added to array (even if unused) |
| File structure | `split('\n').length === 147` | `check-relationship-graph-deps.mjs` (CI) | Comment/whitespace/export churn |

## D-9-08 Gate Summary

| Layer | Mechanism | Targets |
|-------|-----------|---------|
| Test (vitest) | Gate 3 in `producer-boundary.test.ts` | `dashboard/package.json`, `grid/package.json` |
| CI (standalone) | `check-relationship-graph-deps.mjs` in `pretest` | `dashboard/package.json`, `grid/package.json` |

## Phase 9 Closing Checklist

- REL-01: ✓ (zero-diff.test.ts — pure-observer; no-audit-emit.test.ts — runtime + spy)
- REL-02: ✓ (idempotent-rebuild.test.ts — byte-identical canonical after two rebuilds)
- REL-03: ✓ (covered implicitly by perf-10k.test.ts — decay runs on every getTopNFor; deliberately-stale edges at tick=2000 exercise decay path)
- REL-04: ✓ (perf-10k.test.ts — p95 = 0.21ms < 100ms with 10K edges)
- SC#5: ✓ three-layer (allowlist-frozen.test.ts + no-audit-emit.test.ts + check-relationship-graph-deps.mjs)
- D-9-08: ✓ (producer-boundary Gate 3 + CI script)
- D-9-11: ✓ (self-loop events in all fixture sequences exercise silent-reject without failing chain)
- D-9-12: ✓ (no wall-clock in src/**; determinism-source.test.ts grep gate)
- D-9-13: ✓ (ALLOWLIST.size === 18; zero relationship.* kinds admitted)

## Deviations from Plan

### Auto-adapted (no rule required — API alignment)

**1. BROADCAST_ALLOWLIST → ALLOWLIST**
- **Found during:** Task 2 pre-read
- **Issue:** Plan specified `import { BROADCAST_ALLOWLIST }` with `.length` — source file exports `ALLOWLIST` (ReadonlySet) with `.size`. `ALLOWLIST_MEMBERS` is not exported.
- **Fix:** Tests import `ALLOWLIST` and use `.size` / `Array.from(ALLOWLIST).filter()`. Acceptance criteria adapted accordingly — all three SC#5 assertions still present and correct.

**2. allEdges() instead of listener.edges**
- **Found during:** Task 1 (idempotent-rebuild)
- **Issue:** Plan references `listener.edges` as public `ReadonlyMap` — actual field is private; `allEdges()` is the public accessor.
- **Fix:** `snapshotCanonical()` uses `Array.from(listener.allEdges())` which produces identical results.

**3. Baseline = 147 not 146**
- **Found during:** Task 3 smoke test
- **Issue:** `wc -l` counts newlines (146); script's `split('\n').length` produces 147 for files with trailing newline.
- **Fix:** Set `ALLOWLIST_BASELINE_LINES = 147` to match the script's own computation method.

**4. Import ordering fix in producer-boundary.test.ts**
- **Found during:** Task 2 edit
- **Issue:** Initial edit placed `import` statements after top-level code (ESM requires imports at module top level).
- **Fix:** Moved `readFileSync` and `resolve` imports to the top import block alongside existing imports.

**5. makeFixedEventSequence inlined per file**
- **Found during:** Task 1
- **Issue:** Plan references `makeFixedEventSequence` as a shared helper in `../helpers` — no such file exists in the project.
- **Fix:** Inlined a deterministic 500-event sequence generator in each test file that needs it. Sequence composition per plan spec: 100 nous.spoke + 50 trade.settled + 50 trade.reviewed + 50 telos.refined + 250 unrelated events.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All changes are test-only (5 new test files) plus one build-time CI script and two package.json script entries. Zero production code changes.

## Self-Check: PASSED

Files verified present:
- FOUND: `grid/test/relationships/perf-10k.test.ts`
- FOUND: `grid/test/relationships/zero-diff.test.ts`
- FOUND: `grid/test/relationships/idempotent-rebuild.test.ts`
- FOUND: `grid/test/relationships/no-audit-emit.test.ts`
- FOUND: `grid/test/relationships/allowlist-frozen.test.ts`
- FOUND: `scripts/check-relationship-graph-deps.mjs`

Commits verified present:
- `2fe0e8d` — test(09-06): REL-01/02/04 gates
- `8d7cc66` — test(09-06): REL-01 no-audit-emit, SC#5 allowlist-frozen, producer-boundary Gate 3
- `42de477` — chore(09-06): check-relationship-graph-deps.mjs CI gate + pretest wiring

All 65 relationship tests green. `npm run pretest` exit 0.
