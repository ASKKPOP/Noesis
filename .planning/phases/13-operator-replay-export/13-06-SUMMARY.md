---
phase: 13-operator-replay-export
plan: 06
subsystem: state-doc-sync, root-workspace-deps
tags: [gap-closure, ci-gates, doc-sync, tar-hoist]
dependency_graph:
  requires: [13-05]
  provides: [passing-pretest, tar-root-resolution, state-doc-sync-27-events]
  affects: [.planning/STATE.md, package.json, package-lock.json, scripts/check-relationship-graph-deps.mjs]
tech_stack:
  added: []
  patterns: [npm-workspace-hoisting, ci-gate-baseline-update]
key_files:
  created: []
  modified:
    - .planning/STATE.md
    - package.json
    - package-lock.json
    - scripts/check-relationship-graph-deps.mjs
decisions:
  - "Hoist tar@^7.5.13 to root workspace as runtime dependency (not devDep) — scripts/replay-verify.mjs is a CLI, not a test-only import"
  - "Update check-relationship-graph-deps.mjs ALLOWLIST_BASELINE_LINES 266→321 — Phase 12 (+4) and Phase 13 (+1) events raised the count but the script was never updated"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-27"
  tasks_completed: 2
  files_modified: 4
---

# Phase 13 Plan 06: Gap Closure (STATE.md + tar) Summary

Closed both hard blockers identified in 13-VERIFICATION.md so Phase 13 can reach a `pass` status.

## What Was Done

### Task 1: Restore STATE.md content reverted by commit f425d99 (Gap 1)

Commit `f425d99` ("update tracking after wave 4") accidentally reverted the STATE.md changes from commit `cb7d136`. This task restored the four affected sections verbatim.

**Changes made:**
1. Allowlist heading: `Phase 12 — post-ship, Plan 12-04` → `Phase 13 — post-Wave-3, Plan 13-04`
2. Event count: `**26 events.**` → `**27 events.**`
3. Entry 27 inserted after entry 26: `operator.exported` (REPLAY-02 / D-13-04)
4. Regression gate line: `26-event invariant` → `27-event invariant`
5. Session Continuity updated to gap-closure executing state (timestamp `2026-04-27T23:30:00.000Z`)
6. Phase 13 Accumulated Context block inserted immediately before Phase 11 heading (line 323 < line 338)

**Gate output:**
```
[state-doc-sync] OK — STATE.md is in sync with the 27-event allowlist.
DOC-SYNC-OK
```

**Diff stats for STATE.md:** 42 lines changed (29 insertions, 13 deletions)

**Commit:** `47c8131` — `fix(13-06): restore STATE.md content reverted by f425d99 (Gap 1)`

### Task 2: Add tar@^7.5.13 to root workspace (Gap 2)

The `tar` package was installed only in `grid/package.json`. `scripts/replay-verify.mjs` at repo root imports `from 'tar'` and was failing with `ERR_MODULE_NOT_FOUND`. The Wave 3 vitest test `test/replay/tarball-determinism.test.ts` failed for the same reason.

**Fix:** `npm install tar@^7.5.13 --save` at repo root — adds `"tar": "^7.5.13"` to root `package.json` `dependencies` (runtime, not devDep), updates `package-lock.json`.

**Resolved tar version:** `7.5.13` (exact match of constraint `^7.5.13`; deduped with grid workspace copy)

**Gate output:**
```
TAR-OK
Usage: node scripts/replay-verify.mjs <path-to-tarball>
```

**Tarball determinism tests:**
```
✓ grid/test/replay/tarball-determinism.test.ts (2 tests) 11ms
Test Files  2 passed (2)
Tests  4 passed (4)
```

**Commit:** `7ee4eca` — `chore(13-06): hoist tar@^7.5.13 to root workspace so scripts/replay-verify and root vitest resolve`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed check-relationship-graph-deps.mjs ALLOWLIST_BASELINE_LINES stale baseline**

- **Found during:** Task 2 verification — `npm run pretest` failed on `check-relationship-graph-deps` gate
- **Issue:** `ALLOWLIST_BASELINE_LINES = 266` (Phase 11 post-ship) but actual file is 321 lines. Phase 12 added 4 governance events (`proposal.opened`, `ballot.committed`, `ballot.revealed`, `proposal.tallied`) and Phase 13 added `operator.exported`. The baseline was never updated across those 5 additions.
- **Fix:** Updated `ALLOWLIST_BASELINE_LINES` from 266 to 321 and updated the comment history to document Phase 12 and Phase 13 additions.
- **Files modified:** `scripts/check-relationship-graph-deps.mjs`
- **Commit:** `7ee4eca` (included in Task 2 commit)

## Full pretest Gate Results

All 7 gates green after both fixes:

```
[state-doc-sync] OK — STATE.md is in sync with the 27-event allowlist.
[check-relationship-graph-deps] OK — no banned graph libs; broadcast-allowlist.ts at baseline line count.
✅ No wall-clock reads in Bios/Chronos/retrieval paths (D-10b-09 OK)
✅ check-whisper-plaintext: clean (0 violations across 3 tiers + keyring-isolation)
✅ check-governance-isolation: clean (0 violations — operator isolation preserved)
✅ check-governance-plaintext: clean (0 body/text/content violations outside allowlist)
✅ check-governance-weight: clean (0 vote-weighting violations — VOTE-06 OK)
```

## Known Stubs

None — this plan made no UI or data-flow changes. No stubs introduced.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. This plan only touched doc-sync state, a workspace dependency declaration, and a CI gate baseline constant.

## Self-Check: PASSED

- `.planning/STATE.md` — modified and committed in `47c8131` ✓
- `package.json` — modified and committed in `7ee4eca` ✓
- `package-lock.json` — modified and committed in `7ee4eca` ✓
- `scripts/check-relationship-graph-deps.mjs` — modified and committed in `7ee4eca` ✓
- `node scripts/check-state-doc-sync.mjs` exits 0 ✓
- `grep -c "27 events" .planning/STATE.md` = 1 ✓
- `grep -c "operator.exported" .planning/STATE.md` = 2 ✓
- `grep -c "Phase 13 — post-Wave-3, Plan 13-04" .planning/STATE.md` = 1 ✓
- `grep -c "Accumulated Context (Phase 13" .planning/STATE.md` = 1 ✓
- Phase 13 block (line 323) < Phase 11 block (line 338) ✓
- `node -e "import('tar')"` succeeds ✓
- `node scripts/replay-verify.mjs` prints usage banner ✓
- `npx vitest run test/replay/tarball-determinism.test.ts` passes 2/2 ✓
- `npm run pretest` exits 0 (all 7 gates green) ✓
- Commit `47c8131` exists ✓
- Commit `7ee4eca` exists ✓
