# Phase 21: Culture Dashboard — Research

**Researched:** 2026-05-17
**Domain:** SVG data visualization, Next.js routing, Fastify REST, SWR data fetching
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-21-01:** Culture Dashboard at a single `/grid/culture` route — one page with all three SVG visualizations stacked vertically. Follows `GovernanceDashboard` pattern. No sub-routes.
- **D-21-02:** `/grid/culture` is a new top-level tab in the tab bar, alongside Economy, Governance, Replay, and Relationships. Label: `Culture`. Add entry to `dashboard/src/app/grid/components/tab-bar`.
- **D-21-03:** `GET /api/v1/grid/culture/skills/lineage` is the only Grid-side change. Queries `audit_chain` for `skill.taught`/`skill.inferred` events. Returns `{nodes, edges}` with server-computed `{x, y}`. Hierarchical tree layout (BFS from roots, O(N) rank assignment). Empty state: `{nodes:[], edges:[]}`.
- **D-21-04:** Add `"culture"` EventCategory to `event-type.ts`. Matches `skill.*`, `norm.*`, `lore.*` prefixes. Color dot: `bg-emerald-400`. `ALL_CATEGORIES` grows 6→7.
- **D-21-05:** All three SVG components use 6-char truncated labels inline + SVG `<title>` child for hover (native browser tooltip). `skill.taught` edges solid, `skill.inferred` edges dashed (`strokeDasharray="4 2"`). Lore: solid=`lore.contributed`, dashed=`lore.cited`.

### Claude's Discretion

- Exact Sugiyama rank assignment algorithm (BFS from roots sufficient).
- Whether each SVG component gets its own SWR hook (recommended: yes).
- Norm timeline x-axis: relative ticks (ticks since `norm.candidate`) — recommended.
- Lore graph bipartite layout: Nous left (x=150), lore right (x=850), Y evenly distributed.
- Whether `/grid/culture` uses `<Suspense>` per visualization or one shared loading state.
- `data-testid` attribute naming (recommended: `skill-lineage-svg`, `norm-timeline-svg`, `lore-graph-svg`).

### Deferred Ideas (OUT OF SCOPE)

- Fine-grained culture event filtering (separate skill/norm/lore chips).
- Click-to-inspect nodes (interactive navigation from graph nodes to Inspector).
- Live-updating culture SVGs via WebSocket.
- Operator-curated culture artifacts.
- Culture analytics export (CSV/JSON).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CULTURE-01 | Skill lineage tree as raw SVG directed graph (D-9-08 pattern) with server `{x,y}`, `<line>`/`<circle>` elements, nodes = Nous + skill hashes, edges carry tick labels from `skill.taught`/`skill.inferred` | D-9-08 pattern verified in `relationship-graph.tsx`; endpoint design verified from `relationships.ts` + `appendSkillTaught.ts` |
| CULTURE-02 | Norm adoption timeline: horizontal SVG per norm showing `norm.candidate`→`norm.crystallized` transitions, participating Nous DIDs, `convergence_type` label | Norms API shape verified from `server.ts` norms route + D-19-12 |
| CULTURE-03 | Lore contribution graph: bipartite SVG (Nous nodes + lore entry nodes); edges = `lore.contributed` (solid) and `lore.cited` (dashed); edge weight proportional to citation count | Lore API shape verified from `lore.ts` endpoint |
</phase_requirements>

---

## Summary

Phase 21 is a pure observation layer: one new Grid REST endpoint plus three SVG dashboard components. No new allowlist events, no Brain changes, no new runtime dependencies. Every pattern needed exists and is verified in the codebase.

The `RelationshipGraph` component (`dashboard/src/app/grid/relationships/relationship-graph.tsx`) is the canonical D-9-08 SVG clone template. It demonstrates server-computed `{x,y}`, keyed `<line>` and `<circle>` elements, SVG `<title>` hover, `role="img"` + `aria-label` accessibility shell, and `data-testid`. All three culture SVG components replicate this structure with domain-specific data.

The Grid endpoint follows the pattern of `GET /api/v1/grid/relationships/graph` in `grid/src/api/operator/relationships.ts` for layout logic, and `grid/src/api/routes/lore.ts` for route registration style. The `audit_chain.query({eventType})` method accepts only a single `eventType` string — to query both `skill.taught` and `skill.inferred`, the endpoint must call `audit.all()` and filter in-application code (two passes or a single pass with `includes`).

The `TabBar` component currently handles only two in-page tabs (`firehose`/`economy`) via `?tab=` querystring on `/grid`. Governance, Relationships, and Replay are separate Next.js route pages — they are NOT currently linked from the `TabBar`. Adding "Culture" per D-21-02 requires extending the `TabBar` to include navigation-style link tabs pointing to `/grid/culture`. This architectural change is the highest-risk part of the phase: the TabBar test (`tab-bar.test.tsx`) hardcodes `expect(tabs).toHaveLength(2)` and must be updated.

**Primary recommendation:** Clone `relationship-graph.tsx` → three culture components; clone `use-relationships.ts` `useGraph()` → three culture hooks; extend `tab-bar.tsx` with a navigation tab for `/grid/culture`; register the lineage endpoint in `server.ts` following the norms inline-registration pattern.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Skill lineage layout computation | API / Backend (Grid) | — | D-9-09: server computes `{x,y}`; client does zero layout math |
| Skill lineage REST endpoint | API / Backend (Grid) | — | Fastify route in `grid/src/api/` |
| Norms REST query (existing) | API / Backend (Grid) | — | `/api/v1/grid/norms` already registered in `server.ts` |
| Lore REST query (existing) | API / Backend (Grid) | — | `/api/v1/grid/lore` already registered via `registerLoreRoutes` |
| SVG rendering (all 3 components) | Browser / Client | — | `'use client'` components; no SSR needed; pure React reconciliation |
| SWR data fetching | Browser / Client | — | Three hooks in `dashboard/src/lib/hooks/` |
| Tab bar navigation | Frontend Server (SSR) | Browser / Client | `tab-bar.tsx` uses `useRouter` + `useSearchParams` (already client-side) |
| EventCategory extension | Browser / Client | — | `event-type.ts` store mutation |
| Grep gate extension | CI / Scripts | — | `scripts/check-relationship-graph-deps.mjs` |

---

## Standard Stack

### Core (verified)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| swr | `^2.x` (existing in `dashboard/package.json`) | Data fetching + cache | All dashboard data via SWR; `useGraph` uses it |
| fastify | `^4.x` (existing in `grid/package.json`) | REST endpoint registration | All Grid routes use Fastify |
| next.js | `^15.x` (existing) | Route pages + server components | All dashboard pages are Next.js |
| vitest | `^2.0.0` (existing in both) | Testing | Project standard for Grid and Dashboard |

[VERIFIED: codebase grep — `package.json` files in `grid/` and `dashboard/`]

### No New Dependencies
Zero new packages. All three SVG components use raw React + built-in SVG primitives. The lineage layout uses only `node:crypto` (already imported in `relationships.ts`).

[VERIFIED: D-21-04, check-relationship-graph-deps.mjs BANNED list]

---

## Architecture Patterns

### System Architecture Diagram

```
Browser
  ├── /grid/culture (Next.js page)
  │     └── CultureDashboard ('use client')
  │           ├── useSkillLineage() [SWR] ──→ GET /api/v1/grid/culture/skills/lineage
  │           │     └── SkillLineageGraph   ──→ <svg> <circle> <line> <title>
  │           ├── useNorms() [SWR] ─────────→ GET /api/v1/grid/norms  (existing)
  │           │     └── NormTimeline        ──→ <svg> <rect> <text> <title>
  │           └── useLoreGraph() [SWR] ─────→ GET /api/v1/grid/lore   (existing)
  │                 └── LoreGraph           ──→ <svg> <circle> <line> <title>
  │
  └── /grid (existing TabBar extended)
        ├── tab: Firehose+Map  → ?tab= (querystring, existing)
        ├── tab: Economy       → ?tab=economy (querystring, existing)
        ├── link: Governance   → /grid/governance (existing route)
        ├── link: Relationships→ /grid/relationships (existing route)
        ├── link: Replay       → /grid/replay (existing route)
        └── link: Culture      → /grid/culture (NEW route) ← D-21-02

Grid (Fastify)
  └── GET /api/v1/grid/culture/skills/lineage (NEW)
        ├── audit.all() → filter {skill.taught, skill.inferred}
        ├── BFS layout: assign rank per node, spread horizontally
        └── return {nodes:[{id,label,type,x,y}], edges:[{source,target,tick,type}]}
```

### Recommended Project Structure (new files only)

```
dashboard/src/
├── app/grid/culture/
│   ├── page.tsx                  # Server component, metadata, shell
│   └── culture-dashboard.tsx    # 'use client', three SVG panels
├── components/culture/
│   ├── skill-lineage-graph.tsx  # SkillLineageGraph SVG (D-9-08)
│   ├── norm-timeline.tsx        # NormTimeline SVG
│   └── lore-graph.tsx           # LoreGraph SVG
└── lib/
    ├── api/culture.ts            # fetchSkillLineage, fetchNorms, fetchLore typed wrappers
    └── hooks/use-culture.ts      # useSkillLineage, useNorms, useLoreGraph SWR hooks

grid/src/api/
└── routes/
    └── culture.ts                # registerCultureRoutes (or inline in server.ts)
```

### Pattern 1: D-9-08 SVG Component Clone

All three SVG components follow this exact structure, verified from `relationship-graph.tsx`:

```tsx
// Source: dashboard/src/app/grid/relationships/relationship-graph.tsx
'use client';
const VIEWPORT = { width: 1000, height: 1000 } as const;
const NODE_RADIUS = 6;
const EDGE_STROKE_WIDTH = 1.5;

export function SkillLineageGraph(): React.ReactElement | null {
    const { data, error, isLoading } = useSkillLineage();

    if (isLoading) return <div role="status">Loading skill lineage…</div>;
    if (error) return <div role="alert">Skill lineage could not be loaded.</div>;
    if (!data) return null;

    const nodePos = new Map(data.nodes.map((n) => [n.id, n]));

    return (
        <svg
            viewBox={`0 0 ${VIEWPORT.width} ${VIEWPORT.height}`}
            className="w-full h-auto max-w-[800px] mx-auto"
            role="img"
            aria-label="Skill lineage tree showing how skills propagate between Nous"
            data-testid="skill-lineage-svg"
        >
            <g className="edges">
                {data.edges.map((e, i) => {
                    const a = nodePos.get(e.source);
                    const b = nodePos.get(e.target);
                    if (!a || !b) return null;
                    return (
                        <line
                            key={i}
                            x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                            stroke="#9ca3af"
                            strokeWidth={EDGE_STROKE_WIDTH}
                            strokeDasharray={e.type === 'inferred' ? '4 2' : undefined}
                        >
                            <title>tick {e.tick}</title>
                        </line>
                    );
                })}
            </g>
            <g className="nodes">
                {data.nodes.map((n) => (
                    <g key={n.id}>
                        <circle
                            cx={n.x} cy={n.y} r={NODE_RADIUS}
                            fill={n.type === 'nous' ? '#f59e0b' : '#4ade80'}
                        />
                        <title>{n.id}</title>
                        <text x={n.x + 8} y={n.y + 4} className="text-[10px] fill-neutral-400">
                            {n.label}
                        </text>
                    </g>
                ))}
            </g>
        </svg>
    );
}
```

[VERIFIED: relationship-graph.tsx exact implementation read]

### Pattern 2: SWR Hook Clone

Each culture endpoint gets its own SWR hook, mirroring `useGraph()`:

```typescript
// Source: dashboard/src/lib/hooks/use-relationships.ts (useGraph)
export function useSkillLineage(): SWRResponse<SkillLineageResponse, Error> {
    const currentTick = useTick();
    const windowKey = Math.floor(currentTick / 100); // D-9-13 batch window
    return useSWR(
        ['skill-lineage', windowKey],
        () => fetchSkillLineage(),
        { revalidateOnFocus: false, dedupingInterval: 0 },
    );
}
```

[VERIFIED: use-relationships.ts exact implementation read]

### Pattern 3: Grid Route Registration (inline in server.ts)

Norms endpoint uses the inline-registration pattern (no plugin wrapper):

```typescript
// Source: grid/src/api/server.ts lines 364-380
if (services.norms) {
    app.get('/api/v1/grid/norms', async (_req, reply) => { ... });
}
```

The lineage endpoint follows this same inline pattern (no `async register` plugin needed since there are no dynamic imports). Add to `GridServices` interface and register inline:

```typescript
// New in GridServices:
skills?: {
    audit: AuditChain; // already available via services.audit
};
// Route registration:
app.get('/api/v1/grid/culture/skills/lineage', async () => {
    const entries = services.audit.all()
        .filter(e => e.eventType === 'skill.taught' || e.eventType === 'skill.inferred');
    // build nodes + edges + layout
    return { nodes, edges };
});
```

[VERIFIED: server.ts norms pattern lines 364-380]

### Pattern 4: Sugiyama-Style Hierarchical Layout for Skill Lineage

The relationships graph uses `createHash('sha256').update(did).digest()` for deterministic circular layout. For the hierarchical tree, BFS rank assignment:

```typescript
// Conceptual — no external library (D-9-08)
function computeHierarchicalLayout(nodes, edges): NodePosition[] {
    // 1. Find roots (Nous nodes with no incoming 'taught' edges)
    // 2. BFS assigns rank (depth) to each node
    // 3. Group nodes by rank → compute x evenly spaced, y = rank * LEVEL_HEIGHT
    // LEVEL_HEIGHT = VIEWPORT.height / (maxRank + 1)
    // Horizontal spacing: x = (index_in_rank + 1) * VIEWPORT.width / (count_in_rank + 1)
    const VIEWPORT = { width: 1000, height: 1000 };
    // ... O(N) implementation, no library
}
```

[VERIFIED: D-21-03 context + relationships.ts layout pattern]

### Pattern 5: Tab Bar Extension (Critical)

**Current TabBar:** Two-tab querystring switcher (`firehose`/`economy`) operating entirely within `/grid`. Governance, Relationships, Replay are separate route pages with no links from the TabBar.

**D-21-02 mandates:** Adding a "Culture" tab to the TabBar pointing to `/grid/culture`. This requires evolving the TabBar from a pure in-page querystring switcher to a hybrid that also handles cross-route navigation.

**Implementation approach:** Add a `Tab` union member `'culture'` and a corresponding `TABS` entry with `href: '/grid/culture'`. The `activate` function uses `router.push('/grid/culture')` for navigation tabs vs `router.replace('?tab=...')` for in-page tabs. Alternatively, keep the TabBar as-is and rely on a separate nav mechanism — but D-21-02 is explicit about adding to `tab-bar.tsx`.

**Warning:** The TabBar test (`tab-bar.test.tsx`) hardcodes `expect(tabs).toHaveLength(2)`. It MUST be updated to expect the new count when Culture is added.

[VERIFIED: tab-bar.tsx + tab-bar.test.tsx exact implementation read]

### Pattern 6: EventCategory Extension

```typescript
// Source: dashboard/src/lib/stores/event-type.ts

// Before:
export type EventCategory = 'trade' | 'message' | 'movement' | 'law' | 'lifecycle' | 'other';
// After:
export type EventCategory = 'trade' | 'message' | 'movement' | 'law' | 'lifecycle' | 'culture' | 'other';

// categorizeEventType additions:
if (eventType.startsWith('skill.') || eventType.startsWith('norm.') || eventType.startsWith('lore.')) {
    return 'culture';
}

// ALL_CATEGORIES grows 6→7:
export const ALL_CATEGORIES: readonly EventCategory[] = Object.freeze([
    'trade', 'message', 'movement', 'law', 'lifecycle', 'culture',
] as const);
```

In `event-type-filter.tsx`, DOT map gains:
```typescript
culture: 'bg-emerald-400',
```

[VERIFIED: event-type.ts + event-type-filter.tsx exact implementation read]

### Anti-Patterns to Avoid

- **Importing d3, react-flow, cytoscape, recharts, nivo:** D-9-08 hard ban. `check-relationship-graph-deps.mjs` enforces this via CI. [VERIFIED: banned list read from script]
- **Client-side layout computation:** All `{x,y}` positions come from the server response. Client does zero math.
- **Single `eventType` filter for dual event types:** `AuditChain.query()` takes one `eventType` string. To get both `skill.taught` and `skill.inferred`, use `audit.all()` then filter with `e.eventType === 'skill.taught' || e.eventType === 'skill.inferred'`. [VERIFIED: chain.ts query implementation]
- **Placing culture SVG components outside `dashboard/src/components/culture/`:** The grep gate extension in Wave 0 must cover this path.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP data fetching + caching | Custom fetch/cache | `swr` (already installed) | Deduplication, revalidation, loading/error states — already wired |
| SVG element types | Custom element abstraction | Raw `<circle>`, `<line>`, `<text>`, `<title>` | D-9-08 mandates raw SVG; abstraction adds indirection without value |
| Node position for relationships graph | Custom hash layout | `computeNodePosition()` in `relationships.ts` | Already implemented; culture endpoint uses same crypto primitive |
| Empty state UI | Custom empty box | `EmptyState` from `dashboard/src/components/primitives/empty-state.tsx` | Already has correct styling + testId support |
| Route registration plumbing | Custom middleware | Fastify inline `app.get(...)` (norms pattern) | Consistent with existing culture-adjacent endpoints |

---

## Data Shapes Verified

### Skill Lineage Response (new — D-21-03)

```json
{
  "nodes": [
    {"id":"did:noesis:sophia","label":"sophia","type":"nous","x":120,"y":80},
    {"id":"sha256:a1b2c3…","label":"a1b2c3","type":"skill","x":240,"y":160}
  ],
  "edges": [
    {"source":"did:noesis:sophia","target":"sha256:a1b2c3…","tick":42,"type":"taught"},
    {"source":"sha256:a1b2c3…","target":"sha256:d4e5f6…","tick":67,"type":"inferred"}
  ]
}
```

Source events queried from `audit_chain`:
- `skill.taught` payload: `{learner_did, parent_hash, skill_hash, teacher_did, tick}` — teacher→learner edge
- `skill.inferred` payload: `{learner_did, skill_hash, source_event_hash, tick}` — skill→skill edge (skill inferred from another skill's source event)

[VERIFIED: appendSkillTaught.ts closed-tuple + STATE.md payload shapes]

### Norms Response (existing — D-19-12)

`GET /api/v1/grid/norms` returns:
```json
{
  "norms": [
    {
      "norm_id": "uuid",
      "fingerprint": "a1b2c3",
      "crystallized_tick": 450,
      "participant_count": 4,
      "convergence_type": "emergent",
      "evidence_tick_range": [410, 450]
    }
  ]
}
```

`evidence_tick_range` IS confirmed present in server.ts line 377:
`evidence_tick_range: [r.first_seen_tick, r.crystallized_tick]`

NormTimeline: x-axis maps relative tick position (`evidence_tick_range[0]` to `evidence_tick_range[1]`). No participant DID list in the crystallized norms API — `participant_count` is a count, not a DID array. The timeline shows `fingerprint` (6-char), `convergence_type`, and duration.

[VERIFIED: server.ts norms route lines 364-380]

### Lore Response (existing — D-20-11)

`GET /api/v1/grid/lore` returns:
```json
{
  "entries": [
    {
      "contributor_did": "did:noesis:sophia",
      "tick": 100,
      "content_hash": "sha256:abcdef…",
      "category_tag": "observation",
      "citation_count": 5
    }
  ],
  "total": 1
}
```

LoreGraph: Nous nodes derived from unique `contributor_did` values; lore nodes from `content_hash`. Edges: `lore.contributed` = solid (each entry → its contributor), `lore.cited` = dashed (requires a separate citation query or using `citation_count` for thickness).

**Gap:** The `/api/v1/grid/lore` endpoint returns `citation_count` per entry but does NOT return per-Nous citation edges (who cited what). For the LoreGraph, edges between Nous and lore entries are `lore.contributed` (solid) — one per entry. The `lore.cited` dashed edges would require querying `audit_chain` for `lore.cited` events, which the current lore endpoint does not expose. The LoreGraph may need to derive citation edges from `audit.query({eventType:'lore.cited'})` or use `citation_count` as edge thickness on contributed edges only.

[VERIFIED: lore.ts + LoreStorage implementation]

---

## Common Pitfalls

### Pitfall 1: TabBar Test Hardcodes Tab Count

**What goes wrong:** `tab-bar.test.tsx` line `expect(tabs).toHaveLength(2)` will fail after adding Culture tab.

**Why it happens:** The test was written when TabBar had exactly two tabs.

**How to avoid:** Update the test in the same task that modifies `tab-bar.tsx`. The test mock for `next/navigation` `useRouter` and `useSearchParams` will also need updating if Culture uses `router.push()` rather than `router.replace()`.

**Warning signs:** CI failure: `Expected: 2, Received: 3` in tab-bar tests.

[VERIFIED: tab-bar.test.tsx line 34]

### Pitfall 2: AuditChain.query() Only Accepts Single EventType

**What goes wrong:** Calling `services.audit.query({eventType: 'skill.taught'})` gets only `skill.taught` events. A second call for `skill.inferred` is needed. Missing `skill.inferred` events means inferred edges are absent from the lineage tree.

**Why it happens:** `AuditQuery` interface has `eventType?: string` (singular). The `query()` method filters by exact match.

**How to avoid:** Use `services.audit.all()` and filter with `includes([...])` in one pass, or call `query()` twice and concatenate. The `all()` approach is simpler and avoids the second filter pass.

[VERIFIED: chain.ts query + types.ts AuditQuery interface]

### Pitfall 3: Grep Gate Line Count Stale

**What goes wrong:** `check-relationship-graph-deps.mjs` Gate B checks `broadcast-allowlist.ts` line count. Current `ALLOWLIST_BASELINE_LINES = 379`. Current actual line count = 458. The script will **already fail** — this is a pre-existing drift from Phases 18-20 that must be corrected in Wave 0 of Phase 21 (or was corrected in a prior phase without updating the script).

**Why it happens:** Phase 18-20 added events to `broadcast-allowlist.ts` and likely updated `ALLOWLIST_BASELINE_LINES` inside the script — or did not. The script comment shows history up to Phase 16 (379 lines) but the file is now 458 lines.

**How to avoid:** Wave 0 of Phase 21 must verify the current baseline and update `ALLOWLIST_BASELINE_LINES` if it has drifted. Also extend the script to cover `dashboard/src/components/culture/**` paths for D-9-08 enforcement.

[VERIFIED: check-relationship-graph-deps.mjs line 54 + wc -l broadcast-allowlist.ts = 458]

### Pitfall 4: Lore Citation Edges May Not Be Directly Available

**What goes wrong:** The `/api/v1/grid/lore` endpoint returns `citation_count` per entry but not which Nous cited which lore. LoreGraph needs citation edges (dashed lines) between Nous and lore nodes — but there is no endpoint that returns `{citing_did, content_hash}` pairs.

**Why it happens:** `LoreCitationListener` increments `citation_count` in the `lore_commons` table but does not expose per-citation records.

**How to avoid:** Two options — (1) `useLoreGraph` fetches both `/api/v1/grid/lore` (for contributed edges) and `/api/v1/audit/trail?type=lore.cited` (for citation edges), combining them client-side, OR (2) encode `citation_count` as edge weight/opacity on contributed edges only (no dashed citation edges). Decision is Claude's discretion per CONTEXT.md — option 2 is simpler and avoids a second endpoint. If dashed citation edges are required, `/api/v1/audit/trail?type=lore.cited` exists as a fallback.

[VERIFIED: lore.ts response shape + server.ts audit trail endpoint]

### Pitfall 5: Norm Participant DIDs Not in REST Response

**What goes wrong:** NormTimeline wants to show "participating Nous DIDs" per norm, but `GET /api/v1/grid/norms` returns only `participant_count` (integer), not a DID list.

**Why it happens:** D-19-12 design returned crystallized norms from `norm_registry` table which stores `participant_count` not individual DIDs.

**How to avoid:** NormTimeline shows `participant_count` as a label (e.g., "4 Nous"). If individual DIDs are needed, they would require a new endpoint or a new column in `norm_registry` — both are out of scope for Phase 21. Use `participant_count` + `convergence_type` + `fingerprint` as the timeline labels.

[VERIFIED: server.ts norms route shape + D-19-04 norm_registry schema]

---

## Grep Gate Extension (T-21-02)

Current `check-relationship-graph-deps.mjs`:
- **Gate A:** Scans `dashboard/package.json` and `grid/package.json` for banned graph layout libs.
- **Gate B:** Checks `broadcast-allowlist.ts` line count against baseline (379 — stale, actual is 458).

Extension for Phase 21:
1. Update `ALLOWLIST_BASELINE_LINES` from 379 to the correct current value (verify before committing).
2. Add Gate C: scan `dashboard/src/components/culture/**/*.tsx` for banned imports (`d3`, `react-flow`, `cytoscape`, `recharts`, `nivo`). Mirror Gate A logic but scoped to the new culture directory.

[VERIFIED: check-relationship-graph-deps.mjs full implementation]

---

## Wave Planning Recommendation

Given the deliverables and dependencies:

**Wave 0 (Safety / Setup):**
- Fix `ALLOWLIST_BASELINE_LINES` in grep gate script (verify current value = 458).
- Extend grep gate to cover `dashboard/src/components/culture/**`.
- Create `dashboard/src/components/culture/` directory with placeholder index.
- Assert allowlist count = 43 (read-only check, no additions).

**Wave 1 (Grid endpoint):**
- Implement `GET /api/v1/grid/culture/skills/lineage` in `grid/src/api/routes/culture.ts`.
- Add `skills?: {...}` service to `GridServices` in `server.ts` (or inline with `services.audit`).
- Register route inline in `server.ts` following norms pattern.
- Grid-side tests: empty response when no skill events, correct node/edge shapes, layout monotonicity.

**Wave 2 (Dashboard API + hooks):**
- Create `dashboard/src/lib/api/culture.ts` with `fetchSkillLineage`, `fetchNorms`, `fetchLore` typed wrappers.
- Create `dashboard/src/lib/hooks/use-culture.ts` with `useSkillLineage`, `useNorms`, `useLoreGraph`.
- Unit test the hooks (mock SWR, assert correct SWR keys).

**Wave 3 (SVG components + page):**
- Implement `SkillLineageGraph`, `NormTimeline`, `LoreGraph` in `dashboard/src/components/culture/`.
- Implement `culture-dashboard.tsx` (GovernanceDashboard pattern, three stacked panels).
- Implement `dashboard/src/app/grid/culture/page.tsx` (server component shell, metadata).
- Component tests: loading/error/empty states, circle/line counts, edge stroke style (solid/dashed).

**Wave 4 (Integration):**
- Extend `EventCategory` in `event-type.ts` (add `'culture'`), update `ALL_CATEGORIES`.
- Extend `DOT` map in `event-type-filter.tsx` (add `culture: 'bg-emerald-400'`).
- Extend `categorizeEventType` (add `skill.*`, `norm.*`, `lore.*` prefix check — before the `'other'` fallthrough).
- Extend `tab-bar.tsx` with Culture navigation tab + update `tab-bar.test.tsx`.
- Update `event-type-filter.test.tsx` if it hardcodes category count.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.x + @testing-library/react |
| Config file | `dashboard/vitest.config.ts`, `grid/vitest.config.ts` (inferred — not found; uses `package.json` test script) |
| Quick run (dashboard) | `cd dashboard && npm test` |
| Quick run (grid) | `cd grid && npm test` |
| Full suite | `npm test` in both `grid/` and `dashboard/` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CULTURE-01 | Skill lineage SVG renders nodes and edges from response | unit | `cd dashboard && npm test -- skill-lineage` | ❌ Wave 3 |
| CULTURE-01 | Skill lineage endpoint returns correct shape | unit | `cd grid && npm test -- culture` | ❌ Wave 1 |
| CULTURE-01 | `skill.taught` solid edge, `skill.inferred` dashed | unit | `cd dashboard && npm test -- skill-lineage` | ❌ Wave 3 |
| CULTURE-02 | Norm timeline SVG renders per-norm row | unit | `cd dashboard && npm test -- norm-timeline` | ❌ Wave 3 |
| CULTURE-03 | Lore graph bipartite SVG renders Nous and lore nodes | unit | `cd dashboard && npm test -- lore-graph` | ❌ Wave 3 |
| CULTURE-01/02/03 | Empty state renders when nodes=[] | unit | each component test | ❌ Wave 3 |
| CULTURE-01 | `culture` EventCategory matches `skill.*`/`norm.*`/`lore.*` | unit | `cd dashboard && npm test -- event-type` | ✅ (extend existing) |
| D-21-02 | Tab bar shows Culture tab | unit | `cd dashboard && npm test -- tab-bar` | ✅ (extend existing) |
| D-9-08 | No banned graph libs in culture/ | script | `node scripts/check-relationship-graph-deps.mjs` | ✅ (extend existing) |

### Sampling Rate
- Per task: `cd dashboard && npm test` + `cd grid && npm test`
- Per wave merge: full suite + grep gate script
- Phase gate: all tests green + grep gate green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `dashboard/src/components/culture/skill-lineage-graph.tsx` — CULTURE-01
- [ ] `dashboard/src/components/culture/norm-timeline.tsx` — CULTURE-02
- [ ] `dashboard/src/components/culture/lore-graph.tsx` — CULTURE-03
- [ ] `dashboard/src/app/grid/culture/page.tsx` — D-21-01
- [ ] `dashboard/src/lib/api/culture.ts` — API wrappers for three endpoints
- [ ] `dashboard/src/lib/hooks/use-culture.ts` — SWR hooks
- [ ] `grid/src/api/routes/culture.ts` — lineage endpoint

---

## Security Domain

> `security_enforcement` not explicitly set to false — applying standard review.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Culture endpoint is H1 public read (no auth, like relationships/graph) |
| V3 Session Management | No | Read-only REST endpoint, no session state |
| V4 Access Control | Yes (light) | H1 public — no tier validation needed. No operator.inspected emission (consistent with relationships/graph which also doesn't emit) |
| V5 Input Validation | Yes | Lineage endpoint has no query params at MVP. If added later, validate with `Number.isInteger`. |
| V6 Cryptography | No | Server layout uses `node:crypto` sha256 only if deterministic node IDs are hashed; not required for hierarchical layout |

**Threat patterns for this phase:**

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Skill lineage endpoint exposes full audit chain metadata | Information Disclosure | Acceptable — only hashes and DIDs (no content), consistent with Phase 9 graph endpoint which is also H1 |
| Culture SVG injection (malicious label text) | Tampering | SVG `<text>` content is React-escaped; no `dangerouslySetInnerHTML` |
| Norm fingerprint treated as identifying | Information Disclosure | Fingerprints are 6-char hashes of normalized text — not reversible; no PII |

[VERIFIED: server.ts relationships graph route — no auth, no `operator.inspected` emission]

---

## Runtime State Inventory

> Phase 21 is a pure observation layer — no rename, no migration, no refactor. Explicitly skipping this section: no runtime state is created, modified, or renamed. The three new SVG components are read-only clients of existing data.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Grid endpoint | ✓ | (in use) | — |
| npm / next.js | Dashboard build | ✓ | (in use) | — |
| vitest | Tests | ✓ | `^2.0.0` (grid), inferred same (dashboard) | — |
| MySQL (norm_registry) | NormTimeline data | ✓ | (Phase 19 shipped) | EmptyState if no norms |
| MySQL (lore_commons) | LoreGraph data | ✓ | (Phase 20 shipped) | EmptyState if no lore |
| AuditChain (skill.taught/inferred) | SkillLineageGraph data | ✓ | (Phase 18 shipped) | EmptyState if no skill events |

[VERIFIED: Phase 18-20 all marked complete in STATE.md]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The TabBar will grow from 2 to 3 tabs using Next.js `router.push()` for the Culture navigation link (cross-route vs in-page). | Tab Bar Extension | If TabBar stays querystring-only, Culture needs a separate nav mechanism — inconsistent with D-21-02 |
| A2 | `broadcast-allowlist.ts` is 458 lines (current actual), making `ALLOWLIST_BASELINE_LINES = 379` stale in the grep gate script. | Grep Gate | If the baseline was updated in a prior phase wave (not visible in git), the baseline is actually correct and Wave 0 should not change it |
| A3 | LoreGraph dashed citation edges require querying `/api/v1/audit/trail?type=lore.cited` since the lore endpoint does not return per-citing-Nous edges. | Lore Citation Edges | If citation edges can be omitted (use citation_count as thickness only), no second endpoint needed |
| A4 | Skill lineage `skill.inferred` edges represent skill→skill propagation (one skill inferred from another's source event), not Nous→skill edges. | Skill Lineage Data Shape | If `skill.inferred` always has a Nous as source, the tree structure is different |

**If this table is empty:** n/a — 4 assumptions documented above requiring planner confirmation.

---

## Open Questions

1. **TabBar architecture evolution for cross-route navigation**
   - What we know: TabBar uses `router.replace('?tab=...')` for in-page switching. Governance/Relationships/Replay are separate routes with no TabBar links.
   - What's unclear: D-21-02 says "add Culture tab to tab-bar.tsx pointing to `/grid/culture`." Should the TabBar become a mixed navigation bar (some tabs = in-page, some = cross-route links), or should it evolve to use `<Link>` elements for all tabs?
   - Recommendation: Use `router.push('/grid/culture')` for the Culture tab in the existing `activate` callback pattern. Keep consistent with existing `router.replace` for firehose/economy. Tab-bar tests need updating.

2. **LoreGraph citation edges: second endpoint or citation_count only**
   - What we know: `/api/v1/grid/lore` has `citation_count` but not per-citation `{citing_did, content_hash}` pairs.
   - What's unclear: CULTURE-03 says "edges = `lore.cited` (dashed)" — this implies per-citation edges, not just weighted contributed edges.
   - Recommendation: Fetch `/api/v1/audit/trail?type=lore.cited` in `useLoreGraph` hook, combine with lore entry data. If audit trail is too large, scope with `limit` parameter.

3. **ALLOWLIST_BASELINE_LINES drift**
   - What we know: Script says 379, `wc -l` says 458 for current broadcast-allowlist.ts.
   - What's unclear: Whether a prior phase wave already updated this value inside the script (the git log shows Phase 18-20 completed, but the script's comment history only goes to Phase 16).
   - Recommendation: Wave 0 must run `node scripts/check-relationship-graph-deps.mjs` and fix any SC#5 Gate B failure before landing any other change.

---

## Sources

### Primary (HIGH confidence — verified by reading actual source files)

- `dashboard/src/app/grid/relationships/relationship-graph.tsx` — D-9-08 SVG pattern, VIEWPORT/NODE_RADIUS/EDGE_STROKE_WIDTH constants, warmth color map
- `dashboard/src/app/grid/relationships/page.tsx` — route page pattern for culture page
- `dashboard/src/lib/hooks/use-relationships.ts` — `useGraph()` SWR hook pattern (exact clone template)
- `dashboard/src/lib/stores/event-type.ts` — EventCategory type, ALL_CATEGORIES, categorizeEventType
- `dashboard/src/app/grid/components/event-type-filter.tsx` — DOT color map, toggle logic
- `dashboard/src/app/grid/components/tab-bar.tsx` — Tab type union, TABS array, activate logic, router.replace pattern
- `dashboard/src/app/grid/components/tab-bar.test.tsx` — hardcoded `toHaveLength(2)` assertion
- `dashboard/src/app/grid/governance/governance-dashboard.tsx` — multi-panel 'use client' pattern
- `dashboard/src/app/grid/governance/page.tsx` — server component shell pattern
- `dashboard/src/components/primitives/empty-state.tsx` — EmptyState component props + usage
- `dashboard/src/lib/api/relationships.ts` — GraphResponse type, fetchGraph pattern, GRID_ORIGIN()
- `grid/src/api/server.ts` — GridServices interface (norms/lore optional service pattern), inline route registration, norms route shape
- `grid/src/api/routes/lore.ts` — registerLoreRoutes pattern, LoreStorage.queryEntries
- `grid/src/api/operator/relationships.ts` — computeNodePosition (sha256-seeded), graph route H1, relationships service pattern
- `grid/src/audit/chain.ts` — AuditQuery interface (single eventType), all() method, query() method
- `grid/src/skills/appendSkillTaught.ts` — skill.taught payload shape locked
- `grid/src/audit/broadcast-allowlist.ts` — confirmed 43 events, lore.contributed/lore.cited at positions 42-43
- `scripts/check-relationship-graph-deps.mjs` — Gate A banned libs, Gate B line count baseline (379, stale)
- `.planning/phases/19-norm-crystallization/19-CONTEXT.md` — D-19-12 norms REST shape, evidence_tick_range confirmed
- `.planning/phases/20-lore-commons/20-CONTEXT.md` — D-20-11 lore REST shape, citation_count semantics
- `.planning/phases/21-culture-dashboard/21-CONTEXT.md` — all locked decisions
- `.planning/STATE.md` — payload shapes for skill.taught, skill.inferred, norm.candidate, norm.crystallized, lore.contributed, lore.cited

### Secondary (MEDIUM confidence)

- `grid/src/norms/` directory listing — confirms Phase 19 shipped (NormDetector.ts, appendNormCandidate.ts, appendNormCrystallized.ts, storage.ts present)
- `grid/src/skills/` directory listing — confirms Phase 18 shipped (appendSkillTaught.ts, appendSkillInferred.ts, appendSkillRejected.ts present)
- `dashboard/vitest.config.ts` — vitest 4.1 + jsdom + setupFiles, `@` alias resolves to `src/`

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in existing package.json files
- Architecture: HIGH — all patterns verified from exact file reads
- Pitfalls: HIGH — all verified from exact implementation code
- Data shapes: HIGH — lore/norms shapes verified from server.ts and route files; skill.taught shape from sole-producer file

**Research date:** 2026-05-17
**Valid until:** 2026-06-17 (stable domain — SVG/SWR/Fastify patterns change slowly)
