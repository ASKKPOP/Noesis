# Phase 6: Operator Agency Foundation (H1–H4) - Pattern Map

**Mapped:** 2026-04-21
**Files analyzed:** 22 files (9 new grid/brain, 8 new dashboard, 5 test files)
**Analogs found:** 20 / 22

---

## File Classification

### Grid / Brain (server-side, TypeScript + Python)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `grid/src/audit/broadcast-allowlist.ts` (EXTEND) | config | n/a (constant tuple) | same file (extend in place) | exact |
| `grid/src/audit/operator-events.ts` (NEW) | utility | request-response (validator) | `grid/src/audit/broadcast-allowlist.ts` (`payloadPrivacyCheck`) | role-match |
| `grid/src/audit/chain.ts` (no change — `append()` reused as-is) | model | append-only event log | same file | exact |
| `grid/src/api/operator/memory-query.ts` (NEW) | controller | request-response → RPC proxy | `grid/src/api/server.ts` lines 152–181 (`GET /api/v1/nous/:did/state`) | exact |
| `grid/src/api/operator/clock-pause-resume.ts` (NEW) | controller | request-response | same as above + new `WorldClock.pause/resume()` | exact |
| `grid/src/api/operator/governance-laws.ts` (NEW) | controller | CRUD (POST/PUT/DELETE) | `grid/src/api/server.ts` lines 244–255 (laws GET handlers) + `LogosEngine.addLaw/removeLaw` | role-match |
| `grid/src/api/operator/telos-force.ts` (NEW) | controller | request-response → RPC proxy → hash-diff | `grid/src/api/server.ts` lines 152–181 (inspector proxy shape) | exact |
| `grid/src/api/types.ts` (EXTEND) | model | type declarations | same file | exact |
| `grid/src/clock/ticker.ts` (EXTEND) | service | event-driven emitter | same file (add `pause()`/`resume()` mirroring `start()`/`stop()` lines 29–40) | exact |
| `grid/src/logos/engine.ts` (EXTEND) | service | in-memory map ops | same file (add `amendLaw` mirroring `addLaw/removeLaw` lines 16–22) | exact |
| `protocol/src/noesis/bridge/brain-bridge.ts` (EXTEND) | service | JSON-RPC client | same file lines 37–64 (`sendMessage`, `getState`) | exact |
| `protocol/src/noesis/bridge/types.ts` (EXTEND) | model | RPC param shapes | same file | exact |
| `grid/src/integration/types.ts` (EXTEND `IBrainBridge`) | model | interface | same file lines 87–93 | exact |
| `brain/src/noesis_brain/rpc/handler.py` (EXTEND) | controller | RPC handler | same file lines 54–110 (`on_message`) + 135–167 (`get_state`) | exact |
| `brain/src/noesis_brain/__main__.py` (EXTEND registrations) | config | RPC wiring | same file lines 183–191 | exact |
| `grid/src/main.ts` (EXTEND) | config | service composition | same file lines 111–124 (buildServer wiring) | exact |

### Dashboard (client-side, TypeScript/React)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `dashboard/src/lib/protocol/agency-types.ts` (NEW) | model | type declarations | `dashboard/src/lib/protocol/audit-types.ts` | exact |
| `dashboard/src/lib/stores/agency-store.ts` (NEW) | store | client state + localStorage | `dashboard/src/lib/stores/selection-store.ts` (subscribe/getSnapshot pattern) + `dashboard/src/lib/hooks/use-hash-sync.ts` (storage-read pattern) | role-match |
| `dashboard/src/components/agency/agency-indicator.tsx` (NEW) | component | read-only render | `dashboard/src/components/primitives/chip.tsx` (visual primitive) + tooltip idiom from Inspector | role-match |
| `dashboard/src/components/agency/elevation-dialog.tsx` (NEW) | component | modal dialog | `dashboard/src/app/grid/components/inspector.tsx` lines 112–153 (focus-trap / ESC pattern; but elevation uses native `<dialog>`) | partial |
| `dashboard/src/hooks/use-elevated-action.ts` (NEW) | hook | closure-capture race-safe dispatcher | `dashboard/src/lib/hooks/use-hash-sync.ts` lines 45–79 (ref-guarded lifecycle) | partial |
| `dashboard/src/lib/api/operator.ts` (NEW) | utility | fetch wrapper | `dashboard/src/lib/api/introspect.ts` lines 56–81 (fetchNousState) | exact |
| `dashboard/src/app/layout.tsx` (EXTEND) | config | root layout mount | same file | exact |
| `dashboard/src/app/grid/grid-client.tsx` (EXTEND — Inspector H5 button wiring) | component | UI mount | same file lines 169–220 | exact |
| `dashboard/src/app/grid/components/inspector.tsx` (EXTEND — H5 disabled button) | component | UI | same file lines 160–214 (existing drawer footer area) | exact |

### Tests

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `grid/test/audit/broadcast-allowlist.test.ts` (MOVE + EXTEND from `grid/test/broadcast-allowlist.test.ts`) | test | assert | same file | exact |
| `grid/test/audit/operator-events.test.ts` (NEW — tier-required invariant D-13) | test | contract (throws) | `grid/test/broadcast-allowlist.test.ts` lines 9–47 (`describe` + `it.each`) | exact |
| `grid/test/audit/operator-events-privacy.test.ts` (NEW — payload privacy enumerator D-12) | test | assert | `grid/test/broadcast-allowlist.test.ts` lines 49–81 (payloadPrivacyCheck cases) | exact |
| `grid/test/api/operator/memory-query.test.ts`, `clock.test.ts`, `laws.test.ts`, `telos-force.test.ts` (4 NEW) | test | fastify inject | `grid/test/api/nous-state.test.ts` (buildServer + inject + fake runner) | exact |
| `dashboard/src/components/agency/agency-indicator.test.tsx` (NEW) | test | RTL | `dashboard/src/components/primitives/primitives.test.tsx` | exact |
| `dashboard/src/components/agency/elevation-dialog.test.tsx` (NEW — SC#4 race test) | test | RTL + vi.fn mock | `dashboard/src/app/grid/components/inspector.test.tsx` lines 17–97 (vi.mock + fetchMock + Harness) | role-match |
| `dashboard/src/hooks/use-elevated-action.test.ts` (NEW) | test | unit | `dashboard/src/lib/hooks/use-hash-sync.test.ts` (inferred — pattern shared) | partial |
| `dashboard/src/lib/stores/agency-store.test.ts` (NEW) | test | store unit | `dashboard/src/lib/stores/selection-store.test.ts` | exact |
| `dashboard/tests/e2e/agency.spec.ts` (NEW) | test | Playwright e2e | `dashboard/tests/e2e/grid-page.spec.ts` | exact |
| `scripts/check-state-doc-sync.mjs` (EXTEND) | script | static check | same file | exact |

---

## Pattern Assignments

### `grid/src/audit/broadcast-allowlist.ts` (EXTEND)

**Analog:** same file (append 5 members + keep the frozen-set invariant).

**Tuple extension pattern** (lines 29–41) — insert AFTER `grid.stopped`, order-locked by D-10:

```typescript
const ALLOWLIST_MEMBERS: readonly string[] = [
    'nous.spawned',
    'nous.moved',
    'nous.spoke',
    'nous.direct_message',
    'trade.proposed',
    'trade.reviewed',
    'trade.settled',
    'law.triggered',
    'tick',
    'grid.started',
    'grid.stopped',
    // Phase 6 (AGENCY-02, AGENCY-03) — operator agency events.
    // Shared payload contract: { tier, action, operator_id, target_did? }
    // All five emitted from grid/src/api/operator/* handlers after
    // appendOperatorEvent() validates tier-required invariant (D-13).
    'operator.inspected',      // H2 Reviewer — memory query
    'operator.paused',         // H3 Partner  — WorldClock.pause()
    'operator.resumed',        // H3 Partner  — WorldClock.resume()
    'operator.law_changed',    // H3 Partner  — LogosEngine add/amend/repeal
    'operator.telos_forced',   // H4 Driver   — hash-only diff, no goal contents
] as const;
```

**Frozen-set invariant to PRESERVE** (lines 53–62): `buildFrozenAllowlist()` stays unchanged — runtime `add/delete/clear` still throw TypeError. `FORBIDDEN_KEY_PATTERN` (line 75) also unchanged — note that `tier`, `action`, `operator_id`, `target_did`, `law_id`, `change_type`, `telos_hash_before`, `telos_hash_after` all bypass the pattern (per D-12 audit).

---

### `grid/src/audit/operator-events.ts` (NEW — tier-required invariant)

**Analog:** `grid/src/audit/broadcast-allowlist.ts` (`payloadPrivacyCheck` structural check pattern, lines 77–121) + `grid/src/audit/chain.ts` (`append` signature, lines 20–61).

**Pattern to copy — structural validator returning a typed result** (from `payloadPrivacyCheck`):

```typescript
export interface TierRequiredCheckResult {
    ok: boolean;
    reason?: string;
}

/** Reject any operator.* event whose payload lacks a tier field. D-13. */
export function requireTierInPayload(
    eventType: string,
    payload: Record<string, unknown>,
): TierRequiredCheckResult {
    if (!eventType.startsWith('operator.')) return { ok: true };
    const tier = payload['tier'];
    if (tier !== 'H1' && tier !== 'H2' && tier !== 'H3' && tier !== 'H4' && tier !== 'H5') {
        return { ok: false, reason: `tier required on ${eventType} — got ${JSON.stringify(tier)}` };
    }
    return { ok: true };
}
```

**Wrapper pattern — a narrow helper that the operator handlers call instead of `audit.append` directly.** Mirrors `AuditChain.append` signature (chain.ts:20–25) and throws loudly on violation so tests can enumerate:

```typescript
export function appendOperatorEvent(
    audit: AuditChain,
    eventType: `operator.${string}`,
    actorDid: string,
    payload: Record<string, unknown>,
    targetDid?: string,
): AuditEntry {
    const check = requireTierInPayload(eventType, payload);
    if (!check.ok) throw new TypeError(check.reason);
    // Privacy gate — reuse the existing producer-boundary validator.
    const privacy = payloadPrivacyCheck(payload);
    if (!privacy.ok) {
        throw new TypeError(`privacy leak: ${privacy.offendingPath} matches ${privacy.offendingKeyword}`);
    }
    return audit.append(eventType, actorDid, payload, targetDid);
}
```

**Why a wrapper and not a change to `AuditChain.append`:** the chain stays agnostic; the operator domain owns its invariants. This matches Phase 5's Reviewer pattern (service at the producer boundary, not in the chain itself).

---

### `grid/src/api/operator/*.ts` (NEW — 5 endpoint handlers; placement per Claude's discretion)

**Analog — primary:** `grid/src/api/server.ts` lines 152–181 (`GET /api/v1/nous/:did/state`).

**Imports pattern** (server.ts lines 1–26):

```typescript
import Fastify, { type FastifyInstance } from 'fastify';
import type { WorldClock } from '../clock/ticker.js';
import type { LogosEngine } from '../logos/engine.js';
import type { AuditChain } from '../audit/chain.js';
import type { NousRegistry } from '../registry/registry.js';
import type { ApiError } from './types.js';
```

**DID validation pattern** (server.ts:60, 156–159) — reuse the exported `DID_REGEX`:

```typescript
export const DID_REGEX = /^did:noesis:[a-z0-9_\-]+$/i;
// ...
if (!DID_REGEX.test(did)) {
    reply.code(400);
    return { error: 'invalid_did' } satisfies ApiError;
}
```

**Request-body tier validation (D-14)** — new shape; analog is the inspector proxy's 400-then-404-then-503 ladder:

```typescript
// body: { tier, operator_id, target_did?, ...actionPayload }
const body = req.body as { tier?: unknown; operator_id?: unknown };
if (body.tier !== 'H2' && body.tier !== 'H3' && body.tier !== 'H4') {
    reply.code(400);
    return { error: 'invalid_tier' } satisfies ApiError;
}
if (typeof body.operator_id !== 'string' || !/^op:[0-9a-f-]{36}$/i.test(body.operator_id)) {
    reply.code(400);
    return { error: 'invalid_operator_id' } satisfies ApiError;
}
```

**Brain-proxy pattern for H2 memory query + H4 force-Telos** (server.ts:160–180):

```typescript
const getRunner = services.getRunner;
const runner = getRunner ? getRunner(targetDid) : undefined;
if (!runner) {
    reply.code(404);
    return { error: 'unknown_nous' } satisfies ApiError;
}
if (!runner.connected) {
    reply.code(503);
    return { error: 'brain_unavailable' } satisfies ApiError;
}
try {
    const result = await runner.queryMemory(params);  // or forceTelos(newTelos)
    // Emit operator.* event AFTER success (per CONTEXT Claude's discretion:
    // "do NOT emit the operator.* audit event if Brain is unreachable").
    appendOperatorEvent(services.audit, 'operator.inspected',
        body.operator_id, {
            tier: body.tier, action: 'inspect',
            operator_id: body.operator_id, target_did: targetDid,
        },
        targetDid,
    );
    return result;
} catch (err) {
    // Privacy invariant (T-04-12): never leak raw err.message.
    request.log.warn({ err, did: targetDid }, 'brain call failed');
    reply.code(503);
    return { error: 'brain_unavailable' } satisfies ApiError;
}
```

**Error contract** — match server.ts:174 log pattern: `request.log.warn` server-side, client sees only the fixed shape `{error: '<kind>'}`.

---

### `grid/src/clock/ticker.ts` (EXTEND)

**Analog:** same file — the new `pause()`/`resume()` methods mirror the existing `start()`/`stop()` pair (lines 29–40) with one key difference: pause preserves the counter; stop does not restart cleanly.

**Existing pattern** (lines 29–40):

```typescript
start(): void {
    if (this.timer) return; // Already running
    this.startedAt = Date.now();
    this.timer = setInterval(() => this.advance(), this.tickRateMs);
}

stop(): void {
    if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
    }
}
```

**Pattern to add** — preserve zero-diff invariant (D-17 regression test: chain hashes match a non-paused simulation that reaches the same tick):

```typescript
private paused = false;

pause(): void {
    if (this.paused || !this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    this.paused = true;
}

resume(): void {
    if (!this.paused) return;
    this.paused = false;
    // tick counter preserved — do NOT reset startedAt.
    this.timer = setInterval(() => this.advance(), this.tickRateMs);
}

get isPaused(): boolean { return this.paused; }
```

**Zero-diff invariant** (commit 29c3516, preserved across pause/resume): listeners fire in the same order; tick counter increments monotonically; no ticks emitted while paused. Regression: run two simulations to tick N — one paused+resumed mid-run, one continuous — assert identical `audit.head` hashes.

---

### `grid/src/logos/engine.ts` (EXTEND — add `amendLaw`)

**Analog:** same file — `addLaw`/`removeLaw`/`getLaw` (lines 16–26).

**Existing pattern:**

```typescript
addLaw(law: Law): void {
    this.laws.set(law.id, law);
}

removeLaw(id: string): boolean {
    return this.laws.delete(id);
}

getLaw(id: string): Law | undefined {
    return this.laws.get(id);
}
```

**Pattern to add** — amendLaw = replace-in-place with identity preserved:

```typescript
amendLaw(id: string, updates: Partial<Omit<Law, 'id'>>): Law | undefined {
    const existing = this.laws.get(id);
    if (!existing) return undefined;
    const amended: Law = { ...existing, ...updates, id };
    this.laws.set(id, amended);
    return amended;
}
```

---

### `protocol/src/noesis/bridge/brain-bridge.ts` (EXTEND)

**Analog:** same file — `getState()` (lines 61–64) and `sendMessage()` (lines 37–40).

**Existing pattern** (line 61):

```typescript
async getState(): Promise<Record<string, unknown>> {
    const result = await this.client.call('brain.getState', {});
    return (result as Record<string, unknown>) || {};
}
```

**Pattern to add — `queryMemory` and `forceTelos`** (for H2 and H4):

```typescript
async queryMemory(params: { query: string; limit?: number }): Promise<{ entries: Array<{id: string; summary: string; created_at: string}> }> {
    const result = await this.client.call('brain.queryMemory', params as any);
    return (result as any) ?? { entries: [] };
}

async forceTelos(newTelos: Record<string, unknown>): Promise<{ telos_hash_before: string; telos_hash_after: string }> {
    const result = await this.client.call('brain.forceTelos', { new_telos: newTelos } as any);
    return result as { telos_hash_before: string; telos_hash_after: string };
}
```

**`IBrainBridge` extension** (`grid/src/integration/types.ts` lines 87–93):

```typescript
export interface IBrainBridge {
    readonly connected: boolean;
    sendTick(params: TickParams): Promise<BrainAction[]>;
    sendMessage(params: MessageParams): Promise<BrainAction[]>;
    sendEvent(params: EventParams): void;
    getState(): Promise<Record<string, unknown>>;
    // Phase 6 additions:
    queryMemory(params: { query: string; limit?: number }): Promise<{ entries: unknown[] }>;
    forceTelos(newTelos: Record<string, unknown>): Promise<{ telos_hash_before: string; telos_hash_after: string }>;
}
```

---

### `brain/src/noesis_brain/rpc/handler.py` (EXTEND) + `__main__.py` registrations

**Analog:** `handler.py` lines 54–110 (`on_message`) for the async handler shape, and `get_state` at line 135–167 for the dict-return pattern. Registration at `__main__.py` lines 183–191.

**Handler extension pattern:**

```python
async def query_memory(self, params: dict[str, Any]) -> dict[str, Any]:
    """Handle H2 Reviewer memory query. Audit-logged on the Grid side.

    params:
        query: search string (empty → recent)
        limit: max entries (default 5, clamp 50)
    """
    query = str(params.get("query", ""))
    limit = max(1, min(50, int(params.get("limit", 5))))
    if self.memory is None:
        return {"entries": []}
    try:
        raw = self.memory.recent(limit=limit) if not query else self.memory.search(query, limit=limit)
    except Exception as exc:  # pragma: no cover — defensive
        log.warning("memory query failed: %s", exc)
        return {"entries": []}
    return {"entries": [self._normalise_memory_entry(r) for r in raw[:limit]]}

async def force_telos(self, params: dict[str, Any]) -> dict[str, Any]:
    """Handle H4 Driver force-Telos. Hash diff only — no goal contents leave."""
    import hashlib, json
    before = hashlib.sha256(
        json.dumps([g.description for g in self.telos.active_goals()], sort_keys=True).encode()
    ).hexdigest()
    new_goals = params.get("new_telos", {}).get("active_goals", [])
    # Replace telos manager's goals.
    self.telos = TelosManager.from_yaml({"short_term": [g["description"] for g in new_goals]})
    after = hashlib.sha256(
        json.dumps([g.description for g in self.telos.active_goals()], sort_keys=True).encode()
    ).hexdigest()
    return {"telos_hash_before": before, "telos_hash_after": after}
```

**Registration pattern** (`__main__.py` lines 183–191):

```python
rpc.register("brain.onMessage", handler.on_message)
rpc.register("brain.onTick", handler.on_tick)
rpc.register("brain.onEvent", handler.on_event)
# Phase 6:
rpc.register("brain.queryMemory", handler.query_memory)
rpc.register("brain.forceTelos",  handler.force_telos)

async def get_state_handler(params: dict[str, Any]) -> dict[str, Any]:
    return handler.get_state()
rpc.register("brain.getState", get_state_handler)
```

---

### `dashboard/src/lib/protocol/agency-types.ts` (NEW)

**Analog:** `dashboard/src/lib/protocol/audit-types.ts` (hand-copied types, SYNC note header, pure TypeScript).

**Imports/header pattern** (audit-types.ts lines 1–13):

```typescript
/**
 * SYNC: grid/src/api/types.ts (Phase 6 tier types)
 *
 * Two-source copy intentional — Grid and dashboard are separate packages
 * (per Phase 5 precedent; audit-types.ts follows the same rule). If one
 * side changes, update the other in the same commit.
 */

export type HumanAgencyTier = 'H1' | 'H2' | 'H3' | 'H4' | 'H5';

export const TIER_NAME: Record<HumanAgencyTier, string> = {
    H1: 'Observer',
    H2: 'Reviewer',
    H3: 'Partner',
    H4: 'Driver',
    H5: 'Sovereign',
};

// operator_id: session-scoped UUID. Regex matches `op:<uuid-v4>`.
export const OPERATOR_ID_REGEX = /^op:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
```

---

### `dashboard/src/lib/stores/agency-store.ts` (NEW)

**Analog:** `dashboard/src/lib/stores/selection-store.ts` (subscribe/getSnapshot pattern, pure TS, no React import).

**Store-shape pattern** (selection-store.ts lines 23–48):

```typescript
export class AgencyStore {
    private tier: HumanAgencyTier = 'H1';
    private readonly listeners = new Set<() => void>();

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return (): void => { this.listeners.delete(listener); };
    };

    getSnapshot = (): HumanAgencyTier => this.tier;

    setTier(next: HumanAgencyTier): void {
        if (next === this.tier) return;  // same-value no-op (tearing-safe)
        this.tier = next;
        this.persist();
        for (const l of this.listeners) l();
    }

    // localStorage persistence — SSR-safe (guarded at read/write time).
    private persist(): void {
        if (typeof window === 'undefined') return;
        try { window.localStorage.setItem('noesis.operator.tier', this.tier); } catch { /* quota */ }
    }

    hydrateFromStorage(): void {
        if (typeof window === 'undefined') return;
        const raw = window.localStorage.getItem('noesis.operator.tier');
        if (raw === 'H1' || raw === 'H2' || raw === 'H3' || raw === 'H4') this.tier = raw;
    }
}
```

**Operator-id lazy accessor** — synchronous single-read utility (not a store). Pattern mirrors `use-hash-sync.ts` lines 48–53 (read-then-write-if-missing):

```typescript
export function getOperatorId(): string {
    if (typeof window === 'undefined') return 'op:ssr-no-id';
    const existing = window.localStorage.getItem('noesis.operator.id');
    if (existing && /^op:[0-9a-f-]{36}$/i.test(existing)) return existing;
    const fresh = `op:${crypto.randomUUID()}`;
    window.localStorage.setItem('noesis.operator.id', fresh);
    return fresh;
}
```

---

### `dashboard/src/components/agency/agency-indicator.tsx` (NEW)

**Analog:** `dashboard/src/components/primitives/chip.tsx` (visual primitive) + tooltip content pattern from Inspector drawer (`inspector.tsx` header area).

**Chip primitive to EXTEND** (chip.tsx all 25 lines) — add `color` prop per D-03:

```typescript
// Existing (do not break):
export function Chip({ label, testId }: ChipProps): React.ReactElement {
    return (
        <span data-testid={testId} className="inline-flex items-center rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-200">
            {label}
        </span>
    );
}
```

**Extended signature** (zero-diff for existing callers — default color `'neutral'`):

```typescript
export interface ChipProps {
    readonly label: string;
    readonly testId?: string;
    readonly color?: 'neutral' | 'blue' | 'amber' | 'red' | 'muted';
}

const COLOR_CLASSES: Record<NonNullable<ChipProps['color']>, string> = {
    neutral: 'border border-neutral-800 text-neutral-200',
    blue:    'border-2 border-blue-400 text-neutral-200',
    amber:   'border-2 border-amber-300 text-neutral-200',
    red:     'border-2 border-red-400 text-red-400',
    muted:   'border border-dashed border-neutral-600 text-neutral-500 line-through',
};
```

**AgencyIndicator component shape** (CONTEXT.md specifics §Agency Indicator sketch + UI-SPEC §155–163):

```typescript
'use client';
import { useSyncExternalStore } from 'react';
import { Chip } from '@/components/primitives';
import { agencyStore } from '@/lib/stores/agency-store';
import { TIER_NAME, type HumanAgencyTier } from '@/lib/protocol/agency-types';

const TIER_COLOR: Record<HumanAgencyTier, 'neutral'|'blue'|'amber'|'red'|'muted'> = {
    H1: 'neutral', H2: 'blue', H3: 'amber', H4: 'red', H5: 'muted',
};

export function AgencyIndicator(): React.ReactElement {
    const tier = useSyncExternalStore(
        agencyStore.subscribe,
        agencyStore.getSnapshot,
        () => 'H1' as HumanAgencyTier,  // SSR default (D-01)
    );
    return (
        <div className="relative" data-testid="agency-indicator">
            <Chip
                label={`${tier} ${TIER_NAME[tier]}`}
                color={TIER_COLOR[tier]}
                testId="agency-chip"
            />
            {/* tooltip renders on hover/focus — authoritative H1–H5 copy from PHILOSOPHY §7 */}
        </div>
    );
}
```

---

### `dashboard/src/components/agency/elevation-dialog.tsx` (NEW)

**Analog (partial):** `dashboard/src/app/grid/components/inspector.tsx` lines 112–153 (focus-trap + ESC). **Key divergence:** elevation uses the **native `<dialog>` element** with `showModal()` for automatic inert background + Escape handling (UI-SPEC §Keyboard accessibility). Inspector hand-rolls a trap because it's a drawer, not modal.

**Native `<dialog>` pattern** (UI-SPEC §Interaction Contract + D-08):

```typescript
'use client';
import { useEffect, useRef } from 'react';
import { TIER_NAME, type HumanAgencyTier } from '@/lib/protocol/agency-types';

export interface ElevationDialogProps {
    readonly targetTier: Exclude<HumanAgencyTier, 'H1' | 'H5'>;
    readonly open: boolean;
    readonly onConfirm: () => void;   // Parent: captures tier in closure BEFORE this fires
    readonly onCancel: () => void;
}

const CONFIRM_FILL: Record<ElevationDialogProps['targetTier'], string> = {
    H2: 'bg-blue-400 text-neutral-950',
    H3: 'bg-amber-300 text-neutral-950',
    H4: 'bg-red-400 text-neutral-950',
};

export function ElevationDialog({ targetTier, open, onConfirm, onCancel }: ElevationDialogProps): React.ReactElement {
    const ref = useRef<HTMLDialogElement | null>(null);

    useEffect(() => {
        const dlg = ref.current;
        if (!dlg) return;
        if (open && !dlg.open) dlg.showModal();          // native focus-trap + inert bg
        else if (!open && dlg.open) dlg.close();
    }, [open]);

    return (
        <dialog
            ref={ref}
            onClose={onCancel}                            // Esc → native close event
            data-testid="elevation-dialog"
            aria-labelledby="elevation-title"
            className="min-w-[384px] p-6 bg-neutral-900 text-neutral-100 border border-neutral-800 rounded"
        >
            <h2 id="elevation-title" className="text-base font-semibold">
                Entering {targetTier} — {TIER_NAME[targetTier]}
            </h2>
            <p className="mt-2 text-sm">
                Entering {targetTier} — {TIER_NAME[targetTier]}. This will be logged.
            </p>
            <div className="mt-4 flex gap-2 justify-end">
                <button
                    type="button"
                    onClick={onCancel}
                    autoFocus                             // safer default per UI-SPEC
                    className="px-3 py-1 text-sm font-semibold"
                    aria-label={`Cancel elevation to ${targetTier}. No action will be taken.`}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={onConfirm}
                    className={`px-3 py-1 text-sm font-semibold ${CONFIRM_FILL[targetTier]}`}
                    aria-label={`Confirm elevation to ${targetTier}. The action will dispatch and be logged.`}
                >
                    Confirm
                </button>
            </div>
        </dialog>
    );
}
```

---

### `dashboard/src/hooks/use-elevated-action.ts` (NEW — race-safe closure capture)

**Analog (partial):** `dashboard/src/lib/hooks/use-hash-sync.ts` lines 45–79 (ref-guarded loop-breaking pattern). **Novel aspect:** this hook is about serializing a closure value *before* a network I/O — the ref pattern from hash-sync is reused for tracking in-flight state.

**Pattern to follow** (CONTEXT.md specifics §Elevation dialog sketch, race-safe per D-07):

```typescript
'use client';
import { useCallback, useState } from 'react';
import { agencyStore } from '@/lib/stores/agency-store';
import { getOperatorId } from '@/lib/stores/agency-store';
import type { HumanAgencyTier } from '@/lib/protocol/agency-types';

type ElevatedTier = Exclude<HumanAgencyTier, 'H1' | 'H5'>;

export interface ElevationResult<T> {
    ok: boolean;
    reason?: 'cancelled' | 'failed';
    data?: T;
}

export function useElevatedAction(targetTier: ElevatedTier) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [pending, setPending] = useState<null | {
        payload: Record<string, unknown>;
        resolve: (r: ElevationResult<unknown>) => void;
        dispatch: (body: Record<string, unknown>) => Promise<unknown>;
    }>(null);

    const fire = useCallback(<T>(
        payload: Record<string, unknown>,
        dispatch: (body: Record<string, unknown>) => Promise<T>,
    ): Promise<ElevationResult<T>> => {
        return new Promise((resolve) => {
            setPending({ payload, dispatch, resolve: resolve as never });
            agencyStore.setTier(targetTier);   // UI reflects elevation
            setDialogOpen(true);
        });
    }, [targetTier]);

    const onConfirm = useCallback(async (): Promise<void> => {
        const p = pending;
        setDialogOpen(false);
        if (!p) return;
        // D-07 RACE-SAFETY: capture tier in closure + build body BEFORE any I/O.
        const body = { tier: targetTier, operator_id: getOperatorId(), ...p.payload };
        try {
            // Fire-and-await the dispatch. Auto-downgrade fires in finally,
            // AFTER the body is already serialized and dispatch has returned.
            const data = await p.dispatch(body);
            p.resolve({ ok: true, data });
        } catch (err) {
            p.resolve({ ok: false, reason: 'failed' });
        } finally {
            // AGENCY-04 single-action scope: auto-downgrade.
            agencyStore.setTier('H1');
            setPending(null);
        }
    }, [pending, targetTier]);

    const onCancel = useCallback((): void => {
        setDialogOpen(false);
        pending?.resolve({ ok: false, reason: 'cancelled' });
        agencyStore.setTier('H1');  // even on cancel — never persist elevated state
        setPending(null);
    }, [pending]);

    return { dialogOpen, onConfirm, onCancel, fire };
}
```

---

### `dashboard/src/lib/api/operator.ts` (NEW)

**Analog:** `dashboard/src/lib/api/introspect.ts` lines 56–81 (fetchNousState).

**Error-mapping pattern** (introspect.ts lines 50–54):

```typescript
const STATUS_TO_KIND: Record<number, FetchError['kind']> = {
    400: 'invalid_tier',
    404: 'unknown_nous',
    503: 'brain_unavailable',
};
```

**Fetch wrapper pattern** (introspect.ts lines 56–81) — operator POST variant:

```typescript
export async function postOperatorAction<T>(
    endpoint: string,
    origin: string,
    body: Record<string, unknown>,
    signal?: AbortSignal,
): Promise<FetchResult<T>> {
    let resp: Response;
    try {
        resp = await fetch(`${origin}${endpoint}`, {
            method: 'POST',
            signal,
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify(body),
        });
    } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') throw err;
        return { ok: false, error: { kind: 'network' } };
    }
    if (!resp.ok) {
        const kind = STATUS_TO_KIND[resp.status] ?? 'network';
        return { ok: false, error: { kind } };
    }
    return { ok: true, data: (await resp.json()) as T };
}
```

---

### `dashboard/src/app/layout.tsx` (EXTEND — mount AgencyIndicator)

**Analog:** same file (17 lines). Current body wraps children in `<html><body>` — we add the indicator inside `<body>` per D-02.

**Existing pattern** (lines 9–17):

```tsx
export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en" className="dark">
            <body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
                {children}
            </body>
        </html>
    );
}
```

**Extension pattern** — a new fixed-position wrapper hosts the indicator so it never overlaps page content and appears on every route (SC#1):

```tsx
import { AgencyIndicator } from '@/components/agency/agency-indicator';

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en" className="dark">
            <body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
                <div className="fixed right-4 top-4 z-50">
                    <AgencyIndicator />
                </div>
                {children}
            </body>
        </html>
    );
}
```

**SSR note:** `<AgencyIndicator />` is a client component (`'use client'`) and reads from `useSyncExternalStore` — SSR default `'H1'` matches the localStorage-absent first-load case.

---

### `dashboard/src/app/grid/components/inspector.tsx` (EXTEND — H5 disabled button)

**Analog:** same file lines 160–214 (drawer body).

**Add to the footer area (after line 212)** per D-20 + UI-SPEC §H5 disabled Inspector affordance:

```tsx
<div className="mt-3 border-t border-neutral-800 pt-3">
    <button
        type="button"
        disabled
        tabIndex={0}
        aria-disabled="true"
        aria-label="Delete Nous — requires Phase 8 Sovereign operations. Currently disabled."
        title="Requires Phase 8"
        data-testid="inspector-h5-delete"
        className="w-full rounded border border-dashed border-neutral-600 px-2 py-1 text-xs text-neutral-500 line-through cursor-not-allowed"
    >
        Delete Nous
    </button>
</div>
```

No click handler bound (per UI-SPEC: "event handler not bound at all").

---

### `grid/test/audit/operator-events.test.ts` (NEW — tier-required invariant D-13)

**Analog:** `grid/test/broadcast-allowlist.test.ts` lines 9–47 (describe + it.each enumeration).

**Pattern to copy** (existing):

```typescript
import { describe, it, expect } from 'vitest';

describe('broadcast-allowlist: default-deny membership', () => {
    it('has exactly 11 locked v1+Phase 5 event types', () => {
        expect(ALLOWLIST.size).toBe(11);
    });
    it.each(['nous.spawned', 'nous.moved', /* ... */])('allows %s', (eventType) => {
        expect(isAllowlisted(eventType)).toBe(true);
    });
});
```

**Pattern for Phase 6 — tier-required invariant** (CONTEXT specifics §Tier-required invariant test sketch):

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendOperatorEvent } from '../../src/audit/operator-events.js';

const OPERATOR_EVENTS = [
    'operator.inspected',
    'operator.paused',
    'operator.resumed',
    'operator.law_changed',
    'operator.telos_forced',
] as const;

describe('AGENCY-03: tier field required on all operator.* events (D-13)', () => {
    let chain: AuditChain;
    beforeEach(() => { chain = new AuditChain(); });

    it.each(OPERATOR_EVENTS)('%s rejects payload missing tier', (eventType) => {
        expect(() => appendOperatorEvent(
            chain, eventType, 'op:00000000-0000-4000-8000-000000000000',
            { action: 'x', operator_id: 'op:00000000-0000-4000-8000-000000000000' },
        )).toThrow(/tier.*required/i);
    });

    it.each(OPERATOR_EVENTS)('%s accepts well-formed payload with tier', (eventType) => {
        expect(() => appendOperatorEvent(
            chain, eventType, 'op:00000000-0000-4000-8000-000000000000',
            { tier: 'H2', action: 'x', operator_id: 'op:00000000-0000-4000-8000-000000000000' },
        )).not.toThrow();
    });
});
```

---

### `dashboard/src/components/agency/elevation-dialog.test.tsx` (NEW — SC#4 race test)

**Analog:** `dashboard/src/app/grid/components/inspector.test.tsx` lines 17–97 (vi.mock + fetchMock + Harness setup + `act` usage).

**vi.mock pattern** (inspector.test.tsx lines 24–34):

```typescript
const fetchMock = vi.fn();
vi.mock('@/lib/api/introspect', async () => {
    const actual = await vi.importActual<typeof import('@/lib/api/introspect')>('@/lib/api/introspect');
    return { ...actual, fetchNousState: (...args: unknown[]) => fetchMock(...args) };
});
```

**Pattern for SC#4 race test** (CONTEXT specifics §Elevation-race regression sketch):

```typescript
import { describe, it, expect, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useElevatedAction } from '@/hooks/use-elevated-action';
import { agencyStore } from '@/lib/stores/agency-store';

describe('SC#4 elevation-race invariant (D-07)', () => {
    it('committed tier is the confirmed tier, not the tier at HTTP arrival', async () => {
        const dispatch = vi.fn().mockImplementation(async (body: { tier: string }) => {
            // Simulate mid-flight downgrade from another source.
            act(() => { agencyStore.setTier('H1'); });
            return { ok: true, tier_echo: body.tier };
        });
        // ... render a test harness that calls useElevatedAction('H4').fire(...)
        // ... programmatically click Confirm
        // Assert:
        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ tier: 'H4' }));
        expect(agencyStore.getSnapshot()).toBe('H1');  // auto-downgrade fired
    });
});
```

---

### `dashboard/tests/e2e/agency.spec.ts` (NEW — Playwright)

**Analog:** `dashboard/tests/e2e/grid-page.spec.ts` lines 17–82 (test setup + mock-grid fixture + `expect.poll`).

**Boilerplate pattern**:

```typescript
import { test, expect, type Page } from '@playwright/test';
import { startMockGrid, type MockGridHandle } from './fixtures/mock-grid-server';

let mock: MockGridHandle;
test.beforeAll(async () => { mock = await startMockGrid(8080); });
test.afterAll(async () => { if (mock) await mock.stop(); });

test('agency indicator visible on every route; H1 default', async ({ page }) => {
    await page.goto('/grid');
    await expect(page.locator('[data-testid="agency-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="agency-chip"]')).toContainText('H1 Observer');
});

test('SC#5: H5 Delete Nous button is visible and disabled in Inspector', async ({ page }) => {
    await page.goto('/grid#nous=did:noesis:alpha');
    const btn = page.locator('[data-testid="inspector-h5-delete"]');
    await expect(btn).toBeVisible();
    await expect(btn).toBeDisabled();
    await expect(btn).toHaveAttribute('title', 'Requires Phase 8');
});
```

---

### `scripts/check-state-doc-sync.mjs` (EXTEND)

**Analog:** same file — extend the `required` array (lines 65–77) and the `11 events` count literal (line 38).

**Existing pattern:**

```javascript
if (!/11\s+events/i.test(state)) {
  failures.push('STATE.md does not mention "11 events" — Phase 5 allowlist count assertion missing.');
}
const required = [
  'nous.spawned', /* ... */ 'grid.stopped',
];
```

**Phase 6 change** — bump count 11→16, append 5 operator events:

```javascript
if (!/16\s+events/i.test(state)) {
  failures.push('STATE.md does not mention "16 events" — Phase 6 allowlist count assertion missing.');
}
const required = [
  'nous.spawned', 'nous.moved', 'nous.spoke', 'nous.direct_message',
  'trade.proposed', 'trade.reviewed', 'trade.settled',
  'law.triggered', 'tick', 'grid.started', 'grid.stopped',
  // Phase 6:
  'operator.inspected', 'operator.paused', 'operator.resumed',
  'operator.law_changed', 'operator.telos_forced',
];
```

Also bump the `ALLOWLIST.size` assertion in `grid/test/broadcast-allowlist.test.ts` line 10: `expect(ALLOWLIST.size).toBe(16);`.

---

## Shared Patterns

### Pattern S-1: Audit-event producer-boundary privacy gate

**Source:** `grid/src/audit/broadcast-allowlist.ts` lines 77–121 (`payloadPrivacyCheck`) + `grid/src/integration/nous-runner.ts` (call site precedent).

**Apply to:** All 5 new operator endpoint handlers — call `appendOperatorEvent()` (which wraps privacy + tier gates) instead of `audit.append()` directly.

**Excerpt** (call-site discipline):

```typescript
// BEFORE any audit.append in operator handlers:
appendOperatorEvent(services.audit, 'operator.X', body.operator_id, {
    tier: body.tier,
    action: '<action-name>',
    operator_id: body.operator_id,
    // target_did + other payload fields — NEVER include prompt/response/wiki/reflection/thought/emotion_delta
});
```

### Pattern S-2: Fastify endpoint 400→404→503 error ladder

**Source:** `grid/src/api/server.ts` lines 152–181 (inspector proxy).

**Apply to:** All operator endpoints that proxy to Brain (memory-query, telos-force).

**Excerpt:**

```typescript
if (!DID_REGEX.test(did))      { reply.code(400); return { error: 'invalid_did' }; }
if (!body.tier in TIERS)       { reply.code(400); return { error: 'invalid_tier' }; }
if (!runner)                   { reply.code(404); return { error: 'unknown_nous' }; }
if (!runner.connected)         { reply.code(503); return { error: 'brain_unavailable' }; }
try { /* call */ } catch { reply.code(503); return { error: 'brain_unavailable' }; }
```

### Pattern S-3: Hand-copied dashboard type mirrors

**Source:** `dashboard/src/lib/protocol/audit-types.ts` (SYNC header).

**Apply to:** `dashboard/src/lib/protocol/agency-types.ts` — maintain a parallel copy of `HumanAgencyTier` in `grid/src/api/types.ts`, with SYNC comment pointing both ways.

### Pattern S-4: Subscribe/getSnapshot store + useSyncExternalStore

**Source:** `dashboard/src/lib/stores/selection-store.ts` + `dashboard/src/lib/stores/heartbeat-store.ts` + `dashboard/src/app/grid/use-stores.ts`.

**Apply to:** `dashboard/src/lib/stores/agency-store.ts`. The store is a pure TS class with `subscribe` and `getSnapshot` arrow-fields so `useSyncExternalStore(store.subscribe, store.getSnapshot, ssrDefault)` works directly. Unlike other stores, it also persists to `localStorage` via a small `persist()` helper.

### Pattern S-5: Vitest `it.each` + `buildServer()` harness for endpoint tests

**Source:** `grid/test/api/nous-state.test.ts` lines 47–64 (seedServer helper).

**Apply to:** All 4 new operator endpoint test files. Each test file builds a fresh Fastify server with a fake runner map, then uses `app.inject({method: 'POST', url: '/api/v1/operator/...', payload: {...}})`.

### Pattern S-6: Zero-diff invariant (commit 29c3516) preservation for pause/resume

**Source:** Phase 5 D-13 zero-diff test pattern (`grid/test/review/zero-diff.test.ts` — inferred; same invariant class).

**Apply to:** `WorldClock.pause()`/`resume()`. Regression test: run two parallel WorldClock instances to tick N, one with pause/resume mid-stream, and assert identical `AuditChain.head` hashes.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `dashboard/src/components/agency/elevation-dialog.tsx` | component (native `<dialog>`) | modal | **Partial analog only.** Inspector uses a hand-rolled drawer focus-trap; elevation uses the native `<dialog>` element which is new to the dashboard. Planner should reference the HTMLDialogElement API + UI-SPEC §Interaction Contract. |
| `dashboard/src/hooks/use-elevated-action.ts` | hook (closure-capture race-safe dispatcher) | pre-I/O serialization | **Partial analog only.** No existing hook captures a closure value pre-I/O for race-safety. `use-hash-sync.ts` is the closest (ref-guarded loop-breaking), but the semantics differ. Planner should lean on CONTEXT specifics §Elevation dialog sketch + D-07 literal implementation notes. |

---

## Metadata

**Analog search scope:** `grid/src`, `grid/test`, `dashboard/src`, `dashboard/tests`, `brain/src/noesis_brain`, `protocol/src/noesis/bridge`, `scripts/`.

**Files scanned:** ~60 source files read in full or in targeted ranges.

**Pattern extraction date:** 2026-04-21

**Key cross-cutting reuses the planner MUST honor:**
- `DID_REGEX` (exported from `grid/src/api/server.ts:60`) — reuse, never redefine.
- `OPERATOR_ID_REGEX` — new, but kept in the same `agency-types.ts` to avoid triple-source drift.
- `payloadPrivacyCheck` + `FORBIDDEN_KEY_PATTERN` — reuse untouched; ensure every new operator payload field stays outside the pattern.
- `AuditChain.append()` — do NOT modify; wrap via `appendOperatorEvent()` in `grid/src/audit/operator-events.ts`.
- Frozen-set invariant on `ALLOWLIST` — only extension is appending to `ALLOWLIST_MEMBERS` tuple in the locked D-10 order.
- Zero-diff invariant on `WorldClock` — pause/resume must preserve tick counter + listener order.
- Next.js client-boundary conventions — AgencyIndicator, ElevationDialog, hooks all start with `'use client'`.
