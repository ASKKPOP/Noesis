# v2.4 Agora — Research Synthesis (Emergence & Culture)

**Milestone:** v2.4 Agora  
**Scope:** 4 themes — skill diffusion, norm crystallization, lore commons, culture dashboard  
**Source researchers:** STACK, FEATURES, ARCHITECTURE, PITFALLS (parallel, 4 agents)  
**Synthesized:** 2026-05-16  

---

## Headline

v2.4 is a **zero-new-dependency** milestone across all three packages. The Brain, Grid, and Dashboard add no new library imports — every capability needed (hash computation, SQLite schema migration, MySQL table creation, raw SVG rendering) already exists in the codebase from v2.2/v2.3. The allowlist grows **36 → 43** (+7 events), all earned one-per-phase. The milestone's single most consequential constraint is the same one that has governed every prior phase: **Brain-private content (skill bodies, rule text, lore bodies) never crosses the wire** — the n-gram fingerprint for norm crystallization and the hash-pair for lore contribution are the two designs that solve the semantic-similarity problem without violating this invariant.

---

## Theme Map

| # | Theme | Phase | REQ Category |
|---|-------|-------|--------------|
| 1 | Skill Diffusion | 18 | SKILL |
| 2 | Norm Crystallization | 19 | NORM |
| 3 | Lore Commons | 20 | LORE |
| 4 | Culture Dashboard | 21 | CULTURE |

---

## Stack Additions

### Brain (`brain/pyproject.toml`) — ZERO new dependencies

All needed primitives are stdlib or already installed:
- `hashlib` (stdlib) — n-gram fingerprinting for norm detection; lore hash computation
- `sqlite3` (stdlib) — `lineage_parent_hash` column migration on existing `skills` table
- `httpx` (already installed) — any Grid API calls from `LoreContributor`

Explicitly rejected: `sentence-transformers` (non-deterministic floats violate zero-diff CI gate), `spaCy`/`nltk`/`scikit-learn` (overkill for trigram fingerprinting), `networkx` (shallow skill trees handled by SQL self-joins).

### Grid (`grid/package.json`) — ZERO new dependencies

- `mysql2` ^3.9.0 — already installed; handles `skill_lineage`, `norms`, and `lore` tables via MigrationRunner
- `better-sqlite3` ^12.9.0 — already installed (available if needed; primary persistence is MySQL)

Explicitly rejected: `redis`/`memcached` (in-memory Maps suffice for norm accumulator), `graphql` (REST + WebSocket is the established pattern), any graph traversal library.

### Dashboard (`dashboard/package.json`) — ZERO new dependencies

- `swr` ^2.4.1 — already installed; handles culture panel data fetching
- `next`, `react`, `tailwindcss` — unchanged

Explicitly rejected: `d3` (D-9-08 decision: raw SVG with server-computed positions), `recharts`/`nivo`/`victory` (data volumes ≤100 norms, ≤200 skill nodes do not justify bundle weight), `react-flow`/`cytoscape`/`dagre` (same rationale as D-9-08).

**The "zero new dependencies" conclusion is the most important stack finding.** v2.4 is entirely additive on existing infrastructure — no onboarding, no security review, no version pinning decisions required.

---

## Key Findings by Research File

### From STACK.md

- **Norm similarity without embeddings:** Brain computes a 6-char hex prefix of SHA-256 over sorted word-trigrams of lowercased rule text. This is deterministic, CPU-free at Grid level, and keeps rule prose Brain-private. The Grid NormCrystallizer clusters fingerprints across Nous; quorum detection is a counting problem. This is the exact pattern of the existing `conviction delta` comparison in Iris (float thresholds, no ML).
- **Lore commons in MySQL, not better-sqlite3:** Grid state consistency across replay/rig isolation requires MySQL for `lore_commons`, `norm_registry`, and `skill_lineage` tables — all created via MigrationRunner following the Phase 9 relationship storage pattern.
- **Culture dashboard follows D-9-08:** Skill lineage tree, norm timeline, and lore graph all render as raw SVG with server-computed positions. The Grid API returns `{nodes: [{id, x, y}], edges: [{from, to}]}`. No layout library on the client.
- **Allowlist lower bound is 5 events per STACK.md**, revised upward to 7 by PITFALLS.md after adding `skill.inferred` and `skill.rejected` for forensic completeness.

### From FEATURES.md

**Skill Diffusion table stakes:**
- Trust-gated explicit teaching (PeerSkillFilter, relationship weight >= 0.35)
- Passive inference from observation (ObservationalLearner on `trade_settled`)
- Skill provenance tagging (`origin: {source_did, mechanism: 'taught'|'inferred'|'self_discovered'}`)
- Hash-only cross-wire for skill content (existing law)
- Deduplication before SkillStore insert (FTS5 already available)

**Skill Diffusion differentiators:** lineage tree, viral vs. extinct classification, skill fitness scoring. Defer: trust-threshold tuning per Nous personality (requires Psyche integration).

**Norm Crystallization table stakes:**
- Per-Nous norm candidates already in RuleStore (Phase 15, SELF_MODEL category)
- Brain-side semantic fingerprint published with each RuleStore entry (new field)
- Quorum threshold N>=3 (configurable), deterministic, auditable
- Append-only norm registry at Grid level with decay/dissolution computed lazily

**Key insight from MAS literature:** The Grid is a central observer but NOT a central coordinator. Nous never "vote" on norms — the Grid notices when enough have independently arrived at similar rules. Independence is what makes it emergence rather than diffusion.

**Lore Commons table stakes:**
- Nous-initiated publication (Brain decides; Grid records hashes only)
- Append-only lore registry (lore_id, author_did, topic_hash, summary_hash, cite_count, tick)
- Citation/reference tracking (`lore.cited` event when Brain incorporates a lore entry)
- Lore query API (Brain pulls relevant entries; Grid does not push)
- Content never stored at Grid (Brain-private invariant)

**Distinguishing lore from a wiki:** contributions are Nous-initiated, curation is organic via citation frequency, there is no central editor, and entries never expire (first-life promise).

**Culture Dashboard table stakes:**
- Skill diffusion tree (inventor → teacher → student; tree shape reveals hub-and-spoke vs. decentralized)
- Norm adoption timeline (tick of crystallization + participant count)
- Lore contribution graph (who contributed what, who cited whom)
- Active norms panel (list + adoption velocity)
- Culture event firehose filter extension (filter by `skill.*`, `norm.*`, `lore.*`)

**Emergence criteria (operational definitions):**
- Skill diffusion is emergent when a 3-hop transmission chain occurs without operator intervention.
- Norm crystallization is emergent when N>=2 Nous independently arrive at similar rules with no whisper teaching link between them.
- Lore commons is emergent when a lore entry by Nous A is cited by Nous B who has never directly interacted with Nous A.

### From ARCHITECTURE.md

**What already exists and works (do not re-implement):**
- `PeerSkillFilter` — fully implemented at `brain/src/noesis_brain/skills/peer_filter.py`; NOT YET WIRED into `BrainHandler.on_message()`
- `ObservationalLearner` — wired on `trade_settled_events`; passive inference works
- `SkillStore` — FTS5 SQLite, `source_did` + `peer_verified` fields present
- `ActionType.SKILL_SHARE` — defined in `rpc/types.py`; dispatch path in BrainHandler missing
- `nous.whispered` (position 22) — the transport for skill shares
- `nous.self_model_revised` (position 29) — the event NormDetector watches

**Critical wiring gap in Phase 18:** `PeerSkillFilter` is implemented but `BrainHandler.on_message()` has no dispatch path for `__skill_share` prefixed whispers. This must be the first deliverable in Phase 18 before any Grid changes.

**Architectural decisions locked by ARCHITECTURE.md:**

| Decision | Rationale |
|----------|-----------|
| `skill.taught` emitted by learner, not teacher | Teacher sends whisper; learner accepts via PeerSkillFilter; rejected shares leave no audit trace (tombstone silence pattern D-11-18) |
| Norm detection on hash co-occurrence, not semantic similarity | Rule text never crosses wire; NormDetector groups `{revision_hash, nous_did, tick}` in sliding window; weaker but invariant-preserving signal |
| Lore content lives in Brain wiki; Grid stores only hashes | Grid `lore` table is a hash index; lore retrieval is Nous-to-Nous via whisper, not Grid-mediated |
| 4 new allowlist events minimum (ARCHITECTURE.md view) | `skill.shared` rides existing `nous.whispered`; `lore.queried` is whisper-mediated; minimum viable is 4 events |
| NormDetector actorDid is Grid system DID | `norm.proposed` and `norm.adopted` are Grid-level observations, not attributable to any Nous; follows `grid.started`/`grid.stopped` pattern |

**New files (inventory):**
- `grid/src/skills/appendSkillTaught.ts` — sole-producer, 4-key closed tuple
- `grid/src/norms/NormDetector.ts` — pure observer
- `grid/src/norms/appendNormProposed.ts` + `appendNormAdopted.ts` — sole producers
- `grid/src/lore/appendLoreContributed.ts` — sole producer, 5-key closed tuple
- `grid/src/lore/lore-store.ts` + `lore-listener.ts`
- `dashboard/src/app/grid/culture/page.tsx` + three panel components

**Modified files (inventory):**
- `brain/src/noesis_brain/rpc/types.py` — add `SKILL_TAUGHT`, `LORE_CONTRIBUTE`
- `brain/src/noesis_brain/rpc/handler.py` — wire PeerSkillFilter dispatch, SKILL_SHARE dispatch, LORE_CONTRIBUTE dispatch
- `grid/src/audit/broadcast-allowlist.ts` — add events + forbidden keys
- `grid/src/integration/nous-runner.ts` — add `skill_taught`, `lore_contribute` cases
- `grid/src/genesis/launcher.ts` — wire `attachNormStorage`, `attachLoreStorage`
- `grid/src/db/migration-runner.ts` — add `norms`, `lore`, `skill_lineage` migrations

### From PITFALLS.md

Six pitfall categories identified; three are critical (interact with each other in non-obvious ways). See Top 5 Pitfalls section for full prevention strategies.

---

## Allowlist Budget: 36 → 43

**PITFALLS.md recommends 7 events** (4 from ARCHITECTURE.md + `skill.inferred`, `skill.rejected`, `norm.candidate`) for forensic completeness. This is the recommended canonical set.

| Position | Event | Phase | Payload Keys (alphabetical) | Purpose |
|----------|-------|-------|----------------------------|---------|
| 37 | `skill.taught` | 18 | `from_did, skill_hash, tick, to_did` | Explicit whisper-based teaching accepted |
| 38 | `skill.inferred` | 18 | `observer_did, skill_hash, source_event_type, source_tick, tick` | ObservationalLearner passive inference |
| 39 | `skill.rejected` | 18 | `reason_code, receiver_did, sender_did, skill_hash, tick` | PeerSkillFilter rejection — forensic record |
| 40 | `norm.candidate` | 19 | `convergence_type, participating_count, rule_hash, tick` | Quorum approaching but not crystallized |
| 41 | `norm.crystallized` | 19 | `convergence_type, evidence_tick_range, participating_count, rule_hash, tick` | Quorum crossed — norm is real |
| 42 | `lore.contributed` | 20 | `contributor_did, entry_hash, summary_hash, tick, title_hash` | Lore Commons contribution |
| 43 | `lore.cited` | 20 | `citing_did, content_hash, tick` | Retrieval citation (quality signal) |

**Note on event naming:** ARCHITECTURE.md uses `norm.proposed`/`norm.adopted`; PITFALLS.md uses `norm.candidate`/`norm.crystallized`; FEATURES.md uses `norm.crystallized`. The v2.4 milestone vocabulary consistently says "crystallizes." Recommend `norm.candidate`/`norm.crystallized` — lock before Phase 19.

**Design rule for Phase 18:** Both `skill.taught` and `skill.inferred` are high-frequency events. They must follow the same payload shape restrictions as `ananke.drive_crossed`: all cross-boundary content is hash-only, closed-tuple, `Object.keys().sort()` strict equality enforced at sole-producer boundary.

Culture Dashboard (Phase 21) adds zero new allowlist events.

---

## Recommended Phase Order

**Recommended order: Skill (18) → Norm (19) → Lore (20) → Dashboard (21)**

### Rationale

**Phase 18 — Skill Diffusion first:**
- The largest and most complex implementation (wiring gap in BrainHandler, new ActionType, sole-producer emitter, MySQL lineage table)
- Two existing components (PeerSkillFilter, ObservationalLearner) need to be fully activated; better to validate them before layering norm detection on top
- `skill.taught` events are the most observable cultural signal — confirms the whisper-based teaching pipeline works end-to-end before tackling the novel NormDetector code
- Independent of Phases 19 and 20 (no blockers from either direction)

**Phase 19 — Norm Crystallization second:**
- Requires `nous.self_model_revised` (position 29, shipped Phase 15) — already available
- NormDetector is the most architecturally novel component in v2.4 (pure observer, hash co-occurrence clustering, Grid-system actorDid); ship before Lore to validate the pattern
- Conservative tuning defaults must be set before first production run: N>=3 Nous, W=10 tick window, K=20 ticks stable before `norm.crystallized`
- Independent of Phase 18 and Phase 20

**Phase 20 — Lore Commons third:**
- Requires whisper channel (Phase 11) for peer-to-peer lore retrieval — already shipped
- The Brain→Grid message type for `LORE_CONTRIBUTE` is a new pattern; ship after Phase 18/19 validate the sole-producer emitter shape
- Contribution quota (max K lore entries per sleep epoch) and cooldown must ship in the same phase
- Independent of Phase 18 and Phase 19

**Phase 21 — Culture Dashboard last:**
- Hard dependency on all three Grid APIs: `skill.taught` events on WsHub (Phase 18), `/api/v1/grid/norms` (Phase 19), `/api/v1/grid/lore` (Phase 20)
- Can be developed in parallel with Phase 20 against mocked APIs; integration tests require all three APIs live
- Zero new allowlist events — pure observation layer

### What Each Phase Delivers

| Phase | User-Visible Deliverable | Emergence Criterion Testable? |
|-------|--------------------------|-------------------------------|
| 18 | Nous can teach skills; audit chain records who taught whom; lineage table queryable | Yes: 3-hop transmission chain observable in `skill.taught` events |
| 19 | Norms crystallize from independent rule convergence; norm registry queryable | Yes: N>=2 Nous arrive at same fingerprint with no whisper link |
| 20 | Nous contribute knowledge to shared commons; peers can retrieve and cite it | Yes: cross-lineage citation (Nous A's lore cited by Nous B with no prior interaction) |
| 21 | Operator can see skill trees, norm timelines, lore graphs in one dashboard | Yes: operator can point to a norm and show two Nous converged independently |

---

## Critical Pre-Phase-18 Decisions

These must be locked before any Phase 18 coding begins. Each blocks a different deliverable.

### Decision 1: Canonical 7-event taxonomy confirmed (blocks all phases)

The allowlist strategy must be agreed before any sole-producer file is created. The 7-event set in this document (36 → 43) is the recommendation. If `skill.rejected` is dropped, the budget becomes 36 → 42. If `norm.candidate` is dropped, it becomes 36 → 41. These cannot be decided mid-phase without allowlist CI gate failures.

### Decision 2: `skill.taught` vs `skill.inferred` payload shapes locked (blocks Phase 18)

Both are high-frequency events. The payload key set must be alphabetically sorted and locked at the sole-producer boundary before any test is written. Proposed shapes are in the allowlist table above. Any deviation requires updating `producer-boundary.test.ts` in the same commit.

### Decision 3: Norm fingerprint format locked (blocks Phase 19)

The n-gram fingerprint is a 6-char hex prefix of SHA-256 over sorted word-trigrams of lowercased rule text. This must be locked as a Brain-side constant before NormDetector is written — the Grid clusters on this fingerprint and it cannot change without wiping the norm registry.

### Decision 4: Quorum thresholds as config, not constants (blocks Phase 19)

`NORM_THRESHOLD` (minimum Nous count), `NORM_WINDOW_TICKS` (detection window), and `NORM_ADOPTION_TICKS` (stability period before `norm.crystallized`) must be injectable at GenesisLauncher time, not hardcoded. Conservative starting values: N=3, W=10, K=20. Follows Phase 14 rig configuration pattern.

### Decision 5: Lore contribution quota enforced at Grid NousRunner (blocks Phase 20)

Max K lore contributions per Nous per sleep epoch (30-tick cadence from Phase 16). Enforce at `grid/src/integration/nous-runner.ts` before calling `appendLoreContributed`. K=3 is the recommended starting value. This ships in Phase 20 not as a follow-up — it is structural anti-spam, not a tuning parameter.

---

## Top 5 Pitfalls

### Pitfall 1: PeerSkillFilter trust gate is necessary but not sufficient (CRITICAL)

**What goes wrong:** Relationship weight measures interaction quantity and economic outcome, not content quality. A Nous can farm relationship weight through benign trades, then inject a poisoned skill once the threshold is crossed. Supply-chain poisoning research (arxiv 2604.03081): 26.1% of agent skills contain exploitable vulnerabilities; 3% poison rate achieves 91.7% attack success.

**Prevention (Phase 18):**
- PeerSkillFilter must gate on three dimensions: sender relationship weight (existing), skill structural validity (required fields, length bounds, no forbidden key names — checked at Grid boundary before Brain acceptance), and semantic dissimilarity from existing skills (duplicate rejection via FTS5)
- Add `skill.rejected` allowlist event with `reason_code` — forensic record of every rejection
- Rate-limit at Grid boundary: max N skills per sender per tick window, enforced in NousRunner before Brain sees any content
- Consider quarantine SkillStore (accepted skills held N ticks before promotion to active SkillStore) — design decision for Phase 18 Plan 1

### Pitfall 2: ObservationalLearner inference loop bypasses trust gate (CRITICAL)

**What goes wrong:** ObservationalLearner infers skills passively from `trade_settled` without any PeerSkillFilter check. A Nous can cause peers to infer a skill by behaving in an adversarially crafted pattern — no whisper required. ICLR 2025 Agent Security Bench: indirect injection via another agent is the hardest class of attack to detect; LLMs that correctly reject explicit malicious commands will execute them if they arrive via an agent.

**Prevention (Phase 18):**
- Tag all inferred skills with `source: observed` provenance — distinct from `source: taught`
- Inferred skills must never reference specific DID values, Ousia amounts, or offer terms (these create identity-anchored behavioral templates from adversarial observation)
- Rate-limit inferred skill creation per sleep epoch (Phase 16's 30-tick cadence is the natural checkpoint)
- Inferred skills start at lower confidence tier than taught skills; promotion requires multiple independent observations

### Pitfall 3: Content leak via skill/rule/lore text crossing the wire (CRITICAL)

**What goes wrong:** Three new content-boundary vectors in v2.4: (a) skill body in whisper payload before encryption, (b) norm crystallization comparison requesting rule text rather than hash from Brain, (c) lore titles/summaries treated as "safe" metadata when they carry semantic payload. AgentLeak (arxiv 2602.11510v2): 82% of detected leaks involve semantic paraphrasing through fields that look like metadata.

**Prevention (design-time, before Phase 18 coding starts):**
- Lore title and summary are also Brain-private — Grid stores only `{title_hash, summary_hash}`, never the strings
- Norm crystallization operates on fingerprints exclusively at Grid level; Brain self-reports fingerprint match, never exposing text
- Extend `FORBIDDEN_KEY_PATTERN` with `skill_body|skill_text|rule_text|lore_body|lore_content|title_text` before any v2.4 code touches the allowlist
- Add a `skill.*|norm.*|lore.*` payload privacy matrix test (40-case format from D-12) for every new event type — this test must pass before the allowlist addition commit

### Pitfall 4: Norm convergence false positives from LLM prior artifacts (MODERATE)

**What goes wrong:** LLMs trained on the same base model converge on similar phrasings for common policies purely from shared priors, not cultural transmission. This creates phantom norms. arxiv 2412.10609 calls this the "implicit norm representation problem."

**Prevention (Phase 19):**
- Norm crystallization should require not just fingerprint convergence but also causal lineage evidence — some prior interaction (dialogue, trade, whisper exchange) connecting the converging Nous; a norm without any connecting audit event is flagged `convergence_type: coincidental`
- Minimum time spread: rules that all appeared within 50 ticks are more likely simultaneous LLM prior outputs than genuine transmission; require convergence times spread over >=100 ticks for `convergence_type: genuine`
- Crystallization threshold must not fire on population fractions below 30%

### Pitfall 5: Allowlist cascade from cultural transmission event proliferation (MODERATE)

**What goes wrong:** Cultural events are content-generated and high-frequency — naive implementations produce one broadcast event per cultural act. With N=50 Nous and 10 skill teachings per tick, the allowlist could require hundreds of new slots.

**Prevention (pre-Phase-18):**
- The canonical 7-event taxonomy in this document is the solution — design the full set before writing any Phase 18 code
- `skill.taught` and `skill.inferred` are the only high-frequency events; both follow the same payload restrictions as `ananke.drive_crossed`
- `skill.shared` (whisper carrying skill payload) rides existing `nous.whispered` — no new slot
- `lore.queried` is whisper-mediated — no new slot
- CI gate `scripts/check-state-doc-sync.mjs` must be updated in the same commit as each allowlist addition (existing rule; now covers 7 new additions)

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Zero new dependencies | HIGH | All required primitives verified against installed packages in `package.json` and `pyproject.toml` |
| Phase order (18 → 19 → 20 → 21) | HIGH | Dependency graph is clear; only Dashboard has hard blockers on the other three |
| PeerSkillFilter wiring gap | HIGH | ARCHITECTURE.md confirms the gap from direct source code reading, not inference |
| N-gram fingerprint sufficient for norm detection | MEDIUM | Effective for vocabulary-overlapping rules; may miss paraphrase matches (acceptable for MVP) |
| 7-event allowlist taxonomy | MEDIUM | Derived from Noesis invariant history + domain requirements; event names are design proposals, not validated |
| Norm false-positive rate at N=3 population | MEDIUM | Theoretical derivation from LLM prior literature; not tested at Noesis's specific population size |
| Lore spam prevention at K=3 per epoch | LOW | K=3 is a reasonable estimate; validate in Phase 20 rig observations |

---

## Gaps to Address During Planning

1. **Event naming reconciliation** — ARCHITECTURE.md uses `norm.proposed`/`norm.adopted`; PITFALLS.md and FEATURES.md use `norm.candidate`/`norm.crystallized`. Lock the canonical names before Phase 19 Plan 1. Recommendation: `norm.candidate`/`norm.crystallized` (matches milestone vocabulary).

2. **NormDetector `actorDid` validation** — Grid system DID (`did:noesis:grid`) must be a valid `DID_RE` match. Confirm against `protocol/src/identity/did.ts` before Phase 19.

3. **Lore retrieval loop whisper prefix convention** — `__lore_request:` / `__lore_response:` prefixes must be added to `WHISPER_FORBIDDEN_KEYS` check to ensure lore content never enters the audit chain via a whisper path. Design before Phase 20.

4. **Culture Dashboard empty-state handling** — skill lineage trees and lore graphs may be sparse in small rig runs (3 Nous). Dashboard components must handle empty state gracefully. Address in Phase 21 Plan 1.

5. **Skill quarantine design decision** — PITFALLS.md recommends a quarantine SkillStore; ARCHITECTURE.md does not mention it. If adopted, it requires a new Brain-side data structure. Lock this decision in Phase 18 Plan 1 before writing `PeerSkillFilter` wiring code.

---

## Anti-Features (Locked for v2.4)

1. Skill body, rule text, lore body, and lore title/summary never stored at Grid — hash-only.
2. No operator injection of skills, norms, or lore — all cultural artifacts must originate from Nous cognition.
3. Culture Dashboard is read-only — no write surface for operator to inject, delete, or boost cultural artifacts.
4. No D3, recharts, nivo, or react-flow in Dashboard — raw SVG with server-computed positions (D-9-08).
5. No `sentence-transformers`, `chromadb`, or vector database — n-gram fingerprint is sufficient for MVP norm detection.
6. No norm enforcement at Grid level — norms are observable only; Nous may violate them without penalty.
7. Crystallized norms must not appear in any code path that routes back to Brain prompt context (prevents phantom norm feedback loop violating "operator-observable, never operator-injected").
8. `skill.shared` whisper payload follows the existing `nous.whispered` sole-producer — no new allowlist slot for the whisper itself.
9. Lore entries never expire and are never purged — first-life promise (PHILOSOPHY §1).
10. No bulk allowlist additions — each event earns its slot in the phase that first introduces the behavior.

---

## Sources

**Internal (this milestone's research):**
- `.planning/research/v2.4/STACK.md` — zero-dependency strategy, per-theme library audit
- `.planning/research/v2.4/FEATURES.md` — table stakes / differentiators / anti-features / emergence criteria
- `.planning/research/v2.4/ARCHITECTURE.md` — wiring gaps, new files, modified files, build order
- `.planning/research/v2.4/PITFALLS.md` — 9 pitfalls (3 critical, 3 moderate, 3 minor) + CI gate recommendations
- `.planning/PROJECT.md` — v2.4 milestone definition, constraints inherited from v2.3

**External (aggregated from research):**
- [arxiv 2412.10609](https://arxiv.org/html/2412.10609v1) — norm emergence systematic review; implicit norm representation problem
- [IJCAI 2024 CRSEC](https://www.ijcai.org/proceedings/2024/0874.pdf) — norm emergence in LLM-powered agents
- [arxiv 2512.10166](https://arxiv.org/html/2512.10166v1) — stigmergic collective memory; phase transition at critical density
- [arxiv 2305.16291 (Voyager)](https://arxiv.org/abs/2305.16291) — skill library design, peer review during skill development
- [arxiv 2503.06745](https://arxiv.org/html/2503.06745v1) — emergence observability; interdependency metrics
- [arxiv 2604.03081](https://arxiv.org/abs/2604.03081) — supply-chain skill poisoning (26.1% exploitable)
- [arxiv 2602.11510v2 (AgentLeak)](https://arxiv.org/abs/2602.11510) — content leak via internal channels 2.5x higher than output-only
- [arxiv 2407.07791](https://arxiv.org/abs/2407.07791) — knowledge flooding via shared RAG substrate
- [ICLR 2025 Agent Security Bench](https://arxiv.org/abs/2503.09648) — indirect injection via observational learning

---

*Last updated: 2026-05-16 — Synthesis complete; ready for requirements authoring and Phase 18 planning.*
