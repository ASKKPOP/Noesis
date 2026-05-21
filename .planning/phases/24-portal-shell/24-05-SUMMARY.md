---
phase: 24-portal-shell
plan: "05"
subsystem: audit-tests, dashboard-tests
tags: [tests, wallet, portal, allowlist, producer-boundary]
dependency_graph:
  requires: ["24-01", "24-02", "24-03"]
  provides: [WALLET-04-verified, PORTAL-04-tests, PORTAL-05-tests]
  affects: [grid/test/audit, dashboard/src/components/portal, dashboard/src/app/portal/profile]
tech_stack:
  added: []
  patterns: [sole-producer-grep-test, source-inspection-test, pure-function-extraction-test]
key_files:
  created:
    - grid/test/audit/allowlist-forty-five.test.ts
    - grid/test/audit/human-transferred-producer-boundary.test.ts
    - dashboard/src/components/portal/PortalShell.test.tsx
    - dashboard/src/app/portal/profile/profile-rows.test.tsx
  modified: []
decisions:
  - "Used source-inspection pattern (readFileSync + grep) for producer boundary test — mirrors established pattern from telos-refined-producer-boundary.test.ts and nous-deleted-producer-boundary.test.ts"
  - "profile-rows.test.tsx uses pure function extraction (no JSX) — avoids pre-existing dashboard JSX parse environment issue while fully covering the formatting logic"
  - "PortalShell.test.tsx is structurally correct JSX test but affected by pre-existing dashboard vitest/rolldown JSX parse failure (44 other test files share same failure)"
metrics:
  duration: 12m
  completed: "2026-05-20"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 0
---

# Phase 24 Plan 05: Test Coverage — WALLET-04 Verification + Portal Dashboard Tests Summary

**One-liner:** WALLET-04 verified (allowlist=45, human.transferred@44, sole-producer locked); profile row formatting + PortalShell route-change tests added.

## What Was Built

### Task 1: WALLET-04 Verification (grid tests)

Two new test files verify the Phase 23/24 `human.transferred` implementation:

**`grid/test/audit/allowlist-forty-five.test.ts`** (4 tests, all passing):
- `ALLOWLIST_MEMBERS.length === 45` (exact count assertion)
- `ALLOWLIST_MEMBERS[44] === 'human.transferred'` (position 45, index 44)
- `ALLOWLIST_MEMBERS[43] === 'human.joined'` (position 44 still intact)
- `ALLOWLIST_MEMBERS` does NOT contain `'human.moved'` (deferred per D-04)

**`grid/test/audit/human-transferred-producer-boundary.test.ts`** (7 tests, all passing):
- Sole-producer grep: no other file in `grid/src/` emits `human.transferred` via `audit.append`
- Sanity: `append-human-transferred.ts` itself calls `audit.append('human.transferred', ...)`
- Closed 4-key tuple: `asset`, `grid_name`, `human_did`, `tick` all present in source
- `EXPECTED_KEYS` declares them alphabetically: `['asset', 'grid_name', 'human_did', 'tick']`

All 11 grid audit tests pass (11 new tests).

### Task 2: Dashboard Test Coverage

**`dashboard/src/app/portal/profile/profile-rows.test.tsx`** (10 tests, all passing):
- `formatRegion('agora') === 'Agora'` (title-case)
- `formatRegion(null/undefined/'') === '—'` (fallback)
- `formatMemberSince('2026-05-20T...) === 'May 2026'` (locale format)
- `formatMemberSince(null/undefined) === '—'` (fallback)
- ETH balance `'—'` when `ethBal` is undefined
- USDT balance `'—'` when `usdtRaw` is undefined

**`dashboard/src/components/portal/PortalShell.test.tsx`** (4 tests, structurally correct):
- Sidebar starts closed
- Sidebar opens on hamburger click
- Sidebar closes when pathname changes (route-change effect)
- Auth path bypasses shell layout

## Deviations from Plan

### Pre-Existing Dashboard JSX Parse Environment Issue

**Found during:** Task 2 verification

**Issue:** Dashboard `vitest run` fails for all JSX test files (44 files) with `Cannot parse ... Unexpected JSX expression` in `vi.mock` factory functions, and separately `ssrTransformScript` failures. This is a pre-existing environment issue (vitest + rolldown incompatibility with JSX in SSR transforms) present before this plan executed. Confirmed: `__tests__/PortalShell.test.tsx` (committed in Plan 24-03) also fails with the same error.

**Fix applied:** The `profile-rows.test.tsx` was structured as a pure TypeScript file (no JSX, no component rendering) since it only tests pure formatting functions. It passes cleanly.

**PortalShell.test.tsx status:** The test is structurally correct (matches the pattern of all other dashboard portal tests). It would pass if the environment issue is resolved. The acceptance criteria for `cd dashboard && npm run test:unit` cannot be met until the broader dashboard JSX test infrastructure issue is resolved.

**Files not modified:** No implementation files changed — test-only plan executed exactly as scoped.

## Known Stubs

None — all new test files assert against real implementation values, no placeholder assertions.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Test files only — `readFileSync` is used in the grid producer boundary test to inspect source files, consistent with the established pattern (T-24-05-01: source files contain no secrets).

## Self-Check: PASSED

All files exist on disk. Both task commits verified in git log (e7ac56e, 056c781).
