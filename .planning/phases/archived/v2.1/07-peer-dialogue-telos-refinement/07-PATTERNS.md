# Phase 7: Peer Dialogue → Telos Refinement - Pattern Map

**Mapped:** 2026-04-21
**Files analyzed:** 31 (4 grid-new, 5 grid-modified, 7 grid-tests, 5 brain, 6 dashboard-new, 4 dashboard-modified)
**Analogs found:** 31 / 31

## File Classification

### Grid — New Files

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `grid/src/dialogue/aggregator.ts` | service (listener + pull-query) | event-driven → batch | `grid/src/audit/chain.ts` (onAppend) + `grid/src/integration/grid-coordinator.ts` (tick loop) | role-match (new shape) |
| `grid/src/dialogue/dialogue-id.ts` | utility (pure hash) | transform | `grid/src/audit/operator-events.ts` HEX64_RE guard + `grid/src/api/operator/telos-force.ts` hashing | role-match |
| `grid/src/dialogue/types.ts` | type module | n/a | `grid/src/integration/types.ts` | exact |
| `grid/src/audit/append-telos-refined.ts` | utility (producer-boundary) | request-response | `grid/src/audit/operator-events.ts` `appendOperatorEvent` | exact |

### Grid — Modified Files

| Modified File | Role | Data Flow | Change |
|---------------|------|-----------|--------|
| `grid/src/integration/grid-coordinator.ts` | orchestrator | event-driven | inject aggregator.drainPending into per-runner tick |
| `grid/src/integration/nous-runner.ts` | controller | request-response | add `case 'telos_refined'` branch; thread `dialogue_context` into `tickWithContext` |
| `grid/src/integration/types.ts` | type module | n/a | extend `BrainAction` union + `TickParams.dialogue_context?` |
| `grid/src/audit/broadcast-allowlist.ts` | config (frozen tuple) | n/a | add `'telos.refined'` as 17th member |
| `grid/src/genesis/launcher.ts` + types | wiring | n/a | construct `DialogueAggregator`, pass to coordinator |

### Grid — New Tests

| Test File | Role | Analog |
|-----------|------|--------|
| `grid/test/dialogue/aggregator.test.ts` | unit (window logic) | `grid/test/audit/operator-event-invariant.test.ts` (enumeration shape) |
| `grid/test/dialogue/dialogue-id.test.ts` | unit (determinism) | `grid/test/audit/chain.test.ts` (hash determinism) |
| `grid/test/dialogue/producer-boundary.test.ts` | unit (invariant) | `grid/test/audit/operator-event-invariant.test.ts` |
| `grid/test/dialogue/zero-diff.test.ts` | unit (listener determinism) | `grid/test/audit.test.ts` lines 253-281 |
| `grid/test/dialogue/telos-refined-privacy.test.ts` | unit (privacy gate) | `grid/test/audit/operator-payload-privacy.test.ts` |
| `grid/test/dialogue/allowlist-17.test.ts` | unit (frozen-tuple) | `grid/test/audit/broadcast-allowlist.test.ts` |
| `grid/test/dialogue/boundary.test.ts` | integration | `grid/test/integration/agency-integration.test.ts` |

### Brain — Files

| File | Role | Change | Analog |
|------|------|--------|--------|
| `brain/src/noesis_brain/rpc/types.py` | enum | add `TELOS_REFINED = "telos_refined"` | existing `ActionType.FORCE_TELOS` sibling |
| `brain/src/noesis_brain/rpc/handler.py` | controller | extend `on_tick` dialogue branch; add `_build_refined_telos` | `handler.force_telos` lines 376-414 |
| `brain/test/test_telos_refined_action.py` | unit | `brain/test/test_handler_agency.py` |
| `brain/test/test_dialogue_context_consumption.py` | unit | `brain/test/test_handler_agency.py` |
| `brain/test/fixtures/dialogue_context.py` | fixture | in-file helpers in `test_handler_agency.py` |

### Dashboard — New Files

| File | Role | Analog |
|------|------|--------|
| `dashboard/src/components/dialogue/telos-refined-badge.tsx` | component | `dashboard/src/components/agency/agency-indicator.tsx` |
| `dashboard/src/lib/hooks/use-refined-telos-history.ts` | hook | `dashboard/src/lib/stores/firehose-store.ts` subscribe pattern (composed, not cloned) |
| `dashboard/src/lib/hooks/use-firehose-filter.ts` | hook | existing filter state in `firehose.tsx` |
| `dashboard/src/app/grid/components/firehose-filter-chip.tsx` | component | `dashboard/src/components/primitives/chip.tsx` wrapper |
| `dashboard/src/components/dialogue/telos-refined-badge.test.tsx` | unit | `dashboard/src/components/agency/agency-indicator.test.tsx` |
| `dashboard/src/app/grid/components/firehose-filter-chip.test.tsx` | unit | existing firehose tests |
| `dashboard/src/lib/hooks/use-refined-telos-history.test.ts` | unit | existing hook tests |

### Dashboard — Modified Files

| File | Change |
|------|--------|
| `dashboard/src/components/primitives/chip.tsx` | extend `ChipColor` union + color-class map with `'dialogue'` |
| `dashboard/src/app/grid/components/inspector-sections/telos.tsx` | add `did` prop + refined badge in heading |
| `dashboard/src/app/grid/components/firehose.tsx` | integrate filter chip + dim-not-hide |
| `dashboard/src/components/primitives/__tests__/chip.test.tsx` | add `'dialogue'` color case |

### Doc-sync Files

| File | Change |
|------|--------|
| `scripts/check-state-doc-sync.mjs` | bump 16→17, append `'telos.refined'` |
| `.planning/STATE.md` | update "16 events" → "17 events", add `telos.refined` |
| `README.md` | bump allowlist-count promise if present |
| `PHILOSOPHY.md` | add hash-only cross-boundary invariant (if worldview-level) |

---

## Pattern Assignments

### `grid/src/audit/append-telos-refined.ts` (utility, producer-boundary)

**Analog:** `grid/src/audit/operator-events.ts` (primary) + `grid/src/api/operator/telos-force.ts` (HEX64_RE)

**Pattern to copy** (from `operator-events.ts`):
```typescript
export function appendOperatorEvent(
    audit: AuditChain,
    eventType: `operator.${string}`,
    actorDid: string,
    payload: OperatorEventPayload,
    targetDid?: string,
): AuditEntry {
    const tierCheck = requireTierInPayload(eventType, payload);
    if (!tierCheck.ok) throw new TypeError(`operator-events: ${tierCheck.reason}`);
    const privacy = payloadPrivacyCheck(payload);
    if (!privacy.ok) throw new TypeError(`operator-events: privacy violation — ${privacy.reason}`);
    return audit.append(eventType, actorDid, payload, targetDid);
}
```

**Divergence:**
- No tier check (D-19: telos.refined is Nous-initiated, no H-tier stamp).
- Enforce closed 4-key tuple via explicit object destructure — no spread.
- Two hash fields guarded by `HEX64_RE = /^[0-9a-f]{64}$/` (copy from `telos-force.ts`).
- `triggered_by_dialogue_id` guarded by `DIALOGUE_ID_RE = /^[0-9a-f]{16}$/`.
- Reuse `payloadPrivacyCheck` verbatim.

---

### `grid/src/dialogue/aggregator.ts` (service, event-driven → pull-query)

**Analog:** `grid/src/audit/chain.ts` (listener surface) + `grid/src/integration/grid-coordinator.ts` (tick iteration)

**Pattern to copy** — AuditChain listener subscription (from `chain.ts`):
```typescript
this.audit.onAppend((entry) => {
    if (entry.event_type !== 'nous.spoke') return;
    this.ingestSpoke(entry);
});
```

**Pattern to copy** — pull-query drain into tick loop (from `grid-coordinator.ts` lines 42-51):
```typescript
this.launcher.clock.onTick(async (event) => {
    const { tick, epoch } = event;
    const tickPromises = [...this.runners.values()].map(runner =>
        runner.tick(tick, epoch).catch(err => log.error(...))
    );
    await Promise.all(tickPromises);
});
```

**Divergence:**
- Aggregator state is per-pair-key bucket: `Map<string, SpokeWindow>`.
- `pair_key = [sortedDids.join('|'), channel, windowStartTick].join('|')`.
- `drainPending(did, tick)`: return completed windows where `exchanges >= minExchanges && tick - windowStartTick <= windowTicks`, then delete.
- Config injected via constructor `{ windowTicks: 5, minExchanges: 2 }` (D-10, D-11).
- Listener registered once at construction; never unsubscribes within grid lifetime.

---

### `grid/src/dialogue/dialogue-id.ts` (utility, transform)

**Analog:** `grid/src/api/operator/telos-force.ts` (hashing pattern) + `operator-events.ts` HEX64_RE style

**Pattern to copy:**
```typescript
import { createHash } from 'node:crypto';

const DIALOGUE_ID_RE = /^[0-9a-f]{16}$/;

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

**Divergence:** Deterministic, collision-probability < 2^-64 for expected N. Pure function — no imports from grid internals.

---

### `grid/src/dialogue/types.ts`

**Analog:** `grid/src/integration/types.ts`

**Pattern to copy** — discriminated-union + readonly object style already used throughout `integration/types.ts`. Add:
```typescript
export interface DialogueContext {
    readonly dialogue_id: string;
    readonly counterparty_did: string;
    readonly channel: string;
    readonly exchange_count: number;
    readonly window_start_tick: number;
}

export interface SpokeWindow {
    readonly pair_key: string;
    readonly window_start_tick: number;
    readonly exchanges: number;
    readonly dids: readonly string[];
    readonly channel: string;
}
```

**Divergence:** None — copies existing conventions.

---

### `grid/src/integration/nous-runner.ts` (modify — new action case)

**Analog:** `executeActions` `case 'trade_request'` (existing, lines 138-268)

**Pattern to copy** (typed metadata narrowing + silent-drop + explicit destructure):
```typescript
case 'telos_refined': {
    const md = action.metadata ?? {};
    const dialogueId = typeof md['triggered_by_dialogue_id'] === 'string' ? md['triggered_by_dialogue_id'] : '';
    const beforeHash = typeof md['before_goal_hash'] === 'string' ? md['before_goal_hash'] : '';
    const afterHash = typeof md['after_goal_hash'] === 'string' ? md['after_goal_hash'] : '';

    if (!this.recentDialogueIds.has(dialogueId)) {
        log.warn({ dialogueId, nous: this.nousDid }, 'telos_refined dropped — dialogue_id unknown');
        break;
    }

    try {
        appendTelosRefined(this.audit, this.nousDid, {
            did: this.nousDid,
            before_goal_hash: beforeHash,
            after_goal_hash: afterHash,
            triggered_by_dialogue_id: dialogueId,
        });
    } catch (err) {
        log.warn({ err, nous: this.nousDid }, 'telos_refined rejected by producer-boundary');
    }
    break;
}
```

**Divergence:**
- `recentDialogueIds` is a small rolling set (N=100) maintained by the runner, populated whenever a DialogueContext is delivered to the brain — prevents forgery of unknown dialogue_ids.
- No broadcast wiring — `audit.append` → listeners fire on allowlisted events.

---

### `grid/src/integration/grid-coordinator.ts` (modify — inject context)

**Analog:** existing onTick loop lines 42-51

**Pattern to copy + modify:**
```typescript
this.launcher.clock.onTick(async (event) => {
    const { tick, epoch } = event;
    const tickPromises = [...this.runners.values()].map(runner => {
        const ctx = this.aggregator.drainPending(runner.nousDid, tick);
        return runner.tick(tick, epoch, ctx).catch(err => log.error({ err }, 'runner tick failed'));
    });
    await Promise.all(tickPromises);
});
```

**Divergence:** Single additive line `const ctx = this.aggregator.drainPending(...)`. `ctx` may be empty array — runner handles undefined/empty.

---

### `grid/src/integration/types.ts` (modify — union extend)

**Analog:** existing `BrainAction` discriminated union + `TickParams`

**Pattern to copy:**
```typescript
export interface TelosRefinedAction {
    readonly action_type: 'telos_refined';
    readonly metadata: {
        readonly before_goal_hash: string;
        readonly after_goal_hash: string;
        readonly triggered_by_dialogue_id: string;
    };
}

export type BrainAction = /* existing */ | TelosRefinedAction;

export interface TickParams {
    readonly tick: number;
    readonly epoch: string;
    readonly memory?: readonly MemoryEntry[]; // Phase 6
    readonly dialogue_context?: readonly DialogueContext[]; // Phase 7
}
```

**Divergence:** Purely additive — matches Phase 6 `memory?:` precedent.

---

### `grid/src/audit/broadcast-allowlist.ts` (modify — frozen tuple)

**Analog:** existing frozen-tuple allowlist construction

**Pattern to modify:**
```typescript
export const ALLOWLIST_MEMBERS = Object.freeze([
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
    'operator.inspected',
    'operator.paused',
    'operator.resumed',
    'operator.law_changed',
    'operator.telos_forced',
    'telos.refined', // Phase 7 addition — 17th member
] as const);
```

**Divergence:** One-line insertion; all downstream `buildFrozenAllowlist`, `FORBIDDEN_KEY_PATTERN`, `payloadPrivacyCheck` reused unchanged.

---

### `grid/src/genesis/launcher.ts` (modify — wiring)

**Analog:** existing component construction + coordinator handoff

**Pattern to add:**
```typescript
const aggregator = new DialogueAggregator(audit, { windowTicks: 5, minExchanges: 2 });
const coordinator = new GridCoordinator({ /* existing */, aggregator });
```

**Divergence:** Single-line construction; aggregator is constructor-injected into coordinator.

---

### `grid/test/dialogue/aggregator.test.ts` (unit, window logic)

**Analog:** `grid/test/audit/operator-event-invariant.test.ts` (enumeration shape)

**Pattern to copy:**
```typescript
describe('DialogueAggregator', () => {
    let chain: AuditChain;
    let aggregator: DialogueAggregator;
    beforeEach(() => {
        chain = new AuditChain();
        aggregator = new DialogueAggregator(chain, { windowTicks: 5, minExchanges: 2 });
    });

    it.each([
        { exchanges: 1, expected: 0, case: 'below minExchanges' },
        { exchanges: 2, expected: 1, case: 'at minExchanges' },
        { exchanges: 5, expected: 1, case: 'above minExchanges' },
    ])('drains $case → $expected windows', ({ exchanges, expected }) => {
        for (let i = 0; i < exchanges; i++) {
            chain.append('nous.spoke', 'did:noesis:a', { channel: 'ch', text_hash: 'x'.repeat(64) });
            chain.append('nous.spoke', 'did:noesis:b', { channel: 'ch', text_hash: 'y'.repeat(64) });
        }
        const ctx = aggregator.drainPending('did:noesis:a', 10);
        expect(ctx).toHaveLength(expected);
    });
});
```

**Divergence:** Tests aggregator state machine; distinct from allowlist invariants.

---

### `grid/test/dialogue/dialogue-id.test.ts` (unit, determinism)

**Analog:** hash-determinism tests in `grid/test/audit/chain.test.ts`

**Pattern to copy:**
```typescript
describe('computeDialogueId', () => {
    it('is order-independent over DIDs', () => {
        const a = computeDialogueId(['did:noesis:a', 'did:noesis:b'], 'ch', 100);
        const b = computeDialogueId(['did:noesis:b', 'did:noesis:a'], 'ch', 100);
        expect(a).toBe(b);
    });

    it('matches DIALOGUE_ID_RE', () => {
        const id = computeDialogueId(['did:noesis:x', 'did:noesis:y'], 'ch', 42);
        expect(id).toMatch(/^[0-9a-f]{16}$/);
    });

    it('differs on any input change', () => {
        const base = computeDialogueId(['did:noesis:a', 'did:noesis:b'], 'ch', 10);
        expect(computeDialogueId(['did:noesis:a', 'did:noesis:b'], 'ch2', 10)).not.toBe(base);
        expect(computeDialogueId(['did:noesis:a', 'did:noesis:b'], 'ch', 11)).not.toBe(base);
    });
});
```

**Divergence:** Pure function test — no audit/chain.

---

### `grid/test/dialogue/producer-boundary.test.ts` (invariant)

**Analog:** `grid/test/audit/operator-event-invariant.test.ts` structural template

**Pattern to copy** (`it.each` + regex throw assertion):
```typescript
describe('appendTelosRefined — producer boundary', () => {
    let chain: AuditChain;
    beforeEach(() => { chain = new AuditChain(); });

    const VALID = {
        did: 'did:noesis:a',
        before_goal_hash: 'a'.repeat(64),
        after_goal_hash: 'b'.repeat(64),
        triggered_by_dialogue_id: 'c'.repeat(16),
    };

    it('accepts well-formed payload', () => {
        expect(() => appendTelosRefined(chain, 'did:noesis:a', VALID)).not.toThrow();
    });

    it.each([
        ['before_goal_hash too short', { ...VALID, before_goal_hash: 'ab' }, /hex64/i],
        ['after_goal_hash non-hex', { ...VALID, after_goal_hash: 'Z'.repeat(64) }, /hex64/i],
        ['dialogue_id too short', { ...VALID, triggered_by_dialogue_id: 'abc' }, /dialogue_id/i],
        ['extra key', { ...VALID, extra: 'nope' }, /extra key|unexpected key/i],
    ])('rejects %s', (_, payload, re) => {
        expect(() => appendTelosRefined(chain, 'did:noesis:a', payload as any)).toThrow(re);
    });
});
```

**Divergence:** Shape check + hex-regex discipline; no tier dimension.

---

### `grid/test/dialogue/zero-diff.test.ts` (listener determinism)

**Analog:** `grid/test/audit.test.ts` lines 253-281 (clone verbatim, swap event type)

**Pattern to copy:**
```typescript
describe('DialogueAggregator zero-diff invariant', () => {
    it('0 vs 10 listeners → byte-identical chain.head after 100 spoke appends', () => {
        const nowSpy = vi.spyOn(Date, 'now');
        let fakeNow = 1_700_000_000_000;
        nowSpy.mockImplementation(() => { fakeNow += 1; return fakeNow; });

        const runSim = (listenerCount: number): string[] => {
            const chain = new AuditChain();
            const aggregator = new DialogueAggregator(chain, { windowTicks: 5, minExchanges: 2 });
            for (let i = 0; i < listenerCount; i++) chain.onAppend(() => {});
            for (let i = 0; i < 100; i++) {
                chain.append('nous.spoke', `did:noesis:${i % 4}`, { channel: 'c', text_hash: String(i).padStart(64, '0') });
            }
            return chain.entries.map(e => e.hash);
        };

        const withNone = runSim(0);
        const withTen = runSim(10);
        expect(withTen).toEqual(withNone);
        nowSpy.mockRestore();
    });
});
```

**Divergence:** Swap `law.triggered`/`trade.proposed` (in the Phase 5 original) for `nous.spoke`; aggregator subscription is one of the listeners in `withTen`.

---

### `grid/test/dialogue/telos-refined-privacy.test.ts` (privacy gate)

**Analog:** `grid/test/audit/operator-payload-privacy.test.ts`

**Pattern to copy** (happyPayload + mustNotContain enumeration):
```typescript
const happyPayload = {
    did: 'did:noesis:a',
    before_goal_hash: 'a'.repeat(64),
    after_goal_hash: 'b'.repeat(64),
    triggered_by_dialogue_id: 'c'.repeat(16),
};

const FORBIDDEN_CASES = [
    ['prompt', { prompt: 'leak' }],
    ['response', { response: 'leak' }],
    ['wiki', { wiki: 'leak' }],
    ['reflection', { reflection: 'leak' }],
    ['thought', { thought: 'leak' }],
    ['emotion_delta', { emotion_delta: 0.5 }],
    ['new_goals', { new_goals: ['goal'] }],
    ['telos_yaml', { telos_yaml: 'raw' }],
];

describe.each(FORBIDDEN_CASES)('telos.refined privacy — rejects %s', (_, extra) => {
    it('throws on forbidden key', () => {
        const chain = new AuditChain();
        expect(() => appendTelosRefined(chain, 'did:noesis:a', { ...happyPayload, ...extra } as any))
            .toThrow(/privacy|forbidden|unexpected/i);
    });
});
```

**Divergence:** 1 event × 8 cases = 8 tests (vs 5 events × 8 = 40 for Phase 6).

---

### `grid/test/dialogue/allowlist-17.test.ts` (frozen tuple)

**Analog:** `grid/test/audit/broadcast-allowlist.test.ts`

**Pattern to copy:**
```typescript
describe('broadcast allowlist — Phase 7 invariant', () => {
    it('contains exactly 17 members', () => {
        expect(ALLOWLIST_MEMBERS).toHaveLength(17);
    });
    it('contains telos.refined at position 17', () => {
        expect(ALLOWLIST_MEMBERS[16]).toBe('telos.refined');
    });
    it('is frozen', () => {
        expect(Object.isFrozen(ALLOWLIST_MEMBERS)).toBe(true);
    });
});
```

**Divergence:** None — follows Phase 6's 16-count invariant test one-for-one.

---

### `brain/src/noesis_brain/rpc/types.py` (modify — Enum extend)

**Analog:** existing ActionType Enum

**Pattern to modify:**
```python
class ActionType(str, Enum):
    SPEAK = "speak"
    MOVE = "move"
    TRADE_REQUEST = "trade_request"
    # ... existing members ...
    FORCE_TELOS = "force_telos"  # Phase 6 (operator-only path)
    TELOS_REFINED = "telos_refined"  # Phase 7 — Nous-initiated
```

**Divergence:** Single-line addition; matches `FORCE_TELOS` sibling.

---

### `brain/src/noesis_brain/rpc/handler.py` (modify — dialogue branch + builder)

**Analog:** `force_telos` method lines 376-414

**Pattern to copy** (hash-only RPC response building):
```python
def _build_refined_telos(self, dialogue_ctx: DialogueContext) -> Optional[Action]:
    telos_hash_before = compute_active_telos_hash(self.telos.all_goals())
    proposed = self._llm_refine_telos(dialogue_ctx)
    if proposed is None:
        return None
    rebuilt = TelosManager.merge(self.telos, proposed)
    self.telos = rebuilt
    telos_hash_after = compute_active_telos_hash(self.telos.all_goals())
    if telos_hash_before == telos_hash_after:
        return None  # no-op refinement
    return Action(
        action_type=ActionType.TELOS_REFINED,
        metadata={
            "before_goal_hash": telos_hash_before,
            "after_goal_hash": telos_hash_after,
            "triggered_by_dialogue_id": dialogue_ctx.dialogue_id,
        },
    )
```

**Pattern to copy** (on_tick dialogue consumption):
```python
async def on_tick(self, params: TickParams) -> TickResponse:
    actions: list[Action] = []
    # ... existing psyche/thymos/speech path ...
    for ctx in (params.dialogue_context or []):
        refined = self._build_refined_telos(ctx)
        if refined is not None:
            actions.append(refined)
    return TickResponse(actions=actions)
```

**Divergence:**
- Hash computed both sides via single authority `compute_active_telos_hash` (D-20).
- `new_goals` plaintext NEVER appended to `actions` metadata; only hash + dialogue_id cross the boundary.
- Silent no-op when `before == after` (D-22).

---

### `brain/test/test_telos_refined_action.py` (unit)

**Analog:** `brain/test/test_handler_agency.py`

**Pattern to copy** (fixture helpers + action assertion):
```python
def test_telos_refined_action_emits_hash_only():
    handler = _make_handler()
    handler.telos = _make_telos(goals=["original"])
    ctx = DialogueContext(
        dialogue_id="c" * 16,
        counterparty_did="did:noesis:b",
        channel="ch",
        exchange_count=2,
        window_start_tick=10,
    )
    params = TickParams(tick=15, epoch="e1", dialogue_context=[ctx])
    response = await handler.on_tick(params)

    refined = [a for a in response.actions if a.action_type == ActionType.TELOS_REFINED]
    assert len(refined) == 1
    md = refined[0].metadata
    assert set(md.keys()) == {"before_goal_hash", "after_goal_hash", "triggered_by_dialogue_id"}
    assert len(md["before_goal_hash"]) == 64
    assert len(md["after_goal_hash"]) == 64
    assert md["triggered_by_dialogue_id"] == "c" * 16
    for forbidden in ("new_goals", "goals", "telos_yaml", "prompt", "response"):
        assert forbidden not in md
```

**Divergence:** Assertion focused on closed 4-key tuple + hash-only invariant.

---

### `brain/test/test_dialogue_context_consumption.py` (unit)

**Analog:** `brain/test/test_handler_agency.py`

**Pattern to copy:**
```python
async def test_dialogue_context_triggers_refine_attempt():
    handler = _make_handler()
    resp_empty = await handler.on_tick(TickParams(tick=1, epoch="e", dialogue_context=None))
    assert not any(a.action_type == ActionType.TELOS_REFINED for a in resp_empty.actions)
    ctx = _make_dialogue_context()
    resp = await handler.on_tick(TickParams(tick=2, epoch="e", dialogue_context=[ctx]))
    assert handler._refine_attempts == 1
```

**Divergence:** Focuses on branch invocation — LLM mocked.

---

### `dashboard/src/components/primitives/chip.tsx` (modify — add color variant)

**Analog:** existing `ChipColor` union + `COLOR_CLASSES` map

**Pattern to modify:**
```typescript
export type ChipColor = 'neutral' | 'blue' | 'amber' | 'red' | 'muted' | 'dialogue';

const COLOR_CLASSES: Record<ChipColor, string> = {
    neutral: 'bg-neutral-800 border-neutral-700 text-neutral-200',
    blue:    'bg-sky-900/30 border-sky-400 text-sky-200',
    amber:   'bg-amber-900/30 border-amber-400 text-amber-200',
    red:     'bg-red-900/30 border-red-400 text-red-200',
    muted:   'bg-neutral-900 border-neutral-800 text-neutral-500',
    dialogue: 'bg-[#17181C] border border-[#818CF8] text-[#818CF8] font-medium', // UI-SPEC: indigo-400
};
```

**Divergence:** One row addition; color tokens from UI-SPEC `#818CF8`, weight 500.

---

### `dashboard/src/components/dialogue/telos-refined-badge.tsx` (new component)

**Analog:** `dashboard/src/components/agency/agency-indicator.tsx` (verbatim useSyncExternalStore + Chip + focus-ring structure, lines 40-78)

**Pattern to copy:**
```typescript
'use client';
import { Chip } from '@/components/primitives/chip';
import { useRefinedTelosHistory } from '@/lib/hooks/use-refined-telos-history';

export function TelosRefinedBadge({ did }: { did: string }): React.ReactElement | null {
    const history = useRefinedTelosHistory(did);
    if (history.length === 0) return null;
    const latest = history[history.length - 1];
    const ariaLabel = `Telos refined ${history.length} time${history.length === 1 ? '' : 's'}. Latest: dialogue ${latest.triggered_by_dialogue_id.slice(0, 8)}.`;
    return (
        <span
            role="status"
            aria-label={ariaLabel}
            data-testid="telos-refined-badge"
        >
            <Chip label={`Refined ×${history.length}`} color="dialogue" testId="telos-refined-chip" />
        </span>
    );
}
```

**Divergence:**
- No tooltip (UI-SPEC §5 — hover-only count, no interactive modal in Phase 7).
- Returns `null` on empty history (badge absent, not a muted variant).
- Subscribes via composed hook, not directly to a store.

---

### `dashboard/src/lib/hooks/use-refined-telos-history.ts` (new hook)

**Analog:** `dashboard/src/lib/stores/firehose-store.ts` subscribe/getSnapshot pattern (composed over, not cloned)

**Pattern to copy** (composition, not store-creation):
```typescript
import { useMemo } from 'react';
import { useFirehose } from './use-firehose';

export interface RefinedTelosEntry {
    readonly tick: number;
    readonly before_goal_hash: string;
    readonly after_goal_hash: string;
    readonly triggered_by_dialogue_id: string;
}

export function useRefinedTelosHistory(did: string): readonly RefinedTelosEntry[] {
    const firehose = useFirehose();
    return useMemo(
        () => firehose
            .filter(e => e.event_type === 'telos.refined' && e.actor_did === did)
            .map(e => ({
                tick: e.tick,
                before_goal_hash: e.payload.before_goal_hash,
                after_goal_hash: e.payload.after_goal_hash,
                triggered_by_dialogue_id: e.payload.triggered_by_dialogue_id,
            })),
        [firehose, did],
    );
}
```

**Divergence:** Derived selector, not new subscription — avoids double-subscribe to same WebSocket.

---

### `dashboard/src/lib/hooks/use-firehose-filter.ts` (new hook)

**Analog:** existing filter-state pattern in `firehose.tsx` (useState + filter predicate)

**Pattern to copy:**
```typescript
import { useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

const DIALOGUE_ID_RE = /^[0-9a-f]{16}$/;

export function useFirehoseFilter(): {
    dialogueIdFilter: string | null;
    clearFilter: () => void;
} {
    const params = useSearchParams();
    const raw = params.get('firehose_filter');
    let dialogueIdFilter: string | null = null;
    if (raw?.startsWith('dialogue_id:')) {
        const id = raw.slice('dialogue_id:'.length);
        if (DIALOGUE_ID_RE.test(id)) dialogueIdFilter = id;
    }
    const clearFilter = useCallback(() => {
        // Router pushes URL without the param
    }, []);
    return { dialogueIdFilter, clearFilter };
}
```

**Divergence:** Reads from Next.js search params; validates against 16-hex regex per D-29.

---

### `dashboard/src/app/grid/components/firehose-filter-chip.tsx` (new)

**Analog:** `dashboard/src/components/primitives/chip.tsx` + button wrapper from `agency-indicator.tsx`

**Pattern to copy:**
```typescript
'use client';
import { Chip } from '@/components/primitives/chip';
import { useFirehoseFilter } from '@/lib/hooks/use-firehose-filter';

export function FirehoseFilterChip(): React.ReactElement | null {
    const { dialogueIdFilter, clearFilter } = useFirehoseFilter();
    if (!dialogueIdFilter) return null;
    return (
        <div data-testid="firehose-filter-chip" className="flex items-center gap-2">
            <Chip label={`Dialogue ${dialogueIdFilter.slice(0, 8)}…`} color="dialogue" />
            <button
                type="button"
                aria-label="Clear dialogue filter"
                onClick={clearFilter}
                data-testid="firehose-filter-clear"
                className="focus:outline-none focus:ring-2 focus:ring-indigo-400 text-neutral-400 hover:text-neutral-200"
            >×</button>
        </div>
    );
}
```

**Divergence:** Renders only when filter is active; × clears via router push.

---

### `dashboard/src/app/grid/components/inspector-sections/telos.tsx` (modify)

**Analog:** existing section structure (heading + content)

**Pattern to copy + modify:**
```typescript
export function TelosSection({ did, goals }: { did: string; goals: Goal[] }): React.ReactElement {
    return (
        <section aria-labelledby="telos-heading">
            <div className="flex items-center justify-between">
                <h3 id="telos-heading" className="text-sm font-medium text-neutral-200">Telos</h3>
                <TelosRefinedBadge did={did} />
            </div>
            {/* existing goals list */}
        </section>
    );
}
```

**Divergence:** Additive `did` prop; badge is null-guarded for 0-refinement case.

---

### `dashboard/src/app/grid/components/firehose.tsx` (modify)

**Analog:** existing filter empty-state + list render

**Pattern to modify** (dim-not-hide per UI-SPEC §8):
```typescript
const { dialogueIdFilter } = useFirehoseFilter();
const matches = (e: FirehoseEvent) => !dialogueIdFilter || (
    e.event_type === 'telos.refined'
        ? e.payload?.triggered_by_dialogue_id === dialogueIdFilter
        : false
);
return (
    <div>
        <FirehoseFilterChip />
        <ul data-testid="firehose-list">
            {events.map(e => (
                <li
                    key={e.hash}
                    className={matches(e) ? '' : 'opacity-40'}
                    data-testid="firehose-event"
                    data-dimmed={matches(e) ? 'false' : 'true'}
                >
                    {/* existing row */}
                </li>
            ))}
        </ul>
    </div>
);
```

**Divergence:** `opacity-40` + `data-dimmed` for screen readers; no filter => no dim.

---

### `scripts/check-state-doc-sync.mjs` (modify — bump 16→17)

**Analog:** the existing script itself (count assertion + required array)

**Pattern to modify:**
```javascript
// Update count regex:
if (!/17\s+events/i.test(state)) {
  failures.push('STATE.md does not mention "17 events" — Phase 7 allowlist count assertion missing.');
}

// Append to required array:
const required = [
  'nous.spawned', 'nous.moved', 'nous.spoke', 'nous.direct_message',
  'trade.proposed', 'trade.reviewed', 'trade.settled',
  'law.triggered', 'tick', 'grid.started', 'grid.stopped',
  'operator.inspected', 'operator.paused', 'operator.resumed',
  'operator.law_changed', 'operator.telos_forced',
  'telos.refined', // Phase 7 addition
];
```

**Divergence:** Two-line edit; doc-sync comment block at top should mention "Phase 7 bumped allowlist to 17 events."

---

## Shared Patterns

### Producer-Boundary Discipline
**Source:** `grid/src/audit/operator-events.ts` `appendOperatorEvent`
**Apply to:** `grid/src/audit/append-telos-refined.ts`
**Shape:**
```typescript
function appendX(audit, did, payload) {
    validateShape(payload);       // closed tuple + hex regex
    validatePrivacy(payload);     // payloadPrivacyCheck
    return audit.append(eventType, did, payload, targetDid);
}
```

### Privacy Gate
**Source:** `grid/src/audit/broadcast-allowlist.ts` `payloadPrivacyCheck` + `FORBIDDEN_KEY_PATTERN`
**Apply to:** All Phase 7 producer helpers (1: `appendTelosRefined`) + all Phase 7 brain action emitters
**Invariant:** No key matching `/prompt|response|wiki|reflection|thought|emotion_delta/i` ever reaches audit.

### Hex-Regex Runtime Guard
**Source:** `grid/src/api/operator/telos-force.ts` HEX64_RE
**Apply to:** `append-telos-refined.ts` (64-hex × 2 fields) + `dialogue-id.ts` (16-hex × 1)

### Discriminated Union Extension
**Source:** `grid/src/integration/types.ts` existing `BrainAction`
**Apply to:** `TelosRefinedAction` union member + Python `ActionType.TELOS_REFINED` Enum member

### Zero-Diff Listener Test Template
**Source:** `grid/test/audit.test.ts` lines 253-281
**Apply to:** `grid/test/dialogue/zero-diff.test.ts`
**Invariant:** Any listener added under AuditChain MUST NOT mutate chain.head.

### useSyncExternalStore + Chip + Focus Ring
**Source:** `dashboard/src/components/agency/agency-indicator.tsx`
**Apply to:** `telos-refined-badge.tsx` + `firehose-filter-chip.tsx`

### Doc-Sync Regression Gate
**Source:** `scripts/check-state-doc-sync.mjs` (Phase 5 / D-11)
**Apply to:** Phase 7 allowlist bump
**Invariant:** Script count literal, required-array membership, and STATE.md text must all be updated in one commit.

---

## No Analog Found

None. Every Phase 7 file has a concrete existing precedent in the codebase.

---

## Metadata

**Analog search scope:** `grid/src/**`, `grid/test/**`, `brain/src/**`, `brain/test/**`, `dashboard/src/**`, `scripts/**`
**Files scanned:** ~80 (via Glob + targeted Read with offset/limit)
**Key analogs used:** `operator-events.ts`, `broadcast-allowlist.ts`, `chain.ts`, `grid-coordinator.ts`, `nous-runner.ts`, `audit.test.ts` (zero-diff), `operator-event-invariant.test.ts`, `operator-payload-privacy.test.ts`, `handler.py force_telos`, `test_handler_agency.py`, `agency-indicator.tsx`, `firehose-store.ts`, `chip.tsx`, `check-state-doc-sync.mjs`
**Pattern extraction date:** 2026-04-21
