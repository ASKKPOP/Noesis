"""
brain/src/noesis_brain/wire/client.py

Phase 38 WIRE-01 — Brain → Grid HTTPS REST client.
Phase 38 WIRE-03 — Queue-on-error + batch replay (Plan 38-03 extends Plan 38-02).

GridWireClient wraps httpx.AsyncClient to POST BrainAction batches to
POST /api/v1/brain/actions with a short-lived EdDSA bearer token.

TLS is enforced at construction time via validate_grid_url(): Brain refuses
to start when GRID_URL is http:// (Pitfall 5 from RESEARCH.md — validation
fires at config-load, not at first connection attempt).

Offline resilience (WIRE-03):
  - On transport error or status >= 500: each action is individually enqueued
    in the SQLite WireQueue with its derived idempotency key.
  - On any successful delivery: _maybe_replay() drains the queue via
    POST /api/v1/brain/events/batch, deleting acked rows.
  - A replay lock (asyncio.Lock) prevents concurrent drain attempts.
  - 4xx responses are NOT silently queued — they indicate an auth or logic
    error that queuing will not fix.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Optional
from urllib.parse import urlparse

import httpx

from .token_manager import TokenManager
from .queue import WireQueue, QueuedEvent

__all__ = ["GridWireClient", "validate_grid_url"]

log = logging.getLogger(__name__)

# wss:// is reserved for Plan 38-04 (WSS subscriber).
ALLOWED_SCHEMES = {"https", "wss"}


def validate_grid_url(url: str) -> None:
    """Raise ValueError if the URL scheme is not https:// or wss://.

    Called at config-load time (before BrainApp construction) so that a
    misconfigured GRID_URL causes an immediate process exit rather than
    a silent failure on the first tick.

    Pitfall 5 (RESEARCH.md): validation MUST fire before the event loop
    starts — do not defer to first connection attempt.
    """
    parsed = urlparse(url)
    if parsed.scheme not in ALLOWED_SCHEMES:
        raise ValueError(
            f"GRID_URL must use https:// or wss:// scheme, "
            f"got: {url!r} (scheme={parsed.scheme!r})"
        )
    if not parsed.netloc:
        raise ValueError(f"GRID_URL must include a host, got: {url!r}")


class GridWireClient:
    """Brain → Grid HTTPS REST client. Used when GRID_URL is set.

    Reuses a persistent httpx.AsyncClient (one per Brain process) rather than
    creating one per request.  Call aclose() on process shutdown to drain the
    client connection pool.

    Offline resilience (WIRE-03):
      If a WireQueue is supplied via the ``queue`` parameter, this client will
      enqueue every action that fails to deliver (transport error or 5xx) and
      will drain the queue on the first successful delivery via the batch replay
      endpoint POST /api/v1/brain/events/batch.
    """

    def __init__(
        self,
        *,
        grid_url: str,
        token_manager: TokenManager,
        brain_did: str,
        queue: Optional[WireQueue] = None,
        timeout_seconds: float = 10.0,
        replay_batch_size: int = 100,
    ) -> None:
        validate_grid_url(grid_url)
        self._base_url = grid_url.rstrip("/")
        self._token_manager = token_manager
        self._brain_did = brain_did
        self._queue = queue
        self._timeout = timeout_seconds
        self._replay_batch_size = replay_batch_size
        self._replay_lock = asyncio.Lock()  # prevents concurrent replays
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Return the shared AsyncClient, constructing it on first use."""
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=self._timeout)
        return self._client

    async def aclose(self) -> None:
        """Close the underlying HTTP client and release connections."""
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    # ── Live delivery ──────────────────────────────────────────────────────────

    async def post_actions(
        self,
        actions: list[dict[str, Any]],
        tick: int,
    ) -> None:
        """Try online delivery; on failure enqueue each action.

        Success path: sends actions to /api/v1/brain/actions, then attempts to
        drain the WireQueue via the batch replay endpoint.

        Failure path (transport error OR status >= 500): enqueues every action
        individually with its derived idempotency key. Does NOT raise — caller
        continues normally. The events will be replayed on next success.

        4xx responses are logged loudly but NOT queued — they indicate a
        programmer or auth error that retrying will not fix.
        """
        if not actions:
            return
        try:
            resp = await self._do_post_actions(actions, tick)
            if 200 <= resp.status_code < 300:
                # Online success — also attempt to drain anything previously queued.
                await self._maybe_replay()
                return
            if resp.status_code >= 500:
                # Server-side transient — queue and continue.
                self._enqueue_all(actions, tick)
                return
            # 4xx is a programmer / auth error — log loudly, do NOT silently queue.
            log.error(
                "[Brain] grid_wire actions rejected: status=%d body=%s",
                resp.status_code,
                resp.text[:200],
            )
        except (httpx.RequestError, httpx.TimeoutException) as exc:
            log.warning("[Brain] grid_wire actions transport error, queueing: %s", exc)
            self._enqueue_all(actions, tick)

    async def _do_post_actions(
        self,
        actions: list[dict[str, Any]],
        tick: int,
    ) -> httpx.Response:
        """Inner method: POST to /api/v1/brain/actions. Returns raw response.

        Kept separate so tests can monkeypatch just this method without
        reimplementing the full retry/queue logic.
        """
        token = self._token_manager.get_valid_token()
        client = await self._get_client()
        return await client.post(
            f"{self._base_url}/api/v1/brain/actions",
            json={"tick": tick, "actions": actions},
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )

    # ── Presence heartbeat ────────────────────────────────────────────────────

    async def post_presence_heartbeat(self) -> None:
        """Phase 41 SLEEP-01 / D-41-02 — POST /api/v1/civic/presence keep-alive.

        Called every 60 seconds by the heartbeat task in Brain startup. The Grid
        resets its grace timer for our Civic-DID on receipt. On 2xx response,
        persists last_seen_tick to WireQueue SQLite for reconnect cursor.

        Errors logged at WARNING; NEVER raised — grace timer is the safety net.
        """
        try:
            token = self._token_manager.get_valid_token()
            client = await self._get_client()
            resp = await client.post(
                f"{self._base_url}/api/v1/civic/presence",
                json={},
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
            )
            if 200 <= resp.status_code < 300:
                if self._queue is not None:
                    try:
                        data = resp.json()
                    except Exception:
                        data = {}
                    if isinstance(data, dict) and "last_seen_tick" in data:
                        tick = data["last_seen_tick"]
                        if isinstance(tick, int):
                            self._queue.set_last_seen_tick(tick)
            else:
                log.warning(
                    "[Brain] presence heartbeat non-2xx: status=%s",
                    resp.status_code,
                )
        except Exception as exc:
            log.warning("[Brain] presence heartbeat error: %s", exc)

    # ── Queue helpers ──────────────────────────────────────────────────────────

    def _enqueue_all(self, actions: list[dict[str, Any]], tick: int) -> None:
        """Enqueue every action individually. No-op when queue is not configured."""
        if self._queue is None:
            log.warning(
                "[Brain] grid_wire actions failed but no queue configured — DROPPED %d actions",
                len(actions),
            )
            return
        for act in actions:
            event_type = act.get("action_type", "unknown")
            try:
                self._queue.enqueue(
                    brain_did=self._brain_did,
                    tick=tick,
                    event_type=str(event_type),
                    payload=act,
                )
            except Exception:
                log.exception(
                    "[Brain] wire_queue enqueue failed for action_type=%s", event_type
                )

    # ── Replay ─────────────────────────────────────────────────────────────────

    async def _maybe_replay(self) -> None:
        """Drain the WireQueue in batches via POST /api/v1/brain/events/batch.

        Called automatically after a successful live delivery. Idempotency makes
        repeated replay attempts safe — Grid's INSERT IGNORE absorbs duplicates.

        The replay lock prevents a second concurrent drain from starting while
        one is already in progress.

        On any transport error or non-2xx batch response, stops draining and
        leaves remaining events in the queue for the next attempt.
        """
        if self._queue is None or self._queue.size() == 0:
            return
        if self._replay_lock.locked():
            return  # another replay is in progress
        async with self._replay_lock:
            while True:
                batch: list[QueuedEvent] = self._queue.dequeue_batch(self._replay_batch_size)
                if not batch:
                    break
                body = {
                    "events": [
                        {
                            "idempotency_key": evt.idempotency_key,
                            "brain_did": evt.brain_did,
                            "tick": evt.tick,
                            "event_type": evt.event_type,
                            "payload": evt.payload,
                        }
                        for evt in batch
                    ]
                }
                token = self._token_manager.get_valid_token()
                client = await self._get_client()
                try:
                    resp = await client.post(
                        f"{self._base_url}/api/v1/brain/events/batch",
                        json=body,
                        headers={
                            "Authorization": f"Bearer {token}",
                            "Content-Type": "application/json",
                        },
                    )
                except (httpx.RequestError, httpx.TimeoutException):
                    # Network still bad — stop draining; events stay queued.
                    return
                if 200 <= resp.status_code < 300:
                    # Delete ALL rows in the batch regardless of accepted vs duplicate:
                    # duplicate means Grid already has it (safe to delete locally).
                    self._queue.mark_acked([evt.row_id for evt in batch])
                else:
                    log.error(
                        "[Brain] grid_wire batch replay rejected: status=%d body=%s",
                        resp.status_code,
                        resp.text[:200],
                    )
                    # Do NOT mark acked — keep events queued for next attempt.
                    return
