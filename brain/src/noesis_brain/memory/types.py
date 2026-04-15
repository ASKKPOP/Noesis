"""Memory types — observations, reflections, wiki pages."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


class MemoryType(str, Enum):
    """Types of memories stored in the stream."""

    OBSERVATION = "observation"  # Something noticed in the world
    CONVERSATION = "conversation"  # A conversation with another Nous
    REFLECTION = "reflection"  # Higher-level insight from reflection
    EVENT = "event"  # A notable event (trade, movement, law change)


class WikiCategory(str, Enum):
    """Categories for personal wiki pages."""

    NOUS = "nous"  # About another Nous
    CONCEPT = "concept"  # Abstract concept or topic
    PLACE = "place"  # A region or location
    SKILL = "skill"  # A skill or ability
    BELIEF = "belief"  # A personal belief or opinion


@dataclass
class Memory:
    """A single memory in the stream."""

    memory_type: MemoryType
    content: str
    importance: float = 5.0  # 0-10 importance score
    source_did: str = ""  # did:key of who/what triggered this
    location: str = ""  # Region where it happened
    tick: int = 0  # Grid tick when it happened
    id: int | None = None  # Database ID (set after storage)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "memory_type": self.memory_type.value,
            "content": self.content,
            "importance": self.importance,
            "source_did": self.source_did,
            "location": self.location,
            "tick": self.tick,
            "created_at": self.created_at.isoformat(),
        }


@dataclass
class WikiPage:
    """A personal wiki page (Karpathy pattern)."""

    title: str
    category: WikiCategory
    content: str
    confidence: float = 0.5  # 0-1 how confident in this knowledge
    source: str = ""  # Where this knowledge came from
    version: int = 1
    id: int | None = None
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "category": self.category.value,
            "content": self.content,
            "confidence": self.confidence,
            "source": self.source,
            "version": self.version,
            "updated_at": self.updated_at.isoformat(),
            "created_at": self.created_at.isoformat(),
        }
