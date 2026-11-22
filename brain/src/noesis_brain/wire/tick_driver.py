"""
brain/src/noesis_brain/wire/tick_driver.py

A Brain that reached its Grid over the wire (GRID_URL) has no Grid-side caller of
``brain.onTick``: the Grid cannot dial a Brain on someone's own machine. What it
does receive is the Grid's clock, as ``tick`` events on the firehose. TickDriver
turns those into the Nous's decision call.

One decision at a time. A local model can take longer to think than the Grid takes
to tick; a tick that arrives while the Nous is still deciding is skipped, never
queued — the Nous acts on the present, not on a backlog.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Awaitable, Callable, Optional

__all__ = ["TickDriver", "tick_of"]

log = logging.getLogger(__name__)


def tick_of(frame: dict[str, Any]) -> Optional[dict[str, int]]:
    """The ``{tick, epoch}`` of a firehose clock frame, or None for any other frame."""
    if frame.get("type") != "event":
        return None
    entry = frame.get("entry")
    if not isinstance(entry, dict) or entry.get("eventType") != "tick":
        return None
    payload = entry.get("payload")
    if not isinstance(payload, dict):
        return None
    tick = payload.get("tick")
    if isinstance(tick, bool) or not isinstance(tick, int):
        return None
    epoch = payload.get("epoch")
    return {"tick": tick, "epoch": epoch if isinstance(epoch, int) and not isinstance(epoch, bool) else 0}


class TickDriver:
    def __init__(self, on_tick: Callable[[dict[str, Any]], Awaitable[Any]]) -> None:
        self._on_tick = on_tick
        self._task: Optional[asyncio.Task] = None  # type: ignore[type-arg]

    def offer(self, frame: dict[str, Any]) -> bool:
        """Start a decision for this frame if it is a clock tick and the Nous is free.

        Returns True when a decision was started. Never blocks: the decision runs as
        a background task so the firehose keeps being read while the Nous thinks.
        """
        params = tick_of(frame)
        if params is None:
            return False
        if self._task is not None and not self._task.done():
            return False
        self._task = asyncio.create_task(self._decide(params))
        return True

    async def _decide(self, params: dict[str, int]) -> None:
        try:
            await self._on_tick(params)
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("[Brain] decision at tick %s failed", params["tick"])
