---
phase: 17-iris-theory-of-mind
plan: wave-2
type: execute
wave: 3
depends_on: [wave-0, wave-1]
files_modified:
  - grid/src/iris/appendIrisBeliefRevised.ts
  - grid/src/iris/appendIrisContextInvoked.ts
  - grid/src/iris/appendIrisContradictionDetected.ts
  - grid/src/iris/appendIrisPriorSeeded.ts
  - grid/src/iris/types.ts
  - grid/src/iris/index.ts
  - grid/src/integration/nous-runner.ts
autonomous: true
requirements: [IRIS-01, IRIS-02, IRIS-03, IRIS-04]

must_haves:
  truths:
    - "Each iris.* event has exactly one sole-producer emitter file"
    - "All 4 emitters enforce the closed-tuple payload via EXPECTED_KEYS alphabetical sort check"
    - "All 4 emitters enforce the self-report invariant (nous_did === actorDid)"
    - "All 4 emitters run payloadPrivacyCheck before committing to chain"
    - "NousRunner has 4 new case branches wired to the sole-producer emitters"
    - "NousRunner imports from grid/src/iris/index.js"
  artifacts:
    - path: "grid/src/iris/appendIrisBeliefRevised.ts"
      provides: "sole producer for iris.belief_revised"
      exports: ["appendIrisBeliefRevised", "DID_RE", "HEX64_RE"]
    - path: "grid/src/iris/appendIrisContextInvoked.ts"
      provides: "sole producer for iris.context_invoked"
      exports: ["appendIrisContextInvoked"]
    - path: "grid/src/iris/appendIrisContradictionDetected.ts"
      provides: "sole producer for iris.contradiction_detected"
      exports: ["appendIrisContradictionDetected"]
    - path: "grid/src/iris/appendIrisPriorSeeded.ts"
      provides: "sole producer for iris.prior_seeded"
      exports: ["appendIrisPriorSeeded"]
    - path: "grid/src/iris/types.ts"
      provides: "payload interfaces + EXPECTED_KEYS tuples"
      exports: ["IrisBeliefRevisedPayload", "IRIS_BELIEF_REVISED_KEYS"]
    - path: "grid/src/iris/index.ts"
      provides: "barrel export for grid/src/iris/"
      exports: ["appendIrisBeliefRevised", "appendIrisContextInvoked", "appendIrisContradictionDetected", "appendIrisPriorSeeded"]
    - path: "grid/src/integration/nous-runner.ts"
      provides: "4 new dispatch cases + imports"
      contains: "case 'iris_belief_revised'"
  key_links:
    - from: "grid/src/iris/appendIrisBeliefRevised.ts"
      to: "grid/src/audit/chain.js"
      via: "audit.append('iris.belief_revised', ...)"
      pattern: "audit\\.append\\('iris\\.belief_revised'"
    - from: "grid/src/integration/nous-runner.ts case 'iris_belief_revised'"
      to: "grid/src/iris/appendIrisBeliefRevised.js"
      via: "function call in try/catch"
      pattern: "appendIrisBeliefRevised\\(this\\.audit"
---

<objective>
Create the 4 sole-producer emitter files + types barrel, then wire 4 new NousRunner dispatch cases.

Purpose: The Grid audit chain must record iris.* events exactly once per event occurrence, through exactly one file per event type. This wave installs the production emitter boundary.

Output: grid/src/iris/ directory with 6 new files; nous-runner.ts extended with 4 cases and updated imports.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/17-iris-theory-of-mind/17-CONTEXT.md
@.planning/phases/17-iris-theory-of-mind/17-PATTERNS.md

<interfaces>
<!-- Template: grid/src/bios/appendBiosBirth.ts — exact model for all 4 emitters -->
<!-- Key validation order (do NOT reorder):
     1. DID regex: actorDid
     2. DID regex: payload.nous_did
     3. Self-report: payload.nous_did === actorDid
     4. Tick: non-negative integer
     5. Target DID (for 4-key payloads)
     6. Hash field (HEX32_RE for 32-char hashes)
     7. Closed-tuple: Object.keys(payload).sort() === EXPECTED_KEYS
     8. Explicit reconstruction
     9. payloadPrivacyCheck
    10. audit.append(event_type, actorDid, cleanPayload)
-->

<!-- EXPECTED_KEYS (alphabetical — matches Object.keys().sort() output):
     appendIrisBeliefRevised:        ['belief_hash', 'nous_did', 'target_did', 'tick']
     appendIrisContextInvoked:       ['belief_count', 'nous_did', 'tick']
     appendIrisContradictionDetected: ['contradiction_hash', 'nous_did', 'target_did', 'tick']
     appendIrisPriorSeeded:          ['nous_did', 'seed_event_hash', 'target_did', 'tick']
-->

<!-- 3-keys-not-5 invariant (D-17-07):
     Brain metadata = 1-3 keys; Grid injects nous_did + tick in NousRunner.
     The field name is 'nous_did' (not 'did' as in bios/ananke — different naming per D-17-07).
-->

<!-- NousRunner insertion point:
     Insert 4 new cases after line 626 (end of 'vote_reveal' break + closing brace),
     before line 628 ('case 'noop':').
-->

<!-- NousRunner import: add to existing import block at top of file:
import {
    appendIrisBeliefRevised,
    appendIrisContextInvoked,
    appendIrisContradictionDetected,
    appendIrisPriorSeeded,
} from '../iris/index.js';
-->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Create grid/src/iris/types.ts + 4 sole-producer emitters + index.ts</name>
  <files>
    grid/src/iris/types.ts
    grid/src/iris/appendIrisBeliefRevised.ts
    grid/src/iris/appendIrisContextInvoked.ts
    grid/src/iris/appendIrisContradictionDetected.ts
    grid/src/iris/appendIrisPriorSeeded.ts
    grid/src/iris/index.ts
  </files>
  <action>
Create the `grid/src/iris/` directory with 6 files. Follow the `appendBiosBirth.ts` template exactly — same validation order, same error message pattern, same privacy gate.

**File 1: grid/src/iris/types.ts**

Payload interfaces and EXPECTED_KEYS tuples. Used by all 4 emitters to enforce closed-tuple checks.

```typescript
/**
 * Iris Grid types — Phase 17 D-17-08.
 * Payload interfaces and EXPECTED_KEYS tuples for all 4 iris.* sole-producer emitters.
 *
 * 3-keys-not-5 invariant (D-17-07): Brain metadata carries 1-3 keys;
 * Grid injects nous_did + tick at emit time. Field name is 'nous_did' (not 'did').
 *
 * Closed-tuple: EXPECTED_KEYS are alphabetically sorted to match Object.keys(payload).sort().
 */

export interface IrisBeliefRevisedPayload {
    nous_did: string;
    tick: number;
    target_did: string;
    belief_hash: string;
}

export interface IrisContextInvokedPayload {
    nous_did: string;
    tick: number;
    belief_count: number;
}

export interface IrisContradictionDetectedPayload {
    nous_did: string;
    tick: number;
    target_did: string;
    contradiction_hash: string;
}

export interface IrisPriorSeededPayload {
    nous_did: string;
    tick: number;
    target_did: string;
    seed_event_hash: string;
}

/** Alphabetically sorted key tuples — locked by D-17-08. */
export const IRIS_BELIEF_REVISED_KEYS = ['belief_hash', 'nous_did', 'target_did', 'tick'] as const;
export const IRIS_CONTEXT_INVOKED_KEYS = ['belief_count', 'nous_did', 'tick'] as const;
export const IRIS_CONTRADICTION_DETECTED_KEYS = ['contradiction_hash', 'nous_did', 'target_did', 'tick'] as const;
export const IRIS_PRIOR_SEEDED_KEYS = ['nous_did', 'seed_event_hash', 'target_did', 'tick'] as const;
```

**File 2: grid/src/iris/appendIrisBeliefRevised.ts**

Sole producer for `iris.belief_revised`. 4-key payload: `{nous_did, tick, target_did, belief_hash}`.

```typescript
/**
 * appendIrisBeliefRevised — SOLE producer boundary for `iris.belief_revised`.
 *
 * Phase 17 D-17-08. Structural clone of grid/src/bios/appendBiosBirth.ts.
 *
 * Validation discipline (ordering deliberate):
 *   1. DID regex: actorDid
 *   2. DID regex: payload.nous_did
 *   3. Self-report invariant: payload.nous_did === actorDid
 *   4. Tick: non-negative integer
 *   5. DID regex: payload.target_did
 *   6. Hash format: payload.belief_hash (64-char hex, HEX64_RE — full sha256 hexdigest)
 *   7. Closed-tuple: Object.keys(payload).sort() === IRIS_BELIEF_REVISED_KEYS
 *   8. Explicit reconstruction (prototype-pollution defense)
 *   9. Privacy gate: payloadPrivacyCheck belt-and-suspenders (D-17-17)
 *  10. Commit to chain.
 *
 * Wall-clock free per D-17-14 — tick supplied by NousRunner (world clock).
 */

import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';
import { payloadPrivacyCheck } from '../audit/broadcast-allowlist.js';
import { IRIS_BELIEF_REVISED_KEYS, type IrisBeliefRevisedPayload } from './types.js';

/** DID regex — locked project-wide (Phase 7 D-29). */
export const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;

/** 64-char lowercase hex (full sha256 hexdigest — Brain emits full hash, Grid stores as-is). */
export const HEX64_RE = /^[0-9a-f]{64}$/;

export function appendIrisBeliefRevised(
    audit: AuditChain,
    actorDid: string,
    payload: IrisBeliefRevisedPayload,
): AuditEntry {
    // 1. DID regex: actorDid
    if (typeof actorDid !== 'string' || !DID_RE.test(actorDid)) {
        throw new TypeError(
            `appendIrisBeliefRevised: invalid actorDid ${JSON.stringify(actorDid)} (DID_RE failed)`,
        );
    }
    // 2. DID regex: payload.nous_did
    if (typeof payload?.nous_did !== 'string' || !DID_RE.test(payload.nous_did)) {
        throw new TypeError(`appendIrisBeliefRevised: invalid payload.nous_did (DID_RE failed)`);
    }
    // 3. Self-report invariant
    if (payload.nous_did !== actorDid) {
        throw new TypeError(
            `appendIrisBeliefRevised: payload.nous_did must equal actorDid (self-report invariant)`,
        );
    }
    // 4. Tick: non-negative integer
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(
            `appendIrisBeliefRevised: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`,
        );
    }
    // 5. DID regex: payload.target_did
    if (typeof payload.target_did !== 'string' || !DID_RE.test(payload.target_did)) {
        throw new TypeError(`appendIrisBeliefRevised: invalid payload.target_did (DID_RE failed)`);
    }
    // 6. Hash format: belief_hash
    if (typeof payload.belief_hash !== 'string' || !HEX64_RE.test(payload.belief_hash)) {
        throw new TypeError(
            `appendIrisBeliefRevised: invalid belief_hash (expected 64-char lowercase hex sha256)`,
        );
    }
    // 7. Closed-tuple check
    const actualKeys = Object.keys(payload).sort();
    if (
        actualKeys.length !== IRIS_BELIEF_REVISED_KEYS.length ||
        !actualKeys.every((k, i) => k === IRIS_BELIEF_REVISED_KEYS[i])
    ) {
        throw new TypeError(
            `appendIrisBeliefRevised: unexpected key set — expected ${JSON.stringify(IRIS_BELIEF_REVISED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }
    // 8. Explicit reconstruction
    const cleanPayload = {
        nous_did: payload.nous_did,
        tick: payload.tick,
        target_did: payload.target_did,
        belief_hash: payload.belief_hash,
    };
    // 9. Privacy gate
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendIrisBeliefRevised: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 10. Commit to chain (sole producer).
    return audit.append('iris.belief_revised', actorDid, cleanPayload);
}
```

**File 3: grid/src/iris/appendIrisContextInvoked.ts**

Sole producer for `iris.context_invoked`. 3-key payload: `{nous_did, tick, belief_count}`.

Structure: identical to appendIrisBeliefRevised but:
- No `target_did` field; no hash field
- Steps 5 and 6 replaced with: `belief_count` must be a non-negative integer
- Uses `IRIS_CONTEXT_INVOKED_KEYS = ['belief_count', 'nous_did', 'tick']`
- No HEX32_RE import needed
- Event string: `'iris.context_invoked'`

Follow the same 10-step validation skeleton. The belief_count validation:
```typescript
    // 5. belief_count: non-negative integer
    if (!Number.isInteger(payload.belief_count) || payload.belief_count < 0) {
        throw new TypeError(
            `appendIrisContextInvoked: belief_count must be non-negative integer, got ${JSON.stringify(payload.belief_count)}`,
        );
    }
```
Skip steps 5b (no hash) and proceed to closed-tuple check.

**File 4: grid/src/iris/appendIrisContradictionDetected.ts**

Sole producer for `iris.contradiction_detected`. 4-key payload: `{nous_did, tick, target_did, contradiction_hash}`.

Structurally identical to appendIrisBeliefRevised — swap:
- `belief_hash` → `contradiction_hash` (same HEX64_RE validation)
- `IRIS_BELIEF_REVISED_KEYS` → `IRIS_CONTRADICTION_DETECTED_KEYS`
- `IrisBeliefRevisedPayload` → `IrisContradictionDetectedPayload`
- event string: `'iris.contradiction_detected'`
- all error message prefixes: `appendIrisContradictionDetected`

**File 5: grid/src/iris/appendIrisPriorSeeded.ts**

Sole producer for `iris.prior_seeded`. 4-key payload: `{nous_did, tick, target_did, seed_event_hash}`.

Structurally identical to appendIrisBeliefRevised — swap:
- `belief_hash` → `seed_event_hash` (same HEX64_RE validation)
- `IRIS_BELIEF_REVISED_KEYS` → `IRIS_PRIOR_SEEDED_KEYS`
- `IrisBeliefRevisedPayload` → `IrisPriorSeededPayload`
- event string: `'iris.prior_seeded'`
- all error message prefixes: `appendIrisPriorSeeded`

Note: `seed_event_hash` is the full sha256 hexdigest from elicit.py (64 chars). Use `HEX64_RE` consistently — same as belief_hash and contradiction_hash.

**File 6: grid/src/iris/index.ts**

Barrel export:
```typescript
/** Phase 17 Grid-side Iris Theory of Mind audit surface — D-17-08. */
export { appendIrisBeliefRevised, DID_RE, HEX64_RE } from './appendIrisBeliefRevised.js';
export { appendIrisContextInvoked } from './appendIrisContextInvoked.js';
export { appendIrisContradictionDetected } from './appendIrisContradictionDetected.js';
export { appendIrisPriorSeeded } from './appendIrisPriorSeeded.js';
export type {
    IrisBeliefRevisedPayload,
    IrisContextInvokedPayload,
    IrisContradictionDetectedPayload,
    IrisPriorSeededPayload,
} from './types.js';
export {
    IRIS_BELIEF_REVISED_KEYS,
    IRIS_CONTEXT_INVOKED_KEYS,
    IRIS_CONTRADICTION_DETECTED_KEYS,
    IRIS_PRIOR_SEEDED_KEYS,
} from './types.js';
```
  </action>
  <verify>
    <automated>cd /Users/desirey/Programming/src/Noesis/grid && npx tsc --noEmit 2>&1 | grep -E "iris" | head -20</automated>
  </verify>
  <done>
    - `grid/src/iris/` contains 6 files: types.ts, appendIrisBeliefRevised.ts, appendIrisContextInvoked.ts, appendIrisContradictionDetected.ts, appendIrisPriorSeeded.ts, index.ts
    - Each emitter exports its named function
    - TypeScript compiles all 6 files without errors
    - `grep -r "audit.append" grid/src/iris/` shows exactly 4 occurrences (one per emitter)
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Wire 4 NousRunner dispatch cases + imports</name>
  <files>grid/src/integration/nous-runner.ts</files>
  <action>
Add 4 new `case` branches and update imports in nous-runner.ts.

**Step 1 — Add imports.** After line 26 (`import { appendBallotRevealed } from '../governance/appendBallotRevealed.js';`), insert:

```typescript
import {
    appendIrisBeliefRevised,
    appendIrisContextInvoked,
    appendIrisContradictionDetected,
    appendIrisPriorSeeded,
} from '../iris/index.js';
```

**Step 2 — Insert 4 case branches.** After line 626 (the `break;` and closing `}` of the `vote_reveal` case), before line 628 (`case 'noop':`), insert these 4 cases. Follow the `drive_crossed` case pattern exactly (lines 408-429): try/catch, console.warn on rejection, never throw to sibling actions.

```typescript
                case 'iris_belief_revised': {
                    // Phase 17 D-17-09: Grid injects nous_did+tick (3-keys-not-5).
                    // Brain sends target_did, belief_hash, dimension (3 keys).
                    // Sole producer: appendIrisBeliefRevised. Rejections drop silently.
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
                    // Phase 17 D-17-09: belief_count is total beliefs injected this tick.
                    // Sole producer: appendIrisContextInvoked.
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
                    // Phase 17 D-17-09: Grid injects nous_did+tick; Brain sends target_did, contradiction_hash.
                    // Sole producer: appendIrisContradictionDetected.
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
                    // Phase 17 D-17-09: Grid injects nous_did+tick; Brain sends target_did, seed_event_hash.
                    // seed_event_hash may be 32 or 64 chars (from elicit.py source_event_hash).
                    // Sole producer: appendIrisPriorSeeded.
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

**Hash format:** All three hash fields (belief_hash, contradiction_hash, seed_event_hash) are full 64-char sha256 hexdigests from elicit.py. NousRunner passes them through as-is; all 4 emitters validate with HEX64_RE. No truncation.

**Duplicate method warning:** nous-runner.ts has no duplicate methods, but handler.py does. This edit is only to nous-runner.ts — no handler.py changes here.
  </action>
  <verify>
    <automated>cd /Users/desirey/Programming/src/Noesis/grid && npx tsc --noEmit 2>&1 | grep "error" | grep -v "^$" | head -10</automated>
  </verify>
  <done>
    - `grep -c "case 'iris_" grid/src/integration/nous-runner.ts` returns 4
    - `grep "appendIrisBeliefRevised\|appendIrisContextInvoked\|appendIrisContradictionDetected\|appendIrisPriorSeeded" grid/src/integration/nous-runner.ts` shows all 4 imports + 4 call sites
    - TypeScript compiles grid/ without errors
    - 4 cases appear between the `vote_reveal` break and `case 'noop'`
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Brain→Grid (action.metadata) | Belief content must not appear; only hashes/counts |
| Grid emitter→AuditChain | Sole-producer boundary enforced per emitter file |
| NousRunner→emitter | try/catch prevents cross-action rejection cascade |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-17-W2-01 | Information Disclosure | iris.* payloads | mitigate | payloadPrivacyCheck step 9 in every emitter; FORBIDDEN_KEY_PATTERN blocks belief_content etc |
| T-17-W2-02 | Tampering | Closed-tuple enforcement | mitigate | EXPECTED_KEYS alphabetical sort check in every emitter; extra/missing keys throw TypeError |
| T-17-W2-03 | Repudiation | Sole-producer boundary | mitigate | One file per event type calls audit.append(); producer-boundary test (Wave 4) enforces this |
| T-17-W2-04 | Spoofing | Self-report invariant | mitigate | payload.nous_did === actorDid enforced in all 4 emitters; NousRunner passes this.nousDid |
</threat_model>

<verification>
```bash
# Verify emitter files exist and compile
cd /Users/desirey/Programming/src/Noesis/grid
ls src/iris/
npx tsc --noEmit

# Verify sole-producer: each event string appears only in its emitter + allowlist
grep -r "iris\.belief_revised" grid/src/ | grep -v allowlist | grep -v ".test."
# Should show ONLY: iris/appendIrisBeliefRevised.ts

# Verify NousRunner has 4 iris cases
grep -n "case 'iris_" grid/src/integration/nous-runner.ts
```
</verification>

<success_criteria>
- 6 new files in grid/src/iris/ all compile cleanly
- Each event string `iris.*` appears in exactly 2 places: allowlist + its sole emitter
- NousRunner dispatches all 4 iris action types
- No wall-clock references in grid/src/iris/ (`grep -r "Date.now\|new Date" grid/src/iris/` returns empty)
</success_criteria>

<output>
After completion, create `.planning/phases/17-iris-theory-of-mind/17-wave-2-SUMMARY.md` following the summary template.
</output>
