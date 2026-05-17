# Phase 8: H5 Sovereign Operations — Nous Deletion - Pattern Map

**Mapped:** 2026-04-21
**Files analyzed:** 27 (4 grid-new, 6 grid-modified, 8 grid-tests, 3 brain, 2 brain-tests, 2 dashboard-new, 3 dashboard-modified, 2 dashboard-tests, 1 doc-sync)
**Analogs found:** 27 / 27

## File Classification

### Grid — New Files

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `grid/src/audit/append-nous-deleted.ts` | utility (producer-boundary) | request-response | `grid/src/audit/append-telos-refined.ts` + `grid/src/audit/operator-events.ts` | exact |
| `grid/src/audit/state-hash.ts` | utility (canonical-JSON SHA-256) | transform | `grid/src/dialogue/dialogue-id.ts` (Phase 7) + `brain/src/noesis_brain/telos/hashing.py` (canonicalization) | role-match |
| `grid/src/api/operator/delete-nous.ts` | controller (REST route) | request-response | `grid/src/api/operator/telos-force.ts` | exact |
| `grid/src/registry/tombstone-check.ts` | utility (410 gate) | request-response | `grid/src/api/operator/_validation.ts` `validateTierBody` | role-match |

### Grid — Modified Files

| Modified File | Role | Data Flow | Change |
|---------------|------|-----------|--------|
| `grid/src/audit/broadcast-allowlist.ts` | config (frozen tuple) | n/a | append `'operator.nous_deleted'` at position 18 (17→18) |
| `grid/src/registry/types.ts` | type module | n/a | extend `status` union with `'deleted'`; add `deletedAtTick?: number` |
| `grid/src/registry/registry.ts` | service (in-mem store) | CRUD | add `tombstone(did, tick)` method peer to `suspend`/`exile`/`reinstate` |
| `grid/src/space/map.ts` | service (spatial store) | CRUD | add `removeNous(did)` method peer to `placeNous` |
| `grid/src/integration/grid-coordinator.ts` | orchestrator | event-driven | add `despawnNous(did)` — bridge.close + tick-unsub + SpatialMap.removeNous |
| `grid/src/integration/nous-runner.ts` | controller | request-response | tick-dispatch skip guard on `status === 'deleted'` |
| `grid/src/api/server.ts` | wiring | n/a | register delete route; extend `InspectorRunner.computePreDeletionStateHash?` |
| `grid/src/api/introspect.ts` (or handler) | controller | request-response | add `status` to `NousStateResponse`; tombstone-check before body emit |

### Grid — New Tests

| Test File | Role | Analog |
|-----------|------|--------|
| `grid/test/audit/nous-deleted-privacy.test.ts` | unit (privacy matrix) | `grid/test/audit/operator-payload-privacy.test.ts` (8-case enumeration) |
| `grid/test/audit/nous-deleted-producer-boundary.test.ts` | unit (grep invariant) | `grid/test/audit/telos-refined-producer-boundary.test.ts` |
| `grid/test/audit/allowlist-eighteen.test.ts` | unit (frozen-tuple) | `grid/test/audit/allowlist-seventeen.test.ts` |
| `grid/test/api/operator-delete-route.test.ts` | integration (error ladder + happy) | `grid/test/api/operator/telos.test.ts` |
| `grid/test/api/operator-delete-tombstone-routes.test.ts` | integration (410 coverage) | `grid/test/api/operator/telos.test.ts` |
| `grid/test/registry/tombstone-did-reuse.test.ts` | unit (SC#5) | `grid/test/registry/*` (registry CRUD tests) |
| `grid/test/registry/tombstone-tick-skip.test.ts` | unit (SC#3 race) | `grid/test/audit.test.ts` deterministic-clock pattern |
| `grid/test/nous-deleted-zero-diff.test.ts` | unit (SC#4 determinism) | `grid/test/audit.test.ts` lines 253-281 |
| `grid/test/audit-no-purge.test.ts` | unit (chain preservation) | `grid/test/audit.test.ts` (verify + replay) |

### Brain — Files

| File | Role | Change | Analog |
|------|------|--------|--------|
| `brain/src/noesis_brain/state_hash.py` | utility (canonicalization) | NEW — 3 sibling helpers (`compute_psyche_hash`, `compute_thymos_hash`, `compute_memory_stream_hash`) | `brain/src/noesis_brain/telos/hashing.py` `compute_active_telos_hash` |
| `brain/src/noesis_brain/rpc/types.py` | enum | add `COMPUTE_PRE_DELETION_STATE_HASH` | existing `ActionType.FORCE_TELOS` / `TELOS_REFINED` sibling |
| `brain/src/noesis_brain/rpc/handler.py` | controller | new `compute_pre_deletion_state_hash` method returning 4-hash dict | `handler.force_telos` lines 399-436 |
| `brain/test/test_state_hash_rpc.py` | unit (4-hash contract) | `brain/test/test_rpc_handler.py` (fixture builders) |
| `brain/test/test_state_hash_functions.py` | unit (per-component) | `brain/test/test_telos_refined_action.py` (hash determinism) |

### Dashboard — New Files

| File | Role | Analog |
|------|------|--------|
| `dashboard/src/components/agency/irreversibility-dialog.tsx` | component (native `<dialog>` primitive) | `dashboard/src/components/agency/elevation-dialog.tsx` (peer; same dir) |
| `dashboard/src/components/agency/irreversibility-dialog.test.tsx` | unit (DID-typed gate + paste suppressed + copy-lock) | `dashboard/src/components/agency/elevation-dialog.test.tsx` |
| `dashboard/src/app/grid/components/inspector-delete.test.tsx` | integration (2-stage flow wiring) | `dashboard/src/components/agency/elevation-race.test.tsx` (closure-capture SC#4) |

### Dashboard — Modified Files

| File | Change |
|------|--------|
| `dashboard/src/components/agency/elevation-dialog.tsx` | extend `ElevatedTier` to include `'H5'`; add `H5: 'bg-rose-700 text-neutral-100'` row in `CONFIRM_FILL` |
| `dashboard/src/app/grid/components/inspector.tsx` | wire H5 button `onClick`; remove `disabled`; render tombstoned-state; add `nous_deleted` `ERR_COPY` entry |
| `dashboard/src/lib/api/introspect.ts` | widen `NousStateResponse` with `status`; add `'nous_deleted'` to `FetchError.kind`; add `410` to `STATUS_TO_KIND` |
| `dashboard/src/lib/api/operator.ts` | add `deleteNous()` wrapper + extend `OperatorErrorKind` with `'nous_deleted'` |

### Doc-sync Files

| File | Change |
|------|--------|
| `scripts/check-state-doc-sync.mjs` | bump `/17\s+events/i` → `/18\s+events/i`; append `'operator.nous_deleted'` to `required` array |
| `.planning/STATE.md` | update "17 events" → "18 events"; append `operator.nous_deleted` to enumeration; resolve Open Question #3 |
| `README.md` | bump allowlist-count promise if present |
| `.planning/ROADMAP.md` | mark Phase 8 complete |
| `.planning/MILESTONES.md` | append Phase 8 entry |
| `PHILOSOPHY.md` | double-check §7 H5 narrative accuracy (no new invariants) |

---

## Pattern Assignments

### `grid/src/audit/append-nous-deleted.ts` (utility, producer-boundary)

**Analog:** `grid/src/audit/append-telos-refined.ts` (primary structural sibling) + `grid/src/audit/operator-events.ts` (tier-required invariant for `operator.*` namespace)

**Pattern to copy** (from `append-telos-refined.ts` lines 23-104 — regex-guard ladder + closed-tuple + explicit reconstruction + privacy gate):
```typescript
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

export const HEX64_RE = /^[a-f0-9]{64}$/;
export const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;

export interface NousDeletedPayload {
    readonly tier: 'H5';
    readonly action: 'delete';
    readonly operator_id: string;
    readonly target_did: string;
    readonly pre_deletion_state_hash: string;
}

const EXPECTED_KEYS = ['action', 'operator_id', 'pre_deletion_state_hash', 'target_did', 'tier'] as const;

export function appendNousDeleted(
    audit: AuditChain,
    operatorId: string,
    payload: NousDeletedPayload,
): AuditEntry {
    if (typeof operatorId !== 'string' || operatorId.length === 0) {
        throw new TypeError(`appendNousDeleted: operatorId must be non-empty string`);
    }
    if (payload.tier !== 'H5') {
        throw new TypeError(`appendNousDeleted: tier must be 'H5'`);
    }
    if (payload.action !== 'delete') {
        throw new TypeError(`appendNousDeleted: action must be 'delete'`);
    }
    if (typeof payload.target_did !== 'string' || !DID_RE.test(payload.target_did)) {
        throw new TypeError(`appendNousDeleted: invalid target_did (DID_RE failed)`);
    }
    if (typeof payload.pre_deletion_state_hash !== 'string' || !HEX64_RE.test(payload.pre_deletion_state_hash)) {
        throw new TypeError(`appendNousDeleted: pre_deletion_state_hash must match HEX64_RE`);
    }
    if (payload.operator_id !== operatorId) {
        throw new TypeError(`appendNousDeleted: payload.operator_id must equal operatorId argument`);
    }

    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(
            `appendNousDeleted: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }

    const cleanPayload = {
        tier: payload.tier,
        action: payload.action,
        operator_id: payload.operator_id,
        target_did: payload.target_did,
        pre_deletion_state_hash: payload.pre_deletion_state_hash,
    };

    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendNousDeleted: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }

    return audit.append('operator.nous_deleted', operatorId, cleanPayload, payload.target_did);
}
```

**Divergence from `appendTelosRefined`:**
- 5-key closed tuple (vs 4) with **tier literal** `'H5'` + **action literal** `'delete'` (borrowed from Phase 6 `appendOperatorEvent` shape).
- `actorDid` is the H5 operator_id, not a Nous DID — no self-report invariant.
- `target_did` (Nous being deleted) is the 4th positional arg to `audit.append` — correct target field for firehose routing.
- `EXPECTED_KEYS` tuple of 5 sorted strings.

---

### `grid/src/audit/state-hash.ts` (utility, canonical-JSON SHA-256)

**Analog:** `grid/src/dialogue/dialogue-id.ts` (Phase 7 — `createHash('sha256').update(input).digest('hex')`) + `brain/src/noesis_brain/telos/hashing.py` lines 29-41 (canonical-JSON pattern). No pre-existing Grid-side multi-component-hash helper.

**Pattern to copy** (canonical key order LOCKED per D-07):
```typescript
import { createHash } from 'node:crypto';
import type { LifecyclePhase } from '../registry/types.js';

export interface StateHashComponents {
    readonly did: string;
    readonly psyche_hash: string;
    readonly thymos_hash: string;
    readonly telos_hash: string;
    readonly memory_stream_hash: string;
    readonly ousia_balance: number;
    readonly lifecycle_phase: LifecyclePhase;
    readonly region: string;
    readonly spawnedAtTick: number;
}

export function combineStateHash(c: StateHashComponents): string {
    // LOCKED key order — matches 08-CONTEXT §D-07 regression-tested canonical form.
    // ANY reorder changes every historical hash (covert breaking change).
    const canonical = JSON.stringify({
        did: c.did,
        psyche_hash: c.psyche_hash,
        thymos_hash: c.thymos_hash,
        telos_hash: c.telos_hash,
        memory_stream_hash: c.memory_stream_hash,
        ousia_balance: c.ousia_balance,
        lifecycle_phase: c.lifecycle_phase,
        region: c.region,
        spawned_at_tick: c.spawnedAtTick,
    });
    return createHash('sha256').update(canonical).digest('hex');
}
```

**Divergence:**
- Key order is **NOT** `sort_keys=True` like the Brain-side canonicalization. The Grid emits an **ORDERED literal** because the inputs are already hex-stable and the order itself is the locked contract (D-07). Reordering keys would silently change every hash.
- Runtime guards on inputs happen at the route level (see `delete-nous.ts`), not here — keeps `combineStateHash` a pure function.

---

### `grid/src/api/operator/delete-nous.ts` (controller, REST route)

**Analog:** `grid/src/api/operator/telos-force.ts` (exact structural template — tier/op-id gate, DID gate, runner lookup, bridge health, RPC call, HEX64_RE runtime guard, closed-payload-literal audit emit, no 500s, explicit error ladder)

**Pattern to copy** (from `telos-force.ts` lines 45-148, adapted for delete):
```typescript
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { DID_REGEX } from '../server.js';
import type { ApiError } from '../types.js';
import { appendNousDeleted, HEX64_RE } from '../../audit/append-nous-deleted.js';
import { combineStateHash } from '../../audit/state-hash.js';
import { validateTierBody, type OperatorBody } from './_validation.js';

export function registerNousDeleteRoute(
    app: FastifyInstance,
    services: GridServices,
): void {
    app.post<{ Params: { did: string }; Body: OperatorBody }>(
        '/api/v1/operator/nous/:did/delete',
        async (req, reply) => {
            const body = req.body ?? {};

            // 1. Tier + operator_id gate — H5 required.
            const v = validateTierBody(body, 'H5');
            if (!v.ok) { reply.code(400); return { error: v.error } satisfies ApiError; }

            // 2. DID shape gate.
            const targetDid = req.params.did;
            if (!DID_REGEX.test(targetDid)) {
                reply.code(400); return { error: 'invalid_did' } satisfies ApiError;
            }

            // 3. Tombstone gate — already-deleted is 410, not 404.
            const record = services.registry.get(targetDid);
            if (!record) { reply.code(404); return { error: 'unknown_nous' } satisfies ApiError; }
            if (record.status === 'deleted') {
                reply.code(410);
                return { error: 'nous_deleted', deleted_at_tick: record.deletedAtTick } as const;
            }

            // 4. Runner lookup.
            const runner = services.getRunner?.(targetDid);
            if (!runner) { reply.code(404); return { error: 'unknown_nous' } satisfies ApiError; }

            // 5. Bridge health.
            if (!runner.connected || typeof runner.computePreDeletionStateHash !== 'function') {
                reply.code(503); return { error: 'brain_unavailable' } satisfies ApiError;
            }

            // 6. Brain RPC — 4-hash tuple; 503 + NO audit event + NO tombstone on failure.
            let hashes: { psyche_hash: string; thymos_hash: string; telos_hash: string; memory_stream_hash: string };
            try {
                hashes = await runner.computePreDeletionStateHash();
            } catch (err) {
                req.log.warn({ err, targetDid }, 'brain computePreDeletionStateHash failed');
                reply.code(503); return { error: 'brain_unavailable' } satisfies ApiError;
            }

            // 7. Runtime hex-guard — D-28 hash-only + contract drift prevention.
            if (!HEX64_RE.test(hashes.psyche_hash) || !HEX64_RE.test(hashes.thymos_hash)
                || !HEX64_RE.test(hashes.telos_hash) || !HEX64_RE.test(hashes.memory_stream_hash)) {
                req.log.warn({ targetDid }, 'brain returned non-hex64 component hash — contract drift');
                reply.code(503); return { error: 'brain_unavailable' } satisfies ApiError;
            }

            // 8. Compose 5th hash, Grid-side (hash-of-hashes — never touches plaintext).
            const currentTick = services.clock.currentTick();
            const pre_deletion_state_hash = combineStateHash({
                did: record.did,
                psyche_hash: hashes.psyche_hash,
                thymos_hash: hashes.thymos_hash,
                telos_hash: hashes.telos_hash,
                memory_stream_hash: hashes.memory_stream_hash,
                ousia_balance: record.ousia,
                lifecycle_phase: record.lifecyclePhase,
                region: record.region,
                spawnedAtTick: record.spawnedAtTick,
            });

            // 9. Tombstone + map-remove. Atomic — after this, the record is dead.
            services.registry.tombstone(targetDid, currentTick);
            services.map.removeNous(targetDid);

            // 10. Audit emit — sole producer path.
            appendNousDeleted(services.audit, v.operator_id, {
                tier: 'H5',
                action: 'delete',
                operator_id: v.operator_id,
                target_did: targetDid,
                pre_deletion_state_hash,
            });

            // 11. Runner teardown — bridge close + tick unsubscribe.
            services.coordinator.despawnNous(targetDid);

            return { ok: true, deleted_at_tick: currentTick, pre_deletion_state_hash };
        },
    );
}
```

**Divergence from `telos-force.ts`:**
- Step 3 adds a **tombstone gate** returning 410 Gone (new error code for this route).
- 5 hash inputs from Brain (vs 2 for telos_force); combined Grid-side via `combineStateHash`.
- Ordering: Brain RPC → hash runtime guard → **state compose** → **tombstone + map-remove** → audit emit → **runner teardown**. D-10 is explicit: if Brain 503 fires, no tombstone is written — the Nous remains alive.
- Success body returns `deleted_at_tick` and `pre_deletion_state_hash` for UI toast rendering.

---

### `grid/src/registry/tombstone-check.ts` (utility, 410 gate)

**Analog:** `grid/src/api/operator/_validation.ts` `validateTierBody<T>` shape — small typed helper returning tagged union for route composition.

**Pattern to copy** (from `_validation.ts` generic pattern):
```typescript
import type { NousRegistry } from './registry.js';

export type TombstoneResult =
    | { ok: true }
    | { ok: false; deletedAtTick: number };

/**
 * Centralized 410 Gone gate — any DID-resolving route MUST call this
 * before any other work. Prevents route drift across introspect,
 * telos-force, trade, spoke-target.
 *
 * See 08-CONTEXT D-17.
 */
export function tombstoneCheck(registry: NousRegistry, did: string): TombstoneResult {
    const record = registry.get(did);
    if (record && record.status === 'deleted') {
        return { ok: false, deletedAtTick: record.deletedAtTick ?? 0 };
    }
    return { ok: true };
}
```

**Divergence:** Pure read; no mutation. Idempotent. Callers convert `{ok: false, ...}` to HTTP 410 + body `{error: 'nous_deleted', deleted_at_tick}`.

---

### `grid/src/audit/broadcast-allowlist.ts` (modify — frozen tuple)

**Analog:** Phase 7 `'telos.refined'` addition at lines 54-57.

**Pattern to modify** (append 1 member at position 18):
```typescript
const ALLOWLIST_MEMBERS: readonly string[] = [
    // ... positions 1-17 unchanged (ending in 'telos.refined') ...
    'telos.refined',
    // Phase 8 (AGENCY-05) — H5 Sovereign irreversible delete.
    // Payload shape: {tier: 'H5', action: 'delete', operator_id, target_did, pre_deletion_state_hash}
    // Emitted ONLY via appendNousDeleted() (grid/src/audit/append-nous-deleted.ts).
    'operator.nous_deleted',
] as const;
```

**Divergence:** One-line insertion; all downstream `buildFrozenAllowlist`, `FORBIDDEN_KEY_PATTERN`, `payloadPrivacyCheck` reused unchanged (5-key payload is natively clean per D-26).

---

### `grid/src/registry/types.ts` (modify — status union + deletedAtTick)

**Analog:** existing `NousRecord.status` union at line 19.

**Pattern to modify:**
```typescript
export interface NousRecord {
    did: string;
    name: string;
    ndsAddress: string;
    publicKey: string;
    humanOwner?: string;
    region: string;
    lifecyclePhase: LifecyclePhase;
    reputation: number;
    ousia: number;
    spawnedAtTick: number;
    lastActiveTick: number;
    status: 'active' | 'suspended' | 'exiled' | 'deleted';  // Phase 8: +'deleted'
    deletedAtTick?: number;                                  // Phase 8 (D-11)
}
```

**Divergence:** Purely additive — existing serialization code (persist/restore) handles optional field via spread.

---

### `grid/src/registry/registry.ts` (modify — tombstone method)

**Analog:** `suspend` (lines 76-81), `exile` (lines 84-90), `reinstate` (lines 93-98) — all three are atomic status transitions returning `boolean`.

**Pattern to copy** (sibling to `suspend`; adds tick parameter like no other method):
```typescript
/**
 * Tombstone a Nous — terminal status transition (Phase 8 AGENCY-05).
 *
 * Idempotent: returns false if already tombstoned. Unlike suspend→reinstate,
 * there is NO reinstate path for 'deleted' — the record is permanently dead.
 * The record itself is retained forever so historical audit entries resolve
 * to a name + public key + deletedAtTick (PHILOSOPHY §7 first-life promise).
 *
 * See 08-CONTEXT D-11, D-12.
 */
tombstone(did: string, tick: number): boolean {
    const record = this.records.get(did);
    if (!record || record.status === 'deleted') return false;
    record.status = 'deleted';
    record.deletedAtTick = tick;
    return true;
}
```

**Divergence from `suspend`:** Takes `tick` parameter (status transitions elsewhere don't stamp ticks; deletion is the only terminal-with-timestamp transition). Does NOT touch `nameIndex` per D-12 — name stays reserved. `records.has(did)` check in `spawn()` (line 17) natively enforces DID-reuse rejection (D-33).

---

### `grid/src/space/map.ts` (modify — removeNous method)

**Analog:** `placeNous` at lines 54-64 (writes to `positions`); no current `removeNous` — Phase 8 adds the inverse operation.

**Pattern to copy** (mirror `placeNous`, inverse semantics):
```typescript
/**
 * Remove a Nous from the map (Phase 8 — tombstone support).
 *
 * Returns true if a position was removed, false if the DID was never placed
 * (edge case — idempotent no-op). Subsequent getNousInRegion / inRegion
 * queries will NOT return the removed Nous.
 *
 * See 08-CONTEXT D-13.
 */
removeNous(nousDid: string): boolean {
    return this.positions.delete(nousDid);
}
```

**Divergence:** Single-line operation — `Map.delete` returns boolean natively. No region lookup needed (positions are keyed by DID).

---

### `grid/src/integration/grid-coordinator.ts` (modify — despawnNous method)

**Analog:** existing runner-lifecycle methods in the coordinator (`spawnNous` spawn path — bridge open + tick subscription + SpatialMap.placeNous). `despawnNous` is the exact inverse.

**Pattern to add** (mirror of spawn; inverse order):
```typescript
/**
 * Despawn a Nous runner — teardown inverse of spawnNous (Phase 8).
 *
 * Order: (1) unsubscribe tick dispatch (prevent in-flight races per D-15),
 * (2) close Brain bridge, (3) SpatialMap.removeNous.
 *
 * Idempotent — no-op if the runner is already gone.
 *
 * See 08-CONTEXT D-14, D-15.
 */
async despawnNous(did: string): Promise<void> {
    const runner = this.runners.get(did);
    if (!runner) return;
    this.runners.delete(did);       // 1. tick-dispatch unsubscribe (implicit via iteration)
    await runner.bridge.close();    // 2. bridge teardown
    this.map.removeNous(did);       // 3. spatial drop
}
```

**Divergence:** Called from the delete route AFTER audit emit. Tick-skip guard in `nous-runner.ts` (D-15) covers the micro-race where a tick fires between tombstone and despawn.

---

### `grid/src/integration/nous-runner.ts` (modify — tick-skip guard)

**Analog:** existing tick-entry guards in `onTick` (connection check, any existing status checks).

**Pattern to add** (defensive status check at the top of `onTick`):
```typescript
async onTick(tick: number, epoch: string, ctx?: readonly DialogueContext[]): Promise<void> {
    // Phase 8 D-15: tick-skip for tombstoned Nous.
    // Protects against the micro-race where despawnNous is scheduled but
    // a tick dispatch is already in-flight. After this check, no
    // nous.spoke / nous.moved / any action can fire for a deleted DID.
    const record = this.registry.get(this.nousDid);
    if (record?.status === 'deleted') return;

    // ... existing tick pipeline ...
}
```

**Divergence:** Single additive early-return. Phase 8 regression test `grid/test/registry/tombstone-tick-skip.test.ts` fires a delete concurrent with an in-flight tick and asserts zero post-tombstone audit events for the DID.

---

### `grid/src/api/server.ts` (modify — route registration + runner surface)

**Analog:** existing `InspectorRunner` interface (with `forceTelos?`) and route registration chain.

**Pattern to modify:**
```typescript
export interface InspectorRunner {
    connected: boolean;
    forceTelos?(newTelos: Record<string, unknown>): Promise<{ telos_hash_before: string; telos_hash_after: string }>;
    // Phase 8 — sovereign deletion RPC
    computePreDeletionStateHash?(): Promise<{
        psyche_hash: string;
        thymos_hash: string;
        telos_hash: string;
        memory_stream_hash: string;
    }>;
}

// In route-registration section:
import { registerNousDeleteRoute } from './operator/delete-nous.js';
// ...
registerNousDeleteRoute(app, services);
```

**Divergence:** Purely additive — matches Phase 6's `forceTelos?` precedent. Routes appended to existing registration ladder.

---

### `grid/test/audit/nous-deleted-privacy.test.ts` (unit, privacy matrix)

**Analog:** `grid/test/audit/operator-payload-privacy.test.ts` (Phase 6 — 5 events × 8 cases = 40 tests). Phase 8 is 1 event × 8 cases = 8 tests.

**Pattern to copy:**
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendNousDeleted } from '../../src/audit/append-nous-deleted.js';

const happyPayload = {
    tier: 'H5' as const,
    action: 'delete' as const,
    operator_id: 'operator-alpha',
    target_did: 'did:noesis:a',
    pre_deletion_state_hash: 'f'.repeat(64),
};

const FORBIDDEN_CASES = [
    ['prompt', { prompt: 'leak' }],
    ['response', { response: 'leak' }],
    ['wiki', { wiki: 'leak' }],
    ['reflection', { reflection: 'leak' }],
    ['thought', { thought: 'leak' }],
    ['emotion_delta', { emotion_delta: 0.5 }],
    ['nested forbidden', { meta: { prompt: 'leak' } }],
] as const;

describe('operator.nous_deleted — privacy matrix', () => {
    let chain: AuditChain;
    beforeEach(() => { chain = new AuditChain(); });

    it('accepts happy baseline', () => {
        expect(() => appendNousDeleted(chain, 'operator-alpha', happyPayload)).not.toThrow();
    });

    it.each(FORBIDDEN_CASES)('rejects %s', (_, extra) => {
        expect(() => appendNousDeleted(chain, 'operator-alpha', { ...happyPayload, ...extra } as any))
            .toThrow(/privacy|unexpected key|extra/i);
    });
});
```

**Divergence:** The closed 5-key tuple means ANY extra key throws at the EXPECTED_KEYS gate BEFORE `payloadPrivacyCheck` runs. Both error messages qualify — regex `/privacy|unexpected/i` covers both.

---

### `grid/test/audit/nous-deleted-producer-boundary.test.ts` (unit, grep invariant)

**Analog:** `grid/test/audit/telos-refined-producer-boundary.test.ts` (Phase 7 — readdirSync walk + regex assertion that no file outside the sole-producer calls `audit.append` with the event type literal).

**Pattern to copy** (verbatim except event type + sole-producer filename):
```typescript
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const SOLE_PRODUCER = 'append-nous-deleted.ts';
const BAD = /\b(audit|chain|this\.audit|this\.chain)\.append[^;]{0,200}['"]operator\.nous_deleted['"]/;

function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) out.push(...walk(full));
        else if (entry.endsWith('.ts')) out.push(full);
    }
    return out;
}

describe('operator.nous_deleted — producer boundary', () => {
    it('only appendNousDeleted calls audit.append with operator.nous_deleted', () => {
        const violations: string[] = [];
        for (const file of walk(join(__dirname, '../../src'))) {
            if (file.endsWith(SOLE_PRODUCER)) continue;
            const src = readFileSync(file, 'utf8');
            if (BAD.test(src)) violations.push(file);
        }
        expect(violations).toEqual([]);
    });
});
```

**Divergence:** None — clone Phase 7 verbatim, swap event type + sole-producer filename.

---

### `grid/test/audit/allowlist-eighteen.test.ts` (unit, frozen tuple)

**Analog:** `grid/test/audit/allowlist-seventeen.test.ts` (Phase 7 — exact order + count + frozen assertion).

**Pattern to copy:**
```typescript
import { describe, it, expect } from 'vitest';
import { ALLOWLIST } from '../../src/audit/broadcast-allowlist.js';

const EXPECTED_ORDER = [
    'nous.spawned', 'nous.moved', 'nous.spoke', 'nous.direct_message',
    'trade.proposed', 'trade.reviewed', 'trade.settled', 'law.triggered',
    'tick', 'grid.started', 'grid.stopped',
    'operator.inspected', 'operator.paused', 'operator.resumed',
    'operator.law_changed', 'operator.telos_forced',
    'telos.refined',
    'operator.nous_deleted',  // Phase 8 — position 18
] as const;

describe('broadcast allowlist — Phase 8 invariant', () => {
    it('contains exactly 18 members', () => {
        expect(ALLOWLIST.size).toBe(18);
    });
    it('contains operator.nous_deleted at position 18', () => {
        expect([...ALLOWLIST]).toEqual([...EXPECTED_ORDER]);
    });
    it('throws on mutation attempts', () => {
        expect(() => (ALLOWLIST as Set<string>).add('new.event')).toThrow(TypeError);
        expect(() => (ALLOWLIST as Set<string>).delete('tick')).toThrow(TypeError);
        expect(() => (ALLOWLIST as Set<string>).clear()).toThrow(TypeError);
    });
});
```

**Divergence:** None — clone Phase 7's 17-count test, bump to 18, append `'operator.nous_deleted'` at end of EXPECTED_ORDER.

---

### `grid/test/api/operator-delete-route.test.ts` (integration, error ladder + happy path)

**Analog:** `grid/test/api/operator/telos.test.ts` (buildServer + seedServices + makeRunner mock factory with `forceTelos` override; 400/404/503 ladder coverage + happy assertion).

**Pattern to copy** (adapt runner mock for `computePreDeletionStateHash`):
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';

// Mock runner factory mirroring Phase 6 telos.test.ts pattern.
const makeRunner = (opts: {
    connected?: boolean;
    computeHash?: () => Promise<{ psyche_hash: string; thymos_hash: string; telos_hash: string; memory_stream_hash: string }>;
}) => ({
    connected: opts.connected ?? true,
    computePreDeletionStateHash: opts.computeHash,
});

describe('POST /api/v1/operator/nous/:did/delete', () => {
    let server: FastifyInstance;
    // ... seedServices setup per existing pattern ...

    it('400 on missing tier', async () => { /* ... */ });
    it('400 on wrong tier (H4 cannot delete)', async () => { /* ... */ });
    it('400 on malformed DID', async () => { /* ... */ });
    it('404 on unknown nous', async () => { /* ... */ });
    it('410 on already-tombstoned', async () => { /* ... */ });
    it('503 on brain disconnect (no audit emitted)', async () => { /* ... */ });
    it('503 on non-hex64 component hash (contract drift)', async () => { /* ... */ });
    it('emits operator.nous_deleted on happy path', async () => {
        const res = await server.inject({
            method: 'POST',
            url: '/api/v1/operator/nous/did:noesis:target/delete',
            payload: { tier: 'H5', operator_id: 'op-a' },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.ok).toBe(true);
        expect(body.pre_deletion_state_hash).toMatch(/^[a-f0-9]{64}$/);
        const entries = audit.entries.filter(e => e.event_type === 'operator.nous_deleted');
        expect(entries).toHaveLength(1);
        expect(Object.keys(entries[0].payload).sort()).toEqual([
            'action', 'operator_id', 'pre_deletion_state_hash', 'target_did', 'tier',
        ]);
    });
});
```

**Divergence from telos.test.ts:** Adds 410-tombstoned case (new status code for operator routes); runner mock returns 4-hash tuple instead of 2.

---

### `grid/test/api/operator-delete-tombstone-routes.test.ts` (integration, 410 coverage)

**Analog:** `grid/test/api/operator/telos.test.ts` structure (buildServer + multi-route injection).

**Pattern to copy** (iterate existing DID-resolving routes, assert 410 each):
```typescript
const TOMBSTONE_ROUTES = [
    { method: 'GET', url: '/api/v1/nous/did:noesis:target/state' },
    { method: 'POST', url: '/api/v1/operator/nous/did:noesis:target/telos/force', body: { tier: 'H4', operator_id: 'op-a', new_telos: {} } },
    // ... trade initiation, spoke-target routes if applicable ...
];

describe('tombstone gate — 410 Gone across DID-resolving routes', () => {
    beforeEach(() => {
        // Pre-tombstone the DID.
        services.registry.spawn({ did: 'did:noesis:target', /* ... */ }, 'grid', 0, 100);
        services.registry.tombstone('did:noesis:target', 42);
    });

    it.each(TOMBSTONE_ROUTES)('$method $url returns 410', async (route) => {
        const res = await server.inject({ method: route.method, url: route.url, payload: route.body });
        expect(res.statusCode).toBe(410);
        expect(res.json()).toMatchObject({ error: 'nous_deleted', deleted_at_tick: 42 });
    });
});
```

**Divergence:** New test file — no 410 coverage existed pre-Phase 8. Enumerates all DID-resolving routes as a single parameterized it.each block.

---

### `grid/test/registry/tombstone-did-reuse.test.ts` (unit, SC#5)

**Analog:** existing registry tests asserting `spawn` throws on duplicate DID (the check at line 17 of registry.ts).

**Pattern to copy:**
```typescript
describe('NousRegistry.spawn — tombstone DID-reuse regression', () => {
    it('throws "Nous already registered" for a tombstoned DID (natively)', () => {
        const reg = new NousRegistry();
        reg.spawn({ did: 'did:noesis:a', name: 'Alpha', publicKey: 'pk', region: 'r' }, 'grid', 0, 100);
        reg.tombstone('did:noesis:a', 10);

        expect(() => reg.spawn({ did: 'did:noesis:a', name: 'Alpha2', publicKey: 'pk2', region: 'r' }, 'grid', 20, 100))
            .toThrow(/Nous already registered/);
    });

    it('uses the SAME error message as active-DID rejection (no "deleted" kind)', () => {
        // D-33: reason for rejection is identical — "DID taken".
        // ...
    });
});
```

**Divergence:** None new — exercises the existing `records.has(did)` check natively. Asserts D-33's intentional message-reuse design.

---

### `grid/test/registry/tombstone-tick-skip.test.ts` (unit, SC#3 race)

**Analog:** Phase 7 deterministic-clock fixture (`FIXED_TIME`, `tickRateMs`, `ticksPerEpoch` per 08-CONTEXT D-36).

**Pattern to copy:**
```typescript
import { vi } from 'vitest';

describe('NousRunner.onTick — tombstone tick-skip guard', () => {
    it('zero audit events emitted for DID after tombstone lands mid-tick', async () => {
        const nowSpy = vi.spyOn(Date, 'now');
        let fakeNow = 1_700_000_000_000;
        nowSpy.mockImplementation(() => { fakeNow += 1; return fakeNow; });

        // Spawn + run 3 normal ticks.
        const { runner, registry, chain } = await buildFixture();
        for (let t = 0; t < 3; t++) await runner.onTick(t, 'e0');
        const preDeleteCount = chain.entries.filter(e => e.actor_did === runner.nousDid).length;

        // Tombstone.
        registry.tombstone(runner.nousDid, 3);

        // Attempt 5 more ticks — must emit ZERO new entries for that DID.
        for (let t = 3; t < 8; t++) await runner.onTick(t, 'e0');
        const postDeleteCount = chain.entries.filter(e => e.actor_did === runner.nousDid).length;

        expect(postDeleteCount).toBe(preDeleteCount);
        nowSpy.mockRestore();
    });
});
```

**Divergence:** Narrow unit over the runner; concurrent delete-during-tick race is covered by `nous-deleted-zero-diff.test.ts`.

---

### `grid/test/nous-deleted-zero-diff.test.ts` (unit, SC#4 determinism)

**Analog:** `grid/test/audit.test.ts` lines 253-281 (`runSim(listenerCount)` — nowSpy freezes `Date.now`, compares chain heads byte-for-byte across 0 vs 10 listeners).

**Pattern to copy** (clone verbatim, parameterize the delete scenario):
```typescript
describe('AuditChain zero-diff invariant — Phase 8 delete sequence', () => {
    it('0 vs 10 listeners → byte-identical chain.head after spawn/act/delete', () => {
        const nowSpy = vi.spyOn(Date, 'now');
        let fakeNow = 1_700_000_000_000;
        nowSpy.mockImplementation(() => { fakeNow += 1; return fakeNow; });

        const runSim = (listenerCount: number): string[] => {
            const chain = new AuditChain();
            for (let i = 0; i < listenerCount; i++) chain.onAppend(() => {});

            // Deterministic delete-sequence: spawn at tick 5, act at ticks 10-30,
            // delete at tick 40 (08-CONTEXT D-36).
            chain.append('nous.spawned', 'did:noesis:a', { region: 'r', tick: 5 });
            for (let t = 10; t <= 30; t += 5) {
                chain.append('nous.spoke', 'did:noesis:a', { channel: 'c', text_hash: String(t).padStart(64, '0') });
            }
            chain.append('operator.nous_deleted', 'operator-alpha', {
                tier: 'H5',
                action: 'delete',
                operator_id: 'operator-alpha',
                target_did: 'did:noesis:a',
                pre_deletion_state_hash: 'f'.repeat(64),
            }, 'did:noesis:a');
            return chain.entries.map(e => e.hash);
        };

        expect(runSim(10)).toEqual(runSim(0));
        nowSpy.mockRestore();
    });
});
```

**Divergence:** Swap Phase 5 events for a spawn/spoke/delete sequence. Asserts the delete event itself doesn't introduce non-determinism.

---

### `grid/test/audit-no-purge.test.ts` (unit, chain preservation)

**Analog:** `grid/test/audit.test.ts` `verify()` + `filter(actor_did)` existing patterns.

**Pattern to copy:**
```typescript
describe('Audit chain — pre-deletion entries retained post-tombstone', () => {
    it('all pre-deletion entries for deleted DID remain retrievable', () => {
        const { chain, registry } = buildFixture();
        chain.append('nous.spawned', 'did:noesis:a', { /* ... */ });
        chain.append('nous.spoke', 'did:noesis:a', { /* ... */ });
        chain.append('nous.moved', 'did:noesis:a', { /* ... */ });
        const preDeleteEntries = chain.entries.filter(e => e.actor_did === 'did:noesis:a');
        expect(preDeleteEntries).toHaveLength(3);

        registry.tombstone('did:noesis:a', 10);
        chain.append('operator.nous_deleted', 'operator-alpha', { /* ... */ }, 'did:noesis:a');

        // Pre-deletion entries MUST remain.
        const postDeleteEntries = chain.entries.filter(e => e.actor_did === 'did:noesis:a');
        expect(postDeleteEntries).toHaveLength(3);
    });

    it('chain.verify() passes post-deletion', () => {
        // ... chain.verify() === {valid: true}
    });
});
```

**Divergence:** PHILOSOPHY §7 invariant regression gate — first time a test explicitly asserts retention semantics.

---

### `brain/src/noesis_brain/state_hash.py` (new module, 3 sibling helpers)

**Analog:** `brain/src/noesis_brain/telos/hashing.py` `compute_active_telos_hash` (lines 19-41) — canonical-JSON SHA-256, sort_keys=True, semantic-fields-only.

**Pattern to copy** (three sibling functions, same canonical-JSON discipline):
```python
"""Phase 8 state-hash helpers (D-06).

Siblings to telos/hashing.py compute_active_telos_hash. Each returns a 64-hex
SHA-256 over canonical JSON (sort_keys=True, separators=(",",":")) of the
subsystem's semantic state. Inactive/private fields are excluded.

The four component hashes (psyche, thymos, telos, memory_stream) compose the
Grid-side combined pre_deletion_state_hash. Plaintext NEVER crosses the RPC
boundary — only these 64-hex digests (PHILOSOPHY §1).
"""
from __future__ import annotations
import hashlib
import json


def compute_psyche_hash(psyche) -> str:
    """SHA-256 over canonical JSON of PsycheManager's trait vector."""
    canonical = json.dumps({
        "openness": psyche.openness,
        "conscientiousness": psyche.conscientiousness,
        "extraversion": psyche.extraversion,
        "agreeableness": psyche.agreeableness,
        "neuroticism": psyche.neuroticism,
    }, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def compute_thymos_hash(thymos) -> str:
    """SHA-256 over canonical JSON of ThymosManager mood + emotion set."""
    canonical = json.dumps({
        "mood": thymos.mood,
        "emotions": dict(thymos.emotions),  # sort_keys handles ordering
    }, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def compute_memory_stream_hash(memory) -> str:
    """SHA-256 over canonical JSON of memory summaries (NOT contents).

    D-28: plaintext memory contents NEVER enter the hash input — only
    timestamps + summaries + kinds. The Brain's full memory stream stays
    sovereign per PHILOSOPHY §4.
    """
    summaries = [
        {"timestamp": m.timestamp, "kind": m.kind, "summary_digest": hashlib.sha256(m.summary.encode("utf-8")).hexdigest()}
        for m in memory.all()
    ]
    canonical = json.dumps(summaries, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
```

**Divergence from `compute_active_telos_hash`:**
- Three new helpers, one per subsystem.
- `compute_memory_stream_hash` pre-hashes summaries (nested digest) to prevent even summary plaintext from touching the RPC payload — belt-and-suspenders on D-28.
- `compute_active_telos_hash` is reused unchanged as the fourth component (D-06).

---

### `brain/src/noesis_brain/rpc/handler.py` (modify — new RPC method)

**Analog:** `force_telos` method at lines 399-436 (RPC surface returning 2-hash tuple; hash-only contract).

**Pattern to copy** (new method returning 4-hash tuple):
```python
async def compute_pre_deletion_state_hash(self) -> dict[str, str]:
    """RPC surface for Phase 8 Grid delete route (D-06).

    Returns all four component hashes as a single dict. Grid composes the
    fifth (combined) hash via combineStateHash. Plaintext NEVER leaves
    this method — only four 64-hex digests.
    """
    return {
        "psyche_hash": compute_psyche_hash(self.psyche),
        "thymos_hash": compute_thymos_hash(self.thymos),
        "telos_hash": compute_active_telos_hash(self.telos.all_goals()),
        "memory_stream_hash": compute_memory_stream_hash(self.memory),
    }
```

**Divergence from `force_telos`:**
- Read-only — no state mutation. Merely hashes current state and returns.
- 4-hash tuple vs 2; reuses Phase 6's `compute_active_telos_hash` unchanged (D-06).
- No `new_telos` input parameter — the operator is not asking the Brain to change, only to hash.

---

### `brain/test/test_state_hash_rpc.py` (unit, 4-hash contract)

**Analog:** `brain/test/test_rpc_handler.py` (`_make_psyche`, `_make_thymos`, `_make_telos`, `_make_handler` fixture builders).

**Pattern to copy:**
```python
import pytest
from noesis_brain.rpc.handler import RpcHandler

async def test_compute_pre_deletion_state_hash_returns_four_hex64():
    handler = _make_handler()
    result = await handler.compute_pre_deletion_state_hash()
    assert set(result.keys()) == {"psyche_hash", "thymos_hash", "telos_hash", "memory_stream_hash"}
    for k, v in result.items():
        assert isinstance(v, str)
        assert len(v) == 64
        assert all(c in "0123456789abcdef" for c in v), f"{k} not hex64"

async def test_compute_pre_deletion_state_hash_is_deterministic():
    handler1 = _make_handler()
    handler2 = _make_handler()
    r1 = await handler1.compute_pre_deletion_state_hash()
    r2 = await handler2.compute_pre_deletion_state_hash()
    assert r1 == r2  # identical inputs → identical hashes

async def test_compute_pre_deletion_state_hash_no_plaintext_leak():
    handler = _make_handler()
    result = await handler.compute_pre_deletion_state_hash()
    forbidden = ("prompt", "response", "wiki", "reflection", "thought", "emotion_delta")
    for k in result.keys():
        for f in forbidden:
            assert f not in k.lower()
```

**Divergence:** Narrow contract test — no action-emission assertion because this RPC has no audit side-effect.

---

### `brain/test/test_state_hash_functions.py` (unit, per-component determinism)

**Analog:** `brain/test/test_telos_refined_action.py` hash-determinism patterns.

**Pattern to copy** (per-function determinism + hex64 shape + semantic-field-only):
```python
def test_compute_psyche_hash_deterministic():
    p1 = _make_psyche(openness=0.5)
    p2 = _make_psyche(openness=0.5)
    assert compute_psyche_hash(p1) == compute_psyche_hash(p2)

def test_compute_psyche_hash_changes_with_trait_change():
    p1 = _make_psyche(openness=0.5)
    p2 = _make_psyche(openness=0.51)
    assert compute_psyche_hash(p1) != compute_psyche_hash(p2)

def test_compute_memory_stream_hash_uses_summary_digest_not_plaintext():
    # Two streams with DIFFERENT plaintext summaries but identical summary_digest
    # (impossible naturally, but assert the hash input doesn't include raw summary).
    ...
```

**Divergence:** Unit-level — no RPC handler, no LLM fixture.

---

### `dashboard/src/components/agency/irreversibility-dialog.tsx` (new primitive)

**Analog:** `dashboard/src/components/agency/elevation-dialog.tsx` (peer primitive in same directory — native `<dialog>` + `showModal()` + `onClose` → `onCancel` + `autoFocus` on safe default button).

**Pattern to copy** (divergences reflect AGENCY-05 stricter gate):
```typescript
'use client';

import { useEffect, useRef, useState, type ReactElement } from 'react';

export interface IrreversibilityDialogProps {
    readonly targetDid: string;
    readonly targetName: string;
    readonly open: boolean;
    readonly onConfirm: () => void;
    readonly onCancel: () => void;
}

export function IrreversibilityDialog({
    targetDid,
    targetName,
    open,
    onConfirm,
    onCancel,
}: IrreversibilityDialogProps): ReactElement {
    const ref = useRef<HTMLDialogElement | null>(null);
    const [typed, setTyped] = useState('');

    useEffect(() => {
        const dlg = ref.current;
        if (!dlg) return;
        if (open && !dlg.open) { dlg.showModal(); setTyped(''); }
        else if (!open && dlg.open) dlg.close();
    }, [open]);

    const matches = typed === targetDid;

    return (
        <dialog
            ref={ref}
            onClose={onCancel}
            role="alertdialog"                         // stricter than elevation's "dialog"
            aria-labelledby="irreversibility-title"
            aria-describedby="irreversibility-body"
            data-testid="irreversibility-dialog"
            className="min-w-[480px] p-6 bg-neutral-950 text-neutral-100 border-2 border-rose-700 rounded"
        >
            <h2 id="irreversibility-title" className="text-base font-semibold text-rose-400">
                Delete {targetName} forever
            </h2>
            <p id="irreversibility-body" className="mt-2 text-sm" data-testid="irreversibility-first-life-copy">
                This is H5 Sovereign. Audit entries about this Nous will remain forever;
                the Nous itself will not. There is no undo.
            </p>
            <p className="mt-3 text-sm">
                To delete this Nous forever, type its DID exactly:
                {' '}<code data-testid="irreversibility-target-did">{targetDid}</code>
            </p>
            <form onSubmit={(e) => e.preventDefault()} className="mt-3">
                <input
                    type="text"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    onPaste={(e) => e.preventDefault()}   // D-01 paste-suppressed
                    autoComplete="off"
                    spellCheck={false}
                    data-testid="irreversibility-input"
                    className="w-full p-2 bg-neutral-900 border border-neutral-700 rounded"
                />
            </form>
            <div className="mt-4 flex gap-2 justify-end">
                <button
                    type="button"
                    onClick={onCancel}
                    autoFocus                            // mirrors elevation-dialog default-safe autoFocus
                    data-testid="irreversibility-cancel"
                    className="px-3 py-1 text-sm font-semibold text-neutral-200"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={onConfirm}
                    disabled={!matches}                 // D-01 exact-equality gate
                    data-testid="irreversibility-confirm"
                    className={`px-3 py-1 text-sm font-semibold ${matches ? 'bg-rose-700 text-neutral-100' : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'}`}
                >
                    Delete forever
                </button>
            </div>
        </dialog>
    );
}
```

**Divergence from `elevation-dialog.tsx`:**
- `role="alertdialog"` (vs `"dialog"`) — WCAG destructive-action signal.
- `border-2 border-rose-700` (vs `border border-neutral-800`) — visual distinction.
- DID-typed `<input>` with `onPaste={e.preventDefault()}` (D-01) + exact-equality gate on confirm button.
- `<form onSubmit={e.preventDefault()}>` — Enter-key cannot commit (D-03).
- First-life promise copy verbatim (D-04 — copy-lock regression-tested).
- `setTyped('')` on every open — state reset prevents confirm-leak across opens.
- No `ElevatedTier` parameter — this dialog only ever operates in H5 context.

---

### `dashboard/src/components/agency/elevation-dialog.tsx` (modify — add H5)

**Analog:** existing `ElevatedTier` union at line 23 + `CONFIRM_FILL` map at lines 32-36.

**Pattern to modify:**
```typescript
export type ElevatedTier = Exclude<HumanAgencyTier, 'H1'>;  // Phase 8: H5 now included

const CONFIRM_FILL: Record<ElevatedTier, string> = {
    H2: 'bg-blue-400 text-neutral-950',
    H3: 'bg-amber-300 text-neutral-950',
    H4: 'bg-red-400 text-neutral-950',
    H5: 'bg-rose-700 text-neutral-100',   // Phase 8 — distinct rose tone
};
```

**Divergence:** `Exclude<HumanAgencyTier, 'H1'>` (one literal removed from exclusion list) — purely additive union widening. Downstream `targetTier={H5}` call site in Inspector becomes legal.

---

### `dashboard/src/app/grid/components/inspector.tsx` (modify — wire H5 button)

**Analog:** lines 219-234 currently render the `disabled aria-disabled="true" title="Requires Phase 8"` affordance; Phase 6 D-20 left the button inert.

**Pattern to modify** (add state machine for {idle, elevating, confirming, submitting}):
```typescript
const [flow, setFlow] = useState<'idle' | 'elevating' | 'confirming' | 'submitting'>('idle');

const handleDeleteClick = (): void => setFlow('elevating');
const handleElevationConfirm = (): void => setFlow('confirming');
const handleElevationCancel = (): void => setFlow('idle');  // auto-downgrade elsewhere (agency store)
const handleIrreversibilityConfirm = async (): Promise<void> => {
    setFlow('submitting');
    const result = await deleteNous(selectedDid!, origin, /* op-id from agency store */);
    setFlow('idle');
    if (result.ok) { /* close inspector, fire toast */ }
    // auto-downgrade H5→H1 unconditional
};
const handleIrreversibilityCancel = (): void => setFlow('idle');

// Replace lines 219-234 with:
{state.status === 'ok' && state.data.status === 'deleted' ? (
    <div className="mt-4 border-t border-neutral-800 pt-3">
        <button disabled aria-disabled="true" className="w-full ...">
            Nous deleted at tick {state.data.deletedAtTick}
        </button>
    </div>
) : (
    <div className="mt-4 border-t border-neutral-800 pt-3">
        <button
            type="button"
            data-testid="inspector-h5-delete"
            onClick={handleDeleteClick}
            className="w-full rounded border border-rose-900 bg-rose-950/30 px-3 py-2 text-xs text-rose-300"
        >
            Delete Nous
        </button>
    </div>
)}

<ElevationDialog
    targetTier="H5"
    open={flow === 'elevating'}
    onConfirm={handleElevationConfirm}
    onCancel={handleElevationCancel}
/>
<IrreversibilityDialog
    targetDid={selectedDid!}
    targetName={state.status === 'ok' ? state.data.name : ''}
    open={flow === 'confirming'}
    onConfirm={handleIrreversibilityConfirm}
    onCancel={handleIrreversibilityCancel}
/>
```

**Divergence from current line 219-234:**
- Remove `disabled`, `aria-disabled`, `title`, `tabIndex`, `line-through`, caption `<p>`.
- Wire `onClick={handleDeleteClick}` → kicks off 2-stage flow (D-20).
- Tombstoned-state branch reads `state.data.status` + `state.data.deletedAtTick` (D-23).
- Extend `ERR_COPY` at lines 39-56 with a `nous_deleted` entry mapping 410 → "Nous deleted at tick N. Audit history remains in the firehose."

---

### `dashboard/src/lib/api/introspect.ts` (modify — widen types)

**Analog:** existing `NousStateResponse` + `FetchError` + `STATUS_TO_KIND` at lines 21-54.

**Pattern to modify:**
```typescript
export type NousStateResponse = {
    did: string;
    name: string;
    // ... existing fields ...
    status: 'active' | 'suspended' | 'exiled' | 'deleted';  // Phase 8 D-27
    deletedAtTick?: number;                                   // Phase 8 — present iff status='deleted'
};

export type FetchError = {
    kind: 'invalid_did' | 'unknown_nous' | 'brain_unavailable' | 'network' | 'nous_deleted';  // Phase 8
    deletedAtTick?: number;                                   // Phase 8 — surfaced on 410 branch
};

const STATUS_TO_KIND: Record<number, FetchError['kind']> = {
    400: 'invalid_did',
    404: 'unknown_nous',
    410: 'nous_deleted',      // Phase 8
    503: 'brain_unavailable',
};
```

**Divergence:** Purely additive widening. Existing callers that destructure known fields keep compiling. The 410 branch needs extra parse logic to extract `deleted_at_tick` from the response body — follows the same pattern as 200 OK.

---

### `dashboard/src/lib/api/operator.ts` (modify — add deleteNous)

**Analog:** existing `postOperatorAction<T>` wrapper + `OperatorErrorKind` union + `STATUS_TO_KIND` map.

**Pattern to modify:**
```typescript
export type OperatorErrorKind =
    | 'invalid_tier'
    | 'unknown_nous'
    | 'brain_unavailable'
    | 'network'
    | 'nous_deleted';                                    // Phase 8

const STATUS_TO_KIND: Record<number, OperatorErrorKind> = {
    400: 'invalid_tier',
    404: 'unknown_nous',
    410: 'nous_deleted',                                 // Phase 8
    503: 'brain_unavailable',
};

export interface DeleteNousResult {
    ok: true;
    deleted_at_tick: number;
    pre_deletion_state_hash: string;
}

export function deleteNous(
    did: string,
    origin: string,
    operator_id: string,
    signal?: AbortSignal,
): Promise<OperatorFetchResult<DeleteNousResult>> {
    return postOperatorAction<DeleteNousResult>(
        `/api/v1/operator/nous/${encodeURIComponent(did)}/delete`,
        origin,
        { tier: 'H5', operator_id },
        signal,
    );
}
```

**Divergence:** Thin specialization of the existing generic `postOperatorAction` — no duplication; no 500 handling (delete route has no 500 branch per D-16).

---

### `dashboard/src/components/agency/irreversibility-dialog.test.tsx` (unit)

**Analog:** `dashboard/src/components/agency/elevation-dialog.test.tsx` (jsdom 26 shim for `HTMLDialogElement.prototype.showModal/close` at lines 24-36 — mandatory).

**Pattern to copy** (shim + interaction matrix):
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { IrreversibilityDialog } from './irreversibility-dialog';

// jsdom 26 shim — mandatory (copy verbatim from elevation-dialog.test.tsx).
beforeAll(() => {
    if (!HTMLDialogElement.prototype.showModal) {
        HTMLDialogElement.prototype.showModal = function () { (this as any).open = true; };
        HTMLDialogElement.prototype.close = function () { (this as any).open = false; this.dispatchEvent(new Event('close')); };
    }
});

const TARGET_DID = 'did:noesis:sovereign-alpha';

describe('IrreversibilityDialog', () => {
    it('renders first-life promise copy verbatim', () => {
        render(<IrreversibilityDialog targetDid={TARGET_DID} targetName="Alpha" open onConfirm={vi.fn()} onCancel={vi.fn()} />);
        expect(screen.getByTestId('irreversibility-first-life-copy').textContent).toMatch(
            /This is H5 Sovereign\. Audit entries about this Nous will remain forever; the Nous itself will not\. There is no undo\./
        );
    });

    it('disables confirm until input matches targetDid exactly', () => { /* ... */ });
    it('suppresses paste into input', () => {
        render(<IrreversibilityDialog targetDid={TARGET_DID} targetName="Alpha" open onConfirm={vi.fn()} onCancel={vi.fn()} />);
        const input = screen.getByTestId('irreversibility-input') as HTMLInputElement;
        const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
        input.dispatchEvent(pasteEvent);
        expect(pasteEvent.defaultPrevented).toBe(true);
    });
    it('does not submit on Enter key alone', () => { /* form.onSubmit is preventDefault */ });
    it('Cancel, ESC, backdrop click all fire onCancel with no side effects', () => { /* ... */ });
});
```

**Divergence from `elevation-dialog.test.tsx`:** Adds paste-suppression assertion + exact-string-match gate + copy-verbatim lock.

---

### `dashboard/src/app/grid/components/inspector-delete.test.tsx` (integration)

**Analog:** `dashboard/src/components/agency/elevation-race.test.tsx` (closure-capture SC#4 race test via `useElevatedAction`; local storage polyfill at lines 38-65).

**Pattern to copy** (2-stage flow sequencing + auto-downgrade assertion):
```typescript
describe('Inspector — H5 delete wiring (2-stage flow)', () => {
    it('click Delete Nous → opens ElevationDialog(H5)', async () => { /* ... */ });
    it('H5 elevation confirm → closes elevation, opens IrreversibilityDialog', async () => { /* ... */ });
    it('IrreversibilityDialog confirm with typed DID → fires POST /delete', async () => { /* ... */ });
    it('IrreversibilityDialog cancel → auto-downgrades H5→H1 (agencyStore)', async () => { /* ... */ });
    it('ElevationDialog cancel → no POST fires, agency is H1', async () => { /* ... */ });
    it('tombstoned state renders "Nous deleted at tick N" disabled button', async () => { /* ... */ });
    it('410 response sets ERR_COPY.nous_deleted state', async () => { /* ... */ });
    it('localStorage tier="H5" injection → hydrates to H1 (D-21)', () => {
        window.localStorage.setItem('agency-tier', 'H5');
        // ... mount agency store, assert tier is H1.
    });
});
```

**Divergence from `elevation-race.test.tsx`:** Sequences both dialogs + the network POST + the auto-downgrade. Closure-capture pattern from Phase 6 D-07 is reused implicitly via `IrreversibilityDialog`'s internal state.

---

### `scripts/check-state-doc-sync.mjs` (modify — 17→18 bump)

**Analog:** existing script at lines 40-93.

**Pattern to modify:**
```javascript
// Line 40:
if (!/18\s+events/i.test(state)) {
  failures.push('STATE.md does not mention "18 events" — Phase 8 allowlist count assertion missing.');
}

// In required array (after 'telos.refined'):
const required = [
  // ... existing 17 members ...
  'telos.refined',
  // Phase 8 addition (AGENCY-05 / Plan 08-02):
  'operator.nous_deleted',
];
```

**Divergence:** Two localized bumps (regex + required array). The phantom-event guard logic (Phase 7) stays unchanged.

---

## Shared Patterns

### Producer-Boundary Discipline
**Source:** `grid/src/audit/append-telos-refined.ts` (primary Phase 7 sibling) + `grid/src/audit/operator-events.ts` (`operator.*` tier-required invariant)
**Apply to:** `grid/src/audit/append-nous-deleted.ts`
```typescript
// 1. Regex-guard every input (DID_RE, HEX64_RE, literal tier/action).
// 2. Sorted EXPECTED_KEYS closed tuple — Object.keys.sort() structural assertion.
// 3. Explicit object reconstruction — no spread, no inheritance.
// 4. payloadPrivacyCheck() as belt-and-suspenders.
// 5. Single audit.append() call at the bottom.
// 6. Grep test asserts no other file calls audit.append with this event type.
```

### Closed-Tuple Payload (Object.keys.sort())
**Source:** `grid/src/audit/append-telos-refined.ts` lines 41, 76-82
**Apply to:** `grid/src/audit/append-nous-deleted.ts` (5 keys: action, operator_id, pre_deletion_state_hash, target_did, tier)
```typescript
const EXPECTED_KEYS = [<sorted keys>] as const;
const actualKeys = Object.keys(payload).sort();
if (actualKeys.length !== EXPECTED_KEYS.length
    || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
    throw new TypeError(`unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
}
```

### Hex-Regex Runtime Guard
**Source:** `grid/src/audit/append-telos-refined.ts` line 24 + `grid/src/api/operator/telos-force.ts` lines 43, 111-123
**Apply to:** `grid/src/audit/append-nous-deleted.ts` (pre_deletion_state_hash) + `grid/src/api/operator/delete-nous.ts` (4 component hashes from Brain RPC)
```typescript
export const HEX64_RE = /^[a-f0-9]{64}$/;
// Route: on every hash from Brain, test HEX64_RE; on fail → 503 + log "contract drift" + NO audit emit.
```

### Tier-Required for `operator.*`
**Source:** `grid/src/audit/operator-events.ts` lines 31-68 `VALID_TIERS` + `requireTierInPayload`
**Apply to:** `grid/src/audit/append-nous-deleted.ts` — inlined as literal `'H5'` check (not via `appendOperatorEvent` because closed-tuple discipline requires Phase 8 to own its own producer)
```typescript
if (payload.tier !== 'H5') throw new TypeError(`appendNousDeleted: tier must be 'H5'`);
```

### Frozen Allowlist Append-Only
**Source:** `grid/src/audit/broadcast-allowlist.ts` lines 24-58 + `buildFrozenAllowlist` lines 70-79
**Apply to:** Phase 8 `'operator.nous_deleted'` at position 18
```typescript
// Append — no reorder. Downstream buildFrozenAllowlist + FORBIDDEN_KEY_PATTERN + payloadPrivacyCheck unchanged.
// Doc-sync gate (scripts/check-state-doc-sync.mjs) bumped in the SAME commit.
```

### Zero-Diff Determinism (Listener-Invariance)
**Source:** `grid/test/audit.test.ts` lines 253-281 — `nowSpy` freezes Date.now, `runSim(listenerCount)` compares chain heads byte-for-byte across 0 vs 10 listeners
**Apply to:** `grid/test/nous-deleted-zero-diff.test.ts` — spawn/spoke/delete sequence substituted in
```typescript
const runSim = (listenerCount: number): string[] => { /* spawn/spoke/delete */ return chain.entries.map(e => e.hash); };
expect(runSim(10)).toEqual(runSim(0));
```

### Route Error Ladder (No 500s)
**Source:** `grid/src/api/operator/telos-force.ts` entire file — 400 (body) → 400 (DID) → 404 (unknown) → 503 (bridge) → 503 (RPC) → 503 (contract drift) → audit emit → 200
**Apply to:** `grid/src/api/operator/delete-nous.ts` — adds 410 (tombstoned) between 400 (DID) and 404 (unknown); no 500s anywhere
```typescript
// Strict ordering: 1) tier gate → 2) DID gate → 3) tombstone gate (410) → 4) runner lookup →
// 5) bridge health → 6) Brain RPC → 7) hash runtime guard → 8) compose → 9) tombstone + map-remove →
// 10) audit emit → 11) runner teardown → 200.
```

### Centralized Tombstone 410 Gate
**Source:** `grid/src/api/operator/_validation.ts` — `validateTierBody<T>` tagged-union pattern
**Apply to:** `grid/src/registry/tombstone-check.ts` + every DID-resolving route (introspect, telos-force, trade, spoke-target) — call `tombstoneCheck` BEFORE any other work
```typescript
const t = tombstoneCheck(services.registry, targetDid);
if (!t.ok) { reply.code(410); return { error: 'nous_deleted', deleted_at_tick: t.deletedAtTick }; }
```

### ElevationDialog Lifecycle (Native `<dialog>` + closure-capture)
**Source:** `dashboard/src/components/agency/elevation-dialog.tsx` lines 44-51 (`useEffect` + `showModal`/`close`) + `onClose={onCancel}` wiring + `autoFocus` on safe-default button
**Apply to:** `dashboard/src/components/agency/irreversibility-dialog.tsx` — adds `role="alertdialog"`, paste-suppress, exact-DID gate, `preventDefault` on form submit, state-reset on open

### jsdom Dialog Shim (Test Infrastructure)
**Source:** `dashboard/src/components/agency/elevation-dialog.test.tsx` lines 24-36 `beforeAll` — shims `HTMLDialogElement.prototype.showModal/close` for jsdom 26
**Apply to:** `dashboard/src/components/agency/irreversibility-dialog.test.tsx` (mandatory — copy verbatim)

### Closure-Capture Race Safety (Phase 6 D-07)
**Source:** `dashboard/src/components/agency/elevation-race.test.tsx` — asserts the opener + tier captured at dialog-open time, not at commit time
**Apply to:** `dashboard/src/components/agency/irreversibility-dialog.tsx` — `targetDid` passed as prop (captured at mount by parent) + `setTyped('')` on open reset
```typescript
// IrreversibilityDialog's targetDid is captured by the parent at flow='elevating' transition.
// Selection changes mid-dialog cannot redirect the delete to a different Nous.
```

### Auto-Downgrade on Commit/Cancel (Phase 6 D-08)
**Source:** `dashboard/src/components/agency/elevation-dialog.tsx` `onConfirm`/`onCancel` wiring to agency store
**Apply to:** Inspector `handleIrreversibilityConfirm`/`handleIrreversibilityCancel` — unconditional `agencyStore.downgradeToH1()` on either
```typescript
// Both paths land at setFlow('idle') AND fire downgradeToH1() — mirrors H4→H1 auto-downgrade.
```

### H5 Hydration Whitelist Regression (Phase 6 D-20 lock)
**Source:** Phase 6 `agency-store.hydrateFromStorage` whitelist `{H1,H2,H3,H4}`
**Apply to:** `dashboard/src/app/grid/components/inspector-delete.test.tsx` — D-21 regression: inject `tier: 'H5'` into localStorage, assert hydration to H1 (not H5)

### Additive Introspect Widening (Phase 6 `test_get_state_widening` pattern)
**Source:** Phase 6 snapshot pattern — `NousStateResponse` is additive-only; strict-superset assertion
**Apply to:** `dashboard/src/lib/api/introspect.ts` — `status` + `deletedAtTick?` purely additive; callers not reading the new field keep working

### Doc-Sync Regression Gate
**Source:** `scripts/check-state-doc-sync.mjs` — regex on count + required-member array
**Apply to:** Phase 8 closing commit — bump `/17\s+events/` → `/18\s+events/` + append `'operator.nous_deleted'` to required array IN THE SAME COMMIT that flips `ALLOWLIST_MEMBERS` (CLAUDE.md doc-sync rule)

### Hash-Only Cross-Boundary (Phase 6 D-19 extended)
**Source:** `brain/src/noesis_brain/telos/hashing.py` `compute_active_telos_hash` — sole hash authority; plaintext never crosses RPC
**Apply to:** `brain/src/noesis_brain/state_hash.py` (3 new sibling helpers) + `brain/src/noesis_brain/rpc/handler.py` new `compute_pre_deletion_state_hash` method — 4-hash tuple returned; Grid composes 5th via `combineStateHash`; plaintext NEVER touches the Grid process

### Canonical-JSON Discipline
**Source:** `brain/src/noesis_brain/telos/hashing.py` lines 40-41 — `json.dumps(data, sort_keys=True, separators=(",", ":"))` → SHA-256
**Apply to:** All 3 new Brain hash helpers (psyche, thymos, memory_stream) — identical canonicalization
**Divergent apply:** `grid/src/audit/state-hash.ts` `combineStateHash` — does NOT sort_keys; uses an ORDERED object literal because the key order itself is the locked contract (D-07)

### Sole Audit-Append Path Enforcement (Grep-Based Invariant)
**Source:** `grid/test/audit/telos-refined-producer-boundary.test.ts` lines 1-47 — `readdirSync` walk + regex `\b(audit|chain|this\.audit|this\.chain)\.append[^;]{0,200}['"]EVENT_TYPE['"]`
**Apply to:** `grid/test/audit/nous-deleted-producer-boundary.test.ts` — clone verbatim, swap event type + sole-producer filename

---

## No Analog Found

All Phase 8 new files map to established analogs. Two files sit at the boundary of "new shape" but still match closely:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `grid/src/audit/state-hash.ts` | utility (multi-component hash composer) | transform | No Grid-side multi-component hash helper exists pre-Phase 8. Closest analogs are `grid/src/dialogue/dialogue-id.ts` (single-component `createHash('sha256').digest('hex')`) and the Brain's `compute_active_telos_hash` (canonical-JSON-then-SHA-256 discipline). Phase 8 inverts the Brain's `sort_keys=True` choice in favor of an ordered-literal for explicit contract locking (D-07). Planner should treat this as a first-in-family Grid utility. |
| `grid/src/registry/tombstone-check.ts` | utility (route-composable gate) | n/a | No existing `registry/*-check.ts` helper — closest analog is `grid/src/api/operator/_validation.ts` `validateTierBody` generic (same tagged-union pattern). Planner adds to `registry/` for call-site locality (the check consults `NousRegistry`, not request bodies). |

Both are small enough (< 30 lines) that "no exact analog" does not create ambiguity — the patterns are assembled from 2-3 existing building blocks.

---

## Metadata

**Analog search scope:** `grid/src/audit/**`, `grid/src/api/operator/**`, `grid/src/registry/**`, `grid/src/space/**`, `grid/src/integration/**`, `grid/src/dialogue/**`, `grid/test/audit/**`, `grid/test/api/**`, `grid/test/registry/**`, `grid/test/audit.test.ts`, `brain/src/noesis_brain/telos/hashing.py`, `brain/src/noesis_brain/rpc/handler.py`, `brain/test/test_rpc_handler.py`, `brain/test/test_telos_refined_action.py`, `dashboard/src/components/agency/**`, `dashboard/src/app/grid/components/inspector.tsx`, `dashboard/src/lib/api/introspect.ts`, `dashboard/src/lib/api/operator.ts`, `scripts/check-state-doc-sync.mjs`, `.planning/phases/07-peer-dialogue-telos-refinement/07-PATTERNS.md` (structural template).

**Files scanned:** 27 analog source files + 4 planning docs (07-PATTERNS.md, 08-CONTEXT.md, 08-UI-SPEC.md header, 08-RESEARCH.md canonical_refs via CONTEXT.md).

**Pattern extraction date:** 2026-04-21.

**Cross-phase lineage lock:** Phase 8 inherits the Phase 6 operator-event tier-required invariant, Phase 7 closed-tuple + sole-producer + zero-diff regression discipline, and Phase 5 privacy matrix enumeration. Every new file has a direct line of descent to a file that shipped GREEN in a prior phase — zero green-field patterns.
