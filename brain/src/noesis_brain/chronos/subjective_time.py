"""Pure subjective-time computations. Brain-local only.

Per CONTEXT.md D-10b-07: STRICTLY Brain-local. No wire events, no RPC.
Biases memory recency ordering; no new allowlist members.
"""
from __future__ import annotations

from noesis_brain.ananke.types import DriveLevel
from noesis_brain.chronos.types import (
    BOREDOM_PENALTY,
    CURIOSITY_BOOST,
    SUBJECTIVE_MULT_MAX,
    SUBJECTIVE_MULT_MIN,
)
from noesis_brain.memory.types import Memory


def compute_multiplier(
    curiosity_level: DriveLevel,
    boredom_level: DriveLevel,
) -> float:
    """Per D-10b-05: clamp(1 + boost(curiosity) - penalty(boredom), 0.25, 4.0).

    Curiosity stretches time (>1 → memories feel fresher).
    Boredom compresses time (<1 → memories feel older).

    Brain-local ONLY. Never crosses wire. No audit event (D-10b-05, D-10b-11).
    """
    raw = 1.0 + CURIOSITY_BOOST[curiosity_level] - BOREDOM_PENALTY[boredom_level]
    return max(SUBJECTIVE_MULT_MIN, min(SUBJECTIVE_MULT_MAX, raw))


def recency_score_by_tick(
    memory: Memory,
    current_tick: int,
    decay_rate: float = 0.99,
) -> float:
    """Tick-based recency — replaces wall-clock for determinism (CHRONOS-02).

    recency = decay_rate ** max(0, current_tick - memory.tick)

    Args:
        memory: Memory instance (uses memory.tick for age computation).
        current_tick: The current Grid tick.
        decay_rate: Per-tick decay factor (default 0.99).

    Returns:
        float in (0.0, 1.0] — 1.0 when memory.tick == current_tick.
    """
    ticks_ago = max(0, current_tick - memory.tick)
    return decay_rate ** ticks_ago


def score_with_chronos(
    memory: Memory,
    current_tick: int,
    multiplier: float,
    decay_rate: float = 0.99,
) -> float:
    """Tick-based recency scaled by subjective multiplier (D-10b-06).

    score = min(1.0, recency * multiplier)

    Args:
        memory: Memory instance.
        current_tick: Current Grid tick.
        multiplier: Subjective multiplier in [0.25, 4.0] from compute_multiplier.
        decay_rate: Per-tick decay factor.

    Returns:
        float in [0.0, 1.0].
    """
    recency = recency_score_by_tick(memory, current_tick, decay_rate)
    return max(0.0, min(1.0, recency * multiplier))
