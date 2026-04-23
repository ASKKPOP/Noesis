---
phase: 10b
plan: 02
type: execute
wave: 1
depends_on: [10b-01]
files_modified:
  - brain/src/noesis_brain/bios/__init__.py
  - brain/src/noesis_brain/bios/types.py
  - brain/src/noesis_brain/bios/config.py
  - brain/src/noesis_brain/bios/needs.py
  - brain/src/noesis_brain/bios/runtime.py
  - brain/src/noesis_brain/bios/loader.py
  - brain/src/noesis_brain/ananke/runtime.py
autonomous: true
requirements: [BIOS-01, BIOS-04]
must_haves:
  truths:
    - "Brain has a Bios subsystem that rises energy/sustenance deterministically each tick"
    - "Bios crossings elevate matching Ananke drives exactly once per crossing (no per-tick re-elevation)"
    - "Bios state is (seed, tick)-deterministic: same inputs produce byte-identical trace"
  artifacts:
    - path: "brain/src/noesis_brain/bios/needs.py"
      provides: "step(NeedState, tick) -> NeedState, deterministic rise-only with hysteresis"
      contains: "def step"
    - path: "brain/src/noesis_brain/bios/runtime.py"
      provides: "BiosRuntime.step(tick) emits crossings + one-shot elevation to Ananke"
      contains: "class BiosRuntime"
    - path: "brain/src/noesis_brain/bios/config.py"
      provides: "Constants: NEED_BASELINES, NEED_RISE_RATES, THRESHOLDS, HYSTERESIS, TAU, NEED_TO_DRIVE"
      contains: "NEED_BASELINES"
  key_links:
    - from: "brain/src/noesis_brain/bios/runtime.py"
      to: "brain/src/noesis_brain/ananke/runtime.py"
      via: "AnankeRuntime.elevate_drive(drive, level, tick)"
      pattern: "elevate_drive"
    - from: "brain/src/noesis_brain/bios/needs.py"
      to: "brain/src/noesis_brain/bios/config.py"
      via: "import constants for thresholds/rates"
      pattern: "from.*bios.config"
---

<objective>
Create the Brain-side Bios subsystem (energy + sustenance needs) as a 100% structural clone of `brain/src/noesis_brain/ananke/` applied to 2 needs. Add one-shot BIOS→Ananke elevation via `AnankeRuntime.elevate_drive()`. Turns Wave 0 stubs GREEN for: test_needs_determinism.py, test_needs_baseline.py, test_bios_no_walltime.py, test_needs_elevator.py.

Purpose: Bodily needs rise inside the Brain (not on the wire), deterministically, and elevate matching Ananke drives on threshold crossing — the physical substrate for v2.1 Inner Life.

Output: 6 new files in `brain/src/noesis_brain/bios/`, 1 method added to `AnankeRuntime`.
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

<interfaces>
<!-- Analog files — executor MUST read these and mirror the patterns exactly. -->

From brain/src/noesis_brain/ananke/types.py — clone for types.py:
- Drive enum → Need enum { ENERGY, SUSTENANCE }
- DriveLevel enum → NeedLevel enum { LOW, MED, HIGH }
- DriveState dataclass → NeedState(value: float, level: NeedLevel, last_crossing_tick: int | None)

From brain/src/noesis_brain/ananke/drives.py — clone for needs.py:
- `step(state, tick)` applies deterministic rate + hysteresis banding. Pure function.
- Rise-only (no decay, no wall-clock). Passive baseline via `max(value, BASELINE)` on init ONLY.

From brain/src/noesis_brain/ananke/runtime.py:17-76 — clone for runtime.py:
- `class AnankeRuntime: __init__(seed), step(tick) -> list[Crossing]`
- BiosRuntime adds: `death_pending: bool` flag, `elevator` callback to AnankeRuntime.

From CONTEXT.md D-10b-02: once-per-crossing elevation. Use `last_crossing_tick` to gate.
From CONTEXT.md D-10b-04: NEED_TO_DRIVE = { ENERGY: HUNGER, SUSTENANCE: SAFETY }.
From RESEARCH.md: TAU=500, DECAY_FACTOR=math.exp(-1.0/TAU) computed once at import.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create Bios types + config module</name>
  <files>brain/src/noesis_brain/bios/__init__.py, brain/src/noesis_brain/bios/types.py, brain/src/noesis_brain/bios/config.py</files>
  <read_first>
    - brain/src/noesis_brain/ananke/__init__.py
    - brain/src/noesis_brain/ananke/types.py
    - brain/src/noesis_brain/ananke/config.py
    - .planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-PATTERNS.md (sections on types.py + config.py clones)
    - .planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-CONTEXT.md (D-10b-02, D-10b-04)
  </read_first>
  <behavior>
    - types.py exports Need, NeedLevel, NeedState with same shape as ananke analog
    - config.py exports NEED_BASELINES, NEED_RISE_RATES, THRESHOLD_LOW/HIGH, HYSTERESIS_BAND, TAU, DECAY_FACTOR, NEED_TO_DRIVE
    - NEED_TO_DRIVE is a frozen mapping (dict) from Need to ananke.Drive enum
    - All constants are module-level literals; no dynamic computation except DECAY_FACTOR
  </behavior>
  <action>
Create `brain/src/noesis_brain/bios/__init__.py`:
```python
"""Bios — bodily needs subsystem (energy, sustenance). Clone of ananke/ applied to 2 needs.

Per phase 10b / D-10b-02: rises deterministically, elevates matching Ananke drive
once per threshold crossing (not per tick). See 10b-PATTERNS.md.
"""
from noesis_brain.bios.types import Need, NeedLevel, NeedState
from noesis_brain.bios.config import (
    NEED_BASELINES, NEED_RISE_RATES,
    THRESHOLD_LOW, THRESHOLD_HIGH, HYSTERESIS_BAND,
    TAU, DECAY_FACTOR, NEED_TO_DRIVE,
)
from noesis_brain.bios.runtime import BiosRuntime
from noesis_brain.bios.needs import step

__all__ = [
    "Need", "NeedLevel", "NeedState",
    "NEED_BASELINES", "NEED_RISE_RATES",
    "THRESHOLD_LOW", "THRESHOLD_HIGH", "HYSTERESIS_BAND",
    "TAU", "DECAY_FACTOR", "NEED_TO_DRIVE",
    "BiosRuntime", "step",
]
```

Create `brain/src/noesis_brain/bios/types.py` (clone `ananke/types.py`):
```python
from dataclasses import dataclass
from enum import Enum


class Need(str, Enum):
    ENERGY = "energy"
    SUSTENANCE = "sustenance"


class NeedLevel(str, Enum):
    LOW = "low"
    MED = "med"
    HIGH = "high"


@dataclass(frozen=True)
class NeedState:
    need: Need
    value: float
    level: NeedLevel
    last_crossing_tick: int | None = None
```

Create `brain/src/noesis_brain/bios/config.py`:
```python
"""Bios configuration — per CONTEXT.md D-10b-02, D-10b-04 and RESEARCH.md.

Rise-only + hysteresis banding. Tuned for ~500 ticks to cross LOW→MED at baseline.
"""
import math
from noesis_brain.bios.types import Need
from noesis_brain.ananke.types import Drive

# Initial values (post-Bios.birth). All needs start low = satisfied.
NEED_BASELINES: dict[Need, float] = {
    Need.ENERGY: 0.3,
    Need.SUSTENANCE: 0.3,
}

# Per-tick rise rate. Hunger rises faster than safety (per RESEARCH.md).
NEED_RISE_RATES: dict[Need, float] = {
    Need.ENERGY: 0.0003,      # ~3333 ticks floor→ceiling at steady rate
    Need.SUSTENANCE: 0.0001,  # ~10000 ticks floor→ceiling
}

# Level-crossing thresholds (symmetric across needs).
THRESHOLD_LOW: float = 0.33
THRESHOLD_HIGH: float = 0.66

# Hysteresis band: must exceed threshold by band before promoting; drop by band before demoting.
HYSTERESIS_BAND: float = 0.02

# Time constant for passive relief (if ever applied externally — v2.1 is rise-only).
TAU: int = 500
DECAY_FACTOR: float = math.exp(-1.0 / TAU)

# Per CONTEXT.md D-10b-04: each Bios need elevates exactly one Ananke drive on crossing.
NEED_TO_DRIVE: dict[Need, Drive] = {
    Need.ENERGY: Drive.HUNGER,
    Need.SUSTENANCE: Drive.SAFETY,
}
```
  </action>
  <verify>
    <automated>cd brain && uv run pytest test/bios/test_needs_baseline.py -q</automated>
  </verify>
  <done>Files exist; `uv run python -c "from noesis_brain.bios import Need, NEED_TO_DRIVE; assert NEED_TO_DRIVE[Need.ENERGY].value == 'hunger'"` succeeds.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement needs.step() — deterministic rise-only with hysteresis</name>
  <files>brain/src/noesis_brain/bios/needs.py, brain/src/noesis_brain/bios/loader.py</files>
  <read_first>
    - brain/src/noesis_brain/ananke/drives.py (lines 35-71, clone target)
    - brain/src/noesis_brain/ananke/loader.py
    - brain/src/noesis_brain/bios/config.py (from Task 1)
    - brain/src/noesis_brain/bios/types.py (from Task 1)
  </read_first>
  <behavior>
    - step(state: NeedState, tick: int) -> NeedState applies rise + hysteresis
    - No wall-clock reads (grep-gate: no datetime, no time.time)
    - (seed, tick) determinism: step(S, T) always produces same output for same input
    - Hysteresis: promote when value > THRESHOLD_{LOW,HIGH} + BAND; demote when value < THRESHOLD - BAND
    - loader.load_needs(seed) returns {Need: NeedState} initialized to NEED_BASELINES with level=LOW
  </behavior>
  <action>
Create `brain/src/noesis_brain/bios/needs.py` (clone ananke/drives.py:35-71):
```python
"""Deterministic per-tick needs evolution. Rise-only + hysteresis banding.

Per CONTEXT.md D-10b-06: no wall-clock. (seed, tick) → byte-identical trace.
"""
from noesis_brain.bios.config import (
    NEED_RISE_RATES, THRESHOLD_LOW, THRESHOLD_HIGH, HYSTERESIS_BAND,
)
from noesis_brain.bios.types import Need, NeedLevel, NeedState


def _classify(value: float, current: NeedLevel) -> NeedLevel:
    """Hysteresis-banded level classification."""
    band = HYSTERESIS_BAND
    if current == NeedLevel.LOW:
        if value >= THRESHOLD_LOW + band:
            return NeedLevel.MED
        return NeedLevel.LOW
    if current == NeedLevel.MED:
        if value >= THRESHOLD_HIGH + band:
            return NeedLevel.HIGH
        if value < THRESHOLD_LOW - band:
            return NeedLevel.LOW
        return NeedLevel.MED
    # HIGH
    if value < THRESHOLD_HIGH - band:
        return NeedLevel.MED
    return NeedLevel.HIGH


def step(state: NeedState, tick: int) -> NeedState:
    """Advance one tick. Rise-only; level updates via hysteresis."""
    rise = NEED_RISE_RATES[state.need]
    new_value = min(1.0, state.value + rise)
    new_level = _classify(new_value, state.level)
    crossing_tick = tick if new_level != state.level else state.last_crossing_tick
    return NeedState(
        need=state.need,
        value=new_value,
        level=new_level,
        last_crossing_tick=crossing_tick,
    )
```

Create `brain/src/noesis_brain/bios/loader.py`:
```python
"""Initialize Bios NeedStates per spawn. Deterministic from seed."""
from noesis_brain.bios.config import NEED_BASELINES
from noesis_brain.bios.types import Need, NeedLevel, NeedState


def load_needs(seed: int) -> dict[Need, NeedState]:
    """Post-bios.birth initial state. All needs start at baseline LOW."""
    return {
        need: NeedState(need=need, value=baseline, level=NeedLevel.LOW, last_crossing_tick=None)
        for need, baseline in NEED_BASELINES.items()
    }
```
  </action>
  <verify>
    <automated>cd brain && uv run pytest test/bios/test_needs_determinism.py test/bios/test_needs_baseline.py test/bios/test_bios_no_walltime.py -q</automated>
  </verify>
  <done>Determinism + baseline + no-walltime tests pass. Grep check: `rg "datetime|time\\.time" brain/src/noesis_brain/bios/` returns zero matches.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: BiosRuntime + AnankeRuntime.elevate_drive() one-shot elevator</name>
  <files>brain/src/noesis_brain/bios/runtime.py, brain/src/noesis_brain/ananke/runtime.py</files>
  <read_first>
    - brain/src/noesis_brain/ananke/runtime.py (lines 17-76, clone + extend)
    - brain/src/noesis_brain/bios/needs.py (from Task 2)
    - brain/src/noesis_brain/bios/loader.py (from Task 2)
    - .planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-CONTEXT.md (D-10b-02 one-shot semantics)
  </read_first>
  <behavior>
    - BiosRuntime.step(tick) returns list[Crossing] — one per need that crossed this tick
    - On crossing, invokes self._elevator(drive, new_level, tick) callback to AnankeRuntime
    - last_crossing_tick gates re-elevation: only fire elevator when crossing_tick == current tick
    - AnankeRuntime.elevate_drive(drive, level, tick): sets drive.value = max(value, level_floor) so NEXT step() emits ananke.drive_crossed if boundary is actually crossed. Does NOT emit directly — that remains drives.step() responsibility (sole-producer).
    - death_pending: bool flag set externally when energy reaches 1.0 (starvation) — Brain hosts death decision, Grid emits event
  </behavior>
  <action>
Create `brain/src/noesis_brain/bios/runtime.py` (clone ananke/runtime.py):
```python
"""BiosRuntime — per-Nous Bios state machine. Emits crossings, elevates Ananke."""
from dataclasses import dataclass, field
from typing import Callable, Protocol

from noesis_brain.ananke.types import Drive, DriveLevel
from noesis_brain.bios.config import NEED_TO_DRIVE
from noesis_brain.bios.loader import load_needs
from noesis_brain.bios.needs import step as needs_step
from noesis_brain.bios.types import Need, NeedLevel, NeedState


@dataclass(frozen=True)
class BiosCrossing:
    need: Need
    old_level: NeedLevel
    new_level: NeedLevel
    value: float
    tick: int


class DriveElevator(Protocol):
    def __call__(self, drive: Drive, level: DriveLevel, tick: int) -> None: ...


_NEED_LEVEL_TO_DRIVE_LEVEL = {
    NeedLevel.LOW: DriveLevel.LOW,
    NeedLevel.MED: DriveLevel.MED,
    NeedLevel.HIGH: DriveLevel.HIGH,
}


@dataclass
class BiosRuntime:
    seed: int
    states: dict[Need, NeedState] = field(default_factory=dict)
    death_pending: bool = False
    _elevator: DriveElevator | None = None

    @classmethod
    def create(cls, seed: int, elevator: DriveElevator | None = None) -> "BiosRuntime":
        return cls(seed=seed, states=load_needs(seed), _elevator=elevator)

    def step(self, tick: int) -> list[BiosCrossing]:
        crossings: list[BiosCrossing] = []
        new_states: dict[Need, NeedState] = {}
        for need, state in self.states.items():
            new_state = needs_step(state, tick)
            new_states[need] = new_state
            if new_state.level != state.level:
                crossings.append(BiosCrossing(
                    need=need,
                    old_level=state.level,
                    new_level=new_state.level,
                    value=new_state.value,
                    tick=tick,
                ))
                # D-10b-02: one-shot elevation into Ananke drive
                if self._elevator is not None:
                    drive = NEED_TO_DRIVE[need]
                    drive_level = _NEED_LEVEL_TO_DRIVE_LEVEL[new_state.level]
                    self._elevator(drive, drive_level, tick)
        self.states = new_states
        # Starvation trigger: energy hit ceiling
        if self.states[Need.ENERGY].value >= 1.0:
            self.death_pending = True
        return crossings
```

Add to `brain/src/noesis_brain/ananke/runtime.py` (append method inside AnankeRuntime class):
```python
    def elevate_drive(self, drive: Drive, level: DriveLevel, tick: int) -> None:
        """Per D-10b-02: Bios crossings raise matching Ananke drive to at least this level.

        Sets drive value to level's lower bound so the next step() emits ananke.drive_crossed
        if the level genuinely changed. Does NOT emit events directly —
        drives.step() remains sole producer of ananke.drive_crossed (sole-producer invariant).
        """
        from noesis_brain.ananke.config import DRIVE_THRESHOLD_LOW, DRIVE_THRESHOLD_HIGH
        floors = {
            DriveLevel.LOW: 0.0,
            DriveLevel.MED: DRIVE_THRESHOLD_LOW + 0.01,
            DriveLevel.HIGH: DRIVE_THRESHOLD_HIGH + 0.01,
        }
        current = self.states[drive]
        floor = floors[level]
        if current.value < floor:
            # Replace with elevated value; drives.step() will reclassify + emit crossing next tick
            from noesis_brain.ananke.types import DriveState
            self.states[drive] = DriveState(
                drive=drive,
                value=floor,
                level=current.level,  # step() will reclassify
                last_crossing_tick=current.last_crossing_tick,
            )
```
  </action>
  <verify>
    <automated>cd brain && uv run pytest test/bios/test_needs_elevator.py test/bios/test_needs_determinism.py -q</automated>
  </verify>
  <done>BiosRuntime.step() produces crossings and invokes elevator. AnankeRuntime.elevate_drive() raises drive floor without emitting events. One-shot semantics verified by test.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Brain internal state | Bios runtime state is per-process, in-memory, never serialized to wire |
| Bios → Ananke elevator | Callback crosses subsystems within same process; no untrusted input |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10b-02-01 | Tampering | needs.step() determinism | mitigate | Grep-gate: no datetime/time.time imports in brain/src/noesis_brain/bios/ |
| T-10b-02-02 | Information Disclosure | Bios state leak via logs | mitigate | No print/log calls with raw values; BIOS_FORBIDDEN_KEYS enforced in Grid plan 10b-03 |
| T-10b-02-03 | Denial of Service | Infinite death_pending loop | accept | death_pending is one-shot boolean; Grid handler transitions state |
</threat_model>

<verification>
- `cd brain && uv run pytest test/bios/ -q` — all Bios Brain tests GREEN
- `rg "datetime|time\\.time" brain/src/noesis_brain/bios/` returns zero matches
- `uv run python -c "from noesis_brain.bios import BiosRuntime; rt = BiosRuntime.create(seed=42); print(rt.step(1))"` runs without error
- `rg "def elevate_drive" brain/src/noesis_brain/ananke/runtime.py` returns 1 match
</verification>

<success_criteria>
- 6 new files exist under `brain/src/noesis_brain/bios/`
- `AnankeRuntime.elevate_drive()` method added (1 new method, no other ananke/ changes)
- All Wave 0 stubs turned from RED → GREEN: test_needs_determinism, test_needs_baseline, test_bios_no_walltime, test_needs_elevator
- Zero wall-clock reads in bios/ (determinism invariant)
- Sole-producer of ananke.drive_crossed invariant preserved (elevate_drive mutates state, drives.step() emits)
</success_criteria>

<output>
After completion, create `.planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-02-SUMMARY.md`
</output>
