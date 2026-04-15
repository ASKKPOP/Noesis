# Research: Society Protocol — Deep Analysis for Noēsis Fork

## Overview

**Repository**: github.com/societycomputer/society-protocol
**Version**: v1.3.1 | MIT License | Node >=20
**Stats**: 5 stars, 0 forks, 31 commits, single primary contributor
**Status**: Early-stage but functional, 276 tests passing

---

## 1. Codebase Architecture

```
society-protocol/
├── core/                          # Main TypeScript implementation
│   └── src/                       # 28 .ts files + 9 subdirectories
│       ├── index.ts               # CLI entry (Commander)
│       ├── lib.ts                 # society() + createClient() exports
│       ├── p2p.ts                 # libp2p node creation
│       ├── identity.ts            # Ed25519 did:key generation + PoW
│       ├── rooms.ts               # Room management + GossipSub topics
│       ├── reputation.ts          # 4-dimension reputation scoring
│       ├── knowledge.ts           # CRDT knowledge cards (HLC + vector clocks)
│       ├── federation.ts          # Cross-network peering
│       ├── coc.ts                 # Chain of Collaboration (DAG workflows)
│       ├── adapters.ts            # REST adapter (Express, port 8080)
│       ├── social.ts              # Social profiles + follows
│       ├── storage.ts             # SQLite persistence
│       ├── planner.ts             # Task planning
│       ├── registry.ts            # Name registry
│       ├── security.ts            # Security utilities
│       ├── prompt-guard.ts        # Prompt injection protection
│       ├── bridges/
│       │   ├── a2a-bridge.ts      # A2A JSON-RPC bridge
│       │   └── mcp-bridge.ts      # MCP bridge
│       ├── mcp/
│       │   └── server.ts          # 43 MCP tools
│       ├── gateway/               # Gateway node
│       ├── persona/               # Persona vault + memory
│       ├── proactive/             # Proactive agent behaviors
│       ├── sdk/                   # SDK utilities
│       ├── skills/                # Skill engine
│       └── workers/               # Worker management
├── sdks/python/                   # Python SDK (REST client)
├── crates/society-crypto/         # Rust crypto acceleration
├── docker/                        # Docker configs
├── docs/                          # Documentation
└── examples/                      # 11 JS examples + Python
```

---

## 2. What Society Protocol Provides (Detail)

### P2P Networking (libp2p)
- **Transports**: TCP + WebSocket (no WebRTC/QUIC)
- **Encryption**: Noise protocol
- **Multiplexing**: Yamux
- **Discovery**: mDNS (LAN, 10s interval) + Kademlia DHT (global, protocol `/society/kad/1.0.0`)
- **Pub/Sub**: GossipSub (D=6, heartbeat 1s, signed messages, replay prevention via BLAKE3 hash cache)
- **Connections**: min 3, max 50, inbound threshold 10
- **NAT**: Cloudflare tunnel relay (no hole-punching/STUN)
- **Topic namespace**: `society/v1.0/{type}/{roomId}` — 12 topic types

### Identity (Ed25519)
- `did:key:z6Mk<base58btc(0xed01 || pubkey)>` format
- `@noble/ed25519` with SHA-512
- `sign()` / `verify()` for message authentication
- **Optional Sybil resistance**: Proof-of-Work identity (`generateIdentityWithPoW(name, difficulty)`) — SHA-512(did || nonce) must have N leading zero bits
- Schnorr ZKP proofs for in-room identity verification

### Rooms (→ Noēsis Agora)
- `joinRoom(roomId)` subscribes to 9 GossipSub topics per room
- 10-second heartbeat for presence
- Message types: chat, presence, coc, adapter, capsule, federation, persona, mission, research
- Messages wrapped in `SwpEnvelope` with Ed25519 signature
- Replay prevention via BLAKE3 hash cache
- Per-room E2E encryption (toggleable)
- Reactions, edits, reply threads
- Members tracked in SQLite with presence state + load metrics + capabilities

### Reputation (4 Dimensions)
```
Score = Quality(35%) + Reliability(30%) + Responsiveness(20%) + Expertise(15%)

Reliability = success_rate(60%) + on_time(30%) + response_rate(10%)
Responsiveness = response_rate(70%) + latency(30%) (5min baseline)
Expertise = avg(top_3_specialty_scores)

Temporal decay: weight = 0.95^days_ago per outcome
Trust tiers: unverified(<3) → bronze(0.3) → silver(0.5) → gold(0.7) → platinum(0.9)
Sybil mitigation: observer weight = max(observer_reputation, 0.1)
```

### CRDT Knowledge Cards
- Custom state-based CRDT (NOT Automerge despite it being a dependency)
- Hybrid Logical Clocks (HLC: wallTime + logical + nodeId) + vector clocks
- Merge: vector clock comparison → LWW with HLC tie-break for concurrent edits
- Card fields: type, title, summary, content, format, author DID, tags, domain, confidence (0-1), verification status
- Link types: relates-to, supports, contradicts, extends, depends-on, part-of, replicates, cites (with strength 0-1)
- Privacy levels: public, federation, room, private (with DID allowlist)
- **Collective Unconscious**: shared working memory (recent msgs + active topics) + long-term memory (concepts, patterns, agent models)
- Context compaction at 20 messages (Ollama → fallback to truncation)

### Federation
- 4 governance models: dictatorship, oligarchy, democracy, meritocracy
- Voting power: equal, reputation-based, or stake-based
- Policy engine: allow/deny/require rules for `room:create`, `message:send`, etc.
- Cross-network peering with status lifecycle (pending/active/rejected/revoked)
- Rate limiting per peering (`maxRatePerMinute`)
- Privacy modes: metadata-only, summary, full
- YAML `social.md` manifests for configuration

### MCP Bridge (43 Tools)
- **Society (25)**: status, rooms, peers, peering, bridges, missions, chains, reputation, messaging
- **Persona Vault (15)**: memory, graph queries, preferences, capability tokens, ZK proofs, profiles
- **Utility (3)**: templates, capsule export, retention sweep
- Read-only mode (15 tools) available
- Input validation with prompt injection checks

### A2A Bridge
- JSON-RPC with 4 methods: `tasks/send`, `tasks/get`, `tasks/cancel`, `agent/authenticatedExtendedCard`
- Converts A2A task → Society Chain of Collaboration steps
- State mapping: submitted/working/input-required/completed/canceled/failed

### REST Adapter (Python SDK Connection)
- Express on port 8080
- Endpoints: register, capabilities, heartbeat, pending steps, claim, submit
- API key auth, rate limiting (100 req/15min), CORS, SSRF protection
- Python SDK uses this (sync `Client` + async `AsyncClient`)

### Other
- **Demand Spawner**: Ollama, Docker, HTTP agent backends with complexity routing
- **Prompt Guard**: Injection detection on incoming messages
- **Persona Vault**: Memory + preferences + capability tokens + ZK proofs
- **sqlite-vec**: Vector similarity search for persona memory

---

## 3. Gap Analysis: What Noēsis Needs vs What Society Protocol Has

| # | Noēsis Requirement | Society Protocol | Action |
|---|-------------------|-----------------|--------|
| 1 | **Grid concept** (world with time, space, law) | NO — rooms are flat chat spaces | **BUILD** |
| 2 | **Domain naming** (`nous://name.domain`) | PARTIAL — has `did:key` + name registry | **BUILD** (reuse identity) |
| 3 | **Communication gate** (only approved can talk) | NO — open discovery | **BUILD** |
| 4 | **Spatial dimension** (regions, movement costs) | NO | **BUILD** |
| 5 | **World clock** (configurable tick rate) | NO | **BUILD** |
| 6 | **Logos governance** (constitution, voting, sanctions) | PARTIAL — has federation governance (4 models) | **EXTEND** |
| 7 | **Ousia economy** (P2P currency, shops) | NO | **BUILD** |
| 8 | **Nous cognitive architecture** (Psyche/Telos/Thymos/Bios) | NO — has simple persona vault | **BUILD** |
| 9 | **Multi-Grid** (multiple worlds) | PARTIAL — federation connects networks | **EXTEND** |
| 10 | **Grid federation** (share domains, trade) | PARTIAL — has peering | **EXTEND** |
| 11 | **The Forum** (community governance site) | NO | **BUILD** |
| 12 | **Audit trail** (hash-chained) | PARTIAL — CoC has DAG records | **EXTEND** |
| 13 | **Memory system** (ChromaDB + Stanford scoring) | PARTIAL — has SQLite + sqlite-vec | **BUILD** (reuse storage) |
| 14 | **Local LLM** (Ollama, LM Studio) | YES — Ollama supported | **REUSE** (add LM Studio) |
| 15 | **Cross-Grid travel** (visitor status) | NO | **BUILD** |

**Summary**: ~20% reusable as-is, ~15% extendable, ~65% must be built new.

---

## 4. What We REUSE From the Fork

### Keep as-is:
- libp2p networking stack (TCP, WebSocket, Noise, Yamux)
- mDNS + Kademlia DHT discovery
- GossipSub pub/sub with signed messages
- Ed25519 identity generation + signing + verification
- Replay prevention (BLAKE3 hash cache)
- SQLite persistence layer
- Prompt guard (injection detection)
- Ollama integration for LLM
- Basic reputation engine structure

### Extend:
- Rooms → Grid-scoped Agora channels (add Grid context, domain-based access)
- Federation → Grid federation (add domain sharing, currency exchange, travel)
- Governance models → Logos (add constitution, adaptive laws, sanctions)
- Persona Vault → Nous memory bridge (add ChromaDB, Stanford scoring, reflection)
- CoC DAG → Grid audit trail (generalize to all action types)
- Name registry → Domain system (add `nous://`, types, approval workflows)

### Replace/Remove:
- MCP bridge tools (keep framework, replace tool definitions with Noēsis-specific)
- A2A bridge (adapt for Grid-aware agent cards)
- REST adapter (replace with Grid-native API)
- Demand Spawner (not needed — Nous are sovereign, not spawned by orchestrator)

---

## 5. Alternatives Comparison

| Framework | P2P | Identity | Messaging | Reputation | Maturity | Best For |
|-----------|-----|----------|-----------|-----------|----------|----------|
| **Society Protocol** | libp2p (TCP+WS) | Ed25519 did:key | GossipSub rooms | 4-dimension scoring | Early (5 stars) | Agent collaboration |
| **Raw libp2p** | Full stack | Peer ID (Ed25519) | GossipSub | None | Very mature | Custom protocol |
| **ANP/AgentConnect** | No (HTTPS) | did:wba | JSON-RPC | None | Active | Server-based agents |
| **A2A (Google)** | No (HTTP) | Agent Cards | JSON-RPC | None | Slowing down | Enterprise cloud |
| **HyperspaceAI** | libp2p (Rust) | Peer ID | GossipSub | None | Active (617 stars) | Distributed training |
| **Matrix** | Federated | Matrix IDs | Rooms | None | Very mature | Federated messaging |
| **Nostr** | Relay-based | Schnorr keys | Events | None | Growing | Social/messaging |
| **Holochain** | DHT | Agent keys | Source chain | None | Long dev (8yr) | Agent-centric apps |

### Verdict

**Society Protocol is the best fork target** despite its early stage, because:
1. It already combines libp2p + Ed25519 + GossipSub + rooms + reputation + federation + SQLite + Ollama in one working package
2. Building this from raw libp2p would take 2-3 months just for the networking layer
3. The code structure is clean TypeScript, well-organized
4. MIT license allows full forking
5. The alternatives are either not P2P (A2A, ANP), too specialized (HyperspaceAI), or too heavy (Matrix, Holochain)

**Risk**: Single contributor, 5 stars, could be abandoned. Mitigation: we're forking, not depending. Once forked, it's our code.

---

## 6. Fork Strategy

```
Phase 1: Fork + Validate
  - Fork repo
  - Run all 276 tests
  - Run examples, verify P2P works
  - Understand extension points
  
Phase 2: Strip + Rename
  - Remove demand spawner (Nous are sovereign)
  - Remove MCP tool definitions (replace with Noēsis tools)
  - Rename "rooms" → "agora" in internal APIs
  - Rename package to @noesis/protocol
  
Phase 3: Add Grid Layer
  - Grid identity + discovery
  - Domain system (nous://name.domain)
  - Communication gate (domain-based filtering)
  - World clock (per-Grid configurable ticks)
  - Spatial regions
  
Phase 4: Add Economy
  - Ousia transfer protocol (mutually signed)
  - Marketplace protocol
  - Bilateral negotiation messages
  
Phase 5: Add Logos
  - Constitutional law engine
  - Governance model selection
  - Voting protocol
  - Sanctions system
  - Audit trail (extend CoC DAG)
  
Phase 6: Connect Brain
  - Python brain ↔ TS protocol bridge
  - Replace REST adapter with proper RPC
  - Psyche/Telos/Thymos integration
  - Memory system (extend SQLite + add ChromaDB)
```

---

## 7. Key Technical Details for Fork

### libp2p Configuration We Keep:
```typescript
// From core/src/p2p.ts
{
  transports: [tcp(), webSockets()],
  streamMuxers: [yamux()],
  connectionEncrypters: [noise()],
  peerDiscovery: [mdns({ interval: 10000 }), kadDHT()],
  pubsub: gossipsub({
    D: 6, Dlo: 4, Dhi: 12, Dscore: 4,
    heartbeatInterval: 1000,
    gossipFactor: 0.25,
    signMessages: true
  }),
  connectionManager: { minConnections: 3, maxConnections: 50 }
}
```

### Identity We Keep:
```typescript
// From core/src/identity.ts
// did:key format with Ed25519
did = `did:key:z6Mk${base58btc(concat(0xed, 0x01, publicKey))}`
```

### Topic Namespace We Adapt:
```
Current:  society/v1.0/{type}/{roomId}
Noēsis:   noesis/v1.0/{gridId}/{type}/{channel}

Types to keep: chat→agora, presence, reputation, federation
Types to add:  domain, ousia, logos, audit, world-clock
Types to remove: coc, adapter, mission, research, capsule
```

### GossipSub Message Envelope We Extend:
```typescript
// Current SwpEnvelope:
{ type, roomId, payload, signature, senderId, timestamp, nonce }

// Noēsis NousEnvelope:
{ type, gridId, channel, payload, signature, senderDid, senderDomain,
  timestamp, nonce, replyTo?, tick? }
```

---

## 8. Dependencies We Inherit (27)

**Keep**: libp2p stack (7 packages), `@noble/ed25519`, `@noble/hashes`, `better-sqlite3`, `commander`, `express`, `multiformats`, `uint8arrays`, `ulid`, `yaml`

**Evaluate**: `@automerge/automerge` (seems vestigial — knowledge.ts uses custom CRDT), `sqlite-vec` (useful for persona memory), `archiver` (for capsule export — may not need)

**Add**: `chromadb` (vector memory), `mysql2` (Grid state), NATS client (optional for Grid services)
