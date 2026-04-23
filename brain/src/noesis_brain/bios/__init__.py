"""Bios — bodily needs subsystem (energy, sustenance).

Clone of ananke/ applied to the 2-need Bios subset. Per phase 10b / D-10b-02,
needs rise deterministically and elevate matching Ananke drives once per
threshold crossing (NOT per tick). See PHILOSOPHY.md §1: body and mind are
distinct — Bios drives the body, Ananke the mind.

Determinism contract:
    Given (seed, tick) and a starting NeedState, the entire sequence of
    future states is byte-identical regardless of wall-clock cadence
    (BIOS-01, T-09-03). NO wall-clock reads, NO random, NO uuid.

Sole-producer invariant:
    Bios crossings raise ananke drive levels via AnankeRuntime.elevate_drive()
    (in-memory mutation only). The ananke.drive_crossed audit event is still
    emitted SOLELY by drives.detect_crossing() on the next tick — Bios does
    NOT bypass the sole-producer boundary.
"""

from noesis_brain.ananke.types import Direction, DriveLevel  # re-export for tests
from noesis_brain.bios.config import (
    DECAY_FACTOR,
    HYSTERESIS_BAND,
    NEED_BASELINES,
    NEED_RISE_RATES,
    NEED_TO_DRIVE,
    TAU,
    THRESHOLD_HIGH,
    THRESHOLD_LOW,
)
from noesis_brain.bios.loader import BiosLoader
from noesis_brain.bios.needs import (
    bucket,
    detect_crossing,
    initial_state,
    is_terminal,
    step,
)
from noesis_brain.bios.runtime import BiosRuntime
from noesis_brain.bios.types import (
    NEED_NAMES,
    NeedCrossing,
    NeedName,
    NeedState,
)

__all__ = [
    # Re-exports from ananke (shared bucket vocabulary).
    "Direction",
    "DriveLevel",
    # Bios types.
    "NeedName",
    "NEED_NAMES",
    "NeedState",
    "NeedCrossing",
    # Bios config.
    "NEED_BASELINES",
    "NEED_RISE_RATES",
    "THRESHOLD_LOW",
    "THRESHOLD_HIGH",
    "HYSTERESIS_BAND",
    "TAU",
    "DECAY_FACTOR",
    "NEED_TO_DRIVE",
    # Bios functions.
    "step",
    "bucket",
    "detect_crossing",
    "initial_state",
    "is_terminal",
    # Bios runtime + factory.
    "BiosRuntime",
    "BiosLoader",
]
