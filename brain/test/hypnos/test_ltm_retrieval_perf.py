"""HYP-05: LTM retrieval p95 < 10ms on 1000-node graph. RED stub."""
import pytest
import time


def test_ltm_retrieval_perf():
    pytest.importorskip("noesis_brain.hypnos.ltm_store")
    from noesis_brain.hypnos.ltm_store import LtmStore
    from noesis_brain.hypnos.runtime import HypnosRuntime

    store = LtmStore(":memory:")
    # Seed 1000 nodes and 500 edges
    conn = store._conn
    conn.executemany(
        "INSERT OR IGNORE INTO ltm_nodes (node_id, content_hash, first_seen_tick) VALUES (?, ?, ?)",
        [(f"node{i:04d}", f"hash{i:064x}", i) for i in range(1000)],
    )
    conn.executemany(
        "INSERT OR IGNORE INTO ltm_edges (src, dst, weight, last_updated_tick) VALUES (?, ?, ?, ?)",
        [(f"node{i:04d}", f"node{i+1:04d}", 0.1, i) for i in range(999)],
    )
    conn.commit()
    rt = HypnosRuntime(store)
    times = []
    for _ in range(20):
        t0 = time.perf_counter()
        rt.retrieve_top_k(current_tick=1000)
        times.append(time.perf_counter() - t0)
    times.sort()
    p95_ms = times[int(0.95 * len(times))] * 1000
    assert p95_ms < 10.0, f"LTM p95 retrieval {p95_ms:.1f}ms exceeds 10ms budget"
