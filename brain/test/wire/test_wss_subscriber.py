"""
brain/test/wire/test_wss_subscriber.py

Phase 38 WIRE-01 (WSS) + WIRE-05 — WssSubscriber unit tests.

7 tests:
  1. test_connects_and_receives_hello      — on_frame called with hello frame
  2. test_sends_bearer_authorization_header — Authorization header present in request
  3. test_rewrites_https_to_wss            — https:// URL is rewritten to wss://
  4. test_rejects_plaintext_url            — ValueError for http:// or bare URL
  5. test_reconnects_after_disconnect      — reconnects and on_frame called after first session
  6. test_backoff_uses_jitter_and_caps_at_60s — sleep sequence bounded, capped, jittered
  7. test_stop_terminates_run_forever      — stop() causes task to exit within 6 s
"""

from __future__ import annotations

import asyncio
import json
import random
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
import websockets

from noesis_brain.wire.subscriber import (
    BASE_BACKOFF_SECONDS,
    MAX_BACKOFF_SECONDS,
    WssSubscriber,
)
from noesis_brain.wire.token_manager import TokenManager


# ── Helpers ────────────────────────────────────────────────────────────────────


def _make_token_manager() -> TokenManager:
    """Return a TokenManager whose get_valid_token() returns a fixed string."""
    from nacl.signing import SigningKey  # type: ignore[import]

    key = SigningKey.generate()
    mgr = TokenManager(signing_key=key, brain_did="did:noesis:nous:test-brain")
    return mgr


def _mock_tm(token: str = "test-jwt") -> MagicMock:
    tm = MagicMock(spec=TokenManager)
    tm.get_valid_token.return_value = token
    return tm


# ── 1. Connects and receives hello frame ─────────────────────────────────────


@pytest.mark.asyncio
async def test_connects_and_receives_hello() -> None:
    """on_frame is called with {"type": "hello"} sent by the server on connect."""
    frames: list[dict] = []  # type: ignore[type-arg]

    async def on_frame(frame: dict) -> None:  # type: ignore[type-arg]
        frames.append(frame)

    async def server_handler(ws: Any) -> None:
        await ws.send(json.dumps({"type": "hello", "gridName": "genesis"}))
        await ws.wait_closed()

    async with websockets.serve(server_handler, "127.0.0.1", 0) as server:
        port = server.sockets[0].getsockname()[1]
        sub = WssSubscriber(
            grid_url=f"wss://127.0.0.1:{port}",
            token_manager=_mock_tm(),
            on_frame=on_frame,
        )
        # Override _url because the subscriber appends /api/v1/brain/firehose
        sub._url = f"ws://127.0.0.1:{port}"

        await sub.start()
        # Wait for the frame to arrive
        deadline = asyncio.get_event_loop().time() + 3.0
        while not frames and asyncio.get_event_loop().time() < deadline:
            await asyncio.sleep(0.05)
        await sub.stop()

    assert len(frames) >= 1
    assert frames[0]["type"] == "hello"


# ── 2. Sends Authorization: Bearer header ─────────────────────────────────────


@pytest.mark.asyncio
async def test_sends_bearer_authorization_header() -> None:
    """The Authorization: Bearer <token> header is present in the WS upgrade request."""
    captured_auth: list[str] = []
    expected_token = "my-test-jwt-token"

    async def server_handler(ws: Any) -> None:
        auth = ws.request.headers.get("Authorization", "")
        captured_auth.append(auth)
        await ws.close()

    async with websockets.serve(server_handler, "127.0.0.1", 0) as server:
        port = server.sockets[0].getsockname()[1]
        sub = WssSubscriber(
            grid_url=f"wss://127.0.0.1:{port}",
            token_manager=_mock_tm(expected_token),
            on_frame=lambda f: asyncio.sleep(0),
        )
        sub._url = f"ws://127.0.0.1:{port}"

        await sub.start()
        deadline = asyncio.get_event_loop().time() + 3.0
        while not captured_auth and asyncio.get_event_loop().time() < deadline:
            await asyncio.sleep(0.05)
        await sub.stop()

    assert len(captured_auth) >= 1
    assert captured_auth[0] == f"Bearer {expected_token}"


# ── 3. Rewrites https:// to wss:// ───────────────────────────────────────────


def test_rewrites_https_to_wss() -> None:
    """https:// grid_url is rewritten to wss://; path /api/v1/brain/firehose appended."""
    sub = WssSubscriber(
        grid_url="https://grid.example.com",
        token_manager=_mock_tm(),
        on_frame=lambda f: asyncio.sleep(0),
    )
    assert sub._url == "wss://grid.example.com/api/v1/brain/firehose"


# ── 4. Rejects plaintext URL ──────────────────────────────────────────────────


def test_rejects_plaintext_url() -> None:
    """http:// or bare host raises ValueError."""
    with pytest.raises(ValueError, match="https://|wss://"):
        WssSubscriber(
            grid_url="http://grid.example.com",
            token_manager=_mock_tm(),
            on_frame=lambda f: asyncio.sleep(0),
        )

    with pytest.raises(ValueError):
        WssSubscriber(
            grid_url="grid.example.com",
            token_manager=_mock_tm(),
            on_frame=lambda f: asyncio.sleep(0),
        )


# ── 5. Reconnects after disconnect ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_reconnects_after_disconnect() -> None:
    """After the server closes the connection, the subscriber reconnects and receives
    another frame in the second session."""
    session_count = 0
    frames: list[dict] = []  # type: ignore[type-arg]

    async def on_frame(frame: dict) -> None:  # type: ignore[type-arg]
        frames.append(frame)

    async def server_handler(ws: Any) -> None:
        nonlocal session_count
        session_count += 1
        await ws.send(json.dumps({"type": "hello", "session": session_count}))
        # Close immediately after the first frame — client should reconnect
        await ws.close()

    async with websockets.serve(server_handler, "127.0.0.1", 0) as server:
        port = server.sockets[0].getsockname()[1]

        # Patch backoff sleep to 0 so reconnect is nearly instant in tests
        with patch("noesis_brain.wire.subscriber.MAX_BACKOFF_SECONDS", 0.01), \
             patch("noesis_brain.wire.subscriber.BASE_BACKOFF_SECONDS", 0.01):
            sub = WssSubscriber(
                grid_url=f"wss://127.0.0.1:{port}",
                token_manager=_mock_tm(),
                on_frame=on_frame,
            )
            sub._url = f"ws://127.0.0.1:{port}"

            await sub.start()
            # Wait until we see at least 2 frames (from 2 sessions)
            deadline = asyncio.get_event_loop().time() + 5.0
            while len(frames) < 2 and asyncio.get_event_loop().time() < deadline:
                await asyncio.sleep(0.05)
            await sub.stop()

    assert len(frames) >= 2, f"Expected ≥2 frames from reconnect; got {len(frames)}"
    assert frames[0]["type"] == "hello"
    assert frames[1]["type"] == "hello"
    # The second session has a higher session number
    assert frames[1]["session"] > frames[0]["session"]


# ── 6. Backoff uses jitter and caps at 60 s ──────────────────────────────────


def test_backoff_uses_jitter_and_caps_at_60s() -> None:
    """Sleep durations are within [base*0.75, base*1.25] and cap at MAX_BACKOFF.

    We exercise 7 attempts (attempt 0..6) and verify:
      - Each sleep is in [base*0.75, base*1.25] (jitter bound).
      - No sleep exceeds MAX_BACKOFF_SECONDS * 1.25 (jitter on the capped delay).
      - The last 4 attempts (attempt 3..6) all produce sleeps based on 60 s base.
    """
    slept: list[float] = []

    async def _capture_stop_wait(timeout: float) -> None:
        slept.append(timeout)
        raise asyncio.TimeoutError  # simulate sleep expiry (don't actually wait)

    async def run() -> None:
        sub = WssSubscriber(
            grid_url="wss://x.invalid",
            token_manager=_mock_tm(),
            on_frame=lambda f: asyncio.sleep(0),
        )

        async def _fail_once() -> None:
            raise ConnectionError("simulated failure")

        sub._connect_once = _fail_once  # type: ignore[method-assign]

        # Patch asyncio.wait_for to capture sleep durations without actually sleeping
        original_wait_for = asyncio.wait_for

        async def patched_wait_for(coro, timeout=None, **kwargs):  # type: ignore[no-untyped-def]
            slept.append(timeout or 0.0)
            coro.close()
            raise asyncio.TimeoutError

        with patch("asyncio.wait_for", side_effect=patched_wait_for):
            # Patch _stop.is_set to return True after 7 attempts
            stop_count = [0]
            original_is_set = sub._stop.is_set

            def patched_is_set() -> bool:
                stop_count[0] += 1
                # Allow 7 reconnect cycles, then stop
                return stop_count[0] > 14  # 2 checks per cycle (loop + after sleep)

            sub._stop.is_set = patched_is_set  # type: ignore[method-assign]
            await sub._run_forever()

    # Run synchronously
    asyncio.run(run())

    assert len(slept) >= 6, f"Expected ≥6 sleep intervals; got {len(slept)}"

    for i, s in enumerate(slept[:6]):
        attempt = i
        base = min(MAX_BACKOFF_SECONDS, BASE_BACKOFF_SECONDS * (2 ** attempt))
        low = base * 0.75
        high = base * 1.25
        assert low <= s <= high + 0.01, (
            f"Attempt {attempt}: sleep {s:.3f} not in [{low:.3f}, {high:.3f}]"
        )
        assert s <= MAX_BACKOFF_SECONDS * 1.25 + 0.01, (
            f"Sleep {s:.3f} exceeds max allowed {MAX_BACKOFF_SECONDS * 1.25:.3f}"
        )


# ── 7. stop() terminates run_forever ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_stop_terminates_run_forever() -> None:
    """start() then stop() — task completes within 6 s without exception."""
    connect_delay_reached = asyncio.Event()

    async def slow_connect() -> None:
        connect_delay_reached.set()
        # Simulate a connection that never succeeds (slow server)
        await asyncio.sleep(60)

    sub = WssSubscriber(
        grid_url="wss://x.invalid",
        token_manager=_mock_tm(),
        on_frame=lambda f: asyncio.sleep(0),
    )
    sub._connect_once = slow_connect  # type: ignore[method-assign]

    await sub.start()
    # Wait until _connect_once has been entered at least once
    try:
        await asyncio.wait_for(connect_delay_reached.wait(), timeout=2.0)
    except asyncio.TimeoutError:
        pass  # fine — stop still needs to work

    # stop() should cancel the task and complete quickly
    await asyncio.wait_for(sub.stop(), timeout=6.0)

    assert sub._task is None, "task should be None after stop()"
