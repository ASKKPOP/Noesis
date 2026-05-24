---
phase: 31
plan: 05
subsystem: ci-gates
tags: [ci, static-analysis, obs-03, audit-pipeline, no-silent-catch]
dependency_graph:
  requires: [31-03]
  provides: [OBS-03-enforcement]
  affects: [.github/workflows/rig-invariants.yml, scripts/]
tech_stack:
  added: []
  patterns: [static-analysis-gate, walkDir-scanFile-pattern, no-silent-catch-enforcement]
key_files:
  created:
    - scripts/check-no-silent-catch.mjs
  modified:
    - .github/workflows/rig-invariants.yml
decisions:
  - "Scope locked to grid/src/db/ + grid/src/audit/ only — api/brain/dashboard deferred per D-31-B3"
  - "Added second rule no-silent-catch-bound-console to catch .catch(console.warn) bound-handler form"
  - "Gate placed before Vitest step for fast feedback — static analysis is cheap, vitest is not"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-23"
  tasks_completed: 2
  files_changed: 2
---

# Phase 31 Plan 05: OBS-03 CI Gate — No Silent Catch Summary

**One-liner:** Static analysis gate blocking `.catch(...console.{warn,log,debug,error}(...))` regressions in `grid/src/db/` and `grid/src/audit/`, wired into `rig-invariants.yml` CI workflow.

## What Was Built

Two deliverables:

1. **`scripts/check-no-silent-catch.mjs`** (135 lines, executable)
   - Scans `grid/src/db/` and `grid/src/audit/` for the silent-catch pattern Plan 03 removed
   - Two rules: `no-silent-catch-console` (arrow-function form) + `no-silent-catch-bound-console` (bound handler form `.catch(console.warn)`)
   - Exits 0 when clean, exits 1 with `file:line:rule:text` report on any violation
   - Excludes `*.test.ts`, `*.d.ts`, `node_modules/`, `dist/`, `build/`, `.next/`
   - Cloned from `scripts/check-rig-invariants.mjs` pattern (walkDir + scanFile helpers, identical exclusion lists)

2. **`.github/workflows/rig-invariants.yml`** (surgical +3 lines)
   - Added `OBS-03 no-silent-catch gate (Phase 31)` step between T-10-12 check and Vitest step
   - No new workflow file created — surgical edit to existing file per CLAUDE.md §3

## Gate Verification Results

**Gate exits 0 on current (post-Plan-03) codebase:**
```
[check-no-silent-catch] OK — no silent .catch(...console.*) patterns in grid/src/db/ or grid/src/audit/
EXIT_CODE=0
```

**Gate exits 1 on injected violation (sanity self-test):**
- Injected `somePromise().catch(err => console.warn('silent fail', err));` into `grid/src/db/persistent-chain.ts`
- Gate output:
  ```
  [check-no-silent-catch] VIOLATIONS FOUND:
    file:line  rule  text
    grid/src/db/persistent-chain.ts:79:no-silent-catch-console:somePromise().catch(err => console.warn('silent fail', err));
  ```
- EXIT_CODE=1 confirmed
- Injection reverted — current tree is clean

**YAML validation:** `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/rig-invariants.yml'))"` exits 0.

## Deviations from Plan

None — plan executed exactly as written.

The plan specified both rules (no-silent-catch-console + no-silent-catch-bound-console). Both were included as specified in the plan interfaces block. No scope was widened.

## Commits

| Task | Description | Hash |
|------|-------------|------|
| 5.1 | Create scripts/check-no-silent-catch.mjs | c89060d |
| 5.2 | Wire gate into .github/workflows/rig-invariants.yml | 01a5285 |

## Known Stubs

None.

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundaries introduced. This plan adds a read-only static analysis script and a CI step. STRIDE threats T-31-18 (regex bypass via eval) and T-31-19 (catastrophic backtracking) were evaluated in the plan — T-31-19 accepted as-is (bounded regex, O(n) per line). No additional surface beyond what the plan's threat model covers.

## Self-Check: PASSED

- `scripts/check-no-silent-catch.mjs` exists and is executable: CONFIRMED
- `c89060d` commit exists: CONFIRMED
- `01a5285` commit exists: CONFIRMED
- Gate exits 0 on current codebase: CONFIRMED
- YAML parses: CONFIRMED
- No new workflow files: CONFIRMED (2 files total, unchanged count)
- Script is 135 lines (target 90-140): CONFIRMED
- Contains FORBIDDEN_PATTERN: CONFIRMED
- Contains both scan dirs (db + audit): CONFIRMED
- Does NOT contain api/brain/dashboard scope: CONFIRMED
