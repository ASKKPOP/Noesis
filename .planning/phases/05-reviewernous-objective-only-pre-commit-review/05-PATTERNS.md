# Phase 5: ReviewerNous — Objective-Only Pre-Commit Review — Pattern Map

**Mapped:** 2026-04-20
**Files analyzed:** 17 (13 new, 4 modified)
**Analogs found:** 17 / 17

All new files have strong in-repo analogs. Reviewer module mirrors `grid/src/audit/`. Checks mirror `grid/src/logos/engine.ts` dispatch style. Tests mirror `grid/test/audit.test.ts`, `grid/test/broadcast-allowlist.test.ts`, `grid/test/genesis/launcher.tick-audit.test.ts`, and `grid/test/integration/trade-settlement.test.ts`. Brain-side schema extension mirrors the existing `Action.metadata: dict[str, Any]` dataclass contract; TS schema mirrors `TradeRequestAction.metadata`.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `grid/src/review/Reviewer.ts` | service (class, DI, singleton) | request-response | `grid/src/logos/engine.ts` + `grid/src/audit/chain.ts` | role-match |
| `grid/src/review/types.ts` | types (closed unions) | — | `grid/src/audit/types.ts` + `grid/src/registry/registry.ts:119-125` error union | exact |
| `grid/src/review/registry.ts` | utility (self-registering map) | — | `grid/src/logos/engine.ts:14` `laws: Map` + `grid/src/audit/chain.ts:17` `appendListeners: Set` | role-match |
| `grid/src/review/index.ts` | barrel export | — | `grid/src/audit/index.ts` | exact |
| `grid/src/review/checks/balance.ts` | handler (pure function) | transform | `grid/src/registry/registry.ts:126-128,137-139` (insufficient/invalid_amount branches) | exact-logic |
| `grid/src/review/checks/counterparty-did.ts` | handler (pure function) | transform | DID regex at `grid/src/audit/broadcast-allowlist.ts` (pattern style) + `grid/src/registry/registry.ts` spawn site | role-match |
| `grid/src/review/checks/amount.ts` | handler (pure function) | transform | `grid/src/registry/registry.ts:126-128` `Number.isInteger && > 0` | exact-logic |
| `grid/src/review/checks/memory-refs.ts` | handler (pure function) | transform | New format — closest: `FORBIDDEN_KEY_PATTERN` regex declaration pattern | pattern-only |
| `grid/src/review/checks/telos-hash.ts` | handler (pure function) | transform | New format — closest: `FORBIDDEN_KEY_PATTERN` regex declaration + `GENESIS_HASH` 64-hex constant at `grid/src/audit/chain.ts:11` | pattern-only |
| `grid/src/audit/broadcast-allowlist.ts` | config (frozen set) — **MODIFY** | — | itself (line 25 `ALLOWLIST_MEMBERS`) | exact (diff only) |
| `grid/src/integration/types.ts` | types — **MODIFY** | — | itself (lines 44-54 `TradeRequestAction.metadata`) | exact (diff only) |
| `grid/src/integration/nous-runner.ts` | controller (action dispatcher) — **MODIFY** | request-response | itself (lines 117-164 current `trade_request` case) | exact (rewrite) |
| `grid/src/main.ts` | bootstrap (DI wiring) — **MODIFY** | — | itself (lines 65-114 `createGridApp`) + `grid/src/genesis/launcher.ts:40-45` subsystem construction | exact (one-line addition) |
| `grid/test/review/reviewer.test.ts` | test (unit, per-check matrix) | — | `grid/test/audit.test.ts` + `grid/test/logos.test.ts` | exact |
| `grid/test/review/reviewer-singleton.test.ts` | test (unit, singleton throw) | — | `grid/test/audit.test.ts` `beforeEach` + custom | pattern-only |
| `grid/test/review/contract.test.ts` | test (contract, regex-grep + enum coverage) | file-I/O | `grid/test/broadcast-allowlist.test.ts` + new `fs.readFileSync` usage | role-match |
| `grid/test/review/payload-privacy.test.ts` | test (regression) | — | `grid/test/broadcast-allowlist.test.ts:46-123` `payloadPrivacyCheck` cases | exact |
| `grid/test/review/determinism.test.ts` | test (integration, dual-sim) | event-driven | `grid/test/genesis/launcher.tick-audit.test.ts:76-107` `vi.useFakeTimers` dual-run block | exact |
| `grid/test/integration/trade-review.test.ts` | test (integration, end-to-end) | event-driven | `grid/test/integration/trade-settlement.test.ts` | exact |
| `grid/test/broadcast-allowlist.test.ts` | test — **MODIFY** | — | itself (lines 10-43) | exact (diff only) |
| `grid/test/integration/trade-settlement.test.ts` | test fixtures — **MODIFY** | — | itself (lines 83, 127, 157 fixture metadata) | exact (diff only) |
| `brain/src/noesis_brain/rpc/types.py` | types (dict convention) | — | itself (lines 87-102 `Action.metadata: dict[str, Any]`) — no Python diff, brain producers add keys | exact (convention) |
| `brain/src/noesis_brain/telos/hashing.py` | utility (pure function, hashlib) | transform | `grid/src/audit/chain.ts:173-183` `computeHash` (SHA-256 canonical serialization) | role-match |
| `.planning/STATE.md` | docs — **MODIFY** | — | itself (Accumulated Context section) | exact (diff only) |

---

## Pattern Assignments

### `grid/src/review/Reviewer.ts` (service, request-response, singleton)

**Primary analog:** `grid/src/logos/engine.ts` (class placement, Map-backed dispatch loop)
**Secondary analog:** `grid/src/audit/chain.ts` (constructor + `createHash` reuse path)

**Class shape pattern** — mirror `LogosEngine` (grid/src/logos/engine.ts:13-17) and extend with constructor DI + static singleton flag:

```ts
// grid/src/logos/engine.ts:13-17
export class LogosEngine {
    private readonly laws: Map<string, Law> = new Map();

    addLaw(law: Law): void {
        this.laws.set(law.id, law);
    }
```

**Dispatch loop pattern** — mirror `LogosEngine.evaluate()` first-fail-style iteration (grid/src/logos/engine.ts:33-70); Reviewer replaces `for (const law of this.activeLaws())` with `for (const name of CHECK_ORDER)`:

```ts
// grid/src/logos/engine.ts:33-42 (adapt: first-fail-wins on check result)
evaluate(context: ActionContext): EvaluationResult {
    const result: EvaluationResult = { allowed: true, violations: [], warnings: [] };
    for (const law of this.activeLaws()) {
        const matches = this.evaluateCondition(law.ruleLogic.condition, context);
        if (!matches) continue;
        const action = law.ruleLogic.action;
        if (action === 'deny') { ... }
```

**Constructor DI pattern** — mirror `NousRunner` constructor style (grid/src/integration/nous-runner.ts:43-51):

```ts
// grid/src/integration/nous-runner.ts:43-51
constructor(config: NousRunnerConfig) {
    this.nousDid = config.nousDid;
    this.nousName = config.nousName;
    this.bridge = config.bridge;
    this.space = config.space;
    this.audit = config.audit;
    this.registry = config.registry;
    this.economy = config.economy;
}
```

Reviewer uses positional params (simpler — 2 deps, not 7): `constructor(private readonly audit: AuditChain, private readonly registry: NousRegistry)`.

**Singleton enforcement** — no existing analog in grid/src (AuditChain, LogosEngine, NousRegistry are all non-singleton). Synthesize from CONTEXT.md `<specifics>`:

```ts
static readonly DID = 'did:noesis:reviewer';
private static constructed = false;

constructor(...) {
    if (Reviewer.constructed) {
        throw new Error('ReviewerNous is a singleton — already constructed for this Grid');
    }
    Reviewer.constructed = true;
}

/** @internal TEST-ONLY */
static resetForTesting(): void { Reviewer.constructed = false; }
```

**DID constant style** — mirror `GENESIS_HASH` at `grid/src/audit/chain.ts:11`:
```ts
// grid/src/audit/chain.ts:11
const GENESIS_HASH = '0'.repeat(64);
```
Adapt: `static readonly DID = 'did:noesis:reviewer';` (class-level because it's used at emit sites as `Reviewer.DID`).

---

### `grid/src/review/types.ts` (types, closed-union pattern)

**Primary analog:** `grid/src/registry/registry.ts:119-125` (tagged union with `error: 'not_found' | 'insufficient' | 'self_transfer' | 'invalid_amount'`)

**Closed-enum union pattern** — exact style to mirror (grid/src/registry/registry.ts:119-125):

```ts
// grid/src/registry/registry.ts:119-125
transferOusia(
    fromDid: string,
    toDid: string,
    amount: number,
):
    | { success: true; fromBalance: number; toBalance: number }
    | { success: false; error: 'not_found' | 'insufficient' | 'self_transfer' | 'invalid_amount' } {
```

Adapt to `ReviewResult`:
```ts
export type ReviewFailureCode =
    | 'insufficient_balance'
    | 'invalid_counterparty_did'
    | 'non_positive_amount'
    | 'malformed_memory_refs'
    | 'malformed_telos_hash';

export type ReviewResult =
    | { verdict: 'pass' }
    | { verdict: 'fail'; failed_check: ReviewCheckName; failure_reason: ReviewFailureCode };

export type Check = (ctx: ReviewContext) => { ok: true } | { ok: false; code: ReviewFailureCode };
```

**Runtime backstop set** — mirror the `ALLOWLIST` const-set-from-tuple pattern (grid/src/audit/broadcast-allowlist.ts:25-59):

```ts
// grid/src/audit/broadcast-allowlist.ts:59 (pattern only)
export const ALLOWLIST: ReadonlySet<string> = buildFrozenAllowlist(ALLOWLIST_MEMBERS);
```

Adapt:
```ts
export const VALID_REVIEW_FAILURE_CODES: ReadonlySet<ReviewFailureCode> = new Set([
    'insufficient_balance',
    'invalid_counterparty_did',
    'non_positive_amount',
    'malformed_memory_refs',
    'malformed_telos_hash',
] as const);
```

---

### `grid/src/review/registry.ts` (utility, self-registering map)

**Primary analog:** `grid/src/audit/chain.ts:17,76-79` — `appendListeners: Set<AppendListener>` + `onAppend(listener): Unsubscribe` self-registration pattern.

**Self-registration pattern** (grid/src/audit/chain.ts:76-79):

```ts
// grid/src/audit/chain.ts:17,76-79
private readonly appendListeners: Set<AppendListener> = new Set();

onAppend(listener: AppendListener): Unsubscribe {
    this.appendListeners.add(listener);
    return () => this.appendListeners.delete(listener);
}
```

Adapt to module-level (not class-level, since checks self-register at import time):

```ts
// grid/src/review/registry.ts
import type { Check, ReviewCheckName } from './types.js';
export const CHECKS: Map<ReviewCheckName, Check> = new Map();
export const CHECK_ORDER: ReviewCheckName[] = [];

export function registerCheck(name: ReviewCheckName, handler: Check): void {
    if (CHECKS.has(name)) {
        throw new Error(`Check ${name} already registered`);
    }
    CHECKS.set(name, handler);
    CHECK_ORDER.push(name);
}
```

---

### `grid/src/review/checks/balance.ts` (handler, pure function)

**Primary analog:** `grid/src/registry/registry.ts:137-139` (the `insufficient` branch)

**Exact logic to mirror:**
```ts
// grid/src/registry/registry.ts:137-139
if (from.ousia < amount) {
    return { success: false, error: 'insufficient' };
}
```

**Handler shape** (use `registerCheck` self-register pattern):
```ts
// grid/src/review/checks/balance.ts
import { registerCheck } from '../registry.js';

registerCheck('insufficient_balance', (ctx) => {
    return ctx.proposerBalance >= ctx.amount
        ? { ok: true }
        : { ok: false, code: 'insufficient_balance' };
});
```

**Zero subjective keywords** (verify against REV-04 regex `/\b(fairness|wisdom|taste|quality|novelty|good|bad|should)\b/i`) — the above passes.

---

### `grid/src/review/checks/amount.ts` (handler, pure function)

**Primary analog:** `grid/src/registry/registry.ts:126-128`

**Exact logic to mirror:**
```ts
// grid/src/registry/registry.ts:126-128
if (!Number.isInteger(amount) || amount <= 0) {
    return { success: false, error: 'invalid_amount' };
}
```

**Handler:**
```ts
registerCheck('non_positive_amount', (ctx) => {
    return Number.isInteger(ctx.amount) && ctx.amount > 0
        ? { ok: true }
        : { ok: false, code: 'non_positive_amount' };
});
```

---

### `grid/src/review/checks/counterparty-did.ts` (handler, pure function)

**Primary analog:** DID regex is a frozen Phase 1 invariant `/^did:noesis:[a-z0-9_\-]+$/i` (see CONTEXT.md canonical_refs — "DID regex at 3 entry points"). No current entry point shows it as a module-level `const`, so follow the `FORBIDDEN_KEY_PATTERN` declaration style at `grid/src/audit/broadcast-allowlist.ts:70`:

```ts
// grid/src/audit/broadcast-allowlist.ts:70
export const FORBIDDEN_KEY_PATTERN = /prompt|response|wiki|reflection|thought|emotion_delta/i;
```

**Handler:**
```ts
// grid/src/review/checks/counterparty-did.ts
import { registerCheck } from '../registry.js';

const DID_PATTERN = /^did:noesis:[a-z0-9_\-]+$/i;  // Phase 1 invariant — DO NOT widen

registerCheck('invalid_counterparty_did', (ctx) => {
    if (!DID_PATTERN.test(ctx.counterparty)) return { ok: false, code: 'invalid_counterparty_did' };
    if (ctx.counterparty === ctx.proposerDid) return { ok: false, code: 'invalid_counterparty_did' };  // self-transfer
    return { ok: true };
});
```

---

### `grid/src/review/checks/memory-refs.ts` (handler, pure function)

**Primary analog:** Constant-regex + runtime predicate style from `grid/src/audit/broadcast-allowlist.ts:70` combined with `Array.isArray` + `.every(...)` parse pattern from `grid/src/integration/nous-runner.ts:128-130` (metadata parse).

**Parse pattern to mirror** (grid/src/integration/nous-runner.ts:128-130):
```ts
const counterparty = typeof counterpartyRaw === 'string' ? counterpartyRaw : null;
const amount = typeof amountRaw === 'number' && Number.isFinite(amountRaw) ? amountRaw : null;
```

**Handler** (RQ3 locks format as `/^mem:\d+$/`):
```ts
import { registerCheck } from '../registry.js';

const MEM_ID = /^mem:\d+$/;

registerCheck('malformed_memory_refs', (ctx) => {
    const ok = Array.isArray(ctx.memoryRefs)
        && ctx.memoryRefs.length > 0
        && ctx.memoryRefs.every(r => typeof r === 'string' && MEM_ID.test(r));
    return ok ? { ok: true } : { ok: false, code: 'malformed_memory_refs' };
});
```

---

### `grid/src/review/checks/telos-hash.ts` (handler, pure function)

**Primary analog:** 64-char hex constant + regex — see `GENESIS_HASH = '0'.repeat(64)` at `grid/src/audit/chain.ts:11` for length precedent (AuditChain hashes are sha256 hex = 64 chars, matching the telosHash contract).

**Handler:**
```ts
import { registerCheck } from '../registry.js';

const SHA256_HEX = /^[a-f0-9]{64}$/;

registerCheck('malformed_telos_hash', (ctx) => {
    return SHA256_HEX.test(ctx.telosHash)
        ? { ok: true }
        : { ok: false, code: 'malformed_telos_hash' };
});
```

**D-05 Phase 7 watchpoint** — inline comment pointing to Phase 7 TelosRegistry upgrade path.

---

### `grid/src/review/index.ts` (barrel export)

**Primary analog:** `grid/src/audit/index.ts` (exact pattern)

**Full source to mirror:**
```ts
// grid/src/audit/index.ts (complete file)
export { AuditChain } from './chain.js';
export type { AuditEntry, AuditQuery } from './types.js';
```

**Adapt:**
```ts
// grid/src/review/index.ts
export { Reviewer } from './Reviewer.js';
export type { ReviewFailureCode, ReviewCheckName, ReviewContext, ReviewResult, Check } from './types.js';
// DO NOT export registerCheck or resetForTesting — test-only / registration-time API
// DO NOT export ./checks/* — self-register via side-effect imports only
```

**Side-effect import** — Reviewer.ts or index.ts must import each `./checks/*.ts` for registration:
```ts
// grid/src/review/Reviewer.ts (top of file)
import './checks/balance.js';
import './checks/counterparty-did.js';
import './checks/amount.js';
import './checks/memory-refs.js';
import './checks/telos-hash.js';
```

---

### `grid/src/audit/broadcast-allowlist.ts` (MODIFY — one-line addition)

**Self-analog** — the existing `ALLOWLIST_MEMBERS` tuple at lines 25-36:

```ts
// grid/src/audit/broadcast-allowlist.ts:25-36 (CURRENT — 10 entries)
const ALLOWLIST_MEMBERS: readonly string[] = [
    'nous.spawned',
    'nous.moved',
    'nous.spoke',
    'nous.direct_message',
    'trade.proposed',
    'trade.settled',
    'law.triggered',
    'tick',
    'grid.started',
    'grid.stopped',
] as const;
```

**Phase 5 diff** — insert `'trade.reviewed'` between `'trade.proposed'` and `'trade.settled'` (lifecycle ordering):

```ts
    'trade.proposed',
    'trade.reviewed',   // NEW — Phase 5 (REV-02)
    'trade.settled',
```

**DO NOT** touch `buildFrozenAllowlist()` (lines 48-57) — frozen-set invariant protects runtime; the compile-time edit is the only correct mutation path.

---

### `grid/src/integration/types.ts` (MODIFY — `TradeRequestAction.metadata` extension)

**Self-analog** — lines 44-54:

```ts
// grid/src/integration/types.ts:44-54 (CURRENT)
export interface TradeRequestAction {
    action_type: 'trade_request';
    channel: string;
    text: string;
    metadata: {
        counterparty: string;
        amount: number;
        nonce: string;
        [key: string]: unknown;
    };
}
```

**Phase 5 diff** — add 2 required fields:

```ts
export interface TradeRequestAction {
    action_type: 'trade_request';
    channel: string;
    text: string;
    metadata: {
        counterparty: string;
        amount: number;
        nonce: string;
        memoryRefs: string[];    // NEW — Phase 5 (D-05): pre-resolved memory IDs, each `mem:<int>`
        telosHash: string;       // NEW — Phase 5 (D-05): 64-hex SHA-256 of brain's active Telos
        [key: string]: unknown;
    };
}
```

---

### `grid/src/integration/nous-runner.ts` (MODIFY — rewrite `trade_request` case)

**Self-analog** — lines 117-164 (current handler) is the rewrite site.

**Full existing case block to replace** (grid/src/integration/nous-runner.ts:117-164):

```ts
// CURRENT (lines 117-164) — for reference in the plan's read_first
case 'trade_request': {
    // Privacy-first trade settlement (Plan 04-01 D8, Pitfall 4):
    //   - NEVER read action.text or action.channel into the audit payload
    //   - Emit exactly one trade.settled on success with keys
    //     {counterparty, amount, nonce} — nothing else
    //   - Emit exactly one trade.rejected with {reason, nonce} on failure
    const md = action.metadata ?? {};
    const counterpartyRaw = md['counterparty'];
    const amountRaw = md['amount'];
    const nonceRaw = md['nonce'];

    const counterparty = typeof counterpartyRaw === 'string' ? counterpartyRaw : null;
    const amount = typeof amountRaw === 'number' && Number.isFinite(amountRaw) ? amountRaw : null;
    const nonce = typeof nonceRaw === 'string' ? nonceRaw : null;

    if (counterparty === null || amount === null || nonce === null) {
        this.audit.append('trade.rejected', this.nousDid, {
            reason: 'malformed_metadata',
            nonce: nonce ?? null,
        });
        break;
    }

    const bounds = this.economy.validateTransfer(amount);
    if (!bounds.valid) {
        this.audit.append('trade.rejected', this.nousDid, {
            reason: 'bounds',
            nonce,
        });
        break;
    }

    const result = this.registry.transferOusia(this.nousDid, counterparty, amount);
    if (!result.success) {
        this.audit.append('trade.rejected', this.nousDid, {
            reason: result.error,
            nonce,
        });
        break;
    }

    this.audit.append('trade.settled', this.nousDid, {
        counterparty,
        amount,
        nonce,
    });
    break;
}
```

**Rewrite shape (from RESEARCH RQ2):** keep metadata-parse + `trade.rejected{malformed_metadata}` branch; add the 5 new fields; insert `trade.proposed` emit → `reviewer.review()` → `trade.reviewed` emit; break on fail before `bounds`/`transferOusia`; keep the pass-path untouched with a `defensive — unreachable per reviewer invariants` comment on the transferOusia fail branches.

**Constructor DI extension** — mirror existing `NousRunnerConfig` at lines 19-27:
```ts
// grid/src/integration/nous-runner.ts:19-27 (extend by one field)
export interface NousRunnerConfig {
    nousDid: string;
    nousName: string;
    bridge: IBrainBridge;
    space: SpatialMap;
    audit: AuditChain;
    registry: NousRegistry;
    economy: EconomyManager;
    reviewer: Reviewer;    // NEW — Phase 5 (D-02)
}
```

Assignment at constructor body (lines 43-51) — add `this.reviewer = config.reviewer;`.

**Import line to add** at top of file:
```ts
import { Reviewer } from '../review/index.js';
```

---

### `grid/src/main.ts` (MODIFY — Reviewer instantiation at bootstrap)

**Self-analog** — `createGridApp` lines 65-114.

**Insertion pattern** — mirror the launcher-subsystem construction order at `grid/src/genesis/launcher.ts:35-45`:

```ts
// grid/src/genesis/launcher.ts:35-45
this.clock = new WorldClock({...});
this.space = new SpatialMap();
this.logos = new LogosEngine();
this.audit = new AuditChain();
this.economy = new EconomyManager(config.economy);
this.registry = new NousRegistry();
this.shops = new ShopRegistry();
```

**Phase 5 wiring** — insert in `createGridApp` AFTER `launcher.bootstrap()` (line 79) because `Reviewer` needs the launcher's `audit` and `registry`:

```ts
// grid/src/main.ts — insertion after line 79 `launcher.bootstrap({ skipSeedNous: true });`
const reviewer = new Reviewer(launcher.audit, launcher.registry);
// reviewer is threaded through to whatever future plan constructs NousRunner instances.
// For now, document as a TODO at the `getRunner: () => undefined` site (line 113).
```

---

### `grid/test/review/reviewer.test.ts` (test, unit, per-check matrix)

**Primary analog:** `grid/test/audit.test.ts:1-50` (class unit-test shape with `beforeEach`).

**Pattern to mirror** (grid/test/audit.test.ts:1-9):
```ts
// grid/test/audit.test.ts:1-9
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditChain } from '../src/audit/chain.js';

describe('AuditChain', () => {
    let chain: AuditChain;

    beforeEach(() => {
        chain = new AuditChain();
    });
```

**Adapt for Reviewer** — needs singleton reset + fresh deps per test:
```ts
// grid/test/review/reviewer.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Reviewer } from '../../src/review/Reviewer.js';
import { AuditChain } from '../../src/audit/chain.js';
import { NousRegistry } from '../../src/registry/registry.js';
import type { ReviewContext } from '../../src/review/types.js';

describe('Reviewer', () => {
    let reviewer: Reviewer;
    let audit: AuditChain;
    let registry: NousRegistry;

    beforeEach(() => {
        Reviewer.resetForTesting();
        audit = new AuditChain();
        registry = new NousRegistry();
        reviewer = new Reviewer(audit, registry);
    });
    // 5 × 3 unit tests (pass/fail/edge per check) + first-fail-wins assertion
});
```

**Fixture helper** — minimal `makeCtx(overrides)` pattern (justify by the `seedEnv()` precedent at `grid/test/integration/trade-settlement.test.ts:50-69`).

---

### `grid/test/review/reviewer-singleton.test.ts` (test, unit, singleton throw)

**No direct analog** — first singleton-by-construction class. Synthesize from CONTEXT.md D-07 + RESEARCH RQ6.

**Pattern:**
```ts
describe('Reviewer singleton enforcement (D-07)', () => {
    beforeEach(() => { Reviewer.resetForTesting(); });

    it('throws on second construction within same process', () => {
        new Reviewer(new AuditChain(), new NousRegistry());
        expect(() => new Reviewer(new AuditChain(), new NousRegistry()))
            .toThrow(/singleton/i);
    });

    it('resetForTesting clears the flag', () => {
        new Reviewer(new AuditChain(), new NousRegistry());
        Reviewer.resetForTesting();
        expect(() => new Reviewer(new AuditChain(), new NousRegistry())).not.toThrow();
    });
});
```

---

### `grid/test/review/contract.test.ts` (test, file-I/O regex grep)

**Primary analog:** `grid/test/broadcast-allowlist.test.ts:10-43` (frozen-contract enumeration style) + new `fs.readFileSync` for source-body inspection.

**Pattern to mirror** (grid/test/broadcast-allowlist.test.ts:14-27):
```ts
// grid/test/broadcast-allowlist.test.ts:14-27
it.each([
    'nous.spawned',
    'nous.moved',
    // ...
])('allows %s', (eventType) => {
    expect(isAllowlisted(eventType)).toBe(true);
});
```

**Adapt to REV-04 grep:**
```ts
// grid/test/review/contract.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CHECKS, CHECK_ORDER } from '../../src/review/registry.js';

const FORBIDDEN = /\b(fairness|wisdom|taste|quality|novelty|good|bad|should)\b/i;
const CHECKS_DIR = resolve(__dirname, '../../src/review/checks');
const VALID_CODES = new Set([
    'insufficient_balance', 'invalid_counterparty_did', 'non_positive_amount',
    'malformed_memory_refs', 'malformed_telos_hash',
] as const);

describe('REV-04: subjective-check lint gate', () => {
    it('every registered check name is a ReviewFailureCode', () => {
        for (const name of CHECKS.keys()) expect(VALID_CODES.has(name as never)).toBe(true);
    });

    it('registry size equals ReviewFailureCode member count', () => {
        expect(CHECKS.size).toBe(VALID_CODES.size);
    });

    describe('no subjective keywords in handler source', () => {
        for (const name of CHECK_ORDER) {
            it(`checks/${name}.ts contains no subjective keywords`, () => {
                const src = readFileSync(resolve(CHECKS_DIR, `${name}.ts`), 'utf8');
                expect(src).not.toMatch(FORBIDDEN);
            });
        }
    });

    it('CHECK_ORDER enumerates every registered check', () => {
        expect(new Set(CHECK_ORDER)).toEqual(new Set(CHECKS.keys()));
    });
});
```

---

### `grid/test/review/payload-privacy.test.ts` (test, regression)

**Primary analog:** `grid/test/broadcast-allowlist.test.ts:46-123` — every `payloadPrivacyCheck()` regression style.

**Pattern to mirror** (grid/test/broadcast-allowlist.test.ts:46-52):
```ts
// grid/test/broadcast-allowlist.test.ts:46-52
describe('broadcast-allowlist: payloadPrivacyCheck', () => {
    it('passes benign numeric/currency payload', () => {
        expect(payloadPrivacyCheck({ amount: 10, currency: 'ousia' })).toEqual({ ok: true });
    });
```

**Adapt to D-12 trade.reviewed payload** — 6 cases (1 pass + 5 fails × each failure_reason):
```ts
// grid/test/review/payload-privacy.test.ts
import { payloadPrivacyCheck } from '../../src/audit/broadcast-allowlist.js';
import { Reviewer } from '../../src/review/Reviewer.js';

describe('D-12: trade.reviewed payload passes payloadPrivacyCheck', () => {
    it('pass payload', () => {
        expect(payloadPrivacyCheck({
            trade_id: 'nonce-1', reviewer_did: Reviewer.DID, verdict: 'pass',
        })).toEqual({ ok: true });
    });

    it.each(['insufficient_balance','invalid_counterparty_did','non_positive_amount','malformed_memory_refs','malformed_telos_hash'])(
        'fail payload with code=%s is privacy-safe',
        (code) => {
            expect(payloadPrivacyCheck({
                trade_id: 'nonce-1', reviewer_did: Reviewer.DID, verdict: 'fail',
                failed_check: code, failure_reason: code,
            })).toEqual({ ok: true });
        },
    );
});
```

---

### `grid/test/review/determinism.test.ts` (test, dual-sim byte-for-byte)

**Primary analog:** `grid/test/genesis/launcher.tick-audit.test.ts:76-107` — the existing `vi.useFakeTimers` dual-run hash-equality block.

**Full pattern to mirror** (grid/test/genesis/launcher.tick-audit.test.ts:76-107):
```ts
// grid/test/genesis/launcher.tick-audit.test.ts:76-107
it('is idempotent against observer listener count (hash chain unchanged)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const launcherA = makeLauncher();
    launcherA.bootstrap();
    for (let i = 0; i < 100; i++) launcherA.clock.advance();
    const headA = launcherA.audit.head;
    const lengthA = launcherA.audit.length;
    launcherA.stop();

    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const launcherB = makeLauncher();
    launcherB.bootstrap();
    // ... 3 listener observers
    for (let i = 0; i < 100; i++) launcherB.clock.advance();
    const headB = launcherB.audit.head;
    const lengthB = launcherB.audit.length;
    launcherB.stop();

    expect(lengthB).toBe(lengthA);
    expect(headB).toBe(headA);
});
```

**Adapt for D-13 reviewer-ON vs BYPASSED** — cannot compare `head` directly (reviewer injects `trade.reviewed` entries). Instead compare field-by-field after filtering, per RESEARCH RQ5 Option 2:

```ts
// grid/test/review/determinism.test.ts — key excerpt
beforeEach(() => {
    Reviewer.resetForTesting();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
});
afterEach(() => { vi.useRealTimers(); });

it('100-tick sim: reviewer-ON vs BYPASSED diverge only by trade.reviewed entries', async () => {
    // Sim A (reviewer enabled) and Sim B (reviewer omitted from NousRunnerConfig)
    // Same fake-time start, same seeded actions, 100 `clock.advance()` iterations each
    const entriesA = simA.audit.all().filter(e => e.eventType !== 'trade.reviewed');
    const entriesB = simB.audit.all();
    expect(entriesA.length).toBe(entriesB.length);
    for (let i = 0; i < entriesA.length; i++) {
        expect({
            eventType: entriesA[i].eventType,
            actorDid: entriesA[i].actorDid,
            payload: entriesA[i].payload,
            createdAt: entriesA[i].createdAt,
        }).toEqual({
            eventType: entriesB[i].eventType,
            actorDid: entriesB[i].actorDid,
            payload: entriesB[i].payload,
            createdAt: entriesB[i].createdAt,
        });
    }
});
```

**Bypass mechanism** — make `reviewer` an optional field on `NousRunnerConfig` (undefined → skip review block entirely in handler). Production path always injects; test BYPASSED run omits the field.

---

### `grid/test/integration/trade-review.test.ts` (test, end-to-end 3-event flow)

**Primary analog:** `grid/test/integration/trade-settlement.test.ts:1-180` — exact structure: `seedEnv()` helper, `makeBridge()` helper, `NousRunner` construction, `await runner.tick(1, 0)`, `env.audit.query({ eventType: ... })` assertions.

**Fixture helper pattern to mirror** (grid/test/integration/trade-settlement.test.ts:50-69):
```ts
// grid/test/integration/trade-settlement.test.ts:50-69
function seedEnv(): Env {
    const registry = new NousRegistry();
    const audit = new AuditChain();
    const space = new SpatialMap();
    const economy = new EconomyManager({ initialSupply: 100, minTransfer: 1, maxTransfer: 1_000 });
    space.addRegion({ id: 'agora', name: 'Agora', description: 'x', regionType: 'public', capacity: 10, properties: {} });
    registry.spawn({ name: 'Sophia', did: BUYER_DID, publicKey: 'pk-s', region: 'agora' }, 'test.noesis', 0, 100);
    registry.spawn({ name: 'Hermes', did: SELLER_DID, publicKey: 'pk-h', region: 'agora' }, 'test.noesis', 0, 50);
    return { registry, audit, space, economy };
}
```

**Adapt for Phase 5** — extend `Env` with `reviewer: Reviewer`; action fixtures carry `memoryRefs` and `telosHash`:

```ts
function seedEnv(): Env {
    // ... existing 4 deps
    Reviewer.resetForTesting();
    const reviewer = new Reviewer(audit, registry);
    return { registry, audit, space, economy, reviewer };
}

// Assertion pattern — mirror trade-settlement.test.ts:97-119
it('pass path emits 3-event flow in order', async () => {
    const action: BrainAction = {
        action_type: 'trade_request',
        channel: '', text: '',
        metadata: {
            counterparty: SELLER_DID, amount: 42, nonce: 'nonce-1',
            memoryRefs: ['mem:1', 'mem:2'], telosHash: 'a'.repeat(64),
        },
    };
    // ... build runner with reviewer, await tick ...
    const proposed = env.audit.query({ eventType: 'trade.proposed' });
    const reviewed = env.audit.query({ eventType: 'trade.reviewed' });
    const settled = env.audit.query({ eventType: 'trade.settled' });
    expect(proposed).toHaveLength(1);
    expect(reviewed).toHaveLength(1);
    expect(settled).toHaveLength(1);
    expect(reviewed[0].payload.verdict).toBe('pass');
    expect(reviewed[0].actorDid).toBe(Reviewer.DID);
    // ordering
    expect(proposed[0].id).toBeLessThan(reviewed[0].id);
    expect(reviewed[0].id).toBeLessThan(settled[0].id);
});
```

5 additional `it()` cases — one per failure_reason.

---

### `grid/test/broadcast-allowlist.test.ts` (MODIFY — size + it.each table)

**Self-analog** — lines 10-43 of the file itself.

**Diff 1** — size assertion 10 → 11 (2 call sites, lines 11 and 42):
```ts
// Line 11
expect(ALLOWLIST.size).toBe(10);  // → 11

// Line 42
expect(ALLOWLIST.size).toBe(10);  // → 11
```

**Diff 2** — add `'trade.reviewed'` to the `it.each` allowed-events table at lines 14-24, alphabetically-by-lifecycle between `trade.proposed` and `trade.settled` to match the source allowlist ordering.

---

### `grid/test/integration/trade-settlement.test.ts` (MODIFY — fixture extension)

**Self-analog** — 3 action fixtures at lines 83, 127, 157.

**Diff** — each fixture's `metadata` gains `memoryRefs` and `telosHash`:
```ts
// line 83 current:
metadata: { counterparty: SELLER_DID, amount: 42, nonce: 'nonce-1' },

// line 83 Phase 5:
metadata: {
    counterparty: SELLER_DID, amount: 42, nonce: 'nonce-1',
    memoryRefs: ['mem:1'], telosHash: 'a'.repeat(64),
},
```

All three test runners must also receive a `reviewer` (via `seedEnv`) so the new handler compiles — OR the tests switch to BYPASSED mode via undefined `reviewer` field (coordinate with the `NousRunnerConfig.reviewer?: Reviewer` optional field decision in the planner).

---

### `brain/src/noesis_brain/rpc/types.py` (NO Python diff — convention only)

**Self-analog** — `Action` dataclass at lines 87-102:

```python
# brain/src/noesis_brain/rpc/types.py:87-102
@dataclass
class Action:
    """An action produced by the brain for the protocol layer to execute."""
    action_type: ActionType
    channel: str = ""
    text: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)
```

**No class change** — `metadata: dict[str, Any]` already accepts the new keys. Phase 5 adds a **convention**: any producer emitting `ActionType.TRADE_REQUEST` MUST populate `metadata["memoryRefs"]: list[str]` and `metadata["telosHash"]: str`. Enforce via:
1. Grid-side `trade.rejected{malformed_metadata}` on missing keys (already in the nous-runner rewrite path)
2. A new brain-side contract test in `brain/test/` asserting any trade-request producer sets both keys

**Brain producer update** — wherever the brain builds trade_request Actions (identify during planning — `Grep("TRADE_REQUEST", brain/src)` found only the enum at types.py:16 and the test at test_rpc_types.py; the actual producer is downstream of `ActionType.TRADE_REQUEST` usage — ripgrep during planning). The producer pulls `memory.id` from `Memory` at `brain/src/noesis_brain/memory/types.py:40` and prefixes: `[f"mem:{m.id}" for m in refs]`. Telos hash comes from the new `telos/hashing.py` module.

---

### `brain/src/noesis_brain/telos/hashing.py` (NEW — pure utility)

**Primary analog:** `grid/src/audit/chain.ts:173-183` — `AuditChain.computeHash` canonical-serialize-then-sha256 pattern.

**Pattern to mirror:**
```ts
// grid/src/audit/chain.ts:173-183
static computeHash(prevHash, eventType, actorDid, payload, timestamp): string {
    const data = `${prevHash}|${eventType}|${actorDid}|${JSON.stringify(payload)}|${timestamp}`;
    return createHash('sha256').update(data).digest('hex');
}
```

**Adapt to Python** (per RESEARCH RQ3):
```python
# brain/src/noesis_brain/telos/hashing.py
import hashlib
import json
from .types import Goal

def compute_active_telos_hash(goals: list[Goal]) -> str:
    """Deterministic 64-hex SHA-256 over active goals only.

    Canonicalization MUST stay in sync with any Grid-side verification code.
    Phase 7 TelosRegistry will import this symbol directly.
    """
    active = [
        {
            "description": g.description,
            "goal_type": g.goal_type.value,
            "status": g.status.value,
            "priority": g.priority,
            "progress": g.progress,
        }
        for g in goals
        if g.is_active()
    ]
    canon = json.dumps(active, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canon.encode("utf-8")).hexdigest()
```

---

### `.planning/STATE.md` (MODIFY — doc drift reconciliation per D-11)

No code analog — this is a planning-doc edit. The pattern is a search-and-replace in the "Accumulated Context" section:
- `10 events` → `11 events` (in allowlist count reference)
- Add `nous.direct_message` to the enumeration (currently missing)
- Remove any `trade.countered` reference (phantom — zero code producers)
- Add `trade.reviewed` to the enumeration after `trade.proposed`

---

## Shared Patterns

### Pattern S1: Privacy-at-Producer-Boundary Emit
**Source:** `grid/src/integration/nous-runner.ts:117-164` (current trade_request) + `grid/src/audit/broadcast-allowlist.ts:70` (FORBIDDEN_KEY_PATTERN)
**Apply to:** `grid/src/integration/nous-runner.ts` rewrite — both `trade.proposed` and `trade.reviewed` emit sites.

Exact discipline to copy (nous-runner.ts:158-162):
```ts
this.audit.append('trade.settled', this.nousDid, {
    counterparty, amount, nonce,   // explicit keys — never spread or pass raw metadata
});
```

For Phase 5: the new `trade.proposed` payload is `{ counterparty, amount, nonce, memoryRefs, telosHash }` — all 5 safe keys (verified: none match `/prompt|response|wiki|reflection|thought|emotion_delta/i`). The new `trade.reviewed` payload is `{ trade_id, reviewer_did, verdict }` on pass, `{ ..., failed_check, failure_reason }` on fail.

---

### Pattern S2: Closed-Enum String-Literal Union for Error Codes
**Source:** `grid/src/registry/registry.ts:119-125` (transferOusia error union)
**Apply to:** `grid/src/review/types.ts` `ReviewFailureCode` + the emit-site assertion in `nous-runner.ts`.

```ts
// grid/src/registry/registry.ts:119-125 — canonical pattern
| { success: false; error: 'not_found' | 'insufficient' | 'self_transfer' | 'invalid_amount' }
```

Adapt: type-system is the compile-time gate; `VALID_REVIEW_FAILURE_CODES` Set is the runtime-JSON-boundary backstop (RESEARCH RQ8).

---

### Pattern S3: Constructor Dependency Injection
**Source:** `grid/src/integration/nous-runner.ts:19-51` (`NousRunnerConfig` interface + assignment in constructor)
**Apply to:** Extend `NousRunnerConfig` with `reviewer: Reviewer`; Reviewer's own constructor takes `(audit: AuditChain, registry: NousRegistry)` positionally (simpler, 2 deps).

---

### Pattern S4: Frozen Readonly Collection (compile-time-edit, runtime-immutable)
**Source:** `grid/src/audit/broadcast-allowlist.ts:25,48-57,59`
**Apply to:** Allowlist addition (diff line 25-36) + `VALID_REVIEW_FAILURE_CODES` in review/types.ts.

Key invariant to carry: the Set is *built from a source tuple at module-load time*; never mutated at runtime. The frozen-override on `.add/.delete/.clear` throws `TypeError` to make accidental mutation fail fast.

---

### Pattern S5: Vitest Fake-Timer for Hash-Chain Determinism
**Source:** `grid/test/genesis/launcher.tick-audit.test.ts:22,76-107`
**Apply to:** `grid/test/review/determinism.test.ts` (D-13).

Invariant: `AuditChain.computeHash` includes `createdAt = Date.now()` in its SHA-256 input. Any test asserting byte-equality across two independent runs MUST call `vi.useFakeTimers()` + `vi.setSystemTime(...)` before bootstrapping each run.

---

### Pattern S6: Integration Test `seedEnv()` Helper
**Source:** `grid/test/integration/trade-settlement.test.ts:43-69`
**Apply to:** `grid/test/integration/trade-review.test.ts` (extend `Env` with `reviewer`, call `Reviewer.resetForTesting()` before construction).

Also applicable to `grid/test/review/reviewer.test.ts` in its `beforeEach`.

---

### Pattern S7: `it.each` Closed-Set Enumeration for Frozen Contracts
**Source:** `grid/test/broadcast-allowlist.test.ts:14-27` (enumerates all 10 allowlist members)
**Apply to:** `grid/test/review/contract.test.ts` (enumerates the 5 check names / failure codes) and the modified `broadcast-allowlist.test.ts` (now 11 members).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `grid/src/review/Reviewer.ts` singleton flag | class-static-flag enforcement | — | First singleton-by-construction class in the Grid. Pattern synthesized from CONTEXT.md D-07 + RESEARCH RQ6; test-isolation `resetForTesting()` is new. |
| `grid/test/review/contract.test.ts` `readFileSync` source inspection | file-I/O in a test | file-I/O | No current Grid test reads its own source files. Pattern is Vitest+Node stdlib canonical; research verified viability at RESEARCH RQ7. |
| `brain/src/noesis_brain/telos/hashing.py` canonical JSON hashing | Python pure utility | transform | No existing Python module uses `json.dumps(sort_keys=True) + hashlib.sha256` in this codebase. Pattern is stdlib-canonical; research locked at RESEARCH RQ3. |

---

## Metadata

**Analog search scope:** `grid/src/**`, `grid/test/**`, `brain/src/noesis_brain/**` (rpc, memory, telos), `.planning/phases/archived/v2.0/**` for frozen contracts.
**Files scanned:** 17 source files read (end-to-end or targeted slices), 5 test files read (end-to-end or targeted slices), plus directory listings.
**Pattern extraction date:** 2026-04-20

---

*Phase: 05-reviewernous-objective-only-pre-commit-review*
