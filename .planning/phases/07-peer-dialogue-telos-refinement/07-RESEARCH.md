# Phase 7: Peer Dialogue → Telos Refinement — Research

**Researched:** 2026-04-20
**Domain:** Event-driven dialogue aggregation + Brain-side telos mutation + dashboard badge/filter
**Confidence:** HIGH (locked CONTEXT.md supplies 32 decisions; this research supplies implementation mechanics)

## Summary

Phase 7 adds a **deterministic dialogue aggregator** (`grid/src/dialogue/aggregator.ts`) that watches `nous.spoke` commits via `AuditChain.onAppend`, groups utterances into windowed `DialogueContext` objects (`windowTicks=5`, `minExchanges=2`), and delivers them to both participants' Brains on the next tick via a widened `TickParams.dialogue_context?` field. The Python Brain returns a new `ActionType.TELOS_REFINED` action carrying `{before_goal_hash, after_goal_hash, new_goals, dialogue_id}`; the Grid's `NousRunner.executeActions` drops `new_goals`, validates hashes, and calls a new producer helper `appendTelosRefined` that emits the hash-only `telos.refined` audit event — appended at allowlist position 17. The dashboard renders a non-interactive `<TelosRefinedBadge />` in the Telos panel (fed by a new `useRefinedTelosHistory(did)` hook) and a clickable `<DialogueFilterChip />` that sets `firehose_filter=dialogue_id:<16-hex>`.

**Primary recommendation:** Mirror Phase 6's producer-boundary discipline (`appendOperatorEvent`). Build aggregator as a pure class with injected `audit.onAppend` subscription + injected `Date.now` / clock tick source — do NOT let it touch `Math.random` or Map iteration order. Own the aggregator lifetime from `GenesisLauncher` (same place that owns `WorldClock`) so pause hooks can drain deterministically. Write the zero-diff test FIRST before writing aggregator code — it's the invariant that protects the whole phase.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Detect `nous.spoke` commits | Grid (audit listener) | — | AuditChain is the canonical event source; listeners fire synchronously after commit (chain.ts:50-58) |
| Window + pair utterances | Grid (aggregator) | — | Determinism requires a single owner with sorted state |
| Compute `dialogue_id` | Grid (aggregator) | — | `sha256(sortedDids|channel|windowStartTick).slice(0,16)` — deterministic, no RPC round-trip |
| Deliver DialogueContext to Brain | Grid (coordinator) → Brain (RPC) | — | Widens `TickParams`; additive field, back-compat |
| Decide whether to refine telos | **Brain** (Python) | — | Sovereignty (PHILOSOPHY §1) — Brain alone writes goals |
| Compute `before_goal_hash` / `after_goal_hash` | **Brain** (`compute_active_telos_hash`) | — | Brain is sole hash authority (hashing.py comment) |
| Drop plaintext `new_goals`; append event | Grid (producer helper) | — | Hash-only RPC boundary; `appendTelosRefined` enforces at call site |
| Allowlist gating | Grid (broadcast-allowlist) | — | Frozen tuple — Phase 7 grows it to 17 |
| Badge render + filter | Dashboard | Grid (firehose SSE) | Hook fetches `/events?event_type=telos.refined&actor=<did>` |

## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01 … D-32)

> 32 decisions were locked in CONTEXT.md and govern this phase. They are authoritative — this research does not re-derive them, only supplies implementation mechanics. Reference CONTEXT.md for the full text. Summary of the ones that most shape research:

- **D-01**: Aggregator lives at `grid/src/dialogue/aggregator.ts`
- **D-02**: Config `{windowTicks: 5, minExchanges: 2}`
- **D-03**: `dialogue_id = sha256(sortedDids|channel|windowStartTick).slice(0,16)`
- **D-04**: Pause is a clean boundary — aggregator buffers drain on `WorldClock.pause()`
- **D-05**: `DialogueContext` = `{dialogue_id, utterances[≤5, 200-char truncated], counterparty_did}`
- **D-06**: Closed 4-key payload tuple `{did, before_goal_hash, after_goal_hash, triggered_by_dialogue_id}`
- **D-07**: `telos.refined` appends at allowlist position **17**
- **D-08**: Producer boundary = `appendTelosRefined` helper (mirrors `appendOperatorEvent`)
- **D-09**: `ActionType.TELOS_REFINED = "telos_refined"` in Python
- **D-10**: `TickParams.dialogue_context?` widens additively
- **D-11**: NO tier stamp on `telos.refined` (Nous-initiated, not operator-forced)
- **D-13**: Brain action carries `new_goals` (plaintext goals); Grid drops them before append
- **D-14**: Zero-diff test at `grid/test/dialogue-zero-diff.test.ts`; byte-identical chain head for 0 vs 10 listeners
- **D-30**: Badge is panel-level (not per-goal) — hash authority hashes whole goal set

### Claude's Discretion

- Aggregator internal data structure (recommend: sorted array keyed by deterministic `pairKey = sortedDids.join('|')`)
- Whether coordinator pull-queries aggregator each tick vs aggregator push-publishes via a separate channel (recommend: **pull** — matches the existing `GridCoordinator` tick loop control)
- Test file organization inside `grid/test/dialogue/` vs flat (recommend: subdirectory — this phase adds 4+ test files)

### Deferred Ideas (OUT OF SCOPE)

- WHISPER-01 (scoped `nous.whispered` channel) — Sprint 16+
- OP-MULTI-01 multi-operator
- Per-goal hash attribution (requires `compute_per_goal_hash` — not available)

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DIALOG-01 | Aggregate ≥2 `nous.spoke` exchanges within N ticks → pass `dialogue_context` to both Brains | `audit.onAppend('nous.spoke')` + coordinator tick-loop integration (see Architecture §1) |
| DIALOG-02 | Brain returns `telos.refined` action → Grid validates, emits hash-only allowlisted event | `appendTelosRefined` producer helper + payload-privacy invariant (see Architecture §2) |
| DIALOG-03 | Inspector Telos panel shows "↻ refined via dialogue" badge with link to triggering dialogue | `<TelosRefinedBadge />` + `<DialogueFilterChip />` + `useRefinedTelosHistory` hook (see Architecture §3) |

## Standard Stack

### Core (no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | existing | Zero-diff + boundary + privacy tests | `grid/test/audit.test.ts:253-281` is the canonical template |
| AuditChain (internal) | existing | `onAppend` listener + hash-chain commit | Single source for `nous.spoke` observation |
| Node `crypto` | built-in | `createHash('sha256')` for `dialogue_id` | Determinism-safe; already used in chain.ts |
| Playwright | existing | Dashboard badge + filter smoke | `dashboard/tests/e2e/` existing harness |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React hooks (`useState`, `useEffect`) | existing | `useRefinedTelosHistory(did)` | Matches D17's introspect-fetch pattern |
| Zod-like payload validator | **do NOT add** | Payload shape validation | Use plain TS type guards + `Object.keys().sort()` equality — matches Phase 6 style |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pull-query aggregator | Push via event emitter | Push introduces async-ordering race; pull preserves determinism |
| Subscribe to `audit.onAppend` | Monkey-patch `NousRunner.handleSpeak` | Listener is additive & testable in isolation; monkey-patching couples aggregator to runner |
| Per-goal hash | Whole-set hash | Brain API provides only whole-set (D-30); per-goal would require Brain change — out of scope |

**Installation:** none — all dependencies already present.

## Architecture Patterns

### System Architecture Diagram

```
┌──────────┐ nous.spoke       ┌─────────────────┐
│  Brain A │ ──action────────▶│  NousRunner A   │
└──────────┘                  └────────┬────────┘
                                       │ audit.append('nous.spoke')
                                       ▼
                              ┌─────────────────┐
                              │  AuditChain     │─── head updated ──┐
                              │  (commit, hash) │                   │
                              └────────┬────────┘                   │
                                       │ onAppend listeners fire    │
                                       ▼                            │
┌────────────────────────────────────────────────────────┐          │
│  DialogueAggregator (grid/src/dialogue/aggregator.ts)  │          │
│   • buffer[pairKey] = [{did, text, tick}, ...]         │          │
│   • on nous.spoke: append if same pair, prune > window │          │
│   • getPendingContextFor(did) → DialogueContext | nil  │          │
│   • reset()  (called on WorldClock.pause)              │          │
└────────────────────────┬───────────────────────────────┘          │
                         │ pull-query per tick                      │
                         ▼                                          │
┌────────────────────────────────────────────────────────┐          │
│  GridCoordinator tick loop (grid-coordinator.ts:42-51) │          │
│   foreach runner:                                      │          │
│     ctx = aggregator.getPendingContextFor(runner.did)  │          │
│     runner.tick(tick, epoch, ctx)                      │          │
└────────────────────────┬───────────────────────────────┘          │
                         │                                          │
                         ▼                                          │
┌────────────────────────────────────────────────────────┐          │
│  NousRunner → IBrainBridge.sendTick({..., dialogue_context})│     │
└────────────────────────┬───────────────────────────────┘          │
                         │ JSON-RPC                                 │
                         ▼                                          │
┌────────────────────────────────────────────────────────┐          │
│  Brain (Python) handler.on_tick                        │          │
│   if dialogue_context: reason → maybe emit             │          │
│     TELOS_REFINED action                               │          │
│     payload: {dialogue_id, new_goals[],                │          │
│               before_goal_hash, after_goal_hash}       │          │
└────────────────────────┬───────────────────────────────┘          │
                         │ JSON-RPC response                        │
                         ▼                                          │
┌────────────────────────────────────────────────────────┐          │
│  NousRunner.executeActions case 'telos_refined':       │          │
│    • validate 64-hex regex on both hashes              │          │
│    • drop new_goals (never crosses producer boundary)  │          │
│    • appendTelosRefined(audit, did, {                  │          │
│        before_goal_hash, after_goal_hash,              │          │
│        triggered_by_dialogue_id                        │          │
│      })                                                │          │
└────────────────────────┬───────────────────────────────┘          │
                         │ audit.append (allowlisted, privacy-checked)
                         ▼                                          │
                  AuditChain (position 17) ─ fires SSE ─────────────┘
                                                                    │
                                                                    ▼
                                                        ┌───────────────────────┐
                                                        │ Dashboard firehose    │
                                                        │  & useRefinedTelosHistory
                                                        │  → <TelosRefinedBadge />│
                                                        │  → <DialogueFilterChip /> │
                                                        └───────────────────────┘
```

### Component Responsibilities

| Component | File (new/edit) | Responsibility |
|-----------|-----------------|----------------|
| `DialogueAggregator` | **new** `grid/src/dialogue/aggregator.ts` | Subscribe to `audit.onAppend('nous.spoke')`; window + pair; emit deterministic `DialogueContext`; drain on pause |
| `dialogueIdOf(...)` | **new** `grid/src/dialogue/id.ts` | Pure `sha256(sortedDids|channel|windowStartTick).slice(0,16)` |
| `BrainAction` union | edit `grid/src/integration/types.ts` | Add `{ type: 'telos_refined', dialogue_id, before_goal_hash, after_goal_hash, new_goals }` |
| `TickParams` | edit `grid/src/integration/types.ts` | Widen with optional `dialogue_context?: DialogueContext` |
| `appendTelosRefined` | **new** `grid/src/audit/telos-refined.ts` | Producer helper — drops `new_goals`, enforces hex regex, privacy-checks, appends |
| `NousRunner.executeActions` | edit `grid/src/integration/nous-runner.ts` | Add `case 'telos_refined'` — calls helper |
| `GridCoordinator.onTick` | edit `grid/src/integration/grid-coordinator.ts:42-51` | Pull-query aggregator per-runner before `runner.tick()` |
| `GenesisLauncher` pause hook | edit `grid/src/genesis/launcher.ts` | Call `aggregator.reset()` when `clock.pause()` invoked |
| Broadcast allowlist | edit `grid/src/audit/broadcast-allowlist.ts` | Append `'telos.refined'` at position 17 |
| `ActionType.TELOS_REFINED` | edit `brain/src/noesis_brain/rpc/types.py` | Add enum variant |
| `handler.on_tick` | edit `brain/src/noesis_brain/rpc/handler.py` | Accept `dialogue_context`; reason + emit refined action |
| `_build_refined_telos` | **new** Brain method | Clone `force_telos` hash-before/rebuild/hash-after pattern |
| `<TelosRefinedBadge />` | **new** dashboard component | UI-SPEC §14-28 |
| `useRefinedTelosHistory(did)` | **new** `dashboard/src/lib/hooks/` | Fetch + subscribe per UI-SPEC |
| `<DialogueFilterChip />` | **new** dashboard component | UI-SPEC §46-62; sets `firehose_filter=dialogue_id:<hex>` |
| `TelosSection` | edit `dashboard/src/app/grid/components/inspector-sections/telos.tsx` | Accept new `did: string` prop; render badge |
| `Inspector` | edit `dashboard/src/app/grid/components/inspector.tsx:205` | Pass `did={selectedDid}` to `TelosSection` |

### Pattern 1: Aggregator Listener Subscription

**What:** Use `AuditChain.onAppend` to observe `nous.spoke` commits synchronously after commit.
**When to use:** Always — it's the only listener surface that guarantees post-commit ordering (chain.ts:50-58).

```typescript
// Source: grid/src/audit/chain.ts (existing)
//   append() commits → fires listeners AFTER hash write
//   loadEntries() does NOT fire listeners (important for replay determinism)
//
// Pattern — DialogueAggregator constructor:
constructor(audit: AuditChain, opts: { windowTicks: number; minExchanges: number }) {
    this.#unsub = audit.onAppend((entry) => {
        if (entry.eventType !== 'nous.spoke') return;
        this.#ingest(entry); // deterministic: sorted arrays, no Map iteration
    });
}
```

### Pattern 2: Producer Boundary Helper (mirrors Phase 6)

**What:** Single call-site helper that enforces every invariant at the producer boundary.
**When to use:** Any new audit event type — Phase 6 established this as the pattern.

```typescript
// Source: grid/src/audit/operator-events.ts (existing — appendOperatorEvent pattern)
//
// New helper:
export function appendTelosRefined(
    audit: AuditChain,
    actorDid: string,
    payload: {
        before_goal_hash: string;
        after_goal_hash: string;
        triggered_by_dialogue_id: string;
    },
): AuditEntry {
    // 1. Structural — closed 4-key tuple check (D-06)
    const expectedKeys = ['before_goal_hash', 'after_goal_hash', 'triggered_by_dialogue_id'];
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.join(',') !== expectedKeys.sort().join(','))
        throw new Error('telos.refined: closed 4-key payload violation');

    // 2. Hex regex validation
    const HEX64 = /^[a-f0-9]{64}$/;
    if (!HEX64.test(payload.before_goal_hash)) throw new Error('before_goal_hash: not 64-hex');
    if (!HEX64.test(payload.after_goal_hash))  throw new Error('after_goal_hash: not 64-hex');

    // 3. Dialogue-id regex (16-hex from aggregator)
    if (!/^[a-f0-9]{16}$/.test(payload.triggered_by_dialogue_id))
        throw new Error('triggered_by_dialogue_id: not 16-hex');

    // 4. Privacy — rely on allowlist.payloadPrivacyCheck to reject forbidden keys
    // (covered by test `operator-payload-privacy.test.ts`-style suite)

    // 5. Append — AuditChain enforces allowlist membership
    return audit.append('telos.refined', actorDid, payload);
}
```

### Pattern 3: Widening TickParams additively

**What:** Make `dialogue_context` **optional** so all existing callers stay binary-compatible.

```typescript
// Source: grid/src/integration/types.ts (edit)
export interface TickParams {
    tick: number;
    epoch: number;
    dialogue_context?: DialogueContext; // Phase 7: optional, additive
}
```

Python side mirrors this via `Optional[DialogueContext]` in `handler.on_tick`.

### Anti-Patterns to Avoid

- **Using `Math.random` for `dialogue_id`:** breaks zero-diff invariant — use deterministic `sha256(sortedDids|channel|windowStartTick)`.
- **`for (const k of someMap)` in aggregator:** JS `Map` preserves insertion order, which depends on listener firing order. Use `Array.from(map.keys()).sort()` when iterating.
- **Caching `Date.now()` inside aggregator:** aggregator should be driven by **tick count** from audit entries, not wall clock — `Date.now()` is the one source of non-determinism we spy on in the zero-diff test.
- **Sending `new_goals` across producer boundary:** plaintext goals are Brain-only. `appendTelosRefined` must only accept the 3 hash fields; drop `new_goals` in `executeActions` before calling helper.
- **Per-goal badge attribution:** D-30 rules this out — `compute_active_telos_hash` hashes the whole goal set.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Event listener surface | New event bus for aggregator | `AuditChain.onAppend` (existing) | Commit-ordered, already tested for zero-diff |
| Hash computation | Manual JSON canonicalization | `compute_active_telos_hash` (Brain) + `createHash('sha256')` (Grid for dialogue_id) | Single hash authority per tier |
| Allowlist membership | Parallel event-type registry | `ALLOWLIST` frozen Set (extend tuple) | One source of truth, throw-on-mutate tested |
| Payload validation | Schema library (zod) | Inline `Object.keys().sort()` + regex | Matches Phase 6 style; zero new deps |
| Focus trap in badge tooltip | Custom | Radix Tooltip primitive (existing) | Already used dashboard-wide |
| E2E setup | Manual fixture | Reuse `dashboard/tests/e2e/fixtures/` pattern | Phase 6 established; Playwright harness is ready |

**Key insight:** Phase 7 is a composition phase, not a greenfield phase. Every invariant surface (audit commit, allowlist, privacy check, producer helper, badge render) has an established pattern from Phase 5 or Phase 6 — deviate only where D-* locks require it.

## Runtime State Inventory

(Applies because Phase 7 adds allowlist position + Python enum + dashboard hook.)

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | None — `telos.refined` is additive; existing `AuditChain` entries unchanged | None |
| Live service config | None — no env vars introduced | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | Python `ActionType` enum adds variant → any pickled action cache must invalidate (check `brain/.cache` if present) | Clear Brain action cache on deploy |

**Also:** the `.planning/STATE.md` doc-sync rule fires (CLAUDE.md) — allowlist count moves 16 → 17, so this phase's commit MUST touch `STATE.md`, `README.md`, and `scripts/check-state-doc-sync.mjs` in the same commit.

## Common Pitfalls

### Pitfall 1: Aggregator's `Date.now()` leak

**What goes wrong:** Developer writes `lastSeenAt: Date.now()` in aggregator buffer. Zero-diff test fails intermittently.
**Why it happens:** `Date.now()` is the only wall-clock source in determinism path. `vi.spyOn(Date, 'now')` in the test mocks it, but any NEW use in aggregator creates a determinism surface the test doesn't cover yet.
**How to avoid:** Aggregator takes **tick number** (already in audit entry via `createdAt`). NEVER call `Date.now()` inside aggregator — use `entry.createdAt` or pass a clock reference.
**Warning signs:** Test flakes on parallel runs; byte diff in chain head between runs.

### Pitfall 2: Map iteration order dependence

**What goes wrong:** `for (const [key, buf] of this.#buffers)` iterates in insertion order; insertion order depends on which Nous `spoke` first; test runs with different seed see different `dialogue_id` ordering → different head.
**Why it happens:** JS `Map` is insertion-ordered by spec, but insertion order is a behavioral side-effect of the test scenario.
**How to avoid:** Always `Array.from(this.#buffers.keys()).sort()` before iterating. Use `sortedDids` for `pairKey`.
**Warning signs:** Zero-diff test passes in isolation, fails when combined with other tests.

### Pitfall 3: Forgetting pause drain (D-04)

**What goes wrong:** Operator pauses at tick 3 mid-dialogue; unpauses; aggregator's stale buffer fires context at tick 4 with `windowStartTick=1` → `dialogue_id` encodes pre-pause tick, but the dialogue the Brain sees includes post-pause utterances. Audit forensics becomes ambiguous.
**Why it happens:** `WorldClock.pause()` has no listener API; aggregator is not informed.
**How to avoid:** Own aggregator from `GenesisLauncher`; in the launcher's pause path, call `aggregator.reset()`. Alternative: add `WorldClock.onPause(cb)` — additive, one-line.
**Warning signs:** `Boundary` test with pause-resume sequence shows `dialogue_id` spanning pause boundary.

### Pitfall 4: Allowlist tuple-order drift

**What goes wrong:** Developer appends `'telos.refined'` but forgets existing test `idx('operator.telos_forced') < idx('telos.refined')` — or the tuple-order test itself is missing.
**Why it happens:** Allowlist position is semantic (forensic event ordering), not just membership.
**How to avoid:** Clone `grid/test/audit/broadcast-allowlist.test.ts`'s `it.each` pattern; add tuple-order assertion explicitly.
**Warning signs:** CI flags tuple-order assertion failure.

### Pitfall 5: Plaintext goal leak via Brain response

**What goes wrong:** Brain returns `{action: 'telos_refined', ..., new_goals: [...]}`; developer forgets to strip `new_goals` before calling `appendTelosRefined`; privacy-grep test catches plaintext goal string in `telos.refined` event.
**Why it happens:** Brain ↔ Grid RPC is not hash-only (Brain needs to update its own state); only the producer boundary drops plaintext.
**How to avoid:** Explicit destructure in `executeActions` case — `const { new_goals: _drop, ...hashOnly } = action;` then pass only `hashOnly` fields into helper.
**Warning signs:** Privacy-grep test flags forbidden key.

### Pitfall 6: Missing `did` prop on `TelosSection`

**What goes wrong:** Compile error in Inspector — `TelosSection` requires `did` but parent doesn't pass.
**Why it happens:** Current shape is `TelosSectionProps { telos }` only.
**How to avoid:** Parent `Inspector` at `inspector.tsx:205` already has `selectedDid` in scope — change to `<TelosSection did={selectedDid} telos={state.data.telos} />`.
**Warning signs:** TS build fails on inspector.tsx.

## Code Examples

### 1. Deterministic `dialogue_id`

```typescript
// Source: new grid/src/dialogue/id.ts
import { createHash } from 'node:crypto';

export function dialogueIdOf(
    didA: string,
    didB: string,
    channel: string,
    windowStartTick: number,
): string {
    const [lo, hi] = [didA, didB].sort();
    const payload = `${lo}|${hi}|${channel}|${windowStartTick}`;
    return createHash('sha256').update(payload).digest('hex').slice(0, 16);
}
```

### 2. Zero-diff test template (clone this)

```typescript
// Source pattern: grid/test/audit.test.ts:253-281
// Target: grid/test/dialogue-zero-diff.test.ts
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { AuditChain } from '../src/audit/chain';
import { DialogueAggregator } from '../src/dialogue/aggregator';

const FIXED_TIME = new Date('2026-01-01T00:00:00.000Z').getTime();

describe('Phase 7: dialogue aggregator zero-diff', () => {
    let nowSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => FIXED_TIME);
    });

    afterEach(() => { nowSpy.mockRestore(); });

    function runScenario(attachListeners: number): { head: string; length: number } {
        const audit = new AuditChain();
        const agg = new DialogueAggregator(audit, { windowTicks: 5, minExchanges: 2 });

        // Attach noisy listeners — these must NOT mutate chain state
        for (let i = 0; i < attachListeners; i++) audit.onAppend(() => {});

        // 100-tick scenario with pair A/B speaking on odd ticks
        for (let tick = 1; tick <= 100; tick++) {
            if (tick % 2 === 1) {
                audit.append('nous.spoke', 'did:key:a', { tick, channel: 'c1', text: 'x' });
                audit.append('nous.spoke', 'did:key:b', { tick, channel: 'c1', text: 'y' });
            }
        }
        return { head: audit.head, length: audit.length };
    }

    it('byte-identical chain head with 0 vs 10 listeners', () => {
        const none = runScenario(0);
        const ten  = runScenario(10);
        expect(ten).toEqual(none);
    });
});
```

### 3. Brain `_build_refined_telos` (clones force_telos pattern)

```python
# Source pattern: brain/src/noesis_brain/rpc/handler.py  force_telos() method
# Target: handler.py new method
def _build_refined_telos(self, dialogue_id: str) -> Optional[BrainAction]:
    """Called from on_tick when dialogue_context is present."""
    new_goals = self._reason_about_dialogue(dialogue_id)  # LLM-driven
    if not new_goals:
        return None

    before = compute_active_telos_hash(self.telos.all_goals())
    rebuilt = TelosManager.from_goals(new_goals)
    self.telos = rebuilt
    after = compute_active_telos_hash(self.telos.all_goals())

    if before == after:
        return None  # no change → no event

    return BrainAction(
        type=ActionType.TELOS_REFINED,
        dialogue_id=dialogue_id,
        before_goal_hash=before,
        after_goal_hash=after,
        new_goals=new_goals,  # Grid drops at producer boundary
    )
```

### 4. Allowlist grow (additive)

```typescript
// Source: grid/src/audit/broadcast-allowlist.ts (edit)
export const ALLOWLIST_MEMBERS = [
    // ... existing 16 members in locked order
    'operator.telos_forced',
    'telos.refined', // Phase 7 — position 17
] as const;

export const ALLOWLIST = buildFrozenAllowlist(ALLOWLIST_MEMBERS);
```

### 5. Dashboard hook

```typescript
// Source: new dashboard/src/lib/hooks/use-refined-telos-history.ts
export function useRefinedTelosHistory(did: string | null): RefinedEntry[] {
    const [entries, setEntries] = useState<RefinedEntry[]>([]);
    useEffect(() => {
        if (!did) return;
        const ac = new AbortController();
        fetch(`/api/events?event_type=telos.refined&actor=${encodeURIComponent(did)}`, { signal: ac.signal })
            .then(r => r.json())
            .then(data => setEntries(data.entries ?? []));
        return () => ac.abort();
    }, [did]);
    return entries;
}
```

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (existing) |
| Config file | `grid/vitest.config.ts` (existing) |
| Quick run command | `cd grid && npm test -- dialogue` (new scope) |
| Full suite command | `cd grid && npm test` and `cd dashboard && npm test` and `cd brain && uv run pytest` |

### Determinism Invariants

**Invariant 1 — No new wall-clock sources in aggregator path.**
Enforce with a grep test:

```typescript
// grid/test/dialogue-determinism-source.test.ts
it('aggregator has no Date.now / Math.random / performance.now', async () => {
    const src = await fs.readFile('src/dialogue/aggregator.ts', 'utf8');
    expect(src).not.toMatch(/Date\.now|Math\.random|performance\.now/);
});
```

**Invariant 2 — Chain head byte-identical for 0 vs N listeners.**
Seed: `FIXED_TIME = '2026-01-01T00:00:00.000Z'`, 100 ticks, pair A/B speaking on odd ticks (sample size 100 covers ≥20 dialogue windows given `windowTicks=5`). Assert `expect(ten).toEqual(none)` on `{head, length}`. Template: `grid/test/audit.test.ts:253-281`.

**Invariant 3 — `dialogue_id` is a pure function of sorted inputs.**
```typescript
it('dialogue_id is order-independent over dids', () => {
    expect(dialogueIdOf('did:a', 'did:b', 'c1', 5))
      .toBe(dialogueIdOf('did:b', 'did:a', 'c1', 5));
});
```

### Boundary Tests (windowTicks = 5)

- **N-1 ticks (4 ticks, 2 exchanges):** buffer should NOT fire context (falls inside window, but ticks elapsed < window)
- **N ticks (5 ticks, 2 exchanges):** buffer SHOULD fire context
- **N+1 ticks (6 ticks, exchanges at 1 + 6):** buffer SHOULD NOT fire (tick-1 pruned at tick-6)
- **Exactly minExchanges=2:** fire
- **minExchanges-1 = 1:** do NOT fire
- **>2 exchanges within window:** still one dialogue_id, utterances truncated to 5

### Privacy Invariant

```typescript
// grid/test/telos-refined-privacy.test.ts — clone of operator-payload-privacy.test.ts EVENT_SPECS pattern
const FORBIDDEN = /prompt|response|wiki|reflection|thought|emotion_delta|new_goals|goal_text/i;
it.each([
    { key: 'prompt',        value: 'leaked' },
    { key: 'response',      value: 'leaked' },
    { key: 'new_goals',     value: ['goal text here'] },
    { key: 'reflection',    value: {} },
    { key: 'thought',       value: '' },
    { key: 'emotion_delta', value: 0 },
    // Nested
    { key: 'meta',          value: { prompt: 'nested leak' } },
])('rejects forbidden key $key', ({ key, value }) => {
    expect(() => appendTelosRefined(audit, did, { ...happy, [key]: value } as any))
        .toThrow();
});
// Happy path — 4 locked keys only (D-06)
it('accepts closed 4-key tuple', () => { /* ... */ });
```

Total: 8 cases (6 forbidden flat + 1 nested + 1 happy).

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| DIALOG-01 | Aggregator windows ≥2 exchanges | unit | `npm test -- dialogue-aggregator` | ❌ Wave 0 |
| DIALOG-01 | `dialogue_context` delivered to both Brains | integration | `npm test -- dialogue-tick-integration` | ❌ Wave 0 |
| DIALOG-01 | Zero-diff invariant | unit | `npm test -- dialogue-zero-diff` | ❌ Wave 0 |
| DIALOG-02 | `appendTelosRefined` hex validation | unit | `npm test -- telos-refined` | ❌ Wave 0 |
| DIALOG-02 | Allowlist @ position 17 | unit | `npm test -- broadcast-allowlist` (extend) | ✅ extend |
| DIALOG-02 | Privacy 8-case matrix | unit | `npm test -- telos-refined-privacy` | ❌ Wave 0 |
| DIALOG-02 | Brain emits action w/ hash-before/after | unit (Python) | `uv run pytest tests/test_handler.py::test_telos_refined` | ❌ Wave 0 |
| DIALOG-03 | `<TelosRefinedBadge />` renders when history non-empty | unit (React) | `npm test -- telos-refined-badge` | ❌ Wave 0 |
| DIALOG-03 | `<DialogueFilterChip />` sets filter | e2e (Playwright) | `npx playwright test telos-refined` | ❌ Wave 0 |
| DIALOG-03 | `useRefinedTelosHistory` hook | unit | `npm test -- use-refined-telos-history` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd grid && npm test -- dialogue` (≤ 3 s)
- **Per wave merge:** full tri-tier suite (Grid + Dashboard + Brain)
- **Phase gate:** full suite green + Playwright smoke before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `grid/test/dialogue/aggregator.test.ts` — windowing + pairing (DIALOG-01)
- [ ] `grid/test/dialogue/dialogue-zero-diff.test.ts` — determinism (D-14)
- [ ] `grid/test/dialogue/dialogue-determinism-source.test.ts` — grep invariant
- [ ] `grid/test/dialogue/dialogue-id.test.ts` — id purity
- [ ] `grid/test/audit/telos-refined.test.ts` — helper unit
- [ ] `grid/test/audit/telos-refined-privacy.test.ts` — 8-case
- [ ] `grid/test/audit/broadcast-allowlist.test.ts` — EXTEND to 17
- [ ] `grid/test/integration/dialogue-tick-integration.test.ts` — coordinator wiring
- [ ] `brain/tests/test_handler_telos_refined.py` — Python handler
- [ ] `dashboard/src/lib/hooks/__tests__/use-refined-telos-history.test.ts`
- [ ] `dashboard/src/app/grid/components/__tests__/telos-refined-badge.test.tsx`
- [ ] `dashboard/tests/e2e/telos-refined-badge-and-filter.spec.ts`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | (no new auth surface) |
| V3 Session Management | no | — |
| V4 Access Control | yes | Producer-boundary helper; `nous.*` events restricted to Nous actor DID |
| V5 Input Validation | yes | 64-hex regex on hashes; 16-hex on dialogue_id; closed 4-key tuple |
| V6 Cryptography | yes | `createHash('sha256')` (Node built-in) — never hand-roll |

### Known Threat Patterns for Phase 7 stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Plaintext goal leak via `telos.refined` payload | Information Disclosure | `FORBIDDEN_KEY_PATTERN` in `broadcast-allowlist.ts` + 8-case privacy matrix |
| Forged `dialogue_id` from malicious Brain | Spoofing | Grid recomputes / validates that `triggered_by_dialogue_id` matches an aggregator-emitted id within the Brain's recent dialogue window |
| Hash-length extension forgery on `goal_hash` | Tampering | SHA-256 is not vulnerable to extension via direct use of `createHash` output; regex only accepts 64-hex (rejects truncated/extended) |
| Listener-induced chain divergence (determinism attack) | Tampering | Zero-diff test pins listener independence |
| Pause-spanning dialogue window | Integrity of audit forensics | `aggregator.reset()` on `WorldClock.pause()` (D-04) |
| Denial-of-service via runaway dialogue window (unbounded buffer) | DoS | `windowTicks=5` window forces prune every tick; utterances truncated to 5 × 200-char max |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Coordinator can pull-query aggregator before calling `runner.tick()` without breaking existing tests | Architecture §1 | If push is required, aggregator API shape changes but not invariant set |
| A2 | `GenesisLauncher` is an appropriate owner of aggregator + pause hook | Pitfall #3 | If launcher ownership is wrong, alternative is to add `WorldClock.onPause(cb)` — one-line additive |
| A3 | Brain's `_reason_about_dialogue` LLM call can be mocked deterministically for Brain-side tests | Code Examples §3 | If not, Brain tests degrade to shape-only (still valid for DIALOG-02) |
| A4 | `FORBIDDEN_KEY_PATTERN` already covers `new_goals` and `goal_text` keys | Pitfall #5 | If not, extend the pattern in Phase 7's allowlist edit |

**Confirmations (not assumptions):**

- [VERIFIED: `dashboard/src/app/grid/components/inspector.tsx:69,155,205`] Inspector has `selectedDid` in scope; passing to `TelosSection` is clean
- [VERIFIED: `brain/src/noesis_brain/rpc/handler.py:376`] `force_telos` pattern exists and is the correct template
- [VERIFIED: `brain/src/noesis_brain/telos/hashing.py`] `compute_active_telos_hash` is sole authority; hashes whole goal set (confirms D-30)
- [VERIFIED: `grid/src/audit/chain.ts:50-58`] `onAppend` fires after commit, does NOT fire on replay
- [VERIFIED: `grid/src/integration/grid-coordinator.ts:42-51`] Tick loop integration point
- [VERIFIED: `grid/test/audit.test.ts:253-281`] Exact zero-diff template available for cloning

## Open Questions

1. **Brain-side dialogue memory persistence — does the Brain need to store dialogue_ids it has consumed to avoid double-refinement on replay?**
   - What we know: `compute_active_telos_hash` is idempotent (before == after → no event emitted).
   - What's unclear: whether Brain gets the same `dialogue_context` twice if restart happens mid-window.
   - Recommendation: Brain memoizes `last_processed_dialogue_id` in-memory only; restart cold-starts cleanly because aggregator resets on any orchestrator restart anyway.

2. **Should the aggregator expose `getPendingContextFor(did)` or `drainPending(): Map<did, DialogueContext>`?**
   - What we know: both shapes satisfy D-10.
   - Recommendation: `drainPending()` once per tick in coordinator — avoids repeated calls and makes the pull boundary explicit.

## Sources

### Primary (HIGH confidence)

- `grid/src/audit/chain.ts` lines 50-58 — `onAppend` semantics
- `grid/src/audit/broadcast-allowlist.ts` — frozen-tuple pattern
- `grid/src/audit/operator-events.ts` — `appendOperatorEvent` template
- `grid/src/integration/grid-coordinator.ts` lines 42-51 — tick loop
- `grid/src/integration/nous-runner.ts` lines 111-277 — `executeActions` switch, `handleSpeak`
- `grid/src/integration/types.ts` — `BrainAction`, `TickParams`
- `grid/src/clock/ticker.ts` — pause semantics
- `grid/test/audit.test.ts` lines 253-281 — zero-diff template
- `grid/test/genesis/launcher.tick-audit.test.ts` lines 76-107 — alt template
- `grid/test/worldclock-zero-diff.test.ts` — FIXED_TIME + fake-timer pattern
- `grid/test/audit/broadcast-allowlist.test.ts` — tuple-order assertion pattern
- `grid/test/audit/operator-payload-privacy.test.ts` — `EVENT_SPECS` matrix pattern
- `brain/src/noesis_brain/rpc/types.py` — `ActionType` enum
- `brain/src/noesis_brain/rpc/handler.py` line 376 — `force_telos` template
- `brain/src/noesis_brain/telos/hashing.py` — `compute_active_telos_hash` authority
- `dashboard/src/app/grid/components/inspector.tsx` lines 205, 155, 69 — parent has `selectedDid`
- `dashboard/src/app/grid/components/inspector-sections/telos.tsx` — current shape
- `dashboard/src/app/grid/components/firehose.tsx` — existing filter infrastructure
- `.planning/STATE.md` — doc-sync rule; current allowlist count
- `.planning/phases/07-peer-dialogue-telos-refinement/07-CONTEXT.md` — 32 locked decisions
- `.planning/phases/07-peer-dialogue-telos-refinement/07-UI-SPEC.md` — UI contract
- `PHILOSOPHY.md` §1, §7 — sovereignty, agency tier

### Secondary

- Phase 6 verification reports (`.planning/phases/archived/` if present) — confirm `appendOperatorEvent` pattern battle-tested

### Tertiary

- None required — Phase 7 is composition over verified Phase 5/6 surfaces.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — zero new dependencies; all surfaces verified in repo
- Architecture: HIGH — tick loop, audit listener, producer helper all confirmed by file:line reads
- Pitfalls: HIGH — each pitfall maps to a specific code path or D-* decision
- Validation: HIGH — zero-diff template exists verbatim; boundary tests are mechanical
- Brain integration: MEDIUM — `force_telos` template is verified; `_reason_about_dialogue` implementation detail is discretion zone

**Research date:** 2026-04-20
**Valid until:** 2026-05-20 (Phase 7 target ship date; codebase surfaces stable)

## RESEARCH COMPLETE

**Phase:** 7 — Peer Dialogue → Telos Refinement
**Confidence:** HIGH

### Key Findings

- **Aggregator mechanics** — subscribe to `audit.onAppend('nous.spoke')`; coordinator pulls via `drainPending()` before `runner.tick()`; owned by `GenesisLauncher` to hook pause drain.
- **Producer-boundary discipline** — `appendTelosRefined` helper mirrors Phase 6's `appendOperatorEvent`; drops `new_goals`, enforces 64-hex + 16-hex + closed 4-key tuple invariants.
- **Brain-side hash authority** — `compute_active_telos_hash` is sole truth; `_build_refined_telos` clones the proven `force_telos` hash-before/rebuild/hash-after pattern.
- **Zero-diff test is canonical and copy-paste-ready** — clone `grid/test/audit.test.ts:253-281`; pin `Date.now` with monotonic fake, run 100 ticks, assert byte-identical head at listener counts 0 vs 10.
- **Dashboard plumbing is trivial** — `Inspector` already has `selectedDid` in scope at line 205; passing `did` to `TelosSection` is one line. `<DialogueFilterChip />` composes on existing `useFirehose` filter infrastructure.

### File Created

`.planning/phases/07-peer-dialogue-telos-refinement/07-RESEARCH.md`

### Ready for Planning

Planner has concrete answers to all 12 research questions, a Wave 0 gap list of 12 test files, and a closed set of surfaces to edit/create. No upstream ambiguity remains.
