"""HYP-04: Zero-diff — 100-tick sim with Hypnos enabled/disabled → same chain except sleep.* entries. RED stub."""
import pytest


def test_zero_diff_placeholder():
    pytest.importorskip("noesis_brain.hypnos.runtime")
    # Full integration test wired in plan 05 when handler wiring is complete.
    # Placeholder: verify runtime imports cleanly.
    from noesis_brain.hypnos.runtime import HypnosRuntime
    from noesis_brain.hypnos.ltm_store import LtmStore

    store = LtmStore(":memory:")
    rt = HypnosRuntime(store)
    assert rt is not None
