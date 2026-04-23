---
phase: 10b
plan: 04
type: execute
wave: 2
depends_on: [10b-02]
files_modified:
  - brain/src/noesis_brain/chronos/__init__.py
  - brain/src/noesis_brain/chronos/types.py
  - brain/src/noesis_brain/chronos/subjective_time.py
  - brain/src/noesis_brain/memory/retrieval.py
  - brain/src/noesis_brain/rpc/handler.py
  - brain/src/noesis_brain/prompts/system.py
autonomous: true
requirements: [CHRONOS-01, CHRONOS-02, CHRONOS-03]
must_haves:
  truths:
    - "Chronos subjective_multiplier computed Brain-local from curiosity + boredom Telos levels, never wired"
    - "Memory recency is tick-based: recency = exp(-(current_tick - memory.tick) / TAU) * subjective_multiplier"
    - "Zero wall-clock reads in retrieval path (datetime.now removed)"
    - "epoch_since_spawn is derived read over AuditChain cache (bios.birth tick → current_tick), not a new event"
    - "System prompt injects Bios state + epoch_since_spawn + subjective_multiplier for Nous self-awareness"
  artifacts:
    - path: "brain/src/noesis_brain/chronos/subjective_time.py"
      provides: "compute_subjective_multiplier(curiosity, boredom) → float in [0.25, 4.0]"
      contains: "def compute_subjective_multiplier"
    - path: "brain/src/noesis_brain/memory/retrieval.py"
      provides: "score_with_chronos(memory, query_embedding, current_tick, subjective_multiplier) → float"
      contains: "recency_score_by_tick"
    - path: "brain/src/noesis_brain/chronos/types.py"
      provides: "SubjectiveMultiplier bounds + CURIOSITY_BOOST / BOREDOM_PENALTY tables"
      contains: "CURIOSITY_BOOST"
  key_links:
    - from: "brain/src/noesis_brain/memory/retrieval.py"
      to: "brain/src/noesis_brain/chronos/subjective_time.py"
      via: "score_with_chronos multiplies recency by subjective_multiplier"
      pattern: "subjective_multiplier"
    - from: "brain/src/noesis_brain/rpc/handler.py"
      to: "brain/src/noesis_brain/bios/runtime.py"
      via: "_get_or_create_bios() + death_pending transition → BIOS_DEATH action"
      pattern: "_get_or_create_bios"
    - from: "brain/src/noesis_brain/prompts/system.py"
      to: "brain/src/noesis_brain/chronos/subjective_time.py"
      via: "build_system_prompt injects epoch_since_spawn + subjective_multiplier"
      pattern: "epoch_since_spawn"
---

<objective>
Create the Brain-side Chronos subjective-time subsystem and replace the datetime-based recency in `memory/retrieval.py` with tick-based scoring modulated by a Brain-local `subjective_multiplier ∈ [0.25, 4.0]` derived from curiosity + boredom Telos levels. Wire Bios runtime + death action into the RPC handler and inject epoch + multiplier into the system prompt. Turns Wave 0 stubs GREEN for: test_subjective_multiplier, test_epoch_since_spawn, chronos/no-wire-test.

Purpose: Time feels different depending on inner state (curiosity stretches, boredom compresses) — the second pillar of v2.1 Inner Life. Strictly Brain-local and read-side: no new RPC, no new event, no wire leakage.

Output: 3 new files in `brain/src/noesis_brain/chronos/`, 3 modified files (retrieval, handler, system prompt).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-CONTEXT.md
@.planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-RESEARCH.md
@.planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-PATTERNS.md
@.planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-02-SUMMARY.md

<interfaces>
<!-- Key types for executor. -->

From CONTEXT.md D-10b-05 (locked):
```
CURIOSITY_BOOST = { LOW: 0.0, MED: 1.0, HIGH: 3.0 }
BOREDOM_PENALTY = { LOW: 0.0, MED: 0.3, HIGH: 0.75 }
multiplier = clamp(1.0 + CURIOSITY_BOOST[curiosity] - BOREDOM_PENALTY[boredom], 0.25, 4.0)
```

From CONTEXT.md D-10b-07: Chronos is Brain-local ONLY.
- No chronos.* event in allowlist (enforced by 10b-03)
- No RPC exposing subjective_multiplier
- Only observable effect: biased memory retrieval ordering → different speech content

From RESEARCH.md architectural responsibility map:
- `brain/src/noesis_brain/memory/retrieval.py:34` currently uses `datetime.now(timezone.utc)`. MUST be replaced.
- Memory.tick field already exists (types.py:39). Alias as audit_tick, no schema change.

From CONTEXT.md D-10b-08: epoch_since_spawn derived read
- Compute as `current_tick - bios_birth_tick_for_did`
- bios_birth_tick sourced from AuditChain cache indexed by DID (Phase 5 index)
- No new storage, no new event

From 10b-02-SUMMARY.md (predecessor plan):
- BiosRuntime.create(seed, elevator) exists
- BiosRuntime.death_pending: bool signals starvation
- AnankeRuntime.elevate_drive(drive, level, tick) available as callback
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Chronos subsystem — subjective_time formula</name>
  <files>brain/src/noesis_brain/chronos/__init__.py, brain/src/noesis_brain/chronos/types.py, brain/src/noesis_brain/chronos/subjective_time.py</files>
  <read_first>
    - brain/src/noesis_brain/telos/types.py (Telos enum Curiosity, Boredom + TelosLevel)
    - .planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-CONTEXT.md (D-10b-05, D-10b-07)
    - .planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-RESEARCH.md (Chronos section)
  </read_first>
  <behavior>
    - compute_subjective_multiplier(curiosity_level, boredom_level) → float
    - Result always in [0.25, 4.0]
    - Pure function: same inputs → same output, no side effects
    - LOW/LOW → 1.0, HIGH/LOW → 4.0 (clamped from 1+3-0), LOW/HIGH → 0.25, HIGH/HIGH → max(0.25, 1+3-0.75)=3.25
  </behavior>
  <action>
Create `brain/src/noesis_brain/chronos/__init__.py`:
```python
"""Chronos — subjective time subsystem.

Per CONTEXT.md D-10b-07: STRICTLY Brain-local. No wire events, no RPC.
Biases memory recency ordering; no new allowlist members.
"""
from noesis_brain.chronos.types import (
    SUBJECTIVE_MULT_MIN, SUBJECTIVE_MULT_MAX,
    CURIOSITY_BOOST, BOREDOM_PENALTY,
)
from noesis_brain.chronos.subjective_time import compute_subjective_multiplier

__all__ = [
    "SUBJECTIVE_MULT_MIN", "SUBJECTIVE_MULT_MAX",
    "CURIOSITY_BOOST", "BOREDOM_PENALTY",
    "compute_subjective_multiplier",
]
```

Create `brain/src/noesis_brain/chronos/types.py`:
```python
"""Chronos constants per CONTEXT.md D-10b-05 (locked)."""
from noesis_brain.telos.types import TelosLevel

SUBJECTIVE_MULT_MIN: float = 0.25
SUBJECTIVE_MULT_MAX: float = 4.0

CURIOSITY_BOOST: dict[TelosLevel, float] = {
    TelosLevel.LOW: 0.0,
    TelosLevel.MED: 1.0,
    TelosLevel.HIGH: 3.0,
}

BOREDOM_PENALTY: dict[TelosLevel, float] = {
    TelosLevel.LOW: 0.0,
    TelosLevel.MED: 0.3,
    TelosLevel.HIGH: 0.75,
}
```

Create `brain/src/noesis_brain/chronos/subjective_time.py`:
```python
"""Pure subjective_multiplier computation. Brain-local only."""
from noesis_brain.chronos.types import (
    SUBJECTIVE_MULT_MIN, SUBJECTIVE_MULT_MAX,
    CURIOSITY_BOOST, BOREDOM_PENALTY,
)
from noesis_brain.telos.types import TelosLevel


def compute_subjective_multiplier(
    curiosity: TelosLevel,
    boredom: TelosLevel,
) -> float:
    """Per D-10b-05: clamp(1 + boost(curiosity) - penalty(boredom), 0.25, 4.0).

    Curiosity stretches time (>1 → memories feel fresher).
    Boredom compresses time (<1 → memories feel older).
    """
    raw = 1.0 + CURIOSITY_BOOST[curiosity] - BOREDOM_PENALTY[boredom]
    return max(SUBJECTIVE_MULT_MIN, min(SUBJECTIVE_MULT_MAX, raw))
```
  </action>
  <verify>
    <automated>cd brain && uv run pytest tests/chronos/test_subjective_multiplier.py tests/chronos/test_chronos_no_wire.py -q</automated>
  </verify>
  <done>Formula matches D-10b-05 for all 9 (curiosity × boredom) cases. No chronos.* symbol leaks into grid/src/audit/broadcast-allowlist.ts.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Replace datetime-based recency with tick-based + subjective multiplier</name>
  <files>brain/src/noesis_brain/memory/retrieval.py</files>
  <read_first>
    - brain/src/noesis_brain/memory/retrieval.py (full file — locate datetime.now usage at ~line 34)
    - brain/src/noesis_brain/memory/types.py (Memory.tick field at line 39)
    - brain/src/noesis_brain/chronos/subjective_time.py (from Task 1)
    - .planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-RESEARCH.md (retrieval scoring formula: α·relevance + β·(recency × subjective_multiplier) + γ·importance)
  </read_first>
  <behavior>
    - recency_score_by_tick(memory_tick, current_tick, tau=500) returns exp(-age/tau) where age = max(0, current_tick - memory_tick)
    - score_with_chronos(memory, query_embedding, current_tick, subjective_multiplier, alpha, beta, gamma) returns final score
    - Zero datetime imports; zero time.time/time.monotonic calls
    - Backward-compatible: existing score() signature preserved as thin wrapper (if used externally) OR removed with all call sites updated
  </behavior>
  <action>
Edit `brain/src/noesis_brain/memory/retrieval.py`:
- Remove `from datetime import datetime, timezone` (and any `datetime.now(...)` call at ~line 34).
- Add imports:
```python
import math
from noesis_brain.chronos import compute_subjective_multiplier
from noesis_brain.telos.types import TelosLevel
```
- Add new function above the existing score function:
```python
RECENCY_TAU = 500  # tick time constant; matches Phase 10a/10b drive/need TAU


def recency_score_by_tick(memory_tick: int, current_tick: int, tau: int = RECENCY_TAU) -> float:
    """Exponential tick-based recency. No wall-clock."""
    age = max(0, current_tick - memory_tick)
    return math.exp(-age / tau)


def score_with_chronos(
    memory,  # Memory dataclass (has .tick, .embedding, .importance)
    query_embedding,
    current_tick: int,
    subjective_multiplier: float,
    alpha: float = 1.0,
    beta: float = 0.5,
    gamma: float = 0.3,
) -> float:
    """Stanford-style weighted score with Chronos-biased recency.

    score = α·relevance + β·(recency × subjective_multiplier) + γ·importance
    Per RESEARCH.md; subjective_multiplier is Brain-local per D-10b-07.
    """
    from noesis_brain.memory.similarity import cosine_similarity  # existing util
    relevance = cosine_similarity(memory.embedding, query_embedding)
    recency = recency_score_by_tick(memory.tick, current_tick)
    return (
        alpha * relevance
        + beta * recency * subjective_multiplier
        + gamma * memory.importance
    )
```
- Replace any existing `score(memory, query_embedding)` usage with a call to `score_with_chronos(memory, query_embedding, current_tick, subjective_multiplier)` at call sites. If `score()` is still needed for legacy tests, keep it as a wrapper with `subjective_multiplier=1.0` and `current_tick=memory.tick` (returns relevance-only + baseline recency).
- Ensure NO `datetime`, `time.time`, `time.monotonic` remain in this file.
  </action>
  <verify>
    <automated>cd brain && uv run pytest tests/memory/ tests/chronos/ -q && rg "datetime|time\\.time" brain/src/noesis_brain/memory/retrieval.py || echo "CLEAN"</automated>
  </verify>
  <done>retrieval.py has zero wall-clock reads. score_with_chronos multiplies recency by subjective_multiplier. All memory + chronos tests pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Wire BiosRuntime + Chronos into handler + system prompt</name>
  <files>brain/src/noesis_brain/rpc/handler.py, brain/src/noesis_brain/prompts/system.py</files>
  <read_first>
    - brain/src/noesis_brain/rpc/handler.py (full — locate tick handler + retrieval call sites + existing _get_or_create_ananke pattern)
    - brain/src/noesis_brain/prompts/system.py (full — locate build_system_prompt)
    - brain/src/noesis_brain/bios/runtime.py (BiosRuntime.step, death_pending — from 10b-02)
    - brain/src/noesis_brain/chronos/subjective_time.py (from Task 1)
    - .planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-CONTEXT.md (D-10b-08 epoch_since_spawn derived, D-10b-09 starvation→BIOS_DEATH action)
  </read_first>
  <behavior>
    - handler maintains per-DID BiosRuntime via _get_or_create_bios(did) — mirrors existing ananke pattern
    - Each tick: handler calls bios.step(current_tick), checks death_pending, on True enqueues BIOS_DEATH action with cause='starvation' and final_state_hash
    - Retrieval: handler computes subjective_multiplier from current Telos levels (curiosity, boredom) and passes to score_with_chronos
    - build_system_prompt receives (bios_snapshot, epoch_since_spawn_ticks, subjective_multiplier) and injects them as Nous self-awareness section
    - epoch_since_spawn_ticks computed as current_tick - bios_birth_tick (looked up in audit chain cache by DID)
    - No new RPC method, no new audit event (just a new internal action for starvation consumed by existing operator-like pipeline that calls appendBiosDeath via Grid emitter in plan 10b-05)
  </behavior>
  <action>
Edit `brain/src/noesis_brain/rpc/handler.py`:
- Add imports:
```python
from noesis_brain.bios import BiosRuntime
from noesis_brain.chronos import compute_subjective_multiplier
from noesis_brain.memory.retrieval import score_with_chronos
```
- Add per-DID cache (mirrors existing _anankes dict):
```python
self._bioses: dict[str, BiosRuntime] = {}

def _get_or_create_bios(self, did: str, seed: int) -> BiosRuntime:
    if did not in self._bioses:
        ananke = self._get_or_create_ananke(did, seed)
        self._bioses[did] = BiosRuntime.create(seed=seed, elevator=ananke.elevate_drive)
    return self._bioses[did]
```
- In the tick handler, after existing ananke.step, add:
```python
bios = self._get_or_create_bios(did, seed)
bios_crossings = bios.step(current_tick)
if bios.death_pending:
    # D-10b-09: starvation death — enqueue BIOS_DEATH action (consumed by Grid plan 10b-05)
    final_state_hash = self._compute_final_state_hash(did, current_tick)
    self._pending_actions.append({
        'type': 'BIOS_DEATH',
        'did': did,
        'tick': current_tick,
        'cause': 'starvation',
        'final_state_hash': final_state_hash,
    })
    bios.death_pending = False  # consume; Grid-side handler will tombstone
```
- At retrieval call sites, replace legacy `score(memory, query_embedding)` with:
```python
curiosity_level = telos.states[Telos.CURIOSITY].level
boredom_level = telos.states[Telos.BOREDOM].level
subjective_multiplier = compute_subjective_multiplier(curiosity_level, boredom_level)
scored = [
    (score_with_chronos(m, query_embedding, current_tick, subjective_multiplier), m)
    for m in candidate_memories
]
```
- In the prompt-building path, compute epoch_since_spawn (derived read):
```python
bios_birth_tick = self._audit_chain_cache.first_tick_for('bios.birth', did)  # Phase 5 index
epoch_since_spawn = max(0, current_tick - bios_birth_tick)
```
- Pass to build_system_prompt(..., bios_snapshot=bios.states, epoch_since_spawn=epoch_since_spawn, subjective_multiplier=subjective_multiplier).

Edit `brain/src/noesis_brain/prompts/system.py`:
- Extend `build_system_prompt` signature with keyword args `bios_snapshot`, `epoch_since_spawn`, `subjective_multiplier` (default None for backward compat during rollout).
- Add a new section to the prompt template:
```python
if bios_snapshot is not None:
    parts.append(
        f"\n## Your body (Bios)\n"
        f"- energy: {bios_snapshot[Need.ENERGY].level.value}\n"
        f"- sustenance: {bios_snapshot[Need.SUSTENANCE].level.value}\n"
    )
if epoch_since_spawn is not None:
    parts.append(f"- ticks since your birth: {epoch_since_spawn}\n")
if subjective_multiplier is not None:
    parts.append(f"- subjective time sense: {subjective_multiplier:.2f}× (1.0 = neutral)\n")
```
- Do NOT include raw need values (value float) — only level buckets per BIOS_FORBIDDEN_KEYS discipline, even though prompt is Brain-local (defense-in-depth).
  </action>
  <verify>
    <automated>cd brain && uv run pytest tests/rpc/ tests/chronos/test_epoch_since_spawn.py tests/bios/ -q</automated>
  </verify>
  <done>Handler creates per-DID BiosRuntime, steps each tick, enqueues BIOS_DEATH on starvation. Retrieval uses score_with_chronos. System prompt has Bios + epoch + subjective_multiplier sections. No raw float values in prompt text.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Brain process boundary | Chronos state never crosses — no RPC, no event |
| Memory retrieval | Subjective multiplier modulates scoring; must not leak via prompt text |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10b-04-01 | Information Disclosure | subjective_multiplier leaks via prompt/RPC | mitigate | CHRONOS_FORBIDDEN_KEYS grep-gate in plan 10b-03; prompt shows rounded bucket not raw float |
| T-10b-04-02 | Tampering | Determinism broken by wall-clock in retrieval | mitigate | Grep `rg "datetime\\|time\\.time" brain/src/noesis_brain/memory/` returns zero |
| T-10b-04-03 | Denial of Service | death_pending re-fires every tick | mitigate | Handler consumes flag (sets False) after enqueueing BIOS_DEATH |
| T-10b-04-04 | Elevation of Privilege | Prompt injection via Bios state | accept | Bios levels are enum values ('low'/'med'/'high'), untamperable strings |
</threat_model>

<verification>
- `cd brain && uv run pytest tests/chronos/ tests/bios/ tests/memory/ tests/rpc/ -q` — all GREEN
- `rg "datetime|time\\.time|time\\.monotonic" brain/src/noesis_brain/memory/retrieval.py brain/src/noesis_brain/chronos/` returns zero matches
- `rg "chronos\\.\\w+" grid/src/audit/broadcast-allowlist.ts` returns zero matches (no wire leak)
- `rg "_get_or_create_bios" brain/src/noesis_brain/rpc/handler.py` returns ≥1 match
- `rg "epoch_since_spawn" brain/src/noesis_brain/prompts/system.py` returns ≥1 match
</verification>

<success_criteria>
- Chronos subsystem computes subjective_multiplier per D-10b-05 formula, clamped to [0.25, 4.0]
- Memory retrieval is fully tick-based, biased by subjective_multiplier
- epoch_since_spawn is a derived read from AuditChain cache (no new storage)
- Starvation death enqueues BIOS_DEATH action (Grid plan 10b-05 emits actual bios.death event)
- System prompt exposes Bios + epoch + subjective_multiplier in bucket/rounded form
- Zero chronos.* events on the wire; zero wall-clock reads in retrieval
</success_criteria>

<output>
After completion, create `.planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-04-SUMMARY.md`
</output>
