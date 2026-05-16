"""HYP-02: Fixed (seed, episodes, η, σ) → byte-identical LTM graph. RED stub."""
import pytest


def test_ltm_determinism():
    pytest.importorskip("noesis_brain.hypnos.ltm_store")
    from noesis_brain.hypnos.ltm_store import LtmStore
    from noesis_brain.hypnos.runtime import HypnosRuntime
    from noesis_brain.hypnos.types import Episode

    eps = [Episode(content=f"episode_{i}", memory_type="observation") for i in range(7)]

    store1 = LtmStore(":memory:")
    rt1 = HypnosRuntime(store1, eta=0.01, sigma=0.95)
    rt1.working_memory.set_episodes(eps)
    import asyncio
    asyncio.run(rt1.run_sleep("did:noesis:test", 1))
    hash1 = rt1.compute_snapshot_hash()

    store2 = LtmStore(":memory:")
    rt2 = HypnosRuntime(store2, eta=0.01, sigma=0.95)
    rt2.working_memory.set_episodes(eps)
    asyncio.run(rt2.run_sleep("did:noesis:test", 1))
    hash2 = rt2.compute_snapshot_hash()

    assert hash1 == hash2, "LTM snapshot hash must be byte-identical for same inputs"
