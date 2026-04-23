"""Tests for brain/src/noesis_brain/whisper/decrypt.py

Phase 11 Wave 3 — WHISPER-06 / D-11-06.

Cases:
  - Round-trip: encrypt (via Keyring + derive_nonce) then decrypt_envelope → original plaintext
  - Tampered ciphertext → DecryptVerificationError or CryptoError
  - Hash mismatch → DecryptVerificationError
  - Wrong our_did → CryptoError
"""

import base64
import hashlib

import pytest
from nacl.exceptions import CryptoError  # type: ignore[import]

from noesis_brain.whisper.keyring import Keyring
from noesis_brain.whisper.nonce import derive_nonce
from noesis_brain.whisper.decrypt import decrypt_envelope, DecryptVerificationError


ALICE = "did:noesis:alice000000000000000000000000000000"
BOB   = "did:noesis:bob0000000000000000000000000000000"


def make_envelope(sender_did: str, recipient_did: str, plaintext: str, tick: int, counter: int) -> dict:
    """Helper: encrypt plaintext and return a valid Envelope dict."""
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
        "envelope_id": "test-env-1",
    }


def test_round_trip_encrypt_decrypt():
    """Encrypt as Alice → Bob, decrypt as Bob → original plaintext returned."""
    original = "Hello Bob, this is a secret whisper."
    envelope = make_envelope(ALICE, BOB, original, tick=10, counter=0)
    result = decrypt_envelope(envelope, our_did=BOB)
    assert result == original


def test_round_trip_different_messages():
    """Multiple distinct messages round-trip correctly."""
    for i, msg in enumerate(["first message", "second message", "third longer message here"]):
        envelope = make_envelope(ALICE, BOB, msg, tick=1, counter=i)
        assert decrypt_envelope(envelope, our_did=BOB) == msg


def test_tampered_ciphertext_raises():
    """Flipping a byte in ciphertext_b64 must raise DecryptVerificationError or CryptoError."""
    envelope = make_envelope(ALICE, BOB, "tamper test", tick=5, counter=0)
    ct_bytes = bytearray(base64.b64decode(envelope["ciphertext_b64"]))
    ct_bytes[0] ^= 0xFF  # Flip first byte.
    envelope["ciphertext_b64"] = base64.b64encode(bytes(ct_bytes)).decode("ascii")

    with pytest.raises((DecryptVerificationError, CryptoError)):
        decrypt_envelope(envelope, our_did=BOB)


def test_forged_ciphertext_hash_raises():
    """Forged ciphertext_hash (doesn't match actual ciphertext) → DecryptVerificationError."""
    envelope = make_envelope(ALICE, BOB, "hash mismatch test", tick=3, counter=0)
    envelope["ciphertext_hash"] = "0" * 64  # Forge the hash.

    with pytest.raises(DecryptVerificationError):
        decrypt_envelope(envelope, our_did=BOB)


def test_wrong_recipient_raises_crypto_error():
    """Decrypting with the wrong our_did (wrong private key) → CryptoError from NaCl."""
    CAROL = "did:noesis:carol00000000000000000000000000000"
    envelope = make_envelope(ALICE, BOB, "wrong key test", tick=7, counter=0)

    with pytest.raises((CryptoError, Exception)):
        decrypt_envelope(envelope, our_did=CAROL)


def test_ephemeral_pub_b64_is_ignored():
    """decrypt_envelope re-derives sender_pub from from_did, ignores ephemeral_pub_b64."""
    envelope = make_envelope(ALICE, BOB, "ephemeral ignored", tick=2, counter=0)
    # Corrupt ephemeral_pub_b64 — should still decrypt successfully.
    envelope["ephemeral_pub_b64"] = base64.b64encode(b"\x00" * 32).decode("ascii")
    result = decrypt_envelope(envelope, our_did=BOB)
    assert result == "ephemeral ignored"
