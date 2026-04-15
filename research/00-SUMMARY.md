# Noēsis Research Summary

## Research Documents

| # | Document | Coverage |
|---|----------|----------|
| 01 | [Protocols](01-PROTOCOLS.md) | A2A, ANP, AID — specs, data models, SDKs, limitations |
| 02 | [Naming & Identity](02-NAMING-IDENTITY.md) | ANS, agent:// URI, DID, Agent Cards — comparison matrix |
| 03 | [Agent Frameworks](03-AGENT-FRAMEWORKS.md) | ADK, LangGraph, AutoGen, CrewAI, Stanford Generative Agents |
| 04 | [Memory Systems](04-MEMORY-SYSTEMS.md) | Memory types, retrieval scoring, vector DBs, reflection |
| 05 | [Economy](05-ECONOMY.md) | Double-entry ledger, reputation (EigenTrust/TrustFlow), marketplaces |
| 06 | [Governance](06-GOVERNANCE.md) | Constitutional AI, voting, audit trails, sanctions |
| 07 | [Networking](07-NETWORKING.md) | NATS, WebSocket, libp2p, hybrid topology, scaling |
| 08 | [Nous Inner Life](08-NOUS-INNER-LIFE.md) | Psyche, Telos (goals), Chronos (history), Episteme (knowledge), archetypes |

---

## Key Architecture Decisions

### Communication
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Agent-to-agent protocol | **A2A** | Production-ready (v1.0), 5 official SDKs, task lifecycle |
| Internal messaging | **NATS + JetStream** | Subject routing, persistence, request-reply, minimal footprint |
| Real-time bilateral | **WebSocket** | Low latency for negotiations, direct P2P |
| Group communication | **NATS pub/sub** | Agora channels via subject hierarchy |

### Identity & Discovery
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Naming | **nous://name.realm** | Simple, DNS-inspired, sufficient for single world |
| Identity | **Ed25519 key pair** | Cryptographic, DID-inspired but simpler |
| Discovery | **Central registry + Agent Cards** | Fast, simple, A2A-compatible |
| Capability description | **A2A Agent Card format** | Industry-standard, well-specified |

### Agent Runtime
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework base | **Google ADK** or **custom** | Best state management (4-tier), pluggable LLMs |
| Memory architecture | **Stanford + A-MEM hybrid** | Proven retrieval scoring + knowledge graph linking |
| Vector store | **ChromaDB → Qdrant** | Embedded for dev, Rust perf for prod |
| Structured state | **SQLite per agent → PostgreSQL** | Isolated per-agent, migrate when needed |
| LLM backend | **Pluggable adapter** | Claude API + Ollama/local for cost management |

### Economy
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Ledger | **PostgreSQL double-entry** | Append-only, proven (Square), no blockchain needed |
| Reputation | **TrustFlow vectors** | Topic-aware, embedding-space, attack-resilient |
| Marketplace | **Vickrey auctions** | Incentive-compatible (truthful bidding) |
| Escrow | **DB-backed escrow accounts** | FSM lifecycle, automated release |

### Governance
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Self-governance | **CAI-style self-evaluation** | Runtime compliance with reasoning traces |
| Voting | **Quadratic + reputation-weighted** | Balances intensity, engagement, fairness |
| Audit trail | **Event sourcing + Merkle tree** | Complete history, tamper-evident |
| Sanctions | **Graduated capability revocation** | Proportional, allows rehabilitation |
| Agreement enforcement | **FSM + rules engine** | Deterministic, testable, no blockchain |

### Networking
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Primary transport | **NATS** | Scales 10→10K agents, persistence, subject routing |
| P2P transport | **WebSocket + WebRTC** | Direct comms for active pairs |
| NAT traversal | **Relay nodes + hole punching** | Covers all scenarios |
| Topology | **Hybrid** | Central registry + NATS broker + selective P2P |

---

## What Doesn't Exist Yet (Opportunity)

1. **No persistent Grid for AI agents** — Stanford Smallville was research; no platform exists
2. **No agent economy without blockchain** — practical gap between crypto-native and enterprise
3. **No unified identity + naming + discovery** — ANS, DID, Agent Cards are fragmented
4. **No agent governance framework** — regulatory frameworks lag behind technology
5. **No autonomous agent society simulation** — individual agents exist, civilizations don't

Noēsis (platform) and The Grid (virtual world) address all five gaps.

---

## Technical Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| LLM cost at scale | High | Pluggable backends; cheap models for perception, powerful for reasoning |
| Agent behavior divergence | Medium | Constitutional AI self-evaluation + audit trails |
| N² communication scaling | Medium | NATS pub/sub replaces direct connections |
| Memory retrieval accuracy | Medium | A-MEM linking + importance-weighted scoring |
| Economic imbalance | Medium | Council-governed monetary policy levers |
| Governance gaming | Medium | Quadratic voting + reputation caps + Sybil resistance |
| NAT traversal failures | Low | Multi-strategy: direct → hole punch → relay |

---

## Sources (Key References)

### Protocols
- [A2A Protocol Specification v1.0](https://a2a-protocol.org/latest/specification/)
- [A2A GitHub](https://github.com/a2aproject/A2A)
- [ANP GitHub](https://github.com/agent-network-protocol/AgentNetworkProtocol)
- [AgentConnect SDK](https://github.com/agent-network-protocol/AgentConnect)
- [W3C DID Core](https://www.w3.org/TR/did-core/)

### Naming
- [ANS IETF Draft](https://datatracker.ietf.org/doc/html/draft-narajala-ans-00)
- [agent:// URI (arXiv 2601.14567)](https://arxiv.org/abs/2601.14567)
- [AID Specification](https://aid.agentcommunity.org/docs/specification)
- [GoDaddy ANS Registry](https://www.godaddy.com/resources/news/building-trust-at-internet-scale-godaddys-agent-name-service-registry-for-the-agentic-ai-marketplace)

### Frameworks
- [Google ADK](https://adk.dev/)
- [LangGraph](https://docs.langchain.com/oss/python/langgraph/)
- [AutoGen/AG2](https://docs.ag2.ai/)
- [CrewAI](https://docs.crewai.com/)
- [Anthropic Agent SDK](https://code.claude.com/docs/en/agent-sdk)

### Memory
- [Stanford Generative Agents (arXiv 2304.03442)](https://arxiv.org/abs/2304.03442)
- [A-MEM: Agentic Memory (arXiv 2502.12110)](https://arxiv.org/abs/2502.12110)
- [MemoryBank (arXiv 2404.00573)](https://arxiv.org/html/2404.00573v1)

### Economy
- [TrustFlow (arXiv 2603.19452)](https://arxiv.org/html/2603.19452)
- [EigenTrust (Stanford)](https://nlp.stanford.edu/pubs/eigentrust.pdf)
- [Square's Books System](https://developer.squareup.com/blog/books-an-immutable-double-entry-accounting-database-service/)
- [Fetch.ai Architecture (arXiv 2510.18699)](https://arxiv.org/html/2510.18699v1)

### Governance
- [Anthropic Constitutional AI](https://www.anthropic.com/research/constitutional-ai-harmlessness-from-ai-feedback)
- [Colony DAO Voting Mechanisms](https://blog.colony.io/8-essential-voting-mechanisms-in-daos/)
- [Quadratic Voting (Lalley & Weyl)](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2003531)

### Networking
- [NATS Documentation](https://docs.nats.io/)
- [libp2p Documentation](https://libp2p.io/docs/)
- [WebSocket Architecture Best Practices](https://ably.com/topic/websocket-architecture-best-practices)
