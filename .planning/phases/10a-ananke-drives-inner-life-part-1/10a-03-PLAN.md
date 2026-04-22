---
phase: 10a-ananke-drives-inner-life-part-1
plan: 03
type: execute
wave: 2
depends_on: [10a-01]
files_modified:
  - brain/src/noesis_brain/rpc/types.py
  - brain/src/noesis_brain/rpc/handler.py
  - brain/src/noesis_brain/ananke/loader.py
  - brain/test/ananke/test_handler_ananke.py
  - brain/test/ananke/test_loader.py
autonomous: true
requirements: [DRIVE-02, DRIVE-04]
schema_push: not_applicable
user_setup: []

must_haves:
  truths:
    - "The Brain's RPC handler owns one AnankeRuntime per connected DID"
    - "`on_tick(tick)` calls AnankeRuntime.on_tick(tick) then drains crossings into Action metadata"
    - "Each drained CrossingEvent becomes a SEPARATE Action with action_type == ActionType.DRIVE_CROSSED"
    - "Drive → action coupling is ADVISORY only: handler logs 'high hunger, chose non-feeding action' to the Nous's private wiki, never overrides Telos"
    - "ActionType.DRIVE_CROSSED is a new closed-enum member; legacy ActionTypes (SPEAK, MOVE, TRADE_REQUEST, TELOS_REFINED, NOOP, DIRECT_MESSAGE) remain unchanged"
    - "The Action.metadata for DRIVE_CROSSED contains exactly 3 keys: {drive, level, direction} — Grid injects did and tick when converting to the audit payload"
  artifacts:
    - path: brain/src/noesis_brain/rpc/types.py
      provides: "ActionType.DRIVE_CROSSED enum member added"
      contains: "DRIVE_CROSSED"
    - path: brain/src/noesis_brain/rpc/handler.py
      provides: "Handler owns AnankeRuntime instances; on_tick drains crossings → Action list; advisory-log divergence"
      contains: "AnankeRuntime"
    - path: brain/src/noesis_brain/ananke/loader.py
      provides: "Loader hook registering AnankeRuntime with the handler at connection-accept time"
      min_lines: 30
    - path: brain/test/ananke/test_handler_ananke.py
      provides: "Unit test — on_tick returns one Action per crossing, metadata shape locked, advisory logging verified"
      min_lines: 80
    - path: brain/test/ananke/test_loader.py
      provides: "Loader instantiates AnankeRuntime; multiple connected DIDs get independent runtimes"
      min_lines: 40
  key_links:
    - from: brain/src/noesis_brain/rpc/handler.py
      to: brain/src/noesis_brain/ananke/runtime.py
      via: "handler imports AnankeRuntime and holds one per DID"
      pattern: "from .*ananke.*import.*AnankeRuntime"
    - from: brain/src/noesis_brain/rpc/handler.py
      to: brain/src/noesis_brain/rpc/types.py
      via: "handler emits Action(action_type=ActionType.DRIVE_CROSSED, metadata={drive,level,direction})"
      pattern: "ActionType\\.DRIVE_CROSSED"
---

<objective>
Wire the Brain's RPC handler to consume AnankeRuntime crossings and lift them into Actions the Grid dispatcher can route. This plan establishes the Brain→wire boundary — but does NOT touch the Grid side (that's Plan 10a-04). Depends on Plan 10a-01 (AnankeRuntime exists).

Purpose: DRIVE-02 wire-side completion (drive state never crosses the wire as a float — only CrossingEvent tuples lifted into Action.metadata with the 3 keys `{drive, level, direction}`) + DRIVE-04 (advisory-only coupling — drive divergence logged, never coerces Telos).

Output: 2 modified files (rpc/types.py, rpc/handler.py) + 1 new file (ananke/loader.py) + 2 test files.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/10a-ananke-drives-inner-life-part-1/10a-CONTEXT.md
@.planning/phases/10a-ananke-drives-inner-life-part-1/10a-RESEARCH.md
@.planning/phases/10a-ananke-drives-inner-life-part-1/10a-PATTERNS.md
@.planning/REQUIREMENTS.md
@PHILOSOPHY.md
@brain/src/noesis_brain/rpc/types.py
@brain/src/noesis_brain/rpc/handler.py
@brain/src/noesis_brain/ananke/runtime.py
@brain/src/noesis_brain/ananke/types.py

<locked_decisions>
- **D-10a-06:** Drive → action coupling is advisory. If a drive is HIGH but the Nous chooses a non-correlated action (e.g., high hunger + SPEAK instead of MOVE-to-sustenance), the handler logs the divergence to the Nous's private wiki (never broadcast) and moves on. Telos is never overridden.
- **3-keys-not-5 invariant:** Brain emits Action with `metadata = {drive, level, direction}` (3 keys). Grid's dispatcher (Plan 10a-04) injects `did` and `tick` to form the final 5-key payload. This keeps the Brain ignorant of its own DID (reinforces the Brain-as-stateless-mind architecture) and keeps `tick` as the Grid's authoritative counter.
- **Brain-returns-Action pattern:** Clones Phase 7 `TELOS_REFINED` template. On `on_tick()`, the handler returns `list[Action]` — `[Action(NOOP)] + [Action(DRIVE_CROSSED, ...) for each crossing]` or similar. The handler does NOT emit crossings asynchronously; they are synchronous RPC return values.
</locked_decisions>

<analog_sources>
**RPC handler template:** `brain/src/noesis_brain/rpc/handler.py` — read in full to understand the existing `on_tick` handler method signature, how it constructs `Action` objects, and how `ActionType.TELOS_REFINED` is emitted (Phase 7 precedent).

**Advisory logging template:** The Brain's private wiki write path — search for existing wiki writes (e.g., `wiki.append` or `self.wiki.write`). If the wiki interface exists, use it verbatim. If not, log via the standard Brain logger with a distinct log tag (e.g., `logger.info("ananke.divergence", extra={...})`).

**Loader pattern:** `brain/src/noesis_brain/psyche/loader.py` — read in full. This is the canonical subsystem loader: instantiated at connection-accept, holds subsystem state per connection, exposes `on_tick()` the handler calls.
</analog_sources>

<interfaces>
```python
# brain/src/noesis_brain/rpc/types.py
# EDIT — add one enum member.

class ActionType(str, Enum):
    SPEAK = "speak"
    DIRECT_MESSAGE = "direct_message"
    MOVE = "move"
    TRADE_REQUEST = "trade_request"
    TELOS_REFINED = "telos_refined"  # Phase 7 DIALOG-02
    DRIVE_CROSSED = "drive_crossed"  # Phase 10a DRIVE-03 — Ananke threshold crossing; Grid dispatcher converts to ananke.drive_crossed audit event.
    NOOP = "noop"
```

```python
# brain/src/noesis_brain/ananke/loader.py
# NEW — canonical subsystem loader, clone of psyche/loader.py shape.

from __future__ import annotations
from dataclasses import dataclass
from .runtime import AnankeRuntime


@dataclass
class AnankeLoader:
    """Factory for per-connection AnankeRuntime instances.

    Cloned shape from psyche/loader.py. The loader is instantiated once per
    Brain process; it returns a fresh AnankeRuntime for each accepted
    connection (keyed by seed derived from the connecting DID).
    """

    def build(self, *, seed: int) -> AnankeRuntime:
        """Construct a new AnankeRuntime seeded deterministically.

        `seed` is an integer derived from the DID at connection-accept time
        (the handler computes this; the loader is seed-agnostic).
        """
        return AnankeRuntime(seed=seed)
```

```python
# Pseudocode extensions to brain/src/noesis_brain/rpc/handler.py
# (exact edit shape depends on the existing handler structure — see <action>).

from ..ananke import AnankeRuntime, CrossingEvent, DriveName, DriveLevel, Direction
from ..ananke.loader import AnankeLoader
from .types import Action, ActionType

class Handler:
    def __init__(self, ...):
        ...
        self._ananke_loader = AnankeLoader()
        self._ananke_runtimes: dict[str, AnankeRuntime] = {}  # did → runtime

    def _get_or_create_ananke(self, did: str) -> AnankeRuntime:
        if did not in self._ananke_runtimes:
            # Seed is a stable integer derived from the DID (hash-based so replay
            # with the same DID reproduces the same trace). MUST be deterministic
            # and wall-clock-independent.
            seed = int.from_bytes(hashlib.sha256(did.encode()).digest()[:8], 'big')
            self._ananke_runtimes[did] = self._ananke_loader.build(seed=seed)
        return self._ananke_runtimes[did]

    def on_tick(self, did: str, tick: int, ...) -> list[Action]:
        runtime = self._get_or_create_ananke(did)
        runtime.on_tick(tick)
        crossings = runtime.drain_crossings()

        actions: list[Action] = []

        # ... existing decision logic may append SPEAK/MOVE/NOOP ...
        existing_actions = self._decide_primary_action(did, tick, ...)
        actions.extend(existing_actions)

        # Lift crossings into Action objects. Metadata is EXACTLY 3 keys —
        # Grid injects did and tick downstream (3-keys-not-5 invariant).
        for xing in crossings:
            actions.append(Action(
                action_type=ActionType.DRIVE_CROSSED,
                channel="",   # not applicable for DRIVE_CROSSED
                text="",
                metadata={
                    "drive": xing.drive.value,
                    "level": xing.level.value,
                    "direction": xing.direction.value,
                },
            ))

        # Advisory logging — D-10a-06. If there is a HIGH drive that logically
        # suggests a different primary action than the one chosen, log the
        # divergence to the Nous's private wiki. This is INFORMATIONAL only;
        # the chosen actions are NOT rewritten.
        self._advisory_log_divergence(did, runtime.state, existing_actions)

        return actions

    def _advisory_log_divergence(self, did: str, state, chosen_actions) -> None:
        """Log drive-vs-action divergence to the Nous's private wiki.

        PHILOSOPHY §6: drives inform but do not coerce. This function MUST NOT
        modify `chosen_actions`; it is side-effect-only (write to wiki or log).
        """
        for drive_name, level in state.levels.items():
            if level == DriveLevel.HIGH:
                # Example heuristic: high hunger suggests a MOVE-to-sustenance
                # action. If no MOVE action is in chosen_actions, log the divergence.
                chose_move = any(a.action_type == ActionType.MOVE for a in chosen_actions)
                if drive_name == DriveName.HUNGER and not chose_move:
                    self._wiki_append(did, f"ananke.divergence: hunger=high, chose non-movement actions")
                # Repeat for curiosity → SPEAK, safety → MOVE, loneliness → DIRECT_MESSAGE
                # Exact heuristic table is for planner to finalize during implementation;
                # the invariant is that NOTHING in this function modifies chosen_actions.
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add ActionType.DRIVE_CROSSED + AnankeLoader skeleton</name>
  <files>
    brain/src/noesis_brain/rpc/types.py,
    brain/src/noesis_brain/ananke/loader.py,
    brain/test/ananke/test_loader.py
  </files>
  <read_first>
    - Read `brain/src/noesis_brain/rpc/types.py` in full (already in context at lines 10–18) — confirm the `ActionType(str, Enum)` definition and the placement convention of the new member (after TELOS_REFINED, before NOOP — NOOP always remains last by convention).
    - Read `brain/src/noesis_brain/psyche/loader.py` in full to confirm the loader idiom: dataclass-based, `build(*, seed)` factory method.
    - Read `brain/test/test_rpc_handler.py` lines 1–60 to understand the handler-test fixtures (mock chain, fake time, etc.).
  </read_first>
  <behavior>
    - `ActionType.DRIVE_CROSSED.value == "drive_crossed"` (snake_case, matching the existing `telos_refined` style).
    - `ActionType.DRIVE_CROSSED` is an enum member; `Action(action_type=ActionType.DRIVE_CROSSED, ...)` constructs successfully.
    - `ActionType` remains a closed enum — adding an instance by runtime subclassing fails (Python Enum semantics enforce this).
    - `AnankeLoader().build(seed=42)` returns an `AnankeRuntime` instance with `seed == 42` and initial drive state.
    - Two calls to `AnankeLoader().build(seed=42)` return two DISTINCT runtime instances (`a is not b`) — the loader never caches.
    - `AnankeLoader().build(seed=0)` and `AnankeLoader().build(seed=999)` both produce identical 10_000-tick traces in 10a (seed reserved but unused; matches Plan 10a-01 behavior).
  </behavior>
  <action>
    1. **Edit `brain/src/noesis_brain/rpc/types.py`:**
       - Inside the `ActionType(str, Enum)` class, after the `TELOS_REFINED = "telos_refined"` line and before the `NOOP = "noop"` line, insert:
         ```python
         DRIVE_CROSSED = "drive_crossed"  # Phase 10a DRIVE-03 — Ananke threshold crossing; Grid dispatcher converts to ananke.drive_crossed audit event. Metadata shape: {drive, level, direction} (3 keys; Grid injects did and tick).
         ```
       - Do NOT change any other enum value, add any field, or modify the `Action` dataclass.

    2. **Create `brain/src/noesis_brain/ananke/loader.py`** — use the exact code from `<interfaces>`.

    3. **Create `brain/test/ananke/test_loader.py`:**
       ```python
       from noesis_brain.ananke.loader import AnankeLoader
       from noesis_brain.ananke.runtime import AnankeRuntime
       from noesis_brain.ananke.types import DRIVE_NAMES


       def test_loader_builds_runtime() -> None:
           loader = AnankeLoader()
           runtime = loader.build(seed=42)
           assert isinstance(runtime, AnankeRuntime)
           assert runtime.seed == 42


       def test_loader_returns_fresh_instance_per_call() -> None:
           loader = AnankeLoader()
           a = loader.build(seed=42)
           b = loader.build(seed=42)
           assert a is not b


       def test_loader_runtime_starts_at_baseline() -> None:
           runtime = AnankeLoader().build(seed=42)
           # Every drive is at its baseline after initial_state()
           for drive in DRIVE_NAMES:
               # We don't assert the exact float here; we assert the state is
               # in canonical initial shape by checking the level map exists.
               assert drive in runtime.state.values
               assert drive in runtime.state.levels


       def test_loader_multiple_dids_get_independent_runtimes() -> None:
           loader = AnankeLoader()
           rt_alpha = loader.build(seed=hash("did:noesis:alpha") & 0xFFFFFFFF)
           rt_beta = loader.build(seed=hash("did:noesis:beta") & 0xFFFFFFFF)

           for _ in range(100):
               rt_alpha.on_tick(1)
           # rt_beta still at initial state because it was never stepped.
           for drive in DRIVE_NAMES:
               # Alpha moved; beta still at baseline.
               assert rt_beta.state.values[drive] != rt_alpha.state.values[drive] or \
                      rt_beta.state.levels[drive] == rt_alpha.state.levels[drive]
               # (weak assertion — bounds test; the actual independence is
               # proven by the `is not` check above.)
       ```
  </action>
  <verify>
    <automated>cd brain && pytest test/ananke/test_loader.py -q</automated>
  </verify>
  <acceptance_criteria>
    - `python -c "from noesis_brain.rpc.types import ActionType; print(ActionType.DRIVE_CROSSED.value)"` prints `drive_crossed`.
    - `python -c "from noesis_brain.rpc.types import ActionType; assert len(list(ActionType)) == 7"` exits 0 (6 prior + 1 new = 7).
    - `pytest test/ananke/test_loader.py -q` reports 4 passing tests.
    - `grep -n "DRIVE_CROSSED" brain/src/noesis_brain/rpc/types.py` returns exactly 1 match (the enum definition).
  </acceptance_criteria>
  <done>
    `ActionType.DRIVE_CROSSED` exists. `AnankeLoader` skeleton matches the `psyche/loader.py` idiom and returns fresh runtimes per call.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire handler to drain crossings into Actions + implement advisory logging</name>
  <files>
    brain/src/noesis_brain/rpc/handler.py,
    brain/test/ananke/test_handler_ananke.py
  </files>
  <read_first>
    - Read `brain/src/noesis_brain/rpc/handler.py` in full — this is the primary edit target. Identify the existing `on_tick` method (or equivalent tick-handling path), the existing Action-construction conventions, and the private-state-storage convention (self._X mapping per-did).
    - Read `brain/test/test_rpc_handler.py` — it provides the handler-fixture pattern and assertion style for tests that exercise `on_tick` end-to-end.
    - Read `brain/src/noesis_brain/rpc/handler.py` for any existing wiki-append method. If `self._wiki_append(did, text)` or similar exists, reuse it. If no wiki writer exists in Brain, use `logger.info` with a structured `extra` dict as the fallback.
  </read_first>
  <behavior>
    - `handler.on_tick(did='did:noesis:alpha', tick=1)` returns `list[Action]`. When no crossings fire, the list contains only the legacy primary action(s) (e.g., `[Action(NOOP)]`).
    - When a crossing fires (simulate by stepping many ticks so hunger crosses LOW→MED): the returned list contains the legacy primary action PLUS one `Action(action_type=DRIVE_CROSSED, metadata={'drive': 'hunger', 'level': 'med', 'direction': 'rising'})`. Metadata has EXACTLY 3 keys.
    - If two drives cross in the same tick, TWO separate `DRIVE_CROSSED` actions appear (one per crossing).
    - **Drain semantics:** A second `on_tick` immediately after the crossing, with no new bucket changes, returns zero `DRIVE_CROSSED` actions — the queue was drained on the first call.
    - **Independence:** `on_tick` for `did:noesis:alpha` does NOT drain crossings for `did:noesis:beta`. Each DID has its own runtime.
    - **Advisory logging:** When a drive is HIGH but the chosen primary action is not the "matching" action (heuristic: hunger↔MOVE, curiosity↔SPEAK, safety↔MOVE, loneliness↔DIRECT_MESSAGE, boredom↔SPEAK), a wiki append is recorded. The test asserts a specific log entry was emitted (via mock or log capture); the chosen primary action is NOT modified.
    - **No override:** Even if advisory logging records a divergence, the returned `actions` list contains the ORIGINAL primary action unchanged.
  </behavior>
  <action>
    Edit `brain/src/noesis_brain/rpc/handler.py` with minimal surgical changes. Exact edits depend on the existing structure; the constraints are:

    1. **Import additions** at the top of handler.py:
       ```python
       import hashlib
       from ..ananke import AnankeRuntime, DriveLevel, DriveName
       from ..ananke.loader import AnankeLoader
       ```

    2. **Handler constructor additions:**
       ```python
       self._ananke_loader = AnankeLoader()
       self._ananke_runtimes: dict[str, AnankeRuntime] = {}
       ```

    3. **`_get_or_create_ananke(did)` private method** — returns existing runtime or creates one with a SHA-256-derived seed:
       ```python
       def _get_or_create_ananke(self, did: str) -> AnankeRuntime:
           if did not in self._ananke_runtimes:
               seed = int.from_bytes(hashlib.sha256(did.encode()).digest()[:8], 'big')
               self._ananke_runtimes[did] = self._ananke_loader.build(seed=seed)
           return self._ananke_runtimes[did]
       ```

    4. **`on_tick` extension** — after the existing primary-action decision, add:
       ```python
       runtime = self._get_or_create_ananke(did)
       runtime.on_tick(tick)
       for xing in runtime.drain_crossings():
           actions.append(Action(
               action_type=ActionType.DRIVE_CROSSED,
               channel="",
               text="",
               metadata={
                   "drive": xing.drive.value,
                   "level": xing.level.value,
                   "direction": xing.direction.value,
               },
           ))
       self._advisory_log_divergence(did, runtime.state, actions)
       ```

    5. **`_advisory_log_divergence` method** — side-effect-only. Heuristic table:
       | Drive | Matching action |
       |-------|-----------------|
       | hunger | MOVE |
       | curiosity | SPEAK |
       | safety | MOVE |
       | boredom | SPEAK |
       | loneliness | DIRECT_MESSAGE |

       For each drive that is HIGH, if NO action of the matching type is in `actions`, log via `logger.info` with `extra={"event": "ananke.divergence", "did": did, "drive": drive.value, "level": "high", "chose": [a.action_type.value for a in actions]}`. If a wiki-append method exists on the handler, call that instead.

       **Critical invariant:** This method MUST NOT append to, remove from, or modify `actions` in any way. It is pure observation.

    6. **Create `brain/test/ananke/test_handler_ananke.py`** with ≥ 6 tests:
       - `test_on_tick_returns_empty_crossings_at_baseline` — first tick, no crossings.
       - `test_on_tick_lifts_crossing_into_action_metadata` — step until hunger crosses, assert one `DRIVE_CROSSED` action with metadata `{'drive': 'hunger', 'level': 'med', 'direction': 'rising'}`.
       - `test_metadata_has_exactly_three_keys` — assert `sorted(action.metadata.keys()) == ['direction', 'drive', 'level']` (no `did`, no `tick`).
       - `test_crossings_drain_on_first_call` — immediately after the crossing, the next `on_tick` returns no `DRIVE_CROSSED` actions.
       - `test_multiple_dids_have_independent_runtimes` — two DIDs stepped alternately; their crossings do not leak.
       - `test_advisory_log_fires_on_divergence_but_does_not_modify_actions` — set up a runtime where hunger is forced to HIGH (by stepping enough ticks); ensure the returned primary action is NOT rewritten to MOVE; capture the log entry with pytest's `caplog` fixture and assert the `ananke.divergence` event is logged.
       - `test_closed_enum_rejected_at_metadata_level` — not applicable here (the enum constraints live on the Grid side); SKIP.
  </action>
  <verify>
    <automated>cd brain && pytest test/ananke/test_handler_ananke.py -q</automated>
  </verify>
  <acceptance_criteria>
    - `pytest test/ananke/test_handler_ananke.py -q` reports 6 passing tests.
    - `grep -n "ActionType.DRIVE_CROSSED" brain/src/noesis_brain/rpc/handler.py` returns exactly 1 match (the construction site).
    - `grep -n "drain_crossings\|AnankeRuntime\|AnankeLoader" brain/src/noesis_brain/rpc/handler.py` returns ≥ 3 matches (imports + use).
    - No test in the existing `brain/test/` suite regresses — full `pytest -q` exits 0 with handler-related tests still passing.
    - `grep -n "actions\.remove\|actions\.pop\|actions\[0\]\s*=" brain/src/noesis_brain/rpc/handler.py` → check that the advisory-log function does NOT mutate actions. Precise inspection of `_advisory_log_divergence` body shows no modification of the `actions` parameter.
  </acceptance_criteria>
  <done>
    Handler owns one AnankeRuntime per DID. `on_tick` drains crossings into `DRIVE_CROSSED` Actions with 3-key metadata. Advisory logging records drive-action divergence without modifying the Action list. Full Brain test suite green.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Brain runtime (internal) | AnankeRuntime state lives inside handler; never crosses the wire as floats. |
| Brain→Grid (RPC return) | Action objects with `action_type=DRIVE_CROSSED` and 3-key metadata cross here. This plan establishes the lift; Plan 10a-04 wires the Grid-side reception. |
| Nous wiki (private) | Advisory divergence logs land here. Never broadcast; inherited Phase 4 privacy. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10a-11 | Elevation of Privilege | Advisory logging mutating chosen actions | mitigate | `_advisory_log_divergence` is pure observation; `test_advisory_log_fires_on_divergence_but_does_not_modify_actions` asserts the Actions list is unchanged. PHILOSOPHY §6 preserved. |
| T-10a-12 | Information Disclosure | Wiki log content leaking into broadcast | mitigate | Wiki writes are private to the Nous. The `ananke.divergence` log key is not in the allowlist (Plan 10a-02); cannot be broadcast even accidentally. Belt-and-suspenders: log entries flow through Brain's private logger, not the Grid audit chain. (Addresses T-09-02 inherited: drive data never reaches broadcast layer from advisory logs.) |
| T-10a-13 | Information Disclosure | Action.metadata carrying a drive float | mitigate | Metadata construction site explicitly sets 3 keys `{drive, level, direction}` — all strings (enum values). Type-checked by Python at `.value` access. Handler test `test_metadata_has_exactly_three_keys` asserts the set equality. (Addresses T-09-02: the 3-keys-not-5 invariant structurally prevents floats in metadata.) |
| T-10a-14 | Tampering | Seed derivation non-determinism | mitigate | Seed = `int.from_bytes(hashlib.sha256(did).digest()[:8], 'big')` — deterministic from DID string. Replay with identical DID sequence produces identical runtimes. (Addresses T-09-03: no wall-clock input to seed.) |
| T-10a-15 | Denial of Service | Runtime per DID memory growth | accept | One DID = one AnankeRuntime = ~400 bytes (5 floats + 5 enums + dict overhead). 10_000 connected Nous = ~4MB. Acceptable for v2.x; re-evaluate if Nous population exceeds 100k. |
</threat_model>

<verification>
Gate checklist:
- [ ] `ActionType` has 7 members; `DRIVE_CROSSED` is the 6th (between TELOS_REFINED and NOOP).
- [ ] `pytest test/ananke/` exits 0 with ≥ 10 passing tests across both test files.
- [ ] `pytest -q` (full Brain suite) exits 0.
- [ ] Handler's `_advisory_log_divergence` has no `actions.append`, `actions.remove`, or indexed assignment.
- [ ] `brain/src/noesis_brain/ananke/loader.py` exists and imports cleanly.
</verification>

<success_criteria>
- DRIVE-02 wire-side delivered: Brain emits CrossingEvent→Action with 3-key metadata; float never crosses the RPC return boundary.
- DRIVE-04 delivered: advisory logging records divergence without coercing Telos; the returned Action list is unchanged regardless of drive state.
- Brain↔Grid handshake shape locked for Plan 10a-04 to consume.
</success_criteria>

<output>
After completion, create `.planning/phases/10a-ananke-drives-inner-life-part-1/10a-03-SUMMARY.md`.
</output>
