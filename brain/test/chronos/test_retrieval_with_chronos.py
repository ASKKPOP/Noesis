"""Phase 10b Wave 0 RED stub — CHRONOS-01 retrieval scoring (D-10b-06).

References `noesis_brain.chronos.*` (does not exist at Wave 0) ⇒ RED.
Wave 3 (Plan 10b-04) creates the retrieval module ⇒ GREEN.

Memory recency uses tick-delta only (never datetime.now). The
`recency_score_by_tick` baseline:
  recency(memory, current_tick) = decay_rate ** (current_tick - memory.tick)

The chronos-aware variant scales recency by the subjective multiplier:
  score_with_chronos(memory, current_tick, multiplier) =
      min(1.0, recency * multiplier)

Properties:
- ticks_ago=0 ⇒ recency=1.0 (cannot be more recent than now).
- ticks_ago=10 with decay_rate=0.99 ⇒ recency = 0.99**10 ≈ 0.904.
- multiplier=2.0 doubles recency, then clamps to ≤1.0.
- determinism: same inputs ⇒ same output (no datetime in path).
"""

from __future__ import annotations

import time

from noesis_brain.chronos import (  # noqa: F401  RED at Wave 0
    recency_score_by_tick,
    score_with_chronos,
)
from noesis_brain.memory.types import Memory  # exists in 10a — used as fixture target


def _make_memory(tick: int) -> "Memory":
    """Build a minimal Memory at the given tick using the actual constructor."""
    from noesis_brain.memory.types import MemoryType
    return Memory(
        memory_type=MemoryType.OBSERVATION,
        content="x",
        tick=tick,
    )


def test_recency_at_now_is_one() -> None:
    """current_tick == memory.tick ⇒ recency == 1.0."""
    mem = _make_memory(tick=100)
    assert recency_score_by_tick(mem, current_tick=100, decay_rate=0.99) == 1.0


def test_recency_decays_geometrically() -> None:
    """ticks_ago=10 with decay_rate=0.99 ⇒ recency == 0.99**10."""
    mem = _make_memory(tick=90)
    expected = 0.99**10
    actual = recency_score_by_tick(mem, current_tick=100, decay_rate=0.99)
    assert abs(actual - expected) < 1e-9


def test_chronos_multiplier_scales_then_clamps() -> None:
    """multiplier=2.0 doubles recency; clamps at 1.0 ceiling."""
    mem = _make_memory(tick=90)
    base = recency_score_by_tick(mem, current_tick=100, decay_rate=0.99)
    # base ≈ 0.904; doubled ≈ 1.808; must clamp to 1.0.
    scaled = score_with_chronos(mem, current_tick=100, multiplier=2.0, decay_rate=0.99)
    assert scaled == min(1.0, base * 2.0)
    assert scaled <= 1.0


def test_chronos_multiplier_below_one_attenuates() -> None:
    """multiplier=0.5 halves recency; result strictly < base."""
    mem = _make_memory(tick=90)
    base = recency_score_by_tick(mem, current_tick=100, decay_rate=0.99)
    attenuated = score_with_chronos(mem, current_tick=100, multiplier=0.5, decay_rate=0.99)
    assert attenuated < base
    assert abs(attenuated - base * 0.5) < 1e-9


def test_recency_deterministic_across_wall_clock() -> None:
    """Same inputs over a wall-clock sleep return identical outputs."""
    mem = _make_memory(tick=90)
    first = recency_score_by_tick(mem, current_tick=100, decay_rate=0.99)
    time.sleep(0.01)
    second = recency_score_by_tick(mem, current_tick=100, decay_rate=0.99)
    assert first == second
