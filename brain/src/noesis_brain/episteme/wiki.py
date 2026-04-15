"""Personal Wiki — Karpathy-pattern structured knowledge pages.

Each Nous maintains a wiki of structured knowledge about:
- Other Nous (relationships, traits, interactions)
- Concepts (philosophy, trade, governance)
- Places (regions, features, who frequents them)
- Skills (abilities, proficiency levels)
- Beliefs (opinions, convictions, uncertainties)
"""

from __future__ import annotations

from noesis_brain.memory.sqlite_store import MemoryStore
from noesis_brain.memory.types import WikiPage, WikiCategory


class PersonalWiki:
    """High-level wiki interface for a Nous's knowledge base.

    Usage:
        wiki = PersonalWiki(store)
        wiki.write("Nous Hermes", WikiCategory.NOUS,
                    "Cunning trader, values profit. Met in Agora Central.")
        page = wiki.read("Nous Hermes")
    """

    def __init__(self, store: MemoryStore) -> None:
        self._store = store

    def write(
        self,
        title: str,
        category: WikiCategory,
        content: str,
        confidence: float = 0.5,
        source: str = "",
    ) -> WikiPage:
        """Create a new wiki page. Raises if title already exists."""
        page = WikiPage(
            title=title,
            category=category,
            content=content,
            confidence=confidence,
            source=source,
        )
        return self._store.add_wiki_page(page)

    def read(self, title: str) -> WikiPage | None:
        """Read a wiki page by title."""
        return self._store.get_wiki_page(title)

    def update(
        self,
        title: str,
        content: str,
        confidence: float | None = None,
        source: str | None = None,
    ) -> WikiPage | None:
        """Update an existing wiki page. Returns None if not found."""
        return self._store.update_wiki_page(title, content, confidence, source)

    def write_or_update(
        self,
        title: str,
        category: WikiCategory,
        content: str,
        confidence: float = 0.5,
        source: str = "",
    ) -> WikiPage:
        """Create or update a wiki page."""
        existing = self._store.get_wiki_page(title)
        if existing:
            return self._store.update_wiki_page(title, content, confidence, source)
        return self.write(title, category, content, confidence, source)

    def delete(self, title: str) -> bool:
        """Delete a wiki page."""
        return self._store.delete_wiki_page(title)

    def pages_about_nous(self) -> list[WikiPage]:
        """Get all wiki pages about other Nous."""
        return self._store.wiki_pages_by_category(WikiCategory.NOUS)

    def pages_by_category(self, category: WikiCategory) -> list[WikiPage]:
        """Get all wiki pages in a category."""
        return self._store.wiki_pages_by_category(category)

    def all_pages(self) -> list[WikiPage]:
        """Get all wiki pages."""
        return self._store.all_wiki_pages()

    def count(self) -> int:
        """Total wiki pages."""
        return self._store.wiki_page_count()

    def format_for_prompt(self, titles: list[str] | None = None, max_pages: int = 5) -> str:
        """Format wiki pages for inclusion in an LLM prompt."""
        if titles:
            pages = [self.read(t) for t in titles]
            pages = [p for p in pages if p is not None]
        else:
            pages = self._store.all_wiki_pages()[:max_pages]

        if not pages:
            return "No wiki pages yet."

        lines = []
        for p in pages[:max_pages]:
            conf = f" (confidence: {p.confidence:.0%})" if p.confidence < 1.0 else ""
            lines.append(f"## {p.title}{conf}")
            lines.append(p.content)
            lines.append("")
        return "\n".join(lines)
