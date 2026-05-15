"""AAU Discovery — find URLs from multiple zero-auth sources (Phase 15).

Sources (no API key required for basic use):
  - DuckDuckGo via ddgs (rate limit: ~30/min; enforced via sleep)
  - arXiv paper search via arxiv client
  - Wikipedia REST API summary
  - PyPI JSON API

All functions are synchronous wrappers for use inside asyncio.to_thread()
to avoid blocking the event loop (ddgs is not async-native).
"""

from __future__ import annotations

import asyncio
import logging
import urllib.parse
from typing import TYPE_CHECKING

from noesis_brain.aau.types import LearnedFact, SourceKind

if TYPE_CHECKING:
    from noesis_brain.aau.config import AAUConfig

logger = logging.getLogger(__name__)


async def discover_urls(
    query: str,
    config: "AAUConfig",
) -> list[tuple[str, SourceKind]]:
    """Return a list of (url, SourceKind) pairs for the given query.

    Combines DuckDuckGo web results with structured source APIs.
    Total results are capped at config.max_urls_per_cycle.
    """
    results: list[tuple[str, SourceKind]] = []

    # DuckDuckGo — general web search
    ddg_results = await _ddg_search(query, config)
    results.extend(ddg_results)

    if len(results) < config.max_urls_per_cycle:
        remaining = config.max_urls_per_cycle - len(results)

        # arXiv — if query looks technical/academic
        if config.enable_arxiv and _looks_academic(query) and remaining > 0:
            arxiv_results = await _arxiv_search(query, min(2, remaining), config)
            results.extend(arxiv_results)

        # Wikipedia — definitional queries
        if config.enable_wikipedia and remaining > 0:
            wiki_url = _wikipedia_url(query)
            if wiki_url:
                results.append((wiki_url, SourceKind.WIKIPEDIA))

    return results[: config.max_urls_per_cycle]


async def _ddg_search(
    query: str, config: "AAUConfig"
) -> list[tuple[str, SourceKind]]:
    """DuckDuckGo text search via ddgs (no API key)."""
    try:
        from ddgs import DDGS
        from ddgs.exceptions import RatelimitException
    except ImportError:
        logger.debug("ddgs not installed; skipping DuckDuckGo search")
        return []

    def _sync_search() -> list[tuple[str, SourceKind]]:
        with DDGS() as ddg:
            hits = list(ddg.text(query, max_results=config.max_urls_per_cycle * 2))
        return [(h["href"], SourceKind.WEB) for h in hits]

    try:
        results = await asyncio.to_thread(_sync_search)
        await asyncio.sleep(config.ddg_sleep_seconds)  # polite rate-limit delay
        return results
    except Exception as exc:
        # RatelimitException is caught here too
        logger.warning("DuckDuckGo search failed: %s", exc)
        return []


async def _arxiv_search(
    query: str, max_results: int, config: "AAUConfig"
) -> list[tuple[str, SourceKind]]:
    """arXiv paper search (official Atom API, no key)."""
    try:
        import arxiv
    except ImportError:
        return []

    def _sync_search() -> list[LearnedFact]:
        client = arxiv.Client()
        search = arxiv.Search(
            query=query,
            max_results=max_results,
            sort_by=arxiv.SortCriterion.Relevance,
        )
        facts = []
        for paper in client.results(search):
            facts.append(
                LearnedFact(
                    url=paper.entry_id,
                    title=paper.title,
                    content=(
                        f"# {paper.title}\n\n"
                        f"**Authors:** {', '.join(a.name for a in paper.authors[:3])}\n"
                        f"**Published:** {paper.published.date()}\n\n"
                        f"{paper.summary[:2800]}"
                    ),
                    source_kind=SourceKind.ARXIV,
                )
            )
        return facts

    try:
        facts = await asyncio.to_thread(_sync_search)
        # arXiv results are already fully extracted — no HTTP fetch needed
        # Return as sentinel URLs with ARXIV kind; fetcher will detect and pass through
        return [(f.url, SourceKind.ARXIV) for f in facts]
    except Exception as exc:
        logger.warning("arXiv search failed: %s", exc)
        return []


def _wikipedia_url(query: str) -> str | None:
    """Build Wikipedia REST API summary URL for a topic (heuristic)."""
    # Only generate a Wikipedia lookup for short, noun-phrase-style queries
    words = query.split()
    if len(words) > 6:
        return None
    title = query.replace(" ", "_")
    encoded = urllib.parse.quote(title, safe="")
    return f"https://en.wikipedia.org/api/rest_v1/page/summary/{encoded}"


def _looks_academic(query: str) -> bool:
    """Heuristic: does the query look like it benefits from paper search?"""
    academic_signals = {
        "algorithm", "model", "neural", "learning", "paper", "research",
        "theory", "proof", "dataset", "benchmark", "architecture", "framework",
        "method", "approach", "analysis", "study",
    }
    words = set(query.lower().split())
    return bool(words & academic_signals)


async def fetch_pypi_info(package: str) -> LearnedFact | None:
    """Fetch PyPI package metadata (no auth, no rate limit stated)."""
    try:
        import httpx
    except ImportError:
        return None

    url = f"https://pypi.org/pypi/{package}/json"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(url)
        if r.status_code != 200:
            return None
        d = r.json()
        info = d.get("info", {})
        content = (
            f"# {info.get('name', package)} {info.get('version', '')}\n\n"
            f"{info.get('summary', '')}\n\n"
            f"License: {info.get('license', 'unknown')}\n"
            f"Home: {info.get('project_url', info.get('home_page', ''))}"
        )
        return LearnedFact(
            url=url,
            title=f"{info.get('name', package)} (PyPI)",
            content=content,
            source_kind=SourceKind.PYPI,
        )
    except Exception as exc:
        logger.warning("PyPI fetch failed for %r: %s", package, exc)
        return None
