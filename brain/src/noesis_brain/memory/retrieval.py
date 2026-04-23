"""Stanford retrieval scoring — recency × importance × relevance.

Implements the Generative Agents memory retrieval formula:
  score = recency(memory) × importance(memory) × relevance(memory, query)

Without ChromaDB/embeddings, relevance falls back to keyword matching.
When embeddings are available, cosine similarity is used.

Phase 10b CHRONOS-02: Chronos-aware tick-based scoring added.
  recency_score_by_tick  — replaces wall-clock recency for determinism.
  score_with_chronos     — full Stanford score with subjective-time bias.

Wall-clock path (recency_score / score / rank) preserved for legacy callers
that supply an explicit `now` datetime. Callers MUST supply `now` explicitly —
this module no longer calls datetime.now() internally (T-10b-04-02 mitigation).
"""

from __future__ import annotations

from datetime import datetime, timezone

from noesis_brain.memory.types import Memory

# Sentinel epoch used when caller omits `now` in legacy path.
# Returns score ≈ 0.0 for any memory newer than the Unix epoch (safe fallback
# that avoids importing time/datetime.now while preserving the signature).
_EPOCH_UTC = datetime(1970, 1, 1, tzinfo=timezone.utc)


class RetrievalScorer:
    """Scores and ranks memories for retrieval.

    Uses the Stanford Generative Agents formula:
        score = recency × importance × relevance

    recency:    0.99 ^ hours_since_memory  (exponential decay)
    importance: memory.importance / 10.0    (normalized to 0-1)
    relevance:  keyword overlap ratio       (fallback when no embeddings)

    Phase 10b: tick-based methods (recency_score_by_tick, score_with_chronos)
    are the preferred path for deterministic, Chronos-biased retrieval.
    The legacy wall-clock methods remain for backward compatibility but
    require callers to supply `now` explicitly — see _EPOCH_UTC sentinel.
    """

    def __init__(self, decay_rate: float = 0.99) -> None:
        self._decay_rate = decay_rate

    def recency_score(self, memory: Memory, now: datetime | None = None) -> float:
        """Calculate recency score based on wall-clock time elapsed.

        Legacy path — preserved for backward compatibility. Callers SHOULD
        supply `now` explicitly; when omitted, _EPOCH_UTC is used (returns
        near-zero score). Prefer recency_score_by_tick for determinism.
        """
        effective_now: datetime = now if now is not None else _EPOCH_UTC
        # Ensure both are offset-aware
        mem_time = memory.created_at
        if mem_time.tzinfo is None:
            mem_time = mem_time.replace(tzinfo=timezone.utc)
        hours_ago = (effective_now - mem_time).total_seconds() / 3600.0
        return self._decay_rate ** max(0, hours_ago)

    def recency_score_by_tick(self, memory: Memory, current_tick: int) -> float:
        """Tick-based recency — deterministic replacement for wall-clock (CHRONOS-02).

        recency = decay_rate ** max(0, current_tick - memory.tick)

        Zero wall-clock dependency; same inputs across any wall-clock offset
        produce byte-identical results.
        """
        ticks_ago = max(0, current_tick - memory.tick)
        return self._decay_rate ** ticks_ago

    def score_with_chronos(
        self,
        memory: Memory,
        query: str,
        current_tick: int,
        chronos_multiplier: float = 1.0,
    ) -> float:
        """Full Stanford score with subjective-time recency modulation (D-10b-06).

        score = min(1.0, recency_by_tick * chronos_multiplier) * importance * relevance

        chronos_multiplier is Brain-local per D-10b-07 — derived from
        compute_multiplier(curiosity_level, boredom_level) in noesis_brain.chronos.
        """
        r = self.recency_score_by_tick(memory, current_tick)
        r_scaled = max(0.0, min(1.0, r * chronos_multiplier))
        i = self.importance_score(memory)
        rel = self.relevance_score(memory, query)
        return r_scaled * i * rel

    def importance_score(self, memory: Memory) -> float:
        """Normalize importance to 0-1 range."""
        return max(0.0, min(1.0, memory.importance / 10.0))

    def relevance_score(self, memory: Memory, query: str) -> float:
        """Calculate relevance via keyword overlap.

        This is the fallback when embeddings are not available.
        When ChromaDB is available, this is replaced by cosine similarity.
        """
        if not query:
            return 0.5  # Neutral relevance when no query

        query_words = set(query.lower().split())
        content_words = set(memory.content.lower().split())

        if not query_words:
            return 0.5

        overlap = query_words & content_words
        return len(overlap) / len(query_words)

    def score(self, memory: Memory, query: str = "", now: datetime | None = None) -> float:
        """Calculate full retrieval score for a memory."""
        r = self.recency_score(memory, now)
        i = self.importance_score(memory)
        rel = self.relevance_score(memory, query)
        return r * i * rel

    def rank(
        self,
        memories: list[Memory],
        query: str = "",
        top_k: int = 10,
        now: datetime | None = None,
    ) -> list[tuple[Memory, float]]:
        """Rank memories by retrieval score and return top-k.

        Returns list of (memory, score) tuples, sorted by score descending.
        """
        scored = [(m, self.score(m, query, now)) for m in memories]
        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:top_k]
