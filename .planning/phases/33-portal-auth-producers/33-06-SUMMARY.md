---
phase: 33
plan: 06
subsystem: ci-gates
tags: [ci, gates, sole-producer-discipline, state-doc-sync, d-33-d1, d-33-d3, obs-09]
dependency_graph:
  requires: [33-02, 33-03]
  provides: [ci-gate-sole-producer-discipline, ci-gate-allowlist-count]
  affects: [.github/workflows/rig-invariants.yml, scripts/check-sole-producer-discipline.mjs, scripts/check-state-doc-sync.mjs]
tech_stack:
  added: []
  patterns: [walkDir-generator, scanFile-content-check, ENOENT-tolerant-directory-scan, regex-array-extraction]
key_files:
  created:
    - scripts/check-sole-producer-discipline.mjs
  modified:
    - scripts/check-state-doc-sync.mjs
    - .github/workflows/rig-invariants.yml
    - grid/src/governance/appendBallotCommitted.ts
    - grid/src/governance/appendBallotRevealed.ts
    - grid/src/governance/appendLawTriggered.ts
    - grid/src/governance/appendProposalOpened.ts
    - grid/src/governance/appendProposalTallied.ts
decisions:
  - checkAllowlistCount uses regex array-body extraction to count ALLOWLIST_MEMBERS precisely
  - "27 events" literal check updated to "53 events" (pre-existing STATE.md drift: gate was always failing before Plan 33-06)
  - governance files fixed in-scope per D-33-D2 (Phase 33 opportunistic cleanup)
metrics:
  duration: ~30 minutes
  completed: 2026-05-25T05:04:22Z
  tasks: 3/3
  files_modified: 8
---

# Phase 33 Plan 06: CI Gates Summary

**One-liner:** Phase 33 OBS-09 sole-producer triad gate + D-33-D3 allowlist count gate wired into CI, covering 38 files across 10 subsystems with ENOENT tolerance.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create check-sole-producer-discipline.mjs + governance triad fix | 4e58b25 | scripts/check-sole-producer-discipline.mjs, 5 governance files |
| 2 | Extend check-state-doc-sync.mjs (D-33-D3) | 058c3fb | scripts/check-state-doc-sync.mjs |
| 3 | Wire OBS-09 step into rig-invariants.yml | aa60607 | .github/workflows/rig-invariants.yml |

## What Was Built

### Task 1 — `scripts/check-sole-producer-discipline.mjs` (NEW, 125 lines)

Phase 33 OBS-09 (D-33-D1) CI gate. Scans 10 subsystem directories for all `append*.ts` files (case-sensitive basename prefix filter) and asserts each file contains all three triad elements:
1. `Object.keys(payload).sort()` — closed-tuple structural check
2. `payloadPrivacyCheck` — privacy gate
3. `audit.append(` — chain commit

Covers 38 files total (16 in `grid/src/audit/` including 3 new Phase 33 files + 22 across ananke/bios/sleep/iris/skills/norms/lore/governance/whisper). ENOENT-tolerant (missing directories are not violations). Exits 0 when all files pass, exits 1 with per-file violation report (`file  missing-check` format).

### Task 2 — `scripts/check-state-doc-sync.mjs` (extended, 207 → 253 lines)

Two surgical additions:

**Edit 1 — `required` array gains 3 entries:**
```javascript
  // Phase 33 additions (D-33-A1 / OBS-08, OBS-09, OBS-08b):
  'portal.auth.login',
  'portal.auth.register',
  'human.identified',
```

**Edit 2 — New `checkAllowlistCount()` function:**
- Reads `grid/src/audit/broadcast-allowlist.ts` directly
- Regex-extracts the `ALLOWLIST_MEMBERS` array body using `/export const ALLOWLIST_MEMBERS:[^=]*=\s*\[([\s\S]*?)\] as const;/`
- Counts entries matching `/^\s+'[a-z][a-z0-9_.]+'/gm` — asserts `=== 56`
- Checks literal presence of all 3 Phase 33 event names
- Invoked alongside existing prefix-ban functions

### Task 3 — `.github/workflows/rig-invariants.yml` (1 step added)

New step `OBS-09 sole-producer-discipline gate (Phase 33)` inserted at position 5:
1. T-10-12 + T-10-13 grep gates (existing)
2. OBS-03 no-silent-catch gate (Phase 31) (existing)
3. OBS-R-32-01 observability-no-TODO gate (Phase 32) (existing)
4. OBS-R-32-02 setInterval-lifecycle gate (Phase 32) (existing)
5. **OBS-09 sole-producer-discipline gate (Phase 33)** — NEW
6. Fast Vitest rig suite (existing)

## Day-1 Verification

All gates exit 0 against the current codebase:

```
[check-sole-producer-discipline] OK — 38 sole-producer files all contain the full triad
[state-doc-sync] OK — STATE.md is in sync (v2.5: 53 events + Phase 33: 56 members)
[check-no-silent-catch] OK
[check-observability-no-todo] OK
[check-interval-lifecycle] OK
```

## RED-Path Manual Test (Task 1 Acceptance Criterion)

Temporarily renamed `payloadPrivacyCheck` to `payloadPrivacyXheck` in `grid/src/audit/append-human-joined.ts`, then ran the gate:

```
[check-sole-producer-discipline] VIOLATIONS FOUND:
  file  missing-check
  grid/src/audit/append-human-joined.ts  payloadPrivacyCheck

Phase 33 D-33-D1 requires every sole-producer file to contain:
  1. Object.keys(payload).sort()  — closed-tuple structural check
  2. payloadPrivacyCheck          — privacy gate
  3. audit.append(                — chain commit
```

Exit code was 1. Immediately reverted the edit and confirmed gate returns to exit 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added `payloadPrivacyCheck` to 5 governance sole-producers**

- **Found during:** Task 1 (initial gate run returned exit 1 for 5 governance files)
- **Issue:** `grid/src/governance/appendBallotCommitted.ts`, `appendBallotRevealed.ts`, `appendLawTriggered.ts`, `appendProposalOpened.ts`, `appendProposalTallied.ts` — all Phase 12 files — used a domain-specific `GOVERNANCE_FORBIDDEN_KEYS` loop check but lacked `payloadPrivacyCheck` (the belt-and-suspenders triad element). Per D-33-D2: "Pre-Phase-33 sole-producer files that don't conform to the triad get fixed under Phase 33 surgical cleanup-opportunistic scope."
- **Fix:** Added `import { payloadPrivacyCheck } from '../audit/broadcast-allowlist.js'` to each file, inserted `payloadPrivacyCheck(payload)` call as an additional step after the existing forbidden-key check and before the DB write / `audit.append` call. The existing `GOVERNANCE_FORBIDDEN_KEYS` loop was NOT removed (belt-and-suspenders layering).
- **Files modified:** 5 governance files (all in `grid/src/governance/`)
- **Commit:** 4e58b25 (bundled with Task 1)

**2. [Rule 1 - Bug] Updated dead "27 events" literal check to "53 events" in check-state-doc-sync.mjs**

- **Found during:** Task 2 (script exited 1 even before my changes; confirmed via `git stash` that this was pre-existing)
- **Issue:** The original `check-state-doc-sync.mjs` asserted `STATE.md` contains the text "27 events". STATE.md was restructured in Phase 33 Plan 33-01 to enumerate all 53 v2.5 events as a numbered list (item "27. `operator.exported`") rather than stating the count as "27 events". The "27 events" literal was absent from STATE.md in every commit in the repo. The gate was always-failing before Plan 33-06.
- **Fix:** Updated the assertion to match `53\s+events` (STATE.md line: `**53 events.**`). Updated the success message to reflect the current context.
- **Plan note:** The plan stated "Old `27 events` literal check preserved". This was based on the assumption that STATE.md would still contain that text; it did not. The deviation preserves the intent (count assertion) while fixing the broken matching.
- **Files modified:** `scripts/check-state-doc-sync.mjs`
- **Commit:** 058c3fb

## Known Stubs

None — all scripts are fully wired with no placeholder data.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Gate scripts are read-only file scanners with no network access.

## Self-Check: PASSED

- FOUND: scripts/check-sole-producer-discipline.mjs
- FOUND: .github/workflows/rig-invariants.yml
- FOUND: commit 4e58b25
- FOUND: commit 058c3fb
- FOUND: commit aa60607
- Gate scripts all exit 0: confirmed
