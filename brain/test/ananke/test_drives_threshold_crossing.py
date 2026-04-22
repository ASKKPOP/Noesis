"""Threshold-crossing tests — chatter absent, bucket-change-only emission.

Addresses:
- D-10a-04: Emission is threshold-crossing-only — never per tick.
- Audit-size ceiling (Brain-side): 1000 ticks × 5 drives × 1 Nous ≤ 10
  crossings. The Grid-side <= 50 ceiling in Plan 10a-06 inherits this
  with a 5× margin.
"""

from __future__ import annotations

from noesis_brain.ananke import (
    AnankeRuntime,
    CrossingEvent,
    DRIVE_NAMES,
    Direction,
    DriveLevel,
    DriveName,
    DriveState,
    bucket,
    detect_crossing,
)


def _make_state(
    *, hunger_value: float, hunger_level: DriveLevel, fill_with: float = 0.3
) -> DriveState:
    """Build an artificial DriveState with hunger set explicitly.

    Other drives are set to fill_with at LOW level (0.3 is below the LOW
    bucket's +band exit, so they stay LOW across calls).
    """
    values = {d: fill_with for d in DRIVE_NAMES}
    values[DriveName.HUNGER] = hunger_value
    levels = {d: DriveLevel.LOW for d in DRIVE_NAMES}
    levels[DriveName.HUNGER] = hunger_level
    return DriveState(values=values, levels=levels)


def test_crossing_emitted_only_on_bucket_change() -> None:
    """detect_crossing on a steady-state DriveState emits zero crossings.

    hunger at 0.34 is within LOW's hysteresis band (< 0.33 + 0.02 = 0.35),
    so it stays LOW. Calling detect_crossing repeatedly with the same state
    must emit nothing.
    """
    state = _make_state(hunger_value=0.34, hunger_level=DriveLevel.LOW)
    for _ in range(10):
        new_state, crossings = detect_crossing(state)
        assert crossings == []
        assert new_state.levels == state.levels
        state = new_state


def test_hysteresis_prevents_chatter() -> None:
    """A value oscillating within the band around 0.33 stays in its level.

    Oscillating hunger in [0.31, 0.34] — all within LOW's +band exit at
    0.35 — must never trip a bucket change.
    """
    level = DriveLevel.LOW
    oscillation = [0.31, 0.34, 0.32, 0.34, 0.31, 0.34, 0.33, 0.34]
    for value in oscillation * 10:
        next_level = bucket(value, level)
        assert next_level == DriveLevel.LOW, f"chatter at value={value}: {next_level}"
        level = next_level


def test_hysteresis_exit_above_band() -> None:
    """A value > 0.33 + 0.02 = 0.35 leaves LOW to MED."""
    assert bucket(0.36, DriveLevel.LOW) == DriveLevel.MED
    # 0.34 stays LOW (within band).
    assert bucket(0.34, DriveLevel.LOW) == DriveLevel.LOW
    # MED re-entry from above.
    assert bucket(0.32, DriveLevel.MED) == DriveLevel.MED
    # MED drops to LOW at < 0.33 - 0.02 = 0.31.
    assert bucket(0.30, DriveLevel.MED) == DriveLevel.LOW


def test_audit_size_ceiling_brain_side() -> None:
    """1000 ticks × 5 drives × 1 Nous: at most 10 crossings.

    Each drive can have at most 2 tier transitions in 1000 ticks with the
    default rise rates (LOW→MED and possibly MED→HIGH). Five drives × 2 = 10.
    The Grid-side <= 50 ceiling (Plan 10a-06) has a 5× safety margin.
    """
    runtime = AnankeRuntime(seed=1)
    for t in range(1, 1001):
        runtime.on_tick(t)
    all_crossings = runtime.drain_crossings()
    assert len(all_crossings) <= 10, (
        f"Brain-side audit ceiling violated: {len(all_crossings)} > 10"
    )


def test_default_rise_rate_produces_expected_hunger_crossings() -> None:
    """Hunger crosses LOW→MED then MED→HIGH over 10_000 ticks — exactly two.

    Above baseline the rise is monotonic, so there's no oscillation. The
    crossing list filtered to HUNGER must equal
    [(HUNGER, MED, RISING), (HUNGER, HIGH, RISING)] in order.
    """
    runtime = AnankeRuntime(seed=1)
    for t in range(1, 10_001):
        runtime.on_tick(t)
    crossings = runtime.drain_crossings()
    hunger_crossings = [c for c in crossings if c.drive == DriveName.HUNGER]
    assert hunger_crossings == [
        CrossingEvent(drive=DriveName.HUNGER, level=DriveLevel.MED, direction=Direction.RISING),
        CrossingEvent(drive=DriveName.HUNGER, level=DriveLevel.HIGH, direction=Direction.RISING),
    ]


def test_direction_derived_from_bucket_ordinal_not_float() -> None:
    """Direction is RISING iff new level is ordinally higher than old.

    Confirms DRIVE-05: direction is a bucket-ordinal derivation, never a
    float-delta read. Build states that force each transition and verify.
    """
    # LOW -> MED via rising float.
    state = _make_state(hunger_value=0.36, hunger_level=DriveLevel.LOW)
    _, crossings = detect_crossing(state)
    hunger_crossings = [c for c in crossings if c.drive == DriveName.HUNGER]
    assert hunger_crossings[0].direction == Direction.RISING
    assert hunger_crossings[0].level == DriveLevel.MED

    # MED -> LOW via falling float.
    state = _make_state(hunger_value=0.30, hunger_level=DriveLevel.MED)
    _, crossings = detect_crossing(state)
    hunger_crossings = [c for c in crossings if c.drive == DriveName.HUNGER]
    assert hunger_crossings[0].direction == Direction.FALLING
    assert hunger_crossings[0].level == DriveLevel.LOW

    # MED -> HIGH rising.
    state = _make_state(hunger_value=0.70, hunger_level=DriveLevel.MED)
    _, crossings = detect_crossing(state)
    hunger_crossings = [c for c in crossings if c.drive == DriveName.HUNGER]
    assert hunger_crossings[0].direction == Direction.RISING
    assert hunger_crossings[0].level == DriveLevel.HIGH

    # HIGH -> MED falling.
    state = _make_state(hunger_value=0.60, hunger_level=DriveLevel.HIGH)
    _, crossings = detect_crossing(state)
    hunger_crossings = [c for c in crossings if c.drive == DriveName.HUNGER]
    assert hunger_crossings[0].direction == Direction.FALLING
    assert hunger_crossings[0].level == DriveLevel.MED
