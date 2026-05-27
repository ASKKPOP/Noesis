"""Phase 41 / SLEEP-03 — GridWireClient.post_presence_heartbeat() contract.

Wave 0 stub. Implementation lands in Plan 05.
"""
import pytest


@pytest.mark.skip(reason="Wave 0 stub — implemented in Plan 05")
def test_post_presence_heartbeat_posts_bearer_jwt_to_civic_presence_endpoint():
    """POST /api/v1/civic/presence with Authorization: Bearer <token>; body = {}."""
    pass


@pytest.mark.skip(reason="Wave 0 stub — implemented in Plan 05")
def test_post_presence_heartbeat_writes_last_seen_tick_to_wire_queue_kv():
    """On 2xx response containing last_seen_tick, calls WireQueue.set_last_seen_tick(tick)."""
    pass


@pytest.mark.skip(reason="Wave 0 stub — implemented in Plan 05")
def test_post_presence_heartbeat_swallows_transport_errors():
    """httpx.RequestError logged at WARNING; does NOT raise — grace timer is the safety net."""
    pass


@pytest.mark.skip(reason="Wave 0 stub — implemented in Plan 05")
def test_post_presence_heartbeat_skips_kv_write_when_queue_is_none():
    """If client._queue is None, no SQLite write attempted; method still returns cleanly."""
    pass
