"""Phase 10b Wave 0 RED stub — BIOS-01 baseline + rise-only behavior (D-10b-03).

References `noesis_brain.bios.*` which does not exist at Wave 0 ⇒ RED.
Wave 1 (Plan 10b-02) creates the production module → GREEN.

Verifies:
- initial_state() returns energy=0.3, sustenance=0.3 bucketed at LOW.
- rise-only: starting at baseline, value increases monotonically per tick
  (no satiation in the math itself; satiation lives in nous-runner action
  side, not in the drive equations).
- relaxation toward baseline from below (set energy=0.1, run 100 ticks,
  approach 0.3 from below; never overshoot upward via baseline pull alone
  until rise dominates).
"""

from __future__ import annotations

from noesis_brain.bios import (  # noqa: F401  RED at Wave 0
    BiosRuntime,
    DriveLevel,
    NeedName,
    NeedState,
    initial_state,
    step,
)


def test_initial_state_baseline() -> None:
    """initial_state() places energy + sustenance at 0.3, both LOW-bucketed."""
    state: NeedState = initial_state()
    assert state.values[NeedName.ENERGY] == 0.3
    assert state.values[NeedName.SUSTENANCE] == 0.3
    assert state.levels[NeedName.ENERGY] == DriveLevel.LOW
    assert state.levels[NeedName.SUSTENANCE] == DriveLevel.LOW


def test_rise_only_monotonic() -> None:
    """From baseline, both needs increase monotonically per tick for 100 ticks."""
    state = initial_state()
    prev_energy = state.values[NeedName.ENERGY]
    prev_sustenance = state.values[NeedName.SUSTENANCE]
    for t in range(1, 101):
        state, _ = step(state, t)
        assert state.values[NeedName.ENERGY] >= prev_energy, (
            f"energy not monotonic at tick={t}: prev={prev_energy} new={state.values[NeedName.ENERGY]}"
        )
        assert state.values[NeedName.SUSTENANCE] >= prev_sustenance, (
            f"sustenance not monotonic at tick={t}"
        )
        prev_energy = state.values[NeedName.ENERGY]
        prev_sustenance = state.values[NeedName.SUSTENANCE]


def test_relaxation_from_below_baseline() -> None:
    """Starting below baseline, value approaches baseline from below.

    With energy=0.1 (well below baseline 0.3), the relaxation term pulls up
    toward 0.3. The sum of relaxation + rise must be non-negative — the
    value never decreases. Crossing past 0.3 is allowed only via the rise
    term once the relaxation gap closes.
    """
    state = initial_state()
    # Inject sub-baseline manually for the test.
    state.values[NeedName.ENERGY] = 0.1
    prev = 0.1
    for t in range(1, 101):
        state, _ = step(state, t)
        assert state.values[NeedName.ENERGY] >= prev, (
            f"energy decreased below baseline at tick={t}: prev={prev} new={state.values[NeedName.ENERGY]}"
        )
        prev = state.values[NeedName.ENERGY]


def test_runtime_baseline_via_runtime_object() -> None:
    """BiosRuntime(seed=1) exposes the same baseline state via .state attribute."""
    runtime = BiosRuntime(seed=1)
    assert runtime.state.values[NeedName.ENERGY] == 0.3
    assert runtime.state.values[NeedName.SUSTENANCE] == 0.3
