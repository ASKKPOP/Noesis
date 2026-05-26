"""
brain/test/wire/test_grid_wire_client.py

Phase 38 WIRE-01 — GridWireClient unit tests.

Tests:
  - validate_grid_url: accepts https://, wss://; rejects http://, ws://, missing host
  - post_actions: injects Bearer token + correct JSON body
  - post_actions: uses rotated token after 23h
"""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from nacl.signing import SigningKey  # type: ignore[import]

from noesis_brain.wire.client import GridWireClient, validate_grid_url
from noesis_brain.wire.token_manager import TokenManager


# ── validate_grid_url ─────────────────────────────────────────────────────────

def test_validate_grid_url_accepts_https() -> None:
    """https:// scheme must be accepted without error."""
    result = validate_grid_url("https://grid.noesis")
    assert result is None  # returns None on success


def test_validate_grid_url_accepts_wss() -> None:
    """wss:// scheme must be accepted (reserved for Plan 38-04 WSS subscriber)."""
    result = validate_grid_url("wss://grid.noesis")
    assert result is None


def test_validate_grid_url_rejects_http() -> None:
    """http:// scheme must raise ValueError with 'must use https' in message."""
    with pytest.raises(ValueError, match="must use https"):
        validate_grid_url("http://grid.noesis")


def test_validate_grid_url_rejects_ws() -> None:
    """ws:// scheme must raise ValueError."""
    with pytest.raises(ValueError, match="must use https"):
        validate_grid_url("ws://grid.noesis")


def test_validate_grid_url_rejects_missing_host() -> None:
    """https:// with no host must raise ValueError."""
    with pytest.raises(ValueError, match="must include a host"):
        validate_grid_url("https://")


# ── GridWireClient ────────────────────────────────────────────────────────────

def _make_token_manager(clock_fn=None) -> TokenManager:
    """Helper: create a TokenManager with a fresh Ed25519 keypair."""
    signing_key = SigningKey.generate()
    return TokenManager(
        existence_did="did:noesis:nous:test",
        civic_did="did:civic:noesis:test",
        signing_key=signing_key,
        clock=clock_fn,
    )


@pytest.mark.asyncio
async def test_post_actions_sends_bearer_and_json() -> None:
    """post_actions must POST to the correct URL, set Authorization header,
    and send {tick, actions} as JSON."""
    import httpx

    token_manager = _make_token_manager()
    client = GridWireClient(
        grid_url="https://test.grid",
        token_manager=token_manager,
        brain_did="did:noesis:nous:test",
    )

    # Capture the outgoing request via httpx.MockTransport.
    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(200, json={"ok": True, "accepted": 1})

    transport = httpx.MockTransport(handler)
    inner_client = httpx.AsyncClient(transport=transport, timeout=10.0)

    # Inject the mock client directly.
    client._client = inner_client

    actions = [{"action_type": "noop", "channel": "", "text": "", "metadata": {}}]
    # post_actions now returns None (Plan 38-03: queue-on-error wraps the response).
    # Verify via _do_post_actions for the raw response assertion.
    resp = await client._do_post_actions(actions, tick=42)

    assert resp.status_code == 200
    assert len(captured) == 1
    req = captured[0]

    # URL
    assert str(req.url) == "https://test.grid/api/v1/brain/actions"

    # Authorization header must be Bearer eyJ... (EdDSA JWT starts with "eyJ")
    auth = req.headers.get("authorization", "")
    assert auth.startswith("Bearer eyJ"), f"Expected Bearer JWT, got: {auth!r}"

    # Body
    body = json.loads(req.content)
    assert body["tick"] == 42
    assert body["actions"] == actions

    await client.aclose()


@pytest.mark.asyncio
async def test_post_actions_uses_rotated_token_after_23h() -> None:
    """Two post_actions calls separated by 23h must use different bearer tokens
    because TokenManager proactively rotates 1h before expiry (at 23h mark)."""
    import httpx
    import time

    # Mutable clock: start at epoch 0, advance to 23h later.
    clock_state = {"now": 0.0}

    def clock() -> float:
        return clock_state["now"]

    token_manager = _make_token_manager(clock_fn=clock)
    client = GridWireClient(
        grid_url="https://test.grid",
        token_manager=token_manager,
        brain_did="did:noesis:nous:test",
    )

    captured_tokens: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        auth = request.headers.get("authorization", "")
        token = auth.removeprefix("Bearer ")
        captured_tokens.append(token)
        return httpx.Response(200, json={"ok": True, "accepted": 1})

    transport = httpx.MockTransport(handler)
    client._client = httpx.AsyncClient(transport=transport, timeout=10.0)

    actions = [{"action_type": "noop", "channel": "", "text": "", "metadata": {}}]

    # First call — clock at t=0, creates the initial token.
    await client._do_post_actions(actions, tick=1)

    # Advance clock to 23h + 1s (past the rotation threshold: 24h - 1h = 23h).
    clock_state["now"] = 23 * 3600 + 1.0

    # Second call — TokenManager should rotate and issue a new token.
    await client._do_post_actions(actions, tick=2)

    assert len(captured_tokens) == 2
    # The second request must carry a DIFFERENT token (new JWT after rotation).
    assert captured_tokens[0] != captured_tokens[1], (
        "Expected token rotation after 23h but both requests used the same token"
    )

    await client.aclose()
