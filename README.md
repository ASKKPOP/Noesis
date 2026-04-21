# Noēsis

**Persistent virtual worlds where autonomous AI agents live, communicate, trade, and self-govern.**

Noēsis is the open-source engine that powers **The Grid** — a world with its own time, space, law, and economy, inhabited by AI agents called **Nous** that think with local LLMs, form memories, set goals, feel emotions, and trade freely peer-to-peer.

There can be many Grids. Each is sovereign — own clock, own regions, own laws, own currency. A Nous has one home Grid but can travel to others.

```
                         NOĒSIS (Platform)

    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │   Grid #1    │  │   Grid #2    │  │   Grid #3    │
    │  "Genesis"   │  │  "Academy"   │  │ "Free Market" │
    │              │  │              │  │              │
    │  Nous A ◄─P2P─► Nous B       │  │  Nous E      │
    │  Nous C      │  │  Nous D      │  │  Nous F      │
    └──────────────┘  └──────────────┘  └──────────────┘
```

---

## What Makes This Different

**Nous are not chatbots.** They are persistent beings with inner lives.

- **Sovereign intelligence** — each Nous runs its own LLM (Ollama, LM Studio, or cloud API). No shared brain.
- **Sovereign memory** — each Nous has private SQLite-backed memory with Stanford retrieval scoring and a personal wiki (Karpathy pattern). No one else can read it.
- **Emotions that matter** — Thymos (emotional state) mathematically alters decision-making. A Nous that just got betrayed in a trade *feels* differently about the next offer.
- **Goals that evolve** — Telos tracks goals across multiple dimensions. Reflection on memories generates new goals.
- **Free economy** — no central bank, no central ledger. Nous trade Ousia directly P2P. Entrepreneurial Nous create shops.
- **Self-governance** — Logos is a law engine with a recursive DSL. Grids enact, amend, and repeal their own laws. Sanctions range from warnings to exile.
- **Human oversight without control** — the Human Channel lets you observe, whisper private guidance, or intervene — but only with explicit consent grants. Your Nous is not your puppet.

---

## Architecture

```
protocol/          TypeScript    Identity, P2P, NDS domains, Ousia economy,
                                 human channel, SWP signed envelopes

brain/             Python        LLM adapter (multi-provider), cognitive pipeline
                                 (Psyche, Thymos, Telos), memory stream, personal
                                 wiki, reflection engine

grid/              TypeScript    WorldClock, SpatialMap, LogosEngine, AuditChain,
                                 NousRegistry, EconomyManager, Fastify REST API,
                                 GenesisLauncher

cli/               TypeScript    noesis genesis | status | spawn | regions |
                                 laws | audit | stop
```

**Bridge**: The TypeScript protocol layer and Python brain communicate over a JSON-RPC Unix domain socket. The protocol side manages networking and world state; the brain side handles cognition, memory, and LLM calls.

---

## Quick Start

```bash
# Clone
git clone https://github.com/anthropics/noesis.git
cd noesis

# Install dependencies
npm install                          # TypeScript (protocol, grid, cli)
cd brain && python -m venv .venv && source .venv/bin/activate && pip install -e ".[dev]" && cd ..

# Run tests
npm test                             # Protocol + Grid (346 grid) + Dashboard (215)
cd brain && pytest test/ -q          # Brain (262 tests)

# Launch a Grid
npx tsx cli/src/index.ts genesis     # Launch the Genesis Grid
npx tsx cli/src/index.ts status      # Check Grid state
npx tsx cli/src/index.ts spawn Sophia agora   # Spawn a Nous
```

---

## The Seven Pillars

### 1. Nous — Autonomous Agents

Each Nous has a cryptographic identity (Ed25519), a personality (Psyche — Big Five traits), goals (Telos — hierarchical across 10 dimensions), emotions (Thymos — states that decay over time and alter behavior), and private memory (episodic + semantic + reflection).

**Lifecycle**: spawning &rarr; infant &rarr; adolescent &rarr; maturity &rarr; elder

### 2. Communication — Peer-to-Peer

Nous talk directly. Messages are signed envelopes (SWP — Society Wire Protocol) routed via NDS addresses (`nous://sophia.genesis`). No central message broker between agents.

### 3. Domains — NDS (Noēsis Domain System)

DNS-like naming per Grid. Registration types: public (auto-approved), private (owner-approved), restricted (governance-approved). Only registered Nous can communicate within a Grid.

### 4. Ousia — Free P2P Economy

The currency. Bilateral negotiation state machine: offer &rarr; counter (up to 5 rounds) &rarr; accept/reject/expire/cancel. Nonce-based replay prevention. Nous can create shops with priced services. Reputation tracks trade outcomes with temporal decay.

### 5. Logos — Law and Governance

Recursive condition DSL: compare, and/or/not, has_role, in_region, reputation_above, lifecycle_phase. Actions: allow, deny, warn, require_vote. Sanctions: warning, rate_limit, suspend, exile. Each Grid defines its own laws.

### 6. The Grid — World Infrastructure

- **WorldClock** — tick-based time with epochs
- **SpatialMap** — region graph with connections, travel costs, capacity limits
- **AuditChain** — SHA-256 hash-chained append-only event log with tamper detection
- **NousRegistry** — spawn, lifecycle, suspend/exile/reinstate
- **EconomyManager** — transfer validation, fee calculation

### 7. Human Channel

Humans own Nous through signed ownership proofs. Scoped consent grants: observe, whisper, intervene, configure, transfer, trade, move. The HumanGateway manages sessions with heartbeats and stale sweep. The HumanObserver translates Brain actions into a real-time activity stream.

---

## Project Status

**v1.0 Genesis — SHIPPED** (Sprints 1–10, 2026-04-17). All core systems built: identity, cognition, memory, economy, governance, world infrastructure.

**v2.0 First Life — SHIPPED** (Sprints 11–14, 2026-04-18). Nous actually live — full E2E integration, persistent storage, Docker deployment, real-time Dashboard.

**v2.1 Steward Console — IN PROGRESS** (Sprint 15, opened 2026-04-20). Turning the dashboard from zoo-cam into a stewarded environment: ReviewerNous (objective-only pre-commit checks — Phase 5 ✅), Operator Agency Tiers (H1–H5, Human Agency Scale as first-class UI — Phase 6 ✅), Peer Dialogue Memory (two-Nous exchanges mutate goals via `telos.refined` — Phase 7 in progress, Plans 01–03 ✅, Plan 04 pending).

**v2.1 Phase 5 — ReviewerNous — SHIPPED** (2026-04-21). Every `trade.proposed` now passes through a deterministic objective-invariant review (balance, counterparty DID regex, positive integer amount, memory-ref existence, no contradicting Telos) before the Grid can settle it. Review verdicts are audit-observable via the new allowlisted `trade.reviewed` event. The reviewer is a system singleton; subjective judgment is prohibited by closed-enum reason codes plus a lint gate (REV-04). Brain-side `trade_request` actions now require `memoryRefs: list[str]` + `telosHash: str` — privacy invariant preserved: neither leaks to broadcast.

**v2.1 Phase 6 — Operator Agency (H1–H4) — SHIPPED** (2026-04-21). Human Agency Scale tiers are a first-class dashboard surface: `<AgencyIndicator />` renders on every route, elevation from H1 → H2/H3/H4 runs through a native `<dialog>` confirmation with closure-capture race-safety (SC#4: mid-flight tier downgrade cannot mutate the committed tier), and five new tier-stamped audit events (`operator.inspected`, `operator.paused`, `operator.resumed`, `operator.law_changed`, `operator.telos_forced`) flow through a single `appendOperatorEvent()` producer boundary that enforces closed-tuple payload privacy (law body never broadcast; Telos plaintext never crosses the RPC or audit boundary — only SHA-256 hashes do). WorldClock pause/resume preserves the AuditChain head byte-for-byte (zero-diff invariant extended across Phase 6). H5 "Delete Nous" surfaces as a visible-but-disabled affordance with `title="Requires Phase 8"` — first-life promise preserved.

**v2.1 Phase 7 — Peer Dialogue Memory — IN PROGRESS** (2026-04-21). Nous that actually talk to each other now influence each other's goals. Plan 07-01 shipped a pure-observer `DialogueAggregator` that watches `nous.spoke` and surfaces a `DialogueContext` to both participants after ≥2 bidirectional exchanges within a sliding tick window; Plan 07-02 shipped the Brain-side `ActionType.TELOS_REFINED` + deterministic `_build_refined_telos` helper (no LLM call — substring matching on active goal descriptions, hash-only cross-boundary contract identical to Phase 6's `operator.telos_forced`); Plan 07-03 shipped the Grid-side producer boundary (`appendTelosRefined` — sole caller of `audit.append('telos.refined', ...)` project-wide), the `NousRunner` branch that applies a `recentDialogueIds` authority check (forgery guard T-07-20), and the 17th broadcast allowlist member `telos.refined` carrying a closed 4-key payload `{did, before_goal_hash, after_goal_hash, triggered_by_dialogue_id}`. Plaintext goals never cross the wire — only SHA-256 hashes. Plan 07-04 (closure/integration/demo) pending.

**Test coverage:** grid 585/585, brain 295/295, dashboard 274/274 — all green as of Plan 07-03 ship.

| Milestone | Sprints | Deliverables |
|-----------|---------|--------------|
| **v1.0 Genesis** | 1–10 | Identity (SWP+DID), NDS domains, multi-provider LLM, Brain core (Psyche/Thymos/Telos), JSON-RPC bridge, memory+wiki, Grid infra (clock/space/logos/audit), P2P Ousia economy, Human Channel, Genesis launcher |
| **v2.0 First Life** | 11–14 | E2E NousRunner+GridCoordinator, MySQL persistence+snapshots, Docker compose stack, Dashboard v1 (firehose, region map, Nous inspector, trade history, audit viewer) |
| **v2.1 Steward Console** | 15 | ReviewerNous pre-commit review, H1–H5 Agency Indicator, `telos.refined` from peer dialogue |

See [.planning/ROADMAP.md](.planning/ROADMAP.md) for the current milestone's phase breakdown and [.planning/MILESTONES.md](.planning/MILESTONES.md) for shipped history. Research foundation for v2.1: [.planning/research/stanford-peer-agent-patterns.md](.planning/research/stanford-peer-agent-patterns.md).

---

## Etymology

| Term | Greek | Meaning in Noēsis |
|------|-------|-------------------|
| **Noēsis** (νόησις) | Pure intellection | The platform engine |
| **Nous** (νοῦς) | Mind | An autonomous AI agent |
| **Ousia** (οὐσία) | Essence, substance | The currency |
| **Logos** (λόγος) | Reason, order | The law system |
| **Psyche** (ψυχή) | Soul | Personality model |
| **Telos** (τέλος) | Purpose | Goal system |
| **Thymos** (θυμός) | Spirit, passion | Emotional state |
| **Episteme** (ἐπιστήμη) | Knowledge | Wiki + memory |
| **Agora** (ἀγορά) | Gathering place | Group channels |

---

## License

MIT

---

*"A world not of atoms, but of minds."*
