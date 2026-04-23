"""Tests for brain/src/noesis_brain/whisper/receiver.py

Phase 11 Wave 3 — WHISPER-06 / D-11-06.

Cases:
  - 3 envelopes pulled → 3 decrypts → 3 dispatches with channel='whisper' → ACK with all 3 ids
  - Failed decrypt is NOT acked; dispatcher NOT called; logger.warning called
  - Empty pending response → no dispatch, no ack
"""

import base64
import hashlib
from typing import AsyncIterator
from unittest.mock import AsyncMock, MagicMock

import pytest
from nacl.exceptions import CryptoError  # type: ignore[import]

from noesis_brain.whisper.keyring import Keyring
from noesis_brain.whisper.nonce import derive_nonce
from noesis_brain.whisper.receiver import receive_loop


ALICE = "did:noesis:alice000000000000000000000000000000"
BOB   = "did:noesis:bob0000000000000000000000000000000"


def make_valid_envelope(sender_did: str, recipient_did: str, plaintext: str, tick: int, counter: int, env_id: str) -> dict:
    """Helper: create a properly encrypted Envelope dict."""
    keyring = Keyring()
    recipient_pub = keyring.pub_for(recipient_did)
    sender_pub = keyring.pub_for(sender_did)
    sender_seed = hashlib.sha256(sender_did.encode("utf-8")).digest()
    nonce = derive_nonce(sender_seed, tick, counter)
    ct = keyring.encrypt_for(sender_did, recipient_pub, plaintext.encode("utf-8"), nonce)
    ct_hash = hashlib.sha256(ct).hexdigest()
    return {
        "version": 1,
        "from_did": sender_did,
        "to_did": recipient_did,
        "tick": tick,
        "nonce_b64": base64.b64encode(nonce).decode("ascii"),
        "ephemeral_pub_b64": base64.b64encode(sender_pub).decode("ascii"),
        "ciphertext_b64": base64.b64encode(ct).decode("ascii"),
        "ciphertext_hash": ct_hash,
        "envelope_id": env_id,
    }


def make_tampered_envelope(env_id: str) -> dict:
    """Create an envelope with a wrong ciphertext_hash to force DecryptVerificationError."""
    return {
        "version": 1,
        "from_did": ALICE,
        "to_did": BOB,
        "tick": 99,
        "nonce_b64": base64.b64encode(b"\x00" * 24).decode("ascii"),
        "ephemeral_pub_b64": "",
        "ciphertext_b64": base64.b64encode(b"\x00" * 32).decode("ascii"),
        "ciphertext_hash": "bad" + "0" * 61,  # Deliberately wrong hash.
        "envelope_id": env_id,
    }


class SingleTickSource:
    """Yields exactly one tick then stops."""
    def __init__(self, tick: int = 1):
        self.tick = tick

    async def ticks(self) -> AsyncIterator[int]:
        yield self.tick


def make_http_client(envelopes: list[dict]) -> AsyncMock:
    """Mock httpx client that returns envelopes on GET and 200 on POST."""
    pending_resp = MagicMock()
    pending_resp.raise_for_status = MagicMock()
    pending_resp.json.return_value = {"envelopes": envelopes}

    ack_resp = MagicMock()
    ack_resp.raise_for_status = MagicMock()
    ack_resp.json.return_value = {"deleted": len(envelopes)}

    client = AsyncMock()
    client.get = AsyncMock(return_value=pending_resp)
    client.post = AsyncMock(return_value=ack_resp)
    return client


@pytest.mark.asyncio
async def test_three_valid_envelopes_dispatched_and_acked():
    """3 valid envelopes → 3 dispatches with channel='whisper' → ACK with all 3 ids."""
    envelopes = [
        make_valid_envelope(ALICE, BOB, "message one", tick=1, counter=0, env_id="e1"),
        make_valid_envelope(ALICE, BOB, "message two", tick=1, counter=1, env_id="e2"),
        make_valid_envelope(ALICE, BOB, "message three", tick=1, counter=2, env_id="e3"),
    ]

    client = make_http_client(envelopes)
    dispatcher = MagicMock()
    logger = MagicMock()

    await receive_loop(
        nous_did=BOB,
        tick_source=SingleTickSource(tick=1),
        deliberation_dispatcher=dispatcher,
        http_client=client,
        logger=logger,
    )

    # All 3 dispatched with channel='whisper'.
    assert dispatcher.dispatch.call_count == 3
    for call in dispatcher.dispatch.call_args_list:
        assert call.kwargs["channel"] == "whisper"
        assert call.kwargs["from_did"] == ALICE

    # ACK POST was called with all 3 envelope_ids.
    assert client.post.call_count == 1
    ack_body = client.post.call_args.kwargs.get("json") or client.post.call_args.args[1]
    assert set(ack_body["envelope_ids"]) == {"e1", "e2", "e3"}


@pytest.mark.asyncio
async def test_failed_decrypt_not_acked_dispatcher_not_called():
    """Tampered envelope: NOT acked, dispatcher NOT called, logger.warning called."""
    envelopes = [make_tampered_envelope("bad-env-1")]

    client = make_http_client(envelopes)
    dispatcher = MagicMock()
    logger = MagicMock()

    await receive_loop(
        nous_did=BOB,
        tick_source=SingleTickSource(tick=1),
        deliberation_dispatcher=dispatcher,
        http_client=client,
        logger=logger,
    )

    assert dispatcher.dispatch.call_count == 0
    # ACK POST should NOT be called (no successful decrypts).
    assert client.post.call_count == 0
    # Warning logged.
    assert logger.warning.call_count == 1


@pytest.mark.asyncio
async def test_mixed_valid_and_tampered():
    """2 valid + 1 tampered: 2 dispatched, 2 acked, 1 warning, tampered not acked."""
    envelopes = [
        make_valid_envelope(ALICE, BOB, "good one", tick=1, counter=0, env_id="good1"),
        make_tampered_envelope("bad1"),
        make_valid_envelope(ALICE, BOB, "good two", tick=1, counter=1, env_id="good2"),
    ]

    client = make_http_client(envelopes)
    dispatcher = MagicMock()
    logger = MagicMock()

    await receive_loop(
        nous_did=BOB,
        tick_source=SingleTickSource(tick=1),
        deliberation_dispatcher=dispatcher,
        http_client=client,
        logger=logger,
    )

    assert dispatcher.dispatch.call_count == 2
    assert logger.warning.call_count == 1

    ack_body = client.post.call_args.kwargs.get("json") or client.post.call_args.args[1]
    assert set(ack_body["envelope_ids"]) == {"good1", "good2"}
    assert "bad1" not in ack_body["envelope_ids"]


@pytest.mark.asyncio
async def test_empty_pending_no_dispatch_no_ack():
    """Empty pending list → no dispatch, no ACK POST."""
    client = make_http_client([])
    dispatcher = MagicMock()
    logger = MagicMock()

    await receive_loop(
        nous_did=BOB,
        tick_source=SingleTickSource(tick=1),
        deliberation_dispatcher=dispatcher,
        http_client=client,
        logger=logger,
    )

    assert dispatcher.dispatch.call_count == 0
    assert client.post.call_count == 0


@pytest.mark.asyncio
async def test_dispatch_includes_plaintext_from_did_tick():
    """Dispatcher receives correct plaintext, from_did, and tick per envelope."""
    envelopes = [
        make_valid_envelope(ALICE, BOB, "hello world", tick=7, counter=0, env_id="env-x"),
    ]
    client = make_http_client(envelopes)
    dispatcher = MagicMock()
    logger = MagicMock()

    await receive_loop(
        nous_did=BOB,
        tick_source=SingleTickSource(tick=1),
        deliberation_dispatcher=dispatcher,
        http_client=client,
        logger=logger,
    )

    call = dispatcher.dispatch.call_args
    assert call.kwargs["plaintext"] == "hello world"
    assert call.kwargs["from_did"] == ALICE
    assert call.kwargs["tick"] == 7
    assert call.kwargs["channel"] == "whisper"
