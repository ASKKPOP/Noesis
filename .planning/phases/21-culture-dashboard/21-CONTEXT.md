# Phase 21: Culture Dashboard — Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 21 delivers three SVG emergence visualizations — skill lineage tree, norm adoption timeline, and lore contribution graph — as a new "Culture" tab in the operator dashboard. This is a pure observation layer: zero new allowlist events, zero Brain changes, one new Grid REST endpoint (`GET /api/v1/grid/culture/skills/lineage`), and three new dashboard components.

The goal: make the v2.4 Agora emergence substrate legible to the operator without injecting into it.

**What Phase 21 must build:**
1. Grid: `GET /api/v1/grid/culture/skills/lineage` endpoint — queries audit chain for `skill.taught`/`skill.inferred` events, computes server-side `{x, y}` positions, returns `{nodes, edges}` ready for client SVG rendering.
2. Dashboard: `/grid/culture` route + new "Culture" top-level tab entry.
3. Dashboard: Three SVG components following D-9-08 (raw SVG, server-computed layout, no external graph libs):
   - `SkillLineageGraph` — directed tree of Nous and skill hash nodes
   - `NormTimeline` — horizontal per-norm SVG timeline showing candidate→crystallized transitions
   - `LoreGraph` — bipartite SVG (Nous nodes + lore entry nodes), solid/dashed edges
4. Dashboard: Firehose `culture` EventCategory added to `EventTypeFilter`.

**Allowlist:** 43→43. Zero new events. Phase 21 reads `skill.taught`, `skill.inferred`, `skill.rejected`, `norm.candidate`, `norm.crystallized`, `lore.contributed`, `lore.cited` from existing WsHub stream.

</domain>

<decisions>
## Implementation Decisions

### Page and Tab Structure

- **D-21-01:** Culture Dashboard lives at **a single `/grid/culture` route** — one page with all three SVG visualizations stacked vertically. Follows the `GovernanceDashboard` pattern (`governance-dashboard.tsx` renders multiple panels on one page). No sub-routes; all three culture signals visible with a single tab click.

- **D-21-02:** `/grid/culture` is a **new top-level tab** in the tab bar, alongside Economy, Governance, Replay, and Relationships. Label: `Culture`. These three visualizations are the signature output of the v2.4 Agora milestone — they deserve first-class visibility, not nesting under Governance.

### Skill Lineage REST Endpoint

- **D-21-03:** Phase 21 adds **`GET /api/v1/grid/culture/skills/lineage`** to Grid. This is the only Grid-side change in this phase.

  **Data source:** Query the existing MySQL `audit_chain` table (or audit chain query abstraction) for rows with `event_type IN ('skill.taught', 'skill.inferred')` at request time. No new derived table, no startup rebuild, no extra storage. Works off events that Phase 18 already committed.

  **Response shape** (mirrors `GET /api/v1/grid/relationships/graph` from Phase 9):
  ```json
  {
    "nodes": [
      { "id": "did:noesis:sophia", "label": "sophia", "type": "nous", "x": 120, "y": 80 },
      { "id": "sha256:a1b2c3...", "label": "a1b2c3", "type": "skill", "x": 240, "y": 160 }
    ],
    "edges": [
      {
        "source": "did:noesis:sophia",
        "target": "sha256:a1b2c3...",
        "tick": 42,
        "type": "taught"
      },
      {
        "source": "sha256:a1b2c3...",
        "target": "sha256:d4e5f6...",
        "tick": 67,
        "type": "inferred"
      }
    ]
  }
  ```

  **Node types:** `"nous"` (Nous DID as id, last segment after final `:` as label), `"skill"` (skill_hash as id, first 6 chars as label).

  **Layout:** Server computes `{x, y}` using a simple Sugiyama-style hierarchical tree layout (roots = originator Nous, children = skill hashes taught/inferred from them, grandchildren = learners). Depth = tree level; horizontal spread across nodes at each level. No external library — straightforward O(N) rank assignment.

  **Empty state:** Returns `{ "nodes": [], "edges": [] }` when no skill events exist. Dashboard handles gracefully.

### Firehose Filter Extension

- **D-21-04:** Add `"culture"` as a new **`EventCategory`** in `dashboard/src/lib/stores/event-type.ts`. The category matches any event whose type begins with `skill.`, `norm.`, or `lore.` prefix.

  Chip color dot: **`bg-emerald-400`** (distinct from all existing category colors: amber/trade, violet/message, blue/movement, pink/law, neutral/lifecycle).

  `ALL_CATEGORIES` grows from 6 to 7. `EventTypeFilter` DOT map gets a `culture` entry. No other changes to the firehose pipeline — the prefix matching happens in the existing `matchesCategory` predicate (or its equivalent), alongside the existing category rules.

  One chip covers all three cultural signal types (`skill.*`, `norm.*`, `lore.*`). Fine-grained per-prefix filtering is deferred.

### SVG Labels and Hover

- **D-21-05:** All three culture SVG components use **6-char truncated labels inline** + **SVG `<title>` child element** for hover (native browser tooltip, no JS, no new component).

  Pattern:
  ```tsx
  <g>
    <circle cx={n.x} cy={n.y} r={NODE_RADIUS} fill={color} />
    <title>{n.id}</title>          {/* full DID or hash on hover */}
    <text x={n.x + 8} y={n.y + 4} className="text-[10px] fill-neutral-400">
      {n.label}                    {/* 6-char truncated label */}
    </text>
  </g>
  ```

  Applies to: Nous DID nodes (label = last DID segment, e.g., `sophia`), skill hash nodes (label = first 6 chars of hash), lore entry nodes (label = first 6 chars of content_hash). Edge `<title>` shows tick number.

  This is consistent with the RelationshipGraph — no click-through interaction, no external tooltip library.

### Claude's Discretion

- Exact Sugiyama rank assignment algorithm (simple BFS from roots sufficient; no need for full Coffman-Graham).
- Whether `SkillLineageGraph`, `NormTimeline`, and `LoreGraph` each get their own SWR hook (recommended: yes — mirrors `useGraph` from Phase 9, one hook per endpoint).
- Norm timeline x-axis scale: tick-indexed (absolute) vs. relative (ticks since `norm.candidate`). Recommend relative — clearer for operator to see candidate→crystallized duration.
- Lore graph bipartite layout: Nous nodes on left column, lore entry nodes on right column. Two-pass layout: column X is fixed, Y is evenly distributed within column.
- Whether the `/grid/culture` page uses a `<Suspense>` boundary per visualization or one shared loading state.
- `data-testid` attribute naming for the three SVG elements (recommend: `skill-lineage-svg`, `norm-timeline-svg`, `lore-graph-svg` — mirrors `relationship-graph-svg`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §CULTURE-01..03 — authoritative acceptance criteria for Phase 21
- `.planning/ROADMAP.md` §Phase 21 — goal, success criteria, risk table (T-21-01, T-21-02), out-of-scope list
- `.planning/STATE.md` §Culture dashboard raw SVG (D-9-08) — raw SVG constraint, forbidden library list, grep gate scope

### Existing Dashboard Code (read before implementing)
- `dashboard/src/app/grid/relationships/relationship-graph.tsx` — D-9-08 SVG pattern to clone (server `{x,y}`, `<line>`, `<circle>`, `<title>`, warmth color map, VIEWPORT constant)
- `dashboard/src/app/grid/relationships/page.tsx` — route page pattern for culture page
- `dashboard/src/lib/stores/event-type.ts` — EventCategory type + ALL_CATEGORIES array (add `"culture"` here)
- `dashboard/src/app/grid/components/event-type-filter.tsx` — DOT color map (add `culture: 'bg-emerald-400'`)
- `dashboard/src/app/grid/governance/governance-dashboard.tsx` — multi-panel single-page pattern (template for culture page layout)
- `dashboard/src/components/primitives/empty-state.tsx` — EmptyState primitive for zero-node/zero-edge states

### Grid APIs (read before implementing endpoint)
- `grid/src/api/routes/lore.ts` — Phase 20 lore endpoint (template for skills/lineage route)
- `grid/src/api/operator/relationships.ts` — Phase 9 relationships graph endpoint with `{x, y}` layout (direct template for lineage layout logic)
- `grid/src/api/server.ts` — Fastify route registration (register new `/api/v1/grid/culture/skills/lineage` here)

### Grep Gate (mandatory)
- `scripts/check-relationship-graph-deps.mjs` — must be extended to cover `dashboard/src/components/culture/**` paths (T-21-02: D-9-08 grep gate extension)

### Prior Phase Patterns
- `.planning/phases/09-relationship-graph-derived-view/09-CONTEXT.md` — D-9-08 lock, D-9-09 server layout, warmth color hex values
- `.planning/phases/20-lore-commons/20-CONTEXT.md` — D-20-11 lore REST API shape (reuse for culture endpoint family)
- `.planning/phases/19-norm-crystallization/19-CONTEXT.md` — D-19-12 norms REST API shape; `norm_registry` table for NormTimeline data source

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `RelationshipGraph` (`relationships/relationship-graph.tsx`) — clone for `SkillLineageGraph`, `NormTimeline`, `LoreGraph`. All share: `VIEWPORT`, `NODE_RADIUS`, `EDGE_STROKE_WIDTH` constants; `<title>` hover pattern; role="img" + aria-label accessibility shell.
- `useGraph` hook pattern in `dashboard/src/lib/hooks/use-relationships.ts` — clone as `useSkillLineage()`, `useNorms()`, `useLoreGraph()`. Each fetches its REST endpoint via SWR.
- `EmptyState` primitive — already exists at `dashboard/src/components/primitives/empty-state.tsx`. Use when nodes array is empty (T-21-01).
- `GovernanceDashboard` layout — multi-section single-page pattern with section headings; clone for Culture page.
- Grid API operator routes (`grid/src/api/operator/relationships.ts`) — server-side `{x, y}` layout logic; adapt for hierarchical tree layout in the new lineage endpoint.

### Established Patterns
- D-9-08: raw SVG only — `<svg>`, `<line>`, `<circle>`, `<text>`, `<title>`. No d3, react-flow, recharts, cytoscape, nivo. Grep gate enforced by `check-relationship-graph-deps.mjs`.
- Server-computed layout: Grid REST endpoint returns `{x, y}` per node. Client does zero layout math.
- SWR data fetching: all dashboard data via SWR hooks; no direct fetch in components.
- `data-testid` on SVG root elements (e.g., `data-testid="relationship-graph-svg"`).

### Integration Points
- `dashboard/src/app/grid/` — add `culture/` subdirectory with `page.tsx` and `culture-dashboard.tsx`
- `dashboard/src/app/grid/components/tab-bar` — add "Culture" tab entry pointing to `/grid/culture`
- `dashboard/src/lib/stores/event-type.ts` — add `"culture"` to the `EventCategory` union and `ALL_CATEGORIES`
- `grid/src/api/server.ts` or `grid/src/api/routes/` — register new `GET /api/v1/grid/culture/skills/lineage` route

</code_context>

<specifics>
## Specific Ideas

- **Norm timeline x-axis:** Use ticks-relative-to-candidate (not absolute tick numbers). Each norm row starts at tick 0 (its `norm.candidate` event), ends when `norm.crystallized` fires. Makes the candidate→crystallized duration immediately readable without knowing absolute grid age.
- **Lore graph bipartite layout:** Nous DID nodes in left column (evenly spaced Y), lore entry nodes in right column (evenly spaced Y). Solid edges = `lore.contributed`, dashed edges = `lore.cited`. Edge thickness or opacity can encode `citation_count` (heavier = cited more). Server computes: `x_nous = 150`, `x_lore = 850`, y = `(index / count) * VIEWPORT.height`.
- **Edge type visual distinction (skill lineage):** `skill.taught` edges solid line, `skill.inferred` edges dashed (`strokeDasharray="4 2"`). Color both neutral-400, matching RelationshipGraph cold edge color. Tick label on each edge via `<title>`.
- **Dependency on norms API:** `GET /api/v1/grid/norms` (Phase 19) returns `norm_registry` records. NormTimeline fetches from this endpoint. The `evidence_tick_range` array `[first_seen_tick, crystallized_tick]` maps directly to timeline start/end. `convergence_type` maps to a label in the SVG ("emergent" vs "coincidental").

</specifics>

<deferred>
## Deferred Ideas

- **Fine-grained culture event filtering** (`skill`, `norm`, `lore` as separate EventCategory values) — single `culture` chip is sufficient for Phase 21. Separate chips would require 3 more entries in ALL_CATEGORIES.
- **Click-to-inspect nodes** (linking from a Nous node in the culture graph to the Inspector for that Nous) — static SVG in Phase 21; interactive navigation is post-v2.4.
- **Live-updating culture SVGs via WebSocket** — culture graphs are batch-rendered on page load via REST. Real-time incremental update (new edge appearing as a skill is taught) deferred post-v2.4.
- **Operator-curated culture artifacts** — explicitly an anti-feature in v2.4 Agora. Culture is Nous-initiated only.
- **Culture analytics export** — CSV/JSON export of lineage or norm data is post-v2.4.

</deferred>

---

*Phase: 21-culture-dashboard*
*Context gathered: 2026-05-17*
