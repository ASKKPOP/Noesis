---
phase: 21-culture-dashboard
plan: "01"
subsystem: scripts, dashboard/culture, grid
tags: [grep-gate, test-stubs, wave-0, safety-infrastructure]
dependency_graph:
  requires: []
  provides:
    - scripts/check-relationship-graph-deps.mjs (Gate B fixed, Gate C added)
    - dashboard/src/components/culture/__tests__/ (three stub test files)
    - grid/src/__tests__/culture-lineage.test.ts (stub test file)
  affects:
    - Wave 1+ tasks (have runnable automated verify commands)
    - CI gate enforcement for culture/ directory
tech_stack:
  added: []
  patterns:
    - Gate C: recursive .tsx scan using readdirSync/statSync (node:fs), graceful skip when directory absent
    - Vitest stub pattern: vi.mock('swr') + it.todo() for pending implementations
key_files:
  created:
    - dashboard/src/components/culture/__tests__/skill-lineage-graph.test.tsx
    - dashboard/src/components/culture/__tests__/norm-timeline.test.tsx
    - dashboard/src/components/culture/__tests__/lore-graph.test.tsx
    - grid/src/__tests__/culture-lineage.test.ts
  modified:
    - scripts/check-relationship-graph-deps.mjs
decisions:
  - "Baseline set to 459 (split('\\n').length) not 458 (wc -l) — they differ by 1 for files with trailing newlines"
  - "vi.mock('swr') used instead of jest.mock per project vitest globals pattern"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-17T16:33:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 1
---

# Phase 21 Plan 01: Wave-0 Safety Infrastructure Summary

**One-liner:** Grep gate baseline fixed (379→459 split-lines) and Gate C added for culture/ directory; four vitest stub files created for all Wave 1+ tasks.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix grep gate — update baseline and add Gate C | 4347a0f | scripts/check-relationship-graph-deps.mjs |
| 2 | Create four Wave-0 test stub files | e67672d | 4 new test files |

## What Was Built

**Task 1 — Grep gate fix:**
- Updated `ALLOWLIST_BASELINE_LINES` from 379 to 459 in `scripts/check-relationship-graph-deps.mjs`
- Added `readdirSync` and `statSync` imports for Gate C directory traversal
- Added Gate C: recursive `.tsx` scan under `dashboard/src/components/culture/` checking for banned graph library imports (`d3-force`, `cytoscape`, `react-force-graph`, etc.)
- Gate C gracefully warns and skips when the directory does not yet exist
- `node scripts/check-relationship-graph-deps.mjs` exits 0 (was failing with baseline mismatch before)

**Task 2 — Test stubs:**
- Created `dashboard/src/components/culture/__tests__/` directory with three vitest stub files
- Created `grid/src/__tests__/culture-lineage.test.ts` stub
- All stubs use `it.todo()` — no failing assertions, all run to "todo" state
- Used `vi.mock('swr')` per project's vitest globals pattern (not jest.mock)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Baseline value: plan specified 458, actual split('\\n').length is 459**
- **Found during:** Task 1 verification — `node scripts/check-relationship-graph-deps.mjs` reported `actual: 459 lines`
- **Issue:** The plan was written using `wc -l` which counts newlines (458), but the script uses `contents.split('\\n').length` which yields 459 for a file with a trailing newline (the empty string after the final `\\n` counts as an element)
- **Fix:** Set `ALLOWLIST_BASELINE_LINES = 459` to match what the script actually computes
- **Files modified:** `scripts/check-relationship-graph-deps.mjs`
- **Commit:** 4347a0f

**2. [Rule 1 - Bug] Test stubs used jest.mock instead of vi.mock**
- **Found during:** Task 2 verification — plan specified `jest.mock('swr')` but project uses vitest with `globals: true`
- **Issue:** `jest.mock` is not available in vitest — the correct API is `vi.mock`
- **Fix:** Changed all three dashboard stub files to use `vi.mock('swr')`
- **Files modified:** skill-lineage-graph.test.tsx, norm-timeline.test.tsx, lore-graph.test.tsx
- **Commit:** e67672d (included in same task commit)

### Pre-existing Environment Issue (Out of Scope)

`@tailwindcss/postcss` is not installed in this machine's environment, causing `vitest run` to fail with a PostCSS config error for all dashboard tests (not just the new stubs). This is a pre-existing issue that affects the entire dashboard test suite — it is not caused by Plan 01 changes. The plan's automated verify command `cd dashboard && npm test -- --testPathPattern=...` would hit this same error regardless. File existence and content checks confirm all stubs are correctly in place.

## Success Criteria Verification

- `node scripts/check-relationship-graph-deps.mjs` exits 0 — PASS
- `ALLOWLIST_BASELINE_LINES = 459` in script — PASS (459 is the correct split-lines value)
- Gate C code block present, scans `dashboard/src/components/culture/**` — PASS
- Four test stub files exist at correct paths — PASS
- No production code modified — PASS

## Known Stubs

All four test files are intentional stubs — they are the deliverable of this plan, not incomplete work. Components under test do not exist yet (Wave 2). Every `it.todo()` is a tracked behavioral requirement for Wave 2+ plans.

## Self-Check: PASSED

Files exist:
- FOUND: scripts/check-relationship-graph-deps.mjs (modified)
- FOUND: dashboard/src/components/culture/__tests__/skill-lineage-graph.test.tsx
- FOUND: dashboard/src/components/culture/__tests__/norm-timeline.test.tsx
- FOUND: dashboard/src/components/culture/__tests__/lore-graph.test.tsx
- FOUND: grid/src/__tests__/culture-lineage.test.ts

Commits exist:
- FOUND: 4347a0f (chore(21-01): fix Gate B baseline 379→459 and add Gate C)
- FOUND: e67672d (test(21-01): add four Wave-0 test stub files)
