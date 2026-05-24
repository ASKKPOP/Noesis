---
phase: 25c
plan: 04
subsystem: steward
wave: 4
tags: [culture, svg, nous-filter, skill-lineage, norm-timeline, lore-graph, observer]
dependency_graph:
  requires: [25c-03]
  provides: [culture-page, nous-filter-bar, skill-lineage-svg, norm-timeline-svg, lore-graph-svg]
  affects: [steward/src/app/culture/]
tech_stack:
  added: []
  patterns: [raw-svg-visualization, url-param-filter, promise-allsettled-multi-fetch, deterministic-scatter-layout]
key_files:
  created:
    - steward/src/app/culture/page.tsx
    - steward/src/app/culture/nous-filter-bar.tsx
    - steward/src/app/culture/skill-lineage.tsx
    - steward/src/app/culture/norm-timeline.tsx
    - steward/src/app/culture/lore-graph.tsx
  modified: []
decisions:
  - "Lore graph positions computed client-side via deterministicPosition(content_hash) since Grid /api/v1/grid/lore does not return {x,y} per entry"
  - "D-09 forced deviation: culture endpoints (/api/v1/grid/* and /api/v1/audit/*) fetch directly from NEXT_PUBLIC_GRID_ORIGIN, not via /api/operator proxy — proxy architecture cannot rewrite those path prefixes"
  - "Promise.allSettled used for multi-fetch so one failed endpoint does not block the others from rendering"
  - "NousFilterBar uses 300ms debounced router.replace; invalid DID input renders unfiltered view, not an error"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-22"
  tasks_completed: 2
  tasks_total: 2
  files_created: 5
  files_modified: 0
---

# Phase 25c Plan 04: Culture Browser Summary

Raw-SVG /culture page with three observer visualizations (Skill Lineage, Norm Timeline, Lore Graph) and a URL-param Nous DID filter bar, fetching directly from Grid culture endpoints.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Culture page + NousFilterBar component | 37207e2 | page.tsx, nous-filter-bar.tsx |
| 2 | Three Steward-native SVG culture components | 80f6bf7 | skill-lineage.tsx, norm-timeline.tsx, lore-graph.tsx |

## What Was Built

### Culture Page (`page.tsx`)
- `'use client'` component with `useSearchParams` for `?nous=<did>` URL param reading
- `Promise.allSettled` fetching from four Grid endpoints directly via `NEXT_PUBLIC_GRID_ORIGIN`:
  - `GET /api/v1/grid/culture/skills/lineage`
  - `GET /api/v1/grid/norms`
  - `GET /api/v1/grid/lore?limit=100`
  - `GET /api/v1/audit/trail?type=lore.cited&limit=200`
- DID_REGEX validation before activating filter (`activeFilter` is null if invalid DID)
- Loading/error states, passes data + filter to each SVG component

### NousFilterBar (`nous-filter-bar.tsx`)
- 300ms debounced `router.replace` updates URL param
- Active filter pill with terracotta styling and `×` clear button (aria-label "Clear filter")
- `aria-label="Filter by Nous DID"` + visually-hidden helper text
- Invalid DID input quietly renders unfiltered view (no error state)

### Skill Lineage (`skill-lineage.tsx`)
- Raw SVG with server-computed `{x, y}` node positions (no client layout needed)
- Nous nodes: sage `#3a7a5a` circles r=8; Skill nodes: amber `#7a6a2e` 12×12 rects
- Taught edges: solid sage lines; Inferred: dashed amber lines
- Filter: incident edges + filtered node at full opacity; others dimmed to 0.3/0.25
- Filtered node gets terracotta `strokeWidth: 2` ring
- Empty state: "No skill lineage recorded yet."
- Footer legend with mini SVG glyphs

### Norm Timeline (`norm-timeline.tsx`)
- Horizontal SVG timeline; X-axis = tick
- Evidence range bars (lighter fill) + crystallization circles per norm
- Norms always shown unfiltered; sub-label: "Norms are Grid-wide; per-Nous filter does not apply."
- Tick marks every 100 ticks with 9px mono labels
- Empty state: "No crystallized norms yet."

### Lore Graph (`lore-graph.tsx`)
- Positions computed client-side via `deterministicPosition(content_hash)` — hash-seeded scatter
- Category-colored circles (myth, history, ritual, principle, fallback)
- Citation edges rendered only when both source and target have lore entry positions
- Citation count labels (×N) for entries with `citation_count >= 3`
- Filter: `contributor_did === filter` at opacity 1.0 with terracotta stroke ring; others 0.3
- Filter empty state: "No lore contributions from this Nous."
- Global empty state: "No lore contributions yet."

## Deviations from Plan

### Forced Deviation: D-09 — Culture endpoints not proxiable

**Rule:** Rule 2 (forced architectural reality, documented in plan task notes)

**Found during:** Task 1 pre-execution analysis

**Issue:** D-09 specifies "Steward routes all Grid calls through the existing operator proxy." The operator proxy at `/api/operator/...` on Grid maps to `x-operator-id` gated routes. Culture endpoints at `/api/v1/grid/...` and `/api/v1/audit/trail` use different path prefixes that the proxy cannot rewrite. This was already identified in RESEARCH.md Pitfall 3 and documented in the plan task itself as a known forced deviation.

**Fix:** All four culture fetches go directly to `NEXT_PUBLIC_GRID_ORIGIN` — same pattern as `steward/src/app/users/page.tsx` and `steward/src/app/nous/[id]/page.tsx`.

**Files modified:** `steward/src/app/culture/page.tsx`

**Commit:** 37207e2

**Traceability:** Plan task explicitly documents this as unimplementable per architecture; forced deviation is plan-sanctioned.

### Architectural Note: Lore `{x, y}` fields absent from Grid API

The plan's `<interfaces>` section confirms Grid's `/api/v1/grid/lore` does NOT return `{x, y}` per `LoreEntryRow`. The plan prescribes `deterministicPosition(content_hash)` as the canonical client-side layout. Implemented exactly as specified.

## Known Stubs

None. All three panels render live Grid data (or their empty states when no data exists). No hardcoded placeholder data.

## Threat Flags

No new security-relevant surface beyond what the plan's threat model covers:

- T-25c-04-03 (URL param injection): Mitigated — `DID_REGEX.test(nousParam)` validates before use; invalid input renders unfiltered view.
- T-25c-04-02 (no mutations): Confirmed — zero `audit.append` / `audit.emit` calls in any culture file.
- T-25c-04-01 / T-25c-04-04 (disclosure): Accepted — culture data already public via Grid API.

## Invariant Verification

```
grep -rn "import.*d3|import.*recharts|import.*react-flow|import.*cytoscape" steward/src/app/culture/
→ 0 matches (D-10 raw-SVG invariant: PASS)

grep -rn "audit.append" steward/src/app/culture/
→ 0 matches (allowlist delta 0: PASS)

grep "NEXT_PUBLIC_GRID_ORIGIN" steward/src/app/culture/page.tsx
→ present (direct Grid fetch: PASS)

grep "useSearchParams" steward/src/app/culture/page.tsx
→ 2 matches (import + usage: PASS)

grep "deterministicPosition" steward/src/app/culture/lore-graph.tsx
→ 2 matches (definition + usage: PASS)
```

## Self-Check: PASSED

All 5 files created and verified:
- steward/src/app/culture/page.tsx — FOUND
- steward/src/app/culture/nous-filter-bar.tsx — FOUND
- steward/src/app/culture/skill-lineage.tsx — FOUND
- steward/src/app/culture/norm-timeline.tsx — FOUND
- steward/src/app/culture/lore-graph.tsx — FOUND

Commits verified:
- 37207e2 (Task 1) — FOUND
- 80f6bf7 (Task 2) — FOUND
