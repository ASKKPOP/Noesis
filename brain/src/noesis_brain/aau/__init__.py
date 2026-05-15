"""Autonomous Action Unit — online world learning (Phase 15).

A Nous can learn from the real internet without API keys:
  - DuckDuckGo search (ddgs, no key, ~30 req/min)
  - arXiv papers (arxiv client, no key)
  - Wikipedia REST API (no key, 200 req/s)
  - PyPI / npm package metadata (no key)
  - RSS/Atom feeds (feedparser)
  - Jina Reader fallback for JS-heavy pages (r.jina.ai, 20/min free)

All HTTP fetches are async background tasks — they never block the Grid tick RPC.
Knowledge is stored in the existing MemoryStore wiki_pages table (WikiCategory.LEARNED)
with FTS5 indexing and URL+content-hash deduplication (learned_sources table).

Entry point: AAULearner.run_cycle(query, store)
"""

from noesis_brain.aau.types import LearnedFact, SourceKind
from noesis_brain.aau.config import AAUConfig
from noesis_brain.aau.learner import AAULearner

__all__ = ["LearnedFact", "SourceKind", "AAUConfig", "AAULearner"]
