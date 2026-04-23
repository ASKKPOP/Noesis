"""Bios types — closed 2-need enum, NeedState, NeedCrossing.

Clone of ananke/types.py applied to the 2-need Bios subset (energy, sustenance).
DriveLevel and Direction are imported from ananke — Bios elevation maps onto
the same bucket vocabulary (D-10b-02). No duplicate enum.

Per CONTEXT.md D-10b-02 / PATTERNS.md: NeedState carries per-need floats +
bucketed levels. Frozen dataclass — step() returns a new NeedState; levels
dict inside may be mutated for in-place-level bookkeeping by runtime, but
callers SHOULD NOT mutate from outside.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from noesis_brain.ananke.types import Direction, DriveLevel


class NeedName(str, Enum):
    """Closed 2-need enum (BIOS-01).

    Order pins canonical iteration order used by UI-SPEC, audit stream,
    and all per-need lookups. Adding a third need requires an explicit
    phase update — this enum is frozen.
    """

    ENERGY = "energy"
    SUSTENANCE = "sustenance"


# Stable iteration order — matches NEED_ORDER in UI-SPEC.
NEED_NAMES: tuple[NeedName, ...] = (
    NeedName.ENERGY,
    NeedName.SUSTENANCE,
)


@dataclass(frozen=True)
class NeedState:
    """Per-DID, per-tick need values and their bucketed levels.

    `values` maps each NeedName → float in [0.0, 1.0].
    `levels` maps each NeedName → DriveLevel (shared bucket vocabulary with ananke).

    Frozen field refs: `values`/`levels` dict references are locked, but their
    contents are mutable dicts (callers outside the subsystem SHOULD NOT mutate;
    tests may seed values via direct mutation — documented contract).
    """

    values: dict[NeedName, float]
    levels: dict[NeedName, DriveLevel]


@dataclass(frozen=True)
class NeedCrossing:
    """Emitted ONLY when a need's bucket changes (hysteresis-guarded).

    Closed 3-tuple from Brain's perspective. Not a wire payload — Bios does NOT
    emit audit events directly. Crossings drive the one-shot elevator into
    AnankeRuntime (D-10b-02); the ananke.drive_crossed event is the sole-wire
    producer and is emitted next tick via drives.step()/detect_crossing().
    """

    need: NeedName
    level: DriveLevel  # the NEW level (after the crossing)
    direction: Direction
