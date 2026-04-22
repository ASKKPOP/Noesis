# Phase 9 — Relationship Graph (Derived View) — Pattern Map

**Mapped:** 2026-04-21
**Files analyzed:** 28 (19 new source/test + 5 dashboard + 1 SQL + 1 script + launcher edit + coordinator edit)
**Analogs found:** 24 / 28 — 4 files have NO direct analog (SVG graph, 10K load-bench, self-edge-rejection, idempotent-rebuild) and use RESEARCH.md-supplied patterns.

## Verification Notes (before classification)

Analog existence was verified by `ls` / `Read`. Corrections to the upstream hints:

| Hint from context | Reality | Action |
|---|---|---|
| `grid/src/dialogue/config.ts` | **does not exist** — dialogue config is inline in `launcher.ts` (`{ windowTicks: 5, minExchanges: 2 }`) | `relationships/config.ts` has no clone; pattern = frozen-constants module, see §New Patterns |
| `grid/test/dialogue/determinism-source.test.ts` | **does not exist** — no source-grep test in `grid/test/dialogue/` | Clone from `grid/test/audit/telos-refined-producer-boundary.test.ts` (grep-walk template) |
| `grid/test/dialogue/no-audit-emit.test.ts` | **does not exist** | Clone counting pattern from `grid/test/audit/operator-payload-privacy.test.ts` (see §Pattern: chain.length before/after) |
| `grid/src/api/operator/inspect.ts` | **does not exist** — operator inspect is at `grid/src/api/operator/memory-query.ts` | Use `memory-query.ts` (reference filename corrected) |
| `sql/008_economy.sql` | exists | OK |
| `dashboard/src/components/inspector/panel.tsx` | **does not exist** — Inspector lives at `dashboard/src/app/grid/components/inspector.tsx`; sections under `inspector-sections/` (peer of `memory.tsx`, `telos.tsx` …) | New file goes to `dashboard/src/app/grid/components/inspector-sections/relationships.tsx` per UI-SPEC §Surface 1 |
| `dashboard/src/components/agency/tier-chip.tsx` | **does not exist** — tier colors live in `dashboard/src/components/agency/agency-indicator.tsx` + `Chip color="blue"` | Use `Chip` primitive (`dashboard/src/components/primitives/chip.tsx`) — no new chip needed |
| `dashboard/src/hooks/use-relationships.ts` | dashboard hooks directory convention is `dashboard/src/lib/hooks/` (not `dashboard/src/hooks/`) | Place at `dashboard/src/lib/hooks/use-relationships.ts` per UI-SPEC §Surface 4 |
| `scripts/check-subjective-keywords.mjs` | **does not exist** — only `scripts/check-state-doc-sync.mjs` exists | Use `check-state-doc-sync.mjs` as the single Node-ESM grep-script template |
| `swr` dashboard dep | **not installed** — zero `useSWR` usages in the tree | RESEARCH.md A1 applies: Wave 0 task must `npm add swr` in dashboard package; plan must include this |
| SQL numbering | Repo has `001_domains..008_economy`; research hinted `sql/008_economy` → new is `009`. Confirmed correct. | OK |

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `grid/src/relationships/listener.ts` | listener | event-driven (audit onAppend → in-mem Map) | `grid/src/dialogue/aggregator.ts` | **exact** |
| `grid/src/relationships/storage.ts` | db-store | batch snapshot (every 100 ticks) | `grid/src/db/grid-store.ts` + `grid/src/db/persistent-chain.ts` | role-match |
| `grid/src/relationships/types.ts` | type-module | — | `grid/src/dialogue/types.ts` | **exact** |
| `grid/src/relationships/config.ts` | config/constants | — | no analog; closest: `DEFAULT_DIALOGUE_CFG` inline in `launcher.ts:58` + Object.freeze idiom | partial |
| `grid/src/relationships/canonical.ts` | utility (pure hash helper) | transform | `grid/src/dialogue/dialogue-id.ts` | **exact** |
| `grid/src/relationships/index.ts` | barrel-export | — | `grid/src/dialogue/index.ts` | **exact** |
| `grid/src/api/nous/relationships.ts` | endpoint (H1/H2 read) | request-response | `grid/src/api/operator/memory-query.ts` | role-match |
| `grid/src/api/operator/relationships.ts` | endpoint (H5 read) | request-response | `grid/src/api/operator/memory-query.ts` | **exact** |
| `grid/src/api/grid/relationships-graph.ts` | endpoint (H1 public read) | request-response | `grid/src/api/operator/memory-query.ts` (adapted; drop tier gate) | role-match |
| `grid/src/genesis/launcher.ts` (EDIT line ~60) | wiring | — | current aggregator wiring at `launcher.ts:59` | **exact** |
| `grid/src/integration/grid-coordinator.ts` (EDIT, optional reset-call) | wiring | — | `grid-coordinator.ts:45-49` aggregator drain call | **exact** |
| `sql/009_relationships.sql` | migration | schema | `sql/008_economy.sql` (idiom) + `sql/005_audit.sql` (BIGINT tick convention) | role-match |
| `grid/test/relationships/zero-diff.test.ts` | test (integration) | — | `grid/test/dialogue/zero-diff.test.ts` | **exact verbatim** |
| `grid/test/relationships/producer-boundary.test.ts` | test (grep-gate) | — | `grid/test/audit/telos-refined-producer-boundary.test.ts` + `nous-deleted-producer-boundary.test.ts` | **exact** |
| `grid/test/relationships/determinism-source.test.ts` | test (grep-gate) | — | `grid/test/audit/telos-refined-producer-boundary.test.ts` (walk pattern) | role-match |
| `grid/test/relationships/self-edge-rejection.test.ts` | test (unit) | — | no analog; new per D-9-11 | none |
| `grid/test/relationships/no-audit-emit.test.ts` | test (counting) | — | `grid/test/audit/operator-payload-privacy.test.ts` (length-before/after pattern) | partial |
| `grid/test/relationships/idempotent-rebuild.test.ts` | test (integration) | — | no analog; new per D-9-03 | none |
| `grid/test/relationships/load-10k.test.ts` | test (perf-bench, weekly) | — | no analog; Phase 8 perf-bench cadence cited but file not in tree | none |
| `grid/test/audit/relationship-sole-producer.test.ts` | test (grep-gate) | — | folded into `grid/test/relationships/producer-boundary.test.ts` per D-9-05 | merge |
| `grid/test/api/relationships-privacy.test.ts` | test (privacy matrix) | — | `grid/test/audit/operator-payload-privacy.test.ts` | role-match |
| `dashboard/src/app/grid/components/inspector-sections/relationships.tsx` | component (inspector section) | request-response (useSWR → rows) | `dashboard/src/app/grid/components/inspector-sections/memory.tsx` | **exact** |
| `dashboard/src/app/grid/relationships/page.tsx` | component (page) | request-response (static SVG) | no analog (first top-level grid page of this kind); closest structural: `dashboard/src/app/grid/page.tsx` | partial |
| `dashboard/src/components/relationships/edge-events-modal.tsx` | component (modal) | request-response | `dashboard/src/components/agency/elevation-dialog.tsx` (native `<dialog>` + showModal pattern per UI-SPEC §Surface 3) | role-match |
| `dashboard/src/lib/hooks/use-relationships.ts` | hook (data) | useSWR fetch | `dashboard/src/lib/hooks/use-refined-telos-history.ts` (memoized derived read) | partial |
| `dashboard/src/app/grid/components/inspector.tsx` (EDIT — add tab strip) | component (wiring) | — | existing section stacking at `inspector.tsx:42-45` | — |
| `scripts/check-relationship-graph-deps.mjs` | script (grep-gate) | — | `scripts/check-state-doc-sync.mjs` | **exact** (Node-ESM file-walk pattern) |

---

## Pattern Assignments

### `grid/src/relationships/listener.ts` (listener, event-driven)

**Analog:** `grid/src/dialogue/aggregator.ts`

**Clone semantics:** class skeleton, constructor signature, onAppend subscription, private Map mutation discipline, reset() pause hook, pure-observer invariant (no chain.append). Replace DialogueContext-specific logic with Edge-specific bump dispatcher.

**Construction + subscription pattern** (`grid/src/dialogue/aggregator.ts:50-68`):

```typescript
export class DialogueAggregator {
    private readonly audit: AuditChain;
    private readonly config: DialogueAggregatorConfig;

    /** Key: sortedDids.join('|') + '|' + channel. */
    private buffers: Map<string, PairBuffer> = new Map();

    /**
     * dialogue_ids already delivered, keyed by `${pair_key}|${did}`.
     * Each participant receives a given dialogue_id exactly once (D-08, D-11).
     * Cleared on reset() (D-04).
     */
    private delivered: Map<string, Set<string>> = new Map();

    constructor(audit: AuditChain, config: DialogueAggregatorConfig) {
        this.audit = audit;
        this.config = config;
        this.audit.onAppend((entry) => this.handleEntry(entry));
    }
```

**Adapt for RelationshipListener:**
- Replace `buffers: Map<string, PairBuffer>` with `edges: Map<string, Edge>` where key = `${minDid}|${maxDid}`.
- Drop `delivered` Map (not needed — edges are stateful, not one-shot emissions).
- In `handleEntry(entry)`, dispatch by `entry.eventType` to `processSpokeEntry | processTradeSettledEntry | processTradeReviewedEntry | processTelosRefinedEntry`.
- Add `getTopNFor(did, n, currentTick): EdgeView[]` — lazy-decay at read time per D-9-03 / REL-03.
- Add `rebuildFromChain(): void` — iterate `audit.loadEntries()` (note: audit chain.ts:74 "loadEntries does NOT fire listeners" — so rebuild must invoke `handleEntry` manually per entry).

**Preserve verbatim (do NOT modify):**
- Constructor argument order `(audit, config)` — so wiring in launcher mirrors aggregator exactly.
- `this.audit.onAppend((entry) => this.handleEntry(entry))` single-line subscription.
- `reset()` method signature (called from launcher pause hook).
- Pure-observer contract: the file MUST NOT contain any `audit.append` / `chain.append` call. Enforced by producer-boundary grep gate.

**Header JSDoc pattern to mirror** (lines 1-22):

```typescript
/**
 * Phase 7 Plan 01 — DialogueAggregator
 *
 * Key invariants:
 *   - Pure observer: registering N listeners … MUST NOT alter any entries[].eventHash.
 *     Verified by grid/test/dialogue/zero-diff.test.ts.
 *   - No wall-clock: no Date.now / Math.random / performance.now anywhere.
 *     All timing is driven by entry.payload.tick (D-07).
 *   - Deterministic iteration: Array.from(map.keys()).sort() before iterating.
 *   - Pause-safe: reset() called from GenesisLauncher when WorldClock pauses (D-04).
 */
```

Phase 9 Listener MUST carry the same invariant block, swapping Dialogue→Relationship and naming `grid/test/relationships/zero-diff.test.ts`.

---

### `grid/src/relationships/storage.ts` (db-store, batch snapshot)

**Analog (primary):** `grid/src/db/grid-store.ts`
**Secondary (API shape for mirror-on-write):** `grid/src/db/persistent-chain.ts`

**Snapshot pattern** (`grid/src/db/grid-store.ts:43-58`):

```typescript
async snapshot(gridName: string, launcher: GridSubsystems): Promise<void> {
    // Audit trail
    for (const entry of launcher.audit.all()) {
        await this.audit.append(gridName, entry);
    }

    // Registry
    for (const record of launcher.registry.all()) {
        await this.registry.upsert(gridName, record);
    }

    // Spatial positions
    for (const pos of launcher.space.allPositions()) {
        await this.space.upsertPosition(gridName, pos);
    }
}
```

**Restore pattern** (`grid-store.ts:66-80`):

```typescript
async restore(gridName: string, launcher: GridSubsystems): Promise<boolean> {
    const [entries, records, positions] = await Promise.all([
        this.audit.loadAll(gridName),
        this.registry.loadAll(gridName),
        this.space.loadPositions(gridName),
    ]);
    if (entries.length === 0 && records.length === 0) return false;
    launcher.audit.loadEntries(entries);
    launcher.registry.loadRecords(records);
    launcher.space.loadPositions(positions);
    return true;
}
```

**Adapt for RelationshipStorage:**
- Expose `snapshotEdges(gridName, edges: Map<string, Edge>, snapshotTick: number): Promise<void>` — upsert every edge row in one transaction (mysql2 `?` placeholder array).
- Expose `loadEdges(gridName): Promise<Edge[]>` — read all rows for this Grid, return array.
- This file IS THE SOLE writer of SQL `relationships` table per D-9-05. All mysql2 write calls live here.
- Use idempotent UPSERT (`INSERT … ON DUPLICATE KEY UPDATE`) — matches `registry.upsert` idiom.

**Decoupling from PersistentAuditChain:** do NOT extend `AuditChain` — this is a bespoke snapshot helper, not a chain subclass. `PersistentAuditChain` is the wrong template for inheritance; it is only the right template for "commit to memory first, mirror to DB async". The listener calls `storage.snapshotEdges` from its own tick hook, not from onAppend.

---

### `grid/src/relationships/types.ts` (type-module)

**Analog:** `grid/src/dialogue/types.ts`

**Full pattern** (`grid/src/dialogue/types.ts:13-47`):

```typescript
export interface DialogueContext {
    readonly dialogue_id: string;            // 16-hex per D-03 / DIALOGUE_ID_RE
    readonly counterparty_did: string;
    readonly channel: string;
    readonly exchange_count: number;
    readonly window_start_tick: number;
    readonly window_end_tick: number;
    readonly utterances: ReadonlyArray<{
        readonly tick: number;
        readonly speaker_did: string;
        readonly speaker_name: string;
        readonly text: string;
    }>;
}

export interface DialogueAggregatorConfig {
    readonly windowTicks: number;
    readonly minExchanges: number;
}
```

**Adapt for relationships/types.ts:**
- `Edge` — `{ readonly did_a: string; readonly did_b: string; valence: number; weight: number; recency_tick: number; last_event_hash: string }` (mutable fields, because listener mutates in place per D-9-02 bump rules; readonly `did_a`/`did_b` identity).
- `RelationshipConfig` — readonly interface matching CONTEXT §Config surface (13 keys).
- `WarmthBucket` — `'cold' | 'warm' | 'hot'` literal union.
- `EdgeView` — response shape type union gated by tier (H1 omits valence/weight; H2 includes; H5 adds events array — may live in API module, not here).

---

### `grid/src/relationships/config.ts` (config/constants)

**No direct analog.** Dialogue defaults are inline in `launcher.ts:58`:

```typescript
const dialogueCfg = config.dialogue ?? { windowTicks: 5, minExchanges: 2 };
```

**Pattern for Phase 9** — module-scope frozen default + factory. Example shape (composed from `grid/src/dialogue/dialogue-id.ts:17` `Object.freeze`-adjacent convention and CONTEXT §Config surface):

```typescript
import type { RelationshipConfig } from './types.js';

export const DEFAULT_RELATIONSHIP_CONFIG: Readonly<RelationshipConfig> = Object.freeze({
    decayTauTicks: 1000,
    valenceBumpSpoke: 0.01,
    valenceBumpTradeSettled: 0.10,
    valenceBumpTradeRejected: -0.10,
    valenceBumpTelosRefined: 0.05,
    weightBumpSpoke: 0.02,
    weightBumpTradeSettled: 0.10,
    weightBumpTradeRejected: 0.05,
    weightBumpTelosRefined: 0.05,
    snapshotIntervalTicks: 100,
    warmthColdMax: 0.20,
    warmthWarmMax: 0.60,
    maxTopN: 20,
});
```

**Preserve:** `Object.freeze` wrap, explicit `Readonly<…>` type, all 13 keys matching CONTEXT §specifics D-9-02 exactly. No helper functions — constants module only.

---

### `grid/src/relationships/canonical.ts` (utility, transform)

**Analog:** `grid/src/dialogue/dialogue-id.ts`

**Full template** (`grid/src/dialogue/dialogue-id.ts:14-37`):

```typescript
import { createHash } from 'node:crypto';

export const DIALOGUE_ID_RE = /^[0-9a-f]{16}$/;

export function computeDialogueId(
    dids: readonly string[],
    channel: string,
    windowStartTick: number,
): string {
    const sorted = [...dids].sort();
    const input = `${sorted.join('|')}|${channel}|${windowStartTick}`;
    return createHash('sha256').update(input).digest('hex').slice(0, 16);
}
```

**Adapt for canonical.ts (two exports — `canonicalEdge` + `edgeHash`, plus `warmthBucket`):**

- `canonicalEdge(edge: Edge): string` — returns a locked-key-order JSON string with `toFixed(3)` on valence/weight per D-9-10. Six keys, exact order: `did_a, did_b, valence, weight, recency_tick, last_event_hash`.
- `edgeHash(edge: Edge): string` — `createHash('sha256').update(canonicalEdge(edge)).digest('hex')` — full 64-hex (not sliced like dialogue_id, per CONTEXT D-9-10).
- `warmthBucket(weight: number, config: RelationshipConfig): WarmthBucket` — pure function: `< config.warmthColdMax → 'cold' | < config.warmthWarmMax → 'warm' | else 'hot'`.

**Preserve:**
- `import { createHash } from 'node:crypto';` — Node ESM crypto import, NOT `'crypto'`.
- Pure functions only — no side effects, no I/O, no wall-clock.
- Explicit `readonly` on array parameters.
- Named-regex export pattern (`export const DIALOGUE_ID_RE = …`) — Phase 9 adds `export const EDGE_HASH_RE = /^[0-9a-f]{64}$/` to mirror.

---

### `grid/src/relationships/index.ts` (barrel)

**Analog:** `grid/src/dialogue/index.ts`

**Full template** (`grid/src/dialogue/index.ts:1-14`):

```typescript
/**
 * Phase 7 Plan 01 — Dialogue subsystem barrel.
 *
 * Consumers: grid/src/integration/{types.ts, nous-runner.ts, grid-coordinator.ts},
 * grid/src/genesis/launcher.ts, grid/test/dialogue/**.
 */

export { DialogueAggregator } from './aggregator.js';
export { computeDialogueId, DIALOGUE_ID_RE } from './dialogue-id.js';
export type {
    DialogueAggregatorConfig,
    DialogueContext,
    SpokeObservation,
} from './types.js';
```

**Adapt for relationships/index.ts:**

```typescript
export { RelationshipListener } from './listener.js';
export { DEFAULT_RELATIONSHIP_CONFIG } from './config.js';
export { canonicalEdge, edgeHash, warmthBucket, EDGE_HASH_RE } from './canonical.js';
export type { Edge, RelationshipConfig, WarmthBucket } from './types.js';
```

**Preserve:** `.js` extensions in import paths (Node ESM contract — project convention); header JSDoc naming the consumer files.

---

### `grid/src/api/operator/relationships.ts` (endpoint, request-response — H5 edge events)

**Analog:** `grid/src/api/operator/memory-query.ts`

**Full handler pattern** (`grid/src/api/operator/memory-query.ts:39-144`) — the canonical tier-gated operator read. Key excerpts:

**Registration + tier/DID validation** (lines 39-73):

```typescript
export function registerMemoryQueryRoute(
    app: FastifyInstance,
    services: GridServices,
): void {
    app.post<{ Params: { did: string }; Body: QueryBody }>(
        '/api/v1/operator/nous/:did/memory/query',
        async (req, reply) => {
            const body = req.body ?? {};

            // 1. Tier + operator_id gate (D-13 + D-15).
            const v = validateTierBody(body, 'H2');
            if (!v.ok) {
                reply.code(400);
                return { error: v.error } satisfies ApiError;
            }

            // 2. DID shape gate.
            const targetDid = req.params.did;
            if (!DID_REGEX.test(targetDid)) {
                reply.code(400);
                return { error: 'invalid_did' } satisfies ApiError;
            }
```

**Closed-tuple audit emit** (lines 127-138):

```typescript
// 7. Emit operator.inspected — closed payload tuple, no memory content.
appendOperatorEvent(
    services.audit,
    'operator.inspected',
    v.operator_id,
    {
        tier: v.tier,
        action: 'inspect',
        operator_id: v.operator_id,
        target_did: targetDid,
    },
    targetDid,
);

// 8. Return normalized entries in the HTTP body (NOT in the audit).
return { entries: result.entries };
```

**Adapt for operator/relationships.ts:**
- Route: `POST /api/v1/operator/relationships/:edge_key/events` (edge_key = `minDid|maxDid`).
- Swap `validateTierBody(body, 'H2')` → `validateTierBody(body, 'H5')`.
- Replace runner.queryMemory call with `services.audit.loadEntries().filter(e => pairMatches(e, didA, didB))`.
- Reuse `appendOperatorEvent(services.audit, 'operator.inspected', v.operator_id, {tier:'H5', action:'inspect', operator_id, target_did:${didA}})` — NO new allowlist member (D-9-13).
- Return `{edge, events: [{event_hash, tick, event_type, payload}]}` — all data already in the chain; read is zero-diff.

**Preserve verbatim:**
- The exact `validateTierBody` → 400-on-fail ladder.
- `DID_REGEX.test` → 400 on shape fail.
- Closed-tuple payload literal (no spread operator, no dynamic keys) — matches D-12 privacy-gate invariant.
- `tombstoneCheck` block (lines 62-73) — if either DID is tombstoned, return 410.
- Error-ladder comment discipline — `400/404/503` each with a code-comment noting "NO audit event emitted".

---

### `grid/src/api/nous/relationships.ts` (endpoint, request-response — H1 default + H2 numeric variant)

**Analog:** `grid/src/api/operator/memory-query.ts` (H2 handler shape, partial)

**Adapt for nous/relationships.ts:**
- Two route registrations:
  - `GET /api/v1/nous/:did/relationships?top=N` — H1 default; NO body, NO tier check, NO audit emit; response shape excludes valence/weight (per D-9-06 H1 row).
  - Tier-gated branch when `?tier=H2` present: require body with `{tier:'H2', operator_id}` → `validateTierBody` → emit `operator.inspected` via `appendOperatorEvent` → response includes numeric valence/weight.
- H1 branch queries `services.relationships.getTopNFor(did, n, currentTick)` — bounded partial sort, lazy-decay.
- Response shape matrix enforced by `grid/test/api/relationships-privacy.test.ts`.

**Preserve:** DID_REGEX gate, tombstoneCheck block, closed-tuple audit payload when H2 branch engages.

---

### `grid/src/api/grid/relationships-graph.ts` (endpoint, request-response — full graph H1+)

**Analog:** same `memory-query.ts` handler skeleton with tier gate removed.

**Adapt:**
- `GET /api/v1/grid/relationships/graph?minWarmth=warm` — no tier, no body.
- Iterate all edges in listener Map, apply lazy decay, filter by `warmth_bucket >= minWarmth`.
- Compute server-side `{did, x, y}` per RESEARCH.md §Graph Layout Algorithm (lines 491-510) — `createHash('sha256').update(did).digest()` → first 4 bytes → angle, next 4 bytes → jitter. Push into `nodes[].x`, `nodes[].y` in response.
- Response: `{edges: [{did_a, did_b, warmth_bucket, edge_hash}], nodes: [{did, x, y, aggregate_warmth_bucket}]}`.

---

### `grid/src/genesis/launcher.ts` (EDIT — listener wiring)

**Insertion point** — `launcher.ts:59` currently ends with the aggregator construction. Add `this.relationships = new RelationshipListener(this.audit, relationshipCfg);` on new line 60.

**Exact edit template** (`launcher.ts:55-60`):

```typescript
        // Phase 7 DIALOG-01 (D-25): default windowTicks=5, minExchanges=2.
        // The aggregator MUST be constructed AFTER `this.audit` so its onAppend
        // listener is wired to the same AuditChain instance the Grid uses.
        const dialogueCfg = config.dialogue ?? { windowTicks: 5, minExchanges: 2 };
        this.aggregator = new DialogueAggregator(this.audit, dialogueCfg);
```

**Add after line 59 (new line 60):**

```typescript
        // Phase 9 REL-01 (D-9-04): RelationshipListener constructed AFTER
        // the aggregator so a fresh listener order is deterministic.
        // Pure-observer discipline matches DialogueAggregator; zero-diff
        // verified by grid/test/relationships/zero-diff.test.ts.
        const relationshipCfg = config.relationship ?? DEFAULT_RELATIONSHIP_CONFIG;
        this.relationships = new RelationshipListener(this.audit, relationshipCfg);
```

Also add `readonly relationships: RelationshipListener;` field near the `readonly aggregator:` declaration (line 34).

---

### `grid/src/integration/grid-coordinator.ts` (EDIT — optional pause-hook extension)

**Analog:** existing aggregator pause-hook at `grid-coordinator.ts:45-49`:

```typescript
                // Phase 7 DIALOG-01 (D-10, D-11): pull-query the aggregator
                // for any newly-formed dialogue contexts this runner should
                // receive. drainPending returns at most one DialogueContext
                // per counterparty pair + channel; aggregator enforces once-per-pair semantics.
                const contexts = this.launcher.aggregator.drainPending(runner.nousDid, tick);
```

**Adapt for relationships:** NO per-tick drain (relationships aren't pushed to runners — they're pulled by HTTP handlers on demand). The only coordinator edit needed is in the pause hook (existing `aggregator.reset()` call location): add `this.launcher.relationships.reset()` adjacent.

**Search the existing file for `aggregator.reset()`** (from earlier grep, `launcher.ts:178` not coordinator). Confirm location by reading `grid/src/integration/grid-coordinator.ts` before editing.

---

### `sql/009_relationships.sql` (migration)

**Analog:** `sql/008_economy.sql` (convention) — though economy is tiny; pattern is best represented by file header + `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`. The table body is provided verbatim in RESEARCH.md §MySQL Schema Draft (lines 415-456).

**`sql/008_economy.sql` idiom to preserve:**

```sql
-- Economy — Ousia configuration
CREATE TABLE IF NOT EXISTS ousia_config (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  initial_supply  BIGINT UNSIGNED NOT NULL DEFAULT 1000,
  …
) ENGINE=InnoDB;
```

**Adapt for 009_relationships.sql:**
- Header comment with phase reference (`-- Phase 9 REL-02 — derived relationship edges …`).
- `CREATE TABLE IF NOT EXISTS` (idempotent migration).
- `BIGINT UNSIGNED` for tick columns (convention established at `005_audit.sql`).
- `DECIMAL(4,3)` for valence/weight (per CONTEXT D-9-10 — matches canonical `toFixed(3)`).
- `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4` footer.
- Primary key `edge_key VARCHAR(160)` (two 76-char DIDs + `|` + slack per RESEARCH.md).
- Two auxiliary indexes `idx_did_a`, `idx_did_b`, `idx_snapshot_tick` — diagnostic only (in-mem Map is read authority).

Use RESEARCH.md §MySQL Schema Draft lines 420-456 verbatim. No invention needed.

---

### `grid/test/relationships/zero-diff.test.ts` (test — integration, RED-first)

**Analog:** `grid/test/dialogue/zero-diff.test.ts`

**Full template** (`grid/test/dialogue/zero-diff.test.ts:13-61`) — the single most important test to copy verbatim. Key excerpt:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { DialogueAggregator } from '../../src/dialogue/index.js';

describe('dialogue — zero-diff determinism', () => {
    it('100 nous.spoke appends with 0 vs N aggregator+passive listeners produce byte-identical chain entries', () => {
        // Freeze Date.now so createdAt is deterministic across both runs.
        const nowSpy = vi.spyOn(Date, 'now');
        let fakeNow = 1_700_000_000_000;
        nowSpy.mockImplementation(() => {
            fakeNow += 1;
            return fakeNow;
        });

        const runSim = (listenerCount: number, withAggregator: boolean): string[] => {
            fakeNow = 1_700_000_000_000; // reset before each run
            const c = new AuditChain();
            if (withAggregator) {
                void new DialogueAggregator(c, { windowTicks: 5, minExchanges: 2 });
            }
            for (let i = 0; i < listenerCount; i++) c.onAppend(() => {});

            // 100 nous.spoke appends alternating between two speakers on two channels.
            const dids = ['did:noesis:alpha', 'did:noesis:beta'];
            for (let i = 0; i < 100; i++) {
                const speaker = dids[i % 2];
                c.append('nous.spoke', speaker, {
                    name: speaker.split(':').pop(),
                    channel: i % 10 === 0 ? 'channel-b' : 'channel-a',
                    text: `utterance-${i}`,
                    tick: i + 1,
                });
            }
            return c.all().map(e => e.eventHash);
        };

        const withNone = runSim(0, false);
        const withAggOnly = runSim(0, true);
        const withTen = runSim(10, true);

        expect(withAggOnly).toEqual(withNone);
        expect(withTen).toEqual(withNone);
        expect(withTen).toHaveLength(100);

        nowSpy.mockRestore();
    });
});
```

**Adapt:**
- Import `RelationshipListener` from `'../../src/relationships/index.js'`.
- Replace `new DialogueAggregator(c, { windowTicks: 5, minExchanges: 2 })` with `new RelationshipListener(c, DEFAULT_RELATIONSHIP_CONFIG)`.
- Keep the 100-append nous.spoke scenario verbatim. Add a second scenario extending with 10 trade.settled appends (to exercise bump-dispatch branches).
- Assertions remain identical: `withAggOnly.toEqual(withNone)` etc.

**Preserve:**
- `vi.spyOn(Date, 'now')` freeze idiom (line 20-25).
- `fakeNow = 1_700_000_000_000` magic constant (deterministic across runs, matches v2.1 pattern).
- `c.all().map(e => e.eventHash)` return shape.
- `nowSpy.mockRestore()` cleanup.

---

### `grid/test/relationships/producer-boundary.test.ts` (test — grep gate, D-9-05)

**Analog (primary):** `grid/test/audit/telos-refined-producer-boundary.test.ts`
**Secondary:** `grid/test/audit/nous-deleted-producer-boundary.test.ts`

**Full walk template** (`telos-refined-producer-boundary.test.ts:14-47`):

```typescript
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const GRID_SRC = join(__dirname, '..', '..', 'src');
const SOLE_PRODUCER_FILE = 'audit/append-telos-refined.ts';

function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) out.push(...walk(full));
        else if (full.endsWith('.ts')) out.push(full);
    }
    return out;
}

describe('telos.refined — sole producer boundary (D-31)', () => {
    it('no file in grid/src/ except append-telos-refined.ts directly emits telos.refined', () => {
        const offenders: string[] = [];
        for (const file of walk(GRID_SRC)) {
            const rel = relative(GRID_SRC, file).replace(/\\/g, '/');
            if (rel === SOLE_PRODUCER_FILE) continue;
            const src = readFileSync(file, 'utf8');
            const pattern = /\b(audit|chain|this\.audit|this\.chain)\.append[^;]{0,200}['"]telos\.refined['"]/s;
            if (pattern.test(src)) offenders.push(rel);
        }
        expect(offenders).toEqual([]);
    });
});
```

**Adapt for relationships/producer-boundary.test.ts (D-9-05 — TWO sole-producer files):**
- Define `SOLE_MAP_WRITER = 'relationships/listener.ts'` and `SOLE_SQL_WRITER = 'relationships/storage.ts'`.
- First `it()`: walk all `grid/src/**/*.ts`; for each file `rel !== SOLE_MAP_WRITER`, search for `/\brelationships\.(set|delete|clear)\s*\(/` and `/\bedges\.(set|delete|clear)\s*\(/` — offenders array must be empty.
- Second `it()`: walk all; for each file `rel !== SOLE_SQL_WRITER`, search for `/INSERT\s+INTO\s+relationships|UPDATE\s+relationships\s+SET|DELETE\s+FROM\s+relationships/i` — offenders array must be empty.
- Third `it()` (sanity, mirroring line 43-46 of the analog): assert the two authorized files DO contain their respective write patterns.

**Preserve:**
- `walk(dir)` recursive function verbatim.
- `readdirSync / statSync / readFileSync` from `node:fs`.
- Offenders-array + `expect(offenders).toEqual([])` discipline.
- File-relative-path normalization `replace(/\\/g, '/')` for Windows-path robustness.

---

### `grid/test/relationships/determinism-source.test.ts` (test — grep gate, D-9-12)

**Analog:** `grid/test/audit/telos-refined-producer-boundary.test.ts` (same walk template, different regex).

**Adapt:**
- Scope walk to `grid/src/relationships/**` only (not full GRID_SRC).
- Regex: `/\b(Date\.now|performance\.now|setInterval|setTimeout|Math\.random)\b/` — must yield zero matches across the module.
- Same offenders-array discipline.

---

### `grid/test/relationships/self-edge-rejection.test.ts` (test — no analog, NEW per D-9-11)

**No direct v2.1 analog.** Closest-structure guidance:

**Pattern from CONTEXT D-9-11:**
```typescript
import { describe, it, expect, vi } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { RelationshipListener, DEFAULT_RELATIONSHIP_CONFIG } from '../../src/relationships/index.js';

describe('relationships — self-edge rejection (D-9-11 / T-09-08)', () => {
    it('rejects nous.spoke with from_did === to_did silently (no edge materialized)', () => {
        const chain = new AuditChain();
        const listener = new RelationshipListener(chain, DEFAULT_RELATIONSHIP_CONFIG);

        chain.append('nous.spoke', 'did:noesis:self', {
            from_did: 'did:noesis:self',
            to_did: 'did:noesis:self',
            tick: 1,
        });

        // Listener must NOT create a self-loop edge.
        expect(listener.getTopNFor('did:noesis:self', 10, 1)).toEqual([]);
        // And must NOT throw / emit an audit event (pure observer).
        expect(chain.length).toBe(1); // the original event, nothing added
    });
});
```

**Preserve:** zero-throw, zero-audit-emit discipline; silent rejection is the contract per D-9-11.

---

### `grid/test/relationships/no-audit-emit.test.ts` (test — counting, partial analog)

**Analog (length-before/after discipline):** `grid/test/audit/operator-payload-privacy.test.ts:185-201`:

```typescript
const headBefore = chain.head;
const lengthBefore = chain.length;
expect(() =>
    appendOperatorEvent(chain, spec.eventType, VALID_ACTOR, payload as never, spec.targetDid),
).toThrow(/privacy|leak/i);

// CRITICAL side-effect guarantee: a rejected payload leaves the chain
// with zero mutations.
expect(chain.head).toBe(headBefore);
expect(chain.length).toBe(lengthBefore);
```

**Adapt for no-audit-emit.test.ts:**
- Scenario: drive 1000 events through the listener (mixed spoke/trade.settled/trade.reviewed/telos.refined).
- `const lengthAfterSeeding = chain.length;` — the count attributable to the test's direct `chain.append` calls.
- Assert that after all events are processed, `chain.length === lengthAfterSeeding` — listener added zero entries of its own.
- Sanity: also assert `listener.edges.size > 0` (the listener DID receive and process events — proving it's not a broken no-op).

---

### `grid/test/relationships/idempotent-rebuild.test.ts` (test — no analog, NEW per D-9-03)

**Pattern** (per CONTEXT §specifics REL-02 + RESEARCH.md):

```typescript
import { createHash } from 'node:crypto';
import { canonicalEdge } from '../../src/relationships/canonical.js';

// 1. Build live listener via real events
const liveChain = new AuditChain();
const liveListener = new RelationshipListener(liveChain, cfg);
for (const ev of scenarioEvents) liveChain.append(...ev);

// 2. Canonical serialize live Map (sorted keys for determinism)
const liveSorted = Array.from(liveListener.edges.values())
    .sort((a, b) => a.did_a.localeCompare(b.did_a) || a.did_b.localeCompare(b.did_b));
const liveHash = createHash('sha256')
    .update(liveSorted.map(canonicalEdge).join('\n')).digest('hex');

// 3. Rebuild via fresh listener
const rebuildListener = new RelationshipListener(liveChain, cfg);
rebuildListener.rebuildFromChain();

// 4. Assert byte-identical
const rebuildSorted = Array.from(rebuildListener.edges.values())
    .sort(/* same comparator */);
const rebuildHash = createHash('sha256')
    .update(rebuildSorted.map(canonicalEdge).join('\n')).digest('hex');

expect(rebuildHash).toBe(liveHash);
```

Note: `AuditChain.loadEntries` does NOT fire listeners (see `chain.ts:74` comment). So `rebuildFromChain()` MUST iterate `audit.all()` and invoke `this.handleEntry(entry)` directly — this is a Phase-9 design deviation from the normal onAppend path and should be documented in the listener file's JSDoc.

---

### `grid/test/relationships/load-10k.test.ts` (test — no analog, perf-bench, weekly CI)

**No direct analog exists in the repo.** Pattern per CONTEXT D-9-09:

- Build listener, seed 10,000 edges (100 Nous × 100 pairwise).
- Measure wall-clock `performance.now()` around 1000 `GET /relationships?top=5` requests.
- Assert p95 < 100ms.
- Gate via vitest tag / filename prefix so it runs in a weekly CI job, not per-commit — matches Phase 8 perf-bench cadence cited in CONTEXT (even though that file was not located in the tree; cadence is the portable pattern).

**Note on wall-clock exception:** this test file is OUTSIDE `grid/src/relationships/**`, so D-9-12 grep gate does NOT apply to it. `performance.now` is permitted here (and only here).

---

### `grid/test/api/relationships-privacy.test.ts` (test — privacy matrix)

**Analog:** `grid/test/audit/operator-payload-privacy.test.ts` — the 40-case enumerator over 5 operator.* events.

**Adapt:**
- EVENT_SPECS-style table: `(endpoint, tier, allowed_keys, forbidden_keys)` over the three endpoints (H1 nous/relationships, H2 nous/relationships?tier=H2, H5 operator/relationships/:edge_key/events).
- For H1 endpoint: `forbidden = ['valence', 'weight']` — these MUST NOT appear in any response row.
- For H2 endpoint: `allowed = [..., 'valence', 'weight']`; `forbidden = ['events']`.
- For H5 endpoint: `allowed = [..., 'events']`; each event in `events[]` must contain only `{event_hash, tick, event_type, payload}` — no derived fields.
- Use Fastify in-process test server (already exists in `grid/test/api/grid-nous.test.ts` style — not re-read but referenced as an existing pattern).

**Preserve:** the `mustNotContain` array-over-keys idiom:

```typescript
for (const forbidden of spec.mustNotContain) {
    expect(Object.keys(response)).not.toContain(forbidden);
}
```

---

### `dashboard/src/app/grid/components/inspector-sections/relationships.tsx` (component)

**Analog:** `dashboard/src/app/grid/components/inspector-sections/memory.tsx` — sibling in the exact same directory, mirror structure (section > h3 > list-or-empty-state).

**Full template** (`memory.tsx:25-70`):

```tsx
export function MemorySection({ memories }: MemorySectionProps): React.ReactElement {
    const rows = memories.slice(0, MAX_MEMORIES);

    return (
        <section
            data-testid="section-memory"
            aria-labelledby="section-memory-title"
            className="mb-4"
        >
            <h3
                id="section-memory-title"
                className="mb-2 text-sm font-semibold text-neutral-100"
            >
                Memory
            </h3>
            {rows.length === 0 ? (
                <EmptyState
                    title="No episodic memories recorded."
                    description="Nous has not yet formed highlight memories."
                    testId="empty-memory"
                />
            ) : (
                <ul className="flex flex-col gap-1">
                    {rows.map((row, i) => (
                        <li
                            key={`${row.timestamp}-${i}`}
                            className="flex flex-col gap-0.5 rounded border border-neutral-800 bg-neutral-900 px-2 py-1"
                        >
                            <div className="flex items-center gap-2">
                                <Chip label={row.kind} testId={`memory-kind-${i}`} />
                                <span className="font-mono text-[11px] text-neutral-500">{label}</span>
                            </div>
                            <span className="text-xs text-neutral-200">{row.summary}</span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
```

**Adapt for RelationshipsSection:**
- `data-testid="section-relationships"`, `aria-labelledby="section-relationships-title"`.
- h3 copy: `Top partners by weight` (per UI-SPEC verbatim table).
- Row structure: warmth dot (not Chip) + DID code + bucket span (at H1) OR numeric span (at H2).
- Empty state: `title="No relationships yet."` / `description="This Nous has not yet spoken with or traded with another Nous."` (UI-SPEC verbatim-locked).
- At H1 tier, append "Reveal numeric weights" button + footnote below the list.
- At H5 tier, append per-row "Inspect raw turns (H5)" affordance.
- Data source: `useRelationships(did, tier, 5)` — new hook, NOT `useRefinedTelosHistory`.

**Preserve:**
- `section` > `h3#…-title` + `aria-labelledby` referencing the h3 id.
- `flex flex-col gap-0.5 rounded border border-neutral-800 bg-neutral-900 px-2 py-1` row classes — matches Inspector row rhythm across all sections.
- `font-mono text-[11px] text-neutral-500` caption style (reused for tick-number caption per UI-SPEC).
- `EmptyState` primitive import from `@/components/primitives`.
- `testId` prop convention on all data-bearing elements.
- `'use client';` header directive at line 1.

---

### `dashboard/src/app/grid/relationships/page.tsx` (component — NEW page)

**No exact analog.** Structural guidance pulled from UI-SPEC §Surface 2 (which has complete Tailwind classes). Key constraints:

- Next.js 15 App Router page — default export function.
- Fetches from `/api/v1/grid/relationships/graph?minWarmth=warm` via `useRelationships`-style SWR hook (or a sibling `useRelationshipGraph` hook) — **NOT** via direct `fetch` (match Phase 4 `useFirehose` pattern).
- SVG viewBox `0 0 1000 1000`, `className="w-full h-auto max-w-[800px] mx-auto"`.
- Server returns `nodes[].x`, `nodes[].y` — dashboard does NOT compute positions.
- Legend section + H1 footnote below SVG (UI-SPEC verbatim).

**Grep gate dependency:** `scripts/check-relationship-graph-deps.mjs` scans this file (and `dashboard/src/components/relationships/**`) for `d3-force | react-force-graph | cytoscape | graphology` imports — fails phase if any match.

---

### `dashboard/src/components/relationships/edge-events-modal.tsx` (component — modal)

**Analog (native `<dialog>` + showModal pattern):** `dashboard/src/components/agency/elevation-dialog.tsx` (referenced in UI-SPEC; not re-read in this pass — planner should Read it when drafting this plan).

**UI-SPEC verbatim contract** — modal uses `<dialog>` + `showModal()`, NO portal, NO IrreversibilityDialog frame (read is non-destructive per CONTEXT §specifics REL-04). Border is `border-neutral-800`, NOT `border-rose-900`.

**Key divergence from Phase 8 IrreversibilityDialog:** no type-confirm phrase, no paste suppression, no destructive styling. This is a read modal.

---

### `dashboard/src/lib/hooks/use-relationships.ts` (hook)

**Closest partial analog:** `dashboard/src/lib/hooks/use-refined-telos-history.ts` (memoized derived read over firehose snapshot).

**Header-discipline pattern** (`use-refined-telos-history.ts:1-23`):

```typescript
'use client';
/**
 * useRefinedTelosHistory — derived selector over useFirehose().
 *
 * D-28: client-only, zero new RPC, zero new WebSocket. Returns a stable
 * summary of `telos.refined` events for the selected Nous:
 *   - refinedCount — how many valid refinements in current firehose snapshot
 *   - lastRefinedDialogueId — triggered_by_dialogue_id of the most recent one
 *
 * Malformed events … are silently dropped — matches 07-UI-SPEC §State Contract
 * "Silent drop at hook boundary" + the Phase 6 D-16 pattern.
 *
 * Plaintext invariant (PHILOSOPHY §1, D-18): this hook NEVER references
 * `new_goals`, `goal_description`, or `utterance` from a telos.refined payload.
 */
import { useMemo } from 'react';
import { useFirehose } from '@/app/grid/hooks';

const DIALOGUE_ID_RE = /^[0-9a-f]{16}$/;
const HEX64_RE = /^[0-9a-f]{64}$/;
```

**Adapt:**
- `useRelationships` uses `useSWR` (needs dep install — Wave 0), NOT `useFirehose`.
- SWR key: `[did, tier, Math.floor(currentTick / 100)]` per UI-SPEC §Surface 4 (T-09-11 mitigation).
- Fetch URL: `/api/v1/nous/:did/relationships?top=${topN}${tier === 'H2' ? '&tier=H2' : ''}`.
- Validation regex guards (mirror DIALOGUE_ID_RE / HEX64_RE patterns) on the response — silently-drop malformed rows.
- Return shape: `{data, isLoading, error, refresh}` per UI-SPEC §Surface 4.

**Preserve:**
- `'use client';` directive.
- JSDoc header with `plaintext invariant` + cross-reference to `PHILOSOPHY §1` + `D-9-13` (zero-allowlist-growth).
- Regex constants mirroring the producer boundary (`HEX64_RE`).

---

### `dashboard/src/app/grid/components/inspector.tsx` (EDIT — add tab strip)

**Analog:** current section-stacking at `inspector.tsx:42-45`:

```tsx
import { PsycheSection } from './inspector-sections/psyche';
import { ThymosSection } from './inspector-sections/thymos';
import { TelosSection } from './inspector-sections/telos';
import { MemorySection } from './inspector-sections/memory';
```

**Adapt (per UI-SPEC §Surface 1b):**
- Add import: `import { RelationshipsSection } from './inspector-sections/relationships';`.
- Add local `const [activeTab, setActiveTab] = useState<'overview' | 'relationships'>('overview');` — reset to 'overview' when a new DID is selected (via `useEffect` on `selectedDid`).
- Wrap existing four sections in a `<div role="tabpanel" aria-labelledby="inspector-tab-overview" hidden={activeTab !== 'overview'}>`.
- Add `<div role="tabpanel" aria-labelledby="inspector-tab-relationships" hidden={activeTab !== 'relationships'}><RelationshipsSection did={selectedDid} /></div>`.
- Insert tab strip above both panels per UI-SPEC §Surface 1b verbatim Tailwind classes.

---

### `scripts/check-relationship-graph-deps.mjs` (script — grep gate)

**Analog:** `scripts/check-state-doc-sync.mjs`

**Full template** (`check-state-doc-sync.mjs:1-35`):

```javascript
#!/usr/bin/env node
/**
 * STATE.md doc-sync regression gate (Phase 5 / D-11, extended Phase 8 / AGENCY-05).
 *
 * Asserts the .planning/STATE.md Accumulated Context stays in sync with the
 * frozen broadcast allowlist invariant from grid/src/audit/broadcast-allowlist.ts.
 *
 * Exits 0 when STATE.md is in sync.
 * Exits 1 with a diagnostic when drift is detected.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');
const statePath = resolve(repoRoot, '.planning/STATE.md');
```

**Adapt for check-relationship-graph-deps.mjs:**
- Header JSDoc: `Phase 9 D-9-08 — graph-dependency grep gate`.
- Walk `dashboard/src/app/grid/relationships/**/*.{ts,tsx}` + `dashboard/src/components/relationships/**/*.{ts,tsx}`.
- Regex: `/\bfrom\s+['"](d3-force|react-force-graph|cytoscape|graphology)['"]/`.
- Exit 0 on zero matches; exit 1 with file+line diagnostic on any match.
- Mirror `failures.push(...)` + final aggregation block — same diagnostic style as state-doc-sync.

**Preserve:**
- `#!/usr/bin/env node` shebang (line 1).
- ESM-only: `import { … } from 'node:fs'` (NOT `require`).
- `process.exit(0)` on success, `process.exit(1)` on failure.
- `repoRoot = resolve(__dirname, '..')` — script sits in `scripts/`, repo root is one level up.

**Wire into CI:** add to the relevant npm script in the root `package.json` (existing state-doc-sync is wired similarly — planner should grep `package.json` for `check-state-doc-sync` to find the hook point).

---

## Shared Patterns

### Pattern 1: Pure-observer listener

**Source files:**
- `grid/src/audit/chain.ts:50-58` — `onAppend` fan-out with per-listener try/catch, swallowing exceptions
- `grid/src/dialogue/aggregator.ts:64-68` — constructor-time subscription

**Apply to:** `grid/src/relationships/listener.ts` (sole listener file in the phase).

**Code template** (composite):
```typescript
constructor(audit: AuditChain, config: RelationshipConfig) {
    this.audit = audit;
    this.config = config;
    this.audit.onAppend((entry) => this.handleEntry(entry));
}
```

**Invariant chain:**
1. Listener exceptions are swallowed by `AuditChain.append` (chain.ts:52-56). Any throw inside `handleEntry` is silently absorbed — so the listener MUST never rely on errors propagating.
2. `loadEntries()` (restore path) does NOT fire listeners. Rebuild must invoke `handleEntry` manually.
3. Zero-diff invariant: listener count has no observable effect on `entries[].eventHash`. Asserted by `zero-diff.test.ts`.

---

### Pattern 2: Closed-tuple audit emit (for H2/H5 endpoints)

**Source:** `grid/src/api/operator/memory-query.ts:127-138`

**Apply to:** `grid/src/api/nous/relationships.ts` (H2 branch), `grid/src/api/operator/relationships.ts` (H5 endpoint).

**Code template (verbatim shape):**
```typescript
appendOperatorEvent(
    services.audit,
    'operator.inspected',          // Phase 6 event — NOT new allowlist member
    v.operator_id,
    {
        tier: v.tier,
        action: 'inspect',
        operator_id: v.operator_id,
        target_did: targetDid,
    },
    targetDid,
);
```

**D-9-13 invariant:** Phase 9 adds **zero** new allowlist members. The above `operator.inspected` event is the single audit emission point for both H2 and H5 relationship reads.

**Privacy invariant:** payload is a closed literal — no spread, no dynamic keys. If this discipline is broken (e.g., someone adds `...body`), the `payloadPrivacyCheck` gate at `grid/src/audit/broadcast-allowlist.ts` will catch forbidden keys (prompt/response/wiki/reflection/thought/emotion_delta), but the closed-tuple pattern is the first line of defense.

---

### Pattern 3: Tier validation + DID regex + tombstone ladder (for all three endpoints)

**Source:** `grid/src/api/operator/memory-query.ts:46-73`

**Apply to:** all three new endpoint files (nous, operator, grid variants).

**Code template:**
```typescript
const body = req.body ?? {};

// 1. Tier + operator_id gate (only on H2/H5 branches).
const v = validateTierBody(body, 'H2' /* or 'H5' */);
if (!v.ok) {
    reply.code(400);
    return { error: v.error } satisfies ApiError;
}

// 2. DID shape gate.
const targetDid = req.params.did;
if (!DID_REGEX.test(targetDid)) {
    reply.code(400);
    return { error: 'invalid_did' } satisfies ApiError;
}

// 2a. Tombstone check — 410 if DID already deleted.
if (services.registry) {
    try {
        tombstoneCheck(services.registry, targetDid);
    } catch (err) {
        if (err instanceof TombstonedDidError) {
            reply.code(410);
            return { error: 'gone', deleted_at_tick: err.deletedAtTick } as ApiError & { deleted_at_tick: number };
        }
        throw err;
    }
}
```

**Preserve:** the exact error discriminants (`invalid_did`, `gone`) — these map into `FetchError.kind` on the dashboard side (see `inspector.tsx:52-74` ERR_COPY table).

---

### Pattern 4: Grep-walk test skeleton

**Source:** `grid/test/audit/telos-refined-producer-boundary.test.ts:14-47` + `grid/test/audit/nous-deleted-producer-boundary.test.ts:19-47`

**Apply to:** `grid/test/relationships/producer-boundary.test.ts`, `grid/test/relationships/determinism-source.test.ts`.

**Code template (recursive walk):**
```typescript
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const GRID_SRC = join(__dirname, '..', '..', 'src');

function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) out.push(...walk(full));
        else if (full.endsWith('.ts')) out.push(full);
    }
    return out;
}
```

Then per-file regex-search with `offenders.push(rel)` on match, final `expect(offenders).toEqual([])`.

---

### Pattern 5: Inspector section (dashboard UI)

**Source:** `dashboard/src/app/grid/components/inspector-sections/memory.tsx` (full file, 70 lines).

**Apply to:** `dashboard/src/app/grid/components/inspector-sections/relationships.tsx`.

**Preserve:**
- Top-of-file `'use client';` directive.
- `section > h3#id-title` with `aria-labelledby` reference.
- `flex flex-col gap-0.5 rounded border border-neutral-800 bg-neutral-900 px-2 py-1` row class list.
- `EmptyState` primitive for zero-rows branch.
- `testId` on every row for Playwright hookup.
- `font-mono text-[11px]` for caption metadata.

---

## No Analog Found

Files with no close match in the repo. Planner should use RESEARCH.md / UI-SPEC patterns (cited inline above) instead of searching for analogs:

| File | Role | Data Flow | Reason | Recommended Source |
|------|------|-----------|--------|--------------------|
| `grid/src/relationships/config.ts` | frozen-constants module | — | v2.1 configs are inline in launcher, not in dedicated files | `Object.freeze` idiom + CONTEXT §Config surface literal |
| `grid/test/relationships/self-edge-rejection.test.ts` | test | — | T-09-08 is new to v2.2; no self-loop test exists in v2.1 | CONTEXT D-9-11 template (rendered above) |
| `grid/test/relationships/idempotent-rebuild.test.ts` | test | — | v2.1 has no rebuild-from-chain pattern — derived views are new | RESEARCH.md idempotent-rebuild description (rendered above) |
| `grid/test/relationships/load-10k.test.ts` | test (perf) | — | Phase 8 perf-bench cadence cited in CONTEXT but no matching file found in tree | `performance.now` + p95 measurement pattern (standard) |
| `dashboard/src/app/grid/relationships/page.tsx` | page | — | First top-level `/grid/<feature>` page beyond the root grid map | UI-SPEC §Surface 2 (complete Tailwind + SVG spec already rendered) |

## Metadata

**Analog search scope:** `grid/src/**`, `grid/test/**`, `dashboard/src/**`, `sql/**`, `scripts/**`.
**Files opened (Read):** 14 concrete analog files + 3 context files. All file existence verified via `ls` / targeted `Bash` before Read.
**Files NOT opened (referenced only by name):** `dashboard/src/components/agency/elevation-dialog.tsx`, `dashboard/src/components/primitives/empty-state.tsx`, `grid/src/api/operator/_validation.ts`, `grid/src/audit/operator-events.ts`, `grid/src/registry/tombstone-check.ts` — planner should Read these when drafting the plan; they are referenced here with line pointers for orientation.
**Pattern extraction date:** 2026-04-21.
**Hash correlation:** 18-event allowlist frozen. D-9-13 preserves it. Sole-producer boundary (D-9-05) has TWO authorized files (listener.ts for Map, storage.ts for SQL) — mirrors Phase 8 two-file pattern used for `append-nous-deleted.ts` + registry tombstone.
