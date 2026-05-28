"""
brain/test/wire/test_p2p.py

Phase 42 P2P-01..05 — BrainP2PClient contract tests.
All tests implemented in Plan 05.
"""

from __future__ import annotations

import base64
import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from nacl.signing import SigningKey

from noesis_brain.wire.p2p import BrainP2PClient, encrypt_sdp_for_peer, decrypt_sdp_from_peer


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_signing_key() -> SigningKey:
    """Generate a fresh Ed25519 signing key for tests."""
    return SigningKey.generate()


def _signing_key_to_jwk(sk: SigningKey) -> dict:  # type: ignore[type-arg]
    """Convert a signing key's verify key to Ed25519 JWK format."""
    raw = bytes(sk.verify_key)
    x_b64 = base64.urlsafe_b64encode(raw).rstrip(b"=").decode()
    return {"kty": "OKP", "crv": "Ed25519", "x": x_b64}


def _make_client(responses: list[dict[str, Any]]) -> httpx.AsyncClient:
    """Build a mock httpx.AsyncClient that returns given responses in order.

    Each dict in `responses` has:
      - status_code: int (default 200)
      - json: dict (response body)
    """
    mock = MagicMock(spec=httpx.AsyncClient)
    response_objects = []
    for r in responses:
        resp = MagicMock(spec=httpx.Response)
        resp.status_code = r.get("status_code", 200)
        resp.json.return_value = r.get("json", {})
        response_objects.append(resp)

    # Use side_effect to cycle through responses
    call_iter = iter(response_objects)

    async def _post(*args: Any, **kwargs: Any) -> httpx.Response:
        return next(call_iter)

    async def _get(*args: Any, **kwargs: Any) -> httpx.Response:
        return next(call_iter)

    mock.post = AsyncMock(side_effect=_post)
    mock.get = AsyncMock(side_effect=_get)
    return mock  # type: ignore[return-value]


def _make_token_manager() -> MagicMock:
    tm = MagicMock()
    tm.get_valid_token.return_value = "test-bearer-token"
    return tm


def _make_p2p_client(
    http_responses: list[dict[str, Any]],
    signing_key: SigningKey | None = None,
) -> BrainP2PClient:
    if signing_key is None:
        signing_key = _make_signing_key()
    return BrainP2PClient(
        grid_url="https://grid.noesis.test",
        token_manager=_make_token_manager(),
        civic_did="did:civic:noesis:test001",
        signing_key=signing_key,
        client=_make_client(http_responses),
    )


# ── announce ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_announce_posts_empty_body_with_bearer_token() -> None:
    """announce() calls POST /api/v1/p2p/announce with json={} and Authorization: Bearer <token>."""
    client = _make_p2p_client([{"status_code": 200, "json": {"status": "announced"}}])
    await client.announce(tick=1)
    client._client.post.assert_called_once()  # type: ignore[attr-defined]
    call_kwargs = client._client.post.call_args  # type: ignore[attr-defined]
    assert "/p2p/announce" in call_kwargs[0][0]
    assert call_kwargs[1]["json"] == {}
    assert "Bearer test-bearer-token" in call_kwargs[1]["headers"]["Authorization"]


@pytest.mark.asyncio
async def test_announce_logs_warning_on_non_2xx_does_not_raise() -> None:
    """Non-200 response logs at WARNING level, does not raise."""
    client = _make_p2p_client([{"status_code": 503, "json": {}}])
    # Should NOT raise
    await client.announce(tick=2)


@pytest.mark.asyncio
async def test_announce_logs_warning_on_network_error_does_not_raise() -> None:
    """httpx exception is caught and logged at WARNING; does not propagate."""
    client = _make_p2p_client([])
    # Override post to raise an error
    client._client.post = AsyncMock(side_effect=httpx.RequestError("network down"))  # type: ignore[attr-defined]
    # Should NOT raise
    await client.announce(tick=3)


# ── peer discovery ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_peer_status_returns_dict_with_status_field() -> None:
    """GET /api/v1/p2p/peers/<did> returns dict with status field 'online' or 'offline'."""
    client = _make_p2p_client([
        {"status_code": 200, "json": {"status": "online", "last_seen_at": "2026-05-28T00:00:00.000Z"}},
    ])
    result = await client.get_peer_status("did:civic:noesis:bob")
    assert result["status"] in ("online", "offline")
    assert result["status"] == "online"


@pytest.mark.asyncio
async def test_get_peer_public_key_fetches_from_registry_route() -> None:
    """GET /api/v1/registry/civic-did/<did> parses credentialSubject.existencePublicKeyJwk."""
    sk = _make_signing_key()
    jwk = _signing_key_to_jwk(sk)
    vc = {"credentialSubject": {"existencePublicKeyJwk": jwk}}
    client = _make_p2p_client([{"status_code": 200, "json": vc}])
    result = await client.get_peer_public_key("did:civic:noesis:bob")
    assert result is not None
    assert result["kty"] == "OKP"
    assert result["crv"] == "Ed25519"


@pytest.mark.asyncio
async def test_get_peer_public_key_returns_none_when_jwk_missing() -> None:
    """Graceful handling when VC credentialSubject has no existencePublicKeyJwk (Phase 37 rows)."""
    vc = {"credentialSubject": {"id": "did:civic:noesis:legacy"}}
    client = _make_p2p_client([{"status_code": 200, "json": vc}])
    result = await client.get_peer_public_key("did:civic:noesis:legacy")
    assert result is None


@pytest.mark.asyncio
async def test_get_peer_public_key_caches_lazily_per_peer_did() -> None:
    """Second call to same peer DID does NOT hit Grid (lazy cache hit)."""
    sk = _make_signing_key()
    jwk = _signing_key_to_jwk(sk)
    vc = {"credentialSubject": {"existencePublicKeyJwk": jwk}}
    client = _make_p2p_client([{"status_code": 200, "json": vc}])
    # First call — hits Grid
    r1 = await client.get_peer_public_key("did:civic:noesis:bob")
    # Second call — should use cache, NOT hit Grid
    r2 = await client.get_peer_public_key("did:civic:noesis:bob")
    assert r1 == r2
    # GET should have been called exactly once (cache hit on second call)
    assert client._client.get.call_count == 1  # type: ignore[attr-defined]


# ── connection lifecycle ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_handle_signal_received_fetches_inbox_and_decrypts() -> None:
    """WSS frame type 'p2p.signal_received' triggers GET /p2p/signal/inbox + decryption of blob."""
    sk = _make_signing_key()
    # Build a valid encrypted blob
    jwk = _signing_key_to_jwk(sk)
    sdp_str = "v=0\r\no=- 1234 0 IN IP4 127.0.0.1\r\n"
    ciphertext = encrypt_sdp_for_peer(sdp_str, jwk)
    blob_b64 = base64.b64encode(ciphertext).decode()

    inbox_response = {
        "signals": [
            {
                "connectionId": "conn-123",
                "fromDid": "did:civic:noesis:alice",
                "encryptedBlob": blob_b64,
            }
        ]
    }
    # For incoming offer: handle_signal_received → GET inbox → _process_remote_sdp
    # _process_remote_sdp tries to create a pc (aiortc) — we patch it to avoid real ICE
    client = BrainP2PClient(
        grid_url="https://grid.noesis.test",
        token_manager=_make_token_manager(),
        civic_did="did:civic:noesis:test001",
        signing_key=sk,
        client=_make_client([{"status_code": 200, "json": inbox_response}]),
    )
    # Patch _process_remote_sdp to avoid aiortc ICE negotiation in tests
    client._process_remote_sdp = AsyncMock()  # type: ignore[method-assign]
    frame = {"type": "p2p.signal_received"}
    await client.handle_signal_received(frame)
    # Inbox was fetched
    client._client.get.assert_called_once()  # type: ignore[attr-defined]
    # _process_remote_sdp was called with decrypted SDP
    client._process_remote_sdp.assert_called_once()  # type: ignore[attr-defined]
    call_args = client._process_remote_sdp.call_args[0]
    assert call_args[0] == "conn-123"
    assert call_args[1] == "did:civic:noesis:alice"
    assert call_args[2] == sdp_str


# ── TURN credentials ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_turn_credentials_returns_username_password_realm() -> None:
    """GET /api/v1/p2p/turn-credentials returns dict with username, password, ttl, realm."""
    creds = {
        "username": "1717200000:did:civic:noesis:test001",
        "password": "base64hmac",
        "ttl": 3600,
        "realm": "noesis.grid",
        "uris": ["turn:grid.noesis:3478", "stun:grid.noesis:3478"],
    }
    client = _make_p2p_client([{"status_code": 200, "json": creds}])
    result = await client.get_turn_credentials()
    assert result is not None
    assert "username" in result
    assert "password" in result
    assert result["realm"] == "noesis.grid"


# ── announce task cadence ─────────────────────────────────────────────────────

def test_announce_task_cadence_is_300_seconds() -> None:
    """Separate asyncio.Task for announce runs every 300s (NOT 60s — distinct from Phase 41 presence heartbeat)."""
    from noesis_brain.wire.p2p import ANNOUNCE_INTERVAL_SECONDS
    assert ANNOUNCE_INTERVAL_SECONDS == 300
    assert ANNOUNCE_INTERVAL_SECONDS != 60  # presence is 60s; p2p is 5min
    # Also verify class attribute
    assert BrainP2PClient.ANNOUNCE_INTERVAL_SECONDS == 300
