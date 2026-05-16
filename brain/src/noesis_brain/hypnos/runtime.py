"""HypnosRuntime — orchestrates a single sleep cycle. Phase 16.

Coordinates WorkingMemory + consolidator (hebbian_pass + shy_downscale) + LtmStore.
Wall-clock FORBIDDEN: no wall-clock imports allowed (see T-16-03).
Only tick from caller is the time axis.
"""
from __future__ import annotations

import hashlib
import json

from noesis_brain.hypnos.config import HYPNOS_ETA, HYPNOS_SIGMA, HYPNOS_TOP_K
from noesis_brain.hypnos.consolidator import hebbian_pass, shy_downscale
from noesis_brain.hypnos.ltm_store import LtmStore
from noesis_brain.hypnos.working_memory import WorkingMemory


class HypnosRuntime:
    """Orchestrates sleep consolidation: Hebbian pass + SHY downscale + snapshot hash.

    Constructed once per Nous. The store is injected (allows :memory: for tests).
    eta and sigma default to module config constants (D-16-04).
    """

    def __init__(
        self,
        store: LtmStore,
        eta: float = HYPNOS_ETA,
        sigma: float = HYPNOS_SIGMA,
        top_k: int = HYPNOS_TOP_K,
    ) -> None:
        self._store = store
        self._eta = eta
        self._sigma = sigma
        self._top_k = top_k
        self.working_memory: WorkingMemory = WorkingMemory()

    async def run_sleep(self, nous_did: str, tick: int) -> str:
        """Execute one sleep cycle: Hebbian pass then SHY downscale.

        Returns the ltm_snapshot_hash (sha256 of canonical LTM state).
        Non-blocking async wrapper; all operations are synchronous SQLite calls.
        nous_did is accepted for future sole-producer emit wiring (Plan 03).
        """
        episodes = self.working_memory.episodes()
        if episodes:
            hebbian_pass(self._store, episodes, self._eta, tick)
            shy_downscale(self._store, self._sigma)
        return self.compute_snapshot_hash()

    def retrieve_top_k(self, current_tick: int) -> list[dict]:
        """Return top-k LTM concept nodes ranked by incident edge weight + recency.

        O(concept_count) via SQL GROUP BY + LEFT JOIN in LtmStore.retrieve_candidates.
        recency_factor = 1 / (1 + age_ticks / 1000) — simple inverse-age decay.
        Called by prompt-build path (Plan 03). HYP-05.
        """
        candidates = self._store.retrieve_candidates(self._top_k * 4)  # over-fetch then re-rank
        results = []
        for row in candidates:
            age = max(0, current_tick - row["first_seen_tick"])
            recency = 1.0 / (1.0 + age / 1000.0)
            score = row["total_weight"] * recency
            results.append({
                "node_id": row["node_id"],
                "content_hash": row["content_hash"],
                "first_seen_tick": row["first_seen_tick"],
                "total_weight": row["total_weight"],
                "recency": recency,
                "score": score,
            })
        results.sort(key=lambda r: r["score"], reverse=True)
        return results[: self._top_k]

    def compute_snapshot_hash(self) -> str:
        """Compute a deterministic sha256 hash of the current LTM graph state.

        Serialization: canonical JSON with sorted keys, nodes and edges sorted by
        their natural key order for byte-identical output on identical graphs.
        """
        nodes = self._store._conn.execute(
            "SELECT node_id, content_hash, first_seen_tick FROM ltm_nodes ORDER BY node_id"
        ).fetchall()
        edges = self._store._conn.execute(
            "SELECT src, dst, weight, last_updated_tick FROM ltm_edges ORDER BY src, dst"
        ).fetchall()

        snapshot = {
            "nodes": [
                {"node_id": r["node_id"], "content_hash": r["content_hash"], "first_seen_tick": r["first_seen_tick"]}
                for r in nodes
            ],
            "edges": [
                {"src": r["src"], "dst": r["dst"], "weight": r["weight"], "last_updated_tick": r["last_updated_tick"]}
                for r in edges
            ],
        }
        canonical = json.dumps(snapshot, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
