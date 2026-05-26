"""
brain/test/wire/test_token_manager.py

Unit tests for Phase 38 WIRE-02 TokenManager.

Four tests:
  1. JWT is a valid EdDSA token with correct claims.
  2. _should_rotate returns False before 23h and True at 23h.
  3. get_valid_token proactively rotates after 23h (returns new token).
  4. public_jwk has the expected shape (kty, crv, x, alg; x is 43 chars).
"""

from __future__ import annotations

import base64

import jwt as pyjwt  # PyJWT
import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from nacl.signing import SigningKey  # type: ignore[import]

from noesis_brain.wire.token_manager import (
    ROTATE_BEFORE_EXPIRY_SECONDS,
    TOKEN_TTL_SECONDS,
    TokenManager,
    TokenRecord,
)


def _make_manager(clock_val: float = 1_000_000.0) -> TokenManager:
    """Helper: create a TokenManager with a fresh random SigningKey and a fixed clock."""
    signing_key = SigningKey.generate()
    return TokenManager(
        existence_did="did:noesis:nous:testkey",
        civic_did="did:civic:noesis:testcivic",
        signing_key=signing_key,
        clock=lambda: clock_val,
    )


def _public_pem_from_manager(mgr: TokenManager) -> bytes:
    """Derive the Ed25519 public PEM from the manager's JWK x field."""
    jwk = mgr.public_jwk()
    x_bytes = base64.urlsafe_b64decode(jwk["x"] + "==")  # add back padding
    pub_key = Ed25519PublicKey.from_public_bytes(x_bytes)
    return pub_key.public_bytes(Encoding.PEM, PublicFormat.SubjectPublicKeyInfo)


class TestCreateProducesValidEddsaJwt:
    """test_create_produces_valid_eddsa_jwt"""

    def test_jwt_is_valid_and_claims_correct(self) -> None:
        now = 1_000_000
        mgr = _make_manager(clock_val=float(now))
        record = mgr.create()

        pub_pem = _public_pem_from_manager(mgr)
        decoded = pyjwt.decode(
            record.token,
            pub_pem,
            algorithms=["EdDSA"],
            options={"verify_exp": False},  # we assert exp manually
        )

        assert decoded["iss"] == "did:noesis:nous:testkey"
        assert decoded["sub"] == "did:civic:noesis:testcivic"
        assert decoded["scope"] == "brain_wire"
        assert decoded["exp"] - decoded["iat"] == TOKEN_TTL_SECONDS


class TestShouldRotateAt23h:
    """test_should_rotate_at_23h"""

    def test_not_yet_at_22h(self) -> None:
        base_time = 1_000_000
        mgr = _make_manager(clock_val=float(base_time))
        record = mgr.create()

        assert not mgr._should_rotate(record, base_time + 22 * 3600)

    def test_yes_at_23h(self) -> None:
        base_time = 1_000_000
        mgr = _make_manager(clock_val=float(base_time))
        record = mgr.create()

        assert mgr._should_rotate(record, base_time + 23 * 3600)


class TestGetValidTokenRotatesProactively:
    """test_get_valid_token_rotates_proactively"""

    def test_second_call_after_23h_gives_new_token(self) -> None:
        time_state = [1_000_000.0]

        signing_key = SigningKey.generate()
        mgr = TokenManager(
            existence_did="did:noesis:nous:rotatetest",
            civic_did="did:civic:noesis:rotcivic",
            signing_key=signing_key,
            clock=lambda: time_state[0],
        )

        first_token = mgr.get_valid_token()
        first_iat = mgr._current.issued_at  # type: ignore[union-attr]

        # Advance time by 23 hours
        time_state[0] += 23 * 3600

        second_token = mgr.get_valid_token()
        second_iat = mgr._current.issued_at  # type: ignore[union-attr]

        assert first_token != second_token, "Token should have rotated"
        assert second_iat > first_iat, "New token's iat must be later"


class TestPublicJwkShape:
    """test_public_jwk_shape"""

    def test_jwk_has_required_keys_and_x_length(self) -> None:
        mgr = _make_manager()
        jwk = mgr.public_jwk()

        assert jwk["kty"] == "OKP"
        assert jwk["crv"] == "Ed25519"
        assert jwk["alg"] == "EdDSA"
        # base64url without padding of 32 bytes = 43 chars (32 * 4/3 = 42.67 → ceil = 43,
        # no '=' padding because len(32) % 3 = 2)
        assert len(jwk["x"]) == 43, f"Expected 43-char base64url, got {len(jwk['x'])}: {jwk['x']!r}"
        # Must be valid base64url (no +, /, or =)
        assert "+" not in jwk["x"]
        assert "/" not in jwk["x"]
        assert "=" not in jwk["x"]
