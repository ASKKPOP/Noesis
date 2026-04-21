---
phase: 9
name: "Relationship Graph (Derived View)"
milestone: v2.2 Living Grid
requirements: [REL-01, REL-02, REL-03, REL-04]
created: 2026-04-21
mode: auto
---

# Phase 9 — Relationship Graph (Derived View) — CONTEXT

## <domain>

Phase 9 materializes a **derived relationship view** over the existing v2.1 audit chain. Every Nous pair's warmth/trust state must be observable without adding a single allowlist member. The listener clones the v2.1 Phase 7 `DialogueAggregator` pure-observer discipline (`grid/src/dialogue/aggregator.ts`) — it subscribes to `AuditChain.onAppend`, buffers derived edges in-memory, snapshots to a derived MySQL table, and NEVER calls `chain.append`. Rebuilding the table from scratch over the audit chain must produce byte-identical edges (idempotent-rebuild invariant). The only consumer-facing surfaces are a per-Nous Inspector top-N panel (tier-graded privacy — H1 gets bucketed warmth, H2+ gets numeric weight/valence, H5 gets per-edge raw dialogue turns) and a Grid-wide graph view rendering aggregate warmth.

This is the **zero-allowlist-growth opener** for v2.2. It validates the pure-observer pattern for the milestone and is the dependency-root for Phase 10a (Ananke drives clone the hash-only discipline at the producer boundary), Phase 12 (governance may later incorporate relationship-weighted-persuasion), and Phase 13 (state-level replay's second-richest recompute target after vote tallies).

## <decisions>

All decisions below were auto-selected in `--auto` mode using the recommended option from research and roadmap analysis. Full Q&A audit trail lives in `09-DISCUSSION-LOG.md`.

### D-9-01 — Decay time constant τ = 1000 ticks (per-Grid config)

- **τ = 1000 ticks** as the default for `relationship.decay_tau_ticks`, configurable per Grid via `GridConfig`.
- Half-life ≈ 693 ticks (≈11.5 min at `tickRateMs=1000`, ≈12 days at typical researcher tick rates). Unobserved edges cool to < 0.05 weight after ~3000 ticks (3τ).
- Formula applied ONLY when an edge is *touched* this tick (O(edges_touched_this_tick)); edges not touched are lazy-recomputed at read time using `weight × exp(-(currentTick - recency_tick) / τ)`. Zero per-tick O(N²) sweep.
- Resolves ROADMAP Open Question #1.

### D-9-02 — Valence derivation: deterministic event-class mapping (no plaintext)

Valence bump per observed audit event, applied to the sorted-DID-pair edge of the participants, clamped after each bump to `[-1.0, +1.0]`:

| Source event | Valence bump | Weight bump | Rationale |
|---|---|---|---|
| `nous.spoke` (bidirectional within DialogueAggregator window) | `+0.01` | `+0.02` | Low-signal positive (cheap, frequent) |
| `trade.settled` | `+0.10` | `+0.10` | High-signal positive (committed cooperation) |
| `trade.reviewed` with `verdict='rejected'` | `-0.10` | `+0.05` | Interaction occurred but rejected — negative valence, moderate engagement |
| `telos.refined` (if `triggered_by_dialogue_id` participants match the pair) | `+0.05` | `+0.05` | Shared refinement — relationship shaped mutual goal |

All bump constants live in `grid/src/relationships/config.ts` as frozen constants; per-Grid overridable via config for researcher rigs. No plaintext (utterance text, prices, goal text) ever touched — valence is a pure function of `(event_type, verdict_field, participant_dids)`.

### D-9-03 — Storage: in-memory Map + periodic MySQL snapshot + rebuild-from-chain

- Primary state: `Map<sortedPairKey, Edge>` inside `RelationshipListener` (private field, pure-observer discipline).
- `sortedPairKey = ${minDid}|${maxDid}` — DID pair is undirected; self-loops rejected at producer boundary (T-09-08 mitigation).
- MySQL `relationships` table: derived snapshot, written every 100 ticks (reuses Phase 1 snapshot cadence). Schema: `(edge_key PK, did_a, did_b, valence DECIMAL(4,3), weight DECIMAL(4,3), recency_tick BIGINT, last_event_hash VARCHAR(64), snapshot_tick BIGINT)`.
- On Grid restart: `RelationshipListener.rebuildFromChain()` replays `AuditChain.loadEntries()` in order, re-applying bump rules. Idempotent test: rebuild must produce `Map` byte-identical to live state at matching tick (canonical JSON serialize + SHA-256 compare).
- Migration file: `sql/009_relationships.sql`.

### D-9-04 — Listener wiring: construct AFTER existing aggregator (zero-diff preserved)

In `GenesisLauncher` constructor:
```
this.audit = new AuditChain(...)                // Phase 1
this.aggregator = new DialogueAggregator(       // Phase 7
  this.audit, dialogueConfig
)
this.relationships = new RelationshipListener(  // NEW — Phase 9
  this.audit, relationshipConfig
)
```

Zero-diff test (`grid/test/relationships/zero-diff.test.ts`) asserts byte-identical `entries[].eventHash` under fixed `vi.setSystemTime()` with vs without the listener — clones `grid/test/dialogue/zero-diff.test.ts` template verbatim. `reset()` is called from the existing `GenesisLauncher` pause/resume hook (D-04 pattern) so the in-memory Map does not span pause boundaries.

### D-9-05 — Sole-producer boundary: exactly one writer file

- **All mutation of the edge Map flows through** `grid/src/relationships/listener.ts`. No other file touches the Map directly.
- **All mutation of MySQL `relationships` table flows through** `grid/src/relationships/storage.ts` (called only from the listener's snapshot hook).
- Grep gate: `grid/test/relationships/producer-boundary.test.ts` searches `grid/src/**` for direct mutation patterns (`relationships.upsert`, `.set(`, direct SQL writes to the table). Only the two authorized files may match. Mirrors Phase 8 `nous-deleted-producer-boundary.test.ts`.
- T-09-06 (CRITICAL) mitigation.

### D-9-06 — Tier-graded privacy surface (T-09-07 mitigation)

Three endpoint variants, tier-gated:

| Endpoint | Tier | Payload shape | Purpose |
|---|---|---|---|
| `GET /api/v1/nous/:did/relationships?top=N` | H1 (default) | `[{counterparty_did, warmth_bucket: 'cold'\|'warm'\|'hot', recency_tick, edge_hash}]` ordered by numeric weight but weight NOT in response | Public dashboard + Inspector default |
| `GET /api/v1/nous/:did/relationships?top=N&tier=H2` | H2 | `[{counterparty_did, valence, weight, recency_tick, edge_hash}]` — numeric floats | Operator partner-tier inspection |
| `GET /api/v1/operator/relationships/:edge_key/events` | H5 | `{edge, events: [{event_hash, tick, event_type, payload}]}` — raw audit turns for that pair | H5 sovereign per-edge inspection |

- Warmth bucket thresholds (fixed MVP): `weight < 0.2 → cold`, `0.2 ≤ weight < 0.6 → warm`, `weight ≥ 0.6 → hot`.
- H2 and H5 requests emit `operator.inspected` audit entry (reuses Phase 6 memory-query pattern — NOT a new allowlist member).
- H5 edge-event endpoint returns entries already in the chain; pure read, zero-diff preserved.
- Default-tier (H1) responses exclude raw floats by construction — privacy matrix asserts `weight|valence` keys NEVER appear in H1 response shape.

### D-9-07 — Top-N default: N = 5; single-query N+1 mitigation

- `/relationships?top=5` is canonical (per ROADMAP success criterion #4). Client may request up to `top=20`; higher values capped server-side.
- Inspector uses `useSWR` with key `[did, floor(currentTick / 100)]` — one batched fetch per Nous per 100-tick window. T-09-11 (MEDIUM) mitigation.
- Full-graph endpoint: `GET /api/v1/grid/relationships/graph?minWarmth=warm` returns `{edges: [{did_a, did_b, warmth_bucket, edge_hash}], nodes: [{did, aggregate_warmth_bucket}]}` — H1+ default. No floats.

### D-9-08 — Graph view: vanilla SVG with deterministic layout

- Dashboard `/grid/relationships` renders vanilla SVG (zero new dependency). Node positions derived from SHA-256(did) → deterministic angle/radius on a unit circle; edges drawn only for `warmth_bucket ≥ warm`.
- Force-directed layout (d3-force / react-force-graph) **deferred** to v2.3 or until N>50 Nous observed in researcher rigs (Phase 14).
- `scripts/check-relationship-graph-deps.mjs`: grep gate asserts no `d3-force|react-force-graph|cytoscape|graphology` imports introduced in Phase 9.

### D-9-09 — Performance budget: O(edges_touched_this_tick); 10K-edge p95 <100ms

- Per-tick cost: `O(events_this_tick × participants_per_event)` — at most 2 edges mutated per audit event.
- Read endpoint cost: `O(edges_for_did)` — bounded by degree. Top-5 selection uses a bounded partial sort.
- Regression benchmark `grid/test/relationships/load-10k.test.ts`: spawn 100 Nous × 100 pairwise edges = 10K edges seeded; `GET /relationships?top=5` p95 <100ms measured over 1000 requests. Runs weekly in CI, not per-commit (matches Phase 8 perf-bench cadence).
- Decay is **lazy** (computed at read time using `recency_tick`), not per-tick — avoids O(N²) sweep entirely.

### D-9-10 — Canonical edge serialization (rebuild-determinism lock)

Edge serialization for hash computation + rebuild comparison locks key order:
```
canonicalEdge(edge) = JSON.stringify({
  did_a: edge.did_a,        // lexicographically smaller DID
  did_b: edge.did_b,        // lexicographically larger DID
  valence: edge.valence.toFixed(3),
  weight: edge.weight.toFixed(3),
  recency_tick: edge.recency_tick,
  last_event_hash: edge.last_event_hash,
})
```
Six keys, locked order, three-decimal fixed-point for floats (avoids float-repr drift across Node versions). Matches Phase 8 D-07 canonical key-order pattern. `edge_hash = sha256(canonicalEdge(edge))` is what the H1 endpoint returns.

### D-9-11 — Self-loop rejection at producer boundary

- `RelationshipListener.processEntry()` rejects events where `from_did === to_did` silently (no throw, no audit emit) — pure observer discipline.
- `appendEdge` helper: `assert(didA !== didB)` at boundary. T-09-08 (HIGH) mitigation.
- Regression test: `self-edge-rejection.test.ts` emits `nous.spoke` with self-DID and asserts no edge materialized.

### D-9-12 — Wall-clock ban in relationships module

- Grep gate `grid/test/relationships/determinism-source.test.ts` rejects `Date\.now|performance\.now|setInterval|setTimeout|Math\.random` in `grid/src/relationships/**`. Clones Phase 7 `dialogue-determinism-source.test.ts`.
- All timing is driven by `entry.payload.tick` (D-07 inherited). T-09-09 (HIGH, ported from reputation) mitigation.

### D-9-13 — Zero new allowlist members (hard invariant)

- `grid/src/audit/broadcast-allowlist.ts` member count stays at **18** (validated by `scripts/check-state-doc-sync.mjs`).
- `relationship.warmed` / `relationship.cooled` threshold events: **deferred to REL-EMIT-01** (out-of-scope, per ROADMAP). If emergent research demand appears in Phase 14 rigs, gated via explicit per-phase addition with closed-tuple + privacy matrix + sole producer + doc-sync in the same commit.
- Test `grid/test/relationships/no-audit-emit.test.ts`: run 1000-event scenario through `RelationshipListener`, assert `chain.length` unchanged by the listener (pure observer).

## <canonical_refs>

Files that plan + executor MUST read before making changes:

**Phase 9 upstream artifacts**
- `.planning/PROJECT.md` — v2.2 Active requirements, invariants (allowlist freeze, zero-diff, hash-only, closed-tuple, first-life, DID regex), key decisions
- `.planning/REQUIREMENTS.md` — REL-01..04 full spec (REL-01 pure-observer + O(edges_touched_this_tick); REL-02 edge tuple + idempotent rebuild; REL-03 `weight × exp(-Δtick / τ)`; REL-04 tier-graded Inspector + 10K-edge p95 <100ms)
- `.planning/STATE.md` — 18-event allowlist enumeration, v2.1 Phase 5–8 accumulated decisions, current-focus marker "Phase 9 (next to plan)"
- `.planning/ROADMAP.md` lines 30–47 — Phase 9 entry: goal, success criteria, scope, out-of-scope, risks (T-09-06, T-09-07, T-09-11), Open Question #1 (τ default)
- `.planning/research/v2.2/ARCHITECTURE.md` §2 Theme 2 + §5 Pattern 4 (pure-observer) + §6 R4–R5
- `.planning/research/v2.2/PITFALLS.md` T-09-06, T-09-07, T-09-08, T-09-09, T-09-10, T-09-11
- `.planning/research/v2.2/FEATURES.md` REL section
- `.planning/research/v2.2/SUMMARY.md` Theme 2 Theme Map entry; allowlist growth forecast (Theme 2 = 0)
- `PHILOSOPHY.md` §1 sovereignty, §7 visible tier mandate
- `CLAUDE.md` doc-sync rule

**v2.1 pattern exemplars (clone these)**
- `grid/src/dialogue/aggregator.ts` — pure-observer listener skeleton (lines 50–68 construction; lines 80–98 drain pattern; line 67 `onAppend` subscription)
- `grid/src/audit/chain.ts` — `AuditChain.onAppend` surface (lines 50–58)
- `grid/src/audit/broadcast-allowlist.ts` — 18-event frozen allowlist; `FORBIDDEN_KEY_PATTERN`
- `grid/src/audit/append-telos-refined.ts` — sole-producer + closed-tuple skeleton
- `grid/src/audit/append-nous-deleted.ts` — Phase 8 tombstone sole-producer pattern
- `grid/src/integration/nous-runner.ts` — action dispatch, authority-check pattern
- `grid/src/integration/grid-coordinator.ts` — per-tick aggregator wiring (lines 42–51 pattern to clone for relationships drain)
- `grid/src/genesis/launcher.ts` — launcher constructor order (audit → aggregator → NEW: relationships)
- `grid/src/db/grid-store.ts` / `grid/src/db/persistent-chain.ts` — MySQL snapshot pattern (Phase 1/2)
- `grid/src/clock/` — WorldClock pause/resume zero-diff (Phase 6 regression hash `c7c49f49...`)

**v2.1 test exemplars (clone these)**
- `grid/test/dialogue/zero-diff.test.ts` — zero-diff template (listener count 0 vs N produces byte-identical chain head under `FIXED_TIME`)
- `grid/test/dialogue/aggregator.test.ts` — unit test pattern for observer
- `grid/test/audit/telos-refined-producer-boundary.test.ts` — grep gate skeleton
- `grid/test/audit/operator-payload-privacy.test.ts` — privacy-matrix template (extend for relationship H1 endpoint shape)
- `grid/test/registry/tombstone.test.ts` — tombstoneCheck integration
- `grid/test/integration/audit-no-purge.test.ts` — first-life regression reuse
- `grid/test/worldclock-zero-diff.test.ts` — pause/resume regression

**Files the plan will CREATE (new in Phase 9)**
- `grid/src/relationships/listener.ts` — sole writer of in-memory Map; `onAppend` subscriber; `drainPending` and `getTopNFor(did, n)` read API
- `grid/src/relationships/storage.ts` — MySQL `relationships` table snapshot + load; sole writer of SQL table
- `grid/src/relationships/types.ts` — `Edge`, `RelationshipConfig`, `WarmthBucket` types
- `grid/src/relationships/config.ts` — frozen bump constants + τ default
- `grid/src/relationships/canonical.ts` — `canonicalEdge(edge)` serialization + `edgeHash` helper
- `grid/src/relationships/index.ts` — barrel exports
- `grid/src/api/nous/relationships.ts` — H1 and H2 endpoints
- `grid/src/api/operator/relationships.ts` — H5 edge-events endpoint
- `grid/src/api/grid/relationships-graph.ts` — H1+ full-graph endpoint
- `sql/009_relationships.sql` — derived table migration
- `dashboard/src/components/inspector/relationship-panel.tsx` — per-Nous top-N panel
- `dashboard/src/app/grid/relationships/page.tsx` — full-graph view (vanilla SVG)
- `grid/test/relationships/zero-diff.test.ts`
- `grid/test/relationships/producer-boundary.test.ts`
- `grid/test/relationships/determinism-source.test.ts`
- `grid/test/relationships/self-edge-rejection.test.ts`
- `grid/test/relationships/no-audit-emit.test.ts`
- `grid/test/relationships/idempotent-rebuild.test.ts`
- `grid/test/relationships/load-10k.test.ts` (weekly CI)
- `grid/test/api/relationships-privacy.test.ts` — H1/H2/H5 shape matrix

## <code_context>

**Repo layout observed** (`grid/src/` tree): `api/ audit/ clock/ db/ dialogue/ economy/ entrypoint.ts genesis/ index.ts integration/ logos/ main.ts registry/ review/ space/ util/`. The new `grid/src/relationships/` directory parallels `grid/src/dialogue/` and `grid/src/review/` exactly. No existing relationship-adjacent code found — clean slate.

**Listener construction model** (observed in `grid/src/dialogue/aggregator.ts:50–68`):
- Constructor takes `audit: AuditChain` + `config: AggregatorConfig`.
- Single `this.audit.onAppend((entry) => this.handleEntry(entry))` subscription in constructor.
- Buffers mutate on every entry; no writes back to chain.
- `reset()` called from GenesisLauncher on pause.
- Per-DID `drainPending(did, currentTick)` read API, called from `GridCoordinator.tickRunners`.

**Clone points for RelationshipListener:**
- Subscribe in constructor → `handleEntry(entry)` dispatches by `entry.eventType`.
- `processSpokeEntry`, `processTradeSettledEntry`, `processTradeReviewedEntry`, `processTelosRefinedEntry` each mutate at most two edges (one per participant-pair perspective, but edge is undirected so only one Map key touched).
- `getTopNFor(did, n)` iterates edges where `did ∈ {did_a, did_b}`, applies lazy decay, returns ranked list. Called from `/relationships` route handler.
- `reset()` on pause — clears in-memory Map (MySQL snapshot persists; rebuilt on resume).

**MySQL pattern** (observed in existing `sql/0NN_*.sql` files): each migration declares tables + indexes; `grid/src/db/grid-store.ts` loads rows via typed queries. Relationship table adds 7th migration after 008_economy; snapshot write batch uses existing Phase 1 transaction pattern.

**Allowlist file status**: `grid/src/audit/broadcast-allowlist.ts` lists exactly 18 members (verified). `ALLOWLIST_MEMBERS.length === 18` asserted by `grid/test/audit/allowlist-eighteen.test.ts` and `scripts/check-state-doc-sync.mjs`. Phase 9 MUST NOT touch this file.

## <specifics>

### REL-01 — Pure observer

- Implementation shape: `class RelationshipListener` in `grid/src/relationships/listener.ts`; constructor signature matches `DialogueAggregator`.
- Zero-diff test clones `grid/test/dialogue/zero-diff.test.ts` under `grid/test/relationships/zero-diff.test.ts`.
- Performance: O(edges_touched_this_tick); lazy decay at read time only. Regression: `load-10k.test.ts` weekly CI.

### REL-02 — Edge primitive + idempotent rebuild

- Edge: `{from_did, to_did, valence: number, weight: number, recency_tick: number, last_event_hash: string}` where sorted-DID normalization means `from_did < to_did` lexicographically; external-facing fields expose `did_a/did_b` naming.
- MySQL table: see D-9-03. Snapshot cadence: every 100 ticks.
- Idempotent rebuild: `RelationshipListener.rebuildFromChain()` reads `AuditChain.loadEntries()` in order, replays bump rules, produces in-memory Map identical to live state. Test asserts canonical-JSON SHA-256 match.

### REL-03 — Deterministic decay

- Formula: `decayedWeight = edge.weight × Math.exp(-(currentTick - edge.recency_tick) / config.decayTauTicks)`
- Applied lazily at read time (top-N endpoint, graph endpoint) — NOT per-tick sweep.
- `config.decayTauTicks = 1000` default; per-Grid-configurable; rigs may override for long-horizon tests.
- No audit event emitted for decay.
- Determinism test: fixed-seed scenario over 500 ticks; assert `getTopNFor(didA, 5)` returns byte-identical ordered list on two runs.

### REL-04 — Inspector UI + tier-graded RPC

- Inspector panel: top-5 by weight, shown with warmth-bucket icons (cold=gray, warm=amber, hot=rose) at H1; numeric weights revealed via H2 tier elevation (uses existing `AgencyStore` + `useElevatedAction` Phase 6 pattern).
- Full graph: `/grid/relationships` page, vanilla SVG, aggregate warmth coloring only.
- H5 edge-events: `IrreversibilityDialog`-peer pattern? **Not required** — read is non-destructive; H5 gate suffices without copy-verbatim lock. Tier check + `operator.inspected` audit emit (existing Phase 6 event).
- Load test: `load-10k.test.ts` — 10K-edge graph, `/relationships?top=5` p95 <100ms.

### Config surface (new keys in GridConfig)

```typescript
interface RelationshipConfig {
  decayTauTicks: number;                    // default 1000
  valenceBumpSpoke: number;                 // default +0.01
  valenceBumpTradeSettled: number;          // default +0.10
  valenceBumpTradeRejected: number;         // default -0.10
  valenceBumpTelosRefined: number;          // default +0.05
  weightBumpSpoke: number;                  // default +0.02
  weightBumpTradeSettled: number;           // default +0.10
  weightBumpTradeRejected: number;          // default +0.05
  weightBumpTelosRefined: number;           // default +0.05
  snapshotIntervalTicks: number;            // default 100
  warmthColdMax: number;                    // default 0.20
  warmthWarmMax: number;                    // default 0.60
  maxTopN: number;                          // default 20
}
```

### Test coverage targets

- Unit: listener.test.ts (each bump rule), canonical.test.ts (serialization stability across Node versions), storage.test.ts (snapshot/restore round-trip)
- Integration: zero-diff.test.ts, no-audit-emit.test.ts, idempotent-rebuild.test.ts, self-edge-rejection.test.ts
- Grep gates: producer-boundary.test.ts, determinism-source.test.ts
- API: relationships-privacy.test.ts (H1 shape no floats; H2 numeric; H5 events list), top-n-bounds.test.ts
- Load (weekly CI): load-10k.test.ts

## <deferred>

Explicitly out-of-scope for Phase 9 — surfaced here so plan-phase does not wander:

- **`relationship.warmed` / `relationship.cooled` threshold events** — deferred to REL-EMIT-01 (v2.3 or later, gated by emergent research demand from Phase 14 rigs). If added, must ship with closed-tuple payload `{did_a, did_b, tick, before_bucket, after_bucket, edge_hash}` + sole producer + privacy matrix + allowlist growth in same commit.
- **Reputation-weighted voting** — anti-feature (SUMMARY.md §Anti-Features #2; VOTE-06). Not in Phase 9, not in Phase 12.
- **Relationship anomaly surfacing** (T-09-10 Sybil-bootstrap mitigation) — deferred to v2.3.
- **Force-directed graph layout** (d3-force / react-force-graph) — deferred; vanilla SVG only in Phase 9.
- **Relationship export in rig tarballs** — deferred to Phase 14 (RIG-04).
- **Replay reconstruction of relationship graph** — Phase 13 will recompute from audit chain using `RelationshipListener.rebuildFromChain()` as the pure function. No new Phase 9 surface required.
- **Trust score plaintext in audit payload** (T-09-07 anti-feature) — never. Hash-only at boundary; tier-graded at read API only.
- **Full-graph rendering of more than bucketed warmth at H1** — anti-feature; H1 never sees numeric weights.
- **Self-loops** — rejected at producer boundary.
