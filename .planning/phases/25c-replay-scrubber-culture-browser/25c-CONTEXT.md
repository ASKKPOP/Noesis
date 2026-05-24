# Phase 25c: Replay Scrubber + Culture Browser — Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship two read-only operator-facing surfaces in StewardShell:

1. **Replay scrubber** — New `/replay` StewardShell nav section. Lists `operator.exported`
   audit entries (from Phase 13 + 25b export-replay route) in a table. Clicking a row opens
   a modal tick-scrubber backed by `ReplayGrid + buildStateAtTick`. Observer-only — no writes
   to live Grid.

2. **Culture browser** — New `/culture` StewardShell nav section. Steward-native versions
   of the Phase 21 culture views (norm timeline, lore graph, skill lineage graph) with
   per-Nous cross-filtering. Allowlist delta: 0. D-9-08 raw-SVG invariant applies.

**Also in scope (Wave-0 cleanup, sequenced before new surfaces):**
- Migrate `relationships.ts` to header-auth (last body-trust operator route, H2 gate)
- Wire `humanSanctionStore` in `main.ts` (makes ban-human + freeze-wallet live, currently 503)
- Wire `SpawnNousDeps` in `main.ts` (makes spawn-system-nous live, currently 503)

</domain>

<decisions>
## Implementation Decisions

### Wave-0: Cleanup + production wiring

- **D-01:** `grid/src/api/operator/relationships.ts` — migrate to header-auth pattern
  (x-operator-tier / x-operator-id headers, H2 gate). Same shape as 25b-01 through 25b-06.
  This is the last remaining `validateTierBody` caller outside `_validation.ts`.
- **D-02:** Wire `humanSanctionStore` into `GridServices` in `grid/src/main.ts`. Implement the
  DB pool wrapper that fulfils the `HumanSanctionStore` interface (getFlags, setBanned, setFrozen).
  Removes the 503 guard from ban-human and freeze-wallet routes.
- **D-03:** Wire `SpawnNousDeps` into `GridServices` in `grid/src/main.ts`. Connects
  `GenesisLauncher.spawnNous` through the interface. Removes the 503 guard from
  spawn-system-nous route.

### Replay scrubber

- **D-04:** New `/replay` section added to StewardShell nav. Dedicated route, not a modal
  triggered from firehose or Nous inspector.
- **D-05:** Listing page shows a table of `operator.exported` audit entries with columns:
  date, Nous DID, tick range (start\_tick → end\_tick), operator\_id. Click a row → scrubber modal.
  Grid needs an endpoint to list exports (or Steward reads from the audit firehose filtered by
  `operator.exported` event type — planner to determine cleanest approach).
- **D-06:** Scrubber modal: tick slider across the export's tick range + event list at the
  selected tick. State derived from `ReplayGrid + buildStateAtTick` (Phase 13 infrastructure).
  H3+ gate (REPLAY-05 spec). H4 redaction placeholder for sub-H4 operators ("— Requires H4").
  Observer-only — no Grid mutations.
- **D-07:** Phase 13 Plan 04 left RED stubs in `dashboard/src/app/grid/replay/replay-client.test.tsx`.
  **Make these stubs GREEN first** (complete the dashboard REPLAY-05 surface), then port the
  working implementation into Steward. This honours the Phase 13 acceptance contract before
  the Steward version supersedes it.

### Culture browser

- **D-08:** Build **Steward-native** culture components from scratch. Do NOT copy or import
  from `dashboard/src/components/culture/`. Use the same data contracts (Grid API response
  shapes from `dashboard/src/lib/api/culture.ts`) but write new TSX under
  `steward/src/app/culture/`.
- **D-09:** Grid culture data endpoints are the same routes the dashboard uses. Steward routes
  all Grid calls through the existing operator proxy (`steward/src/app/api/operator/[...path]/route.ts`).
  No new Grid culture endpoints needed.
- **D-10:** D-9-08 raw-SVG invariant carries into 25c — no d3, react-flow, cytoscape, or
  recharts. All three visualizations (norm timeline, lore graph, skill lineage) use
  server-computed positions + client `<line>` / `<circle>` / `<rect>` SVG elements.
- **D-11:** Per-Nous cross-filtering — scope and UX not discussed; Claude's discretion.
  Suggested approach: Nous DID picker / filter bar at top of `/culture` that filters all three
  views simultaneously. Optional deep-link from Nous inspector (`?nous=<did>`).

### Claude's Discretion

- Per-Nous cross-filter exact UX (picker vs dropdown vs URL param) — not discussed
- How Steward lists `operator.exported` entries (new Grid endpoint vs firehose filter) — planner decides
- Scrubber modal size and tick slider control style — follow Steward design system

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 13 — Replay infrastructure
- `.planning/phases/13-operator-replay-export/13-02-SUMMARY.md` — ReplayGrid constructor
  signature (positional args), buildStateAtTick API, silent-restore / rebuildFromChain behavior
- `.planning/phases/13-operator-replay-export/13-VALIDATION.md` — REPLAY-05 RED stubs to make green
- `grid/src/replay/replay-grid.ts` — ReplayGrid implementation
- `grid/src/api/operator/export-replay.ts` — operator.exported emitter + ReplayGrid usage pattern

### Phase 21 — Culture data contracts
- `dashboard/src/lib/api/culture.ts` — Grid culture endpoint response shapes (SkillLineageResponse etc.)
- `dashboard/src/components/culture/norm-timeline.tsx` — reference for data consumed (not copied)
- `dashboard/src/components/culture/lore-graph.tsx` — reference for data consumed (not copied)
- `dashboard/src/components/culture/skill-lineage-graph.tsx` — reference for data consumed (not copied)

### Phase 25 parent context
- `.planning/phases/25-steward-console-expansion-humans-sanctions-cognitive-inspect/25-CONTEXT.md`
  — Sub-phase split decisions (D-01 through D-11), invariant list
- `.planning/phases/25a-observer-surfaces/25a-UI-SPEC.md` — Steward design system (palette,
  typography, spacing, nav pattern, steward-card, StewardShell layout)

### Phase 25b — Operator proxy (auth pattern for Steward)
- `steward/src/app/api/operator/[...path]/route.ts` — catch-all proxy that injects
  x-operator-id server-side; all Steward→Grid operator calls must route through here

### Invariants
- `.planning/STATE.md` §"v2.4 Critical invariants" — D-9-08 raw-SVG invariant (no charting libs)
- `.planning/ROADMAP.md` §"Phase 25c" — observer-only constraint, allowlist delta 0

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `grid/src/replay/replay-grid.ts` — ReplayGrid class, ready to use
- `grid/src/replay/state-builder.ts` — buildStateAtTick function
- `steward/src/app/api/operator/[...path]/route.ts` — operator proxy, route Steward→Grid calls through here
- `dashboard/src/lib/api/culture.ts` — culture API wrappers (response types reusable, not the fetch logic)
- `steward/src/app/layout.tsx` — StewardShell nav, add /replay and /culture sections here

### Established Patterns
- StewardShell nav section: add link in layout.tsx, create `steward/src/app/{section}/page.tsx`
- steward-card CSS class for card containers (from 25a-UI-SPEC)
- Header-auth operator calls: x-operator-tier + x-operator-id injected by proxy, not hardcoded in client
- Sole-producer audit emitters: each event has one file; relationships.ts migration follows 25b-01 shape

### Integration Points
- `grid/src/api/operator/index.ts` — barrel where relationships.ts is registered
- `grid/src/main.ts` — GridServices wiring point for humanSanctionStore + SpawnNousDeps
- `grid/src/api/operator/relationships.ts` — body-trust to header-auth migration target
- `dashboard/src/app/grid/replay/` — Phase 13 RED stubs to make green

</code_context>

<specifics>
## Specific Ideas

- Replay listing table columns: date | Nous DID | tick range | operator_id
- Scrubber modal: tick slider at top, event list below (each event shows type, hash, key payload fields)
- H3+ gate on scrubber (REPLAY-05 spec); H4 redaction placeholder for sub-H4 access
- Culture `/culture` route: three panels (norm timeline, lore graph, skill lineage) with shared
  Nous DID filter bar above them

</specifics>

<deferred>
## Deferred Ideas

- Per-Nous cross-filter deep-link from Nous inspector — noted but not decided; planner may include
- Relationship graph visualization in scrubber modal — user chose event list over graph; graph
  could be a future enhancement
- Shared component package (monorepo packages/) for culture components — deferred; copy-per-app
  is the current pattern

</deferred>

---

*Phase: 25c-replay-scrubber-culture-browser*
*Context gathered: 2026-05-22*
