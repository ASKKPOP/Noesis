---
phase: 32
plan: 05
subsystem: ci-gates
tags: [ci, gates, observability, r-32-01, r-32-02, OBS-05, OBS-06, OBS-07]
dependency_graph:
  requires: []
  provides: [R-32-01-gate, R-32-02-gate, rig-invariants-wired]
  affects: [.github/workflows/rig-invariants.yml]
tech_stack:
  added: []
  patterns: [ENOENT-tolerant-walkDir, regex-gate-script, CI-gate-step]
key_files:
  created:
    - scripts/check-observability-no-todo.mjs
    - scripts/check-interval-lifecycle.mjs
  modified:
    - .github/workflows/rig-invariants.yml
decisions:
  - "comment-skip intentionally omitted from R-32-01 — TODO/FIXME/XXX live in comments by design"
  - "3-line preceding-context window chosen for multi-line setInterval assignment detection"
  - "SCAN_DIRS mirrors check-no-silent-catch.mjs: diagnostics + audit + db"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-25"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 1
---

# Phase 32 Plan 05: CI Gate Scripts (R-32-01 + R-32-02) Summary

Two CI gate scripts shipped and wired into rig-invariants.yml: R-32-01 blocks TODO/FIXME/XXX near observability keywords, R-32-02 blocks unbound setInterval — both ENOENT-tolerant, day-1 clean, forward-locking.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 32-05-01 | R-32-01 observability-no-TODO gate | 9241834 | scripts/check-observability-no-todo.mjs (created) |
| 32-05-02 | R-32-02 setInterval-lifecycle gate | 5638cfd | scripts/check-interval-lifecycle.mjs (created) |
| 32-05-03 | Wire both gates into rig-invariants.yml | 94549d1 | .github/workflows/rig-invariants.yml (modified) |

## What Was Built

### R-32-01: check-observability-no-todo.mjs

Blocks any PR that ships a `TODO|FIXME|XXX` comment within 50 characters of an observability keyword (`health|metric|frame|drift|reconcile`) in `grid/src/{diagnostics,audit,db}/`. This is the exact pattern that produced GAP-A — deferred observability work shipped silently.

Key design decisions:
- **No comment-skip**: Unlike `check-no-silent-catch.mjs`, this gate intentionally scans comment lines because `TODO/FIXME/XXX` live in comments.
- **Regex**: `/(TODO|FIXME|XXX).{0,50}(health|metric|frame|drift|reconcile)/i` — the `i` flag handles mixed case; the `.{0,50}` captures "within 50 chars" proximity.
- **ENOENT-tolerant**: `grid/src/diagnostics/` does not exist until Plan 03 lands; `err.code === 'ENOENT'` swallows missing dirs silently.

### R-32-02: check-interval-lifecycle.mjs

Blocks any `setInterval(...)` in the same three directories that is NOT stored in a class field. Pitfall 8: unbound interval handle GC'd silently, watchdog dies.

Key design decisions:
- **Two-pass per line**: detect `setInterval(`, then check inline-store OR preceding 3-line field-assign window.
- **`INLINE_STORE_RE`**: `this.\w+\s*=\s*setInterval\s*\(` — canonical form on one line.
- **`FIELD_ASSIGN_RE`**: `this.\w+\s*=\s*$` — multi-line assignment (RHS continues on next line).
- **3-line lookahead**: covers typical multi-line patterns without being overly permissive.
- **Comment lines skipped**: gate targets executable code only (unlike R-32-01).

### rig-invariants.yml

Two new steps inserted after OBS-03 (Phase 31) and before Fast Vitest suite:

```
T-10-12 + T-10-13 grep gates
OBS-03 no-silent-catch gate (Phase 31)
OBS-R-32-01 observability-no-TODO gate (Phase 32)   ← new
OBS-R-32-02 setInterval-lifecycle gate (Phase 32)    ← new
Fast Vitest rig suite
```

Surgical addition only — all existing steps preserved, `node-version`, `runs-on`, `timeout-minutes` unchanged.

## Manual RED/GREEN Path Verification

### R-32-01 (check-observability-no-todo.mjs)

**RED path**: Appended `// TODO investigate firehose drift` to `grid/src/audit/append-human-joined.ts` (line 115).
- `node scripts/check-observability-no-todo.mjs` → exit 1
- Output: `grid/src/audit/append-human-joined.ts:115:observability-no-TODO:// TODO investigate firehose drift`
- Reverted via `sed -i '' "${LINE_COUNT}d"` — file restored to original.
- Post-revert run → exit 0 confirmed.

### R-32-02 (check-interval-lifecycle.mjs)

**RED path**: Appended `setInterval(() => {}, 1000);` to `grid/src/audit/append-human-joined.ts`.
- `node scripts/check-interval-lifecycle.mjs` → exit 1
- Output: `grid/src/audit/append-human-joined.ts:116:interval-must-be-stored:setInterval(() => {}, 1000);`
- Reverted.

**GREEN allow-path**: Appended `this._heartbeat = setInterval(() => {}, 1000);`.
- `node scripts/check-interval-lifecycle.mjs` → exit 0 (inline-store pattern allowed).
- Reverted.

Final clean state: both scripts exit 0.

## Day-1 Baseline

Both scripts pass today with zero violations — no `setInterval` calls exist in any scanned dir (research-verified), and no observability TODOs exist. The gates are forward-locking: they enforce discipline for Plans 03-06 that ship the actual HealthWatchdog code.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, file write paths, or trust boundary changes introduced. Both scripts are read-only (`readFileSync`), no network I/O, bounded by `timeout-minutes: 5` on the existing workflow job. T-32-CI-01 (DoS via gate hang) mitigated by sync fs ops + `EXCLUDE_DIR_NAMES` blocking `node_modules`.

## Self-Check: PASSED

- `scripts/check-observability-no-todo.mjs` exists: FOUND
- `scripts/check-interval-lifecycle.mjs` exists: FOUND
- `.github/workflows/rig-invariants.yml` contains both new steps: FOUND
- Commit 9241834 exists: FOUND
- Commit 5638cfd exists: FOUND
- Commit 94549d1 exists: FOUND
