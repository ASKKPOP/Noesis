# Research: P2P Networking and Infrastructure

## 1. Recommended Architecture: Hybrid Topology

```
Layer 1: Central Registry (Discovery + Identity)
Layer 2: Message Broker — NATS (group comms + persistence)
Layer 3: Direct P2P — WebSocket/WebRTC (low-latency bilateral)
Layer 4: Relay Nodes (NAT traversal fallback)
```

---

## 2. NATS (Primary Messaging)

### Why NATS

| Feature | NATS | RabbitMQ | Redis Pub/Sub |
|---------|------|----------|---------------|
| **Latency** | Sub-millisecond | Higher | Sub-millisecond |
| **Persistence** | JetStream (mem+file) | Disk-backed | None |
| **Delivery** | At-most-once, at-least-once, exactly-once | At-most/least-once | At-most-once only |
| **Protocol** | Simple text-based | AMQP (complex) | Redis protocol |
| **Deployment** | Single small binary | JVM + Erlang | Redis server |
| **Request-Reply** | Native first-class | Application-level | Application-level |
| **Auth** | TLS, NKEYS (Ed25519), JWT | SASL, TLS | Password, TLS |
| **Multi-tenancy** | Built-in accounts | Virtual hosts | DB numbers |

### JetStream Features

**Subject-Based Routing** — natural for agent communication:
```
world.events.>                    -- World state changes
governance.proposals.>            -- Proposals and votes
nous.<id>.inbox                   -- Per-agent message inbox
regions.<region>.broadcast        -- Regional broadcasts
trade.offers.>                    -- Trade marketplace
agora.<topic>.>                   -- Group discussion channels
```

**Consumers**:
- Push: Server delivers immediately (real-time reactions)
- Pull: Agent requests batches on demand (horizontal scaling)

**Persistence**: Memory or file, configurable replication (R=1 dev, R=3 prod). RAFT consensus.

**Retention policies**: Limits (N messages/time), work queue (exactly-once, auto-delete), interest (retain while consumers exist).

**Key-Value Store**: Built on JetStream. Atomic operations, compare-and-set, watch for changes, value history. Ideal for agent state, reputation scores.

**Object Store**: Large file chunking. Models, datasets, world snapshots.

**Exactly-once**: Publisher unique message IDs + server dedup. Consumer double-ack.

### Noēsis Subject Hierarchy

```
noesis.world.tick                          -- World clock
noesis.world.events.{event_type}           -- World events
noesis.nous.{id}.inbox                     -- Direct messages
noesis.nous.{id}.status                    -- Presence heartbeat
noesis.agora.{topic}                       -- Group channels
noesis.trade.offers.{service_type}         -- Service marketplace
noesis.trade.bids.{offer_id}              -- Auction bids
noesis.governance.proposals.{id}           -- Proposals
noesis.governance.votes.{proposal_id}      -- Votes
noesis.governance.announcements            -- Council announcements
noesis.registry.registrations              -- New Nous registration events
noesis.audit.{nous_id}                     -- Audit trail events
```

---

## 3. WebSocket for Direct P2P

### When to Use Direct vs NATS

| Use Case | Channel |
|----------|---------|
| Bilateral negotiation (real-time) | Direct WebSocket |
| Group discussion | NATS agora.{topic} |
| Service marketplace broadcast | NATS trade.offers.> |
| Governance voting | NATS governance.> |
| Presence/heartbeat | NATS nous.{id}.status |
| Audit logging | NATS audit.{id} |
| High-frequency interaction pair | Direct WebSocket |

### Connection Pooling

- Pool per destination agent
- Health checks via ping/pong
- Capacity: 500K+ idle connections per server with 16GB RAM

### Reconnection

- Exponential backoff with jitter: `min(base * 2^attempt + jitter, max_backoff)`
- Session state in external store (Redis/NATS KV) for server-agnostic resumption
- Message sequence numbers for replay on reconnect

### Message Queuing During Disconnection

- Server-side per-agent buffer with TTL
- Three levels: at-most-once, at-least-once, exactly-once
- Backpressure: throttle high-volume agents, prioritize control messages

---

## 4. libp2p Assessment

### Relevant Components

| Component | Node.js | Browser | Notes |
|-----------|---------|---------|-------|
| TCP | Yes | No | Traditional |
| WebSocket | Yes | Yes | HTTP-compatible |
| WebRTC | Yes | Yes | NAT-traversable |
| mDNS | Yes | No | Local discovery |
| Kademlia DHT | Yes | Yes | Global discovery |
| GossipSub | Yes | Yes | Pub/sub |
| Circuit Relay | Yes | Yes | NAT fallback |
| Hole Punching (DCUtR) | Yes | Limited | Direct upgrade |

### Assessment for Noēsis

**Strengths**: Modular, crypto identity per peer, proven at scale (IPFS, Ethereum), browser support.

**Weaknesses**: No message persistence (fire-and-forget), DHT bootstrap problem, high complexity, no request-reply.

**Verdict**: Use selectively — WebRTC for browser agents, hole punching technique for NAT traversal. Don't use as primary messaging (NATS is better).

---

## 5. Scaling Strategy

| Scale | Registry | Messaging | P2P | Relays |
|-------|----------|-----------|-----|--------|
| **10 agents** | Single instance | Single NATS | Full mesh possible | Not needed |
| **100 agents** | Single instance | Single NATS | Frequent pairs only | 1-2 |
| **1,000 agents** | Replicated (3x) | NATS cluster (3 nodes, R=3) | Active pairs only | 3-5 regional |
| **10,000 agents** | Sharded | NATS supercluster | Rare; NATS primary | 10+ geo-distributed |

### Key Transitions

- **10→100**: Move from full-mesh to selective direct connections. Add NATS for groups.
- **100→1,000**: Registry replication. NATS cluster. Relay nodes. Direct P2P only for high-frequency pairs.
- **1,000→10,000**: Shard registry by region. NATS superclusters. Most comms through NATS. Direct P2P = optimization only.

---

## 6. NAT Traversal

### Strategy

```
1. Agent connects to registry, reports public/private address
2. When Agent A wants to reach Agent B:
   a. Registry returns B's address info
   b. Try direct connection (WebSocket)
   c. If fails → attempt hole punching (STUN-like)
   d. If fails → route through nearest relay node
   e. After relay established → attempt upgrade to direct (DCUtR pattern)
```

### Relay Nodes

- Deployed at well-known public addresses
- Forward traffic between NATed peers
- Research shows: well-distributed relays add minimal latency (intra-region hop only)
- Selection: Registry returns nearest relay based on agent location
