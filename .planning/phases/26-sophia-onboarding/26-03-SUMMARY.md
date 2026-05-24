---
phase: 26-sophia-onboarding
plan: 03
subsystem: ui
tags: [react, canvas, typescript, nextjs, isometric, animation, cybergrid]

# Dependency graph
requires:
  - phase: 24-portal-shell
    provides: CyberGrid.tsx isometric canvas component used as the base

provides:
  - "CyberGridProps interface with highlightDistrict and hideHud optional props"
  - "Ref-synchronized district highlight animation in drawBuilding() with pulsed shadowBlur"
  - "Gated HUD sections: header, controls, stats bar, legend, corner decorations, scanlines"

affects: [26-04, 26-05, 26-06]  # Onboarding wizard steps that use CyberGrid as background

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ref-sync pattern for animation loop prop access: prop → useEffect → ref.current"
    - "Optional prop gating with !hideHud conditional wrappers on HUD JSX blocks"

key-files:
  created: []
  modified:
    - dashboard/src/components/portal/CyberGrid.tsx

key-decisions:
  - "pulseMult computed as 0.8 + 0.2 * sin(tick * 0.05) so highlighted buildings breathe visually"
  - "topAlpha boosted by +0.25 in addition to shadowBlur boost for stronger visual distinction"
  - "Corner decorations gated as array.map expression rather than wrapping a JSX block, matching surrounding code style"

patterns-established:
  - "Ref-sync for animation props: useRef initialized from prop, useEffect keeps it current, animation loop reads ref"
  - "HUD gating: wrap each section individually with {!hideHud && (...)} rather than a single outer wrapper to preserve render order and independent control"

requirements-completed: [ONBOARD-03]

# Metrics
duration: 12min
completed: 2026-05-22
---

# Phase 26 Plan 03: CyberGrid Props Extension Summary

**CyberGrid extended with ref-synchronized district highlight pulse and optional HUD suppression for onboarding wizard use as a full-screen animated background**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-22T00:00:00Z
- **Completed:** 2026-05-22T00:12:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Added `CyberGridProps` interface with `highlightDistrict?: DistrictId | null` and `hideHud?: boolean`
- `highlightDistrictRef` synced from prop via `useEffect` — animation loop reads ref, no re-render needed
- `drawBuilding()` applies `shadowBlur = 32 * pulseMult` and `topAlpha + 0.25` when building's district matches `highlightDistrictRef.current`
- All 6 HUD sections individually gated on `!hideHud`: scanlines, corner decorations, header, controls, stats bar, legend
- Existing `<CyberGrid />` usage unchanged — both props optional with default `= {}`
- TypeScript compiles clean with no errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Add CyberGridProps interface and prop wiring** - `3d0df60` (feat)

**Plan metadata:** (committed with SUMMARY.md below)

## Files Created/Modified

- `dashboard/src/components/portal/CyberGrid.tsx` - Added CyberGridProps interface, highlightDistrictRef sync, drawBuilding highlight logic, gated HUD sections

## Variable Names Found in Animation Loop

- **Tick counter:** `tick` (incremented at top of `loop()`)
- **District data:** accessed via `WORLD.tileMap[r][c]` inside `drawBuilding(r, c)` — `r` and `c` are the function parameters
- **District colors:** `d.glow` (the `shadowColor`), `d.color` (fill), `d.dark` (darker variant)
- **Night mode:** read via `nightRef.current` (ref pattern, consistent with other refs)

## HUD Sections Found and Gated

1. **Scanlines** — `div` with `repeating-linear-gradient` background, `pointer-events-none absolute inset-0`
2. **Corner decorations** — 4-element array `.map()` producing `div`s with `border-t/b border-l/r` classes
3. **Header** — `div` with `absolute left-8 top-6`, contains NOĒSIS logotype + subtitle + uptime
4. **Controls** — `div` with `absolute right-8 top-6`, contains 4 toggle buttons (Night, Packets, Rain, Rotate)
5. **Stats bar** — `div` with `absolute bottom-6 left-8`, 4-metric flex row
6. **Legend** — `div` with `absolute bottom-6 right-8`, district color dot list

All gated individually with `{!hideHud && (...)}`. Canvas element not gated.

## Decisions Made

- Used `topAlpha + 0.25` boost alongside `shadowBlur` boost for a stronger visual distinction on highlighted district rooftops
- `pulseMult` computed once before the top face block (not inline in the fillStyle call) for readability
- Corner decorations gated as `{!hideHud && [...].map(...)}` — the existing array expression form was kept rather than converting to a `{!hideHud && (<> ... </>)}` wrapper, for minimal diff

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03 complete. `CyberGrid` is ready to accept `highlightDistrict="AI_CORE"` and `hideHud={true}` from the onboarding wizard.
- Plans 04 (DB migration + `/me` extension) and 05 (onboard route + wizard) can proceed in parallel — this plan had no dependencies on them.
- Plan 06 (world tour step 3) directly relies on `highlightDistrict` — that prop is now available.

## Known Stubs

None — the implementation is complete and fully wired. No placeholder values.

## Threat Flags

None — `highlightDistrict` is constrained to the `DistrictId` union type at compile time; canvas drawing code only, no DOM injection surface.

## Self-Check: PASSED

- `dashboard/src/components/portal/CyberGrid.tsx` modified: confirmed
- Commit `3d0df60` exists: confirmed
- TypeScript compiles clean: confirmed (zero output from `npx tsc --noEmit`)

---
*Phase: 26-sophia-onboarding*
*Completed: 2026-05-22*
