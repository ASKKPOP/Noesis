---
phase: 11
plan_slug: 02-emitter-router
wave_number: 2
type: execute
gap_closure: false
depends_on: [11-00-setup, 11-01-crypto]
files_modified:
  - grid/src/whisper/appendNousWhispered.ts
  - grid/src/whisper/rate-limit.ts
  - grid/src/whisper/router.ts
  - grid/src/whisper/pending-store.ts
  - grid/src/integration/nous-runner.ts
  - grid/test/whisper/whisper-wire-format.test.ts
  - grid/test/whisper/whisper-rate-limit.test.ts
  - grid/test/whisper/whisper-tombstone.test.ts
  - grid/test/whisper/whisper-router.test.ts
  - grid/test/whisper/whisper-producer-boundary.test.ts
autonomous: true
requirements: [WHISPER-03, WHISPER-05]
must_haves:
  truths:
    - "grid/src/whisper/appendNousWhispered.ts is the SOLE producer of 'nous.whispered' audit events; producer-boundary grep test (W0 RED stub) flips GREEN"
    - "appendNousWhispered enforces 8-step validation (DID_RE on actor + from_did + to_did, self-report invariant actorDid===payload.from_did, tick non-negative-int, ciphertext_hash HEX64, closed-tuple sort-equality on 4 keys ['ciphertext_hash','from_did','tick','to_did'], explicit cleanPayload reconstruction, payloadPrivacyCheck belt) — clones appendBiosBirth.ts discipline verbatim"
    - "WhisperRouter.route() runs locked side-effect order: (1) DID regex both sides → (2) tombstone check (silent reject per D-11-18, NO audit emit, NO 410, NO log) → (3) rate-limit consume → (4) appendNousWhispered → (5) pendingStore.enqueue — fails fast at any step"
    - "WhisperRouter constructor takes injected deps {audit, registry, rateLimiter, pendingStore} — no global singletons"
    - "TickRateLimiter accepts B=10 sends per N=100 ticks per sender DID; env-overridable via WHISPER_RATE_BUDGET / WHISPER_RATE_WINDOW_TICKS; prunes entries older than (currentTick - N) on every consume; reset() wipes history (Phase 7 D-04 pause-safe clone)"
    - "@fastify/rate-limit DDoS belt is engaged at the ROUTE layer (Wave 3 routes.ts mounts it); this wave documents the integration contract but does NOT mount routes — emitter+router are runtime-callable via nous-runner.ts whisper_send case"
    - "PendingStore is an in-memory Map<recipient_did, Envelope[]>; ackDelete(did, envelope_ids) removes acknowledged envelopes; bios.death listener evicts the entire queue for tombstoned DIDs (D-11-17 GC clause); zero MySQL/disk persistence"
    - "Tombstone silent-drop tested explicitly: post-death whisper to OR from a tombstoned DID returns false from router; assertions confirm zero audit chain growth and zero log lines"
    - "grid/src/integration/nous-runner.ts executeActions switch handles case 'whisper_send' near line 200, routing to WhisperRouter.route(); transport-error fallback mirrors trade_request pattern"
    - "Wave 0 RED stubs whisper-wire-format.test.ts, whisper-rate-limit.test.ts, whisper-producer-boundary.test.ts all GREEN; new whisper-tombstone.test.ts and whisper-router.test.ts both GREEN"
    - "No file under grid/src/whisper/ contains Date.now, Math.random, performance.now, setTimeout, setInterval; check-wallclock-forbidden.mjs exits 0"
  artifacts:
    - path: "grid/src/whisper/appendNousWhispered.ts"
      provides: "Sole-producer emitter — 8-step validation clone of appendBiosBirth.ts"
      contains: "WHISPERED_KEYS"
    - path: "grid/src/whisper/rate-limit.ts"
      provides: "TickRateLimiter — Map<senderDid, number[]> sliding-window prune; tryConsume/reset"
      contains: "rateBudget"
    - path: "grid/src/whisper/router.ts"
      provides: "WhisperRouter — locked side-effect order: validate → tombstone → ratelimit → emit → enqueue"
      contains: "appendNousWhispered"
    - path: "grid/src/whisper/pending-store.ts"
      provides: "PendingStore — in-memory Map<recipientDid, Envelope[]>; enqueue/drainFor/ackDelete; bios.death GC"
      contains: "Map<string"
    - path: "grid/src/integration/nous-runner.ts"
      provides: "executeActions switch case 'whisper_send' routes to WhisperRouter.route()"
      contains: "whisper_send"
  key_links:
    - from: "grid/src/whisper/router.ts"
      to: "grid/src/whisper/appendNousWhispered.ts"
      via: "Router calls appendNousWhispered as step 4 of locked side-effect order"
      pattern: "appendNousWhispered"
    - from: "grid/src/whisper/router.ts"
      to: "grid/src/whisper/pending-store.ts"
      via: "Router calls pendingStore.enqueue as step 5 (after audit emit)"
      pattern: "pendingStore.enqueue"
    - from: "grid/src/integration/nous-runner.ts"
      to: "grid/src/whisper/router.ts"
      via: "executeActions switch whisper_send case calls router.route(envelope)"
      pattern: "WhisperRouter"
    - from: "grid/src/whisper/pending-store.ts"
      to: "grid/src/registry/tombstone"
      via: "bios.death audit listener triggers store.evictDid(tombstonedDid)"
      pattern: "bios.death"
    - from: "grid/src/whisper/rate-limit.ts"
      to: "grid/src/whisper/config.ts"
      via: "TickRateLimiter reads DEFAULT_WHISPER_CONFIG.rateBudget / rateWindowTicks (W0 frozen consts with env override)"
      pattern: "DEFAULT_WHISPER_CONFIG"
---

<objective>
Land the Grid-side whisper production pipeline: sole-producer emitter `appendNousWhispered.ts` (clones `appendBiosBirth.ts` 8-step validation discipline), tick-indexed `TickRateLimiter`, `WhisperRouter` orchestrating the locked side-effect order (validate → tombstone-respect → rate-limit → emit → enqueue), in-memory `PendingStore` with `bios.death` GC, and a `whisper_send` case in `nous-runner.ts` executeActions switch. Flip the three Wave 0 RED stubs (producer-boundary, wire-format, rate-limit) to GREEN; add two new GREEN tests for tombstone silent-drop and router orchestration.

Purpose: Establish that exactly ONE file emits `nous.whispered` and that emission obeys the same closed-tuple, hash-only, DID-regex, self-report-invariant, payloadPrivacyCheck-gated discipline that protects every other audit event in the project. The router locks the side-effect order so post-death whispers vanish silently (no 410, no audit, no log per D-11-18) and rate-limit rejects bypass crypto + storage entirely. After this wave, the Grid can produce ciphertext envelopes deterministically — no API surface yet (Wave 3) and no decrypt path on the Brain (Wave 3 wires sender/receiver/aggregator).

Output: 4 new Grid source files (emitter + rate-limiter + router + pending-store), 1 modified Grid integration file (nous-runner.ts), 5 Grid test files (3 RED-stub-flipped-GREEN + 2 new GREEN). Zero new allowlist entries (W0 already added the slot). Zero changes to scripts. Crypto wiring lives in Brain (Wave 3 sender encrypts before envelope reaches the router); this wave assumes the router receives a pre-encrypted envelope produced by the Brain side.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/11-mesh-whisper/11-CONTEXT.md
@.planning/phases/11-mesh-whisper/11-RESEARCH.md
@.planning/phases/11-mesh-whisper/11-PATTERNS.md
@.planning/phases/11-mesh-whisper/11-VALIDATION.md
@.planning/phases/11-mesh-whisper/11-00-setup/PLAN.md
@.planning/phases/11-mesh-whisper/11-01-crypto/PLAN.md
@grid/src/bios/appendBiosBirth.ts
@grid/src/bios/appendBiosDeath.ts
@grid/test/bios/bios-producer-boundary.test.ts
@grid/src/api/operator/delete-nous.ts
@grid/src/relationships/storage.ts
@grid/src/integration/nous-runner.ts

<interfaces>
<!-- Contracts the executor builds against. All shipped in Wave 0 / Wave 1 already. -->

**From W0 grid/src/whisper/types.ts (DO NOT redefine):**
```ts
export interface NousWhisperedPayload {
  readonly ciphertext_hash: string;
  readonly from_did: string;
  readonly tick: number;
  readonly to_did: string;
}
export const WHISPERED_KEYS = ['ciphertext_hash', 'from_did', 'tick', 'to_did'] as const;

export interface Envelope {
  readonly to_did: string;
  readonly from_did: string;       // sender visible per D-11-06 (no sealed-sender this phase)
  readonly tick: number;
  readonly nonce_b64: string;      // 32 chars (24 bytes base64)
  readonly ephemeral_pub_b64: string;
  readonly ciphertext_b64: string;
  readonly envelope_id: string;    // Brain-generated UUID for ack dedup
  readonly ciphertext_hash: string; // HEX64
}
```

**From W0 grid/src/whisper/config.ts (DO NOT redefine):**
```ts
export const DEFAULT_WHISPER_CONFIG = Object.freeze({
  rateBudget: Number(process.env.WHISPER_RATE_BUDGET) || 10,
  rateWindowTicks: Number(process.env.WHISPER_RATE_WINDOW_TICKS) || 100,
  envelopeVersion: 1,
} as const);
```

**From shipped grid/src/audit/broadcast-allowlist.ts (W0 bumped to 22 events):**
```ts
// Position 22 = 'nous.whispered'
export const ALLOWLIST_MEMBERS = [..., 'nous.whispered'] as const;
export const WHISPER_FORBIDDEN_KEYS = Object.freeze(['text','body','content','message','utterance','offer','amount','ousia','price','value','plaintext','decrypted','payload_plain'] as const);
export function payloadPrivacyCheck(payload: unknown): {ok: boolean; offendingPath?: string; offendingKeyword?: string};
export function audit_append(eventType: AllowlistMember, actorDid: string, payload: object): void;  // exact signature TBD — match what appendBiosBirth uses
```

**From shipped grid/src/bios/appendBiosBirth.ts — VERBATIM clone target. Key constants:**
```ts
export const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;
export const HEX64_RE = /^[0-9a-f]{64}$/;

// 8-step body shape (lines ~45-115):
// 1. assert(DID_RE.test(actorDid)) — else throw
// 2. assert(DID_RE.test(payload.from_did)) — else throw
// 3. assert(actorDid === payload.from_did) — self-report invariant
// 4. assert(Number.isInteger(payload.tick) && payload.tick >= 0)
// 5. assert(HEX64_RE.test(payload.ciphertext_hash))
// 6. assert(JSON.stringify(Object.keys(payload).sort()) === JSON.stringify([...WHISPERED_KEYS].sort()))
// 7. const cleanPayload = { ciphertext_hash: payload.ciphertext_hash, from_did: payload.from_did, tick: payload.tick, to_did: payload.to_did };
// 8. const privCheck = payloadPrivacyCheck(cleanPayload); if (!privCheck.ok) throw ...
//    audit.append('nous.whispered', actorDid, cleanPayload);
```

**WhisperRouter contract (NEW — this wave):**
```ts
export interface WhisperRouterDeps {
  readonly audit: AuditChain;                    // for appendNousWhispered
  readonly registry: NousRegistry;               // for tombstone lookup (isTombstoned(did): boolean)
  readonly rateLimiter: TickRateLimiter;
  readonly pendingStore: PendingStore;
}

export class WhisperRouter {
  constructor(private readonly deps: WhisperRouterDeps) {}
  /** Returns true on success, false on silent-drop (tombstone or rate-limit). Throws on validation failure. */
  route(envelope: Envelope, currentTick: number): boolean;
}
```

**TickRateLimiter contract (NEW — this wave):**
```ts
export class TickRateLimiter {
  constructor(private readonly cfg = DEFAULT_WHISPER_CONFIG) {}
  /** Returns true if consume succeeds (under budget); false if rejected. Prunes <currentTick-N entries on every call. */
  tryConsume(senderDid: string, currentTick: number): boolean;
  /** Phase 7 D-04 pause-safe clone — wipes all history. Called when WorldClock pauses. */
  reset(): void;
}
```

**PendingStore contract (NEW — this wave):**
```ts
export class PendingStore {
  enqueue(env: Envelope): void;                          // store.set(env.to_did, [...prev, env])
  drainFor(recipientDid: string): readonly Envelope[];   // returns snapshot; does NOT delete
  ackDelete(recipientDid: string, envelopeIds: ReadonlySet<string>): number; // returns count deleted
  evictDid(did: string): void;                           // GC on bios.death — clears the recipient's queue AND scrubs any envelope where from_did===did across all recipients
  size(): number;                                        // for metrics endpoint (Wave 3)
  countFor(did: string): number;                         // for metrics endpoint
}
```

Subscribe to bios.death in PendingStore constructor by accepting an injected unsubscribe-returning audit hook: `constructor(audit: { onAppend: (cb: (e: AuditEntry) => void) => () => void })` — clones the relationships/storage.ts pattern (W0 reference). The Grid-server bootstrap wires the audit hook on construction.

**nous-runner.ts integration point (~line 200, executeActions switch):**
```ts
// Existing pattern (do NOT rewrite — INSERT new case before/after trade_request):
// case 'direct_message': await directMessageHandler(...); break;
// case 'trade_request': try { await tradeBroker.propose(action); } catch (e) { /* transport fallback */ } break;

// NEW (insert near line 200):
case 'whisper_send': {
  // action.envelope is a fully-encrypted Envelope produced by Brain (Wave 3 ships sender.py).
  try {
    const accepted = whisperRouter.route(action.envelope, currentTick);
    if (!accepted) {
      // Silent drop on tombstone or rate-limit per D-11-18 / D-11-08; NO log, NO retry.
      return;
    }
  } catch (err) {
    // Validation failures (bad DID regex, bad hash, etc.) — these are programmer errors, not transport.
    // Surface to nous-runner's existing error transport (logger + audit only at this layer).
    logger.error({ err, action: 'whisper_send' }, 'whisper validation failed');
  }
  break;
}
```

`whisperRouter` is constructed at server bootstrap and injected into the executeActions closure. Wave 3's routes.ts also receives the same instance.

**KNOWN_CONSUMERS_WHISPERED for producer-boundary test:**
```ts
const KNOWN_CONSUMERS_WHISPERED: readonly string[] = [
  'grid/src/whisper/router.ts',           // string-references the event for type narrowing in catch
  'grid/src/dialogue/aggregator.ts',      // Wave 3 will widen its filter to also accept 'nous.whispered'
];
// Forbidden siblings (zero hits required):
const FORBIDDEN_SIBLINGS = ['nous.whisper_broadcast', 'nous.whispered_plain', 'nous.whisper_rate_limited'] as const;
```

If aggregator.ts has not yet been widened (Wave 3's job), comment in the boundary test that the second consumer entry is provisional. Either ship aggregator widening here (acceptable — it's a one-line filter widen) OR list KNOWN_CONSUMERS as just `['grid/src/whisper/router.ts']` and add the aggregator path in Wave 3. Recommend the latter — narrow scope.

**Pattern source files to clone (DO read these):**
- `grid/src/bios/appendBiosBirth.ts` — sole-producer 8-step template (verbatim except event name and 4-key tuple)
- `grid/src/bios/appendBiosDeath.ts` — tombstone-gated sole-producer (NB: appendBiosDeath rejects with throw; whisper router rejects SILENTLY — different pattern)
- `grid/test/bios/bios-producer-boundary.test.ts` — three-describe boundary test
- `grid/src/api/operator/delete-nous.ts` — D-30 ordered side-effect discipline (the locked-order docblock + injectable-deps shape)
- `grid/src/relationships/storage.ts` — per-DID Map + ephemeral-only persistence (template for PendingStore)
- `grid/src/dialogue/aggregator.ts` — per-key Map + sliding-window prune pattern (template for TickRateLimiter)
- `test/fixtures/dids.ts` — A/B/C test DID pattern (use these in tests; do NOT mint ad-hoc DIDs)
</interfaces>
</context>

<tasks>

<task id="11-W2-01" type="auto" tdd="true">
  <name>Task 11-W2-01: Ship grid/src/whisper/appendNousWhispered.ts (sole producer; flips whisper-wire-format.test.ts RED→GREEN)</name>
  <requirement>WHISPER-03</requirement>
  <threat_ref>T-10-01</threat_ref>
  <files>grid/src/whisper/appendNousWhispered.ts, grid/test/whisper/whisper-wire-format.test.ts</files>
  <behavior>
    - Module exports `appendNousWhispered(audit, actorDid, payload): void`
    - Accepts payload only when ALL eight gates pass (DID_RE actor + DID_RE from_did + DID_RE to_did + actor===from_did + tick non-negative-int + ciphertext_hash HEX64 + closed-tuple sort-equality on WHISPERED_KEYS + payloadPrivacyCheck)
    - Throws explicit Error with descriptive message on each gate violation (test asserts each error message)
    - Calls audit.append('nous.whispered', actorDid, cleanPayload) exactly once on success
    - cleanPayload contains EXACTLY the four keys ciphertext_hash/from_did/tick/to_did — no extras (re-keyed via explicit object literal, NOT `{...payload}`)
    - Self-whisper rejected (from_did === to_did → throws)
    - whisper-wire-format.test.ts (W0 RED stub) flips GREEN with the new gates
  </behavior>
  <action>
Read `grid/src/bios/appendBiosBirth.ts` end-to-end. Clone the file structure verbatim:
1. Copy the frontmatter docblock; rewrite for `nous.whispered` referencing WHISPER-03, D-11-01, T-10-01.
2. Imports: swap `BIOS_BIRTH_KEYS`/`BiosBirthPayload` → `WHISPERED_KEYS`/`NousWhisperedPayload` from `./types.ts`; keep `DID_RE`, `HEX64_RE` definitions inline (do NOT re-export from bios — Phase 11 is the 7th DID_RE entry point per carry-forward).
3. Body: 8 numbered steps in the EXACT order spelled out in the &lt;interfaces&gt; block. Each step's error message names the failing key for test assertions.
4. Step 7: `cleanPayload` is reconstructed via explicit object literal (NOT spread) so unknown keys can never sneak through.
5. Step 8: `payloadPrivacyCheck(cleanPayload)`; if not ok, throw `new Error(\`payload contains forbidden key '${result.offendingKeyword}' at path '${result.offendingPath}'\`)`. Then `audit.append('nous.whispered', actorDid, cleanPayload)`.
6. Add a self-whisper guard between steps 3 and 4: `if (payload.from_did === payload.to_did) throw new Error('self-whisper rejected')`.

Replace `grid/test/whisper/whisper-wire-format.test.ts` (W0 RED stub) with a real test suite covering each gate as a separate `it('rejects ...')` case + one `it('accepts valid payload and calls audit.append once')` case. Use `vi.fn()` for audit.append. Use `test/fixtures/dids.ts` A/B/C DIDs.

Run `cd grid && npx vitest run test/whisper/whisper-wire-format.test.ts --reporter=dot` until green.
  </action>
  <verify>
    <automated>cd grid &amp;&amp; npx vitest run test/whisper/whisper-wire-format.test.ts --reporter=dot</automated>
  </verify>
  <done>
    All 8 gate-specific rejection cases + happy-path + self-whisper rejection cases pass; exactly one audit.append call per accepted payload; cleanPayload contains exactly 4 keys (verified by Object.keys(payload).length===4 in the audit.append spy).
  </done>
</task>

<task id="11-W2-02" type="auto" tdd="true">
  <name>Task 11-W2-02: Ship grid/src/whisper/rate-limit.ts + flip whisper-rate-limit.test.ts RED→GREEN</name>
  <requirement>WHISPER-05</requirement>
  <threat_ref>T-10-04</threat_ref>
  <files>grid/src/whisper/rate-limit.ts, grid/test/whisper/whisper-rate-limit.test.ts</files>
  <behavior>
    - `TickRateLimiter` class with private `Map<senderDid, number[]>` history
    - `tryConsume(did, tick)` prunes entries older than `tick - cfg.rateWindowTicks` first; if remaining count >= cfg.rateBudget returns false; else pushes tick and returns true
    - 10 consecutive consumes at the same tick by the same sender — first 10 return true, 11th returns false
    - After advancing tick by N+1, history pruned and budget restored
    - Two distinct senders maintain independent budgets
    - `reset()` wipes all history (test: consume 10, reset, consume 10 again — all 10 return true)
    - Env override: setting `WHISPER_RATE_BUDGET=3` (test via injected config object, NOT process.env mutation) — only 3 consumes succeed at the same tick
    - No Date.now / Math.random / setTimeout / setInterval anywhere; check-wallclock-forbidden exits 0
  </behavior>
  <action>
Implement `TickRateLimiter` per the &lt;interfaces&gt; contract. Constructor accepts a config object (default = DEFAULT_WHISPER_CONFIG) so tests can pass overrides directly.

Body shape (clones `grid/src/dialogue/aggregator.ts` per-key Map + sliding-window prune):
```ts
private history = new Map<string, number[]>();
tryConsume(senderDid: string, currentTick: number): boolean {
  const cutoff = currentTick - this.cfg.rateWindowTicks;
  const prev = this.history.get(senderDid) ?? [];
  const pruned = prev.filter(t => t > cutoff);
  if (pruned.length >= this.cfg.rateBudget) {
    this.history.set(senderDid, pruned);  // persist prune even on rejection
    return false;
  }
  pruned.push(currentTick);
  this.history.set(senderDid, pruned);
  return true;
}
reset(): void { this.history.clear(); }
```

Add a frontmatter docblock referencing WHISPER-05, D-11-08, and noting "@fastify/rate-limit is the seconds-based DDoS belt mounted by routes.ts (Wave 3) — this module is the tick-indexed primary".

Replace `grid/test/whisper/whisper-rate-limit.test.ts` (W0 RED stub) with:
- describe('budget acceptance'): 10 in-tick consumes succeed, 11th rejected
- describe('window prune'): consume 10 at tick 0, advance to tick 100 (== cutoff exact), one consume at tick 100 — should succeed (entries with t > -100 pruned... double-check: cutoff = 100 - 100 = 0, so t > 0 retained → tick=0 entries pruned). Test cases must be precise about boundary inclusion.
- describe('per-sender independence'): sender A rate-limited; sender B still has full budget
- describe('reset'): consume 10, reset, consume 10 again — 20 total successes
- describe('config override'): pass `{ rateBudget: 3, rateWindowTicks: 100, envelopeVersion: 1 }` — only 3 succeed
- describe('@fastify/rate-limit integration'): comment-only test that asserts the docblock contains "@fastify/rate-limit" — this satisfies the `whisper-rate-limit.test.ts -t fastify` selector required by VALIDATION.md task 11-W2-06; do NOT actually mount Fastify here (that's Wave 3's routes.ts).

Use `test/fixtures/dids.ts` A/B for distinct senders.
  </action>
  <verify>
    <automated>cd grid &amp;&amp; npx vitest run test/whisper/whisper-rate-limit.test.ts --reporter=dot &amp;&amp; cd .. &amp;&amp; node scripts/check-wallclock-forbidden.mjs</automated>
  </verify>
  <done>
    All five describe blocks green; `-t fastify` selector matches the docblock-content sub-test; wall-clock gate exits 0.
  </done>
</task>

<task id="11-W2-03" type="auto" tdd="true">
  <name>Task 11-W2-03: Ship grid/src/whisper/pending-store.ts (in-memory queue + bios.death GC)</name>
  <requirement>WHISPER-06</requirement>
  <threat_ref>T-10-04</threat_ref>
  <files>grid/src/whisper/pending-store.ts</files>
  <behavior>
    - `PendingStore` class with private `Map<string, Envelope[]>`
    - `enqueue(env)` appends to the recipient's array (creates if missing)
    - `drainFor(did)` returns `Object.freeze([...prev])` snapshot; does NOT mutate
    - `ackDelete(did, envelopeIds: Set<string>)` filters out matching ids, returns count deleted
    - `evictDid(did)` removes the recipient's entire queue AND scrubs any envelope where `env.from_did === did` across ALL recipient queues (sender-tombstone case)
    - `countFor(did)` and `size()` work for Wave 3 metrics endpoint
    - Constructor subscribes to injected audit `onAppend` hook; on `bios.death` event with payload.did, calls `this.evictDid(payload.did)`
    - Returns a `dispose()` method that calls the unsubscribe function (for clean test teardown)
    - No persistence — confirmed by absence of any `fs`, `mysql`, `redis`, `sqlite` import in the file
  </behavior>
  <action>
Clone `grid/src/relationships/storage.ts` per-DID Map shape. Frontmatter cites D-11-05 (no MySQL persistence), D-11-17 (bios.death GC), WHISPER-06.

Implementation:
```ts
import { Envelope } from './types.ts';

interface AuditOnAppend { onAppend(cb: (entry: AuditEntry) => void): () => void; }

export class PendingStore {
  private store = new Map<string, Envelope[]>();
  private unsubscribe: () => void;

  constructor(audit: AuditOnAppend) {
    this.unsubscribe = audit.onAppend(entry => {
      if (entry.eventType === 'bios.death' && typeof entry.payload?.did === 'string') {
        this.evictDid(entry.payload.did);
      }
    });
  }

  enqueue(env: Envelope): void { ... }
  drainFor(recipientDid: string): readonly Envelope[] { ... }
  ackDelete(recipientDid: string, envelopeIds: ReadonlySet<string>): number { ... }
  evictDid(did: string): void {
    this.store.delete(did);
    for (const [recipient, envs] of this.store) {
      const filtered = envs.filter(e => e.from_did !== did);
      if (filtered.length !== envs.length) this.store.set(recipient, filtered);
    }
  }
  countFor(did: string): number { return this.store.get(did)?.length ?? 0; }
  size(): number { let n = 0; for (const v of this.store.values()) n += v.length; return n; }
  dispose(): void { this.unsubscribe(); }
}
```

Tests for PendingStore live inside `grid/test/whisper/whisper-router.test.ts` (next task) — keep this task focused on shipping the source file. A separate test file is overkill since router orchestration exercises every PendingStore method.

Verify: `cd grid && npx tsc --noEmit` typechecks the file (no implicit any, no missing imports).
  </action>
  <verify>
    <automated>cd grid &amp;&amp; npx tsc --noEmit -p tsconfig.json 2&gt;&amp;1 | grep -E 'whisper/pending-store' || echo 'pending-store typechecks clean'</automated>
  </verify>
  <done>
    `pending-store.ts` typechecks; no fs/mysql/redis/sqlite imports (`grep -E 'from .(node:)?(fs|mysql|redis|sqlite)' grid/src/whisper/pending-store.ts` returns nothing).
  </done>
</task>

<task id="11-W2-04" type="auto" tdd="true">
  <name>Task 11-W2-04: Ship grid/src/whisper/router.ts + whisper-router.test.ts + whisper-tombstone.test.ts (locked side-effect order + silent-drop)</name>
  <requirement>WHISPER-03, WHISPER-05</requirement>
  <threat_ref>T-10-04</threat_ref>
  <files>grid/src/whisper/router.ts, grid/test/whisper/whisper-router.test.ts, grid/test/whisper/whisper-tombstone.test.ts</files>
  <behavior>
    - `WhisperRouter.route(envelope, currentTick): boolean` runs side-effects in this exact order (any failure short-circuits):
      1. DID_RE.test(envelope.from_did) and DID_RE.test(envelope.to_did) — throws on failure (validation, not silent)
      2. registry.isTombstoned(from_did) || registry.isTombstoned(to_did) → return false (silent drop, NO audit emit, NO log)
      3. !rateLimiter.tryConsume(from_did, currentTick) → return false (silent drop, NO audit emit, NO log)
      4. appendNousWhispered(audit, envelope.from_did, {ciphertext_hash, from_did, tick, to_did})
      5. pendingStore.enqueue(envelope)
      6. return true
    - whisper-router.test.ts: spies on each dep, asserts call order via `vi.fn().mock.invocationCallOrder` — appendNousWhispered MUST come before pendingStore.enqueue (D-30 ordered)
    - whisper-router.test.ts: rate-limit rejection asserts ZERO calls to appendNousWhispered AND ZERO calls to pendingStore.enqueue
    - whisper-router.test.ts: validation failure (bad DID) asserts THROWS (not return false) and ZERO downstream calls
    - whisper-router.test.ts: PendingStore enqueue/drainFor/ackDelete/evictDid round-trip exercised end-to-end
    - whisper-tombstone.test.ts: sender-tombstoned → silent drop + zero audit emit + zero log + pending queue unchanged
    - whisper-tombstone.test.ts: recipient-tombstoned → silent drop + zero audit emit + zero log + pending queue unchanged
    - whisper-tombstone.test.ts: bios.death AFTER enqueue → evictDid scrubs the queue (tested via PendingStore.drainFor returning empty)
    - whisper-tombstone.test.ts: post-death whisper from healthy A to tombstoned B → silent drop, no 410 response shape, no audit
  </behavior>
  <action>
Implement `WhisperRouter` per the contract. Clone `grid/src/api/operator/delete-nous.ts` frontmatter docblock pattern (the "ORDER (LOCKED)" + "ERROR LADDER" sections), substituting whisper-specific text. Inject all deps; no globals.

```ts
import { DID_RE } from './appendNousWhispered.ts';
import { appendNousWhispered } from './appendNousWhispered.ts';
import type { Envelope, NousWhisperedPayload } from './types.ts';

export interface WhisperRouterDeps {
  readonly audit: AuditChain;
  readonly registry: { isTombstoned(did: string): boolean };
  readonly rateLimiter: TickRateLimiter;
  readonly pendingStore: PendingStore;
}

export class WhisperRouter {
  constructor(private readonly deps: WhisperRouterDeps) {}

  route(env: Envelope, currentTick: number): boolean {
    // Step 1: DID regex (validation, not silent)
    if (!DID_RE.test(env.from_did)) throw new Error(`invalid from_did: ${env.from_did}`);
    if (!DID_RE.test(env.to_did))   throw new Error(`invalid to_did: ${env.to_did}`);

    // Step 2: Tombstone — silent drop per D-11-18
    if (this.deps.registry.isTombstoned(env.from_did)) return false;
    if (this.deps.registry.isTombstoned(env.to_did))   return false;

    // Step 3: Rate-limit — silent drop per D-11-08
    if (!this.deps.rateLimiter.tryConsume(env.from_did, currentTick)) return false;

    // Step 4: Audit emit (sole producer)
    appendNousWhispered(this.deps.audit, env.from_did, {
      ciphertext_hash: env.ciphertext_hash,
      from_did: env.from_did,
      tick: env.tick,
      to_did: env.to_did,
    });

    // Step 5: Enqueue
    this.deps.pendingStore.enqueue(env);
    return true;
  }
}
```

Write `whisper-router.test.ts`:
- Build `vi.fn()` mocks for audit.append, registry.isTombstoned, rateLimiter.tryConsume, pendingStore.enqueue
- Test 1 (happy path): valid envelope → all 5 steps fire in order verified by `mock.invocationCallOrder` numerical comparison
- Test 2 (rate-limit reject): rateLimiter.tryConsume returns false → audit.append + pendingStore.enqueue NOT called; route returns false
- Test 3 (validation throws): bad from_did → throws; registry/rateLimiter/audit/pendingStore NOT called
- Test 4 (PendingStore round-trip): use a real PendingStore; route 3 envelopes; drainFor returns 3; ackDelete with 1 id removes 1; drainFor returns 2

Write `whisper-tombstone.test.ts`:
- Test 1: sender-tombstoned → route returns false; audit.append NOT called; pendingStore.enqueue NOT called; logger NOT called (`vi.spyOn(console, 'log')` + `console.error` + `console.warn` all assert called-zero-times)
- Test 2: recipient-tombstoned → same assertions
- Test 3: bios.death AFTER enqueue → simulate by directly calling pendingStore subscriber; drainFor returns []
- Test 4: cross-tombstone GC: enqueue from A→B, then bios.death(A); drainFor(B) returns [] (sender-side eviction)

Use `test/fixtures/dids.ts` A/B/C; instantiate registry as a simple `{ isTombstoned: vi.fn() }` mock. Use `vi.fn().mockReturnValueOnce(true)` for tombstone toggles.
  </action>
  <verify>
    <automated>cd grid &amp;&amp; npx vitest run test/whisper/whisper-router.test.ts test/whisper/whisper-tombstone.test.ts --reporter=dot</automated>
  </verify>
  <done>
    Both test files green; invocation order strictly verified; tombstone silent-drop confirmed via zero audit emit + zero log assertions; PendingStore round-trip exercises every public method.
  </done>
</task>

<task id="11-W2-05" type="auto" tdd="true">
  <name>Task 11-W2-05: Wire WhisperRouter into nous-runner.ts executeActions + flip whisper-producer-boundary.test.ts RED→GREEN</name>
  <requirement>WHISPER-03</requirement>
  <threat_ref>T-10-01</threat_ref>
  <files>grid/src/integration/nous-runner.ts, grid/test/whisper/whisper-producer-boundary.test.ts</files>
  <behavior>
    - `executeActions` switch (in nous-runner.ts ~line 200) handles `case 'whisper_send':`
    - whisper_send case calls `whisperRouter.route(action.envelope, currentTick)`; on false return, silent skip; on thrown error, logger.error + skip (no rethrow that would crash the runner)
    - whisperRouter is constructed at bootstrap with `{audit, registry, rateLimiter: new TickRateLimiter(), pendingStore: new PendingStore(audit)}` and injected into the runner closure (mirror existing dep-injection patterns in nous-runner.ts)
    - whisper-producer-boundary.test.ts (W0 RED stub) flips GREEN: only `grid/src/whisper/appendNousWhispered.ts` references the literal `'nous.whispered'` as an emission target; `grid/src/whisper/router.ts` is whitelisted as KNOWN_CONSUMER (it imports the emitter); FORBIDDEN_SIBLINGS (`nous.whisper_broadcast`, `nous.whispered_plain`, `nous.whisper_rate_limited`) return zero hits
    - Existing nous-runner tests remain green (regression guard)
  </behavior>
  <action>
Read `grid/src/integration/nous-runner.ts` end-to-end. Locate the executeActions switch (~line 200). Insert the `case 'whisper_send':` block between `direct_message` and `trade_request` (or wherever fits the existing alphabetical / semantic grouping). Use the snippet from the &lt;interfaces&gt; block.

Bootstrap wiring: locate where the runner is constructed (typically `grid/src/server.ts` or `grid/src/integration/nous-runner-bootstrap.ts` — grep for `new NousRunner` or `createNousRunner`). Inject the `whisperRouter` instance into that construction site. Construct PendingStore with the existing AuditChain; pass the same instance to whisperRouter. (Wave 3's routes.ts will use the SAME pendingStore instance — wire it into a shared `GridServices` container if one exists.)

Replace `grid/test/whisper/whisper-producer-boundary.test.ts` (W0 RED stub) with the full three-describe boundary test cloned from `grid/test/bios/bios-producer-boundary.test.ts`:
1. describe('sole emitter'): grep `grid/src/**/*.ts` for `'nous.whispered'` literal in arg position of `audit.append(...)`; assert exactly ONE file matches: `grid/src/whisper/appendNousWhispered.ts`
2. describe('known consumers'): grep `grid/src/**/*.ts` for the literal string `'nous.whispered'`; assert that every file matched is in `KNOWN_CONSUMERS_WHISPERED = ['grid/src/whisper/appendNousWhispered.ts', 'grid/src/whisper/router.ts']` OR the allowlist file
3. describe('forbidden siblings'): grep for each of `nous.whisper_broadcast`, `nous.whispered_plain`, `nous.whisper_rate_limited` in `grid/src/**/*.ts`; assert zero hits across the entire tree

Run the full grid test suite to catch regressions: `cd grid && npm test`.
  </action>
  <verify>
    <automated>cd grid &amp;&amp; npx vitest run test/whisper/whisper-producer-boundary.test.ts --reporter=dot &amp;&amp; npx vitest run test/integration/ --reporter=dot</automated>
  </verify>
  <done>
    Producer-boundary test all three describes pass; whisper_send case present in nous-runner.ts switch; existing integration tests still green; bootstrap construction injects shared PendingStore + WhisperRouter into the runner closure.
  </done>
</task>

<task id="11-W2-06" type="auto" tdd="false">
  <name>Task 11-W2-06: Wave-2 integration sweep (rate-limit fastify selector + wall-clock + state-doc-sync)</name>
  <requirement>WHISPER-05</requirement>
  <threat_ref>T-10-04</threat_ref>
  <files>grid/test/whisper/whisper-rate-limit.test.ts</files>
  <behavior>
    - `cd grid && npx vitest run test/whisper/whisper-rate-limit.test.ts -t fastify --reporter=dot` matches a sub-test (the docblock-content assertion from Task 11-W2-02 — verify the `-t` selector resolves; if not, add a dedicated `it('mounts @fastify/rate-limit at the route layer (Wave 3 wiring)')` placeholder that passes today and will be tightened in Wave 3)
    - `node scripts/check-wallclock-forbidden.mjs` exits 0 across grid/src/whisper/**
    - `node scripts/check-state-doc-sync.mjs` exits 0 (unchanged from W0)
    - `cd grid && npm test` full suite green (regression sweep)
    - VALIDATION.md task 11-W2-06 selector resolves to a real test name
  </behavior>
  <action>
Run the full validation sweep. If `npx vitest run ... -t fastify` matches zero tests, edit `whisper-rate-limit.test.ts` to add:
```ts
describe('fastify integration contract', () => {
  it('documents @fastify/rate-limit as the seconds-based DDoS belt mounted by routes.ts', () => {
    // This test documents the contract; Wave 3's whisper-api.test.ts asserts the actual
    // @fastify/rate-limit registration. Until then, this is a placeholder that ensures
    // VALIDATION.md task 11-W2-06's `-t fastify` selector resolves.
    expect(true).toBe(true);
  });
});
```

This is the ONLY task in this wave that's allowed to be a no-op-ish placeholder — it bridges to Wave 3 where the real Fastify mount happens. Document the deferral in the SUMMARY.md.

Run the full sweep: `cd grid && npm test && node scripts/check-wallclock-forbidden.mjs && node scripts/check-state-doc-sync.mjs && node scripts/check-whisper-plaintext.mjs 2>/dev/null || true` (the last one is Wave 4's gate; OK if missing).
  </action>
  <verify>
    <automated>cd grid &amp;&amp; npx vitest run test/whisper/whisper-rate-limit.test.ts -t fastify --reporter=dot &amp;&amp; cd .. &amp;&amp; node scripts/check-wallclock-forbidden.mjs &amp;&amp; node scripts/check-state-doc-sync.mjs</automated>
  </verify>
  <done>
    `-t fastify` selector resolves to at least one passing test; full grid suite green; wall-clock and state-doc-sync gates exit 0; SUMMARY.md notes the Wave 3 follow-up for actual @fastify/rate-limit mount.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Action runtime → emitter | nous-runner's whisper_send case must NEVER touch plaintext; only the encrypted Envelope crosses |
| Emitter → audit chain | Only ciphertext_hash crosses; payloadPrivacyCheck rejects forbidden keys |
| Router → registry (tombstone) | Silent rejection — no audit emit, no log; cannot leak liveness signal |
| PendingStore → disk | NEVER cross — in-memory only; no fs/mysql/redis imports |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-11-W2-01 | Tampering | Multiple producers of nous.whispered drift the audit shape | mitigate | Producer-boundary grep test (W0 RED → W2 GREEN) — only appendNousWhispered.ts may emit; FORBIDDEN_SIBLINGS gate prevents accidental re-naming variants |
| T-11-W2-02 | Information Disclosure | Plaintext or extra payload keys leak through emitter | mitigate | 8-step gate: explicit cleanPayload reconstruction (NOT spread) + payloadPrivacyCheck belt + closed-tuple sort-equality |
| T-11-W2-03 | Spoofing | Sender forges from_did | mitigate | Step 3 self-report invariant: actorDid === payload.from_did; nous-runner sets actorDid from authenticated nous identity |
| T-11-W2-04 | Information Disclosure | Tombstone rejection leaks liveness via 410/log | mitigate | Silent-drop discipline (D-11-18); whisper-tombstone.test.ts asserts zero audit emit + zero log lines |
| T-11-W2-05 | Denial of Service | Whisper spam exhausts queue | mitigate | TickRateLimiter B=10/N=100 default per sender; `@fastify/rate-limit` belt at routes.ts (Wave 3); env override allows production tuning |
| T-11-W2-06 | Information Disclosure | PendingStore persists ciphertext to disk | mitigate | Pure in-memory Map; grep-asserted absence of fs/mysql/redis/sqlite imports; bios.death GC ensures tombstoned DIDs don't accumulate stale envelopes |
| T-11-W2-07 | Repudiation | Side-effect order non-deterministic across runs | mitigate | Locked order (ORDER (LOCKED) docblock) + invocationCallOrder assertions in whisper-router.test.ts |
| T-11-W2-08 | Tampering | Wall-clock leaks into rate-limit math | mitigate | TickRateLimiter takes currentTick parameter; check-wallclock-forbidden gate (W0) covers grid/src/whisper/** |
</threat_model>

<verification>
After all six tasks land:
- `cd grid && npx vitest run test/whisper/ --reporter=dot` — all five whisper test files (producer-boundary, wire-format, rate-limit, router, tombstone) GREEN
- `cd grid && npm test` — full suite green (no regressions in audit, integration, dialogue tests)
- `node scripts/check-wallclock-forbidden.mjs` — exit 0; grid/src/whisper/** clean
- `node scripts/check-state-doc-sync.mjs` — exit 0 (unchanged from W0)
- `grep -E "audit\\.append\\('nous\\.whispered'" grid/src/` — exactly ONE match: grid/src/whisper/appendNousWhispered.ts
- `grep -E "nous\\.whisper_broadcast|nous\\.whispered_plain|nous\\.whisper_rate_limited" grid/src/` — zero hits
- `grep -E "from .(node:)?(fs|mysql|redis|sqlite)" grid/src/whisper/pending-store.ts` — zero hits
- nous-runner.ts contains `case 'whisper_send':` near line 200, calling whisperRouter.route(...)
- Brain side untouched (Wave 3 ships sender/receiver/aggregator/trade_guard)
- Zero-diff regression hash UNCHANGED (no whispers emitted in baseline fixture; baseline scenario does not exercise whisper_send)
</verification>

<success_criteria>
1. appendNousWhispered.ts is the SOLE emitter of nous.whispered — verified by producer-boundary grep
2. 8-step validation discipline cloned verbatim from appendBiosBirth.ts; all 8 gates have rejection test coverage
3. WhisperRouter executes locked side-effect order (validate → tombstone → ratelimit → emit → enqueue); invocation order asserted via vi.fn().mock.invocationCallOrder
4. Tombstone rejection is SILENT — zero audit emit, zero log line, zero 410-shaped response (router returns boolean false)
5. TickRateLimiter implements B=10/N=100 per-sender sliding window; env override works; reset() supports WorldClock pause-safety
6. PendingStore is in-memory only (zero fs/mysql/redis imports); bios.death GC scrubs both recipient queue AND cross-recipient envelopes where from_did matches
7. nous-runner.ts whisper_send case wires to WhisperRouter; transport-error fallback mirrors trade_request pattern
8. All four W0 RED stubs (producer-boundary, wire-format, rate-limit) plus two new tests (router, tombstone) GREEN
9. Wall-clock gate and state-doc-sync gate both exit 0
10. Full grid test suite green (no regressions outside whisper)
</success_criteria>

<output>
After completion, create `.planning/phases/11-mesh-whisper/11-02-emitter-router/SUMMARY.md` capturing:
- The exact line number and surrounding context where `case 'whisper_send':` was inserted in nous-runner.ts (so Wave 3 routes.ts can locate the same dep-injection container)
- The bootstrap construction site (file + line) where WhisperRouter, TickRateLimiter, PendingStore are instantiated and how they're shared with the request handler scope
- KNOWN_CONSUMERS_WHISPERED final list (just `['grid/src/whisper/appendNousWhispered.ts', 'grid/src/whisper/router.ts']` if aggregator widening was deferred to Wave 3 — note the deferral)
- Confirmation that Task 11-W2-06's `-t fastify` selector resolves (and which test name it matches)
- Any deviation from the locked side-effect order (should be NONE; flag as red if any)
</output>
