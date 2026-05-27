"""Phase 41 / SLEEP-03 — GridWireClient.post_presence_heartbeat() contract."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest


def _make_client(queue=None, status_code=200, json_body=None, raise_exc=None):
    """Build a GridWireClient with mocked internals for heartbeat tests.

    Returns (client, mock_http_client) so tests can inspect the captured request.
    """
    from noesis_brain.wire.client import GridWireClient

    token_mgr = MagicMock()
    token_mgr.get_valid_token.return_value = "test-jwt-token"

    # Build a real GridWireClient (uses https:// to pass validate_grid_url)
    wire = GridWireClient(
        grid_url="https://grid.noesis.test",
        token_manager=token_mgr,
        brain_did="did:noesis:nous:test",
        queue=queue,
    )

    # Build a mock httpx.AsyncClient whose .post() is controllable
    mock_http = AsyncMock()
    if raise_exc is not None:
        mock_http.post = AsyncMock(side_effect=raise_exc)
    else:
        fake_resp = MagicMock()
        fake_resp.status_code = status_code
        body = json_body if json_body is not None else {}
        fake_resp.json.return_value = body
        mock_http.post = AsyncMock(return_value=fake_resp)

    # Inject the mock client so _get_client() returns it
    wire._client = mock_http

    return wire, mock_http


@pytest.mark.asyncio
async def test_post_presence_heartbeat_posts_bearer_jwt_to_civic_presence_endpoint():
    """POST /api/v1/civic/presence with Authorization: Bearer <token>; body = {}."""
    wire, mock_http = _make_client(status_code=200, json_body={})

    await wire.post_presence_heartbeat()

    mock_http.post.assert_called_once()
    call_kwargs = mock_http.post.call_args

    # URL must end with /api/v1/civic/presence
    url_arg = call_kwargs[0][0] if call_kwargs[0] else call_kwargs.kwargs.get("url") or call_kwargs[1].get("url", "")
    # positional arg is always the URL
    assert url_arg.endswith("/api/v1/civic/presence"), f"Unexpected URL: {url_arg}"

    # Body must be {}
    assert call_kwargs.kwargs.get("json") == {}

    # Authorization header must carry the bearer token
    headers = call_kwargs.kwargs.get("headers", {})
    assert headers.get("Authorization") == "Bearer test-jwt-token"


@pytest.mark.asyncio
async def test_post_presence_heartbeat_writes_last_seen_tick_to_wire_queue_kv():
    """On 2xx response containing last_seen_tick, calls WireQueue.set_last_seen_tick(tick)."""
    mock_queue = MagicMock()
    wire, _ = _make_client(queue=mock_queue, status_code=200, json_body={"last_seen_tick": 100})

    await wire.post_presence_heartbeat()

    mock_queue.set_last_seen_tick.assert_called_once_with(100)


@pytest.mark.asyncio
async def test_post_presence_heartbeat_swallows_transport_errors():
    """httpx.RequestError logged at WARNING; does NOT raise — grace timer is the safety net."""
    wire, _ = _make_client(raise_exc=httpx.RequestError("connection refused"))

    # Must not raise
    result = await wire.post_presence_heartbeat()
    assert result is None


@pytest.mark.asyncio
async def test_post_presence_heartbeat_skips_kv_write_when_queue_is_none():
    """If client._queue is None, no SQLite write attempted; method still returns cleanly."""
    wire, _ = _make_client(queue=None, status_code=200, json_body={"last_seen_tick": 42})

    # Must not raise AttributeError or anything else
    result = await wire.post_presence_heartbeat()
    assert result is None
