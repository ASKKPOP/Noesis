"""AAU types — data structures for web-learned facts."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum


class SourceKind(str, Enum):
    """Where a learned fact came from."""

    WEB = "web"                 # General httpx fetch via DuckDuckGo result
    ARXIV = "arxiv"             # arXiv paper abstract
    WIKIPEDIA = "wikipedia"     # Wikipedia REST API summary
    PYPI = "pypi"               # PyPI package metadata
    NPM = "npm"                 # npm registry metadata
    RSS = "rss"                 # RSS/Atom feed entry
    JINA = "jina"               # Jina Reader fallback (r.jina.ai)

    @property
    def default_ttl_days(self) -> int:
        """Default TTL by source type (research finding: differentiated TTLs)."""
        return {
            SourceKind.WEB: 7,
            SourceKind.ARXIV: 90,
            SourceKind.WIKIPEDIA: 14,
            SourceKind.PYPI: 1,
            SourceKind.NPM: 1,
            SourceKind.RSS: 0,   # 0 = never cache RSS entries (always fresh)
            SourceKind.JINA: 7,
        }[self]


@dataclass
class FetchResult:
    """Raw HTTP fetch result before extraction."""

    url: str
    status: int
    content_type: str
    body: bytes = field(default_factory=bytes)

    @property
    def is_ok(self) -> bool:
        return self.status == 200

    @property
    def is_html(self) -> bool:
        return "html" in self.content_type

    @property
    def is_pdf(self) -> bool:
        return "pdf" in self.content_type

    @property
    def is_json(self) -> bool:
        return "json" in self.content_type


@dataclass
class LearnedFact:
    """A single piece of knowledge extracted from the web and ready for storage."""

    url: str
    title: str
    content: str                           # Clean markdown / text (≤3000 chars)
    source_kind: SourceKind = SourceKind.WEB
    fetched_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def ttl_days(self) -> int:
        return self.source_kind.default_ttl_days

    def is_storable(self) -> bool:
        """Reject obviously useless content."""
        return bool(self.content) and len(self.content) >= 80

    def truncated_content(self, max_chars: int = 3000) -> str:
        """Truncate at last sentence boundary up to max_chars."""
        if len(self.content) <= max_chars:
            return self.content
        cut = self.content[:max_chars]
        # Try to end at a sentence boundary
        for sep in (". ", ".\n", "! ", "? "):
            idx = cut.rfind(sep)
            if idx > max_chars // 2:
                return cut[: idx + 1]
        return cut
