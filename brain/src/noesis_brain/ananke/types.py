"""Ananke types — closed 5-drive enum, bucketed levels, crossing event.

The five drive names are a frozen closed enum (DRIVE-01). Adding a sixth
drive (e.g. ENERGY — a Phase 10b Bios concern) MUST go through an explicit
phase that updates both this enum and the allowlist in Grid.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class DriveName(str, Enum):
    """Closed 5-drive enum (DRIVE-01).

    Order matters — DRIVE_NAMES below pins canonical iteration order used
    by UI-SPEC, audit stream, and all per-drive lookups.
    """

    HUNGER = "hunger"
    CURIOSITY = "curiosity"
    SAFETY = "safety"
    BOREDOM = "boredom"
    LONELINESS = "loneliness"


class DriveLevel(str, Enum):
    """Bucketed tier a drive currently occupies.

    The Operator sees `med → high (rising)`, never `0.67 → 0.71`.
    Float drive values never cross the Brain↔Grid wire (DRIVE-05).
    """

    LOW = "low"
    MED = "med"
    HIGH = "high"


class Direction(str, Enum):
    """Direction of a threshold crossing.

    Derived from bucket ordinal transitions, NOT from raw float deltas —
    preserves the hash-only cross-boundary invariant (DRIVE-05).
    """

    RISING = "rising"
    FALLING = "falling"


# Stable iteration order — matches DRIVE_ORDER in UI-SPEC and REQUIREMENTS DRIVE-01.
DRIVE_NAMES: tuple[DriveName, ...] = (
    DriveName.HUNGER,
    DriveName.CURIOSITY,
    DriveName.SAFETY,
    DriveName.BOREDOM,
    DriveName.LONELINESS,
)


@dataclass(frozen=True)
class DriveState:
    """Per-DID, per-tick drive values and their bucketed levels.

    `values` maps each DriveName → float in [0.0, 1.0].
    `levels` maps each DriveName → DriveLevel (the last-committed bucket).

    Frozen dataclass: `step()` returns a new DriveState rather than mutating.
    """

    values: dict[DriveName, float]
    levels: dict[DriveName, DriveLevel]


@dataclass(frozen=True)
class CrossingEvent:
    """Emitted ONLY when a drive's bucket changes (hysteresis-guarded).

    Closed 3-tuple from Brain's perspective — Grid injects `did` and `tick`
    when it converts this to an `ananke.drive_crossed` audit entry. The wire
    payload is the closed 5-tuple `{did, tick, drive, level, direction}`
    (D-10a-03).
    """

    drive: DriveName
    level: DriveLevel  # the NEW level (after the crossing)
    direction: Direction
