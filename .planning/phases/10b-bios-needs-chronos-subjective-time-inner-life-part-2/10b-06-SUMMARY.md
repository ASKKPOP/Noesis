---
phase: 10b
plan: "06"
subsystem: dashboard/bios-panel
tags: [bios, dashboard, inspector, react, drift-sync, snake_case, tdd-green, wave-3]
requires:
  - bios.birth audit event (10b-03 — grid sole-producer)
  - bios.death audit event (10b-03 — grid sole-producer)
  - ananke.drive_crossed firehose events (10a-05 — source of level data)
  - Inspector Overview tab layout (10a-05 — AnankeSection + TelosSection mount points)
provides:
  - BiosSection React component (2-row need panel in Inspector Overview)
  - useBiosLevels hook (derives energy/sustenance levels from ananke.drive_crossed firehose)
  - bios-types.ts (dashboard mirror of grid/src/bios/types.ts — snake_case wire keys)
affects:
  - dashboard/src/app/grid/components/inspector.tsx (+1 import, +1 JSX mount between Ananke and Telos)
tech-stack:
  added: []
  patterns:
    - SYNC-header mirror (two SYNC: mirrors headers — brain bios/config.py + grid bios/types.ts)
    - Firehose-derived hook (clone of use-ananke-levels — useMemo keyed on (entries, did))
    - Drive→need elevator projection (hunger→energy, safety→sustenance — D-10b-02)
    - Bucket-only render surface (no raw floats ever enter dashboard pipeline)
    - 18-case aria matrix: 2 needs × 3 levels × 3 direction states
key-files:
  created:
    - dashboard/src/lib/protocol/bios-types.ts
    - dashboard/src/lib/hooks/use-bios-levels.ts
    - dashboard/src/app/grid/components/inspector-sections/bios.tsx
    - dashboard/src/app/grid/components/inspector-sections/bios.test.tsx
  modified:
    - dashboard/src/app/grid/components/inspector.tsx
decisions:
  - "bios-types.ts exports NEED_ORDER, NEED_GLYPH, NEED_BASELINE_LEVEL, NEED_TO_DRIVE, BiosLevelEntry in addition to wire payload types — required by drift test and forbidden-keys test imports"
  - "aria-label grammar is '{need} {level} [{direction}]' (simpler than Ananke's '{drive} level {level}[, {direction}]') per 10b-UI-SPEC"
  - "bios.test.tsx uses getAttribute('aria-label') assertions (not toBeInTheDocument) to avoid jest-dom dependency mismatch between worktree vitest 2.1.9 and dashboard vitest 4.1.4"
  - "Wave 0 RED stubs turned GREEN: drift test (7/7), forbidden-keys test (9/9), component test (24/24)"
metrics:
  duration: ~45 minutes
  completed: "2026-04-22"
  commits:
    - "87558ba feat(10b-06): dashboard bios-types.ts (snake_case mirror) + use-bios-levels hook"
    - "6a20d9e feat(10b-06): BiosSection component + inspector mount"
---

# Phase 10b Plan 06: Dashboard Bios Panel Summary

Dashboard Bios panel: 2-row inspector section (⚡ energy, ⬡ sustenance) with bucket-only level display, drift-synced snake_case type mirror, and drive→need projection hook sourcing from existing ananke.drive_crossed firehose.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | bios-types.ts + use-bios-levels hook | 87558ba | bios-types.ts, use-bios-levels.ts |
| 2 | BiosSection component + inspector mount | 6a20d9e | bios.tsx, bios.test.tsx, inspector.tsx |
| 3 | Human-verify checkpoint | auto-approved | — |

## In-Scope Verification — ALL GREEN

```
Test Files  3 passed (3)
      Tests  40 passed (40)

  bios.test.tsx               24 pass (18-case aria matrix + shell + privacy)
  bios-types.drift.test.ts     7 pass (snake_case keys, glyph pins, baselines)
  bios-forbidden-keys-dashboard.test.tsx  9 pass (no floats, no forbidden keys in DOM)
```

Additional checks:
- `rg "<BiosSection" dashboard/src/app/grid/components/inspector.tsx` → 1 match
- `rg "psycheHash|finalStateHash" dashboard/src/lib/protocol/bios-types.ts` → 0 matches
- `rg "psyche_hash|final_state_hash" dashboard/src/lib/protocol/bios-types.ts` → 4 matches
- `rg "raw_value|rise_rate" dashboard/src/` → 0 matches

## TDD Gate Compliance

Wave 0 RED stubs (10b-01) → turned GREEN by this plan:
- `test/privacy/bios-forbidden-keys-dashboard.test.tsx` (was failing: BiosSection missing)
- `test/lib/bios-types.drift.test.ts` (was failing: bios-types.ts missing)

GREEN gate: feat commits 87558ba + 6a20d9e implement the types, hook, and component that
make all Wave 0 stubs pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Drift test requires richer exports than plan action described**
- **Found during:** Task 1 verification
- **Issue:** The Wave 0 drift test (`bios-types.drift.test.ts`) imports `NEED_BASELINE_LEVEL`, `NEED_ORDER`, `NEED_GLYPH`, `NEED_TO_DRIVE`, `BiosLevelEntry` from `bios-types.ts`. The plan action template only showed the wire payload types (BiosBirthPayload etc.). The forbidden-keys test also imports `BiosLevelEntry`.
- **Fix:** Added all required exports to `bios-types.ts` to satisfy both test files.
- **Files:** dashboard/src/lib/protocol/bios-types.ts
- **Commit:** 87558ba

**2. [Rule 1 - Bug] Test assertions use getAttribute pattern (not toBeInTheDocument)**
- **Found during:** Task 2 verification
- **Issue:** The worktree's test environment uses root-level `node_modules/vitest@2.1.9` while dashboard tests require `vitest@4.1.4` (installed in `dashboard/node_modules/`). With the older binary, jsx tests fail (`document is not defined`). Additionally, `toBeInTheDocument` (jest-dom) isn't wired through when using the older vitest. The ananke.test.tsx uses `getAttribute('aria-label')` assertions instead of `toBeInTheDocument()` — that pattern works with vitest 4.1.4.
- **Fix:** Wrote bios.test.tsx following ananke.test.tsx assertion patterns (getAttribute, not.toBeNull, not.toBeUndefined) with no jest-dom dependency.
- **Files:** dashboard/src/app/grid/components/inspector-sections/bios.test.tsx
- **Commit:** 6a20d9e

### Checkpoint Auto-Approval

Task 3 (human-verify visual smoke test) was auto-approved per `--auto` mode orchestrator flag. Visual verification of glyph rendering, level updates, and section placement between Ananke and Telos is pending human confirmation during live run.

## Known Stubs

None. BiosSection sources from real firehose data via `useBiosLevels` → `useFirehose()`. No hardcoded values in the render path.

## Threat Flags

None. The three threat mitigations from the plan threat register are all satisfied:
- T-10b-06-01 (raw float leak): no digits rendered (asserted by component test + forbidden-keys test)
- T-10b-06-02 (type drift): snake_case keys enforced by drift test (7/7)
- T-10b-06-03 (aria regression): 18-case aria matrix covered (24 component tests)

## Self-Check

Created files:
- FOUND: dashboard/src/lib/protocol/bios-types.ts
- FOUND: dashboard/src/lib/hooks/use-bios-levels.ts
- FOUND: dashboard/src/app/grid/components/inspector-sections/bios.tsx
- FOUND: dashboard/src/app/grid/components/inspector-sections/bios.test.tsx

Commits:
- FOUND: 87558ba (bios-types.ts + use-bios-levels hook)
- FOUND: 6a20d9e (BiosSection component + inspector mount)

## Self-Check: PASSED
