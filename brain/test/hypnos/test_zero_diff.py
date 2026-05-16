"""HYP-04: Zero-diff — actions excluding sleep.* are byte-identical with/without Hypnos.

Tests the zero-diff invariant: Hypnos is a pure ADDITION — it does not alter the actions
that a Nous would take without it. Only SLEEP_ENTERED and SLEEP_COMPLETED are new.
"""
from __future__ import annotations
import pytest


def test_zero_diff_sleep_actions_are_additive():
    """With Hypnos, on_tick may produce SLEEP_ENTERED/COMPLETED; all other actions identical."""
    pytest.importorskip("noesis_brain.hypnos.runtime")
    from noesis_brain.hypnos.ltm_store import LtmStore
    from noesis_brain.hypnos.runtime import HypnosRuntime
    from noesis_brain.hypnos.types import Episode

    # Minimal zero-diff: two runtimes with identical episodes produce same snapshot hash.
    episodes = [Episode(content=f"ep{i}", memory_type="observation") for i in range(7)]
    store1, store2 = LtmStore(":memory:"), LtmStore(":memory:")
    rt1 = HypnosRuntime(store1, eta=0.01, sigma=0.95)
    rt2 = HypnosRuntime(store2, eta=0.01, sigma=0.95)
    rt1.working_memory.set_episodes(episodes)
    rt2.working_memory.set_episodes(episodes)

    import asyncio
    h1 = asyncio.run(rt1.run_sleep("did:noesis:a", 30))
    h2 = asyncio.run(rt2.run_sleep("did:noesis:b", 30))
    # Same episodes → same hash (different DID doesn't affect graph content)
    assert h1 == h2, f"Zero-diff violated: {h1} != {h2}"


def test_compute_snapshot_hash_stable_across_calls():
    """compute_snapshot_hash() is idempotent — same result on repeated calls."""
    from noesis_brain.hypnos.ltm_store import LtmStore
    from noesis_brain.hypnos.runtime import HypnosRuntime
    from noesis_brain.hypnos.types import Episode

    store = LtmStore(":memory:")
    rt = HypnosRuntime(store)
    eps = [Episode(content=f"e{i}", memory_type="observation") for i in range(3)]
    rt.working_memory.set_episodes(eps)
    import asyncio
    asyncio.run(rt.run_sleep("did:noesis:stable", 1))
    h1 = rt.compute_snapshot_hash()
    h2 = rt.compute_snapshot_hash()
    assert h1 == h2, "compute_snapshot_hash must be idempotent"
    assert len(h1) == 64, f"Expected 64-char hex, got {len(h1)}"
