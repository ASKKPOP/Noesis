"""Iris priors — relationship-graph prior seeding (Phase 17).

Derives initial ToM beliefs from the 4-key relationship_context edges
passed from Grid on each tick. No LLM calls, no HTTP, no wall-clock.

4-key relationship_context contract (alphabetical, from Grid):
    {counterparty_did, warmth, weight, recency_tick}
    last_event_hash is EXCLUDED (D-17-xx design decision — not needed for priors).
    Extra keys are silently ignored for forward-compatibility.

Warmth bucket → honesty mapping (3-bucket, closed set):
    cold  → 0.2  (distrust prior)
    warm  → 0.5  (neutral prior)
    hot   → 0.8  (trust prior)

Prior confidence = honesty (honesty anchors the initial belief confidence).
goal_alignment = weight (relationship weight as proxy for goal-alignment prior).
freshness = exp(-recency_tick / FRESHNESS_DECAY) clamped to [0.0, 1.0].

IRIS_BELIEFS_CAP (10) enforces LRU eviction inside IrisStore.add_belief().

No LLM calls, no HTTP, no random, no wall-clock — deterministic from inputs.
Wall-clock free: NEVER use datetime, time.time, random.random, uuid.uuid4, os.urandom.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Protocol

from noesis_brain.iris.config import IRIS_BELIEFS_CAP
from noesis_brain.iris.store import IrisStore
from noesis_brain.iris.types import Belief, DIMENSION_VALUES

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

FRESHNESS_DECAY: float = 100.0  # ticks for freshness to decay to e^-1 ≈ 0.37

WARMTH_TO_HONESTY: dict[str, float] = {
    "cold": 0.2,
    "warm": 0.5,
    "hot": 0.8,
}

# Default for unknown warmth values — treat as neutral.
_WARMTH_DEFAULT: float = 0.5


# ---------------------------------------------------------------------------
# Dispatcher protocol (structural — no import of grid types)
# ---------------------------------------------------------------------------

class _Dispatcher(Protocol):
    """Minimal dispatcher interface used by seed_priors."""
    def emit(self, action_type: str, metadata: dict) -> None: ...


# ---------------------------------------------------------------------------
# BeliefPrior — pure data object
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class BeliefPrior:
    """Derived prior estimate for a peer, from relationship graph.

    All fields are [0.0, 1.0] floats.
    target_did: DID of the peer this prior describes.
    honesty: trust estimate (derived from warmth bucket).
    goal_alignment: goal-alignment estimate (derived from edge weight).
    freshness: recency estimate (derived from recency_tick decay).
    """
    target_did: str
    honesty: float
    goal_alignment: float
    freshness: float


# ---------------------------------------------------------------------------
# derive_prior — pure function
# ---------------------------------------------------------------------------

def derive_prior(edge: dict[str, Any], current_tick: int) -> BeliefPrior:
    """Derive a BeliefPrior from a single 4-key relationship edge.

    Args:
        edge: Dict with keys {counterparty_did, warmth, weight, recency_tick}.
              Extra keys are silently ignored (forward-compatibility).
        current_tick: Current world tick (caller-supplied, no wall-clock).

    Returns:
        BeliefPrior with honesty/goal_alignment/freshness all in [0.0, 1.0].

    No LLM calls, no HTTP, no wall-clock — purely deterministic.
    """
    target_did = edge["counterparty_did"]
    warmth = str(edge.get("warmth", "warm")).lower()
    weight = float(edge.get("weight", 0.5))
    recency_tick = int(edge.get("recency_tick", 0))

    honesty = WARMTH_TO_HONESTY.get(warmth, _WARMTH_DEFAULT)

    # goal_alignment from weight, clamped to [0.0, 1.0]
    goal_alignment = max(0.0, min(1.0, weight))

    # freshness: e^(-(current_tick - recency_tick) / FRESHNESS_DECAY)
    # If recency_tick > current_tick (edge is "from the future"), treat as fresh.
    delta = max(0, current_tick - recency_tick)
    freshness = math.exp(-delta / FRESHNESS_DECAY)

    return BeliefPrior(
        target_did=target_did,
        honesty=honesty,
        goal_alignment=goal_alignment,
        freshness=freshness,
    )


# ---------------------------------------------------------------------------
# seed_priors — store writer (once-per-pair)
# ---------------------------------------------------------------------------

def seed_priors(
    edges: list[dict[str, Any]],
    nous_did: str,
    store: IrisStore,
    tick: int,
    dispatcher: Any,
) -> None:
    """Seed initial ToM beliefs for each peer in the relationship context.

    For each edge: if no prior exists for (nous_did, target_did), derive a
    BeliefPrior, insert one honesty belief into the store, and emit
    iris.prior_seeded via the dispatcher.

    Once-per-pair cardinality: has_prior_for() gate prevents re-seeding.
    No LLM calls, no HTTP, no wall-clock.

    Args:
        edges: List of 4-key relationship edges from Grid.
        nous_did: DID of the owning Nous.
        store: IrisStore for this Nous.
        tick: Current world tick (caller-supplied, no wall-clock).
        dispatcher: Object with .emit(action_type, metadata) method.
    """
    for edge in edges:
        if not isinstance(edge, dict):
            continue
        target_did = edge.get("counterparty_did", "")
        if not target_did:
            continue

        # Once-per-pair guard — has_prior_for checks ALL beliefs including superseded.
        if store.has_prior_for(nous_did=nous_did, target_did=target_did):
            continue

        prior = derive_prior(edge, current_tick=tick)

        # Seed an initial honesty belief — confidence = prior.honesty.
        # content is Brain-private prose summarizing the prior.
        content = (
            f"Prior from relgraph: honesty={prior.honesty:.2f}, "
            f"goal_alignment={prior.goal_alignment:.2f}, "
            f"freshness={prior.freshness:.2f}"
        )

        belief = Belief(
            id=None,
            nous_did=nous_did,
            target_did=target_did,
            dimension="belief",  # honesty beliefs seed under 'belief' dimension
            content=content,
            confidence=prior.honesty,
            superseded_by=None,
            created_tick=tick,
            source_event_hash=None,
        )
        store.add_belief(belief, tick=tick)

        # Emit iris.prior_seeded — Grid injects nous_did + tick at emit time.
        # 2 Brain keys: {source, target_did}. Grid adds nous_did + tick.
        dispatcher.emit(
            "iris.prior_seeded",
            {
                "source": "relgraph",
                "target_did": target_did,
            },
        )
