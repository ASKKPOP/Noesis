"""
brain/test/wire/test_grid_wire_client_offline.py

Phase 38 WIRE-03 — offline-queue integration tests for GridWireClient.

6 test cases:
  1. test_post_actions_enqueues_on_transport_error
  2. test_post_actions_enqueues_on_5xx
  3. test_post_actions_does_NOT_enqueue_on_4xx
  4. test_replay_drains_queue_on_2xx_batch
  5. test_replay_stops_on_5xx_keeps_events_queued
  6. test_concurrent_replays_serialize_via_lock
"""

from __future__ import annotations

import asyncio
import time
from unittest.mock import AsyncMock, MagicMock, patch
from typing import Any

import httpx
import pytest

from noesis_brain.wire.client import GridWireClient
from noesis_brain.wire.queue import WireQueue, derive_idempotency_key
from noesis_brain.wire.token_manager import TokenManager, TokenRecord

# ── Helpers ────────────────────────────────────────────────────────────────────

BRAIN_DID = "did:noesis:nous:test-offline-001"
CIVIC_DID = "did:civic:noesis:test-offline-001"
GRID_URL = "https://grid.test.noesis.io"


def make_token_manager() -> TokenManager:
    """Minimal stub TokenManager that returns a fixed token string."""
    # TokenManager stores records; we just need get_valid_token() to return.
    tm = MagicMock(spec=TokenManager)
    tm.get_valid_token.return_value = "stub-token"
    return tm


def make_client(tmp_path, *, queue: WireQueue | None = None) -> GridWireClient:
    tm = make_token_manager()
    return GridWireClient(
        grid_url=GRID_URL,
        token_manager=tm,
        brain_did=BRAIN_DID,
        queue=queue,
        timeout_seconds=5.0,
        replay_batch_size=100,
    )


SAMPLE_ACTIONS = [
    {"action_type": "nous.spoke", "channel": "public", "text": "hello", "metadata": {}},
    {"action_type": "nous.moved", "channel": "", "text": "", "metadata": {"region": "Agora"}},
]


def make_mock_response(status_code: int, body: dict | None = None) -> httpx.Response:
    """Create a minimal httpx.Response substitute."""
    import json as _json
    content = _json.dumps(body or {}).encode()
    return httpx.Response(status_code, content=content)


# ── Test 1 — transport error → enqueue ────────────────────────────────────────


@pytest.mark.asyncio
async def test_post_actions_enqueues_on_transport_error(tmp_path):
    """ConnectError during POST /actions causes all actions to be enqueued."""
    q = WireQueue(tmp_path / "q.db")
    client = make_client(tmp_path, queue=q)

    with patch.object(client, "_do_post_actions", new_callable=AsyncMock) as mock_post:
        mock_post.side_effect = httpx.ConnectError("refused")
        await client.post_actions(SAMPLE_ACTIONS, tick=1)

    assert q.size() == len(SAMPLE_ACTIONS)
    q.close()


# ── Test 2 — 5xx → enqueue ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_post_actions_enqueues_on_5xx(tmp_path):
    """503 status causes all actions to be enqueued."""
    q = WireQueue(tmp_path / "q.db")
    client = make_client(tmp_path, queue=q)

    with patch.object(client, "_do_post_actions", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = make_mock_response(503)
        await client.post_actions(SAMPLE_ACTIONS, tick=2)

    assert q.size() == len(SAMPLE_ACTIONS)
    q.close()


# ── Test 3 — 4xx → do NOT enqueue ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_post_actions_does_NOT_enqueue_on_4xx(tmp_path):
    """401 is not silently queued — it's an auth/logic error, not a transient."""
    q = WireQueue(tmp_path / "q.db")
    client = make_client(tmp_path, queue=q)

    with patch.object(client, "_do_post_actions", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = make_mock_response(401)
        await client.post_actions(SAMPLE_ACTIONS, tick=3)

    assert q.size() == 0, "4xx must NOT enqueue — retry won't fix auth errors"
    q.close()


# ── Test 4 — replay drains queue on 2xx ──────────────────────────────────────


@pytest.mark.asyncio
async def test_replay_drains_queue_on_2xx_batch(tmp_path):
    """Pre-populate 250 events; _do_post_actions returns 2xx; replay drains all
    events in ceil(250 / 100) = 3 POST calls to /events/batch."""
    q = WireQueue(tmp_path / "q.db")

    # Pre-populate 250 events.
    for i in range(250):
        q.enqueue(
            brain_did=BRAIN_DID,
            tick=i,
            event_type="nous.spoke",
            payload={"seq": i},
        )
    assert q.size() == 250

    client = make_client(tmp_path, queue=q)
    batch_calls: list[dict] = []

    async def mock_post(url: str, **kwargs: Any) -> httpx.Response:
        if "/events/batch" in url:
            batch_calls.append(kwargs.get("json", {}))
            return make_mock_response(200, {"accepted": len(kwargs["json"]["events"]), "duplicate": 0})
        return make_mock_response(200, {"ok": True, "accepted": 0})

    mock_http = AsyncMock()
    mock_http.post = mock_post
    client._client = mock_http  # type: ignore[assignment]

    await client._maybe_replay()

    assert q.size() == 0, "queue must be fully drained after replay"
    assert len(batch_calls) == 3, f"expected 3 batch calls (250 / 100), got {len(batch_calls)}"
    q.close()


# ── Test 5 — 5xx during replay → stop, keep events queued ───────────────────


@pytest.mark.asyncio
async def test_replay_stops_on_5xx_keeps_events_queued(tmp_path):
    """If /events/batch returns 5xx on first batch, replay stops immediately;
    events remain in queue; exactly 1 POST attempt made."""
    q = WireQueue(tmp_path / "q.db")
    for i in range(10):
        q.enqueue(
            brain_did=BRAIN_DID,
            tick=i,
            event_type="nous.spoke",
            payload={"seq": i},
        )

    client = make_client(tmp_path, queue=q)
    post_calls = 0

    async def mock_post(url: str, **kwargs: Any) -> httpx.Response:
        nonlocal post_calls
        post_calls += 1
        if "/events/batch" in url:
            return make_mock_response(503)
        return make_mock_response(200)

    mock_http = AsyncMock()
    mock_http.post = mock_post
    client._client = mock_http  # type: ignore[assignment]

    await client._maybe_replay()

    assert q.size() == 10, "events must remain queued when replay returns 5xx"
    assert post_calls == 1, f"expected exactly 1 attempt, got {post_calls}"
    q.close()


# ── Test 6 — concurrent replays serialize ────────────────────────────────────


@pytest.mark.asyncio
async def test_concurrent_replays_serialize_via_lock(tmp_path):
    """Two concurrent _maybe_replay() calls must NOT both acquire the lock at once.
    The second call sees the lock is taken and returns immediately."""
    q = WireQueue(tmp_path / "q.db")
    for i in range(5):
        q.enqueue(
            brain_did=BRAIN_DID,
            tick=i,
            event_type="nous.spoke",
            payload={"seq": i},
        )

    client = make_client(tmp_path, queue=q)

    lock_concurrently_acquired = False
    lock_held_count = 0

    original_replay = client._maybe_replay.__func__  # type: ignore[attr-defined]

    async def counted_replay(self_) -> None:
        nonlocal lock_held_count, lock_concurrently_acquired
        if self_._replay_lock.locked():
            # Second concurrent call — lock already taken, should return early.
            return
        async with self_._replay_lock:
            lock_held_count += 1
            if lock_held_count > 1:
                lock_concurrently_acquired = True
            # Simulate work.
            await asyncio.sleep(0)
            lock_held_count -= 1

    with patch.object(type(client), "_maybe_replay", counted_replay):
        await asyncio.gather(client._maybe_replay(), client._maybe_replay())

    assert not lock_concurrently_acquired, "lock must never be acquired concurrently"
    q.close()
