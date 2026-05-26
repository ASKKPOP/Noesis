"""
brain/src/noesis_brain/wire/client.py

Phase 38 WIRE-01 — Brain → Grid HTTPS REST client.

GridWireClient wraps httpx.AsyncClient to POST BrainAction batches to
POST /api/v1/brain/actions with a short-lived EdDSA bearer token.

TLS is enforced at construction time via validate_grid_url(): Brain refuses
to start when GRID_URL is http:// (Pitfall 5 from RESEARCH.md — validation
fires at config-load, not at first connection attempt).
"""

from __future__ import annotations

from typing import Any, Optional
from urllib.parse import urlparse

import httpx

from .token_manager import TokenManager

__all__ = ["GridWireClient", "validate_grid_url"]

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

    Reuses a persistent httpx.AsyncClient (one per Brain process) rather
    than creating one per request — mirrors the lore-poll pattern at
    brain/src/noesis_brain/rpc/handler.py:649 but with connection reuse.

    Call aclose() on process shutdown to drain the client connection pool.
    """

    def __init__(
        self,
        *,
        grid_url: str,
        token_manager: TokenManager,
        timeout_seconds: float = 10.0,
    ) -> None:
        validate_grid_url(grid_url)
        self._base_url = grid_url.rstrip("/")
        self._token_manager = token_manager
        self._timeout = timeout_seconds
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

    async def post_actions(
        self,
        actions: list[dict[str, Any]],
        tick: int,
    ) -> httpx.Response:
        """POST a batch of BrainAction dicts to /api/v1/brain/actions.

        Returns the raw httpx.Response so the caller can inspect the status
        code and decide on retry / queue-on-error policy (Plan 38-03 will
        wrap this with queue-on-error logic; for now the caller logs non-2xx).

        Does NOT raise on non-2xx — plan 38-03 wraps this with queue-on-error.
        Network errors (ConnectError, TimeoutException) propagate to the caller
        which is responsible for logging / queuing.
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
