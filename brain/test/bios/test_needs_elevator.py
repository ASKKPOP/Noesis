"""Phase 10b Wave 0 RED stub — BIOS-01 elevator (D-10b-02).

References `noesis_brain.bios.*` (does not exist at Wave 0) ⇒ RED.
Wave 1 (Plan 10b-02) creates BiosRuntime + the elevator handoff to
AnankeRuntime ⇒ GREEN.

Verifies (clone of brain/test/ananke/test_drives_threshold_crossing.py shape):
- energy crossing LOW→MED elevates AnankeRuntime hunger one bucket up
  (LOW→MED).
- sustenance crossing LOW→MED elevates safety one bucket up (LOW→MED).
- HIGH cap: if hunger already HIGH, the elevator is no-op (cannot go above
  HIGH).
- mapping is exactly {energy→hunger, sustenance→safety}; curiosity /
  boredom / loneliness MUST NOT be elevated by Bios crossings.
- once-per-crossing: oscillation above threshold across N ticks emits
  ≤1 elevation per crossing event (no double-fire while still above).
"""

from __future__ import annotations

from noesis_brain.ananke import AnankeRuntime, DriveLevel, DriveName  # noqa: F401
from noesis_brain.bios import (  # noqa: F401  RED at Wave 0
    BiosRuntime,
    NeedName,
)


def test_energy_crossing_elevates_hunger() -> None:
    """When energy crosses LOW→MED, AnankeRuntime hunger LOW→MED."""
    ananke = AnankeRuntime(seed=1)
    bios = BiosRuntime(seed=1, ananke=ananke)
    # Force energy above LOW threshold (0.33 + 0.02 hysteresis = 0.36).
    bios.state.values[NeedName.ENERGY] = 0.40
    # Pre-condition: hunger LOW.
    assert ananke.state.levels[DriveName.HUNGER] == DriveLevel.LOW
    bios.on_tick(1)
    assert ananke.state.levels[DriveName.HUNGER] == DriveLevel.MED


def test_sustenance_crossing_elevates_safety() -> None:
    """When sustenance crosses LOW→MED, AnankeRuntime safety LOW→MED."""
    ananke = AnankeRuntime(seed=1)
    bios = BiosRuntime(seed=1, ananke=ananke)
    bios.state.values[NeedName.SUSTENANCE] = 0.40
    assert ananke.state.levels[DriveName.SAFETY] == DriveLevel.LOW
    bios.on_tick(1)
    assert ananke.state.levels[DriveName.SAFETY] == DriveLevel.MED


def test_high_cap_is_noop() -> None:
    """If hunger is already HIGH, an energy crossing does not double-elevate."""
    ananke = AnankeRuntime(seed=1)
    ananke.state.levels[DriveName.HUNGER] = DriveLevel.HIGH
    bios = BiosRuntime(seed=1, ananke=ananke)
    bios.state.values[NeedName.ENERGY] = 0.80
    bios.on_tick(1)
    assert ananke.state.levels[DriveName.HUNGER] == DriveLevel.HIGH


def test_mapping_does_not_touch_unrelated_drives() -> None:
    """energy/sustenance crossings DO NOT elevate curiosity/boredom/loneliness."""
    ananke = AnankeRuntime(seed=1)
    bios = BiosRuntime(seed=1, ananke=ananke)
    pre_curiosity = ananke.state.levels[DriveName.CURIOSITY]
    pre_boredom = ananke.state.levels[DriveName.BOREDOM]
    pre_loneliness = ananke.state.levels[DriveName.LONELINESS]
    bios.state.values[NeedName.ENERGY] = 0.80
    bios.state.values[NeedName.SUSTENANCE] = 0.80
    bios.on_tick(1)
    assert ananke.state.levels[DriveName.CURIOSITY] == pre_curiosity
    assert ananke.state.levels[DriveName.BOREDOM] == pre_boredom
    assert ananke.state.levels[DriveName.LONELINESS] == pre_loneliness


def test_once_per_crossing_no_chatter() -> None:
    """Hovering above threshold across many ticks emits ≤1 elevation per crossing.

    Once a need crosses LOW→MED and elevates, staying above threshold for
    subsequent ticks must NOT re-elevate. Only a fresh crossing from below
    re-arms the elevator.
    """
    ananke = AnankeRuntime(seed=1)
    bios = BiosRuntime(seed=1, ananke=ananke)
    bios.state.values[NeedName.ENERGY] = 0.40
    bios.on_tick(1)
    # First on_tick triggers the crossing → MED.
    assert ananke.state.levels[DriveName.HUNGER] == DriveLevel.MED
    # Stay above threshold for 100 more ticks; hunger must not jump to HIGH.
    for t in range(2, 102):
        bios.state.values[NeedName.ENERGY] = 0.45
        bios.on_tick(t)
    assert ananke.state.levels[DriveName.HUNGER] == DriveLevel.MED, (
        "elevator double-fired without a fresh threshold crossing"
    )
