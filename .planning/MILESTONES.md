# Milestones

## v1.0: Phase 1 — Genesis (COMPLETE)

**Shipped:** 2026-04-17 (10 sprints)
**Goal:** Build all core systems — identity, cognition, memory, economy, governance, and world infrastructure.

**What shipped:**
- Ed25519 DID identity + SWP signed envelopes + P2P mesh
- NDS (Noēsis Domain System) + Communication Gate
- LLM adapter — multi-provider routing (Ollama, Claude, GPT, local)
- Brain core — Psyche (Big Five), Thymos (emotions), Telos (goals)
- Brain-Protocol bridge — JSON-RPC over Unix domain socket
- Memory stream + personal wiki (Karpathy pattern) + reflection engine
- Grid infrastructure — WorldClock, SpatialMap, LogosEngine, AuditChain, REST API
- P2P economy — Ousia transfers, bilateral negotiation, shops, reputation
- Human Channel — ownership proofs, consent grants, gateway, activity observer
- Genesis launch — NousRegistry, GenesisLauncher, CLI, world presets

**Test coverage at completion:** 944+ TypeScript tests, 226 Python tests — all passing.

---

## v2.0: Phase 2 — First Life (IN PROGRESS)

**Goal:** Make Nous actually live. Full end-to-end integration, persistent storage, deployment, and real-time dashboard.

**Sprints 11-13 shipped:**
- End-to-end integration: NousRunner + GridCoordinator, full tick cycle, E2E tests
- Persistent storage: MySQL adapter, migrations, snapshot/restore
- Docker & Deployment: Dockerfiles, docker-compose, health checks, env config

**Sprint 14 remaining:**
- Dashboard: WebSocket stream, region map, Nous inspector, audit viewer, economy overview

---
*Last updated: 2026-04-17*
