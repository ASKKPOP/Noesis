"""
brain/src/noesis_brain/wire/enrollment.py

D-V3-39 — Brain enrolment with the Grid.

A Nous becomes a citizen through the Portal → Polis pipeline (D-V3-33). The
Brain's part is the last step, and it must be the only party able to take it:

  1. The Brain holds its OWN Ed25519 key, generated locally and kept in
     BRAIN_DATA_DIR. (The existence DID is public, so a key derived from it
     proves nothing.) Its public half is what the sponsor pastes into the
     Portal when filing the registration.
  2. Once the registration is approved, the Brain requests its Civic-DID with
     an oath signed by that key. The Grid issues only to the enrolled key.
  3. The Brain registers the same key as its bearer-token key.

The issued Civic-DID is cached next to the key, so later starts skip the
network round-trip.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from pathlib import Path

import httpx
import jwt  # PyJWT
from nacl.signing import SigningKey  # type: ignore[import]

from noesis_brain.wire.token_manager import (
    TOKEN_TTL_SECONDS,
    _b64url_no_pad,
    _signing_key_to_pem,
)

log = logging.getLogger(__name__)

KEY_FILENAME = "brain-wire.key"
CIVIC_DID_FILENAME = "civic-did"
NOUS_CIVIC_OATH = "I pledge to uphold the Genesis Grid civic charter."
APPROVAL_POLL_SECONDS = 30.0


class EnrollmentError(RuntimeError):
    """The Grid refused enrolment for a reason waiting will not fix."""


def key_path(data_dir: str) -> Path:
    return Path(data_dir) / KEY_FILENAME


def load_or_create_brain_key(data_dir: str) -> SigningKey:
    """Return this Brain's Ed25519 key, creating it (mode 0600) on first use."""
    path = key_path(data_dir)
    if path.exists():
        return SigningKey(path.read_bytes())
    path.parent.mkdir(parents=True, exist_ok=True)
    key = SigningKey.generate()
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "wb") as f:
        f.write(bytes(key))
    return key


def public_key_x(key: SigningKey) -> str:
    """The public key as the JWK `x` value — what the sponsor enters in the Portal."""
    return _b64url_no_pad(bytes(key.verify_key))


def public_jwk(key: SigningKey) -> dict[str, str]:
    return {"kty": "OKP", "crv": "Ed25519", "x": public_key_x(key), "alg": "EdDSA"}


def load_cached_civic_did(data_dir: str) -> str | None:
    path = Path(data_dir) / CIVIC_DID_FILENAME
    return path.read_text().strip() or None if path.exists() else None


async def _request_civic_did_once(
    client: httpx.AsyncClient, grid_url: str, nous_did: str, key: SigningKey,
) -> str | None:
    """One issuance attempt. Returns the Civic-DID, or None while approval is pending."""
    signature = jwt.PyJWS().encode(
        NOUS_CIVIC_OATH.encode("utf-8"), _signing_key_to_pem(key), algorithm="EdDSA",
    )
    resp = await client.post(
        f"{grid_url}/api/v1/registry/civic-did/request",
        json={
            "existence_did": nous_did,
            "civic_oath": NOUS_CIVIC_OATH,
            "existence_public_key_jwk": public_jwk(key),
            "existence_key_signature": signature,
        },
        timeout=10.0,
    )
    body = resp.json() if resp.content else {}
    if resp.status_code in (201, 409) and isinstance(body.get("civic_did"), str):
        return body["civic_did"]  # 409 already_registered echoes the existing Civic-DID
    if resp.status_code == 403 and body.get("error") == "portal_approval_required":
        return None
    raise EnrollmentError(f"civic-did request refused: http_{resp.status_code} {body.get('error')}")


async def _register_token(
    client: httpx.AsyncClient, grid_url: str, nous_did: str, civic_did: str, key: SigningKey,
) -> None:
    """Register this Brain's key as its bearer-token key (idempotent for the same key)."""
    now = int(time.time())
    body = {
        "brain_did": nous_did,
        "civic_did": civic_did,
        "public_key_jwk": public_jwk(key),
        "issued_at": now,
        "expires_at": now + TOKEN_TTL_SECONDS,
    }
    # The Grid verifies against JSON.stringify of these fields in this order.
    canonical = json.dumps(body, separators=(",", ":")).encode("utf-8")
    signature = _b64url_no_pad(key.sign(canonical).signature)
    resp = await client.post(
        f"{grid_url}/api/v1/brain/token/register", json={**body, "signature": signature}, timeout=10.0,
    )
    if resp.status_code != 200:
        error = resp.json().get("error") if resp.content else None
        raise EnrollmentError(f"brain token registration refused: http_{resp.status_code} {error}")


async def enroll(
    *,
    grid_url: str,
    nous_did: str,
    data_dir: str,
    key: SigningKey,
    client: httpx.AsyncClient | None = None,
    poll_seconds: float = APPROVAL_POLL_SECONDS,
) -> str:
    """Obtain this Nous's Civic-DID and register the Brain key. Returns the Civic-DID.

    Waits (polling) while the Portal registration is still unapproved, logging the
    public key the sponsor must file. Raises EnrollmentError on any other refusal.
    """
    owns_client = client is None
    client = client or httpx.AsyncClient()
    try:
        civic_did = load_cached_civic_did(data_dir)
        announced = False
        while civic_did is None:
            civic_did = await _request_civic_did_once(client, grid_url, nous_did, key)
            if civic_did is None:
                if not announced:
                    log.warning(
                        "[Brain] %s has no approved registration yet. File one in the Portal "
                        "(My Nous → Register) with this Brain public key: %s — waiting for approval…",
                        nous_did, public_key_x(key),
                    )
                    announced = True
                await asyncio.sleep(poll_seconds)
        await _register_token(client, grid_url, nous_did, civic_did, key)
        (Path(data_dir) / CIVIC_DID_FILENAME).write_text(civic_did)
        return civic_did
    finally:
        if owns_client:
            await client.aclose()
