"""Bios configuration — per-need baselines, rise rates, thresholds.

Verbatim clone of ananke/config.py applied to 2 needs. `math.exp` is called
exactly once, here at module load, to pre-compute DECAY_FACTOR. The per-tick
hot path in needs.py MUST NOT call math.exp.

Per CONTEXT.md D-10b-02, D-10b-04 and RESEARCH.md Pattern 5.
"""

from __future__ import annotations

import math

from noesis_brain.ananke.types import DriveName
from noesis_brain.bios.types import NeedName


# Per-need passive baselines. Locked 2026-04-22 per D-10b-03.
# Both needs start at 0.3 (below THRESHOLD_LOW=0.33) so first-paint bucket is LOW.
NEED_BASELINES: dict[NeedName, float] = {
    NeedName.ENERGY: 0.3,
    NeedName.SUSTENANCE: 0.3,
}

# Per-need rise rates (per-tick growth above baseline).
# Mirrors ananke hunger/safety rise rates (D-10b-03 + A5).
NEED_RISE_RATES: dict[NeedName, float] = {
    NeedName.ENERGY: 0.0003,      # mirrors hunger rise rate
    NeedName.SUSTENANCE: 0.0001,  # mirrors safety rise rate
}

# Threshold geometry — equal thirds with ±HYSTERESIS_BAND guard.
# Identical to ananke: clones bucket vocabulary across subsystems.
THRESHOLD_LOW: float = 0.33
THRESHOLD_HIGH: float = 0.66
HYSTERESIS_BAND: float = 0.02

# Baseline relaxation time-constant (ticks). Locked by planner — mirrors ananke.
TAU: int = 500

# Pre-computed at module load — `math.exp` MUST NOT appear on the hot per-tick
# path. This is the ONLY `math.exp` call in the bios subsystem.
DECAY_FACTOR: float = math.exp(-1.0 / TAU)

# Per CONTEXT.md D-10b-04: each Bios need elevates exactly one Ananke drive.
# energy → hunger, sustenance → safety. curiosity, boredom, loneliness are
# mind-driven (not Bios-driven) and MUST NOT appear in this map.
NEED_TO_DRIVE: dict[NeedName, DriveName] = {
    NeedName.ENERGY: DriveName.HUNGER,
    NeedName.SUSTENANCE: DriveName.SAFETY,
}
