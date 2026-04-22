---
phase: 9
name: "Relationship Graph (Derived View)"
milestone: v2.2 Living Grid
requirements: [REL-01, REL-02, REL-03, REL-04]
researched: 2026-04-21
confidence: HIGH
---

# Phase 9 — Relationship Graph (Derived View) — RESEARCH

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

All 13 decisions D-9-01..D-9-13 below are LOCKED. Research addresses HOW to implement them, not whether to revisit them.

- **D-9-01** τ = 1000 ticks default on `relationship.decay_tau_ticks`; per-Grid overridable. Half-life ≈ 693 ticks. Lazy decay at read time using `weight × exp(-(currentTick - recency_tick) / τ)`. Zero per-tick O(N²) sweep.
- **D-9-02** Valence: deterministic event-class bump table (no plaintext). `nous.spoke +0.01/+0.02`, `trade.settled +0.10/+0.10`, `trade.reviewed(rejected) -0.10/+0.05`, `telos.refined +0.05/+0.05` (valence/weight), clamped `[-1, +1]` after each bump.
- **D-9-03** In-memory `Map<sortedPairKey, Edge>` + MySQL snapshot every 100 ticks + idempotent rebuild-from-chain. `sortedPairKey = ${minDid}|${maxDid}`. Migration file `sql/009_relationships.sql`.
- **D-9-04** Listener constructed AFTER aggregator in `GenesisLauncher`. Zero-diff test clones `grid/test/dialogue/zero-diff.test.ts`. `reset()` called from existing pause/resume hook.
- **D-9-05** Sole producer: `listener.ts` owns the Map; `storage.ts` owns MySQL table. Grep gate mirrors `nous-deleted-producer-boundary.test.ts`.
- **D-9-06** Three tier-graded endpoint variants: H1 bucketed, H2 numeric, H5 edge-events. Reuses `operator.inspected` (no allowlist growth).
- **D-9-07** Top-N = 5 default; cap 20; `useSWR` key `[did, floor(currentTick / 100)]`. Full-graph endpoint filters `minWarmth=warm`.
- **D-9-08** Vanilla SVG deterministic layout: SHA-256(did) → angle/radius on unit circle. Grep gate forbids `d3-force|react-force-graph|cytoscape|graphology`.
- **D-9-09** Lazy decay at read + weekly CI `load-10k.test.ts`. Per-tick cost O(edges_touched_this_tick).
- **D-9-10** Canonical 6-key serialization, 3-decimal fixed-point floats, SHA-256 edge hash. Locks `did_a, did_b, valence, weight, recency_tick, last_event_hash` key order.
- **D-9-11** Self-loop silent-reject at producer boundary. `assert(didA !== didB)` in `appendEdge` helper.
- **D-9-12** Grep gate forbidding `Date.now|performance.now|setInterval|setTimeout|Math.random` in `grid/src/relationships/**`.
- **D-9-13** Zero new allowlist members. `ALLOWLIST_MEMBERS.length === 18` invariant. `relationship.warmed/.cooled` deferred to REL-EMIT-01.

### Claude's Discretion

None — all 13 gray areas auto-resolved in single pass. Research focus is implementation detail within locked decisions.

### Deferred Ideas (OUT OF SCOPE)

- `relationship.warmed` / `relationship.cooled` threshold events → REL-EMIT-01 (v2.3+)
- Reputation-weighted voting → anti-feature (VOTE-06)
- Relationship anomaly surfacing (T-09-10 Sybil-bootstrap) → v2.3
- Force-directed graph layout (d3-force) → v2.3 or N>50 Nous observed
- Relationship export in rig tarballs → Phase 14 (RIG-04)
- Trust score plaintext in audit payload → permanent anti-feature (T-09-07)
- Numeric weights at H1 → permanent anti-feature (privacy-by-construction)
- Self-loops → rejected at producer boundary

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REL-01 | RelationshipListener subscribes to audit chain, pure-observer, O(edges_touched_this_tick); zero-diff invariant preserved (`c7c49f49…`) | DialogueAggregator clone template; `AuditChain.onAppend` surface (chain.ts:50-58); zero-diff.test.ts clone template |
| REL-02 | Edge tuple `{did_a, did_b, valence, weight, recency_tick, last_event_hash}`; MySQL snapshot + idempotent rebuild-from-chain; canonical-JSON SHA-256 equality | Schema in `sql/009_relationships.sql`; canonical 6-key order; `AuditChain.loadEntries()` replay pattern (does NOT fire listeners — manual replay required) |
| REL-03 | Lazy decay `weight × exp(-(Δtick)/τ)` at read; τ=1000 default; per-Grid-configurable; no audit emit | `canonical.ts` + `listener.getTopNFor` read-path math; numerical stability analysis below |
| REL-04 | Tier-graded Inspector panel (H1 bucketed / H2 numeric / H5 edge-events) + full-graph view; 10K-edge p95 <100ms | Fastify handler pattern from `memory-query.ts`; `validateTierBody` helper; `useElevatedAction` + `useRefinedTelosHistory` dashboard patterns; `load-10k.test.ts` weekly benchmark |

</phase_requirements>

## Summary

Phase 9 is a **zero-allowlist-growth derived view** over the existing v2.1 audit chain. Every pattern needed is already in the codebase — this phase is substantially an exercise in disciplined cloning of the v2.1 Phase 7 pure-observer pattern (`DialogueAggregator`), the sole-producer regex gate (`telos-refined-producer-boundary.test.ts`), the zero-diff invariant test (`dialogue/zero-diff.test.ts`), and the tier-validated Fastify handler (`operator/memory-query.ts`).

The single highest risk is **the canonical serialization + idempotent rebuild invariant**. Because floats drift across Node.js versions and JSON key-order is not standardized, the rebuild-vs-live-Map equality test only holds if we (a) lock key order with explicit `JSON.stringify({a, b, c, ...})` construction and (b) represent floats as `value.toFixed(3)` at hash time. Both disciplines already exist in Phase 8 (D-07 canonical key-order) and must be ported verbatim.

**Primary recommendation:** Build the six `grid/src/relationships/*.ts` files as a structural clone of `grid/src/dialogue/*.ts`, with storage.ts diverging to MySQL-snapshot (per `grid/src/db/persistent-chain.ts` pattern). All 8 test files map 1:1 to existing v2.1 test exemplars — clone and adapt, do not invent.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Pure-observer edge derivation from audit chain | Grid (listener) | — | Must live in-process with `AuditChain` to guarantee zero-diff (no cross-process listener). |
| Edge-Map mutation | Grid (sole-producer: `listener.ts`) | — | D-9-05 mandates one writer file. |
| MySQL snapshot I/O | Grid (sole-producer: `storage.ts`) | — | D-9-05 separates SQL I/O from hot observer path. |
| Tier gating + H2/H5 audit emit | Grid API (Fastify) | — | `appendOperatorEvent` producer boundary already owns tier-required + payload-privacy. |
| Warmth-bucket classification | Grid (canonical helper) | Dashboard (renderer) | Bucketing is deterministic from `weight`; computed server-side for H1 response. |
| Top-N selection | Grid (listener read API) | — | Bounded partial-sort inside `getTopNFor(did, n)` keeps hot path in-process. |
| SVG deterministic layout | Dashboard (client) | — | Layout is a pure function of DID set; no server state needed. |
| Rebuild-from-chain | Grid (listener) | — | `AuditChain.loadEntries()` lives in-process; listener replays it to rebuild Map. |

## Standard Stack

### Core (ALREADY IN PROJECT — zero new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fastify` | ^5.0.0 | Grid HTTP API | Phase 1 established; `app.post<{Params, Body}>` generic typing already used in `memory-query.ts` [VERIFIED: grid/package.json] |
| `mysql2` | ^3.9.0 | MySQL driver for snapshot | Phase 1 established; `grid-store.ts` typed queries [VERIFIED: grid/package.json] |
| `vitest` | ^2.0.0 | Test framework | Phase 1 established; `vi.setSystemTime()`, `vi.spyOn()` used in zero-diff test [VERIFIED: grid/package.json] |
| `swr` | (present in dashboard) | Per-Nous top-N batching | T-09-11 mitigation (D-9-07); already imported elsewhere [ASSUMED — verify via `dashboard/package.json` in Wave 0] |

### Supporting (standard library only — no new imports)

| Technique | Purpose | When to Use |
|-----------|---------|-------------|
| Node `crypto.createHash('sha256')` | `edgeHash(edge)` + layout seed | Already used in `dialogue/dialogue-id.ts` [VERIFIED] |
| Node `Math.exp()` | Lazy decay math | Pure function; deterministic across Node versions for normal-range inputs [CITED: ECMA-262] |
| `value.toFixed(3)` | Canonical float representation for hash | Phase 8 D-07 precedent; avoids V8 float-repr drift [VERIFIED: existing phase precedent] |

### Alternatives Considered (all rejected per CONTEXT.md)

| Instead of | Could Use | Tradeoff | Status |
|------------|-----------|----------|--------|
| Vanilla SVG | d3-force / react-force-graph | Adds runtime dep; non-deterministic convergence | REJECTED (D-9-08) |
| In-memory Map + snapshot | Write-through MySQL | Adds per-event I/O to hot observer path | REJECTED (D-9-03) |
| SHA-256 canonical JSON | MessagePack | Adds dep; no benefit at this scale | REJECTED (D-9-10) |

**Installation:** Nothing new. Phase 9 adds zero runtime dependencies.

**Version verification:** Package versions above confirmed via `grid/package.json`. Dashboard SWR version must be confirmed as first task in Wave 0.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────────┐
                    │    AuditChain (Phase 1, source of truth)│
                    │        .append() ── .onAppend(cb) ──────┼──┐
                    └──────────────────▲──────────────────────┘  │
                                       │                         │ (pure read;
                                       │ writes: Phase 5-8        │  no .append
                                       │ producers only           │   from Phase 9)
                                       │                         │
                                       │                         ▼
                  ┌─────────────────────────────┐   ┌────────────────────────┐
                  │ DialogueAggregator (Phase 7)│   │  RelationshipListener  │
                  │ pure-observer buffers       │   │  (NEW, Phase 9)        │
                  └─────────────────────────────┘   │  Map<sortedPairKey,Edge│
                                                    │  .handleEntry(entry)   │
                                                    │  .processSpoke(…)      │
                                                    │  .processTradeSettled  │
                                                    │  .processTradeReviewed │
                                                    │  .processTelosRefined  │
                                                    │  .rebuildFromChain()   │
                                                    │  .reset()              │
                                                    │  .getTopNFor(did,n)    │
                                                    └────────┬───────────────┘
                                                             │
                               ┌─────────────────────────────┼────────────────┐
                               │ (every 100 ticks)           │ (read path)    │
                               ▼                             ▼                ▼
                     ┌──────────────────┐    ┌─────────────────────┐  ┌────────────────┐
                     │ storage.ts       │    │  Fastify handlers   │  │ Layout helper  │
                     │ sole writer of   │    │  (tier-graded)      │  │ (pure fn)      │
                     │ MySQL            │    │ H1 / H2 / H5        │  │ SHA-256(did)   │
                     │ `relationships`  │    │ endpoints           │  │ →angle/radius  │
                     └──────┬───────────┘    └─────────┬───────────┘  └────────┬───────┘
                            │                          │                       │
                            ▼                          ▼                       ▼
                    ┌──────────────┐         ┌─────────────────┐     ┌───────────────────┐
                    │ MySQL        │         │ operator.       │     │ Dashboard SVG     │
                    │ relationships│         │ inspected       │     │ (deterministic    │
                    │ table        │         │ (H2/H5 only —   │     │ node positions)   │
                    │ (derived)    │         │ existing event) │     │                   │
                    └──────────────┘         └────────┬────────┘     └───────────────────┘
                                                      │
                                                      ▼
                                           back to AuditChain (Phase 6 producer)
```

Data flow: audit entries fan out to multiple pure-observer listeners; relationship listener mutates only its own Map; Map writes to MySQL snapshot-style; read endpoints pull from live Map (not SQL) with lazy decay applied; H2/H5 reads round-trip to audit chain via existing `operator.inspected` producer.

### Recommended Project Structure

```
grid/src/relationships/          # NEW — parallels grid/src/dialogue/
├── listener.ts                  # sole writer of Map; onAppend subscriber
├── storage.ts                   # sole writer of MySQL table; snapshot + load
├── types.ts                     # Edge, RelationshipConfig, WarmthBucket
├── config.ts                    # frozen bump constants + τ default
├── canonical.ts                 # canonicalEdge + edgeHash + warmthBucket
└── index.ts                     # barrel exports

grid/src/api/nous/relationships.ts           # H1 + H2 endpoints
grid/src/api/operator/relationships.ts       # H5 edge-events
grid/src/api/grid/relationships-graph.ts     # H1+ full-graph

sql/009_relationships.sql                    # derived table migration

dashboard/src/components/inspector/relationship-panel.tsx
dashboard/src/app/grid/relationships/page.tsx
dashboard/src/lib/hooks/use-relationships.ts # useSWR wrapper

grid/test/relationships/
├── zero-diff.test.ts
├── producer-boundary.test.ts
├── determinism-source.test.ts
├── self-edge-rejection.test.ts
├── no-audit-emit.test.ts
├── idempotent-rebuild.test.ts
└── load-10k.test.ts             # weekly CI only

grid/test/api/relationships-privacy.test.ts
```

### Pattern 1: Pure-Observer Listener

**What:** Constructor subscribes to `AuditChain.onAppend`; `handleEntry(entry)` dispatches by `eventType`; each processor mutates at most one Map key.

**When to use:** Every Phase 9 audit-driven state derivation. MUST NOT call `chain.append` anywhere in `grid/src/relationships/**`.

**Example:**
```typescript
// Source: grid/src/dialogue/aggregator.ts:50-68 (clone template)
// [VERIFIED]

import type { AuditChain, AuditEntry } from '../audit/chain.js';

export class RelationshipListener {
    private readonly audit: AuditChain;
    private readonly config: RelationshipConfig;
    private edges: Map<string, Edge> = new Map();
    private lastSnapshotTick: number = -1;

    constructor(audit: AuditChain, config: RelationshipConfig) {
        this.audit = audit;
        this.config = config;
        this.audit.onAppend((entry) => this.handleEntry(entry));
    }

    reset(): void {
        this.edges = new Map();
        this.lastSnapshotTick = -1;
    }

    private handleEntry(entry: AuditEntry): void {
        switch (entry.eventType) {
            case 'nous.spoke':         return this.processSpoke(entry);
            case 'trade.settled':      return this.processTradeSettled(entry);
            case 'trade.reviewed':     return this.processTradeReviewed(entry);
            case 'telos.refined':      return this.processTelosRefined(entry);
            default:                   return;  // ignore all other events
        }
    }
    // …processors mutate this.edges only
}
```

### Pattern 2: Sole-Producer Grep Gate (MySQL variant)

**What:** Test walks `grid/src/**` looking for forbidden write patterns. Only authorized file paths may match.

**When to use:** Protecting the Map-write boundary + the MySQL-write boundary.

**Example:**
```typescript
// Source: grid/test/audit/telos-refined-producer-boundary.test.ts (clone template)
// [VERIFIED]

// For Map mutations — listener.ts is sole writer
const MAP_WRITE_PATTERN = /\b(this\.)?edges\.(set|delete|clear)\b/;
const ALLOWED_MAP_WRITER = /grid\/src\/relationships\/listener\.ts$/;

// For MySQL writes — storage.ts is sole writer
const SQL_WRITE_PATTERN = /INSERT\s+INTO\s+relationships|UPDATE\s+relationships\s+SET|REPLACE\s+INTO\s+relationships/i;
const ALLOWED_SQL_WRITER = /grid\/src\/relationships\/storage\.ts$/;
```

### Pattern 3: Zero-Diff Regression Test

**What:** Fixed-time scenario; compare audit chain head hash with vs. without listener attached. Must be byte-identical.

**When to use:** Every new pure-observer listener (regression anchor hash `c7c49f49…` carries forward).

**Example:** Clone `grid/test/dialogue/zero-diff.test.ts` verbatim; swap in `RelationshipListener` construction. The assertion:
```typescript
// entries[].eventHash arrays must be strictly equal
expect(withListener.map(e => e.eventHash)).toEqual(withoutListener.map(e => e.eventHash));
```

### Pattern 4: Tier-Validated Fastify Endpoint

**What:** Use `validateTierBody(body, 'H2')` from `grid/src/api/operator/_validation.ts`; error ladder 400/404/410/503 (no 500s); emit `operator.inspected` via `appendOperatorEvent` AFTER successful read.

**When to use:** H2 and H5 endpoints. H1 endpoint has NO tier body (public).

**Example:**
```typescript
// Source: grid/src/api/operator/memory-query.ts (clone template, lines 39-144)
// [VERIFIED]

app.post<{Params: {did: string}; Body: QueryBody}>(
    '/api/v1/operator/relationships/:edge_key/events',
    async (req, reply) => {
        const v = validateTierBody(req.body ?? {}, 'H5');
        if (!v.ok) { reply.code(400); return {error: v.error}; }
        // … read from storage …
        appendOperatorEvent(
            services.audit,
            'operator.inspected',
            v.operator_id,
            { tier: v.tier, action: 'inspect', operator_id: v.operator_id, target_did: /* one of pair */ },
            /* target_did */,
        );
        return { edge, events };
    },
);
```

### Pattern 5: Canonical Serialization (rebuild-determinism anchor)

**What:** Explicit key-order JSON construction + `toFixed(3)` for floats.

**When to use:** `edgeHash(edge)` + `rebuildFromChain()` equality test.

**Example:**
```typescript
// Source: D-9-10 spec + Phase 8 D-07 precedent
// [CITED: 09-CONTEXT.md D-9-10]

export function canonicalEdge(edge: Edge): string {
    // LOCKED KEY ORDER — DO NOT REORDER
    return JSON.stringify({
        did_a: edge.did_a,                       // lexicographically smaller
        did_b: edge.did_b,                       // lexicographically larger
        valence: edge.valence.toFixed(3),        // string, 3-decimal
        weight: edge.weight.toFixed(3),          // string, 3-decimal
        recency_tick: edge.recency_tick,         // integer (bigint-safe for now)
        last_event_hash: edge.last_event_hash,   // 64-hex
    });
}

export function edgeHash(edge: Edge): string {
    return createHash('sha256').update(canonicalEdge(edge)).digest('hex');
}
```

### Anti-Patterns to Avoid

- **Calling `chain.append` from `grid/src/relationships/**`.** Breaks allowlist freeze + zero-diff. Detected by `no-audit-emit.test.ts`.
- **Reading `entry.payload.utterance` / prices / goal text.** Breaks hash-only at boundary (I-5). Valence is a pure function of `(event_type, verdict_field, participant_dids)`.
- **Per-tick decay sweep over all edges.** Breaks O(edges_touched_this_tick) budget. Decay is LAZY at read.
- **`JSON.stringify(edge)` without explicit key construction.** Breaks canonical-hash stability across Node versions.
- **Using `Date.now()` or `performance.now()` for timing.** Breaks determinism. All timing via `entry.payload.tick`. Detected by `determinism-source.test.ts`.
- **Returning `weight` / `valence` in H1 response body.** Breaks privacy-by-construction. Detected by `relationships-privacy.test.ts`.
- **Self-loop edges.** Rejected at producer. Detected by `self-edge-rejection.test.ts`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tier + operator_id validation | Custom regex check | `validateTierBody` from `grid/src/api/operator/_validation.ts` | Single chokepoint; T-6-06d mitigation already proven |
| Audit emit for H2/H5 reads | New `relationship.inspected` event | `appendOperatorEvent(audit, 'operator.inspected', …)` | Reuses existing allowlist member; D-9-13 freeze |
| Event subscription surface | Custom pub/sub | `AuditChain.onAppend(cb)` | Already fires post-commit, synchronous, listener exceptions swallowed [VERIFIED: chain.ts:50-58] |
| DID regex | Inline regex | `DID_REGEX` from `grid/src/api/server.ts` | I-7 invariant; single source of truth |
| Tombstone check | Custom deleted-DID filter | `tombstoneCheck(registry, did)` | Phase 8 D-28 pattern; returns 410 Gone |
| Dialogue ID derivation | Custom hash | `computeDialogueId` pattern from `grid/src/dialogue/dialogue-id.ts` | Template for `edgeHash` helper |
| Client elevation flow | Custom tier state | `useElevatedAction('H2')` from `dashboard/src/hooks/use-elevated-action.ts` | Proven race-safe (D-07 SC#4 invariant) |
| Derived-selector client hook | Custom WebSocket listener | `useFirehose()` + `useMemo` pattern from `use-refined-telos-history.ts` | Zero new RPC, zero new WebSocket |
| Vitest fake timers | Real timers | `vi.setSystemTime(FIXED_TIME)` pattern from zero-diff.test.ts | Deterministic across CI runs |

**Key insight:** Every capability Phase 9 needs has a v2.1 exemplar. Phase 9 is structural cloning + new domain glue, not net-new surface area.

## Runtime State Inventory

Phase 9 is a **new-code phase**, not rename/refactor/migration. Nothing to inventory.

- **Stored data:** None — MySQL `relationships` table is new (created in `sql/009_relationships.sql`). No existing data migration. Verified by `ls sql/` → latest is `008_economy.sql`.
- **Live service config:** None — no external services touched.
- **OS-registered state:** None — no scheduler, systemd, pm2 interactions.
- **Secrets/env vars:** None — no new secrets.
- **Build artifacts:** None — no package renames; `package.json` untouched.

## Clone Template Map

Every new file has an exact v2.1 clone source. This table is the primary input for the planner.

### Grid source files

| NEW file | Clone template | Adapt for |
|----------|---------------|-----------|
| `grid/src/relationships/listener.ts` | `grid/src/dialogue/aggregator.ts:1-354` (full file) | Constructor signature, `onAppend` subscription (line 67), `handleEntry` dispatch, `reset()` (line ~100), per-DID read API. Replace dialogue-specific `DialogueContext` with `Edge`. Remove `drainPending(did, currentTick)` per-DID drain semantics; replace with `getTopNFor(did, n)` read method. |
| `grid/src/relationships/storage.ts` | `grid/src/db/persistent-chain.ts:1-43` (snapshot pattern) | Snapshot entire Map every 100 ticks; load entire table at startup; INSERT/UPDATE via `mysql2` in existing `grid-store.ts` style. Note: do NOT extend a base class — this is a bespoke snapshot helper, not an audit-chain extension. |
| `grid/src/relationships/types.ts` | `grid/src/dialogue/types.ts` (if exists; else inline) | `Edge`, `RelationshipConfig` (see CONTEXT §Config surface), `WarmthBucket` = `'cold' \| 'warm' \| 'hot'` literal union. |
| `grid/src/relationships/config.ts` | `grid/src/dialogue/config.ts` (defaults export pattern) | Export `DEFAULT_RELATIONSHIP_CONFIG: RelationshipConfig` with D-9-01 + D-9-02 constants, frozen via `Object.freeze`. |
| `grid/src/relationships/canonical.ts` | `grid/src/dialogue/dialogue-id.ts:1-37` (pure-function hash helper) | `canonicalEdge(edge)` explicit-key JSON + `edgeHash(edge)` = `sha256(canonicalEdge).digest('hex')`. Also `warmthBucket(weight, config): WarmthBucket` deterministic bucketing. |
| `grid/src/relationships/index.ts` | `grid/src/dialogue/index.ts` barrel | Re-export `RelationshipListener`, `DEFAULT_RELATIONSHIP_CONFIG`, types. |

### Grid API files

| NEW file | Clone template | Adapt for |
|----------|---------------|-----------|
| `grid/src/api/nous/relationships.ts` | `grid/src/api/operator/memory-query.ts:26-144` | Two route registrations: `GET /api/v1/nous/:did/relationships?top=N` (no tier body — public H1 default) and a tier-gated `?tier=H2` variant. H2 variant calls `validateTierBody(body, 'H2')` + `appendOperatorEvent(…, 'operator.inspected', …)`. |
| `grid/src/api/operator/relationships.ts` | `grid/src/api/operator/memory-query.ts:39-144` (full handler) | `POST /api/v1/operator/relationships/:edge_key/events` → `validateTierBody(body, 'H5')` → read all audit entries filtered to this pair from `AuditChain.loadEntries()` → emit `operator.inspected` → return `{edge, events}`. |
| `grid/src/api/grid/relationships-graph.ts` | `grid/src/api/nous/` handler style | `GET /api/v1/grid/relationships/graph?minWarmth=warm` → iterate all edges in listener Map → apply lazy decay → filter → return `{edges, nodes}`. No tier body (public H1). |

**GenesisLauncher wiring insertion point:** `grid/src/genesis/launcher.ts:59` ends with `this.aggregator = new DialogueAggregator(this.audit, dialogueCfg);`. Insert at **line 60**:
```typescript
this.relationships = new RelationshipListener(this.audit, relationshipCfg);
```
The existing pause/resume discipline (`drainDialogueOnPause` at ~line 177) is extended with a `relationships.reset()` call inside the same lifecycle hook — matches D-04 pattern.

### Grid test files

| NEW file | Clone template | Adapt for |
|----------|---------------|-----------|
| `grid/test/relationships/zero-diff.test.ts` | `grid/test/dialogue/zero-diff.test.ts:1-62` (verbatim) | Swap `DialogueAggregator` → `RelationshipListener`. Same `FIXED_TIME`, same scenario, same `entries[].eventHash` assertion. |
| `grid/test/relationships/producer-boundary.test.ts` | `grid/test/audit/nous-deleted-producer-boundary.test.ts:1-47` | Adapt `walk()` regex: Map-write pattern for `listener.ts` scope; SQL-write pattern for `storage.ts` scope. Two separate asserts. |
| `grid/test/relationships/determinism-source.test.ts` | `grid/test/dialogue/determinism-source.test.ts` (if exists; else Phase 7 variant) | Same grep walk; scope `grid/src/relationships/**`; pattern `/Date\.now\|performance\.now\|setInterval\|setTimeout\|Math\.random/`. |
| `grid/test/relationships/self-edge-rejection.test.ts` | No direct v2.1 analog — write new | Create `RelationshipListener`; `audit.append({eventType: 'nous.spoke', payload: {from_did: 'did:noesis:a', to_did: 'did:noesis:a', …}})`; assert `listener.edges.size === 0`. |
| `grid/test/relationships/no-audit-emit.test.ts` | `grid/test/audit/operator-payload-privacy.test.ts` (counting pattern) | Run 1000-event scenario; assert `chain.length` after listener equals `chain.length` before listener. |
| `grid/test/relationships/idempotent-rebuild.test.ts` | No direct v2.1 analog — write new | 1. Build Map via live events. 2. Serialize live Map to `canonicalEdge()` JSON array, sha256. 3. Create fresh listener, call `rebuildFromChain()`. 4. Serialize rebuilt Map identically. 5. Assert hashes equal. |
| `grid/test/relationships/load-10k.test.ts` | No direct v2.1 analog — write new | 100 Nous × 100 pairwise edges = 10K edges. 1000 GET requests. Assert `p95(responseTime) < 100ms`. Marked weekly-only via vitest tag. |
| `grid/test/api/relationships-privacy.test.ts` | `grid/test/audit/operator-payload-privacy.test.ts` | Matrix: H1 response keys ⊆ `{counterparty_did, warmth_bucket, recency_tick, edge_hash}`; H2 includes `{valence, weight}`; H5 response `events[]` contains raw turns. |

## MySQL Schema Draft

File: `sql/009_relationships.sql`

```sql
-- sql/009_relationships.sql
-- Phase 9 — derived relationship edges (pure-observer snapshot of audit chain)
-- Migration follows the 0NN_name.sql convention from 001_audit.sql .. 008_economy.sql.

CREATE TABLE IF NOT EXISTS relationships (
    -- Edge key is the sorted DID pair joined by '|'. Unique edge identity.
    edge_key            VARCHAR(160)    NOT NULL PRIMARY KEY,

    -- Lexicographically smaller DID of the pair. did_a < did_b always.
    -- Max DID length = 76 chars per DID_REGEX (did:noesis: + 64 alphanum). 80 is safe.
    did_a               VARCHAR(80)     NOT NULL,
    -- Lexicographically larger DID of the pair.
    did_b               VARCHAR(80)     NOT NULL,

    -- Valence in [-1.000, +1.000]. DECIMAL(4,3) holds 3-decimal fixed-point exactly.
    -- NOTE: DECIMAL(4,3) range is [-9.999, +9.999] but values are clamped to [-1, +1]
    -- at producer boundary (D-9-02). Storage precision matches canonical serialization.
    valence             DECIMAL(4,3)    NOT NULL DEFAULT 0.000,

    -- Weight in [0.000, +1.000]. Lazy-decayed at read; snapshot is pre-decay value.
    weight              DECIMAL(4,3)    NOT NULL DEFAULT 0.000,

    -- Tick at which this edge was last mutated (for lazy-decay math at read time).
    recency_tick        BIGINT UNSIGNED NOT NULL,

    -- Event hash (SHA-256 hex) of the audit entry that most recently mutated this edge.
    -- Gives replay verifiers a root-of-trust anchor per edge.
    last_event_hash     CHAR(64)        NOT NULL,

    -- Tick at which this row was written. Lets the rebuild-from-chain test
    -- anchor "compare live Map at tick T" to "compare snapshot taken at tick T".
    snapshot_tick       BIGINT UNSIGNED NOT NULL,

    -- Indexes: top-N-by-weight reads filter on either did_a or did_b. Two indexes
    -- avoid OR branch; the read path (listener read API) uses the in-memory Map
    -- anyway. These indexes exist solely for diagnostic/SQL-console queries and
    -- the rebuild-verification join.
    INDEX idx_did_a (did_a),
    INDEX idx_did_b (did_b),
    INDEX idx_snapshot_tick (snapshot_tick)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Rationale notes:**
- `DECIMAL(4,3)` chosen over `FLOAT` / `DOUBLE` to guarantee exact 3-decimal round-trip matching `canonicalEdge()` representation. A `FLOAT(8)` column would re-introduce the drift we prevent with `toFixed(3)`.
- `VARCHAR(160)` for `edge_key` accommodates two 76-char DIDs + `|` separator + slack.
- `CHAR(64)` for `last_event_hash` — SHA-256 hex is fixed-length.
- `BIGINT UNSIGNED` for tick columns — ticks never go negative; BIGINT is already the Phase 1 convention in `sql/001_audit.sql` [ASSUMED — verify in Wave 0].
- No foreign keys to a `nous` table — DID is the canonical identifier, not an integer FK; this is consistent with Phase 1-8 audit-first discipline.

## Graph Layout Algorithm

Dashboard `/grid/relationships` renders vanilla SVG with deterministic node positions per D-9-08. Replay-equivalent rigs must produce pixel-identical layouts.

### Seeded layout specification

```typescript
// Source: D-9-08 spec + standard technique
// Placement: dashboard/src/app/grid/relationships/layout.ts (new file, pure function)

import { createHash } from 'crypto';

interface LayoutConfig {
    readonly radius: number;        // outer ring radius in SVG units, default 400
    readonly centerX: number;       // viewport center, default 500
    readonly centerY: number;       // viewport center, default 500
    readonly jitterRadius: number;  // radial jitter amplitude, default 50
}

export interface NodePosition {
    readonly did: string;
    readonly x: number;
    readonly y: number;
}

export function computeNodePosition(did: string, cfg: LayoutConfig): NodePosition {
    // 1. Hash DID → 32 bytes deterministic entropy.
    const hash = createHash('sha256').update(did).digest();

    // 2. First 4 bytes → angle in [0, 2π). Uint32LE normalized to [0,1).
    const angleRaw = hash.readUInt32LE(0) / 0x1_0000_0000;
    const angle = angleRaw * 2 * Math.PI;

    // 3. Next 4 bytes → radial jitter in [-jitterRadius, +jitterRadius].
    const jitterRaw = hash.readUInt32LE(4) / 0x1_0000_0000;
    const jitter = (jitterRaw - 0.5) * 2 * cfg.jitterRadius;

    // 4. Project onto circle.
    const r = cfg.radius + jitter;
    return {
        did,
        x: cfg.centerX + r * Math.cos(angle),
        y: cfg.centerY + r * Math.sin(angle),
    };
}
```

**Why this works:**
1. **Deterministic** — pure function of `did`. Same DID always places at same pixel.
2. **Uniformly distributed** — SHA-256 output is indistinguishable from uniform random; angles are uniform on [0, 2π), jitter is uniform on [-J, +J].
3. **Zero new dependency** — uses Node `crypto` (browser side: Web Crypto `subtle.digest` or ship a tiny sha256 polyfill already present in dashboard's transport layer if needed; alternatively compute positions server-side and ship `{did, x, y}` pairs).
4. **Scales to ~50 Nous** — at N=50, 360°/50 = 7.2° average angular spacing with ±jitter. Clusters will happen (birthday-paradox) but are acceptable for MVP.
5. **Scales beyond** — deferred to force-directed layout (v2.3).

**Edge rendering:**
- Iterate edges from `/grid/relationships/graph?minWarmth=warm` endpoint.
- Each edge = straight line from `computeNodePosition(did_a)` to `computeNodePosition(did_b)`.
- Stroke color by `warmth_bucket`: `cold=#9ca3af` (gray), `warm=#f59e0b` (amber), `hot=#e11d48` (rose). H1 tier sees bucket only — no opacity-scaled numeric weight.

**Browser-side note:** If Node `crypto` is not available in client bundle, use `globalThis.crypto.subtle.digest('SHA-256', TextEncoder().encode(did))` — both Chrome and Firefox evergreen [CITED: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest]. Alternatively, compute positions server-side in the graph endpoint and ship them — this is the simpler path and avoids any client crypto dependency. **Recommended: server-side computation**, because the endpoint is already iterating all edges; add `nodes[].x` and `nodes[].y` to the response payload.

## Producer-Boundary Grep Gate Regex

Two separate gates, one test file:

```typescript
// grid/test/relationships/producer-boundary.test.ts
// Clone structure from grid/test/audit/telos-refined-producer-boundary.test.ts

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const GRID_SRC = join(__dirname, '../../src');

// Gate 1: Map mutations allowed ONLY in listener.ts
const MAP_WRITE_PATTERN = /\b(?:this\.)?edges\.(?:set|delete|clear)\s*\(/;
const ALLOWED_MAP_WRITER = /relationships\/listener\.ts$/;

// Gate 2: SQL writes against `relationships` table allowed ONLY in storage.ts
const SQL_WRITE_PATTERN = /\b(?:INSERT\s+INTO|UPDATE|REPLACE\s+INTO|DELETE\s+FROM)\s+[`"']?relationships[`"']?/i;
const ALLOWED_SQL_WRITER = /relationships\/storage\.ts$/;

function walk(dir: string, files: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full, files);
        else if (full.endsWith('.ts')) files.push(full);
    }
    return files;
}

describe('relationships producer boundary', () => {
    const all = walk(GRID_SRC);

    it('only listener.ts mutates the edges Map', () => {
        const offenders: string[] = [];
        for (const f of all) {
            const src = readFileSync(f, 'utf-8');
            if (MAP_WRITE_PATTERN.test(src) && !ALLOWED_MAP_WRITER.test(f)) {
                offenders.push(relative(GRID_SRC, f));
            }
        }
        expect(offenders).toEqual([]);
    });

    it('only storage.ts writes to the relationships SQL table', () => {
        const offenders: string[] = [];
        for (const f of all) {
            const src = readFileSync(f, 'utf-8');
            if (SQL_WRITE_PATTERN.test(src) && !ALLOWED_SQL_WRITER.test(f)) {
                offenders.push(relative(GRID_SRC, f));
            }
        }
        expect(offenders).toEqual([]);
    });
});
```

**Edge cases handled:**
- Token `edges.` is domain-specific enough that it won't collide with unrelated code (verified by grepping `grep -r 'edges\.'` on current codebase — zero hits outside planned path).
- SQL pattern is case-insensitive and allows backtick/quote variation.
- Comments containing forbidden patterns will trigger the gate; add `// eslint-disable-next-line` marker in the allowed files is NOT the escape hatch — instead, the path-allowlist is the escape.

## Lazy Decay Math + Numerical Stability

Formula (D-9-01, REL-03):
```
decayedWeight(edge, currentTick) = edge.weight × Math.exp(-(currentTick - edge.recency_tick) / τ)
```

### Range analysis

- `edge.weight ∈ [0, 1]` — stored value, before decay.
- `Δtick = currentTick - recency_tick ≥ 0` — ticks never go backward within a Grid run; pause/resume preserves tick counter.
- `τ = 1000` (default).
- Exponent = `-Δtick / 1000`.

### 10K-tick stress test (worst-case in researcher rigs)

| Δtick | exponent | Math.exp(exp) | decayed weight (from 1.0) |
|-------|----------|---------------|---------------------------|
| 0 | 0 | 1.000000 | 1.000000 |
| 1000 | -1 | 0.367879… | 0.367879 |
| 3000 | -3 | 0.049787… | 0.049787 |
| 5000 | -5 | 0.006738… | 0.006738 |
| 10000 | -10 | 0.0000454 | 0.0000454 |
| 50000 | -50 | 1.93e-22 | 1.93e-22 (still exactly representable as double) |
| 744261 | -744.261 | Number.MIN_VALUE (5e-324) reached near here | underflow to 0 |

**Conclusion:** Within any plausible researcher rig horizon (ticks < 10^5), the math is numerically well-behaved. Underflow to zero occurs only at exponents < -745 (Δtick > 745,000 at τ=1000) — at that point the edge has effectively been cold for ~12 years of real time at `tickRateMs=1000` and underflow to exactly zero is the correct behavior. No special-casing needed.

**Denormal concern:** JavaScript `Math.exp` gracefully produces denormal numbers between ~1e-308 and Number.MIN_VALUE. No NaN risk, no Infinity risk for non-negative Δtick [CITED: ECMA-262 §21.3.2.17].

**Determinism:** `Math.exp` is specified to produce an implementation-defined approximation — **NOT bit-exact across Node versions**. This is a real risk for `idempotent-rebuild.test.ts`. Mitigation: **compare edges by `canonicalEdge()` (which uses `.toFixed(3)` — three-decimal rounding absorbs sub-ppm implementation differences)**, NOT by raw float equality. This is exactly why D-9-10 locks `toFixed(3)`. The rebuild test hashes the canonical form — safe.

### Clamping discipline

After every valence/weight bump, before storing:
```typescript
edge.valence = Math.max(-1, Math.min(1, edge.valence + bump));
edge.weight  = Math.max( 0, Math.min(1, edge.weight  + bump));
```
Clamp in listener, not in canonical. Downstream canonical sees a value already in range.

## Validation Architecture

> `.planning/config.json` has no explicit `workflow.nyquist_validation` key — treated as enabled per research protocol.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `vitest ^2.0.0` [VERIFIED: grid/package.json] |
| Config file | `grid/vitest.config.ts` (path present — empty/default config observed; Wave 0 may need to add `test.include` paths) |
| Quick run command | `cd grid && npm test -- relationships/` |
| Full suite command | `cd grid && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| REL-01 | Pure-observer; zero-diff chain hash | unit + regression | `cd grid && npm test grid/test/relationships/zero-diff.test.ts` | ❌ Wave 0 |
| REL-01 | O(edges_touched_this_tick); no per-tick O(N²) sweep | perf | `cd grid && npm test grid/test/relationships/listener.test.ts` (timing assertions) | ❌ Wave 0 |
| REL-02 | Edge tuple shape + sorted-DID normalization | unit | `cd grid && npm test grid/test/relationships/listener.test.ts` | ❌ Wave 0 |
| REL-02 | MySQL snapshot round-trip | integration | `cd grid && npm test grid/test/relationships/storage.test.ts` | ❌ Wave 0 |
| REL-02 | Idempotent rebuild (canonical SHA-256 equality) | integration | `cd grid && npm test grid/test/relationships/idempotent-rebuild.test.ts` | ❌ Wave 0 |
| REL-03 | Lazy decay formula + τ default | unit | `cd grid && npm test grid/test/relationships/canonical.test.ts` | ❌ Wave 0 |
| REL-03 | No audit emit during decay | regression | `cd grid && npm test grid/test/relationships/no-audit-emit.test.ts` | ❌ Wave 0 |
| REL-04 | H1 response shape (no floats) | integration | `cd grid && npm test grid/test/api/relationships-privacy.test.ts` | ❌ Wave 0 |
| REL-04 | H2 numeric + audit emit `operator.inspected` | integration | same file | ❌ Wave 0 |
| REL-04 | H5 edge-events + audit emit | integration | same file | ❌ Wave 0 |
| REL-04 | 10K-edge p95 <100ms | perf | `cd grid && npm test grid/test/relationships/load-10k.test.ts` (weekly CI tag) | ❌ Wave 0 |
| D-9-05 | Sole-producer grep gate (Map + SQL) | regression | `cd grid && npm test grid/test/relationships/producer-boundary.test.ts` | ❌ Wave 0 |
| D-9-11 | Self-loop rejection | unit | `cd grid && npm test grid/test/relationships/self-edge-rejection.test.ts` | ❌ Wave 0 |
| D-9-12 | Wall-clock ban grep gate | regression | `cd grid && npm test grid/test/relationships/determinism-source.test.ts` | ❌ Wave 0 |
| D-9-13 | Allowlist length = 18 (unchanged) | regression | `node scripts/check-state-doc-sync.mjs` (existing) | ✅ |
| D-9-08 | No force-directed graph deps introduced | regression | `node scripts/check-relationship-graph-deps.mjs` (NEW) | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd grid && npm test -- relationships/` (runs all unit + fast integration tests for the new module; ~a few seconds).
- **Per wave merge:** `cd grid && npm test` (full grid suite including cross-module zero-diff + allowlist invariants).
- **Phase gate before `/gsd-verify-work`:** full grid suite green + `cd dashboard && npm test` green + weekly `load-10k.test.ts` pass captured in CI log.

### Wave 0 Gaps

All Phase 9 test files are net-new. Wave 0 must:
- [ ] `grid/test/relationships/zero-diff.test.ts` — covers REL-01 zero-diff invariant (clone from `grid/test/dialogue/zero-diff.test.ts`)
- [ ] `grid/test/relationships/producer-boundary.test.ts` — covers D-9-05 (clone from `grid/test/audit/nous-deleted-producer-boundary.test.ts`)
- [ ] `grid/test/relationships/determinism-source.test.ts` — covers D-9-12 (clone Phase 7 variant)
- [ ] `grid/test/relationships/self-edge-rejection.test.ts` — covers D-9-11 (new)
- [ ] `grid/test/relationships/no-audit-emit.test.ts` — covers D-9-13 (new)
- [ ] `grid/test/relationships/idempotent-rebuild.test.ts` — covers REL-02 (new)
- [ ] `grid/test/relationships/load-10k.test.ts` — covers REL-04 perf budget (new, weekly CI)
- [ ] `grid/test/relationships/listener.test.ts` — unit coverage of four processors (new)
- [ ] `grid/test/relationships/canonical.test.ts` — unit coverage of serialization + decay math (new)
- [ ] `grid/test/relationships/storage.test.ts` — MySQL snapshot round-trip (new)
- [ ] `grid/test/api/relationships-privacy.test.ts` — H1/H2/H5 shape matrix (clone from `grid/test/audit/operator-payload-privacy.test.ts`)
- [ ] `dashboard/test/components/inspector/relationship-panel.test.tsx` — component test (new)
- [ ] `scripts/check-relationship-graph-deps.mjs` — CI grep gate for d3/cytoscape imports (new)

No framework install needed — vitest is already present at `^2.0.0` in both `grid/` and `dashboard/`.

## Common Pitfalls

Carried forward from `.planning/research/v2.2/PITFALLS.md` with implementation-level mitigation.

### T-09-06 (CRITICAL): Unaudited edge mutation from outside the listener

**What goes wrong:** A developer, needing to "fix" a stale edge, writes to `edges.set(…)` from a different file. Listener is no longer sole producer; idempotent-rebuild breaks silently.

**Why it happens:** The Map is a regular JS object; JavaScript cannot enforce privacy beyond `#private` fields (which work at runtime but not against naive workarounds).

**How to avoid:** `private edges` + producer-boundary grep gate (see §Producer-Boundary Grep Gate Regex). Gate runs in CI on every PR.

**Warning signs:** PR touches `grid/src/relationships/*` outside `listener.ts` and mutates `edges.*`.

### T-09-07 (CRITICAL): Plaintext trust score leaks through H1 endpoint

**What goes wrong:** A developer adds `weight` to the H1 response payload "for convenience"; privacy-by-construction breaks.

**Why it happens:** The per-tier endpoint variants share most of the code path; easy to forget which variant is responding.

**How to avoid:** Privacy matrix test (`relationships-privacy.test.ts`) asserts at the RESPONSE-SHAPE level that H1 response keys ⊆ `{counterparty_did, warmth_bucket, recency_tick, edge_hash}`. Any extra key fails. Mirror Phase 6 `operator-payload-privacy.test.ts`.

**Warning signs:** New key added to H1 response without updating privacy matrix.

### T-09-08 (HIGH): Self-loop pollution

**What goes wrong:** `nous.spoke` event has `from_did === to_did`; creates `{did_a: X, did_b: X}` edge. Breaks edge-pair invariant, pollutes graph view.

**Why it happens:** A Nous monologuing to itself is a legitimate Phase 7 event shape; Phase 9 must silently drop it.

**How to avoid:** `assert(didA !== didB)` at `appendEdge` helper boundary. `self-edge-rejection.test.ts` regression-tests it.

**Warning signs:** Graph view shows a node with a self-loop; edge Map size grows unexpectedly.

### T-09-09 (HIGH): Wall-clock drift in reputation/relationships code

**What goes wrong:** Developer imports `Date.now()` or `setInterval` thinking "this is just for snapshot cadence, it's harmless." Determinism breaks; replay rigs diverge from live runs.

**Why it happens:** Snapshot cadence feels naturally wall-clock-driven ("every 100ms") when it should be tick-driven ("every 100 ticks").

**How to avoid:** `determinism-source.test.ts` grep gate forbids `/Date\.now|performance\.now|setInterval|setTimeout|Math\.random/` in `grid/src/relationships/**`. All timing via `entry.payload.tick`.

**Warning signs:** CI grep gate fires. Also: non-reproducible test output.

### T-09-10 (MEDIUM): Sybil-bootstrap via reciprocal trades

**What goes wrong:** Attacker spawns K fake Nous, runs reciprocal trades, inflates warmth. Warmth appears legitimate to operators.

**Why it happens:** The bump table treats all `trade.settled` events equally; does not discount intra-cluster reciprocity.

**How to avoid:** Out of scope for Phase 9 (deferred to v2.3 anomaly surfacing). Document as known limitation.

**Warning signs:** Operator sees unreasonably high warmth between Nous that registered within seconds of each other.

### T-09-11 (MEDIUM): N+1 Inspector queries

**What goes wrong:** Inspector panel renders top-5 relationships; for each, fires a `/relationships?did=X` → five more `/nous/X/summary` queries. 1+N pattern; server overwhelmed at N=100.

**Why it happens:** Naive render loop.

**How to avoid:** `useSWR` with stable key `[did, floor(currentTick / 100)]` — one batched fetch per Nous per 100-tick window. Server returns all top-5 counterparty info in a single response shape.

**Warning signs:** Network tab shows N+1 request pattern.

### Phase-9-specific pitfall: Rebuild divergence from float representation

**What goes wrong:** `rebuildFromChain()` processes events in the same order as live run, but `Math.exp(x)` produces slightly different float than live run (different Node version, different V8 JIT state). Live Map and rebuilt Map diverge at raw-float level; idempotent-rebuild test fails.

**Why it happens:** `Math.exp` is not bit-exact across runtimes per ECMA-262.

**How to avoid:** **Never compare raw floats in the rebuild test.** Compare `canonicalEdge()` output — `toFixed(3)` absorbs sub-ppm drift. Also: storage.ts snapshot writes DECIMAL(4,3) which matches `toFixed(3)` exactly; round-trip is lossless at canonical precision.

**Warning signs:** Idempotent-rebuild test fails intermittently across CI runs on different Node versions.

### Phase-9-specific pitfall: `AuditChain.loadEntries()` does NOT fire listeners

**What goes wrong:** `rebuildFromChain()` calls `loadEntries()` expecting side-effects (listener re-processes each entry); nothing happens because `loadEntries()` does not invoke `onAppend` callbacks.

**Why it happens:** By design — loading historical entries shouldn't trigger fresh audit reactions. But Phase 9 rebuild needs explicit replay.

**How to avoid:** `rebuildFromChain()` must manually iterate `audit.loadEntries()` and call `this.handleEntry(entry)` directly (bypassing the subscription). Document the subtlety in a code comment.

**Warning signs:** Rebuilt Map is empty; idempotent-rebuild test fails with "hashes differ, live has N edges, rebuilt has 0".

## Code Examples

Verified reference patterns:

### Tier-validated Fastify handler

```typescript
// Source: grid/src/api/operator/memory-query.ts:39-144 [VERIFIED]
// Adapted for relationships H2 endpoint

app.get<{Params: {did: string}; Querystring: {top?: string; tier?: string}}>(
    '/api/v1/nous/:did/relationships',
    async (req, reply) => {
        const targetDid = req.params.did;
        if (!DID_REGEX.test(targetDid)) { reply.code(400); return {error: 'invalid_did'}; }

        // Tombstone check (Phase 8 D-28)
        if (services.registry) {
            try { tombstoneCheck(services.registry, targetDid); }
            catch (err) {
                if (err instanceof TombstonedDidError) {
                    reply.code(410); return {error: 'gone', deleted_at_tick: err.deletedAtTick};
                }
                throw err;
            }
        }

        const topRaw = Number(req.query.top ?? '5');
        const top = Number.isInteger(topRaw) && topRaw >= 1 && topRaw <= 20 ? topRaw : 5;

        // Default tier: H1 (bucketed, no tier body required)
        if (req.query.tier === undefined) {
            const edges = services.relationships.getTopNFor(targetDid, top, currentTick);
            return {
                edges: edges.map(e => ({
                    counterparty_did: e.counterpartyDid,
                    warmth_bucket: warmthBucket(e.weight, services.config.relationship),
                    recency_tick: e.recency_tick,
                    edge_hash: edgeHash(e),
                })),
            };
        }

        // H2 tier: requires body with {tier: 'H2', operator_id}
        // Fastify GET with body is nonstandard; switch to POST for tier variants OR
        // require Authorization header carrying tier + operator_id.
        // Recommended: keep H1 as GET public, make H2 a POST.
        // [OPEN QUESTION — see §Open Questions for Planner]
    },
);
```

### Canonical edge + hash

```typescript
// Source: D-9-10 spec + Phase 8 D-07 precedent
// File: grid/src/relationships/canonical.ts (new)

import { createHash } from 'crypto';
import type { Edge, RelationshipConfig, WarmthBucket } from './types.js';

export function canonicalEdge(edge: Edge): string {
    return JSON.stringify({
        did_a: edge.did_a,
        did_b: edge.did_b,
        valence: edge.valence.toFixed(3),
        weight: edge.weight.toFixed(3),
        recency_tick: edge.recency_tick,
        last_event_hash: edge.last_event_hash,
    });
}

export function edgeHash(edge: Edge): string {
    return createHash('sha256').update(canonicalEdge(edge)).digest('hex');
}

export function decayedWeight(edge: Edge, currentTick: number, tau: number): number {
    if (currentTick <= edge.recency_tick) return edge.weight;  // guard against paused-tick
    const delta = currentTick - edge.recency_tick;
    return edge.weight * Math.exp(-delta / tau);
}

export function warmthBucket(weight: number, config: RelationshipConfig): WarmthBucket {
    if (weight < config.warmthColdMax) return 'cold';
    if (weight < config.warmthWarmMax) return 'warm';
    return 'hot';
}

export function sortedPairKey(didA: string, didB: string): string {
    if (didA === didB) throw new Error('self-loop rejected');  // D-9-11
    return didA < didB ? `${didA}|${didB}` : `${didB}|${didA}`;
}
```

### Rebuild-from-chain

```typescript
// Source: D-9-03 idempotent rebuild spec + AuditChain.loadEntries() semantics
// File: grid/src/relationships/listener.ts (method on RelationshipListener)

rebuildFromChain(): void {
    this.reset();
    // loadEntries does NOT fire onAppend — manual replay required.
    const entries = this.audit.loadEntries();
    for (const entry of entries) {
        this.handleEntry(entry);
    }
    // this.edges now matches what a live run would have produced.
}
```

### useSWR hook (dashboard)

```typescript
// Source: D-9-07 T-09-11 mitigation + dashboard useSWR convention
// File: dashboard/src/lib/hooks/use-relationships.ts (new)

import useSWR from 'swr';
import { useTick } from '@/lib/hooks/use-tick';  // assumed existing

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useRelationships(did: string | null, top: number = 5) {
    const currentTick = useTick();
    const windowKey = Math.floor(currentTick / 100);
    return useSWR(
        did ? [`/api/v1/nous/${did}/relationships?top=${top}`, windowKey] : null,
        ([url]) => fetcher(url),
        { revalidateOnFocus: false },
    );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Force-directed graph rendering (d3-force) | Deterministic SHA-256-seeded layout | Phase 9 (v2.2) | Zero new dependency; reproducibility guaranteed |
| Per-tick O(N²) decay sweep | Lazy decay at read time | Phase 9 (v2.2) | Performance budget holds at 10K edges |
| Trust score in audit payload | Tier-graded at read API only | Phase 9 (v2.2) | Hash-only at boundary invariant preserved |
| New `relationship.*` audit events | Reuse `operator.inspected` | Phase 9 (v2.2) | Zero allowlist growth |
| Manual file-level listener add in multiple locations | `GenesisLauncher` ordered construction | v2.1 Phase 5+ | Single insertion point; ordering invariant |

**Deprecated/outdated:**
- None — Phase 9 is net-new module.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `swr` is already a dashboard dependency | Standard Stack | Low — if missing, add to `dashboard/package.json` as Wave 0 task; no architectural impact |
| A2 | `sql/001_audit.sql` uses `BIGINT UNSIGNED` for tick columns | MySQL Schema Draft | Low — Wave 0 quick read of 001_audit.sql confirms; if `BIGINT SIGNED`, match it |
| A3 | `useTick()` hook exists in dashboard | Code Examples | Medium — if missing, wave 0 must add a tick-subscriber hook; likely exists given Phase 6 dialogue UI needs |
| A4 | `grid/test/dialogue/determinism-source.test.ts` exists | Clone Template Map | Low — if missing, clone from `grid/test/dialogue/zero-diff.test.ts` and adapt pattern-match walk |
| A5 | Fastify 5 supports GET with body for H2 tier variant | Code Examples | Medium — see Open Questions; POST is safer if ambiguous |
| A6 | `Math.exp` is deterministic enough after `.toFixed(3)` rounding | Lazy Decay Math | Low — verified against ECMA-262 spec; 3-decimal rounding absorbs inter-runtime drift |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Grid + dashboard | ✓ | `>=20.0.0` [VERIFIED: grid/package.json engines] | — |
| TypeScript | Build | ✓ | `^5.5.0` [VERIFIED] | — |
| vitest | Tests | ✓ | `^2.0.0` [VERIFIED] | — |
| mysql2 | Snapshot I/O | ✓ | `^3.9.0` [VERIFIED] | — |
| fastify | API handlers | ✓ | `^5.0.0` [VERIFIED] | — |
| Running MySQL instance for integration tests | Storage round-trip test | [ASSUMED] | — | Mock with in-memory store if missing |
| swr (dashboard) | `useRelationships` hook | [ASSUMED] | — | Replace with `useEffect + fetch`; Phase 6 hook patterns show useSWR already in use |

**Missing dependencies with no fallback:** None expected.

**Missing dependencies with fallback:** swr — fall back to plain `useEffect + fetch` with manual 100-tick-window memoization if not present.

## Security Domain

> `security_enforcement` is not explicitly set in `.planning/config.json` → treat as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No new auth surface; inherits Phase 1 auth model |
| V3 Session Management | no | Stateless; `operator_id` session scope unchanged |
| V4 Access Control | yes | Tier-based authorization via `validateTierBody`; tombstone check via `tombstoneCheck()` |
| V5 Input Validation | yes | `DID_REGEX`, `OPERATOR_ID_REGEX`, integer-range clamping on `top` parameter |
| V6 Cryptography | yes | `createHash('sha256')` for edge hash + layout seed — never hand-roll |
| V7 Error Handling | yes | Error ladder 400/404/410/503; never 500; never leak `err.message` to client (T-6-03 pattern) |
| V8 Data Protection | yes | Tier-graded response shape; H1 never sees floats; audit emits closed-tuple payload |
| V10 Malicious Code | yes | Grep-gated producer boundary prevents foreign writes |
| V13 API | yes | Fastify schema validation; Querystring clamping; no trust in user-supplied tier |

### Known Threat Patterns for Node + TypeScript + Fastify + MySQL

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via DID in parameterized query | Tampering | Use `mysql2` parameterized queries; DID already regex-validated |
| Tier spoofing (H1 client sends `tier: 'H5'` header) | Elevation of Privilege | `validateTierBody` uses strict equality; reuses Phase 6 proven pattern |
| N+1 request DoS | Denial of Service | useSWR with 100-tick window; server caps `top ≤ 20` |
| Timing side-channel on tier check | Information Disclosure | Tier check happens first, short-circuits before any data lookup |
| Self-DID forgery to forge edges | Spoofing | `sortedPairKey` rejects self-loops; DID_REGEX enforces shape |
| Plaintext valence leak via H1 | Information Disclosure | Response-shape privacy matrix test |
| Audit-chain flooding via H2/H5 inspection | Denial of Service | Existing Phase 6 rate-limit on `operator.inspected` (inherited) |
| Stale-map read post-crash | Tampering | `rebuildFromChain()` at startup; idempotent-rebuild regression test |

## Open Questions for Planner

These are the implementation-level tradeoffs the planner must resolve during plan writing. All are downstream of locked decisions; none revisit them.

### OQ-1 — HTTP verb for H2 tier variant of relationship endpoint

**What we know:** H1 is a public GET (no body). H2 requires `{tier, operator_id}` body for `validateTierBody`. Fastify 5 technically supports GET-with-body but most HTTP infrastructure (proxies, caches) does not.

**What's unclear:** Keep H1 GET + make H2 a separate POST endpoint path? Or use a single POST endpoint for both tiers with optional `tier` body field?

**Options:**
- (a) Two endpoints: `GET /api/v1/nous/:did/relationships` (H1) + `POST /api/v1/nous/:did/relationships/inspect` (H2) — **recommended**, matches Phase 6 `/memory/query` POST pattern.
- (b) Single POST for both tiers with `tier` defaulting to H1.
- (c) GET for both with `tier` query param + `Authorization` header (nonstandard).

**Recommendation:** (a). Separates public surface from audited-read surface; matches Phase 6 precedent; cacheable H1 GET.

### OQ-2 — Snapshot write cadence: tick-synchronous vs. fire-and-forget

**What we know:** Snapshot every 100 ticks (D-9-03). Must be pure-observer (no audit emit).

**What's unclear:** Does the snapshot write block the tick, or run async after tick?

**Options:**
- (a) Fire-and-forget (Phase 1 `persistent-chain.ts` pattern): `storage.snapshot().catch(err => log.warn(err))` inside a `setImmediate`. Tick is never blocked.
- (b) Tick-synchronous await. Hot path blocks on MySQL I/O; breaks O(edges_touched_this_tick) budget.

**Recommendation:** (a). Matches Phase 1 persistence discipline. Accept the semantics that a crash between "tick N" and "snapshot N" loses up-to-100-tick of derived state — but that state is losslessly recoverable via `rebuildFromChain()` on restart. The audit chain is the source of truth; the snapshot is cache.

### OQ-3 — `GET /api/v1/grid/relationships/graph` pagination for N>100 Nous

**What we know:** Success criterion is 10K edges p95 <100ms for Inspector top-N. Full-graph endpoint returns all edges ≥ warm — could be up to ~5K at N=100 Nous.

**What's unclear:** Is the full-graph response size concerning?

**Options:**
- (a) Return all edges + all nodes in one response (max ~5K rows × ~200 bytes ≈ 1 MB).
- (b) Paginate by `cursor=<edge_hash>&limit=500`.

**Recommendation:** (a) for Phase 9. Defer pagination to v2.3 when researcher rigs hit N>100 Nous. Document as known limitation. The MVP researcher rig is typically N=5..20 Nous — no paging concern.

### OQ-4 — H5 `edge_events` endpoint: full chain scan or derived index?

**What we know:** H5 endpoint returns all audit entries involving a DID pair. Requires iterating the audit chain.

**What's unclear:** Accept O(chain_length) per-request cost, or build a secondary edge-events index?

**Options:**
- (a) Full scan via `audit.loadEntries().filter(...)`. At 100K chain length, ~10ms. Acceptable at H5 frequency (human operator, not per-tick).
- (b) Build `relationship_events` secondary index table. Adds another MySQL write path + producer boundary.

**Recommendation:** (a). H5 is rare-operator-action (SUMMARY.md estimates H5 Sovereign usage at <1/day per Grid). Full scan is acceptable. Document measurement in weekly CI load test.

### OQ-5 — Dashboard layout: pre-compute positions server-side or client-side?

**What we know:** Layout is a pure function of DID set; deterministic hash-based placement.

**What's unclear:** Compute in browser (saves server CPU, requires Web Crypto) or server-side (simpler client, ships `{x, y}` in payload)?

**Recommendation (from §Graph Layout Algorithm):** Server-side. Add `{x, y}` to `nodes[]` in the `/grid/relationships/graph` response. Client renders trivially.

### OQ-6 — Config for warmth-bucket thresholds: per-Grid override or global constant?

**What we know:** D-9-02 bumps are per-Grid overridable. D-9-06 warmth thresholds are "fixed MVP" values in CONTEXT.md.

**What's unclear:** If a rig wants faster/slower cooling, should it also adjust bucket boundaries?

**Recommendation:** Include `warmthColdMax` and `warmthWarmMax` in `RelationshipConfig` (per CONTEXT §Config surface — already there). Per-Grid overridable. Defaults 0.20 / 0.60.

### OQ-7 — `storage.ts` snapshot granularity: full rewrite or diff?

**What we know:** Map has up to ~5K entries at MVP scale.

**What's unclear:** Every 100 ticks, write entire Map (simple, ~5K rows × MySQL UPSERT latency) or track dirty keys and write only them?

**Options:**
- (a) Full snapshot every 100 ticks via `REPLACE INTO … VALUES (…), (…), …` batched. Simple; bounded; ~100ms MySQL roundtrip at 5K rows (well within 100-tick window).
- (b) Dirty-key tracking: maintain `dirtyKeys: Set<string>` in listener; snapshot only emits UPSERTs for dirty keys.

**Recommendation:** (a) for Phase 9. Simpler; harder to diverge between live and snapshot; idempotent rebuild is the correctness anchor anyway. Revisit at N>50 Nous if MySQL latency becomes the bottleneck.

## Project Constraints (from CLAUDE.md)

- **Documentation Sync Rule:** Every change that affects scope/design MUST update source-of-truth docs in the same commit (README, PHILOSOPHY, ROADMAP, MILESTONES, PROJECT, REQUIREMENTS, STATE, research/*).
- **Phase numbering:** Continues across milestones. v2.1 ended at Phase 8; v2.2 Phase 9 is correct.
- **Archive on milestone close:** Phase dirs → `.planning/phases/archived/v<milestone>/`. Not relevant until v2.2 closes.
- **Allowlist freeze:** Broadcast allowlist (18 events) is frozen. Any new `operator.*` / `nous.*` / `trade.*` event requires explicit per-phase addition. Phase 9 adds **zero**. `grid/src/audit/broadcast-allowlist.ts` MUST NOT be touched.
- **I-5 hash-only at cross-boundary** (PHILOSOPHY): plaintext never crosses Grid/Brain boundary.
- **I-6 first-life promise:** audit entries retained forever; relevant for H5 edge-events endpoint — entries it reads are permanently available.
- **I-7 DID regex:** `/^did:noesis:[a-z0-9_\-]+$/i` — use `DID_REGEX` constant, never redeclare.
- **H-tier visibility:** every operator action must declare tier; `operator.inspected` payload already records tier (Phase 6 pattern preserved).

## Sources

### Primary (HIGH confidence)

- `grid/src/dialogue/aggregator.ts` — DialogueAggregator class (354 lines, read in full). Clone template for RelationshipListener.
- `grid/src/audit/chain.ts:50-58` — `AuditChain.onAppend` subscription surface.
- `grid/src/audit/broadcast-allowlist.ts` — 18-event frozen allowlist + `FORBIDDEN_KEY_PATTERN`.
- `grid/src/audit/append-telos-refined.ts` (104 lines) — sole-producer skeleton.
- `grid/src/audit/append-nous-deleted.ts` (133 lines) — Phase 8 sole-producer pattern.
- `grid/src/api/operator/memory-query.ts` (144 lines) — tier-validated Fastify handler template.
- `grid/src/api/operator/_validation.ts` (43 lines) — `validateTierBody` helper.
- `grid/src/genesis/launcher.ts:59` — aggregator construction; insertion point for RelationshipListener at line 60.
- `grid/test/dialogue/zero-diff.test.ts` (62 lines) — zero-diff regression template.
- `grid/test/audit/telos-refined-producer-boundary.test.ts` (47 lines) — grep gate template.
- `dashboard/src/hooks/use-elevated-action.ts` (118 lines) — client elevation flow.
- `dashboard/src/lib/hooks/use-refined-telos-history.ts` (84 lines) — useFirehose-based derived selector.
- `dashboard/src/components/dialogue/telos-refined-badge.tsx` (67 lines) — testid + aria convention.
- `sql/008_economy.sql` — latest migration; 009 follows.
- `.planning/phases/09-relationship-graph-derived-view/09-CONTEXT.md` — authoritative for all 13 locked decisions.
- `.planning/REQUIREMENTS.md` — REL-01..04 spec.
- `.planning/STATE.md` — 18-event allowlist enumeration.
- `.planning/ROADMAP.md` lines 30-47 — Phase 9 entry.

### Secondary (MEDIUM confidence)

- `.planning/research/v2.2/PITFALLS.md` — T-09-06..T-09-11 threat catalogue (v2.2 research).
- `.planning/research/v2.2/SUMMARY.md` Theme 2 — zero-allowlist-cost scope.
- `PHILOSOPHY.md` §1, §7 — sovereignty + visible-tier mandate.
- MDN Web Crypto `SubtleCrypto.digest` — client-side SHA-256 fallback for layout if server-side compute is rejected.

### Tertiary (LOW confidence — flagged for Wave 0 verification)

- [ASSUMED] `swr` dashboard dependency version — confirm at Wave 0.
- [ASSUMED] `sql/001_audit.sql` uses `BIGINT UNSIGNED` for tick columns — confirm at Wave 0.
- [ASSUMED] `useTick()` hook exists in `dashboard/src/lib/hooks/` — confirm at Wave 0.
- [ASSUMED] `grid/test/dialogue/determinism-source.test.ts` exists — if missing, clone pattern from Phase 7 equivalent.
- [ASSUMED] Fastify 5 GET-with-body behavior — OQ-1 recommends POST for H2 tier variant to sidestep.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library already present in project.
- Architecture: HIGH — structural clone of proven v2.1 patterns.
- Pitfalls: HIGH — catalogued in v2.2 research; mitigations locked in D-9-01..D-9-13.
- MySQL schema: MEDIUM — pattern matches 008_economy.sql, but `BIGINT UNSIGNED` assumption needs verification.
- Layout algorithm: HIGH — deterministic SHA-256 seeded placement is standard.
- Validation architecture: HIGH — vitest framework + clone targets all identified.

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (30 days — codebase is stable; v2.1 patterns unlikely to churn)
