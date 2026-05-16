"""WorkingMemory — pure in-memory ring buffer (cap=7, Miller's Law). Phase 16.

NOT persisted to SQLite. Reconstructed each tick from MemoryStore. D-16-01.
Wall-clock FORBIDDEN in this module.
"""
from __future__ import annotations

from collections import deque

from noesis_brain.hypnos.types import Episode


class WorkingMemory:
    """Ring buffer capped at 7 episodes. Overflow evicts oldest (FIFO via deque). D-16-01."""

    CAP = 7

    def __init__(self) -> None:
        self._buf: deque[Episode] = deque(maxlen=self.CAP)

    def set_episodes(self, memories: list) -> None:
        """Replace buffer contents from tick-ordered MemoryStore results.

        Takes the first CAP items from memories (caller already fetched limit=7).
        Clears the buffer first so stale episodes don't persist.
        """
        self._buf.clear()
        for m in memories[:self.CAP]:
            # Accept any object with .content and .memory_type attributes (MemoryStore rows).
            content = getattr(m, "content", "") or ""
            mtype = str(getattr(m, "memory_type", "observation"))
            self._buf.append(Episode(content=content, memory_type=mtype))

    def episodes(self) -> list[Episode]:
        """Return current episodes as a plain list (oldest first)."""
        return list(self._buf)

    def __len__(self) -> int:
        return len(self._buf)
