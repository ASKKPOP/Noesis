"""
brain/src/noesis_brain/wire/token_manager.py

Phase 38 WIRE-02 — EdDSA JWT creation + proactive rotation.

Brain produces a short-lived JWT (24h) signed with the operator's Ed25519
existence-key (PyNaCl SigningKey).  Grid verifies via jose.jwtVerify with
the stored Ed25519 public JWK.

Token rotation policy:
  - TTL: 24 hours (TOKEN_TTL_SECONDS)
  - Rotate: proactively 1 hour before expiry (ROTATE_BEFORE_EXPIRY_SECONDS = 3600)
  - Overlap: during the 1h window before old-token expiry, both the old and
    new token verify on Grid side because the same Ed25519 public key covers
    both.  Grid only rejects when exp passes OR when the brain_tokens row is
    revoked.
"""

from __future__ import annotations

import base64
from dataclasses import dataclass
from typing import Callable, Optional

import jwt  # PyJWT
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    NoEncryption,
    PrivateFormat,
)
from nacl.signing import SigningKey  # type: ignore[import]

__all__ = ["TokenManager", "TokenRecord", "WireError"]

TOKEN_TTL_SECONDS: int = 24 * 60 * 60       # 24 h
ROTATE_BEFORE_EXPIRY_SECONDS: int = 60 * 60  # rotate at 23 h mark


class WireError(Exception):
    """Raised when wire-protocol operations fail."""


@dataclass
class TokenRecord:
    """A single issued JWT with its timing metadata."""

    token: str        # compact JWS string
    issued_at: int    # unix seconds
    expires_at: int   # unix seconds


def _signing_key_to_pem(signing_key: SigningKey) -> bytes:
    """Convert a PyNaCl SigningKey to a PKCS8 PEM-encoded Ed25519 private key.

    PyJWT accepts cryptography-library PEM bytes directly for algorithm="EdDSA".
    """
    seed: bytes = bytes(signing_key)  # 32-byte raw seed
    private_key = Ed25519PrivateKey.from_private_bytes(seed)
    return private_key.private_bytes(
        encoding=Encoding.PEM,
        format=PrivateFormat.PKCS8,
        encryption_algorithm=NoEncryption(),
    )


def _b64url_no_pad(data: bytes) -> str:
    """Return base64url encoding without padding characters."""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


class TokenManager:
    """Create and rotate EdDSA JWTs for Brain → Grid authentication.

    Usage::

        mgr = TokenManager(
            existence_did="did:noesis:nous:abc123",
            civic_did="did:civic:noesis:xyz789",
            signing_key=my_nacl_signing_key,
        )
        token_str = mgr.get_valid_token()
        jwk = mgr.public_jwk()  # register this with Grid
    """

    def __init__(
        self,
        *,
        existence_did: str,
        civic_did: str,
        signing_key: SigningKey,
        clock: Optional[Callable[[], float]] = None,
    ) -> None:
        self._existence_did = existence_did
        self._civic_did = civic_did
        self._signing_key = signing_key
        self._pem_private: bytes = _signing_key_to_pem(signing_key)
        self._clock: Callable[[], float] = clock if clock is not None else __import__("time").time
        self._current: Optional[TokenRecord] = None

    # ── Public API ────────────────────────────────────────────────────────────

    def create(self) -> TokenRecord:
        """Issue a fresh 24h JWT and store it as the current token.

        Returns the new TokenRecord (also available via self._current).
        """
        now = int(self._clock())
        expires_at = now + TOKEN_TTL_SECONDS
        payload = {
            "iss": self._existence_did,
            "sub": self._civic_did,
            "iat": now,
            "exp": expires_at,
            "scope": "brain_wire",
        }
        token_str: str = jwt.encode(payload, self._pem_private, algorithm="EdDSA")
        record = TokenRecord(token=token_str, issued_at=now, expires_at=expires_at)
        self._current = record
        return record

    def get_valid_token(self) -> str:
        """Return a valid JWT string, creating or rotating as needed.

        If no token exists, creates one.
        If within ROTATE_BEFORE_EXPIRY_SECONDS of expiry, rotates to a new one.
        The caller should treat the returned string as opaque — it is a compact JWS.
        """
        if self._current is None:
            self.create()
        elif self._should_rotate(self._current, int(self._clock())):
            self.create()
        assert self._current is not None  # always set after create()
        return self._current.token

    def _should_rotate(self, record: TokenRecord, now: int) -> bool:
        """Return True when the token has entered the rotation window (≥23h old)."""
        return now >= record.expires_at - ROTATE_BEFORE_EXPIRY_SECONDS

    def public_jwk(self) -> dict:  # type: ignore[type-arg]
        """Return the Ed25519 verify key as a JWK dict suitable for registration.

        Format: {"kty": "OKP", "crv": "Ed25519", "x": "<b64url>", "alg": "EdDSA"}
        where "x" is the 32-byte public key, base64url-encoded without padding.
        """
        raw_pub: bytes = bytes(self._signing_key.verify_key)  # 32 bytes
        return {
            "kty": "OKP",
            "crv": "Ed25519",
            "x": _b64url_no_pad(raw_pub),
            "alg": "EdDSA",
        }
