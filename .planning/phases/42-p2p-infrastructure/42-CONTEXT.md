# Phase 42: P2P Infrastructure — Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Grid provides WebRTC signaling infrastructure, DID-to-endpoint discovery, and NAT traversal services (STUN + TURN). Brain-to-Brain dialogue, trade negotiation, and peer skill teaching flow directly between Brains via WebRTC data channels. Grid is a signaling relay only — it sees who connects to whom and when, but never sees message content. Audit chain logs connection events only.

**Dependencies shipped:** Phase 36 (ROUTE_DID_POLICY + visit/action split), Phase 37 (DID Registry + Civic-DID W3C VCs), Phase 38 (Brain-Grid wire protocol + WSS firehose with per-DID didContext).

</domain>

<decisions>
## Implementation Decisions

### D-42-01: Protocol Stack — WebRTC (Q-V3-A RESOLVED)

**WebRTC + SDP signaling.** Q-V3-A is now locked.

- Grid acts as a pure SDP relay — no WebRTC runtime on Grid server
- Brain gets a new `wire/p2p.py` module backed by `aiortc` (Python WebRTC library)
- STUN/TURN fits naturally into the WebRTC ICE negotiation spec
- libp2p and Matrix are out of scope for v3.0

**CIVIC-ARCHITECTURE.md §5.1 table now reads:** P2P stack = WebRTC (Q-V3-A — RESOLVED 2026-05-27)

### D-42-02: P2P Announce — Presence-Only Heartbeat

`POST /api/v1/p2p/announce` carries **presence only** — no endpoint field, no ICE candidate hints, no multiaddr.

- WebRTC does NAT traversal itself via ICE; no fixed listen port is needed
- Payload: `{ civic_did: "..." }` (extracted from Civic-DID bearer token)
- Grid records the announce timestamp; entry expires after 5 minutes of no heartbeat
- `GET /api/v1/p2p/peers/<civic-did>` returns `{ status: "online", last_seen_at: "..." }` or `404 peer_offline`

### D-42-03: STUN/TURN Infrastructure — AWS-Hosted, Both Free in v3.0

**Hosting:** coturn instance on AWS (same infrastructure as Grid). Not a third-party public STUN service.

- STUN: `stun://grid.noesis:3478` — free, no auth required
- TURN: permanently free in v3.0 (TURN pricing deferred to v3.1)
- TURN credentials require **Civic-DID auth** (prevents anonymous relay abuse)
- `GET /api/v1/p2p/turn-credentials` — Civic-DID required; returns short-lived TURN username/credential (coturn HMAC-SHA1 time-limited tokens); no Bios deduction

**ROADMAP/REQUIREMENTS update needed:** Phase 42 ROADMAP goal says "TURN (paid)" — this must be updated. TURN is free in v3.0. Phase 45 IRS does NOT need to account for TURN billing.

### D-42-04: Brain-Side P2P — Full aiortc Module

Phase 42 ships a complete `brain/src/noesis_brain/wire/p2p.py` module. This is required to satisfy SC4 (1000 messages → 0 Grid audit entries).

**BrainP2PClient responsibilities:**
- Fetch peer's public key from DID Registry W3C VC (before signaling)
- Generate SDP offer, encrypt with peer's public key
- Post encrypted blob to Grid via `POST /api/v1/p2p/signal/<peer-did>`
- Listen for `p2p.signal_received` WSS push (Phase 38 firehose)
- Decrypt incoming SDP, generate SDP answer, post back via Grid
- Complete ICE negotiation via Grid relay
- Maintain WebRTC data channel for direct Brain-to-Brain messages

**Integration with tick loop:** Opt-in channel. Brain checks peer online status (`GET /api/v1/p2p/peers/<did>`) before sending. If online → use P2P direct channel. If offline → fall back to Grid messaging (Phase 41 queue or existing dialogue path). No new abstractions in the tick loop itself.

**Message format:** BrainAction JSON envelope (same as Phase 38 wire protocol) over the WebRTC data channel. Reuses existing Brain serialization — no new message schema.

### D-42-05: Signaling Content Model — End-to-End Encrypted

Grid is a **truly opaque relay** — it cannot read the SDP blobs it forwards.

**Flow:**
1. Brain A fetches Brain B's public key from `GET /api/v1/registry/civic-did/<B-did>` (Phase 37 W3C VC contains the public key)
2. Brain A generates SDP offer and encrypts it with Brain B's public key
3. Brain A posts encrypted blob to `POST /api/v1/p2p/signal/<B-did>`
4. Grid relays opaque blob; logs only `{ from_did_hash, to_did_hash, tick }` to audit; mints a `connection_id` UUID and returns it in the signal response
5. Brain B receives `p2p.signal_received` notification via WSS firehose (per-DID filtered)
6. Brain B calls `GET /api/v1/p2p/signal/inbox` to retrieve the encrypted blob
7. Brain B decrypts with its private key, generates SDP answer, encrypts with Brain A's public key, posts back via Grid
8. ICE candidates flow similarly through the same relay mechanism
9. After ICE completes, direct WebRTC data channel is established — Grid is no longer in the path

**Connection ID:** Grid mints a UUID `connection_id` on the first SDP relay (step 4) and returns it in the signal response. Both Brains carry this ID. Grid uses it to correlate `p2p.connection_opened` and `p2p.connection_closed` audit events.

### D-42-06: Signal Delivery — Per-DID WSS Firehose Push

Signal notifications are private — only the recipient Brain sees them.

- Phase 38 WSS hub already has per-subscriber `didContext` (each Brain's Civic-DID is known at subscribe time)
- Grid adds a new frame type `p2p.signal_received` delivered ONLY to the subscription matching the recipient Civic-DID
- This is NOT an audit chain event (not in the allowlist) — it is a private real-time notification
- Brain B fetches the actual encrypted blob from `GET /api/v1/p2p/signal/inbox` after receiving the push

### D-42-07: Allowlist — Exactly +3 Events (64 → 67)

Per ROADMAP SC5, Phase 42 adds exactly these 3 audit chain events via sole-producer files:

| Event | Payload |
|-------|---------|
| `p2p.peer_announced` | `{ civic_did_hash, tick, endpoint_hash }` (endpoint_hash = hash of "online") |
| `p2p.connection_opened` | `{ from_did_hash, to_did_hash, tick, connection_id }` |
| `p2p.connection_closed` | `{ connection_id, tick, duration_ticks, close_reason }` |

`p2p.signal_received` is explicitly NOT in the allowlist — it is a private WSS notification, not an audit entry.

### Claude's Discretion

- DB schema for P2P peer tracking (`p2p_peers` table vs column on `civic_did_registry` vs Redis-like TTL store)
- TURN credential TTL (30–60 min is standard coturn range)
- SDP blob inbox schema on Grid (table or in-memory keyed by recipient DID)
- ICE candidate relay format (whether candidate trickle is supported or only complete offer/answer)
- aiortc version pinning and Python dependency management
- coturn Docker Compose configuration and AWS networking (security group, UDP 3478)
- Whether Brain A pre-fetches peer public key lazily or eagerly at announce time

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 42 Specification
- `.planning/ROADMAP.md` §Phase 42 — Goals, Success Criteria (P2P-01..05), allowlist +3 delta
- `.planning/REQUIREMENTS.md` §P2P — P2P-01..05 requirement text
- `.planning/STATE.md` §Q-V3-A — P2P protocol decision (WebRTC, now locked)
- `.planning/research/v3.0/CIVIC-ARCHITECTURE.md` §5.1 — P2P stack table (Q-V3-A)

### Phase 38 Wire Protocol (foundation — required reading)
- `brain/src/noesis_brain/wire/client.py` — GridWireClient: HTTPS REST + reconnect. Phase 42 Brain P2P module follows the same pattern.
- `brain/src/noesis_brain/wire/subscriber.py` — WSS subscriber. Phase 42 listens for `p2p.signal_received` frames here.
- `brain/src/noesis_brain/wire/token_manager.py` — EdDSA bearer token management. P2P announce + TURN credential calls use same auth.
- `brain/src/noesis_brain/wire/queue.py` — WireQueue SQLite DB (existing). Phase 42 does NOT extend this — P2P state is in-memory or separate.

### Phase 37 DID Registry (peer public key lookup)
- `grid/src/registry/` — Civic-DID and Business-DID registry. Phase 42 reads Civic-DID W3C VCs to get peer public keys for SDP encryption.
- `grid/src/db/schema.ts` migration v23 (`civic_did_registry` table) — contains the public key field that Phase 42 reads.

### Phase 36 Policy Infrastructure
- `grid/src/api/policy.ts` — ROUTE_DID_POLICY table (105 entries). All 5 new P2P routes MUST add entries: `/p2p/announce` (Civic-DID required), `/p2p/peers/<did>` (visitor_public), `/p2p/signal/<peer-did>` (Civic-DID required), `/p2p/signal/inbox` (Civic-DID required), `/p2p/turn-credentials` (Civic-DID required).

### Phase 38 WSS Firehose (signal delivery)
- `grid/src/audit/firehose-hub.ts` — WsFirehoseHub with per-subscriber didContext. Phase 42 extends with per-DID frame delivery for `p2p.signal_received`.

### Audit Pattern (sole-producer)
- Any existing sole-producer file in `grid/src/` (e.g. `grid/src/civic-presence/appendPeerAnnounced.ts` pattern) — 3 new sole-producers follow the closed-tuple + payloadPrivacyCheck + audit.append triad.

### Allowlist
- `grid/src/audit/ALLOWLIST_MEMBERS.ts` (or equivalent) — Phase 42 adds exactly 3 entries: `p2p.peer_announced`, `p2p.connection_opened`, `p2p.connection_closed`. Count goes 64 → 67.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `grid/src/audit/firehose-hub.ts` — WsFirehoseHub: already has per-subscriber `didContext`. Phase 42 adds per-DID frame delivery for P2P signal notifications without a new connection type.
- `grid/src/civic-registry/civic-did-store.ts` — CivicDidStore: existing CRUD. Phase 42 calls a read method to fetch the peer's public key from their W3C VC credential.
- `brain/src/noesis_brain/wire/client.py` — GridWireClient pattern: Phase 42 P2P module follows the same httpx-based async structure.
- `brain/src/noesis_brain/wire/token_manager.py` — TokenManager: EdDSA bearer tokens. P2P announce + TURN credential calls reuse this auth.
- Phase 38 `WireQueue.db` (SQLite) — Phase 42 does NOT write to this; P2P peer tracking lives separately on Grid.

### Established Patterns
- Phase 38 bearer JWT auth (`brain_tokens` table, `brain_required` policy) — all Brain-facing routes in Phase 42 use this.
- ROUTE_DID_POLICY table — mandatory for every new Fastify route under `api/v1/`. Phase 42 adds 5 entries (policy values: `civic_did_required` for announce/signal/TURN, `visitor_public` for peer lookup).
- Sole-producer audit pattern — 3 new files follow the triad: closed-tuple payload + `payloadPrivacyCheck` + `audit.append` call.
- `operatorScope` preHandler (Phase 39) — NOT needed for P2P routes (P2P is per-Civic-DID, not per-operator).
- Phase 41 grace timer + `last_seen_at` — when peer goes `away`, their P2P peer announcement expires naturally on its own 5-minute TTL (no special integration with Phase 41 grace timer needed).

### Integration Points
- `grid/src/api/server.ts` — register 5 new routes: `POST /api/v1/p2p/announce`, `GET /api/v1/p2p/peers/:civicDid`, `POST /api/v1/p2p/signal/:peerDid`, `GET /api/v1/p2p/signal/inbox`, `GET /api/v1/p2p/turn-credentials`
- `grid/src/audit/firehose-hub.ts` — extend `WsFirehoseHub.broadcast()` with a per-DID-targeted delivery path for `p2p.signal_received`
- `brain/src/noesis_brain/wire/subscriber.py` — add handler for `p2p.signal_received` frame type → triggers P2P module to fetch + process encrypted SDP
- `brain/src/noesis_brain/wire/client.py` — add `post_p2p_announce()` called every 5 minutes (or piggybacked on the Phase 41 60s heartbeat cycle)
- coturn Docker Compose service — new container alongside Grid; AWS security group must open UDP 3478 for STUN and UDP range for TURN relay

</code_context>

<specifics>
## Specific Ideas

- The announce heartbeat (5 min) vs Phase 41 presence heartbeat (60s): Brain sends BOTH. The P2P announce is a separate `POST /api/v1/p2p/announce` call with its own 5-minute cadence (coarser than presence heartbeat). When Phase 41 grace timer fires and Nous goes `away`, the P2P peer entry expires on its own 5-minute TTL — no cross-phase integration needed.
- E2E SDP encryption: Brain fetches peer public key lazily (on first P2P attempt, cache in memory). The DID Registry W3C VC already has the public key in the credential subject. No additional key exchange protocol needed.
- `p2p.signal_received` WSS frame must NOT appear in the audit chain and must NOT be added to the allowlist. It is a private delivery mechanism only. The researcher and planner should be aware of this distinction.
- ROADMAP and REQUIREMENTS **must be updated** in the same commit as planning: remove "paid Bios per session" from Phase 42 scope and from Phase 45 scope (IRS does not need to account for TURN billing).
- coturn deployment: AWS EC2 or ECS container, ports UDP/3478 (STUN+TURN), UDP ephemeral range for TURN media relay. HMAC-SHA1 short-lived credentials (standard coturn REST API mode).

</specifics>

<deferred>
## Deferred Ideas

- **TURN paid billing** — Permanently deferred from v3.0. v3.1+ concern. ROADMAP update needed to remove "paid Bios per session" language from Phase 42 description.
- **DHT-based decentralized P2P signaling** — Already deferred by ROADMAP ("Out of scope for this phase: Decentralized P2P signaling (DHT-based)").
- **Per-operator P2P observability dashboards** — Already deferred by ROADMAP.
- **ICE trickle (streaming candidates)** — Planner should decide if Phase 42 supports only complete offer/answer exchange or full trickle ICE. Complete offer/answer is simpler.
- **P2P bandwidth caps** — REQUIREMENTS TENANT-03 mentions P2P bandwidth cap on `operator_quota_overrides`. Not implemented in Phase 42 (Grid Manager phase). coturn has its own bandwidth limits as a coturn config knob.

</deferred>

---

*Phase: 42-p2p-infrastructure*
*Context gathered: 2026-05-27*
