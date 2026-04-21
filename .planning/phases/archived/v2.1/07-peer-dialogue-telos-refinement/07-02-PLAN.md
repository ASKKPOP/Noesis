---
phase: 07-peer-dialogue-telos-refinement
plan: 02
type: execute
wave: 2
depends_on: [01]
files_modified:
  - brain/src/noesis_brain/rpc/types.py
  - brain/src/noesis_brain/rpc/handler.py
  - brain/tests/unit/test_telos_refined_action.py
  - brain/tests/unit/test_dialogue_context_consumption.py
  - brain/tests/fixtures/dialogue_contexts.py
autonomous: true
requirements: [DIALOG-02]
must_haves:
  truths:
    - "Brain's ActionType enum exposes TELOS_REFINED as a Nous-initiated action (distinct from operator.force_telos RPC)"
    - "Brain's on_tick consumes params['dialogue_context'] when present and MAY emit a telos_refined action (opt-in, never coerced)"
    - "Brain computes before_goal_hash BEFORE mutating self.telos and after_goal_hash AFTER mutating, via the SOLE authority compute_active_telos_hash"
    - "Brain never places new_goals plaintext in the telos_refined action metadata — only {before_goal_hash, after_goal_hash, triggered_by_dialogue_id}"
    - "When before_goal_hash == after_goal_hash (no-op refinement), Brain drops the action silently — no audit emit"
    - "dialogue_context payload is truncation-respecting: ≤5 utterances; each text ≤200 chars (the aggregator upstream already truncates; Brain does not re-inflate)"
  artifacts:
    - path: "brain/src/noesis_brain/rpc/types.py"
      provides: "ActionType.TELOS_REFINED = 'telos_refined' enum member"
      contains: "TELOS_REFINED"
    - path: "brain/src/noesis_brain/rpc/handler.py"
      provides: "_build_refined_telos helper + on_tick dialogue_context consumption branch"
      contains: "_build_refined_telos"
    - path: "brain/tests/fixtures/dialogue_contexts.py"
      provides: "reusable DialogueContext sample payloads for Brain-side tests"
      contains: "make_dialogue_context"
    - path: "brain/tests/unit/test_telos_refined_action.py"
      provides: "closed 4-key metadata tuple + hash-only invariant assertions"
      contains: "assert set(md.keys())"
    - path: "brain/tests/unit/test_dialogue_context_consumption.py"
      provides: "on_tick branch invocation + no-op-refinement silence + truncation respect"
      contains: "dialogue_context"
  key_links:
    - from: "brain/src/noesis_brain/rpc/handler.py:_build_refined_telos"
      to: "brain/src/noesis_brain/telos/hashing.py:compute_active_telos_hash"
      via: "direct call before/after TelosManager mutation"
      pattern: "compute_active_telos_hash\\(self\\.telos\\.all_goals\\(\\)\\)"
    - from: "brain/src/noesis_brain/rpc/handler.py:on_tick"
      to: "params['dialogue_context']"
      via: "params.get('dialogue_context', []) iteration inside tick body"
      pattern: "params\\.get\\(['\"]dialogue_context['\"]"
    - from: "brain/src/noesis_brain/rpc/handler.py:_build_refined_telos"
      to: "Action(action_type=ActionType.TELOS_REFINED, metadata={...})"
      via: "return value wrapped by on_tick into action list"
      pattern: "ActionType\\.TELOS_REFINED"
---

<objective>
Wire the Brain side of DIALOG-02: extend `ActionType` with `TELOS_REFINED`, add `_build_refined_telos` helper that mirrors the Phase 6 `force_telos` hash-before/mutate/hash-after pattern (handler.py:376-413), extend `on_tick` to consume the new `dialogue_context` RPC parameter, and ship Brain-side unit tests covering the closed 4-key metadata tuple + hash-only invariant + opt-in branch behavior.

Purpose: Brain is the sovereign owner of the "should I refine my goals after this dialogue?" decision (PHILOSOPHY §1, CONTEXT D-15). The Grid aggregates dialogue context upstream (Plan 01); the Brain decides, rebuilds, hashes, and emits. No plaintext (`new_goals`) crosses the RPC boundary — only the two 64-hex Telos hashes and the 16-hex `dialogue_id` reference (D-18, D-14).

Output: Modified Python types + handler, new dialogue-context fixtures module, two new pytest unit files. Ready for Plan 03 (which adds the Grid-side `case 'telos_refined'` branch in nous-runner.ts and the producer-boundary helper).
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
@brain/src/noesis_brain/rpc/types.py
@brain/src/noesis_brain/rpc/handler.py
@brain/src/noesis_brain/telos/hashing.py
@brain/src/noesis_brain/telos/manager.py

<interfaces>
<!-- Contracts this plan depends on or produces. Executor uses these directly. -->

From brain/src/noesis_brain/rpc/types.py (CURRENT — Phase 6):
```python
class ActionType(str, Enum):
    SPEAK = "speak"
    DIRECT_MESSAGE = "direct_message"
    MOVE = "move"
    TRADE_REQUEST = "trade_request"
    NOOP = "noop"

@dataclass
class Action:
    action_type: ActionType
    channel: str = ""
    text: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "action_type": self.action_type.value,
            "channel": self.channel,
            "text": self.text,
            "metadata": self.metadata,
        }
```

From brain/src/noesis_brain/telos/hashing.py (PINNED — Phase 6 SOLE hash authority):
```python
def compute_active_telos_hash(goals: list[Goal]) -> str:
    """Deterministic 64-hex sha256 over canonicalised active-goal descriptions.

    Same authority called from handler.force_telos BEFORE and AFTER the
    TelosManager rebuild (handler.py:400, 408). Reused identically here.
    """
```

From brain/src/noesis_brain/rpc/handler.py:376-413 (ANALOG — force_telos hash-only pattern):
```python
async def force_telos(self, params: dict[str, Any]) -> dict[str, Any]:
    new_telos_raw = params.get("new_telos", {})
    if not isinstance(new_telos_raw, dict):
        new_telos_raw = {}
    telos_hash_before = compute_active_telos_hash(self.telos.all_goals())
    rebuilt = TelosManager.from_yaml(new_telos_raw)
    self.telos = rebuilt
    telos_hash_after = compute_active_telos_hash(self.telos.all_goals())
    return {"telos_hash_before": telos_hash_before, "telos_hash_after": telos_hash_after}
```

From brain/src/noesis_brain/rpc/handler.py:112-129 (CURRENT on_tick — Phase 6 minimal stub):
```python
async def on_tick(self, params: dict[str, Any]) -> list[dict[str, Any]]:
    """Handle world clock tick — opportunity for autonomous action.
    params: tick: Current tick number, epoch: Current epoch
    """
    self.thymos.decay()
    top_goals = self.telos.top_priority(1)
    if not top_goals:
        return [Action(action_type=ActionType.NOOP).to_dict()]
    return [Action(action_type=ActionType.NOOP).to_dict()]
```

NEW — DialogueContext shape on the Python side (matches Grid D-09, but Python keeps
it as a plain dict from params since the RPC boundary is JSON):
```python
# Expected shape inside params["dialogue_context"] (list-wrapped, may be empty/None):
# {
#     "dialogue_id": str,              # 16-hex (sha256(...)[:16])
#     "counterparty_did": str,         # the OTHER nous's DID
#     "channel": str,
#     "exchange_count": int,           # >= minExchanges (default 2)
#     "window_start_tick": int,
#     "window_end_tick": int,
#     "utterances": list[dict],        # <= 5 entries, each {tick, speaker_did, speaker_name, text}
# }
# NB: grid upstream (Plan 01 DialogueAggregator) caps utterances to 5 and text to 200 chars.
```

NEW — Action metadata contract Brain emits for telos_refined (closed 4-key tuple;
`did` is injected by the Grid-side nous-runner in Plan 03, NOT by Brain):
```python
# Brain returns metadata with THREE keys:
#   {"before_goal_hash", "after_goal_hash", "triggered_by_dialogue_id"}
# Grid-side nous-runner adds `did` when calling appendTelosRefined (Plan 03).
# The on-wire audit payload has FOUR keys total per D-20.
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend ActionType + add _build_refined_telos + on_tick dialogue_context branch</name>
  <files>brain/src/noesis_brain/rpc/types.py, brain/src/noesis_brain/rpc/handler.py</files>
  <read_first>
    - brain/src/noesis_brain/rpc/types.py (full — 103 lines; current ActionType enum at lines 10-17, Action dataclass at lines 87-102)
    - brain/src/noesis_brain/rpc/handler.py:112-129 (current on_tick stub — the two-line tick body that returns NOOP)
    - brain/src/noesis_brain/rpc/handler.py:376-413 (force_telos hash-only pattern — CLONE this hash-before/mutate/hash-after shape)
    - brain/src/noesis_brain/telos/hashing.py (compute_active_telos_hash — SOLE hash authority, already imported at handler.py:14)
    - brain/src/noesis_brain/telos/manager.py (TelosManager.from_yaml / .all_goals() / .active_goals() — used by force_telos and reused here)
    - 07-CONTEXT.md D-13, D-14, D-15, D-18, D-20 (metadata contract, opt-in rule, hash-only boundary)
    - 07-PATTERNS.md §handler.py (the `_build_refined_telos` clone-of-force_telos pattern; verbatim shape to copy)
  </read_first>
  <behavior>
    - Test 1 (types.py): `ActionType.TELOS_REFINED.value == "telos_refined"` and it is a member of the enum.
    - Test 2 (types.py): existing enum members (SPEAK, DIRECT_MESSAGE, MOVE, TRADE_REQUEST, NOOP) all still present with identical string values (additive-only widening — Phase 6 test_get_state_widening pattern).
    - Test 3 (handler): calling `on_tick({"tick": 5, "epoch": 1})` with NO dialogue_context returns the pre-existing NOOP shape (backward compatible — Phase 6 additive-widening rule).
    - Test 4 (handler): calling `on_tick({"tick": 5, "epoch": 1, "dialogue_context": []})` (empty list) returns NOOP — no dialogue means no refinement attempt.
    - Test 5 (handler): calling `on_tick({..., "dialogue_context": [ctx]})` with a well-formed ctx invokes `_build_refined_telos` exactly once per ctx entry. When `_build_refined_telos` returns a non-None Action, that action appears in the returned list; when it returns None (no-op), the action list is unaffected.
    - Test 6 (_build_refined_telos contract): the returned Action (when non-None) has `action_type == ActionType.TELOS_REFINED`, `channel == ""`, `text == ""`, and `metadata` is EXACTLY the three-key dict `{"before_goal_hash", "after_goal_hash", "triggered_by_dialogue_id"}` — no `new_goals`, no `goals`, no `telos_yaml`, no plaintext whatsoever.
    - Test 7 (hash-before-then-mutate): in `_build_refined_telos`, `compute_active_telos_hash` is called BEFORE `self.telos = rebuilt` and AGAIN AFTER. Both hashes are 64-hex. Assertion via a spy / side-effect ordering check.
    - Test 8 (no-op silence): if the refinement would produce `before_goal_hash == after_goal_hash` (rebuild produces identical canonical hash), `_build_refined_telos` returns None — no action emitted.
  </behavior>
  <action>
    **Step 1 — types.py extension (per D-13):**
    Open `brain/src/noesis_brain/rpc/types.py`. Inside the `ActionType(str, Enum)` class body (currently lines 10-17), append ONE line between `TRADE_REQUEST = "trade_request"` and `NOOP = "noop"`:
    ```python
        TELOS_REFINED = "telos_refined"  # Phase 7 DIALOG-02 — Nous-initiated refinement after peer dialogue
    ```
    Keep the insertion order deterministic: put `TELOS_REFINED` BEFORE `NOOP` so `NOOP` stays last (matches human-readable "action continuum: action types first, no-op sentinel last"). Do not reorder existing members. Do not renumber anything — `str` enums use string values, not integers.

    **Step 2 — handler.py: add `_build_refined_telos` helper (per D-14, D-18, D-20):**
    Open `brain/src/noesis_brain/rpc/handler.py`. Add the helper as a sibling method to `force_telos` (so logically adjacent to the sole other hashing-discipline method). Place it AFTER `force_telos` (after line 413) so the file reads: force_telos → _build_refined_telos → (existing _psyche_snapshot / _thymos_snapshot / _telos_snapshot / _normalise_memory_entry helpers).

    Signature and body (clone force_telos's hash-before/mutate/hash-after structure VERBATIM; diverge only on (a) input source = dialogue_context not params["new_telos"], (b) return type = Optional[Action] not dict, (c) no-op silence):
    ```python
    def _build_refined_telos(self, ctx: dict[str, Any]) -> Action | None:
        """Brain decides whether to refine Telos after a peer dialogue.

        Mirrors the hash-before/mutate/hash-after shape of ``force_telos`` (the
        Phase 6 SOLE-hash-authority pattern). Returns an ActionType.TELOS_REFINED
        Action when the refinement produces a non-identity hash change, else None.

        Per D-18 the returned metadata carries ONLY hashes + dialogue_id —
        never goal plaintext. Per D-15 the decision is Brain-opt-in: this
        method MAY return None even when ctx is well-formed.

        ctx: A single dialogue_context dict from the incoming tick params —
             keys include dialogue_id (16-hex), counterparty_did, channel,
             utterances (list, <=5 entries, each text <=200 chars).
        """
        dialogue_id = ctx.get("dialogue_id", "")
        if not isinstance(dialogue_id, str) or len(dialogue_id) != 16:
            # Malformed ctx — log and drop. No audit emit (D-16 mirror on Brain side).
            log.warning("telos_refined: dropping ctx with bad dialogue_id %r", dialogue_id)
            return None

        # Heuristic: decide whether THIS dialogue suggests refinement.
        # v2.1 minimal: proceed if any utterance text substring-matches any
        # active goal description (lowercased). Future phases replace this
        # with a persona-contingent LLM prompt — kept minimal here per
        # CONTEXT "Claude's Discretion" guidance.
        proposed = self._dialogue_driven_goal_set(ctx)
        if proposed is None:
            return None  # Brain opted out — no audit emit (D-15).

        # SOLE hash authority, called BEFORE mutation.
        telos_hash_before = compute_active_telos_hash(self.telos.all_goals())

        # Atomic swap — build first, swap only on success (clone force_telos:404-406).
        rebuilt = TelosManager.from_yaml(proposed)
        self.telos = rebuilt

        # SOLE hash authority, called AFTER mutation.
        telos_hash_after = compute_active_telos_hash(self.telos.all_goals())

        if telos_hash_before == telos_hash_after:
            # No-op refinement — silence per D-22 / silent-no-op invariant.
            return None

        return Action(
            action_type=ActionType.TELOS_REFINED,
            channel="",
            text="",
            metadata={
                "before_goal_hash": telos_hash_before,
                "after_goal_hash": telos_hash_after,
                "triggered_by_dialogue_id": dialogue_id,
            },
        )

    def _dialogue_driven_goal_set(self, ctx: dict[str, Any]) -> dict[str, list[str]] | None:
        """Minimal v2.1 heuristic: if any utterance substring-matches an active
        goal description (case-insensitive), propose a reprioritised goal set.

        Returns a TelosManager.from_yaml-compatible dict, or None if no
        refinement is warranted. Future phases replace this with an LLM call.

        Kept deterministic + synchronous so tests can pin behavior without
        mocking the LLM. The LLM prompt path is tracked as a deferred idea.
        """
        utterances = ctx.get("utterances") or []
        if not isinstance(utterances, list) or not utterances:
            return None
        active = self.telos.active_goals()
        if not active:
            return None
        # Lowercased utterance text pool (truncation-respecting: Grid already
        # capped to 200 chars; we do not re-inflate).
        texts = []
        for u in utterances:
            if isinstance(u, dict):
                t = u.get("text")
                if isinstance(t, str):
                    texts.append(t.lower())
        pool = " ".join(texts)
        if not pool:
            return None
        # Promote goals whose description is mentioned; demote the rest.
        promoted: list[str] = []
        demoted: list[str] = []
        for g in active:
            if g.description.lower() in pool:
                promoted.append(g.description)
            else:
                demoted.append(g.description)
        if not promoted:
            return None  # No goal mentioned — dialogue not goal-relevant.
        # Return a from_yaml-compatible shape. Keep all goals; priority shifts
        # via bucket assignment (short_term gets promoted, medium_term gets demoted).
        return {
            "short_term": promoted,
            "medium_term": demoted,
            "long_term": [],
        }
    ```

    Import note: `Action` and `ActionType` are already imported at handler.py:18; `compute_active_telos_hash` at line 14; `TelosManager` at line 15. No new imports needed EXCEPT add `Action | None` return type — the file already uses `from __future__ import annotations` (line 3) so PEP 604 union syntax works without `Optional` import.

    **Step 3 — handler.py: extend `on_tick` to consume dialogue_context (per D-10, D-11, D-15):**
    Replace the current 8-line `on_tick` body (lines 112-129) with an additive-widening version that:
    1. Still decays emotions (preserves Phase 6 behavior).
    2. Reads `params.get("dialogue_context")` — MAY be absent (None), empty list, or list of ctx dicts.
    3. For each ctx in the list, calls `_build_refined_telos(ctx)`; collects non-None returns.
    4. If any TELOS_REFINED actions were produced, returns them (a single tick may produce multiple refinements if the Grid delivers multiple dialogues in the same tick — rare but possible per D-11).
    5. Otherwise falls back to the pre-existing NOOP path (strict backward compatibility — Phase 6 test_get_state_widening contract).

    New body:
    ```python
    async def on_tick(self, params: dict[str, Any]) -> list[dict[str, Any]]:
        """Handle world clock tick — opportunity for autonomous action.

        params:
            tick: Current tick number
            epoch: Current epoch
            dialogue_context: (Phase 7, optional) list of DialogueContext dicts
                aggregated by the Grid from recent nous.spoke events. Brain
                MAY respond with ActionType.TELOS_REFINED actions (opt-in
                per D-15). Absence/empty list preserves Phase 6 behavior.
        """
        # Decay emotions each tick (Phase 6 behavior — preserved exactly).
        self.thymos.decay()

        # Phase 7 additive widening (D-10): consume optional dialogue_context.
        # Absent or empty → no refinement path attempted, falls through to NOOP.
        dialogue_ctxs = params.get("dialogue_context")
        actions: list[dict[str, Any]] = []
        if isinstance(dialogue_ctxs, list):
            for ctx in dialogue_ctxs:
                if not isinstance(ctx, dict):
                    continue
                refined = self._build_refined_telos(ctx)
                if refined is not None:
                    actions.append(refined.to_dict())

        if actions:
            return actions

        # Pre-Phase-7 NOOP fallback preserved verbatim for additive-widening
        # compatibility (matches test_get_state_widening strict-superset rule).
        top_goals = self.telos.top_priority(1)
        if not top_goals:
            return [Action(action_type=ActionType.NOOP).to_dict()]
        return [Action(action_type=ActionType.NOOP).to_dict()]
    ```

    **Docstring discipline:** Both `_build_refined_telos` and the new `on_tick` body must reference the D-IDs they implement (D-13, D-14, D-15, D-18, D-20) as comments. This traces decision provenance at read time.

    **Do NOT modify:**
    - `force_telos` (Phase 6 frozen contract).
    - `Action` dataclass (backward compatibility).
    - `on_message` or `on_event` (out of scope).
    - `get_state` or its `_*_snapshot` helpers (Phase 6 test_get_state_widening would fail).
    - Any LLM integration — v2.1 heuristic is deterministic/substring-based per CONTEXT "Claude's Discretion."
  </action>
  <verify>
    <automated>cd brain &amp;&amp; uv run pytest tests/unit/test_types.py tests/unit/test_telos_refined_action.py tests/unit/test_dialogue_context_consumption.py -x -q</automated>
  </verify>
  <done>
    - `grep "TELOS_REFINED" brain/src/noesis_brain/rpc/types.py` returns a match.
    - `grep "_build_refined_telos" brain/src/noesis_brain/rpc/handler.py` returns matches for both definition and at least one call site inside `on_tick`.
    - `grep "dialogue_context" brain/src/noesis_brain/rpc/handler.py` returns a match inside `on_tick`.
    - `cd brain && uv run python -c "from noesis_brain.rpc.types import ActionType; assert ActionType.TELOS_REFINED.value == 'telos_refined'; print('OK')"` prints "OK".
    - `cd brain && uv run mypy src/noesis_brain/rpc/handler.py` passes (or preserves the pre-existing mypy clean state — do not regress).
    - `cd brain && uv run pytest tests/ -x -q` passes (full Brain suite — catches any accidental regression in get_state / force_telos / on_message).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Brain-side test coverage — fixtures + action contract + tick branch invocation</name>
  <files>brain/tests/fixtures/dialogue_contexts.py, brain/tests/unit/test_telos_refined_action.py, brain/tests/unit/test_dialogue_context_consumption.py</files>
  <read_first>
    - brain/tests/unit/test_handler_agency.py (full — the Phase 6 pattern for handler-level tests: fixture factories, _make_handler(), assertion style)
    - brain/tests/unit/test_force_telos.py (if present — the Phase 6 hash-only assertion template; look for `compute_active_telos_hash` invocation patterns in tests)
    - brain/tests/conftest.py (for shared fixtures, pytest-asyncio mode, handler construction helpers)
    - 07-PATTERNS.md §brain/test/test_telos_refined_action.py (verbatim shape to clone — closed 4-key tuple assertion)
    - 07-PATTERNS.md §brain/test/test_dialogue_context_consumption.py (verbatim shape to clone — branch invocation + LLM-free path)
    - 07-VALIDATION.md Wave 0 Brain section (the three files this task must produce)
  </read_first>
  <behavior>
    - **Fixtures module** must export `make_dialogue_context(**overrides)` returning a well-formed dict with all required keys (dialogue_id=16-hex, counterparty_did="did:noesis:b", channel="agora", exchange_count=2, window_start_tick, window_end_tick, utterances=[{tick, speaker_did, speaker_name, text}, ...]). Overrides replace individual keys. Defaults produce a context whose utterances substring-match a test goal so the heuristic fires.
    - **test_telos_refined_action.py** must cover:
      - The happy path: well-formed ctx + matching goal → returned action has `action_type == ActionType.TELOS_REFINED`, `channel == ""`, `text == ""`, metadata key set is EXACTLY `{"before_goal_hash", "after_goal_hash", "triggered_by_dialogue_id"}` (no extras, no missing), both hashes are 64-hex, dialogue_id is the same 16-hex value that was passed in.
      - Hash-before-then-hash-after ordering: the two hashes differ when refinement actually changed the goal set (use a fixture where promoting/demoting changes `active_goals()` order so `compute_active_telos_hash` differs).
      - No-op silence: a ctx that substring-matches NO goals → `_build_refined_telos` returns None and `on_tick` returns the NOOP fallback, NOT a TELOS_REFINED action.
      - Plaintext-never-leaks invariant: assert each of `{"new_goals", "goals", "telos_yaml", "prompt", "response", "wiki", "reflection", "thought", "emotion_delta"}` is NOT a key in `metadata` — cloning the 07-PATTERNS.md §brain/test/test_telos_refined_action.py forbidden-key check.
      - Malformed dialogue_id guards: ctx with `dialogue_id = ""` / `"abc"` / non-string → returns None (drops silently).
    - **test_dialogue_context_consumption.py** must cover:
      - Pre-Phase-7 compatibility: `on_tick({"tick": 1, "epoch": 1})` (no dialogue_context key) returns a NOOP-shaped list — same length and same action_type as before Phase 7.
      - Empty dialogue_context list: `on_tick({..., "dialogue_context": []})` returns NOOP.
      - Non-list dialogue_context: `on_tick({..., "dialogue_context": "not a list"})` does NOT crash — falls through to NOOP.
      - Multiple contexts in one tick (D-11): a list of 2 well-formed contexts both targeting the same goal set → on_tick returns 1 or 2 TELOS_REFINED actions depending on whether the second refinement is a no-op (the second call's before == first call's after, so the second typically becomes a no-op). Assert behavior is deterministic and ≤2 actions.
      - Utterance truncation respected: construct a ctx with utterance `text` at exactly 200 chars and 201 chars; assert handler does not crash (it should not inflate beyond what Grid delivered).
    - All Brain tests use pytest-asyncio (the existing project convention; on_tick is async).
  </behavior>
  <action>
    **Step 1 — Create fixtures module `brain/tests/fixtures/dialogue_contexts.py`:**
    ```python
    """Shared dialogue_context fixture factories for Phase 7 Brain tests.

    Used by test_telos_refined_action.py and test_dialogue_context_consumption.py.
    Keep these deterministic so D-23 zero-diff invariant can lean on them.
    """
    from __future__ import annotations

    from typing import Any


    def make_dialogue_context(
        *,
        dialogue_id: str = "a1b2c3d4e5f60718",  # 16-hex
        counterparty_did: str = "did:noesis:beta",
        channel: str = "agora",
        exchange_count: int = 2,
        window_start_tick: int = 10,
        window_end_tick: int = 15,
        utterances: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """Produce a well-formed dialogue_context dict for Brain on_tick tests.

        Default utterances substring-match the goal 'Survive the day' so the
        minimal heuristic in _build_refined_telos fires. Override `utterances`
        to test the silent/no-match branch.
        """
        if utterances is None:
            utterances = [
                {
                    "tick": 10,
                    "speaker_did": "did:noesis:alpha",
                    "speaker_name": "Alpha",
                    "text": "we should focus on how to survive the day together",
                },
                {
                    "tick": 12,
                    "speaker_did": "did:noesis:beta",
                    "speaker_name": "Beta",
                    "text": "agreed — survive the day is the priority",
                },
            ]
        return {
            "dialogue_id": dialogue_id,
            "counterparty_did": counterparty_did,
            "channel": channel,
            "exchange_count": exchange_count,
            "window_start_tick": window_start_tick,
            "window_end_tick": window_end_tick,
            "utterances": utterances,
        }


    def make_dialogue_context_no_match() -> dict[str, Any]:
        """Dialogue on an unrelated topic — should NOT trigger refinement."""
        return make_dialogue_context(
            utterances=[
                {"tick": 10, "speaker_did": "did:noesis:alpha", "speaker_name": "Alpha",
                 "text": "the weather is nice today"},
                {"tick": 12, "speaker_did": "did:noesis:beta", "speaker_name": "Beta",
                 "text": "yes very mild and sunny"},
            ],
        )
    ```

    Create `brain/tests/fixtures/__init__.py` if it does not already exist (empty `"""Test fixtures package."""` docstring-only file is fine).

    **Step 2 — Create `brain/tests/unit/test_telos_refined_action.py`:**
    Clone the test_handler_agency.py structure (same `_make_handler()` helper pattern). Pytest-asyncio mode.
    ```python
    """DIALOG-02: Brain-side telos_refined action contract tests.

    Covers 07-CONTEXT.md D-13 (ActionType extension), D-14 (metadata contract),
    D-18 (no plaintext crosses boundary), D-20 (closed 4-key tuple — minus
    `did` which grid injects). Mirrors the Phase 6 force_telos hash-only
    pattern (handler.py:376).
    """
    from __future__ import annotations

    import pytest

    from noesis_brain.rpc.handler import BrainHandler
    from noesis_brain.rpc.types import Action, ActionType
    from noesis_brain.telos.manager import TelosManager

    from tests.fixtures.dialogue_contexts import (
        make_dialogue_context,
        make_dialogue_context_no_match,
    )

    # Canonical forbidden-key set per D-18 — Brain-side privacy gate.
    FORBIDDEN_METADATA_KEYS = frozenset({
        "new_goals", "goals", "telos_yaml", "prompt", "response",
        "wiki", "reflection", "thought", "emotion_delta",
    })

    EXPECTED_METADATA_KEYS = frozenset({
        "before_goal_hash", "after_goal_hash", "triggered_by_dialogue_id",
    })


    def _make_handler(goal_descriptions: list[str] | None = None) -> BrainHandler:
        """Build a BrainHandler with controllable Telos for tests.

        Follows the existing test_handler_agency.py fixture pattern — minimal
        dependencies, no LLM wiring (the heuristic is deterministic).
        """
        # Delegate to the project's existing helper if one exists in conftest;
        # otherwise construct here with a TelosManager and stubs.
        # [Executor: check brain/tests/conftest.py for an existing `make_handler`
        # factory and reuse it; only fall through to direct construction if none.]
        from tests.conftest import make_handler  # type: ignore[attr-defined]
        handler = make_handler()
        if goal_descriptions:
            handler.telos = TelosManager.from_yaml({
                "short_term": goal_descriptions,
                "medium_term": [],
                "long_term": [],
            })
        return handler


    class TestTelosRefinedActionContract:
        @pytest.mark.asyncio
        async def test_happy_path_returns_telos_refined_with_closed_tuple(self):
            handler = _make_handler(goal_descriptions=["Survive the day"])
            ctx = make_dialogue_context()

            response = await handler.on_tick({"tick": 20, "epoch": 1, "dialogue_context": [ctx]})

            refined = [a for a in response if a["action_type"] == "telos_refined"]
            assert len(refined) == 1, f"expected exactly one telos_refined action, got {response}"
            md = refined[0]["metadata"]
            assert set(md.keys()) == set(EXPECTED_METADATA_KEYS), (
                f"metadata must be the closed 3-key tuple {EXPECTED_METADATA_KEYS}, "
                f"got keys={set(md.keys())}"
            )
            # 64-hex hashes per D-14
            assert isinstance(md["before_goal_hash"], str) and len(md["before_goal_hash"]) == 64
            assert isinstance(md["after_goal_hash"], str) and len(md["after_goal_hash"]) == 64
            # 16-hex dialogue_id echoed through unchanged per D-14
            assert md["triggered_by_dialogue_id"] == ctx["dialogue_id"]
            assert refined[0]["channel"] == ""
            assert refined[0]["text"] == ""

        @pytest.mark.asyncio
        async def test_no_forbidden_plaintext_keys_in_metadata(self):
            """D-18 Brain-side privacy gate — plaintext never crosses the boundary."""
            handler = _make_handler(goal_descriptions=["Survive the day"])
            ctx = make_dialogue_context()
            response = await handler.on_tick({"tick": 20, "epoch": 1, "dialogue_context": [ctx]})
            refined = [a for a in response if a["action_type"] == "telos_refined"]
            assert len(refined) == 1
            md = refined[0]["metadata"]
            leaked = FORBIDDEN_METADATA_KEYS & set(md.keys())
            assert not leaked, f"Brain leaked plaintext keys across boundary: {leaked}"

        @pytest.mark.asyncio
        async def test_no_op_refinement_returns_no_action(self):
            """D-22 silent-no-op: if before_hash == after_hash, no action emitted."""
            handler = _make_handler(goal_descriptions=["Survive the day"])
            # Dialogue mentions no active goal → heuristic returns None →
            # no hash computation, no action.
            ctx = make_dialogue_context_no_match()
            response = await handler.on_tick({"tick": 20, "epoch": 1, "dialogue_context": [ctx]})
            refined = [a for a in response if a["action_type"] == "telos_refined"]
            assert refined == [], "expected no telos_refined action for non-matching dialogue"

        @pytest.mark.asyncio
        @pytest.mark.parametrize("bad_dialogue_id", ["", "abc", "A" * 16, 12345, None])
        async def test_malformed_dialogue_id_drops_silently(self, bad_dialogue_id):
            """D-16 mirror on Brain side: malformed dialogue_id → drop, no action."""
            handler = _make_handler(goal_descriptions=["Survive the day"])
            ctx = make_dialogue_context(dialogue_id=bad_dialogue_id if isinstance(bad_dialogue_id, str) else "")
            if not isinstance(bad_dialogue_id, str):
                # simulate non-string type directly
                ctx["dialogue_id"] = bad_dialogue_id
            response = await handler.on_tick({"tick": 20, "epoch": 1, "dialogue_context": [ctx]})
            refined = [a for a in response if a["action_type"] == "telos_refined"]
            assert refined == [], f"expected drop for bad dialogue_id={bad_dialogue_id!r}"

        @pytest.mark.asyncio
        async def test_hashes_computed_before_and_after_mutation(self):
            """D-14: compute_active_telos_hash is SOLE authority, called BEFORE
            then AFTER self.telos swap. Assert the two hashes differ when
            refinement genuinely changes the canonical goal set."""
            handler = _make_handler(goal_descriptions=["Survive the day", "Make allies"])
            ctx = make_dialogue_context()
            # capture pre-call hash independently
            from noesis_brain.telos.hashing import compute_active_telos_hash
            pre_hash = compute_active_telos_hash(handler.telos.all_goals())
            response = await handler.on_tick({"tick": 20, "epoch": 1, "dialogue_context": [ctx]})
            refined = [a for a in response if a["action_type"] == "telos_refined"]
            assert len(refined) == 1
            md = refined[0]["metadata"]
            assert md["before_goal_hash"] == pre_hash, "before_goal_hash must match pre-call canonical hash"
            post_hash = compute_active_telos_hash(handler.telos.all_goals())
            assert md["after_goal_hash"] == post_hash, "after_goal_hash must match post-mutation canonical hash"
            assert md["before_goal_hash"] != md["after_goal_hash"], (
                "refinement was supposed to change the canonical goal set — "
                "if these are equal, the heuristic produced a no-op and the "
                "action should not have been emitted."
            )
    ```

    **Step 3 — Create `brain/tests/unit/test_dialogue_context_consumption.py`:**
    ```python
    """DIALOG-02: Brain on_tick dialogue_context consumption branch tests.

    Covers 07-CONTEXT.md D-10 (additive widening), D-11 (per-participant delivery),
    D-15 (Brain opt-in). Verifies additive-widening compatibility — the Phase 6
    test_get_state_widening contract extends here.
    """
    from __future__ import annotations

    import pytest

    from tests.conftest import make_handler  # type: ignore[attr-defined]
    from tests.fixtures.dialogue_contexts import (
        make_dialogue_context,
        make_dialogue_context_no_match,
    )
    from noesis_brain.telos.manager import TelosManager


    @pytest.mark.asyncio
    async def test_on_tick_without_dialogue_context_preserves_pre_phase7_behavior():
        """Additive widening: absent dialogue_context → Phase 6 NOOP path unchanged."""
        handler = make_handler()
        response = await handler.on_tick({"tick": 1, "epoch": 1})
        assert isinstance(response, list) and len(response) == 1
        assert response[0]["action_type"] == "noop"


    @pytest.mark.asyncio
    async def test_on_tick_empty_dialogue_context_list_falls_through_to_noop():
        handler = make_handler()
        response = await handler.on_tick({"tick": 1, "epoch": 1, "dialogue_context": []})
        assert len(response) == 1 and response[0]["action_type"] == "noop"


    @pytest.mark.asyncio
    async def test_on_tick_non_list_dialogue_context_does_not_crash():
        """Defense-in-depth: a non-list dialogue_context (RPC misformat) drops to NOOP."""
        handler = make_handler()
        response = await handler.on_tick({"tick": 1, "epoch": 1, "dialogue_context": "not a list"})
        assert len(response) == 1 and response[0]["action_type"] == "noop"


    @pytest.mark.asyncio
    async def test_on_tick_dialogue_context_without_match_produces_noop():
        """Non-matching dialogue → heuristic returns None → NOOP fallback."""
        handler = make_handler()
        handler.telos = TelosManager.from_yaml({
            "short_term": ["Survive the day"],
            "medium_term": [], "long_term": [],
        })
        response = await handler.on_tick({
            "tick": 1, "epoch": 1,
            "dialogue_context": [make_dialogue_context_no_match()],
        })
        assert len(response) == 1 and response[0]["action_type"] == "noop"


    @pytest.mark.asyncio
    async def test_on_tick_matching_dialogue_produces_telos_refined():
        handler = make_handler()
        handler.telos = TelosManager.from_yaml({
            "short_term": ["Survive the day"],
            "medium_term": [], "long_term": [],
        })
        response = await handler.on_tick({
            "tick": 1, "epoch": 1,
            "dialogue_context": [make_dialogue_context()],
        })
        types = {a["action_type"] for a in response}
        assert "telos_refined" in types


    @pytest.mark.asyncio
    async def test_on_tick_multiple_contexts_are_all_evaluated():
        """D-11: a single tick may carry multiple dialogue_contexts; each is evaluated."""
        handler = make_handler()
        handler.telos = TelosManager.from_yaml({
            "short_term": ["Survive the day", "Make allies"],
            "medium_term": [], "long_term": [],
        })
        c1 = make_dialogue_context(dialogue_id="1111222233334444")
        c2 = make_dialogue_context_no_match()  # second context is a non-match
        c2["dialogue_id"] = "5555666677778888"
        response = await handler.on_tick({
            "tick": 1, "epoch": 1,
            "dialogue_context": [c1, c2],
        })
        # c1 produces refined; c2 is a no-match → no extra action.
        refined = [a for a in response if a["action_type"] == "telos_refined"]
        assert len(refined) == 1
        assert refined[0]["metadata"]["triggered_by_dialogue_id"] == "1111222233334444"


    @pytest.mark.asyncio
    async def test_on_tick_handles_utterance_at_boundary_length():
        """Grid upstream caps utterance text at 200 chars. Brain must not crash
        on boundary-length strings; does not re-inflate."""
        handler = make_handler()
        handler.telos = TelosManager.from_yaml({
            "short_term": ["Survive the day"],
            "medium_term": [], "long_term": [],
        })
        boundary = "survive the day " + ("x" * (200 - len("survive the day ")))
        ctx = make_dialogue_context(utterances=[
            {"tick": 1, "speaker_did": "did:noesis:a", "speaker_name": "A", "text": boundary[:200]},
            {"tick": 2, "speaker_did": "did:noesis:b", "speaker_name": "B", "text": boundary[:201]},
        ])
        response = await handler.on_tick({"tick": 1, "epoch": 1, "dialogue_context": [ctx]})
        assert isinstance(response, list)  # no crash; either refined or noop acceptable
    ```

    **Step 4 — If `brain/tests/conftest.py` lacks a `make_handler` factory**, add a minimal one (do not change any existing fixtures). Example body to append:
    ```python
    @pytest.fixture
    def make_handler():
        def _factory():
            from noesis_brain.psyche.types import Psyche, PersonalityProfile
            from noesis_brain.thymos.tracker import ThymosTracker
            from noesis_brain.telos.manager import TelosManager
            from noesis_brain.llm.fake import FakeLLMAdapter  # or existing test-LLM
            return BrainHandler(
                psyche=Psyche(name="Test", archetype="seeker", personality=PersonalityProfile.default()),
                thymos=ThymosTracker.default(),
                telos=TelosManager.from_yaml({"short_term": [], "medium_term": [], "long_term": []}),
                llm=FakeLLMAdapter(),
                did="did:noesis:test",
            )
        return _factory
    ```
    However: FIRST check if conftest already has such a factory under any name (e.g., `handler_factory`, `build_handler`). If so, import that name in the two test files instead. Do not duplicate factories.

    **Do NOT:**
    - Mock the LLM beyond what conftest already provides — the heuristic is deterministic.
    - Add network I/O, sleep, or time.time() dependencies — zero-diff invariant forbids.
    - Assert on internal log messages (fragile across logging changes).
    - Import from brain internals bypassing the public `rpc` package.
  </action>
  <verify>
    <automated>cd brain &amp;&amp; uv run pytest tests/unit/test_telos_refined_action.py tests/unit/test_dialogue_context_consumption.py tests/fixtures/ -x -q</automated>
  </verify>
  <done>
    - `brain/tests/fixtures/dialogue_contexts.py` exists and exports both `make_dialogue_context` and `make_dialogue_context_no_match`.
    - `brain/tests/unit/test_telos_refined_action.py` exists with ≥5 test methods (happy path, forbidden keys, no-op silence, malformed dialogue_id, hash ordering).
    - `brain/tests/unit/test_dialogue_context_consumption.py` exists with ≥6 test methods (no ctx, empty list, non-list, non-match, match, multi-ctx, boundary length).
    - All tests pass: `cd brain && uv run pytest tests/unit/test_telos_refined_action.py tests/unit/test_dialogue_context_consumption.py -v` reports all green.
    - Full Brain suite passes: `cd brain && uv run pytest tests/ -x -q` still green (no regressions in Phase 6 tests: test_handler_agency, test_force_telos, test_get_state_widening, etc.).
    - `grep -r "new_goals\|telos_yaml" brain/tests/unit/test_telos_refined_action.py` shows ONLY the forbidden-key assertion references, never in a passing-assertion expected-value slot.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Grid Python-RPC → Brain | `dialogue_context` arrives untrusted over the JSON-RPC wire; Brain validates shape before use |
| Brain heuristic → TelosManager | `_dialogue_driven_goal_set` writes to `self.telos`; bad heuristic output corrupts goal state |
| Brain → Grid (return path) | Action metadata goes back over RPC; plaintext leak here = T-07-02 (Telos plaintext leak via Brain response) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-07-10 | Spoofing | forged dialogue_context from compromised Grid | accept | Single-operator v2.1 trust model; Grid is trusted. Future cryptographic attestation is deferred. |
| T-07-11 | Tampering | malformed dialogue_context dict (missing keys, wrong types) | mitigate | `_build_refined_telos` validates `dialogue_id` is 16-char string; `on_tick` type-checks list/dict before iteration. Malformed ctx → drop silently, no crash. |
| T-07-12 | Repudiation | Brain refined goals but cannot prove which dialogue triggered it | mitigate | `triggered_by_dialogue_id` is carried through verbatim to the Grid-side audit event (Plan 03); hash chain provides tamper-evidence of the linkage. |
| T-07-13 | Info Disclosure | `new_goals` plaintext leaks into `metadata` over RPC to Grid | mitigate | `_build_refined_telos` constructs metadata with EXACTLY 3 keys (before_hash, after_hash, dialogue_id). Test `test_no_forbidden_plaintext_keys_in_metadata` enumerates 9 forbidden keys and asserts none present. |
| T-07-14 | Info Disclosure | Dialogue utterance text leaks into metadata | mitigate | `metadata` construction literal contains no utterance field; explicit key enumeration (no spread, no **kwargs) makes this impossible by design. Closed-tuple assertion enforced in test. |
| T-07-15 | DoS | many dialogue_contexts per tick → many TelosManager rebuilds → CPU exhaustion | accept | D-11 bounds: Grid delivers ≤1 context per pair per tick; pair cardinality bounded by active Nous count. Per-tick rebuild cost is O(goals) which is bounded (Phase 4 Telos depth cap). |
| T-07-16 | Elevation | malicious heuristic produces adversarial goal set (e.g., prompt injection from dialogue text) | mitigate | v2.1 heuristic is substring-matching ONLY — no LLM, no eval, no dynamic code. Utterance text feeds into the match check, never into goal-descriptions list (promoted/demoted lists are drawn from the Nous's OWN pre-existing goals). Future LLM-driven heuristic will require a separate threat review. |
</threat_model>

<verification>
**Wave 0 prerequisite check:** confirm `brain/tests/fixtures/__init__.py` exists (create empty file if not).

**Per-task verification** is in each task's `<verify>` block. Cross-task integration check:
1. `cd brain && uv run pytest tests/ -x -q` — full Brain suite, expect all green.
2. `cd brain && uv run mypy src/noesis_brain/rpc/handler.py src/noesis_brain/rpc/types.py` — type check clean.
3. Structural check: `python -c "import ast; tree = ast.parse(open('brain/src/noesis_brain/rpc/handler.py').read()); methods = [n.name for n in ast.walk(tree) if isinstance(n, ast.FunctionDef) or isinstance(n, ast.AsyncFunctionDef)]; assert '_build_refined_telos' in methods; assert 'on_tick' in methods; print('OK')"` prints OK.
4. Hash authority check: `grep -n "compute_active_telos_hash" brain/src/noesis_brain/rpc/handler.py | wc -l` returns ≥ 4 (2 in force_telos + 2 in _build_refined_telos).

**DOES NOT HAVE:** Grid-side integration test for the full dialogue → Brain → telos.refined → audit loop. That is deliberately deferred to Plan 03 (where nous-runner.ts gains the `case 'telos_refined'` branch that consumes Brain's metadata). Plan 02 ships only the Brain side; the Grid side wires it.
</verification>

<success_criteria>
- [ ] `ActionType.TELOS_REFINED` exists in `brain/src/noesis_brain/rpc/types.py` and equals `"telos_refined"` on the wire.
- [ ] `BrainHandler._build_refined_telos` exists, clones the `force_telos` hash-before/mutate/hash-after ordering, and returns `Optional[Action]`.
- [ ] `BrainHandler.on_tick` consumes optional `params["dialogue_context"]` additively without regressing Phase 6 behavior.
- [ ] No-op refinement (before_hash == after_hash) silently returns None — no action emitted.
- [ ] Closed 3-key metadata tuple `{before_goal_hash, after_goal_hash, triggered_by_dialogue_id}` enforced; forbidden plaintext keys assertion passes for all 9 canonical leak candidates.
- [ ] Two new unit test files pass (≥11 test methods total across both files).
- [ ] Full Brain suite stays green — no Phase 6 regression.
- [ ] Strict-superset widening (Phase 6 test_get_state_widening rule) preserved: existing `on_tick({"tick": N, "epoch": N})` callers unaffected.
</success_criteria>

<output>
After completion, create `.planning/phases/07-peer-dialogue-telos-refinement/07-02-SUMMARY.md` covering:
- Files changed with line counts.
- Test counts added and full-suite green status.
- Confirmation of D-13, D-14, D-15, D-18, D-20 decision implementation (cite decision IDs).
- Any deviation from the planned implementation (e.g., if an existing conftest fixture was named differently and was reused, or if the heuristic needed adjustment to make the hash-change test deterministic).
- Hand-off note to Plan 03: the Brain emits `metadata = {before_goal_hash, after_goal_hash, triggered_by_dialogue_id}` — Plan 03's nous-runner must READ these three keys and INJECT `did = this.nousDid` when calling `appendTelosRefined` (the 4th key is a Grid-side attribution, not Brain-provided).
</output>
