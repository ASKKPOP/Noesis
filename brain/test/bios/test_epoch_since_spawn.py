"""Phase 10b Wave 0 RED stub — CHRONOS-03 epoch_since_spawn.

References `noesis_brain.bios.BiosRuntime` (does not exist at Wave 0) ⇒ RED.
Wave 1 → GREEN.

epoch_since_spawn(current_tick) is a pure constructor-attribute subtraction:
  current_tick - self.birth_tick

Properties:
- birth_tick is set at construction; never re-scanned.
- result at current_tick == birth_tick is 0.
- result is always non-negative for current_tick >= birth_tick.
- pure function of (birth_tick, current_tick) — no wall clock involvement.
"""

from __future__ import annotations

from noesis_brain.bios import BiosRuntime  # noqa: F401  RED at Wave 0


def test_epoch_basic_subtraction() -> None:
    """epoch_since_spawn(150) on BiosRuntime(birth_tick=100) returns 50."""
    runtime = BiosRuntime(seed=1, birth_tick=100)
    assert runtime.epoch_since_spawn(150) == 50


def test_epoch_at_birth_is_zero() -> None:
    """current_tick == birth_tick ⇒ epoch == 0."""
    runtime = BiosRuntime(seed=1, birth_tick=42)
    assert runtime.epoch_since_spawn(42) == 0


def test_epoch_memoized_birth_tick() -> None:
    """Calling epoch_since_spawn twice does not mutate birth_tick.

    birth_tick is a constructor-fixed attribute; multiple reads must
    return the original value.
    """
    runtime = BiosRuntime(seed=1, birth_tick=10)
    assert runtime.epoch_since_spawn(20) == 10
    assert runtime.epoch_since_spawn(30) == 20
    assert runtime.birth_tick == 10


def test_epoch_pure_no_wall_clock() -> None:
    """Same (birth_tick, current_tick) inputs always return same output.

    Calling repeatedly with identical inputs across simulated wall-clock
    sleeps must not vary (no datetime.now() smuggled in).
    """
    import time

    runtime = BiosRuntime(seed=1, birth_tick=0)
    first = runtime.epoch_since_spawn(1000)
    time.sleep(0.01)
    second = runtime.epoch_since_spawn(1000)
    assert first == second == 1000
