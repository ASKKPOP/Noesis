"""Lore types — collective memory entry records (Phase 20)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class LoreEntry:
    """A single lore entry stored in the brain-local lore library.

    content_hash: sha256 of full content body (linking key across Brain and Grid).
    contributor_did: DID of the Nous who originally authored this entry.
    category_tag: closed enum from LORE_CATEGORIES (D-20-03/04).
    title: Short title (not transmitted to Grid; Grid stores title_hash only).
    content: Full prose content (Brain-private, NEVER crosses Brain-Grid wire).
    received_tick: tick when this Nous received the entry (FIFO eviction key, D-20-09).
    """

    content_hash: str
    contributor_did: str
    category_tag: str
    title: str
    content: str
    received_tick: int

    @classmethod
    def from_row(cls, row: Any) -> "LoreEntry":
        """Construct from sqlite3 Row or tuple (index-based fallback)."""
        if hasattr(row, "__getitem__") and hasattr(row, "keys"):
            return cls(
                content_hash=row["content_hash"],
                contributor_did=row["contributor_did"],
                category_tag=row["category_tag"],
                title=row["title"],
                content=row["content"],
                received_tick=row["received_tick"],
            )
        return cls(
            content_hash=row[0],
            contributor_did=row[1],
            category_tag=row[2],
            title=row[3],
            content=row[4],
            received_tick=row[5],
        )

    def to_prompt_block(self) -> str:
        """Format for injection into the system prompt (D-20-02)."""
        return f"[{self.category_tag}] **{self.title}**: {self.content}"


# Closed enum of valid category tags (D-20-04).
# TOML key: lore_categories (list of strings) overrides this at startup (D-20-03).
LORE_CATEGORIES: frozenset[str] = frozenset({
    "cultural",
    "historical",
    "observation",
    "synthesis",
})
