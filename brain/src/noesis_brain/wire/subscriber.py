"""
brain/src/noesis_brain/wire/subscriber.py

Phase 38 WIRE-01 (WSS half) + WIRE-05 (per-DID filter, server-side).

WssSubscriber opens a WebSocket connection to the Grid firehose at
``wss://<grid>/api/v1/brain/firehose`` using the brain's bearer JWT for
authentication and delivers parsed JSON frames to an async callback.

On any disconnect (clean or error) the subscriber reconnects automatically
with exponential backoff + jitter to avoid thundering-herd behaviour when
the Grid restarts (Pitfall 3 from the Phase 38 design notes).
"""

from __future__ import annotations

import asyncio
import json
import logging
import random
from typing import Awaitable, Callable, Optional

import websockets

from .token_manager import TokenManager

__all__ = ["WssSubscriber"]

log = logging.getLogger(__name__)

BASE_BACKOFF_SECONDS: float = 1.0
MAX_BACKOFF_SECONDS: float = 60.0


class WssSubscriber:
    """Persistent, auto-reconnecting WebSocket subscriber for the Grid firehose.

    Usage::

        async def handle(frame: dict) -> None:
            print(frame)

        sub = WssSubscriber(
            grid_url="https://grid.noesis.local",
            token_manager=my_token_manager,
            on_frame=handle,
        )
        await sub.start()   # launches background task
        # ... later ...
        await sub.stop()    # clean shutdown (max 5s wait)
    """

    def __init__(
        self,
        *,
        grid_url: str,
        token_manager: TokenManager,
        on_frame: Callable[[dict], Awaitable[None]],  # type: ignore[type-arg]
    ) -> None:
        # Accept https:// or wss:// — internally always wss.
        if grid_url.startswith("https://"):
            base = "wss://" + grid_url[len("https://"):]
        elif grid_url.startswith("wss://"):
            base = grid_url
        else:
            raise ValueError(
                f"WssSubscriber requires https:// or wss:// URL, got {grid_url!r}"
            )
        self._url = f"{base.rstrip('/')}/api/v1/brain/firehose"
        self._token_manager = token_manager
        self._on_frame = on_frame
        self._stop = asyncio.Event()
        self._task: Optional[asyncio.Task] = None  # type: ignore[type-arg]

    async def start(self) -> None:
        """Launch the background reconnect loop.

        Raises ``RuntimeError`` if already started.
        """
        if self._task is not None:
            raise RuntimeError("WssSubscriber already started")
        self._stop.clear()
        self._task = asyncio.create_task(self._run_forever())

    async def stop(self) -> None:
        """Signal the reconnect loop to stop and wait up to 5 s for it to exit."""
        self._stop.set()
        if self._task is not None:
            try:
                await asyncio.wait_for(self._task, timeout=5.0)
            except asyncio.TimeoutError:
                self._task.cancel()
                try:
                    await self._task
                except (asyncio.CancelledError, Exception):
                    pass
            self._task = None

    async def _run_forever(self) -> None:
        attempt = 0
        while not self._stop.is_set():
            try:
                await self._connect_once()
                attempt = 0  # successful session — reset backoff counter
            except Exception as exc:
                log.warning("[Brain] WSS connection lost: %s", exc)

            if self._stop.is_set():
                return

            # Exponential backoff with jitter (Pitfall 3).
            # delay = min(60, 1 * 2**attempt) * [0.75, 1.25]
            delay = min(MAX_BACKOFF_SECONDS, BASE_BACKOFF_SECONDS * (2 ** attempt))
            jitter = 0.75 + 0.5 * random.random()  # uniform [0.75, 1.25]
            sleep_for = delay * jitter
            log.debug(
                "[Brain] WSS reconnect in %.2fs (attempt %d)", sleep_for, attempt
            )
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=sleep_for)
                return  # stop signaled during backoff sleep
            except asyncio.TimeoutError:
                pass  # sleep elapsed normally — try again

            attempt = min(attempt + 1, 6)  # cap so delay never exceeds 60 s base

    async def _connect_once(self) -> None:
        """Open one WebSocket session and receive frames until disconnect or stop."""
        token = self._token_manager.get_valid_token()
        headers = {"Authorization": f"Bearer {token}"}
        async with websockets.connect(self._url, additional_headers=headers) as ws:
            log.info("[Brain] WSS connected to %s", self._url)
            while not self._stop.is_set():
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=1.0)
                except asyncio.TimeoutError:
                    # Periodically yield so _stop can be detected between frames
                    continue
                try:
                    frame = json.loads(raw)
                except json.JSONDecodeError:
                    log.warning("[Brain] WSS dropped non-JSON frame: %r", raw[:80])
                    continue
                try:
                    await self._on_frame(frame)
                except Exception:
                    log.exception("[Brain] WSS on_frame handler raised")
