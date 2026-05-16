"""HypnosRuntime — orchestrates sleep cycle (Hebbian + SHY + snapshot hash). Phase 16.

Wall-clock FORBIDDEN: no wall-clock imports allowed (see T-16-03).
Only tick from caller is the time axis. D-16-03, T-16-03.
"""
from __future__ import annotations

import hashlib
import json
import math

from noesis_brain.hypnos.config import HYPNOS_ETA, HYPNOS_SIGMA, HYPNOS_TOP_K
from noesis_brain.hypnos.consolidator import hebbian_pass, shy_downscale
from noesis_brain.hypnos.ltm_store import LtmStore
from noesis_brain.hypnos.working_memory import WorkingMemory


class HypnosRuntime:
    """Orchestrates per-Nous sleep cycle: Working Memory → Hebbian → SHY → snapshot hash."""

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
        """Execute one sleep cycle. Returns ltm_snapshot_hash (64-char hex).

        Non-blocking — caller MUST use asyncio.create_task() for this coroutine.
        NEVER await in on_tick() path directly (T-16-02).

        Steps: Hebbian pass (all episode pairs) → SHY downscale → snapshot hash.
        """
        episodes = self.working_memory.episodes()
        if episodes:
            hebbian_pass(self._store, episodes, self._eta, tick)
        shy_downscale(self._store, self._sigma)
        return self.compute_snapshot_hash()

    def compute_snapshot_hash(self) -> str:
        """Canonical JSON hash of the LTM graph state. Deterministic: sorted keys.

        Format: {"edges":[...],"nodes":[...]} (all top-level keys sorted).
        sha256(canonical_utf8).hexdigest() → 64-char hex. D-16-03.
        """
        nodes = self._store._conn.execute(
            "SELECT node_id, content_hash, first_seen_tick FROM ltm_nodes ORDER BY node_id"
        ).fetchall()
        edges = self._store._conn.execute(
            "SELECT src, dst, weight, last_updated_tick FROM ltm_edges ORDER BY src, dst"
        ).fetchall()
        graph_dict = {
            "nodes": [
                {
                    "content_hash": r["content_hash"],
                    "first_seen_tick": r["first_seen_tick"],
                    "node_id": r["node_id"],
                }
                for r in nodes
            ],
            "edges": [
                {
                    "dst": r["dst"],
                    "last_updated_tick": r["last_updated_tick"],
                    "src": r["src"],
                    "weight": r["weight"],
                }
                for r in edges
            ],
        }
        canonical = json.dumps(graph_dict, separators=(",", ":"), sort_keys=True)
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    def retrieve_top_k(self, current_tick: int, tau: int = 500) -> list[str]:
        """Return top-k concept content_hashes ranked by (sum_weight × recency_factor).

        O(concept_count) via SQL GROUP BY (retrieve_candidates) + Python re-rank.
        p95 < 10ms on 1000-node graph (HYP-05).
        recency_factor = exp(-delta / tau) where delta = current_tick - first_seen_tick.
        tau=500 mirrors Phase 10b Chronos TAU convention.
        """
        candidates = self._store.retrieve_candidates(self._top_k * 4)
        scored: list[tuple[float, str]] = []
        for row in candidates:
            delta = current_tick - row["first_seen_tick"]
            recency = math.exp(-delta / tau) if delta >= 0 else 1.0
            scored.append((row["total_weight"] * recency, row["content_hash"]))
        scored.sort(reverse=True)
        return [content_hash for _, content_hash in scored[: self._top_k]]
