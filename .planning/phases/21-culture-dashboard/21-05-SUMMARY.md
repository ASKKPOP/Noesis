---
phase: 21-culture-dashboard
plan: "05"
subsystem: dashboard-culture-svg
tags: [svg, culture, norm-timeline, lore-graph, tdd, CULTURE-02, CULTURE-03]
dependency_graph:
  requires: ["21-03"]
  provides: [norm-timeline-component, lore-graph-component]
  affects: [culture-dashboard-page]
tech_stack:
  added: []
  patterns: [raw-svg-D-9-08, tdd-red-green, bipartite-layout-arithmetic, swr-hook-mock]
key_files:
  created:
    - dashboard/src/components/culture/norm-timeline.tsx
    - dashboard/src/components/culture/lore-graph.tsx
    - dashboard/src/components/culture/__tests__/norm-timeline.test.tsx (filled stubs)
    - dashboard/src/components/culture/__tests__/lore-graph.test.tsx (filled stubs)
  modified:
    - dashboard/vitest.config.ts (Rule 1 auto-fix: replace oxc key with plugin-react for Vite 5)
decisions:
  - "NormTimeline uses getAllByText() in tests for participant_count and convergence_type labels to handle SVG label + legend text matches"
  - "LoreGraph <title> placed as direct child of <g> (sibling of <circle>) per SVG spec; tests find it via g.querySelector('title')"
  - "stroke-dasharray DOM attribute queried with both hyphenated and camelCase forms to handle React/jsdom serialization"
  - "vitest.config.ts oxc key replaced with @vitejs/plugin-react (already installed at 4.7.0) — oxc key is Vite 8 syntax, ignored by Vite 5.4 causing React not defined in all component tests"
metrics:
  duration: "~22 minutes"
  completed: "2026-05-17"
  tasks_completed: 2
  files_created: 4
  files_modified: 1
---

# Phase 21 Plan 05: NormTimeline and LoreGraph Summary

NormTimeline SVG component (CULTURE-02) and LoreGraph bipartite SVG component (CULTURE-03) — both following D-9-08 raw SVG constraints with no external layout libraries. 9 NormTimeline tests + 10 LoreGraph tests all green.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | NormTimeline + norm-timeline tests | 354f152 | norm-timeline.tsx, norm-timeline.test.tsx, vitest.config.ts |
| 2 | LoreGraph + lore-graph tests | 859cb4e | lore-graph.tsx, lore-graph.test.tsx |

## What Was Built

**`dashboard/src/components/culture/norm-timeline.tsx`** — NormTimeline SVG component consuming `useNorms()` hook. Renders one `<rect>` per norm with fill `#7DD3FC` for emergent (genuine cultural transmission) and `#9CA3AF` for coincidental (shared LLM prior). Each bar has a `<title>` with `{fingerprint} — {convergence_type} — {N} Nous — {duration} ticks`. X-axis is relative ticks (duration-proportional bar width, all bars start at `TIMELINE_START_X=200`). Loading/error/empty states use UI-SPEC copy verbatim.

**`dashboard/src/components/culture/lore-graph.tsx`** — LoreGraph bipartite SVG component consuming `useLoreGraph()` hook. Nous nodes at `x=150` (amber `#F59E0B`), lore entry nodes at `x=850` (violet `#A78BFA`). Contributed edges (solid) one per `loreEntry`, cited edges (dashed `strokeDasharray="4 2"`) one per `loreCitation`. Column labels "Nous" and "Lore" at top. Each `<g>` node has `<circle>` + `<title>` + `<text>` children; `<title>` holds the full DID or full content_hash for hover. Y positions computed with `distributeY()` arithmetic (no external layout library — complies with D-9-08).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vitest.config.ts used Vite 8 `oxc` JSX config on installed Vite 5**
- **Found during:** Task 1 RED phase — `React is not defined` in all component tests
- **Issue:** The `oxc` key in vitest.config.ts is Vite 8 syntax. The installed version is Vite 5.4.21 + Vitest 2.1.9 (not Vite 8 + Vitest 4.1 as the comment describes). Vite 5 silently ignores the `oxc` key, leaving JSX with no transform configuration — causing `React is not defined` in every component test render.
- **Fix:** Replaced `oxc: { jsx: { ... } }` with `plugins: [react()]` using `@vitejs/plugin-react` 4.7.0 (already in root node_modules). This is the correct approach for Vite 5.
- **Files modified:** `dashboard/vitest.config.ts`
- **Commit:** 354f152 (bundled with Task 1)

**2. [Rule 1 - Bug] `getByText` matched multiple elements for label + legend text**
- **Found during:** Task 1 GREEN phase — tests 7/8 failed with "Found multiple elements"
- **Issue:** NormTimeline renders both a SVG text label (`{N} Nous · convergence_type`) and a legend `<li>` containing the same text fragments. `getByText` threw on multiple matches.
- **Fix:** Changed test assertions to use `getAllByText(...).length > 0` for label presence tests.
- **Files modified:** `dashboard/src/components/culture/__tests__/norm-timeline.test.tsx`
- **Commit:** 354f152

**3. [Rule 1 - Bug] `strokeDasharray` DOM attribute name in test**
- **Found during:** Task 2 GREEN phase — dashed edge test failed
- **Issue:** React renders SVG `strokeDasharray` prop as `stroke-dasharray` (hyphenated) in the DOM. `getAttribute('strokeDasharray')` returned null.
- **Fix:** Test checks both `stroke-dasharray` and `strokeDasharray` attribute names.
- **Files modified:** `dashboard/src/components/culture/__tests__/lore-graph.test.tsx`
- **Commit:** 859cb4e

## Verification Results

```
norm-timeline tests:  9/9 passed
lore-graph tests:    10/10 passed
D-9-08 grep gate:    PASS (no banned imports in culture/)
broadcast-allowlist: PASS (baseline line count correct)
X_NOUS = 150:        present in lore-graph.tsx
X_LORE = 850:        present in lore-graph.tsx
strokeDasharray:     present on cited edges
No d3/react-flow/cytoscape/recharts/nivo imports: confirmed
```

## Known Stubs

None. Both components are fully wired to their `useNorms()` / `useLoreGraph()` hooks. Empty state, loading, and error cases all handle real data or absence of data. No hardcoded mock data in component files.

## Threat Flags

No new security surface introduced. SVG text content is React-escaped (no `dangerouslySetInnerHTML`). Norm fingerprints are 6-char SHA-256 hex prefixes — not reversible. Lore content hashes are SHA-256 hex. DIDs are validated at sole-producer boundary. All consistent with threat model T-21-05-01 through T-21-05-03 in the plan.

## Self-Check: PASSED

Files exist:
- FOUND: dashboard/src/components/culture/norm-timeline.tsx
- FOUND: dashboard/src/components/culture/lore-graph.tsx
- FOUND: dashboard/src/components/culture/__tests__/norm-timeline.test.tsx
- FOUND: dashboard/src/components/culture/__tests__/lore-graph.test.tsx

Commits exist:
- FOUND: 354f152 (feat(21-05): implement NormTimeline SVG component and tests)
- FOUND: 859cb4e (feat(21-05): implement LoreGraph bipartite SVG component and tests)
