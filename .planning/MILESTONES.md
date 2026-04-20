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

## v2.0: First Life (COMPLETE)

**Shipped:** 2026-04-18 (Sprints 11-14)
**Goal:** Make Nous actually live. Full end-to-end integration, persistent storage, deployment, and real-time dashboard.

**What shipped:**
- **Sprint 11** — End-to-end integration: NousRunner + GridCoordinator, full tick cycle, E2E tests
- **Sprint 12** — Persistent storage: MySQL adapter, migrations, snapshot/restore
- **Sprint 13** — Docker & Deployment: Dockerfiles, docker-compose, health checks, env config
- **Sprint 14** — Dashboard v1:
  - Phase 1: AuditChain listener API + broadcast allowlist (zero-diff invariant)
  - Phase 2: WsHub + `/ws/events` endpoint with ring-buffered backpressure
  - Phase 3: Dashboard firehose + heartbeat + region map (Next.js 15)
  - Phase 4: Nous inspector + economy + Docker polish (standalone Next + compose)

**Test coverage at completion:** grid 346/346, brain 262/262, dashboard 215/215 — all green.
**SC status:** 6/7 phase 4 success criteria MET; SC-6 (live docker compose smoke) verified on operator machine after shipping.

---

## v2.1: Steward Console (IN PROGRESS)

**Goal:** Turn the observational dashboard into a stewarded environment. Operators can intervene at explicit agency tiers, Nous review each other's proposed actions on objective invariants only, and peer dialogue meaningfully mutates goals.

**Research foundation:** `.planning/research/stanford-peer-agent-patterns.md` (2026-04-20)
- Agentic Reviewer pattern (Zou, Stanford HAI) → ReviewerNous
- Human Agency Scale H1–H5 (arxiv 2506.06576) → operator UI
- SPARC peer-dialogue → telos.refined from two-Nous exchanges

**Target features:**
- ReviewerNous — objective-only pre-commit checks on trades (REV-01, REV-02)
- Operator Agency Tiers — H1–H5 first-class UI concept with tier-stamped audit events (AGENCY-01, AGENCY-02, AGENCY-03)
- Peer Dialogue Memory — `telos.refined` from two-Nous exchanges (DIALOG-01, DIALOG-02)

---
*Last updated: 2026-04-20*
