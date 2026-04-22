"""Ananke configuration — per-drive baselines, rise rates, thresholds.

Every constant a downstream drive calculation might need lives here so that
`drives.py` contains zero magic numbers. `math.exp` is called exactly once
in the entire subsystem — here, at module load — to pre-compute DECAY_FACTOR.
"""

from __future__ import annotations

import math

from noesis_brain.ananke.types import DriveName


# Per-drive passive baselines — the "elastic floor" each drive relaxes toward
# when below baseline. Locked 2026-04-22 per D-10a-01.
DRIVE_BASELINES: dict[DriveName, float] = {
    DriveName.HUNGER: 0.3,
    DriveName.CURIOSITY: 0.5,
    DriveName.SAFETY: 0.2,
    DriveName.BOREDOM: 0.4,
    DriveName.LONELINESS: 0.4,
}

# Per-drive rise rates (above-baseline growth per tick).
# Rationale: hunger at 0.0003/tick reaches 1.0 from baseline 0.3 in ~2333 ticks,
# giving a 10_000-tick RIG run ~4 crossings/drive — non-degenerate, not saturated.
DRIVE_RISE_RATES: dict[DriveName, float] = {
    DriveName.HUNGER: 0.0003,
    DriveName.CURIOSITY: 0.0002,
    DriveName.SAFETY: 0.0001,
    DriveName.BOREDOM: 0.0002,
    DriveName.LONELINESS: 0.0002,
}

# Threshold geometry — equal thirds with ±HYSTERESIS_BAND guard.
# A drive at level `med` drops to `low` only when value < 0.33 - 0.02 = 0.31;
# rises from `med` to `high` only when value > 0.66 + 0.02 = 0.68.
THRESHOLD_LOW: float = 0.33
THRESHOLD_HIGH: float = 0.66
HYSTERESIS_BAND: float = 0.02

# Baseline relaxation time-constant (ticks). Locked by planner.
TAU: int = 500

# Pre-computed at module load — `math.exp` MUST NOT appear on the hot per-tick
# path. This is the ONLY `math.exp` call in the ananke subsystem (see grep gate
# in Plan 10a-06).
DECAY_FACTOR: float = math.exp(-1.0 / TAU)
