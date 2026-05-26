# Phase 38: Brain ↔ Grid Wire Protocol — Research

**Researched:** 2026-05-26
**Domain:** Network wire protocol — Python async HTTP/WebSocket client (Brain) + TypeScript Fastify server (Grid)
**Confidence:** HIGH

---

## Summary

Phase 38 replaces the in-process communication model with a real network protocol. Today, Brain and Grid share a Docker network: Grid calls Brain over a Unix domain socket (JSON-RPC 2.0 via `protocol/src/noesis/bridge/brain-bridge.ts`→`rpc-client.ts`), and Brain calls Grid via direct in-process bindings (the only current Grid→Brain→Grid HTTP interaction is the Lore discovery poll at `rpc/handler.py:649` using `httpx`). There is no Brain→Grid audit-event channel at all — all audit appends are done synchronously by the Grid-side `NousRunner` after receiving Brain actions via RPC.

The phase must therefore:
1. Add a Grid-authenticated HTTPS REST path so Brain can POST actions/events to Grid.
2. Upgrade the existing WSS firehose so Brain can subscribe with a Civic-DID bearer token and receive filtered events.
3. Add an operator-signed short-lived JWT bearer token mechanism with 24h rotation.
4. Add a local SQLite queue on Brain for outbound events when network is lost, plus a batch ingest endpoint on Grid with idempotency.
5. Add server-side per-DID event filtering so each Brain subscriber sees only relevant events.

**Primary recommendation:** Build a `GridWireClient` Python async class in `brain/src/noesis_brain/wire/` that wraps `httpx.AsyncClient` for REST + `websockets` for WSS. Token signing uses PyNaCl's `nacl.signing.SigningKey` (already a dependency via `pynacl`). The Grid batch endpoint (`POST /api/v1/brain/events/batch`) adds `INSERT IGNORE` into `brain_event_ingest` (a new idempotency table, migration 25). The existing WSS firehose hub gains a per-Civic-DID filter layer on top of the existing redaction logic.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| TLS enforcement / plaintext rejection | Brain (config-load) | Grid (connection refusal) | Brain must refuse to start if GRID_URL is not `https://`; Grid also requires TLS at ingress |
| Operator-signed bearer JWT creation | Brain (wire client) | — | Operator's private key lives on operator machine; Brain signs on behalf of operator |
| JWT verification on inbound requests | Grid (preHandler) | — | Grid is the verifying party; `tryDid` already does `jwtVerify` via jose |
| Token rotation (24h cycle) | Brain (token manager) | Grid (revocation store) | Brain tracks expiry and refreshes; Grid enforces revocation via new `brain_tokens` table |
| Outbound event queue (offline buffer) | Brain (SQLite) | — | Brain is the producer; local disk is on operator machine |
| Batch event ingest + dedup | Grid (MySQL) | — | Grid is the consumer; INSERT IGNORE into `brain_event_ingest` |
| WSS firehose per-Civic-DID filtering | Grid (firehose-hub) | — | Server-side filtering — client still subscribes to one WSS endpoint |
| R-31-01 zero-diff audit chain | Grid (AuditChain.append) | — | Chain invariant is Grid-internal; wire boundary must not mutate chain order |

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WIRE-01 | Brain ↔ Grid via HTTPS REST (control) + WSS (events). TLS enforced; no plaintext fallback. | Grid already has Fastify with ws plugin; Brain already uses httpx (lore poll pattern). Need: Brain config-load TLS check, new routes `POST /api/v1/brain/actions` and `WSS /api/v1/brain/firehose`. |
| WIRE-02 | Operator-signed bearer tokens (operator-DID signs JWT with civic-DID + scope). 24h rotation. Revocable via Steward Console. | Brain has PyNaCl (signing.py). Grid has jose (CompactSign/jwtVerify). Need: Brain token manager + Grid new `brain_tokens` table (migration 25) + Steward Console revoke UI. |
| WIRE-03 | Local queue (max 10K) when offline. Reconnect replays via batch endpoint with idempotency key. | httpx already available. Need: Brain SQLite `wire_queue` table + `GridWireClient` with reconnect logic + Grid `POST /api/v1/brain/events/batch` with INSERT IGNORE into `brain_event_ingest` table. |
| WIRE-04 | Every event carries `sha256(brain_did + tick + event_type + payload_hash)` idempotency key. Grid uses INSERT IGNORE. | Grid already uses INSERT IGNORE in `AuditStore.append` and `LoreStorage`. Pattern is established. Need: Brain-side key derivation function + Grid batch handler. |
| WIRE-05 | WSS firehose filters by subscriber Civic-DID — pushes only own audit echoes, messages received, community events for joined communities. | `WsFirehoseHub` already has `didContext` per client (Phase 36 VIS-03). Need: extend `ClientConnection.trySend` with per-DID relevance filter. |
</phase_requirements>

---

## Current Architecture (Brain ↔ Grid In-Process)

### How Brain calls Grid today

Brain does NOT call Grid via HTTP today except for one pattern:

- **Lore discovery poll** (`brain/src/noesis_brain/rpc/handler.py:644-676`): Brain async-polls `{base_url}/api/v1/grid/lore` via `httpx.AsyncClient` every `lore_poll_interval` ticks. This is the ONLY existing Brain→Grid HTTP call. `_grid_base_url` attribute is checked but is not currently set in `create_brain_app()` — the lore poll silently no-ops without it.

### How Grid calls Brain today

Grid calls Brain through the `IBrainBridge` interface:
- `protocol/src/noesis/bridge/brain-bridge.ts` — production implementation using `RPCClient`
- `protocol/src/noesis/bridge/rpc-client.ts` — JSON-RPC 2.0 over Unix domain socket
- `grid/src/integration/grid-coordinator.ts:43` — `launcher.clock.onTick` drives `runner.tick(tick, epoch)` → `bridge.sendTick(params)` → RPC to Brain

### How audit events are emitted today

Audit events are emitted EXCLUSIVELY by Grid-side `NousRunner` after receiving Brain actions:
- Brain returns `Action` dicts from `on_tick()`/`on_message()`
- Grid's `NousRunner.executeActions()` calls `appendXxx(this.audit, ...)` sole-producer functions
- `PersistentAuditChain.append()` fires: in-memory commit first → listener fan-out → async fire-and-forget DB write (`AuditStore.append` with INSERT IGNORE)

**Key insight for Phase 38:** The current tick flow is Grid→Brain (via RPC). Phase 38 inverts the FUTURE model to Brain→Grid (via HTTPS REST + WSS), but the existing in-process RPC path must continue to work for local dev/test. Phase 38 adds the network wire protocol ALONGSIDE the existing path; Phase 39 (multi-tenancy) and Phase 41 (sleep cycle) will deprecate the local RPC path.

### Key files

| File | Role |
|------|------|
| `brain/src/noesis_brain/__main__.py` | Entry point; reads `GRID_URL`, `NOUS_DID`, `BRAIN_HTTP_SECRET` env vars |
| `brain/src/noesis_brain/rpc/handler.py` | `BrainHandler` — on_tick/on_message; line 644 has only httpx call |
| `brain/src/noesis_brain/rpc/server.py` | Unix socket JSON-RPC server |
| `brain/src/noesis_brain/http/server.py` | aiohttp HTTP server (port 8090, read-only observability) |
| `brain/src/noesis_brain/whisper/keyring.py` | Ed25519 keypair via PyNaCl (model for token signing key) |
| `grid/src/integration/nous-runner.ts` | Grid-side Brain bridge; dispatches actions to audit |
| `grid/src/integration/grid-coordinator.ts` | Clock→NousRunner fanout |
| `grid/src/integration/types.ts` | `IBrainBridge`, `BrainAction` union (all action types) |
| `protocol/src/noesis/bridge/brain-bridge.ts` | Concrete `IBrainBridge` over Unix socket |
| `protocol/src/noesis/bridge/rpc-client.ts` | JSON-RPC 2.0 client |
| `grid/src/api/routes/audit-firehose.ts` | WSS firehose route — already accepts Civic-DID bearer |
| `grid/src/audit/firehose-hub.ts` | `WsFirehoseHub` — `ClientConnection.trySend` with `didContext` |
| `grid/src/audit/firehose-redaction.ts` | `serializeVisitorFrame` / `serializeFullFrame` |
| `grid/src/api/preHandlers/tryDid.ts` | JWT bearer verification using `jose.jwtVerify` |
| `grid/src/api/policy.ts` | `ROUTE_DID_POLICY` — new Brain routes need entries |
| `grid/src/civic-registry/vc-builder.ts` | `CompactSign` from `jose` — token signing pattern |
| `grid/src/db/stores/audit-store.ts` | `INSERT IGNORE` pattern to reuse for batch ingest |
| `grid/src/db/audit-reconcile.ts` | Reconcile loop (INSERT IGNORE idempotent) — model for batch endpoint |
| `grid/src/db/persistent-chain.ts` | R-31-01 zero-diff invariant: `super.append()` FIRST |
| `grid/src/db/schema.ts` | Migrations; latest version is 24 (`business_did_registry`) |

---

## Patterns to Reuse

### 1. jose JWT verification (Grid side)

**File:** `grid/src/api/preHandlers/tryDid.ts:43-62`

```typescript
// VERIFIED pattern from tryDid.ts
const { payload } = await jwtVerify(token, publicKey);
const sub = payload.sub; // civic-DID string
```

The Grid already verifies ES256 JWTs from the same `keyPairPromise` generated at `grid/src/api/portal/auth.ts`. For Brain bearer tokens, the signing key is the operator's key, not the Grid's key — so Grid needs to store the operator's public key (registered during Brain onboarding, Phase 39) to verify brain tokens. For Phase 38 (pre-multi-tenancy), a SIMPLER approach: use the same Grid key pair for signing brain tokens too — operator rotates via Grid API which re-signs a new token. This avoids needing operator key management before Phase 39.

**Alternative:** Operator signs with their own Ed25519 key (PyNaCl signing), Grid verifies with stored public key. This is WIRE-02's exact requirement but requires storing the operator's JWK in Grid — needs new `brain_tokens` table regardless.

**Recommended approach:** Brain generates an Ed25519 keypair at first boot (stored in Brain's local SQLite), registers public key with Grid, Grid stores in `brain_tokens` table (migration 25). Brain signs a short-lived JWT (24h) with its Ed25519 key. Grid verifies with stored public key via `jose.importJWK`.

### 2. CompactSign for JWT creation (Grid side analogy, Brain side new)

**File:** `grid/src/civic-registry/vc-builder.ts:50-54`

```typescript
// Grid uses this pattern; Brain Python equivalent:
from nacl.signing import SigningKey  # nacl.signing already available
import json, base64, hashlib
```

PyNaCl's `nacl.signing.SigningKey` provides Ed25519 sign/verify. For JWT creation, Brain needs to build a compact JWS manually or use `PyJWT` (not currently in `pyproject.toml`). **Simplest path:** add `PyJWT[crypto]` to Brain's dependencies for JWT encoding; use `nacl.signing.SigningKey` for the actual Ed25519 key material.

**Alternatively**, Brain can build a minimal JWT without a library — it's just `base64url(header) + "." + base64url(payload) + "." + base64url(signature)` where signature is `Ed25519(key, header.payload)`.

### 3. INSERT IGNORE semantics for batch ingest

**File:** `grid/src/db/stores/audit-store.ts:14-33`

```typescript
// VERIFIED pattern — use for brain_event_ingest table
await this.db.execute(
    `INSERT IGNORE INTO audit_trail
        (grid_name, id, event_type, ...) VALUES (?, ?, ?, ...)`,
    [gridName, entry.id, entry.eventType, ...]
);
```

The batch endpoint on Grid should accept an array of events, each with an `idempotency_key` field, and INSERT IGNORE into a new `brain_event_ingest` table (migration 25). After deduplication, accepted events are forwarded to the AuditChain via the normal sole-producer path.

### 4. WSS firehose per-subscriber context (Phase 36 pattern)

**File:** `grid/src/audit/firehose-hub.ts:215-235`

```typescript
// VERIFIED — onConnect already takes DIDContext
onConnect(socket: ServerSocket, didContext: DIDContext | null = null): void {
    const client = new ClientConnection(socket, ..., didContext);
    ...
}
```

`ClientConnection.trySend` at line 90-103 already branches on `didContext.tier === 'civic_member'`. For WIRE-05, extend `trySend` to also check whether the event's `actor_did` or `target_did` matches `client.didContext.did` — pass only own-relevant events.

### 5. GRID_WS_SECRET gate (existing WSS auth pattern)

**File:** `grid/src/api/routes/audit-firehose.ts:26-40`

The existing firehose route already checks `Authorization: Bearer` or `?token=` query param. The Brain WSS subscriber should use `Authorization: Bearer <brain_jwt>` on the upgrade request — no change to the route handler needed, just ensure the JWT resolves to `civic_member` tier via `tryDid`.

### 6. httpx AsyncClient (Brain's existing HTTP pattern)

**File:** `brain/src/noesis_brain/rpc/handler.py:649-673` (Lore discovery poll)

```python
# VERIFIED existing pattern
async with _httpx.AsyncClient() as client:
    resp = await client.get(
        f"{base_url}/api/v1/grid/lore",
        params={"limit": "20"},
        timeout=5.0,
    )
```

The Brain wire client should use `httpx.AsyncClient` (already a dependency in `pyproject.toml:9`). For WSS, `websockets` library is NOT currently in `pyproject.toml` — needs adding. Alternatively, `httpx` has WebSocket support via `httpx-ws` (third party) or use the standard `websockets` library.

---

## Critical Pitfalls

### Pitfall 1: R-31-01 zero-diff invariant across network boundary

**What goes wrong:** If Brain sends audit events directly via HTTPS and Grid appends them to the chain outside the normal `NousRunner.executeActions()` path, the chain hash is computed over different data than what Brain computed. Worse, concurrent network events could land out of order.

**Root cause:** `PersistentAuditChain.append()` at `grid/src/db/persistent-chain.ts:69-80` calls `super.append()` FIRST (in-memory commit) then fire-and-forget DB write. The batch endpoint must use the SAME append path — it must call `this.audit.append()` synchronously in chain order, not directly INSERT into the DB.

**How to avoid:** Brain wire events become `BrainAction` items posted to Grid, where Grid's existing `NousRunner.executeActions()` processes them normally — the chain append happens on Grid as before. The batch endpoint receives `BrainAction` objects (not raw `AuditEntry` rows), reconstructs the action dispatch, and lets the sole-producer functions call `audit.append()`. The idempotency key gates at the BATCH RECEIPT level (did we already receive this action?), not at the chain level. `[VERIFIED: grid/src/db/persistent-chain.ts:69-78]`

### Pitfall 2: Tick collision in idempotency key

**What goes wrong:** `sha256(brain_did + tick + event_type + payload_hash)` assumes tick is unique per (brain_did, event_type) combination per tick. But Brain can emit multiple actions of the same type in one tick (e.g., two `drive_crossed` events for different drives).

**How to avoid:** Append a sequence number to the key: `sha256(brain_did + tick + event_type + payload_hash + seq)` where `seq` is the 0-based index of this event within the tick's batch. Alternatively use `payload_hash` alone to discriminate — if two drive-crossed events have different payloads (different drive/level/direction), the payload_hash already distinguishes them. Verify that no two events in a tick can have identical (event_type, payload_hash) pairs.

**Recommended:** Use `sha256(brain_did + ":" + str(tick) + ":" + event_type + ":" + payload_hash)` with separator colons to prevent prefix collision. Document this as the canonical formula. `[ASSUMED — no existing formula in codebase to compare against]`

### Pitfall 3: WSS reconnect storm on Grid restart

**What goes wrong:** When Grid restarts, all Brain subscribers disconnect simultaneously. If Brain uses exponential backoff without jitter, all reconnect at the same time causing a thundering herd.

**How to avoid:** Brain reconnect logic must use exponential backoff with jitter: `delay = min(base * 2^attempt, max_delay) * (0.5 + random.random() * 0.5)`. First reconnect after 1s, max 60s. `[ASSUMED — standard practice, not project-specific]`

### Pitfall 4: Missing ROUTE_DID_POLICY entries for new Brain routes

**What goes wrong:** The CI gate `scripts/check-did-policy-coverage.mjs` will fail if new routes are added without ROUTE_DID_POLICY entries. All routes in `api/v1/` must be listed.

**How to avoid:** Add entries in `grid/src/api/policy.ts` for every new Brain route at the same time as the route handler. Use `civic_did_required` for all Brain action routes. `[VERIFIED: grid/src/api/policy.ts and scripts/check-did-policy-coverage.mjs]`

### Pitfall 5: Brain TLS config validation at module import time vs start time

**What goes wrong:** If `GRID_URL` validation is deferred to first connection attempt, the Brain process starts successfully but fails silently on first tick. The requirement is "plaintext fallback rejected at config-load with TLS-required error."

**How to avoid:** Add a `validate_grid_url(url: str)` function called in `create_brain_app_from_env()` (before `BrainApp` construction) that raises `ValueError` if URL scheme is not `https://` or `wss://`. The error is raised synchronously before the event loop starts. `[VERIFIED: brain/src/noesis_brain/__main__.py:251-278 — config loading happens in factory]`

### Pitfall 6: WebSocket library not in Brain's pyproject.toml

**What goes wrong:** Brain uses `httpx` for HTTP but `httpx` does not support WebSocket natively. The `websockets` library is not in `pyproject.toml`.

**How to avoid:** Add `websockets>=12.0` to `pyproject.toml` dependencies. Do NOT use `aiohttp` WebSocket client (Brain already has `aiohttp` for `BrainHttpServer`, but mixing client + server patterns in aiohttp is complex). `websockets` is the standard asyncio WebSocket library. `[VERIFIED: brain/pyproject.toml — websockets absent]`

### Pitfall 7: Token key management — operator key vs Grid-issued token

**What goes wrong:** WIRE-02 says "operator-DID signs" the JWT. But Phase 37's Civic-DID registration uses the existence-key (Brain-held). Phase 38 must clarify: does the operator's *existence-key* sign the token, or does a separate *operator signing key* sign it?

**How to avoid:** Use the Nous's existence-DID signing key (already in Brain's memory model conceptually — derived from `sha256(existence_did)` via the Keyring pattern). The JWT `sub` is the civic-DID, `iss` is the existence-DID, signed with the existence private key. Grid verifies against the public key registered at Civic-DID issuance time (stored in `civic_did_registry.credential_json.credentialSubject.existenceDid` → look up public key from the existence DID). `[ASSUMED — requires verification against Phase 37 REG-01 schema]`

### Pitfall 8: Brain event buffer capacity and eviction during reconnect replay

**What goes wrong:** WIRE-03 says max 10K entries in the local buffer. If Brain has been offline for a long time, the buffer may be full when it tries to add new events — old events are lost. On reconnect, the buffer is replayed but may be missing events before eviction.

**How to avoid:** SQLite queue with FIFO eviction: on INSERT when size >= 10000, DELETE the oldest row. This is a deliberate lossy buffer — the 10K limit is documented. Use a SQLite table with `autoincrement id` so oldest-first order is maintained. WAL mode for concurrent reads during replay. `[ASSUMED — no existing implementation to compare against]`

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket client | Custom asyncio WS | `websockets>=12.0` (Python) | Handles masking, fragmentation, ping/pong, close handshake |
| JWT creation on Brain | Manual base64url | `PyJWT[crypto]` or `jose` (already on Grid) | Edge cases in JWS header encoding, alg negotiation |
| Exponential backoff | Custom retry loop | `tenacity` library or `asyncio.sleep` with simple formula | tenacity handles cancellation correctly; or just implement the formula (it's 3 lines) |
| Idempotency at DB level | Custom unique check | `INSERT IGNORE` (MySQL, already used in project) | Atomic under concurrent inserts; avoids SELECT-then-INSERT race |
| TLS in Python | Custom SSL context | `httpx` default SSL (uses `certifi`) | httpx verifies certs by default; no extra work needed |

---

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  Operator Machine                                               │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Brain Process                                          │   │
│  │                                                         │   │
│  │  BrainHandler (on_tick/on_message)                      │   │
│  │       │ Action[]                                        │   │
│  │       ▼                                                 │   │
│  │  GridWireClient                                         │   │
│  │   ├── [online] POST /api/v1/brain/actions  ──────────┐  │   │
│  │   ├── [offline] SQLite wire_queue (≤10K)             │  │   │
│  │   └── [reconnect] POST /api/v1/brain/events/batch ──┐│  │   │
│  │                                                      ││  │   │
│  │  TokenManager                                        ││  │   │
│  │   └── operator Ed25519 key → short-lived JWT        ││  │   │
│  │                                                      ││  │   │
│  │  WssSubscriber ◄── wss://.../brain/firehose ────────┘│  │   │
│  └──────────────────────────────────────────────────────┘│  │   │
│                                                           │  │   │
└───────────────────────────────────────────────────────────┼──┘   
                                                            │
                         HTTPS/WSS (TLS required)           │
                                                            │
┌───────────────────────────────────────────────────────────▼──────┐
│  Grid (Henry's server)                                            │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  Fastify API                                              │   │
│  │                                                           │   │
│  │  POST /api/v1/brain/actions                               │   │
│  │    tryDid(bearer) → civic_member tier                     │   │
│  │    ↓ BrainAction → NousRunner.executeActions()            │   │
│  │    ↓ audit.append() → AuditChain (R-31-01 preserved)     │   │
│  │                                                           │   │
│  │  POST /api/v1/brain/events/batch                          │   │
│  │    tryDid(bearer) → civic_member tier                     │   │
│  │    foreach event: idempotency key check                   │   │
│  │    INSERT IGNORE INTO brain_event_ingest(idempotency_key) │   │
│  │    dispatch accepted events → NousRunner.executeActions() │   │
│  │                                                           │   │
│  │  GET  /api/v1/brain/firehose (WSS upgrade)               │   │
│  │    tryDid(bearer) → civic_member tier                     │   │
│  │    WsFirehoseHub.onConnect(socket, didContext)            │   │
│  │    per-DID filter: only own-relevant events               │   │
│  │                                                           │   │
│  │  POST /api/v1/brain/token/revoke (Steward Console)        │   │
│  │    marks token revoked in brain_tokens table              │   │
│  │                                                           │   │
│  └───────────────────────────────────────────────────────────┤   │
│  │  brain_tokens table (migration 25)                        │   │
│  │  brain_event_ingest table (migration 25 or 26)            │   │
│  └───────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (new files only)

```
brain/src/noesis_brain/
├── wire/                        # NEW — all Grid wire protocol code
│   ├── __init__.py
│   ├── client.py                # GridWireClient (httpx + websockets)
│   ├── token_manager.py         # JWT creation + rotation
│   └── queue.py                 # SQLite offline buffer (≤10K events)

grid/src/
├── api/routes/
│   └── brain-wire.ts            # NEW — POST /brain/actions, POST /brain/events/batch, GET /brain/firehose
├── db/
│   └── stores/
│       └── brain-token-store.ts # NEW — brain_tokens table CRUD
└── audit/
    └── firehose-filter.ts       # NEW — per-DID relevance filter for WIRE-05
```

### Pattern 1: GridWireClient (Brain side)

```python
# Source: [ASSUMED — new code modeled on rpc/handler.py:649 httpx pattern]
class GridWireClient:
    def __init__(self, grid_url: str, token_manager: TokenManager) -> None:
        if not grid_url.startswith("https://"):
            raise ValueError(f"GRID_URL must use https:// scheme, got: {grid_url!r}")
        self._base_url = grid_url
        self._token_manager = token_manager
        self._queue: WireQueue = WireQueue()  # SQLite offline buffer

    async def post_actions(self, actions: list[dict]) -> None:
        token = await self._token_manager.get_valid_token()
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self._base_url}/api/v1/brain/actions",
                json={"actions": actions},
                headers={"Authorization": f"Bearer {token}"},
                timeout=10.0,
            )
            resp.raise_for_status()
```

### Pattern 2: INSERT IGNORE batch ingest (Grid side)

```typescript
// Source: [VERIFIED model from grid/src/db/stores/audit-store.ts:14-33]
// New brain_event_ingest table
async ingestBatch(events: BrainWireEvent[]): Promise<{ accepted: number; duplicate: number }> {
    let accepted = 0, duplicate = 0;
    for (const evt of events) {
        const result = await this.db.execute(
            `INSERT IGNORE INTO brain_event_ingest
                (idempotency_key, brain_did, tick, event_type, payload, received_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [evt.idempotency_key, evt.brain_did, evt.tick, evt.event_type,
             JSON.stringify(evt.payload), Date.now()]
        );
        // mysql2 returns OkPacket with affectedRows = 0 on IGNORE
        if ((result as any).affectedRows === 0) duplicate++;
        else accepted++;
    }
    return { accepted, duplicate };
}
```

### Pattern 3: Per-DID firehose filter (Grid side)

```typescript
// Source: [VERIFIED model from grid/src/audit/firehose-hub.ts:90-102]
// Extend ClientConnection.trySend() — add relevance check before serialization
isRelevantFor(entry: AuditEntry, didContext: DIDContext | null): boolean {
    if (didContext === null) return true;  // visitors see everything allowlisted
    const did = didContext.did;
    // Own actor events (audit echo), messages addressed to this DID, community events
    return entry.actorDid === did
        || entry.targetDid === did
        || entry.eventType.startsWith('community.')
        || entry.eventType === 'tick';
}
```

### Anti-Patterns to Avoid

- **Direct audit INSERT from Brain:** Brain must never write directly to `audit_trail`. All audit appends go through Grid's sole-producer pattern (`appendXxx` functions). `[VERIFIED: grid/src/audit/chain.ts pattern]`
- **Blocking WSS in Brain's tick loop:** WSS event reception must be in a separate asyncio task, not blocking `on_tick`. `[ASSUMED — standard asyncio practice]`
- **Token stored in env only:** Bearer token must be persisted in Brain's local SQLite so it survives process restarts without needing re-authentication. `[ASSUMED]`
- **Plaintext HTTP fallback:** Even for local development, enforce `https://`. For dev, use a self-signed cert with `HTTPS_ALLOW_SELF_SIGNED=true` env override — not unencrypted HTTP. `[ASSUMED — matches WIRE-01 spirit]`

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| In-process Unix socket (Brain → Grid RPC) | Network HTTPS REST + WSS | Phase 38 | Brain can now run on operator's machine; Grid is remote |
| No auth (shared Docker network trust) | Civic-DID bearer JWT | Phase 38 | Grid enforces per-Nous authorization across network boundary |
| Synchronous in-memory audit chain only | INSERT IGNORE idempotency at batch boundary | Phase 38 | Network replay safety without duplicate chain entries |
| All audit emits by Grid-side NousRunner | Brain posts `BrainAction` → Grid dispatches → Grid emits audit | Phase 38 | Same logical path, new transport |

---

## Plan Recommendations

### Suggested decomposition: 4 plans across 2 waves

**Wave 1 (foundation):**

**Plan 38-01: Token infrastructure (WIRE-02 partial)**
- Brain: `wire/token_manager.py` — Ed25519 key generation, JWT creation, 24h expiry
- Grid: Migration 25 (`brain_tokens` table), `brain-token-store.ts`, `POST /api/v1/brain/token/register`, `POST /api/v1/brain/token/revoke`
- ROUTE_DID_POLICY entries for new routes
- Tests: Brain unit test for token creation; Grid unit test for token store INSERT/revoke

**Plan 38-02: HTTPS REST action channel (WIRE-01 + WIRE-02 complete)**
- Brain: `wire/client.py` (GridWireClient, TLS validation at config-load, POST actions)
- Grid: `POST /api/v1/brain/actions` route + handler that delegates to NousRunner.executeActions()
- WIRE-01 TLS enforcement (Brain raises ValueError on http://)
- Tests: Brain integration test for `validate_grid_url`; Grid test for POST /brain/actions → audit chain

**Wave 2 (resilience + filtering):**

**Plan 38-03: Offline queue + batch ingest (WIRE-03 + WIRE-04)**
- Brain: `wire/queue.py` (SQLite ≤10K FIFO buffer), reconnect replay logic
- Grid: Migration 26 (`brain_event_ingest` table), `POST /api/v1/brain/events/batch` with INSERT IGNORE
- WIRE-04 idempotency key derivation (`sha256(brain_did:tick:event_type:payload_hash)`)
- Tests: Brain test for queue overflow + replay; Grid test for batch endpoint dedup
- UAT script: `uat-wire-disconnect.mjs` (severs network 60s, verifies ≤10K queue, replay, exactly-once)

**Plan 38-04: WSS subscription + per-DID filtering (WIRE-01 WSS + WIRE-05)**
- Brain: `wire/subscriber.py` (websockets client, reconnect with jitter backoff)
- Grid: `GET /api/v1/brain/firehose` route (new dedicated Brain WSS endpoint), extend `WsFirehoseHub.onConnect` with Brain-DID relevance filter (WIRE-05)
- Add `websockets>=12.0` to Brain `pyproject.toml`
- Tests: Grid unit test for per-DID filter logic; Brain integration test for WSS reconnect

---

## Open Questions

1. **Operator key vs Grid-issued token (WIRE-02 precision)**
   - What we know: WIRE-02 says "operator-DID signs JWT containing civic-DID + scope." Phase 37 REG-01 stores the existence public key JWK in `civic_did_registry`. The existence-DID IS the operator's Nous identity key.
   - What's unclear: Is the signing key the existence-DID key (already derived as `sha256(existence_did)` in Keyring) or a separate "operator key" tied to the human operator (not the Nous)?
   - Recommendation: Treat the existence-DID key as the operator key for Phase 38. Document that Phase 39 (multi-tenancy) may introduce a separate operator-level signing credential.

2. **WIRE-05 community event filtering scope**
   - What we know: Filter should push "community events for joined communities." Community memberships are not yet implemented (Phase 49).
   - What's unclear: Without Phase 49 data, how to filter community events? In Phase 38, community memberships don't exist yet.
   - Recommendation: In Phase 38, filter `community.*` events by `actor_did === subscriber_did` only (can't filter by membership). Add a TODO comment for Phase 49 to extend the filter.

3. **Token rotation mechanism: proactive vs reactive**
   - What we know: WIRE-02 says tokens rotate every 24h. Brain must re-acquire without state loss.
   - What's unclear: Does Brain proactively refresh before expiry (recommended) or reactively on 401?
   - Recommendation: Brain proactively rotates 1h before expiry (23h window), keeping old and new token in `brain_tokens` to support in-flight requests during rotation.

4. **NousRunner dependency during POST /brain/actions**
   - What we know: `NousRunner` is the Grid-side orchestrator that routes Brain actions to audit emitters. Currently one NousRunner per Nous per Grid boot.
   - What's unclear: When Brain POSTs actions to Grid, which NousRunner handles them? In the local path, the coordinator knows which runner owns which DID.
   - Recommendation: The `POST /api/v1/brain/actions` handler looks up the runner by `brain_did` (Civic-DID from JWT `sub`) via a registry lookup. If no runner found, return 404.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `httpx` | Brain HTTP client | ✓ | `>=0.27.0` (in pyproject.toml) | — |
| `websockets` | Brain WSS client | ✗ | not in pyproject.toml | Must add as dependency |
| `pynacl` | Ed25519 signing in Brain | ✓ | `1.6.2` (in venv, pyproject.toml) | — |
| `jose` (npm) | JWT verify in Grid | ✓ | already in grid/package.json (registry.ts uses it) | — |
| `PyJWT[crypto]` | JWT creation in Brain | ✗ | not in pyproject.toml | Could use raw PyNaCl + manual base64url (3 lines) |
| MySQL | Grid audit/token storage | ✓ (dev via Docker) | checked in existing phases | — |
| SQLite | Brain offline queue | ✓ | stdlib (Python 3.11+ built-in) | — |

**Missing dependencies with no fallback:**
- `websockets` must be added to `brain/pyproject.toml`

**Missing dependencies with fallback:**
- `PyJWT[crypto]` — can hand-roll minimal JWT encoding using `nacl.signing.SigningKey` directly (viable for 1 algorithm, but error-prone). Recommendation: add `PyJWT[crypto]>=2.8` to avoid edge cases.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Grid framework | Vitest |
| Grid config file | `grid/vitest.config.ts` |
| Brain framework | pytest |
| Brain config file | `brain/pyproject.toml` (`[tool.pytest.ini_options]`) |
| Grid quick run | `cd grid && npx vitest run test/api/` |
| Brain quick run | `cd brain && python -m pytest test/ -x -q` |
| Full suite (Grid) | `cd grid && npx vitest run` |
| Full suite (Brain) | `cd brain && python -m pytest test/ -q` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WIRE-01 (TLS) | `validate_grid_url("http://...")` raises ValueError | unit (Brain) | `pytest test/wire/test_grid_wire_client.py::test_plaintext_rejected -x` | ❌ Wave 0 |
| WIRE-01 (REST) | POST /api/v1/brain/actions with valid bearer → 200 | integration (Grid) | `npx vitest run test/api/brain-wire.test.ts` | ❌ Wave 0 |
| WIRE-01 (WSS) | WSS upgrade with valid bearer → hello frame | integration (Grid) | `npx vitest run test/api/brain-firehose.test.ts` | ❌ Wave 0 |
| WIRE-02 (token) | Token registers, verifies, expires after 24h | unit (Grid) | `npx vitest run test/api/brain-token.test.ts` | ❌ Wave 0 |
| WIRE-02 (rotation) | Old token 401 after revocation | integration (Grid) | `npx vitest run test/api/brain-token.test.ts::token_revocation` | ❌ Wave 0 |
| WIRE-03 (queue) | Buffer 10K events offline, replay exactly-once | integration (Brain) | `pytest test/wire/test_wire_queue.py::test_offline_replay -x` | ❌ Wave 0 |
| WIRE-03 (UAT) | 60s network sever → ≤10K queued → reconnect → exactly-once | manual / UAT | `node scripts/uat-wire-disconnect.mjs` | ❌ Wave 0 |
| WIRE-04 (dedup) | Same idempotency key submitted twice → accepted=1, duplicate=1 | unit (Grid) | `npx vitest run test/api/brain-wire.test.ts::batch_dedup` | ❌ Wave 0 |
| WIRE-05 (filter) | Subscriber DID A does not receive DID B's private events | unit (Grid) | `npx vitest run test/audit/firehose-filter.test.ts` | ❌ Wave 0 |

### Wave 0 Gaps

- [ ] `brain/test/wire/test_grid_wire_client.py` — covers WIRE-01 TLS + WIRE-03 queue
- [ ] `brain/test/wire/test_token_manager.py` — covers WIRE-02 token creation
- [ ] `brain/test/wire/test_wire_queue.py` — covers WIRE-03 offline buffer
- [ ] `grid/test/api/brain-wire.test.ts` — covers WIRE-01 REST + WIRE-04 batch dedup
- [ ] `grid/test/api/brain-token.test.ts` — covers WIRE-02 token store + revocation
- [ ] `grid/test/audit/firehose-filter.test.ts` — covers WIRE-05 per-DID filter
- [ ] `scripts/uat-wire-disconnect.mjs` — UAT success criterion 3

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Operator Ed25519 JWT bearer (PyNaCl + PyJWT on Brain, jose on Grid) |
| V3 Session Management | yes | 24h token TTL, proactive rotation, revocation via brain_tokens table |
| V4 Access Control | yes | ROUTE_DID_POLICY `civic_did_required` for all /brain/* routes; per-DID firehose filter |
| V5 Input Validation | yes | Batch endpoint validates idempotency key format (64-hex sha256) + max batch size |
| V6 Cryptography | yes | Ed25519 (PyNaCl / jose) — never hand-roll; TLS via httpx certifi |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Token replay after network intercept | Spoofing | Short TTL (24h) + TLS enforced; consider nonce in JWT claims |
| Idempotency key collision (hash prefix attack) | Tampering | Use colon-separated input `brain_did:tick:type:hash` to prevent prefix collision |
| Brain replay flood (sending 10K events repeatedly) | DoS | Grid rate-limit per brain_did on batch endpoint; max batch size (e.g., 500 events per request) |
| Unauthorized firehose subscription (wrong Civic-DID) | Information Disclosure | `tryDid` bearer verification + per-DID relevance filter; revocation check on every WS ping |
| Forged audit events from compromised Brain | Tampering | Grid verifies bearer JWT before accepting actions; R-31-01 chain is Grid-authoritative |

---

## Sources

### Primary (HIGH confidence)

- `[VERIFIED: brain/src/noesis_brain/__main__.py]` — Brain entry point, env var config, BrainApp factory
- `[VERIFIED: brain/src/noesis_brain/rpc/handler.py]` — BrainHandler, httpx lore poll at line 649
- `[VERIFIED: brain/src/noesis_brain/whisper/keyring.py]` — PyNaCl Ed25519 signing pattern
- `[VERIFIED: brain/pyproject.toml]` — Brain Python dependencies (httpx, pynacl, aiohttp; no websockets/PyJWT)
- `[VERIFIED: grid/src/audit/chain.ts]` — AuditChain.append() commit-then-fan-out
- `[VERIFIED: grid/src/db/persistent-chain.ts]` — R-31-01 zero-diff: super.append() first
- `[VERIFIED: grid/src/db/stores/audit-store.ts]` — INSERT IGNORE pattern
- `[VERIFIED: grid/src/db/audit-reconcile.ts]` — REPLAY_BATCH_CAP, INSERT IGNORE idempotent reconcile
- `[VERIFIED: grid/src/api/preHandlers/tryDid.ts]` — jwtVerify bearer pattern
- `[VERIFIED: grid/src/audit/firehose-hub.ts]` — WsFirehoseHub, ClientConnection, didContext per client
- `[VERIFIED: grid/src/api/routes/audit-firehose.ts]` — WSS upgrade route, GRID_WS_SECRET gate
- `[VERIFIED: grid/src/api/policy.ts]` — ROUTE_DID_POLICY, CI gate requirement
- `[VERIFIED: grid/src/db/schema.ts]` — latest migration version 24
- `[VERIFIED: grid/src/integration/nous-runner.ts]` — NousRunner, executeActions (audit dispatch path)
- `[VERIFIED: grid/src/integration/grid-coordinator.ts]` — clock→runner fanout
- `[VERIFIED: grid/src/integration/types.ts]` — IBrainBridge, BrainAction union
- `[VERIFIED: protocol/src/noesis/bridge/brain-bridge.ts]` — BrainBridge over Unix socket
- `[VERIFIED: .github/workflows/rig-invariants.yml]` — CI gate list
- `[VERIFIED: grid/src/civic-registry/vc-builder.ts]` — CompactSign jose pattern

### Secondary (MEDIUM confidence)

- PyNaCl 1.6.2 `nacl/signing.py` confirmed present in Brain venv
- `websockets` confirmed absent from Brain `pyproject.toml`
- `jose` npm package already used in `grid/src/api/routes/registry.ts` (compactVerify, importJWK)

### Tertiary (LOW confidence)

- None — all critical claims verified against codebase

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Idempotency key formula: `sha256(brain_did:tick:event_type:payload_hash)` with colon separators | Pitfall 2, WIRE-04 | Minor — collision risk if different formula used; fix at plan authoring time |
| A2 | PyJWT[crypto]>=2.8 as recommended JWT library for Brain | Standard Stack | Low — could use nacl.signing directly for Ed25519 JWT, just more boilerplate |
| A3 | `websockets>=12.0` as WSS client for Brain | Don't Hand-Roll | Low — httpx-ws is an alternative; either works |
| A4 | Existence-DID key is the "operator signing key" for bearer JWTs | Open Question 1 | MEDIUM — if user wants a separate human-operator key, changes Phase 39 scope |
| A5 | WIRE-05 community filter deferred until Phase 49 (only filter own events in Phase 38) | WIRE-05 | Low — requirement says "joined communities"; with no memberships in Phase 38, can only filter by DID |

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all dependencies verified against pyproject.toml and npm manifests
- Architecture: HIGH — all file paths and class names verified in codebase
- Pitfalls: HIGH — Pitfalls 1 (R-31-01), 4 (policy CI gate), 5 (config-load) are VERIFIED; Pitfalls 2, 3, 6-8 are ASSUMED standard practice
- Token model: MEDIUM — existence-DID-as-operator-key is ASSUMED pending user confirmation (Open Question 1)

**Research date:** 2026-05-26
**Valid until:** 2026-06-25 (30 days — stable TypeScript/Python dependencies)
