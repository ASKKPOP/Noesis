# Phase 42: P2P Infrastructure — Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 18 new/modified files
**Analogs found:** 17 / 18

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `grid/src/db/schema.ts` | config/migration | CRUD | `grid/src/db/schema.ts` v23 / v30 | exact |
| `grid/src/civic-registry/vc-builder.ts` | service | transform | `grid/src/civic-registry/vc-builder.ts` (self — modify `buildCivicDidVc`) | exact |
| `grid/src/civic-registry/civic-did-store.ts` | service | CRUD | `grid/src/civic-registry/civic-did-store.ts` (self — modify `insert`) | exact |
| `grid/src/p2p/p2p-peer-store.ts` | service | event-driven | `grid/src/civic-presence/presence-service.ts` (TTL map pattern) | role-match |
| `grid/src/p2p/sdp-inbox-store.ts` | service | request-response | `grid/src/civic-presence/presence-service.ts` | role-match |
| `grid/src/p2p/turn-credentials.ts` | utility | transform | `grid/src/audit/firehose-redaction.ts` (pure transform utility) | role-match |
| `grid/src/p2p/types.ts` | config | — | `grid/src/ananke/types.ts` | role-match |
| `grid/src/audit/append-p2p-peer-announced.ts` | middleware | event-driven | `grid/src/audit/append-registry-civic-did-issued.ts` | exact |
| `grid/src/audit/append-p2p-connection-opened.ts` | middleware | event-driven | `grid/src/audit/append-registry-civic-did-issued.ts` | exact |
| `grid/src/audit/append-p2p-connection-closed.ts` | middleware | event-driven | `grid/src/ananke/append-drive-crossed.ts` (closed-enum + tick) | exact |
| `grid/src/audit/broadcast-allowlist.ts` | config | — | `grid/src/audit/broadcast-allowlist.ts` (self — add 3 entries) | exact |
| `grid/src/audit/ALLOWLIST_MEMBERS.ts` (if separate) | config | — | same file | exact |
| `grid/src/audit/firehose-hub.ts` | service | event-driven | `grid/src/audit/firehose-hub.ts` (self — add `pushSignalToDid`) | exact |
| `grid/src/api/routes/p2p.ts` | controller | request-response | `grid/src/api/routes/civic-presence.ts` | exact |
| `grid/src/api/policy.ts` | config | — | `grid/src/api/policy.ts` (self — add 5 entries) | exact |
| `grid/src/api/server.ts` | config | — | `grid/src/api/server.ts` (self — register p2p routes + optional service fields) | exact |
| `brain/src/noesis_brain/wire/p2p.py` | service | request-response | `brain/src/noesis_brain/wire/client.py` | exact |
| `brain/src/noesis_brain/wire/subscriber.py` | service | event-driven | `brain/src/noesis_brain/wire/subscriber.py` (self — extend `_on_frame`) | exact |
| `brain/src/noesis_brain/wire/client.py` | service | request-response | `brain/src/noesis_brain/wire/client.py` (self — add `post_p2p_announce`) | exact |
| `brain/pyproject.toml` | config | — | `brain/pyproject.toml` (self — add aiortc) | exact |
| `docker-compose.yml` | config | — | `docker-compose.yml` (self — add coturn service) | exact |

---

## Pattern Assignments

### `grid/src/db/schema.ts` — migration v32 (modify, add column)

**Analog:** `grid/src/db/schema.ts` v30 (lines 530-553) — `add_presence_to_civic_did_registry`

**Migration v30 pattern** (lines 530-553) — ALTER TABLE adding columns to `civic_did_registry`:
```typescript
{
    version: 30,
    name: 'add_presence_to_civic_did_registry',
    up: `
        ALTER TABLE civic_did_registry
          ADD COLUMN presence_status ENUM('awake','away','absent','presumed_departed')
                                     NOT NULL DEFAULT 'awake',
          ADD COLUMN last_seen_at TIMESTAMP(3) NULL,
          ADD COLUMN last_seen_tick INT UNSIGNED NULL,
          ADD COLUMN away_grace_expires_at TIMESTAMP(3) NULL,
          ADD COLUMN frozen TINYINT(1) NOT NULL DEFAULT 0,
          ADD INDEX idx_presence_status (grid_name, presence_status),
          ADD INDEX idx_last_seen_at (grid_name, last_seen_at)
    `,
    down: `
        ALTER TABLE civic_did_registry
          DROP INDEX idx_last_seen_at,
          DROP INDEX idx_presence_status,
          DROP COLUMN frozen,
          ...
    `,
},
```

**Phase 42 v32 must follow this pattern exactly:**
```typescript
{
    version: 32,
    name: 'add_public_key_to_civic_did_registry',
    up: `
        ALTER TABLE civic_did_registry
          ADD COLUMN existence_public_key_jwk JSON NULL
    `,
    down: `
        ALTER TABLE civic_did_registry
          DROP COLUMN existence_public_key_jwk
    `,
},
```
Note: NULL allowed for existing Phase 37 rows (NULL = P2P unavailable for that DID — see RESEARCH §Runtime State Inventory).

---

### `grid/src/civic-registry/vc-builder.ts` — modify `buildCivicDidVc()` (add public key to credentialSubject)

**Analog:** `grid/src/civic-registry/vc-builder.ts` (self, full file — 100 lines)

**Current `buildCivicDidVc` params** (lines 22-26):
```typescript
export async function buildCivicDidVc(params: {
    civicDid: string;
    existenceDid: string;
    issuedAtTick: number;
}): Promise<object> {
```

**Current `credentialSubject`** (lines 37-42) — MISSING public key:
```typescript
credentialSubject: {
    id: params.civicDid,
    existenceDid: params.existenceDid,
    civicRole: 'resident',
    issuedAtTick: params.issuedAtTick,
},
```

**Phase 42 change — add `existencePublicKeyJwk` param and field:**
```typescript
export async function buildCivicDidVc(params: {
    civicDid: string;
    existenceDid: string;
    issuedAtTick: number;
    existencePublicKeyJwk?: object | null;   // Phase 42 — nullable; NULL = P2P unavailable
}): Promise<object> {
    // ...
    credentialSubject: {
        id: params.civicDid,
        existenceDid: params.existenceDid,
        civicRole: 'resident',
        issuedAtTick: params.issuedAtTick,
        ...(params.existencePublicKeyJwk ? { existencePublicKeyJwk: params.existencePublicKeyJwk } : {}),
    },
```

---

### `grid/src/civic-registry/civic-did-store.ts` — modify `insert()` to save public key

**Analog:** `grid/src/civic-registry/civic-did-store.ts` (self, lines 50-66)

**Current `insert` method** (lines 53-66):
```typescript
async insert(record: CivicDidRecord): Promise<void> {
    await this.pool.query(
        `INSERT INTO civic_did_registry
            (grid_name, civic_did, existence_did, credential_json, status, issued_at_tick)
         VALUES (?, ?, ?, ?, 'active', ?)`,
        [
            record.gridName,
            record.civicDid,
            record.existenceDid,
            JSON.stringify(record.credentialJson),
            record.issuedAtTick,
        ],
    );
}
```

**Phase 42 change — extend INSERT to include `existence_public_key_jwk`:**
```typescript
async insert(record: CivicDidRecord): Promise<void> {
    await this.pool.query(
        `INSERT INTO civic_did_registry
            (grid_name, civic_did, existence_did, credential_json, status, issued_at_tick,
             existence_public_key_jwk)
         VALUES (?, ?, ?, ?, 'active', ?, ?)`,
        [
            record.gridName,
            record.civicDid,
            record.existenceDid,
            JSON.stringify(record.credentialJson),
            record.issuedAtTick,
            record.existencePublicKeyJwk ? JSON.stringify(record.existencePublicKeyJwk) : null,
        ],
    );
}
```
Also update `CivicDidRecord` type and `rowToRecord` to include `existencePublicKeyJwk?: object | null`.

---

### `grid/src/audit/append-p2p-peer-announced.ts` (sole producer #65)

**Analog:** `grid/src/audit/append-registry-civic-did-issued.ts` (lines 1-102)

**Imports pattern** (lines 20-22):
```typescript
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
```

**Payload interface + EXPECTED_KEYS** (lines 30-38):
```typescript
/** Closed 4-key payload for registry.civic_did_issued. */
export interface RegistryCivicDidIssuedPayload {
    readonly civic_did: string;       // CIVIC_DID_RE
    readonly existence_did: string;   // EXISTENCE_DID_RE
    readonly grid_name: string;       // non-empty string
    readonly issued_at_tick: number;  // non-negative integer
}
const EXPECTED_KEYS = ['civic_did', 'existence_did', 'grid_name', 'issued_at_tick'] as const;
```

**Phase 42 `append-p2p-peer-announced.ts` must use:**
```typescript
/** Closed 3-key payload for p2p.peer_announced. Keys ALPHABETICAL. */
export interface P2pPeerAnnouncedPayload {
    readonly civic_did_hash: string;   // sha256(civicDid) — 64 hex chars
    readonly endpoint_hash: string;    // sha256("online") — static
    readonly tick: number;             // non-negative integer
}
const EXPECTED_KEYS = ['civic_did_hash', 'endpoint_hash', 'tick'] as const;
```

**8-step validation discipline** (lines 50-101) — copy from `append-registry-civic-did-issued.ts`:
1. Type guard (plain non-null non-array object)
2. Regex guard for each string field (HEX64 pattern for hashes)
3. Non-negative integer for tick
4. Closed-tuple structural check (alphabetical key order)
5. Explicit reconstruction (no spread)
6. `payloadPrivacyCheck` — belt-and-suspenders
7. `audit.append('p2p.peer_announced', ...)` final call

**Core pattern** (lines 86-101):
```typescript
// 6. Explicit reconstruction — no spread, no prototype pollution.
const cleanPayload = {
    civic_did: payload.civic_did,
    // ... all keys explicit
};
// 7. Privacy gate.
const privacy = payloadPrivacyCheck(cleanPayload);
if (!privacy.ok) {
    throw new TypeError(`...: privacy violation — path=${privacy.offendingPath}`);
}
// 8. Commit to chain.
return audit.append('registry.civic_did_issued', payload.civic_did, cleanPayload);
```

---

### `grid/src/audit/append-p2p-connection-opened.ts` (sole producer #66)

**Analog:** `grid/src/audit/append-registry-civic-did-issued.ts` — same 8-step pattern

**Payload:**
```typescript
/** Closed 4-key payload for p2p.connection_opened. Keys ALPHABETICAL. */
export interface P2pConnectionOpenedPayload {
    readonly connection_id: string;    // UUID v4 format
    readonly from_did_hash: string;    // sha256(fromCivicDid) — 64 hex chars
    readonly tick: number;             // non-negative integer
    readonly to_did_hash: string;      // sha256(toCivicDid) — 64 hex chars
}
const EXPECTED_KEYS = ['connection_id', 'from_did_hash', 'tick', 'to_did_hash'] as const;
```

UUID validation for `connection_id`:
```typescript
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX64_RE = /^[0-9a-f]{64}$/i;
```

---

### `grid/src/audit/append-p2p-connection-closed.ts` (sole producer #67)

**Analog:** `grid/src/ananke/append-drive-crossed.ts` — same 8-step pattern but with closed-enum validation for `close_reason`

**Payload:**
```typescript
/** Closed 4-key payload for p2p.connection_closed. Keys ALPHABETICAL. */
export interface P2pConnectionClosedPayload {
    readonly close_reason: 'completed' | 'timeout' | 'error' | 'initiated';
    readonly connection_id: string;    // UUID v4
    readonly duration_ticks: number;   // non-negative integer
    readonly tick: number;             // non-negative integer
}
const CLOSE_REASONS = new Set(['completed', 'timeout', 'error', 'initiated']);
const EXPECTED_KEYS = ['close_reason', 'connection_id', 'duration_ticks', 'tick'] as const;
```

**Closed-enum gate pattern** (from `append-drive-crossed.ts` lines 84-98):
```typescript
// 4. Closed-enum validation
if (!DRIVE_NAME_SET.has(payload.drive)) {
    throw new TypeError(
        `appendAnankeDriveCrossed: unknown drive ${JSON.stringify(payload.drive)}`,
    );
}
```

---

### `grid/src/audit/broadcast-allowlist.ts` — add 3 entries (modify)

**Analog:** `grid/src/audit/broadcast-allowlist.ts` (lines 83-234) — current list ends at position 64

**Append pattern** (lines 228-234 — how Phase 37 added entries):
```typescript
// Phase 37 (REG-06): +4 registry.* events.
// registry.civic_did_issued: closed 4-key {civic_did, existence_did, grid_name, issued_at_tick}.
//   Emitted ONLY via appendRegistryCivicDidIssued (grid/src/audit/append-registry-civic-did-issued.ts).
'registry.civic_did_issued',    // (61)
'registry.civic_did_revoked',   // (62)
'registry.business_did_registered', // (63)
'registry.business_did_dissolved',  // (64)
```

**Phase 42 must append at position 65-67:**
```typescript
// Phase 42 (P2P-01..05 / D-42-07) — P2P audit events. Allowlist 64 → 67.
// p2p.peer_announced: closed 3-key {civic_did_hash, endpoint_hash, tick}.
//   endpoint_hash = sha256('online') — static sentinel hash.
//   Emitted ONLY via appendP2pPeerAnnounced() (grid/src/audit/append-p2p-peer-announced.ts).
'p2p.peer_announced',      // (65) {civic_did_hash, endpoint_hash, tick}
// p2p.connection_opened: closed 4-key {connection_id, from_did_hash, tick, to_did_hash}.
//   Emitted ONLY via appendP2pConnectionOpened() (grid/src/audit/append-p2p-connection-opened.ts).
'p2p.connection_opened',   // (66) {connection_id, from_did_hash, tick, to_did_hash}
// p2p.connection_closed: closed 4-key {close_reason, connection_id, duration_ticks, tick}.
//   close_reason ∈ {completed, timeout, error, initiated}.
//   Emitted ONLY via appendP2pConnectionClosed() (grid/src/audit/append-p2p-connection-closed.ts).
'p2p.connection_closed',   // (67) {close_reason, connection_id, duration_ticks, tick}
```

**CRITICAL:** `p2p.signal_received` must NOT appear here. It is a private WSS push only (D-42-06).

---

### `grid/src/audit/firehose-hub.ts` — add `pushSignalToDid()` method (modify)

**Analog:** `grid/src/audit/firehose-hub.ts` — `onAuditEvent` method (lines 320-334) and `ClientConnection.trySend` (lines 91-117)

**`_clients` iteration pattern** (lines 322-332):
```typescript
private onAuditEvent(entry: AuditEntry): void {
    try {
        if (!isAllowlisted(entry.eventType)) return;
        for (const client of this._clients) {
            try {
                client.enqueue(entry);
            } catch {
                /* swallow per-client errors */
            }
        }
    } catch {
        /* swallow entire listener body (defense-in-depth) */
    }
}
```

**Per-DID targeting pattern** — `ClientConnection.didContext` field (line 67):
```typescript
readonly didContext: DIDContext | null;
```

**Phase 42 new method on `WsFirehoseHub`** — mirrors RESEARCH Pattern 4:
```typescript
/**
 * Phase 42 D-42-06 — push a private frame ONLY to the subscriber whose
 * didContext.did matches recipientDid. NOT an audit chain event; NOT allowlist-gated.
 * Bypasses onAuditEvent() entirely — this is a private real-time notification.
 */
pushSignalToDid(recipientDid: string, frame: object): void {
    const payload = JSON.stringify(frame);
    for (const client of this._clients) {
        if (client.didContext?.did === recipientDid) {
            try {
                client.socket.send(payload);
                this.metrics.frames_sent_total++;
                this.metrics.last_frame_at = Date.now();
            } catch {
                /* swallow broken socket */
            }
        }
    }
}
```

Note: `this.metrics` is private — the method must live on `WsFirehoseHub` class (not an external function), matching how `onAuditEvent` accesses it. The `_clients` Set is also private, so the method goes inside the class body.

---

### `grid/src/api/routes/p2p.ts` (5 new routes)

**Analog:** `grid/src/api/routes/civic-presence.ts` (lines 1-66) — exact same Fastify route pattern

**File header + imports pattern** (lines 1-15):
```typescript
/**
 * Phase 42 P2P-01..03 — P2P signaling routes.
 * POST /api/v1/p2p/announce           — civic_did_required (Brain JWT heartbeat)
 * GET  /api/v1/p2p/peers/:civicDid    — visitor_public (peer presence lookup)
 * POST /api/v1/p2p/signal/:peerDid   — civic_did_required (SDP relay)
 * GET  /api/v1/p2p/signal/inbox       — civic_did_required (fetch encrypted SDP)
 * GET  /api/v1/p2p/turn-credentials   — civic_did_required (TURN auth)
 */
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
```

**Route registration function signature** (line 13-15):
```typescript
export async function registerP2pRoutes(
    app: FastifyInstance,
    services: GridServices,
): Promise<void> {
```

**Per-route pattern** (lines 17-34) — copy and adapt from `civic-presence.ts`:
```typescript
app.post('/api/v1/p2p/announce', async (req, reply) => {
    const p2pService = services.p2pService;
    if (!p2pService) return reply.code(503).send({ error: 'p2p_service_unavailable' });
    const tickFn = services.currentTick;
    if (!tickFn) return reply.code(503).send({ error: 'clock_unavailable' });

    const civicDid = req.didContext?.did;
    if (!civicDid || !CIVIC_DID_RE.test(civicDid) || req.didContext?.tier !== 'civic_member') {
        return reply.code(401).send({ error: 'unauthorized' });
    }
    const tick = tickFn();
    p2pService.peerStore.announce(civicDid, tick);
    appendP2pPeerAnnounced(services.audit, { civic_did_hash: sha256Hex(civicDid), endpoint_hash: sha256Hex('online'), tick });
    return reply.code(200).send({ status: 'announced', next_announce_in: 300 });
});
```

**Error response pattern** (lines 19-21 of civic-presence.ts):
```typescript
if (!svc) return reply.code(503).send({ error: 'presence_service_unavailable' });
// Pattern: service name + _unavailable suffix
```

---

### `grid/src/api/policy.ts` — add 5 ROUTE_DID_POLICY entries (modify)

**Analog:** `grid/src/api/policy.ts` (lines 26-140) — existing ROUTE_DID_POLICY record

**Existing entry format** (lines 57-62):
```typescript
// Phase 36 write routes — enforce Civic-DID (the primary VIS-02 deliverable)
'POST /api/v1/trade': 'civic_did_required',
'POST /api/v1/governance/propose': 'civic_did_required',
```

**Existing public entry** (lines 38-40):
```typescript
'GET /api/v1/civic-map/state': 'public',
```

**Phase 42 must add** (note: the policy value for peer lookup is `'public'` not `'visitor_public'` — `visitor_public` is not in `ROUTE_DID_POLICY_VALUES`; use `'public'`):
```typescript
// Phase 42 P2P-01..03: P2P signaling routes
'POST /api/v1/p2p/announce':           'civic_did_required',  // Brain JWT heartbeat
'GET /api/v1/p2p/peers/:civicDid':     'public',              // public peer presence lookup
'POST /api/v1/p2p/signal/:peerDid':   'civic_did_required',  // Brain JWT SDP relay
'GET /api/v1/p2p/signal/inbox':        'civic_did_required',  // Brain JWT SDP inbox
'GET /api/v1/p2p/turn-credentials':    'civic_did_required',  // Brain JWT TURN auth
```

**ROUTE_DID_POLICY_VALUES** (lines 15-23) — valid values are: `'public'`, `'portal_session_required'`, `'civic_did_required'`, `'business_did_required'`, `'government_only'`, `'police_only'`. There is no `'visitor_public'` value. Use `'public'` for the peer lookup route.

---

### `grid/src/api/server.ts` — register p2p routes + optional service field (modify)

**Analog:** `grid/src/api/server.ts` (lines 354-363, 664-667)

**Optional service field pattern** (lines 354-363):
```typescript
/**
 * Phase 41 SLEEP-01..05: presence + inbox service facade.
 * When absent, Phase 41 routes return 503 presence_service_unavailable.
 */
presenceService?: import('../civic-presence/presence-service.js').PresenceService;
/**
 * Phase 41 — current tick accessor for routes that write last_seen_tick.
 */
currentTick?: () => number;
```

**Phase 42 must add to `GridServices`:**
```typescript
/**
 * Phase 42 P2P-01..05: P2P peer store + SDP inbox + firehose hub reference.
 * When absent, Phase 42 routes return 503 p2p_service_unavailable.
 */
p2pService?: import('../p2p/types.js').P2PService;
```

**Route registration pattern** (lines 660-667):
```typescript
// --- Phase 41 SLEEP-01..05: Civic presence + inbox + message routes ---
void registerCivicPresenceRoutes(app, services);
void registerCivicInboxRoutes(app, services);
void registerCivicMessageRoute(app, services);
```

**Phase 42 must add** (after Phase 41 block):
```typescript
// --- Phase 42 P2P-01..05: P2P signaling routes ---
// Five endpoints: POST /p2p/announce, GET /p2p/peers/:did, POST /p2p/signal/:did,
// GET /p2p/signal/inbox, GET /p2p/turn-credentials.
// Policy enforcement delegated to onRequest hook per ROUTE_DID_POLICY.
void registerP2pRoutes(app, services);
```

Also add to imports at top of file:
```typescript
import { registerP2pRoutes } from './routes/p2p.js';
```

---

### `brain/src/noesis_brain/wire/p2p.py` (new module)

**Analog:** `brain/src/noesis_brain/wire/client.py` (lines 1-297) — GridWireClient pattern

**Module docstring + imports pattern** (lines 1-38):
```python
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
import logging
from typing import Optional

import httpx
from nacl.public import SealedBox
from nacl.signing import VerifyKey

from .token_manager import TokenManager

__all__ = ["BrainP2PClient"]

log = logging.getLogger(__name__)
```

**Constructor pattern** (lines 78-96 of `client.py`):
```python
def __init__(
    self,
    *,
    grid_url: str,
    token_manager: TokenManager,
    brain_did: str,
    queue: Optional[WireQueue] = None,
    timeout_seconds: float = 10.0,
    replay_batch_size: int = 100,
) -> None:
    validate_grid_url(grid_url)
    self._base_url = grid_url.rstrip("/")
    self._token_manager = token_manager
    # ...
    self._client: Optional[httpx.AsyncClient] = None
```

**Phase 42 `BrainP2PClient.__init__` pattern:**
```python
def __init__(
    self,
    *,
    grid_url: str,
    token_manager: TokenManager,
    civic_did: str,
    signing_key,           # nacl.signing.SigningKey (existence key)
    client: httpx.AsyncClient,   # shared — NOT created internally
) -> None:
    self._base_url = grid_url.rstrip("/")
    self._token_manager = token_manager
    self._civic_did = civic_did
    self._signing_key = signing_key
    self._client = client
    self._announce_task: Optional[asyncio.Task] = None
    self._peer_pubkey_cache: dict[str, dict] = {}  # lazy cache: peer_did → JWK
```

**Async HTTP method pattern** (lines 151-170 of `client.py`) — `_do_post_actions`:
```python
async def _do_post_actions(self, actions, tick) -> httpx.Response:
    token = self._token_manager.get_valid_token()
    client = await self._get_client()
    return await client.post(
        f"{self._base_url}/api/v1/brain/actions",
        json={"tick": tick, "actions": actions},
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
```

**Presence heartbeat pattern** (lines 174-210 of `client.py`) — `post_presence_heartbeat`:
```python
async def post_presence_heartbeat(self) -> None:
    try:
        token = self._token_manager.get_valid_token()
        client = await self._get_client()
        resp = await client.post(
            f"{self._base_url}/api/v1/civic/presence",
            json={},
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
        if 200 <= resp.status_code < 300:
            ...
        else:
            log.warning("[Brain] presence heartbeat non-2xx: status=%s", resp.status_code)
    except Exception as exc:
        log.warning("[Brain] presence heartbeat error: %s", exc)
```

**Phase 42 `post_p2p_announce` must mirror this pattern exactly:**
```python
async def announce(self, tick: int) -> None:
    """POST /api/v1/p2p/announce — 5-min heartbeat (separate from presence 60s)."""
    try:
        token = self._token_manager.get_valid_token()
        resp = await self._client.post(
            f"{self._base_url}/api/v1/p2p/announce",
            json={},
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
        if not (200 <= resp.status_code < 300):
            log.warning("[Brain] p2p announce non-2xx: status=%s", resp.status_code)
    except Exception as exc:
        log.warning("[Brain] p2p announce error: %s", exc)
```

---

### `brain/src/noesis_brain/wire/client.py` — add `post_p2p_announce()` (modify)

**Analog:** `brain/src/noesis_brain/wire/client.py` — `post_presence_heartbeat` method (lines 174-210)

`post_p2p_announce()` should follow the identical structure as `post_presence_heartbeat()`:
- Same try/except wrapper
- Same logging convention: `[Brain] p2p announce non-2xx: status=%s`
- Same error fallback: `log.warning("[Brain] p2p announce error: %s", exc)`
- Calls `POST /api/v1/p2p/announce` with empty JSON body and Bearer auth
- Cadence: separate asyncio.Task every **300 seconds** (NOT piggybacked on 60s presence)

---

### `brain/src/noesis_brain/wire/subscriber.py` — extend frame handler (modify)

**Analog:** `brain/src/noesis_brain/wire/subscriber.py` — `_on_frame` callback (lines 156-161)

**Current frame dispatch** (lines 148-161):
```python
async with websockets.connect(connect_url, additional_headers=headers) as ws:
    log.info("[Brain] WSS connected to %s", connect_url)
    while not self._stop.is_set():
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=1.0)
        except asyncio.TimeoutError:
            continue
        try:
            frame = json.loads(raw)
        except json.JSONDecodeError:
            log.warning("[Brain] WSS dropped non-JSON frame: %r", raw[:80])
            continue
        try:
            await self._on_frame(frame)
        except Exception:
            log.exception("[Brain] WSS on_frame handler raised")
```

The `WssSubscriber` delivers all frames to `on_frame` callback. The frame-type routing happens in `BrainApp._on_firehose_frame`. Phase 42 extends that routing in `BrainApp`, not in `WssSubscriber` directly.

**Phase 42 extension pattern** — in `BrainApp` (or wherever `on_frame` is wired):
```python
async def _on_firehose_frame(self, frame: dict) -> None:
    """Route incoming WSS frames — extend existing handler."""
    event_type = frame.get("type") or frame.get("event_type", "")
    if event_type == "p2p.signal_received":
        # Private WSS push — not an audit entry, not allowlist-gated
        if self.p2p_client is not None:
            await self.p2p_client.handle_signal_received(frame)
    elif event_type == "event":
        # Existing audit chain events
        ...
    # Other existing branches unchanged
```

---

### `brain/pyproject.toml` — add aiortc dependency (modify)

**Analog:** `brain/pyproject.toml` (lines 11-20) — existing `dependencies` block

**Current dependencies block** (lines 11-20):
```toml
dependencies = [
    "pyyaml>=6.0",
    "httpx>=0.27.0",
    "openai>=1.0.0",
    "anthropic>=0.30.0",
    "pynacl>=1.6.2,<2",
    "aiohttp>=3.10,<4",
    "PyJWT[crypto]>=2.8",
    "websockets>=12.0",
]
```

**Phase 42 must add `aiortc` after `pynacl`:**
```toml
dependencies = [
    "pyyaml>=6.0",
    "httpx>=0.27.0",
    "openai>=1.0.0",
    "anthropic>=0.30.0",
    "pynacl>=1.6.2,<2",
    "aiortc>=1.13.0,<2",   # Phase 42 P2P-04 — WebRTC (brings av, cryptography, aioice, pyee)
    "aiohttp>=3.10,<4",
    "PyJWT[crypto]>=2.8",
    "websockets>=12.0",
]
```

Note: PyNaCl is already present at `>=1.6.2,<2` — no change needed. `aiortc` transitively pulls `av>=14.0.0` (bundled FFmpeg wheels), `cryptography>=44.0.0`, `aioice`, `pyee`, `pylibsrtp`, `pyopenssl`.

---

### `docker-compose.yml` — add coturn service (modify)

**Analog:** `docker-compose.yml` (lines 3-70) — existing `grid` and `mysql` service definitions

**Existing service pattern** (lines 25-70 — `grid` service):
```yaml
grid:
  build:
    context: .
    dockerfile: docker/Dockerfile.grid
  container_name: noesis-grid
  depends_on:
    mysql:
      condition: service_healthy
  ports:
    - "${GRID_PORT:-8080}:8080"
  environment:
    GRID_NAME: ${GRID_NAME:-Genesis}
    # ...
  healthcheck:
    test: ["CMD", "wget", "-qO-", "http://127.0.0.1:8080/health"]
    interval: 15s
    timeout: 5s
    retries: 5
    start_period: 30s
  restart: unless-stopped
```

**Phase 42 coturn service** (follows same pattern; no `depends_on` since coturn is infrastructure-only):
```yaml
  # ── coturn STUN/TURN (Phase 42 P2P-03) ──────────────────────────────────────
  coturn:
    image: coturn/coturn:4.6.3
    container_name: noesis-coturn
    ports:
      - "3478:3478"
      - "3478:3478/udp"
      - "5349:5349"
      - "5349:5349/udp"
      # NOTE: large UDP relay range is impractical on macOS Docker Desktop.
      # For dev use STUN-only (stun.l.google.com). For production AWS, open UDP 49152-65535.
      # - "49152-65535:49152-65535/udp"
    environment:
      DETECT_EXTERNAL_IP: "yes"
      STATIC_AUTH_SECRET: "${TURN_STATIC_AUTH_SECRET:-changeme-turn-secret}"
    command: >
      -f
      --use-auth-secret
      --realm=noesis.grid
      --static-auth-secret=${TURN_STATIC_AUTH_SECRET:-changeme-turn-secret}
      --min-port=49152
      --max-port=65535
      --no-multicast-peers
      --denied-peer-ip=10.0.0.0-10.255.255.255
      --denied-peer-ip=192.168.0.0-192.168.255.255
      --denied-peer-ip=172.16.0.0-172.31.255.255
    restart: unless-stopped
```

**Grid service must gain new env var** (add to `grid.environment`):
```yaml
      TURN_STATIC_AUTH_SECRET: ${TURN_STATIC_AUTH_SECRET:-changeme-turn-secret}
```

Also add `TURN_STATIC_AUTH_SECRET` to `.env.example`.

---

### `grid/src/p2p/p2p-peer-store.ts` (new service)

**Analog:** No exact analog — closest is `grid/src/civic-presence/presence-service.ts` (in-memory state pattern).

**Pattern:** In-memory Map with TTL cleanup. Follow RESEARCH Pattern 6 verbatim (lines 404-438 of RESEARCH.md):

```typescript
const P2P_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface PeerEntry {
    civicDid: string;
    lastSeenAt: number;  // Date.now()
    lastSeenTick: number;
}

export class P2PPeerStore {
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

---

### `grid/src/p2p/sdp-inbox-store.ts` (new service)

**Analog:** No exact analog — in-memory ephemeral store. Follow RESEARCH Pattern 7 verbatim (lines 452-479 of RESEARCH.md).

**Pattern:**
```typescript
interface InboxEntry {
    connectionId: string;
    fromDid: string;
    encryptedBlob: string;   // base64-encoded ciphertext
    expiresAt: number;       // Date.now() + 60_000
}

export class SdpInboxStore {
    private inbox = new Map<string, InboxEntry[]>();

    push(toDid: string, entry: InboxEntry): void {
        const entries = this.inbox.get(toDid) ?? [];
        entries.push(entry);
        this.inbox.set(toDid, entries);
    }

    drain(toDid: string): InboxEntry[] {
        const entries = (this.inbox.get(toDid) ?? [])
            .filter(e => e.expiresAt > Date.now());
        this.inbox.delete(toDid);
        return entries;
    }
}
```

---

### `grid/src/p2p/turn-credentials.ts` (new utility)

**Analog:** No exact analog — pure transform utility. Follow RESEARCH Pattern 3 verbatim (lines 305-328 of RESEARCH.md):

```typescript
import { createHmac } from 'node:crypto';

const TURN_TTL_SECONDS = 3600;  // 1 hour
const TURN_REALM = 'noesis.grid';

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

---

## Shared Patterns

### Authentication — `req.didContext?.tier === 'civic_member'` guard

**Source:** `grid/src/api/routes/civic-presence.ts` lines 23-25
**Apply to:** All 4 Brain-facing P2P routes (announce, signal POST, inbox GET, turn-credentials GET)

```typescript
const civicDid = req.didContext?.did;
if (!civicDid || !CIVIC_DID_RE.test(civicDid) || req.didContext?.tier !== 'civic_member') {
    return reply.code(401).send({ error: 'unauthorized' });
}
```

### Service Availability Guard

**Source:** `grid/src/api/routes/civic-presence.ts` lines 18-21
**Apply to:** All P2P route handlers

```typescript
const svc = services.presenceService;
if (!svc) return reply.code(503).send({ error: 'presence_service_unavailable' });
// Phase 42 equivalent:
const p2p = services.p2pService;
if (!p2p) return reply.code(503).send({ error: 'p2p_service_unavailable' });
```

### Sole-Producer 8-Step Discipline

**Source:** `grid/src/audit/append-registry-civic-did-issued.ts` lines 50-101
**Apply to:** All 3 new append-p2p-*.ts files

Steps:
1. Type guard (plain non-null non-array object)
2. Regex/format guard for each string field
3. Non-negative integer for tick and duration fields
4. Closed-enum guard (for `close_reason` in `p2p.connection_closed`)
5. Closed-tuple structural check (alphabetical key sort equality)
6. Explicit reconstruction (no spread — prototype-pollution defense)
7. `payloadPrivacyCheck` — belt-and-suspenders
8. `audit.append(eventType, actorDid, cleanPayload)` commit

### SHA-256 Hashing (Grid-side)

**Source:** `grid/src/api/routes/registry.ts` lines 26-28
**Apply to:** All sole-producer files and route handlers that hash DIDs

```typescript
import { createHash } from 'node:crypto';

function sha256Hex(input: string): string {
    return createHash('sha256').update(input).digest('hex');
}
```

### Error Handling — Brain Wire Methods

**Source:** `brain/src/noesis_brain/wire/client.py` lines 174-210 (`post_presence_heartbeat`)
**Apply to:** All new methods in `BrainP2PClient` and any addition to `GridWireClient`

```python
async def <method_name>(self) -> None:
    try:
        token = self._token_manager.get_valid_token()
        resp = await self._client.post(...)
        if not (200 <= resp.status_code < 300):
            log.warning("[Brain] <method> non-2xx: status=%s", resp.status_code)
    except Exception as exc:
        log.warning("[Brain] <method> error: %s", exc)
# NEVER raise — caller continues normally.
```

### Optional Service Field in GridServices

**Source:** `grid/src/api/server.ts` lines 354-363 (presenceService pattern)
**Apply to:** New `p2pService` field in `GridServices`

```typescript
/**
 * Phase 42 P2P-01..05: P2P peer store + SDP inbox + firehose hub reference.
 * When absent, Phase 42 routes return 503 p2p_service_unavailable.
 */
p2pService?: import('../p2p/types.js').P2PService;
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `grid/src/p2p/types.ts` | config | — | P2P domain types (P2PService interface, etc.) are new to the project; nearest is `grid/src/ananke/types.ts` for pattern reference but content is entirely new |

---

## Metadata

**Analog search scope:** `grid/src/` (all subdirectories), `brain/src/noesis_brain/wire/`, `docker-compose.yml`, `brain/pyproject.toml`
**Files scanned:** ~25 source files read in full
**Pattern extraction date:** 2026-05-28
