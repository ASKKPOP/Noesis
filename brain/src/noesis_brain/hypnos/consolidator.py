"""Consolidator — Hebbian pass + SHY downscale (pure functions). Phase 16.

Wall-clock FORBIDDEN: no wall-clock imports allowed (see T-16-03).
Only tick from caller is the time axis.
"""
from __future__ import annotations

import hashlib

from noesis_brain.hypnos.ltm_store import LtmStore
from noesis_brain.hypnos.types import Episode


def _node_id(content: str) -> str:
    """sha256(content.encode()).hexdigest()[:16] — 16-char hex node ID. D-16-03."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]


def hebbian_pass(store: LtmStore, episodes: list[Episode], eta: float, tick: int) -> None:
    """Co-activate all episode pairs. Dw = eta x 1.0 x 1.0 = eta (binary activation). D-16-03.

    All-pairs O(n^2) for n <= 7 episodes -> max 21 edge updates.
    Canonical undirected ordering: src < dst enforced here (caller must not swap).
    """
    for i in range(len(episodes)):
        for j in range(i + 1, len(episodes)):
            ep_i = episodes[i]
            ep_j = episodes[j]
            node_i = _node_id(ep_i.content)
            node_j = _node_id(ep_j.content)
            # Full SHA-256 for content_hash stored in ltm_nodes
            hash_i = hashlib.sha256(ep_i.content.encode("utf-8")).hexdigest()
            hash_j = hashlib.sha256(ep_j.content.encode("utf-8")).hexdigest()
            # Canonical undirected edge: src < dst
            if node_i < node_j:
                src, dst, sh, dh = node_i, node_j, hash_i, hash_j
            else:
                src, dst, sh, dh = node_j, node_i, hash_j, hash_i
            store.upsert_node(node_i, hash_i, tick)
            store.upsert_node(node_j, hash_j, tick)
            store.strengthen_edge(src, dst, delta=eta, tick=tick)


def shy_downscale(store: LtmStore, sigma: float) -> None:
    """Scale all edge weights by sigma — prevents runaway saturation. D-16-03, HYP-03.

    Delegates SQL to store.scale_all_edges — no direct SQL in consolidator.
    Geometric bound: max_weight = eta / (1 - sigma) = 0.01 / 0.05 = 0.2.
    """
    store.scale_all_edges(sigma)
