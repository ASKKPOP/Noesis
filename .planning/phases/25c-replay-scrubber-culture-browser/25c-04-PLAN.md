---
phase: 25c
plan: 04
type: execute
wave: 4
depends_on: [25c-03]
files_modified:
  - steward/src/app/culture/page.tsx
  - steward/src/app/culture/nous-filter-bar.tsx
  - steward/src/app/culture/norm-timeline.tsx
  - steward/src/app/culture/lore-graph.tsx
  - steward/src/app/culture/skill-lineage.tsx
autonomous: true
requirements: [D-08, D-09, D-10, D-11]

must_haves:
  truths:
    - "Navigating to /culture renders three SVG panels: Skill Lineage, Norm Timeline, Lore Graph"
    - "All three SVGs use raw <svg><line><circle><rect><text> — zero charting library imports"
    - "Nous DID filter bar at top of /culture; URL param ?nous=<did> controls filter"
    - "Skill Lineage filters incident edges/nodes by DID; Norm Timeline shows all (Grid-wide note); Lore Graph filters by contributor_did"
    - "Culture data fetched directly from NEXT_PUBLIC_GRID_ORIGIN (not via /api/operator proxy)"
    - "No new audit events or Grid mutations from culture surface"
  artifacts:
    - path: "steward/src/app/culture/page.tsx"
      provides: "Culture page fetching skill/norm/lore data from Grid"
      contains: "NEXT_PUBLIC_GRID_ORIGIN"
    - path: "steward/src/app/culture/nous-filter-bar.tsx"
      provides: "URL-param Nous DID filter bar"
      contains: "useSearchParams"
    - path: "steward/src/app/culture/norm-timeline.tsx"
      provides: "Norm timeline SVG (raw SVG, no charting libs)"
      contains: "<svg"
    - path: "steward/src/app/culture/lore-graph.tsx"
      provides: "Lore graph SVG (raw SVG, no charting libs)"
      contains: "<svg"
    - path: "steward/src/app/culture/skill-lineage.tsx"
      provides: "Skill lineage tree SVG (raw SVG, server-computed positions)"
      contains: "<svg"
  key_links:
    - from: "steward/src/app/culture/page.tsx"
      to: "NEXT_PUBLIC_GRID_ORIGIN/api/v1/grid/culture/skills/lineage"
      via: "direct fetch (not proxied)"
      pattern: "grid/culture/skills/lineage"
    - from: "steward/src/app/culture/nous-filter-bar.tsx"
      to: "steward/src/app/culture/page.tsx"
      via: "URL param ?nous= read by page via useSearchParams"
      pattern: "useSearchParams"
---

<objective>
Build the Steward-native /culture page: three raw-SVG culture visualizations (Skill Lineage,
Norm Timeline, Lore Graph) with a per-Nous DID filter bar. All components are Steward-native
(no copy-paste from dashboard/src/components/culture/). Data fetched directly from Grid.
D-9-08 raw-SVG invariant enforced: zero charting library imports.

Purpose: Operators can observe emergent cultural patterns (skill teaching lineage, norm
crystallization, lore contributions) from the Steward Console with per-Nous filtering.
Output: Five new files. Manual verification at localhost:3002/culture.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/25c-replay-scrubber-culture-browser/25c-CONTEXT.md
@.planning/phases/25c-replay-scrubber-culture-browser/25c-RESEARCH.md
@.planning/phases/25c-replay-scrubber-culture-browser/25c-PATTERNS.md
@.planning/phases/25c-replay-scrubber-culture-browser/25c-UI-SPEC.md
@.planning/phases/25c-replay-scrubber-culture-browser/25c-03-SUMMARY.md

<interfaces>
<!-- Key data contracts extracted from Grid source files -->

From grid/src/api/routes/culture.ts (SkillLineageResponse shape — server computes {x,y}):
```typescript
// GET /api/v1/grid/culture/skills/lineage
// Response: { nodes: LineageNode[], edges: LineageEdge[] }
interface LineageNode {
    id: string;       // DID for Nous nodes, hash for skill nodes
    label: string;    // short display name
    type: 'nous' | 'skill';
    x: number;       // server-computed BFS position
    y: number;       // server-computed BFS position
}
interface LineageEdge {
    source: string;  // id of source node
    target: string;  // id of target node
    tick: number;
    type: 'taught' | 'inferred';
}
```

From grid/src/api/routes/lore.ts (LoreEntry shape — NO {x,y} returned by Grid):
```typescript
// GET /api/v1/grid/lore
// Response: { entries: LoreEntryRow[], total: number }
// LoreEntryRow does NOT have x,y — positions must be computed client-side
interface LoreEntryRow {
    contributor_did: string;
    tick: number;
    content_hash: string;
    category_tag: string;
    citation_count: number;
}
// GET /api/v1/audit/trail?type=lore.cited
// Response: { entries: AuditEntry[] }
// Each entry.payload: { citing_did: string, content_hash: string, tick: number }
```

From grid/src/api/server.ts (norms endpoint):
```typescript
// GET /api/v1/grid/norms
// Response: { norms: NormRecord[] }
// NormRecord shape (from grid/src/norms/types.ts or server):
interface NormRecord {
    norm_id: string;
    fingerprint: string;       // 6-char hex
    crystallized_tick: number;
    participating_count: number;
    convergence_type: 'emergent' | 'coincidental';
    evidence_tick_range: [number, number];
}
```

Design tokens from 25a-UI-SPEC (carried into 25c):
```
--ink          (dark brown text)
--parchment    (dominant bg)
--vellum       (secondary bg, card body)
--terracotta   (#b8542f, accent)
--rule         (border color)
--muted        (#8a8479, muted text)
--serif        (heading font)
--mono         (monospace font)
```

Color palette for SVGs (all from 25a event-family table + tokens):
```typescript
const NOUS_COLOR    = '#3a7a5a';  // sage — nous family
const SKILL_COLOR   = '#7a6a2e';  // amber — skill family
const NORM_EMERGENT = '#5a5a6a';  // norm family slate
const NORM_COIN     = '#8a8479';  // --muted
const LORE_COLORS: Record<string, string> = {
    myth:      '#6a4a7a',  // lore family mauve
    history:   '#5a5a6a',  // norm family slate
    ritual:    '#b8542f',  // --terracotta
    principle: '#8a6a2e',  // --bronze
};
const LORE_FALLBACK = '#8a8479';  // --muted
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create culture page + NousFilterBar component (D-08, D-09, D-11)</name>
  <files>steward/src/app/culture/page.tsx, steward/src/app/culture/nous-filter-bar.tsx</files>
  <read_first>
    - steward/src/app/users/page.tsx (client component pattern with useEffect multi-fetch)
    - steward/src/components/StewardShell.tsx (StewardShell props: title, breadcrumb)
    - dashboard/src/lib/api/culture.ts (data type shapes — read for type reference only, NOT to copy fetch functions)
  </read_first>
  <action>
FILE 1 — steward/src/app/culture/page.tsx:
Client component ('use client') following users/page.tsx pattern. Key implementation points:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import StewardShell from '@/components/StewardShell';
import { NousFilterBar } from './nous-filter-bar';
import { SkillLineage } from './skill-lineage';
import { NormTimeline } from './norm-timeline';
import { LoreGraph } from './lore-graph';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';
const DID_REGEX = /^did:noesis:[a-z0-9_\-]+$/i;
```

State: skillData, normsData, loreData, citationsData (each typed), loading, error.

NOTE on D-09: D-09 as stated ('Steward routes all Grid calls through the existing operator proxy') is unimplementable for culture endpoints. The Steward operator proxy maps to /api/v1/operator/... on Grid; culture endpoints at /api/v1/grid/... and /api/v1/audit/... cannot be routed through it (they are different path prefixes that the proxy does not rewrite). Direct fetch from NEXT_PUBLIC_GRID_ORIGIN is the technically correct approach per RESEARCH.md Pitfall 3. This is a forced deviation, not a scope reduction — the proxy is architecturally incapable of routing these paths.

Fetch via Promise.allSettled from GRID_ORIGIN directly (per RESEARCH Pitfall 3 — culture routes are NOT operator-gated):
```typescript
const [skillRes, normsRes, loreRes, citationsRes] = await Promise.allSettled([
    fetch(`${GRID_ORIGIN}/api/v1/grid/culture/skills/lineage`),
    fetch(`${GRID_ORIGIN}/api/v1/grid/norms`),
    fetch(`${GRID_ORIGIN}/api/v1/grid/lore?limit=100`),
    fetch(`${GRID_ORIGIN}/api/v1/audit/trail?type=lore.cited&limit=200`),
]);
```

Read ?nous search param:
```typescript
const searchParams = useSearchParams();
const nousParam = searchParams.get('nous') ?? '';
const activeFilter = DID_REGEX.test(nousParam) ? nousParam : null;
```

StewardShell props: title="Culture" breadcrumb="Steward · Observatory · Culture"

Page h1: "Culture" (20px serif --ink), sub-label: "Emergent skill, norm, and lore patterns. Filter by Nous." (11px mono --muted)

Render NousFilterBar at top, then three culture card components stacked vertically (gap 24px):
- SkillLineage nodes={skillData?.nodes ?? []} edges={skillData?.edges ?? []} filter={activeFilter}
- NormTimeline norms={normsData?.norms ?? []}
- LoreGraph entries={loreData?.entries ?? []} citations={citationsData?.entries ?? []} filter={activeFilter}

---

FILE 2 — steward/src/app/culture/nous-filter-bar.tsx:
Client component. URL-param based filter per PATTERNS.md §NousFilterBar:

```tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

const DID_REGEX = /^did:noesis:[a-z0-9_\-]+$/i;

export function NousFilterBar() { ... }
```

Full implementation per PATTERNS.md §NousFilterBar pattern (copy the full component code from PATTERNS.md section — it is complete and correct):
- Input width 320px, height 32px, background var(--parchment), border 1px solid var(--rule)
- 300ms debounce on router.replace
- Active filter pill with terracotta styling and × clear button
- aria-label="Filter by Nous DID"
- Sticky container: background var(--vellum), borderBottom 1px var(--rule), padding 12px 24px
  </action>
  <verify>
    <automated>grep -n "useSearchParams\|NEXT_PUBLIC_GRID_ORIGIN\|api/v1/grid/culture\|NousFilterBar\|SkillLineage\|NormTimeline\|LoreGraph" /Users/desirey/Programming/src/Noesis/steward/src/app/culture/page.tsx 2>/dev/null</automated>
  </verify>
  <acceptance_criteria>
    - `grep "useSearchParams" steward/src/app/culture/page.tsx` → 1 match
    - `grep "api/v1/grid/culture" steward/src/app/culture/page.tsx` → 1 match (direct Grid fetch)
    - `grep "/api/operator" steward/src/app/culture/page.tsx` → 0 matches (NOT proxied per D-09 + RESEARCH Pitfall 3)
    - `grep "Filter by Nous DID" steward/src/app/culture/nous-filter-bar.tsx` → 1 match (aria-label)
    - `grep "useSearchParams\|useRouter" steward/src/app/culture/nous-filter-bar.tsx` → matches
    - `grep "router.replace" steward/src/app/culture/nous-filter-bar.tsx` → 1 match
    - `grep "Clear filter" steward/src/app/culture/nous-filter-bar.tsx` → 1 match (aria-label on × button)
  </acceptance_criteria>
  <done>Culture page with multi-fetch and NousFilterBar with URL-param filter created.</done>
</task>

<task type="auto">
  <name>Task 2: Create three Steward-native SVG culture components (D-08, D-10)</name>
  <files>steward/src/app/culture/skill-lineage.tsx, steward/src/app/culture/norm-timeline.tsx, steward/src/app/culture/lore-graph.tsx</files>
  <read_first>
    - dashboard/src/lib/api/culture.ts (type definitions ONLY — SkillLineageResponse, NormsResponse, LoreEntriesResponse; do NOT copy fetch functions)
    - steward/src/app/nous/[id]/page.tsx (steward-card pattern, eyebrow pattern, count badge)
    - .planning/phases/25c-replay-scrubber-culture-browser/25c-UI-SPEC.md §Cards 1-3 (full SVG spec — primary specification)
  </read_first>
  <action>
Write THREE new Steward-native SVG components. Do NOT import from dashboard/src/. Use the data type interfaces defined locally (copy only the interface shapes, not function implementations).

IMPORTANT: LoreEntry does NOT have {x, y} fields from the Grid API (verified from grid/src/api/routes/lore.ts). Lore graph positions must be computed client-side using a deterministic scatter based on content_hash. Use this function:
```typescript
function deterministicPosition(hash: string, width = 760, height = 420): { x: number; y: number } {
    // Use first 8 hex chars as two 4-char groups for x, y seed
    const xSeed = parseInt(hash.slice(0, 4), 16) / 0xffff;
    const ySeed = parseInt(hash.slice(4, 8), 16) / 0xffff;
    return {
        x: 20 + xSeed * (width - 40),
        y: 20 + ySeed * (height - 40),
    };
}
```
This is deterministic (same hash → same position), simple, and does not require any external library.

---

FILE 1 — steward/src/app/culture/skill-lineage.tsx:
Per 25c-UI-SPEC §Card 1 and PATTERNS.md §skill-lineage.tsx. Implementation:

```tsx
'use client';

interface LineageNode { id: string; label: string; type: 'nous' | 'skill'; x: number; y: number; }
interface LineageEdge { source: string; target: string; tick: number; type: 'taught' | 'inferred'; }
interface Props { nodes: LineageNode[]; edges: LineageEdge[]; filter: string | null; }

const NOUS_COLOR    = '#3a7a5a';
const SKILL_COLOR   = '#7a6a2e';
const TAUGHT_STROKE = '#3a7a5a';
const INF_STROKE    = '#7a6a2e';

export function SkillLineage({ nodes, edges, filter }: Props) { ... }
```

SVG rendering per UI-SPEC §Card 1 (full spec):
- viewBox: `0 0 ${Math.max(...nodes.map(n=>n.x),400)+40} ${Math.max(...nodes.map(n=>n.y),300)+40}`
- Edges first (render under nodes)
- Nous nodes: circle r=8, fill NOUS_COLOR; Skill nodes: rect 12×12 centered, fill SKILL_COLOR
- Node labels: 10px mono --ink, x+12 y+4, truncate to 16 chars
- Filter: incident edges (source===filter||target===filter) → opacity 0.9; non-incident → 0.25
- Filtered node: opacity 1.0 + stroke var(--terracotta) strokeWidth 2; non-incident nodes: opacity 0.3
- role="img" aria-label={`Skill lineage visualization. ${nodes.length} nodes.`}
- background var(--parchment) on svg

Steward-card wrapper with header (eyebrow "Culture", title "Skill Lineage", count badge "{nodes.length} nodes") and footer legend: [● Nous] [■ Skill] [— Taught] [- - Inferred].
Empty state: "No skill lineage recorded yet." 12px mono --muted, centered.
Filter filtered-out state: if filter && !nodes.some(n=>n.id===filter): show "Selected Nous has no skills in lineage." below SVG.

---

FILE 2 — steward/src/app/culture/norm-timeline.tsx:
Per 25c-UI-SPEC §Card 2 and PATTERNS.md §norm-timeline.tsx. Implementation:

```tsx
'use client';

interface NormRecord {
    norm_id: string;
    fingerprint: string;
    crystallized_tick: number;
    participating_count: number;
    convergence_type: 'emergent' | 'coincidental';
    evidence_tick_range: [number, number];
}
interface Props { norms: NormRecord[]; }

const NORM_COLORS: Record<string, string> = {
    emergent: '#5a5a6a',
    coincidental: '#8a8479',
};

function scaleX(tick: number, minTick: number, maxTick: number): number {
    if (maxTick === minTick) return 80;
    return 80 + ((tick - minTick) / (maxTick - minTick)) * (720 - 80);
}

export function NormTimeline({ norms }: Props) { ... }
```

SVG per UI-SPEC §Card 2:
- viewBox: `0 0 800 ${norms.length * 32 + 60}`
- X-axis line from x=80 y=20 to x=800 y=20
- Tick marks every 100 ticks: text at top, 9px mono --muted
- For each norm (i): transform `translate(0, ${i * 32 + 40})`
  - Fingerprint label: text x=72 y=14 10px mono --ink textAnchor end
  - Evidence range rect: lighter opacity (0.25) fill normColor, y=4 height=16 rx=3
  - Crystallization circle: cx=scaleX(crystallized_tick) cy=14 r=5 fill normColor stroke --ink
  - Participant count: text x=cx+12 y=18 9px mono --muted "N={participating_count}"
- role="img" aria-label={`Norm timeline visualization. ${norms.length} norms.`}
- background var(--parchment)

Card wrapper: steward-card, header (eyebrow "Culture", title "Norm Timeline", count badge), body (SVG), footer legend.
Note under title when filter is active: "Norms are Grid-wide; per-Nous filter does not apply." 11px mono --muted. NormTimeline receives no filter prop (norms are always shown unfiltered).
Empty state: "No crystallized norms yet." 12px mono --muted, centered.

---

FILE 3 — steward/src/app/culture/lore-graph.tsx:
Per 25c-UI-SPEC §Card 3 and PATTERNS.md §lore-graph.tsx.

IMPORTANT: Grid lore API does NOT return {x,y}. Use deterministicPosition(entry.content_hash) to compute positions. All positions computed client-side from content_hash — deterministic, no external layout library.

```tsx
'use client';

interface LoreEntry {
    contributor_did: string;
    tick: number;
    content_hash: string;
    category_tag: string;
    citation_count: number;
}
interface LoreCitationPayload { citing_did: string; content_hash: string; tick: number; }
interface LoreCitationEntry { id: number; payload: LoreCitationPayload; }
interface Props { entries: LoreEntry[]; citations: LoreCitationEntry[]; filter: string | null; }

const LORE_COLORS: Record<string, string> = {
    myth:      '#6a4a7a',
    history:   '#5a5a6a',
    ritual:    '#b8542f',
    principle: '#8a6a2e',
};
const LORE_FALLBACK = '#8a8479';
function categoryColor(tag: string): string { return LORE_COLORS[tag] ?? LORE_FALLBACK; }

function deterministicPosition(hash: string, width = 760, height = 420): { x: number; y: number } {
    const xSeed = parseInt(hash.slice(0, 4), 16) / 0xffff;
    const ySeed = parseInt(hash.slice(4, 8), 16) / 0xffff;
    return { x: 20 + xSeed * (width - 40), y: 20 + ySeed * (height - 40) };
}

export function LoreGraph({ entries, citations, filter }: Props) { ... }
```

SVG per UI-SPEC §Card 3:
- viewBox: "0 0 800 480", background var(--parchment)
- Compute positions: const posMap = new Map(entries.map(e => [e.content_hash, deterministicPosition(e.content_hash)]))
- Citation edges (lines first): for each citation, look up src pos (posMap.get(payload.content_hash)) and tgt... WAIT — citation is lore.cited: {citing_did, content_hash} — the edge is from citing_did's lore entries to cited content_hash. Use: find src = entry with content_hash === payload.content_hash (that's the cited entry). The citing entity is a Nous DID, not a lore entry — there's no direct node for the citing DID. Skip edge rendering or render only if both src and tgt are lore entries. Simplify: citation edges connect the cited content_hash to citing_did (which may not have a node position). In practice, render citation count labels instead of edges since the citing entity is a DID, not a lore entry node. If entries exist for the citing DID (contributor_did === citation.citing_did), draw a line. Otherwise skip the edge.
- Entry nodes: circles cx={pos.x} cy={pos.y} r=6, fill=categoryColor, stroke var(--ink) strokeWidth 0.75
- Filter: isFiltered = !filter || entry.contributor_did === filter
  - Filtered: opacity 1.0 + stroke var(--terracotta) strokeWidth 2
  - Non-filtered: opacity 0.3
- Citation count labels: for entries with citation_count >= 3: text x+12 y+4 9px mono --muted "×{citation_count}"
- role="img" aria-label={`Lore graph visualization. ${entries.length} entries.`}

Card wrapper: steward-card, header (eyebrow "Culture", title "Lore Graph", count badge), body (SVG), footer legend.
Filter empty state: if filter && !entries.some(e=>e.contributor_did===filter): "No lore contributions from this Nous." 12px mono --muted, centered.
Global empty state: "No lore contributions yet." 12px mono --muted, centered.

CRITICAL RAW-SVG INVARIANT (D-10): All three files MUST use only: `<svg>`, `<line>`, `<circle>`, `<rect>`, `<text>`, `<g>`. Zero imports from d3, recharts, react-flow, cytoscape, @visx, @nivo, victory, or any charting package. This is an absolute invariant from D-9-08.
  </action>
  <verify>
    <automated>grep -rn "import.*d3\|import.*recharts\|import.*react-flow\|import.*cytoscape\|from 'd3\|from 'recharts\|from 'react-flow\|from 'cytoscape" /Users/desirey/Programming/src/Noesis/steward/src/app/culture/ 2>/dev/null</automated>
  </verify>
  <acceptance_criteria>
    - `grep -rn "import.*d3\|import.*recharts\|import.*react-flow\|import.*cytoscape" steward/src/app/culture/` → 0 matches (D-10 invariant)
    - `grep "<svg" steward/src/app/culture/skill-lineage.tsx` → 1 match
    - `grep "<svg" steward/src/app/culture/norm-timeline.tsx` → 1 match
    - `grep "<svg" steward/src/app/culture/lore-graph.tsx` → 1 match
    - `grep 'role="img"' steward/src/app/culture/skill-lineage.tsx steward/src/app/culture/norm-timeline.tsx steward/src/app/culture/lore-graph.tsx` → 3 matches (one per file)
    - `grep "deterministicPosition" steward/src/app/culture/lore-graph.tsx` → 1 match (client-side layout for lore)
    - `grep "api/v1/grid/culture/skills/lineage" steward/src/app/culture/page.tsx` → 1 match
    - `grep "api/v1/grid/norms" steward/src/app/culture/page.tsx` → 1 match
    - `grep "api/v1/grid/lore" steward/src/app/culture/page.tsx` → 1 match
    - `grep -rn "audit\.append\|audit\.emit" steward/src/app/culture/` → 0 matches (allowlist delta 0)
    - `grep "Skill Lineage" steward/src/app/culture/skill-lineage.tsx` → 1 match (card title)
    - `grep "Norm Timeline" steward/src/app/culture/norm-timeline.tsx` → 1 match (card title)
    - `grep "Lore Graph" steward/src/app/culture/lore-graph.tsx` → 1 match (card title)
    - `grep "No skill lineage recorded yet" steward/src/app/culture/skill-lineage.tsx` → 1 match (empty state)
    - `grep "Norms are Grid-wide" steward/src/app/culture/norm-timeline.tsx` → 1 match
  </acceptance_criteria>
  <done>Three Steward-native SVG culture components created. No charting libraries. Lore uses deterministic client-side positions. All raw-SVG invariant requirements met.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → Steward /culture page | Client fetches public Grid culture endpoints; no auth required |
| URL param ?nous= | User-controlled input, validated against DID regex before use as filter |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-25c-04-01 | Information Disclosure | culture SVG rendering | accept | Culture data (skill lineage, norms, lore) is already public via Grid API; SVG rendering reveals no additional information beyond what the API exposes |
| T-25c-04-02 | Tampering | observer-only culture surface | accept | No writes to Grid from culture surface; zero audit.append calls; read-only fetch |
| T-25c-04-03 | Elevation of Privilege | URL param filter | mitigate | nousParam validated against `/^did:noesis:[a-z0-9_\-]+$/i` before use; invalid input renders unfiltered view, not error |
| T-25c-04-04 | Information Disclosure | lore contributor_did in SVG | accept | contributor_did is already present in the public /api/v1/grid/lore response; SVG renders the same data |
| T-25c-04-05 | Repudiation | D-9-08 raw-SVG invariant | accept | No charting library = no bundled remote font loading or external requests from SVG elements; CI grep gate confirms invariant |
</threat_model>

<verification>
- `grep -rn "import.*d3\|import.*recharts\|import.*react-flow\|import.*cytoscape" steward/src/app/culture/` → 0 matches
- `grep -rn "audit\.append" steward/src/app/culture/` → 0 matches
- `grep "useSearchParams" steward/src/app/culture/page.tsx` → 1 match
- `grep "deterministicPosition" steward/src/app/culture/lore-graph.tsx` → 1 match
- Manual: navigate to localhost:3002/culture → three cards visible
- Manual: navigate to localhost:3002/culture?nous=did:noesis:sophia → skill lineage dims non-sophia nodes
- Manual: Norm Timeline shows "Norms are Grid-wide; per-Nous filter does not apply." sub-label
</verification>

<success_criteria>
1. /culture renders three SVG panels with raw SVG elements only
2. NousFilterBar updates URL param; filter propagates to SkillLineage and LoreGraph
3. NormTimeline renders all norms regardless of filter (Grid-wide sub-label shown)
4. No charting library imports in any culture file
5. No audit.append calls in culture files (allowlist delta 0)
6. Lore graph uses deterministic client-side positioning (content_hash seed)
</success_criteria>

<output>
After completion, create `.planning/phases/25c-replay-scrubber-culture-browser/25c-04-SUMMARY.md`
</output>
