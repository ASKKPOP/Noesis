---
phase: 13-operator-replay-export
plan: "01"
subsystem: replay-red-scaffolding
tags: [tdd, red-tests, dependencies, replay, audit, export]
dependency_graph:
  requires: []
  provides:
    - grid/test/replay/readonly-chain.test.ts (locks REPLAY-03 / T-10-07 acceptance)
    - grid/test/replay/replay-grid.test.ts (locks REPLAY-03 / T-10-08 acceptance)
    - grid/test/replay/state-builder.test.ts (locks REPLAY-04 / D-13-04 acceptance)
    - grid/test/replay/tarball-determinism.test.ts (locks REPLAY-01 determinism acceptance)
    - grid/test/audit/operator-exported-allowlist.test.ts (locks allowlist 26→27 acceptance)
    - grid/test/audit/operator-exported-payload-privacy.test.ts (locks T-13-01-02 privacy acceptance)
    - grid/test/audit/operator-exported-producer-boundary.test.ts (locks sole-producer gate)
    - dashboard/src/app/grid/replay/replay-client.test.tsx (locks REPLAY-05 / T-10-09 acceptance)
    - dashboard/src/app/grid/replay/export-consent-dialog.test.tsx (locks T-10-10 consent acceptance)
  affects:
    - grid/package.json (better-sqlite3, tar dependencies added)
    - package-lock.json (updated)
tech_stack:
  added:
    - better-sqlite3@^12.9.0 (grid dependency — in-memory SQLite for ReplayGrid chain)
    - tar@^7.5.13 (grid dependency — deterministic tarball construction)
    - "@types/better-sqlite3@^7.6.13" (grid devDependency)
    - "@types/tar@^6.1.13" (grid devDependency)
  patterns:
    - TDD RED-only wave (Wave 0 — all tests intentionally failing)
    - Phase 8 IrreversibilityDialog verbatim-copy-lock cloned for ExportConsentDialog
    - Phase 6 sole-producer grep gate pattern cloned for operator.exported
    - Phase 8 paste-suppression pattern cloned for export consent Grid-ID input
key_files:
  created:
    - grid/test/replay/readonly-chain.test.ts
    - grid/test/replay/replay-grid.test.ts
    - grid/test/replay/state-builder.test.ts
    - grid/test/replay/tarball-determinism.test.ts
    - grid/test/audit/operator-exported-allowlist.test.ts
    - grid/test/audit/operator-exported-payload-privacy.test.ts
    - grid/test/audit/operator-exported-producer-boundary.test.ts
    - dashboard/src/app/grid/replay/replay-client.test.tsx
    - dashboard/src/app/grid/replay/export-consent-dialog.test.tsx
  modified:
    - grid/package.json (added better-sqlite3, tar, type definitions)
    - package-lock.json (676 packages added, better-sqlite3 + tar installed)
decisions:
  - "Wave 0 is strictly RED-only — no implementation files created"
  - "ALLOWLIST_MEMBERS import in allowlist test will fail at undefined access until Wave 3 exports it"
  - "Dashboard tests fail at vite import-resolution (no .tsx source) — valid RED mode"
  - "Grid replay/tarball tests fail at Node module-resolution (no .js source) — valid RED mode"
  - "Both dashboard test files mirror verbatim export copy constants for cross-file drift detection"
metrics:
  duration_seconds: 395
  completed_date: "2026-04-27"
  tasks_completed: 2
  tasks_total: 2
  files_created: 9
  files_modified: 2
---

# Phase 13 Plan 01: RED Test Scaffolding — Wave 0 Summary

**One-liner:** RED test scaffold for Phase 13 operator replay & export — 9 failing test files encoding all REPLAY-01..05 acceptance criteria + better-sqlite3 + tar deps installed.

## What Was Built

Wave 0 locked every acceptance criterion for Waves 1–4 into executable, failing tests before any implementation was written. This is the Nyquist gate: nothing ships in Phase 13 without a pre-written automated verifier.

### Dependencies installed (grid workspace)

```
npm install output (abbreviated):
  added 676 packages in 15s
  better-sqlite3@12.9.0 — OK (node -e require passes)
  tar@7.5.13 — OK (node -e require passes)
  @types/better-sqlite3@7.6.13 — devDependency
  @types/tar@6.1.13 — devDependency
```

### RED test files created

| File | Line Count | Tests Defined | RED Reason |
|------|-----------|---------------|------------|
| `grid/test/replay/readonly-chain.test.ts` | 64 | 3 | Import fails: `src/replay/readonly-chain.ts` does not exist (Wave 1) |
| `grid/test/replay/replay-grid.test.ts` | 90 | 3 | Import fails: `src/replay/replay-grid.ts` does not exist (Wave 1) |
| `grid/test/replay/state-builder.test.ts` | 100 | 2 | Import fails: `src/replay/state-builder.ts` does not exist (Wave 2) |
| `grid/test/replay/tarball-determinism.test.ts` | 90 | 2 | Import fails: `src/replay/tarball.ts` does not exist (Wave 2) |
| `grid/test/audit/operator-exported-allowlist.test.ts` | 40 | 3 | `ALLOWLIST_MEMBERS` not exported + allowlist has 26 not 27 entries (Wave 3) |
| `grid/test/audit/operator-exported-payload-privacy.test.ts` | 130 | 13 | Import fails: `src/audit/append-operator-exported.ts` does not exist (Wave 3) |
| `grid/test/audit/operator-exported-producer-boundary.test.ts` | 65 | 1 | `matchingFiles.length === 0` not 1 (Wave 3 creates sole-producer) |
| `dashboard/src/app/grid/replay/replay-client.test.tsx` | 125 | 6 | Import fails: `./replay-client` does not exist (Wave 4) |
| `dashboard/src/app/grid/replay/export-consent-dialog.test.tsx` | 140 | 10 | Import fails: `./export-consent-dialog` does not exist (Wave 4) |

**Total: 9 test files, 43 test cases defined, all in RED state.**

### Failing test counts

```
Grid:      7 files failed (7 fail-or-error) — 4 tests execute + fail, rest fail at import
Dashboard: 2 files failed (2 fail-or-error) — both fail at vite import-resolution
```

### Acceptance criteria verification

```
grep -c '"better-sqlite3"' grid/package.json  → 1 ✓
grep -c '"tar"' grid/package.json             → 1 ✓
node -e "require('better-sqlite3')"          → exit 0 ✓
node -e "require('tar')"                     → exit 0 ✓
ls grid/test/replay/*.test.ts                → 4 files ✓
ls grid/test/audit/operator-exported*.ts     → 3 files ✓
ls dashboard/.../replay/*.test.tsx           → 2 files ✓
Both dashboard files contain 'Export audit chain slice' ✓
Both dashboard files contain 'Export forever' ✓
Both dashboard files contain 'Keep private' ✓
Each file ends with // RED until Wave N comments ✓
Pre-existing grid test suite: 1266/1266 PASSING ✓
```

## Git Commits

| Hash | Message |
|------|---------|
| `912fb9e` | `test(13-01): RED scaffold grid-side replay/audit tests + install deps` |
| `a7b2e30` | `test(13-01): RED scaffold dashboard replay/export-consent tests` |

## Deviations from Plan

None — plan executed exactly as written with one minor deviation documented:

**[Rule 2 - Missing Export] `ALLOWLIST_MEMBERS` not exported from broadcast-allowlist.ts**
- **Found during:** Task 1, Step 6 (writing allowlist test)
- **Issue:** The plan's test imports `ALLOWLIST_MEMBERS` from `broadcast-allowlist.ts`, but the constant is declared `const` (not `export const`). The import resolves but the symbol is `undefined`, causing the test to fail with `TypeError: Cannot read properties of undefined`.
- **Fix:** This is acceptable RED state — the test fails for the right reason (allowlist doesn't have 27 entries, and the export is missing). Wave 3 (Plan 13-04) must also export `ALLOWLIST_MEMBERS` when it bumps the allowlist 26→27.
- **Files modified:** None — no production code modified in Wave 0.
- **Impact on Wave 3:** Wave 3 must add `export` to `ALLOWLIST_MEMBERS` declaration in `grid/src/audit/broadcast-allowlist.ts` in addition to appending `'operator.exported'` at position 27.

## Known Stubs

None — this plan creates only test files and installs dependencies. No production implementation stubs.

## Threat Flags

None — Wave 0 creates only test files and installs audited npm packages. No new network endpoints, auth paths, file access patterns, or schema changes.

## Wave 1–4 Guide

Wave 1 executors (Plan 13-02) must turn these RED tests GREEN:
- `grid/test/replay/readonly-chain.test.ts` — create `grid/src/replay/readonly-chain.ts`
- `grid/test/replay/replay-grid.test.ts` — create `grid/src/replay/replay-grid.ts`

Wave 2 executors (Plan 13-03) must turn these RED tests GREEN:
- `grid/test/replay/state-builder.test.ts` — create `grid/src/replay/state-builder.ts`
- `grid/test/replay/tarball-determinism.test.ts` — create `grid/src/replay/tarball.ts`

Wave 3 executors (Plan 13-04) must turn these RED tests GREEN:
- `grid/test/audit/operator-exported-allowlist.test.ts` — export ALLOWLIST_MEMBERS + append 'operator.exported' at position 27
- `grid/test/audit/operator-exported-payload-privacy.test.ts` — create `grid/src/audit/append-operator-exported.ts`
- `grid/test/audit/operator-exported-producer-boundary.test.ts` — the sole-producer file must be the only match

Wave 4 executors (Plan 13-05) must turn these RED tests GREEN:
- `dashboard/src/app/grid/replay/replay-client.test.tsx` — create `replay-client.tsx`
- `dashboard/src/app/grid/replay/export-consent-dialog.test.tsx` — create `export-consent-dialog.tsx`

## Self-Check: PASSED

All created files verified present. Both commits verified in git log.

| Check | Result |
|-------|--------|
| `grid/test/replay/readonly-chain.test.ts` | FOUND |
| `grid/test/replay/replay-grid.test.ts` | FOUND |
| `grid/test/replay/state-builder.test.ts` | FOUND |
| `grid/test/replay/tarball-determinism.test.ts` | FOUND |
| `grid/test/audit/operator-exported-allowlist.test.ts` | FOUND |
| `grid/test/audit/operator-exported-payload-privacy.test.ts` | FOUND |
| `grid/test/audit/operator-exported-producer-boundary.test.ts` | FOUND |
| `dashboard/src/app/grid/replay/replay-client.test.tsx` | FOUND |
| `dashboard/src/app/grid/replay/export-consent-dialog.test.tsx` | FOUND |
| Commit `912fb9e` | FOUND |
| Commit `a7b2e30` | FOUND |
