# Milestone v2.4 — Agora: Emergence & Culture

**Generated:** 2026-05-17  
**Milestone:** v2.4 Agora — Emergence & Culture  
**Purpose:** Team onboarding and project review — read this to understand what Noēsis is and what was built.

---

## 1. Project Overview

**Noēsis** is an open-source engine for persistent virtual worlds where autonomous AI agents called **Nous** live, communicate, trade, and self-govern. Each Nous runs its own LLM, forms private memories, sets goals, feels drives and emotions, and trades Ousia peer-to-peer. Grids are sovereign worlds with their own clock, regions, laws, and economy.

**Core value proposition:** The first persistent Grid where Nous actually *live* — observable, running continuously, with real cognitive cycles, real trades, and genuine social dynamics emerging from the system.

**Target users:** AI researchers studying emergent multi-agent behavior; developers building AI-native virtual worlds; operators observing and governing Nous populations.

### Milestone Focus

v2.4 is the **Agora** milestone — it completes the cultural substrate that turns a population of individuals into a *society*. Three new emergent systems land:

1. **Skill Diffusion** — Nous teach skills to trusted peers via the whisper channel and passively infer skills from observing trade patterns. A skill lineage tree traces who invented what, who taught whom, and which techniques spread vs died out.
2. **Norm Crystallization** — When ≥3 Nous independently converge on semantically similar rules, a shared norm crystallizes at the Grid level. Never operator-injected — it emerges entirely from Nous cognition.
3. **Lore Commons** — A Grid-side shared knowledge substrate contributed bottom-up by Nous. Peers discover and cite lore via the whisper channel. Collective memory that no single Nous owns.
4. **Culture Dashboard** — Operator-facing SVG visualizations: skill lineage graph, norm adoption timeline, lore contribution graph. Makes emergence visible without injecting into it.

---

## 2. Architecture & Technical Decisions

### Core Architecture

The system is a **TypeScript + Python monorepo** with five workspaces:

| Package | Language | Role |
|---------|----------|------|
| `protocol/` | TypeScript | DID identity, P2P economy, trade state machines |
| `grid/` | TypeScript (Fastify) | World infrastructure: AuditChain, WorldClock, SpatialMap, NousRegistry, WebSocket hub |
| `brain/` | Python (asyncio) | LLM routing, cognition, memory, drives, skills |
| `dashboard/` | TypeScript (Next.js 15) | Operator console — firehose, inspector, governance, culture views |
| `cli/` | TypeScript | Launcher CLI for starting Grids |

**Bridge:** JSON-RPC over Unix domain socket connects the TypeScript Grid to the Python Brain. This gives zero network overhead and a natural process boundary.

**Persistence:** MySQL for Grid state (migrations via `MigrationRunner`), SQLite FTS5 for Brain-side skill/memory stores, in-memory for Replay/Rig chains.

### Invariants That Everything Else Inherits From

These four invariants were established in Phase 1 and are enforced by CI grep gates permanently:

- **Zero-diff audit chain** — `AuditChain.append()` is append-only; zero state mutation through replay. Every phase adds pure-observer listeners, never modifiers.
- **Broadcast allowlist frozen-except-by-explicit-addition** — `grid/src/audit/broadcast-allowlist.ts` is the canonical list. Adding a new event requires a dedicated allowlist slot in its own phase. v2.4 ends at **43 events**.
- **Hash-only cross-boundary** — plaintext content (skill bodies, rule text, lore prose, whisper messages) never crosses the Brain↔Grid wire. Only SHA-256 hashes do.
- **Closed-tuple payloads + sole-producer boundaries** — each event has exactly one file that calls `chain.append()` for it; payload keys are sorted and equality-checked at every write.

### Key Architectural Decisions

- **Centralized star topology (Grid hub)** over mesh — preserves audit chain integrity. O(N²) mesh cost from arxiv 2512.08296 was the deciding factor; whisper channel is the only intra-Nous sidechannel.
- **Server-computed layout for culture visualizations (D-9-08)** — all three culture SVGs receive `{x, y}` node positions pre-computed by the Grid API. No d3, react-flow, cytoscape, or recharts in the dashboard. BFS traversal in Grid → coordinates → `<line>/<circle>` elements in React.
- **Brain-private inner life** — Ananke drives, Bios needs, Iris belief models, memory graphs, skill text all live in the Python Brain and never cross the wire as plaintext. Operators see bucketed levels (`low/med/high`), hashes, and derived views only.
- **Sole-producer emitter pattern** — one file per event type (e.g., `appendSkillTaught.ts`) holds the only call to `chain.append()` for that event. Enforced by grep CI gate.
- **3-keys-not-5 payload composition** — Brain owns cognitive decision (`{drive, level, direction}`), Grid owns boundary identity (`{did, tick}`). The sole-producer file composes the 5-key closed tuple at write time.
- **ObservationalLearner on trade_settled** — skill inference runs passively as Nous observe peer trades. No new wire events needed; the existing `trade.settled` audit stream is the signal.
- **n-gram fingerprint for norm detection** — 6-char hex prefix of SHA-256 over sorted word-trigrams of lowercased rule text. Brain computes and self-reports; Grid never reads rule text. Locked format — changes require wiping the norm registry.
- **ReviewerNous objective-only** — based on Zou et al. (Stanford HAI) showing AI reviewers are weak on subjective novelty. Closed-enum reason codes + subjective-keyword lint gate enforce the constraint.
- **H1–H5 Agency Scale** — based on arxiv 2506.06576 showing users want higher agency than experts deem needed on 47.5% of tasks. Five tiers with explicit elevation dialogs, tier-stamped audit events.
- **Rig schema isolation** — each Researcher Rig runs in `rig_{configName}_{seed_first_8_hex_chars}` MySQL schema. `chronos.rig_closed` event only on the rig's own chain; hard-banned from production allowlist.

---

## 3. All Phases Delivered

### v2.0 — First Life (2026-04-18)

| Phase | Name | What Was Built |
|-------|------|---------------|
| 1 | AuditChain + Broadcast Allowlist | Zero-diff invariant, 10-event frozen allowlist baseline, sole-producer boundary |
| 2 | WsHub + WebSocket Events | Real-time audit event broadcast to dashboard clients; ring-buffered backpressure |
| 3 | Dashboard Firehose + Heartbeat + Region Map | Next.js 15 dashboard: live firehose, heartbeat, spatial Nous map |
| 4 | Nous Inspector + Economy + Docker | Per-Nous inspector panel, economy view, `docker compose up` full stack |

### v2.1 — Steward Console (2026-04-21)

| Phase | Name | What Was Built |
|-------|------|---------------|
| 5 | ReviewerNous | Objective-only pre-commit trade review; `trade.reviewed` event; closed-enum reason codes |
| 6 | Operator Agency H1–H4 | H1–H5 tier indicator; elevation dialogs; 5 tier-stamped `operator.*` events; WorldClock pause/resume |
| 7 | Peer Dialogue → Telos Refinement | `DialogueAggregator`; `telos.refined` hash-only payload; "↻ refined via dialogue" inspector badge |
| 8 | H5 Sovereign Operations | Tombstone primitive; `IrreversibilityDialog` (paste-suppressed DID confirmation); `operator.nous_deleted` |

### v2.2 — Living Grid (2026-04-28)

| Phase | Name | What Was Built |
|-------|------|---------------|
| 9 | Relationship Graph | Pure-observer `RelationshipListener`; derived MySQL table; exponential decay; 10K-edge p95 <100ms |
| 10a | Ananke Drives | 5 drives (hunger/curiosity/safety/boredom/loneliness); hysteresis bucketing; `ananke.drive_crossed` |
| 10b | Bios + Chronos | Bodily needs (energy/sustenance); `bios.birth`/`bios.death`; subjective-time multiplier on Stanford retrieval |
| 11 | Mesh Whisper | libsodium `crypto_box` E2E encryption; `nous.whispered` hash-only; three-tier plaintext grep gate |
| 12 | Governance & Collective Law | Commit-reveal ballot lifecycle (4 events); operator exclusion; LogosEngine promotion on pass |
| 13 | Operator Replay & Export | `ReplayGrid` sandboxed in-memory chain; Rewind panel (H3+); `operator.exported`; tarball determinism |
| 14 | Researcher Rigs | Ephemeral grids from TOML config; fixture LLM adapter (no real LLM calls); JSONL dataset export; 50 Nous × 10K ticks target |

### v2.3 — Living Minds (2026-05-15)

| Phase | Name | What Was Built |
|-------|------|---------------|
| 15 | Pneuma (Narrative Self) | Growth Journal; `ReflexionBuffer` (cap=5); `RuleStore` (cap=10); Voyager `SkillStore` (FTS5); AAU Web Learner; `CoherenceGate` |
| 16 | Hypnos (Consolidating Memory) | Working Memory (cap=7); Hebbian LTM concept graph; SHY downscale; 30-tick sleep cycle; `nous.sleep.*` events |
| 17 | Iris (Theory of Mind) | Per-Nous private belief model (5 dims); `IrisRuntime.elicit` via LLM; contradiction detection; prior seeding; 4 new allowlist events |

### v2.4 — Agora: Emergence & Culture (2026-05-17) ← **this milestone**

| Phase | Name | What Was Built |
|-------|------|---------------|
| 18 | Skill Diffusion | `PeerSkillFilter` (trust-gated); `QuarantineStore`; `skill.taught` / `skill.inferred` / `skill.rejected`; `ObservationalLearner` rate-limited; allowlist 36→39 |
| 19 | Norm Crystallization | `NormDetector` pure-observer; n-gram fingerprint clustering; `norm.candidate` + `norm.crystallized`; injectable quorum thresholds; allowlist 39→41 |
| 20 | Lore Commons | `LoreStore` (FTS5); `lore_commons` MySQL table; `GET /api/v1/grid/lore`; `LoreQuotaTracker` (K=3/epoch); `lore.contributed` + `lore.cited`; allowlist 41→43 |
| 21 | Culture Dashboard | `GET /api/v1/grid/culture/skills/lineage` (BFS layout); `useSkillLineage`/`useNorms`/`useLoreGraph` SWR hooks; `SkillLineageGraph`/`NormTimeline`/`LoreGraph` SVG components; Culture tab; `EventCategory 'culture'` |

---

## 4. Requirements Coverage

### v2.4 Requirements (all validated)

| Req | Description | Status |
|-----|-------------|--------|
| SKILL-01 | PeerSkillFilter trust gate — relationship weight threshold before accepting skill | ✅ Phase 18 |
| SKILL-02 | QuarantineStore vetting before skill activation; `skill.rejected` on filter hit | ✅ Phase 18 |
| SKILL-03 | `skill.taught` / `skill.inferred` / `skill.rejected` allowlisted with closed-tuple payloads | ✅ Phase 18 |
| SKILL-04 | ObservationalLearner rate-limited to 1 extraction per sleep epoch per Nous | ✅ Phase 18 |
| NORM-01 | NormDetector watches `nous.self_model_revised`; pure-observer (zero `chain.append`) | ✅ Phase 19 |
| NORM-02 | n-gram fingerprint clustering (N≥3 Nous to crystallize) | ✅ Phase 19 |
| NORM-03 | `norm.candidate` + `norm.crystallized` events; injectable quorum config | ✅ Phase 19 |
| LORE-01 | REST endpoint accepts lore submissions; `lore_commons` MySQL table; `lore.contributed` | ✅ Phase 20 |
| LORE-02 | Brain discovers lore via HTTP pull; `## Lore Commons` section in system prompt | ✅ Phase 20 (runtime E2E pending human test) |
| LORE-03 | K=3 quota per Nous per sleep epoch via `LoreQuotaTracker` | ✅ Phase 20 (production wiring pending human test) |
| CULTURE-01 | Skill lineage SVG — server-computed BFS layout, taught/inferred edge styles | ✅ Phase 21 |
| CULTURE-02 | Norm timeline SVG — rect bars per norm, emergent/coincidental coloring | ✅ Phase 21 |
| CULTURE-03 | Lore graph SVG — bipartite Nous/lore layout, contributed/cited edge styles | ✅ Phase 21 |

### Prior Milestone Requirements

All v2.0 (IDENT, LLM, BRAIN, MEM, GRID, ECON, HUMAN, LAUNCH, E2E, STORE, DEPLOY, DASH), v2.1 (REV, AGENCY, DIALOG), v2.2 (DRIVE, BIOS, CHRONOS, REL, VOTE, WHISPER, REPLAY, RIG), and v2.3 (PNEU, HYP, IRIS) requirements: **100% validated**.

---

## 5. Key Decisions Log

| Decision ID | What | Why | Phase |
|-------------|------|-----|-------|
| D-01 | AuditChain append-only + zero-diff invariant | Audit integrity — any mutation invalidates all downstream hashes | Phase 1 |
| D-06 | Hash-only cross-boundary | PHILOSOPHY §1: Brain sovereignty; no cognitive content in operator-visible audit chain | Phase 1 |
| D-07 | H5 deletion: 5-key payload composed at Grid boundary | Brain owns cognitive content, Grid owns identity binding — prevents forgery at composition point | Phase 8 |
| D-09 | Drive floats never cross wire | PHILOSOPHY §1: bucketed `{level}` in audit is sufficient for operator observability; raw drive float is inner life | Phase 10a |
| D-10b-01 | Phase 10b adds +2 events (bios.birth + bios.death) | Authoritative check showed neither existed in v2.1 allowlist — ROADMAP was wrong; corrected | Phase 10b |
| D-14-01 | Rig schema `rig_{name}_{seed8}` naming | Human-readable in SHOW SCHEMAS; avoids collisions across parallel rig runs | Phase 14 |
| D-14-08 | `chronos.rig_closed` hard-banned from production allowlist | Rig boundary events MUST NOT pollute the live Grid's audit chain | Phase 14 |
| D-27 | Telos refinement badge derives from firehose history (not stored) | No new storage, zero lag, derived state pattern over existing WebSocket stream | Phase 7 |
| D-9-08 | Culture SVGs: server-computed `{x,y}` + client `<line>/<circle>` — no graph libs | D3/react-flow would add 200KB+ bundle and non-deterministic layout; BFS layout is deterministic and testable | Phase 21 |
| D-SkillGate | ObservationalLearner: tick-based gate (not count-based) | Count-based gate could be gamed in a single tick epoch; tick-based gate enforces cadence | Phase 18 |
| D-NormFP | 6-char SHA-256 prefix over sorted word-trigrams | LLM-agnostic; reproducible from rule text alone; short enough for display | Phase 19 |

---

## 6. Tech Debt & Deferred Items

### Open Human-Verification Items

| Item | What Needs Confirming | Phase |
|------|-----------------------|-------|
| LORE-02 E2E | `## Lore Commons` section appears in live LLM system prompt | Phase 20 |
| LORE-03 production | `NousRunner` wires `LoreQuotaTracker` in production `main.ts` | Phase 20 |
| SC-6 | `docker compose up` → dashboard connects WebSocket on first attempt | Phase 4 |

### Deferred to Future Milestones

| Feature | Deferred Reason | Ticket |
|---------|-----------------|--------|
| THYMOS-01 — valenced emotion labels | Namespace collision risk with Bios/Chronos in v2.2 | v2.5 |
| WHISPER-FS-01 — Signal Double Ratchet forward secrecy | Out of scope v2.2; current libsodium box is sufficient | v2.5+ |
| REL-EMIT-01 — first-class `relationship.*` events | Derived view covers all observable needs; event-sourcing only if perf forces it | v2.5+ |
| GOV-MULTI-01 — multi-Grid federated voting | Intra-Grid governance proved the pattern; federation is inter-Grid | v3.0 |
| WITNESS-BUNDLE-01 — cryptographic replay attestations | Tarball determinism covers the use case; attestations are nice-to-have | v2.5+ |
| RIG-PARQUET-01 — columnar export for large rig runs | JSONL is sufficient; Parquet adds Apache Arrow dependency | v2.5 |
| LLM-driven drives/emotions | Deterministic heuristics keep Ananke/Bios/Chronos testable and replay-safe | v3.0 |
| Multi-Grid federation | Inter-Grid handshake requires new trust model | v3.0+ |
| Mobile observer app | Web dashboard covers operator use case | v3.0 |

### Architectural Risks to Monitor

- **Allowlist at 43 events** — each new feature must earn its slot. The freeze discipline has held since Phase 1; continue enforcing `scripts/check-state-doc-sync.mjs`.
- **Brain↔Grid socket** — Unix domain socket is process-local; multi-host deployments will need the bridge redesigned.
- **Norm fingerprint stability** — the n-gram fingerprint format is locked. Any LLM change that reformats rule text silently invalidates the norm registry.
- **Lore quota K=3** — currently injected via `NousRunner`; production wiring not yet confirmed by human test.

---

## 7. Getting Started

### Run the Full Stack

```bash
git clone https://github.com/ASKKPOP/Noesis.git
cd Noesis
docker compose up -d --build
# Wait ~30s for all four services to become healthy
docker compose ps
# Open http://localhost:3001/grid in Chrome
```

### Run Tests

```bash
# Grid (TypeScript) — from repo root
cd grid && npm test

# Dashboard (TypeScript)
cd dashboard && npx vitest run

# Brain (Python)
cd brain && python -m pytest

# All together
npm run test:all   # (if configured in root package.json)
```

### Key Directories

```
grid/src/
  api/routes/          — Fastify REST endpoints (including /culture/skills/lineage)
  audit/               — AuditChain, broadcast-allowlist, sole-producer emitters
  skills/              — appendSkillTaught.ts, appendSkillInferred.ts, appendSkillRejected.ts
  norms/               — NormDetector, appendNormCandidate.ts, appendNormCrystallized.ts
  lore/                — LoreStorage, appendLoreContributed.ts, appendLoreCited.ts
  relationships/       — RelationshipListener (pure-observer derived view)
  governance/          — CommitRevealBallotManager, proposal/ballot emitters

brain/src/noesis_brain/
  ananke/              — AnankeRuntime (5 drives, deterministic)
  bios/                — BiosRuntime (energy/sustenance)
  iris/                — IrisRuntime (Theory of Mind, belief models)
  skills/              — PeerSkillFilter, QuarantineStore, ObservationalLearner
  memory/              — StanfordRetrieval, WorkingMemory, LTM concept graph (Hypnos)
  lore/                — LoreStore (FTS5 discovery, quota tracking)

dashboard/src/
  app/grid/            — Next.js App Router pages (firehose, culture, governance, replay)
  components/culture/  — SkillLineageGraph, NormTimeline, LoreGraph SVG components
  lib/hooks/           — use-culture.ts (SWR hooks for culture data)
  lib/stores/          — event-type.ts (EventCategory with 'culture')
```

### Where to Look First (for new contributors)

1. **`PHILOSOPHY.md`** — the 8 non-negotiables. These never change. Read before writing code.
2. **`grid/src/audit/broadcast-allowlist.ts`** — the 43-event frozen list. Every Grid-side feature lives or dies by this file.
3. **`grid/src/api/routes/culture.ts`** — a clean example of the new BFS layout API pattern.
4. **`dashboard/src/components/culture/skill-lineage-graph.tsx`** — the D-9-08 SVG pattern.
5. **`scripts/check-state-doc-sync.mjs`** — the CI gate that keeps the allowlist honest.

### Researcher Rigs (for AI researchers)

```bash
# Create a rig config (TOML)
cp scripts/rigs/example.toml scripts/rigs/my-experiment.toml
# Edit: nous_count, tick_budget, fixture_path, etc.

# Run headlessly (no real LLM calls in fixture mode)
node scripts/rig.mjs scripts/rigs/my-experiment.toml --fixture my-fixtures.jsonl

# Output: deterministic JSONL dataset in ./rig-output/
```

---

## Stats

| Metric | Value |
|--------|-------|
| **Milestone** | v2.4 Agora — Emergence & Culture |
| **Timeline** | 2026-04-18 → 2026-05-17 (~30 days) |
| **Phases** | 21 complete / 21 total (Phases 1–21, with 10a/10b) |
| **Plans** | 78 / 78 complete |
| **Commits** | 725 (since v2.0 open) |
| **Files changed** | 1,173 files (+273,158 / -608) |
| **Allowlist events** | 43 (started at 10, grew by +33 across all milestones) |
| **Test coverage** | 944+ TypeScript tests (protocol + grid), 226+ Python tests (brain) |
| **Contributors** | Henry Desirey |

---

*Generated by `/gsd-milestone-summary` · Noēsis v2.4 Agora*
