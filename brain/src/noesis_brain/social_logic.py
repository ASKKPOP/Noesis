"""Who a Nous counts as a trusted peer in its social cycle. Pure — no I/O.

Verified as P-SOCIAL-01..04 (verification/PROPERTIES.md).
"""
from __future__ import annotations

from typing import Any

TRUST_WEIGHT = 0.3   # a known relationship weight at or above this is trusted
MAX_PEERS = 3


def trusted_peers(weights: dict[str, float], ties: Any, self_did: str) -> list[str]:
    """The peers a Nous may message or teach, strongest source first.

    weights: relationship weights the Brain already holds (DID → weight).
    ties:    the Grid's public view of this Nous's ties — a list of
             {"counterparty_did", "warmth_bucket"} with bucket cold / warm / hot.
             The public tier gives no number. Anything malformed is ignored.

    Order: weighted peers (highest first), then hot ties, then warm ties. Never
    the Nous itself, never a DID twice, at most MAX_PEERS.
    """
    weighted = [
        did for did, w in sorted(weights.items(), key=lambda x: x[1], reverse=True)
        if w >= TRUST_WEIGHT
    ]
    hot: list[Any] = []
    warm: list[Any] = []
    for tie in ties if isinstance(ties, list) else []:
        if not isinstance(tie, dict):
            continue
        bucket = tie.get("warmth_bucket")
        if bucket == "hot":
            hot.append(tie.get("counterparty_did"))
        elif bucket == "warm":
            warm.append(tie.get("counterparty_did"))

    peers: list[str] = []
    for did in weighted + hot + warm:
        if isinstance(did, str) and did != self_did and did not in peers and len(peers) < MAX_PEERS:
            peers.append(did)
    return peers
