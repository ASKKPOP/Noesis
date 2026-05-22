# Phase 25c: Replay Scrubber + Culture Browser — Research

**Researched:** 2026-05-22
**Domain:** StewardShell UI surfaces, Grid operator routes, ReplayGrid infrastructure, Phase 13/21 data contracts
**Confidence:** HIGH

---

## Summary

Phase 25c ships two read-only StewardShell surfaces — a `/replay` scrubber backed by the Phase 13 `ReplayGrid + buildStateAtTick` infrastructure, and a `/culture` browser that renders Phase 21 visualizations (norm timeline, lore graph, skill lineage) natively in Steward. It is preceded by three Wave-0 cleanup tasks: header-auth migration for `relationships.ts` (D-01), wiring `humanSanctionStore` in `main.ts` (D-02), and wiring `SpawnNousDeps` in `main.ts` (D-03).

All three new Grid/infra tasks follow established patterns and require no new endpoints. The replay listing is best sourced by querying the existing `/api/v1/audit/trail?type=operator.exported` endpoint — no new Grid route is needed. Culture data arrives via the three endpoints already present from Phase 21 (`/api/v1/grid/culture/skills/lineage`, `/api/v1/grid/norms`, `/api/v1/grid/lore`), proxied through the Steward operator proxy. The raw-SVG invariant (D-9-08) and allowlist delta 0 constraint lock the implementation path.

One infrastructure gap found: the dashboard `replay-client.test.tsx` file is currently failing due to a missing `@vitejs/plugin-react` in the dashboard's own `node_modules` (it has been hoisted to the monorepo root, causing vitest's bundled vite to not find it). This must be fixed as part of D-07 (make RED stubs GREEN).

**Primary recommendation:** Follow the Wave sequence — Wave 0 (cleanup + prod wiring), Wave 1 (D-07 dashboard test GREEN), Wave 2 (Steward `/replay` route + listing table), Wave 3 (scrubber modal), Wave 4 (Steward `/culture` route + three SVG panels), Wave 5 (per-Nous filter bar + regression). No new Grid endpoints are needed beyond confirming the audit/trail query approach works for export listing.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Wave-0: Cleanup + production wiring**

- **D-01:** `grid/src/api/operator/relationships.ts` — migrate to header-auth pattern (x-operator-tier / x-operator-id headers, H2 gate). Same shape as 25b-01 through 25b-06. This is the last remaining `validateTierBody` caller outside `_validation.ts`.
- **D-02:** Wire `humanSanctionStore` into `GridServices` in `grid/src/main.ts`. Implement the DB pool wrapper that fulfils the `HumanSanctionStore` interface (getFlags, setBanned, setFrozen). Removes the 503 guard from ban-human and freeze-wallet routes.
- **D-03:** Wire `SpawnNousDeps` into `GridServices` in `grid/src/main.ts`. Connects `GenesisLauncher.spawnNous` through the interface. Removes the 503 guard from spawn-system-nous route.

**Replay scrubber**

- **D-04:** New `/replay` section added to StewardShell nav. Dedicated route, not a modal triggered from firehose or Nous inspector.
- **D-05:** Listing page shows a table of `operator.exported` audit entries with columns: date, Nous DID, tick range (start_tick → end_tick), operator_id. Click a row → scrubber modal. Grid needs an endpoint to list exports (or Steward reads from the audit firehose filtered by `operator.exported` event type — planner to determine cleanest approach).
- **D-06:** Scrubber modal: tick slider across the export's tick range + event list at the selected tick. State derived from `ReplayGrid + buildStateAtTick` (Phase 13 infrastructure). H3+ gate (REPLAY-05 spec). H4 redaction placeholder for sub-H4 operators ("— Requires H4"). Observer-only — no Grid mutations.
- **D-07:** Phase 13 Plan 04 left RED stubs in `dashboard/src/app/grid/replay/replay-client.test.tsx`. **Make these stubs GREEN first** (complete the dashboard REPLAY-05 surface), then port the working implementation into Steward. This honours the Phase 13 acceptance contract before the Steward version supersedes it.

**Culture browser**

- **D-08:** Build **Steward-native** culture components from scratch. Do NOT copy or import from `dashboard/src/components/culture/`. Use the same data contracts (Grid API response shapes from `dashboard/src/lib/api/culture.ts`) but write new TSX under `steward/src/app/culture/`.
- **D-09:** Grid culture data endpoints are the same routes the dashboard uses. Steward routes all Grid calls through the existing operator proxy (`steward/src/app/api/operator/[...path]/route.ts`). No new Grid culture endpoints needed.
- **D-10:** D-9-08 raw-SVG invariant carries into 25c — no d3, react-flow, cytoscape, or recharts. All three visualizations (norm timeline, lore graph, skill lineage) use server-computed positions + client `<line>` / `<circle>` / `<rect>` SVG elements.
- **D-11:** Per-Nous cross-filtering — scope and UX not discussed; Claude's discretion. Suggested approach: Nous DID picker / filter bar at top of `/culture` that filters all three views simultaneously. Optional deep-link from Nous inspector (`?nous=<did>`).

### Claude's Discretion

- Per-Nous cross-filter exact UX (picker vs dropdown vs URL param) — not discussed
- How Steward lists `operator.exported` entries (new Grid endpoint vs firehose filter) — planner decides
- Scrubber modal size and tick slider control style — follow Steward design system

### Deferred Ideas (OUT OF SCOPE)

- Per-Nous cross-filter deep-link from Nous inspector — noted but not decided; planner may include
- Relationship graph visualization in scrubber modal — user chose event list over graph; graph could be a future enhancement
- Shared component package (monorepo packages/) for culture components — deferred; copy-per-app is the current pattern
</user_constraints>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| header-auth migration (D-01) | API / Backend (Grid) | — | Route lives in `grid/src/api/operator/relationships.ts`; pure server-side auth change |
| humanSanctionStore wiring (D-02) | API / Backend (Grid) | DB/Storage | `GridServices` in `main.ts` is the wiring point; needs mysql2 pool wrapper |
| SpawnNousDeps wiring (D-03) | API / Backend (Grid) | — | `main.ts` creates the deps object wrapping `launcher.spawnNous` |
| Replay listing page | Frontend Server (Steward SSR) | API/Backend | Steward server component fetches from Grid via proxy; table rendered in Steward |
| Scrubber modal — data fetch | Frontend Server (Steward) | API/Backend | Server fetches audit slice via proxy; passes entries to client component |
| Scrubber modal — tick slider UI | Browser / Client | — | Interactive slider; `ReplayGrid + buildStateAtTick` can run in the browser (pure TS) |
| Culture SVG visualizations | Browser / Client | Frontend Server | Data fetched server-side; SVG rendered client-side or as RSC (no interactivity required except filter) |
| Per-Nous filter bar | Browser / Client | — | Requires `useState`; client component controlling which DID filters all three views |

---

## Standard Stack

### Core (already in project — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.3.2 | Steward app framework | Already installed in `steward/package.json` |
| React | 19.2.5 | UI runtime | Already in Steward; also dashboard |
| TypeScript | 5.x | Type safety | Project-wide standard |
| vitest | 4.1.4 | Dashboard test runner | Already in `dashboard/package.json` |

### Supporting (already in project)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@vitejs/plugin-react` | ^4.3.4 | JSX transform for vitest | Required by `dashboard/vitest.config.ts` — must be resolvable from dashboard |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `audit/trail?type=operator.exported` for listing | New `/api/v1/operator/exports` Grid route | firehose filter is cleaner — no new Grid code; new route adds test burden with 0 benefit |
| URL param `?nous=<did>` for filter | React dropdown state | URL param enables deep-link from Nous inspector (fits deferred idea); simpler to implement with `useSearchParams` |

**Installation:**
None required — all dependencies are already present in the repo.

**Version verification:** [VERIFIED: local node_modules] All packages confirmed present at versions in package.json files.

---

## Architecture Patterns

### System Architecture Diagram

```
StewardShell browser
    │
    ├── /replay (server component)
    │       │  fetches audit/trail?type=operator.exported → listing table
    │       │  click row → open modal
    │       └─ ReplayModal (client component)
    │               │  receives AuditEntry[] slice (from Grid via proxy)
    │               │  calls ReplayGrid(entries) + buildStateAtTick(replay, tick)
    │               │  tick slider (Scrubber component) → onTick change
    │               └─ event list at selected tick (read from replay.audit.all() filtered by tick)
    │
    ��── /culture (server component or client with useEffect)
    │       ��  fetches /api/v1/grid/culture/skills/lineage
    │       │  fetches /api/v1/grid/norms
    │       │  fetches /api/v1/grid/lore
    │       │  (all via Steward proxy /api/operator/... → Grid)
    │       └─ NousDIDFilterBar (client, useState or useSearchParams)
    │               │  props.filter → NormTimelineCard
    │               │  props.filter → LoreGraphCard
    │               └─ props.filter → SkillLineageCard
    │                       (each: raw SVG, server-computed positions, filtered by nous DID)
    │
    └── StewardShell.tsx nav
            ├── /replay (new NavItem)
            └── /culture (new NavItem)

Grid (Fastify)
    ├── GET /api/v1/audit/trail?type=operator.exported  ← replay listing source
    ├── GET /api/v1/grid/culture/skills/lineage          ← skill lineage
    ├── GET /api/v1/grid/norms                           ← norms
    ├── GET /api/v1/grid/lore                            ← lore entries
    └── POST /api/v1/operator/replay/export              ← (existing, not used in 25c)
```

### Recommended Project Structure

```
steward/src/app/
├── replay/
│   ├── page.tsx               # Server component: fetches operator.exported entries, renders ExportTable
│   └── replay-modal.tsx       # Client component: tick slider + event list (ReplayGrid browser usage)
├── culture/
│   ├── page.tsx               # Server component (or client): fetches all 3 culture endpoints
│   ├── nous-filter-bar.tsx    # Client: Nous DID picker, controls URL param or state
│   ├── norm-timeline.tsx      # Raw SVG: NormsResponse → SVG bars (Steward-native)
│   ├── lore-graph.tsx         # Raw SVG: LoreGraphData → SVG nodes/edges (Steward-native)
│   └── skill-lineage.tsx      # Raw SVG: SkillLineageResponse → SVG tree (Steward-native)

dashboard/src/app/grid/replay/
└── replay-client.tsx          # RED → GREEN (D-07, make Phase 13 tests pass first)
```

### Pattern 1: Header-auth migration (D-01)

**What:** Replace `validateTierBody(body, 'H2')` with header reads (`req.headers['x-operator-tier']`, `req.headers['x-operator-id']`).
**When to use:** Any route that still uses the deprecated body-trust pattern.
**Example (verified from `grid/src/api/operator/export-replay.ts`):**
```typescript
// Source: grid/src/api/operator/export-replay.ts lines 69-90
const tierHeader = req.headers['x-operator-tier'];
if (typeof tierHeader !== 'string') {
    reply.code(401);
    return { error: 'tier_missing' } satisfies ApiError;
}
const tierNum = parseInt(tierHeader, 10);
if (!Number.isFinite(tierNum)) {
    reply.code(401);
    return { error: 'tier_missing' } satisfies ApiError;
}
if (tierNum < 2) {  // for H2 gate
    reply.code(403);
    return { error: 'tier_too_low' } satisfies ApiError;
}
const opIdHeader = req.headers['x-operator-id'];
if (typeof opIdHeader !== 'string' || !OPERATOR_ID_REGEX.test(opIdHeader)) {
    reply.code(400);
    return { error: 'invalid_operator_id' } satisfies ApiError;
}
```
The `relationships.ts` has TWO spots that use `validateTierBody`: the H2 inspect route and the H5 edge-events route. Both need migration to header-auth.

### Pattern 2: humanSanctionStore wiring (D-02)

**What:** Create a mysql2-backed object that implements the `humanSanctionStore` interface in `GridServices` and pass it to `buildServer()`.
**When to use:** `main.ts`, conditioned on `dbConn` being non-null (DB must be configured).
**Interface (verified from `grid/src/api/server.ts` line 215):**
```typescript
humanSanctionStore?: {
    existsByDid(did: string): Promise<boolean>;
    setBanned(did: string): Promise<void>;
    setFrozen(did: string): Promise<void>;
    getFlags(did: string): Promise<{ frozen: number; banned: number } | null>;
};
```
Pattern: implement as a plain object literal using `dbConn.getPool()` to execute queries against `human_users` table. Mirrors the pattern used by `HumanRegistry` + `LoreStorage` wiring.

### Pattern 3: SpawnNousDeps wiring (D-03)

**What:** Construct a `SpawnNousDeps` object wrapping `launcher.spawnNous` and pass to `registerSpawnSystemNousRoute`.
**When to use:** `main.ts` after `launcher.bootstrap()`.
**Interface (verified from `grid/src/api/operator/spawn-system-nous.ts` line 68):**
```typescript
interface SpawnNousDeps {
    spawnNous(name: string, did: string, publicKey: string, region: string): void;
}
// Wire:
const spawnNousDeps: SpawnNousDeps = {
    spawnNous: (name, did, pk, region) => launcher.spawnNous(name, did, pk, region),
};
```
Route currently reads deps via `(services as unknown as { _spawnNousDeps?: SpawnNousDeps })._spawnNousDeps`. Production path: pass deps directly to `registerSpawnSystemNousRoute(app, services, spawnNousDeps)`.

### Pattern 4: Replay listing via audit/trail filter

**What:** Steward server component fetches `GET /api/v1/audit/trail?type=operator.exported&limit=200` through the Steward proxy, extracts `operator.exported` entries, and renders a table.
**When to use:** `/replay/page.tsx` (server component).
**Verified Grid endpoint (from `grid/src/api/server.ts` line 518):**
```typescript
app.get('/api/v1/audit/trail', async (req) => {
    const entries = services.audit.query({
        eventType: req.query.type,
        actorDid: req.query.actor,
        limit: req.query.limit ? parseInt(req.query.limit, 10) : 50,
        offset: req.query.offset ? parseInt(req.query.offset, 10) : 0,
    });
    return { entries, total: services.audit.length };
});
```
The `operator.exported` payload shape: `{tier, operator_id, start_tick, end_tick, tarball_hash, requested_at}`. The listing table reads `start_tick`, `end_tick`, `operator_id`, and `requested_at` from the payload. `actorDid` on the entry is the operator_id. No Nous DID column exists in the payload — the "Nous DID" column in D-05 refers to the grid instance (or is absent — planner to note this discrepancy; the payload has no per-Nous DID, only `operator_id`).

**IMPORTANT FINDING:** The `operator.exported` event has NO `nous_did` field. Its payload is `{tier, operator_id, start_tick, end_tick, tarball_hash, requested_at}`. The listing table column should be `operator_id` not `Nous DID`. The planner should adapt D-05's column spec to match the actual payload — "Nous DID" does not exist in this event.

### Pattern 5: ReplayGrid browser usage for scrubber modal

**What:** The scrubber modal needs to show events at a selected tick. The cleanest approach is to receive the raw audit entries from a server-side fetch, pass them to `ReplayGrid` in the browser, then query `replay.audit.all()` filtered to `entry.id <= selectedTick`.
**When to use:** `replay-modal.tsx` client component.
**Key APIs (verified from `grid/src/replay/replay-grid.ts`):**
```typescript
// Constructor — positional form
new ReplayGrid(entries: ReadonlyArray<AuditEntry>, gridName: string)

// After construction — must call to reconstruct relationship edges
replay.rebuildFromChain()

// Access all loaded entries
replay.audit.all()  // returns AuditEntry[]
```
NOTE: `ReplayGrid` is Grid-side TypeScript. It can be imported in the browser IF the Steward bundle can import from `../../grid/src/replay/replay-grid.ts`. However, given the mono-repo structure, this cross-package import is non-trivial without a shared package. The simpler approach is to port the minimal replay logic (filtering entries by tick) into Steward directly. The scrubber only needs to display events at a tick — it does not need the full `RelationshipListener` rebuild. The event list at tick N = `entries.filter(e => e.id === N)` or `entries.filter(e => e.id <= N)` depending on spec. **Planner decision:** either import from Grid (if monorepo setup allows), or inline the entry-filter logic in Steward without using ReplayGrid. Given the `observer-only, no writes` constraint, the event list at a tick is just `entries.filter(e => (e.id ?? 0) <= tick)`.

### Pattern 6: Culture SVG in Steward (raw SVG invariant)

**What:** Write new TSX that fetches the same Grid endpoints the dashboard uses, but renders them with Steward's parchment/vellum/ink color palette instead of dashboard's dark theme.
**Data shapes (verified from `dashboard/src/lib/api/culture.ts`):**
```typescript
interface SkillLineageResponse {
    nodes: Array<{ id: string; label: string; type: 'nous' | 'skill'; x: number; y: number }>;
    edges: Array<{ source: string; target: string; tick: number; type: 'taught' | 'inferred' }>;
}
interface NormsResponse {
    norms: NormRecord[];  // each has crystallized_tick, evidence_tick_range, fingerprint, etc.
}
interface LoreEntriesResponse {
    entries: LoreEntry[];  // each has contributor_did, tick, content_hash, category_tag
    total: number;
}
```
**Endpoints:**
- Skill lineage: `GET /api/v1/grid/culture/skills/lineage`
- Norms: `GET /api/v1/grid/norms`
- Lore entries: `GET /api/v1/grid/lore`
- Lore citations: `GET /api/v1/audit/trail?type=lore.cited`

All must be routed through the Steward proxy. However, the proxy only handles `/api/operator/[...path]` → `/api/v1/operator/[...path]`. Culture endpoints are `/api/v1/grid/...` and `/api/v1/audit/...`, NOT operator routes. These can be fetched directly from `NEXT_PUBLIC_GRID_ORIGIN` (public Grid origin) in server components — this is the same pattern the dashboard uses. No proxy needed for culture data since it's public grid data, not operator-gated data.

**IMPORTANT FINDING:** The Steward operator proxy (`/api/operator/[...path]`) proxies ONLY `operator.*` routes. Culture and audit-trail routes are not operator-gated — they use the public Grid origin directly. Server components in Steward should fetch from `process.env.NEXT_PUBLIC_GRID_ORIGIN` (already set via `steward/.env`) for these public endpoints. The proxy pattern only applies to write/operator calls requiring `x-operator-id` injection.

### Pattern 7: Nous DID filter (Claude's Discretion — D-11)

**What:** A filter bar above the three culture views that lets operators filter to a specific Nous. URL param `?nous=<did>` is recommended — enables deep-link from Nous inspector, survives page reload, and is compatible with Next.js `useSearchParams`.
**When to use:** `culture/page.tsx` and `culture/nous-filter-bar.tsx`.
**Implementation:** Server component reads `searchParams.nous`, passes as prop to SVG components. SVG components filter `nodes` / `norms` / `entries` by `nous_did` matching. Empty/null filter = show all.

### Pattern 8: StewardShell nav extension

**What:** Add `/replay` and `/culture` nav items to `StewardShell.tsx` in the appropriate section.
**Current nav structure (verified from `steward/src/components/StewardShell.tsx`):**
```
Operator section: Dashboard, Nous Roster, Economy, Governance, Users, Firehose, Audit Log
Grid section: System, World Map
```
Add `/replay` and `/culture` under a new "Observatory" section or within the Operator section — planner's choice.

### Anti-Patterns to Avoid

- **Importing ReplayGrid from grid/src in the Steward bundle:** Creates a cross-package dependency that will fail at build time unless the monorepo has explicit package exports. Use inline tick-filtering logic instead.
- **Using d3, cytoscape, react-flow, recharts for culture SVGs:** D-10 forbids all visualization libraries. Raw `<svg>`, `<line>`, `<circle>`, `<rect>` elements only — positions come from the Grid's server-computed response (x, y already in the API response).
- **Routing culture data through the operator proxy:** Culture endpoints (`/api/v1/grid/...`, `/api/v1/audit/trail`) are public-origin fetches, not operator-gated calls. Proxy adds no value and would require extending the proxy path patterns.
- **Constructing HumanSanctionStore outside of DB availability check:** The store must be conditioned on `dbConn` being non-null, same as `HumanRegistry` and `LoreStorage` in `main.ts`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tick slider control | Custom range input | HTML `<input type="range">` | Already used in `dashboard/src/app/grid/replay/scrubber.tsx` — the exact implementation is proven |
| Audit entry filtering by type | Custom query builder | Existing `?type=operator.exported` query param on `/api/v1/audit/trail` | Grid already supports this — tested, working |
| SVG coordinate layout | Custom BFS/layout algorithm | Grid already computes `{x, y}` in API response | `grid/src/api/routes/culture.ts` runs BFS layout server-side; coordinates arrive pre-computed |
| Modal component | Complex modal library | Plain conditional render with overlay div | Pattern in Phase 25a — hand-rolled inline styles, no modal library |
| Tier gate logic | Custom auth | Read `req.headers['x-operator-tier']` → integer parse | The exact pattern used by every 25b route — copy verbatim |

**Key insight:** All the hard infrastructure exists. Phase 25c is a UI assembly task on top of fully-tested Grid primitives. The only non-trivial code is the Steward-native SVG renderers with the Nous DID filter.

---

## Common Pitfalls

### Pitfall 1: `replay-client.test.tsx` fails due to missing `@vitejs/plugin-react` in dashboard's own node_modules

**What goes wrong:** `cd dashboard && npx vitest run` fails with "Failed to parse source... jsx to preserve" because vitest 4.x bundles its own Vite that looks for `@vitejs/plugin-react` locally, but the package is hoisted to the monorepo root.
**Why it happens:** npm hoisting puts `@vitejs/plugin-react` at `/node_modules/@vitejs/plugin-react` not at `dashboard/node_modules/@vitejs/plugin-react`. The vitest bundled Vite's module resolution searches the local `node_modules` first and fails.
**How to avoid:** Add `@vitejs/plugin-react` to `dashboard/package.json` devDependencies and run `npm install` from the dashboard directory. Or confirm the root-level install is found by checking `ls dashboard/node_modules/@vitejs` — if missing, it needs a local install.
**Warning signs:** Any attempt to run `cd dashboard && npx vitest run ...` on a `.tsx` test file fails with "invalid JS syntax / jsx preserve" error.

### Pitfall 2: `operator.exported` payload has no `nous_did` field

**What goes wrong:** D-05 specifies a "Nous DID" column in the listing table. The actual `operator.exported` payload only contains `{tier, operator_id, start_tick, end_tick, tarball_hash, requested_at}`. There is no `nous_did`.
**Why it happens:** The CONTEXT.md description conflated the export event with the Nous being exported. The export is a tick-range over the entire Grid, not a per-Nous export.
**How to avoid:** The listing table should have columns: date (from `entry.createdAt`), operator_id, tick range (`start_tick → end_tick`). Drop the "Nous DID" column or replace with "Tarball Hash" (truncated).

### Pitfall 3: Culture data routes are NOT operator-gated

**What goes wrong:** Routing `/api/v1/grid/culture/skills/lineage` through the Steward operator proxy (`/api/operator/...`) will 404 — the proxy maps to `/api/v1/operator/...` on Grid, but culture routes are at `/api/v1/grid/culture/...`.
**Why it happens:** The Steward proxy exists specifically for operator-authenticated calls that need `x-operator-id` injection. Culture routes require no auth.
**How to avoid:** Server components in Steward should `fetch` culture data directly from `process.env.NEXT_PUBLIC_GRID_ORIGIN` (same as dashboard does in `dashboard/src/lib/api/culture.ts`).

### Pitfall 4: `relationships.ts` has TWO `validateTierBody` call sites

**What goes wrong:** Only migrating one call site leaves the other in body-trust mode.
**Why it happens:** The file has an H2 inspect route AND an H5 edge-events route — both use `validateTierBody`. D-01 says "last remaining `validateTierBody` caller outside `_validation.ts`" which implies ALL callers in that file.
**How to avoid:** Grep for all `validateTierBody` occurrences in `relationships.ts` before writing the migration. Migrate both the H2 and H5 routes to header-auth.

### Pitfall 5: ReplayGrid is a Grid-side class, not available in Steward bundle

**What goes wrong:** Attempting to `import { ReplayGrid } from '../../../grid/src/replay/replay-grid'` from within `steward/src` will fail at build time unless explicit package exports are configured.
**Why it happens:** The monorepo has no `packages/` shared library (deferred per CONTEXT.md). `grid` is a separate package, not imported by `steward`.
**How to avoid:** For the Steward scrubber modal, implement tick-based entry filtering inline: `entries.filter(e => (e.id ?? 0) <= selectedTick)`. This is all the scrubber modal needs — a list of events at or before the selected tick. The full `ReplayGrid + buildStateAtTick` machinery is only needed if the modal must show relationship graph state, which has been deferred.

### Pitfall 6: `main.ts` wiring must be conditioned on `dbConn` non-null

**What goes wrong:** Constructing `humanSanctionStore` without a DB connection causes a runtime error when Grid starts without MySQL configured (e.g., test environments, CI).
**Why it happens:** `dbConn` is optional in `GridAppConfig.db`. The existing `loreStorage` wiring pattern already handles this correctly.
**How to avoid:** Wrap humanSanctionStore construction in `if (dbConn) { ... }`, then pass `...(humanSanctionStore ? { humanSanctionStore } : {})` to `buildServer()`.

---

## Code Examples

### Replay listing fetch (Steward server component)

```typescript
// steward/src/app/replay/page.tsx — server component pattern
// Source: verified from steward/src/app/users/page.tsx audit/trail usage
const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

interface OperatorExportedPayload {
    tier: 'H5';
    operator_id: string;
    start_tick: number;
    end_tick: number;
    tarball_hash: string;
    requested_at: number;
}

interface AuditEntry {
    id: number;
    eventType: string;
    actorDid: string;
    payload: OperatorExportedPayload;
    createdAt: number;
    eventHash: string;
}

async function fetchExportEntries(): Promise<AuditEntry[]> {
    const res = await fetch(
        `${GRID_ORIGIN}/api/v1/audit/trail?type=operator.exported&limit=200`,
        { cache: 'no-store' },
    );
    if (!res.ok) return [];
    const body = await res.json() as { entries: AuditEntry[] };
    return body.entries ?? [];
}
```

### Scrubber modal tick filter (inline, no ReplayGrid dependency)

```typescript
// steward/src/app/replay/replay-modal.tsx — client component
// No import from grid/src/replay needed — inline filtering is sufficient
'use client';

function EventsAtTick({ entries, tick }: { entries: AuditEntry[]; tick: number }) {
    const visible = entries.filter(e => (e.id ?? 0) === tick);
    // or: entries.filter(e => (e.id ?? 0) <= tick) for cumulative view
    return (
        <ul>
            {visible.map(e => (
                <li key={e.eventHash} style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
                    <span>{e.eventType}</span>
                    <span style={{ color: 'var(--muted)', marginLeft: 8 }}>
                        {e.actorDid.slice(0, 16)}…
                    </span>
                </li>
            ))}
        </ul>
    );
}
```

### H3 tier gate for scrubber (verified from replay-client.tsx pattern)

```typescript
// Source: dashboard/src/app/grid/replay/replay-client.tsx lines 50-58
const TIER_ORDER = ['H1', 'H2', 'H3', 'H4', 'H5'] as const;
type Tier = typeof TIER_ORDER[number];

function tierAtLeast(tier: Tier, minimum: Tier): boolean {
    return TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(minimum);
}

// Usage: if (!tierAtLeast(operatorTier, 'H3')) return <p>Replay requires H3 or higher</p>;
```

### Culture data fetch (direct from NEXT_PUBLIC_GRID_ORIGIN, not via proxy)

```typescript
// steward/src/app/culture/page.tsx — server component
// Source: verified from dashboard/src/lib/api/culture.ts pattern
const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

const [skillRes, normsRes, loreRes] = await Promise.allSettled([
    fetch(`${GRID_ORIGIN}/api/v1/grid/culture/skills/lineage`, { cache: 'no-store' }),
    fetch(`${GRID_ORIGIN}/api/v1/grid/norms`, { cache: 'no-store' }),
    fetch(`${GRID_ORIGIN}/api/v1/grid/lore`, { cache: 'no-store' }),
]);
```

### Steward-native SVG norm bar (design system colors)

```typescript
// steward/src/app/culture/norm-timeline.tsx
// Source: dashboard/src/components/culture/norm-timeline.tsx for structure; 
//         steward/src/app/globals.css for token names
const EMERGENT_FILL = '#3a7a5a';      // --sage-green (nous family color from 25a-UI-SPEC)
const COINCIDENTAL_FILL = '#8a8479';  // --muted

// SVG: use var(--ink), var(--vellum), var(--rule) — not dark-mode neutrals
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Body-trust auth (`validateTierBody`) | Header-auth (`x-operator-tier` / `x-operator-id`) | Phase 25b (D-25b-NEW-1) | All new operator routes must use header-auth; `relationships.ts` is the last body-trust holdout |
| Shared Grid client components across apps | App-native components with shared type imports only | Phase 25c D-08 | No copy-paste of dashboard components; only data types (`SkillLineageResponse`, etc.) are reusable |

**Deprecated/outdated:**
- `validateTierBody`: Used only in `relationships.ts` now; all other operator routes have been migrated. Phase 25c D-01 completes the migration.

---

## Open Questions

1. **Fetch audit entries for scrubber modal: server-side or client-side?**
   - What we know: Server component can pre-fetch entries; client component can re-fetch on demand.
   - What's unclear: If the tick range is large (hundreds of entries), server-pre-fetch is better for initial render; but the user hasn't selected a specific export row until they click. A two-step approach (listing page = server; modal = client fetch when row is clicked) is likely correct.
   - Recommendation: Listing page is server component. Modal is client component that fetches the entry slice for the selected export when opened (using the start/end tick from the selected row).

2. **Nous DID filter when Nous DIDs are not in the culture API responses**
   - What we know: `SkillLineageResponse.nodes` includes `{id: string}` where `id` is a DID for Nous nodes and a skill hash for skill nodes. `NormsResponse` has no per-Nous DID (norms are grid-wide convergences). `LoreEntriesResponse.entries` has `contributor_did`.
   - What's unclear: Norms cannot be filtered to a specific Nous (they are Grid-wide crystallizations). The filter would only meaningfully affect skill lineage (nodes with `type: 'nous'`) and lore (by `contributor_did`). Norm timeline filter would show all norms.
   - Recommendation: Filter bar affects skill lineage (highlight/filter selected Nous node + its edges) and lore (filter entries by `contributor_did`). Norm timeline: show all, since norms are multi-Nous convergences. Document this behavior in the plan.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Grid, Steward builds | ✓ | (system) | — |
| `@vitejs/plugin-react` in dashboard/node_modules | D-07 dashboard tests | ✗ (hoisted to root) | ^4.3.4 | Wave-0 task: `npm install --save-dev @vitejs/plugin-react` from dashboard dir |
| MySQL / DB | D-02 humanSanctionStore | ✓ (dev env) | — | humanSanctionStore omitted when db config absent |
| Grid running locally | Steward dev/test | optional | — | Steward handles Grid offline with empty states |

**Missing dependencies with no fallback:**
- None that block execution.

**Missing dependencies with fallback:**
- `@vitejs/plugin-react` not in `dashboard/node_modules`: Wave-0 install task. Until fixed, no dashboard tests run in the test runner from the repo root.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.4 (dashboard), no test framework in steward |
| Config file | `dashboard/vitest.config.ts` |
| Quick run command | `cd dashboard && npx vitest run --reporter=dot` |
| Full suite command | `cd grid && npx vitest run && cd ../dashboard && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-01 | header-auth migration in relationships.ts | unit | `cd grid && npx vitest run --reporter=dot` | ✅ existing grid test suite covers auth |
| D-02 | humanSanctionStore wired — ban/freeze return 200 | integration | `cd grid && npx vitest run --reporter=dot` | ✅ ban-human.test.ts, freeze-wallet.test.ts exist |
| D-03 | spawn-system-nous returns 200 with deps wired | unit | `cd grid && npx vitest run --reporter=dot` | ✅ spawn-system-nous.test.ts exists |
| D-07 | replay-client.test.tsx turns GREEN | unit | `cd dashboard && npx vitest run src/app/grid/replay/replay-client.test.tsx` | ✅ test exists, currently fails (infra gap) |
| D-04/D-05 | /replay route renders table | manual | navigate to `localhost:3002/replay` | ❌ Wave 0 (file doesn't exist yet) |
| D-06 | scrubber modal: H1/H2 see gate message; H3+ see slider | unit | `cd dashboard && npx vitest run` (port to steward when tests added) | ❌ Wave 0 |
| D-08/D-10 | culture SVGs render without d3/recharts | grep gate + manual | `node scripts/check-wallclock-forbidden.mjs` (extend for charting libs) | ❌ Wave 0 |
| D-11 | per-Nous filter bar changes what SVGs show | manual | navigate to `localhost:3002/culture?nous=<did>` | ❌ Wave 0 |

### Wave 0 Gaps

- [ ] `@vitejs/plugin-react` must be locally installed in `dashboard/` — needed to run replay-client.test.tsx
- [ ] `steward/src/app/replay/page.tsx` — listing table
- [ ] `steward/src/app/culture/page.tsx` — culture panels
- [ ] `steward/src/components/StewardShell.tsx` — add `/replay` and `/culture` nav items

*(Wave 0 infrastructure gap: "None — existing test infrastructure covers all phase requirements" does NOT apply — see D-07 vitest fix and new steward pages)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Read-only observer surfaces; Steward is operator-facing, no new auth paths |
| V3 Session Management | No | No new session paths in 25c |
| V4 Access Control | Yes | H3+ gate on replay scrubber; D-01 header-auth ensures operator tier is server-trusted |
| V5 Input Validation | Yes | D-01 validates `x-operator-tier` as integer, `x-operator-id` via OPERATOR_ID_REGEX |
| V6 Cryptography | No | No new crypto; tarball hashes are pre-computed Grid-side |

### Known Threat Patterns for Phase 25c

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Body-trust tier spoofing (D-01 residual) | Elevation of Privilege | Header-auth migration per D-25b-NEW-1 removes body trust completely |
| Cross-operator export attribution | Repudiation | `x-operator-id` injected server-side by Steward proxy (T-25b-06-02 pattern) |
| Replay surface modifying live Grid | Tampering | Observer-only constraint + `ReadOnlyAuditChain` throws on `append()` (T-10-07) |

---

## Project Constraints (from CLAUDE.md)

- **Simplicity First:** No abstractions for single-use code. Culture components are Steward-native, not abstracted into a shared package.
- **Surgical Changes:** `relationships.ts` migration (D-01) touches ONLY the auth validation; no other changes to that file.
- **Raw SVG invariant (D-9-08):** No d3, react-flow, cytoscape, recharts. Absolute requirement. Steward SVGs use `<line>`, `<circle>`, `<rect>` with server-computed positions.
- **Allowlist delta 0:** No new `audit.append()` calls in Phase 25c. All surfaces are read-only.
- **Sole-producer boundary:** No new audit event emitters in this phase.
- **Documentation Sync Rule:** Update ROADMAP.md, STATE.md, PROJECT.md when phase ships.

---

## Sources

### Primary (HIGH confidence)

- `grid/src/api/operator/export-replay.ts` — verified header-auth pattern and `operator.exported` emitter
- `grid/src/replay/replay-grid.ts` — ReplayGrid constructor signature (positional), rebuildFromChain() API
- `grid/src/replay/state-builder.ts` — buildStateAtTick signature: `(replay: ReplayGrid, tick: number): ReplayState`
- `grid/src/audit/append-operator-exported.ts` — verified 6-key payload shape: `{tier, operator_id, start_tick, end_tick, tarball_hash, requested_at}`
- `grid/src/api/server.ts` — verified `humanSanctionStore` interface shape (line 215), `/api/v1/audit/trail` endpoint (line 518)
- `grid/src/api/operator/spawn-system-nous.ts` — verified `SpawnNousDeps` interface (line 68)
- `grid/src/api/operator/relationships.ts` — confirmed `validateTierBody` at line 40 (two call sites confirmed via grep)
- `dashboard/src/lib/api/culture.ts` — verified all 4 response shapes and endpoint URLs
- `dashboard/src/app/grid/replay/replay-client.tsx` — tier gate pattern, redaction constants, TIER_ORDER logic
- `dashboard/src/app/grid/replay/scrubber.tsx` — Scrubber component props: `{value, startTick, endTick, onChange}`
- `steward/src/app/api/operator/[...path]/route.ts` — proxy pattern: injects `x-operator-id`, passes `x-operator-tier`
- `steward/src/components/StewardShell.tsx` — current nav structure (Operator section + Grid section)
- `.planning/phases/25a-observer-surfaces/25a-UI-SPEC.md` — design system tokens: `--ink`, `--parchment`, `--vellum`, `--terracotta`, `--muted`, `--rule`
- `.planning/phases/13-operator-replay-export/13-02-SUMMARY.md` — ReplayGrid construction order, rebuildFromChain caveat
- `grid/src/api/routes/culture.ts` — server-computed BFS layout produces `{x, y}` in API response

### Secondary (MEDIUM confidence)

- `dashboard/src/app/grid/replay/replay-client.test.tsx` — verified 9 test cases describing component API surface
- `steward/package.json` — confirmed no test framework installed in Steward (no vitest, no jest)

### Tertiary (LOW confidence)

- None in this research — all findings were verified from source files.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Steward server components can fetch `NEXT_PUBLIC_GRID_ORIGIN` directly for culture/audit endpoints (no proxy needed) | Architecture Patterns §6 | Low risk — if wrong, a pass-through proxy route is easy to add; existing steward pages (nous/[id]) already do direct Grid fetches |
| A2 | `@vitejs/plugin-react` hoisted to monorepo root is sufficient after `npm install` from project root | Environment Availability | Medium risk — vitest 4.x may still require local resolution; Wave-0 task should verify and install locally if needed |

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from package.json and node_modules
- Architecture: HIGH — all canonical refs read and verified
- Pitfalls: HIGH — discovered from direct file inspection (test failure, payload shape discrepancy)
- Culture endpoints: HIGH — verified from grid/src/api/server.ts and grid/src/api/routes/culture.ts

**Research date:** 2026-05-22
**Valid until:** 2026-06-22 (stable — Grid API and Steward design system are frozen in v2.5)
