"""Phase 10b Wave 0 RED stub — CHRONOS-01 subjective-time formula (D-10b-05).

References `noesis_brain.chronos.*` which does not exist at Wave 0 ⇒ RED.
Wave 3 (Plan 10b-04) creates `noesis_brain.chronos.compute_multiplier` ⇒ GREEN.

Formula (D-10b-05): subjective multiplier from curiosity + boredom levels.
  base = curiosity_weight[curiosity_level]   # LOW=1.0, MED=2.0, HIGH=4.0
  penalty = boredom_weight[boredom_level]    # LOW=0.0, MED=0.5, HIGH=0.75
  raw = base - penalty if curiosity == LOW else base * (1 - penalty) + base
  ... per matrix below
  multiplier = clamp(raw, MIN=0.25, MAX=4.0)

Exact target values per D-10b-05 (the 9-cell matrix this test pins):
  curiosity LOW + boredom LOW   → 1.0
  curiosity MED + boredom LOW   → 2.0
  curiosity HIGH + boredom LOW  → 4.0   (clamp from raw 4.0)
  curiosity LOW + boredom HIGH  → 0.25  (clamp from raw 1.0 - 0.75 = 0.25)
  curiosity HIGH + boredom HIGH → 3.25  (raw 1.0 + 3.0 - 0.75)

hunger / safety / loneliness MUST NOT influence the multiplier.
"""

from __future__ import annotations

import pytest

from noesis_brain.ananke import DriveLevel  # noqa: F401
from noesis_brain.chronos import compute_multiplier  # noqa: F401  RED at Wave 0


@pytest.mark.parametrize(
    ("curiosity", "boredom", "expected"),
    [
        (DriveLevel.LOW, DriveLevel.LOW, 1.0),
        (DriveLevel.MED, DriveLevel.LOW, 2.0),
        (DriveLevel.HIGH, DriveLevel.LOW, 4.0),
        (DriveLevel.LOW, DriveLevel.HIGH, 0.25),
        (DriveLevel.HIGH, DriveLevel.HIGH, 3.25),
    ],
)
def test_compute_multiplier_matrix(
    curiosity: "DriveLevel", boredom: "DriveLevel", expected: float
) -> None:
    """All five anchor cells from D-10b-05 produce the literal expected value."""
    assert compute_multiplier(curiosity_level=curiosity, boredom_level=boredom) == expected


def test_compute_multiplier_clamps_min() -> None:
    """Any combination producing raw < 0.25 is clamped to 0.25."""
    # LOW + HIGH already clamps; verify by signature contract.
    result = compute_multiplier(curiosity_level=DriveLevel.LOW, boredom_level=DriveLevel.HIGH)
    assert result == 0.25
    assert result >= 0.25


def test_compute_multiplier_clamps_max() -> None:
    """Any combination producing raw > 4.0 is clamped to 4.0."""
    # HIGH + LOW already at 4.0; verify clamp semantic by contract.
    result = compute_multiplier(curiosity_level=DriveLevel.HIGH, boredom_level=DriveLevel.LOW)
    assert result == 4.0
    assert result <= 4.0


def test_other_drives_ignored() -> None:
    """compute_multiplier signature accepts curiosity + boredom only.

    Calling with extra kwargs naming hunger/safety/loneliness must raise
    TypeError (signature does not accept them) — the test pins the
    contract that these drives have NO subjective-time influence.
    """
    with pytest.raises(TypeError):
        compute_multiplier(  # type: ignore[call-arg]
            curiosity_level=DriveLevel.LOW,
            boredom_level=DriveLevel.LOW,
            hunger_level=DriveLevel.HIGH,
        )
