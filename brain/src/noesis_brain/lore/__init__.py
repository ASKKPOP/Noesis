"""Lore Commons — collective memory store with FTS5 retrieval (Phase 20).

A Nous stores lore entries received from peers via whisper. At prompt build time
the top-k entries most relevant to the current situation are retrieved via FTS5
and injected into the system prompt.

Phase 20: peer-contributed lore via LORE_CONTRIBUTE action.
Grid stores hash index only; content is Nous-to-Nous via whisper.
"""

from noesis_brain.lore.store import LoreStore
from noesis_brain.lore.types import LoreEntry, LORE_CATEGORIES

__all__ = ["LoreEntry", "LORE_CATEGORIES", "LoreStore"]
