---
phase: 10a-ananke-drives-inner-life-part-1
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - brain/src/noesis_brain/ananke/__init__.py
  - brain/src/noesis_brain/ananke/types.py
  - brain/src/noesis_brain/ananke/config.py
  - brain/src/noesis_brain/ananke/drives.py
  - brain/src/noesis_brain/ananke/runtime.py
  - brain/test/ananke/__init__.py
  - brain/test/ananke/conftest.py
  - brain/test/ananke/test_drives_determinism.py
  - brain/test/ananke/test_drives_bounds.py
  - brain/test/ananke/test_drives_threshold_crossing.py
autonomous: true
requirements: [DRIVE-01, DRIVE-02]
schema_push: not_applicable
user_setup: []

must_haves:
  truths:
    - "Given (seed, tick) the five drive values are a pure deterministic function (no wall-clock, no Math.random, no external I/O)"
    - "Drive trace at tickRateMs=1000 is byte-identical to tickRateMs=1_000_000 for the same seed"
    - "Drive values remain in the closed interval [0.0, 1.0] across 10_000 simulated ticks (property test)"
    - "Threshold-crossing detector returns (drive, from_level, to_level, direction) tuples — and only on bucket changes, never per-tick"
    - "Five drive names are a frozen closed enum: hunger, curiosity, safety, boredom, loneliness (no 6th)"
  artifacts:
    - path: brain/src/noesis_brain/ananke/__init__.py
      provides: "Ananke package marker; exports DRIVE_NAMES, DriveLevel, DriveState"
      min_lines: 10
    - path: brain/src/noesis_brain/ananke/types.py
      provides: "Closed enum DriveName, DriveLevel; DriveState dataclass; CrossingEvent dataclass"
      min_lines: 40
    - path: brain/src/noesis_brain/ananke/config.py
      provides: "DRIVE_BASELINES, DRIVE_RISE_RATES, THRESHOLD_LOW, THRESHOLD_HIGH, HYSTERESIS_BAND, pre-computed DECAY_FACTOR"
      min_lines: 30
    - path: brain/src/noesis_brain/ananke/drives.py
      provides: "Pure step(state, seed, tick) function; bucket(value, prev_level) function; detect_crossing() function"
      min_lines: 80
    - path: brain/src/noesis_brain/ananke/runtime.py
      provides: "AnankeRuntime class holding per-(did) DriveState and crossings queue; on_tick(tick) method"
      min_lines: 60
    - path: brain/test/ananke/test_drives_determinism.py
      provides: "Replay harness — same (seed, tick) produces byte-identical 10_000-tick trace across two simulated tick rates"
      min_lines: 40
    - path: brain/test/ananke/test_drives_bounds.py
      provides: "Property test — drive ∈ [0.0, 1.0] over 10_000 ticks × 5 drives × 20 seeds"
      min_lines: 30
    - path: brain/test/ananke/test_drives_threshold_crossing.py
      provides: "Crossing events emitted only on bucket change; hysteresis band prevents chatter at 0.33 ± 0.02 and 0.66 ± 0.02"
      min_lines: 50
  key_links:
    - from: brain/src/noesis_brain/ananke/runtime.py
      to: brain/src/noesis_brain/ananke/drives.py
      via: "runtime calls step() then detect_crossing() per drive per tick"
      pattern: "from .drives import step, detect_crossing"
    - from: brain/src/noesis_brain/ananke/drives.py
      to: brain/src/noesis_brain/ananke/config.py
      via: "drives imports DECAY_FACTOR, baselines, thresholds — no magic numbers in drives.py"
      pattern: "from .config import"
    - from: brain/test/ananke/test_drives_determinism.py
      to: brain/src/noesis_brain/ananke/runtime.py
      via: "test instantiates AnankeRuntime twice with same seed and asserts trace equality"
      pattern: "AnankeRuntime"
---

<objective>
Build the Brain-side Ananke subsystem as a sibling of `psyche/`, `telos/`, `thymos/`. This plan produces ONLY pure deterministic drive math — no RPC wiring, no Grid dispatch, no allowlist changes. The outputs of this plan are: (a) a closed enum of 5 drives, (b) a pure `step(state, seed, tick) → DriveState` recurrence, (c) a threshold-crossing detector returning `CrossingEvent` tuples, (d) a runtime holding per-DID state and a crossings queue.

Purpose: DRIVE-01 (pure Python, closed enum, no external libs) + DRIVE-02 (deterministic (seed, tick) recurrence, byte-identical replay, monotonic rise with passive baseline pull). This plan is the mathematical core every downstream plan depends on.

Output: 10 files (5 source + 5 test). Brain test suite passes with `cd brain && pytest test/ananke -q` in < 30s.
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
@brain/src/noesis_brain/psyche/types.py
@brain/src/noesis_brain/psyche/loader.py

<locked_decisions>
From 10a-CONTEXT.md:
- **D-10a-01:** Rise-only with passive baseline decay. Piecewise recurrence:
  - If `prev < baseline`: `next = baseline + (prev - baseline) * DECAY_FACTOR` (baseline pulls UP toward itself)
  - If `prev >= baseline`: `next = prev + rise_rate` (pure monotonic rise above baseline)
  - Clamp to `[0.0, 1.0]`.
  - `DECAY_FACTOR = exp(-1/tau)` is pre-computed at config load; `math.exp` MUST NOT appear in the hot per-tick path.
- **D-10a-02:** Pure Python; no external libraries beyond stdlib `math`, `dataclasses`, `enum`, `typing`, `hashlib`.
- **D-10a-05:** Wall-clock ban — `time.time`, `time.monotonic`, `time.sleep`, `datetime.now`, `random.random` (without explicit seed) FORBIDDEN in `brain/src/noesis_brain/ananke/**`.

Per-drive baselines (locked): hunger=0.3, curiosity=0.5, safety=0.2, boredom=0.4, loneliness=0.4.

Per-drive rise rates (locked by planner — ship default):
hunger=0.0003, curiosity=0.0002, safety=0.0001, boredom=0.0002, loneliness=0.0002.
Rationale: at 0.0003/tick, hunger reaches 1.0 from baseline 0.3 in ~2333 ticks, giving the RIG 10_000-tick run ~4 crossings/drive — non-degenerate, not saturated.

Threshold geometry (locked): equal thirds at 0.33 and 0.66 with `HYSTERESIS_BAND = 0.02`.
Hysteresis rule: a drive at level `med` drops to `low` only when value < 0.33 - 0.02 = 0.31; rises from `med` to `high` only when value > 0.66 + 0.02 = 0.68. Prevents boundary chatter.

Tau (baseline relaxation time-constant, locked): `tau = 500 ticks`. So `DECAY_FACTOR = exp(-1/500) ≈ 0.998001998...`.
</locked_decisions>

<analog_sources>
**Subsystem layout clone** — `brain/src/noesis_brain/psyche/` has `__init__.py`, `loader.py`, `types.py`. Ananke MUST follow the identical file layout plus `config.py`, `drives.py`, `runtime.py`. Use `psyche/types.py` as the dataclass + Enum style guide (frozen dataclasses, `from __future__ import annotations`, explicit type hints).

**Determinism precedent** — Phase 9 `grid/src/relationships/decay.ts` (read this file for conceptual shape only; do NOT port its code — Ananke is Python-side): `weight × exp(-Δtick/τ)` computed lazily from `(seed, tick)` with zero wall-clock reads. Ananke clones this discipline — one deterministic update per tick, replay-identical.

**Closed enum precedent** — `brain/src/noesis_brain/rpc/types.py` `ActionType(str, Enum)` is the idiomatic Brain closed-enum style. Clone exactly: `class DriveName(str, Enum)` with 5 members.
</analog_sources>

<interfaces>
<!-- Executor implements against these exact shapes. No codebase exploration needed. -->

```python
# brain/src/noesis_brain/ananke/types.py

from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum


class DriveName(str, Enum):
    HUNGER = "hunger"
    CURIOSITY = "curiosity"
    SAFETY = "safety"
    BOREDOM = "boredom"
    LONELINESS = "loneliness"


class DriveLevel(str, Enum):
    LOW = "low"
    MED = "med"
    HIGH = "high"


class Direction(str, Enum):
    RISING = "rising"
    FALLING = "falling"


# Stable iteration order — matches DRIVE_ORDER in UI-SPEC and REQUIREMENTS DRIVE-01.
DRIVE_NAMES: tuple[DriveName, ...] = (
    DriveName.HUNGER,
    DriveName.CURIOSITY,
    DriveName.SAFETY,
    DriveName.BOREDOM,
    DriveName.LONELINESS,
)


@dataclass(frozen=True)
class DriveState:
    """Per-DID, per-tick drive values and their bucketed levels.

    `values` maps each DriveName → float in [0.0, 1.0].
    `levels` maps each DriveName → DriveLevel (the last-committed bucket).
    """
    values: dict[DriveName, float]
    levels: dict[DriveName, DriveLevel]


@dataclass(frozen=True)
class CrossingEvent:
    """Emitted ONLY when a drive's bucket changes (hysteresis-guarded).

    Closed 3-tuple from Brain's perspective — Grid injects `did` and `tick`
    when it converts this to an `ananke.drive_crossed` audit entry.
    """
    drive: DriveName
    level: DriveLevel         # the NEW level (after the crossing)
    direction: Direction
```

```python
# brain/src/noesis_brain/ananke/config.py

from __future__ import annotations
import math
from .types import DriveName


# Per-drive passive baselines — the "elastic floor" each drive relaxes toward.
DRIVE_BASELINES: dict[DriveName, float] = {
    DriveName.HUNGER: 0.3,
    DriveName.CURIOSITY: 0.5,
    DriveName.SAFETY: 0.2,
    DriveName.BOREDOM: 0.4,
    DriveName.LONELINESS: 0.4,
}

# Per-drive rise rates (above-baseline growth per tick).
DRIVE_RISE_RATES: dict[DriveName, float] = {
    DriveName.HUNGER: 0.0003,
    DriveName.CURIOSITY: 0.0002,
    DriveName.SAFETY: 0.0001,
    DriveName.BOREDOM: 0.0002,
    DriveName.LONELINESS: 0.0002,
}

# Threshold geometry — equal thirds with ±HYSTERESIS_BAND guard.
THRESHOLD_LOW: float = 0.33
THRESHOLD_HIGH: float = 0.66
HYSTERESIS_BAND: float = 0.02

# Baseline relaxation time-constant (ticks).
TAU: int = 500

# Pre-computed at module load — `math.exp` MUST NOT appear on the hot path.
DECAY_FACTOR: float = math.exp(-1.0 / TAU)
```

```python
# brain/src/noesis_brain/ananke/drives.py

from __future__ import annotations
from .config import (
    DRIVE_BASELINES, DRIVE_RISE_RATES,
    THRESHOLD_LOW, THRESHOLD_HIGH, HYSTERESIS_BAND, DECAY_FACTOR,
)
from .types import (
    DriveName, DriveLevel, Direction, DriveState, CrossingEvent, DRIVE_NAMES,
)


def step(state: DriveState, seed: int, tick: int) -> DriveState:
    """Pure, deterministic per-tick update.

    NO wall-clock reads. NO random. The (seed, tick) arguments are reserved
    for future seed-conditioned perturbations; in 10a the update is seed-
    independent, but the signature is locked so downstream callers use it
    consistently.
    """
    new_values: dict[DriveName, float] = {}
    for drive in DRIVE_NAMES:
        prev = state.values[drive]
        baseline = DRIVE_BASELINES[drive]
        if prev < baseline:
            nxt = baseline + (prev - baseline) * DECAY_FACTOR
        else:
            nxt = prev + DRIVE_RISE_RATES[drive]
        # Clamp.
        if nxt < 0.0:
            nxt = 0.0
        elif nxt > 1.0:
            nxt = 1.0
        new_values[drive] = nxt
    # Re-bucket every tick with hysteresis; levels are committed by
    # detect_crossing() which returns (new_state, crossings).
    new_levels = {d: state.levels[d] for d in DRIVE_NAMES}
    return DriveState(values=new_values, levels=new_levels)


def bucket(value: float, prev_level: DriveLevel) -> DriveLevel:
    """Hysteresis-guarded bucketing.

    The guard prevents a drive hovering at ~0.33 from emitting a crossing every
    other tick. A level is only left when the value crosses the outer edge of
    the hysteresis band; re-entry is cheap.
    """
    if prev_level == DriveLevel.LOW:
        # Leave LOW only when value exceeds THRESHOLD_LOW + band.
        if value > THRESHOLD_LOW + HYSTERESIS_BAND:
            return DriveLevel.HIGH if value > THRESHOLD_HIGH + HYSTERESIS_BAND else DriveLevel.MED
        return DriveLevel.LOW
    if prev_level == DriveLevel.MED:
        # Leave MED when crossing either outer band edge.
        if value < THRESHOLD_LOW - HYSTERESIS_BAND:
            return DriveLevel.LOW
        if value > THRESHOLD_HIGH + HYSTERESIS_BAND:
            return DriveLevel.HIGH
        return DriveLevel.MED
    # HIGH
    if value < THRESHOLD_HIGH - HYSTERESIS_BAND:
        return DriveLevel.LOW if value < THRESHOLD_LOW - HYSTERESIS_BAND else DriveLevel.MED
    return DriveLevel.HIGH


def detect_crossing(
    state: DriveState,
) -> tuple[DriveState, list[CrossingEvent]]:
    """Apply bucketing to the state's current values; return (new_state,
    crossings). A crossing is emitted only when the bucket changes.
    """
    crossings: list[CrossingEvent] = []
    new_levels: dict[DriveName, DriveLevel] = {}
    for drive in DRIVE_NAMES:
        old_level = state.levels[drive]
        new_level = bucket(state.values[drive], old_level)
        new_levels[drive] = new_level
        if new_level != old_level:
            # Direction is derived from the bucket ordinal, not the float.
            going_up = (
                (old_level == DriveLevel.LOW and new_level != DriveLevel.LOW)
                or (old_level == DriveLevel.MED and new_level == DriveLevel.HIGH)
            )
            direction = Direction.RISING if going_up else Direction.FALLING
            crossings.append(CrossingEvent(drive=drive, level=new_level, direction=direction))
    new_state = DriveState(values=state.values, levels=new_levels)
    return new_state, crossings


def initial_state() -> DriveState:
    """First-life drive vector — every drive at its baseline, every level
    is the bucketed baseline. Psyche/Big Five coupling is deferred (D-10a-01).
    """
    values = {d: DRIVE_BASELINES[d] for d in DRIVE_NAMES}
    levels = {d: bucket(DRIVE_BASELINES[d], DriveLevel.LOW) for d in DRIVE_NAMES}
    # The seed bucket call above deliberately starts from LOW so the bucketing
    # settles into the correct initial tier; because hysteresis only applies
    # when leaving a level, starting from LOW means a baseline > 0.33 + 0.02
    # goes straight to MED on the first real tick — desired.
    return DriveState(values=values, levels=levels)
```

```python
# brain/src/noesis_brain/ananke/runtime.py

from __future__ import annotations
from dataclasses import dataclass, field
from .drives import step, detect_crossing, initial_state
from .types import CrossingEvent, DriveState


@dataclass
class AnankeRuntime:
    """Per-Nous drive runtime. One instance per DID.

    The runtime keeps per-DID DriveState and a queue of pending crossings.
    on_tick(seed, tick) steps the state and appends any crossings to the
    queue. drain_crossings() returns and clears the queue (for the RPC
    handler to lift into Action metadata).
    """
    seed: int
    state: DriveState = field(default_factory=initial_state)
    _crossings: list[CrossingEvent] = field(default_factory=list)

    def on_tick(self, tick: int) -> None:
        stepped = step(self.state, self.seed, tick)
        self.state, new_crossings = detect_crossing(stepped)
        if new_crossings:
            self._crossings.extend(new_crossings)

    def drain_crossings(self) -> list[CrossingEvent]:
        out = self._crossings
        self._crossings = []
        return out
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create Ananke package skeleton — types, config, drives (pure functions)</name>
  <files>
    brain/src/noesis_brain/ananke/__init__.py,
    brain/src/noesis_brain/ananke/types.py,
    brain/src/noesis_brain/ananke/config.py,
    brain/src/noesis_brain/ananke/drives.py
  </files>
  <read_first>
    - Read `brain/src/noesis_brain/psyche/__init__.py`, `psyche/types.py`, `psyche/loader.py` to confirm the Brain subsystem idiom (`from __future__ import annotations`, frozen dataclasses, explicit `__all__`, no implicit re-exports).
    - Read `brain/src/noesis_brain/rpc/types.py` lines 10–18 for the `ActionType(str, Enum)` closed-enum precedent.
    - Read `brain/pyproject.toml` to confirm the Python version and any linter directives that apply to new subsystem files.
  </read_first>
  <behavior>
    - A module-level `DRIVE_NAMES: tuple[DriveName, ...]` tuple exists and has exactly 5 entries in the order hunger, curiosity, safety, boredom, loneliness.
    - `DriveName(str, Enum)`, `DriveLevel(str, Enum)`, `Direction(str, Enum)` are closed enums — adding `DriveName.ENERGY` to a test stub fails a `closed-enum` assertion (no 6th).
    - `DRIVE_BASELINES[DriveName.HUNGER] == 0.3` (and the other four baselines match the locked table).
    - `DECAY_FACTOR` is a module-level float computed once at import; `abs(DECAY_FACTOR - math.exp(-1/500)) < 1e-15`.
    - `math.exp` does NOT appear in `drives.py` (compiled-once decay factor).
    - `step(initial_state(), seed=0, tick=1)` returns a new `DriveState` where every value is `baseline + (baseline - baseline) * DECAY_FACTOR == baseline` for drives where `prev == baseline` (edge case: `prev < baseline` is False at equality, so all drives take the `>= baseline` branch and rise by their rise-rate). Specifically: for hunger at baseline 0.3, next value is `0.3 + 0.0003 = 0.3003`.
    - `bucket(0.34, DriveLevel.LOW)` → `DriveLevel.MED` (0.34 > 0.33 + 0.02 = 0.35? No — 0.34 < 0.35, so returns `LOW`). Hysteresis holds.
    - `bucket(0.36, DriveLevel.LOW)` → `DriveLevel.MED` (0.36 > 0.35).
    - `bucket(0.32, DriveLevel.MED)` → `DriveLevel.MED` (still within hysteresis band; 0.32 > 0.31 = 0.33 - 0.02).
    - `bucket(0.30, DriveLevel.MED)` → `DriveLevel.LOW` (0.30 < 0.31).
  </behavior>
  <action>
    Create the four files with the exact interfaces declared in the `<interfaces>` block above. Specific implementation rules:

    1. **`__init__.py`** (per D-10a-02, minimal surface):
       ```python
       """Ananke — deterministic drive dynamics subsystem (Phase 10a).

       Pure Python, stdlib only. Hash-only cross-boundary (DRIVE-05).
       See PHILOSOPHY.md §6 — drives are advisory, not coercive.
       """
       from .types import DriveName, DriveLevel, Direction, DriveState, CrossingEvent, DRIVE_NAMES
       from .drives import step, bucket, detect_crossing, initial_state

       __all__ = [
           "DriveName", "DriveLevel", "Direction",
           "DriveState", "CrossingEvent", "DRIVE_NAMES",
           "step", "bucket", "detect_crossing", "initial_state",
       ]
       ```

    2. **`types.py`** — use the exact code in the `<interfaces>` block.

    3. **`config.py`** — use the exact code in the `<interfaces>` block. The `DECAY_FACTOR` is computed ONCE at module load; this is the only `math.exp` call in the entire subsystem.

    4. **`drives.py`** — use the exact code in the `<interfaces>` block. Critical implementation details:
       - The `>=` branch in `step` means when `prev == baseline`, we take the RISE branch (not the decay branch). This is intentional: at exact equality, which branch we take is moot mathematically since `(baseline - baseline) * DECAY_FACTOR == 0` and adding 0 to baseline also equals baseline — but the semantic "rise above baseline" branch is the right one conceptually (we're ABOVE-OR-AT baseline → pure rise).
       - `bucket()` uses `prev_level` to choose which side of the hysteresis band to compare. This is what keeps a drive at ~0.33 from chattering.
       - `detect_crossing` never emits a `Direction` from floats — direction is derived from bucket ordinal transitions, preserving the hash-only cross-boundary invariant (DRIVE-05).
       - `initial_state()` calls `bucket(baseline, DriveLevel.LOW)` — starting from LOW means a baseline > 0.35 settles into MED on first-paint (curiosity=0.5 → MED, boredom=0.4 → MED, loneliness=0.4 → MED, hunger=0.3 → LOW, safety=0.2 → LOW).

    NO file may `import time`, `import random`, `from datetime import ...` — this is enforced by the grep gate in Plan 10a-06. NO magic numbers in `drives.py`; everything flows through `config.py`.
  </action>
  <verify>
    <automated>cd brain && pytest test/ananke/ -q --no-header 2>&1 | head -30</automated>
    <!-- test/ananke/ does not exist yet; this command is a smoke check that the package imports cleanly. -->
    <manual>python -c "from noesis_brain.ananke import DRIVE_NAMES, step, detect_crossing, initial_state; s = initial_state(); print(len(DRIVE_NAMES), len(s.values))"</manual>
  </verify>
  <acceptance_criteria>
    - `python -c "from noesis_brain.ananke import *; print(len(DRIVE_NAMES))"` prints `5`.
    - `python -c "from noesis_brain.ananke import DRIVE_NAMES, DriveName; assert tuple(d.value for d in DRIVE_NAMES) == ('hunger','curiosity','safety','boredom','loneliness')"` exits 0.
    - `grep -rn "math\.exp\|time\.\|datetime\|random\." brain/src/noesis_brain/ananke/` returns ONLY the single `math.exp` call in `config.py` (and zero time/datetime/random matches).
    - `wc -l brain/src/noesis_brain/ananke/*.py` shows each file meets its `min_lines` target.
    - `python -c "from noesis_brain.ananke.config import DECAY_FACTOR; import math; assert abs(DECAY_FACTOR - math.exp(-1/500)) < 1e-15"` exits 0.
  </acceptance_criteria>
  <done>
    Four Python files created under `brain/src/noesis_brain/ananke/`. Package imports cleanly. `DRIVE_NAMES` closed enum is 5-tuple in canonical order. `DECAY_FACTOR` is pre-computed; `math.exp` appears exactly once (in config.py) and nowhere else in the subsystem.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create AnankeRuntime and determinism test suite</name>
  <files>
    brain/src/noesis_brain/ananke/runtime.py,
    brain/test/ananke/__init__.py,
    brain/test/ananke/conftest.py,
    brain/test/ananke/test_drives_determinism.py,
    brain/test/ananke/test_drives_bounds.py,
    brain/test/ananke/test_drives_threshold_crossing.py
  </files>
  <read_first>
    - Read `brain/test/test_thymos.py` and `brain/test/test_telos.py` for the Brain pytest idiom (flat test modules, no `tests/` subdir except when subsystem-specific — `test/ananke/` is a new subdir, which is the clone of the runtime pattern).
    - Read `brain/test/__pycache__` presence to confirm tests run at `brain/test/`, not `brain/tests/`. (VALIDATION.md proposed `tests/` but the actual convention is `test/` — use the actual convention.)
    - Read `brain/pyproject.toml` `[tool.pytest.ini_options]` to confirm `testpaths` configuration and whether subdir discovery needs a `conftest.py` or `__init__.py`.
  </read_first>
  <behavior>
    - **Replay identity test:** Two `AnankeRuntime(seed=42)` instances, stepped 10_000 ticks each, produce byte-identical final `DriveState.values` dicts (assert `json.dumps(sorted(...)) == json.dumps(sorted(...))`).
    - **Two-tick-rate equivalence:** The tick number is a pure integer input to `step`; `runtime.on_tick(1)` then `runtime.on_tick(2)` produces identical state to a runtime that simulates ticks 1..2 with any notion of wall-clock between them. This is trivially true by construction, but the test must explicitly assert no wall-clock coupling exists (sleep 0.1s between ticks, confirm identical output).
    - **Bounds property test:** For 20 distinct seeds × 10_000 ticks × 5 drives = 1_000_000 observations, every value lies in `[0.0, 1.0]`.
    - **Threshold-crossing-count test:** Over 10_000 ticks with default rise rates, hunger (baseline 0.3, rise 0.0003) crosses LOW→MED around tick ~177 (0.3 + 177*0.0003 = 0.3531 > 0.35) and MED→HIGH around tick ~1267 (0.3 + 1267*0.0003 = 0.6801 > 0.68). Assert 2 crossings for hunger over 10_000 ticks (LOW→MED and MED→HIGH; no oscillation because rise is monotonic above baseline).
    - **Hysteresis chatter test:** Construct an artificial trajectory where a drive oscillates around 0.33 (e.g., by manually setting values to [0.32, 0.34, 0.32, 0.34, ...]). Assert that `detect_crossing` emits AT MOST ONE crossing, not N/2.
    - **Audit-size ceiling pre-check:** 1000 ticks × 5 drives × 1 Nous yields AT MOST 10 crossings with default rise rates (each drive has at most 2 tier transitions in 1000 ticks). This is the Brain-side upper bound that the Grid-side ceiling test (Plan 10a-06) depends on; fail here if the bound is exceeded.
  </behavior>
  <action>
    1. **`runtime.py`** — use the exact `AnankeRuntime` code from the `<interfaces>` block.

    2. **`brain/test/ananke/__init__.py`** — empty file (marker).

    3. **`brain/test/ananke/conftest.py`** — shared fixtures:
       ```python
       import pytest
       from noesis_brain.ananke import AnankeRuntime

       @pytest.fixture
       def runtime_seed_42() -> AnankeRuntime:
           return AnankeRuntime(seed=42)
       ```

    4. **`test_drives_determinism.py`** — three tests:
       - `test_replay_identity`: two runtimes with seed=42, each stepped 10_000 ticks; assert final `state.values` dicts are byte-identical (compare via `json.dumps(sorted(state.values.items(), key=lambda kv: kv[0].value))`).
       - `test_no_wall_clock_coupling`: step runtime A 10_000 ticks rapidly; step runtime B 10_000 ticks with a `time.sleep(0.001)` between ticks; assert final states identical.
       - `test_seed_independence_v1`: in 10a, seed is reserved but unused by the math; confirm `AnankeRuntime(seed=0)` and `AnankeRuntime(seed=999)` produce identical traces (locks current behavior — a future phase may introduce seed-conditioned perturbation, at which point this test flips to assert divergence).

    5. **`test_drives_bounds.py`** — one parametrized test:
       - `@pytest.mark.parametrize("seed", range(20))` + `test_drive_values_stay_bounded(seed)`: step 10_000 ticks, assert every value in `state.values.values()` is in `[0.0, 1.0]` at every tick (not just final). Use a helper that steps one tick at a time and asserts after each.

    6. **`test_drives_threshold_crossing.py`** — three tests:
       - `test_crossing_emitted_only_on_bucket_change`: construct an artificial `DriveState` with hunger at 0.34 (LOW bucket), level=LOW; call `detect_crossing` repeatedly with identical state — assert zero crossings emitted.
       - `test_hysteresis_prevents_chatter`: construct a DriveState where hunger value oscillates across the 0.33 boundary without ever exceeding the hysteresis band (0.31 to 0.34); apply bucket() in a loop with the previous level fed forward — assert bucket stays LOW throughout.
       - `test_audit_size_ceiling_brain_side`: step 1 runtime 1000 ticks; assert `len(all_crossings_collected) <= 10` (the Grid-side `<=50` ceiling has a 5× margin; Brain-side is the strict upper bound).
       - `test_default_rise_rate_produces_expected_crossings`: step hunger 10_000 ticks, collect crossings, assert the list equals `[CrossingEvent(HUNGER, MED, RISING), CrossingEvent(HUNGER, HIGH, RISING)]` (exactly two, order-locked).
  </action>
  <verify>
    <automated>cd brain && pytest test/ananke/ -q</automated>
  </verify>
  <acceptance_criteria>
    - `cd brain && pytest test/ananke/ -q` exits 0 with ≥ 6 passing tests.
    - `grep -rn "time\.\|datetime\|random\.\b" brain/src/noesis_brain/ananke/` returns zero matches (the test file may import `time.sleep` for the wall-clock-coupling test, but the subsystem source MUST NOT).
    - `brain/test/ananke/test_drives_determinism.py::test_replay_identity` runs in < 5 seconds.
    - `brain/test/ananke/test_drives_bounds.py` runs in < 15 seconds across all 20 seed permutations.
    - The audit-size-ceiling Brain-side test asserts `<= 10` crossings per 1000 ticks (this bound is what the Grid-side `<=50` ceiling test in Plan 10a-06 inherits).
  </acceptance_criteria>
  <done>
    `AnankeRuntime` class exists. 5 test modules under `brain/test/ananke/` pass. Determinism is proven byte-identically across 10_000 ticks. Hysteresis chatter is measurably absent. Audit size ceiling Brain-side is ≤ 10 crossings per 1000 ticks (strict bound).
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Brain-internal (pre-RPC) | Drive math lives inside the Brain process. No bytes leave this boundary in Plan 10a-01. Payload shaping (which crosses the wire) is Plan 10a-04's responsibility. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10a-01 | Tampering | `ananke/drives.py` pure step function | mitigate | Pure function, no external I/O, no global state. Determinism tests (`test_drives_determinism.py::test_replay_identity`) assert byte-identical output across 10_000 ticks. (Addresses T-09-01 inherited: per-tick bloat prevented by emission being threshold-only — `detect_crossing` returns `[]` most ticks.) |
| T-10a-02 | Information Disclosure | `DriveState` values (plaintext floats) | mitigate | DriveState NEVER crosses the Brain↔Grid wire in this plan. The runtime keeps floats internal; only `CrossingEvent` (bucketed enum) is ever passed upstream. Plan 10a-04 enforces the wire boundary with closed-tuple strict equality. (Addresses T-09-02 inherited: plaintext drive leak prevented by structural separation — there is no code path from `drives.py` floats to the wire in this plan.) |
| T-10a-03 | Repudiation | Determinism coupling to wall-clock | mitigate | Wall-clock ban enforced by `brain/test/ci/ananke-no-walltime.test.py` (Plan 10a-06) grep gate over `brain/src/noesis_brain/ananke/**`. The `step(state, seed, tick)` signature takes `tick` as an integer parameter; no call to `time.time()`, `time.monotonic()`, `datetime.now()`, or `random` module functions. (Addresses T-09-03 inherited: wall-clock coupling prevented at source.) |
| T-10a-04 | Denial of Service | Drive-value clamping | mitigate | Explicit clamp `[0.0, 1.0]` in `step()`; `test_drives_bounds.py` parametrized over 20 seeds × 10_000 ticks proves no overflow/underflow across 1_000_000 observations. |
| T-10a-05 | Spoofing | Drive name enum | mitigate | `DriveName(str, Enum)` closed 5-member enum. An attempt to add `ENERGY` (Phase 10b concern — Bios) MUST NOT leak into this phase. Any new `DriveName` addition is allowlist-gated at the phase that introduces it (same discipline as `operator.*` allowlist). |
</threat_model>

<verification>
Gate checklist:
- [ ] `brain/src/noesis_brain/ananke/` has exactly 5 source files (__init__, types, config, drives, runtime).
- [ ] `brain/test/ananke/` has conftest + 3 test modules + __init__.py.
- [ ] `pytest test/ananke/ -q` exits 0.
- [ ] `grep -rn "math\.exp" brain/src/noesis_brain/ananke/` returns exactly 1 match (in config.py).
- [ ] `grep -rn "time\.\|datetime\|random\." brain/src/noesis_brain/ananke/` returns 0 matches.
- [ ] `DRIVE_NAMES` tuple order is `(hunger, curiosity, safety, boredom, loneliness)`.
</verification>

<success_criteria>
- DRIVE-01 substantially delivered: closed enum of 5 drives in pure Python, no external libs. (Wire-side closure completed in Plan 10a-04.)
- DRIVE-02 substantially delivered: deterministic (seed, tick) recurrence with monotonic rise + passive baseline pull; replay byte-identical across 10_000 ticks; no wall-clock reads. (Grep gate enforcement delivered in Plan 10a-06.)
- Threshold-crossing detection is hysteresis-guarded and chatter-free — foundation for Plan 10a-03's RPC lift.
- Audit-size ceiling Brain-side bound proven: ≤10 crossings per 1000 ticks per Nous.
</success_criteria>

<output>
After completion, create `.planning/phases/10a-ananke-drives-inner-life-part-1/10a-01-SUMMARY.md` using `$HOME/.claude/get-shit-done/templates/summary.md`.
</output>
