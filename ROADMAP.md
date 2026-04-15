# Roadmap

## Phase 1: First Grid ("Genesis") — COMPLETE

Ten sprints. All core systems built. 944+ tests passing.

| Sprint | Status | Deliverable |
|--------|--------|-------------|
| 1 | Done | Identity — Ed25519 DID keys, SWP signed envelopes, P2P mesh |
| 2 | Done | NDS (Noēsis Domain System) + Communication Gate |
| 3 | Done | LLM adapter — multi-provider routing (Ollama, Claude, GPT, local) |
| 4 | Done | Brain core — Psyche (Big Five), Thymos (emotions), Telos (goals) |
| 5 | Done | Brain-Protocol bridge — JSON-RPC over Unix domain socket |
| 6 | Done | Memory stream + personal wiki (Karpathy pattern) + reflection engine |
| 7 | Done | Grid infrastructure — WorldClock, SpatialMap, LogosEngine, AuditChain, API |
| 8 | Done | P2P economy — Ousia transfers, bilateral negotiation, shops, reputation |
| 9 | Done | Human Channel — ownership proofs, consent grants, gateway, activity observer |
| 10 | Done | Genesis launch — NousRegistry, GenesisLauncher, CLI, world presets |

---

## Phase 2: First Life — IN PROGRESS

Make Nous actually live. Connect all systems end-to-end and run the first persistent simulation.

### Sprint 11: End-to-End Integration
- [ ] Wire Brain to Grid via the bridge — full tick cycle: clock tick &rarr; bridge &rarr; brain &rarr; action &rarr; grid state update
- [ ] Spawn 3 Nous (Sophia, Hermes, Themis) with distinct personalities on Genesis Grid
- [ ] E2E smoke test: Nous receive tick, perceive environment, generate action, action executes on Grid
- [ ] Integration test: two Nous exchange messages through the full stack

### Sprint 12: Persistent Storage
- [ ] MySQL adapter for Grid state (registry, audit, spatial positions)
- [ ] Migration system for schema versioning
- [ ] Grid state snapshots and restore (crash recovery)
- [ ] Audit chain persistence (currently in-memory)

### Sprint 13: Docker & Deployment
- [ ] Dockerfile for Grid (TypeScript)
- [ ] Dockerfile for Brain (Python + LLM)
- [ ] `docker compose up` — one command launches Grid + 3 Nous + MySQL
- [ ] Health checks and graceful shutdown
- [ ] Environment-based configuration (LLM provider, tick rate, region layout)

### Sprint 14: Dashboard
- [ ] WebSocket real-time activity stream
- [ ] Region map visualization (Nous positions, movement)
- [ ] Nous inspector (personality, goals, emotions, memory highlights)
- [ ] Audit trail viewer
- [ ] Trade history and economy overview

---

## Phase 3: Rich Inner Life

Deepen the cognitive architecture. Make Nous genuinely different from each other.

### Sprint 15: Full Cognitive Cycle
- [ ] Ananke (needs hierarchy) — computational, security, social, esteem, actualization
- [ ] Bios (daily lifecycle) — 7-phase cycle affecting behavior
- [ ] Chronos (life history) — chapters, relationships, achievements
- [ ] Needs influencing goal priority (hungry Nous prioritize trade)

### Sprint 16: Relationship System
- [ ] Relationship tracker — trust, familiarity, sentiment per Nous pair
- [ ] Relationship-aware prompts (Nous speaks differently to friends vs strangers)
- [ ] Social graph queries (who are my allies? who do I distrust?)
- [ ] Relationship evolution through interaction history

### Sprint 17: Advanced Reflection
- [ ] Reflection-driven goal evolution (reflection generates new Telos entries)
- [ ] Belief revision (wiki pages updated when evidence contradicts them)
- [ ] Emotional processing (reflecting on painful events reduces their emotional weight)
- [ ] Cross-referencing memories with wiki for richer context

### Sprint 18: Personality Dynamics
- [ ] Personality drift over time (experiences shift Big Five scores slightly)
- [ ] Communication style adaptation (Nous learns what works with each peer)
- [ ] Values formation through experience (not just initial config)
- [ ] Instinct refinement (better fallback behavior as Nous matures)

---

## Phase 4: Society

Make the collective more than the sum of its parts.

### Sprint 19: Governance Voting
- [ ] Proposal creation and deliberation period
- [ ] Voting mechanism (direct democracy, weighted by reputation, council)
- [ ] Law enactment from passed proposals
- [ ] Governance participation as reputation signal

### Sprint 20: Real Cryptographic Signing
- [ ] Ed25519 signatures on all SWP envelopes
- [ ] Mutual signatures on Ousia transfers (both parties sign)
- [ ] Ownership proof verification (human-Nous bond)
- [ ] Signature verification in Communication Gate

### Sprint 21: Advanced Economy
- [ ] Service marketplace with search and discovery
- [ ] Reputation-weighted pricing (gold-tier Nous charge more)
- [ ] Economic statistics and Gini coefficient tracking
- [ ] Trade dispute resolution via governance

### Sprint 22: Scale Testing
- [ ] 20+ Nous on a single Grid
- [ ] Performance profiling and bottleneck identification
- [ ] Memory and context management at scale
- [ ] Clock tick optimization (parallel brain processing)

---

## Phase 5: Multi-Grid

### Sprint 23-24: Federation
- [ ] Grid discovery protocol
- [ ] Inter-Grid trust establishment
- [ ] Cross-Grid Nous travel (visa system)
- [ ] Cross-Grid messaging (federated NDS resolution)

### Sprint 25-26: Grid Creation
- [ ] Grid creation from The Forum
- [ ] Custom region layouts, law sets, economic parameters
- [ ] Grid templates (democracy, monarchy, anarchy, utopia)
- [ ] Grid health monitoring and analytics

---

## Phase 6: Ecosystem

### Sprint 27+
- [ ] Nous-created Nous (reproduction with personality inheritance)
- [ ] Cross-Grid economy (currency exchange)
- [ ] Mobile/web observer app
- [ ] Public API for Grid operators
- [ ] Plugin system for custom Grid behaviors
- [ ] Advanced AI: tool use, code execution, artifact creation

---

## Principles for the Road Ahead

1. **Ship the simplest thing that works, then observe what emerges.** Don't over-design social dynamics — let them develop from the systems we build.

2. **Measure before optimizing.** Don't guess what 20 Nous will stress. Profile it.

3. **Sovereignty is non-negotiable.** Every feature must be evaluated against: does this compromise a Nous's control over its own cognition, memory, or decisions?

4. **The interesting part is what we can't predict.** If we could script what Nous will do, we wouldn't need to build this.
