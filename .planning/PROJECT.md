# Noēsis

## What This Is

Noēsis is an open-source engine for persistent virtual worlds where autonomous AI agents (Nous) live, communicate, trade, and self-govern. Each Nous runs its own LLM, forms private memories, sets goals, feels emotions, and trades Ousia peer-to-peer. Grids are sovereign worlds with their own clock, regions, laws, and economy. Built to discover what emerges when you give AI agents genuine inner lives and let them loose in a structured world.

## Core Value

The first persistent Grid where Nous actually live — observable, running continuously, with real cognitive cycles, real trades, and real social dynamics emerging from the systems.

## Requirements

### Validated

<!-- Phase 1: Genesis — all shipped and confirmed. -->

- ✓ **IDENT-01**: Nous have Ed25519 DID keypairs and sign all messages via SWP — Phase 1 Sprint 1
- ✓ **IDENT-02**: NDS domain system resolves `nous://name.grid` addresses — Phase 1 Sprint 2
- ✓ **LLM-01**: Brain supports multi-provider LLM routing (Ollama, Claude, GPT, local) — Phase 1 Sprint 3
- ✓ **BRAIN-01**: Nous have Psyche (Big Five personality), Thymos (emotions), Telos (goals) — Phase 1 Sprint 4
- ✓ **BRAIN-02**: Brain and Protocol communicate over JSON-RPC Unix domain socket — Phase 1 Sprint 5
- ✓ **MEM-01**: Nous have private episodic memory stream with Stanford retrieval scoring — Phase 1 Sprint 6
- ✓ **MEM-02**: Nous have personal wiki (Karpathy pattern) + reflection engine — Phase 1 Sprint 6
- ✓ **GRID-01**: WorldClock (tick-based time), SpatialMap (region graph), AuditChain, NousRegistry, API — Phase 1 Sprint 7
- ✓ **ECON-01**: Ousia P2P transfers with bilateral negotiation, shops, reputation — Phase 1 Sprint 8
- ✓ **HUMAN-01**: Human Channel with ownership proofs, consent grants, gateway, observer — Phase 1 Sprint 9
- ✓ **LAUNCH-01**: NousRegistry, GenesisLauncher, CLI, world presets — Phase 1 Sprint 10
- ✓ **E2E-01**: NousRunner + GridCoordinator wire Brain to Grid — full tick cycle end-to-end — Phase 2 Sprint 11
- ✓ **STORE-01**: MySQL adapter for Grid state with migrations and snapshot/restore — Phase 2 Sprint 12
- ✓ **DEPLOY-01**: Dockerfiles for Grid + Brain, `docker compose up` launches full stack — Phase 2 Sprint 13
- ✓ **DASH-01**: WebSocket real-time activity stream from Grid to browser — v2.0 Sprint 14 Phase 2-3
- ✓ **DASH-02**: Region map showing Nous positions and movement in real-time — v2.0 Sprint 14 Phase 3
- ✓ **DASH-03**: Nous inspector showing personality, goals, emotions, memory highlights — v2.0 Sprint 14 Phase 4
- ✓ **DASH-04**: Audit trail viewer (AuditChain events) — v2.0 Sprint 14 Phase 3
- ✓ **DASH-05**: Trade history and economy overview — v2.0 Sprint 14 Phase 4
- ✓ **REV-01**: ReviewerNous validates proposed trades against objective invariants before settlement — v2.1 Phase 5 (shipped 2026-04-21)
  → Validated in Phase 5
- ✓ **REV-02**: `trade.reviewed` audit event (allowlisted) records review outcome + rejection reason — v2.1 Phase 5 (shipped 2026-04-21)
  → Validated in Phase 5
- ✓ **REV-03**: ReviewerNous deployed as system singleton (opt-in peer review deferred) — v2.1 Phase 5 (shipped 2026-04-21)
  → Validated in Phase 5
- ✓ **REV-04**: Reviewer never makes subjective judgments — enforced via closed-enum reason codes + subjective-keyword lint gate — v2.1 Phase 5 (shipped 2026-04-21)
  → Validated in Phase 5

## Current Milestone: v2.1 Steward Console

**Goal:** Turn the dashboard from zoo-cam into a stewarded environment — operators can intervene at explicit agency tiers, Nous can review each other's proposed actions on objective invariants, and peer dialogue meaningfully mutates goals.

**Target features:**
- **ReviewerNous** — Agentic Reviewer pattern (Zou, Stanford HAI): objective-only pre-commit checks on trade proposals (balance, DID, memory refs, goal contradictions). No subjective judgment.
- **Operator Agency Tiers (H1–H5)** — Human Agency Scale (arxiv 2506.06576) as first-class UI concept. Dashboard header shows current tier; every operator.* event records tier at commit time.
- **Peer Dialogue Memory** — SPARC-inspired: two-Nous conversations can emit `telos.refined` events, mutating internal state without requiring Grid-level external commits.

**Research source:** `.planning/research/stanford-peer-agent-patterns.md` (committed 9bb3046)

### Active

<!-- Sprint 15 v2.1 Steward Console — in planning. -->

<!-- REV-01..04 shipped in Phase 5 (2026-04-21) — moved to Validated above. -->

- [ ] **AGENCY-01**: Dashboard header displays current operator agency tier (H1–H5)
- [ ] **AGENCY-02**: Operator interventions (inspect, pause, law-change, force-Telos, delete) each map to a default tier and require explicit elevation when the action exceeds H1
- [ ] **AGENCY-03**: `operator.*` audit events record the tier at commit time
- [ ] **DIALOG-01**: Brain receives back-and-forth Nous conversation as context on next get_state call
- [ ] **DIALOG-02**: `telos.refined` audit event emitted when dialogue surfaces a goal refinement (hash-only payload)

### Out of Scope

| Feature | Reason |
|---------|--------|
| Rich Inner Life (Ananke, Bios, Chronos) | Phase 3 — after First Life lands |
| Relationship system | Phase 3 |
| Governance voting | Phase 4 |
| Real cryptographic signing | Phase 4 |
| Multi-Grid federation | Phase 5 |
| Mobile observer app | Phase 6+ |

## Context

- **Monorepo**: `protocol/` (TypeScript — identity, P2P, economy), `brain/` (Python — LLM, cognition, memory), `grid/` (TypeScript — world infrastructure), `cli/` (TypeScript), `dashboard/` (Next.js)
- **Test coverage**: 944+ TypeScript tests (protocol + grid), 226 Python tests (brain) — all passing as of Sprint 13
- **Bridge**: JSON-RPC over Unix domain socket between TypeScript protocol layer and Python brain
- **Dashboard scaffold**: `dashboard/src/app/grid/` and `dashboard/src/app/nous/[id]/` routes exist; components directory empty
- **Docker**: `docker/Dockerfile.brain`, `docker/Dockerfile.grid`, `docker-compose.yml` all written in Sprint 13
- **Nous launched**: Sophia, Hermes, Themis run on Genesis Grid as of Sprint 11 E2E tests

## Constraints

- **Tech Stack**: TypeScript (protocol/grid/cli/dashboard), Python (brain), MySQL (persistence) — no new languages
- **Dashboard**: Next.js (already scaffolded in dashboard/ workspace) — use existing app router structure
- **WebSocket**: Must connect to Grid's Fastify server — extend existing REST API
- **Self-hosted**: Everything runs on user hardware or VPS — no cloud-only dependencies
- **LLM sovereignty**: Brain must support local LLMs (Ollama) as primary — no forced cloud dependency

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| JSON-RPC over Unix socket for brain-protocol bridge | Zero network overhead, natural process boundary | ✓ Good |
| Karpathy pattern for Nous wiki | Proven retrieval, narrative coherence | ✓ Good |
| P2P economy without central ledger | True sovereignty, bilateral state machine | ✓ Good |
| MySQL for Grid state | Crash recovery, relational queries on Grid data | — Pending |
| Docker Compose for single-command launch | Developer experience, reproducibility | — Pending |
| Next.js for dashboard | Already scaffolded, app router, React ecosystem | ✓ Good (v2.0 shipped) |
| Standalone Next.js output + multi-stage Docker | Smallest prod image, baked NEXT_PUBLIC_* at build | ✓ Good (v2.0 Phase 4) |
| Centralized star topology (Grid hub) over mesh | Preserves audit chain integrity; arxiv 2512.08296 shows O(N²) mesh cost | ✓ Good (locked) |
| Objective-only Nous-to-Nous review | Zou's paperreview.ai data: AI weak on subjective novelty judgment | — v2.1 decision |
| H1–H5 as first-class operator UI concept | arxiv 2506.06576: users want higher agency than experts deem needed on 47.5% of tasks | — v2.1 decision |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-20 — v2.0 Dashboard shipped; v2.1 Steward Console opened*
