"""
brain/test/wire/test_enrollment.py

D-V3-39 — Brain enrolment: own persisted key, Civic-DID request that waits for
Portal approval, token registration, and the cached Civic-DID.
"""

from __future__ import annotations

import base64
import json
import stat

import httpx
import jwt as pyjwt  # PyJWT
import pytest
from nacl.signing import VerifyKey  # type: ignore[import]

from noesis_brain.wire import enrollment

GRID = "https://grid.test"
NOUS = "did:noesis:hermes"
CIVIC = "did:civic:noesis:1234"


def _b64url_decode(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def _client(handler) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def test_key_is_created_once_private_and_reloaded(tmp_path):
    key = enrollment.load_or_create_brain_key(str(tmp_path))
    path = enrollment.key_path(str(tmp_path))
    assert stat.S_IMODE(path.stat().st_mode) == 0o600
    again = enrollment.load_or_create_brain_key(str(tmp_path))
    assert bytes(again) == bytes(key)
    assert len(enrollment.public_key_x(key)) == 43


def test_two_brains_get_different_keys(tmp_path):
    a = enrollment.load_or_create_brain_key(str(tmp_path / "a"))
    b = enrollment.load_or_create_brain_key(str(tmp_path / "b"))
    assert enrollment.public_key_x(a) != enrollment.public_key_x(b)


async def test_enroll_waits_for_approval_then_registers_and_caches(tmp_path):
    key = enrollment.load_or_create_brain_key(str(tmp_path))
    verify = VerifyKey(_b64url_decode(enrollment.public_key_x(key)))
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        calls.append(request.url.path)
        if request.url.path == "/api/v1/registry/civic-did/request":
            assert body["existence_did"] == NOUS
            assert body["existence_public_key_jwk"]["x"] == enrollment.public_key_x(key)
            # The oath is a compact JWS signed by the Brain key.
            payload = pyjwt.PyJWS().decode(
                body["existence_key_signature"], _pem(verify), algorithms=["EdDSA"],
            )
            assert payload.decode() == body["civic_oath"] == enrollment.NOUS_CIVIC_OATH
            if calls.count(request.url.path) == 1:
                return httpx.Response(403, json={"error": "portal_approval_required"})
            return httpx.Response(201, json={"civic_did": CIVIC})
        assert request.url.path == "/api/v1/brain/token/register"
        signature = body.pop("signature")
        assert list(body) == ["brain_did", "civic_did", "public_key_jwk", "issued_at", "expires_at"]
        # Verifies against the same bytes JSON.stringify produces on the Grid.
        verify.verify(json.dumps(body, separators=(",", ":")).encode(), _b64url_decode(signature))
        assert body["civic_did"] == CIVIC
        return httpx.Response(200, json={"ok": True})

    async with _client(handler) as client:
        civic = await enrollment.enroll(
            grid_url=GRID, nous_did=NOUS, data_dir=str(tmp_path), key=key, client=client, poll_seconds=0,
        )
    assert civic == CIVIC
    assert calls == [
        "/api/v1/registry/civic-did/request",
        "/api/v1/registry/civic-did/request",
        "/api/v1/brain/token/register",
    ]
    assert enrollment.load_cached_civic_did(str(tmp_path)) == CIVIC


async def test_enroll_uses_cached_civic_did_without_requesting_again(tmp_path):
    key = enrollment.load_or_create_brain_key(str(tmp_path))
    (tmp_path / enrollment.CIVIC_DID_FILENAME).write_text(CIVIC)
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.path)
        return httpx.Response(200, json={"ok": True})

    async with _client(handler) as client:
        assert await enrollment.enroll(grid_url=GRID, nous_did=NOUS, data_dir=str(tmp_path), key=key, client=client) == CIVIC
    assert calls == ["/api/v1/brain/token/register"]


async def test_already_registered_reuses_the_existing_civic_did(tmp_path):
    key = enrollment.load_or_create_brain_key(str(tmp_path))

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/civic-did/request"):
            return httpx.Response(409, json={"error": "already_registered", "civic_did": CIVIC})
        return httpx.Response(200, json={"ok": True})

    async with _client(handler) as client:
        assert await enrollment.enroll(grid_url=GRID, nous_did=NOUS, data_dir=str(tmp_path), key=key, client=client) == CIVIC


@pytest.mark.parametrize("path,status,error", [
    ("/api/v1/registry/civic-did/request", 403, "brain_key_not_enrolled"),
    ("/api/v1/brain/token/register", 403, "brain_key_not_enrolled"),
])
async def test_a_refusal_that_waiting_cannot_fix_raises(tmp_path, path, status, error):
    key = enrollment.load_or_create_brain_key(str(tmp_path))

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == path:
            return httpx.Response(status, json={"error": error})
        return httpx.Response(201, json={"civic_did": CIVIC})

    async with _client(handler) as client:
        with pytest.raises(enrollment.EnrollmentError, match=error):
            await enrollment.enroll(grid_url=GRID, nous_did=NOUS, data_dir=str(tmp_path), key=key, client=client, poll_seconds=0)
    assert enrollment.load_cached_civic_did(str(tmp_path)) is None


def _pem(verify: VerifyKey) -> bytes:
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
    from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

    return Ed25519PublicKey.from_public_bytes(bytes(verify)).public_bytes(Encoding.PEM, PublicFormat.SubjectPublicKeyInfo)
