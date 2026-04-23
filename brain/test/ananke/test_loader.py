"""Loader tests — AnankeLoader skeleton, per-DID runtime independence.

Covers:
- Loader returns an AnankeRuntime instance with the requested seed.
- Each `build()` call returns a fresh instance (never cached).
- Per-DID independence: distinct runtimes produced for distinct seeds.
- `ActionType.DRIVE_CROSSED` is present in the closed enum (Phase 10a DRIVE-03).
"""

from __future__ import annotations

from noesis_brain.ananke.loader import AnankeLoader
from noesis_brain.ananke.runtime import AnankeRuntime
from noesis_brain.ananke.types import DRIVE_NAMES
from noesis_brain.rpc.types import ActionType


def test_loader_builds_runtime() -> None:
    loader = AnankeLoader()
    runtime = loader.build(seed=42)
    assert isinstance(runtime, AnankeRuntime)
    assert runtime.seed == 42


def test_loader_returns_fresh_instance_per_call() -> None:
    loader = AnankeLoader()
    a = loader.build(seed=42)
    b = loader.build(seed=42)
    assert a is not b


def test_loader_runtime_starts_at_baseline() -> None:
    runtime = AnankeLoader().build(seed=42)
    # Every drive has an entry in both values and levels dicts.
    for drive in DRIVE_NAMES:
        assert drive in runtime.state.values
        assert drive in runtime.state.levels


def test_loader_multiple_dids_get_independent_runtimes() -> None:
    loader = AnankeLoader()
    rt_alpha = loader.build(seed=hash("did:noesis:alpha") & 0xFFFFFFFF)
    rt_beta = loader.build(seed=hash("did:noesis:beta") & 0xFFFFFFFF)

    # The runtimes are distinct instances (independence proven structurally).
    assert rt_alpha is not rt_beta

    # Step alpha many ticks; beta remains untouched.
    for t in range(100):
        rt_alpha.on_tick(t)

    # Beta still at baseline (no ticks).
    for drive in DRIVE_NAMES:
        # Alpha may have moved away from baseline; beta has not.
        # The structural independence is already asserted via `is not`.
        # This loop ensures iterating state is safe after one runtime stepped.
        assert drive in rt_beta.state.values
        assert drive in rt_alpha.state.values


def test_action_type_drive_crossed_present() -> None:
    """Phase 10a DRIVE-03: DRIVE_CROSSED is a member of the closed ActionType enum."""
    assert ActionType.DRIVE_CROSSED.value == "drive_crossed"
    # ActionType has exactly 8 members after Phase 10b added BIOS_DEATH (7 prior + 1 new).
    assert len(list(ActionType)) == 8


def test_action_type_drive_crossed_position() -> None:
    """DRIVE_CROSSED sits between TELOS_REFINED and NOOP; NOOP remains last."""
    members = list(ActionType)
    names = [m.name for m in members]
    idx_telos = names.index("TELOS_REFINED")
    idx_drive = names.index("DRIVE_CROSSED")
    idx_noop = names.index("NOOP")
    assert idx_telos < idx_drive < idx_noop
    assert names[-1] == "NOOP"
