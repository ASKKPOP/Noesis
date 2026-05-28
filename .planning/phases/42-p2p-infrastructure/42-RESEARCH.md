# Phase 42: P2P Infrastructure — Research

**Researched:** 2026-05-28
**Domain:** WebRTC signaling relay, aiortc Python client, coturn STUN/TURN, SDP encryption (PyNaCl), Grid Fastify routes, WSS per-DID push
**Confidence:** HIGH (all critical claims verified against codebase or official docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-42-01:** WebRTC + aiortc (Python) for Brain P2P. Grid = pure SDP relay (no WebRTC runtime on Grid).
- **D-42-02:** P2P announce = presence-only heartbeat (no endpoint field). 5-min TTL. `POST /api/v1/p2p/announce`.
- **D-42-03:** coturn on AWS. STUN free. TURN free in v3.0 with Civic-DID HMAC-SHA1 credentials.
- **D-42-04:** Full `brain/src/noesis_brain/wire/p2p.py` module with `BrainP2PClient`.
- **D-42-05:** End-to-end SDP encryption. Brain A fetches Brain B's public key from DID Registry W3C VC, encrypts SDP blob with peer's public key before posting to Grid.
- **D-42-06:** `p2p.signal_received` = private WSS push ONLY (not in allowlist, not audit chain).
- **D-42-07:** Exactly +3 allowlist entries: `p2p.peer_announced`, `p2p.connection_opened`, `p2p.connection_closed`. Count goes 64 → 67.

### Claude's Discretion

- DB schema for P2P peer tracking (`p2p_peers` table vs column on `civic_did_registry` vs Redis-like TTL store)
- TURN credential TTL (30–60 min is standard coturn range)
- SDP blob inbox schema on Grid (table or in-memory keyed by recipient DID)
- ICE candidate relay format (whether candidate trickle is supported or only complete offer/answer)
- aiortc version pinning and Python dependency management
- coturn Docker Compose configuration and AWS networking (security group, UDP 3478)
- Whether Brain A pre-fetches peer public key lazily or eagerly at announce time

### Deferred Ideas (OUT OF SCOPE)

- TURN paid billing — permanently deferred from v3.0. v3.1+ concern.
- DHT-based decentralized P2P signaling.
- Per-operator P2P observability dashboards.
- P2P bandwidth caps (TENANT-03 mentions them; not implemented in Phase 42).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| P2P-01 | Brain announces P2P endpoint to Grid via `POST /api/v1/p2p/announce`. Grid maintains DID-to-endpoint mapping; expired after 5 min no heartbeat. | §Standard Stack: aiortc + PyNaCl. §Architecture: announce heartbeat flow. |
| P2P-02 | Grid mediates WebRTC SDP exchange via `POST /api/v1/p2p/signal/<peer-did>`. Grid sees metadata (who, when) but never message content. | §Architecture: opaque-relay SDP flow. §Pitfalls: SDP privacy invariant. |
| P2P-03 | Grid runs STUN (free); TURN (free in v3.0 with Civic-DID auth). | §Standard Stack: coturn config. §Environment: Docker + coturn. |
| P2P-04 | Brain-to-Brain content flows directly via P2P. Audit chain logs connection events only; content stays private. | §Architecture: post-ICE direct channel. §Don't Hand-Roll: RTCDataChannel. |
| P2P-05 | Sole-producer for 3 audit events: `p2p.peer_announced`, `p2p.connection_opened`, `p2p.connection_closed`. Closed-tuple payloads with hash-only DID pairs. | §Architecture: sole-producer triad. §Code Examples: audit payload shapes. |
</phase_requirements>

---

## Summary

Phase 42 ships Grid-mediated WebRTC signaling infrastructure. Grid acts as a pure SDP relay: it stores encrypted SDP blobs and pushes delivery notifications to the correct recipient Brain, but cannot read the content. Brain-to-Brain communication (dialogue, trade negotiation, skill teaching) flows directly via WebRTC data channels after ICE negotiation completes through the Grid relay. Grid also hosts coturn (STUN + TURN) for NAT traversal.

**Critical discovery (public key gap):** The existing W3C VC `credentialSubject` in `vc-builder.ts` does NOT include the Brain's public key. The `civic_did_registry` table also does NOT have a dedicated public key column — only `credential_json` (the full VC). D-42-05 requires Brain A to fetch Brain B's public key from the DID Registry. Phase 42 must add a `public_key_jwk` field to the Civic-DID VC `credentialSubject` AND add a `existence_public_key_jwk` column (JSON) to `civic_did_registry` migration v32. This is new work, not pre-existing infrastructure.

**aiortc dependency footprint:** aiortc 1.13.0 requires PyAV (`av>=14.0.0`) which ships FFmpeg binaries in its wheel — no system FFmpeg needed. It also requires `cryptography>=44.0.0`. These are significant additions to `brain/pyproject.toml`. The data-channel-only fork (`aiortc-datachannel-only 1.3.2.post3`) is too stale (2022) to recommend. Use full aiortc 1.13.0 and accept the footprint.

**aiortc does not support trickle ICE.** The library gathers all ICE candidates before `setLocalDescription()` completes (or requires a polling loop on `iceGatheringState == "complete"`). The planner should choose the "complete offer/answer only" model — no trickle ICE signaling protocol needed on the Grid SDP inbox.

**Primary recommendation:** Ship Grid P2P routes (5 Fastify routes, migration v32, sole producers ×3, per-DID WSS push extension) and Brain `wire/p2p.py` module (`BrainP2PClient`) with PyNaCl SealedBox encryption in a single coherent wave.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| P2P announce / peer presence store | API / Backend (Grid) | — | Grid is the shared registry; Brain is ephemeral |
| SDP relay (opaque blob store) | API / Backend (Grid) | — | Grid relays blobs without reading content |
| SDP encryption / decryption | Brain (local) | — | Private key lives on Brain; Grid is opaque |
| Per-DID WSS signal push | API / Backend (Grid) | — | Extends existing WsFirehoseHub per-DID context |
| STUN / TURN NAT traversal | CDN / Static (coturn sidecar) | — | Network infrastructure, not application logic |
| ICE negotiation / WebRTC | Brain (local) | — | aiortc runs on Brain, not Grid |
| Post-ICE data channel messages | Brain (local, direct P2P) | — | Grid is NOT in the path after ICE completes |
| Audit: connection events | API / Backend (Grid) | — | Grid is the sole audit chain producer |
| Peer public key lookup | API / Backend (Grid) | — | DID Registry route `GET /api/v1/registry/civic-did/:did` |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| aiortc | 1.13.0 [VERIFIED: pip index] | Python WebRTC — RTCPeerConnection, RTCDataChannel, SDP offer/answer | Only production-grade Python WebRTC library; actively maintained (2025-10-13 release) |
| PyNaCl | >=1.6.2 [VERIFIED: brain/pyproject.toml] | SDP encryption via SealedBox; Ed25519→X25519 key conversion | Already a brain dependency; provides `VerifyKey.to_curve25519_public_key()` |
| coturn | 4.6.3 [CITED: metered.ca/blog coturn Docker guide] | STUN + TURN NAT traversal server | Industry standard open-source TURN server |
| PyAV (av) | >=14.0.0 [VERIFIED: aiortc-1.13.0 wheel metadata] | Media codec layer required by aiortc | Ships FFmpeg binaries in wheel; no system install needed |
| cryptography | >=44.0.0 [VERIFIED: aiortc-1.13.0 wheel metadata] | TLS/DTLS primitives used by aiortc | Standard pyca cryptography library |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| aioice | >=0.10.1,<1.0.0 [VERIFIED: aiortc wheel metadata] | ICE candidate gathering (transitive dep of aiortc) | Pulled automatically |
| pyee | >=13.0.0 [VERIFIED: aiortc wheel metadata] | EventEmitter for RTCPeerConnection events | Pulled automatically |
| pylibsrtp | >=0.10.0 [VERIFIED: aiortc wheel metadata] | SRTP media encryption (transitive) | Pulled automatically |
| pyopenssl | >=25.0.0 [VERIFIED: aiortc wheel metadata] | DTLS for data channel security | Pulled automatically |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| aiortc 1.13.0 | aiortc-datachannel-only 1.3.2.post3 | data-channel-only is stale (2022, based on aiortc 1.3.2) — missing 2 years of fixes; not recommended |
| Full coturn | stunserver | stunserver is STUN-only; no TURN relay capability |
| PyNaCl SealedBox | `cryptography` library ECIES | PyNaCl is already a brain dep; SealedBox is simpler; Ed25519→X25519 conversion built-in |

**Installation (brain/pyproject.toml additions):**
```bash
# Add to brain/pyproject.toml [project].dependencies:
"aiortc>=1.13.0,<2",   # brings av + cryptography + aioice + pyee + pylibsrtp + pyopenssl

# PyNaCl already present at >=1.6.2 — no change needed
```

**Version verification:**
- aiortc latest: 1.13.0 [VERIFIED: `pip3 index versions aiortc 2>/dev/null`]
- PyNaCl in brain: >=1.6.2,<2 [VERIFIED: brain/pyproject.toml line 17]
- PyAV bundled FFmpeg: yes, no system install [CITED: pypi.org/project/av + PyAV-Org GitHub]

---

## Architecture Patterns

### System Architecture Diagram

```
Brain A (Operator Machine)          Grid (Henry's AWS)              Brain B (Operator Machine)
│                                   │                                │
│  1. POST /p2p/announce             │                                │
│─────────────────────────────────►│                                │
│                                   │ stores {civic_did, last_seen}  │
│                                   │ (p2p_peers table, 5-min TTL)   │
│                                   │                                │
│  2. GET /registry/civic-did/:B    │                                │
│─────────────────────────────────►│                                │
│◄──── credentialJson (VC w/ pubkey)│                                │
│                                   │                                │
│  [Brain A: generate SDP offer]    │                                │
│  [encrypt with B's X25519 pubkey] │                                │
│                                   │                                │
│  3. POST /p2p/signal/:B-did        │                                │
│    {blob: "<encrypted SDP>"}      │                                │
│─────────────────────────────────►│                                │
│◄──── {connection_id: "<uuid>"}    │  mints connection_id           │
│                                   │  stores blob in sdp_inbox      │
│                                   │  logs from_did_hash/to_did_hash│
│                                   │  appends p2p.connection_opened │
│                                   │  pushes p2p.signal_received ──►│ (WSS per-DID, NOT audit chain)
│                                   │                                │
│                                   │          4. GET /p2p/signal/inbox
│                                   │◄───────────────────────────────│
│                                   │──── {blob: "<encrypted SDP>"}─►│
│                                   │                                │
│                                   │          [Brain B: decrypt SDP]│
│                                   │          [generate SDP answer] │
│                                   │          [encrypt w/ A's pubkey]│
│                                   │                                │
│                                   │   5. POST /p2p/signal/:A-did    │
│  p2p.signal_received push ◄───────│◄───────────────────────────────│
│                                   │                                │
│  6. GET /p2p/signal/inbox          │                                │
│─────────────────────────────────►│                                │
│◄──── {blob: "<encrypted answer>"} │                                │
│                                   │                                │
│  [Decrypt → RTCPeerConnection]    │                                │
│  [ICE negotiation via coturn]     │                                │
│       ◄────────────── STUN/TURN ─────────────────────────────────►│
│                                   │                                │
│  ◄══════════════ WebRTC DataChannel (direct, Grid is NOT in path) ►│
│                                   │                                │
│  [BrainAction JSON over channel]  │                                │
│                                   │                                │
│  7. POST /p2p/signal/:B-did        │                                │
│    {event: "close", connection_id} │                                │
│─────────────────────────────────►│                                │
│                                   │ appends p2p.connection_closed  │
```

### Recommended Project Structure (new files only)

```
grid/src/
├── p2p/
│   ├── p2p-peer-store.ts         # TTL-aware peer presence store
│   ├── sdp-inbox-store.ts        # SDP blob inbox (in-memory or DB)
│   ├── turn-credentials.ts       # HMAC-SHA1 time-limited credential generator
│   └── types.ts                  # P2P domain types
├── audit/
│   ├── append-p2p-peer-announced.ts     # sole producer #65
│   ├── append-p2p-connection-opened.ts  # sole producer #66
│   └── append-p2p-connection-closed.ts  # sole producer #67
└── api/routes/
    └── p2p.ts                    # 5 routes: announce, peers/:did, signal/:did, signal/inbox, turn-credentials

brain/src/noesis_brain/wire/
└── p2p.py                        # BrainP2PClient (new module)

grid/test/p2p/
├── p2p-routes.test.ts
├── p2p-peer-store.test.ts
├── turn-credentials.test.ts
└── p2p-producer-boundary.test.ts

brain/test/wire/
└── test_p2p.py
```

### Pattern 1: aiortc Complete Offer/Answer (no trickle ICE)

**What:** Generate SDP offer/answer with all ICE candidates bundled (gathered before returning). aiortc does not support trickle ICE — `iceGatheringState` must be `"complete"` before sending.
**When to use:** Always — the Grid SDP inbox model assumes a complete SDP blob, not an incremental candidate stream.

```python
# Source: Context7 /aiortc/aiortc + GitHub issue #1344 (trickle not supported)
import asyncio
from aiortc import RTCPeerConnection, RTCConfiguration, RTCIceServer, RTCSessionDescription

async def create_offer_with_gathered_candidates(
    stun_url: str,
    turn_url: str,
    turn_username: str,
    turn_credential: str,
) -> str:
    """Create SDP offer with all ICE candidates bundled (complete-offer-only model)."""
    config = RTCConfiguration(
        iceServers=[
            RTCIceServer(urls=stun_url),
            RTCIceServer(
                urls=turn_url,
                username=turn_username,
                credential=turn_credential,
            ),
        ]
    )
    pc = RTCPeerConnection(configuration=config)
    channel = pc.createDataChannel("brain-link")

    offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    # Wait for ICE gathering to complete — aiortc does NOT trickle
    # All candidates are bundled in localDescription.sdp once complete.
    while pc.iceGatheringState != "complete":
        await asyncio.sleep(0.05)

    # Return the SDP string with candidates embedded
    sdp_string = pc.localDescription.sdp
    return sdp_string
```

### Pattern 2: PyNaCl SealedBox SDP Encryption (Ed25519→X25519 conversion)

**What:** Encrypt SDP blob to peer's public key. The W3C VC stores the peer's Ed25519 public key (JWK format from `existence_public_key_jwk`). PyNaCl provides `VerifyKey.to_curve25519_public_key()` to convert Ed25519 verify key to X25519 for encryption.
**When to use:** Before posting any SDP blob to Grid via `POST /api/v1/p2p/signal/:peer-did`.

```python
# Source: VERIFIED via PyNaCl 1.6.2 API — VerifyKey.to_curve25519_public_key() exists
# Source: pynacl.readthedocs.io/en/latest/public/ — SealedBox API
import base64
import json
from nacl.public import SealedBox
from nacl.signing import VerifyKey

def encrypt_sdp_for_peer(sdp_string: str, peer_public_key_jwk: dict) -> bytes:
    """Encrypt SDP string to peer's public key (anonymous sealed encryption).

    peer_public_key_jwk: the Ed25519 JWK from the peer's W3C VC credentialSubject.
    Returns: encrypted bytes (SealedBox ciphertext, includes ephemeral public key).
    """
    # Decode the Ed25519 raw public key from JWK format
    # JWK Ed25519: {"kty": "OKP", "crv": "Ed25519", "x": "<base64url>"}
    raw_ed25519_bytes = base64.urlsafe_b64decode(
        peer_public_key_jwk["x"] + "=="  # pad for base64
    )
    # Convert Ed25519 verify key to X25519 for SealedBox encryption
    verify_key = VerifyKey(raw_ed25519_bytes)
    x25519_public_key = verify_key.to_curve25519_public_key()

    sealed = SealedBox(x25519_public_key)
    return sealed.encrypt(sdp_string.encode())


def decrypt_sdp_from_peer(encrypted_blob: bytes, my_signing_key) -> str:
    """Decrypt SDP blob using our X25519 private key (derived from Ed25519 signing key).

    my_signing_key: nacl.signing.SigningKey (the Brain's existence key).
    """
    x25519_private_key = my_signing_key.to_curve25519_private_key()
    unsealed = SealedBox(x25519_private_key)
    return unsealed.decrypt(encrypted_blob).decode()
```

### Pattern 3: coturn HMAC-SHA1 Time-Limited Credentials

**What:** Generate short-lived TURN credentials using shared secret. coturn validates these without a database — stateless.
**When to use:** `GET /api/v1/p2p/turn-credentials` handler on Grid.

```typescript
// Source: CITED coturn/coturn wiki (turnserver.conf) + medium.com/@BeingOttoman/coturn-rest-api
import { createHmac } from 'node:crypto';

const TURN_TTL_SECONDS = 3600; // 1 hour (within 30–60 min standard range; use 1h for v3.0)
const TURN_REALM = 'noesis.grid';

/**
 * Generate coturn REST API time-limited HMAC-SHA1 credentials.
 * username = "<unix_timestamp_at_expiry>:<civic_did>"
 * password = base64(HMAC-SHA1(sharedSecret, username))
 */
export function generateTurnCredentials(
    civicDid: string,
    sharedSecret: string,
): { username: string; password: string; ttl: number; realm: string } {
    const expiry = Math.floor(Date.now() / 1000) + TURN_TTL_SECONDS;
    const username = `${expiry}:${civicDid}`;
    const password = createHmac('sha1', sharedSecret)
        .update(username)
        .digest('base64');
    return { username, password, ttl: TURN_TTL_SECONDS, realm: TURN_REALM };
}
```

### Pattern 4: Per-DID WSS Signal Push (extending WsFirehoseHub)

**What:** Push `p2p.signal_received` frame ONLY to the recipient Brain's WSS connection. This is NOT an audit chain event — it is a private real-time notification.
**When to use:** Grid route `POST /api/v1/p2p/signal/:peer-did` calls hub's new `pushToDid()` method.

```typescript
// Source: VERIFIED via grid/src/audit/firehose-hub.ts — ClientConnection.didContext exists
// WsFirehoseHub already has per-subscriber didContext. New method pushes to ONE specific DID.

// New method on WsFirehoseHub (does NOT go through audit chain, NOT allowlist-gated):
pushSignalToDid(recipientDid: string, frame: object): void {
    const payload = JSON.stringify(frame);
    for (const client of this._clients) {
        if (client.didContext?.did === recipientDid) {
            try {
                client.socket.send(payload);
                this.metrics.frames_sent_total++;
                this.metrics.touchLastFrame();
            } catch {
                /* swallow broken socket */
            }
        }
    }
}
```

### Pattern 5: coturn Docker Compose

**What:** Add coturn as a sidecar service in `docker-compose.yml` alongside Grid.
**When to use:** Development and production deploy.

```yaml
# Source: CITED metered.ca/blog/running-coturn-in-docker-a-step-by-step-guide/
# Source: CITED coturn/coturn wiki (turnserver man page)
  coturn:
    image: coturn/coturn:4.6.3
    ports:
      - "3478:3478"          # STUN + TURN TCP
      - "3478:3478/udp"      # STUN + TURN UDP
      - "5349:5349"          # TURNS TCP (TLS)
      - "5349:5349/udp"      # TURNS UDP
      - "49152-65535:49152-65535/udp"  # TURN relay range
    environment:
      DETECT_EXTERNAL_IP: "yes"
      STATIC_AUTH_SECRET: "${TURN_STATIC_AUTH_SECRET}"
    command: >
      -f
      --use-auth-secret
      --realm=noesis.grid
      --min-port=49152
      --max-port=65535
      --no-multicast-peers
      --denied-peer-ip=10.0.0.0-10.255.255.255
      --denied-peer-ip=192.168.0.0-192.168.255.255
      --denied-peer-ip=172.16.0.0-172.31.255.255
    healthcheck:
      test: ["CMD-SHELL", "turnutils_uclient -T stun.l.google.com 2>/dev/null || true"]
      interval: 30s
      timeout: 10s
      retries: 3
```

**coturn turnserver.conf key options [CITED: coturn/coturn wiki]:**
- `--use-auth-secret` — enables REST API HMAC-SHA1 time-limited credentials (no database needed)
- `--static-auth-secret=<secret>` — the shared secret (passed via `STATIC_AUTH_SECRET` env)
- `--realm=noesis.grid` — required for REST API credentials
- `-f` / `--fingerprint` — adds STUN fingerprinting (required for WebRTC)
- `--min-port=49152 --max-port=65535` — TURN relay UDP range (AWS security group must open this)

### Pattern 6: P2P Peer Store (TTL-aware, in-memory with periodic cleanup)

**What:** Store active peer announcements in-memory with 5-minute TTL. Avoids DB writes on every 5-min heartbeat. Grid restart clears peers — acceptable since Brains re-announce on reconnect (Phase 41 reconnect flow).

```typescript
// Source: ASSUMED — standard in-memory TTL map pattern
const P2P_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface PeerEntry {
    civicDid: string;
    lastSeenAt: number;  // Date.now()
    lastSeenTick: number;
}

class P2PPeerStore {
    private peers = new Map<string, PeerEntry>();

    announce(civicDid: string, tick: number): void {
        this.peers.set(civicDid, { civicDid, lastSeenAt: Date.now(), lastSeenTick: tick });
    }

    getStatus(civicDid: string): { status: 'online' | 'offline'; last_seen_at?: string } {
        const entry = this.peers.get(civicDid);
        if (!entry) return { status: 'offline' };
        if (Date.now() - entry.lastSeenAt > P2P_TTL_MS) {
            this.peers.delete(civicDid);
            return { status: 'offline' };
        }
        return { status: 'online', last_seen_at: new Date(entry.lastSeenAt).toISOString() };
    }

    cleanup(): void {
        const now = Date.now();
        for (const [did, entry] of this.peers) {
            if (now - entry.lastSeenAt > P2P_TTL_MS) this.peers.delete(did);
        }
    }
}
```

**Recommendation (Claude's Discretion):** Use in-memory `P2PPeerStore`. Rationale:
- Peer heartbeats are 5-min intervals — DB writes would add latency on critical path
- Grid restart clears peers — fine, Brains re-announce within 5 min (Phase 41 reconnect handles this)
- No cross-Grid need in v3.0 (single Grid)
- Schedule `cleanup()` every 60s in GenesisLauncher (pair clearInterval per OBS-R-32-02 pattern)

### Pattern 7: SDP Inbox Schema (in-memory keyed by recipient DID)

**Recommendation (Claude's Discretion):** Use in-memory `SdpInboxStore` (Map keyed by recipient DID → array of blobs with connection_id and expiry). Rationale:
- SDP blobs are ephemeral (consumed within seconds of ICE negotiation)
- Storing in DB adds migration + cleanup complexity
- If Grid restarts mid-handshake, Brain will retry (5-min TTL on peer prevents stale connections)
- Inbox TTL: 60 seconds per entry (if Brain doesn't fetch within 60s, the offer is abandoned)

```typescript
interface InboxEntry {
    connectionId: string;
    fromDid: string;
    encryptedBlob: string;   // base64-encoded ciphertext
    expiresAt: number;       // Date.now() + 60_000
}

class SdpInboxStore {
    private inbox = new Map<string, InboxEntry[]>();

    push(toDid: string, entry: InboxEntry): void {
        const entries = this.inbox.get(toDid) ?? [];
        entries.push(entry);
        this.inbox.set(toDid, entries);
    }

    drain(toDid: string): InboxEntry[] {
        // Returns all non-expired entries and clears them
        const entries = (this.inbox.get(toDid) ?? [])
            .filter(e => e.expiresAt > Date.now());
        this.inbox.delete(toDid);
        return entries;
    }
}
```

### Pattern 8: Sole-Producer Audit Events (three new files)

Following the established triad: closed-tuple payload + `payloadPrivacyCheck` + `audit.append`.

**`p2p.peer_announced`** — emitted from `POST /api/v1/p2p/announce` handler:
```typescript
// Closed 3-key payload (alphabetical): civic_did_hash, endpoint_hash, tick
// endpoint_hash = sha256("online") — static hash, satisfies "hash of presence" requirement
// civic_did = sha256(civicDid) — DID is hashed in audit, per hash-only discipline
const payload = {
    civic_did_hash: sha256Hex(civicDid),
    endpoint_hash: sha256Hex('online'),
    tick,
};
```

**`p2p.connection_opened`** — emitted from `POST /api/v1/p2p/signal/:peer-did` handler (first signal):
```typescript
// Closed 4-key payload (alphabetical): connection_id, from_did_hash, tick, to_did_hash
const payload = {
    connection_id: connectionId,   // UUID, not sensitive
    from_did_hash: sha256Hex(fromDid),
    tick,
    to_did_hash: sha256Hex(toDid),
};
```

**`p2p.connection_closed`** — emitted from `POST /api/v1/p2p/signal/:peer-did` with `{event: "close"}`:
```typescript
// Closed 4-key payload (alphabetical): close_reason, connection_id, duration_ticks, tick
const payload = {
    close_reason: closeReason,  // ∈ {'completed', 'timeout', 'error', 'initiated'}
    connection_id: connectionId,
    duration_ticks: durationTicks,
    tick,
};
```

### Anti-Patterns to Avoid

- **Trickle ICE on Grid:** Do NOT implement an ICE candidate exchange endpoint. aiortc gathers all candidates before returning the SDP. Grid only needs one `POST /p2p/signal/:did` per direction.
- **Audit chain for `p2p.signal_received`:** This event is private WSS push ONLY. Adding it to ALLOWLIST_MEMBERS would broadcast it to all subscribers — a privacy violation.
- **Grid WebRTC runtime:** Grid does NOT run aiortc. Grid is a pure HTTP/WS relay. No `RTCPeerConnection` on the Grid server.
- **SDP blob in audit payload:** The encrypted SDP blob must NEVER appear in any audit payload. Only `connection_id`, `tick`, and hashed DIDs cross the chain.
- **Storing peer public key only in VC body:** The `GET /api/v1/registry/civic-did/:did` endpoint returns the full `credentialJson` which IS stored. Brain must parse `credential.credentialSubject.existencePublicKeyJwk` from the returned VC. Phase 42 must ensure this field is written at registration time (migration v32 adds a dedicated column; vc-builder.ts must be updated to include the public key in `credentialSubject`).

---

## Critical Gap: Public Key Storage

[VERIFIED: reading `grid/src/civic-registry/vc-builder.ts` and `grid/src/db/schema.ts` migration v23]

**Current state:**
- `civic_did_registry` table has NO `public_key` column
- `vc-builder.ts` `buildCivicDidVc()` does NOT include any public key in `credentialSubject`
- `registry.ts` accepts `existence_public_key_jwk` in the request body but does NOT store it — it only verifies the signature, then discards the JWK

**Required by D-42-05:** Brain A must fetch Brain B's public key from `GET /api/v1/registry/civic-did/<B-did>`. This requires the public key to be in the returned VC.

**Resolution — Phase 42 must implement:**

1. **Migration v32** — add `existence_public_key_jwk JSON NOT NULL` column to `civic_did_registry`
2. **`vc-builder.ts` update** — add `existencePublicKeyJwk` to `buildCivicDidVc()` params and to `credentialSubject`
3. **`registry.ts` update** — save the JWK to the new column on `store.insert()` and pass it to `buildCivicDidVc()`
4. **`civic-did-store.ts` update** — `insert()` signature gains `existencePublicKeyJwk` param

This is ~20 lines of change across 4 files, but is a load-bearing prerequisite for D-42-05 SDP encryption.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebRTC SDP negotiation | Custom SDP parser/generator | `aiortc.RTCPeerConnection` | SDP format is complex; ICE state machine is ~10K lines of spec |
| NAT traversal | Custom STUN/TURN server | `coturn` | TURN protocol is a 100+ page RFC with security implications |
| SDP encryption | Custom ECDH key exchange | `nacl.public.SealedBox` + `VerifyKey.to_curve25519_public_key()` | Cryptographic primitives — hand-rolling is dangerous |
| HMAC-SHA1 credential generation | Custom token system | coturn REST API mode (`--use-auth-secret`) | Standard; coturn validates these natively without DB |
| ICE trickle state machine | Incremental candidate accumulator on Grid | Complete offer/answer model (no trickle) | aiortc doesn't support trickle; complete-offer is simpler |

**Key insight:** The WebRTC spec is 1400+ pages. ICE negotiation handles NAT types (full cone, symmetric, restricted), candidate prioritization, connectivity checks, and DTLS fingerprint exchange. None of this is hand-rollable safely.

---

## Common Pitfalls

### Pitfall 1: Sending SDP Before ICE Gathering Complete

**What goes wrong:** Brain posts SDP offer to Grid immediately after `setLocalDescription()`. The SDP contains no ICE candidates. Brain B tries to connect and fails.
**Why it happens:** `setLocalDescription()` triggers gathering asynchronously; the SDP returned may be incomplete.
**How to avoid:** Poll `pc.iceGatheringState` until it equals `"complete"` before serializing `pc.localDescription.sdp`. [VERIFIED: aiortc GitHub issues #1084, #1344]
**Warning signs:** SDP blob has no `a=candidate:` lines.

### Pitfall 2: Using Ed25519 Key Directly for Encryption

**What goes wrong:** Attempting to use the Brain's Ed25519 signing key (JWK `crv: "Ed25519"`) directly with RSA or ECDH encryption — these are different key types.
**Why it happens:** Confusion between signing (Ed25519) and encryption (X25519/Curve25519).
**How to avoid:** Always convert: `VerifyKey(raw_bytes).to_curve25519_public_key()` for sender; `SigningKey(...).to_curve25519_private_key()` for receiver. PyNaCl 1.6.2+ provides these methods. [VERIFIED: PyNaCl pypi.org + pynacl.readthedocs.io]
**Warning signs:** `TypeError: Invalid key type` when constructing SealedBox.

### Pitfall 3: Missing `p2p.signal_received` vs `p2p.connection_opened` Distinction

**What goes wrong:** Adding `p2p.signal_received` to `ALLOWLIST_MEMBERS` — broadcasts private signal notifications to ALL WSS subscribers.
**Why it happens:** Conflating the private WSS push (signal notification) with the public audit chain event (connection opened).
**How to avoid:** D-42-06 is explicit: `p2p.signal_received` is NEVER in the allowlist. It uses `hub.pushSignalToDid()` which bypasses `onAuditEvent()` entirely. The audit-chain event is `p2p.connection_opened` (emitted separately on first signal relay).
**Warning signs:** `ALLOWLIST_MEMBERS.length !== 67` after Phase 42.

### Pitfall 4: SDP Blob Privacy Leak in Audit Payload

**What goes wrong:** Sole-producer for `p2p.connection_opened` includes the `encrypted_blob` field. `payloadPrivacyCheck` might not catch this (it checks key names, not values), but SDP contains endpoint information.
**Why it happens:** Temptation to include debugging info in audit payload.
**How to avoid:** Audit payload for `p2p.connection_opened` contains ONLY `{connection_id, from_did_hash, to_did_hash, tick}` — no blob, no size, no endpoint hints.
**Warning signs:** `payloadPrivacyCheck` passing but SDP content visible in audit stream.

### Pitfall 5: coturn Private IP Relay Abuse (SSRF)

**What goes wrong:** TURN server allows relay connections to internal AWS/VPC IP ranges — potential SSRF attack surface.
**Why it happens:** Default coturn config has no IP deny-list.
**How to avoid:** Add `--denied-peer-ip` for RFC 1918 ranges (10.x, 192.168.x, 172.16-31.x) and 127.0.0.0/8 in coturn command. [CITED: coturn wiki security recommendations]
**Warning signs:** TURN relay connects to Grid internal IP.

### Pitfall 6: P2P Announce Cadence Conflicts With Phase 41 Presence

**What goes wrong:** Brain sends P2P announce every 60s (same cadence as Phase 41 presence heartbeat) — emits `p2p.peer_announced` 5× more often than intended (5-min TTL suggests 1 announce per 5 min).
**Why it happens:** Confusion between presence heartbeat (60s, `POST /api/v1/civic/presence`) and P2P announce (5-min, `POST /api/v1/p2p/announce`).
**How to avoid:** P2P announce uses a SEPARATE asyncio task with 5-min cadence. The 60s presence heartbeat (`BrainApp.post_presence_heartbeat`) is UNCHANGED. Two independent asyncio tasks, two different cadences.
**Warning signs:** `p2p.peer_announced` audit events appearing every 60s instead of every 5 min.

### Pitfall 7: aiortc Heavy Dependency (av/PyAV footprint)

**What goes wrong:** `aiortc>=1.13.0` requires `av>=14.0.0` (PyAV with bundled FFmpeg) — adds ~80MB to Brain's installed package size. May cause slow CI in Docker builds.
**Why it happens:** aiortc uses PyAV for media codec support even when only data channels are needed.
**How to avoid:** PyAV wheels ship bundled FFmpeg binaries — no system install needed. Accept the size. Cache pip install in Dockerfile. Alternative (`aiortc-datachannel-only`) is too stale. [CITED: pypi.org/project/av + PyAV-Org github.com/pyav-org/pyav-ffmpeg]
**Warning signs:** `pip install aiortc` fails on systems without libav — should not happen with binary wheels.

---

## Runtime State Inventory

Phase 42 is a new-feature phase (not a rename/refactor). However, one runtime consideration exists:

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `civic_did_registry` rows missing `existence_public_key_jwk` (all existing rows from Phase 37) | Migration v32 adds column with NULL allowed for existing rows; new registrations populate it |
| Live service config | coturn: new Docker service (not yet deployed) | Add to docker-compose.yml; AWS security group: open UDP 3478 + UDP 49152-65535 |
| OS-registered state | None | None |
| Secrets/env vars | `TURN_STATIC_AUTH_SECRET` — new env var needed in `.env` and Grid env config | Add to `.env.example`, Grid Docker env |
| Build artifacts | Brain Docker image will grow ~80MB (PyAV bundled FFmpeg) | Layer cache in Dockerfile.brain |

**Migration v32 NULL handling:** Existing `civic_did_registry` rows from Phase 37 will have `existence_public_key_jwk = NULL`. Brain MUST handle this gracefully: if public key is NULL in the VC, fall back to Grid messaging (Phase 41 queue) rather than P2P. Phase 42 does NOT retroactively backfill Phase 37 registrations — operators must re-register to get P2P capability (acceptable for v3.0, document in VERIFICATION.md).

---

## Code Examples

### BrainP2PClient structure (following GridWireClient pattern)

```python
# Source: VERIFIED via brain/src/noesis_brain/wire/client.py (GridWireClient pattern)
# brain/src/noesis_brain/wire/p2p.py

class BrainP2PClient:
    """Phase 42 P2P-01..05 — WebRTC signaling client for Brain-to-Brain communication.

    Follows GridWireClient conventions:
    - Shares the same httpx.AsyncClient (passed in, not created internally)
    - Uses TokenManager for bearer auth
    - Logs at WARNING on errors; NEVER raises to caller
    - Separate asyncio.Task for 5-min announce heartbeat
    """

    def __init__(
        self,
        *,
        grid_url: str,
        token_manager: TokenManager,
        civic_did: str,
        signing_key,       # nacl.signing.SigningKey (Brain's existence key)
        client: httpx.AsyncClient,
    ) -> None: ...

    async def announce(self, tick: int) -> None:
        """POST /api/v1/p2p/announce every 5 minutes."""
        ...

    async def get_peer_status(self, peer_did: str) -> dict:
        """GET /api/v1/p2p/peers/<did> — check if peer is online before signaling."""
        ...

    async def get_peer_public_key(self, peer_did: str) -> dict | None:
        """GET /api/v1/registry/civic-did/<did> — fetch peer's existence public key JWK."""
        ...

    async def initiate_connection(
        self, peer_did: str, tick: int
    ) -> tuple[str, "RTCPeerConnection"]:
        """Full offer flow: fetch pubkey → generate offer → encrypt → post signal.
        Returns (connection_id, pc) for the caller to hold and use the data channel.
        """
        ...

    async def handle_signal_received(self, frame: dict) -> None:
        """Called by WssSubscriber when frame.type == 'p2p.signal_received'.
        Fetches inbox, decrypts SDP, generates answer or completes ICE.
        """
        ...

    async def get_turn_credentials(self) -> dict:
        """GET /api/v1/p2p/turn-credentials — fetch short-lived TURN creds."""
        ...
```

### Grid P2P Routes (5 new routes)

```typescript
// Source: VERIFIED via grid/src/api/routes/civic-presence.ts (pattern reference)
// grid/src/api/routes/p2p.ts

// [P2P-01] POST /api/v1/p2p/announce — civic_did_required (Brain JWT)
// Body: {} (civic_did extracted from bearer JWT)
// Response: { status: 'announced', next_announce_in: 300 }
// Side effects: P2PPeerStore.announce(); appendP2pPeerAnnounced() sole-producer

// [P2P-01] GET /api/v1/p2p/peers/:civicDid — visitor_public
// Response: { status: 'online'|'offline', last_seen_at?: ISO }

// [P2P-02] POST /api/v1/p2p/signal/:peerDid — civic_did_required (Brain JWT)
// Body: { encrypted_blob: string, event?: 'close', connection_id?: string, close_reason?: string }
// Response: { connection_id: string }
// Side effects:
//   - First signal (no event field or event='offer'|'answer'): SdpInboxStore.push(); hub.pushSignalToDid(); appendP2pConnectionOpened()
//   - Event='close': appendP2pConnectionClosed()

// [P2P-02] GET /api/v1/p2p/signal/inbox — civic_did_required (Brain JWT)
// Response: { signals: [{ connection_id, from_did, encrypted_blob }] }
// Side effects: SdpInboxStore.drain(myDid)

// [P2P-03] GET /api/v1/p2p/turn-credentials — civic_did_required (Brain JWT)
// Response: { username, password, ttl, realm, uris: ['turn:...', 'stun:...'] }
// No side effects (TURN is free; no Bios deduction in v3.0)
```

### ROUTE_DID_POLICY additions (5 entries)

```typescript
// Source: VERIFIED via grid/src/api/policy.ts — existing pattern
// Add to ROUTE_DID_POLICY:
'POST /api/v1/p2p/announce':             'civic_did_required',  // Brain JWT heartbeat
'GET /api/v1/p2p/peers/:civicDid':       'visitor_public',       // public peer lookup
'POST /api/v1/p2p/signal/:peerDid':      'civic_did_required',  // Brain JWT signal relay
'GET /api/v1/p2p/signal/inbox':          'civic_did_required',  // Brain JWT inbox
'GET /api/v1/p2p/turn-credentials':      'civic_did_required',  // Brain JWT TURN
```

### WssSubscriber frame handler for `p2p.signal_received`

```python
# Source: VERIFIED via brain/src/noesis_brain/wire/subscriber.py (on_frame pattern)
# Extend WssSubscriber's existing on_frame callback routing:

async def _on_firehose_frame(self, frame: dict) -> None:
    """Route incoming WSS frames — extend existing handler in BrainApp."""
    event_type = frame.get("type") or frame.get("event_type", "")
    if event_type == "p2p.signal_received":
        # Private WSS push — not an audit entry
        await self.p2p_client.handle_signal_received(frame)
    elif event_type == "event":
        # Existing audit chain events
        ...
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| libp2p for P2P | WebRTC + aiortc (D-42-01) | 2026-05-27 (Q-V3-A resolved) | aiortc is Python-native; libp2p Go bindings have poor Python support |
| TURN paid per session | TURN free in v3.0 (D-42-03) | 2026-05-27 discuss phase | Phase 45 IRS does NOT need TURN billing logic |
| trickle ICE | Complete offer/answer only | aiortc design (no trickle support) | Simpler Grid relay; no incremental candidate exchange needed |

**Deprecated/outdated:**
- ROADMAP Phase 42 description says "TURN (paid)" — MUST be updated to "TURN (free, Civic-DID auth)" per D-42-03
- REQUIREMENTS.md P2P-03 says "TURN relay service is optional and paid by initiating Nous (Bios fee per session)" — MUST be updated to "free in v3.0" per D-42-03

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | SDP inbox 60s entry TTL is sufficient for ICE negotiation to complete | Architecture Patterns §7 | Brain B may miss signals if ICE takes >60s on slow networks — raise to 120s if needed |
| A2 | In-memory P2PPeerStore survives Grid restarts gracefully (Brains re-announce within 5 min) | Architecture Patterns §6 | If Grid restarts during active P2P session, both Brains must re-discover — acceptable for v3.0 |
| A3 | coturn `DETECT_EXTERNAL_IP: yes` correctly detects AWS public IP | Architecture Patterns §5 | On some AWS network configurations this may not work — alternative: set `--external-ip` via env var pointing to instance's EIP |
| A4 | `close_reason ∈ {'completed', 'timeout', 'error', 'initiated'}` covers all P2P session end conditions | Code Examples §audit | May need additional reason codes after integration testing |

---

## Open Questions

1. **Existing Phase 37 registrations and public key backfill**
   - What we know: Existing `civic_did_registry` rows have no `existence_public_key_jwk`
   - What's unclear: Can operators re-register their existence-DID to populate the key? Or does Phase 42 need a migration ceremony?
   - Recommendation: Document in Phase 42 VERIFICATION.md that P2P requires re-registration for Phase 37 Brains. Accept NULL = P2P unavailable for that DID.

2. **coturn AWS deployment scope**
   - What we know: coturn is added to `docker-compose.yml` (dev/test); production is AWS-hosted
   - What's unclear: Is coturn part of the same EC2 as Grid, or a separate service? UDP 49152-65535 range in docker-compose is impractical on macOS (Docker Desktop blocks large UDP port ranges)
   - Recommendation: For dev, use a public STUN server (stun.l.google.com) without TURN. Production: dedicated AWS EC2. Planner should split coturn into a Phase 42 deliverable note rather than a blocking dependency.

3. **BrainApp integration: how many concurrent P2P connections**
   - What we know: BrainP2PClient holds RTCPeerConnection per active connection
   - What's unclear: Should there be a connection limit (e.g., max 3 concurrent P2P channels per Brain)?
   - Recommendation: No limit in v3.0 (defer to TENANT-03 bandwidth caps).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| aiortc | Brain P2P module | ✗ (not yet installed) | 1.13.0 latest | None — must be installed |
| PyAV (av) | aiortc transitive dep | ✗ | 14.x+ (bundled FFmpeg wheel) | None — required by aiortc |
| coturn Docker image | STUN/TURN service | ✓ (Docker available) | 4.6.3 | Public STUN (stun.l.google.com) for dev-only, no TURN |
| Docker | coturn sidecar | ✓ | 29.4.3 [VERIFIED: `docker --version`] | — |
| Docker Compose | Multi-service deploy | ✓ | v5.1.3 [VERIFIED: `docker compose version`] | — |
| PyNaCl | SDP encryption | ✓ | >=1.6.2 (brain/pyproject.toml) [VERIFIED] | — |
| FFmpeg (system) | NOT needed (PyAV bundles it) | ✗ | — | N/A — wheel is self-contained |

**Missing dependencies with no fallback:**
- `aiortc>=1.13.0,<2` — must be added to `brain/pyproject.toml`

**Missing dependencies with fallback:**
- coturn (TURN): dev can use STUN-only mode with public STUN server — TURN required for production symmetric NAT scenarios only

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Grid framework | Vitest `^2.0.0` (package.json: `"test": "vitest run"`) [VERIFIED] |
| Brain framework | pytest + pytest-asyncio (`asyncio_mode = "auto"`) [VERIFIED: brain/pyproject.toml] |
| Grid config file | `package.json` test script (`vitest run`) — no separate vitest.config.ts found |
| Grid quick run | `cd grid && npm test` |
| Brain quick run | `cd brain && python -m pytest test/ -x` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| P2P-01 | P2P announce stores peer with 5-min TTL; expired entries return offline | unit (Grid) | `cd grid && npm test -- --grep "p2p"` | ❌ Wave 0 |
| P2P-01 | Brain announce sends correct payload every 5 min | unit (Brain) | `cd brain && python -m pytest test/wire/test_p2p.py -x` | ❌ Wave 0 |
| P2P-02 | Signal relay stores blob in inbox; pushes per-DID WSS notification | unit (Grid) | `cd grid && npm test -- --grep "p2p-signal"` | ❌ Wave 0 |
| P2P-02 | Signal inbox returned only to recipient DID | integration (Grid) | `cd grid && npm test -- --grep "p2p-inbox"` | ❌ Wave 0 |
| P2P-03 | TURN credentials are valid HMAC-SHA1 for given shared secret | unit (Grid) | `cd grid && npm test -- --grep "turn-credentials"` | ❌ Wave 0 |
| P2P-04 | `p2p.signal_received` NOT in ALLOWLIST_MEMBERS | unit (Grid) | `cd grid && npm test -- --grep "allowlist"` | ✅ (broadcast-allowlist.test.ts) |
| P2P-04 | Allowlist count === 67 after sole producers added | unit (Grid) | `cd grid && npm test -- --grep "ALLOWLIST"` | ✅ (exists, count must be updated) |
| P2P-05 | Sole-producer boundary: only `appendP2pPeerAnnounced.ts` emits `p2p.peer_announced` | unit (Grid) | `cd grid && npm test -- --grep "p2p-producer-boundary"` | ❌ Wave 0 |
| P2P-05 | Payload privacy check passes for all 3 P2P audit events | unit (Grid) | `cd grid && npm test -- --grep "p2p-payload"` | ❌ Wave 0 |
| SC4 (success criteria) | SDP blob content NOT readable by Grid (opaque relay test) | unit (Brain) | `cd brain && python -m pytest test/wire/test_p2p.py::test_sdp_opaque_to_grid -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd grid && npm test -- --grep "p2p"`
- **Per wave merge:** `cd grid && npm test && cd ../brain && python -m pytest test/ -x`
- **Phase gate:** Full suite green (all grid + brain tests) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `grid/test/p2p/p2p-routes.test.ts` — covers P2P-01, P2P-02, P2P-03 route contract
- [ ] `grid/test/p2p/p2p-peer-store.test.ts` — covers TTL expiry, cleanup
- [ ] `grid/test/p2p/turn-credentials.test.ts` — covers HMAC-SHA1 credential validity
- [ ] `grid/test/p2p/p2p-producer-boundary.test.ts` — covers P2P-05 sole-producer invariant
- [ ] `brain/test/wire/test_p2p.py` — covers BrainP2PClient announce, signal, encrypt/decrypt
- [ ] Update `grid/test/audit/broadcast-allowlist.test.ts` — update expected count to 67

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Civic-DID bearer JWT (existing `requireDid` preHandler) |
| V3 Session Management | No | P2P connections are ephemeral; no session state on Grid |
| V4 Access Control | Yes | Peer lookup is public; signal/TURN require Civic-DID |
| V5 Input Validation | Yes | Validate `encrypted_blob` is base64; validate `connection_id` UUID format |
| V6 Cryptography | Yes | PyNaCl SealedBox (libsodium) for SDP; HMAC-SHA1 for TURN (coturn standard) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| TURN relay abuse (proxy amplification) | Elevation of Privilege | Civic-DID auth required for TURN; denied-peer-ip blocks RFC 1918 (coturn config) |
| SDP spoofing (replay attack) | Tampering | `connection_id` UUID per session; SDP blobs expire in 60s |
| Signal inbox enumeration (poll other DIDs' inbox) | Information Disclosure | `GET /p2p/signal/inbox` scoped to bearer JWT's Civic-DID only (`requireDid` enforces this) |
| Peer presence fingerprinting | Information Disclosure | `GET /p2p/peers/:did` is public — acceptable; returns online/offline only, no IP |
| SDP content leakage via audit chain | Information Disclosure | Sole-producer payloads contain only hashed DIDs + connection_id; no SDP content |

---

## Sources

### Primary (HIGH confidence)

- [VERIFIED: brain/pyproject.toml] — pynacl>=1.6.2 is existing brain dependency
- [VERIFIED: grid/src/audit/broadcast-allowlist.ts] — ALLOWLIST_MEMBERS count = 64, sole-producer pattern established
- [VERIFIED: grid/src/audit/firehose-hub.ts] — WsFirehoseHub.ClientConnection.didContext exists; supports per-DID targeting
- [VERIFIED: grid/src/api/policy.ts] — ROUTE_DID_POLICY table, 5-value enum, default-deny pattern
- [VERIFIED: grid/src/civic-registry/vc-builder.ts] — credentialSubject does NOT include public key (critical gap)
- [VERIFIED: grid/src/db/schema.ts] — civic_did_registry (v23) has NO public_key column
- [VERIFIED: grid/src/civic-registry/civic-did-store.ts] — insert() does NOT save public key
- [VERIFIED: pip3 index versions aiortc] — aiortc 1.13.0 is latest
- [VERIFIED: aiortc-1.13.0-py3-none-any.whl METADATA] — exact dependency versions (av, cryptography, aioice, pyee, pylibsrtp, pyopenssl)
- [VERIFIED: Context7 /aiortc/aiortc] — RTCPeerConnection, RTCDataChannel, RTCConfiguration, iceGatheringState API
- [VERIFIED: docker --version] — Docker 29.4.3 available
- [CITED: pynacl.readthedocs.io/en/latest/public/] — SealedBox API (encrypt/decrypt)
- [CITED: coturn/coturn wiki turnserver] — `--use-auth-secret`, `--static-auth-secret`, `--realm`, `--min-port`, `--max-port`, `-f`

### Secondary (MEDIUM confidence)

- [CITED: metered.ca/blog/running-coturn-in-docker-a-step-by-step-guide/] — Docker Compose config for coturn (STATIC_AUTH_SECRET, ports)
- [CITED: github.com/aiortc/aiortc issues #1084, #1344] — aiortc does NOT support trickle ICE; must poll iceGatheringState
- [CITED: pynacl.readthedocs.io + pypi.org/project/PyNaCl] — VerifyKey.to_curve25519_public_key() and SigningKey.to_curve25519_private_key() exist in PyNaCl 1.6.2+
- [CITED: pypi.org/project/av] — PyAV wheels include bundled FFmpeg binaries (no system install needed)
- [CITED: github.com/PyAV-Org/pyav-ffmpeg] — binary FFmpeg builds for PyAV wheels confirmed

### Tertiary (LOW confidence)

- [ASSUMED] P2PPeerStore in-memory with 5-min TTL and cleanup every 60s — standard pattern, not verified against a specific reference
- [ASSUMED] SdpInboxStore in-memory with 60s entry TTL — reasonable guess for ICE negotiation latency budget
- [ASSUMED] `close_reason ∈ {'completed', 'timeout', 'error', 'initiated'}` — derived from WebRTC spec close scenarios

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — aiortc version verified from pip index + wheel metadata; PyNaCl verified from existing pyproject.toml
- Architecture: HIGH — based on verified codebase patterns (firehose-hub.ts, whisper sole-producer, ROUTE_DID_POLICY)
- Critical gap (public key storage): HIGH — verified by reading vc-builder.ts, schema.ts, and civic-did-store.ts
- Pitfalls: HIGH (2–5) / MEDIUM (1, 7) — WebRTC ICE behavior cited from aiortc issues; footprint cited from wheel metadata
- coturn config: MEDIUM — cited from official wiki and Docker guide; HMAC-SHA1 credential format verified via medium.com citation

**Research date:** 2026-05-28
**Valid until:** 2026-06-28 (aiortc releases infrequently; coturn is stable; PyNaCl is stable)
