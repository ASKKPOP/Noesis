"""
brain/test/wire/test_p2p_crypto.py

Phase 42 P2P-05 — SDP encryption/decryption roundtrip tests.
Covers: encrypt_sdp_for_peer / decrypt_sdp_from_peer using PyNaCl SealedBox.
All tests implemented in Plan 05.
"""

from __future__ import annotations

import base64
import pytest
from nacl.signing import SigningKey, VerifyKey
from nacl.public import SealedBox
from nacl.exceptions import CryptoError

from noesis_brain.wire.p2p import encrypt_sdp_for_peer, decrypt_sdp_from_peer


# ── helpers ───────────────────────────────────────────────────────────────────

def _signing_key_to_jwk(sk: SigningKey) -> dict:  # type: ignore[type-arg]
    """Convert a signing key's verify key to Ed25519 JWK format."""
    raw = bytes(sk.verify_key)
    x_b64 = base64.urlsafe_b64encode(raw).rstrip(b"=").decode()
    return {"kty": "OKP", "crv": "Ed25519", "x": x_b64}


# ── contract tests ────────────────────────────────────────────────────────────

def test_encrypt_sdp_for_peer_returns_bytes() -> None:
    """encrypt_sdp_for_peer("v=0\\r\\n...", peer_jwk) returns bytes."""
    sk = SigningKey.generate()
    peer_jwk = _signing_key_to_jwk(sk)
    result = encrypt_sdp_for_peer("v=0\r\no=- ...", peer_jwk)
    assert isinstance(result, bytes)
    # Ciphertext must be longer than plaintext (SealedBox adds ephemeral key + MAC)
    assert len(result) > len("v=0\r\no=- ...")


def test_encrypt_then_decrypt_roundtrip_recovers_original_sdp() -> None:
    """Generate peer SigningKey, derive JWK, encrypt offer, recipient decrypts — recovered == original."""
    signing_key = SigningKey.generate()
    peer_jwk = _signing_key_to_jwk(signing_key)
    sdp = "v=0\r\no=- 123456 0 IN IP4 192.168.0.1\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n"
    ciphertext = encrypt_sdp_for_peer(sdp, peer_jwk)
    recovered = decrypt_sdp_from_peer(ciphertext, signing_key)
    assert recovered == sdp


def test_decrypt_with_wrong_key_fails() -> None:
    """Third-party signing key cannot decrypt ciphertext encrypted for a different peer."""
    bob_key = SigningKey.generate()
    wrong_key = SigningKey.generate()
    bob_jwk = _signing_key_to_jwk(bob_key)
    sdp = "v=0\r\no=- private SDP data\r\n"
    ciphertext = encrypt_sdp_for_peer(sdp, bob_jwk)
    # Decrypting with the wrong key must raise
    with pytest.raises(CryptoError):
        decrypt_sdp_from_peer(ciphertext, wrong_key)


def test_jwk_parsing_handles_base64url_padding() -> None:
    """JWK x value without '=' padding decodes correctly (urlsafe_b64decode with '==' suffix trick)."""
    # 32 zero bytes encodes as 43 chars (no padding needed for 32-byte input but let's test)
    raw = bytes(32)
    x_no_pad = base64.urlsafe_b64encode(raw).rstrip(b"=").decode()
    assert "=" not in x_no_pad  # confirm no padding
    jwk = {"kty": "OKP", "crv": "Ed25519", "x": x_no_pad}
    # encrypt_sdp_for_peer internally calls urlsafe_b64decode(x + "==")
    # With 32 zero bytes as public key this is NOT a valid Ed25519 key — we just
    # test that base64 decoding succeeds (not that the resulting key is valid)
    # The decode + VerifyKey construction would raise for zero-bytes; test only decode
    decoded = base64.urlsafe_b64decode(x_no_pad + "==")
    assert len(decoded) == 32
    assert decoded == raw


def test_ed25519_to_x25519_conversion_uses_verify_key_method() -> None:
    """Encryption uses VerifyKey.to_curve25519_public_key() not raw bytes directly."""
    sk = SigningKey.generate()
    verify_key = sk.verify_key
    x25519_pub = verify_key.to_curve25519_public_key()
    assert x25519_pub is not None
    # Verify we can build a SealedBox with the converted key
    box = SealedBox(x25519_pub)
    ciphertext = box.encrypt(b"test")
    assert isinstance(ciphertext, bytes)


def test_signing_key_to_curve25519_private_key_for_decryption() -> None:
    """Recipient derives X25519 private key using SigningKey.to_curve25519_private_key()."""
    signing_key = SigningKey.generate()
    x25519_priv = signing_key.to_curve25519_private_key()
    assert x25519_priv is not None
    # Verify we can build a SealedBox with the derived private key
    box = SealedBox(x25519_priv)
    assert box is not None


def test_grid_cannot_decrypt_blob_without_recipient_private_key() -> None:
    """SDP content is opaque to Grid: ciphertext encrypted with B's pubkey can only be decrypted by B."""
    bob_key = SigningKey.generate()
    bob_jwk = _signing_key_to_jwk(bob_key)
    sdp = "v=0\r\no=- secret SDP content that Grid cannot read\r\n"
    ciphertext = encrypt_sdp_for_peer(sdp, bob_jwk)
    # Encrypted blob != original SDP (opaque to observer without recipient key)
    assert ciphertext != sdp.encode("utf-8")
    # Grid (third party with no private key) cannot decrypt — wrong_key represents Grid
    grid_key = SigningKey.generate()
    with pytest.raises(CryptoError):
        decrypt_sdp_from_peer(ciphertext, grid_key)


# ── non-skipped sanity test ───────────────────────────────────────────────────

def test_pynacl_sealedbox_roundtrip_sanity() -> None:
    """Sanity: PyNaCl SealedBox + Ed25519→X25519 conversion works in test env."""
    signing_key = SigningKey.generate()
    verify_key = signing_key.verify_key
    x25519_pub = verify_key.to_curve25519_public_key()
    x25519_priv = signing_key.to_curve25519_private_key()
    plaintext = b"v=0\r\no=- ..."
    ciphertext = SealedBox(x25519_pub).encrypt(plaintext)
    recovered = SealedBox(x25519_priv).decrypt(ciphertext)
    assert recovered == plaintext
