---
phase: 17-iris-theory-of-mind
plan: wave-3
type: execute
wave: 4
depends_on: [wave-0, wave-1, wave-2]
files_modified:
  - brain/src/noesis_brain/rpc/handler.py
  - brain/src/noesis_brain/prompts/system.py
autonomous: true
requirements: [IRIS-05, IRIS-06, IRIS-07, IRIS-08]

must_haves:
  truths:
    - "IrisRuntime is initialized in __init__ when iris_db_dir is provided, disabled (None) when absent"
    - "elicit() is called once per peer in dialogue_context after seed_priors(), on every non-idle tick"
    - "context_for() is called per peer at prompt-build time when Iris is enabled"
    - "IRIS_CONTEXT_INVOKED action is emitted once per tick when any beliefs are injected"
    - "build_system_prompt() accepts a tom_context kwarg and injects a Theory of Mind section"
    - "All iris calls are guarded by _iris_runtime is not None (fail-soft, log.warning on error)"
  artifacts:
    - path: "brain/src/noesis_brain/rpc/handler.py"
      provides: "IrisRuntime init + elicit() trigger + context_for() call"
      contains: "self._iris_runtime = IrisRuntime"
    - path: "brain/src/noesis_brain/prompts/system.py"
      provides: "Theory of Mind section in system prompt"
      contains: "tom_context"
  key_links:
    - from: "BrainHandler.__init__ iris_db_dir param"
      to: "IrisStore(db_path=..., nous_did=self.did)"
      via: "optional-dep injection"
      pattern: "IrisRuntime\\(_iris_store"
    - from: "on_tick() after seed_priors block (line ~228)"
      to: "self._iris_runtime.elicit()"
      via: "dialogue_context loop"
      pattern: "self\\._iris_runtime\\.elicit"
    - from: "build_system_prompt() tom_context kwarg"
      to: "_theory_of_mind_section() helper"
      via: "optional section injection"
      pattern: "tom_context"
---

<objective>
Wire IrisRuntime initialization, elicit() trigger, context_for() prompt injection, and dispatcher adapter into BrainHandler. Extend build_system_prompt() with the Theory of Mind section.

Purpose: This is the cognitive integration — the already-implemented Iris module finally runs inside the Brain's tick and message loop. All four iris.* audit events are emitted here.

Output: handler.py with full Iris wiring; system.py with ToM prompt section.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/17-iris-theory-of-mind/17-CONTEXT.md
@.planning/phases/17-iris-theory-of-mind/17-PATTERNS.md

<interfaces>
<!-- IrisRuntime API (from brain/src/noesis_brain/iris/elicit.py) -->
```python
class IrisRuntime:
    def __init__(self, store: IrisStore, llm_adapter: Any) -> None: ...
    def set_dispatcher(self, dispatcher: Any) -> None: ...
    def elicit(self, nous_did: str, target_did: str, context: dict, tick: int) -> ElicitResult: ...

@dataclass
class ElicitResult:
    beliefs: list[Belief]       # populated on success; empty on cooldown/error
    contradiction: bool         # True if confidence delta > IRIS_CONTRADICTION_THRESHOLD
    new_hash: str               # sha256 hex of new belief content ("" if no belief)
    prior_hash: str             # sha256 hex of prior active belief ("" if none)
    source_event_hash: str      # sha256 hex of context identifier ("" if not provided)
```

<!-- context_for() API (from brain/src/noesis_brain/iris/integration.py) -->
```python
def context_for(target_did: str, store: IrisStore, k: int = IRIS_CONTEXT_TOP_K) -> ToMContext:
    """Returns top-K active beliefs about target_did. PURE READ."""

@dataclass(frozen=True)
class ToMContext:
    target_did: str
    beliefs: list[Belief]
    n_beliefs_used: int
```

<!-- IrisStore constructor (from brain/src/noesis_brain/iris/store.py) -->
```python
class IrisStore:
    def __init__(self, db_path: str | Path = ":memory:", nous_did: str = "") -> None: ...
```

<!-- build_system_prompt() current signature (from brain/src/noesis_brain/prompts/system.py) -->
```python
def build_system_prompt(
    psyche, mood, telos,
    grid_name="genesis", location="Agora Central",
    *, bios_snapshot=None, epoch_since_spawn=None, subjective_multiplier=None,
    skills=None, rules=None, reflections=None, peer_voices=None,
) -> str:
    # sections list: [identity, personality, emotional, goals, context]
    # then optional: rules, reflections, skills, peer_voices
    # finally: directives
```

<!-- Belief dataclass (from brain/src/noesis_brain/iris/types.py — not read but known) -->
```python
@dataclass
class Belief:
    id: int | None
    nous_did: str
    target_did: str
    dimension: str  # 'belief' | 'desire' | 'intention' | 'knowledge' | 'emotion'
    content: str    # Brain-private; NEVER crosses wire
    confidence: float
    superseded_by: int | None
    created_tick: int
    source_event_hash: str | None
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Initialize IrisRuntime in BrainHandler.__init__ and wire elicit() in on_tick()</name>
  <files>brain/src/noesis_brain/rpc/handler.py</files>
  <action>
Three sub-steps in handler.py. **Duplicate method warning:** handler.py has duplicate method definitions. Touch ONLY the FIRST occurrence of `__init__` (lines 40-71) and the FIRST occurrence of `on_tick()` (lines 140+). Do not touch any subsequent duplicate blocks.

**Sub-step A — Add imports** (after line 24 `from noesis_brain.iris.priors import seed_priors`):
```python
from pathlib import Path
from noesis_brain.iris.store import IrisStore
from noesis_brain.iris.elicit import IrisRuntime
from noesis_brain.iris.integration import context_for
```
Do NOT import context_for here if it's already imported elsewhere. Verify with `grep -n "context_for" handler.py` first.

**Sub-step B — Replace the placeholder in __init__.** Wave 0 added `self._iris_runtime = None`. Replace that single line with the full optional-dep initialization block (after `self._bios_birth_ticks: dict[str, int] = {}`):

```python
        # Phase 17 D-17-14: IrisRuntime optional-dep injection.
        # iris_db_dir=None → Iris disabled (all iris guards are no-ops).
        # iris_db_dir provided → IrisStore + IrisRuntime constructed for this Nous.
        if iris_db_dir is not None:
            _iris_store = IrisStore(
                db_path=Path(iris_db_dir) / f"iris_{self.did.replace(':', '_')}.db",
                nous_did=self.did,
            )
            self._iris_runtime: IrisRuntime | None = IrisRuntime(_iris_store, self.llm)
            self._iris_runtime.set_dispatcher(None)  # dispatcher injected post-init if needed
        else:
            self._iris_runtime = None
```

Also add `iris_db_dir: str | Path | None = None` to `__init__` signature after `did: str = ""`:
```python
    def __init__(
        self,
        psyche: Psyche,
        thymos: ThymosTracker,
        telos: TelosManager,
        llm: LLMAdapter,
        grid_name: str = "genesis",
        location: str = "Agora Central",
        *,
        memory: Any = None,
        did: str = "",
        iris_db_dir: str | Path | None = None,   # Phase 17 D-17-14
    ) -> None:
```

**Sub-step C — Wire elicit() in on_tick().** After the existing seed_priors block (lines 212-228), before the `if actions:` block (line 229), insert:

```python
        # Phase 17 D-17-15: IrisRuntime.elicit() — once per peer in dialogue_context.
        # Gated: _iris_runtime present AND dialogue_context is a list (D-17-04).
        # Each ElicitResult may emit: IRIS_BELIEF_REVISED, IRIS_CONTRADICTION_DETECTED,
        # IRIS_PRIOR_SEEDED. IRIS_CONTEXT_INVOKED emitted once if any beliefs injected.
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

                # IRIS_BELIEF_REVISED: one action per returned belief (may be empty on cooldown).
                for belief in result.beliefs:
                    actions.append(Action(
                        action_type=ActionType.IRIS_BELIEF_REVISED,
                        metadata={
                            "target_did": target_did,
                            "belief_hash": result.new_hash,
                            "dimension": belief.dimension if isinstance(belief.dimension, str)
                                        else belief.dimension.value,
                        },
                    ).to_dict())
                    total_injected += 1

                # IRIS_CONTRADICTION_DETECTED: fires when confidence delta > threshold.
                if result.contradiction:
                    actions.append(Action(
                        action_type=ActionType.IRIS_CONTRADICTION_DETECTED,
                        metadata={
                            "target_did": target_did,
                            "contradiction_hash": result.prior_hash,
                        },
                    ).to_dict())

                # IRIS_PRIOR_SEEDED: fires when this is the first belief for this pair.
                # Condition: new_hash present AND no prior (prior_hash empty string).
                if result.new_hash and not result.prior_hash:
                    actions.append(Action(
                        action_type=ActionType.IRIS_PRIOR_SEEDED,
                        metadata={
                            "target_did": target_did,
                            "seed_event_hash": result.source_event_hash or result.new_hash,
                        },
                    ).to_dict())

            # D-17-13: IRIS_CONTEXT_INVOKED emitted once per tick when beliefs injected.
            if total_injected > 0:
                actions.append(Action(
                    action_type=ActionType.IRIS_CONTEXT_INVOKED,
                    metadata={"belief_count": total_injected},
                ).to_dict())
```

**Invariant check on contradiction_hash:** NousRunner's appendIrisContradictionDetected slices `[:32]` — the hash comes from `result.prior_hash` (a full sha256 hexdigest). Brain sends it full; Grid truncates. This is correct.

**Invariant check on belief_hash:** NousRunner slices `result.new_hash[:32]`. Brain sends full sha256. Correct.
  </action>
  <verify>
    <automated>python -c "
import ast
with open('brain/src/noesis_brain/rpc/handler.py') as f:
    src = f.read()
ast.parse(src)
print('syntax ok')
# Check iris_db_dir in signature
assert 'iris_db_dir' in src, 'iris_db_dir param missing'
assert 'IrisRuntime' in src, 'IrisRuntime not imported/used'
assert 'IRIS_BELIEF_REVISED' in src, 'IRIS_BELIEF_REVISED action missing'
print('all assertions pass')
"</automated>
  </verify>
  <done>
    - `iris_db_dir: str | Path | None = None` in __init__ signature
    - `self._iris_runtime = IrisRuntime(...)` in __init__ body when iris_db_dir provided
    - `self._iris_runtime.elicit(...)` called in on_tick() after seed_priors block
    - `ActionType.IRIS_BELIEF_REVISED`, `IRIS_CONTRADICTION_DETECTED`, `IRIS_PRIOR_SEEDED`, `IRIS_CONTEXT_INVOKED` all referenced in on_tick()
    - File parses without syntax error
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Wire context_for() into system prompt + Theory of Mind section</name>
  <files>
    brain/src/noesis_brain/prompts/system.py
    brain/src/noesis_brain/rpc/handler.py
  </files>
  <action>
Two sub-steps: extend `build_system_prompt()` with a `tom_context` parameter, and call `context_for()` in `on_tick()` (and `on_message()`) before building the system prompt.

**Sub-step A — Extend build_system_prompt() in system.py:**

Add `tom_context` parameter to the function signature (per D-17-11, after `peer_voices`):
```python
    # Phase 17 additive-widening: Theory of Mind context for up to 3 peers.
    # tom_context: list of ToMContext objects, one per peer with active beliefs.
    # None when Iris disabled; empty list when enabled but no beliefs yet.
    tom_context: "list | None" = None,
```

Add a new `_theory_of_mind_section()` helper function, and inject it between the drives/goals section and the directives section. Per D-17-11, position it after `peer_voices` injection and before `_directives_section`:

```python
    # Phase 17: inject Theory of Mind context if available.
    if tom_context:
        section = _theory_of_mind_section(tom_context)
        if section:
            sections.append(section)

    sections.append(_directives_section(psyche))
```

Add the helper function:
```python
def _theory_of_mind_section(tom_contexts: list) -> str:
    """Build Theory of Mind section for up to 3 peers (D-17-11, D-17-12).

    Brain-private: belief content never leaves Brain. This section is in the
    LLM system prompt — it does NOT cross the Brain↔Grid wire.

    Args:
        tom_contexts: list of ToMContext objects from context_for().
                      Up to 3 peers; each has beliefs and n_beliefs_used.
    """
    if not tom_contexts:
        return ""

    lines = ["## What You Know About Others"]
    # D-17-12: max 3 most-recently-interacted peers.
    for ctx in tom_contexts[:3]:
        if not ctx.beliefs:
            continue
        lines.append(f"\nAbout {ctx.target_did}:")
        for belief in ctx.beliefs[:5]:  # IRIS_CONTEXT_TOP_K = 5
            dim = belief.dimension if isinstance(belief.dimension, str) else belief.dimension.value
            conf_label = "confidently" if belief.confidence > 0.7 else "tentatively"
            lines.append(
                f"  - [{dim}] You {conf_label} believe: {belief.content}"
            )
    result = "\n".join(lines)
    # Guard: if nothing was added beyond the header, return ""
    return result if len(lines) > 1 else ""
```

**Sub-step B — Call context_for() in handler.py on_tick() and on_message().**

In `on_tick()`, before the `build_system_prompt(...)` call, insert:
```python
        # Phase 17 D-17-16: gather Theory of Mind context for prompt injection.
        # Calls context_for() for each recently-interacted peer.
        # tom_contexts is empty list when Iris disabled or no beliefs yet.
        tom_contexts: list = []
        if self._iris_runtime is not None and isinstance(dialogue_ctxs, list):
            seen_peers = []
            for ctx in dialogue_ctxs:
                if not isinstance(ctx, dict):
                    continue
                peer = ctx.get("counterparty_did", "")
                if peer and peer not in seen_peers:
                    seen_peers.append(peer)
            # D-17-12: up to 3 most-recently-interacted peers.
            for peer_did in seen_peers[:3]:
                tom_ctx = context_for(
                    target_did=peer_did,
                    store=self._iris_runtime.store,
                    k=5,
                )
                if tom_ctx.beliefs:
                    tom_contexts.append(tom_ctx)
```

Then pass `tom_context=tom_contexts` to `build_system_prompt()`:
```python
        system_prompt = build_system_prompt(
            self.psyche, self.thymos.mood, self.telos,
            grid_name=self.grid_name, location=self.location,
            bios_snapshot=bios_rt.state,
            epoch_since_spawn=epoch_since_spawn,
            subjective_multiplier=subjective_multiplier,
            tom_context=tom_contexts if tom_contexts else None,   # Phase 17 D-17-16
        )
```

**Note on on_message():** on_message() doesn't have `dialogue_ctxs` (it's a single message). Pass `tom_context=None` there (the section is omitted when None per D-17-12). No context_for() call needed in on_message() — ToM is tick-driven.

**Ordering invariant (D-17-15 vs D-17-16):** IRIS_CONTEXT_INVOKED must be emitted AFTER elicit() so belief_count reflects newly written beliefs. The context_for() call must also happen AFTER elicit() so the prompt sees the freshest beliefs. In on_tick(), the order is:
1. seed_priors block (existing)
2. elicit() loop → emits IRIS_BELIEF_REVISED, IRIS_CONTRADICTION_DETECTED, IRIS_PRIOR_SEEDED, IRIS_CONTEXT_INVOKED
3. context_for() loop → gathers tom_contexts for prompt
4. build_system_prompt() → uses tom_contexts

This means context_for() and build_system_prompt() belong AFTER the elicit() block in on_tick(). Look at on_tick() structure: currently the system prompt is NOT built in on_tick() (it's for `on_message`). In on_tick(), actions are returned directly. So the context_for() call is only needed when on_tick() generates an LLM call — i.e., in the NOOP fallback path (lines 236+) where `build_system_prompt` is called. Adjust accordingly: place the tom_contexts computation inside the NOOP fallback code path that calls `build_system_prompt`. If on_tick() never calls build_system_prompt, skip this wiring and note it in the summary — the Phase 17 prompt injection applies to on_message() and any on_tick() LLM call path. Read the actual on_tick() implementation before deciding.
  </action>
  <verify>
    <automated>python -c "
from noesis_brain.prompts.system import build_system_prompt
from noesis_brain.psyche.types import Psyche, PersonalityDimension, CommunicationStyle
from noesis_brain.thymos.types import MoodState, Emotion
from noesis_brain.telos.manager import TelosManager
import inspect
sig = inspect.signature(build_system_prompt)
assert 'tom_context' in sig.parameters, 'tom_context param missing from build_system_prompt'
print('build_system_prompt accepts tom_context:', 'tom_context' in sig.parameters)
"</automated>
  </verify>
  <done>
    - `build_system_prompt()` accepts `tom_context` kwarg (defaults to None)
    - `_theory_of_mind_section()` helper exists and returns empty string when no beliefs
    - When `tom_context` is a non-empty list, the returned prompt includes "## What You Know About Others"
    - handler.py calls `context_for()` in the appropriate prompt-build code path
    - Both files parse without syntax error
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Brain system prompt | belief.content appears in LLM system prompt — Brain-private, never serialized to Grid |
| on_tick() action list | Only hashes/counts in action.metadata; content stays in IrisStore |
| IrisRuntime.elicit() | LLM adapter call — fail-soft, returns empty ElicitResult on error |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-17-W3-01 | Information Disclosure | belief.content in system prompt | accept | System prompt is Brain-local; never serialized to AuditChain or Grid |
| T-17-W3-02 | Denial of Service | elicit() LLM failure | mitigate | try/except in elicit() loop; log.warning + continue; empty ElicitResult on error |
| T-17-W3-03 | Denial of Service | IrisStore init failure | mitigate | Optional-dep injection: if IrisStore raises, iris_db_dir=None fallback at caller |
| T-17-W3-04 | Tampering | belief_count inflation | mitigate | total_injected counts result.beliefs entries; IRIS_CONTEXT_INVOKED gated on total_injected > 0 |
</threat_model>

<verification>
```bash
# Syntax check both files
python -c "
import ast
for f in ['brain/src/noesis_brain/rpc/handler.py', 'brain/src/noesis_brain/prompts/system.py']:
    ast.parse(open(f).read())
    print(f, 'syntax ok')
"

# Verify IrisRuntime initialization path
python -c "
import sys; sys.path.insert(0, 'brain/src')
# Cannot instantiate without deps but check signature
import inspect
from noesis_brain.rpc.handler import BrainHandler
sig = inspect.signature(BrainHandler.__init__)
assert 'iris_db_dir' in sig.parameters, 'iris_db_dir missing'
print('BrainHandler.__init__ has iris_db_dir param')
"

# Verify tom_context param
python -c "
import sys; sys.path.insert(0, 'brain/src')
import inspect
from noesis_brain.prompts.system import build_system_prompt
sig = inspect.signature(build_system_prompt)
print('tom_context in signature:', 'tom_context' in sig.parameters)
"

# Verify no wall-clock in iris/
grep -r "datetime\|time\.time\|random\|uuid\.uuid4\|os\.urandom" brain/src/noesis_brain/iris/ && echo "VIOLATION" || echo "wall-clock free OK"
```
</verification>

<success_criteria>
- BrainHandler can be instantiated with `iris_db_dir="/tmp/test"` and runs elicit() on next on_tick() with dialogue_context
- build_system_prompt() produces "## What You Know About Others" section when tom_context provided
- All iris calls are guarded by `_iris_runtime is not None`
- No wall-clock references in iris/ module or newly added handler.py code
</success_criteria>

<output>
After completion, create `.planning/phases/17-iris-theory-of-mind/17-wave-3-SUMMARY.md` following the summary template.
</output>
