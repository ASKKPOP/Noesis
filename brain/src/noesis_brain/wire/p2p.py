"""
brain/src/noesis_brain/wire/p2p.py

Phase 42 P2P-01..05 — Brain-to-Brain WebRTC signaling client.

BrainP2PClient wraps the Grid P2P HTTP endpoints and the aiortc
RTCPeerConnection for SDP offer/answer exchange and data channel management.

Encryption: SDP blobs are encrypted with peer's X25519 public key (derived
from Ed25519 JWK via PyNaCl VerifyKey.to_curve25519_public_key()) using
nacl.public.SealedBox before posting to Grid (D-42-05).

Grid is a pure opaque relay — it sees from_did_hash / to_did_hash but
cannot read SDP content.

Errors logged at WARNING; NEVER raised to caller (GridWireClient convention).
"""
from __future__ import annotations

import asyncio
import base64
import logging
from typing import Optional

import httpx
from nacl.public import SealedBox
from nacl.signing import SigningKey, VerifyKey

from .token_manager import TokenManager

__all__ = ["BrainP2PClient", "encrypt_sdp_for_peer", "decrypt_sdp_from_peer"]

log = logging.getLogger(__name__)

# Announce cadence constant (separate from 60s presence heartbeat — D-42-02 / Pitfall 6)
ANNOUNCE_INTERVAL_SECONDS: int = 300


def encrypt_sdp_for_peer(sdp_string: str, peer_public_key_jwk: dict) -> bytes:
    """Encrypt SDP string to peer's Ed25519 public key (anonymous SealedBox).

    peer_public_key_jwk: the Ed25519 JWK from peer's W3C VC credentialSubject.
                        Format: {"kty": "OKP", "crv": "Ed25519", "x": "<base64url>"}
    Returns: SealedBox ciphertext bytes (includes ephemeral X25519 public key).
    """
    if peer_public_key_jwk.get("kty") != "OKP" or peer_public_key_jwk.get("crv") != "Ed25519":
        raise ValueError(f"Unsupported JWK type/curve: {peer_public_key_jwk!r}")
    x_b64url = peer_public_key_jwk["x"]
    # urlsafe_b64decode requires padding — add "==" suffix (safe; b64 decoder ignores extras)
    raw_ed25519_bytes = base64.urlsafe_b64decode(x_b64url + "==")
    verify_key = VerifyKey(raw_ed25519_bytes)
    x25519_public = verify_key.to_curve25519_public_key()
    return SealedBox(x25519_public).encrypt(sdp_string.encode("utf-8"))


def decrypt_sdp_from_peer(encrypted_blob: bytes, my_signing_key: SigningKey) -> str:
    """Decrypt SealedBox ciphertext using our Ed25519 signing key.

    my_signing_key: nacl.signing.SigningKey (the Brain's existence key).
    Returns: original SDP string.
    """
    x25519_private = my_signing_key.to_curve25519_private_key()
    plaintext = SealedBox(x25519_private).decrypt(encrypted_blob)
    return plaintext.decode("utf-8")


class BrainP2PClient:
    """WebRTC signaling client for Brain-to-Brain communication.

    Follows GridWireClient conventions:
    - Shares the same httpx.AsyncClient (passed in, not created internally)
    - Uses TokenManager for bearer auth
    - Logs at WARNING on errors; NEVER raises to caller
    - Separate asyncio.Task for 300s announce heartbeat (distinct from 60s presence)
    """

    ANNOUNCE_INTERVAL_SECONDS: int = ANNOUNCE_INTERVAL_SECONDS

    def __init__(
        self,
        *,
        grid_url: str,
        token_manager: TokenManager,
        civic_did: str,
        signing_key: SigningKey,
        client: httpx.AsyncClient,
    ) -> None:
        self._base_url = grid_url.rstrip("/")
        self._token_manager = token_manager
        self._civic_did = civic_did
        self._signing_key = signing_key
        self._client = client
        # Lazy per-peer public-key cache (peer_did → JWK dict)
        self._peer_pubkey_cache: dict[str, dict] = {}  # type: ignore[type-arg]
        # Active connections: connection_id → RTCPeerConnection
        # (deferred import — aiortc adds ~80MB; only import when first used)
        self._active_connections: dict[str, object] = {}

    async def announce(self, tick: int) -> None:
        """POST /api/v1/p2p/announce — 5-min heartbeat (separate cadence from presence 60s)."""
        try:
            token = self._token_manager.get_valid_token()
            resp = await self._client.post(
                f"{self._base_url}/api/v1/p2p/announce",
                json={},
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
            )
            if not (200 <= resp.status_code < 300):
                log.warning("[Brain] p2p announce non-2xx: status=%s", resp.status_code)
        except Exception as exc:
            log.warning("[Brain] p2p announce error: %s", exc)

    async def get_peer_status(self, peer_did: str) -> dict:  # type: ignore[type-arg]
        """GET /api/v1/p2p/peers/<did> — public, no auth required."""
        try:
            resp = await self._client.get(f"{self._base_url}/api/v1/p2p/peers/{peer_did}")
            if resp.status_code == 404:
                return {"status": "offline"}
            if 200 <= resp.status_code < 300:
                return resp.json()  # type: ignore[no-any-return]
            log.warning(
                "[Brain] get_peer_status non-2xx: status=%s did=%s", resp.status_code, peer_did
            )
            return {"status": "offline"}
        except Exception as exc:
            log.warning("[Brain] get_peer_status error: %s did=%s", exc, peer_did)
            return {"status": "offline"}

    async def get_peer_public_key(self, peer_did: str) -> Optional[dict]:  # type: ignore[type-arg]
        """GET /api/v1/registry/civic-did/<did> — extract existencePublicKeyJwk from VC.

        Returns None when:
        - Grid returns non-2xx
        - VC credentialSubject has no existencePublicKeyJwk (Phase 37 rows)
        - Network error

        Result is cached lazily per peer_did to avoid redundant registry calls.
        """
        if peer_did in self._peer_pubkey_cache:
            return self._peer_pubkey_cache[peer_did]
        try:
            resp = await self._client.get(
                f"{self._base_url}/api/v1/registry/civic-did/{peer_did}"
            )
            if not (200 <= resp.status_code < 300):
                log.warning(
                    "[Brain] get_peer_public_key non-2xx: status=%s did=%s",
                    resp.status_code,
                    peer_did,
                )
                return None
            vc = resp.json()
            subject = vc.get("credentialSubject", {})
            jwk = subject.get("existencePublicKeyJwk")
            if not jwk:
                log.info(
                    "[Brain] peer %s has no existencePublicKeyJwk "
                    "(pre-Phase-42 registration — P2P unavailable for this DID)",
                    peer_did,
                )
                return None
            self._peer_pubkey_cache[peer_did] = jwk
            return jwk  # type: ignore[no-any-return]
        except Exception as exc:
            log.warning("[Brain] get_peer_public_key error: %s did=%s", exc, peer_did)
            return None

    async def initiate_connection(
        self, peer_did: str, tick: int
    ) -> Optional[tuple[str, object]]:
        """Full offer flow. Returns (connection_id, RTCPeerConnection) or None on failure.

        Steps:
          1. Fetch peer public key (None → fallback to Grid messaging)
          2. Fetch TURN credentials
          3. Generate SDP offer with ALL ICE candidates gathered (aiortc has no trickle — Pitfall 1)
          4. Encrypt SDP with peer's X25519 pubkey (D-42-05 opaque relay)
          5. POST /api/v1/p2p/signal/<peer_did> with base64(ciphertext)
          6. Return (connection_id, pc) for caller to hold pc and use the data channel later
        """
        peer_jwk = await self.get_peer_public_key(peer_did)
        if peer_jwk is None:
            log.info(
                "[Brain] No public key for %s — falling back to Grid messaging", peer_did
            )
            return None

        turn = await self.get_turn_credentials()
        if not turn:
            log.warning("[Brain] No TURN credentials available; aborting P2P initiation")
            return None

        try:
            from aiortc import RTCPeerConnection, RTCConfiguration, RTCIceServer  # type: ignore[import]
        except ImportError as exc:
            log.warning("[Brain] aiortc not installed: %s", exc)
            return None

        try:
            uris = turn.get("uris", [])
            ice_servers = []
            for uri in uris:
                if uri.startswith("turn:"):
                    ice_servers.append(
                        RTCIceServer(
                            urls=uri,
                            username=turn.get("username", ""),
                            credential=turn.get("password", ""),
                        )
                    )
                elif uri.startswith("stun:"):
                    ice_servers.append(RTCIceServer(urls=uri))
            if not ice_servers:
                # Fallback: construct from known coturn pattern
                ice_servers = [RTCIceServer(urls="stun:stun.l.google.com:19302")]

            config = RTCConfiguration(iceServers=ice_servers)
            pc = RTCPeerConnection(configuration=config)
            # Create data channel BEFORE createOffer (aiortc requires this for SDP m=application)
            pc.createDataChannel("brain-link")

            offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            # aiortc does NOT support trickle ICE — poll until gathering complete (Pitfall 1)
            while pc.iceGatheringState != "complete":
                await asyncio.sleep(0.05)

            sdp_string = pc.localDescription.sdp
            ciphertext = encrypt_sdp_for_peer(sdp_string, peer_jwk)
            encoded = base64.b64encode(ciphertext).decode("ascii")

            token = self._token_manager.get_valid_token()
            resp = await self._client.post(
                f"{self._base_url}/api/v1/p2p/signal/{peer_did}",
                json={"encrypted_blob": encoded},
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
            )
            if not (200 <= resp.status_code < 300):
                log.warning(
                    "[Brain] initiate_connection signal POST non-2xx: status=%s", resp.status_code
                )
                await pc.close()
                return None
            connection_id = resp.json()["connection_id"]
            self._active_connections[connection_id] = pc
            return (connection_id, pc)
        except Exception as exc:
            log.warning("[Brain] initiate_connection error: %s", exc)
            return None

    async def handle_signal_received(self, frame: dict) -> None:  # type: ignore[type-arg]
        """Called when WSS frame type='p2p.signal_received' arrives.

        Fetches encrypted blob from inbox, decrypts, handles offer (generate answer)
        or answer (set remote description on existing pc).

        D-42-06: This frame is a private WSS push — NOT an audit chain event.
        """
        try:
            token = self._token_manager.get_valid_token()
            resp = await self._client.get(
                f"{self._base_url}/api/v1/p2p/signal/inbox",
                headers={"Authorization": f"Bearer {token}"},
            )
            if not (200 <= resp.status_code < 300):
                log.warning("[Brain] inbox GET non-2xx: status=%s", resp.status_code)
                return
            signals = resp.json().get("signals", [])
            for sig in signals:
                connection_id = sig["connectionId"]
                from_did = sig["fromDid"]
                blob_b64 = sig["encryptedBlob"]
                try:
                    blob = base64.b64decode(blob_b64)
                    sdp_string = decrypt_sdp_from_peer(blob, self._signing_key)
                except Exception as exc:
                    log.warning(
                        "[Brain] failed to decrypt signal %s: %s", connection_id, exc
                    )
                    continue
                await self._process_remote_sdp(connection_id, from_did, sdp_string)
        except Exception as exc:
            log.warning("[Brain] handle_signal_received error: %s", exc)

    async def _process_remote_sdp(
        self, connection_id: str, from_did: str, sdp_string: str
    ) -> None:
        """Apply remote SDP — branch on offer vs answer.

        If connection_id is unknown → incoming offer (create pc, set remote, build answer, post back).
        If connection_id already in _active_connections → incoming answer (set remote on existing pc).
        """
        try:
            from aiortc import RTCPeerConnection, RTCSessionDescription  # type: ignore[import]
        except ImportError:
            return

        if connection_id not in self._active_connections:
            # Incoming offer — create pc, set remote, build answer
            pc = RTCPeerConnection()
            self._active_connections[connection_id] = pc
            await pc.setRemoteDescription(
                RTCSessionDescription(sdp=sdp_string, type="offer")
            )
            answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            # Wait for ICE gathering to complete (Pitfall 1)
            while pc.iceGatheringState != "complete":
                await asyncio.sleep(0.05)
            answer_sdp = pc.localDescription.sdp
            # Encrypt with from_did's public key and post back
            peer_jwk = await self.get_peer_public_key(from_did)
            if peer_jwk is None:
                log.warning(
                    "[Brain] Cannot encrypt answer — no pubkey for %s", from_did
                )
                return
            ciphertext = encrypt_sdp_for_peer(answer_sdp, peer_jwk)
            encoded = base64.b64encode(ciphertext).decode("ascii")
            try:
                token = self._token_manager.get_valid_token()
                await self._client.post(
                    f"{self._base_url}/api/v1/p2p/signal/{from_did}",
                    json={"encrypted_blob": encoded},
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json",
                    },
                )
            except Exception as exc:
                log.warning("[Brain] answer POST error: %s", exc)
        else:
            # Incoming answer — set remote on existing pc
            pc = self._active_connections[connection_id]  # type: ignore[assignment]
            await pc.setRemoteDescription(  # type: ignore[attr-defined]
                RTCSessionDescription(sdp=sdp_string, type="answer")
            )

    async def get_turn_credentials(self) -> Optional[dict]:  # type: ignore[type-arg]
        """GET /api/v1/p2p/turn-credentials — Civic-DID auth, returns TURN credential dict.

        Response shape: {username, password, ttl, realm, uris: [turn:..., stun:...]}
        D-42-03: TURN is FREE in v3.0. No Bios deduction.
        """
        try:
            token = self._token_manager.get_valid_token()
            resp = await self._client.get(
                f"{self._base_url}/api/v1/p2p/turn-credentials",
                headers={"Authorization": f"Bearer {token}"},
            )
            if not (200 <= resp.status_code < 300):
                log.warning(
                    "[Brain] turn-credentials non-2xx: status=%s", resp.status_code
                )
                return None
            return resp.json()  # type: ignore[no-any-return]
        except Exception as exc:
            log.warning("[Brain] turn-credentials error: %s", exc)
            return None

    async def close(self) -> None:
        """Close all active RTCPeerConnections (best-effort)."""
        for connection_id, pc in list(self._active_connections.items()):
            try:
                await pc.close()  # type: ignore[attr-defined]
            except Exception as exc:
                log.warning("[Brain] close(%s) error: %s", connection_id, exc)
        self._active_connections.clear()
