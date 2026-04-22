"""Bounds property test — drive ∈ [0.0, 1.0] across 20 seeds × 10_000 ticks.

Addresses T-10a-04: DoS via unbounded drive values. The explicit clamp in
step() must hold across 1_000_000 observations (20 seeds × 10_000 ticks ×
5 drives).
"""

from __future__ import annotations

import pytest

from noesis_brain.ananke import DRIVE_NAMES, AnankeRuntime


@pytest.mark.parametrize("seed", list(range(20)))
def test_drive_values_stay_bounded(seed: int) -> None:
    """Every drive value stays in [0.0, 1.0] at every tick for 10_000 ticks.

    This is the Brain-side DoS guard: if the explicit clamp in step() were
    ever dropped or miscoded, one drive rising above 1.0 would be enough
    to fail the property across any seed. Asserting at every tick (not
    just final) catches transient overflows as well.
    """
    runtime = AnankeRuntime(seed=seed)
    for t in range(1, 10_001):
        runtime.on_tick(t)
        for drive in DRIVE_NAMES:
            value = runtime.state.values[drive]
            assert 0.0 <= value <= 1.0, (
                f"drive={drive.value} value={value} out of [0,1] at tick={t} seed={seed}"
            )


def test_drive_values_reach_upper_clamp() -> None:
    """With default rise rates, hunger saturates at 1.0 within 10_000 ticks.

    Hunger baseline=0.3, rise=0.0003 → value=1.0 at tick ~2334. Asserting
    the clamp is hit (not exceeded) and held at exactly 1.0 thereafter.
    This proves the upper bound of the clamp is LIVE behavior, not a
    latent branch.
    """
    runtime = AnankeRuntime(seed=0)
    for t in range(1, 10_001):
        runtime.on_tick(t)
    # Hunger must have saturated.
    from noesis_brain.ananke import DriveName

    assert runtime.state.values[DriveName.HUNGER] == 1.0
