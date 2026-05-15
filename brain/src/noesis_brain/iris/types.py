"""Iris types — Phase 17 Theory of Mind.

Belief content NEVER crosses the Brain↔Grid wire.
Only content_hash (sha256 hex) is audit-chain visible.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

# Closed dimension enum — locked for v2.3.
# 2nd-order ("about what X believes about Y") deferred to v2.4.
Dimension = Literal["belief", "desire", "intention", "knowledge", "emotion"]

DIMENSION_VALUES: frozenset[str] = frozenset({
    "belief", "desire", "intention", "knowledge", "emotion"
})


@dataclass(frozen=True)
class Belief:
    """A single 1st-order belief about a peer.

    id: SQLite AUTOINCREMENT row id (None before insert).
    nous_did: DID of the belief-holding Nous.
    target_did: DID of the peer this belief describes.
    dimension: Closed-enum belief type.
    content: Full belief prose (Brain-private; NEVER crosses wire).
    confidence: [0.0, 1.0] confidence in this belief.
    superseded_by: Row id of the belief that replaced this one (append-only).
    created_tick: Caller-supplied world tick (no wall-clock).
    source_event_hash: sha256 of triggering event, or None for derived priors.
    recency_decay: Pre-computed decay factor for LRU eviction scoring.
    """
    id: int | None
    nous_did: str
    target_did: str
    dimension: Dimension
    content: str
    confidence: float
    superseded_by: int | None
    created_tick: int
    source_event_hash: str | None
    recency_decay: float = 1.0
