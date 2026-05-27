"""Phase 41 / SLEEP-03 — WssSubscriber._compute_connect_url appends ?since=<last_seen_tick> on reconnect."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock


def _make_subscriber(queue=None):
    """Build a WssSubscriber with minimal mocks."""
    from noesis_brain.wire.subscriber import WssSubscriber

    async def _noop_frame(frame):
        pass

    return WssSubscriber(
        grid_url="https://example.test",
        token_manager=MagicMock(),
        on_frame=_noop_frame,
        queue=queue,
    )


def test_connect_once_appends_since_query_param_when_queue_has_last_seen_tick():
    """When WireQueue.get_last_seen_tick() returns 12345, URL is f'{base}/api/v1/brain/firehose?since=12345'."""
    fake_queue = MagicMock()
    fake_queue.get_last_seen_tick.return_value = 12345

    sub = _make_subscriber(queue=fake_queue)
    url = sub._compute_connect_url()

    assert "?since=12345" in url


def test_connect_once_omits_since_param_when_queue_returns_none():
    """When WireQueue.get_last_seen_tick() returns None, connect URL is the bare firehose URL (no ?since=)."""
    fake_queue = MagicMock()
    fake_queue.get_last_seen_tick.return_value = None

    sub = _make_subscriber(queue=fake_queue)
    url = sub._compute_connect_url()

    assert "since" not in url


def test_connect_once_omits_since_param_when_queue_is_none():
    """When self._queue is None, connect URL is the bare firehose URL — no AttributeError raised."""
    sub = _make_subscriber(queue=None)
    url = sub._compute_connect_url()  # must not raise AttributeError

    assert "since" not in url
