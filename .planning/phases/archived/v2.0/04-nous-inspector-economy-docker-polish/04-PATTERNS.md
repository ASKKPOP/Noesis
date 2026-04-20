# Phase 4: Nous Inspector + Economy + Docker Polish — Pattern Map

**Mapped:** 2026-04-18
**Files analyzed:** 40 (8 grid, 2 brain, 25 dashboard, 3 docker/infra, 2 tests umbrella)
**Analogs found:** 38 / 40 (2 files are genuinely greenfield — docker-smoke shell, inspector drawer has no prior in-repo analog but mirrors WAI-ARIA primer cited in RESEARCH.md Pattern 3)

Brain tests live in `brain/test/` (singular, not `tests/`). RESEARCH.md's `brain/tests/` path is corrected here.

---

## File Classification

### Grid (TypeScript)

| File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `grid/src/economy/shop-registry.ts` | creator (module) | CRUD (in-memory) | `grid/src/registry/registry.ts` | exact-role |
| `grid/src/economy/types.ts` | modifier | config | `grid/src/economy/types.ts` (self, extend `EconomyConfig`) | self |
| `grid/src/economy/index.ts` | modifier | barrel export | `grid/src/economy/index.ts` (self) | self |
| `grid/src/genesis/presets.ts` | modifier (seed config) | config | `grid/src/genesis/presets.ts` (self — `TEST_CONFIG`) | self |
| `grid/src/genesis/launcher.ts` | modifier | bootstrap | `grid/src/genesis/launcher.ts` `bootstrap()` body | self |
| `grid/src/integration/types.ts` | modifier (type union widen) | type-only | `grid/src/integration/types.ts` (self) | self |
| `grid/src/integration/nous-runner.ts` | modifier (switch case) | event-driven | `grid/src/integration/nous-runner.ts` existing `direct_message` case | self |
| `grid/src/registry/registry.ts` | modifier (add `transferOusia`) | atomic mutation | `grid/src/registry/registry.ts` `spawn()` atomicity pattern | self |
| `grid/src/api/server.ts` | modifier (4 routes) | request-response | `grid/src/api/server.ts:80-94` existing `GET /api/v1/grid/regions[/id]` | self |
| `grid/test/unit/shop-registry.test.ts` | test | unit | `grid/test/registry.test.ts` | exact-role. NOTE: grid tests live at `grid/test/` flat + `grid/test/api/`, `grid/test/integration/`, `grid/test/genesis/` — there is no `grid/test/unit/` subdirectory. Plan should place this at `grid/test/shop-registry.test.ts` (flat) to match existing convention, OR create `grid/test/economy/shop-registry.test.ts`. |
| `grid/test/integration/trade-settlement.test.ts` | test | integration | `grid/test/integration/e2e-tick-cycle.test.ts` | role-match |
| `grid/test/integration/introspection-proxy.test.ts` | test | integration | `grid/test/api/server.regions.test.ts` (closer analog for route-level proxy with mocks) | role-match |
| `grid/test/api/server.nous-state.test.ts` (per RESEARCH D13) | test | integration | `grid/test/api/server.regions.test.ts` | exact |
| `grid/test/api/server.economy-trades.test.ts` | test | integration | `grid/test/api/server.regions.test.ts` | exact |
| `grid/test/api/server.economy-shops.test.ts` | test | integration | `grid/test/api/server.regions.test.ts` | exact |
| `grid/test/nous-runner.trade-settled.test.ts` | test | integration | `grid/test/integration/e2e-messaging.test.ts` | role-match |

### Brain (Python)

| File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `brain/src/noesis_brain/rpc/handler.py` | modifier (widen `get_state`) | request-response (sync) | `brain/src/noesis_brain/rpc/handler.py:128-137` (self) | self |
| `brain/test/test_rpc_handler_get_state.py` | test | unit | `brain/test/test_rpc_handler.py` | exact |
| `brain/test/test_memory_highlights.py` | test | unit | `brain/test/test_memory.py` (already present) | exact |

**Path correction:** brain tests are in `brain/test/` (singular) not `brain/tests/`. CONTEXT/RESEARCH both use the wrong path.

### Protocol (TypeScript)

| File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| (no new protocol files required for Phase 4) | — | — | — | — |

RESEARCH.md clarifies types are locally mirrored in `grid/src/integration/types.ts` rather than added to `protocol/`. The dashboard fetches JSON and types its own response locally (`dashboard/src/lib/protocol/*`). **Recommendation:** create `dashboard/src/lib/protocol/inspector-types.ts` + `dashboard/src/lib/protocol/economy-types.ts` mirroring `dashboard/src/lib/protocol/region-types.ts` pattern.

### Dashboard (Next.js)

| File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `dashboard/src/lib/stores/selection-store.ts` | creator | client-state | `dashboard/src/lib/stores/presence-store.ts` | exact-role (simpler surface) |
| `dashboard/src/lib/stores/selection-store.test.ts` | test | unit | `dashboard/src/lib/stores/firehose-store.test.ts` | exact |
| `dashboard/src/lib/hooks/use-hash-sync.ts` | creator | bidir-binding | _no in-repo analog_ — derives from RESEARCH Pattern 2 + Next.js docs | greenfield (pattern cited) |
| `dashboard/src/lib/hooks/use-hash-sync.test.ts` | test | unit | `dashboard/src/app/grid/hooks.test.tsx` | role-match |
| `dashboard/src/lib/hooks/use-selection.ts` | creator | React binding | `dashboard/src/app/grid/hooks.ts` (existing `usePresence`, `useFirehoseView`, etc.) | exact |
| `dashboard/src/lib/api/introspect.ts` | creator | fetch wrapper | `dashboard/src/lib/transport/refill.ts` (REST fetch with AbortSignal) | role-match |
| `dashboard/src/lib/api/economy.ts` | creator | fetch wrapper | `dashboard/src/lib/transport/refill.ts` | role-match |
| `dashboard/src/app/grid/components/tab-bar.tsx` | creator | UI control | `dashboard/src/app/grid/components/event-type-filter.tsx` (tab-like chip pattern) | role-match |
| `dashboard/src/app/grid/components/tab-bar.test.tsx` | test | unit | `dashboard/src/app/grid/components/event-type-filter.test.tsx` | exact |
| `dashboard/src/app/grid/components/inspector.tsx` | creator | fetch + modal UI | _no in-repo drawer analog_ — composes RESEARCH Pattern 3 + `firehose.tsx` fetch shape | greenfield (pattern cited) |
| `dashboard/src/app/grid/components/inspector.test.tsx` | test | RTL | `dashboard/src/app/grid/components/firehose.test.tsx` | role-match |
| `dashboard/src/app/grid/components/inspector-sections/psyche.tsx` | creator | presentational | `dashboard/src/app/grid/components/firehose-row.tsx` | role-match |
| `dashboard/src/app/grid/components/inspector-sections/telos.tsx` | creator | presentational | `dashboard/src/app/grid/components/firehose-row.tsx` | role-match |
| `dashboard/src/app/grid/components/inspector-sections/thymos.tsx` | creator | presentational | `dashboard/src/app/grid/components/firehose-row.tsx` | role-match |
| `dashboard/src/app/grid/components/inspector-sections/memory.tsx` | creator | presentational | `dashboard/src/app/grid/components/firehose-row.tsx` | role-match |
| `dashboard/src/app/grid/components/inspector-sections/__tests__/*.test.tsx` | test | RTL | `dashboard/src/app/grid/components/firehose-row.test.tsx` | exact |
| `dashboard/src/app/grid/components/economy/economy-panel.tsx` | creator | container + WS sub | `dashboard/src/app/grid/grid-client.tsx` (WS subscribe + REST hydrate pattern) | role-match |
| `dashboard/src/app/grid/components/economy/balance-grid.tsx` (D15 name) | creator | table | `dashboard/src/app/grid/components/firehose.tsx` | role-match |
| `dashboard/src/app/grid/components/economy/trades-table.tsx` | creator | table | `dashboard/src/app/grid/components/firehose.tsx` | role-match |
| `dashboard/src/app/grid/components/economy/shops-list.tsx` | creator | grouped list | `dashboard/src/app/grid/components/firehose-row.tsx` | role-match |
| `dashboard/src/app/grid/components/economy/__tests__/*.test.tsx` | test | RTL | `dashboard/src/app/grid/components/firehose.test.tsx` | role-match |
| `dashboard/src/app/grid/grid-client.tsx` | modifier | integrate TabBar + Inspector trigger | `dashboard/src/app/grid/grid-client.tsx` (self) | self |
| `dashboard/src/app/api/dash/health/route.ts` | creator | request-response | _no in-repo App Router route handler yet_ — standard Next.js 15 idiom | greenfield (framework std) |
| `dashboard/next.config.mjs` | modifier (add `output:'standalone'`) | config | `dashboard/next.config.mjs` (self) | self |

### Docker / Infra

| File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `docker/Dockerfile.dashboard` | creator | container build | `docker/Dockerfile.grid` (multi-stage node:N-alpine) + `docker/Dockerfile.brain` (ARG forwarding) | role-match. NOTE D10 pins node:**22**-alpine intentionally (not node:20 as Dockerfile.grid uses). |
| `docker-compose.yml` | modifier (add `dashboard:` service) | config | `docker-compose.yml` `grid:` service block | self |
| `.env.example` (if exists) | modifier | config | (not present at repo root per listing) — may need creation documenting `DASHBOARD_PORT`, `NEXT_PUBLIC_GRID_ORIGIN` |
| `scripts/docker-smoke.sh` | creator | shell | _no prior smoke script_ | greenfield, not CI-gated per D13 |

---

## Pattern Assignments

### `grid/src/economy/shop-registry.ts` (creator, CRUD in-memory)

**Analog:** `grid/src/registry/registry.ts` (VERIFIED 137 lines, full scan)

**Imports + class shell pattern** (registry.ts:1-14):
```typescript
/**
 * Nous Registry — tracks all Nous in the Grid.
 * Handles spawning, lookup, lifecycle transitions, and status management.
 */
import type { NousRecord, SpawnRequest, LifecyclePhase } from './types.js';

export class NousRegistry {
    private readonly records = new Map<string, NousRecord>();
    private readonly nameIndex = new Map<string, string>(); // name → did
```

**Register / duplicate-guard pattern** (registry.ts:15-42):
```typescript
spawn(req: SpawnRequest, ...): NousRecord {
    if (this.records.has(req.did)) {
        throw new Error(`Nous already registered: ${req.did}`);
    }
    // ... build record ...
    this.records.set(req.did, record);
    this.nameIndex.set(req.name.toLowerCase(), req.did);
    return record;
}
```

**List/get pattern** (registry.ts:44-53, 121-124):
```typescript
get(did: string): NousRecord | undefined { return this.records.get(did); }
all(): NousRecord[] { return [...this.records.values()]; }
```

**Key invariants for ShopRegistry:**
- In-memory `Map<string, Shop>`; `.js` import specifiers on local types; `register()` throws on duplicate id; `listAll()` returns array-spread copy; all returned data frozen per RESEARCH Pattern code example (`Object.freeze({...shop, listings: Object.freeze([...])})`) because shops are *read-only after seeding* (PITFALL 9).

---

### `grid/src/economy/types.ts` (modifier, type-only)

**Analog:** self — file currently defines only `EconomyConfig` (VERIFIED, 11 lines).

**Existing shape to preserve** (types.ts:1-11):
```typescript
/**
 * Economy configuration types for Grid.
 */
export interface EconomyConfig {
    initialSupply: number;
    transactionFee: number;
    minTransfer: number;
    maxTransfer: number;
}
```

**Add** (per RESEARCH Code Examples "ShopRegistry"):
```typescript
export interface Shop {
  readonly id: string;
  readonly ownerDid: string;
  readonly name: string;
  readonly region: string;
  readonly listings: ReadonlyArray<{ readonly kind: string; readonly price: number }>;
}
export type ShopSeed = Shop;  // alias for GenesisConfig.shops
```

**Key invariant:** All fields `readonly` (matches `Readonly<SelectionSnapshot>` convention in RESEARCH Pattern 1). No mutation after `register()`.

---

### `grid/src/registry/registry.ts` (modifier — add `transferOusia`)

**Analog:** self — `spawn()` is the atomicity reference.

**Atomic check-then-apply pattern** (registry.ts:15-42):
```typescript
if (this.records.has(req.did)) { throw ...; }
if (this.nameIndex.has(req.name.toLowerCase())) { throw ...; }
// build and commit in one synchronous block
this.records.set(...); this.nameIndex.set(...);
```

**New method signature** (per CONTEXT D8 + RESEARCH Code Examples):
```typescript
/** Bilateral Ousia transfer — atomic debit proposer / credit counterparty. Returns false on insufficient balance or unknown DID. */
transferOusia(fromDid: string, toDid: string, amount: number): boolean {
    const from = this.records.get(fromDid);
    const to = this.records.get(toDid);
    if (!from || !to || amount <= 0 || from.ousia < amount) return false;
    from.ousia -= amount;
    to.ousia += amount;
    return true;
}
```

**Key invariant:** check all failure conditions FIRST (existence, positivity, sufficient balance), then mutate both sides synchronously — no partial state. Returns boolean (never throws), mirroring `suspend`/`reinstate` boolean contract (registry.ts:76-98).

---

### `grid/src/genesis/presets.ts` (modifier — seed `TEST_CONFIG.shops`)

**Analog:** self — `TEST_CONFIG` at `presets.ts:112-130`.

**Existing TEST_CONFIG tail** (presets.ts:125-130):
```typescript
economy: { initialSupply: 500 },
seedNous: [
    { name: 'Sophia', did: 'did:key:sophia', publicKey: 'pk-sophia', region: 'alpha' },
    { name: 'Hermes', did: 'did:key:hermes', publicKey: 'pk-hermes', region: 'beta' },
],
```

**Add after `seedNous`** (per CONTEXT specifics):
```typescript
shops: [
    { id: 'sophia.library', ownerDid: 'did:noesis:sophia', name: 'Sophia\u2019s Library', region: 'agora', listings: [{kind:'dialectic-session', price:5}] },
    { id: 'hermes.courier',  ownerDid: 'did:noesis:hermes',  name: 'Hermes\u2019 Courier',  region: 'agora', listings: [{kind:'message-delivery',   price:2}] },
]
```

**Key invariant:** NO shop for Themis (lawkeeper, not merchant — CONTEXT specifics). `GENESIS_CONFIG` stays un-seeded in this phase (CONTEXT deferred). `shops` is an **optional** new field on `GenesisConfig` so other presets with no economy don't need migration.

---

### `grid/src/genesis/launcher.ts` (modifier — wire `ShopRegistry`)

**Analog:** self — `bootstrap()` at `launcher.ts:51-95`.

**Existing construction + seed pattern** (launcher.ts:28-66):
```typescript
constructor(private readonly config: GenesisConfig) {
    this.clock = new WorldClock({...});
    this.space = new SpatialMap();
    this.logos = new LogosEngine();
    this.audit = new AuditChain();
    this.economy = new EconomyManager(config.economy);
    this.registry = new NousRegistry();
}
bootstrap(opts: { skipSeedNous?: boolean } = {}): void {
    // 1. Seed regions
    for (const region of this.config.regions) { this.space.addRegion(region); }
    // 2. Seed connections / 3. Enact laws / 4. Spawn seed Nous
    ...
}
```

**Key invariant:** Add `readonly shops: ShopRegistry` next to `registry`. Seed in `bootstrap()` *unconditionally* (unlike `seedNous` which `opts.skipSeedNous` can toggle — shops are deterministic config, not persisted in DB yet per PITFALL 9). Seeding happens AFTER regions so any future `region` validation on listings has its source of truth.

---

### `grid/src/integration/types.ts` (modifier — widen `BrainAction`)

**Analog:** self (VERIFIED, 43 lines — full file).

**Current `BrainAction` union** (types.ts:8-13):
```typescript
export interface BrainAction {
    action_type: 'speak' | 'direct_message' | 'move' | 'noop';
    channel: string;
    text: string;
    metadata: Record<string, unknown>;
}
```

**Modify to** (per D8 + PITFALL 3):
```typescript
action_type: 'speak' | 'direct_message' | 'move' | 'noop' | 'trade_request';
```

**Key invariant:** This local mirror MUST be widened BEFORE `nous-runner.ts` adds the switch case (PITFALL 3 — else the `switch` silently falls through to default and trades are dropped). `channel`/`text` remain non-optional (runner reads via `action.metadata`, ignores channel/text for trades).

---

### `grid/src/integration/nous-runner.ts` (modifier — add `trade_request` case)

**Analog:** self — existing `direct_message` case is the closest handler shape.

**Existing `direct_message` pattern** (nous-runner.ts:101-111):
```typescript
case 'direct_message': {
    const targetDid = action.metadata?.['target_did'] as string | undefined;
    this.audit.append('nous.direct_message', this.nousDid, {
        targetDid,
        channel: action.channel,
        text: action.text.slice(0, 100),
        tick,
    });
    break;
}
```

**New `trade_request` case** (per RESEARCH Code Examples lines 652-675 — copy verbatim modulo `services.*` rename to instance fields):
```typescript
case 'trade_request': {
  const md = action.metadata as Record<string, unknown>;
  if (typeof md?.['counterparty_did'] !== 'string' ||
      !/^did:noesis:[a-z0-9_\-]+$/i.test(md['counterparty_did'] as string) ||
      typeof md['amount'] !== 'number' || (md['amount'] as number) <= 0 ||
      typeof md['nonce'] !== 'string') {
    break;  // malformed metadata — drop silently (log optional)
  }
  const transferred = this.registry.transferOusia(
    this.nousDid, md['counterparty_did'] as string, md['amount'] as number,
  );
  if (!transferred) break;
  this.audit.append('trade.settled', this.nousDid, {
    counterparty: md['counterparty_did'],
    amount: md['amount'],
    nonce: md['nonce'],
  });
  break;
}
```

**Key invariants:**
- Payload schema EXACTLY `{counterparty, amount, nonce}` — no `memo`, `reason`, or free text (PITFALL 4).
- Uses `this.registry` / `this.audit` (class fields, NOT a `services` closure — the runner stores them on the instance, runner.ts:33-36).
- `action.actor_did` does NOT exist on the local `BrainAction` type — use `this.nousDid` (which is always the actor for actions returned by this runner's brain).

---

### `grid/src/api/server.ts` (modifier — add 4 routes)

**Analog:** self — `GET /api/v1/grid/regions[/id]` at `server.ts:80-94` (VERIFIED).

**Existing GET route pattern** (server.ts:80-94):
```typescript
app.get('/api/v1/grid/regions', async () => {
    return { regions: services.space.allRegions(), connections: services.space.allConnections() };
});
app.get<{ Params: { id: string } }>('/api/v1/grid/regions/:id', async (req, reply) => {
    const region = services.space.getRegion(req.params.id);
    if (!region) { reply.code(404); return { error: 'Region not found', code: 404 }; }
    return region;
});
```

**Querystring pattern** (server.ts:113-124, audit trail):
```typescript
app.get<{ Querystring: { type?: string; actor?: string; limit?: string; offset?: string } }>(
    '/api/v1/audit/trail',
    async (req) => {
        const entries = services.audit.query({
            eventType: req.query.type,
            limit: req.query.limit ? parseInt(req.query.limit, 10) : 50,
            offset: req.query.offset ? parseInt(req.query.offset, 10) : 0,
        });
        return { entries, total: services.audit.length };
    },
);
```

**New routes to add** (per RESEARCH Code Examples + CONTEXT D1/D6):
1. `GET /api/v1/grid/nous` — maps `registry.all()` → `[{did, name, region, ousia, lifecyclePhase}]`.
2. `GET /api/v1/nous/:did/state` — DID regex guard → `brainClient.call('get_state')` → 200/404/503 (RESEARCH Code Examples lines 606-623).
3. `GET /api/v1/economy/trades` — `audit.query({eventType:'trade.settled', limit, offset})` → map to `{id, tick, createdAt, proposer, counterparty, amount, nonce}` (RESEARCH lines 628-647).
4. `GET /api/v1/economy/shops` — `shops.listAll()`.

**Key invariants:**
- All 4 routes registered BEFORE `app.register(fastifyWebsocket, ...)` call at server.ts:133 (CONTEXT specifics: route order).
- The `GridServices` interface (server.ts:18-24) must be widened to include `registry: NousRegistry`, `shops: ShopRegistry`, and `nousRunners: { brainClientFor(did): RPCClient | null }` (or equivalent). The existing `GridServices` at server.ts:18-24 does NOT currently hold the registry — this is an expected extension.
- CORS allowlist at server.ts:46-50 is UNCHANGED — all new routes inherit `['http://localhost:3001', 'http://localhost:3000']`. Do not add origins.
- Invalid DID: `400 { error: 'invalid did', did }`. Unknown DID: `404 { error: 'nous unknown', did }`. Brain dead: `503 { error: 'brain unreachable', did }` (CONTEXT specifics).

---

### `brain/src/noesis_brain/rpc/handler.py` (modifier — widen `get_state`)

**Analog:** self — `get_state()` at `handler.py:128-137` (VERIFIED, full file 155 lines).

**Current method** (handler.py:128-137):
```python
def get_state(self) -> dict[str, Any]:
    """Return current brain state for Human Channel."""
    return {
        "name": self.psyche.name,
        "archetype": self.psyche.archetype,
        "mood": self.thymos.mood.current_mood(),
        "emotions": self.thymos.mood.describe(),
        "active_goals": [g.description for g in self.telos.active_goals()],
        "location": self.location,
    }
```

**Widen per CONTEXT D2 + RESEARCH Pattern 5** (keep existing top-level keys for backward-compat, ADD new nested blocks). Use `self.memory.recent(limit=5)` — this method EXISTS at `stream.py:86` (VERIFIED):

```python
m_recent = self.memory.recent(limit=5)  # assumes self.memory exists on BrainHandler; see A-1 below
return {
    # backward-compat
    "name": self.psyche.name,
    "archetype": self.psyche.archetype,
    "mood": self.thymos.mood.current_mood(),
    "emotions": self.thymos.mood.describe(),
    "active_goals": [g.description for g in self.telos.active_goals()],
    "location": self.location,
    # NEW per D2
    "did": getattr(self, "did", ""),
    "psyche": {...},   # see RESEARCH Pattern 5 + Assumption A1 (6 dims, string levels)
    "thymos": {...},
    "telos": {"active_goals": [{"id": ..., "description": ..., "priority": ..., "created_tick": ...}, ...]},
    "memory_highlights": [{"tick": m.tick, "kind": m.memory_type.value, "summary": m.content[:240], "salience": m.importance} for m in m_recent],
}
```

**Key invariants:**
- Must be JSON-serializable & deterministic — no `datetime`, no numpy (CONTEXT specifics).
- `memory.recent(limit=5)` is verified present at `brain/src/noesis_brain/memory/stream.py:86` — do NOT add a new method.
- **ASSUMPTION A-1 (blocking):** `BrainHandler.__init__` (handler.py:31-45) does NOT currently accept `memory` or `did`. Plan must add both to the constructor AND update the handler's instantiation site (the `noesis_brain` main module). This is a propagation task the planner must split out.
- Existing callers (`test_rpc_handler.py`) read `name/mood/emotions/active_goals/location` at top level — those keys MUST stay in the return dict to preserve backward-compat.

---

### `brain/test/test_rpc_handler_get_state.py` (test, new)

**Analog:** `brain/test/test_rpc_handler.py` (VERIFIED, pytest + unittest.mock fixtures at lines 1-50).

**Fixture pattern** (test_rpc_handler.py:21-50):
```python
def _make_psyche(name: str = "Sophia", ...) -> Psyche:
    return Psyche(
        name=name, archetype="The Philosopher",
        personality=PersonalityProfile(
            openness="high", conscientiousness="medium", ...
        ),
        ...
    )
def _make_thymos() -> ThymosTracker: ...
```

**Key invariant:** Re-use the existing `_make_psyche` / `_make_thymos` / `_make_telos` fixture helpers (they're module-level functions, free to import). Assert the full superset shape: `assert set(state.keys()) >= {"name","archetype","mood","active_goals","location","did","psyche","thymos","telos","memory_highlights"}`. Assert `len(state["memory_highlights"]) <= 5`.

---

### `dashboard/src/lib/stores/selection-store.ts` (creator, client-state)

**Analog:** `dashboard/src/lib/stores/presence-store.ts` (VERIFIED first 60 lines — framework-agnostic store idiom).

**Store shell pattern** (presence-store.ts:32-60):
```typescript
export class PresenceStore {
    private readonly nousByDid = new Map<...>();
    private readonly listeners = new Set<() => void>();
    private cachedSnapshot: PresenceSnapshot | null = null;

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return (): void => { this.listeners.delete(listener); };
    }
    getSnapshot(): PresenceSnapshot {
        if (this.cachedSnapshot !== null) return this.cachedSnapshot;
        // build frozen snapshot
    }
}
```

**Copy RESEARCH Pattern 1 VERBATIM (lines 280-309)** — RESEARCH already provides the finished class. The only divergence: use `#private` OR `private readonly` to match the presence-store convention (which uses `private readonly`).

**Key invariants:**
- NO React import (framework-agnostic — contract restated in presence-store.ts:20).
- `setSelected(did)` validates against `/^did:noesis:[a-z0-9_\-]+$/i` BEFORE write (PITFALL 7 — XSS guard).
- `getSnapshot()` returns the SAME frozen object reference until state actually changes (useSyncExternalStore tearing invariant — firehose-store.ts:14-15 spells this out).
- Listeners notified synchronously in forEach loop (presence-store pattern, firehose-store.ts:121-126).

---

### `dashboard/src/lib/stores/selection-store.test.ts` (test)

**Analog:** `dashboard/src/lib/stores/firehose-store.test.ts` (VERIFIED first 40 lines).

**Test harness pattern** (firehose-store.test.ts:1-17):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirehoseStore } from './firehose-store';
describe('FirehoseStore — ingest and ordering', () => {
    it('appends entries in arrival order', () => {
        const store = new FirehoseStore();
        store.ingest(...);
        expect(store.getSnapshot().entries).toHaveLength(3);
    });
});
```

**Required cases:**
- `setSelected` with malformed DID → no-op (regex guard).
- `setSelected` followed by `setSelected` of same value → only one listener fire.
- `clear()` → snapshot reports `selectedDid: null`.
- Snapshot referential stability across calls with no mutation.

---

### `dashboard/src/lib/hooks/use-hash-sync.ts` (creator, greenfield — RESEARCH Pattern 2)

**Analog:** _no in-repo equivalent_; the cited reference is Next.js 15 App Router docs (RESEARCH Pattern 2, lines 311-353).

**Copy RESEARCH Pattern 2 VERBATIM.** Key clauses:
```typescript
'use client';
export function useHashSync(key: string, store: SelectionStore): void {
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const v = params.get(key);
    if (v) store.setSelected(v);
    const onHash = () => { /* ... */ };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [key, store]);
  // Write hash on store change via store.subscribe(...)
}
```

**Key invariants:**
- `'use client'` directive at top.
- Uses `history.replaceState` NOT `router.replace` (avoids Next.js server re-render — CONTEXT D16 rationale).
- Validates hash value against DID regex BEFORE calling `store.setSelected` (defense in depth — store also validates, PITFALL 7).

---

### `dashboard/src/lib/hooks/use-selection.ts` + `dashboard/src/app/grid/hooks.ts` modify

**Analog:** `dashboard/src/app/grid/hooks.ts` (VERIFIED exists — contains `usePresence`, `useFirehoseView`, etc.).

**Pattern:** the existing hooks consume stores via `useSyncExternalStore(store.subscribe, store.getSnapshot)`. `useSelection` mirrors this.

**Key invariant:** must co-locate with existing hook exports in `dashboard/src/app/grid/hooks.ts` — D15 locks the file layout but RESEARCH implies a unified hooks module already exists. Plan may choose: (a) add `useSelection` to existing `hooks.ts`, or (b) create `lib/hooks/use-selection.ts` and re-export. Consistency favors (a).

---

### `dashboard/src/app/grid/components/tab-bar.tsx` (creator, WAI-ARIA tablist)

**Analog:** `dashboard/src/app/grid/components/event-type-filter.tsx` (chip-style toggle button cluster — closest to tab bar semantics).

**Imports + 'use client' pattern** (firehose-row.tsx:1-22):
```typescript
'use client';
import { usePresence } from '../hooks';
import type { AuditEntry } from '@/lib/protocol/audit-types';
```

**Key invariants per UI-SPEC §Interaction Contract "Tab bar roving tabindex":**
- `<div role="tablist">` wrapping two `<button role="tab">`.
- Only active tab has `tabindex="0"`; inactive `tabindex="-1"`.
- Arrow-left/right moves focus AND activates (activate-on-focus).
- Active tab signal: 2px accent bottom-border (UI-SPEC Color §6).
- URL state via `?tab=economy` using `router.replace(url, {scroll:false})` — NOT hash (hash is reserved for `#nous=`).

---

### `dashboard/src/app/grid/components/inspector.tsx` (creator, WAI-ARIA dialog drawer)

**Analog:** RESEARCH Pattern 3 (lines 355-413) — no in-repo drawer exists yet.

**Copy RESEARCH Pattern 3** as the shell; inner content renders 4 section components (`PsycheSection`, `TelosSection`, `ThymosSection`, `MemorySection`).

**Fetch-on-open pattern** — mirror `grid-client.tsx` WS setup but use `fetch()` with `AbortController` (see `dashboard/src/lib/transport/refill.ts` for in-repo fetch + abort idiom).

**Key invariants:**
- `role="dialog"` + `aria-modal="true"` + `aria-labelledby="drawer-header-id"` on the `<aside>`.
- Focus moves in on mount (first focusable), restored on unmount (RESEARCH Pattern 3).
- Tab cycle via keyboard handler attached in `useEffect` (NOT `react-focus-lock` — RESEARCH Pattern 3 + PITFALL 6).
- Fetch: `fetch(\`${origin}/api/v1/nous/${did}/state\`, { signal })`. On 503 → render `<EmptyState heading="Brain unreachable" body="..."/>` per CONTEXT specifics.
- Snapshot only — NO `setInterval`, NO WS subscription (CONTEXT D4, PITFALL anti-pattern).

---

### `dashboard/src/app/grid/components/inspector-sections/*.tsx` (4 creators, presentational)

**Analog:** `dashboard/src/app/grid/components/firehose-row.tsx` (VERIFIED 1-80 — concise presentational pattern).

**Format function pattern** (firehose-row.tsx:38-44):
```typescript
function formatTimestamp(ms: number): string {
    const d = new Date(ms);
    const hh = String(d.getHours()).padStart(2, '0');
    // ...
}
```

**Category → Tailwind map pattern** (firehose-row.tsx:29-36):
```typescript
const CATEGORY_BADGE: Record<EventCategory, string> = {
    movement: 'bg-blue-400/10 text-blue-300',
    ...
};
```

**Key invariants (from 04-UI-SPEC.md):**
- `psyche.tsx`: 5 `<MeterRow>` (or 6 with Assumption A1 fallback — warning-colored bars when string levels).
- `telos.tsx`: iteration over `active_goals[]`; empty state `"No active goals. Telos is quiescent."` (VERBATIM).
- `thymos.tsx`: top-6 emotions by intensity, overflow `"+N more"`.
- `memory.tsx`: 5 rows, summary truncated via `-webkit-line-clamp:2`, salience bar (NOT animation — informational).
- All copy strings VERBATIM from 04-UI-SPEC.md §Copywriting Contract. No exclamation, no emoji.

---

### `dashboard/src/app/grid/components/economy/economy-panel.tsx` (creator, container)

**Analog:** `dashboard/src/app/grid/grid-client.tsx` (VERIFIED 1-130 — WS + fetch composition).

**REST hydrate + WS subscribe pattern** (grid-client.tsx:61-128):
```typescript
useEffect(() => {
    const client = new WsClient({ url: wsUrl, onError: ... });
    const offEvent = client.on('event', (entry) => ingestAll([entry]));
    client.connect();
    return () => { client.close(); abort.abort(); };
}, [origin, stores]);
```

**Key invariants (CONTEXT D6):**
- On mount: 3 REST fetches (`/api/v1/grid/nous`, `/api/v1/economy/trades?limit=20`, `/api/v1/economy/shops`).
- Subscribe to existing WsClient's `'event'` channel, filter client-side for `entry.eventType === 'trade.settled'`.
- On `trade.settled` frame: re-fetch balances + trades ONLY (shops unchanged per UI-SPEC data flow diagram).
- `AbortController` on unmount — CRITICAL to prevent late-resolving fetch from writing to freed panel (grid-client.tsx:76 + 100-107 show the pattern).
- NO new WS frame type introduced (PITFALL 2 anti-pattern — allowlist frozen).

---

### `dashboard/src/app/grid/components/economy/{balance-grid,trades-table,shops-list}.tsx` (3 creators)

**Analog:** `dashboard/src/app/grid/components/firehose.tsx` — existing table-like list panel.

**Key invariants (UI-SPEC §Component Inventory C8-C10):**
- Semantic `<table><thead><th scope="col">...<tbody>` — NOT `<div>` grids.
- Row 28px (UI-SPEC exception documented).
- Row click → `SelectionStore.setSelected(did)` — opens inspector (UI-SPEC interaction #9).
- Trades table prepends new rows with 200ms opacity fade (respects `prefers-reduced-motion`).
- Balance row left-border flashes `--color-destructive`/`--color-success` 600ms on `trade.settled` (non-motion, stays on reduced-motion).

---

### `dashboard/src/app/grid/grid-client.tsx` (modifier — integrate TabBar + Inspector)

**Analog:** self (VERIFIED 1-130).

**Existing structure to extend** (grid-client.tsx:47-55):
```typescript
export function GridClient(props: GridClientProps): React.ReactElement {
    return (
        <StoresProvider>
            <GridLayout {...props} />
        </StoresProvider>
    );
}
```

**Modifications:**
1. `<StoresProvider>` must be extended (in `use-stores.ts`) to instantiate + provide `SelectionStore` alongside the existing triple.
2. Add `useHashSync('nous', selectionStore)` call in `<GridLayout>`.
3. Tab bar rendered above the Firehose/Map split.
4. Inspector rendered as sibling to the panel tree (so it overlays correctly).
5. NOT a route change — tab switches via `?tab=economy` query param (CONTEXT D12).

---

### `dashboard/src/app/api/dash/health/route.ts` (creator, Next.js App Router)

**Analog:** _no in-repo route handler yet_ — standard Next.js 15 App Router idiom.

**Canonical pattern (per CONTEXT D14):**
```typescript
// dashboard/src/app/api/dash/health/route.ts
export const dynamic = 'force-dynamic';
export async function GET(): Promise<Response> {
    return Response.json({
        status: 'ok',
        gridOrigin: process.env.NEXT_PUBLIC_GRID_ORIGIN ?? null,
    });
}
```

**Key invariants:**
- MUST NOT probe the Grid (CONTEXT D14 — cascade-fail prevention, PITFALL 8).
- `force-dynamic` prevents Next.js from statically building the handler (static export would break with standalone runtime).

---

### `dashboard/next.config.mjs` (modifier)

**Analog:** self (VERIFIED, 8 lines).

**Current file:**
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
};
export default nextConfig;
```

**Add:**
```javascript
output: 'standalone',
```

**Key invariant:** REQUIRED by `docker/Dockerfile.dashboard` — without it there is no `.next/standalone/server.js` to run. `output: 'export'` is FORBIDDEN (breaks route handlers — PITFALL "`output:'export'`").

---

### `docker/Dockerfile.dashboard` (creator, multi-stage node:22-alpine)

**Analogs:**
- Stage pattern → `docker/Dockerfile.grid` (VERIFIED 1-58).
- Build-arg forwarding → `docker/Dockerfile.brain` (VERIFIED 1-47).

**Copy RESEARCH Pattern 4 (lines 415-459).** Critical diffs from `Dockerfile.grid`:
- Base: `node:22-alpine` (NOT `node:20-alpine` — CONTEXT D10 deliberately non-aligned).
- Three stages: `deps`, `builder`, `runner` (grid uses `builder`/`runtime`).
- `ARG NEXT_PUBLIC_GRID_ORIGIN` in `builder` stage, `ENV`'d BEFORE `npm run build`.
- `runner` copies `dashboard/.next/standalone` + `dashboard/.next/static` + `dashboard/public`.
- Non-root `USER nextjs`, `EXPOSE 3001`, `CMD ["node", "dashboard/server.js"]`.

**Key invariants:**
- `NEXT_PUBLIC_GRID_ORIGIN` MUST be an `ARG` baked into the builder `ENV` (PITFALL 1 — build-time, not runtime).
- `HEALTHCHECK` optional here; compose-level healthcheck is authoritative (per D10).

---

### `docker-compose.yml` (modifier — add `dashboard:` service)

**Analog:** self — existing `grid:` block at `docker-compose.yml:26-56`.

**Existing `grid:` pattern:**
```yaml
grid:
    build: { context: ., dockerfile: docker/Dockerfile.grid }
    depends_on: { mysql: { condition: service_healthy } }
    ports: ["${GRID_PORT:-8080}:8080"]
    environment: { ... }
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8080/health"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 30s
    restart: unless-stopped
```

**New `dashboard:` block (copy CONTEXT D10 text VERBATIM):**
```yaml
dashboard:
    build: { context: ., dockerfile: docker/Dockerfile.dashboard }
    depends_on: { grid: { condition: service_healthy } }
    ports: ["${DASHBOARD_PORT:-3001}:3001"]
    environment:
      NEXT_PUBLIC_GRID_ORIGIN: "http://localhost:${GRID_PORT:-8080}"
      PORT: 3001
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3001/api/dash/health"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 20s
    restart: unless-stopped
```

**Key invariants:**
- `NEXT_PUBLIC_GRID_ORIGIN` MUST be `http://localhost:${GRID_PORT:-8080}` — NOT `http://grid:8080` (PITFALL 1 / anti-pattern "NEXT_PUBLIC_GRID_ORIGIN=http://grid:8080"). Browser-facing, host-mapped.
- `start_period: 20s` is Next.js standalone cold-start specific (PITFALL 8). Not 30s like grid.
- `depends_on` is `grid: service_healthy` (not MySQL) — dashboard needs Grid up, MySQL transitive via grid.

---

### Test files — Grid API routes

**Analog for all 3 route tests:** `grid/test/api/server.regions.test.ts` (VERIFIED 1-60).

**Harness pattern** (server.regions.test.ts:9-32):
```typescript
function seedServer(seedRegions: boolean): { app: FastifyInstance; clock: WorldClock } {
    const clock = new WorldClock({ tickRateMs: 100_000 });
    const space = new SpatialMap();
    // ... seed ...
    const app = buildServer({ clock, space, logos, audit, gridName: 'genesis' });
    return { app, clock };
}
describe('GET /api/v1/grid/regions — returns regions + connections', () => {
    let app: FastifyInstance;
    beforeAll(async () => { ({ app } = seedServer(true)); await app.ready(); });
    afterAll(async () => { await app.close(); });
    it('returns both regions array and connections array', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/grid/regions' });
        expect(res.statusCode).toBe(200);
    });
});
```

**Key invariants:**
- Use `app.inject({method, url})` — NOT a real HTTP client.
- `buildServer(services)` assembly must include the widened `GridServices` (with `registry`, `shops`, `nousRunners`/brainClient stub).
- For `server.nous-state.test.ts`: mock a `brainClientFor(did)` that returns `{ call: vi.fn().mockResolvedValue(stateFixture) }` — 200 path; mock rejecting `call` for 503 path; `brainClientFor` returns `null` for 404 path.

---

## Shared Patterns

### Framework-agnostic store (useSyncExternalStore contract)
**Source:** `dashboard/src/lib/stores/presence-store.ts` + `firehose-store.ts` (both VERIFIED).
**Apply to:** `selection-store.ts` (and any future dashboard store in this phase).
```typescript
private readonly listeners = new Set<() => void>();
private cachedSnapshot: TSnapshot | null = null;
subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
}
getSnapshot(): TSnapshot {
    if (this.cachedSnapshot !== null) return this.cachedSnapshot;
    this.cachedSnapshot = Object.freeze({...});
    return this.cachedSnapshot;
}
private invalidate(): void {
    this.cachedSnapshot = null;
    for (const l of this.listeners) l();
}
```
**Invariant:** `getSnapshot()` returns same object reference until mutation. NO React import.

### DID regex validation
**Source:** `grid/src/api/server.ts` has no prior DID validator; regex canonicalized by RESEARCH Pattern 1 (`DID_RE`).
**Apply to:** Every public entry point that accepts a DID:
- `SelectionStore.setSelected` (store layer — PITFALL 7)
- `useHashSync` (hook layer — defense in depth)
- `grid/src/api/server.ts:/api/v1/nous/:did/state` (route layer — 400 on invalid)
- `grid/src/integration/nous-runner.ts` `trade_request` handler (counterparty validation)
```typescript
const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;
```

### Fastify route convention
**Source:** `grid/src/api/server.ts:80-94` + `113-124`.
**Apply to:** All 4 new grid routes.
- Path: `/api/v1/...`.
- Register BEFORE `fastifyWebsocket` registration (CONTEXT specifics: route order).
- Typed params: `app.get<{ Params: { ... } }>(...)` or `Querystring`.
- 404: `reply.code(404); return { error: '...', code: 404 };` (existing style) OR `reply.code(404).send({...})` (RESEARCH alt style — acceptable).
- CORS allowlist UNCHANGED at server.ts:46-50.

### Audit append for trade.settled (payload privacy)
**Source:** `grid/src/audit/broadcast-allowlist.ts` docstring + PITFALL 4.
**Apply to:** `nous-runner.ts` trade_request case.
- Payload keys EXACTLY `{counterparty, amount, nonce}`.
- No `memo`, `reason`, `body`, `text`, or any free-string field.
- Regression test MUST assert `payloadPrivacyCheck(payload)` passes.

### Docker multi-stage + non-root + healthcheck
**Source:** `docker/Dockerfile.grid`.
**Apply to:** `docker/Dockerfile.dashboard`.
- Two or three stages (deps→builder→runner for dashboard).
- `addgroup -S / adduser -S` then `USER <user>` before `CMD`.
- `HEALTHCHECK --interval=15s --timeout=5s` minimum; `start_period` tuned per service (20s for Next.js standalone, 30s for Grid, 30s for MySQL).
- `CMD ["node", "<path>/server.js"]` exec-form for SIGTERM propagation.

### Test harness (Vitest + Fastify inject)
**Source:** `grid/test/api/server.regions.test.ts`.
**Apply to:** All new `grid/test/api/server.*.test.ts` files.
- `beforeAll` → `app.ready()`; `afterAll` → `app.close()`.
- `app.inject({method,url})` — never real HTTP.
- Services assembled in a `seedServer()` helper with test doubles for the brain client where relevant.

### RTL test harness
**Source:** `dashboard/src/app/grid/components/firehose.test.tsx:1-50`.
**Apply to:** All new dashboard `.test.tsx` files.
- Wrap renders in `<StoresProvider>`.
- `resetFixtureIds()` in `beforeEach` when using `makeAuditEntry` fixture.
- Use `act(() => ...)` for store mutations; `userEvent` for clicks.

---

## No Analog Found

Files with no close match in the codebase (planner should lean on RESEARCH.md patterns + cited external references):

| File | Role | Data Flow | Reason | Reference |
|------|------|-----------|--------|-----------|
| `dashboard/src/app/grid/components/inspector.tsx` | drawer container | fetch + WAI-ARIA dialog | No prior modal/drawer in repo | RESEARCH Pattern 3 (WAI-ARIA APG cited) |
| `dashboard/src/lib/hooks/use-hash-sync.ts` | bidir URL↔store hook | client-only | No prior URL-sync hook | RESEARCH Pattern 2 + Next.js 15 App Router docs |
| `dashboard/src/app/api/dash/health/route.ts` | Next.js route handler | static response | No prior Next.js App Router route handler in repo | Next.js 15 std idiom (CONTEXT D14) |
| `scripts/docker-smoke.sh` | shell smoke | CLI | No prior smoke script | New per D13 (not CI-gated) |
| Primitive components `<Chip>`, `<MeterRow>`, `<EmptyState>` (UI-SPEC P1/P2/C11) | presentational primitives | pure UI | No prior presentational primitives dir | UI-SPEC §Component Inventory — compose existing Tailwind `@theme` tokens from `dashboard/src/app/globals.css` |

---

## Assumptions Flagged for Planner Ratification

**A-1 (blocking):** `BrainHandler.__init__` (handler.py:31-45) does NOT currently accept `memory` or `did`. The widened `get_state()` references `self.memory.recent(...)` and `self.did`. Planner MUST split out a sub-task to plumb both into the handler constructor AND update the instantiation site in `brain/src/noesis_brain/__main__.py` (or wherever the handler is constructed). Without this, Plan 2 (Brain) cannot compile.

**A-2 (already resolved by RESEARCH):** `EpisodicMemoryStream.recent(limit=20)` EXISTS at `stream.py:86` — no new method needed.

**A-3 (deferred to executor):** `Psyche` currently uses string levels ("high"/"medium") — see `test_rpc_handler.py:29-35`. D2 schema expects floats. UI-SPEC §Assumption A1 already specifies a warning-colored fallback bar render. Plan must explicitly instruct executor: "emit floats if brain's current `PersonalityProfile` exposes a numeric getter; else emit strings and let UI map to bar positions 0.25/0.55/0.85."

**A-4 (grid test layout):** RESEARCH lists `grid/test/unit/shop-registry.test.ts` but the repo has NO `grid/test/unit/` directory — existing tests are FLAT in `grid/test/*.test.ts` with `grid/test/api/`, `grid/test/genesis/`, `grid/test/integration/` as the only subdirectories. Plan should place `shop-registry.test.ts` at `grid/test/economy/shop-registry.test.ts` (new subdir, matches convention) OR flat at `grid/test/shop-registry.test.ts`. Do NOT create `grid/test/unit/`.

**A-5 (brain test path):** CONTEXT and RESEARCH both say `brain/tests/` — the actual path is `brain/test/` (singular). All brain test files land in `brain/test/test_*.py`.

---

## Metadata

**Analog search scope:** `grid/src/`, `grid/test/`, `brain/src/`, `brain/test/`, `dashboard/src/`, `docker/`, repo root. Depth: 5 levels.
**Files scanned (Read):** 18 full or targeted reads — `registry.ts`, `api/server.ts`, `nous-runner.ts`, `integration/types.ts`, `genesis/presets.ts`, `genesis/launcher.ts:1-80`, `economy/types.ts`, `brain/.../handler.py`, `brain/.../memory/stream.py:60-110`, `brain/test/test_rpc_handler.py:1-50`, `dashboard/.../firehose-store.ts`, `presence-store.ts:1-60`, `firehose-store.test.ts:1-40`, `firehose-row.tsx:1-80`, `region-map.tsx:1-50`, `grid-client.tsx:1-130`, `next.config.mjs`, `docker/Dockerfile.grid`, `docker/Dockerfile.brain`, `docker-compose.yml`, `grid/test/api/server.regions.test.ts:1-60`, `grid/test/registry.test.ts:1-60`, `grid/test/genesis/launcher.tick-audit.test.ts:1-30`, `dashboard/.../firehose.test.tsx:1-50`, `dashboard/.../region-map.test.tsx:1-30`.
**Pattern extraction date:** 2026-04-18

---

## PATTERN MAPPING COMPLETE

**Phase:** 04 - Nous Inspector + Economy + Docker Polish
**Files classified:** 40 (8 grid src + 2 brain + 25 dashboard + 3 docker/infra + 2 test umbrella)
**Analogs found:** 38 / 40

### Coverage
- Files with exact analog (same role + data flow, existing in repo): 22
- Files with role-match analog (same role, different data flow): 16
- Files with no in-repo analog (cited external pattern): 5 (inspector drawer, use-hash-sync, health route, docker-smoke shell, UI primitives)

### Key Patterns Identified
- **All new grid REST routes** mirror `server.ts:80-94` (Fastify `app.get<{Params|Querystring}>`, typed reply, registered BEFORE `fastifyWebsocket`); CORS allowlist FROZEN.
- **All new dashboard stores** mirror `presence-store.ts` + `firehose-store.ts` — framework-agnostic class with `subscribe/getSnapshot/invalidate`, snapshot referential stability, NO React import, DID regex validation at entry points (PITFALL 7).
- **`trade.settled` audit payload** must be EXACTLY `{counterparty, amount, nonce}` — no free text (PITFALL 4, privacy lint regression test required).
- **Inspector drawer** is snapshot-only (no polling, no WS sub — CONTEXT D4); WAI-ARIA focus trap is hand-rolled (RESEARCH Pattern 3, no `react-focus-lock`).
- **Docker dashboard** uses `node:22-alpine` (intentionally different from grid's `node:20-alpine`), REQUIRES `NEXT_PUBLIC_GRID_ORIGIN` as build `ARG` baked into `ENV` before `npm run build` (PITFALL 1 — Next.js `NEXT_PUBLIC_*` is build-time, not runtime).

### File Created
`/Users/desirey/Programming/src/Noēsis/.planning/phases/04-nous-inspector-economy-docker-polish/04-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can now author plan files with concrete `<read_first>` references pointing to the cited file+line ranges above. Three assumption flags (A-1 brain handler widening prereq, A-3 Psyche dims fallback, A-4/A-5 test path corrections) should be resolved in the plan's ordering/prerequisites section.
