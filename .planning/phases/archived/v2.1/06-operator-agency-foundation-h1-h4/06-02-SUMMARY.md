---
phase: 06-operator-agency-foundation-h1-h4
plan: 02
subsystem: dashboard-agency-ui
tags: [react-19, next-15, use-sync-external-store, localStorage, ssr, tier-chip, philosophy-verbatim, rfc4122]

# Dependency graph
requires:
  - phase: 06-operator-agency-foundation-h1-h4
    plan: 01
    provides: "HumanAgencyTier + TIER_NAME + OPERATOR_ID_REGEX in grid/src/api/types.ts (authoritative source for the dashboard SYNC mirror)"
  - phase: archived/v2.0/03-nous-inspector-economy-docker-polish
    provides: "Chip primitive (dashboard/src/components/primitives/chip.tsx) + selection-store subscribe/getSnapshot pattern"
provides:
  - "AgencyIndicator persistent pill mounted in dashboard root layout — visible on every route (closes SC#1 at unit level)"
  - "agencyStore singleton (subscribe/getSnapshot/setTier/hydrateFromStorage) — consumed by Plan 03's useElevatedAction"
  - "getOperatorId() — stable op:<uuid-v4> matching OPERATOR_ID_REGEX, persisted via localStorage, consumed by every tiered request body in Plans 04/05"
  - "TierTooltip H1–H5 definitions panel — PHILOSOPHY §7 verbatim copy with drift detector test"
  - "dashboard-side HumanAgencyTier + TIER_NAME + OPERATOR_ID_REGEX mirror (SYNC header points to grid/src/api/types.ts)"
  - "AgencyHydrator SSR-pure bridge component (useEffect-gated localStorage read)"
  - "Extended Chip primitive with optional color prop (neutral|blue|amber|red|muted) — zero-diff for pre-Phase-6 callers"
affects: [06-03-elevation-dialog, 06-04-clock-governance-endpoints, 06-05-memory-telos-endpoints, 06-06-sc-e2e-gates]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useSyncExternalStore with arrow-field subscribe/getSnapshot (tearing-safe same-value no-op) + SSR snapshot literally locked to 'H1' per D-01"
    - "SSR-safe localStorage: all window access wrapped in `typeof window === 'undefined'` guards; writes in try/catch to survive quota errors"
    - "Two-source type mirror with SYNC header — dashboard/src/lib/protocol/agency-types.ts byte-identical to grid/src/api/types.ts (enforced by a fs.readFileSync drift-detector test + inter-package diff gate)"
    - "PHILOSOPHY §7 verbatim-copy drift detector: inline test strings (not imported from TIER_DEFINITIONS) fail on any paraphrase of the 5 tier definitions"
    - "Hydration whitelist excludes 'H5' — D-20 discipline preserved (H5 is never a runtime-reachable tier)"
    - "Client-boundary wrapper pattern: layout.tsx stays Server Component; AgencyIndicator + AgencyHydrator are the 'use client' islands"
    - "jsdom localStorage polyfill (Map-backed Storage installed via Object.defineProperty) — Vitest 4.1 ships empty window.localStorage"

key-files:
  created:
    - dashboard/src/lib/protocol/agency-types.ts
    - dashboard/src/lib/stores/agency-store.ts
    - dashboard/src/lib/stores/agency-store.test.ts
    - dashboard/src/components/agency/agency-indicator.tsx
    - dashboard/src/components/agency/agency-indicator.test.tsx
    - dashboard/src/components/agency/tier-tooltip.tsx
    - dashboard/src/components/agency/tier-tooltip.test.tsx
    - dashboard/src/components/agency/agency-hydrator.tsx
    - dashboard/src/app/layout.test.tsx
  modified:
    - dashboard/src/components/primitives/chip.tsx
    - dashboard/src/app/layout.tsx

key-decisions:
  - "Rendered role=status as a nested span inside the trigger button (D-A below) — aria-label duplicated on both outer button and inner status span so both `getByRole('status')` and `getByRole('button')` queries hit the same label string"
  - "STATE_SUFFIX map encodes tier-state semantically in the aria-label ('Read-only.' / 'Elevation active.' / 'Disabled — requires Phase 8.') — screen-reader users get the tier state without depending on the visual border color"
  - "Tooltip toggled on click and on hover (mouseenter/mouseleave) and on focus/blur; Escape closes. Tests cover click toggle; hover/focus behavior verified in component not tests (standard RTL convention — synthetic hover is unreliable)"
  - "jest-dom matchers do not register under Vitest 4.1 + oxc transform despite setup.ts import (project-wide — no existing dashboard test uses toHaveTextContent/toBeInTheDocument). Used plain Chai + native DOM: element.textContent, getAttribute, className.toContain, queryByTestId null-checks"
  - "localStorage polyfill installed inline per test file (not in global setup.ts) because the store module imports window.localStorage at use-time and needs the polyfill in place before beforeEach clears it"
  - "AgencyHydrator returns `null` (not `React.Fragment`) so the layout DOM is clean — the effect is the whole purpose"
  - "Suppressed jsdom's <html>-inside-<div> warning in layout.test.tsx via console.error filter (the layout legitimately returns html+body; RTL wraps it in a div). No test assertions depend on the warning text"

patterns-established:
  - "Pattern: every 'use client' store consumer uses useSyncExternalStore with the store's arrow-field methods (no .bind(this) needed) — proven by agency-store + selection-store matching shapes"
  - "Pattern: SSR snapshot always literal (() => 'H1' as HumanAgencyTier) — never reads from the store (which may have been mutated by previous tests/instances)"
  - "Pattern: hydration bridge component ('use client' + useEffect + null return) — reusable for any future localStorage-backed store. Mount adjacent to, not inside, the consumer component"
  - "Pattern: dashboard package mirrors grid protocol types with byte-identical content + SYNC header + drift-detector test. If mirror grows, consider consolidating into a shared package — but not before 3 mirrors exist (audit-types, agency-types, next)"

# Metrics
metrics:
  duration: "~52 minutes wall time (Tasks 1–3 + sync fix + summary)"
  completed-date: "2026-04-21"
  tests-added: 48
  tests-passing: "274/274 across 35 files (full dashboard suite)"
  commits: 4
  files-created: 9
  files-modified: 2
  lines-added: 1066
---

# Phase 6 Plan 02: Operator Agency Foundation (H1–H4) — AgencyIndicator + store + tooltip Summary

**One-liner:** Shipped the dashboard-side foundation for the Human Agency Scale — persistent H1–H4 tier chip in the root-layout overlay (every route, SC#1), backed by a localStorage-persisted `agencyStore` with tearing-safe `useSyncExternalStore` subscription, plus a PHILOSOPHY §7 verbatim-copy tooltip and a stable RFC 4122 v4 `op:<uuid>` operator-id helper that downstream elevation plans (03–05) will inject into every tiered request body.

## What Shipped

### Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `dashboard/src/lib/protocol/agency-types.ts` | 21 | Dashboard mirror of grid-side tier types. SYNC header points back to `grid/src/api/types.ts`. Exports `HumanAgencyTier`, `TIER_NAME`, `OPERATOR_ID_REGEX`. |
| `dashboard/src/lib/stores/agency-store.ts` | 121 | `AgencyStore` class (subscribe/getSnapshot/setTier/hydrateFromStorage) + `agencyStore` singleton + `getOperatorId()` helper. SSR-guarded; H5 rejected at hydration per D-20. |
| `dashboard/src/lib/stores/agency-store.test.ts` | 267 | 25 tests: types & regex, SYNC-header drift detector, default H1, subscribe/setTier same-value no-op, localStorage persistence, H5 rejection, `getOperatorId` UUID + regex + stability + replacement, SSR safety via `delete globalThis.window`. |
| `dashboard/src/components/agency/agency-indicator.tsx` | 78 | `'use client'` persistent tier chip. `useSyncExternalStore(agencyStore.subscribe, agencyStore.getSnapshot, () => 'H1')`. Wraps Chip in `role="status"` with `aria-label` carrying tier + state suffix. Tooltip toggled on click/hover/focus; Escape closes. Focus ring `sky-300`. |
| `dashboard/src/components/agency/agency-indicator.test.tsx` | 160 | 13 tests: default render (H1), role="status" aria-label, tier reactivity (H2/H3/H4 border classes), tooltip visibility + click toggle, focus-ring class, data-testid presence for Plan 06 Playwright. |
| `dashboard/src/components/agency/tier-tooltip.tsx` | 74 | `'use client'` H1–H5 panel. `TIER_DEFINITIONS` exports 5 PHILOSOPHY §7 VERBATIM strings. H5 row: `line-through text-neutral-500` + `(requires Phase 8)` suffix. Active tier highlighted `font-semibold border-l-2 border-neutral-200 pl-2` (except H5). |
| `dashboard/src/components/agency/tier-tooltip.test.tsx` | 120 | 15 tests: 5 verbatim-copy drift detectors (strings embedded inline — paraphrase fails), H5 styling (D-20), active-tier highlight (H3), structure (role=tooltip, "Agency Scale" heading, exactly 5 listitems). |
| `dashboard/src/components/agency/agency-hydrator.tsx` | 20 | `'use client'` SSR-pure bridge. Calls `agencyStore.hydrateFromStorage()` inside `useEffect` exactly once on client mount. Returns `null`. |
| `dashboard/src/app/layout.test.tsx` | 133 | 5 tests: unconditional indicator mount (SC#1), fixed-position wrapper class list (`fixed right-4 top-4 z-50`), children render alongside indicator, hydrator fires exactly once (vi.spyOn), hydrator reads persisted tier from seeded localStorage. |

### Files Modified

| File | Change | Commit |
|------|--------|--------|
| `dashboard/src/components/primitives/chip.tsx` | Extended with optional `color?: ChipColor` prop (neutral/blue/amber/red/muted) + `aria-label` forward. Default `undefined` resolves to the pre-Phase-6 neutral class list — Inspector + Economy callers are zero-diff. UI-SPEC §Color tier-to-color map implemented in `COLOR_CLASSES`. | `ad3a1ff` |
| `dashboard/src/app/layout.tsx` | Stays Server Component. Imports `AgencyIndicator` + `AgencyHydrator`. Mounts hydrator (pure side-effect) and a fixed top-right overlay `<div className="fixed right-4 top-4 z-50"><AgencyIndicator /></div>` inside `<body>`, before `{children}`. | `bfa82b3` |
| `dashboard/src/lib/protocol/agency-types.ts` (post-Task-3 sync fix) | Matched grid-side two-line wrap of `OPERATOR_ID_REGEX` definition. Regex body byte-identical; formatting alignment satisfies the Plan 06 inter-package diff gate. | `3b7e0cc` |

## Commits

| Commit | Task | Message |
|--------|------|---------|
| `77e939f` | 1 | `feat(06-02): agency-types mirror + AgencyStore + getOperatorId` |
| `ad3a1ff` | 2 | `feat(06-02): Chip color prop + AgencyIndicator + TierTooltip` |
| `bfa82b3` | 3 | `feat(06-02): mount AgencyIndicator in root layout + hydrator` |
| `3b7e0cc` | post | `fix(06-02): match grid-side line-wrap for OPERATOR_ID_REGEX` |

## Success Criteria

| SC | Criterion | Status |
|----|-----------|--------|
| 1 | `<AgencyIndicator />` mounts in root layout and renders on every dashboard route (SC#1 unit-level) | ✅ `layout.test.tsx` Test 1 asserts `data-testid="agency-indicator"` present unconditionally |
| 2 | Chip shows `'H1 Observer'` on first load with empty localStorage, color class `bg-neutral-800` | ✅ `agency-indicator.test.tsx` default-render block |
| 3 | `agencyStore.setTier('H4')` re-renders chip with `'H4 Driver'` and `border-red-400` within one React commit | ✅ `agency-indicator.test.tsx` tier-reactivity block (uses `act()`) |
| 4 | Tooltip shows all 5 PHILOSOPHY §7 definitions verbatim | ✅ `tier-tooltip.test.tsx` 5 inline drift-detector tests pass |
| 5 | H5 tooltip row: `line-through` + `text-neutral-500` + `(requires Phase 8)` suffix | ✅ `tier-tooltip.test.tsx` H5 styling block (D-20 compliance) |
| 6 | `getOperatorId()` returns stable `op:<uuid-v4>` matching `OPERATOR_ID_REGEX`, persists via localStorage | ✅ `agency-store.test.ts` getOperatorId block (4 tests: generation, regex validation, stability, replacement on malformed) |
| 7 | Dashboard-side types byte-identical to grid-side | ✅ `diff <(grep ... grid) <(grep ... dashboard)` returns empty after commit `3b7e0cc` — contract gate green |
| 8 | Full dashboard suite green — no regression on Chip callers | ✅ 274/274 across 35 files after Task 3 |

## Verification Gates

**Unit (Wave 2 gate):**
```
cd dashboard && npx vitest run src/lib/stores/agency-store.test.ts src/components/agency src/components/primitives src/app/layout.test.tsx
```
Result: all target files green, 48 plan-02 tests pass.

**No-regression gate:**
```
cd dashboard && npx vitest run
```
Result: **274/274 across 35 files**. Inspector + Economy primitives tests unchanged.

**Contract gate (sync with grid):**
```
diff <(grep -E "^export (type HumanAgencyTier|const (TIER_NAME|OPERATOR_ID_REGEX))" grid/src/api/types.ts) \
     <(grep -E "^export (type HumanAgencyTier|const (TIER_NAME|OPERATOR_ID_REGEX))" dashboard/src/lib/protocol/agency-types.ts)
```
Result: empty diff, `SYNC OK` echo printed.

**Grep done-criteria (plan §done blocks):**
- `grep -n 'AgencyIndicator' dashboard/src/app/layout.tsx` → 2 matches (import + JSX) ✅
- `grep -n 'fixed right-4 top-4 z-50' dashboard/src/app/layout.tsx` → 1 match ✅
- `grep -c "H1 Observer — read-only" dashboard/src/components/agency/tier-tooltip.tsx` → 1 ✅

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Cosmetic drift] `OPERATOR_ID_REGEX` line-wrap mismatch between grid and dashboard**
- **Found during:** post-Task-3 verification, running the plan's Contract gate diff.
- **Issue:** Grid-side `OPERATOR_ID_REGEX` is split across two lines (`export const OPERATOR_ID_REGEX =\n    /^op:.../i;`). Dashboard mirror inlined the assignment on one line. Regex bodies are functionally identical but the plan explicitly demands byte-identical grep output across both packages (Contract gate in `<verification>`).
- **Fix:** Broke the dashboard assignment across two lines to match grid's formatting.
- **Files modified:** `dashboard/src/lib/protocol/agency-types.ts`
- **Commit:** `3b7e0cc`

**2. [Rule 3 — Tooling gap] jsdom ships empty `window.localStorage` under Vitest 4.1**
- **Found during:** Task 1 first test run.
- **Issue:** `localStorage.clear is not a function`. Probe confirmed `ls instanceof Storage: false`, `typeof ls.setItem: undefined` — Vitest 4.1 + jsdom hands back an empty object, not a real `Storage`.
- **Fix:** Added an inline `installLocalStoragePolyfill()` (Map-backed Storage installed via `Object.defineProperty(window, 'localStorage', ...)`) to `agency-store.test.ts`, `agency-indicator.test.tsx`, and `layout.test.tsx` in `beforeAll`. Could have been moved to the shared `src/test/setup.ts` but kept per-file for clarity — the polyfill is dependency-free and ≈25 LOC.
- **Files modified:** (new test files only — no production code touched)
- **Commit:** `77e939f` (initial), `ad3a1ff` (indicator test), `bfa82b3` (layout test)

**3. [Rule 3 — Tooling gap] jest-dom matchers don't register under Vitest 4.1 + oxc JSX transform**
- **Found during:** Task 2 tooltip test first run.
- **Issue:** `Invalid Chai property: toHaveTextContent` / `toBeInTheDocument`. Despite `src/test/setup.ts` importing `@testing-library/jest-dom/vitest`, the matchers never attach. Grep confirmed no existing dashboard test uses these matchers — the setup has been dead for an unknown duration.
- **Fix:** Rewrote all Plan 06-02 test assertions to use plain Chai + native DOM:
    - `expect(el.textContent).toBe('...')` / `.toContain('...')`
    - `expect(el).not.toBeNull()` / `.toBeNull()`
    - `expect(el.getAttribute('aria-label') ?? '').toContain('...')`
    - `expect(el.className).toContain('...')`
- This matches the rest of the dashboard suite's convention (e.g. `primitives.test.tsx`), so it's actually a consistency improvement.
- **Commits:** `ad3a1ff` (tooltip + indicator tests), `bfa82b3` (layout tests)

**4. [Rule 2 — Critical feature] aria-label carries tier-state suffix beyond the plan's `'Current agency tier: X'` minimum**
- **Found during:** Task 2 drafting (during UI-SPEC §Copywriting Contract review).
- **Issue:** The plan's Test 3 minimum asserts aria-label contains `'Current agency tier: H1 Observer'` — but that leaves screen-reader users without the tier-state semantic. Sighted users get the tier state from the border color (red vs blue vs neutral), so aria-label must carry it too.
- **Fix:** Added `STATE_SUFFIX` map encoding the tier state: `H1: 'Read-only.'`, `H2/H3/H4: 'Elevation active.'`, `H5: 'Disabled — requires Phase 8.'`. Tests updated to assert both `'Current agency tier: X'` and the state suffix are present.
- **Files modified:** `agency-indicator.tsx` (STATE_SUFFIX map) + `agency-indicator.test.tsx` (3 tests assert the suffix).
- **Commit:** `ad3a1ff`

### Authentication Gates

None — plan required no auth.

## Downstream Consumption

Plan 03 (`/gsd-execute-phase` orchestration will use this):
- `agencyStore.setTier(tier)` — called from the elevation dialog's confirm handler in Plan 03's `useElevatedAction`.
- `agencyStore.getSnapshot()` — used to read current tier for gating allowed actions without subscribing.
- `getOperatorId()` — returned value injected into every tiered request body's `operator_id` field (Plans 04 + 05).
- `HumanAgencyTier` type — imported from `@/lib/protocol/agency-types` anywhere the dashboard reasons about tier values. Never hand-roll the union.
- `OPERATOR_ID_REGEX` — imported for any dashboard-side validation of operator IDs. Dashboard-side validation is a convenience; the grid is the authoritative validator.

## Self-Check: PASSED

**Files verified to exist:**
- FOUND: `dashboard/src/lib/protocol/agency-types.ts`
- FOUND: `dashboard/src/lib/stores/agency-store.ts`
- FOUND: `dashboard/src/lib/stores/agency-store.test.ts`
- FOUND: `dashboard/src/components/agency/agency-indicator.tsx`
- FOUND: `dashboard/src/components/agency/agency-indicator.test.tsx`
- FOUND: `dashboard/src/components/agency/tier-tooltip.tsx`
- FOUND: `dashboard/src/components/agency/tier-tooltip.test.tsx`
- FOUND: `dashboard/src/components/agency/agency-hydrator.tsx`
- FOUND: `dashboard/src/app/layout.test.tsx`

**Commits verified to exist:**
- FOUND: `77e939f` feat(06-02): agency-types mirror + AgencyStore + getOperatorId
- FOUND: `ad3a1ff` feat(06-02): Chip color prop + AgencyIndicator + TierTooltip
- FOUND: `bfa82b3` feat(06-02): mount AgencyIndicator in root layout + hydrator
- FOUND: `3b7e0cc` fix(06-02): match grid-side line-wrap for OPERATOR_ID_REGEX

## TDD Gate Compliance

Plan type is `type: execute` (not `type: tdd` plan-level) but each task is `tdd="true"`. For every task, tests were written first (test file referenced in the task's `<files>` list alongside its production file), then implementation. All 4 feat/fix commits combine the test + implementation in a single commit per GSD convention for `type: execute` plans with per-task TDD — this is consistent with 06-01's shipping model.

No RED-commit-then-GREEN-commit split was required because this is an `execute` plan, not a `tdd` plan. The test file + implementation file shipped atomically per task, which matches Phase 6 Plan 01's SUMMARY (single feat commit per task bundling tests + code).
