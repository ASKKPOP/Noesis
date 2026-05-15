# Phase 17: Iris (Theory of Mind) — Pattern Map

**Mapped:** 2026-05-15
**Files analyzed:** 11 new/modified files
**Analogs found:** 11 / 11

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `grid/src/iris/appendIrisBeliefRevised.ts` | emitter (sole-producer) | request-response | `grid/src/bios/appendBiosBirth.ts` | exact (hash-key payload, no enums) |
| `grid/src/iris/appendIrisContextInvoked.ts` | emitter (sole-producer) | request-response | `grid/src/bios/appendBiosBirth.ts` | exact (count-only payload) |
| `grid/src/iris/appendIrisContradictionDetected.ts` | emitter (sole-producer) | request-response | `grid/src/bios/appendBiosBirth.ts` | exact (hash-key payload, no enums) |
| `grid/src/iris/appendIrisPriorSeeded.ts` | emitter (sole-producer) | request-response | `grid/src/bios/appendBiosBirth.ts` | exact (hash-key payload, no enums) |
| `grid/src/iris/index.ts` | barrel export | — | `grid/src/ananke/index.ts` | exact |
| `grid/src/integration/nous-runner.ts` (modify) | coordinator | request-response | `case 'drive_crossed'` in same file | exact (lines 408–429) |
| `grid/src/audit/broadcast-allowlist.ts` (modify) | allowlist + privacy | — | existing file (lines 62–127, 274) | exact (append 4 entries + regex extension) |
| `brain/src/noesis_brain/rpc/types.py` (modify) | enum | — | existing `ActionType` members | exact (append 4 new members after line 33) |
| `brain/src/noesis_brain/rpc/handler.py` (modify) | service orchestrator | event-driven | seed_priors block (lines 212–228) | exact (same optional-dep guard pattern) |
| `protocol/src/noesis/bridge/types.ts` (modify) | bridge contract | — | existing `BrainAction.action_type` union | exact (union extension) |
| `grid/src/iris/*.test.ts` + `brain/tests/iris/*.py` | tests | — | `grid/test/ananke/append-drive-crossed.test.ts` | exact |

---

## Pattern Assignments

---

### `grid/src/iris/appendIrisBeliefRevised.ts` — sole-producer emitter

**Analog:** `grid/src/bios/appendBiosBirth.ts`

The Iris emitters carry **hash strings** rather than enums, so the bios analog is the closest match: it validates a hash field (psyche_hash), a DID, and a tick — no closed-enum gates. The drive-crossed analog (`append-drive-crossed.ts`) adds enum gates that do not apply here.

**Key differences vs drive-crossed:**
- No enum validation steps (drive / level / direction)
- Payload keys: `{nous_did, tick, target_did, belief_hash}` (4 keys; Grid injects `nous_did` + `tick`)
- Hash fields validated with `HEX64_RE` (see bios pattern) or relaxed to non-empty hex string per hash key
- `nous_did` replaces `did` as the self-report field name (matches D-17-07 "Grid injects nous_did")
- Event string: `'iris.belief_revised'`

**Imports pattern** (copy from `grid/src/bios/appendBiosBirth.ts` lines 28–31):
```typescript
import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';
import { payloadPrivacyCheck } from '../audit/broadcast-allowlist.js';
import { IRIS_BELIEF_REVISED_KEYS, type IrisBeliefRevisedPayload } from './types.js';
```

**Validation order** (copy from `grid/src/bios/appendBiosBirth.ts` lines 50–115, adapt):
```
1. DID regex: actorDid (= nous_did) — throw TypeError
2. DID regex: payload.nous_did — throw TypeError
3. Self-report: payload.nous_did === actorDid — throw TypeError
4. Tick: non-negative integer — throw TypeError
5. DID regex: payload.target_did (peer DID) — throw TypeError
6. Hash field: payload.belief_hash — non-empty string (32-char hex) — throw TypeError
7. Closed-tuple: Object.keys(payload).sort() === EXPECTED_KEYS — throw TypeError
8. Explicit reconstruction: { nous_did, tick, target_did, belief_hash }
9. payloadPrivacyCheck — throw TypeError on violation
10. return audit.append('iris.belief_revised', actorDid, cleanPayload)
```

**Closed-tuple check pattern** (from `grid/src/bios/appendBiosBirth.ts` lines 80–88):
```typescript
const EXPECTED_KEYS = ['belief_hash', 'nous_did', 'target_did', 'tick'] as const;

const actualKeys = Object.keys(payload).sort();
if (
    actualKeys.length !== EXPECTED_KEYS.length ||
    !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])
) {
    throw new TypeError(
        `appendIrisBeliefRevised: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
    );
}
```

**Explicit reconstruction + privacy gate + commit** (from `grid/src/bios/appendBiosBirth.ts` lines 99–114, adapt):
```typescript
const cleanPayload = {
    nous_did: payload.nous_did,
    tick: payload.tick,
    target_did: payload.target_did,
    belief_hash: payload.belief_hash,
};
const privacy = payloadPrivacyCheck(cleanPayload);
if (!privacy.ok) {
    throw new TypeError(
        `appendIrisBeliefRevised: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
    );
}
return audit.append('iris.belief_revised', actorDid, cleanPayload);
```

---

### `grid/src/iris/appendIrisContextInvoked.ts` — sole-producer emitter

**Analog:** `grid/src/bios/appendBiosBirth.ts`

3-key payload: `{nous_did, tick, belief_count}`. No DID peer field; `belief_count` is a non-negative integer. No hash field.

**Key differences vs belief_revised:**
- No `target_did` field; no hash field
- `belief_count` validated as non-negative integer (same tick rule, different field name)
- Event string: `'iris.context_invoked'`

**EXPECTED_KEYS:**
```typescript
const EXPECTED_KEYS = ['belief_count', 'nous_did', 'tick'] as const;
```

**belief_count validation** (insert after tick check, before tuple check):
```typescript
if (!Number.isInteger(payload.belief_count) || payload.belief_count < 0) {
    throw new TypeError(
        `appendIrisContextInvoked: belief_count must be non-negative integer, got ${JSON.stringify(payload.belief_count)}`,
    );
}
```

**Explicit reconstruction:**
```typescript
const cleanPayload = {
    nous_did: payload.nous_did,
    tick: payload.tick,
    belief_count: payload.belief_count,
};
```

---

### `grid/src/iris/appendIrisContradictionDetected.ts` — sole-producer emitter

**Analog:** `grid/src/bios/appendBiosBirth.ts`

4-key payload: `{nous_did, tick, target_did, contradiction_hash}`. Structurally identical to `appendIrisBeliefRevised` — swap `belief_hash` → `contradiction_hash`.

**EXPECTED_KEYS:**
```typescript
const EXPECTED_KEYS = ['contradiction_hash', 'nous_did', 'target_did', 'tick'] as const;
```

**Explicit reconstruction:**
```typescript
const cleanPayload = {
    nous_did: payload.nous_did,
    tick: payload.tick,
    target_did: payload.target_did,
    contradiction_hash: payload.contradiction_hash,
};
```

Event string: `'iris.contradiction_detected'`

---

### `grid/src/iris/appendIrisPriorSeeded.ts` — sole-producer emitter

**Analog:** `grid/src/bios/appendBiosBirth.ts`

4-key payload: `{nous_did, tick, target_did, seed_event_hash}`. Structurally identical to `appendIrisBeliefRevised` — swap `belief_hash` → `seed_event_hash`.

**EXPECTED_KEYS:**
```typescript
const EXPECTED_KEYS = ['nous_did', 'seed_event_hash', 'target_did', 'tick'] as const;
```

**Explicit reconstruction:**
```typescript
const cleanPayload = {
    nous_did: payload.nous_did,
    tick: payload.tick,
    target_did: payload.target_did,
    seed_event_hash: payload.seed_event_hash,
};
```

Event string: `'iris.prior_seeded'`

---

### `grid/src/iris/index.ts` — barrel export

**Analog:** `grid/src/ananke/index.ts` (full content, lines 1–4)

```typescript
/** Phase 10a Grid-side Ananke drive audit surface — DRIVE-03, DRIVE-05. */
export { appendAnankeDriveCrossed, DID_RE } from './append-drive-crossed.js';
export { ANANKE_DIRECTIONS, ANANKE_DRIVE_LEVELS, ANANKE_DRIVE_NAMES } from './types.js';
export type { AnankeDirection, AnankeDriveCrossedPayload, AnankeDriveLevel, AnankeDriveName } from './types.js';
```

**Phase 17 adaptation:**
```typescript
/** Phase 17 Grid-side Iris Theory of Mind audit surface — D-17-08. */
export { appendIrisBeliefRevised } from './appendIrisBeliefRevised.js';
export { appendIrisContextInvoked } from './appendIrisContextInvoked.js';
export { appendIrisContradictionDetected } from './appendIrisContradictionDetected.js';
export { appendIrisPriorSeeded } from './appendIrisPriorSeeded.js';
export type {
    IrisBeliefRevisedPayload,
    IrisContextInvokedPayload,
    IrisContradictionDetectedPayload,
    IrisPriorSeededPayload,
} from './types.js';
```

---

### `grid/src/integration/nous-runner.ts` — 4 new case branches

**Exact insertion point:** After `case 'vote_reveal'` block closes (line 626, before `case 'noop'`).

**Analog:** `case 'drive_crossed'` block (lines 408–429):
```typescript
case 'drive_crossed': {
    // Phase 10a DRIVE-03 / D-10a-03, D-10a-04: Grid injects
    // did+tick (3-keys-not-5 invariant). `tick` is the world-clock
    // tick from executeActions — NEVER Date.now(). Rejections
    // drop silently per T-10a-18 so sibling actions still dispatch.
    try {
        appendAnankeDriveCrossed(this.audit, this.nousDid, {
            did: this.nousDid,
            tick,
            drive: action.metadata.drive,
            level: action.metadata.level,
            direction: action.metadata.direction,
        });
    } catch (err) {
        console.warn(JSON.stringify({
            event: 'ananke.dispatch.rejected',
            did: this.nousDid,
            reason: (err as Error).message,
        }));
    }
    break;
}
```

**4 new cases to insert** (follow the exact structure above):
```typescript
case 'iris_belief_revised': {
    // Phase 17 D-17-09: Grid injects nous_did+tick (3-keys-not-5).
    // Rejections drop silently; never throws to sibling actions.
    try {
        appendIrisBeliefRevised(this.audit, this.nousDid, {
            nous_did: this.nousDid,
            tick,
            target_did: action.metadata['target_did'] as string,
            belief_hash: action.metadata['belief_hash'] as string,
        });
    } catch (err) {
        console.warn(JSON.stringify({
            event: 'iris.dispatch.rejected',
            action_type: 'iris_belief_revised',
            did: this.nousDid,
            reason: (err as Error).message,
        }));
    }
    break;
}

case 'iris_context_invoked': {
    try {
        appendIrisContextInvoked(this.audit, this.nousDid, {
            nous_did: this.nousDid,
            tick,
            belief_count: action.metadata['belief_count'] as number,
        });
    } catch (err) {
        console.warn(JSON.stringify({
            event: 'iris.dispatch.rejected',
            action_type: 'iris_context_invoked',
            did: this.nousDid,
            reason: (err as Error).message,
        }));
    }
    break;
}

case 'iris_contradiction_detected': {
    try {
        appendIrisContradictionDetected(this.audit, this.nousDid, {
            nous_did: this.nousDid,
            tick,
            target_did: action.metadata['target_did'] as string,
            contradiction_hash: action.metadata['contradiction_hash'] as string,
        });
    } catch (err) {
        console.warn(JSON.stringify({
            event: 'iris.dispatch.rejected',
            action_type: 'iris_contradiction_detected',
            did: this.nousDid,
            reason: (err as Error).message,
        }));
    }
    break;
}

case 'iris_prior_seeded': {
    try {
        appendIrisPriorSeeded(this.audit, this.nousDid, {
            nous_did: this.nousDid,
            tick,
            target_did: action.metadata['target_did'] as string,
            seed_event_hash: action.metadata['seed_event_hash'] as string,
        });
    } catch (err) {
        console.warn(JSON.stringify({
            event: 'iris.dispatch.rejected',
            action_type: 'iris_prior_seeded',
            did: this.nousDid,
            reason: (err as Error).message,
        }));
    }
    break;
}
```

**Import additions** (insert after line 28 `import { appendBallotRevealed }...`):
```typescript
import {
    appendIrisBeliefRevised,
    appendIrisContextInvoked,
    appendIrisContradictionDetected,
    appendIrisPriorSeeded,
} from '../iris/index.js';
```

---

### `grid/src/audit/broadcast-allowlist.ts` — allowlist bump + FORBIDDEN_KEY_PATTERN

**File:** `/Users/desirey/Programming/src/Noesis/grid/src/audit/broadcast-allowlist.ts`

#### Insertion point 1: ALLOWLIST_MEMBERS array header comment (lines 24–61)

Current header ends with: `"Phase 13 (REPLAY-02): +1 'operator.exported' at position 27"`.

Update header to add:
```
 *  Phase 15 (REFLEX-02): +3 nous.reflection_authored, nous.self_model_revised, nous.creed_violation at positions 28–30.
 *  Phase 16 (SLEEP-01): +2 nous.sleep.entered, nous.sleep.completed at positions 31–32.
 *  Phase 17 (D-17-02): +4 iris.* events at positions 33–36 (allowlist 32→36).
 *   - 'iris.belief_revised'       (33) — closed 4-key {nous_did, tick, target_did, belief_hash}
 *   - 'iris.context_invoked'      (34) — closed 3-key {nous_did, tick, belief_count}
 *   - 'iris.contradiction_detected' (35) — closed 4-key {nous_did, tick, target_did, contradiction_hash}
 *   - 'iris.prior_seeded'         (36) — closed 4-key {nous_did, tick, target_did, seed_event_hash}
 *  All 4 emitted ONLY via grid/src/iris/append*.ts sole-producer emitters.
```

**NOTE:** Wave 0 MUST verify positions 28–32 exist. If missing, add Phase 15/16 entries as prerequisites per D-17-01.

#### Insertion point 2: End of `ALLOWLIST_MEMBERS` array (after line 127 `'operator.exported'`):

```typescript
    // Phase 17 (IRIS-01..04 / D-17-02) — Theory of Mind lifecycle events.
    // All 4 carry hashes/counts only — belief content is Brain-private and NEVER crosses the wire.
    // Sole producers in grid/src/iris/append*.ts (D-17-08).
    'iris.belief_revised',        // (33) {nous_did, tick, target_did, belief_hash}
    'iris.context_invoked',       // (34) {nous_did, tick, belief_count}
    'iris.contradiction_detected', // (35) {nous_did, tick, target_did, contradiction_hash}
    'iris.prior_seeded',          // (36) {nous_did, tick, target_did, seed_event_hash}
```

#### Insertion point 3: FORBIDDEN_KEY_PATTERN (line 274)

Current value ends with: `...ousia_weight/i`

**Extend** by appending `|belief_content|target_content|emotion_text|dimension_text|belief_prose|iris_content` before the `/i` flag:

```typescript
export const FORBIDDEN_KEY_PATTERN = /prompt|response|wiki|reflection|thought|emotion_delta|hunger|curiosity|safety|boredom|loneliness|drive_value|energy|sustenance|need_value|bios_value|subjective_multiplier|chronos_multiplier|subjective_tick|text|body|content|message|utterance|plaintext|decrypted|payload_plain|description|rationale|proposal_text|law_text|body_text|weight|reputation|relationship_score|ousia_weight|belief_content|target_content|emotion_text|dimension_text|belief_prose|iris_content/i;
```

Also add an `IRIS_FORBIDDEN_KEYS` export parallel to `GOVERNANCE_FORBIDDEN_KEYS` (lines 205–218 pattern):
```typescript
export const IRIS_FORBIDDEN_KEYS = Object.freeze([
    'belief_content',
    'target_content',
    'emotion_text',
    'dimension_text',
    'belief_prose',
    'iris_content',
] as const);
```

---

### `brain/src/noesis_brain/rpc/types.py` — 4 new ActionType members

**File:** `/Users/desirey/Programming/src/Noesis/brain/src/noesis_brain/rpc/types.py`

**Exact insertion point:** After line 33 (`SKILL_SHARE = "skill_share"`), before the blank line at 34.

**Analog pattern** (lines 21–25, governance block):
```python
    # Phase 12 Wave 3 — D-12-07 / VOTE-05: collective-law governance actions.
    # String values MUST match the Grid NousRunner switch cases exactly.
    PROPOSE = "propose"         # Open a proposal. Metadata: {body_text, deadline_tick, quorum_pct?, supermajority_pct?}
    VOTE_COMMIT = "vote_commit"  # Blind ballot commit. Metadata: {proposal_id, commit_hash}
    VOTE_REVEAL = "vote_reveal"  # Reveal nonce+choice. Metadata: {proposal_id, choice, nonce}
```

**4 new members to insert** (after line 33):
```python
    # Phase 17 — D-17-06: Iris Theory of Mind lifecycle events.
    # String values MUST match the Grid NousRunner switch cases exactly.
    # All 4 are forwarded to the Grid (unlike SKILL_LEARN/RULE_STORE which are Brain-internal only).
    # 3-keys-not-5: Brain metadata carries 1–3 keys; Grid injects nous_did and tick at emit time.
    IRIS_BELIEF_REVISED = "iris_belief_revised"              # Metadata: {target_did, belief_hash, dimension} (3 keys)
    IRIS_CONTEXT_INVOKED = "iris_context_invoked"            # Metadata: {belief_count} (1 key)
    IRIS_CONTRADICTION_DETECTED = "iris_contradiction_detected"  # Metadata: {target_did, contradiction_hash} (2 keys)
    IRIS_PRIOR_SEEDED = "iris_prior_seeded"                  # Metadata: {target_did, seed_event_hash} (2 keys)
```

---

### `brain/src/noesis_brain/rpc/handler.py` — IrisRuntime init + elicit() + context_for()

**File:** `/Users/desirey/Programming/src/Noesis/brain/src/noesis_brain/rpc/handler.py`

#### Insertion point 1: `__init__` constructor — IrisRuntime optional-dep field

**Analog:** The `_iris_runtime` field already partially exists. The `seed_priors` block (lines 212–228) shows `self._iris_runtime is not None` guard is already used. The `__init__` must add the field initialization.

**Pattern reference:** Phase 15 AAULearner optional-dep injection. The field is typed as `IrisRuntime | None = None`.

**Add to `__init__` signature** (after `did: str = ""` on line 50):
```python
        iris_db_dir: str | Path | None = None,
```

**Add to imports** (top of file, after line 24 `from noesis_brain.iris.priors import seed_priors`):
```python
from pathlib import Path
from noesis_brain.iris.store import IrisStore
from noesis_brain.iris.elicit import IrisRuntime
from noesis_brain.iris.integration import context_for
```

**Add to `__init__` body** (after `self._bios_birth_ticks: dict[str, int] = {}` on line 71):
```python
        # Phase 17 D-17-14: IrisRuntime optional-dep injection.
        # If iris_db_dir is None, Iris is disabled for this Nous (no-op on all guards).
        if iris_db_dir is not None:
            _iris_store = IrisStore(
                db_path=Path(iris_db_dir) / f"{self.did.replace(':', '_')}.db",
                nous_did=self.did,
            )
            self._iris_runtime: IrisRuntime | None = IrisRuntime(_iris_store, self.llm)
            self._iris_runtime.set_dispatcher(self._dispatcher if hasattr(self, '_dispatcher') else None)
        else:
            self._iris_runtime = None
```

**NOTE:** The `_dispatcher` reference must match the existing dispatcher registration pattern already in use for `seed_priors`.

#### Insertion point 2: `on_tick()` — elicit() call after seed_priors block

**Current seed_priors block** (lines 212–228 — keep as-is):
```python
        relationship_context = params.get("relationship_context")
        if self._iris_runtime is not None and isinstance(relationship_context, list):
            try:
                seed_priors(
                    edges=relationship_context,
                    nous_did=self.did,
                    store=self._iris_runtime.store,
                    tick=tick,
                    dispatcher=self._iris_runtime.dispatcher,
                )
            except Exception as exc:
                log.warning("iris: seed_priors failed: %s", exc)
```

**Insert immediately after the seed_priors block** (after line 228, before line 229 `if actions:`):
```python
        # Phase 17 D-17-15: IrisRuntime.elicit() — once per peer in dialogue_context.
        # Called after seed_priors(); gated on _iris_runtime present AND dialogue_context provided.
        # Each ElicitResult emits: IRIS_BELIEF_REVISED (non-empty beliefs), IRIS_CONTRADICTION_DETECTED,
        # IRIS_PRIOR_SEEDED (new pair). IRIS_CONTEXT_INVOKED emitted once if any beliefs injected.
        if self._iris_runtime is not None and isinstance(dialogue_ctxs, list):
            total_injected = 0
            for ctx in dialogue_ctxs:
                if not isinstance(ctx, dict):
                    continue
                target_did = ctx.get("counterparty_did", "")
                if not target_did:
                    continue
                try:
                    result = self._iris_runtime.elicit(
                        nous_did=self.did,
                        target_did=target_did,
                        context=ctx,
                        tick=tick,
                    )
                except Exception as exc:
                    log.warning("iris: elicit failed for %s: %s", target_did, exc)
                    continue

                for belief in result.beliefs:
                    actions.append(Action(
                        action_type=ActionType.IRIS_BELIEF_REVISED,
                        metadata={
                            "target_did": target_did,
                            "belief_hash": result.new_hash,
                            "dimension": belief.dimension.value if hasattr(belief.dimension, "value") else str(belief.dimension),
                        },
                    ).to_dict())
                    total_injected += 1

                if result.contradiction:
                    actions.append(Action(
                        action_type=ActionType.IRIS_CONTRADICTION_DETECTED,
                        metadata={
                            "target_did": target_did,
                            "contradiction_hash": result.prior_hash,
                        },
                    ).to_dict())

                if result.new_hash and not result.prior_hash:
                    # First belief for this (nous_did, target_did) pair → prior_seeded
                    actions.append(Action(
                        action_type=ActionType.IRIS_PRIOR_SEEDED,
                        metadata={
                            "target_did": target_did,
                            "seed_event_hash": result.source_event_hash,
                        },
                    ).to_dict())

            # D-17-13: IRIS_CONTEXT_INVOKED emitted once per tick if any beliefs injected.
            if total_injected > 0:
                actions.append(Action(
                    action_type=ActionType.IRIS_CONTEXT_INVOKED,
                    metadata={"belief_count": total_injected},
                ).to_dict())
```

#### Insertion point 3: Prompt builder — context_for() injection

**Location in `on_message()`** (lines 91–103) and the corresponding system prompt call in `on_tick()`. The system prompt builder call is `build_system_prompt(...)`.

**Add context_for() call** before the `build_system_prompt` call in both `on_message` and `on_tick`:
```python
        # Phase 17 D-17-16: Inject Theory of Mind context if Iris is enabled.
        tom_context = None
        if self._iris_runtime is not None:
            tom_context = context_for(
                store=self._iris_runtime.store,
                nous_did=self.did,
                max_peers=3,
                top_k=5,
            )
```

Then pass `tom_context` into `build_system_prompt()` as a new keyword argument:
```python
        system_prompt = build_system_prompt(
            self.psyche, self.thymos.mood, self.telos,
            grid_name=self.grid_name, location=self.location,
            bios_snapshot=bios_rt.state,
            epoch_since_spawn=epoch_since_spawn,
            subjective_multiplier=subjective_multiplier,
            tom_context=tom_context,   # Phase 17 — None when Iris disabled
        )
```

---

### `protocol/src/noesis/bridge/types.ts` — BrainAction union extension

**File:** `/Users/desirey/Programming/src/Noesis/protocol/src/noesis/bridge/types.ts`

**Exact insertion point:** Line 27 — the `action_type` union in `BrainAction`.

**Current value** (line 26–27):
```typescript
    action_type: 'speak' | 'direct_message' | 'move' | 'trade_request' | 'noop';
```

**New value** (extend union to include all forwarded action types):
```typescript
    action_type:
        | 'speak'
        | 'direct_message'
        | 'move'
        | 'trade_request'
        | 'noop'
        | 'telos_refined'
        | 'drive_crossed'
        | 'bios_death'
        | 'propose'
        | 'vote_commit'
        | 'vote_reveal'
        // Phase 17 — D-17-10: Iris Theory of Mind lifecycle events (forwarded to Grid).
        | 'iris_belief_revised'
        | 'iris_context_invoked'
        | 'iris_contradiction_detected'
        | 'iris_prior_seeded';
```

**Note:** The existing union is incomplete (missing telos_refined, drive_crossed, etc. that NousRunner already handles). Phase 17 adds the 4 iris members. The planner must decide whether to backfill missing historical members or add only the 4 iris entries — CONTEXT.md D-17-10 says "extend... with the 4 new iris action strings".

---

### Test files in `grid/src/iris/` and `brain/tests/iris/`

**Grid test analog:** `grid/test/ananke/append-drive-crossed.test.ts` (full file above)

**Test structure to clone:**
```typescript
// grid/test/iris/appendIrisBeliefRevised.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendIrisBeliefRevised } from '../../src/iris/appendIrisBeliefRevised.js';

const NOUS_DID = 'did:noesis:alpha';
const TARGET_DID = 'did:noesis:beta';
const BELIEF_HASH = 'a'.repeat(32);

const happyPayload = {
    nous_did: NOUS_DID,
    tick: 42,
    target_did: TARGET_DID,
    belief_hash: BELIEF_HASH,
};

describe('appendIrisBeliefRevised — Phase 17 sole producer', () => {
    let chain: AuditChain;
    beforeEach(() => { chain = new AuditChain(); });

    it('appends well-formed payload', () => { /* ... */ });
    it('rejects missing key (3-key payload)', () => { /* closed-tuple test */ });
    it('rejects extra key', () => { /* closed-tuple test */ });
    it('rejects mismatched nous_did (self-report invariant)', () => { /* ... */ });
    it('rejects negative tick', () => { /* ... */ });
    it('rejects empty belief_hash', () => { /* ... */ });
    it('rejects forbidden key in payload (privacy gate)', () => { /* ... */ });
});
```

**Producer-boundary test pattern** (clone `grid/test/ananke/drive-crossed-producer-boundary.test.ts`):
```typescript
// grid/test/iris/iris-producer-boundary.test.ts
// Verifies each iris.* event string appears ONLY in:
//   - grid/src/audit/broadcast-allowlist.ts
//   - its sole emitter (grid/src/iris/append*.ts)
const SOLE_EMITTERS = {
    'iris.belief_revised': 'iris/appendIrisBeliefRevised.ts',
    'iris.context_invoked': 'iris/appendIrisContextInvoked.ts',
    'iris.contradiction_detected': 'iris/appendIrisContradictionDetected.ts',
    'iris.prior_seeded': 'iris/appendIrisPriorSeeded.ts',
};
```

**Brain test analog:** Mirror Phase 14 FixtureBrainAdapter pattern (per CONTEXT.md). Tests cover:
- Cooldown: 50 ticks same peer → at most ceil(50/20) = 3 elicit() calls
- Contradiction threshold: delta < 0.3 does NOT trigger iris.contradiction_detected
- Append-only: 20 beliefs for same (target_did, dimension) → 10 active, 10 superseded, total=20
- Zero-diff: 100-tick sim with Iris enabled vs disabled produces chain head byte-identical modulo iris.* entries

---

## Shared Patterns

### DID Regex
**Source:** `grid/src/bios/appendBiosBirth.ts` line 34 (identical in all emitters)
**Apply to:** All 4 appendIris* emitters
```typescript
/** DID regex — locked project-wide (Phase 7 D-29). */
export const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;
```

### 32-char hex hash validation (iris payloads use truncated 32-char hashes per D-17-06)
**Source:** Inferred from D-17-06: `{target_did, belief_hash, dimension}` — belief_hash is a 32-char hex substring (sha256[:32]).
**Apply to:** appendIrisBeliefRevised, appendIrisContradictionDetected, appendIrisPriorSeeded
```typescript
const HEX32_RE = /^[0-9a-f]{32}$/;
```
(Contrast with `HEX64_RE` used in bios for full sha256.)

### Self-report invariant
**Source:** `grid/src/bios/appendBiosBirth.ts` lines 62–65; `grid/src/ananke/append-drive-crossed.ts` lines 71–74
**Apply to:** All 4 appendIris* emitters (nous_did === actorDid)
```typescript
if (payload.nous_did !== actorDid) {
    throw new TypeError(
        `appendIrisX: payload.nous_did must equal actorDid (self-report invariant)`,
    );
}
```

### payloadPrivacyCheck belt-and-suspenders
**Source:** `grid/src/bios/appendBiosBirth.ts` lines 106–111; `grid/src/ananke/append-drive-crossed.ts` lines 125–130
**Apply to:** All 4 appendIris* emitters (step 9 of validation)
```typescript
const privacy = payloadPrivacyCheck(cleanPayload);
if (!privacy.ok) {
    throw new TypeError(
        `appendIrisX: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
    );
}
```

### try/catch + console.warn in NousRunner cases
**Source:** `grid/src/integration/nous-runner.ts` lines 413–428 (drive_crossed case)
**Apply to:** All 4 new case branches in nous-runner.ts
```typescript
try {
    appendIrisX(this.audit, this.nousDid, { ... });
} catch (err) {
    console.warn(JSON.stringify({
        event: 'iris.dispatch.rejected',
        action_type: 'iris_X',
        did: this.nousDid,
        reason: (err as Error).message,
    }));
}
```

### Optional-dep guard in handler.py
**Source:** `brain/src/noesis_brain/rpc/handler.py` lines 217–228 (seed_priors block)
**Apply to:** All elicit() and context_for() calls in handler.py
```python
if self._iris_runtime is not None and <condition>:
    try:
        <call>
    except Exception as exc:
        log.warning("iris: X failed: %s", exc)
```

---

## No Analog Found

All files have analogs. No entries in this section.

---

## Metadata

**Analog search scope:** `grid/src/ananke/`, `grid/src/bios/`, `grid/src/governance/`, `grid/src/integration/`, `grid/src/audit/`, `brain/src/noesis_brain/rpc/`, `brain/src/noesis_brain/iris/`, `protocol/src/noesis/bridge/`, `grid/test/ananke/`
**Files scanned:** 15 source files read in full; 4 directories listed
**Pattern extraction date:** 2026-05-15

---

## Key Invariants for Planner

1. **3-keys-not-5**: Brain metadata = 1–3 keys; Grid injects `nous_did` + `tick` at emit time. The `nous_did` field in the iris payloads replaces the `did` field used in bios/ananke payloads (naming difference per D-17-07).

2. **Validation ordering in emitters is deliberate**: DID regex → self-report → tick → hash format → closed-tuple → explicit reconstruction → privacy gate → chain.append. Do not reorder.

3. **Closed-tuple EXPECTED_KEYS must be alphabetically sorted** (matching `Object.keys().sort()` output). For iris payloads:
   - `appendIrisBeliefRevised`: `['belief_hash', 'nous_did', 'target_did', 'tick']`
   - `appendIrisContextInvoked`: `['belief_count', 'nous_did', 'tick']`
   - `appendIrisContradictionDetected`: `['contradiction_hash', 'nous_did', 'target_did', 'tick']`
   - `appendIrisPriorSeeded`: `['nous_did', 'seed_event_hash', 'target_did', 'tick']`

4. **Wave 0 prerequisite check**: Before adding positions 33–36 to ALLOWLIST_MEMBERS, verify positions 28–32 exist (Phase 15/16 events). If missing, add them first per D-17-01.

5. **handler.py has duplicate method definitions**: Lines 546–582 repeat `hash_state`, lines 831–880 and 882–919 repeat `query_memory` and `force_telos`. Do not add IrisRuntime init inside any duplicate block — place it in the FIRST occurrence of `__init__` (lines 40–71).

6. **`_iris_runtime` field already referenced at line 217**: The field exists in handler.py (seed_priors block) but is never assigned in `__init__`. Phase 17 adds the assignment. Confirm `self._iris_runtime = None` is set BEFORE the first `if self._iris_runtime is not None` guard at line 217.
