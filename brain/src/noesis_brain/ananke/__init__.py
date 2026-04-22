"""Ananke — deterministic drive dynamics subsystem (Phase 10a).

Pure Python, stdlib only. Hash-only cross-boundary (DRIVE-05).
See PHILOSOPHY.md §6 — drives are advisory, not coercive.

Drive math lives entirely here as a sibling of psyche/, telos/, thymos/.
Given a (seed, tick) pair the five drive values are a pure deterministic
function — no wall-clock reads, no Math.random, no external I/O (DRIVE-02).

Five drives (closed enum, DRIVE-01):
    hunger, curiosity, safety, boredom, loneliness
"""

from noesis_brain.ananke.types import (
    DriveName,
    DriveLevel,
    Direction,
    DriveState,
    CrossingEvent,
    DRIVE_NAMES,
)
from noesis_brain.ananke.drives import (
    step,
    bucket,
    detect_crossing,
    initial_state,
)

__all__ = [
    "DriveName",
    "DriveLevel",
    "Direction",
    "DriveState",
    "CrossingEvent",
    "DRIVE_NAMES",
    "step",
    "bucket",
    "detect_crossing",
    "initial_state",
]
