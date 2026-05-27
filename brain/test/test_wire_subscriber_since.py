"""Phase 41 / SLEEP-03 — WssSubscriber._connect_once appends ?since=<last_seen_tick> on reconnect.

Wave 0 stub. Implementation lands in Plan 05.
"""
import pytest


@pytest.mark.skip(reason="Wave 0 stub — implemented in Plan 05")
def test_connect_once_appends_since_query_param_when_queue_has_last_seen_tick():
    """When WireQueue.get_last_seen_tick() returns 12345, connect URL is f'{base}/api/v1/brain/firehose?since=12345'."""
    pass


@pytest.mark.skip(reason="Wave 0 stub — implemented in Plan 05")
def test_connect_once_omits_since_param_when_queue_returns_none():
    """When WireQueue.get_last_seen_tick() returns None, connect URL is the bare firehose URL (no ?since=)."""
    pass


@pytest.mark.skip(reason="Wave 0 stub — implemented in Plan 05")
def test_connect_once_omits_since_param_when_queue_is_none():
    """When self._queue is None, connect URL is the bare firehose URL — no AttributeError raised."""
    pass
