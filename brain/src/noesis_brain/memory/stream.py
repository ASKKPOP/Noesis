"""Memory stream — records observations, conversations, and events."""

from __future__ import annotations

from datetime import datetime, timezone

from noesis_brain.memory.types import Memory, MemoryType
from noesis_brain.memory.sqlite_store import MemoryStore


class MemoryStream:
    """High-level interface for recording and querying memories.

    Wraps MemoryStore with convenience methods for common operations.
    """

    def __init__(self, store: MemoryStore) -> None:
        self._store = store

    def observe(
        self,
        content: str,
        importance: float = 5.0,
        location: str = "",
        tick: int = 0,
    ) -> Memory:
        """Record an observation about the world."""
        return self._store.add_memory(Memory(
            memory_type=MemoryType.OBSERVATION,
            content=content,
            importance=importance,
            location=location,
            tick=tick,
        ))

    def record_conversation(
        self,
        content: str,
        source_did: str,
        importance: float = 6.0,
        location: str = "",
        tick: int = 0,
    ) -> Memory:
        """Record a conversation with another Nous."""
        return self._store.add_memory(Memory(
            memory_type=MemoryType.CONVERSATION,
            content=content,
            importance=importance,
            source_did=source_did,
            location=location,
            tick=tick,
        ))

    def record_event(
        self,
        content: str,
        importance: float = 7.0,
        source_did: str = "",
        location: str = "",
        tick: int = 0,
    ) -> Memory:
        """Record a notable event (trade, law change, achievement)."""
        return self._store.add_memory(Memory(
            memory_type=MemoryType.EVENT,
            content=content,
            importance=importance,
            source_did=source_did,
            location=location,
            tick=tick,
        ))

    def add_reflection(
        self,
        content: str,
        importance: float = 8.0,
        tick: int = 0,
    ) -> Memory:
        """Record a higher-level reflection/insight."""
        return self._store.add_memory(Memory(
            memory_type=MemoryType.REFLECTION,
            content=content,
            importance=importance,
            tick=tick,
        ))

    def recent(self, limit: int = 20, memory_type: MemoryType | None = None) -> list[Memory]:
        """Get recent memories."""
        return self._store.recent_memories(limit=limit, memory_type=memory_type)

    def about(self, source_did: str, limit: int = 20) -> list[Memory]:
        """Get memories about/involving a specific Nous."""
        return self._store.memories_by_source(source_did, limit=limit)

    def important(self, min_importance: float = 7.0, limit: int = 20) -> list[Memory]:
        """Get high-importance memories."""
        return self._store.memories_by_importance(min_importance, limit=limit)

    def count(self) -> int:
        """Total memories recorded."""
        return self._store.memory_count()

    def format_for_prompt(self, memories: list[Memory], max_entries: int = 10) -> str:
        """Format memories for inclusion in an LLM prompt."""
        if not memories:
            return "No relevant memories."
        lines = []
        for m in memories[:max_entries]:
            timestamp = m.created_at.strftime("%Y-%m-%d %H:%M")
            prefix = f"[{timestamp}]"
            if m.source_did:
                prefix += f" (involving {m.source_did})"
            lines.append(f"{prefix} {m.content}")
        return "\n".join(lines)
