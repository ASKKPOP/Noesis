"""Ananke drive dynamics — pure deterministic functions.

The public surface:
    step(state, seed, tick) -> DriveState  — pure per-tick update
    bucket(value, prev_level) -> DriveLevel — hysteresis-guarded tier
    detect_crossing(state) -> (new_state, crossings) — bucket-change detection
    initial_state() -> DriveState — first-life baseline vector

NO wall-clock reads. NO Math.random. Given (seed, tick) and a starting
DriveState, the entire sequence of future states is determined byte-
identically (DRIVE-02). Replay at tickRateMs=1000 is identical to
tickRateMs=1_000_000 (T-09-03).
"""

from __future__ import annotations

from noesis_brain.ananke.config import (
    DECAY_FACTOR,
    DRIVE_BASELINES,
    DRIVE_RISE_RATES,
    HYSTERESIS_BAND,
    THRESHOLD_HIGH,
    THRESHOLD_LOW,
)
from noesis_brain.ananke.types import (
    DRIVE_NAMES,
    CrossingEvent,
    Direction,
    DriveLevel,
    DriveName,
    DriveState,
)


def step(state: DriveState, seed: int, tick: int) -> DriveState:
    """Pure, deterministic per-tick update.

    Piecewise recurrence (D-10a-01):
        if prev < baseline:  next = baseline + (prev - baseline) * DECAY_FACTOR
        else:                next = prev + rise_rate
    Clamp to [0.0, 1.0].

    NO wall-clock reads. NO random. The (seed, tick) arguments are reserved
    for future seed-conditioned perturbations; in 10a the update is seed-
    independent, but the signature is locked so downstream callers use it
    consistently (D-10a-01 literal spec).
    """
    # Intentionally-unused params; signature is the locked contract.
    del seed, tick

    new_values: dict[DriveName, float] = {}
    for drive in DRIVE_NAMES:
        prev = state.values[drive]
        baseline = DRIVE_BASELINES[drive]
        if prev < baseline:
            # Baseline pulls UP toward itself — exponential relaxation.
            nxt = baseline + (prev - baseline) * DECAY_FACTOR
        else:
            # At or above baseline: pure monotonic rise.
            nxt = prev + DRIVE_RISE_RATES[drive]
        # Clamp.
        if nxt < 0.0:
            nxt = 0.0
        elif nxt > 1.0:
            nxt = 1.0
        new_values[drive] = nxt

    # step() carries levels forward unchanged — bucket re-evaluation happens in
    # detect_crossing() so crossings are emitted exactly once per tier change.
    new_levels = {d: state.levels[d] for d in DRIVE_NAMES}
    return DriveState(values=new_values, levels=new_levels)


def bucket(value: float, prev_level: DriveLevel) -> DriveLevel:
    """Hysteresis-guarded bucketing.

    The guard prevents a drive hovering at ~0.33 from emitting a crossing every
    other tick. A level is only left when the value crosses the outer edge of
    the hysteresis band; re-entry is cheap.

    Invariants (D-10a-01 threshold geometry):
        LOW → MED  when value > THRESHOLD_LOW  + HYSTERESIS_BAND  (> 0.35)
        LOW → HIGH when value > THRESHOLD_HIGH + HYSTERESIS_BAND  (> 0.68)
        MED → LOW  when value < THRESHOLD_LOW  - HYSTERESIS_BAND  (< 0.31)
        MED → HIGH when value > THRESHOLD_HIGH + HYSTERESIS_BAND  (> 0.68)
        HIGH → MED when value < THRESHOLD_HIGH - HYSTERESIS_BAND  (< 0.64)
        HIGH → LOW when value < THRESHOLD_LOW  - HYSTERESIS_BAND  (< 0.31)
    """
    if prev_level == DriveLevel.LOW:
        # Leave LOW only when value exceeds THRESHOLD_LOW + band.
        if value > THRESHOLD_LOW + HYSTERESIS_BAND:
            if value > THRESHOLD_HIGH + HYSTERESIS_BAND:
                return DriveLevel.HIGH
            return DriveLevel.MED
        return DriveLevel.LOW

    if prev_level == DriveLevel.MED:
        # Leave MED only when value crosses either outer band edge.
        if value < THRESHOLD_LOW - HYSTERESIS_BAND:
            return DriveLevel.LOW
        if value > THRESHOLD_HIGH + HYSTERESIS_BAND:
            return DriveLevel.HIGH
        return DriveLevel.MED

    # prev_level == DriveLevel.HIGH
    if value < THRESHOLD_HIGH - HYSTERESIS_BAND:
        if value < THRESHOLD_LOW - HYSTERESIS_BAND:
            return DriveLevel.LOW
        return DriveLevel.MED
    return DriveLevel.HIGH


def detect_crossing(
    state: DriveState,
) -> tuple[DriveState, list[CrossingEvent]]:
    """Apply bucketing to the state's current values; return (new_state, crossings).

    A crossing is emitted ONLY when the bucket changes — never per-tick.
    This is the threshold-crossing-only emission invariant (D-10a-04); the
    Grid-side audit-size ceiling test (Plan 10a-06) depends on this bound.

    Direction is derived from the bucket ordinal transition (RISING if the new
    level is strictly higher than the old one), never from the float delta —
    this preserves the hash-only cross-boundary invariant (DRIVE-05).
    """
    crossings: list[CrossingEvent] = []
    new_levels: dict[DriveName, DriveLevel] = {}
    for drive in DRIVE_NAMES:
        old_level = state.levels[drive]
        new_level = bucket(state.values[drive], old_level)
        new_levels[drive] = new_level
        if new_level != old_level:
            # Derive direction from bucket ordinal transition, not the float.
            going_up = (old_level == DriveLevel.LOW and new_level != DriveLevel.LOW) or (
                old_level == DriveLevel.MED and new_level == DriveLevel.HIGH
            )
            direction = Direction.RISING if going_up else Direction.FALLING
            crossings.append(
                CrossingEvent(drive=drive, level=new_level, direction=direction)
            )
    new_state = DriveState(values=state.values, levels=new_levels)
    return new_state, crossings


def initial_state() -> DriveState:
    """First-life drive vector — every drive at its baseline.

    Psyche/Big Five coupling is deferred (D-10a-01); the first-life drive
    vector is just the baseline vector.

    Levels are bucketed from LOW so hysteresis lets a baseline > 0.35 settle
    into MED on first-paint (curiosity=0.5, boredom=0.4, loneliness=0.4 →
    MED; hunger=0.3, safety=0.2 → LOW).
    """
    values = {d: DRIVE_BASELINES[d] for d in DRIVE_NAMES}
    levels = {d: bucket(DRIVE_BASELINES[d], DriveLevel.LOW) for d in DRIVE_NAMES}
    return DriveState(values=values, levels=levels)
