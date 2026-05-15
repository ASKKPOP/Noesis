"""AAU Learner — orchestrator for one learning cycle (Phase 15).

Entry point: AAULearner.run_cycle(query, store)

Sequence: discover URLs → (async) fetch each → extract → retain

All HTTP work is async. The learner is designed to run as a background
asyncio.Task launched from BrainHandler — it MUST NOT be awaited inline
inside on_tick() because a slow web fetch would delay Grid responses.

Curiosity gate: caller checks config.min_curiosity_level before launching.
The learner itself does not read Ananke drives — that check belongs in the
BrainHandler where the drive state is available.

Anti-patterns this module avoids:
  - Never calls the LLM (extraction pipeline is deterministic)
  - Never emits Grid events (AAU is Brain-local)
  - Never blocks the asyncio event loop on synchronous I/O
  - Never stores raw HTML (always extracts first)
"""

from __future__ import annotations

import asyncio
import logging

from noesis_brain.aau.config import AAUConfig
from noesis_brain.aau.discovery import discover_urls
from noesis_brain.aau.extractor import AAUExtractor
from noesis_brain.aau.fetcher import AAUFetcher
from noesis_brain.aau.retention import AAURetention
from noesis_brain.aau.types import FetchResult, LearnedFact, SourceKind
from noesis_brain.memory.sqlite_store import MemoryStore
from noesis_brain.memory.types import WikiPage

logger = logging.getLogger(__name__)


class AAULearner:
    """Orchestrates a single learn-from-web cycle.

    Typical lifecycle per Nous instance:
        learner = AAULearner(config)
        # Inside BrainHandler, triggered by curiosity:
        asyncio.create_task(learner.run_cycle(query, memory_store))
    """

    def __init__(self, config: AAUConfig | None = None) -> None:
        self._config = config or AAUConfig()
        self._fetcher = AAUFetcher(self._config)
        self._extractor = AAUExtractor(self._config)

    async def run_cycle(
        self,
        query: str,
        store: MemoryStore,
        *,
        skip_if_known: bool = True,
    ) -> list[WikiPage]:
        """Run one full learning cycle for the given query.

        Args:
            query: What the Nous wants to learn about.
            store: The Nous's MemoryStore (shared SQLite connection).
            skip_if_known: If True, skip the cycle if ≥2 pages already match.

        Returns:
            List of newly stored WikiPage objects.
        """
        retention = AAURetention(store)

        # Gate: already knows enough?
        if skip_if_known and retention.already_knows(query):
            logger.debug("AAULearner: already knows about %r — skipping cycle", query[:60])
            return []

        logger.info("AAULearner: starting cycle for query %r", query[:80])

        # 1. Discover
        url_kinds = await discover_urls(query, self._config)
        if not url_kinds:
            logger.debug("AAULearner: no URLs discovered for %r", query[:60])
            return []

        # 2. Fetch + Extract (sequential with inter-fetch delay — polite crawl)
        facts: list[LearnedFact] = []
        for url, kind in url_kinds[: self._config.max_urls_per_cycle]:
            fact = await self._fetch_and_extract(url, kind)
            if fact:
                facts.append(fact)
            await asyncio.sleep(self._config.fetch_inter_url_sleep)

        # 3. Retain
        stored = retention.store_many(facts)
        logger.info(
            "AAULearner: cycle complete — %d URLs, %d extracted, %d stored",
            len(url_kinds), len(facts), len(stored),
        )
        return stored

    async def _fetch_and_extract(
        self, url: str, kind: SourceKind
    ) -> LearnedFact | None:
        """Fetch a URL and extract clean text. Returns None on failure."""
        # arXiv entries are pre-extracted by discovery.py — build LearnedFact directly
        if kind == SourceKind.ARXIV:
            return await self._handle_arxiv(url)

        # Wikipedia REST API returns JSON with an "extract" field
        if kind == SourceKind.WIKIPEDIA:
            return await self._handle_wikipedia(url)

        # General web fetch
        result: FetchResult | None = await self._fetcher.fetch(url, kind)
        if not result:
            return None

        # Extract
        fact = await asyncio.to_thread(self._extractor.extract, result)

        # Jina fallback for JS-rendered pages (trafilatura returned None)
        if fact is None and result.is_html:
            logger.debug("AAULearner: trafilatura got nothing — trying Jina for %s", url[:80])
            fact = await self._extractor.extract_via_jina(url, self._config)

        return fact

    async def _handle_arxiv(self, entry_id: str) -> LearnedFact | None:
        """Re-fetch arXiv paper details via the arxiv client."""
        try:
            import arxiv
        except ImportError:
            return None

        def _sync() -> LearnedFact | None:
            client = arxiv.Client()
            search = arxiv.Search(id_list=[entry_id.split("/abs/")[-1]])
            for paper in client.results(search):
                content = (
                    f"# {paper.title}\n\n"
                    f"**Authors:** {', '.join(a.name for a in paper.authors[:3])}\n"
                    f"**Published:** {paper.published.date()}\n\n"
                    f"{paper.summary[:2800]}"
                )
                return LearnedFact(
                    url=entry_id,
                    title=paper.title[:80],
                    content=content,
                    source_kind=SourceKind.ARXIV,
                )
            return None

        try:
            return await asyncio.to_thread(_sync)
        except Exception as exc:
            logger.debug("arXiv fetch failed for %s: %s", entry_id, exc)
            return None

    async def _handle_wikipedia(self, api_url: str) -> LearnedFact | None:
        """Fetch Wikipedia REST summary JSON and extract the 'extract' field."""
        try:
            import httpx
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.get(
                    api_url,
                    headers={"User-Agent": self._config.user_agent},
                )
            if r.status_code != 200:
                return None
            data = r.json()
            text = data.get("extract", "")
            title = data.get("title", "Wikipedia")
            if not text or len(text) < self._config.min_content_chars:
                return None
            return LearnedFact(
                url=api_url,
                title=title[:80],
                content=text[:self._config.max_content_chars],
                source_kind=SourceKind.WIKIPEDIA,
            )
        except Exception as exc:
            logger.debug("Wikipedia fetch failed for %s: %s", api_url, exc)
            return None
