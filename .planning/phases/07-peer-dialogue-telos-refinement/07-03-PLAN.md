---
phase: 07-peer-dialogue-telos-refinement
plan: 03
type: execute
wave: 3
depends_on: [01, 02]
revised_at: 2026-04-21
files_modified:
  - grid/src/audit/broadcast-allowlist.ts
  - grid/src/audit/append-telos-refined.ts
  - grid/src/audit/index.ts
  - grid/src/integration/nous-runner.ts
  - grid/test/audit/telos-refined-privacy.test.ts
  - grid/test/audit/allowlist-seventeen.test.ts
  - grid/test/audit/telos-refined-producer-boundary.test.ts
  - grid/test/integration/telos-refined-runner-branch.test.ts
  - scripts/check-state-doc-sync.mjs
  - .planning/STATE.md
  - README.md
autonomous: true
requirements: [DIALOG-02]
must_haves:
  truths:
    - "ALLOWLIST_MEMBERS contains exactly 17 event types; telos.refined is at position 17 (zero-indexed 16)"
    - "appendTelosRefined is the SOLE producer path for telos.refined — no other file in grid/src/ calls audit.append with eventType === 'telos.refined'"
    - "appendTelosRefined validates did (DID_RE), both goal hashes (HEX64_RE), and dialogue_id (DIALOGUE_ID_RE) at the producer boundary — malformed inputs throw TypeError"
    - "The on-wire audit payload for telos.refined has EXACTLY 4 keys: {did, before_goal_hash, after_goal_hash, triggered_by_dialogue_id} — Object.keys().sort() assertion fails on add/remove"
    - "payloadPrivacyCheck() passes natively on a well-formed telos.refined payload (no keys match prompt|response|wiki|reflection|thought|emotion_delta)"
    - "NousRunner.executeActions case 'telos_refined' calls appendTelosRefined ONLY when recentDialogueIds.has(dialogueId) — unknown/forged dialogue_ids drop silently"
    - "scripts/check-state-doc-sync.mjs asserts 17 events (not 16) and includes telos.refined in its required-array literal"
    - "STATE.md allowlist enumeration lists 17 events ending with telos.refined; README.md (if it promises an event count) agrees"
  artifacts:
    - path: "grid/src/audit/broadcast-allowlist.ts"
      provides: "ALLOWLIST_MEMBERS extended to 17 members, telos.refined at index 16"
      contains: "'telos.refined'"
    - path: "grid/src/audit/append-telos-refined.ts"
      provides: "Sole producer-boundary helper for telos.refined events"
      exports: ["appendTelosRefined", "HEX64_RE", "DIALOGUE_ID_RE"]
      contains: "export function appendTelosRefined"
    - path: "grid/src/integration/nous-runner.ts"
      provides: "case 'telos_refined' branch in executeActions; consumes recentDialogueIds from Plan 01"
      contains: "case 'telos_refined':"
    - path: "grid/test/audit/telos-refined-privacy.test.ts"
      provides: "8-case privacy matrix (6 forbidden flat + 1 nested + 1 happy baseline) + EVENT_SPECS coverage assertion"
      contains: "FORBIDDEN_CASES"
    - path: "grid/test/audit/allowlist-seventeen.test.ts"
      provides: "Frozen-tuple ordering invariant — length === 17, position 17 === 'telos.refined', set is frozen"
      contains: "toHaveLength(17)"
    - path: "grid/test/audit/telos-refined-producer-boundary.test.ts"
      provides: "Sole-call-site gate: grep-style assertion that no other grid/src file calls audit.append with 'telos.refined'"
      contains: "appendTelosRefined"
    - path: "grid/test/integration/telos-refined-runner-branch.test.ts"
      provides: "NousRunner branch contract: unknown dialogue_id drops; valid payload emits audit event"
      contains: "recentDialogueIds"
    - path: "scripts/check-state-doc-sync.mjs"
      provides: "Doc-sync gate bumped 16→17; telos.refined in required array"
      contains: "'telos.refined'"
    - path: ".planning/STATE.md"
      provides: "Allowlist enumeration updated to 17 events"
      contains: "17 events"
    - path: "README.md"
      provides: "Current allowlist count updated (if README mentions it)"
      contains: "telos.refined"
  key_links:
    - from: "grid/src/integration/nous-runner.ts:case 'telos_refined'"
      to: "grid/src/audit/append-telos-refined.ts:appendTelosRefined"
      via: "sole call site"
      pattern: "appendTelosRefined\\(this\\.audit"
    - from: "grid/src/audit/append-telos-refined.ts"
      to: "grid/src/audit/broadcast-allowlist.ts:payloadPrivacyCheck"
      via: "runtime guard before chain.append"
      pattern: "payloadPrivacyCheck"
    - from: "scripts/check-state-doc-sync.mjs"
      to: ".planning/STATE.md"
      via: "regex count assertion + required-array membership"
      pattern: "17\\s+events"
    - from: "grid/src/integration/nous-runner.ts"
      to: "recentDialogueIds"
      via: "authority check BEFORE appendTelosRefined"
      pattern: "recentDialogueIds\\.has"
---

<objective>
Close the Grid-side producer boundary for DIALOG-02 by (a) extending the broadcast allowlist from 16 to 17 event types with `telos.refined` at position 17, (b) creating the sole producer helper `appendTelosRefined` that mirrors Phase 6's `appendOperatorEvent` discipline — closed 4-key tuple, triple-regex guard (DID + HEX64 × 2 + DIALOGUE_ID), native `payloadPrivacyCheck` pass — (c) wiring the `case 'telos_refined'` branch in `NousRunner.executeActions` using the `recentDialogueIds` seam Plan 01 added to the runner, and (d) reconciling the CLAUDE.md doc-sync rule across `scripts/check-state-doc-sync.mjs`, `.planning/STATE.md`, and `README.md` in the SAME task that flips the allowlist length.

Purpose: The allowlist is Noēsis's sovereignty moat. Extending it is a discrete, traceable event that must leave a consistent audit trail across code + planning docs + regression script. Phase 6 established this discipline (operator.* events grew 11→16); Phase 7 extends the same ritual to 17. The producer-boundary helper prevents shotgun-scattered `auditChain.append({ eventType: 'telos.refined', ... })` calls — only one file in `grid/src/` is authorized to emit this event.

Output: Frozen-17 allowlist, sole-producer helper + tests, runner branch + integration test, doc-sync parity across 3 non-code files. Ready for Plan 04 (Inspector badge + firehose filter chip on the dashboard side).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/07-peer-dialogue-telos-refinement/07-CONTEXT.md
@.planning/phases/07-peer-dialogue-telos-refinement/07-RESEARCH.md
@.planning/phases/07-peer-dialogue-telos-refinement/07-PATTERNS.md
@.planning/phases/07-peer-dialogue-telos-refinement/07-VALIDATION.md
@.planning/phases/07-peer-dialogue-telos-refinement/plan-01-grid-aggregator.md
@.planning/phases/07-peer-dialogue-telos-refinement/plan-02-brain-telos-refined.md
@CLAUDE.md
@grid/src/audit/broadcast-allowlist.ts
@grid/src/audit/operator-events.ts
@grid/src/audit/chain.ts
@grid/src/integration/nous-runner.ts
@scripts/check-state-doc-sync.mjs

<interfaces>
<!-- From Plan 01 (Grid aggregator) — seam this plan consumes: -->

```typescript
// grid/src/integration/nous-runner.ts (already extended by Plan 01)
class NousRunner {
    // Rolling set of dialogue_ids recently delivered to THIS nous's Brain
    // via sendTick. Cap 100; eviction is FIFO via a ringbuffer or Map.
    private readonly recentDialogueIds: Set<string>;

    // Plan 01 populates recentDialogueIds when GridCoordinator passes a
    // DialogueContext into runner.tick(tick, epoch, ctx). Plan 03 READS
    // this Set inside the new case 'telos_refined' branch (authority check).
}
```

<!-- From Plan 02 (Brain) — on-wire contract this plan validates: -->

```python
# Brain returns, via RPC, an action shaped like:
{
    "action_type": "telos_refined",
    "channel": "",
    "text": "",
    "metadata": {
        "before_goal_hash": <64-hex>,
        "after_goal_hash":  <64-hex>,
        "triggered_by_dialogue_id": <16-hex>,  # echoes the ctx.dialogue_id the Brain received
    },
}
```

<!-- From Phase 6 (FROZEN) — producer-boundary pattern to clone: -->

```typescript
// grid/src/audit/operator-events.ts (existing, Phase 6 D-13 SOLE producer helper)
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

<!-- From grid/src/audit/broadcast-allowlist.ts (CURRENT — before Plan 03 edit): -->

```typescript
const ALLOWLIST_MEMBERS: readonly string[] = [
    'nous.spawned', 'nous.moved', 'nous.spoke', 'nous.direct_message',
    'trade.proposed', 'trade.reviewed', 'trade.settled',
    'law.triggered', 'tick', 'grid.started', 'grid.stopped',
    'operator.inspected', 'operator.paused', 'operator.resumed',
    'operator.law_changed', 'operator.telos_forced',
] as const;   // ← 16 members as of Phase 6

export const FORBIDDEN_KEY_PATTERN = /prompt|response|wiki|reflection|thought|emotion_delta/i;
export function payloadPrivacyCheck(payload: unknown): PrivacyCheckResult { /* ... */ }
```

<!-- NEW — appendTelosRefined signature (Plan 03 produces): -->

```typescript
// grid/src/audit/append-telos-refined.ts
export const HEX64_RE = /^[0-9a-f]{64}$/;
export const DIALOGUE_ID_RE = /^[0-9a-f]{16}$/;
export const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;

export interface TelosRefinedPayload {
    readonly did: string;
    readonly before_goal_hash: string;
    readonly after_goal_hash: string;
    readonly triggered_by_dialogue_id: string;
}

export function appendTelosRefined(
    audit: AuditChain,
    actorDid: string,
    payload: TelosRefinedPayload,
): AuditEntry;
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Allowlist 16→17 + appendTelosRefined producer helper + three test files</name>
  <files>grid/src/audit/broadcast-allowlist.ts, grid/src/audit/append-telos-refined.ts, grid/src/audit/index.ts, grid/test/audit/allowlist-seventeen.test.ts, grid/test/audit/telos-refined-privacy.test.ts, grid/test/audit/telos-refined-producer-boundary.test.ts</files>
  <read_first>
    - grid/src/audit/broadcast-allowlist.ts (FULL — current 16-member tuple at lines 30-51; FORBIDDEN_KEY_PATTERN at line 85; payloadPrivacyCheck implementation)
    - grid/src/audit/operator-events.ts (FULL — the Phase 6 analog; clone function shape, import style, error messages)
    - grid/src/audit/chain.ts (AuditChain.append signature; how append returns AuditEntry)
    - grid/src/audit/index.ts (current barrel exports — add appendTelosRefined here)
    - grid/src/api/operator/_validation.ts (Phase 6 HEX64_RE pattern — clone the regex literal shape)
    - grid/test/audit/broadcast-allowlist.test.ts (if exists) — the analog frozen-tuple invariant test to clone
    - grid/test/audit/operator-event-invariant.test.ts — the analog enumeration-shape test
    - grid/test/audit/operator-payload-privacy.test.ts — the analog privacy-matrix test (Phase 6 ships 5 events × 8 cases = 40; Phase 7 ships 1 × 8 = 8)
    - 07-CONTEXT.md D-19, D-20, D-21, D-22, D-31 (allowlist position, closed tuple, native privacy pass, privacy matrix, sole producer boundary)
    - 07-PATTERNS.md §grid/src/audit/append-telos-refined.ts, §grid/test/dialogue/allowlist-seventeen.test.ts, §grid/test/dialogue/telos-refined-privacy.test.ts, §grid/test/dialogue/producer-boundary.test.ts
    - 07-VALIDATION.md Wave 0 Grid section (confirms these test files are mandatory and authored RED-first inside this task)
  </read_first>
  <behavior>
    - **broadcast-allowlist.ts:** After edit, `ALLOWLIST_MEMBERS.length === 17`, `ALLOWLIST_MEMBERS[16] === 'telos.refined'`, `ALLOWLIST.has('telos.refined') === true`, and all pre-existing Phase 6 tests still pass (order of first 16 members unchanged).
    - **append-telos-refined.ts (happy path):** `appendTelosRefined(chain, did, { did, before_goal_hash, after_goal_hash, triggered_by_dialogue_id })` returns an `AuditEntry` whose `event_type === 'telos.refined'` and whose `payload` has exactly 4 keys in the documented set.
    - **append-telos-refined.ts (invalid DID):** throws `TypeError` matching `/did/i` when `actorDid` does not match `DID_RE`.
    - **append-telos-refined.ts (invalid before_goal_hash):** throws `TypeError` matching `/hex64|before_goal_hash/i` for non-64-hex inputs (`''`, `'ab'`, `'Z'.repeat(64)`, `'a'.repeat(63)`).
    - **append-telos-refined.ts (invalid after_goal_hash):** same guard, independent check.
    - **append-telos-refined.ts (invalid dialogue_id):** throws `TypeError` matching `/dialogue_id|hex16/i` when `triggered_by_dialogue_id` is not 16-hex.
    - **append-telos-refined.ts (extra key):** throws `TypeError` matching `/extra|unexpected/i` if the payload carries any key outside the 4-key closed tuple. (Implementation tip: destructure + explicit reconstruction; then `Object.keys(payload).length === 4` assertion.)
    - **append-telos-refined.ts (privacy gate):** `payloadPrivacyCheck` runs BEFORE `chain.append`; a payload with `prompt`/`response`/`wiki`/`reflection`/`thought`/`emotion_delta` keys throws before anything enters the chain.
    - **allowlist-seventeen.test.ts:** asserts length 17, position 16 is `'telos.refined'`, first 16 members unchanged (pin as array literal comparison).
    - **telos-refined-privacy.test.ts:** 8 cases = 6 forbidden flat (`prompt`, `response`, `wiki`, `reflection`, `thought`, `emotion_delta`) + 1 nested forbidden (`{meta: {prompt: 'x'}}`) + 1 happy baseline. Plus a coverage assertion that the allowlist / EVENT_SPECS enumeration includes `'telos.refined'`.
    - **telos-refined-producer-boundary.test.ts:** grep-style invariant — read all `.ts` files under `grid/src/` (excluding `grid/src/audit/append-telos-refined.ts`), assert none contains `audit.append` / `chain.append` followed (within ~100 chars) by the string `'telos.refined'`. This is the "sole call site" gate.
  </behavior>
  <action>
    **TDD discipline — author tests RED-first BEFORE any src/ edit.**

    **Step 0 — RED: Create all three test files before any production code exists.**
    Create `grid/test/audit/allowlist-seventeen.test.ts`, `grid/test/audit/telos-refined-privacy.test.ts`, and `grid/test/audit/telos-refined-producer-boundary.test.ts` with real `expect(...)` assertions per the test bodies shown in Steps 4–6 below. Run `cd grid && pnpm test -- audit/allowlist-seventeen audit/telos-refined-privacy audit/telos-refined-producer-boundary --run` and CONFIRM all three files report failing tests (not "0 tests found"). The failures confirm the test harness is wired and the assertions are real.

    **Step 1 — Edit `grid/src/audit/broadcast-allowlist.ts`:**
    1. Locate the `ALLOWLIST_MEMBERS` tuple (currently lines 30-51).
    2. Replace the header comment (lines 24-29) to mention Phase 7:
    ```typescript
    /** Locked allowlist (v1 + Phase 5 + Phase 6 + Phase 7) — exactly these 17 event types.
     *  v1 (Phase 1): 10 events.
     *  Phase 5 (REV-02): +1 'trade.reviewed'.
     *  Phase 6 (AGENCY-02/03): +5 operator.* events.
     *  Phase 7 (DIALOG-02): +1 'telos.refined' at position 17 — Nous-initiated
     *  hash-only refinement after peer dialogue. Tuple ORDER is locked; any
     *  reorder fails grid/test/audit/allowlist-seventeen.test.ts.
     */
    ```
    3. Append `'telos.refined'` as the 17th entry, BELOW `'operator.telos_forced'`:
    ```typescript
        'operator.telos_forced',   // H4 Driver   — hash-only diff, no goal contents
        // Phase 7 (DIALOG-02) — Nous-initiated telos refinement after peer dialogue.
        // Payload shape: { did, before_goal_hash, after_goal_hash, triggered_by_dialogue_id }
        // Emitted ONLY via appendTelosRefined() (grid/src/audit/append-telos-refined.ts).
        'telos.refined',
    ```
    4. Leave everything else in the file (`buildFrozenAllowlist`, `isAllowlisted`, `FORBIDDEN_KEY_PATTERN`, `payloadPrivacyCheck`) completely untouched — those are the Phase 6 frozen contracts this plan relies on.

    **Step 2 — Create `grid/src/audit/append-telos-refined.ts`:**
    Clone the shape of `operator-events.ts` structurally (imports, error-message prefix convention, export position). Diverge where D-19 demands (no tier check — telos.refined is Nous-initiated).
    ```typescript
    /**
     * appendTelosRefined — SOLE producer boundary for `telos.refined` audit events.
     *
     * Mirrors Phase 6's appendOperatorEvent discipline (07-CONTEXT D-31):
     *   1. Regex-guard every string input (DID_RE, HEX64_RE, DIALOGUE_ID_RE).
     *   2. Close the payload tuple — exactly 4 keys, explicit destructure, no spread.
     *   3. Run payloadPrivacyCheck before chain.append (belt-and-suspenders — the
     *      4 closed keys are natively privacy-clean per D-21, but the gate still
     *      runs so future edits cannot regress).
     *   4. Call audit.append with the canonical event type 'telos.refined'.
     *
     * Any other file in grid/src/ calling audit.append with eventType
     * === 'telos.refined' fails the producer-boundary invariant test
     * (grid/test/audit/telos-refined-producer-boundary.test.ts).
     *
     * See: 07-CONTEXT.md D-17, D-18, D-19, D-20, D-31.
     */
    import { AuditChain, AuditEntry } from './chain';
    import { payloadPrivacyCheck } from './broadcast-allowlist';

    /** 64-hex SHA-256 digest — matches grid/src/api/operator/_validation.ts HEX64_RE. */
    export const HEX64_RE = /^[0-9a-f]{64}$/;

    /** 16-hex dialogue_id — truncated SHA-256 (first 16 chars). */
    export const DIALOGUE_ID_RE = /^[0-9a-f]{16}$/;

    /** DID regex — locked at 3 entry points project-wide; Phase 7 is the 4th. */
    export const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;

    /** Closed 4-key payload tuple for telos.refined (D-20). */
    export interface TelosRefinedPayload {
        readonly did: string;
        readonly before_goal_hash: string;
        readonly after_goal_hash: string;
        readonly triggered_by_dialogue_id: string;
    }

    /** The 4 keys a telos.refined payload must carry — nothing more, nothing less. */
    const EXPECTED_KEYS = ['after_goal_hash', 'before_goal_hash', 'did', 'triggered_by_dialogue_id'] as const;

    /**
     * Sole producer path for telos.refined audit events.
     *
     * @throws TypeError if any regex guard fails, if the payload carries an
     *   unexpected key, or if payloadPrivacyCheck rejects the payload.
     */
    export function appendTelosRefined(
        audit: AuditChain,
        actorDid: string,
        payload: TelosRefinedPayload,
    ): AuditEntry {
        // 1. Regex guards — reject malformed inputs before ANY side effect.
        if (typeof actorDid !== 'string' || !DID_RE.test(actorDid)) {
            throw new TypeError(`appendTelosRefined: invalid actorDid ${JSON.stringify(actorDid)} (DID_RE failed)`);
        }
        if (typeof payload?.did !== 'string' || !DID_RE.test(payload.did)) {
            throw new TypeError(`appendTelosRefined: invalid payload.did (DID_RE failed)`);
        }
        if (payload.did !== actorDid) {
            // Self-reporting only — a Nous cannot announce someone else's refinement.
            throw new TypeError(`appendTelosRefined: payload.did must equal actorDid (self-report invariant)`);
        }
        if (typeof payload.before_goal_hash !== 'string' || !HEX64_RE.test(payload.before_goal_hash)) {
            throw new TypeError(`appendTelosRefined: before_goal_hash must match HEX64_RE`);
        }
        if (typeof payload.after_goal_hash !== 'string' || !HEX64_RE.test(payload.after_goal_hash)) {
            throw new TypeError(`appendTelosRefined: after_goal_hash must match HEX64_RE`);
        }
        if (typeof payload.triggered_by_dialogue_id !== 'string' || !DIALOGUE_ID_RE.test(payload.triggered_by_dialogue_id)) {
            throw new TypeError(`appendTelosRefined: triggered_by_dialogue_id must match DIALOGUE_ID_RE (hex16)`);
        }

        // 2. Closed-tuple check — any extra key = contract drift, refuse to emit.
        const actualKeys = Object.keys(payload).sort();
        if (actualKeys.length !== EXPECTED_KEYS.length
            || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
            throw new TypeError(
                `appendTelosRefined: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
            );
        }

        // 3. Explicit object reconstruction — guarantees no prototype pollution
        //    or accidental inheritance from a caller's object literal.
        const cleanPayload = {
            did: payload.did,
            before_goal_hash: payload.before_goal_hash,
            after_goal_hash: payload.after_goal_hash,
            triggered_by_dialogue_id: payload.triggered_by_dialogue_id,
        };

        // 4. Privacy gate — belt-and-suspenders (D-21: the 4 keys are natively
        //    clean; this check is the regression gate, not the primary defense).
        const privacy = payloadPrivacyCheck(cleanPayload);
        if (!privacy.ok) {
            throw new TypeError(
                `appendTelosRefined: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
            );
        }

        // 5. Commit to the chain.
        return audit.append('telos.refined', actorDid, cleanPayload);
    }
    ```

    **Step 3 — Update `grid/src/audit/index.ts`:**
    Add the new exports:
    ```typescript
    export {
        appendTelosRefined,
        HEX64_RE as TELOS_REFINED_HEX64_RE,      // namespaced to avoid collision
        DIALOGUE_ID_RE,
        type TelosRefinedPayload,
    } from './append-telos-refined';
    ```
    If a `HEX64_RE` is already re-exported from another audit submodule, adjust the alias to prevent name collision — do NOT shadow the existing export.

    **Step 4 — `grid/test/audit/allowlist-seventeen.test.ts` (authored RED in Step 0; GREEN after Step 1):**
    ```typescript
    import { describe, expect, it } from 'vitest';
    import { ALLOWLIST, isAllowlisted } from '../../src/audit/broadcast-allowlist';

    /** Frozen expected tuple — Phase 7 position-17 discipline. */
    const EXPECTED_ORDER = [
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
        'telos.refined',              // position 17 (zero-indexed 16)
    ] as const;

    describe('broadcast allowlist — Phase 7 invariant (DIALOG-02 D-19)', () => {
        it('contains exactly 17 members', () => {
            expect(ALLOWLIST.size).toBe(17);
        });

        it('includes telos.refined', () => {
            expect(ALLOWLIST.has('telos.refined')).toBe(true);
            expect(isAllowlisted('telos.refined')).toBe(true);
        });

        it('preserves the Phase 6 order and appends telos.refined last', () => {
            // Array-ify the Set in insertion order; ALLOWLIST is built via
            // `new Set(ALLOWLIST_MEMBERS)` which preserves insertion order.
            expect([...ALLOWLIST]).toEqual([...EXPECTED_ORDER]);
        });

        it('is frozen — mutation attempts throw', () => {
            expect(() => (ALLOWLIST as unknown as Set<string>).add('malicious.event')).toThrow(TypeError);
            expect(() => (ALLOWLIST as unknown as Set<string>).delete('telos.refined')).toThrow(TypeError);
            expect(() => (ALLOWLIST as unknown as Set<string>).clear()).toThrow(TypeError);
        });
    });
    ```

    **Step 5 — `grid/test/audit/telos-refined-privacy.test.ts` (authored RED in Step 0; GREEN after Step 2):**
    ```typescript
    import { describe, expect, it } from 'vitest';
    import { AuditChain } from '../../src/audit/chain';
    import { appendTelosRefined } from '../../src/audit/append-telos-refined';
    import { ALLOWLIST, payloadPrivacyCheck } from '../../src/audit/broadcast-allowlist';

    const happy = {
        did: 'did:noesis:alpha',
        before_goal_hash: 'a'.repeat(64),
        after_goal_hash: 'b'.repeat(64),
        triggered_by_dialogue_id: 'c'.repeat(16),
    };

    /** 6 flat forbidden + 1 nested forbidden = 7 failure cases. +1 happy baseline = 8 total. */
    const FORBIDDEN_CASES: Array<[string, Record<string, unknown>]> = [
        ['prompt',          { ...happy, prompt: 'leak' }],
        ['response',        { ...happy, response: 'leak' }],
        ['wiki',            { ...happy, wiki: 'leak' }],
        ['reflection',      { ...happy, reflection: 'leak' }],
        ['thought',         { ...happy, thought: 'leak' }],
        ['emotion_delta',   { ...happy, emotion_delta: 0.5 }],
        ['nested.prompt',   { ...happy, meta: { prompt: 'leak deep' } }],
    ];

    describe('telos.refined — privacy matrix (D-21, D-22)', () => {
        let chain: AuditChain;
        beforeEach(() => { chain = new AuditChain(); });

        it('allowlist enumeration includes telos.refined (coverage assertion)', () => {
            expect(ALLOWLIST.has('telos.refined')).toBe(true);
        });

        it('happy baseline — well-formed payload appends successfully', () => {
            expect(() => appendTelosRefined(chain, happy.did, happy)).not.toThrow();
            const entries = chain.entries;
            expect(entries[entries.length - 1]?.event_type).toBe('telos.refined');
            const payload = entries[entries.length - 1]?.payload as Record<string, unknown>;
            expect(Object.keys(payload).sort()).toEqual(
                ['after_goal_hash', 'before_goal_hash', 'did', 'triggered_by_dialogue_id'],
            );
        });

        it.each(FORBIDDEN_CASES)('rejects payload with forbidden key %s', (label, bad) => {
            expect(() => appendTelosRefined(chain, happy.did, bad as typeof happy))
                .toThrow(/unexpected key|privacy violation/i);
        });

        it('payloadPrivacyCheck natively passes the 4-key closed tuple (D-21)', () => {
            expect(payloadPrivacyCheck(happy).ok).toBe(true);
        });
    });
    ```

    **Step 6 — `grid/test/audit/telos-refined-producer-boundary.test.ts` (authored RED in Step 0; GREEN after Step 2):**
    This is the grep-style "sole call site" invariant. It scans all `.ts` files under `grid/src/` (excluding `append-telos-refined.ts` itself and tests) and asserts none of them calls `audit.append` / `chain.append` / `this.audit.append` with a literal `'telos.refined'` in proximity.
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
                // Match patterns like audit.append(..., 'telos.refined', ...) or
                // chain.append('telos.refined', ...) within the same line or
                // up-to-120-char window.
                const pattern = /\b(audit|chain|this\.audit|this\.chain)\.append[^;]{0,200}['"]telos\.refined['"]/s;
                if (pattern.test(src)) offenders.push(rel);
            }
            expect(offenders).toEqual([]);
        });

        it('append-telos-refined.ts itself calls audit.append with telos.refined (sanity)', () => {
            const src = readFileSync(join(GRID_SRC, SOLE_PRODUCER_FILE), 'utf8');
            expect(src).toMatch(/audit\.append\(['"]telos\.refined['"]/);
        });
    });
    ```

    **Step 7 — Vitest config:** ensure `grid/vitest.config.ts` (or package-level `test:` glob) picks up `grid/test/audit/**/*.test.ts`. If already glob-included, no change. If not, add the directory to `include`.

    **Step 8 — CONFIRM GREEN:** Run `cd grid && pnpm test -- audit/allowlist-seventeen audit/telos-refined-privacy audit/telos-refined-producer-boundary --run` and confirm vitest reports a non-zero PASSING count across all three files (not "0 tests found"). If any file reports "0 tests found", the test-discovery glob failed — fix `vitest.config.ts` before marking done.

    **Do NOT modify:**
    - `payloadPrivacyCheck` or `FORBIDDEN_KEY_PATTERN` (Phase 1 + Phase 6 frozen contracts).
    - `appendOperatorEvent` or any Phase 6 operator.* test (DIALOG-02 is additive only).
    - `AuditChain.append` signature (additive-widening only if ever; not needed here).
    - Any `grid/src/review/*` or `grid/src/api/operator/*` file (out of scope).
  </action>
  <verify>
    <automated>cd grid &amp;&amp; pnpm test -- audit/allowlist-seventeen audit/telos-refined-privacy audit/telos-refined-producer-boundary --run &amp;&amp; pnpm run typecheck</automated>
  </verify>
  <done>
    - `grid/src/audit/broadcast-allowlist.ts` contains `'telos.refined'` on a line immediately after `'operator.telos_forced'`.
    - `grid/src/audit/append-telos-refined.ts` exists and exports `appendTelosRefined`, `HEX64_RE`, `DIALOGUE_ID_RE`, `TelosRefinedPayload`.
    - `grid/src/audit/index.ts` re-exports the new symbols (import from `@/audit` works in downstream code).
    - `cd grid && pnpm test -- audit/allowlist-seventeen --run` reports 4/4 tests green (non-zero count).
    - `cd grid && pnpm test -- audit/telos-refined-privacy --run` reports ≥9 tests green (1 coverage + 1 happy + 7 parametrized + 1 privacy-check native pass).
    - `cd grid && pnpm test -- audit/telos-refined-producer-boundary --run` reports 2/2 green.
    - `cd grid && pnpm run typecheck` passes (no type errors introduced).
    - `cd grid && pnpm test -- audit --run` (full audit dir) reports no regressions in Phase 6 tests.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: NousRunner executeActions case 'telos_refined' branch + integration test</name>
  <files>grid/src/integration/nous-runner.ts, grid/test/integration/telos-refined-runner-branch.test.ts</files>
  <read_first>
    - grid/src/integration/nous-runner.ts (FULL — Plan 01 already added `recentDialogueIds: Set<string>` and the population seam; Phase 6 established the `executeActions` switch; read the existing `case 'trade_request'` at ~lines 138-268 as the closest analog for pre-audit validation)
    - grid/src/integration/types.ts (Plan 01 extended `BrainAction` with `TelosRefinedAction` variant — confirm the shape this branch narrows to)
    - grid/test/integration/agency-integration.test.ts (Phase 6 analog — the integration-test fixture pattern for full brain→runner→audit pipeline)
    - plan-01-grid-aggregator.md (confirm the name and cap of the `recentDialogueIds` seam — the runner's own rolling Set, NOT a shared global)
    - plan-02-brain-telos-refined.md (confirm the metadata keys the Brain sends: before_goal_hash, after_goal_hash, triggered_by_dialogue_id — 3 keys, NOT 4; runner adds `did`)
    - 07-CONTEXT.md D-16, D-17 (validation contract + sole producer path)
    - 07-PATTERNS.md §grid/src/integration/nous-runner.ts (verbatim case shape to copy)
  </read_first>
  <behavior>
    - **Valid flow:** runner receives a brain action `{action_type: 'telos_refined', channel: '', text: '', metadata: {before_goal_hash, after_goal_hash, triggered_by_dialogue_id}}` where `triggered_by_dialogue_id` is in `this.recentDialogueIds`. Result: `appendTelosRefined` is called exactly once with `actorDid = this.nousDid`; `AuditChain` gains one entry with `event_type === 'telos.refined'` and `payload.did === this.nousDid`.
    - **Authority check (D-16):** runner receives an action whose `triggered_by_dialogue_id` is NOT in `recentDialogueIds`. Result: NO `appendTelosRefined` call; NO audit entry; a warn-level log is emitted (optional to assert) and the branch falls through.
    - **Malformed metadata — missing keys:** metadata lacks `before_goal_hash` or `after_goal_hash`. Result: runner catches the `TypeError` thrown by `appendTelosRefined`, logs warning, drops silently. No audit entry.
    - **Malformed metadata — bad hash format:** `before_goal_hash === 'nothex'`. Result: same silent-drop via try/catch around `appendTelosRefined`.
    - **Metadata extra keys (e.g. `new_goals` leak attempt from Brain):** runner passes ONLY the three expected keys (plus `did`) to `appendTelosRefined`; any extra keys in `metadata` are IGNORED (explicit destructure in the runner). The `appendTelosRefined` closed-tuple check is a belt-and-suspenders second line of defense.
    - **Non-regression:** Phase 5/6 existing cases (`speak`, `direct_message`, `move`, `trade_request`, `noop`) still compile + all their Phase 6 tests still pass.
  </behavior>
  <action>
    **TDD discipline — author the integration test RED-first BEFORE editing nous-runner.ts.**

    **Step 0 — RED: Create `grid/test/integration/telos-refined-runner-branch.test.ts`** with the test body shown in Step 2 below. Run `cd grid && pnpm test -- integration/telos-refined-runner-branch --run` and CONFIRM the test file fails (not "0 tests found"). All 6 scenarios should fail because the `case 'telos_refined':` branch does not yet exist in nous-runner.ts.

    **Step 1 — Edit `grid/src/integration/nous-runner.ts`:**
    Inside the `executeActions` method (the switch statement that dispatches on `action.action_type`), add a new `case 'telos_refined':` branch. Location: AFTER the existing `case 'trade_request':` and BEFORE the `default:` / `case 'noop':` (whichever comes last in the file). Follow the PATTERNS.md §nous-runner.ts shape verbatim, adapted to (a) use THIS plan's `appendTelosRefined` import, (b) reference the `recentDialogueIds` seam that Plan 01 created.

    Add at the top of the file (import block):
    ```typescript
    import { appendTelosRefined } from '../audit/append-telos-refined';
    ```
    (or `from '../audit'` if Plan 03 Task 1 re-exported from the barrel — prefer the barrel.)

    Add the new case:
    ```typescript
            case 'telos_refined': {
                // DIALOG-02 D-16 — validate authority before emitting audit.
                // The Brain metadata carries 3 keys; the runner injects `did`
                // (self-reporting per D-31). Unknown dialogue_ids drop silently.
                const md = (action.metadata ?? {}) as Record<string, unknown>;
                const dialogueId = typeof md.triggered_by_dialogue_id === 'string'
                    ? md.triggered_by_dialogue_id
                    : '';
                const beforeHash = typeof md.before_goal_hash === 'string'
                    ? md.before_goal_hash
                    : '';
                const afterHash = typeof md.after_goal_hash === 'string'
                    ? md.after_goal_hash
                    : '';

                if (!this.recentDialogueIds.has(dialogueId)) {
                    // Replay-protection / forgery guard (D-16). A Brain cannot
                    // claim participation in a dialogue its runner never delivered.
                    log.warn(
                        { nous: this.nousDid, dialogueId },
                        'telos_refined: unknown dialogue_id, dropping silently',
                    );
                    break;
                }

                try {
                    appendTelosRefined(this.audit, this.nousDid, {
                        did: this.nousDid,           // self-report — matches actorDid per D-31
                        before_goal_hash: beforeHash,
                        after_goal_hash: afterHash,
                        triggered_by_dialogue_id: dialogueId,
                    });
                } catch (err) {
                    // Producer-boundary rejection (D-16: any assertion fail → drop).
                    log.warn(
                        { err, nous: this.nousDid },
                        'telos_refined: producer-boundary rejected payload, dropping',
                    );
                }
                break;
            }
    ```

    **Critical notes for the executor:**
    - Use the existing logger import style in nous-runner.ts — do NOT introduce a new `log`/`logger` import if one is already in scope.
    - The `break;` must be inside the block braces — TypeScript switch-case without block scope shares variable names across cases and will cause compile errors.
    - Do NOT propagate `err` — this case drops silently by design (mirrors Phase 6 malformed-brain-response pattern per D-16 step 4).
    - Do NOT add a `default:` branch — the existing default handles unknown action types.

    **Step 2 — `grid/test/integration/telos-refined-runner-branch.test.ts` (authored RED in Step 0; GREEN after Step 1):**
    ```typescript
    /**
     * DIALOG-02 integration: NousRunner.executeActions case 'telos_refined'.
     *
     * Covers 07-CONTEXT D-16 (validation), D-17 (sole producer path), D-31
     * (self-report did invariant). Tests the runner's branch in isolation
     * with a real AuditChain + a fake Brain bridge.
     */
    import { describe, expect, it, vi } from 'vitest';
    import { AuditChain } from '../../src/audit/chain';
    import { NousRunner } from '../../src/integration/nous-runner';
    // [Executor: import helpers from the existing integration test fixture
    //  in grid/test/integration/agency-integration.test.ts — reuse make-runner
    //  factories if they exist; do not duplicate brain-bridge stubs.]

    const NOUS_DID = 'did:noesis:alpha';
    const KNOWN_DIALOGUE_ID = 'a1b2c3d4e5f60718';
    const UNKNOWN_DIALOGUE_ID = 'deadbeefdeadbeef';
    const BEFORE_HASH = 'a'.repeat(64);
    const AFTER_HASH  = 'b'.repeat(64);

    function makeBrainAction(overrides: Partial<{ dialogue_id: string; before: string; after: string }> = {}): unknown {
        return {
            action_type: 'telos_refined',
            channel: '',
            text: '',
            metadata: {
                triggered_by_dialogue_id: overrides.dialogue_id ?? KNOWN_DIALOGUE_ID,
                before_goal_hash: overrides.before ?? BEFORE_HASH,
                after_goal_hash:  overrides.after  ?? AFTER_HASH,
            },
        };
    }

    describe('NousRunner — case telos_refined (DIALOG-02 D-16)', () => {
        let chain: AuditChain;
        let runner: NousRunner;

        beforeEach(() => {
            chain = new AuditChain();
            // [Executor: construct NousRunner using the project's existing test
            //  helper; ensure recentDialogueIds is accessible/pre-populatable.]
            runner = /* ...factory with audit=chain, nousDid=NOUS_DID... */ null as unknown as NousRunner;
            // Seed recentDialogueIds with the KNOWN id (Plan 01 exposes this
            // via either a public method or the test helper).
            (runner as unknown as { recentDialogueIds: Set<string> }).recentDialogueIds.add(KNOWN_DIALOGUE_ID);
        });

        it('valid telos_refined action → appends exactly one telos.refined entry', async () => {
            await runner.executeActions([makeBrainAction()] as never);
            const refined = chain.entries.filter(e => e.event_type === 'telos.refined');
            expect(refined).toHaveLength(1);
            expect(refined[0].payload).toEqual({
                did: NOUS_DID,
                before_goal_hash: BEFORE_HASH,
                after_goal_hash: AFTER_HASH,
                triggered_by_dialogue_id: KNOWN_DIALOGUE_ID,
            });
        });

        it('unknown dialogue_id drops silently — no audit entry', async () => {
            await runner.executeActions([makeBrainAction({ dialogue_id: UNKNOWN_DIALOGUE_ID })] as never);
            const refined = chain.entries.filter(e => e.event_type === 'telos.refined');
            expect(refined).toHaveLength(0);
        });

        it('malformed before_goal_hash drops silently — producer-boundary rejects', async () => {
            await runner.executeActions([makeBrainAction({ before: 'nothex' })] as never);
            const refined = chain.entries.filter(e => e.event_type === 'telos.refined');
            expect(refined).toHaveLength(0);
        });

        it('malformed after_goal_hash drops silently', async () => {
            await runner.executeActions([makeBrainAction({ after: 'Z'.repeat(64) })] as never);
            const refined = chain.entries.filter(e => e.event_type === 'telos.refined');
            expect(refined).toHaveLength(0);
        });

        it('missing metadata keys drop silently', async () => {
            const bad = { action_type: 'telos_refined', channel: '', text: '', metadata: {} };
            await runner.executeActions([bad] as never);
            expect(chain.entries.filter(e => e.event_type === 'telos.refined')).toHaveLength(0);
        });

        it('extra keys in Brain metadata (e.g. new_goals leak attempt) are not propagated', async () => {
            const leaky = {
                action_type: 'telos_refined',
                channel: '', text: '',
                metadata: {
                    triggered_by_dialogue_id: KNOWN_DIALOGUE_ID,
                    before_goal_hash: BEFORE_HASH,
                    after_goal_hash: AFTER_HASH,
                    new_goals: ['leaked plaintext'],       // must not reach audit
                    prompt: 'leaked prompt',               // must not reach audit
                },
            };
            await runner.executeActions([leaky] as never);
            const refined = chain.entries.filter(e => e.event_type === 'telos.refined');
            expect(refined).toHaveLength(1);
            const keys = Object.keys(refined[0].payload).sort();
            expect(keys).toEqual(['after_goal_hash', 'before_goal_hash', 'did', 'triggered_by_dialogue_id']);
            expect(refined[0].payload).not.toHaveProperty('new_goals');
            expect(refined[0].payload).not.toHaveProperty('prompt');
        });
    });
    ```

    **Step 3 — CONFIRM GREEN:** Run `cd grid && pnpm test -- integration/telos-refined-runner-branch --run` and confirm vitest reports 6/6 passing (non-zero count).

    **Do NOT:**
    - Add a `setRecentDialogueIds` public API to NousRunner just for tests — use the type-assertion seam pattern (`(runner as unknown as {...}).recentDialogueIds.add(...)`) so the production API stays clean.
    - Broadcast anything new — `audit.append` → `WsHub` → allowlist → clients is the existing wiring. This branch does not touch WsHub directly.
    - Mutate `recentDialogueIds` after the call — a single action consumes but does not evict.
  </action>
  <verify>
    <automated>cd grid &amp;&amp; pnpm test -- integration/telos-refined-runner-branch --run &amp;&amp; pnpm run typecheck</automated>
  </verify>
  <done>
    - `grep "case 'telos_refined':" grid/src/integration/nous-runner.ts` returns a match.
    - `grep "appendTelosRefined" grid/src/integration/nous-runner.ts` returns exactly one match (the call inside the new case).
    - `cd grid && pnpm test -- integration/telos-refined-runner-branch --run` reports 6/6 green (non-zero count).
    - `cd grid && pnpm run typecheck` passes.
    - `cd grid && pnpm test -- integration --run` reports no regressions in Phase 6 tests.
    - The producer-boundary test from Task 1 (`telos-refined-producer-boundary.test.ts`) also passes after this change — nous-runner.ts does NOT call `audit.append('telos.refined', ...)` directly; it goes via `appendTelosRefined`.
  </done>
</task>

<task type="auto">
  <name>Task 3: Doc-sync — check-state-doc-sync.mjs + STATE.md + README.md in one coherent edit (CLAUDE.md rule)</name>
  <files>scripts/check-state-doc-sync.mjs, .planning/STATE.md, README.md</files>
  <read_first>
    - CLAUDE.md (Documentation Sync Rule — lines 1-80; pay special attention to "When this rule fires" and "How to apply it" sections; Phase 7 fires because allowlist grows 16→17)
    - scripts/check-state-doc-sync.mjs (FULL — the current regression gate asserts 16 events + enumerates them in a required array; Plan 03 bumps both)
    - .planning/STATE.md (find the allowlist-enumeration section — Phase 6 shipped "16 events"; Phase 7 updates to "17 events" and appends telos.refined to the list)
    - README.md (full file — search for "16" or "allowlist" or "events"; update only if README makes a count promise)
    - .planning/MILESTONES.md (Phase 6 entry — confirms the doc-sync ritual was carried out at 11→16; Phase 7 follows same ritual)
    - 07-CONTEXT.md D-32 (doc-sync reconciliation rule for this phase)
    - 07-PATTERNS.md §scripts/check-state-doc-sync.mjs (the 16→17 edit pattern)
  </read_first>
  <action>
    **Step 1 — Update `scripts/check-state-doc-sync.mjs`:**
    Locate the block asserting `16 events` in STATE.md (failure message reads something like "STATE.md does not mention '16 events' ..."). Update:
    - Change the regex from `/16\s+events/i` (or equivalent literal) to `/17\s+events/i`.
    - Update the failure message string from "16 events" to "17 events" and append a note referencing Phase 7: e.g. `"Phase 7 bumped allowlist to 17 events (telos.refined at position 17)."`.

    Locate the `required` array (the enumerated allowlist). Append `'telos.refined'` as the 17th entry AFTER `'operator.telos_forced'`:
    ```javascript
    const required = [
      'nous.spawned', 'nous.moved', 'nous.spoke', 'nous.direct_message',
      'trade.proposed', 'trade.reviewed', 'trade.settled',
      'law.triggered', 'tick', 'grid.started', 'grid.stopped',
      'operator.inspected', 'operator.paused', 'operator.resumed',
      'operator.law_changed', 'operator.telos_forced',
      'telos.refined', // Phase 7 (DIALOG-02) — Nous-initiated hash-only refinement
    ];
    ```

    Update the top-of-file doc comment to mention Phase 7:
    ```javascript
    /**
     * check-state-doc-sync.mjs — keep STATE.md's allowlist enumeration in
     * lockstep with grid/src/audit/broadcast-allowlist.ts.
     *
     * Phase 1 (v1): 10 events.
     * Phase 5 (REV-02): +1 trade.reviewed → 11.
     * Phase 6 (AGENCY-02/03): +5 operator.* → 16.
     * Phase 7 (DIALOG-02): +1 telos.refined → 17.
     *
     * Fails CI if STATE.md fails to mention '17 events' OR if any required
     * event is missing from the STATE.md allowlist section.
     */
    ```

    **Step 2 — Update `.planning/STATE.md`:**
    Locate the accumulated-context section that enumerates the broadcast allowlist (likely under a heading like "Broadcast allowlist" or "Accumulated Context"). Phase 6 shipped it as 16 events. Update:

    - Change "16 events" → "17 events" everywhere it appears in that enumeration section.
    - Append `telos.refined` as the 17th bullet/item, with a one-line gloss:
      ```
      17. `telos.refined` — Phase 7 (DIALOG-02). Nous-initiated hash-only event
          emitted when a Brain refines its Telos after a peer dialogue. Payload:
          `{did, before_goal_hash, after_goal_hash, triggered_by_dialogue_id}`
          (4 keys closed tuple per D-20). Sole producer path:
          `grid/src/audit/append-telos-refined.ts`.
      ```
    - If STATE.md has a "Crown-jewel regression hashes" or "Zero-diff invariants" section, add a note that Phase 7 extends the zero-diff invariant to 0-vs-10-listener determinism across dialogue + refinement (D-23). The pinned hash itself comes from Plan 01's zero-diff test output — reference the test file, not a specific hash (which depends on the test's simulation and will be filled in when the test stabilizes).
    - Update the STATE.md "Current focus" / "Sprint" / "Phase" section: Phase 7 moves from planning → execution once this task runs; Plan 04 is the remaining dashboard phase work.
    - Date-stamp the change (the existing STATE.md convention uses `Last updated: YYYY-MM-DD`).

    **Step 3 — Update `README.md`:**
    Search the entire README.md for the literal strings `16 events`, `16 event types`, `allowlist`, and `telos_forced`.
    - If README.md currently claims a count (e.g., "...16-event broadcast allowlist..."), update to "17-event".
    - If README.md enumerates event types (rare — usually in a Quickstart or Architecture section), append `telos.refined`.
    - If README.md does NOT mention the count or enumerate events, this step is a no-op for README — but DO NOT silently skip. Add a brief comment to the Plan 03 Summary explaining that README did not need updating.
    - Update any "current status" or "milestone" callout at the top of the README to reflect that Phase 7 DIALOG-02 has shipped (or is in progress, depending on when the summary is written).

    **Step 4 — (Optional but recommended) Update `.planning/MILESTONES.md`:**
    If MILESTONES.md enumerates events per milestone (per Phase 6 precedent), append a Phase 7 entry under v2.1 showing the allowlist bump 16→17. If MILESTONES.md only captures milestone-level summaries (no event-level detail), leave it alone — Plan 04's phase-close summary handles the milestone narrative.

    **Step 5 — Verify doc-sync passes:**
    Run `node scripts/check-state-doc-sync.mjs`. It MUST exit 0. If it fails, the script output will name the specific mismatch — fix by editing STATE.md (not the script, unless the script's regex itself was the issue).

    **Do NOT:**
    - Edit CLAUDE.md (the doc-sync rule is the governance layer, not a per-phase artifact).
    - Edit PHILOSOPHY.md unless Phase 7 introduces a worldview-level invariant (CONTEXT doesn't — the hash-only invariant is already in Phase 6's PHILOSOPHY entry). Skip unless you find a gap.
    - Edit ROADMAP.md at this step — Plan 04 updates ROADMAP on phase close.
    - Commit in this task — the planner-specified workflow commits at phase close, not per-task.
  </action>
  <verify>
    <automated>node scripts/check-state-doc-sync.mjs &amp;&amp; cd grid &amp;&amp; pnpm test -- audit/allowlist-seventeen --run</automated>
  </verify>
  <done>
    - `node scripts/check-state-doc-sync.mjs` exits 0.
    - `grep "17 events" .planning/STATE.md` returns at least one match.
    - `grep "telos.refined" .planning/STATE.md` returns at least one match.
    - `grep "'telos.refined'" scripts/check-state-doc-sync.mjs` returns exactly one match (the required-array entry).
    - `grep "17" scripts/check-state-doc-sync.mjs` returns matches for the count assertion.
    - README.md either (a) mentions "17" in the allowlist context or (b) has no allowlist-count claim at all (both are acceptable; a stale "16" is NOT).
    - The allowlist-seventeen vitest test still passes (confirms STATE.md and code stayed in lockstep).
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Brain (Python) → Grid (TypeScript) over RPC | Untrusted JSON payload; nous-runner.ts validates and strips before producer-boundary |
| NousRunner → AuditChain via appendTelosRefined | Sole producer path; all Brain-originated telos.refined events pass through this single helper |
| AuditChain → WsHub → WebSocket clients | Allowlist + payloadPrivacyCheck gate (broadcast-allowlist.ts) |
| grid/src/ codebase ← developer edits over time | Producer-boundary invariant test + sole-call-site grep prevents scattered audit.append calls from bypassing the helper |
| grid code + STATE.md + check-state-doc-sync.mjs | Doc-sync regression gate enforces triad stays coherent across edits |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-07-20 | Spoofing | Compromised Brain forges a `triggered_by_dialogue_id` it never received | mitigate | `NousRunner.recentDialogueIds` authority check (D-16 step 1) — only dialogue_ids the runner itself delivered to THIS Brain are acceptable. Unknown ids drop silently. |
| T-07-21 | Spoofing | Compromised Brain claims a different Nous's DID in metadata | mitigate | `appendTelosRefined` enforces `payload.did === actorDid` (self-report invariant). Runner hard-codes `did: this.nousDid` and ignores any `did` in Brain metadata. |
| T-07-22 | Tampering | Someone edits broadcast-allowlist.ts to remove an event | mitigate | `allowlist-seventeen.test.ts` pins the full 17-tuple by array literal comparison; any reorder / removal / addition fails. |
| T-07-23 | Tampering | Scattered `audit.append('telos.refined', ...)` calls accrete across grid/src/ over time | mitigate | `telos-refined-producer-boundary.test.ts` grep-scans grid/src/ on every test run; only `append-telos-refined.ts` is exempt. |
| T-07-24 | Repudiation | Developer forgets to update STATE.md when code changes | mitigate | `scripts/check-state-doc-sync.mjs` runs in CI (Phase 5 / Phase 6 precedent); STATE.md must mention "17 events" and list telos.refined. |
| T-07-25 | Info Disclosure | Brain metadata carries `new_goals: [...]` or `prompt: ...`; leaks into audit | mitigate | (a) NousRunner destructures metadata explicitly — only 3 known keys reach the helper; (b) `appendTelosRefined` closed-tuple check rejects any unexpected key; (c) `payloadPrivacyCheck` runs as belt-and-suspenders third gate. Plan 03 Task 2 Test 6 asserts this. |
| T-07-26 | Info Disclosure | Nested forbidden key slips past (e.g. `meta: {prompt: 'leak'}`) | mitigate | `payloadPrivacyCheck` is recursive (Phase 1 / Phase 6 invariant); `telos-refined-privacy.test.ts` has an explicit `nested.prompt` case. |
| T-07-27 | DoS | Brain spams telos_refined actions every tick → audit chain + WsHub floods | accept | Brain-side Plan 02 discipline: no-op refinements (before_hash == after_hash) are silent; a well-behaved Brain emits at most once per dialogue. Future rate-limiting is a deferred idea (CONTEXT). |
| T-07-28 | DoS | Attacker crafts a payload with a huge `triggered_by_dialogue_id` string | mitigate | DIALOGUE_ID_RE requires exactly 16 hex chars; any length mismatch throws TypeError at producer boundary before chain.append runs. |
| T-07-29 | Elevation | Malicious PR extends allowlist silently without updating STATE.md | mitigate | Doc-sync script + required-array literal makes silent extension impossible in code review (the test fails, STATE.md mismatch shows in the PR diff). |
| T-07-30 | Elevation | telos.refined event carried a `tier` field suggesting operator authority | mitigate | Closed-tuple check rejects any key outside {did, before_goal_hash, after_goal_hash, triggered_by_dialogue_id}. No `tier` possible. |
</threat_model>

<verification>
**Holistic end-to-end check after all three tasks:**

1. **Allowlist + privacy + producer-boundary:** `cd grid && pnpm test -- audit --run` — all Phase 6 tests green + all three new Plan 03 test files green.
2. **Runner branch:** `cd grid && pnpm test -- integration --run` — all Phase 6 agency integration tests green + new Plan 03 runner-branch test green.
3. **Typecheck:** `cd grid && pnpm run typecheck` — clean.
4. **Doc-sync regression:** `node scripts/check-state-doc-sync.mjs` — exit 0.
5. **Full Grid suite:** `cd grid && pnpm test` — green.
6. **Full Brain suite:** `cd brain && uv run pytest tests/ -x -q` — still green (Plan 02 output preserved; Plan 03 does not touch Python).
7. **Sovereign moat cross-check:** `grep -rn "telos.refined" grid/src/` should return matches in exactly: `grid/src/audit/broadcast-allowlist.ts` (allowlist entry), `grid/src/audit/append-telos-refined.ts` (producer helper + the `audit.append` call). Any other match is a producer-boundary violation that `telos-refined-producer-boundary.test.ts` should also catch.
</verification>

<success_criteria>
- [ ] `ALLOWLIST_MEMBERS.length === 17` and position 17 is `'telos.refined'`.
- [ ] `appendTelosRefined(chain, actorDid, payload)` exists as the SOLE producer helper for `telos.refined`.
- [ ] Regex guards applied: DID (`actorDid` + `payload.did`), HEX64 (both goal hashes), DIALOGUE_ID (16-hex). All malformed inputs → `TypeError`.
- [ ] Closed 4-key tuple enforced: `Object.keys(payload).sort() === ['after_goal_hash', 'before_goal_hash', 'did', 'triggered_by_dialogue_id']`.
- [ ] Self-report invariant: `payload.did === actorDid` — a Nous cannot audit-emit a refinement on behalf of another.
- [ ] 8-case privacy matrix (6 flat + 1 nested forbidden + 1 happy) all green; coverage assertion confirms `telos.refined` in allowlist.
- [ ] `NousRunner.executeActions` has a `case 'telos_refined':` branch that uses `recentDialogueIds` for the authority check and `appendTelosRefined` for emission.
- [ ] 6-case runner-branch integration test all green (valid, unknown id, bad before_hash, bad after_hash, missing keys, leak-attempt).
- [ ] Producer-boundary grep test green: no file other than `grid/src/audit/append-telos-refined.ts` calls `audit.append` with `'telos.refined'`.
- [ ] Doc-sync triad coherent: `check-state-doc-sync.mjs` asserts 17 + includes `telos.refined`; STATE.md enumerates 17 events; README.md has no stale "16" claims.
- [ ] CLAUDE.md doc-sync rule honored: all doc changes in the SAME task as the code flipping the allowlist length.
</success_criteria>

<output>
After completion, create `.planning/phases/07-peer-dialogue-telos-refinement/07-03-SUMMARY.md` covering:
- Line counts for each modified file.
- All test counts (allowlist-seventeen: 4, privacy matrix: ≥9, producer-boundary: 2, runner-branch: 6).
- Confirmation that `node scripts/check-state-doc-sync.mjs` exits 0.
- Any README.md changes (or explicit note that README did not claim an allowlist count, so no-op there).
- Confirmation that the producer-boundary invariant test passes — list the `grep -rn "telos.refined" grid/src/` output to prove ONLY the allowlist entry + the producer helper reference the literal string.
- Hand-off note to Plan 04: the audit chain now emits `telos.refined` events with the 4-key closed payload. Plan 04's Inspector hook (`useRefinedTelosHistory`) subscribes to the firehose stream, filters `eventType === 'telos.refined' && payload.did === did`, and collects `after_goal_hash` into a Set. No new RPC, no new WebSocket channel. Dashboard testids from 07-UI-SPEC: `telos-refined-badge`, `telos-refined-chip`, `firehose-filter-chip`, `firehose-filter-clear`.
</output>
