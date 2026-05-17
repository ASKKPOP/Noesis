---
phase: "21"
plan: "04"
subsystem: dashboard
tags: [svg, culture, skill-lineage, D-9-08, tdd]
dependency_graph:
  requires:
    - "21-03"  # use-culture.ts hooks (useSkillLineage export)
  provides:
    - "SkillLineageGraph SVG component"
    - "Passing tests for CULTURE-01 skill lineage rendering"
  affects:
    - "dashboard/src/components/culture/"
tech_stack:
  added: []
  patterns:
    - "D-9-08: Raw SVG with server-computed layout, no external graph libs"
    - "TDD: RED/GREEN/REFACTOR cycle for component tests"
    - "vi.mock('@/lib/hooks/use-culture') for hook isolation"
key_files:
  created:
    - dashboard/src/components/culture/skill-lineage-graph.tsx
  modified:
    - dashboard/src/components/culture/__tests__/skill-lineage-graph.test.tsx
decisions:
  - "Used textContent assertion instead of toHaveTextContent due to worktree vitest environment — jest-dom matchers not hoisted to worktree dashboard node_modules"
  - "Removed banned-lib keywords (cytoscape/d3/etc) from JSDoc comment to pass Gate C grep gate string scan"
metrics:
  duration: "~9 minutes (worktree execution)"
  completed: "2026-05-17T16:44:43Z"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 2
---

# Phase 21 Plan 04: SkillLineageGraph Component Summary

**One-liner:** SkillLineageGraph SVG component with D-9-08 pattern — server-computed layout, Nous/skill node types, taught/inferred edge styles, title hover, and 9 passing unit tests.

---

## What Was Built

### `dashboard/src/components/culture/skill-lineage-graph.tsx`

The `SkillLineageGraph` component follows the D-9-08 RelationshipGraph clone pattern exactly:

- `'use client'` directive
- SVG constants: `VIEWPORT={width:1000,height:1000}`, `NODE_RADIUS=6`, `EDGE_STROKE_WIDTH=1.5`, `NODE_NOUS_FILL='#F59E0B'`, `NODE_SKILL_FILL='#4ADE80'`, `EDGE_STROKE='#9CA3AF'`
- Consumes `useSkillLineage()` from `@/lib/hooks/use-culture`
- Loading: `<div role="status">Loading skill lineage…</div>`
- Error: `<div role="alert">Skill lineage could not be loaded.</div>`
- Empty: `<EmptyState title="No skill events yet." description="..." testId="skill-lineage-empty" />`
- SVG root: `data-testid="skill-lineage-svg"`, `role="img"`, `aria-label="Skill lineage tree showing how skills propagate between Nous"`
- Edges: `skill.taught` = solid (no strokeDasharray), `skill.inferred` = dashed (`strokeDasharray="4 2"`)
- Nodes: `type:'nous'` → amber fill, `type:'skill'` → green fill
- Every node `<g>` has `<title>{n.id}</title>` (full DID or hash)
- Every edge `<line>` has `<title>tick {e.tick}</title>`
- Legend section below SVG (edge types + node colors)
- Zero external layout libraries (D-9-08 enforcement)

### `dashboard/src/components/culture/__tests__/skill-lineage-graph.test.tsx`

Replaced Plan 01 stubs with 9 concrete passing tests:

1. Loading state renders `role="status"` with copy "Loading skill lineage…"
2. Error state renders `role="alert"` with copy "Skill lineage could not be loaded."
3. Empty state renders EmptyState with title "No skill events yet."
4. SVG with `data-testid="skill-lineage-svg"` present when data has nodes
5. Correct circle count per node count
6. Taught edge has no `stroke-dasharray` attribute
7. Inferred edge has `stroke-dasharray="4 2"`
8. Node `<g>` elements contain `<title>` with full DID/hash
9. Edge `<line>` elements contain `<title>` with "tick N" text

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed banned-lib keyword from JSDoc comment**
- **Found during:** Task 1 — grep gate (Gate C) failure
- **Issue:** JSDoc comment included "NO d3/react-flow/cytoscape/recharts/nivo" as prohibition reminder; Gate C does `contents.includes(banned)` on full file text, not just import lines
- **Fix:** Replaced with "no external graph layout libraries" (semantically equivalent, doesn't trigger gate)
- **Files modified:** `dashboard/src/components/culture/skill-lineage-graph.tsx`
- **Commit:** 897304f

**2. [Rule 3 - Blocking] Worktree node_modules missing**
- **Found during:** Task 1 — test execution
- **Issue:** Worktree `agent-a03d9f42abfa0fcfb` had no `node_modules` — vitest and testing-library unavailable; `npm test` failed with PostCSS config error
- **Fix:** Ran `npm install` from worktree root; hoisted dependencies to worktree root `node_modules`
- **Commit:** N/A (node_modules not committed)

**3. [Rule 1 - Bug] `toHaveTextContent` jest-dom matcher not available in worktree vitest**
- **Found during:** Task 1 — first GREEN run
- **Issue:** `@testing-library/jest-dom` hoisted to worktree root `node_modules` but vitest 4.1.4 in `dashboard/node_modules` couldn't resolve the setup file import; `toHaveTextContent` showed "Invalid Chai property"
- **Fix:** Replaced `toHaveTextContent(str)` with `.textContent` + `.toContain(str)` — equivalent assertion, uses native vitest without jest-dom dependency
- **Files modified:** `dashboard/src/components/culture/__tests__/skill-lineage-graph.test.tsx`
- **Commit:** 897304f

---

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED | test file written (import error = compilation fail) | PASS |
| GREEN | 897304f — 9 tests pass | PASS |
| REFACTOR | None needed — component clean on first pass | N/A |

Note: RED phase used "component import fails because file doesn't exist" as the failing state, which is the canonical TDD red for a new component.

---

## Verification Results

| Check | Result |
|-------|--------|
| `vitest run skill-lineage-graph.test.tsx` | 9/9 passed |
| `node scripts/check-relationship-graph-deps.mjs` | All gates PASS |
| `grep "d3\|react-flow\|cytoscape\|recharts\|nivo" skill-lineage-graph.tsx` | Empty (no matches) |
| `grep "data-testid=\"skill-lineage-svg\"" skill-lineage-graph.tsx` | Match found |
| File starts with `'use client';` | Yes |
| Exports `SkillLineageGraph` | Yes |
| `NODE_NOUS_FILL = '#F59E0B'` present | Yes |
| `NODE_SKILL_FILL = '#4ADE80'` present | Yes |
| `strokeDasharray` with `'4 2'` for inferred | Yes |

---

## Threat Surface Scan

No new threat surface introduced. Component:
- Uses JSX string interpolation only (React escapes all content)
- No `dangerouslySetInnerHTML`
- Consumes only `n.id`, `n.label`, `n.type`, `n.x`, `n.y` from hook data
- All values are skill hashes (hex) or DID segments (alphanumeric + colon/hyphen) — consistent with T-21-04-01 mitigation documented in PLAN threat register

---

## Self-Check: PASSED

- `dashboard/src/components/culture/skill-lineage-graph.tsx` — FOUND
- `dashboard/src/components/culture/__tests__/skill-lineage-graph.test.tsx` — FOUND
- Commit `897304f` — FOUND in git log
