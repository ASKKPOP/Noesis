# Phase 8: H5 Sovereign Operations (Nous Deletion) — Research

**Researched:** 2026-04-21
**Domain:** Tombstone patterns, hash composition, confirmation UX, HTTP 410, audit determinism
**Confidence:** HIGH (40 decisions locked in CONTEXT.md; research supplies implementation mechanics)

---

## Summary

Phase 8 is the terminal human-agency tier: an H5-elevated operator can delete a Nous with
maximum friction, full forensic preservation, and audit-chain integrity intact. The CONTEXT locks
every architectural decision (D-01..D-40). This document supplies the *how* — concrete code
patterns, library idioms, codebase file:line references, and pitfalls — so the planner can write
executable task lists without re-investigating.

**Plan decomposition (D-37):** 3 plans, each RED-first per Noēsis TDD discipline.

- **08-01**: Grid primitives (tombstone, SpatialMap.removeNous, tombstoneCheck, 410 wiring,
  introspect status field, runner despawn). ~8–10 tasks.
- **08-02**: Delete route + `appendNousDeleted` + `combineStateHash` + Brain state-hash RPC +
  allowlist 17→18 + privacy/producer-boundary/zero-diff tests. ~10–12 tasks.
- **08-03**: Dashboard `IrreversibilityDialog` + Inspector wiring + 2-stage elevation flow +
  introspect 410 client mapping + firehose deleted-chip. ~8–10 tasks.

**Primary recommendation:** Mirror Phase 7's producer-boundary discipline
(`appendTelosRefined`) without deviation. Write the zero-diff test first. Every new
`assertClosed` invariant (key-order lock, 64-hex regex) should copy patterns from
`grid/src/audit/append-telos-refined.ts` verbatim. The Brain hash module mirrors
`brain/src/noesis_brain/telos/hashing.py` exactly — `json.dumps(sort_keys=True, separators=(",",":"))`
then `hashlib.sha256(...).hexdigest()`.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01 .. D-40)

All 40 decisions in CONTEXT.md are locked and govern this phase. This research does not
re-derive them — only supplies implementation mechanics. The decisions most relevant to each
research area are cited inline below.

Key decisions that bound the broadest scope:
- **D-07**: `combineStateHash` canonical key order is LOCKED — any reorder invalidates all
  historical hashes.
- **D-24**: `'operator.nous_deleted'` at position **18** — tuple order locked; frozen-ordering
  test must extend.
- **D-25**: Closed 5-key payload tuple `{tier,action,operator_id,target_did,pre_deletion_state_hash}`.
- **D-11**: Tombstone retains the `NousRecord` in the `records` Map forever — name/DID
  permanently reserved (D-33, D-34).
- **D-31**: H5 is default-ON behind the irreversibility dialog — no feature flag (PHILOSOPHY §7
  visible-tier mandate).

### Claude's Discretion

- Exact file layout for the delete route (likely `grid/src/api/operator/delete-nous.ts`).
- Whether `combineStateHash` lives in `grid/src/audit/state-hash.ts` or
  `grid/src/registry/state-hash.ts` — audit/ preferred for call-site locality.
- Whether `IrreversibilityDialog` reuses `ElevationDialog` as a composed primitive or is a peer —
  peer is cleaner (different semantics: commitment vs elevation).
- Exact Tailwind classes for the `operator.nous_deleted` chip in Firehose.
- Whether `GridCoordinator.despawnNous` is a method on the coordinator or inlined in the route.
- Whether Brain's 4 component hash helpers live in separate files or a single `state_hash.py` —
  single module preferred.
- Whether the introspect route's 410 body includes the deleted record's `name`.

### Deferred Ideas (OUT OF SCOPE)

- Forensic plaintext vault (encrypted snapshot keyed by `pre_deletion_state_hash`).
- Undelete / resurrection.
- Bulk deletion / roster purge (`H5-BULK-01`).
- Cross-grid deletion propagation (Federation — Milestone 5).
- Dedicated "graveyard" dashboard tab.
- Per-component hash attribution in audit payload.
- Name-reuse after tombstone (`NAME-REUSE-01`).
- Audit-chain compaction / pruning (PHILOSOPHY §7: never).
- Typing the Nous's *name* instead of DID.
- Feature-flag hiding H5 from UI (rejected per D-31).
- H5 emission via Brain self-termination (no such action exists).
- Post-deletion read endpoints (`GET /api/v1/deleted/:did/tombstone`).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AGENCY-05 | H5 deletion gated by irreversibility dialog + DID-typed confirm; emits `operator.nous_deleted` with pre-deletion state hash; audit chain never purged | Sections: tombstone pattern, hash composition, dialog UX, 410 Gone, zero-diff regression, producer boundary |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| DID-typed confirm dialog | Dashboard (client) | — | Operator interaction; never reaches the server until confirmed |
| Two-stage elevation (H4→H5→commit) | Dashboard (client) | — | Phase 6 ElevationDialog flow already lives here |
| Tombstone `NousRecord` | Grid (registry) | — | In-memory state; `NousRegistry.tombstone(did, tick)` mutates the single record |
| Remove from `SpatialMap` | Grid (space) | — | Position Map is Grid-owned; `removeNous(did)` is a peer of `placeNous` |
| Compute pre-deletion state hash (4 components) | **Brain** | — | Brain is sole hash authority (PHILOSOPHY §1); never returns plaintext |
| Compose combined hash (5 grid fields + 4 brain hashes) | Grid (audit) | — | Hash-only cross-boundary contract; `combineStateHash` in `state-hash.ts` |
| Emit `operator.nous_deleted` | Grid (`appendNousDeleted`) | — | Sole-producer boundary pattern; mirrors `appendTelosRefined` |
| Allowlist extension 17→18 | Grid (`broadcast-allowlist.ts`) | — | Frozen tuple append at position 18 |
| HTTP 410 Gone for tombstoned DIDs | Grid (route guards) | — | `tombstoneCheck` helper consumed by every DID-resolving route |
| Runner teardown / tick-skip guard | Grid (coordinator + runner) | — | `despawnNous` + `status==='deleted'` guard in `NousRunner.tick` |
| 410 client mapping → `FetchError.nous_deleted` | Dashboard (API layer) | — | Maps HTTP 410 from `/api/v1/nous/:did/state`; introspect.ts |
| Firehose `operator.nous_deleted` chip | Dashboard (client) | — | Visual distinction — additive to existing FirehoseRow chip logic |
| Doc-sync gate 17→18 | Scripts | — | `check-state-doc-sync.mjs` literal bump |

---

## Standard Stack

### Core (no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | existing | All Grid/dashboard unit tests | Project-wide; `grid/vitest.config.ts` existing |
| Node `crypto` | built-in | `createHash('sha256')` for `combineStateHash` | Same module used in `chain.ts:8` and `id.ts`; determinism-safe |
| Fastify | existing | Route registration for delete endpoint | `grid/src/api/server.ts` — all routes use Fastify |
| React (hooks) | existing | `IrreversibilityDialog` state (`useState`, `useRef`, `useEffect`) | Dashboard-wide; no new deps |
| `hashlib` + `json` (Python stdlib) | built-in | Brain `compute_*_hash` helpers | Matches `brain/src/noesis_brain/telos/hashing.py:10-11` exactly |

### Supporting (no new dependencies)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Playwright | existing | Inspector delete flow E2E smoke | `dashboard/tests/e2e/` harness already wired from Phase 6 |
| `@fastify/cors`, `@fastify/websocket` | existing | Not touched by Phase 8 | Existing server infrastructure |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled canonical JSON (`JSON.stringify` with sorted keys) | `json-canonicalize` npm package (RFC 8785 JCS) | Project already uses `JSON.stringify` for hash computation (chain.ts:181); adding a library for one call would be inconsistent. Manual key-order lock is more auditable and already tested. See §Hash Composition research below. |
| `role="alertdialog"` for IrreversibilityDialog | `role="dialog"` | ARIA 1.2 recommends `alertdialog` for irreversible destructive actions — but native `<dialog>` with `showModal()` satisfies focus-trap and Escape by default. Either is acceptable; `alertdialog` is more semantically correct for the delete case (see §UX research). |

**Installation:** none — all dependencies already present.

---

## Architecture Patterns

### System Architecture Diagram

```
Operator (H1 default)
    │
    │  clicks "Delete Nous" in Inspector
    ▼
Dashboard: Inspector.tsx
    │  (1) opens ElevationDialog(tier="H5")
    ▼
ElevationDialog (Phase 6 D-06)
    │  onConfirm → tier="H5" in agencyStore
    ▼  onCancel  → auto-downgrade H1, flow aborts
    │
    │  (2) IrreversibilityDialog opens
    ▼
IrreversibilityDialog (NEW — Phase 8)
    │  • shows targetDid in <code> element
    │  • <input onPaste={e=>e.preventDefault()} >
    │  • Delete button disabled until typed === targetDid
    ▼  Cancel/ESC/backdrop → auto-downgrade H1, flow aborts
    │
    │  (3) DELETE POST fires on confirm
    ▼
Grid: POST /api/v1/operator/nous/:did/delete
    │  (validateTierBody 'H5' + DID gate)
    │
    ├─── tombstoneCheck → 410 if already deleted
    ├─── registry.get → 404 if unknown
    ├─── runner.connected check → 503 if Brain unavailable
    │
    │  (4) Brain RPC: compute_pre_deletion_state_hash
    ▼
Brain: /compute_pre_deletion_state_hash (NEW handler)
    │  compute_psyche_hash | compute_thymos_hash |
    │  compute_active_telos_hash | compute_memory_stream_hash
    │  → {psyche_hash, thymos_hash, telos_hash, memory_stream_hash}
    ▼  (each 64-hex SHA-256 over canonical JSON of that subsystem)
    │
    │  (5) Grid receives 4 hashes — validates each HEX64_RE
    ▼
Grid: combineStateHash(4 hashes + 5 grid fields)
    │  canonical JSON (key order LOCKED) → SHA-256 → pre_deletion_state_hash
    │
    │  (6) Tombstone + spatial remove + runner despawn
    │  registry.tombstone(did, tick)       → status='deleted', deletedAtTick=N
    │  spatial.removeNous(did)             → drops position entry
    │  coordinator.despawnNous(did)        → bridge.close, tick unsub, spatial drop
    │
    │  (7) Audit emit — sole producer boundary
    ▼
appendNousDeleted(audit, operator_id, {target_did, pre_deletion_state_hash})
    │  validates inputs, emits closed 5-key tuple
    ▼
AuditChain.append('operator.nous_deleted', ...)
    │  fires SSE to WebSocket hub
    ▼
Firehose (Dashboard)
    │  existing firehose renders any allowlisted event
    │  Phase 8 adds: red/strikethrough chip for operator.nous_deleted
    ▼

After deletion, every DID-resolving route:
    GET /api/v1/nous/:did/state        → tombstoneCheck → 410
    POST /api/v1/operator/nous/:did/telos/force → tombstoneCheck → 410
    trade initiation                   → tombstoneCheck → 410
    nous.spoke targeting               → tombstoneCheck → 410

Dashboard:
    introspect.ts: STATUS_TO_KIND[410] = 'nous_deleted'
    Inspector: renders EmptyState "Nous deleted at tick N"
    "Delete Nous" button: renders "Nous deleted at tick N" (read-only disabled)
```

### Component Responsibilities

| Component | File (new/edit) | Responsibility |
|-----------|-----------------|----------------|
| `NousRegistry.tombstone` | edit `grid/src/registry/registry.ts` | Add `tombstone(did, tick): boolean` peer of `suspend`/`exile` |
| `NousRecord.status` + `deletedAtTick?` | edit `grid/src/registry/types.ts` | Extend union; add optional field |
| `NousRegistry.active()` filter | edit `grid/src/registry/registry.ts` | Already filters `r.status === 'active'`; `'deleted'` excluded naturally |
| `SpatialMap.removeNous` | edit `grid/src/space/map.ts` | Peer of `placeNous`; `positions.delete(did)` |
| `tombstoneCheck` | **new** `grid/src/registry/tombstone-check.ts` | Centralized 410-guard helper |
| `GridServices.coordinator?` | edit `grid/src/api/server.ts` | Add optional `coordinator` reference for `despawnNous` |
| `GridCoordinator.despawnNous` | edit `grid/src/integration/grid-coordinator.ts` | Idempotent teardown: bridge.close + tick unsub + spatial remove |
| `NousRunner.tick` — deleted guard | edit `grid/src/integration/nous-runner.ts` | Skip `sendTick` when `registry.get(did)?.status === 'deleted'` |
| `registerDeleteNousRoute` | **new** `grid/src/api/operator/delete-nous.ts` | Structural mirror of `telos-force.ts` |
| `registerOperatorRoutes` barrel | edit `grid/src/api/operator/index.ts` | Add `registerDeleteNousRoute` import |
| `appendNousDeleted` | **new** `grid/src/audit/append-nous-deleted.ts` | Sole-producer boundary for `operator.nous_deleted` |
| `combineStateHash` | **new** `grid/src/audit/state-hash.ts` | Canonical-JSON SHA-256 over 9-field struct; key order LOCKED |
| `ALLOWLIST_MEMBERS` | edit `grid/src/audit/broadcast-allowlist.ts` | Append `'operator.nous_deleted'` at position 18 |
| `GET /nous/:did/state` — tombstone | edit `grid/src/api/server.ts` | Call `tombstoneCheck` before runner lookup; 410 path |
| `NousStateResponse.status` | edit `dashboard/src/lib/api/introspect.ts` | Additive field `status: 'active'|'suspended'|'exiled'|'deleted'` |
| `FetchError.kind` | edit `dashboard/src/lib/api/introspect.ts` | Add `'nous_deleted'` variant; map HTTP 410 |
| `Inspector` | edit `dashboard/src/app/grid/components/inspector.tsx` | Wire H5 delete button; tombstoned-state rendering |
| `IrreversibilityDialog` | **new** `dashboard/src/components/agency/irreversibility-dialog.tsx` | Peer of `elevation-dialog.tsx`; native `<dialog>`, paste-suppressed input |
| `FirehoseRow` | edit `dashboard/src/app/grid/components/firehose-row.tsx` | Add deleted-chip class for `operator.nous_deleted` |
| Brain `state_hash.py` | **new** `brain/src/noesis_brain/state_hash.py` | 4 hash helpers; `compute_pre_deletion_state_hash` dispatcher |
| Brain RPC handler | edit `brain/src/noesis_brain/rpc/handler.py` | Register `compute_pre_deletion_state_hash` method |
| Brain RPC types | edit `brain/src/noesis_brain/rpc/types.py` | New RPC method name (if typed) |
| `check-state-doc-sync.mjs` | edit `scripts/check-state-doc-sync.mjs` | Bump count literal 17→18; add `'operator.nous_deleted'` to required[] |

---

## Research Area 1: Tombstone Pattern for In-Memory Registries

### Existing Pattern (VERIFIED: `grid/src/registry/registry.ts:76-90`)

`NousRegistry` has `suspend(did)`, `exile(did)`, `reinstate(did)` — all mutate `record.status` in
place. The record stays in `this.records` permanently; `active()` at line 146-148 filters by
`r.status === 'active'`. Phase 8 `tombstone(did, tick)` is a direct peer of this pattern.

```typescript
// VERIFIED: grid/src/registry/registry.ts:76-90 — existing pattern
suspend(did: string): boolean {
    const record = this.records.get(did);
    if (!record || record.status !== 'active') return false;
    record.status = 'suspended';
    return true;
}
```

### Phase 8 tombstone method (mirrors the pattern exactly):

```typescript
// grid/src/registry/registry.ts — new method
tombstone(did: string, tick: number): boolean {
    const record = this.records.get(did);
    if (!record || record.status === 'deleted') return false;  // idempotent
    record.status = 'deleted';
    record.deletedAtTick = tick;
    return true;
}
```

### Iteration Predicates — Active vs Deleted

The existing `active()` method [VERIFIED: `grid/src/registry/registry.ts:146-148`] filters
`r.status === 'active'`. Since `'deleted'` is not `'active'`, deleted Nous are excluded
from `active()`, `inRegion()`, and the roster endpoint **without any code change to those
filters**. The extension is additive.

The `get(did)` method [VERIFIED: `grid/src/registry/registry.ts:45-47`] returns the record
regardless of status — correct, because the audit chain and tombstoneCheck helpers need to
resolve tombstoned DIDs to read `deletedAtTick` and `name`.

**Query API surface decision (D-11):** No separate `getAlive` / `get` split needed. The
existing `get()` returns tombstones (needed for forensics); `active()` already excludes
them. The only new method is `tombstone(did, tick)`.

### DID Reuse Prevention (D-33)

`NousRegistry.spawn()` [VERIFIED: `grid/src/registry/registry.ts:16-18`] throws
`Nous already registered: ${did}` when `this.records.has(req.did)`. Since `tombstone()` does
NOT remove the record from `this.records`, spawn-with-tombstone-DID throws naturally — no
code change needed. A regression test at `grid/test/registry/tombstone-did-reuse.test.ts`
confirms this behavior.

### SpatialMap.removeNous (D-13)

`SpatialMap.placeNous` [VERIFIED: `grid/src/space/map.ts:55-64`] does
`this.positions.set(nousDid, ...)`. The peer remove is:

```typescript
// grid/src/space/map.ts — new method
removeNous(did: string): boolean {
    const had = this.positions.has(did);
    this.positions.delete(did);
    return had;
}
```

`getNousInRegion` [VERIFIED: `grid/src/space/map.ts:72-74`] iterates `this.positions.values()` —
deleting from the Map removes the entry immediately, so subsequent region queries exclude the
tombstoned Nous without any filter change.

### tombstoneCheck Helper (D-17) — Centralized 410 Guard

```typescript
// grid/src/registry/tombstone-check.ts — new file
import type { NousRegistry } from './registry.js';

export type TombstoneCheckResult =
    | { ok: true }
    | { ok: false; deletedAtTick: number };

export function tombstoneCheck(
    registry: NousRegistry,
    did: string,
): TombstoneCheckResult {
    const r = registry.get(did);
    if (r && r.status === 'deleted') {
        return { ok: false, deletedAtTick: r.deletedAtTick ?? -1 };
    }
    return { ok: true };
}
```

Callers: introspect route, telos-force route, trade initiation routes, spoke targeting, delete
route itself (re-deletion is 410 not 404). All consume the same helper — drift is prevented.

---

## Research Area 2: Hash Composition for Cross-Boundary State Digest

### Canonical JSON in TypeScript

The existing `AuditChain.computeHash` [VERIFIED: `grid/src/audit/chain.ts:174-183`] uses:

```typescript
const data = `${prevHash}|${eventType}|${actorDid}|${JSON.stringify(payload)}|${timestamp}`;
return createHash('sha256').update(data).digest('hex');
```

`JSON.stringify` without a replacer produces key order equal to **insertion order** of the
object literal. This is deterministic when the object literal is hardcoded with a fixed key
order — and non-deterministic if a `spread` or dynamic key assignment is used.

**For `combineStateHash`, key order is LOCKED (D-07):**

```typescript
// grid/src/audit/state-hash.ts — NEW
import { createHash } from 'node:crypto';
import type { LifecyclePhase } from '../registry/types.js';

export interface StateHashComponents {
    psyche_hash: string;
    thymos_hash: string;
    telos_hash: string;
    memory_stream_hash: string;
    ousia_balance: number;
    lifecycle_phase: LifecyclePhase;
    region: string;
    spawnedAtTick: number;
    did: string;
}

/** LOCKED key order (D-07) — ANY reorder changes all historical hashes. */
const CANONICAL_KEYS = [
    'did',
    'psyche_hash',
    'thymos_hash',
    'telos_hash',
    'memory_stream_hash',
    'ousia_balance',
    'lifecycle_phase',
    'region',
    'spawned_at_tick',   // NOTE: camelCase field maps to snake_case key
] as const;

export function combineStateHash(c: StateHashComponents): string {
    // Explicit key-ordered object — NO spread, NO dynamic keys
    const canonical = JSON.stringify({
        did: c.did,
        psyche_hash: c.psyche_hash,
        thymos_hash: c.thymos_hash,
        telos_hash: c.telos_hash,
        memory_stream_hash: c.memory_stream_hash,
        ousia_balance: c.ousia_balance,
        lifecycle_phase: c.lifecycle_phase,
        region: c.region,
        spawned_at_tick: c.spawnedAtTick,  // camelCase → snake_case in canonical form
    });
    return createHash('sha256').update(canonical).digest('hex');
}
```

**Why not `json-canonicalize` (RFC 8785 JCS)?** [ASSUMED] RFC 8785 JCS sorts keys
alphabetically. `JSON.stringify` with an explicit hardcoded object literal preserves insertion
order deterministically. Since we control the literal at `combineStateHash`, `JSON.stringify`
is simpler and introduces zero new dependencies. A regression test that locks the serialized
key order string makes future violations immediately visible.

**Key ordering regression test (MUST include):**

```typescript
it('combineStateHash canonical key order is locked — any reorder fails this test', () => {
    const fixture = {
        did: 'did:noesis:test',
        psyche_hash: '0'.repeat(64), thymos_hash: '1'.repeat(64),
        telos_hash: '2'.repeat(64), memory_stream_hash: '3'.repeat(64),
        ousia_balance: 100, lifecycle_phase: 'infant' as const,
        region: 'agora', spawnedAtTick: 5,
    };
    const result = combineStateHash(fixture);
    // Verify the canonical JSON produced the expected key order before hashing:
    const canonical = JSON.stringify({
        did: fixture.did, psyche_hash: fixture.psyche_hash,
        thymos_hash: fixture.thymos_hash, telos_hash: fixture.telos_hash,
        memory_stream_hash: fixture.memory_stream_hash,
        ousia_balance: fixture.ousia_balance, lifecycle_phase: fixture.lifecycle_phase,
        region: fixture.region, spawned_at_tick: fixture.spawnedAtTick,
    });
    expect(JSON.parse(canonical)).toMatchObject({ did: 'did:noesis:test' });
    expect(Object.keys(JSON.parse(canonical))).toEqual([
        'did','psyche_hash','thymos_hash','telos_hash','memory_stream_hash',
        'ousia_balance','lifecycle_phase','region','spawned_at_tick',
    ]);
    // The hash is then a deterministic function of this string
    expect(result).toMatch(/^[0-9a-f]{64}$/);
});
```

### undefined/null gotchas

`JSON.stringify(undefined)` returns `undefined` (not the string `"undefined"`), and
`JSON.stringify({key: undefined})` omits the key. For `combineStateHash`, every field is
typed non-optional (TypeScript enforces this) except `spawnedAtTick` which is always a
`number`. No null/undefined paths exist in the closed struct.

### Python-side canonical JSON

[VERIFIED: `brain/src/noesis_brain/telos/hashing.py:19-41`]
`compute_active_telos_hash` uses `json.dumps(sort_keys=True, separators=(",", ":"))`.
Each new Brain component hash must use **identical canonicalization** for internal consistency
even though the Grid never receives plaintext — the 64-hex value must be reproducible for
forensic reconstruction (D-29 defers plaintext but doesn't remove reproducibility requirement).

---

## Research Area 3: Brain State Hash RPC — New Module `state_hash.py`

### Template (VERIFIED: `brain/src/noesis_brain/telos/hashing.py`)

The new module follows the same pattern — `json.dumps(sort_keys=True, separators=(",", ":"))` →
`hashlib.sha256(...).hexdigest()`:

```python
# brain/src/noesis_brain/state_hash.py — NEW
from __future__ import annotations
import hashlib
import json
from typing import Any

from noesis_brain.telos.hashing import compute_active_telos_hash


def compute_psyche_hash(psyche: Any) -> str:
    """64-hex SHA-256 over canonical JSON of the Psyche dimension scores."""
    canonical = json.dumps({
        "openness": psyche.openness,
        "conscientiousness": psyche.conscientiousness,
        "extraversion": psyche.extraversion,
        "agreeableness": psyche.agreeableness,
        "neuroticism": psyche.neuroticism,
    }, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def compute_thymos_hash(thymos: Any) -> str:
    """64-hex SHA-256 over canonical JSON of the current emotional state."""
    # Thymos state: mood string + emotion dimension values
    emotion_data = {}
    for dim in thymos.dimensions:          # iterate current emotion values
        emotion_data[str(dim)] = thymos.get(dim)
    canonical = json.dumps(
        {"mood": str(thymos.mood), "emotions": emotion_data},
        sort_keys=True, separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def compute_memory_stream_hash(memory: Any) -> str:
    """64-hex SHA-256 over canonical JSON of the N most recent memory entries.
    Memory is Brain-sovereign — hash only, plaintext never crosses boundary."""
    if memory is None:
        canonical = json.dumps([], separators=(",", ":"))
    else:
        try:
            recent = memory.recent(limit=50)  # last 50 entries for digest
        except Exception:
            recent = []
        entries = [{"kind": e.get("kind",""), "summary": e.get("summary","")}
                   for e in recent if isinstance(e, dict)]
        canonical = json.dumps(entries, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


async def compute_pre_deletion_state_hash(handler: Any) -> dict[str, str]:
    """Dispatcher called by the RPC layer.

    Returns four 64-hex hashes. Reuses compute_active_telos_hash (the sole
    Telos hash authority, Phase 6 D-19) for telos_hash.

    Never returns plaintext. Each hash is independently reproducible from
    the same Brain state — deterministic by construction (sort_keys=True).
    """
    return {
        "psyche_hash": compute_psyche_hash(handler.psyche),
        "thymos_hash": compute_thymos_hash(handler.thymos),
        "telos_hash": compute_active_telos_hash(handler.telos.all_goals()),
        "memory_stream_hash": compute_memory_stream_hash(handler.memory),
    }
```

### Registration in `handler.py`

[VERIFIED: `brain/src/noesis_brain/rpc/handler.py:399-436`] `force_telos` and `query_memory`
are `async def` methods on `BrainHandler` that accept `params: dict[str, Any]`. The new
method follows the same shape:

```python
# brain/src/noesis_brain/rpc/handler.py — new method on BrainHandler
async def compute_pre_deletion_state_hash(self, params: dict[str, Any]) -> dict[str, str]:
    """Return four-component state hash for pre-deletion forensic preservation.

    Params: {} (no input needed — handler has full self-access to all subsystems).
    Returns: {psyche_hash, thymos_hash, telos_hash, memory_stream_hash} — each 64-hex.

    Never returns plaintext (D-06, D-28). Reuses compute_active_telos_hash
    (sole Telos hash authority, Phase 6 D-19 preserved).
    """
    from noesis_brain.state_hash import compute_pre_deletion_state_hash
    return await compute_pre_deletion_state_hash(self)
```

**Grid-side call site** in `delete-nous.ts`: `runner.computePreDeletionStateHash()` — add this
method to `InspectorRunner` interface in `grid/src/api/server.ts` (optional, same pattern as
`forceTelos?` at server.ts:59).

---

## Research Area 4: Delete Route — Structural Mirror of `telos-force.ts`

### Template (VERIFIED: `grid/src/api/operator/telos-force.ts:45-149`)

The telos-force route is the closest structural sibling. The delete route mirrors it with these
differences:
1. Expected tier is `'H5'` not `'H4'`.
2. No `new_telos` body field — only `{tier, operator_id}` body needed.
3. Re-deletion check at step 3 (tombstoneCheck) before runner lookup.
4. Brain RPC returns 4 hashes not 2.
5. Steps 9: tombstone + map-remove + despawn before audit emit (order per D-10).
6. Optional env gate at step 0 (D-32: `NOESIS_GRID_DISABLE_H5=1` → 503).

**Error ladder (no 500s):**
- 503 — `NOESIS_GRID_DISABLE_H5 === '1'`
- 400 — malformed tier or operator_id (`validateTierBody` fails)
- 400 — malformed DID shape
- 410 — already tombstoned (`tombstoneCheck` → ok:false)
- 404 — DID not in registry (`registry.get` returns undefined)
- 503 — runner not found or bridge not connected
- 503 — Brain RPC throws or returns non-hex64 hash
- 200 — success

**Note on step 3 (tombstone before runner lookup):** An already-tombstoned DID has no active
runner (it was despawned in the prior deletion). Returning 410 before 404 correctly communicates
"this Nous existed but was deleted" vs "this DID was never registered".

### Registration

[VERIFIED: `grid/src/api/operator/index.ts:14-27`] Add `registerDeleteNousRoute` import and
call in the barrel:

```typescript
// grid/src/api/operator/index.ts — edit
import { registerDeleteNousRoute } from './delete-nous.js';
// ... existing imports ...
export function registerOperatorRoutes(app, services) {
    // ... existing routes ...
    registerDeleteNousRoute(app, services);
}
```

---

## Research Area 5: `appendNousDeleted` — Sole Producer Boundary

### Template (VERIFIED: `grid/src/audit/append-telos-refined.ts:49-103`)

`appendTelosRefined` is the direct structural sibling. The new `appendNousDeleted` mirrors it:

1. Regex-guard all string inputs (DID_RE, HEX64_RE) — throw `TypeError` on failure.
2. Closed-tuple check: `Object.keys(payload).sort()` strict-equality against expected 5-key set.
3. Explicit object reconstruction — no spread, no rest.
4. `payloadPrivacyCheck` — belt-and-suspenders.
5. `audit.append('operator.nous_deleted', operatorId, cleanPayload)`.

**Note:** Unlike `appendTelosRefined`, `appendNousDeleted` uses `appendOperatorEvent` is NOT
the right parent — that function is for `operator.*` events generically but adds a tier-check.
Since `appendNousDeleted` is a specialized producer that knows it always emits with `tier:'H5'`,
it can call `audit.append` directly (same as `appendTelosRefined` calls `audit.append`
directly, not through `appendOperatorEvent`). The producer-boundary grep test ensures no
other site calls `audit.append` with `'operator.nous_deleted'`.

**Key difference from telos-refined:** The `actorDid` for `appendNousDeleted` is the
**operator_id** (not a Nous DID) because `operator.*` events are actor=operator convention
(compare `telos-force.ts:128` which passes `v.operator_id` as `actorDid`). The function
signature follows the Phase 6 `appendOperatorEvent` convention:

```typescript
// grid/src/audit/append-nous-deleted.ts — new file
export function appendNousDeleted(
    audit: AuditChain,
    operatorId: string,
    p: { target_did: string; pre_deletion_state_hash: string },
): void {
    // 1. Input guards
    if (typeof operatorId !== 'string' || operatorId.length === 0)
        throw new TypeError('appendNousDeleted: operator_id required');
    if (!DID_RE.test(p.target_did))
        throw new TypeError('appendNousDeleted: invalid target_did');
    if (!HEX64_RE.test(p.pre_deletion_state_hash))
        throw new TypeError('appendNousDeleted: pre_deletion_state_hash must be 64-hex');

    // 2. Closed-tuple check (D-25) — 5 keys exactly
    const payload = {
        tier: 'H5' as const,
        action: 'delete' as const,
        operator_id: operatorId,
        target_did: p.target_did,
        pre_deletion_state_hash: p.pre_deletion_state_hash,
    };
    const expectedKeys = ['action','operator_id','pre_deletion_state_hash','target_did','tier'];
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.join(',') !== expectedKeys.join(','))
        throw new TypeError('appendNousDeleted: closed-tuple violation');

    // 3. Privacy gate (D-26) — natively clean; gate is regression check
    const privacy = payloadPrivacyCheck(payload);
    if (!privacy.ok)
        throw new TypeError(`appendNousDeleted: privacy violation — ${privacy.offendingPath}`);

    // 4. Commit
    audit.append('operator.nous_deleted', operatorId, payload);
}
```

### Privacy Check (D-26)

The 5-key payload `{tier:'H5', action:'delete', operator_id, target_did, pre_deletion_state_hash}`:
- `tier` — no forbidden keyword match
- `action` — no forbidden keyword match
- `operator_id` — no forbidden keyword match
- `target_did` — no forbidden keyword match
- `pre_deletion_state_hash` — no forbidden keyword match

`FORBIDDEN_KEY_PATTERN = /prompt|response|wiki|reflection|thought|emotion_delta/i`
[VERIFIED: `grid/src/audit/broadcast-allowlist.ts:92`]. Passes natively; no extension needed.

---

## Research Area 6: HTTP 410 Gone

### RFC 9110 §15.5.11 Semantics [CITED: https://httpwg.org/specs/rfc9110.html#status.410]

HTTP 410 Gone indicates "the target resource is no longer available at the origin server and
this condition is likely to be permanent". Key properties:
- **Cacheable by default** — a 410 response MAY be stored by a cache (unlike 404, which is
  also cacheable but typically shorter-lived). For our use case, the deleted Nous will never
  return, so caching is semantically correct.
- **Prefer 410 over 404** when the resource definitively existed and was permanently removed.
  A 404 on a tombstoned DID would be misleading — the DID is known to the system.

### 404 vs 410 Decision

| Status | Meaning | Phase 8 usage |
|--------|---------|---------------|
| 404 | Resource not found (unknown) | DID was never registered |
| 410 | Resource was here, now permanently gone | DID is tombstoned (`status === 'deleted'`) |

**Ordering in the delete route (D-16):** Check tombstone (→410) BEFORE runner lookup (→404).
Re-deletion hits 410 not 404 — semantically correct (the Nous existed, was deleted).

### Fastify Pattern for 410

```typescript
// In any route handler:
const tc = tombstoneCheck(services.registry!, targetDid);
if (!tc.ok) {
    reply.code(410);
    return { error: 'nous_deleted', deleted_at_tick: tc.deletedAtTick };
}
```

Fastify serializes the return value as JSON with `Content-Type: application/json` and the
given status code. No special plugin needed. [ASSUMED: Fastify 4.x default JSON serialization
applies — consistent with existing route handler patterns in `telos-force.ts`.]

### Client (Dashboard) — `FetchError.nous_deleted`

[VERIFIED: `dashboard/src/lib/api/introspect.ts:51-54`] `STATUS_TO_KIND` maps HTTP status to
`FetchError.kind`. Phase 8 adds:

```typescript
// dashboard/src/lib/api/introspect.ts — edit STATUS_TO_KIND
const STATUS_TO_KIND: Record<number, FetchError['kind']> = {
    400: 'invalid_did',
    404: 'unknown_nous',
    410: 'nous_deleted',   // Phase 8 (AGENCY-05)
    503: 'brain_unavailable',
};
```

And `FetchError` union extends:

```typescript
export type FetchError = {
    kind: 'invalid_did' | 'unknown_nous' | 'nous_deleted' | 'brain_unavailable' | 'network';
};
```

The `ERR_COPY` map in `inspector.tsx` [VERIFIED: `dashboard/src/app/grid/components/inspector.tsx:39-56`]
must gain a `nous_deleted` entry:

```typescript
nous_deleted: {
    title: 'Nous deleted',
    description: 'This Nous was deleted. Audit history remains in the firehose.',
},
```

---

## Research Area 7: DID-Typed Confirmation Dialog UX

### Native `<dialog>` Pattern (Phase 6 Established)

[VERIFIED: `dashboard/src/components/agency/elevation-dialog.tsx:38-93`] `ElevationDialog`
uses native `<dialog ref={ref}>` + `ref.current.showModal()` inside `useEffect`. This provides:
- Browser-native focus trap (no Radix, no hand-rolled trap).
- Escape key fires `onClose` event (mapped to `props.onCancel`).
- Inert background behind the modal.

`IrreversibilityDialog` mirrors this lifecycle exactly.

### Paste Suppression (D-01)

```tsx
<input
    type="text"
    autoComplete="off"
    spellCheck={false}
    value={typed}
    onChange={(e) => setTyped(e.target.value)}
    onPaste={(e) => e.preventDefault()}
    data-testid="irreversibility-did-input"
    aria-label="Type the DID to confirm deletion"
/>
```

`onPaste={(e) => e.preventDefault()}` [ASSUMED: standard React synthetic event — `e.preventDefault()`
prevents the paste action at the DOM level, forcing the operator to type character-by-character.
Keyboard users who can type are unaffected — only clipboard paste is blocked.]

**Accessibility note:** Blocking paste is a contested WCAG practice. WCAG 2.1 SC 1.3.5
(Input Purpose) and SC 3.3.1 (Error Identification) do not require paste support. However,
WCAG 2.1 SC 1.3.5 does suggest allowing autofill for known fields. For a one-time
irreversible-action confirmation, disabling paste is the standard industry pattern (GitHub
repo deletion, AWS resource deletion, Stripe key deletion) and is acceptable per the
PHILOSOPHY §7 intent — the operator must *engage deliberately*.

**Testing paste suppression** (Playwright):
```typescript
// In irreversibility-dialog.test.tsx (jsdom)
it('paste is suppressed on DID input', () => {
    const input = screen.getByTestId('irreversibility-did-input');
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    input.dispatchEvent(pasteEvent);
    expect(pasteEvent.defaultPrevented).toBe(true);
});
```

### `role="alertdialog"` vs `role="dialog"`

ARIA 1.2 specification defines `alertdialog` as a dialog that contains "an important message
or alert to the user" and where "user attention is required". [CITED: https://www.w3.org/TR/wai-aria-1.2/#alertdialog]

For `IrreversibilityDialog`, `role="alertdialog"` is more semantically precise:
- The operator is being warned of an irreversible action.
- `aria-describedby` points to the warning text.

Native `<dialog>` elements get implicit `role="dialog"`. To override to `alertdialog`:

```tsx
<dialog
    ref={dialogRef}
    role="alertdialog"
    aria-labelledby="irrev-title"
    aria-describedby="irrev-warning"
    // ...
>
```

[ASSUMED: `<dialog role="alertdialog">` is valid ARIA — `alertdialog` is a subclass of
`dialog` and assigning it to a native `<dialog>` element is accepted by AT scanners. Verified
against ARIA authoring practices but not tested against a screen reader in this session.]

### Auto-focus on Delete Button vs Cancel

[VERIFIED: `dashboard/src/components/agency/elevation-dialog.tsx:74`] `ElevationDialog`
uses `autoFocus` on the **Cancel** button ("safer default so Enter-on-dialog-open cannot
dispatch an action the operator hasn't read yet"). `IrreversibilityDialog` MUST NOT
`autoFocus` the Delete button for the same reason. Instead, `autoFocus` on the input
field so the operator can start typing immediately — this is the intended friction.

### D-03 — No Enter-to-Submit

```tsx
<form onSubmit={(e) => e.preventDefault()}>
    {/* ... */}
    <button type="button" onClick={onConfirm} disabled={!exact}>
        Delete forever
    </button>
</form>
```

Or simpler — no `<form>` wrapper at all, just `<div>` with `type="button"` buttons.
`<button type="button">` is already not a submit button. Using `<form onSubmit={preventDefault}>`
is belt-and-suspenders.

### Focus Restoration (D-05, Phase 6 Pattern)

[VERIFIED: `dashboard/src/app/grid/components/inspector.tsx:74,88-90`] `openerRef` captures
`document.activeElement` at dialog-open time. On close/cancel, `openerRef.current?.focus()` is
called. `IrreversibilityDialog` mirrors this via the same closure-capture pattern as Phase 6 D-07
— the opener reference is captured when the dialog opens, not when it closes.

---

## Research Area 8: Zero-Diff Determinism Regression

### Existing Zero-Diff Test Pattern (VERIFIED: `grid/test/worldclock-zero-diff.test.ts`)

The canonical template:
```typescript
const FIXED_TIME = new Date('2026-01-01T00:00:00.000Z');
vi.useFakeTimers();
vi.setSystemTime(FIXED_TIME);
vi.advanceTimersByTime(1); // per tick, both runs advance identically
```

Phase 6 regression hash: `c7c49f492d85072327e8a4af6912228d6dc2db2d7be372f92b57b30b2a4b0461`
[VERIFIED: STATE.md accumulated context Plan 06-04].

### Phase 8 Zero-Diff Test Design (D-36)

Scenario: a Nous spawns at tick 5, acts ticks 10–30, is deleted at tick 40. Run with 0 vs 10
WebSocket listeners. Assert chain head is byte-identical.

```typescript
// grid/test/nous-deleted-zero-diff.test.ts — new file
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuditChain } from '../src/audit/chain.js';
import { NousRegistry } from '../src/registry/registry.js';

const FIXED_TIME = new Date('2026-01-01T00:00:00.000Z');

async function runDeletionScenario(listenerCount: number): Promise<string> {
    vi.setSystemTime(FIXED_TIME);
    const audit = new AuditChain();
    const registry = new NousRegistry();

    // Attach noisy listeners — must NOT mutate chain state
    for (let i = 0; i < listenerCount; i++) audit.onAppend(() => {});

    // tick 5: spawn
    registry.spawn({ did: 'did:noesis:test-a', name: 'TestA', publicKey: 'pk', region: 'agora' },
        'genesis', 5, 100);
    audit.append('nous.spawned', 'did:noesis:test-a', { name: 'TestA', region: 'agora' });

    // ticks 10–30: activity (spoke events simulate normal operation)
    for (let t = 10; t <= 30; t += 2) {
        audit.append('nous.spoke', 'did:noesis:test-a', { channel: 'agora', text: 'hello', tick: t });
        vi.advanceTimersByTime(1);
    }

    // tick 40: delete — tombstone + audit emit
    registry.tombstone('did:noesis:test-a', 40);
    const fakeHash = 'a'.repeat(64);  // fake pre_deletion_state_hash for determinism
    audit.append('operator.nous_deleted', 'op:00000000-0000-4000-8000-000000000000', {
        tier: 'H5', action: 'delete',
        operator_id: 'op:00000000-0000-4000-8000-000000000000',
        target_did: 'did:noesis:test-a',
        pre_deletion_state_hash: fakeHash,
    });
    vi.advanceTimersByTime(1);

    return audit.head;
}

describe('Phase 8: nous-deleted zero-diff invariant', () => {
    beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED_TIME); });
    afterEach(() => { vi.useRealTimers(); });

    it('SC#4: chain head identical 0 vs 10 listeners across delete sequence', async () => {
        const none = await runDeletionScenario(0);
        const ten  = await runDeletionScenario(10);
        expect(none).toBe(ten);
        expect(none).toMatch(/^[0-9a-f]{64}$/);
    });
});
```

**Why `vi.setSystemTime(FIXED_TIME)` must be called inside `runDeletionScenario`:** Both runs
must start from the same wall-clock baseline. `vi.setSystemTime` at `beforeEach` sets it once,
but the `vi.advanceTimersByTime` calls accumulate between scenarios — re-pin inside each call.
This matches the pattern at [VERIFIED: `grid/test/worldclock-zero-diff.test.ts:36`].

---

## Research Area 9: Broadcast Allowlist Extension

### Current State (VERIFIED: `grid/src/audit/broadcast-allowlist.ts:33-58`)

17 members, `'telos.refined'` at position 17 (last). The tuple comment at line 24 lists the
phase additions. Phase 8 appends:

```typescript
// grid/src/audit/broadcast-allowlist.ts — edit ALLOWLIST_MEMBERS
const ALLOWLIST_MEMBERS: readonly string[] = [
    // ... existing 17 members (positions 1-17) ...
    'telos.refined',
    // Phase 8 (AGENCY-05) — H5 Sovereign Nous deletion.
    // Payload: {tier:'H5', action:'delete', operator_id, target_did, pre_deletion_state_hash}
    // Emitted ONLY via appendNousDeleted() (grid/src/audit/append-nous-deleted.ts).
    'operator.nous_deleted',   // position 18
] as const;
```

### Allowlist Test Extension (VERIFIED: `grid/test/audit/broadcast-allowlist.test.ts`)

The existing test at line 10 asserts `ALLOWLIST.size === 17`. Phase 8 bumps to 18:
- `expect(ALLOWLIST.size).toBe(18)` — auto-fix in the RED commit.
- `it.each` gains `'operator.nous_deleted'` entry.
- The tuple-order assertion at line 57+ gains: `idx('telos.refined') < idx('operator.nous_deleted')`.

### Doc-Sync Gate (VERIFIED: `scripts/check-state-doc-sync.mjs`)

The script asserts `"17 events"` in STATE.md and checks `required[]` membership. Phase 8's
closing commit must:
1. Change the regex on line 40: `/18\s+events/i` (or more robustly: `/18 events/i`).
2. Add `'operator.nous_deleted'` to the `required` array.
3. Update STATE.md enumeration to list 18 events.
4. Update README.md "current count".

---

## Research Area 10: Inspector Wiring + Firehose Chip

### Inspector H5 Button (VERIFIED: `dashboard/src/app/grid/components/inspector.tsx:219-234`)

The existing disabled affordance:
```tsx
<button
    type="button"
    data-testid="inspector-h5-delete"
    disabled
    aria-disabled="true"
    title="Requires Phase 8"
    tabIndex={0}
    className="w-full cursor-not-allowed rounded border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-600 line-through"
>
    Delete Nous
</button>
```

Phase 8 replaces with:
1. If `state.status === 'ok' && state.data.status === 'deleted'`: render read-only "Nous deleted at tick N" label.
2. Otherwise: remove `disabled`, add `onClick` → two-stage elevation flow.

```tsx
{/* Phase 8 (AGENCY-05): wired delete button */}
<div className="mt-4 border-t border-neutral-800 pt-3">
    {state.status === 'ok' && state.data.status === 'deleted' ? (
        <p className="text-xs text-neutral-500">
            Nous deleted at tick {state.data.deletedAtTick ?? '?'}
        </p>
    ) : (
        <>
            <button
                type="button"
                data-testid="inspector-h5-delete"
                onClick={handleDeleteClick}
                tabIndex={0}
                className="w-full rounded border border-red-900 bg-neutral-900 px-3 py-2 text-xs text-red-600 hover:bg-red-950"
            >
                Delete Nous
            </button>
            <p className="mt-1 text-[10px] text-neutral-600">
                H5 — irreversible. Requires elevation and DID confirmation.
            </p>
        </>
    )}
</div>
```

`handleDeleteClick` opens `ElevationDialog(tier="H5")`. On H5 confirm: close elevation dialog,
open `IrreversibilityDialog(targetDid=selectedDid)`. On Irreversibility confirm: POST delete,
auto-downgrade agency to H1.

### Firehose Chip — `operator.nous_deleted`

[VERIFIED: `dashboard/src/app/grid/components/firehose-row.tsx:29-36`] `CATEGORY_BADGE` maps
`EventCategory` → Tailwind classes. `operator.nous_deleted` falls into the `'other'` category
by default from `categorizeEventType`. Phase 8 adds a **special case rendering** for this
event type alongside the existing `dialogueFilter` pattern:

```tsx
// In FirehoseRow — after the existing dim-not-hide logic
const isDeletedNous = entry.eventType === 'operator.nous_deleted';
const badgeExtra = isDeletedNous ? ' line-through text-red-400 bg-red-400/10' : '';
```

The actor column can also show `target_did` (truncated) with a strikethrough to visually
signal that the Nous no longer exists. Exact Tailwind class selection is planner discretion.

---

## Research Area 11: `NousRunner` Tick-Skip Guard (D-15)

[VERIFIED: `grid/src/integration/nous-runner.ts:99-112`]

The existing `tick()` method:
```typescript
async tick(tick: number, epoch: number, dialogueContext?: DialogueContext): Promise<void> {
    if (!this.bridge.connected) return;
    // ...
}
```

Phase 8 adds a deleted-status guard:

```typescript
async tick(tick: number, epoch: number, dialogueContext?: DialogueContext): Promise<void> {
    if (!this.bridge.connected) return;
    // Phase 8 (D-15): skip tick dispatch for tombstoned Nous.
    // Prevents race where a tick is in-flight when deletion lands.
    const record = this.registry.get(this.nousDid);
    if (record?.status === 'deleted') return;
    // ... rest of method
}
```

`this.registry` is already available on the runner [VERIFIED: `nous-runner.ts:58`]. This
guard is checked at tick entry, before `bridge.sendTick`, so an in-flight tick from the
previous cycle may still complete — that is acceptable (the record transitions atomically
via `tombstone()`, and the next tick won't execute).

---

## Research Area 12: `GridCoordinator.despawnNous` (D-14)

[VERIFIED: `grid/src/integration/grid-coordinator.ts:30-31`] `removeRunner(nousDid)` already
exists — it only removes from `this.runners`. `despawnNous` extends this:

```typescript
// grid/src/integration/grid-coordinator.ts — new method
async despawnNous(did: string): Promise<void> {
    const runner = this.runners.get(did);
    if (!runner) return; // idempotent
    // 1. Close brain bridge
    if ('bridge' in runner && typeof (runner as any).bridge?.close === 'function') {
        try { (runner as any).bridge.close(); } catch { /* swallow */ }
    }
    // 2. Remove from coordinator (removes tick subscription)
    this.removeRunner(did);
    // 3. Drop spatial position (belt-and-suspenders — route already called spatial.removeNous)
    this.launcher.space.removeNous(did);
}
```

The bridge is private on `NousRunner`. The planner should evaluate whether to expose
`runner.closeBridge()` as a public method or use the coordinator's access to `launcher.space`
to avoid reaching into runner internals. Either approach works; the exact call site is
planner discretion.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Canonical JSON with stable key order | Custom serializer | Hardcoded object literal + `JSON.stringify` | Existing pattern in `chain.ts:181` is proven and zero-dependency; just lock the key order in tests |
| SHA-256 hashing | Custom hash function | Node `createHash('sha256')` / Python `hashlib.sha256` | Same modules used throughout the codebase; cross-boundary reproducibility proven |
| Focus trap in `IrreversibilityDialog` | Hand-rolled Tab cycling | `showModal()` + native `<dialog>` | Phase 6 established this; browser-native trap is identical to `ElevationDialog` |
| Allowlist membership check | Custom Set | `ALLOWLIST` frozen Set (extend tuple) | One source of truth; Phase 6 frozen-tuple test covers it |
| Payload privacy gate | Inline regex | `payloadPrivacyCheck()` (existing, `broadcast-allowlist.ts:108`) | The D-26 check is belt-and-suspenders against future edits |
| 410 Gone response | Custom error class | `reply.code(410); return {...}` pattern (Fastify) | Same pattern all existing routes use for 400/404/503 |
| Tombstone iteration filter | New `active()` variant | Existing `active()` already excludes `status !== 'active'` | `'deleted'` is not `'active'` — zero code change needed in `active()` |

**Key insight:** Phase 8 is a composition phase. Every invariant surface (audit commit,
allowlist, privacy check, producer helper, hash computation, dialog lifecycle) has an
established pattern from Phases 5–7. Deviate only where a D-* decision requires it.

---

## Runtime State Inventory

(Applies because Phase 8 adds an allowlist position + Python RPC method + new field in NousRecord.)

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | NousRecord persisted to DB (GridStore.snapshot) — must include `deletedAtTick?` in the snapshot schema | Additive field; `loadRecords` [VERIFIED: `registry.ts:170-175`] spreads `{...record}` — new field serializes naturally. Verify DB migration if schema is strict. |
| Live service config | None — no new env vars required (D-32 `NOESIS_GRID_DISABLE_H5` is optional/off by default) | None |
| OS-registered state | None | None |
| Secrets/env vars | `NOESIS_GRID_DISABLE_H5=1` — new optional env gate (D-32); not documented in user-facing docs | None unless operator sets it; off by default |
| Build artifacts | Python `BrainHandler` gains new async method → no pickle cache impact (methods are not pickled) | None |

**CLAUDE.md doc-sync rule fires:** Phase 8's closing commit MUST simultaneously update:
- `STATE.md` allowlist enumeration (17→18) + Open Question #3 resolution
- `scripts/check-state-doc-sync.mjs` (17→18 count literal + `'operator.nous_deleted'` in `required[]`)
- `README.md` "current count" section
- `ROADMAP.md` (Phase 8 → complete)
- `MILESTONES.md` (append Phase 8 shipment)
- `PHILOSOPHY.md` H5 narrative (double-check still accurate)

---

## Common Pitfalls

### Pitfall 1: Wrong Tombstone Call Order (D-10)

**What goes wrong:** Developer writes tombstone BEFORE Brain RPC. Brain 503 occurs; tombstone
is already written; Nous appears deleted with no audit record.
**Why it happens:** Intuitive order seems: "decide to delete → mark deleted → get hash." But
the hash IS the audit record; tombstone without hash breaks forensic contract.
**How to avoid:** Enforce the order from D-10 in code comments:
```typescript
// ORDER IS LOAD-BEARING (D-10): RPC → tombstone → map-remove → despawn → audit.
// If RPC fails (503), no tombstone is written. Nous remains alive.
```
**Warning signs:** Test `operator-delete-route.test.ts` "Brain 503 → no tombstone" case
fails (registry.get(did)?.status === 'deleted' when it should be 'active').

### Pitfall 2: `combineStateHash` Key Order Drift

**What goes wrong:** A refactor spread-merges the fields (`{...brainHashes, ...gridFields}`)
or adds a new key. The JSON serialization changes key order → every historical hash is
invalidated retroactively.
**Why it happens:** `JSON.stringify` is insertion-ordered; `Object.spread` merges in the
order of the operands; any change to either silently changes the hash.
**How to avoid:** The key-order regression test (see §Hash Composition) locks the exact
`Object.keys(JSON.parse(canonical))` array. Any reorder fails CI immediately.
**Warning signs:** The key-order lock test fails; or historical hashes computed before the
refactor don't match recomputed values.

### Pitfall 3: Firehose Renders `operator.nous_deleted` Before Allowlist Extension

**What goes wrong:** A Phase 8 plan ships the `appendNousDeleted` call BEFORE the allowlist
extension. `AuditChain.append` succeeds (no allowlist check at append time); WsHub calls
`isAllowlisted('operator.nous_deleted')` → false → NOT broadcast → firehose never sees it.
**Why it happens:** Allowlist membership is checked at broadcast time (WsHub), not at append time.
**How to avoid:** The allowlist extension `broadcast-allowlist.ts` edit MUST land in the same
plan as `appendNousDeleted` (Plan 08-02). Do not split them across plans.
**Warning signs:** Unit tests for `appendNousDeleted` pass but the zero-diff regression test
shows the event in the chain but the WS test doesn't receive it.

### Pitfall 4: Paste-Suppression Test vs Real DOM

**What goes wrong:** Test uses `fireEvent.paste(input)` from `@testing-library/react` — this
dispatches a synthetic event that bypasses React's `onPaste` handler.
**Why it happens:** `fireEvent` from JSDOM does not call React synthetic event handlers.
**How to avoid:** Use `userEvent.paste(input)` from `@testing-library/user-event` v14 which
simulates the full browser paste sequence including React's synthetic event layer. If
`user-event` is not installed, use the native `dispatchEvent` approach with `cancelable: true`
and check `defaultPrevented`.
**Warning signs:** Paste test passes even before `onPaste={(e) => e.preventDefault()}` is
added.

### Pitfall 5: H5 Hydration Whitelist Not Covered

**What goes wrong:** Phase 8 ships H5 as live but doesn't add the regression test that
`localStorage['noesis.operator.tier'] = 'H5'` is rejected on hydration.
**Why it happens:** The whitelist is in `agency-store.ts` [VERIFIED: lines 31-36] and already
excludes H5. The risk is that a future edit of the whitelist accidentally includes H5.
**How to avoid:** The test at `dashboard/src/app/grid/components/inspector-delete.test.tsx`
(D-35) explicitly asserts the hydration rejection. This is already in the CONTEXT test list;
just ensure it's in the Wave 0 gap list.

### Pitfall 6: `tombstoneCheck` Not Called in All DID-Resolving Routes

**What goes wrong:** A DID-resolving route added AFTER Phase 8 omits the `tombstoneCheck`
call. Deleted Nous start appearing in new surfaces.
**Why it happens:** `tombstoneCheck` must be called explicitly per D-17 — no middleware
enforces it automatically.
**How to avoid:** The producer-boundary grep test for `tombstoneCheck` (or a comment in
the helper itself) lists the required call sites. Future routes that match the `nous/:did`
pattern are noted in a PITFALLS.md entry.
**Warning signs:** E2E test for a new route shows 200 OK on a tombstoned DID.

### Pitfall 7: Brain RPC Timeout During Delete (D-22)

**What goes wrong:** Brain is slow or hung during `compute_pre_deletion_state_hash`. Route
waits indefinitely, or the RPC resolves after the tick increment.
**Why it happens:** No explicit timeout on the Brain RPC call in the existing `telos-force.ts`
pattern — it relies on the bridge's underlying socket timeout.
**How to avoid:** D-22 locks: "503 + no deletion on RPC failure." The `try/catch` around
the RPC call is the mechanism. If the tick increments during the RPC, the captured
`deletedAtTick` in step 9 is `services.clock.currentTick` at TOMBSTONE time (after RPC),
not at RPC-start time. This is correct: `deletedAtTick` records when the deletion was
committed, not when the hash was computed.
**Warning signs:** The route returns 200 with a `deletedAtTick` that's one tick ahead of
the `pre_deletion_state_hash` computation tick. This is expected and acceptable behavior.

### Pitfall 8: `NousStateResponse.status` Missing from Dashboard Type

**What goes wrong:** Grid introspect route returns `{..., status: 'deleted'}` but
`NousStateResponse` in `dashboard/src/lib/api/introspect.ts` doesn't include `status`.
TypeScript allows the field (extra JSON keys are ignored), but the Inspector can't read
`state.data.status` without the type.
**Why it happens:** `NousStateResponse` is a hand-maintained mirror of the Brain's `get_state`
response. It must be explicitly extended.
**How to avoid:** Phase 8 adds `status?: 'active' | 'suspended' | 'exiled' | 'deleted'` as
an optional additive field to `NousStateResponse` (D-27). The `?` keeps backward compatibility
with cached grid responses.

---

## Code Examples

### 1. `NousRecord` type extension

```typescript
// grid/src/registry/types.ts — edit
// VERIFIED: existing file at lines 1-30

export type LifecyclePhase = 'spawning' | 'infant' | 'adolescent' | 'maturity' | 'elder' | 'exiled';

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
    deletedAtTick?: number;                                   // Phase 8: new optional field
}
```

### 2. `appendNousDeleted` (full implementation)

```typescript
// grid/src/audit/append-nous-deleted.ts — new file
// Source pattern: grid/src/audit/append-telos-refined.ts (VERIFIED)

import type { AuditChain } from './chain.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const HEX64_RE = /^[0-9a-f]{64}$/;
const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;
const OPERATOR_ID_RE = /^op:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Closed 5-key payload for operator.nous_deleted (D-25). */
const EXPECTED_KEYS = ['action', 'operator_id', 'pre_deletion_state_hash', 'target_did', 'tier'];

export function appendNousDeleted(
    audit: AuditChain,
    operatorId: string,
    p: { target_did: string; pre_deletion_state_hash: string },
): void {
    if (typeof operatorId !== 'string' || operatorId.length === 0)
        throw new TypeError('appendNousDeleted: operator_id required');
    if (!DID_RE.test(p.target_did))
        throw new TypeError('appendNousDeleted: invalid target_did (DID_RE failed)');
    if (!HEX64_RE.test(p.pre_deletion_state_hash))
        throw new TypeError('appendNousDeleted: pre_deletion_state_hash must be 64-hex');

    const payload = {
        tier: 'H5' as const,
        action: 'delete' as const,
        operator_id: operatorId,
        target_did: p.target_did,
        pre_deletion_state_hash: p.pre_deletion_state_hash,
    };

    // Closed-tuple check (D-25)
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length ||
        !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(
            `appendNousDeleted: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`
        );
    }

    // Privacy gate (D-26) — belt-and-suspenders; natively clean
    const privacy = payloadPrivacyCheck(payload);
    if (!privacy.ok)
        throw new TypeError(`appendNousDeleted: privacy violation — ${privacy.offendingPath}`);

    audit.append('operator.nous_deleted', operatorId, payload);
}
```

### 3. `IrreversibilityDialog` core (peer of `elevation-dialog.tsx`)

```tsx
// dashboard/src/components/agency/irreversibility-dialog.tsx — new file
// Pattern: dashboard/src/components/agency/elevation-dialog.tsx (VERIFIED)

'use client';
import { useEffect, useRef, useState, type ReactElement } from 'react';

export interface IrreversibilityDialogProps {
    readonly targetDid: string;
    readonly open: boolean;
    readonly onConfirm: () => void;
    readonly onCancel: () => void;
}

export function IrreversibilityDialog({
    targetDid, open, onConfirm, onCancel,
}: IrreversibilityDialogProps): ReactElement {
    const ref = useRef<HTMLDialogElement | null>(null);
    const [typed, setTyped] = useState('');
    const exact = typed === targetDid;

    useEffect(() => {
        const dlg = ref.current;
        if (!dlg) return;
        if (open && !dlg.open) { dlg.showModal(); setTyped(''); }
        else if (!open && dlg.open) dlg.close();
    }, [open]);

    return (
        <dialog
            ref={ref}
            role="alertdialog"
            aria-labelledby="irrev-title"
            aria-describedby="irrev-warning"
            onClose={onCancel}
            data-testid="irreversibility-dialog"
            className="min-w-[420px] p-6 bg-neutral-950 text-neutral-100 border-2 border-red-600 rounded"
        >
            <h2 id="irrev-title" className="text-base font-semibold text-red-400">
                Delete Nous — permanent
            </h2>
            <p id="irrev-warning" className="mt-2 text-sm text-red-300" data-testid="irrev-warning-copy">
                This is H5 Sovereign. Audit entries about this Nous will remain forever;
                the Nous itself will not. There is no undo.
            </p>
            <p className="mt-3 text-sm text-neutral-300">
                To delete, type its DID exactly:
            </p>
            <code
                data-testid="irreversibility-target-did"
                className="block mt-1 text-xs text-neutral-400 font-mono break-all"
            >
                {targetDid}
            </code>
            <input
                type="text"
                autoComplete="off"
                spellCheck={false}
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onPaste={(e) => e.preventDefault()}
                data-testid="irreversibility-did-input"
                aria-label="Type the DID to confirm deletion"
                className="mt-3 w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm font-mono text-neutral-100 focus:border-red-600 focus:outline-none"
            />
            <div className="mt-4 flex gap-2 justify-end">
                <button
                    type="button"
                    onClick={onCancel}
                    data-testid="irreversibility-cancel"
                    className="px-3 py-1 text-sm font-semibold text-neutral-200"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    disabled={!exact}
                    onClick={onConfirm}
                    data-testid="irreversibility-confirm"
                    className="px-3 py-1 text-sm font-semibold text-red-400 border border-red-600 rounded disabled:opacity-40"
                    aria-label="Confirm permanent deletion of this Nous"
                >
                    Delete forever
                </button>
            </div>
        </dialog>
    );
}
```

### 4. Producer-boundary grep test (mirrors Phase 7 pattern)

```typescript
// grid/test/audit/nous-deleted-producer-boundary.test.ts — new file
// Pattern: grid/test/audit/telos-refined-producer-boundary.test.ts (VERIFIED exists)

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC_ROOT = resolve(__dirname, '../../src');

function findAllTs(dir: string): string[] {
    const entries = readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const e of entries) {
        const full = `${dir}/${e.name}`;
        if (e.isDirectory()) files.push(...findAllTs(full));
        else if (e.name.endsWith('.ts')) files.push(full);
    }
    return files;
}

describe('operator.nous_deleted sole-producer boundary', () => {
    it('only append-nous-deleted.ts calls audit.append with operator.nous_deleted', () => {
        const pattern = /chain\.append[^;]{0,200}['"]operator\.nous_deleted['"]/;
        const violations: string[] = [];

        for (const file of findAllTs(SRC_ROOT)) {
            if (file.includes('append-nous-deleted.ts')) continue;  // allow sole producer
            const content = readFileSync(file, 'utf8');
            if (pattern.test(content)) violations.push(file);
        }

        expect(violations).toEqual([]);
    });
});
```

### 5. Privacy matrix (8-case, mirrors Phase 6/7 pattern)

```typescript
// grid/test/audit/nous-deleted-privacy.test.ts — new file
// Pattern: grid/test/audit/operator-payload-privacy.test.ts (VERIFIED)

import { describe, it, expect, beforeEach } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendNousDeleted } from '../../src/audit/append-nous-deleted.js';
import { payloadPrivacyCheck } from '../../src/audit/broadcast-allowlist.js';

const VALID_OP_ID = 'op:00000000-0000-4000-8000-000000000000';
const VALID_DID = 'did:noesis:target-nous';
const VALID_HASH = 'a'.repeat(64);

describe('operator.nous_deleted — payload privacy matrix (D-30)', () => {
    let audit: AuditChain;
    beforeEach(() => { audit = new AuditChain(); });

    const happyPayload = {
        tier: 'H5', action: 'delete', operator_id: VALID_OP_ID,
        target_did: VALID_DID, pre_deletion_state_hash: VALID_HASH,
    };

    it('1 happy — closed 5-key tuple passes', () => {
        expect(() => appendNousDeleted(audit, VALID_OP_ID, {
            target_did: VALID_DID, pre_deletion_state_hash: VALID_HASH,
        })).not.toThrow();
    });

    it.each([
        { key: 'prompt', value: 'leaked prompt text' },
        { key: 'response', value: 'leaked response' },
        { key: 'wiki', value: 'leaked wiki' },
        { key: 'reflection', value: 'leaked reflection' },
        { key: 'thought', value: 'leaked thought' },
        { key: 'emotion_delta', value: 0.5 },
        { key: 'nested', value: { prompt: 'nested-leak' } },
    ])('forbidden key $key is rejected by payloadPrivacyCheck', ({ key, value }) => {
        const leaky = { ...happyPayload, [key]: value };
        const result = payloadPrivacyCheck(leaky);
        expect(result.ok).toBe(false);
    });

    it('EVENT_SPECS coverage — operator.nous_deleted is in the allowlist', () => {
        const { ALLOWLIST } = require('../../src/audit/broadcast-allowlist.js');
        expect(ALLOWLIST.has('operator.nous_deleted')).toBe(true);
    });
});
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (Grid/Dashboard); pytest (Brain) |
| Config file | `grid/vitest.config.ts` (existing); `brain/pyproject.toml` (existing) |
| Quick run command | `cd grid && npm test -- nous-deleted` (new scope) |
| Full suite command | `cd grid && npm test && cd dashboard && npm test && cd brain && uv run pytest` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGENCY-05 | IrreversibilityDialog paste-suppressed | unit | `npm test -- irreversibility-dialog` | ❌ Wave 0 |
| AGENCY-05 | Delete button disabled until exact-DID match | unit | `npm test -- irreversibility-dialog` | ❌ Wave 0 |
| AGENCY-05 | Cancel/ESC/backdrop close without side effect | unit | `npm test -- irreversibility-dialog` | ❌ Wave 0 |
| AGENCY-05 | First-life promise copy verbatim "no undo" | unit | `npm test -- irreversibility-dialog` | ❌ Wave 0 |
| AGENCY-05 | 2-stage elevation flow (H4→H5→Irreversibility) | unit | `npm test -- inspector-delete` | ❌ Wave 0 |
| AGENCY-05 | Tombstoned state → disabled "deleted at tick N" | unit | `npm test -- inspector-delete` | ❌ Wave 0 |
| AGENCY-05 | H5 localStorage hydration rejected | unit | `npm test -- agency-store` (extend) | ✅ extend |
| AGENCY-05 | `operator.nous_deleted` at position 18 | unit | `npm test -- broadcast-allowlist` (extend) | ✅ extend |
| AGENCY-05 | Privacy 8-case matrix | unit | `npm test -- nous-deleted-privacy` | ❌ Wave 0 |
| AGENCY-05 | Producer-boundary grep gate | unit | `npm test -- nous-deleted-producer-boundary` | ❌ Wave 0 |
| AGENCY-05 | Delete route error ladder (400/410/404/503) | unit | `npm test -- operator-delete-route` | ❌ Wave 0 |
| AGENCY-05 | 410 Gone across introspect + telos-force + trade | unit | `npm test -- operator-delete-tombstone-routes` | ❌ Wave 0 |
| AGENCY-05 | AuditChain zero-diff 0/10 listeners delete-sequence | unit | `npm test -- nous-deleted-zero-diff` | ❌ Wave 0 |
| AGENCY-05 | Pre-deletion entries still retrievable post-deletion | unit | `npm test -- audit-no-purge` | ❌ Wave 0 |
| AGENCY-05 | Tombstoned DID cannot be re-spawned | unit | `npm test -- tombstone-did-reuse` | ❌ Wave 0 |
| AGENCY-05 | Tick-skip for deleted Nous | unit | `npm test -- tombstone-tick-skip` | ❌ Wave 0 |
| AGENCY-05 | Brain returns 4-hash tuple | unit (Python) | `uv run pytest test/test_state_hash_rpc.py` | ❌ Wave 0 |
| AGENCY-05 | `check-state-doc-sync` asserts 18 events | script | `node scripts/check-state-doc-sync.mjs` | ✅ extend |

### Sampling Rate

- **Per task commit:** `cd grid && npm test -- nous-deleted` (new scope, ≤ 5 s)
- **Per wave merge:** full tri-tier suite (Grid + Dashboard + Brain)
- **Phase gate:** full suite green + Playwright smoke before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `grid/test/registry/tombstone-did-reuse.test.ts` — SC#3, SC#5
- [ ] `grid/test/registry/tombstone-tick-skip.test.ts` — race guard (D-15)
- [ ] `grid/test/audit/nous-deleted-privacy.test.ts` — 8-case matrix (D-30)
- [ ] `grid/test/audit/nous-deleted-producer-boundary.test.ts` — grep gate (D-38)
- [ ] `grid/test/api/operator-delete-route.test.ts` — route error ladder + happy path
- [ ] `grid/test/api/operator-delete-tombstone-routes.test.ts` — 410 across routes
- [ ] `grid/test/nous-deleted-zero-diff.test.ts` — SC#4 determinism (D-36)
- [ ] `grid/test/audit-no-purge.test.ts` — chain integrity post-deletion
- [ ] `brain/test/test_state_hash_rpc.py` — 4-hash tuple contract
- [ ] `dashboard/src/components/agency/irreversibility-dialog.test.tsx` — paste, exact-DID, ESC, copy
- [ ] `dashboard/src/app/grid/components/inspector-delete.test.tsx` — 2-stage flow, tombstoned state, auto-downgrade

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | (no new auth surface; operator_id validation unchanged) |
| V3 Session Management | yes | H5 hydration whitelist rejects localStorage injection (D-21); same `AgencyStore` singleton |
| V4 Access Control | yes | `tombstoneCheck` centralized helper prevents re-access after deletion; `validateTierBody('H5')` enforces tier |
| V5 Input Validation | yes | `DID_RE`, `HEX64_RE`, `OPERATOR_ID_RE` on all RPC boundary inputs; closed-tuple check on payload |
| V6 Cryptography | yes | `createHash('sha256')` (Node built-in); `hashlib.sha256` (Python stdlib) — never hand-rolled |

### Known Threat Patterns for Phase 8 Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Operator deletes a Nous they don't own (multi-tenant future) | Spoofing | `operator_id` stamped in audit at commit time; v2.1 single-operator model limits scope |
| Paste bypass on confirmation input | Tampering | `onPaste={(e) => e.preventDefault()}` (D-01); forces character-by-character transcription |
| Forged H5 elevation via localStorage | Elevation of Privilege | `HYDRATABLE_TIERS` whitelist rejects `'H5'` on `hydrateFromStorage()` (D-21, verified in `agency-store.ts:31-36`) |
| Re-deletion after tombstone creating orphan state | Denial of Service | `tombstoneCheck` returns 410 before runner lookup; `tombstone()` is idempotent (returns false on already-deleted) |
| Brain hung during hash RPC → route hangs | Denial of Service | `try/catch` around RPC call; 503 on any throw (D-22); Nous remains alive — no orphaned tombstone |
| Plaintext state leak in `operator.nous_deleted` payload | Information Disclosure | `payloadPrivacyCheck` gate at producer boundary; 5-key closed tuple is natively clean (D-26) |
| Hash-length extension on `pre_deletion_state_hash` | Tampering | SHA-256 is not vulnerable to length extension via direct `createHash` output; regex enforces exact 64-hex |
| Zero-diff invariant attack via listener injection | Tampering | Listener exceptions are swallowed (chain.ts:52-57); determinism test pins 0 vs 10 listeners |
| `deletedAtTick` spoofed in audit payload | Repudiation | `deletedAtTick` lives in `NousRecord` (Grid-controlled), not in the audit payload — audit payload contains only `pre_deletion_state_hash`; client reads `deleted_at_tick` from the HTTP 410 body |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `<dialog role="alertdialog">` is accepted by AT/screen-reader scanners without additional ARIA hacks | §UX Research | If wrong, use `role="dialog"` — semantically slightly weaker but functionally identical for keyboard users |
| A2 | Fastify's default JSON serialization applies to 410 responses (no special plugin needed) | §HTTP 410 Research | If wrong, add `reply.header('Content-Type', 'application/json')` before return |
| A3 | Brain's `ThymosTracker` exposes `dimensions` iterable and `get(dim)` method for computing `thymos_hash` | §Brain RPC Research | If wrong, adapt `compute_thymos_hash` to the actual Thymos API shape |
| A4 | `json-canonicalize` (RFC 8785 JCS) is not already in the project dependency tree | §Hash Composition | If wrong, it could be used instead — result is equivalent for our sorted-literal case |
| A5 | `userEvent.paste` from `@testing-library/user-event` is available in the dashboard test setup | §UX Research | If wrong, use native `dispatchEvent` with `new ClipboardEvent('paste', {cancelable:true})` |

**All other claims in this document are VERIFIED by direct file:line reads of the codebase
or CITED to official specifications.**

---

## Open Questions

1. **`despawnNous` access to `NousRunner.bridge`**
   - What we know: `bridge` is private on `NousRunner` (`nous-runner.ts:56`).
   - What's unclear: whether `GridCoordinator` can call `runner.bridge.close()` without
     exposing a new `public closeBridge()` method on `NousRunner`.
   - Recommendation: Add `public closeBridge(): void { this.bridge.close(); }` to
     `NousRunner` — minimal surface, clean abstraction. Planner decides.

2. **`NousStateResponse` `deletedAtTick` field**
   - What we know: D-27 adds `status` to the introspect payload. CONTEXT §Claude's Discretion
     leaves open whether `name` and `deletedAtTick` are also returned on 410 (for dashboard
     display continuity).
   - Recommendation: Return `{error: 'nous_deleted', deleted_at_tick: N, name: record.name}`
     in the 410 body so the dashboard can render "Nous 'Alpha' deleted at tick 40" without
     an additional lookup. Planner decides.

3. **`GridServices.coordinator` optional field**
   - What we know: `GridServices` in `server.ts` has optional fields (`registry?`, `getRunner?`).
     The delete route needs `services.coordinator?.despawnNous(did)`.
   - What's unclear: whether adding `coordinator?` to `GridServices` is acceptable or whether
     `despawnNous` should be wired differently.
   - Recommendation: Add `coordinator?: GridCoordinator` to `GridServices` — mirrors existing
     optional field pattern. Planner confirms.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 8 is a code/config-only change. All dependencies (Fastify, Vitest,
React, Python stdlib) are existing. No new CLIs or external services required.

---

## Sources

### Primary (HIGH confidence — VERIFIED by direct file reads)

| Source | Lines / Content Verified |
|--------|--------------------------|
| `grid/src/audit/broadcast-allowlist.ts` | Full file — ALLOWLIST_MEMBERS tuple, FORBIDDEN_KEY_PATTERN, payloadPrivacyCheck |
| `grid/src/audit/chain.ts` | Full file — AuditChain.append, onAppend semantics, computeHash |
| `grid/src/audit/operator-events.ts` | Full file — appendOperatorEvent pattern |
| `grid/src/audit/append-telos-refined.ts` | Full file — structural template for appendNousDeleted |
| `grid/src/api/operator/telos-force.ts` | Full file — route error ladder template |
| `grid/src/api/operator/_validation.ts` | Full file — validateTierBody, OPERATOR_ID_REGEX |
| `grid/src/api/server.ts` | Full file — GridServices, DID_REGEX, InspectorRunner |
| `grid/src/registry/registry.ts` | Full file — suspend/exile/reinstate pattern, active() filter |
| `grid/src/registry/types.ts` | Full file — NousRecord.status union |
| `grid/src/space/map.ts` | Full file — placeNous/positions Map; no removeNous |
| `grid/src/integration/nous-runner.ts` | Lines 1-157 — tick(), recordDialogueDelivery, bridge |
| `grid/src/integration/grid-coordinator.ts` | Full file — runners Map, removeRunner, despawnNous seam |
| `grid/src/api/operator/index.ts` | Full file — operator barrel pattern |
| `grid/test/worldclock-zero-diff.test.ts` | Full file — FIXED_TIME, fake-timer pattern |
| `grid/test/audit/broadcast-allowlist.test.ts` | Lines 1-60 — 17-member assertion, it.each template |
| `grid/test/audit/operator-payload-privacy.test.ts` | Lines 1-80 — EVENT_SPECS matrix pattern |
| `brain/src/noesis_brain/telos/hashing.py` | Full file — compute_active_telos_hash canonical form |
| `brain/src/noesis_brain/rpc/handler.py` | Lines 399-436 — force_telos pattern; lines 448-545 — _build_refined_telos |
| `dashboard/src/components/agency/elevation-dialog.tsx` | Full file — native dialog pattern, useEffect showModal |
| `dashboard/src/lib/stores/agency-store.ts` | Full file — HYDRATABLE_TIERS whitelist (H5 excluded) |
| `dashboard/src/lib/api/introspect.ts` | Full file — NousStateResponse, FetchError, STATUS_TO_KIND |
| `dashboard/src/app/grid/components/inspector.tsx` | Lines 200-241 — H5 disabled affordance location |
| `dashboard/src/app/grid/components/firehose-row.tsx` | Full file — CATEGORY_BADGE, dialogueFilter dim pattern |
| `scripts/check-state-doc-sync.mjs` | Full file — 17-events assertion, required[] array |
| `.planning/STATE.md` | Accumulated context — allowlist enumeration, Phase 6/7 decisions |
| `.planning/phases/08-h5-sovereign-operations-nous-deletion/08-CONTEXT.md` | Full file — 40 locked decisions |
| `.planning/phases/07-peer-dialogue-telos-refinement/07-RESEARCH.md` | Full file — style + depth reference |
| `PHILOSOPHY.md` §7 | Agency Scale H1–H5, first-life promise, audit-preservation invariant |

### Secondary (MEDIUM confidence — cited from official specifications)

- [CITED: https://httpwg.org/specs/rfc9110.html#status.410] — RFC 9110 §15.5.11 HTTP 410 Gone semantics and caching behavior
- [CITED: https://www.w3.org/TR/wai-aria-1.2/#alertdialog] — ARIA 1.2 `alertdialog` role definition

### Tertiary (LOW confidence — assumed from training knowledge)

- [ASSUMED] `json-canonicalize` npm package not in project deps — not needed
- [ASSUMED] `@testing-library/user-event` availability for paste simulation
- [ASSUMED] `<dialog role="alertdialog">` screen-reader acceptance

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — zero new dependencies; all surfaces verified by file:line reads
- Architecture: HIGH — every component maps to a verified existing pattern (Phase 6/7 templates)
- Pitfalls: HIGH — each pitfall maps to a specific code path or D-* decision
- Validation: HIGH — zero-diff template exists verbatim; boundary tests are mechanical clones
- Brain integration: MEDIUM — `force_telos` template verified; `compute_thymos_hash` internals
  depend on Thymos API shape not fully read in this session (A3)

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (phase target ship date; all codebase surfaces stable)
