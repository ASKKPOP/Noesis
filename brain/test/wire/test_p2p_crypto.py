"""
brain/test/wire/test_p2p_crypto.py

Phase 42 P2P-05 — SDP encryption/decryption roundtrip tests.
Covers: encrypt_sdp_for_peer / decrypt_sdp_from_peer using PyNaCl SealedBox.
Most tests skipped until Plan 05 implements brain/src/noesis_brain/wire/p2p.py.
One non-skipped sanity test validates the PyNaCl crypto stack is ready.
"""

from __future__ import annotations

import base64
import json
import pytest
from nacl.signing import SigningKey, VerifyKey
from nacl.public import SealedBox


# ── skipped contract tests ────────────────────────────────────────────────────

@pytest.mark.skip(reason="Phase 42 Plan 05 — encrypt_sdp_for_peer not yet implemented")
def test_encrypt_sdp_for_peer_returns_bytes() -> None:
    """encrypt_sdp_for_peer("v=0\\r\\n...", peer_jwk) returns bytes."""
    # peer_jwk = {'kty': 'OKP', 'crv': 'Ed25519', 'x': '<base64url>'}
    # result = encrypt_sdp_for_peer("v=0\r\no=- ...", peer_jwk)
    # assert isinstance(result, bytes)
    pass


@pytest.mark.skip(reason="Phase 42 Plan 05 — encrypt_sdp_for_peer not yet implemented")
def test_encrypt_then_decrypt_roundtrip_recovers_original_sdp() -> None:
    """generate peer SigningKey, derive JWK, encrypt offer, recipient decrypts with own signing_key — recovered == original."""
    # signing_key = SigningKey.generate()
    # verify_key = signing_key.verify_key
    # jwk = {'kty': 'OKP', 'crv': 'Ed25519', 'x': base64.urlsafe_b64encode(bytes(verify_key)).rstrip(b'=').decode()}
    # sdp = "v=0\r\no=- ..."
    # ciphertext = encrypt_sdp_for_peer(sdp, jwk)
    # recovered = decrypt_sdp_from_peer(ciphertext, signing_key)
    # assert recovered == sdp
    pass


@pytest.mark.skip(reason="Phase 42 Plan 05 — encrypt_sdp_for_peer not yet implemented")
def test_decrypt_with_wrong_key_fails() -> None:
    """Third-party signing key cannot decrypt ciphertext encrypted for a different peer."""
    # wrong_key = SigningKey.generate()
    # ... encrypt with bob's pubkey, attempt decrypt with wrong_key → raises CryptoError
    pass


@pytest.mark.skip(reason="Phase 42 Plan 05 — encrypt_sdp_for_peer not yet implemented")
def test_jwk_parsing_handles_base64url_padding() -> None:
    """JWK x value without '=' padding decodes correctly (urlsafe_b64decode with '==' suffix trick)."""
    # x_no_pad = base64.urlsafe_b64encode(b'\x00' * 32).rstrip(b'=').decode()
    # jwk = {'kty': 'OKP', 'crv': 'Ed25519', 'x': x_no_pad}
    # result = parse_existence_public_key_jwk(jwk)
    # assert isinstance(result, VerifyKey)
    pass


@pytest.mark.skip(reason="Phase 42 Plan 05 — encrypt_sdp_for_peer not yet implemented")
def test_ed25519_to_x25519_conversion_uses_verify_key_method() -> None:
    """Encryption uses VerifyKey.to_curve25519_public_key() not raw bytes directly."""
    # verify_key = SigningKey.generate().verify_key
    # x25519_pub = verify_key.to_curve25519_public_key()
    # assert x25519_pub is not None
    pass


@pytest.mark.skip(reason="Phase 42 Plan 05 — encrypt_sdp_for_peer not yet implemented")
def test_signing_key_to_curve25519_private_key_for_decryption() -> None:
    """Recipient derives X25519 private key using SigningKey.to_curve25519_private_key()."""
    # signing_key = SigningKey.generate()
    # x25519_priv = signing_key.to_curve25519_private_key()
    # assert x25519_priv is not None
    pass


@pytest.mark.skip(reason="Phase 42 Plan 05 — encrypt_sdp_for_peer not yet implemented")
def test_grid_cannot_decrypt_blob_without_recipient_private_key() -> None:
    """SDP content is opaque to Grid: ciphertext encrypted with B's pubkey can only be decrypted by B."""
    # Encrypt with bob's pubkey. Third-party (Grid) has no private key — cannot decrypt.
    # assert encrypted blob != original sdp (opaque to observer without recipient key)
    pass


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
