"""Stanford retrieval scoring — recency × importance × relevance.

Implements the Generative Agents memory retrieval formula:
  score = recency(memory) × importance(memory) × relevance(memory, query)

Without ChromaDB/embeddings, relevance falls back to keyword matching.
When embeddings are available, cosine similarity is used.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone

from noesis_brain.memory.types import Memory


class RetrievalScorer:
    """Scores and ranks memories for retrieval.

    Uses the Stanford Generative Agents formula:
        score = recency × importance × relevance

    recency:    0.99 ^ hours_since_memory  (exponential decay)
    importance: memory.importance / 10.0    (normalized to 0-1)
    relevance:  keyword overlap ratio       (fallback when no embeddings)
    """

    def __init__(self, decay_rate: float = 0.99) -> None:
        self._decay_rate = decay_rate

    def recency_score(self, memory: Memory, now: datetime | None = None) -> float:
        """Calculate recency score based on time elapsed."""
        now = now or datetime.now(timezone.utc)
        # Ensure both are offset-aware
        mem_time = memory.created_at
        if mem_time.tzinfo is None:
            mem_time = mem_time.replace(tzinfo=timezone.utc)
        hours_ago = (now - mem_time).total_seconds() / 3600.0
        return self._decay_rate ** max(0, hours_ago)

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
