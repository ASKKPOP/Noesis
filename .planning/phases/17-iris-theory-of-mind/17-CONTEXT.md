# Phase 17: Iris (Theory of Mind) — Context

**Gathered:** 2026-05-15
**Status:** Ready for planning
**Mode:** --auto (all decisions are recommended defaults, no interactive session)

<domain>
## Phase Boundary

Phase 17 delivers the Theory of Mind (ToM) layer for each Nous: a per-Nous private belief
model of peers across 5 dimensions (belief, desire, intention, knowledge, emotion). The model
is Brain-private; only hashes cross the Brain↔Grid wire. The Iris elicit cycle uses LLM
inference over witnessed peer events (dialogue_context) to form, update, and detect
contradictions in beliefs. Prior seeding from the relationship graph runs every tick without
LLM. Four audit events anchor the lifecycle.

**Brain module already implemented (recovered from deletion):**
- `brain/src/noesis_brain/iris/types.py` — Belief dataclass + Dimension enum
- `brain/src/noesis_brain/iris/config.py` — IRIS_ELICIT_COOLDOWN=20, IRIS_CONTRADICTION_THRESHOLD=0.3, IRIS_BELIEFS_CAP=10, IRIS_CONTEXT_TOP_K=5
- `brain/src/noesis_brain/iris/store.py` — IrisStore (SQLite WAL + FTS5, append-only)
- `brain/src/noesis_brain/iris/elicit.py` — IrisRuntime.elicit() with cooldown + contradiction detection
- `brain/src/noesis_brain/iris/integration.py` — context_for(), predict_vote(), ToMContext, VotePrediction
- `brain/src/noesis_brain/iris/priors.py` — Prior seeding from relationship_context edges
- `brain/src/noesis_brain/iris/__init__.py` — Module exports
- `brain/src/noesis_brain/rpc/handler.py` — seed_priors() wired; _iris_runtime field exists (uninitialized)

**What Phase 17 must build:**
1. Brain: IrisRuntime initialization + elicit() trigger + context_for() prompt injection
2. Grid: 4 sole-producer emitters + 4 NousRunner cases + allowlist 32→36
3. Protocol: 4 new Brain ActionType members + bridge/types.ts update
4. Grid: FORBIDDEN_KEY_PATTERN extension
5. Tests: determinism, zero-diff, cooldown, contradiction, closed-tuple payloads

</domain>

<decisions>
## Implementation Decisions

### Allowlist Sequencing

- **D-17-01:** Phase 17 allowlist positions are 33-36. Assumes Phase 15 added positions 28-30
  (`nous.reflection_authored`, `nous.self_model_revised`, `nous.creed_violation`) and Phase 16
  added positions 31-32 (`nous.sleep.entered`, `nous.sleep.completed`). Phase 17 Wave 0 MUST
  verify these 5 entries exist in `grid/src/audit/broadcast-allowlist.ts` before adding the
  4 Iris entries. If missing, Wave 0 adds them (with Phase 15/16 sole-producer emitters) as
  prerequisites.

- **D-17-02:** The 4 Iris audit events and their allowlist positions (alphabetical within each
  prefix group, matching existing Phase 10a/11/12 convention):
  - Position 33: `iris.belief_revised` — fires on every belief write
  - Position 34: `iris.context_invoked` — fires per-tick when beliefs are injected into prompt
  - Position 35: `iris.contradiction_detected` — fires when confidence delta exceeds threshold
  - Position 36: `iris.prior_seeded` — fires when a Nous forms first belief about a peer

### elicit() Trigger Strategy

- **D-17-03:** `IrisRuntime.elicit()` is called once per peer in `dialogue_context` when the
  Grid delivers a dialogue_context payload (same delivery mechanism as Phase 7 telos.refined).
  For each peer DID in the exchange, elicit() is invoked once, subject to
  IRIS_ELICIT_COOLDOWN=20 ticks per (nous_did, target_did) pair.

- **D-17-04:** If no dialogue_context arrives on a tick (no peer interactions), elicit() is NOT
  called. Only seed_priors() runs (from relationship_context). This avoids LLM calls on idle
  ticks.

- **D-17-05:** elicit() produces 1 belief per dimension inferred from the exchange context. The
  LLM prompt includes: peer's witnessed utterances (hashes only on the prompt — actual text
  from memory), existing active beliefs, and the Nous's current drives/Telos for context.
  LLM output format: structured JSON `[{dimension, content, confidence}]`.

### Iris Action Types → Grid Emission

- **D-17-06:** 4 new `ActionType` members added to `brain/src/noesis_brain/rpc/types.py`:
  - `IRIS_BELIEF_REVISED = "iris_belief_revised"` — Brain metadata: `{target_did, belief_hash, dimension}` (3 keys)
  - `IRIS_CONTEXT_INVOKED = "iris_context_invoked"` — Brain metadata: `{belief_count}` (1 key)
  - `IRIS_CONTRADICTION_DETECTED = "iris_contradiction_detected"` — Brain metadata: `{target_did, contradiction_hash}` (2 keys)
  - `IRIS_PRIOR_SEEDED = "iris_prior_seeded"` — Brain metadata: `{target_did, seed_event_hash}` (2 keys)
  All 4 are forwarded to the Grid (unlike SKILL_LEARN/RULE_STORE which are Brain-internal only).

- **D-17-07:** 3-keys-not-5 invariant applies: Brain metadata carries 1-3 keys; Grid injects
  `nous_did` and `tick` at emit time. Grid is sole authority on `nous_did` and `tick` values.
  This mirrors the `drive_crossed` pattern (Phase 10a) exactly.

- **D-17-08:** 4 sole-producer emitters in `grid/src/iris/`:
  - `appendIrisBeliefRevised.ts` — closed 4-key payload `{nous_did, tick, target_did, belief_hash}`
  - `appendIrisContextInvoked.ts` — closed 3-key payload `{nous_did, tick, belief_count}`
  - `appendIrisContradictionDetected.ts` — closed 4-key payload `{nous_did, tick, target_did, contradiction_hash}`
  - `appendIrisPriorSeeded.ts` — closed 4-key payload `{nous_did, tick, target_did, seed_event_hash}`
  Each uses `Object.keys(payload).sort()` strict equality enforcement (Phase 6 D-11 pattern).

- **D-17-09:** 4 new `case` branches in `grid/src/integration/nous-runner.ts`:
  - `case 'iris_belief_revised'` — calls `appendIrisBeliefRevised`
  - `case 'iris_context_invoked'` — calls `appendIrisContextInvoked`
  - `case 'iris_contradiction_detected'` — calls `appendIrisContradictionDetected`
  - `case 'iris_prior_seeded'` — calls `appendIrisPriorSeeded`
  All follow the `drive_crossed` case pattern: try/catch with console.warn on rejection,
  never throwing to sibling actions.

- **D-17-10:** Bridge types update — `protocol/src/noesis/bridge/types.ts` BrainAction
  `action_type` union extended with the 4 new iris action strings. Drift detector test
  updated (clone Phase 12 governance-types.drift.test.ts pattern).

### context_for() Prompt Injection

- **D-17-11:** `context_for()` builds a `ToMContext` for each peer with active beliefs.
  Injected as a "Theory of Mind" section in the system prompt builder, positioned between
  the drives/Ananke section and the Telos section. This matches the injection site established
  in Phase 15 (reflexion buffer injects above drives, skills inject below drives).

- **D-17-12:** Up to 3 most-recently-interacted peers are included per tick (bounded to avoid
  prompt bloat). Top-5 beliefs per peer (IRIS_CONTEXT_TOP_K=5). If no active beliefs exist
  for any peer, the section is omitted entirely — no placeholder text.

- **D-17-13:** `iris.context_invoked` fires once per tick when any beliefs are injected.
  `belief_count` = total number of beliefs injected across all peers in that tick (sum).
  If no beliefs are injected (empty ToM section), the event is NOT emitted.

### IrisRuntime Initialization and BrainHandler Wiring

- **D-17-14:** `IrisRuntime` initialized in `BrainHandler.__init__()` as optional-dep
  injection (same pattern as AAULearner from Phase 15). Constructor parameter:
  `iris_db_dir: str | Path | None = None`. If None, `_iris_runtime = None` (disabled, no-op).
  If provided, constructs `IrisStore(db_path=iris_db_dir, nous_did=self.did)` and wraps in
  `IrisRuntime(store, self._llm)`. Dispatcher set via `set_dispatcher(self._dispatcher)`.

- **D-17-15:** `elicit()` called inside `on_tick()` after `seed_priors()`, gated on
  `_iris_runtime is not None` and `dialogue_context is not None`. Return value is an
  `ElicitResult` list; each result with non-empty beliefs emits IRIS_BELIEF_REVISED actions;
  each contradiction emits IRIS_CONTRADICTION_DETECTED; each result.new_hash on a pair with
  no prior belief emits IRIS_PRIOR_SEEDED.

- **D-17-16:** context_for() called at prompt-build time (inside the existing system prompt
  builder), gated on `_iris_runtime is not None`. Result flows into ToM prompt section.
  IRIS_CONTEXT_INVOKED action emitted inside on_tick() AFTER elicit() (so belief count
  reflects any newly written beliefs from that tick).

### FORBIDDEN_KEY_PATTERN Extension

- **D-17-17:** Add iris-specific forbidden keys to the regex in
  `grid/src/audit/broadcast-allowlist.ts`:
  `belief_content|target_content|emotion_text|dimension_text|belief_prose|iris_content`
  Appended to the existing FORBIDDEN_KEY_PATTERN. CI grep gate (clone Phase 11's
  three-tier whisper pattern): Grid emitters, Brain wire, Dashboard render all checked.

### Dashboard

- **D-17-18:** No new Dashboard panel for Phase 17. The 4 `iris.*` events appear in the
  firehose automatically (they are allowlisted). Inspector Nous panel does NOT get a new
  Theory of Mind section — all belief content is Brain-private and never available to the
  dashboard. Deferred to future phase: ToM event-count badge on Inspector.

### Claude's Discretion
- LLM prompt template for elicit() — planner decides structure (JSON-mode response preferred
  if LLM adapter supports it; fallback to regex extraction).
- SQLite pragma tuning for IrisStore beyond WAL (cache_size, mmap_size) — planner/executor
  may tune based on Phase 16 ltm_store.py benchmarks.
- Test fixture format for elicit() LLM responses — planner designs, matching Phase 14
  FixtureBrainAdapter pattern.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Iris Brain Module (already implemented — read before modifying)
- `brain/src/noesis_brain/iris/__init__.py` — Module exports and architecture doc
- `brain/src/noesis_brain/iris/types.py` — Belief dataclass + Dimension enum (frozen)
- `brain/src/noesis_brain/iris/config.py` — All config constants (locked)
- `brain/src/noesis_brain/iris/store.py` — IrisStore (append-only discipline)
- `brain/src/noesis_brain/iris/elicit.py` — IrisRuntime.elicit() + ElicitResult
- `brain/src/noesis_brain/iris/integration.py` — context_for(), predict_vote()
- `brain/src/noesis_brain/iris/priors.py` — seed_priors() (relationship-graph prior seeding)
- `brain/src/noesis_brain/rpc/handler.py` — Current _iris_runtime wiring (seed_priors only)

### Grid Patterns to Clone
- `grid/src/ananke/append-drive-crossed.ts` — 3-keys-not-5 sole-producer pattern (D-17-07)
- `grid/src/integration/nous-runner.ts` case 'drive_crossed' — NousRunner case pattern (D-17-09)
- `grid/src/audit/broadcast-allowlist.ts` — Allowlist + FORBIDDEN_KEY_PATTERN (D-17-01, D-17-17)
- `grid/src/governance/appendProposalOpened.ts` — Closed-tuple sole-producer boilerplate

### Protocol / Bridge
- `protocol/src/noesis/bridge/types.ts` — BrainAction union to extend (D-17-10)
- `brain/src/noesis_brain/rpc/types.py` — ActionType enum to extend (D-17-06)

### Prior Context (established invariants)
- `.planning/phases/10a-ananke-drives-inner-life-part-1/10a-CONTEXT.md` — 3-keys-not-5 invariant, drive_crossed pattern
- `.planning/phases/11-mesh-whisper/11-CONTEXT.md` — Three-tier privacy grep gate, FORBIDDEN_KEY_PATTERN precedent
- `.planning/phases/12-governance-collective-law/12-CONTEXT.md` — Closed-tuple payload + drift detector pattern

### Phase Roadmap
- `.planning/ROADMAP.md` §"Phase 17: Iris (Theory of Mind)" — Goal, Success Criteria, Allowlist additions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `IrisRuntime` (elicit.py): fully implemented — planner wires it into handler, not re-implements it
- `IrisStore` (store.py): SQLite WAL + FTS5, append-only — same discipline as Phase 16 LtmStore
- `seed_priors()` (priors.py): already called in handler.py on_tick — no new wiring needed for priors
- `context_for()` (integration.py): pure read function — planner adds prompt injection call site only
- `appendAnankeDriveCrossed` pattern: exact template for all 4 appendIris* emitters

### Established Patterns
- **3-keys-not-5**: Grid injects nous_did + tick; Brain sends 1-3 metadata keys only
- **Sole-producer boundary**: one file per event type calls `chain.append()`
- **Closed-tuple payload**: `Object.keys(payload).sort()` strict equality assertion in every emitter
- **Optional-dep injection**: `_iris_runtime: IrisRuntime | None = None` already in handler — same init pattern as Phase 15 AAULearner
- **Append-only beliefs**: superseded_by FK chain; NEVER delete rows (mirrors Phase 16 LtmStore)
- **Wall-clock free**: tick from caller; NEVER datetime/time.time/random/uuid in iris/ modules

### Integration Points
- `grid/src/integration/nous-runner.ts` executeActions switch: add 4 cases after `case 'vote_reveal'`
- `brain/src/noesis_brain/rpc/handler.py` on_tick(): add elicit() call after seed_priors(), add context_for() call in prompt builder
- `brain/src/noesis_brain/rpc/types.py` ActionType: add 4 new members after existing governance actions
- `grid/src/audit/broadcast-allowlist.ts`: bump allowlist 32→36 + extend FORBIDDEN_KEY_PATTERN

</code_context>

<specifics>
## Specific Requirements

- **Wall-clock free invariant** — grep gate must cover ALL of `brain/src/noesis_brain/iris/` and
  `grid/src/iris/`: forbid `datetime`, `time.time`, `random.random`, `uuid.uuid4`, `os.urandom`.
  Mirrors Phase 10a T-09-03 and Phase 10b T-09-04 gates exactly.

- **Content never crosses wire** — ALL 4 iris.* audit payloads carry only hashes/counts.
  Privacy matrix must include `belief_content`, `content`, `prose`, `target_content`,
  `dimension_text`, `emotion_text`, `iris_content`, `belief_prose` as forbidden keys.
  Three-tier grep: Grid emitter → Brain wire → Dashboard render.

- **Cooldown enforcement** — IRIS_ELICIT_COOLDOWN=20 ticks per (nous_did, target_did) pair.
  Test: 50 ticks of dialogue with same peer → exactly ceil(50/20) = 3 elicit() calls max.

- **Contradiction threshold** — IRIS_CONTRADICTION_THRESHOLD=0.3. Test: updating same-dimension
  belief with near-identical content does NOT trigger iris.contradiction_detected (delta < 0.3).

- **Append-only** — IrisStore.add_belief() NEVER deletes rows; eviction sets superseded_by FK.
  Test: 20 beliefs for same (target_did, dimension) → exactly 10 active (IRIS_BELIEFS_CAP=10),
  10 with superseded_by set, total row count = 20.

- **Zero-diff invariant** — 100-tick sim with Iris enabled + disabled produces chain head
  byte-identical modulo exactly the iris.* entries (same discipline as Phase 10a T-09-01 gate).

</specifics>

<deferred>
## Deferred Ideas

- **Second-order ToM** — "what X believes Y believes about Z" — deferred to v2.4 per types.py comment
- **Cross-Nous belief sharing** — adversarial surface; deferred post-v2.3
- **Belief influence on governance voting** — predict_vote() exists but not wired to Phase 12 balloting; deferred
- **Thymos emotion-label integration** — Iris models peer emotions; Thymos is own emotions; integration deferred to v2.4
- **ToM Inspector badge** — event-count display on Dashboard Inspector; deferred to future phase

</deferred>

---

*Phase: 17-iris-theory-of-mind*
*Context gathered: 2026-05-15*
