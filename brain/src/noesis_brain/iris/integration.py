"""Iris integration helpers — context_for, predict_vote, ToMContext (Phase 17).

Pure read functions that compose IrisStore reads into caller-ready structures.
No writes, no LLM calls, no wall-clock.

context_for:
    Returns a ToMContext for a single peer — top-K active beliefs ordered by
    confidence DESC. PURE READ — never writes to IrisStore.

predict_vote:
    Estimates how a peer might vote on a proposal given stored intentions/desires.
    Returns a VotePrediction with vote ∈ {'yes', 'no', 'abstain', 'unknown'}.
    'unknown' when no relevant beliefs exist. Deterministic — no LLM.

ToMContext:
    Lightweight view struct carrying the top beliefs for a peer + count.
    Suitable for injection into system prompts (Brain-private).

Wall-clock free: NEVER use datetime, time.time, random.random, uuid.uuid4.
No HTTP calls from this module.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from noesis_brain.iris.config import IRIS_CONTEXT_TOP_K
from noesis_brain.iris.store import IrisStore
from noesis_brain.iris.types import Belief

__all__ = [
    "context_for",
    "predict_vote",
    "ToMContext",
    "VotePrediction",
]


# ---------------------------------------------------------------------------
# ToMContext — result type for context_for()
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class ToMContext:
    """Theory-of-Mind context for a single peer.

    target_did: DID of the peer.
    beliefs: Top-K active beliefs, ordered by confidence DESC.
    n_beliefs_used: Count of beliefs returned (== len(beliefs)).
    """
    target_did: str
    beliefs: list[Belief]
    n_beliefs_used: int


# ---------------------------------------------------------------------------
# VotePrediction — result type for predict_vote()
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class VotePrediction:
    """Predicted vote for a peer on a given ballot.

    vote: one of {'yes', 'no', 'abstain', 'unknown'}.
    confidence: confidence in the prediction [0.0, 1.0], 0.0 when 'unknown'.
    reasoning: brief prose reasoning (Brain-private, never crosses wire).
    """
    vote: str
    confidence: float = 0.0
    reasoning: str = ""


# ---------------------------------------------------------------------------
# context_for — PURE READ
# ---------------------------------------------------------------------------

def context_for(
    target_did: str,
    store: IrisStore,
    k: int = IRIS_CONTEXT_TOP_K,
) -> ToMContext:
    """Return top-K active beliefs about target_did ordered by confidence DESC.

    PURE READ — never writes to IrisStore. Suitable for concurrent calls.

    Args:
        target_did: DID of the peer to retrieve beliefs for.
        store: IrisStore for the owning Nous.
        k: Maximum beliefs to return (default IRIS_CONTEXT_TOP_K=5).

    Returns:
        ToMContext with beliefs list and n_beliefs_used count.
    """
    beliefs = store.get_beliefs(
        target_did=target_did,
        dimension=None,   # all dimensions
        k=k,
        active_only=True,
    )
    return ToMContext(
        target_did=target_did,
        beliefs=beliefs,
        n_beliefs_used=len(beliefs),
    )


# ---------------------------------------------------------------------------
# predict_vote — deterministic heuristic, no LLM
# ---------------------------------------------------------------------------

def predict_vote(
    target_did: str,
    ballot: dict,
    store: IrisStore,
) -> VotePrediction:
    """Estimate how target_did might vote given stored intentions/desires.

    Uses intention and desire beliefs as the primary signal. If none exist,
    returns 'unknown'. The heuristic is:
    - High-confidence intention/desire beliefs → infer alignment with proposal.
    - Average confidence > 0.6 → 'yes'.
    - Average confidence < 0.4 → 'no'.
    - Otherwise → 'abstain'.
    - No relevant beliefs → 'unknown'.

    Deterministic — no LLM, no wall-clock. Ballot body is not parsed (Brain-private).

    Args:
        target_did: DID of the peer whose vote is being predicted.
        ballot: Dict containing the ballot payload (body, etc.). Not parsed here.
        store: IrisStore for the owning Nous.

    Returns:
        VotePrediction with vote ∈ {'yes', 'no', 'abstain', 'unknown'}.
    """
    # Gather intention and desire beliefs as the primary vote signal.
    intention_beliefs = store.get_beliefs(
        target_did=target_did,
        dimension="intention",
        k=IRIS_CONTEXT_TOP_K,
        active_only=True,
    )
    desire_beliefs = store.get_beliefs(
        target_did=target_did,
        dimension="desire",
        k=IRIS_CONTEXT_TOP_K,
        active_only=True,
    )

    relevant = intention_beliefs + desire_beliefs
    if not relevant:
        return VotePrediction(vote="unknown", confidence=0.0, reasoning="no relevant beliefs")

    avg_confidence = sum(b.confidence for b in relevant) / len(relevant)

    if avg_confidence > 0.6:
        return VotePrediction(
            vote="yes",
            confidence=avg_confidence,
            reasoning=f"high avg intention/desire confidence ({avg_confidence:.2f})",
        )
    if avg_confidence < 0.4:
        return VotePrediction(
            vote="no",
            confidence=1.0 - avg_confidence,
            reasoning=f"low avg intention/desire confidence ({avg_confidence:.2f})",
        )
    return VotePrediction(
        vote="abstain",
        confidence=0.5,
        reasoning=f"neutral avg confidence ({avg_confidence:.2f})",
    )
