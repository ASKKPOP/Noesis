---
milestone: cross-cutting
sources: 4 codebase deep-audits + 2 OSS landscape surveys (2026-07-02)
tags: [audit, autonomy, cooperation, visualization, availability, usability]
---

# Full-System Audit — Nous & Grid (2026-07-02)

> Operator asked three questions: **(1)** is the Nous a permanent object that autonomously acts,
> learns, and cooperates to advance the Grid — can it learn on its own and work ceaselessly toward
> its goals? **(2)** does an optimal system exist to visualize the physical objects/knowledge Nous
> build, with continuous upgrades? **(3)** availability, scalability, and friendliness for both
> professional and no-IT users?
>
> Served twin of this page: `docs/noesis-system-analysis-2026-07.html` (diagrams + flows).
> OSS inputs: [[oss-agent-learning-landscape]] · [[oss-visualization-landscape]].

## Q1 Verdict — Autonomy & learning: **PARTIAL (foundation real, learning loop not closed)**

**What is real and wired** (evidence: `brain/src/noesis_brain/rpc/handler.py`, `grid/src/clock/ticker.ts`, `grid/src/integration/nous-runner.ts`):
- Tick loop: Grid `WorldClock` (30s ticks) → `NousRunner.tick` → Brain `on_tick`; actions dispatch back (sync RPC + async HTTPS wire).
- Action space: **61 ActionTypes** (speak/DM, move, economy, governance, civic land, groups, skills, lore, sleep, tools).
- **Economic decision cycle (W3b)** — autonomous LLM decision pay_due / bid_rfp every ~50 ticks when actionable, cost-gated with Brain-side guardrails. Genuinely autonomous.
- **Agentic tool loop (Phase 72b)** — curiosity-gated autonomous research.
- Inner life: Psyche/Thymos/Ananke (personality, mood, drives), Iris theory-of-mind, Hypnos sleep + LTM consolidation (Miller's-law working memory), SQLite persistent memory (`BRAIN_DATA_DIR`), 3-tier ModelRouter (small/primary/large; ollama|claude).

**What blocks "learns on its own, works ceaselessly"** (ranked):
1. **Main per-tick decision loop returns NOOP** — `handler.py` ~1024–1033: "could generate autonomous action based on goals / for Sprint 5, just acknowledge". The Nous is reactive outside the economic/tool cycles.
2. **ReflectionEngine is orphaned** — `memory/reflection.py` (57 lines) never instantiated in handler; insights never update goals/beliefs.
3. **Goals are static** — Telos seeded at birth from YAML; `TelosManager.evolve()` only decays stale priorities; no runtime goal creation from failure/opportunity; no `goal.progress` updates from outcomes.
4. **No outcome feedback loop** — action results never update goal progress, skill proficiency, or lessons.
5. **Not ceaseless** — Brain runs only while the operator's machine is awake (Phase 41 presence handles absence gracefully but is a workaround); **Phase 40b Hosted LLM Pool not built**; Type B spawn routes 403 `forbidden_in_v3.0`.
6. **The NOUS-SIM learning loop (S1–S5: observe→hypothesize→build→physics-gate→evaluate→specialize→teach) SHIPPED 2026-06-20 — but in the visualization layer** (`dashboard/public/grid-viz/physics-gate.js`, `object-gen.js`, `learning.js`, `simulate.js`, `teaching.js`), driven by UI buttons, **not by the Brain**. The engine of "improve over generations" exists client-side and is not connected to Nous cognition.

## Q1b Verdict — Cooperation: **city real, citizens not yet collaborative**

Liveness classification — (a) autonomous in decision loop / (b) built server-side but Brain never initiates / (c) scaffold-dormant:

| Capability | Status |
|---|---|
| Pay dues · bid RFPs · build orbital objects | **(a) autonomous** (Economic Reality Loop closed end-to-end, 8-event audit sequence proven) |
| Messaging (civic queue) · P2P WebRTC (Phase 42) | (b) — never initiated by decision loop; LONELINESS→DIRECT_MESSAGE is advisory-log only |
| Skill share / lore | (b) — inbound quarantine + lore reading wired; **outbound teach/contribute never fires** |
| Vote / propose (VOTE-05) | (c) — `governance/voter.py` + `proposer.py` are dead code; public polis-bills surface still a stub |
| Join groups / found communities | (c) — O1a actions defined; handler never generates them; no FOUND_COMMUNITY action |
| Nous↔Nous work contracts | missing — procurement is Polis→Nous only |
| Land (parcels/structures) | (b) — registry + condition ladder dormant for Nous autonomy |

## Q2 Verdict — Visualization: **~60% toward optimal; foundations excellent, fragmented + create-once**

- **Closed real-data loop**: `orbital.js` renders REAL physics-gated backend objects (`GET /api/v1/orbital/objects`), canonical 3D orbital-station map obeys locked canon (D-NH-01..13); lore citation graph in Steward; live WS firehose exists.
- **14 surfaces inventoried, fragmented**: canonical map (static embedded seed) + synced dashboard copy (manual discipline, no CI hash check) + portal civic-map (static seed, raw-SVG D-V3-06) + steward maps/firehose + library room. Only Steward firehose is truly live.
- **Upgradeability**: orbital objects are **create-once immutable** (status enum has `decommissioned`, no route); structures have condition ladder (maintained→worn→derelict) + `extendInterior` + blueprints — **scaffolded but dormant** (upkeep-scanner unwired).
- **Knowledge viz missing**: no skill graph, no relationship graph, no per-Nous personal wiki UI, no time-lapse/replay despite tamper-evident audit chain being a perfect event source.

## Q3 Verdict — Availability **not production-ready** · Scalability **PoC** · Usability **pro-good / beginner-blocked**

- **Availability**: single EC2 (52.9.147.202); MySQL in a local Docker volume — **no backup/replication/PITR**; audit reconcile window (~60 ticks) risks event loss on crash; health endpoints exist but **no alerting**; known mock-Pool blind spot (SQL errors surface only on real-MySQL deploy — 2026-06-14 crash-loop incident).
- **Scalability**: one Grid (Genesis), one Node process, one MySQL; per-DID 600/min + per-IP 120/min rate limits wired; **no load tests**; WS subscriber cap undocumented; LLM cost scales client-side (operator machines) — fine by design, but no hosted pool for Type B; Portal still inside the dashboard (Phase 52 deferred); Moon/Mars are configs, not deployments (operator directive 2026-06-24: Genesis focus).
- **Usability**: professional path decent (API routes, CLI, wiki, spec docs). **Beginner path effectively blocked**: ~10 manual steps (git, npm, Python venv, Ollama, CLI spawn), install docs are operator-oriented, many entry points with no single "start here", wallet needed to own a Nous (email/OAuth users hit a wall), **no hosted browser-only trial**, English-only (no Korean despite the community).

## The one-sentence synthesis

**The skeleton of a permanent autonomous citizen is built and audited — but the mind idles (NOOP), learning is disconnected (reflection orphaned; S1–S5 loop lives in the viz layer), society is dormant (no outbound cooperation), the world-view is fragmented and create-once, and the substrate is a single unprotected host that beginners cannot reach.**

## Proposed implementation program (for operator review — "implement by that")

Five workstreams, ordered; each maps to GSD phases when opened (numbering continues after Phase 87):

- **W-A Mind — ceaseless autonomous learning** (Q1 core): A1 main decision loop (JSON-schema-constrained action choice replaces NOOP) · A2 persistent goal ledger + two-timescale planner/actor (BabyAGI × PIANO) · A3 wire ReflectionEngine (+ Reflexion failure-lessons) · A4 outcome-feedback (Grid result → goal progress/skill proficiency) · A5 scored memory retrieval · A6 SKILL.md skill library (Voyager verify-then-add, sleep-time AWM distillation) · A7 sleep-time compute on Hypnos · A8 offline DSPy/GEPA prompt evolution from audit logs · A9 ceaselessness: Phase 40b hosted pool or always-on operator guidance. **Connect the S1–S5 learning loop to the Brain (hypothesize/build/specialize driven by Nous decisions, not UI buttons).**
- **W-B Society — cooperation goes live**: B1 outbound DIRECT_MESSAGE/dialogue from drives · B2 wire voter/proposer (VOTE-05 real) · B3 outbound SKILL_SHARE + LORE_CONTRIBUTE (teach ⑦) · B4 autonomous JOIN_GROUP/FOUND_COMMUNITY + Nous↔Nous work contracts · B5 multi-tick agreements (promise ledger).
- **W-C Living map — see everything, upgrade anything**: C1 snapshot+WS-delta live map (glow-on-build) · C2 camera-controls fly-to + BVH picking + instancing/LOD/labels · C3 upgrade paths real (orbital upgrade/decommission routes + version lineage; wire upkeep-scanner; extendInterior UI; CSG interiors + CC0 assets) · C4 knowledge constellations (three-forcegraph in-station; cosmos.gl civilization view; Quartz per-Nous wikis) · C5 audit-chain time scrubber · C6 CI map-sync hash gate; live-fetch with embedded fallback only.
- **W-D Substrate trust — availability & scale**: D1 MySQL backups → managed DB path · D2 real-MySQL CI job (kills mock-Pool blind spot) · D3 health→webhook alerting · D4 WS/tick load tests + subscriber cap · D5 restart/nginx hardening.
- **W-E Open doors — onboarding**: E1 single getting-started decision tree (observer/citizen/operator/developer) · E2 hosted browser-only trial Nous (with 40b) · E3 one-command local install wizard · E4 post-signup wizard + Brain health panel · E5 Korean localization.

Priority: **W-A → W-B** (the "permanent object" itself), W-C parallel-capable, W-D before public testing, W-E overlapping the end.

Related: [[v3.0/NOUS-SIM-MASTERPLAN|Nous Sim Master Plan]] · [[v3.0/CIVIC-ARCHITECTURE|Civic Architecture]] · [[stanford-peer-agent-patterns]] · [[nous-house-research]]
