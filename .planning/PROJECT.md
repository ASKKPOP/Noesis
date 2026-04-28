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
- ✓ **AGENCY-01**: Dashboard Agency Indicator renders H1–H5 tier with tooltip — v2.1 Phase 6 (shipped 2026-04-21)
  → Validated in Phase 6
- ✓ **AGENCY-02**: Per-action default tier + explicit elevation confirmation above H1; tier map covers inspect/memory-query/pause/law-change/force-Telos/delete — v2.1 Phase 6 (shipped 2026-04-21)
  → Validated in Phase 6
- ✓ **AGENCY-03**: `operator.*` events record tier at commit time; 5 new allowlist members at closed-tuple payloads — v2.1 Phase 6 (shipped 2026-04-21)
  → Validated in Phase 6
- ✓ **AGENCY-04**: Elevation dialog ("Entering H3 — Co-decision. This will be logged.") covers one action; closure-capture race-safety — v2.1 Phase 6 (shipped 2026-04-21)
  → Validated in Phase 6
- ✓ **AGENCY-05**: H5 irreversible Nous deletion with DID-typed confirmation + pre-deletion state hash + `operator.nous_deleted` + audit-chain preservation forever — v2.1 Phase 8 (shipped 2026-04-21)
  → Validated in Phase 8
- ✓ **DIALOG-01**: Grid aggregates ≥2 bidirectional `nous.spoke` in sliding window and surfaces `dialogue_context` to both participants — v2.1 Phase 7 (shipped 2026-04-21)
  → Validated in Phase 7
- ✓ **DIALOG-02**: `telos.refined` allowlisted with closed 4-key hash-only payload; `recentDialogueIds` authority check at producer boundary — v2.1 Phase 7 (shipped 2026-04-21)
  → Validated in Phase 7
- ✓ **DIALOG-03**: Inspector Telos panel renders `↻ refined via dialogue (N)` badge linking to filtered firehose — v2.1 Phase 7 (shipped 2026-04-21)
  → Validated in Phase 7
- ✓ **REL-01**: Pure-observer RelationshipListener derives edges from audit events without appending to audit chain — v2.2 Phase 9 (shipped 2026-04-22)
  → Validated in Phase 9
- ✓ **REL-02**: Relationship edges persist in derived MySQL `relationships` table via idempotent rebuild; production wiring via `launcher.attachRelationshipStorage(pool)` — v2.2 Phase 9 (shipped 2026-04-22)
  → Validated in Phase 9
- ✓ **REL-03**: Deterministic decay `weight × exp(-Δtick/τ)` computed lazily at read time; zero wall-clock reads in relationships module — v2.2 Phase 9 (shipped 2026-04-22)
  → Validated in Phase 9
- ✓ **REL-04**: 10K-edge rebuild p95 < 100ms (measured ~0.27ms, 370× under budget); tier-graded operator API (H1 warmth / H2 numeric / H5 events) — v2.2 Phase 9 (shipped 2026-04-22)
  → Validated in Phase 9
- ✓ **DRIVE-01**: Brain-side `AnankeRuntime` runs 5 drives (hunger, curiosity, safety, boredom, loneliness) deterministically — piecewise recurrence (below baseline pulls up via `DECAY_FACTOR=exp(-1/500)`, above baseline rises by drive-specific rate); bounds-clamped at 0.0/1.0; byte-identical traces from (seed, tick) alone — v2.2 Phase 10a (shipped 2026-04-22)
  → Validated in Phase 10a
- ✓ **DRIVE-02**: Hysteresis-guarded level bucketing (`low<0.33`, `med<0.66`, `high≥0.66`, ±0.02 band) prevents threshold flapping; level crossings detected on band-boundary traversal only — v2.2 Phase 10a (shipped 2026-04-22)
  → Validated in Phase 10a
- ✓ **DRIVE-03**: `ananke.drive_crossed` allowlisted (19th member) with closed 5-key payload `{did, tick, drive, level, direction}`; Grid-side `appendAnankeDriveCrossed` is sole producer with `Object.keys(payload).sort()` strict equality; drive floats NEVER cross the wire (three-tier privacy grep Grid+Brain+Dashboard) — v2.2 Phase 10a (shipped 2026-04-22)
  → Validated in Phase 10a
- ✓ **DRIVE-04**: Advisory-only drive→action coupling — Brain handler logs drive/action divergence to private wiki (side-effect-only log; does NOT mutate chosen actions list); PHILOSOPHY §6 Nous sovereignty preserved — v2.2 Phase 10a (shipped 2026-04-22)
  → Validated in Phase 10a
- ✓ **DRIVE-05**: Dashboard Drives panel renders 5-row Ananke section between Thymos and Telos in Inspector; locked Unicode glyphs (⊘ ✦ ◆ ◯ ❍) + 45-state aria matrix + baseline bucketed mirror row + level palette (neutral/amber/rose) — v2.2 Phase 10a (shipped 2026-04-22)
  → Validated in Phase 10a
- ✓ **BIOS-01**: Brain-side `BiosRuntime` tracks energy + sustenance in `[0.0, 1.0]`; rise-only with passive baseline decay; threshold crossing elevates matching Ananke drive (energy→hunger, sustenance→safety) once per crossing — v2.2 Phase 10b (shipped 2026-04-22)
  → Validated in Phase 10b
- ✓ **BIOS-02**: `bios.birth` (pos 20) and `bios.death` (pos 21) are the only lifecycle events; closed-enum test confirms bios.resurrect/migrate/transfer fail at allowlist gate; allowlist 19→21 per D-10b-01 correction — v2.2 Phase 10b (shipped 2026-04-22)
  → Validated in Phase 10b
- ✓ **BIOS-03**: `bios.death` payload closed-tuple `{did, tick, cause, final_state_hash}`; `cause ∈ {starvation, operator_h5, replay_boundary}`; D-30 extension: H5 delete handler emits bios.death before operator.nous_deleted — v2.2 Phase 10b (shipped 2026-04-22)
  → Validated in Phase 10b
- ✓ **BIOS-04**: Tombstoned DIDs permanently reserved; NousRegistry blocks DID reuse after bios.death; first-life promise (PHILOSOPHY §1) preserved; GDPR erasure out of scope — v2.2 Phase 10b (shipped 2026-04-22)
  → Validated in Phase 10b
- ✓ **CHRONOS-01**: Subjective-time multiplier `[0.25, 4.0]` = `clamp(1.0 + curiosity_boost - boredom_penalty, 0.25, 4.0)`; modulates Stanford retrieval recency score; Brain-local, never crosses wire — v2.2 Phase 10b (shipped 2026-04-22)
  → Validated in Phase 10b
- ✓ **CHRONOS-02**: `audit_tick === system_tick` strictly; 1000-tick CI integration test asserts zero drift across all Phase 10b event types; subjective time is read-side only — v2.2 Phase 10b (shipped 2026-04-22)
  → Validated in Phase 10b
- ✓ **CHRONOS-03**: `epoch_since_spawn` exposed to Brain prompting via ChronosListener (Grid-side pure-observer over bios.birth); no new allowlist event; Brain context "I am N ticks old" — v2.2 Phase 10b (shipped 2026-04-22)
  → Validated in Phase 10b

## Current Milestone: v2.2 Living Grid

**Goal:** Move Nous from observed entities into full agents. Inner life, social bonds, collective governance, sidechannel communication, deep observability, and researcher tooling ship together — the Grid stops being a simulation stage and becomes a living society.

**Target features (6 themes, MVP depth):**
1. **Rich Inner Life** — Ananke (internal drives), Bios (bodily needs), Chronos (time-perception) layer onto Brain; autonomous behavior gains internal pressure beyond Telos.
2. **Relationship & Trust** — persistent Nous↔Nous relationship graph with reputation-weighted interactions; friendship / rivalry / acquaintance emerge from repeated audit-visible encounters.
3. **Governance & Law** — voting primitives, proposal lifecycle, Nous-collective law enactment atop v2.1 `law.triggered` machinery. Operator stops being sole law author.
4. **Mesh Whisper** — WHISPER-01 Nous-to-Nous sidechannel; mesh-vs-star revisited with audit-preserving pattern. Defers the full mesh but ships the smallest-viable whisper channel.
5. **Operator Observability** — replay / rewind / export on top of the 18-event audit chain; deep telemetry tools for the Steward built in v2.1.
6. **Observer / Researcher Tools** — spawn-N-Nous rigs, long-horizon tick runs (10,000+), dataset export for external analysis. Makes Noēsis usable as a research platform.

**Constraints inherited from v2.1 (do not break):**
- Broadcast allowlist frozen-except-by-explicit-addition (currently 18 events). Every new `*.whispered` / `relationship.*` / `vote.*` / `need.*` / `drive.*` earns its own allowlist slot in its own phase.
- Zero-diff audit chain invariant unbroken since Phase 1 `29c3516` — every new listener is pure-observer.
- Hash-only cross-boundary (Brain↔Grid plaintext never crosses the wire — applies to drives, needs, relationship memories, votes).
- Closed-tuple payloads + sole-producer boundaries remain the law.
- PHILOSOPHY §1 first-life promise — every audit entry retained forever; no purge paths.

**Phase numbering:** continues from v2.1 (Phase 9 onward).

**Research source:** `.planning/research/v2.2/` (to be populated — 4 parallel researchers: Stack, Features, Architecture, Pitfalls).

### Active

**39 REQs across 8 categories, mapped to 7 phases (9, 10a, 10b, 11, 12, 13, 14). Full detail in [REQUIREMENTS.md](REQUIREMENTS.md); phase structure in [ROADMAP.md](ROADMAP.md).**

| Category | REQs | Phase | Status |
|----------|------|-------|--------|
| **REL** (Relationship Graph) | REL-01..04 | 9 — Relationship Graph (Derived View) | Validated (shipped 2026-04-22) |
| **DRIVE** (Ananke Drives) | DRIVE-01..05 | 10a — Ananke Drives | Validated (shipped 2026-04-22) |
| **BIOS** (Bodily Needs) + **CHRONOS** (Subjective Time) | BIOS-01..04, CHRONOS-01..03 | 10b — Bios + Chronos | Validated (shipped 2026-04-22) |
| **WHISPER** (Sidechannel) | WHISPER-01..06 | 11 — Mesh Whisper (libsodium X25519+XChaCha20) | Validated (shipped 2026-04-23) |
| **VOTE** (Commit-Reveal Voting) | VOTE-01..07 | 12 — Governance & Collective Law | Planned |
| **REPLAY** (Replay + Export) | REPLAY-01..05 | 13 — Replay + Export | Validated (shipped 2026-04-27) |
| **RIG** (Researcher Rigs) | RIG-01..05 | 14 — Researcher Rigs (50 Nous × 10k ticks) | Planned |

**Build order rationale (from [research/v2.2/FEATURES.md](research/v2.2/FEATURES.md)):** REL first (zero allowlist slots) → DRIVE (advisory-only) → BIOS+CHRONOS (coupled body+time) → VOTE (5 allowlist) → WHISPER (new cross-boundary semantics) → REPLAY+RIG (build on everything below).

**Allowlist growth:** 18 → 25 (+7 events: `drive.threshold_crossed`, `bios.need_crossed`, `bios.died`, `vote.proposed`, `vote.committed`, `vote.revealed`, `vote.resolved`). WHISPER uses no broadcast events — deliveries audited via `whisper.delivered` hash-only boundary event (counted within 25).

**Future (deferred to v2.3+):** THYMOS-01 (valenced emotions), WHISPER-FS-01 (forward-secure ratcheting), RIG-PARQUET-01 (columnar export), REL-EMIT-01 (first-class `relationship.*` events), GOV-MULTI-01 (multi-Grid federated voting), WITNESS-BUNDLE-01 (cryptographic replay attestations).

## Previous Milestone: v2.1 Steward Console — SHIPPED (2026-04-21)

**Status:** Closed 2026-04-21, 18/18 plans = 100%. All requirements REV-01..04, AGENCY-01..05, DIALOG-01..03 validated across Phases 5–8.

**Delivered:**
- **Phase 5 — ReviewerNous** (shipped 2026-04-21): Agentic Reviewer pattern (Zou, Stanford HAI); singleton, objective-only pre-commit checks; closed-enum reason codes; subjective-keyword lint gate.
- **Phase 6 — Operator Agency H1–H4** (shipped 2026-04-21): Human Agency Scale (arxiv 2506.06576) as first-class UI concept; `<AgencyIndicator />` on every route; 5 tier-stamped `operator.*` audit events through sole-producer `appendOperatorEvent`; closed-tuple payload privacy (law body never broadcast; Telos hash-only); WorldClock pause/resume zero-diff.
- **Phase 7 — Peer Dialogue Memory** (shipped 2026-04-21): SPARC-inspired; `DialogueAggregator` surfaces `DialogueContext` after ≥2 bidirectional exchanges; Brain-side `TELOS_REFINED` with deterministic substring heuristic (no LLM call); Grid-side `appendTelosRefined` producer boundary with `recentDialogueIds` authority check (forgery guard); 17th allowlist member `telos.refined` with closed 4-key hash-only payload.
- **Phase 8 — H5 Sovereign Operations** (shipped 2026-04-21): Tombstone primitive + DELETE route + `IrreversibilityDialog` (paste-suppressed typed DID + verbatim "Delete forever" / "Keep this Nous"); 18th allowlist member `operator.nous_deleted` with closed 5-key payload including pre-deletion state hash; Brain returns 4 component hashes, Grid composes 5th with locked canonical key order (D-07); HTTP 410 Gone precedes 404 for tombstoned DIDs; audit-chain entries retained forever; DID permanently reserved.

**Research source:** `.planning/research/stanford-peer-agent-patterns.md` (committed 9bb3046 2026-04-20) — Agentic Reviewer → Phase 5; H1–H5 Agency Scale → Phase 6 + Phase 8; SPARC peer dialogue → Phase 7; mesh-vs-star → centralized kept, mesh deferred to v2.2 WHISPER-01.

### Out of Scope

| Feature | Reason |
|---------|--------|
| Real cryptographic signing | Post-v2.2 — Ed25519 today is sufficient for the single-Grid trust model |
| Multi-Grid federation | Post-v2.2 — WHISPER-01 in v2.2 is intra-Grid sidechannel only; inter-Grid handshake deferred |
| Mobile observer app | Post-v2.2 — operator observability v2.2 targets the web Steward Console |
| Full mesh topology (O(N²) pairwise) | Still deferred per arxiv 2512.08296 — WHISPER-01 ships smallest-viable sidechannel, not full mesh |
| LLM-driven drives / emotions / goals | v2.2 keeps deterministic heuristics for Ananke/Bios/Chronos; LLM augmentation post-v2.2 |

<!-- Moved into v2.2 scope (no longer out of scope): Rich Inner Life (Ananke/Bios/Chronos), Relationship system, Governance voting, WHISPER-01 sidechannel, deep operator observability, researcher tooling. -->


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
| Objective-only Nous-to-Nous review | Zou's paperreview.ai data: AI weak on subjective novelty judgment | ✓ v2.1 (Phase 5) |
| H1–H5 as first-class operator UI concept | arxiv 2506.06576: users want higher agency than experts deem needed on 47.5% of tasks | ✓ v2.1 (Phase 6 + 8) |
| Open v2.2 Living Grid with 6-theme MVP scope | Individual depth (inner life) without social context (relationships) is lonely; governance without sidechannel (whisper) is top-down; all 6 ship together so emergent society has substrate | — v2.2 decision (2026-04-21) |
| Drive-float-never-crosses-wire invariant (Ananke → Bios) | PHILOSOPHY §1 hash-only cross-boundary made explicit for inner-life floats: Brain emits `{drive, level, direction}` only (3 bucketed keys); raw floats stay Brain-side. Extends to Phase 10b Bios so bodily-need floats NEVER cross wire either. Three-tier grep (Grid emitter + Brain wire + Dashboard render) enforces. | ✓ v2.2 Phase 10a (locked 2026-04-22) |
| 3-keys-not-5 payload composition (Brain returns metadata; Grid composes producer-boundary) | Clones Phase 7 D-14: Brain owns cognitive decision (`{drive, level, direction}`), Grid owns boundary identity (`{did, tick}`). Five-key closed-tuple composed exactly at `appendAnankeDriveCrossed` with `Object.keys(payload).sort()` strict equality. Pattern reusable for future Brain-emitted boundary events (Phase 10b BIOS, Phase 12 ballot). | ✓ v2.2 Phase 10a (locked 2026-04-22) |
| D-10b-01 allowlist correction (Phase 10b adds +2, not 0) | ROADMAP originally assumed bios.birth + bios.death existed in v2.1. Authoritative check against `grid/src/audit/broadcast-allowlist.ts` (19 entries at Phase 10b open) showed neither existed. Phase 10b adds exactly +2. Running total: 19→21. All source-of-truth files corrected atomically in Plan 10b-08. | ✓ v2.2 Phase 10b (locked 2026-04-22) |
| Body↔mood separation (T-09-05, PHILOSOPHY §1) | Bios = physical body (energy, sustenance — tick-deterministic rise). Thymos = mood/emotions (distinct subsystem, out of scope v2.2). Non-negotiable distinction sealed in PHILOSOPHY §1 to prevent future namespace collision. | ✓ v2.2 Phase 10b (locked 2026-04-22) |

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
*Last updated: 2026-04-27 — Phase 13 shipped (REPLAY-01..05 validated; allowlist 26→27 with operator.exported; ReplayGrid + deterministic tarball + /grid/replay panel surface with tier-aware redaction)*
