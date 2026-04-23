"""Chronos constants per CONTEXT.md D-10b-05 (locked).

Brain-local ONLY. Never crosses wire. No audit event (D-10b-05, D-10b-11).
"""
from __future__ import annotations

from noesis_brain.ananke.types import DriveLevel

SUBJECTIVE_MULT_MIN: float = 0.25
SUBJECTIVE_MULT_MAX: float = 4.0

# curiosity_weight: LOW=0.0, MED=1.0, HIGH=3.0
CURIOSITY_BOOST: dict[DriveLevel, float] = {
    DriveLevel.LOW: 0.0,
    DriveLevel.MED: 1.0,
    DriveLevel.HIGH: 3.0,
}

# boredom_penalty: LOW=0.0, MED=0.3, HIGH=0.75
BOREDOM_PENALTY: dict[DriveLevel, float] = {
    DriveLevel.LOW: 0.0,
    DriveLevel.MED: 0.3,
    DriveLevel.HIGH: 0.75,
}
