"""Determinism tests — byte-identical replay, no wall-clock coupling.

Addresses:
- DRIVE-02 literal spec: deterministic (seed, tick) recurrence, byte-identical
  replay across 10_000 ticks.
- T-09-03: wall-clock coupling forbidden; replay at tickRateMs=1000 is
  identical to tickRateMs=1_000_000 — tested here by injecting time.sleep
  between ticks in one run and not in another.
"""

from __future__ import annotations

import json
import time

from noesis_brain.ananke import AnankeRuntime, DriveName


def _values_as_sorted_json(runtime: AnankeRuntime) -> str:
    """Serialize DriveState.values deterministically for byte-equality check."""
    return json.dumps(
        sorted(((d.value, v) for d, v in runtime.state.values.items()), key=lambda kv: kv[0])
    )


def test_replay_identity() -> None:
    """Two runtimes with seed=42 stepped 10_000 ticks produce byte-identical state."""
    a = AnankeRuntime(seed=42)
    b = AnankeRuntime(seed=42)

    for t in range(1, 10_001):
        a.on_tick(t)
        b.on_tick(t)

    assert _values_as_sorted_json(a) == _values_as_sorted_json(b)
    # Levels (bucketed) must also be byte-identical.
    assert {d.value: lvl.value for d, lvl in a.state.levels.items()} == {
        d.value: lvl.value for d, lvl in b.state.levels.items()
    }


def test_no_wall_clock_coupling() -> None:
    """Adding time.sleep(0.001) between ticks of one runtime must not change output.

    This is the T-09-03 inherited check: wall-clock reads are forbidden in
    ananke sources, so the only coupling a clock could smuggle in would be
    via an implicit time.time() read inside step(). Insert a sleep on one
    run and assert byte-identical output.
    """
    fast = AnankeRuntime(seed=7)
    slow = AnankeRuntime(seed=7)

    for t in range(1, 501):
        fast.on_tick(t)
    for t in range(1, 501):
        slow.on_tick(t)
        # Short sleep in the test (NOT in ananke source). If any hidden
        # wall-clock dependency exists in step(), this run diverges.
        time.sleep(0.001)

    assert _values_as_sorted_json(fast) == _values_as_sorted_json(slow)


def test_seed_independence_v1() -> None:
    """In 10a, seed is reserved but unused by the math.

    A future phase may introduce seed-conditioned perturbation; this test
    locks the current (seed-independent) behavior so any such introduction
    flips it to an assert-divergence test in the same commit.
    """
    a = AnankeRuntime(seed=0)
    b = AnankeRuntime(seed=999)

    for t in range(1, 1001):
        a.on_tick(t)
        b.on_tick(t)

    # Seed-independence: same state regardless of seed.
    assert a.state.values[DriveName.HUNGER] == b.state.values[DriveName.HUNGER]
    assert _values_as_sorted_json(a) == _values_as_sorted_json(b)


def test_two_tick_rate_equivalence() -> None:
    """tick is a pure integer input; any tick rate produces the same trace.

    Simulate a 'fast' tick cadence (no gap) and a 'slow' one (with real
    sleep). Both must produce the same trajectory for the same tick
    sequence — replay at tickRateMs=1000 == tickRateMs=1_000_000.
    """
    fast = AnankeRuntime(seed=1)
    slow = AnankeRuntime(seed=1)

    fast_trace = []
    slow_trace = []

    for t in range(1, 101):
        fast.on_tick(t)
        fast_trace.append(_values_as_sorted_json(fast))

    for t in range(1, 101):
        slow.on_tick(t)
        slow_trace.append(_values_as_sorted_json(slow))
        time.sleep(0.0005)

    assert fast_trace == slow_trace
