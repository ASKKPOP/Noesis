"""Bios need dynamics — pure deterministic functions.

Clone of ananke/drives.py applied to 2 needs. Given (seed, tick) and a starting
NeedState, the entire sequence of future states is byte-identical regardless
of wall-clock cadence (BIOS-01, T-09-03).

Public surface:
    step(state, tick) -> (NeedState, list[NeedCrossing])
    bucket(value, prev_level) -> DriveLevel   (hysteresis-guarded)
    detect_crossing(state) -> (new_state, crossings)
    initial_state() -> NeedState
    is_terminal(state) -> bool    (starvation trigger, D-10b-04)

NO wall-clock reads. NO random. NO math.exp on hot path — DECAY_FACTOR is
pre-computed in config.py at module load.
"""

from __future__ import annotations

from noesis_brain.ananke.types import Direction, DriveLevel
from noesis_brain.bios.config import (
    DECAY_FACTOR,
    HYSTERESIS_BAND,
    NEED_BASELINES,
    NEED_RISE_RATES,
    THRESHOLD_HIGH,
    THRESHOLD_LOW,
)
from noesis_brain.bios.types import NEED_NAMES, NeedCrossing, NeedName, NeedState


def bucket(value: float, prev_level: DriveLevel) -> DriveLevel:
    """Hysteresis-guarded bucketing — clone of ananke.drives.bucket().

    Thresholds identical to ananke (THRESHOLD_LOW=0.33, THRESHOLD_HIGH=0.66,
    HYSTERESIS_BAND=0.02). A need at ~0.33 does not emit a crossing every other
    tick — the guard band enforces hysteresis.
    """
    if prev_level == DriveLevel.LOW:
        if value > THRESHOLD_LOW + HYSTERESIS_BAND:
            if value > THRESHOLD_HIGH + HYSTERESIS_BAND:
                return DriveLevel.HIGH
            return DriveLevel.MED
        return DriveLevel.LOW

    if prev_level == DriveLevel.MED:
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


def _step_values(state: NeedState) -> dict[NeedName, float]:
    """Piecewise recurrence — clone of ananke.drives.step() body."""
    new_values: dict[NeedName, float] = {}
    for need in NEED_NAMES:
        prev = state.values[need]
        baseline = NEED_BASELINES[need]
        if prev < baseline:
            # Baseline pulls UP toward itself — exponential relaxation.
            nxt = baseline + (prev - baseline) * DECAY_FACTOR
        else:
            # At or above baseline: pure monotonic rise.
            nxt = prev + NEED_RISE_RATES[need]
        if nxt < 0.0:
            nxt = 0.0
        elif nxt > 1.0:
            nxt = 1.0
        new_values[need] = nxt
    return new_values


def detect_crossing(
    state: NeedState,
) -> tuple[NeedState, list[NeedCrossing]]:
    """Apply bucketing to the state's current values; return (new_state, crossings).

    A crossing is emitted ONLY when the bucket changes. Direction is derived
    from the bucket ordinal transition, never from the float delta.
    """
    crossings: list[NeedCrossing] = []
    new_levels: dict[NeedName, DriveLevel] = {}
    for need in NEED_NAMES:
        old_level = state.levels[need]
        new_level = bucket(state.values[need], old_level)
        new_levels[need] = new_level
        if new_level != old_level:
            going_up = (old_level == DriveLevel.LOW and new_level != DriveLevel.LOW) or (
                old_level == DriveLevel.MED and new_level == DriveLevel.HIGH
            )
            direction = Direction.RISING if going_up else Direction.FALLING
            crossings.append(
                NeedCrossing(need=need, level=new_level, direction=direction)
            )
    new_state = NeedState(values=state.values, levels=new_levels)
    return new_state, crossings


def step(state: NeedState, tick: int) -> tuple[NeedState, list[NeedCrossing]]:
    """Pure deterministic per-tick update + crossing detection.

    Composition:
        1. piecewise recurrence on values (rise-above-baseline, relax-below)
        2. hysteresis-guarded re-bucketing → crossings

    `tick` is reserved (unused by math, signature locked per BIOS-01 contract).
    Returns the new state and any crossings emitted this tick.
    """
    del tick  # reserved; signature locked

    new_values = _step_values(state)
    stepped = NeedState(values=new_values, levels=dict(state.levels))
    return detect_crossing(stepped)


def initial_state() -> NeedState:
    """First-life need vector — both needs at baseline (0.3), bucketed LOW.

    Baselines 0.3 bucket to LOW at threshold 0.33 (below THRESHOLD_LOW).
    """
    values = {need: NEED_BASELINES[need] for need in NEED_NAMES}
    levels = {need: bucket(NEED_BASELINES[need], DriveLevel.LOW) for need in NEED_NAMES}
    return NeedState(values=values, levels=levels)


def is_terminal(state: NeedState) -> bool:
    """Starvation trigger (D-10b-04): any need at 1.0 → death pending."""
    return any(v >= 1.0 for v in state.values.values())
