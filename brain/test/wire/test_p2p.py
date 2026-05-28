"""
brain/test/wire/test_p2p.py

Phase 42 P2P-01..05 — BrainP2PClient contract tests.
All skipped until Plan 05 implements brain/src/noesis_brain/wire/p2p.py.
"""

from __future__ import annotations

import pytest


# ── announce ──────────────────────────────────────────────────────────────────

@pytest.mark.skip(reason="Phase 42 Plan 05 — BrainP2PClient not yet implemented")
@pytest.mark.asyncio
async def test_announce_posts_empty_body_with_bearer_token() -> None:
    """announce() calls POST /api/v1/p2p/announce with json={} and Authorization: Bearer <token>."""
    # client = BrainP2PClient(wire_client=mock_wire_client)
    # await client.announce(tick=1)
    # mock_wire_client.post.assert_called_once_with('/api/v1/p2p/announce', json={})
    pass


@pytest.mark.skip(reason="Phase 42 Plan 05 — BrainP2PClient not yet implemented")
@pytest.mark.asyncio
async def test_announce_logs_warning_on_non_2xx_does_not_raise() -> None:
    """Non-200 response logs at WARNING level, does not raise (mirrors post_presence_heartbeat convention)."""
    # mock returns 503; assert logger.warning called, no exception raised
    pass


@pytest.mark.skip(reason="Phase 42 Plan 05 — BrainP2PClient not yet implemented")
@pytest.mark.asyncio
async def test_announce_logs_warning_on_network_error_does_not_raise() -> None:
    """httpx exception is caught and logged at WARNING; does not propagate."""
    # mock raises httpx.RequestError; assert no exception raised
    pass


# ── peer discovery ────────────────────────────────────────────────────────────

@pytest.mark.skip(reason="Phase 42 Plan 05 — BrainP2PClient not yet implemented")
@pytest.mark.asyncio
async def test_get_peer_status_returns_dict_with_status_field() -> None:
    """GET /api/v1/p2p/peers/<did> returns dict with status field 'online' or 'offline'."""
    # result = await client.get_peer_status('did:civic:noesis:bob')
    # assert result['status'] in ('online', 'offline')
    pass


@pytest.mark.skip(reason="Phase 42 Plan 05 — BrainP2PClient not yet implemented")
@pytest.mark.asyncio
async def test_get_peer_public_key_fetches_from_registry_route() -> None:
    """GET /api/v1/registry/civic-did/<did> parses credentialSubject.existencePublicKeyJwk."""
    # result = await client.get_peer_public_key('did:civic:noesis:bob')
    # assert result is not None
    # assert result['kty'] == 'OKP'
    pass


@pytest.mark.skip(reason="Phase 42 Plan 05 — BrainP2PClient not yet implemented")
@pytest.mark.asyncio
async def test_get_peer_public_key_returns_none_when_jwk_missing() -> None:
    """Graceful handling when VC credentialSubject has no existencePublicKeyJwk (Phase 37 rows)."""
    # registry returns VC without existencePublicKeyJwk
    # result = await client.get_peer_public_key('did:civic:noesis:legacy')
    # assert result is None
    pass


@pytest.mark.skip(reason="Phase 42 Plan 05 — BrainP2PClient not yet implemented")
@pytest.mark.asyncio
async def test_get_peer_public_key_caches_lazily_per_peer_did() -> None:
    """Second call to same peer DID does NOT hit Grid (lazy cache hit)."""
    # call twice; assert HTTP mock called only once
    pass


# ── connection lifecycle ──────────────────────────────────────────────────────

@pytest.mark.skip(reason="Phase 42 Plan 05 — BrainP2PClient not yet implemented")
@pytest.mark.asyncio
async def test_initiate_connection_full_flow() -> None:
    """fetch pubkey → generate offer SDP → encrypt with peer pubkey → POST /p2p/signal/:peerDid; returns (connection_id, pc)."""
    # connection_id, pc = await client.initiate_connection('did:civic:noesis:bob')
    # assert isinstance(connection_id, str)
    # assert pc is not None
    pass


@pytest.mark.skip(reason="Phase 42 Plan 05 — BrainP2PClient not yet implemented")
@pytest.mark.asyncio
async def test_handle_signal_received_fetches_inbox_and_decrypts() -> None:
    """WSS frame type 'p2p.signal_received' triggers GET /p2p/signal/inbox + decryption of blob."""
    # frame = {'type': 'p2p.signal_received'}
    # await client.handle_signal_received(frame)
    # mock_wire_client.get.assert_called_with('/api/v1/p2p/signal/inbox')
    pass


# ── TURN credentials ──────────────────────────────────────────────────────────

@pytest.mark.skip(reason="Phase 42 Plan 05 — BrainP2PClient not yet implemented")
@pytest.mark.asyncio
async def test_get_turn_credentials_returns_username_password_realm() -> None:
    """GET /api/v1/p2p/turn-credentials returns dict with username, password, ttl, realm."""
    # creds = await client.get_turn_credentials()
    # assert 'username' in creds
    # assert 'password' in creds
    # assert creds['realm'] == 'noesis.grid'
    pass


# ── announce task cadence ─────────────────────────────────────────────────────

@pytest.mark.skip(reason="Phase 42 Plan 05 — BrainP2PClient not yet implemented")
@pytest.mark.asyncio
async def test_announce_task_cadence_is_300_seconds() -> None:
    """Separate asyncio.Task for announce runs every 300s (NOT 60s — distinct from Phase 41 presence heartbeat)."""
    # assert client.ANNOUNCE_INTERVAL_SECONDS == 300
    # assert client.ANNOUNCE_INTERVAL_SECONDS != 60  # presence is 60s; p2p is 5min
    pass
