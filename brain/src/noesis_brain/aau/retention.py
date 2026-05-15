"""AAU Retention — dedup, FTS5 upsert, TTL management (Phase 15).

Stores LearnedFacts into the existing MemoryStore wiki_pages table under
WikiCategory.LEARNED. The learned_sources table tracks URL+content hashes to
prevent re-fetching within the source's TTL.

Also provides FTS5 search over previously learned knowledge so the Nous can
check its wiki before fetching from the web again.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from noesis_brain.aau.types import LearnedFact
from noesis_brain.memory.sqlite_store import MemoryStore
from noesis_brain.memory.types import WikiCategory, WikiPage

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


class AAURetention:
    """Manages storage and retrieval of web-learned facts."""

    def __init__(self, store: MemoryStore) -> None:
        self._store = store

    # ── Write ────────────────────────────────────────────────────────────────

    def store(self, fact: LearnedFact) -> WikiPage | None:
        """Persist a LearnedFact to the wiki and record the source.

        Returns the stored WikiPage, or None if skipped (already fresh / invalid).
        """
        if not fact.is_storable():
            logger.debug("Retention: fact too short to store (%d chars)", len(fact.content))
            return None

        # Dedup check — skip if still within TTL
        if self._store.is_source_fresh(fact.url):
            logger.debug("Retention: URL still fresh, skipping: %s", fact.url[:80])
            return None

        content = fact.truncated_content(max_chars=3000)

        # Upsert wiki page (update if title already exists)
        existing = self._store.get_wiki_page(fact.title)
        if existing:
            page = self._store.update_wiki_page(
                fact.title,
                content,
                confidence=0.6,
                source=fact.url,
            )
        else:
            page = self._store.add_wiki_page(
                WikiPage(
                    title=fact.title,
                    category=WikiCategory.LEARNED,
                    content=content,
                    confidence=0.6,
                    source=fact.url,
                )
            )

        # Record source so dedup check works on next cycle
        self._store.record_learned_source(
            url=fact.url,
            content=content,
            source_kind=fact.source_kind.value,
            ttl_days=fact.ttl_days,
        )

        logger.info(
            "Retention: stored %r from %s (%d chars)",
            fact.title[:40], fact.source_kind.value, len(content)
        )
        return page

    def store_many(self, facts: list[LearnedFact]) -> list[WikiPage]:
        """Store multiple facts, skipping duplicates. Returns stored pages."""
        stored: list[WikiPage] = []
        for fact in facts:
            page = self.store(fact)
            if page:
                stored.append(page)
        return stored

    # ── Read ─────────────────────────────────────────────────────────────────

    def search(self, query: str, limit: int = 5) -> list[WikiPage]:
        """FTS5 keyword search over all learned wiki pages."""
        if not query.strip():
            return []
        try:
            return self._store.search_wiki_fts(query, limit=limit)
        except Exception as exc:
            logger.warning("Retention FTS5 search failed: %s", exc)
            return []

    def already_knows(self, query: str, threshold: int = 2) -> bool:
        """Return True if the Nous already has enough pages matching this query.

        Used to decide whether a learning cycle is worth running at all.
        """
        hits = self.search(query, limit=threshold)
        return len(hits) >= threshold

    def learned_page_count(self) -> int:
        """Total number of web-learned wiki pages."""
        pages = self._store.wiki_pages_by_category(WikiCategory.LEARNED)
        return len(pages)
