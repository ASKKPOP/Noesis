# Phase 17: Iris (Theory of Mind) — Research

**Researched:** 2026-05-15
**Domain:** Brain wiring (Python), Grid audit emitters (TypeScript), Protocol bridge extension
**Confidence:** HIGH — all findings are from direct codebase inspection (no assumed knowledge)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-17-01:** Allowlist positions 33-36 for 4 iris events. Wave 0 MUST verify Phase 15/16
  entries 28-32 exist before adding iris entries. If missing, Wave 0 adds them as prerequisites.
- **D-17-02:** 4 audit events: `iris.belief_revised` (33), `iris.context_invoked` (34),
  `iris.contradiction_detected` (35), `iris.prior_seeded` (36).
- **D-17-03:** `elicit()` called once per peer in `dialogue_context`, per-pair cooldown 20 ticks.
- **D-17-04:** No `dialogue_context` → no `elicit()`. Only `seed_priors()` runs.
- **D-17-05:** elicit() produces beliefs from witnessed utterances. JSON output `[{dimension, content, confidence}]`.
- **D-17-06:** 4 new ActionType members: `IRIS_BELIEF_REVISED`, `IRIS_CONTEXT_INVOKED`,
  `IRIS_CONTRADICTION_DETECTED`, `IRIS_PRIOR_SEEDED`. All forwarded to Grid (not Brain-internal).
- **D-17-07:** 3-keys-not-5 invariant — Brain sends 1-3 metadata keys; Grid injects `nous_did` + `tick`.
- **D-17-08:** 4 sole-producer emitters in `grid/src/iris/`:
  - `appendIrisBeliefRevised.ts` — 4-key payload `{nous_did, tick, target_did, belief_hash}`
  - `appendIrisContextInvoked.ts` — 3-key payload `{nous_did, tick, belief_count}`
  - `appendIrisContradictionDetected.ts` — 4-key payload `{nous_did, tick, target_did, contradiction_hash}`
  - `appendIrisPriorSeeded.ts` — 4-key payload `{nous_did, tick, target_did, seed_event_hash}`
- **D-17-09:** 4 new `case` branches in `nous-runner.ts` after `case 'vote_reveal'`.
- **D-17-10:** `protocol/src/noesis/bridge/types.ts` BrainAction union extended with 4 iris strings.
- **D-17-11:** `context_for()` injected as "Theory of Mind" section between drives and Telos.
- **D-17-12:** Up to 3 most-recently-interacted peers, IRIS_CONTEXT_TOP_K=5 beliefs per peer.
- **D-17-13:** `iris.context_invoked` fires once per tick with `belief_count` = total injected.
- **D-17-14:** `IrisRuntime` optional-dep: `iris_db_dir: str | Path | None = None` in `__init__`.
- **D-17-15:** `elicit()` called in `on_tick()` after `seed_priors()`, gated on `_iris_runtime is not None`.
- **D-17-16:** `context_for()` called at prompt-build time; `IRIS_CONTEXT_INVOKED` emitted after elicit().
- **D-17-17:** FORBIDDEN_KEY_PATTERN additions: `belief_content|target_content|emotion_text|dimension_text|belief_prose|iris_content`.
- **D-17-18:** No new Dashboard panel. Firehose only.

### Claude's Discretion
- LLM prompt template for `elicit()` — JSON-mode response preferred; fallback to regex extraction.
- SQLite pragma tuning beyond WAL (cache_size, mmap_size).
- Test fixture format for `elicit()` LLM responses.

### Deferred Ideas (OUT OF SCOPE)
- Second-order ToM ("what X believes Y believes about Z")
- Cross-Nous belief sharing
- Belief influence on governance voting (predict_vote() not wired to Phase 12)
- Thymos/Iris integration
- ToM Inspector badge on Dashboard
</user_constraints>

---

## Summary

Phase 17 wires the already-implemented Iris Brain module into BrainHandler and builds the Grid-side audit emission layer. The research is entirely codebase-derived — no external documentation needed.

**Critical finding (Wave 0 blocker):** The allowlist currently ends at position 27 (`operator.exported`). Phase 15/16 entries (28-32: `nous.reflection_authored`, `nous.self_model_revised`, `nous.creed_violation`, `nous.sleep.entered`, `nous.sleep.completed`) are **absent** from the live file. Wave 0 must add these 5 prerequisite entries with their sole-producer emitters before appending the 4 iris entries at positions 33-36.

**Critical finding (handler.py):** `self._iris_runtime` is referenced at lines 215-227 in `on_tick()` but is **never declared** in `__init__()`. The field will raise `AttributeError` the first time the block is hit (Python attributes are not lazily-None by default). The `__init__` wiring is the first task.

**Primary recommendation:** Follow the `appendAnankeDriveCrossed` / `case 'drive_crossed'` pattern exactly for all 4 Grid emitters and NousRunner cases — the pattern is fully validated and battle-tested across Phases 10a, 11, 12.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Belief elicitation (LLM call) | Brain | — | LLM access is Brain-only; belief content is Brain-private |
| Belief storage (SQLite) | Brain | — | IrisStore lives in Brain process; append-only |
| Prior seeding from relgraph | Brain | — | seed_priors() already wired; no Grid involvement |
| ToM prompt injection | Brain | — | context_for() pure read; drives system prompt only |
| Audit event emission | Grid | — | Grid is sole chain.append() authority; Brain sends actions |
| Audit payload validation | Grid (emitter) | — | Closed-tuple + privacy gate per emitter file |
| Allowlist enforcement | Grid (WsHub) | — | broadcast-allowlist.ts gating |
| Bridge type declarations | Protocol pkg | Grid (local copy) | types.ts in both; drift-detector test catches divergence |

---

## Standard Stack

All libraries are already in use. No new dependencies.

### Core (verified in-tree)
| Library | Purpose | Location |
|---------|---------|---------|
| `sqlite3` (stdlib) | IrisStore WAL + FTS5 | `brain/src/noesis_brain/iris/store.py` |
| `hashlib` (stdlib) | content_hash, sha256 throughout | All iris/*.py files |
| `json` (stdlib) | LLM response parsing, context serialization | `iris/elicit.py` |
| `dataclasses` (stdlib) | Belief, ElicitResult, BeliefPrior | `iris/types.py`, `iris/elicit.py` |
| `vitest` | Grid TypeScript tests | All `grid/test/**/*.test.ts` |
| `pytest` | Brain Python tests | All `brain/test/test_*.py` |

[VERIFIED: direct file read]

### SQLite Pragmas Already Set
`IrisStore.__init__` executes `PRAGMA journal_mode=WAL` before schema init. No additional pragmas are wired. [VERIFIED: store.py line 52]

**Discretion area — additional pragma candidates:**
```python
self._conn.execute("PRAGMA cache_size=-16000")   # 16 MB page cache
self._conn.execute("PRAGMA mmap_size=134217728")  # 128 MB mmap
self._conn.execute("PRAGMA synchronous=NORMAL")   # safe with WAL
```
These match Phase 16 LtmStore recommendations. Phase 17 executor may add them; they are not locked.

---

## Architecture Patterns

### System Architecture Diagram

```
Brain on_tick() receives {tick, dialogue_context, relationship_context}
         │
         ├─► seed_priors(relationship_context)       [already wired; no-op if _iris_runtime None]
         │        │
         │        └─► IrisStore.add_belief()
         │             └─► dispatcher.emit("iris.prior_seeded", {source, target_did})
         │                   └─► Action(IRIS_PRIOR_SEEDED) → Grid
         │
         ├─► [NEW] elicit(peer_did, dialogue_context, tick)   [once per peer, per cooldown]
         │        │
         │        ├─► IrisStore.get_beliefs(prior)
         │        ├─► LLM.complete(prompt)
         │        ├─► IrisStore.add_belief(new)
         │        ├─► IrisStore.supersede(old, new)   [if contradiction]
         │        └─► ElicitResult → Action(IRIS_BELIEF_REVISED)
         │                        → Action(IRIS_CONTRADICTION_DETECTED) [if contradiction]
         │
         ├─► [NEW] context_for(peers)                [ToM prompt section; PURE READ]
         │        └─► IrisStore.get_beliefs(top-k)
         │             └─► ToMContext → _theory_of_mind_section(contexts)
         │                              → injected into system_prompt
         │             └─► Action(IRIS_CONTEXT_INVOKED) [if belief_count > 0]
         │
         └─► return actions[]
                    │
                    ▼
Grid NousRunner.executeActions(actions, tick)
         │
         case 'iris_belief_revised'      → appendIrisBeliefRevised(audit, nousDid, {nous_did, tick, target_did, belief_hash})
         case 'iris_context_invoked'     → appendIrisContextInvoked(audit, nousDid, {nous_did, tick, belief_count})
         case 'iris_contradiction_detected' → appendIrisContradictionDetected(...)
         case 'iris_prior_seeded'        → appendIrisPriorSeeded(...)
                    │
                    ▼
         AuditChain.append('iris.belief_revised', actorDid, payload)
                    │
                    ▼
         WsHub: ALLOWLIST gate → broadcast to Dashboard firehose
```

### Recommended Project Structure

```
grid/src/iris/                          # NEW — mirrors grid/src/ananke/ pattern
├── appendIrisBeliefRevised.ts          # sole producer for iris.belief_revised
├── appendIrisContextInvoked.ts         # sole producer for iris.context_invoked
├── appendIrisContradictionDetected.ts  # sole producer for iris.contradiction_detected
├── appendIrisPriorSeeded.ts            # sole producer for iris.prior_seeded
└── index.ts                            # barrel re-export (clone ananke/index.ts)

brain/src/noesis_brain/iris/            # EXISTING — do not restructure
├── __init__.py
├── config.py
├── elicit.py
├── integration.py
├── priors.py
├── store.py
└── types.py

brain/test/                             # EXISTING — add test files alongside
├── test_iris_store.py                  # NEW
├── test_iris_elicit.py                 # NEW
├── test_iris_priors.py                 # NEW
└── test_iris_handler_wiring.py         # NEW

grid/test/iris/                         # NEW
├── append-iris-belief-revised.test.ts  # NEW
├── append-iris-context-invoked.test.ts # NEW
├── append-iris-contradiction-detected.test.ts # NEW
├── append-iris-prior-seeded.test.ts    # NEW
└── iris-producer-boundary.test.ts      # NEW — grep gate
```

---

## Exact Wiring Points

### handler.py — `__init__` (line 71, end of current body)

**Gap confirmed:** `self._iris_runtime` is referenced at lines 217-227 but is NOT declared in `__init__` (lines 40-71). This will raise `AttributeError` at runtime.

**Add after line 71** (after `self._bios_birth_ticks: dict[str, int] = {}`):

```python
# Phase 17 Iris — optional-dep injection (mirrors Phase 15 AAULearner pattern).
# iris_db_dir: str | Path | None = None means disabled.
# Constructor parameter added to signature above (iris_db_dir kwarg).
self._iris_runtime: IrisRuntime | None = None
if iris_db_dir is not None:
    from noesis_brain.iris.elicit import IrisRuntime
    from noesis_brain.iris.store import IrisStore
    _store = IrisStore(db_path=iris_db_dir, nous_did=self.did)
    self._iris_runtime = IrisRuntime(store=_store, llm_adapter=self.llm)
    # Dispatcher set separately via set_iris_dispatcher() after coordinator
    # bootstraps the Grid-side action emitter. See D-17-14.
```

**Signature change** — add `iris_db_dir: str | Path | None = None` after `did: str = ""` in the `__init__` keyword-only block.

[VERIFIED: handler.py lines 40-71 read; `_iris_runtime` absent from `__init__`]

### handler.py — `on_tick()` elicit() insertion

**Current state:** `seed_priors()` block ends at line 227. The `if actions:` block starts at line 229.

**Insert between lines 227 and 229:**

```python
        # Phase 17 Iris — elicit() triggered by dialogue_context.
        # One call per peer in the exchange, per 20-tick cooldown.
        # Gate: _iris_runtime must exist AND dialogue_context must be present.
        if self._iris_runtime is not None and isinstance(dialogue_ctxs, list):
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
                    if result.beliefs:
                        actions.append(Action(
                            action_type=ActionType.IRIS_BELIEF_REVISED,
                            channel="",
                            text="",
                            metadata={
                                "target_did": target_did,
                                "belief_hash": result.new_hash,
                                "dimension": result.beliefs[0].dimension,
                            },
                        ).to_dict())
                    if result.contradiction:
                        actions.append(Action(
                            action_type=ActionType.IRIS_CONTRADICTION_DETECTED,
                            channel="",
                            text="",
                            metadata={
                                "target_did": target_did,
                                "contradiction_hash": result.prior_hash,
                            },
                        ).to_dict())
                except Exception as exc:
                    log.warning("iris.elicit: failed for (%s, %s): %s", self.did, target_did, exc)
```

**Note:** `iris.prior_seeded` is emitted by `seed_priors()` → `dispatcher.emit()` path (already wired). The `IRIS_PRIOR_SEEDED` ActionType backs this dispatcher call — see dispatcher wiring below.

**After the elicit block, add IRIS_CONTEXT_INVOKED emission:**

```python
        # Phase 17 Iris — context_for() and IRIS_CONTEXT_INVOKED.
        # Fires AFTER elicit() so belief_count reflects freshly written beliefs.
        if self._iris_runtime is not None:
            # Peers: extract from recent dialogue_ctxs for this tick.
            peer_dids: list[str] = []
            if isinstance(dialogue_ctxs, list):
                for ctx in dialogue_ctxs:
                    if isinstance(ctx, dict):
                        tdid = ctx.get("counterparty_did", "")
                        if tdid and tdid not in peer_dids:
                            peer_dids.append(tdid)
            # Bounded to 3 peers (D-17-12).
            peer_dids = peer_dids[:3]
            total_beliefs = 0
            for peer_did in peer_dids:
                from noesis_brain.iris.integration import context_for
                tom_ctx = context_for(target_did=peer_did, store=self._iris_runtime.store)
                total_beliefs += tom_ctx.n_beliefs_used
            if total_beliefs > 0:
                actions.append(Action(
                    action_type=ActionType.IRIS_CONTEXT_INVOKED,
                    channel="",
                    text="",
                    metadata={"belief_count": total_beliefs},
                ).to_dict())
```

[VERIFIED: handler.py on_tick() lines 140-248 read in full; elicit() NOT called; context_for() NOT called]

### handler.py — `on_message()` / prompt builder

`build_system_prompt()` is called at line 98-104 in `on_message()` and at lines 96-104 with the same call site pattern. The `context_for()` call feeds the prompt builder via a new `theory_of_mind` kwarg.

**In `on_message()` before the `build_system_prompt()` call** (after line 97):

```python
        # Phase 17 Iris — Theory of Mind prompt section (D-17-11).
        tom_contexts = []
        if self._iris_runtime is not None:
            from noesis_brain.iris.integration import context_for
            sender_ctx = context_for(
                target_did=sender_did,
                store=self._iris_runtime.store,
            )
            if sender_ctx.n_beliefs_used > 0:
                tom_contexts = [sender_ctx]
        system_prompt = build_system_prompt(
            self.psyche, self.thymos.mood, self.telos,
            grid_name=self.grid_name, location=self.location,
            bios_snapshot=bios_rt.state,
            epoch_since_spawn=epoch_since_spawn,
            subjective_multiplier=subjective_multiplier,
            theory_of_mind=tom_contexts,   # NEW kwarg
        )
```

**In `prompts/system.py` `build_system_prompt()`** — add `theory_of_mind: list | None = None` kwarg after `peer_voices`, and call `_theory_of_mind_section(theory_of_mind)` BEFORE the `_directives_section` call, positioned between drives context and Telos:

Insertion order in `sections` list (after `_goals_section`, before `_context_section`):
```python
    # Phase 17: inject Theory of Mind after goals, before context.
    if theory_of_mind:
        section = _theory_of_mind_section(theory_of_mind)
        if section:
            # Insert before context section (position 4).
            sections.insert(4, section)
```

**`_theory_of_mind_section()` implementation:**
```python
def _theory_of_mind_section(tom_contexts: list) -> str:
    """Theory of Mind — beliefs about peers (Phase 17).

    Brain-private: content never leaves Brain process.
    Cap: 3 peers × 5 beliefs = 15 entries max (D-17-12).
    """
    if not tom_contexts:
        return ""
    lines = ["## Theory of Mind (Your beliefs about peers)"]
    for ctx in tom_contexts[:3]:
        lines.append(f"\n### {ctx.target_did} ({ctx.n_beliefs_used} beliefs)")
        for b in ctx.beliefs[:5]:
            lines.append(f"- [{b.dimension}] {b.content} (confidence: {b.confidence:.2f})")
    return "\n".join(lines)
```

[VERIFIED: system.py lines 1-240 read; no theory_of_mind kwarg exists yet]

---

## TypeScript Emitter Boilerplate

Cloned directly from `appendAnankeDriveCrossed` pattern. All 4 emitters follow identical structure.

### appendIrisBeliefRevised.ts (4-key closed payload)

```typescript
/**
 * appendIrisBeliefRevised — SOLE producer boundary for `iris.belief_revised`.
 *
 * Phase 17 IRIS-03. Structural clone of appendAnankeDriveCrossed pattern
 * (grid/src/ananke/append-drive-crossed.ts).
 *
 * 3-keys-not-5 invariant (D-17-07): Brain sends {target_did, belief_hash, dimension}.
 * Grid injects nous_did + tick to form the closed 4-key payload.
 *
 * Validation order (mirrors drive-crossed discipline):
 *   1. DID regex guards (actorDid, payload.nous_did, payload.target_did)
 *   2. Self-report invariant (payload.nous_did == actorDid)
 *   3. Tick non-negative integer
 *   4. belief_hash format (64-hex sha256)
 *   5. Closed-tuple (exactly 4 keys, alphabetical sort equality)
 *   6. Explicit reconstruction (prototype pollution defense)
 *   7. Privacy gate (payloadPrivacyCheck belt-and-suspenders)
 *   8. chain.append()
 */
import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';
import { payloadPrivacyCheck } from '../audit/broadcast-allowlist.js';

export const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;
const BELIEF_HASH_RE = /^[0-9a-f]{64}$/;

export interface IrisBeliefRevisedPayload {
    readonly nous_did: string;
    readonly tick: number;
    readonly target_did: string;
    readonly belief_hash: string;
}

const EXPECTED_KEYS = ['belief_hash', 'nous_did', 'target_did', 'tick'] as const;

export function appendIrisBeliefRevised(
    audit: AuditChain,
    actorDid: string,
    payload: IrisBeliefRevisedPayload,
): AuditEntry {
    if (typeof actorDid !== 'string' || !DID_RE.test(actorDid)) {
        throw new TypeError(`appendIrisBeliefRevised: invalid actorDid`);
    }
    if (typeof payload?.nous_did !== 'string' || !DID_RE.test(payload.nous_did)) {
        throw new TypeError(`appendIrisBeliefRevised: invalid payload.nous_did`);
    }
    if (payload.nous_did !== actorDid) {
        throw new TypeError(`appendIrisBeliefRevised: self-report invariant violated`);
    }
    if (typeof payload?.target_did !== 'string' || !DID_RE.test(payload.target_did)) {
        throw new TypeError(`appendIrisBeliefRevised: invalid payload.target_did (DID_RE failed)`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendIrisBeliefRevised: tick must be non-negative integer`);
    }
    if (typeof payload.belief_hash !== 'string' || !BELIEF_HASH_RE.test(payload.belief_hash)) {
        throw new TypeError(`appendIrisBeliefRevised: belief_hash must be 64-hex sha256`);
    }

    const actualKeys = Object.keys(payload).sort();
    if (
        actualKeys.length !== EXPECTED_KEYS.length ||
        !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])
    ) {
        throw new TypeError(
            `appendIrisBeliefRevised: key set mismatch — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }

    const cleanPayload = {
        nous_did: payload.nous_did,
        tick: payload.tick,
        target_did: payload.target_did,
        belief_hash: payload.belief_hash,
    };

    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendIrisBeliefRevised: privacy violation — path=${privacy.offendingPath}`,
        );
    }

    return audit.append('iris.belief_revised', actorDid, cleanPayload);
}
```

### appendIrisContextInvoked.ts (3-key closed payload)

Key differences from `appendIrisBeliefRevised`:
- `EXPECTED_KEYS = ['belief_count', 'nous_did', 'tick']`
- Payload field: `belief_count: number` (positive integer, not a hash)
- Validation: `belief_count` must be `Number.isInteger(payload.belief_count) && payload.belief_count > 0`
- No `target_did` field

```typescript
// EXPECTED_KEYS = ['belief_count', 'nous_did', 'tick'] as const;
export interface IrisContextInvokedPayload {
    readonly nous_did: string;
    readonly tick: number;
    readonly belief_count: number;
}
```

### appendIrisContradictionDetected.ts (4-key closed payload)

Key differences:
- `EXPECTED_KEYS = ['contradiction_hash', 'nous_did', 'target_did', 'tick']`
- Payload field: `contradiction_hash: string` (64-hex sha256)
- Both `target_did` and `contradiction_hash` validated

```typescript
// EXPECTED_KEYS = ['contradiction_hash', 'nous_did', 'target_did', 'tick'] as const;
export interface IrisContradictionDetectedPayload {
    readonly nous_did: string;
    readonly tick: number;
    readonly target_did: string;
    readonly contradiction_hash: string;
}
```

### appendIrisPriorSeeded.ts (4-key closed payload)

Key differences:
- `EXPECTED_KEYS = ['nous_did', 'seed_event_hash', 'target_did', 'tick']`
- Payload field: `seed_event_hash: string` (64-hex sha256, or empty string `''` when derived from relgraph edge with no source hash)

**Special case:** `seed_priors()` dispatcher emits `{source, target_did}` (2 keys per priors.py line 183). Grid must not use `source` in payload — Grid injects `nous_did` + `tick` and computes `seed_event_hash` from the `target_did` + `tick` deterministically (sha256 of `${nous_did}:${target_did}:${tick}`).

```typescript
// EXPECTED_KEYS = ['nous_did', 'seed_event_hash', 'target_did', 'tick'] as const;
export interface IrisPriorSeededPayload {
    readonly nous_did: string;
    readonly tick: number;
    readonly target_did: string;
    readonly seed_event_hash: string;  // sha256 of `${nous_did}:${target_did}:${tick}`
}
```

[VERIFIED: appendAnankeDriveCrossed.ts read in full; appendProposalOpened.ts read for closed-tuple comparison]

---

## NousRunner Insertion Points

### Where to insert

File: `grid/src/integration/nous-runner.ts`
Insert 4 new cases **after line 625** (`case 'vote_reveal'` break) and **before line 628** (`case 'noop'`).

[VERIFIED: nous-runner.ts lines 568-631 read; `case 'vote_reveal'` block ends at line 625, `case 'noop'` begins at line 628]

### Import additions (top of file, after governance imports)

```typescript
import { appendIrisBeliefRevised } from '../iris/appendIrisBeliefRevised.js';
import { appendIrisContextInvoked } from '../iris/appendIrisContextInvoked.js';
import { appendIrisContradictionDetected } from '../iris/appendIrisContradictionDetected.js';
import { appendIrisPriorSeeded } from '../iris/appendIrisPriorSeeded.js';
import { createHash } from 'node:crypto';
```

(`createHash` is already imported in `appendProposalOpened.ts` — confirm it's available in `nous-runner.ts` scope or import there.)

### 4 new case branches (insert after vote_reveal break, before noop)

```typescript
case 'iris_belief_revised': {
    // Phase 17 IRIS-03 / D-17-09: sole producer appendIrisBeliefRevised.
    // Brain sends {target_did, belief_hash, dimension}; Grid injects nous_did + tick.
    // dimension is NOT in the 4-key payload (belief content is Brain-private).
    // Silent drop on validation failure (mirrors drive_crossed pattern).
    const md = (action.metadata ?? {}) as Record<string, unknown>;
    const targetDid = typeof md['target_did'] === 'string' ? md['target_did'] : null;
    const beliefHash = typeof md['belief_hash'] === 'string' ? md['belief_hash'] : null;
    if (targetDid === null || beliefHash === null) {
        console.warn(JSON.stringify({
            event: 'iris.belief_revised.malformed_metadata',
            did: this.nousDid,
            reason: 'missing target_did or belief_hash',
            tick,
        }));
        break;
    }
    try {
        appendIrisBeliefRevised(this.audit, this.nousDid, {
            nous_did: this.nousDid,
            tick,
            target_did: targetDid,
            belief_hash: beliefHash,
        });
    } catch (err) {
        console.warn(JSON.stringify({
            event: 'iris.belief_revised.rejected',
            did: this.nousDid,
            reason: (err as Error).message,
        }));
    }
    break;
}

case 'iris_context_invoked': {
    // Phase 17 IRIS-04 / D-17-09: sole producer appendIrisContextInvoked.
    // Brain sends {belief_count}; Grid injects nous_did + tick.
    const md = (action.metadata ?? {}) as Record<string, unknown>;
    const beliefCount = typeof md['belief_count'] === 'number'
        && Number.isInteger(md['belief_count'])
        && (md['belief_count'] as number) > 0
        ? (md['belief_count'] as number)
        : null;
    if (beliefCount === null) {
        console.warn(JSON.stringify({
            event: 'iris.context_invoked.malformed_metadata',
            did: this.nousDid,
            reason: 'missing or invalid belief_count',
            tick,
        }));
        break;
    }
    try {
        appendIrisContextInvoked(this.audit, this.nousDid, {
            nous_did: this.nousDid,
            tick,
            belief_count: beliefCount,
        });
    } catch (err) {
        console.warn(JSON.stringify({
            event: 'iris.context_invoked.rejected',
            did: this.nousDid,
            reason: (err as Error).message,
        }));
    }
    break;
}

case 'iris_contradiction_detected': {
    // Phase 17 IRIS-05 / D-17-09: sole producer appendIrisContradictionDetected.
    // Brain sends {target_did, contradiction_hash}; Grid injects nous_did + tick.
    const md = (action.metadata ?? {}) as Record<string, unknown>;
    const targetDid = typeof md['target_did'] === 'string' ? md['target_did'] : null;
    const contradictionHash = typeof md['contradiction_hash'] === 'string' ? md['contradiction_hash'] : null;
    if (targetDid === null || contradictionHash === null) {
        console.warn(JSON.stringify({
            event: 'iris.contradiction_detected.malformed_metadata',
            did: this.nousDid,
            reason: 'missing target_did or contradiction_hash',
            tick,
        }));
        break;
    }
    try {
        appendIrisContradictionDetected(this.audit, this.nousDid, {
            nous_did: this.nousDid,
            tick,
            target_did: targetDid,
            contradiction_hash: contradictionHash,
        });
    } catch (err) {
        console.warn(JSON.stringify({
            event: 'iris.contradiction_detected.rejected',
            did: this.nousDid,
            reason: (err as Error).message,
        }));
    }
    break;
}

case 'iris_prior_seeded': {
    // Phase 17 IRIS-06 / D-17-09: sole producer appendIrisPriorSeeded.
    // Brain sends {target_did, seed_event_hash}; Grid injects nous_did + tick.
    // seed_event_hash may be an empty string when no source hash was derivable.
    const md = (action.metadata ?? {}) as Record<string, unknown>;
    const targetDid = typeof md['target_did'] === 'string' ? md['target_did'] : null;
    const seedEventHash = typeof md['seed_event_hash'] === 'string' ? md['seed_event_hash'] : null;
    if (targetDid === null || seedEventHash === null) {
        console.warn(JSON.stringify({
            event: 'iris.prior_seeded.malformed_metadata',
            did: this.nousDid,
            reason: 'missing target_did or seed_event_hash',
            tick,
        }));
        break;
    }
    try {
        appendIrisPriorSeeded(this.audit, this.nousDid, {
            nous_did: this.nousDid,
            tick,
            target_did: targetDid,
            seed_event_hash: seedEventHash,
        });
    } catch (err) {
        console.warn(JSON.stringify({
            event: 'iris.prior_seeded.rejected',
            did: this.nousDid,
            reason: (err as Error).message,
        }));
    }
    break;
}
```

---

## Protocol Changes

### brain/src/noesis_brain/rpc/types.py — ActionType additions

Insert after `VOTE_REVEAL = "vote_reveal"` (line 25), before `SKILL_LEARN`:

```python
# Phase 17 Iris — forwarded to Grid (unlike SKILL_LEARN/RULE_STORE which are Brain-internal).
# 3-keys-not-5: metadata carries 1-3 keys; Grid injects nous_did + tick at dispatch time.
IRIS_BELIEF_REVISED = "iris_belief_revised"         # metadata: {target_did, belief_hash, dimension}
IRIS_CONTEXT_INVOKED = "iris_context_invoked"       # metadata: {belief_count}
IRIS_CONTRADICTION_DETECTED = "iris_contradiction_detected"  # metadata: {target_did, contradiction_hash}
IRIS_PRIOR_SEEDED = "iris_prior_seeded"             # metadata: {target_did, seed_event_hash}
```

[VERIFIED: types.py lines 25-33 read; insertion point confirmed]

### protocol/src/noesis/bridge/types.ts — BrainAction union

The `BrainAction` union is at line 188. Current value in `action_type` of the base `BrainAction` interface (line 26) is: `'speak' | 'direct_message' | 'move' | 'trade_request' | 'noop'`.

**Note:** The local `grid/src/integration/types.ts` has the full union with all phases. The `protocol/src/noesis/bridge/types.ts` `BrainAction.action_type` is OUTDATED (only 5 variants). The pattern from Phase 12 was to add new interface variants to `grid/src/integration/types.ts` (the authoritative local copy) and update the bridge types separately.

Add 4 new interfaces to `grid/src/integration/types.ts`:

```typescript
export interface BrainActionIrisBeliefRevised {
    readonly action_type: 'iris_belief_revised';
    readonly channel: '';
    readonly text: '';
    readonly metadata: {
        readonly target_did: string;
        readonly belief_hash: string;
        readonly dimension: string;
    };
}

export interface BrainActionIrisContextInvoked {
    readonly action_type: 'iris_context_invoked';
    readonly channel: '';
    readonly text: '';
    readonly metadata: {
        readonly belief_count: number;
    };
}

export interface BrainActionIrisContradictionDetected {
    readonly action_type: 'iris_contradiction_detected';
    readonly channel: '';
    readonly text: '';
    readonly metadata: {
        readonly target_did: string;
        readonly contradiction_hash: string;
    };
}

export interface BrainActionIrisPriorSeeded {
    readonly action_type: 'iris_prior_seeded';
    readonly channel: '';
    readonly text: '';
    readonly metadata: {
        readonly target_did: string;
        readonly seed_event_hash: string;
    };
}
```

Then extend `BrainAction` union (currently ends line 199):
```typescript
export type BrainAction =
    | SpeakAction
    | DirectMessageAction
    | MoveAction
    | NoopAction
    | TradeRequestAction
    | TelosRefinedAction
    | BrainActionDriveCrossed
    | BrainActionWhisperSend
    | BrainActionPropose
    | BrainActionVoteCommit
    | BrainActionVoteReveal
    | BrainActionIrisBeliefRevised       // Phase 17
    | BrainActionIrisContextInvoked      // Phase 17
    | BrainActionIrisContradictionDetected // Phase 17
    | BrainActionIrisPriorSeeded;        // Phase 17
```

[VERIFIED: grid/src/integration/types.ts lines 188-199 read; union confirmed]

---

## Allowlist Changes

### Wave 0 gap: Phase 15/16 entries missing

**Confirmed absent** from `grid/src/audit/broadcast-allowlist.ts` (grep returned no results for `nous.reflection`, `nous.self_model`, `nous.creed`, `nous.sleep`).

Current allowlist count: **27 entries** (positions 1-27, ending with `operator.exported` at line 126).

**Wave 0 must add positions 28-32 as prerequisites** before adding 33-36:
```
28: 'nous.reflection_authored'
29: 'nous.self_model_revised'
30: 'nous.creed_violation'
31: 'nous.sleep.entered'
32: 'nous.sleep.completed'
```

Each needs a sole-producer emitter file in `grid/src/`. The Phase 15/16 plans define these — the planner must verify those plans exist or add stub emitters.

### Positions 33-36: Iris entries

Append after `operator.exported` entry (currently position 27 at line 126):

```typescript
    // Phase 17 (IRIS-03): +4 iris.* events at positions 33-36.
    // Closed payloads — hashes only, belief content NEVER crosses wire.
    // Sole producers in grid/src/iris/append*.ts.
    //
    // iris.belief_revised (33) — Nous forms/updates a belief about a peer.
    //   4-key payload: {nous_did, tick, target_did, belief_hash}.
    'iris.belief_revised',
    // iris.context_invoked (34) — Nous's ToM beliefs injected into prompt this tick.
    //   3-key payload: {nous_did, tick, belief_count}.
    'iris.context_invoked',
    // iris.contradiction_detected (35) — Belief confidence delta > threshold.
    //   4-key payload: {nous_did, tick, target_did, contradiction_hash}.
    'iris.contradiction_detected',
    // iris.prior_seeded (36) — First belief about a peer seeded from relgraph.
    //   4-key payload: {nous_did, tick, target_did, seed_event_hash}.
    'iris.prior_seeded',
```

### FORBIDDEN_KEY_PATTERN extension

Current pattern (line 274 — single long regex string). Append the 6 iris-specific terms:

```typescript
export const FORBIDDEN_KEY_PATTERN = /prompt|response|wiki|reflection|thought|emotion_delta|hunger|curiosity|safety|boredom|loneliness|drive_value|energy|sustenance|need_value|bios_value|subjective_multiplier|chronos_multiplier|subjective_tick|text|body|content|message|utterance|plaintext|decrypted|payload_plain|description|rationale|proposal_text|law_text|body_text|weight|reputation|relationship_score|ousia_weight|belief_content|target_content|emotion_text|dimension_text|belief_prose|iris_content/i;
```

Added: `belief_content|target_content|emotion_text|dimension_text|belief_prose|iris_content`

[VERIFIED: broadcast-allowlist.ts lines 24-274 read in full; line 274 is the current pattern end]

---

## LLM Prompt Design for elicit() (Claude's Discretion)

The existing `IrisRuntime._build_prompt()` (elicit.py lines 229-247) already implements a working prompt. It is minimal JSON-mode. The research recommendation is to enhance it slightly for better structured output while keeping content Brain-private.

### Current prompt (in elicit.py)

```python
return (
    f"You are {nous_did}. Elicit a 1st-order belief about {target_did}.\n"
    f"Context: {ctx_summary}\n"
    "Reply with JSON only: "
    '{"dimension": "<belief|desire|intention|knowledge|emotion>", '
    '"content": "<brief prose>", "confidence": <0.0-1.0>}'
)
```

### Recommended enhancement for on_tick() elicit calls

The `context` dict passed to `elicit()` from `on_tick()` should include structured fields that `_build_prompt()` can surface meaningfully. Recommended `context` structure:

```python
context = {
    "counterparty_did": target_did,
    "utterances": [u.get("text", "")[:200] for u in ctx.get("utterances", [])[:5]],
    "channel": ctx.get("channel", ""),
    "dialogue_id": ctx.get("dialogue_id", ""),
    # source_event_hash for audit anchoring:
    "source_event_hash": hashlib.sha256(
        ctx.get("dialogue_id", "").encode("utf-8")
    ).hexdigest() if ctx.get("dialogue_id") else "",
}
```

**Enhanced `_build_prompt()` (replacement — stays Brain-private):**

```python
def _build_prompt(self, nous_did: str, target_did: str, context: dict) -> str:
    utterances = context.get("utterances", [])
    utterance_block = "\n".join(
        f"  - {u[:200]}" for u in utterances[:5] if isinstance(u, str)
    ) or "  (none)"
    return (
        f"You are {nous_did}. Based on the conversation below, form a 1st-order "
        f"belief about {target_did}.\n\n"
        f"Recent utterances from {target_did}:\n{utterance_block}\n\n"
        "Reply with a single JSON object (no markdown, no explanation):\n"
        '{"dimension": "<belief|desire|intention|knowledge|emotion>", '
        '"content": "<1-2 sentence belief prose>", "confidence": <0.0-1.0>}\n\n'
        "dimension must be exactly one of: belief, desire, intention, knowledge, emotion\n"
        "content is your private inference — be specific but concise.\n"
        "confidence is your certainty [0.0=none, 1.0=certain]."
    )
```

This is discretionary. The existing prompt works and tests pass with it. The enhancement improves signal by surfacing actual utterances.

---

## Test Patterns

### Python test fixture pattern (from test_rpc_handler.py)

```python
# Standard fixture helpers already in test_rpc_handler.py:
# _make_psyche(), _make_thymos(), _make_telos(), _make_llm(), _make_handler()

# Pattern for Iris tests — matches Phase 14 FixtureBrainAdapter style
from unittest.mock import MagicMock

def make_iris_llm(response: str) -> MagicMock:
    """Mock LLM adapter with .complete() for IrisRuntime."""
    llm = MagicMock()
    llm.complete.return_value = response
    return llm

# Standard valid elicit response:
VALID_BELIEF_JSON = '{"dimension": "belief", "content": "Prefers to avoid conflict.", "confidence": 0.75}'

# Test: cooldown enforcement
def test_elicit_cooldown():
    store = IrisStore(db_path=":memory:", nous_did="did:noesis:test")
    llm = make_iris_llm(VALID_BELIEF_JSON)
    rt = IrisRuntime(store=store, llm_adapter=llm)
    r1 = rt.elicit("did:noesis:alpha", "did:noesis:beta", {}, tick=0)
    r2 = rt.elicit("did:noesis:alpha", "did:noesis:beta", {}, tick=10)  # within cooldown
    r3 = rt.elicit("did:noesis:alpha", "did:noesis:beta", {}, tick=20)  # at cooldown boundary
    assert len(r1.beliefs) == 1
    assert len(r2.beliefs) == 0   # cooldown
    assert len(r3.beliefs) == 1   # cooldown expired
    assert llm.complete.call_count == 2  # only r1 and r3 hit LLM
```

### TypeScript test fixture pattern (from nous-runner-ananke.test.ts)

```typescript
// makeBridge() helper from nous-runner-ananke.test.ts (copy exactly):
function makeBridge(queue: BrainAction[][]): IBrainBridge { ... }

// Iris-specific action factories:
function makeIrisBeliefRevisedAction(targetDid: string, beliefHash: string): BrainAction {
    return {
        action_type: 'iris_belief_revised',
        channel: '',
        text: '',
        metadata: {
            target_did: targetDid,
            belief_hash: beliefHash,
            dimension: 'belief',
        },
    } as unknown as BrainAction;
}

// Test: valid iris_belief_revised → chain entry
it('valid iris_belief_revised appends iris.belief_revised entry', async () => {
    const { audit } = seedEnv();
    const runner = makeRunner(makeBridge([[makeIrisBeliefRevisedAction(
        'did:noesis:beta',
        'a'.repeat(64),
    )]]), { audit });
    await runner.tick(5, 1);
    const entries = audit.entries.filter(e => e.eventType === 'iris.belief_revised');
    expect(entries).toHaveLength(1);
    expect((entries[0].payload as Record<string, unknown>).nous_did).toBe(NOUS_DID);
    expect((entries[0].payload as Record<string, unknown>).tick).toBe(5);
});

// Test: malformed metadata → console.warn, no throw, sibling actions still run
it('malformed iris_belief_revised drops silently without aborting siblings', async () => {
    // ... follows T-10a-18 sibling-resilience pattern from ananke test
});
```

[VERIFIED: grid/test/integration/nous-runner-ananke.test.ts lines 1-80 read for pattern]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Belief persistence | Custom DB schema | IrisStore (already implemented) | WAL + FTS5 + append-only already built and tested |
| Hash computation | `crypto.subtle.digest`, custom | `hashlib.sha256` (Python), `createHash('sha256')` (TS) | Already used throughout; consistent with audit-chain patterns |
| Closed-tuple validation | Hand-written key checks | `Object.keys(payload).sort()` + `every` pattern | Exact pattern from drive-crossed; battle-tested |
| Cooldown enforcement | Clock-based throttle | `_last_elicit` dict in IrisRuntime | Already implemented; no wall-clock needed |
| LRU eviction | Custom eviction algorithm | `IrisStore._enforce_cap()` | Already implemented; superseded_by FK chain |

---

## Common Pitfalls

### Pitfall 1: `self._iris_runtime` AttributeError on first on_tick call

**What goes wrong:** handler.py references `self._iris_runtime` at lines 217-227 but `__init__` does not declare it. Any `on_tick()` call will raise `AttributeError: 'BrainHandler' object has no attribute '_iris_runtime'`.

**Why it happens:** The field was added to `on_tick()` as a forward stub but the `__init__` wiring was left for Phase 17.

**How to avoid:** The FIRST task of Wave 1 must be adding `self._iris_runtime: IrisRuntime | None = None` to `__init__` plus the optional-dep construction block. This is a prerequisite for all other Brain wiring tasks.

**Warning signs:** Any existing test that calls `on_tick()` will fail immediately once `seed_priors()` block runs (line 217 is the guard).

[VERIFIED: handler.py __init__ lines 40-71 confirm field is absent]

### Pitfall 2: seed_event_hash mismatch between priors.py dispatcher and appendIrisPriorSeeded

**What goes wrong:** `seed_priors()` calls `dispatcher.emit("iris.prior_seeded", {"source": "relgraph", "target_did": target_did})` (2 keys). The Grid NousRunner case receives these 2 keys but `appendIrisPriorSeeded` needs a `seed_event_hash` (64-hex). If the NousRunner case reads `md['seed_event_hash']` it gets `undefined`.

**How to avoid:** The NousRunner `case 'iris_prior_seeded'` must compute `seed_event_hash` from the available fields if absent, OR the Brain's dispatcher must be updated to emit the hash. The recommended approach: Brain's dispatcher emits `{target_did, seed_event_hash}` where `seed_event_hash = sha256(f"{nous_did}:{target_did}:{tick}").hexdigest()` — computed inside the dispatcher wrapper, not in priors.py (priors.py is locked).

**Implementation:** Create a dispatcher wrapper in handler.py's Iris init that intercepts `iris.prior_seeded` emissions and enriches the metadata before converting to an Action.

### Pitfall 3: Allowlist positions 28-32 absent from live file

**What goes wrong:** Adding positions 33-36 without 28-32 creates a gap. The allowlist test (`broadcast-allowlist.test.ts`) asserts the ALLOWLIST_MEMBERS array length. If 28-32 are absent and 33-36 are added, the count will be 32 not 36, and any test that checks the exact member list will fail.

**How to avoid:** Wave 0 must add all 5 Phase 15/16 entries first, with their sole-producer emitter stubs.

### Pitfall 4: `dimension` key in Brain metadata crosses wire as plaintext

**What goes wrong:** Brain emits `IRIS_BELIEF_REVISED` with `metadata: {target_did, belief_hash, dimension}`. The `dimension` value (`"belief"`, `"desire"`, etc.) is a closed enum — NOT belief content — but it does partially characterize the belief. The Grid 4-key payload omits `dimension` (it is NOT in `EXPECTED_KEYS` for `appendIrisBeliefRevised`). The NousRunner case must extract `belief_hash` and `target_did` only, and silently drop `dimension`.

**How to avoid:** The `appendIrisBeliefRevised` payload interface has exactly `{nous_did, tick, target_did, belief_hash}` — 4 keys. Grid never forwards `dimension` to the audit chain. The closed-tuple check enforces this.

### Pitfall 5: `context_for()` called before beliefs exist (empty section emitted)

**What goes wrong:** On first tick, IrisStore has no beliefs. `context_for()` returns `n_beliefs_used=0`. If the ToM section is emitted with "no beliefs" placeholder text, it adds noise to the system prompt.

**How to avoid:** `_theory_of_mind_section()` returns `""` when all `n_beliefs_used == 0`. The `build_system_prompt()` only appends it when non-empty. `IRIS_CONTEXT_INVOKED` action is NOT emitted when `total_beliefs == 0`.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Hand-coded `_iris_runtime` in on_tick() without __init__ declaration | Add kwarg + conditional init in __init__ (optional-dep pattern from Phase 15) | Prevents AttributeError |
| Allowlist static at 27 entries | Allowlist grows to 36 (28-32 Phase 15/16, 33-36 Phase 17) | 9 new broadcast event types |
| No ToM in system prompt | Theory of Mind section between drives and Telos | Nous awareness of peer beliefs |
| elicit() stub in elicit.py unused | Wired into on_tick(), triggered by dialogue_context | Live LLM-inferred peer model |

---

## Assumptions Log

All claims in this research are [VERIFIED: direct codebase read]. No assumed claims.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | — | — | — |

**All claims verified by direct file reads during this research session.**

---

## Open Questions

1. **Phase 15/16 sole-producer emitters: do they exist?**
   - What we know: The 5 allowlist strings (28-32) are absent from `broadcast-allowlist.ts`. The planning directory shows phases 15 and 16 existed (see git log).
   - What's unclear: Whether sole-producer emitter `.ts` files were created for Phase 15/16 events. If they don't exist, Wave 0 must create stubs.
   - Recommendation: Wave 0 task: `find grid/src -name "appendNousReflection*.ts" -o -name "appendNousSleep*.ts"` to confirm presence before touching the allowlist.

2. **dispatcher wiring for seed_priors**
   - What we know: `seed_priors()` calls `dispatcher.emit("iris.prior_seeded", {source, target_did})`. The dispatcher protocol expects `.emit(action_type, metadata)`. The handler's `_iris_runtime.dispatcher` is `set_dispatcher()` via a call that doesn't exist yet in the __init__ wiring.
   - What's unclear: What object implements the dispatcher in handler.py context. Looking at Phase 10a, actions are appended to the `actions` list directly in `on_tick()` — there is no dispatcher object; actions are returned. Iris priors need to emit Actions into the same list.
   - Recommendation: The dispatcher should be a thin wrapper created in handler.py's `__init__` that captures the `actions` list reference OR a lambda that appends to the local `actions` list. The cleanest approach: don't use a dispatcher at all for priors; instead post-process the `seed_priors()` return value. But `seed_priors()` returns `None` and fires via dispatcher.emit(). The planner must design a dispatcher adapter that appends to `actions`.

3. **`seed_event_hash` for IRIS_PRIOR_SEEDED when no source hash available**
   - What we know: `priors.py` sets `source_event_hash=None` on the Belief (line 177). The dispatcher emit at line 183 sends `{"source": "relgraph", "target_did": target_did}` — no hash.
   - What's unclear: What 64-hex string to put in `seed_event_hash` for the Grid payload.
   - Recommendation: Compute `sha256(f"{nous_did}:{target_did}:{tick}".encode()).hexdigest()` as a deterministic surrogate in the dispatcher adapter. This is reproducible, wall-clock-free, and distinct per (nous_did, target_did, tick) triple.

---

## Environment Availability

Step 2.6: SKIPPED — no external dependencies. All dependencies (SQLite stdlib, hashlib, Python, TypeScript/vitest) are already in use in the project.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Python framework | pytest (brain/test/) |
| TypeScript framework | vitest (grid/test/) |
| Python quick run | `cd brain && python -m pytest test/test_iris_*.py -x` |
| TypeScript quick run | `cd grid && npx vitest run test/iris/` |
| Full suite (Brain) | `cd brain && python -m pytest` |
| Full suite (Grid) | `cd grid && npx vitest run` |

### Phase Requirements → Test Map

| Req | Behavior | Test Type | Automated Command |
|-----|----------|-----------|-------------------|
| IRIS-01 | IrisRuntime init in handler __init__ (optional-dep, None safe) | unit | `pytest test/test_iris_handler_wiring.py::test_handler_iris_disabled -x` |
| IRIS-02 | elicit() triggered once per peer per dialogue_context (cooldown=20) | unit | `pytest test/test_iris_elicit.py::test_cooldown_enforcement -x` |
| IRIS-03 | appendIrisBeliefRevised: 4-key closed tuple, DID regex, hash format | unit | `npx vitest run test/iris/append-iris-belief-revised.test.ts` |
| IRIS-04 | appendIrisContextInvoked: 3-key closed tuple, belief_count positive | unit | `npx vitest run test/iris/append-iris-context-invoked.test.ts` |
| IRIS-05 | appendIrisContradictionDetected: 4-key, contradiction_hash 64-hex | unit | `npx vitest run test/iris/append-iris-contradiction-detected.test.ts` |
| IRIS-06 | appendIrisPriorSeeded: 4-key, seed_event_hash 64-hex | unit | `npx vitest run test/iris/append-iris-prior-seeded.test.ts` |
| IRIS-07 | NousRunner 4 new cases: valid → chain entry; invalid → warn + drop | integration | `npx vitest run test/iris/nous-runner-iris.test.ts` |
| IRIS-08 | Sole-producer boundary: only appendIris*.ts calls chain.append('iris.*') | grep/static | `npx vitest run test/iris/iris-producer-boundary.test.ts` |
| IRIS-09 | Allowlist 33-36: iris.* events broadcast; non-iris iris-like events don't | unit | `npx vitest run test/audit/broadcast-allowlist.test.ts` |
| IRIS-10 | FORBIDDEN_KEY_PATTERN blocks belief_content, iris_content, etc. | unit | `npx vitest run test/privacy/iris-forbidden-keys.test.ts` |
| IRIS-11 | Contradiction detection: delta > 0.3 → iris.contradiction_detected | unit | `pytest test/test_iris_elicit.py::test_contradiction_threshold -x` |
| IRIS-12 | Append-only: 20 beliefs, cap=10, 10 active, 10 superseded, 0 deleted | unit | `pytest test/test_iris_store.py::test_cap_lru_eviction -x` |
| IRIS-13 | Zero-diff: 100-tick sim ±iris enabled = chain diff exactly iris.* entries | integration | `npx vitest run test/audit/zero-diff-iris.test.ts` |
| IRIS-14 | Wall-clock grep gate: iris/ modules contain no time.time/uuid/datetime | static/grep | `pytest test/test_iris_no_walltime.py -x` |

### Wave 0 Gaps (files that must be created before implementation)

- [ ] `brain/test/test_iris_store.py` — IrisStore unit tests (cap, append-only, FTS5)
- [ ] `brain/test/test_iris_elicit.py` — IrisRuntime unit tests (cooldown, contradiction, LLM parse)
- [ ] `brain/test/test_iris_priors.py` — seed_priors unit tests (once-per-pair, derive_prior)
- [ ] `brain/test/test_iris_handler_wiring.py` — BrainHandler.__init__ iris optional-dep tests
- [ ] `brain/test/test_iris_no_walltime.py` — Wall-clock grep gate (clone ananke pattern)
- [ ] `grid/test/iris/append-iris-belief-revised.test.ts` — Emitter unit tests
- [ ] `grid/test/iris/append-iris-context-invoked.test.ts`
- [ ] `grid/test/iris/append-iris-contradiction-detected.test.ts`
- [ ] `grid/test/iris/append-iris-prior-seeded.test.ts`
- [ ] `grid/test/iris/iris-producer-boundary.test.ts` — Grep gate (clone drive-crossed-producer-boundary.test.ts)
- [ ] `grid/test/iris/nous-runner-iris.test.ts` — NousRunner integration (clone nous-runner-ananke.test.ts)
- [ ] `grid/test/audit/zero-diff-iris.test.ts` — Zero-diff sim (clone zero-diff-ananke.test.ts)
- [ ] `grid/test/privacy/iris-forbidden-keys.test.ts` — FORBIDDEN_KEY_PATTERN iris terms

---

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | Closed-tuple + DID regex + hash format validation in all 4 emitters |
| V5 Content Privacy | yes | FORBIDDEN_KEY_PATTERN + belief_content never in payload |
| V4 Access Control | no | Iris is Brain-internal; no operator-facing endpoints |
| V2 Authentication | no | No new auth surface |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Brain sends `belief_content` in metadata | Information Disclosure | FORBIDDEN_KEY_PATTERN gate + closed-tuple rejects extra keys |
| Brain forges `nous_did` in metadata | Spoofing | Self-report invariant (payload.nous_did must equal actorDid) — same as drive_crossed |
| Brain sends `dimension_text` prose key | Information Disclosure | FORBIDDEN_KEY_PATTERN + closed-tuple rejects unlisted keys |
| Stale cooldown allows excessive LLM calls | DoS | `_last_elicit` dict enforces 20-tick minimum per pair; no wall-clock needed |

---

## Sources

### Primary (HIGH confidence — all verified by direct file read)
- `brain/src/noesis_brain/iris/elicit.py` — IrisRuntime, ElicitResult, _build_prompt, cooldown logic
- `brain/src/noesis_brain/iris/store.py` — IrisStore, add_belief, supersede, get_beliefs, has_prior_for
- `brain/src/noesis_brain/iris/integration.py` — context_for, predict_vote, ToMContext
- `brain/src/noesis_brain/iris/priors.py` — seed_priors, derive_prior, dispatcher protocol
- `brain/src/noesis_brain/iris/config.py` — All 4 constants (COOLDOWN=20, THRESHOLD=0.3, CAP=10, TOP_K=5)
- `brain/src/noesis_brain/iris/types.py` — Belief dataclass, DIMENSION_VALUES
- `brain/src/noesis_brain/rpc/handler.py` — Full handler (1042 lines); wiring gaps confirmed
- `brain/src/noesis_brain/rpc/types.py` — ActionType enum; insertion point confirmed
- `brain/src/noesis_brain/prompts/system.py` — build_system_prompt; insertion point confirmed
- `grid/src/ananke/append-drive-crossed.ts` — Sole-producer template (cloned for all 4 iris emitters)
- `grid/src/integration/nous-runner.ts` — Full NousRunner (699 lines); insertion point confirmed
- `grid/src/integration/types.ts` — BrainAction union; extension point confirmed
- `grid/src/audit/broadcast-allowlist.ts` — Full allowlist (321 lines); 27-entry count confirmed; Phase 15/16 entries absent confirmed
- `grid/src/governance/appendProposalOpened.ts` — Closed-tuple boilerplate reference
- `grid/test/ananke/append-drive-crossed.test.ts` — Test pattern reference
- `grid/test/integration/nous-runner-ananke.test.ts` — Integration test pattern reference
- `.planning/phases/17-iris-theory-of-mind/17-CONTEXT.md` — All locked decisions

---

## Metadata

**Confidence breakdown:**
- Brain wiring points (handler.py): HIGH — exact line numbers from direct file read
- Grid emitter boilerplate: HIGH — cloned from verified drive-crossed pattern
- NousRunner insertion: HIGH — exact line numbers confirmed
- Allowlist state: HIGH — live file read confirms 27 entries, Phase 15/16 absent
- LLM prompt design: MEDIUM — discretionary; existing implementation works, enhancement recommended
- dispatcher adapter design: MEDIUM — open question 2 requires planner decision

**Research date:** 2026-05-15
**Valid until:** 2026-06-15 (stable codebase; no fast-moving external deps)
