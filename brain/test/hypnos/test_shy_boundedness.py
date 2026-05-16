"""HYP-03: SHY: after 100 cycles max_weight ≤ η/(1−σ) + ε = 0.21. RED stub."""
import pytest


def test_shy_boundedness():
    pytest.importorskip("noesis_brain.hypnos.ltm_store")
    from noesis_brain.hypnos.ltm_store import LtmStore
    from noesis_brain.hypnos.consolidator import hebbian_pass, shy_downscale
    from noesis_brain.hypnos.types import Episode

    store = LtmStore(":memory:")
    eps = [Episode(content=f"ep{i}", memory_type="observation") for i in range(7)]
    for tick in range(100):
        hebbian_pass(store, eps, 0.01, tick)
        shy_downscale(store, 0.95)
    row = store._conn.execute("SELECT MAX(weight) FROM ltm_edges").fetchone()
    max_w = row[0] if row and row[0] is not None else 0.0
    assert max_w <= 0.21, f"SHY boundedness violated: {max_w:.6f} > 0.21"
