# Phase 21: Culture Dashboard — Pattern Map

**Mapped:** 2026-05-17
**Files analyzed:** 12 (7 new, 5 edited)
**Analogs found:** 12 / 12

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `dashboard/src/app/grid/culture/page.tsx` | route (server component) | request-response | `dashboard/src/app/grid/relationships/page.tsx` | exact |
| `dashboard/src/app/grid/culture/culture-dashboard.tsx` | component | request-response | `dashboard/src/app/grid/governance/governance-dashboard.tsx` | role-match |
| `dashboard/src/components/culture/skill-lineage-graph.tsx` | component | request-response | `dashboard/src/app/grid/relationships/relationship-graph.tsx` | exact |
| `dashboard/src/components/culture/norm-timeline.tsx` | component | request-response | `dashboard/src/app/grid/relationships/relationship-graph.tsx` | role-match |
| `dashboard/src/components/culture/lore-graph.tsx` | component | request-response | `dashboard/src/app/grid/relationships/relationship-graph.tsx` | exact |
| `dashboard/src/lib/api/culture.ts` | service (API wrapper) | request-response | `dashboard/src/lib/api/relationships.ts` | exact |
| `dashboard/src/lib/hooks/use-culture.ts` | hook | request-response | `dashboard/src/lib/hooks/use-relationships.ts` | exact |
| `grid/src/api/routes/culture.ts` | route (Fastify) | request-response | `grid/src/api/routes/lore.ts` | exact |
| `dashboard/src/lib/stores/event-type.ts` | store (edit) | transform | self (existing) | — |
| `dashboard/src/app/grid/components/event-type-filter.tsx` | component (edit) | transform | self (existing) | — |
| `dashboard/src/app/grid/components/tab-bar.tsx` | component (edit) | event-driven | self (existing) | — |
| `scripts/check-relationship-graph-deps.mjs` | utility / CI script (edit) | batch | self (existing) | — |

---

## Pattern Assignments

### `dashboard/src/app/grid/culture/page.tsx` (route, server component)

**Analog:** `dashboard/src/app/grid/relationships/page.tsx`

**Imports pattern** (lines 1–11):
```typescript
// dashboard/src/app/grid/relationships/page.tsx lines 1-11
import { RelationshipGraph } from './relationship-graph';

export const metadata = { title: 'Relationship Graph — Noēsis Grid' };

export default function RelationshipsPage(): React.ReactElement {
    return (
        <main className="bg-neutral-950 min-h-screen p-4">
```

**Core pattern** — metadata export + `<main>` shell + card wrapper (lines 13–30):
```tsx
// dashboard/src/app/grid/relationships/page.tsx lines 13-30
export const metadata = { title: 'Relationship Graph — Noēsis Grid' };

export default function RelationshipsPage(): React.ReactElement {
    return (
        <main className="bg-neutral-950 min-h-screen p-4">
            <h1 className="text-sm font-semibold text-neutral-100">
                Relationship Graph
            </h1>
            <p className="mt-1 text-xs text-neutral-400">
                Warmth and weight derived from dialogue and trade events. Read-only.
            </p>
            <div className="mt-4 rounded border border-neutral-800 bg-neutral-900 p-6">
                <RelationshipGraph />
            </div>
        </main>
    );
}
```

**Adaptation for culture/page.tsx:**
- No `headers()` call needed (no tier logic — Culture endpoint is H1 public read).
- Use `export default function CulturePage()` (sync, not async, unlike GovernancePage).
- Metadata: `{ title: 'Culture — Noēsis Grid' }`.
- Import `CultureDashboard` from `./culture-dashboard` and render inside card.
- Heading: `Culture`, subtext: `Skill lineage, norm adoption, and lore contribution. Read-only.`

---

### `dashboard/src/app/grid/culture/culture-dashboard.tsx` (component, 'use client')

**Analog:** `dashboard/src/app/grid/governance/governance-dashboard.tsx`

**Shell pattern** — 'use client' + imports + component export (lines 1–22):
```tsx
// dashboard/src/app/grid/governance/governance-dashboard.tsx lines 1-22
'use client';
import React from 'react';
// ... imports ...
export function GovernanceDashboard({ tier }: GovernanceDashboardProps) {
    const { proposals, isLoading, error } = useGovernanceProposals();
    if (isLoading) {
        return (
            <div role="status" className="text-xs text-neutral-400">
                Loading proposals…
            </div>
        );
    }
    if (error) {
        return (
            <div role="alert" className="text-xs text-rose-400">
                <span>Failed to load proposals: {error.message}</span>
            </div>
        );
    }
    // ... render panels ...
}
```

**Adaptation for culture-dashboard.tsx:**
- No props (no tier — culture is H1 only).
- Import the three hooks: `useSkillLineage`, `useNorms`, `useLoreGraph` from `@/lib/hooks/use-culture`.
- Import the three SVG components: `SkillLineageGraph`, `NormTimeline`, `LoreGraph`.
- Render three stacked `<section>` blocks with headings, each containing one SVG component.
- No shared loading state — per CONTEXT.md Claude's Discretion, each SVG component handles its own loading/error state internally.

**Multi-panel layout pattern** (from governance structure — one card, multiple sections):
```tsx
// Adapt from governance-dashboard.tsx structure:
<div className="space-y-8">
    <section>
        <h2 className="mb-2 text-xs font-semibold text-neutral-300">Skill Lineage</h2>
        <SkillLineageGraph />
    </section>
    <section>
        <h2 className="mb-2 text-xs font-semibold text-neutral-300">Norm Adoption</h2>
        <NormTimeline />
    </section>
    <section>
        <h2 className="mb-2 text-xs font-semibold text-neutral-300">Lore Contributions</h2>
        <LoreGraph />
    </section>
</div>
```

---

### `dashboard/src/components/culture/skill-lineage-graph.tsx` (component, SVG, D-9-08)

**Analog:** `dashboard/src/app/grid/relationships/relationship-graph.tsx` (exact clone base)

**Full file pattern** (lines 1–104):
```tsx
// dashboard/src/app/grid/relationships/relationship-graph.tsx lines 1-104
'use client';
// [file docblock — update for skill lineage]

import { useGraph } from '@/lib/hooks/use-relationships';

const WARMTH_COLOR: Record<...> = { ... } as const;  // OMIT for culture — use fixed colors

const VIEWPORT = { width: 1000, height: 1000 } as const;
const NODE_RADIUS = 6;
const EDGE_STROKE_WIDTH = 1.5;

export function RelationshipGraph(): React.ReactElement | null {
    const { data, error, isLoading } = useGraph();

    if (isLoading) {
        return <div role="status">Loading graph…</div>;
    }
    if (error) {
        return <div role="alert">Graph could not be loaded.</div>;
    }
    if (!data) return null;

    const nodePos = new Map(data.nodes.map((n) => [n.did, n]));

    return (
        <svg
            viewBox={`0 0 ${VIEWPORT.width} ${VIEWPORT.height}`}
            className="w-full h-auto max-w-[800px] mx-auto"
            role="img"
            aria-label={`Relationship graph showing ...`}
            data-testid="relationship-graph-svg"
        >
            <g className="edges">
                {data.edges.map((e, i) => {
                    const a = nodePos.get(e.source_did);
                    const b = nodePos.get(e.target_did);
                    if (!a || !b) return null;
                    return (
                        <line
                            key={i}
                            x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                            stroke={WARMTH_COLOR[e.warmth_bucket]}
                            strokeWidth={EDGE_STROKE_WIDTH}
                            strokeOpacity={0.7}
                        />
                    );
                })}
            </g>
            <g className="nodes">
                {data.nodes.map((n) => (
                    <circle key={n.did} cx={n.x} cy={n.y} r={NODE_RADIUS}
                        fill="#333" stroke="#0A0A0A" strokeWidth={1} />
                ))}
            </g>
        </svg>
    );
}
```

**Adaptation for SkillLineageGraph:**
- Import `useSkillLineage` from `@/lib/hooks/use-culture`.
- Node lookup key: `n.id` (not `n.did` — skill lineage nodes use `id` per D-21-03 shape).
- Edge endpoints: `e.source` / `e.target` (not `e.source_did` / `e.target_did`).
- Add `<title>` to each `<line>`: `<title>tick {e.tick}</title>`.
- `strokeDasharray` on edges: `e.type === 'inferred' ? '4 2' : undefined` (D-21-05).
- Fixed edge color `#9ca3af` (cold neutral — no warmth buckets for skill edges).
- Node fill by type: `n.type === 'nous' ? '#f59e0b' : '#4ade80'`.
- Add `<title>{n.id}</title>` inside each node `<g>` for hover (D-21-05).
- Add `<text>` label next to each node: `{n.label}` (6-char truncated — server provides).
- Wrap each node in `<g key={n.id}>` (not bare `<circle>`).
- Empty state: use `EmptyState` from `@/components/primitives/empty-state` when `data.nodes.length === 0`.
- `data-testid="skill-lineage-svg"`, `aria-label="Skill lineage tree showing how skills propagate between Nous"`.

**D-21-05 hover pattern** (from CONTEXT.md):
```tsx
<g key={n.id}>
    <circle cx={n.x} cy={n.y} r={NODE_RADIUS} fill={color} />
    <title>{n.id}</title>
    <text x={n.x + 8} y={n.y + 4} className="text-[10px] fill-neutral-400">
        {n.label}
    </text>
</g>
```

---

### `dashboard/src/components/culture/norm-timeline.tsx` (component, SVG, D-9-08)

**Analog:** `dashboard/src/app/grid/relationships/relationship-graph.tsx` (role-match — SVG shell pattern)

**Core SVG shell** (same VIEWPORT/role/aria pattern, lines 35–65 of relationship-graph.tsx):
```tsx
// Copy SVG shell from relationship-graph.tsx lines 59-66:
<svg
    viewBox={`0 0 ${VIEWPORT.width} ${VIEWPORT.height}`}
    className="w-full h-auto max-w-[800px] mx-auto"
    role="img"
    aria-label="Norm adoption timeline"
    data-testid="norm-timeline-svg"
>
```

**Adaptation for NormTimeline:**
- Import `useNorms` from `@/lib/hooks/use-culture`.
- Data shape: `{ norms: Array<{ norm_id, fingerprint, crystallized_tick, participant_count, convergence_type, evidence_tick_range: [first_seen_tick, crystallized_tick] }> }`.
- SVG layout: one horizontal row per norm. `ROW_HEIGHT = 40`, `ROW_OFFSET = 20`, `BAR_Y = (index * ROW_HEIGHT) + ROW_OFFSET`.
- X-axis: relative ticks (ticks since `norm.candidate`). `duration = evidence_tick_range[1] - evidence_tick_range[0]`. Map to `[MARGIN_LEFT, VIEWPORT.width - MARGIN_RIGHT]`.
- Render `<rect>` bar per norm (not `<circle>`/`<line>`).
- Labels: `<text>` with `fingerprint` (6-char) + `convergence_type` + `participant_count Nous`.
- `<title>` on each rect: full `norm_id` on hover.
- Empty state: `EmptyState` when `data.norms.length === 0`.
- VIEWPORT height: `Math.max(200, norms.length * ROW_HEIGHT + ROW_OFFSET * 2)` — dynamic, or fixed large enough for expected norm counts.

**No analog for timeline-specific rendering** — uses same raw SVG primitives (`<rect>`, `<text>`, `<title>`) as the relationship graph uses (`<circle>`, `<line>`, `<text>`). The D-9-08 constraint (no layout libs, no d3) applies equally.

---

### `dashboard/src/components/culture/lore-graph.tsx` (component, SVG, D-9-08)

**Analog:** `dashboard/src/app/grid/relationships/relationship-graph.tsx` (exact clone base — bipartite is same node+edge SVG pattern)

**Full SVG shell** — identical to `skill-lineage-graph.tsx` starting point.

**Adaptation for LoreGraph:**
- Import `useLoreGraph` from `@/lib/hooks/use-culture`.
- Data shape: `{ entries: Array<{ contributor_did, tick, content_hash, category_tag, citation_count }>, total }`.
- **Client-side bipartite layout** (server does NOT pre-compute positions for lore — the lore endpoint returns flat entries, not `{nodes, edges}` with `{x,y}`). Layout constants from CONTEXT.md:
  - `X_NOUS = 150`, `X_LORE = 850`
  - `Y = (index / count) * VIEWPORT.height` for each column
- Derive nodes from data: unique `contributor_did` values → nous nodes; each `content_hash` → lore node.
- Edges: one solid `<line>` per entry (contributor → lore node = `lore.contributed`).
- Citation edges: use `citation_count` as `strokeWidth` multiplier on contributed edges (per Research pitfall 4 resolution — use `citation_count` as thickness, not separate dashed edges, unless `/api/v1/audit/trail?type=lore.cited` is also fetched).
- Node fill: nous nodes `#f59e0b`, lore nodes `#818cf8` (indigo — distinct from skill `#4ade80`).
- `<title>` on each node: full `contributor_did` or `content_hash`.
- `<text>` label: `contributor_did` last DID segment for nous; first 6 chars of `content_hash` for lore.
- `data-testid="lore-graph-svg"`, `aria-label="Lore contribution graph showing Nous and lore entry nodes"`.
- Empty state: `EmptyState` when `entries.length === 0`.

**Key difference from skill-lineage-graph:** layout is computed **client-side** (bipartite columns have fixed x, evenly-distributed y — this is O(N) math, not force simulation, so D-9-08 still allows it). The skill lineage graph uses server `{x,y}`; the lore graph derives positions from the flat entries response.

---

### `dashboard/src/lib/api/culture.ts` (service, API wrapper)

**Analog:** `dashboard/src/lib/api/relationships.ts` (exact clone of `fetchGraph` pattern)

**GRID_ORIGIN pattern** (line 97):
```typescript
// dashboard/src/lib/api/relationships.ts line 97-98
const GRID_ORIGIN = (): string =>
    process.env.NEXT_PUBLIC_GRID_ORIGIN ?? '';
```

**fetchGraph pattern** (lines 203–223) — copy verbatim, adapt URL and response type:
```typescript
// dashboard/src/lib/api/relationships.ts lines 203-223
export async function fetchGraph(signal?: AbortSignal): Promise<GraphResponse> {
    let resp: Response;
    try {
        resp = await fetch(
            `${GRID_ORIGIN()}/api/v1/grid/relationships/graph`,
            { signal, headers: { accept: 'application/json' } },
        );
    } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') throw err;
        throw Object.assign(new Error('network'), { fetchError: { kind: 'network', status: 0 } });
    }
    if (!resp.ok) {
        let body: { error?: string } = {};
        try { body = (await resp.json()) as { error?: string }; } catch { /* ignore */ }
        // ... error mapping ...
    }
    return (await resp.json()) as GraphResponse;
}
```

**Adaptation for culture.ts:**
- Export three response types: `SkillLineageResponse`, `NormsResponse`, `LoreResponse`.
- Export three fetchers: `fetchSkillLineage()` → `GET /api/v1/grid/culture/skills/lineage`, `fetchNorms()` → `GET /api/v1/grid/norms`, `fetchLore()` → `GET /api/v1/grid/lore`.
- Re-export types from this module so hooks can import them.
- No error discriminated union needed (culture endpoints are H1 with no tier checking — simpler error handling than relationships.ts; a single `CultureFetchError = { kind: 'network'; status: 0 }` is sufficient).
- `GRID_ORIGIN` is the same environment variable — copy the constant as-is.

**SkillLineageResponse type** (from D-21-03):
```typescript
export interface SkillLineageResponse {
    nodes: Array<{ id: string; label: string; type: 'nous' | 'skill'; x: number; y: number }>;
    edges: Array<{ source: string; target: string; tick: number; type: 'taught' | 'inferred' }>;
}
```

---

### `dashboard/src/lib/hooks/use-culture.ts` (hook, SWR)

**Analog:** `dashboard/src/lib/hooks/use-relationships.ts` — `useGraph()` function (lines 80–89)

**useGraph pattern** (lines 80–89):
```typescript
// dashboard/src/lib/hooks/use-relationships.ts lines 37-38, 80-89
import useSWR from 'swr';
import { useTick } from '@/lib/stores/tick-store';
// ...
import type { SWRResponse } from 'swr';

const BATCH_WINDOW_TICKS = 100; // D-9-13 — NEVER change without phase decision.

export function useGraph(): SWRResponse<GraphResponse, Error> {
    const currentTick = useTick();
    const windowKey = Math.floor(currentTick / BATCH_WINDOW_TICKS);
    return useSWR(
        ['graph', windowKey],
        () => fetchGraph(),
        { revalidateOnFocus: false, dedupingInterval: 0 },
    );
}
```

**Adaptation for use-culture.ts:**
- Three hook functions: `useSkillLineage`, `useNorms`, `useLoreGraph`.
- Same `BATCH_WINDOW_TICKS = 100` constant (D-9-13 discipline applies — culture data is equally stable).
- SWR keys: `['skill-lineage', windowKey]`, `['norms', windowKey]`, `['lore-graph', windowKey]`.
- Fetchers: `fetchSkillLineage`, `fetchNorms`, `fetchLore` from `@/lib/api/culture`.
- Same SWR options: `{ revalidateOnFocus: false, dedupingInterval: 0 }`.
- Add `'use client'` directive (same as use-relationships.ts line 1).

---

### `grid/src/api/routes/culture.ts` (route, Fastify)

**Analog:** `grid/src/api/routes/lore.ts` (exact registration pattern)

**registerLoreRoutes pattern** (lines 15–47):
```typescript
// grid/src/api/routes/lore.ts lines 15-47
import type { FastifyInstance } from 'fastify';
import type { LoreStorage } from '../../lore/LoreStorage.js';

export async function registerLoreRoutes(
    fastify: FastifyInstance,
    storage: LoreStorage,
    gridName: string,
): Promise<void> {
    fastify.get<{ Querystring: LoreQuery }>('/api/v1/grid/lore', async (request, reply) => {
        // ... query params validation ...
        try {
            const entries = await storage.queryEntries(gridName, category, limit);
            return reply.code(200).send({ entries: [...], total: entries.length });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            request.log.error({ msg: 'lore_query_failed', err: msg });
            return reply.code(500).send({ error: 'lore query failed' });
        }
    });
}
```

**Alternate analog:** inline registration in `grid/src/api/server.ts` lines 364–381 (norms pattern — simpler for an endpoint with no storage class):
```typescript
// grid/src/api/server.ts lines 364-381
if (services.norms) {
    app.get('/api/v1/grid/norms', async (_req, reply) => {
        const rows = await services.norms!.loadNorms(services.gridName);
        reply.code(200);
        return {
            norms: rows.map((r) => ({
                norm_id: r.norm_id,
                fingerprint: r.fingerprint,
                crystallized_tick: r.crystallized_tick,
                participant_count: r.participant_count,
                convergence_type: r.convergence_type,
                evidence_tick_range: [r.first_seen_tick, r.crystallized_tick],
            })),
        };
    });
}
```

**Recommendation:** Use the `registerLoreRoutes`-style function in a separate `culture.ts` file for testability. The function signature:
```typescript
export async function registerCultureRoutes(
    fastify: FastifyInstance,
    audit: AuditChain,   // from GridServices — already required, no optional service needed
): Promise<void>
```

**Route implementation pattern** (audit.all() filter — from Research pitfall 2):
```typescript
// Per research: AuditChain.query() accepts single eventType. Use audit.all() + filter.
const entries = audit.all()
    .filter(e => e.eventType === 'skill.taught' || e.eventType === 'skill.inferred');
```

**server.ts registration** — add below the lore block (lines 383–396), following the `services.lore` pattern:
```typescript
// grid/src/api/server.ts — add after lore block
void app.register(async (instance) => {
    const { registerCultureRoutes } = await import('./routes/culture.js');
    await registerCultureRoutes(instance, services.audit);
});
```

No new `GridServices` field required — `audit` is already a required service (line 68 of server.ts).

---

## Edits to Existing Files

### `dashboard/src/lib/stores/event-type.ts` (EDIT)

**Source:** `dashboard/src/lib/stores/event-type.ts` (self)

**Current state** (lines 22, 32–38, 46–52):
```typescript
// line 22 — current type union:
export type EventCategory = 'trade' | 'message' | 'movement' | 'law' | 'lifecycle' | 'other';

// lines 32–38 — categorizeEventType:
export function categorizeEventType(eventType: string): EventCategory {
    if (eventType.startsWith('trade.')) return 'trade';
    if (MESSAGE_TYPES.has(eventType)) return 'message';
    if (eventType === 'nous.moved') return 'movement';
    if (eventType === 'law.triggered') return 'law';
    if (LIFECYCLE_TYPES.has(eventType)) return 'lifecycle';
    return 'other';
}

// lines 46–52 — ALL_CATEGORIES (6 entries, 'other' excluded):
export const ALL_CATEGORIES: readonly EventCategory[] = Object.freeze([
    'trade', 'message', 'movement', 'law', 'lifecycle',
] as const);
```

**Required edits** (D-21-04):
1. Extend type union: add `'culture'` before `'other'`.
2. Add predicate to `categorizeEventType` **before** the `return 'other'` fallthrough:
   ```typescript
   if (eventType.startsWith('skill.') || eventType.startsWith('norm.') || eventType.startsWith('lore.')) return 'culture';
   ```
3. Extend `ALL_CATEGORIES`: append `'culture'` (grows 5 → 6 visible categories; `'other'` remains excluded from the array).

---

### `dashboard/src/app/grid/components/event-type-filter.tsx` (EDIT)

**Source:** `dashboard/src/app/grid/components/event-type-filter.tsx` (self)

**Current DOT map** (lines 25–32):
```typescript
// lines 25-32
const DOT: Record<EventCategory, string> = {
    trade: 'bg-amber-400',
    message: 'bg-violet-400',
    movement: 'bg-blue-400',
    law: 'bg-pink-400',
    lifecycle: 'bg-neutral-400',
    other: 'bg-neutral-700',
};
```

**Required edit** (D-21-04): add one entry to the `DOT` record:
```typescript
culture: 'bg-emerald-400',
```

TypeScript will enforce this — the `Record<EventCategory, string>` type will produce a compile error if `'culture'` is added to `EventCategory` but not to `DOT`.

---

### `dashboard/src/app/grid/components/tab-bar.tsx` (EDIT)

**Source:** `dashboard/src/app/grid/components/tab-bar.tsx` (self)

**Current Tab type and TABS array** (lines 20–31):
```typescript
// lines 20-31
type Tab = 'firehose' | 'economy';

interface TabDef {
    readonly id: Tab;
    readonly label: string;
    readonly testId: string;
}

const TABS: readonly TabDef[] = [
    { id: 'firehose', label: 'Firehose + Map', testId: 'tab-firehose' },
    { id: 'economy', label: 'Economy', testId: 'tab-economy' },
];
```

**Current activate function** (lines 43–56):
```typescript
// lines 43-56
const activate = useCallback(
    (tab: Tab): void => {
        const params = new URLSearchParams(searchParams.toString());
        if (tab === 'economy') {
            params.set('tab', 'economy');
        } else {
            params.delete('tab');
        }
        router.replace(`?${params.toString()}`);
        refs.current.get(tab)?.focus();
    },
    [router, searchParams],
);
```

**Required edits** (D-21-02):
1. Add `'culture'` to the `Tab` union.
2. Add `TabDef` entry: `{ id: 'culture', label: 'Culture', testId: 'tab-culture' }`.
3. Extend `activate`: culture tab uses `router.push('/grid/culture')` (cross-route) rather than `router.replace('?...')` (in-page):
   ```typescript
   if (tab === 'culture') {
       router.push('/grid/culture');
       return;
   }
   ```
4. Update `resolveActive` to handle the culture case (when on `/grid/culture`, the tab bar may not be rendered, so this may be a no-op — but add `'culture'` to the union return type for completeness).

**tab-bar.test.tsx must also be updated** (line 34 hardcodes `toHaveLength(2)`):
```typescript
// tab-bar.test.tsx line 34 — MUST change:
expect(tabs).toHaveLength(2);  // → expect(tabs).toHaveLength(3);
// And add test for tab-culture existence:
expect(screen.getByTestId('tab-culture')).not.toBeNull();
```
The mock for `useRouter` must also expose `push: mockPush` alongside `replace: mockReplace`.

---

### `scripts/check-relationship-graph-deps.mjs` (EDIT)

**Source:** `scripts/check-relationship-graph-deps.mjs` (self)

**Current Gate B baseline** (lines 43–54):
```javascript
// lines 43-54 — stale baseline (actual file is 458 lines per Research pitfall 3):
const ALLOWLIST_BASELINE_LINES = 379;
```

**Current Gate A scan targets** (lines 38–41):
```javascript
const TARGETS = [
    resolve(repoRoot, 'dashboard/package.json'),
    resolve(repoRoot, 'grid/package.json'),
];
```

**Required edits** (T-21-02):
1. Update `ALLOWLIST_BASELINE_LINES` from `379` to the verified actual line count (Research says 458 — **verify with `wc -l` before committing**; Wave 0 task).
2. Add Gate C: scan `dashboard/src/components/culture/**/*.tsx` for banned imports. Mirror Gate A logic (parse file contents, grep for banned lib names):
   ```javascript
   // Gate C — D-9-08 enforcement for culture/ directory
   import { readdirSync, statSync } from 'node:fs';

   function findTsxFiles(dir) {
       // recursive glob over dashboard/src/components/culture/
   }

   const CULTURE_DIR = resolve(repoRoot, 'dashboard/src/components/culture');
   // for each .tsx file: check for BANNED lib imports
   ```

---

## Shared Patterns

### D-9-08 Raw SVG Constraint
**Source:** `dashboard/src/app/grid/relationships/relationship-graph.tsx` (entire file)
**Apply to:** `skill-lineage-graph.tsx`, `norm-timeline.tsx`, `lore-graph.tsx`

Key invariants shared by all three culture SVG files:
- `'use client'` directive at line 1.
- Constants block: `VIEWPORT`, `NODE_RADIUS`, `EDGE_STROKE_WIDTH` (copy verbatim, adjust values if needed for domain).
- SVG root: `viewBox`, `className="w-full h-auto max-w-[800px] mx-auto"`, `role="img"`, `aria-label`, `data-testid`.
- Loading state: `<div role="status">Loading …</div>`.
- Error state: `<div role="alert">… could not be loaded.</div>`.
- Empty state: `<EmptyState title="No data yet" />` from `@/components/primitives/empty-state`.
- Edges rendered before nodes (edges `<g>` first, nodes `<g>` second).
- Keyed elements: `key={i}` for edges (index), `key={n.id}` for nodes.
- `<title>` for hover on both nodes and edges.
- No `dangerouslySetInnerHTML`, no d3 import, no external layout library.

### SWR Hook Pattern
**Source:** `dashboard/src/lib/hooks/use-relationships.ts` lines 80–89 (`useGraph`)
**Apply to:** `useSkillLineage`, `useNorms`, `useLoreGraph` in `use-culture.ts`

```typescript
// Exact pattern to replicate per hook:
const BATCH_WINDOW_TICKS = 100;  // D-9-13 — one const for the whole file

export function useSkillLineage(): SWRResponse<SkillLineageResponse, Error> {
    const currentTick = useTick();
    const windowKey = Math.floor(currentTick / BATCH_WINDOW_TICKS);
    return useSWR(
        ['skill-lineage', windowKey],
        () => fetchSkillLineage(),
        { revalidateOnFocus: false, dedupingInterval: 0 },
    );
}
```

### API Fetcher Pattern
**Source:** `dashboard/src/lib/api/relationships.ts` lines 97–98, 203–223 (`GRID_ORIGIN`, `fetchGraph`)
**Apply to:** All three fetchers in `culture.ts`

```typescript
// Copy GRID_ORIGIN exactly:
const GRID_ORIGIN = (): string =>
    process.env.NEXT_PUBLIC_GRID_ORIGIN ?? '';

// fetchGraph structure (lines 203-223) is the template for all three fetchers.
// Only change: URL path and return type.
```

### Fastify Route Registration
**Source:** `grid/src/api/server.ts` lines 364–381 (norms inline pattern) and `grid/src/api/routes/lore.ts` (plugin function pattern)
**Apply to:** `grid/src/api/routes/culture.ts`

Norms inline pattern (simpler, no storage class):
```typescript
// server.ts lines 364-381 — template for inline registration
app.get('/api/v1/grid/norms', async (_req, reply) => {
    const rows = await services.norms!.loadNorms(services.gridName);
    reply.code(200);
    return { norms: rows.map((r) => ({ ... })) };
});
```

`audit.all()` filter pattern (Research pitfall 2 — single-pass approach):
```typescript
// services.audit is always available (required field in GridServices)
const entries = services.audit.all()
    .filter(e => e.eventType === 'skill.taught' || e.eventType === 'skill.inferred');
```

### EmptyState Usage
**Source:** `dashboard/src/components/primitives/empty-state.tsx` (lines 17–31)
**Apply to:** All three SVG components when their data arrays are empty

```tsx
// Props interface:
// title: string (required)
// description?: string (optional subtext)
// testId?: string (data-testid)

// Usage pattern:
if (data.nodes.length === 0) {
    return <EmptyState title="No skill lineage yet" testId="skill-lineage-empty" />;
}
```

### Page Shell Pattern (Server Component)
**Source:** `dashboard/src/app/grid/relationships/page.tsx` (lines 13–61)
**Apply to:** `dashboard/src/app/grid/culture/page.tsx`

```tsx
// Key elements: metadata export + default function + <main> + h1 + p + card div
export const metadata = { title: '… — Noēsis Grid' };
export default function XPage(): React.ReactElement {
    return (
        <main className="bg-neutral-950 min-h-screen p-4">
            <h1 className="text-sm font-semibold text-neutral-100">…</h1>
            <p className="mt-1 text-xs text-neutral-400">… Read-only.</p>
            <div className="mt-4 rounded border border-neutral-800 bg-neutral-900 p-6">
                <XDashboard />
            </div>
        </main>
    );
}
```

---

## No Analog Found

All files have close codebase analogs. No files require falling back to RESEARCH.md patterns alone.

| File | Notes |
|------|-------|
| `norm-timeline.tsx` — `<rect>` bar rendering | Role-match only (relationship-graph uses `<circle>` not `<rect>`). The SVG shell is identical; only the element type differs. No external analog needed — `<rect>` is a standard SVG primitive. |
| `lore-graph.tsx` — client-side bipartite layout | The lore endpoint returns flat entries (not `{nodes, edges}` with `{x,y}`). Client computes two-column `{x,y}` positions from column constants. This is O(N) arithmetic, not a force simulation — D-9-08 allows it. No analog needed beyond the column constants in CONTEXT.md specifics. |

---

## Metadata

**Analog search scope:** `dashboard/src/`, `grid/src/api/`, `scripts/`
**Files read:** 17 source files
**Pattern extraction date:** 2026-05-17
