---
phase: 10a-ananke-drives-inner-life-part-1
plan: 05
subsystem: dashboard-ananke-panel
tags: [ananke, drives, inspector, render-surface, drive-05, privacy, aria, sync-mirror]
dependency_graph:
  requires:
    - 10a-01 (Brain AnankeRuntime + DRIVE_BASELINES config)
    - 10a-02 (Grid sole-producer emitter + allowlist)
    - 10a-03 (Brain handler drive_crossed lift)
    - 10a-04 (Grid dispatcher + wire path)
  provides:
    - "Dashboard Drives panel — 5-row AnankeSection in Inspector Overview"
    - "DRIVE_BASELINE_LEVEL SYNC mirror (Brain Python ↔ Grid TS ↔ Dashboard TS)"
    - "Drift-detector test contract binding dashboard to brain/ananke/config.py"
    - "Render-surface privacy gate (no numeric drive value in DOM)"
    - "45-state aria-label accessibility matrix (WCAG color-not-sole-channel)"
  affects:
    - "dashboard/src/app/grid/components/inspector.tsx (+ 1 import, + 1 JSX mount)"
    - "dashboard/vitest.config.ts (extended include to test/**)"
    - "Inspector Overview tabpanel section order: Psyche → Thymos → Ananke → Telos → Memory"
tech_stack:
  added: []
  patterns:
    - "SYNC-header mirror (clone of agency-types.ts pattern)"
    - "Firehose-derived hook (clone of use-refined-telos-history)"
    - "useMemo-based derived Map selector keyed on (entries, did)"
    - "Module-level vi.mock for hook isolation (clone of Phase 7/9 test harness pattern)"
    - "Hysteresis-aware bucket mirror: bucketFromLow(v) → low|med|high"
    - "Unicode escape syntax (\\u2298 etc.) over literal glyphs in source"
key_files:
  created:
    - dashboard/src/lib/protocol/ananke-types.ts
    - dashboard/src/lib/hooks/use-ananke-levels.ts
    - dashboard/src/lib/hooks/use-ananke-levels.test.ts
    - dashboard/src/app/grid/components/inspector-sections/ananke.tsx
    - dashboard/src/app/grid/components/inspector-sections/ananke.test.tsx
    - dashboard/test/lib/ananke-types.drift.test.ts
    - dashboard/test/privacy/drive-forbidden-keys-dashboard.test.tsx
  modified:
    - dashboard/src/app/grid/components/inspector.tsx
    - dashboard/src/app/grid/components/inspector.test.tsx
    - dashboard/test/integration/delete-flow.test.tsx
    - dashboard/vitest.config.ts
decisions:
  - "Unicode escape syntax (\\u2298, \\u2726, \\u25C6, \\u25EF, \\u274D) over literal glyphs to avoid editor-encoding drift"
  - "Floats documented in JSDoc comment block (not executable) — drift test strips block comments before asserting no 0.x literal in code"
  - "Drift test anchors regex on DRIVE_BASELINES\\s*:\\s*dict[...] block — avoids false match on DRIVE_RISE_RATES that follows"
  - "Plan-level TDD: RED (tests only) → GREEN (impl + tests) → section-order refinement as separate test commit"
  - "Mocked useAnankeLevels at module level in inspector.test.tsx + delete-flow.test.tsx — mirrors Phase 7 (use-refined-telos-history) + Phase 9 (use-relationships) harness pattern; no StoresProvider needed in test harness"
  - "Privacy test file uses .tsx extension (not .ts) because it imports + renders JSX — plan's original .ts suffix was adjusted"
metrics:
  duration_min: 95
  completed_date: 2026-04-22
  tasks_completed: 2
  files_created: 7
  files_modified: 4
  tests_added: 82
requirements:
  - DRIVE-05 (render-surface enforcement — no numeric drive value in DOM, 45-state aria matrix, color-not-sole-channel)
---

# Phase 10a Plan 05: Dashboard Drives Panel Summary

Inspector Overview tab now renders a 5-row Drives panel (AnankeSection) between Thymos and Telos. Each row encodes pressure level via a colored dot AND the level enum text (color-not-sole-channel), with optional rising/falling arrow, driven entirely off the existing firehose audit stream — no new RPC, no additions to NousStateResponse, no wall-clock, no timers, no animation.

## What shipped

1. **`dashboard/src/lib/protocol/ananke-types.ts`** — SYNC-header mirror file exporting `DRIVE_ORDER`, `DRIVE_LEVELS`, `DRIVE_DIRECTIONS`, `DRIVE_BASELINE_LEVEL`, `AnankeLevelEntry`, and `AnankeDriveCrossedPayload`. Three `SYNC: mirrors` pointer comments bind it to Brain `types.py`, Brain `config.py`, and Grid `ananke/types.ts`. No drive-baseline floats appear in executable code — they live only in the documentation block (where a future refactor regressing to expose floats would be caught by the privacy grep + drift detector).

2. **`dashboard/src/lib/hooks/use-ananke-levels.ts`** — Derived selector over `useFirehose()`. Filters audit entries by `(actorDid === did) && (eventType === 'ananke.drive_crossed')` with a shape-guard on payload, walks chronologically to let the latest crossing per drive win, and falls back to `DRIVE_BASELINE_LEVEL` + `direction: null` when the buffer is empty or `did` is `null`. Memoized on `(snap.entries, did)`. 0 timers, 0 wall-clock reads.

3. **`dashboard/src/app/grid/components/inspector-sections/ananke.tsx`** — The AnankeSection component:
   - `<section data-testid="section-ananke">` + `<h3>Drives</h3>` + `<ul role="list" aria-label="Current drive pressure levels">`.
   - 5 `<li>` rows in locked order (hunger, curiosity, safety, boredom, loneliness).
   - Per-row: colored dot (`bg-neutral-400|amber-400|rose-400`), Unicode glyph (⊘ ✦ ◆ ◯ ❍), drive name, level text (with `aria-label: {drive} level {level}` or `{drive} level {level}, {direction}`), optional direction arrow (↑↓).
   - `data-drive`, `data-level`, `data-direction` attributes on each row (`data-direction="stable"` when null).
   - Dot, glyph, and arrow spans all `aria-hidden="true"` — level text carries the semantic aria-label.

4. **`dashboard/src/app/grid/components/inspector.tsx`** — Edited to import `AnankeSection` and mount `<AnankeSection did={selectedDid} />` between `<ThymosSection>` and `<TelosSection>` in the Overview tabpanel JSX. Single import + single JSX line added; no other changes.

5. **Test coverage (82 new test cases across 4 files):**
   - `use-ananke-levels.test.ts` — 8 tests: null-DID baseline, empty-store baseline, single crossing applied, newer overrides older, foreign-DID ignored, non-ananke event-type ignored, falling direction, null-DID with entries in store.
   - `ananke.test.tsx` — 65 tests: shell/baseline (7), **45-state aria matrix** (5 drives × 3 levels × 3 directions), Unicode glyph-per-drive (5), data-attr (4), transition baseline→crossing (1), privacy contract (3).
   - `ananke-types.drift.test.ts` — 3 tests: parses DRIVE_BASELINES block from `brain/src/noesis_brain/ananke/config.py` via anchored regex, bucketizes each float with `bucketFromLow(v)`, asserts match; asserts ≥2 SYNC header pointers; asserts no 0.x float in executable code after stripping both line and block comments.
   - `drive-forbidden-keys-dashboard.test.tsx` — 5 tests: NousStateResponse shape has no drive property, rendered DOM has no numeric float, no `title=` / `data-value=` / `data-drive-raw=`, no wall-clock/timer in component+hook sources, repo-wide grep over `dashboard/src/lib/api`.
   - `inspector.test.tsx` — section-order regression asserting Psyche → Thymos → Ananke → Telos → Memory in document order.

## Commits

| Task | Type | Hash | Subject |
|------|------|------|---------|
| Task 1 RED | test | 688670a | add failing tests for ananke SYNC mirror + useAnankeLevels |
| Task 1 GREEN | feat | 4494eb9 | SYNC mirror + useAnankeLevels hook — 11/11 tests green |
| Task 2 RED | test | bbbfb27 | add failing tests for AnankeSection + dashboard privacy grep |
| Task 2 GREEN | feat | e7e32d1 | AnankeSection 5-row Drives panel + Inspector mount |
| Section order | test | 1714f8e | add Inspector section-order regression — Ananke between Thymos and Telos |

## Verification results

| Gate | Result |
|------|--------|
| `npx vitest run src/lib/hooks/use-ananke-levels.test.ts` | 8/8 pass |
| `npx vitest run src/app/grid/components/inspector-sections/ananke.test.tsx` | 65/65 pass |
| `npx vitest run test/lib/ananke-types.drift.test.ts` | 3/3 pass |
| `npx vitest run test/privacy/drive-forbidden-keys-dashboard.test.tsx` | 5/5 pass |
| Full dashboard suite (`npx vitest run`) | 517/517 pass, 53 test files |
| `npx tsc --noEmit` | clean |
| `grep -c "AnankeSection" dashboard/src/app/grid/components/inspector.tsx` | 2 (import + JSX, as specified) |
| `grep -n "SYNC: mirrors" dashboard/src/lib/protocol/ananke-types.ts` | 3 matches (≥2 required — Brain types.py + Brain config.py + Grid types.ts) |
| Wall-clock grep (ananke.tsx + use-ananke-levels.ts) | 0 matches |
| Section order in DOM (Psyche → Thymos → Ananke → Telos → Memory) | asserted by inspector.test.tsx |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Vitest include pattern did not cover `test/` directory**
- **Found during:** Task 1 RED (attempting to run drift detector test)
- **Issue:** Plan specified `dashboard/test/lib/ananke-types.drift.test.ts` and `dashboard/test/privacy/drive-forbidden-keys-dashboard.test.ts`, but `dashboard/vitest.config.ts` `include` was `src/**/*.{test,spec}.{ts,tsx}` — Vitest silently skipped the new test files.
- **Fix:** Extended include to `['src/**/*.{test,spec}.{ts,tsx}', 'test/**/*.{test,spec}.{ts,tsx}']`.
- **Files modified:** `dashboard/vitest.config.ts`.

**2. [Rule 3 — Blocking] Privacy test file extension**
- **Found during:** Task 2 RED.
- **Issue:** Plan specified `drive-forbidden-keys-dashboard.test.ts`, but the file imports and renders JSX (`render(<AnankeSection ... />)`), which requires the `.tsx` extension for the TS compiler.
- **Fix:** Renamed to `.test.tsx`. Spec-level intent unchanged — the file path and content-shape contract still hold.

**3. [Rule 3 — Blocking] inspector.test.tsx + delete-flow.test.tsx broke after AnankeSection mount**
- **Found during:** Task 2 GREEN (running full suite after mounting AnankeSection in inspector.tsx).
- **Issue:** AnankeSection calls `useAnankeLevels` → `useFirehose` → `useStores`, which requires a `StoresProvider` ancestor. The Inspector test harness (and delete-flow integration test) renders `<Inspector />` without a StoresProvider — identical problem Phase 9 hit with `useRelationshipsH1` → `useTick` → `useStores`.
- **Fix:** Added module-level `vi.mock('@/lib/hooks/use-ananke-levels', ...)` returning a baseline Map to both test files. This is the exact clone of the Phase 7 `use-refined-telos-history` mock and Phase 9 `use-relationships` + `tick-store` mocks already in `inspector.test.tsx`.
- **Files modified:** `dashboard/src/app/grid/components/inspector.test.tsx`, `dashboard/test/integration/delete-flow.test.tsx`.

**4. [Rule 1 — Bug] delete-flow.test.tsx had 3 pre-existing Phase-9 test harness failures**
- **Found during:** Task 2 GREEN (full-suite regression check after adding use-ananke-levels mock).
- **Issue:** After adding the use-ananke-levels mock, `delete-flow.test.tsx` still threw `useStores must be called inside a <StoresProvider>` — traced to `RelationshipsSection → useRelationshipsH1 → useTick → useStores`. Stash verification confirmed these 3 failures existed on base `bbbfb27` (pre-my-changes) — they were a pre-existing Phase 9 regression.
- **Fix:** Mirrored the Phase 9 `use-relationships` + `tick-store` mocks from `inspector.test.tsx` into `delete-flow.test.tsx`. Since mounting AnankeSection surfaced the full suite's health, closing this pre-existing gap here (rather than deferring) got the suite to 517/517 green.
- **Files modified:** `dashboard/test/integration/delete-flow.test.tsx`.

**5. [Rule 2 — Missing critical functionality] Inspector section-order regression test**
- **Found during:** Task 2 verification review.
- **Issue:** Plan verification gate explicitly required "Section order in DOM: Psyche → Thymos → Ananke → Telos → Memory (asserted by extended inspector.test.tsx)" but no such test existed.
- **Fix:** Added a dedicated section-order test in `inspector.test.tsx` that locates each section testid and asserts ascending document-order position. Committed as a separate `test(10a-05):` commit (`1714f8e`).

### Auth gates

None. Fully autonomous plan.

## Threat Flags

None. All threat-model surfaces (T-10a-21..26) are covered by the tests added in this plan. No new surface introduced beyond what the plan's `<threat_model>` already enumerates.

## Known Stubs

None. AnankeSection is fully wired to the real firehose store in production; the component only receives mocked hook values in tests (explicit test-harness isolation, not a runtime stub).

## Self-Check

- [x] `dashboard/src/lib/protocol/ananke-types.ts` exists
- [x] `dashboard/src/lib/hooks/use-ananke-levels.ts` exists
- [x] `dashboard/src/lib/hooks/use-ananke-levels.test.ts` exists
- [x] `dashboard/src/app/grid/components/inspector-sections/ananke.tsx` exists
- [x] `dashboard/src/app/grid/components/inspector-sections/ananke.test.tsx` exists
- [x] `dashboard/test/lib/ananke-types.drift.test.ts` exists
- [x] `dashboard/test/privacy/drive-forbidden-keys-dashboard.test.tsx` exists
- [x] `dashboard/src/app/grid/components/inspector.tsx` modified with AnankeSection mount
- [x] `dashboard/vitest.config.ts` include extended to `test/**`
- [x] Commit 688670a found in git log (Task 1 RED)
- [x] Commit 4494eb9 found in git log (Task 1 GREEN)
- [x] Commit bbbfb27 found in git log (Task 2 RED)
- [x] Commit e7e32d1 found in git log (Task 2 GREEN)
- [x] Commit 1714f8e found in git log (section-order refinement)

## Self-Check: PASSED
