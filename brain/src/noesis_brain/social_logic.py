"""Who a Nous counts as a trusted peer in its social cycle. Pure — no I/O.

Verified as P-SOCIAL-01..04 and P-SKILLTRUST-01..03 (verification/PROPERTIES.md).
"""
from __future__ import annotations

import math
from typing import Any

TRUST_WEIGHT = 0.3   # a known relationship weight at or above this is trusted
MAX_PEERS = 3
# What a hot tie is worth as a relationship weight: the lowest weight the Grid
# calls hot (grid/src/relationships/config.ts, warmthWarmMax).
HOT_TIE_WEIGHT = 0.60


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


def hot_ties(ties: Any, self_did: str) -> frozenset[str]:
    """The peers the Grid's public view lists as a hot tie of this Nous.

    ties: as for trusted_peers. Anything that is not a list of well-formed ties
    gives nobody; so does a tie whose bucket is not exactly "hot".
    """
    out: set[str] = set()
    for tie in ties if isinstance(ties, list) else []:
        if not isinstance(tie, dict) or tie.get("warmth_bucket") != "hot":
            continue
        did = tie.get("counterparty_did")
        if isinstance(did, str) and did != self_did:
            out.add(did)
    return frozenset(out)


def skill_trust_weight(weights: dict[str, Any], hot: frozenset[str], did: str) -> float:
    """The relationship weight a Brain holds a peer to when that peer teaches it a
    skill: the weight it already holds, or HOT_TIE_WEIGHT when the Grid lists the
    peer as a hot tie, whichever is higher. A warm, cold or unlisted peer adds
    nothing; a held weight that is not a finite number counts as 0.
    """
    held = weights.get(did)
    weight = (
        float(held)
        if isinstance(held, (int, float)) and not isinstance(held, bool) and math.isfinite(held)
        else 0.0
    )
    return max(weight, HOT_TIE_WEIGHT) if did in hot else weight
