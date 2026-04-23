"""Tests for brain/src/noesis_brain/whisper/sender.py

Phase 11 Wave 3 — WHISPER-01 / D-11-06 / D-11-19 / T-10-06.

Cases:
  - Happy path: POST body contains ciphertext_blob_b64 (not plaintext)
  - Trade keyword rejection: raises TradeKeywordRejected BEFORE httpx is called
  - Deterministic nonce: same (sender, recipient, tick, counter, plaintext) → same ciphertext
"""

import base64
import pytest
from unittest.mock import AsyncMock, MagicMock

from noesis_brain.whisper.sender import send_whisper
from noesis_brain.whisper.trade_guard import TradeKeywordRejected


ALICE = "did:noesis:alice000000000000000000000000000000"
BOB   = "did:noesis:bob0000000000000000000000000000000"
PLAINTEXT = "Hello, this is a test whisper message."


def make_mock_client(status_code: int = 202, json_body: dict | None = None) -> AsyncMock:
    """Create a mock httpx.AsyncClient that returns a fixed response."""
    if json_body is None:
        json_body = {
            "envelope_id": "mock-envelope-id-1234",
            "ciphertext_hash": "a" * 64,
        }
    mock_resp = MagicMock()
    mock_resp.status_code = status_code
    mock_resp.json.return_value = json_body
    mock_resp.raise_for_status = MagicMock()

    client = AsyncMock()
    client.post = AsyncMock(return_value=mock_resp)
    return client


@pytest.mark.asyncio
async def test_happy_path_returns_grid_response():
    """send_whisper should call Grid and return the envelope_id + ciphertext_hash."""
    client = make_mock_client()
    result = await send_whisper(
        sender_did=ALICE,
        recipient_did=BOB,
        plaintext=PLAINTEXT,
        tick=42,
        counter=0,
        http_client=client,
    )
    assert result["envelope_id"] == "mock-envelope-id-1234"
    assert result["ciphertext_hash"] == "a" * 64


@pytest.mark.asyncio
async def test_post_body_does_not_contain_plaintext():
    """The POST body must contain ciphertext_blob_b64, never the original plaintext."""
    client = make_mock_client()
    await send_whisper(
        sender_did=ALICE,
        recipient_did=BOB,
        plaintext=PLAINTEXT,
        tick=42,
        counter=0,
        http_client=client,
    )

    # Inspect what was sent to Grid.
    assert client.post.call_count == 1
    call_kwargs = client.post.call_args
    sent_body = call_kwargs.kwargs.get("json") or call_kwargs.args[1] if len(call_kwargs.args) > 1 else call_kwargs.kwargs["json"]

    # ciphertext_blob_b64 must be present.
    assert "ciphertext_blob_b64" in sent_body

    # Decode the ciphertext and confirm it does NOT equal the plaintext bytes.
    ct_bytes = base64.b64decode(sent_body["ciphertext_blob_b64"])
    assert ct_bytes != PLAINTEXT.encode("utf-8"), "ciphertext must not equal plaintext"

    # The plaintext string must NOT appear anywhere in the POST body JSON.
    import json
    body_str = json.dumps(sent_body)
    assert PLAINTEXT not in body_str, "plaintext must never appear in POST body"


@pytest.mark.asyncio
async def test_trade_keyword_raises_before_http():
    """TradeKeywordRejected must be raised BEFORE any HTTP call (T-10-06)."""
    client = make_mock_client()
    with pytest.raises(TradeKeywordRejected):
        await send_whisper(
            sender_did=ALICE,
            recipient_did=BOB,
            plaintext="I want to buy some ousia today",
            tick=10,
            counter=0,
            http_client=client,
        )
    assert client.post.call_count == 0, "httpx must not be called when trade keyword present"


@pytest.mark.asyncio
@pytest.mark.parametrize("keyword", ["buy", "sell", "trade", "offer", "bid", "ask", "price", "amount", "ousia"])
async def test_each_trade_keyword_blocks_send(keyword: str):
    """Each keyword in TRADE_KEYWORDS_RE must block send_whisper."""
    client = make_mock_client()
    with pytest.raises(TradeKeywordRejected):
        await send_whisper(
            sender_did=ALICE,
            recipient_did=BOB,
            plaintext=f"please {keyword} now",
            tick=1,
            counter=0,
            http_client=client,
        )
    assert client.post.call_count == 0


@pytest.mark.asyncio
async def test_deterministic_ciphertext_same_inputs():
    """Same (sender, recipient, plaintext, tick, counter) → same ciphertext_blob_b64."""
    captured: list[str] = []

    async def capture_call(*args, **kwargs):
        body = kwargs.get("json", {})
        captured.append(body.get("ciphertext_blob_b64", ""))
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {"envelope_id": "x", "ciphertext_hash": "y"}
        return mock_resp

    for _ in range(2):
        client = AsyncMock()
        client.post = AsyncMock(side_effect=capture_call)
        await send_whisper(
            sender_did=ALICE,
            recipient_did=BOB,
            plaintext="Hello determinism",
            tick=5,
            counter=3,
            http_client=client,
        )

    assert len(captured) == 2
    assert captured[0] == captured[1], "same inputs must produce same ciphertext"


@pytest.mark.asyncio
async def test_different_counters_produce_different_ciphertexts():
    """Different counter values → different nonces → different ciphertexts."""
    captured: list[str] = []

    for counter in [0, 1]:
        async def capture_call(*args, **kwargs):
            body = kwargs.get("json", {})
            captured.append(body.get("ciphertext_blob_b64", ""))
            mock_resp = MagicMock()
            mock_resp.raise_for_status = MagicMock()
            mock_resp.json.return_value = {"envelope_id": "x", "ciphertext_hash": "y"}
            return mock_resp

        client = AsyncMock()
        client.post = AsyncMock(side_effect=capture_call)
        await send_whisper(
            sender_did=ALICE,
            recipient_did=BOB,
            plaintext="Same message",
            tick=5,
            counter=counter,
            http_client=client,
        )

    assert captured[0] != captured[1], "different counters must produce different ciphertexts"
