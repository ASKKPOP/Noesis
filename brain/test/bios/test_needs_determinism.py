"""Phase 10b Wave 0 RED stub — BIOS-01 byte-identical replay.

Clones brain/test/ananke/test_drives_determinism.py shape with renames:
  AnankeRuntime → BiosRuntime, DriveName → NeedName, drives → needs.

The stub references `noesis_brain.bios.*` which does not exist at Wave 0.
Import failure ⇒ RED. Wave 1 (Plan 10b-02) creates the production module
which turns this GREEN.

Addresses:
- BIOS-01 literal spec: deterministic (seed, tick) recurrence,
  byte-identical replay across 10_000 ticks.
- T-09-03: wall-clock coupling forbidden; replay at tickRateMs=1000 is
  identical to tickRateMs=1_000_000 — tested here by injecting time.sleep
  between ticks in one run and not in another.
"""

from __future__ import annotations

import json
import time

from noesis_brain.bios import BiosRuntime, NeedName  # noqa: F401  RED at Wave 0


def _values_as_sorted_json(runtime: "BiosRuntime") -> str:
    """Serialize NeedState.values deterministically for byte-equality check."""
    return json.dumps(
        sorted(((n.value, v) for n, v in runtime.state.values.items()), key=lambda kv: kv[0])
    )


def test_replay_identity() -> None:
    """Two runtimes with seed=42 stepped 10_000 ticks produce byte-identical state."""
    a = BiosRuntime(seed=42)
    b = BiosRuntime(seed=42)

    for t in range(1, 10_001):
        a.on_tick(t)
        b.on_tick(t)

    assert _values_as_sorted_json(a) == _values_as_sorted_json(b)
    assert {n.value: lvl.value for n, lvl in a.state.levels.items()} == {
        n.value: lvl.value for n, lvl in b.state.levels.items()
    }


def test_no_wall_clock_coupling() -> None:
    """Adding time.sleep(0.001) between ticks of one runtime must not change output.

    T-09-03 inherited check: wall-clock reads are forbidden in bios sources;
    inserting a sleep in the test must not perturb the trace.
    """
    fast = BiosRuntime(seed=7)
    slow = BiosRuntime(seed=7)

    for t in range(1, 501):
        fast.on_tick(t)
    for t in range(1, 501):
        slow.on_tick(t)
        time.sleep(0.001)

    assert _values_as_sorted_json(fast) == _values_as_sorted_json(slow)


def test_two_tick_rate_equivalence() -> None:
    """tick is a pure integer input; any tick rate produces the same trace.

    Replay at tickRateMs=1000 == tickRateMs=1_000_000 — same tick sequence,
    same trajectory, regardless of wall-clock cadence.
    """
    fast = BiosRuntime(seed=1)
    slow = BiosRuntime(seed=1)

    fast_trace: list[str] = []
    slow_trace: list[str] = []

    for t in range(1, 101):
        fast.on_tick(t)
        fast_trace.append(_values_as_sorted_json(fast))

    for t in range(1, 101):
        slow.on_tick(t)
        slow_trace.append(_values_as_sorted_json(slow))
        time.sleep(0.0005)

    assert fast_trace == slow_trace
