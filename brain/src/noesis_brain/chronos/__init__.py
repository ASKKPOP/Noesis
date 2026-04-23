"""Chronos — Brain-local subjective-time subsystem.

Per CONTEXT.md D-10b-07: STRICTLY Brain-local. No wire events, no RPC.
Biases memory recency ordering; no new allowlist members.

NO wall-clock reads, NO random, NO uuid — determinism contract enforced by
brain/test/test_bios_no_walltime.py grep gate.
"""
from __future__ import annotations

from noesis_brain.chronos.subjective_time import (
    compute_multiplier,
    recency_score_by_tick,
    score_with_chronos,
)
from noesis_brain.chronos.types import (
    BOREDOM_PENALTY,
    CURIOSITY_BOOST,
    SUBJECTIVE_MULT_MAX,
    SUBJECTIVE_MULT_MIN,
)

__all__ = [
    # formula
    "compute_multiplier",
    "recency_score_by_tick",
    "score_with_chronos",
    # constants
    "SUBJECTIVE_MULT_MIN",
    "SUBJECTIVE_MULT_MAX",
    "CURIOSITY_BOOST",
    "BOREDOM_PENALTY",
]
