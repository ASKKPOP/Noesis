# Roadmap: Noēsis — v2.4 Agora (Emergence & Culture)

## Overview

v2.3 gives Nous a mind that authors itself. Three themes — Narrative Self (Pneuma), Consolidating Memory (Hypnos), and Social Cognition (Iris) — build on top of the v2.2 Living Grid's frozen audit chain. The Nous can now learn continuously from the open web, reflect on failures, maintain an immutable creed, sleep to consolidate experience into long-term memory, and model the beliefs and intentions of peers. Allowlist grows **27 → 36** (+9 events across 3 phases, all Brain-private content; only hashes cross the wire).

Phase numbering continues from v2.2 — do NOT reset without `--reset-phase-numbers`.

## Milestones

- ✅ **v1.0 Genesis** (shipped 2026-04-17) — Phases 1-10, 944+ TS tests, 226 Py tests
- ✅ **v2.0 First Life Sprints 11-14** (shipped 2026-04-18) — E2E, persistence, Docker, Dashboard v1
- ✅ **v2.1 Steward Console — Phases 5-8** (shipped 2026-04-21, 18/18 plans)
- ✅ **v2.2 Living Grid — Phases 9-14** (shipped 2026-04-28, 44/44 plans)
- ✅ **v2.3 Living Minds — Phases 15-17** (shipped 2026-05-15, 16/16 plans)
- ✅ **v2.4 Agora — Phases 18-21** (shipped 2026-05-20, 115/115 plans)
- 🔄 **v2.5 Human Portal — Phases 22-29** (opened 2026-05-20)

## Phases (v2.5 Human Portal — Active)

- [x] **Phase 22: Web3 Identity** — SIWE (Sign-In With Ethereum) auth, MetaMask/WalletConnect, human DID issuance (`did:noesis:human:<address>`), `human_users` MySQL table, JWT session layer. Allowlist 43→44 (+1: human.joined). (completed 2026-05-20)
  **Plans**: 4 plans
  Plans:
  - [x] 22-01-PLAN.md — Grid: human_users migration (v9) + HumanRegistry service
  - [x] 22-02-PLAN.md — Grid: SIWE auth endpoints + JWT issuance + human.joined emitter
  - [x] 22-03-PLAN.md — Dashboard: wagmi provider + wallet connect UI + portal layout
  - [x] 22-04-PLAN.md — Dashboard: SIWE sign-in flow + auth store + Next.js middleware
- [x] **Phase 23: Cyber Coin Wallet** — EVM on-chain balance display (USDT/ETH), wagmi integration, send form, transaction history. Dashboard UI shipped. Grid endpoint + human.transferred emitter deferred to Phase 24 (allowlist stays at 44). (completed 2026-05-20)
  **Plans**: 1 plan
  Plans:
  - [x] 23-01-PLAN.md — Dashboard: WalletPanel (ETH/USDT balances, send form, tx history)
- [x] **Phase 24: Portal Shell** — region presence on profile, profile completeness (region + wallet balance + join date), mobile hamburger sidebar, portal home live Grid stats. Allowlist stays at 45 (no new events). (completed 2026-05-21)
  **Plans**: 5 plans
  Plans:
  - [x] 24-01-PLAN.md — Grid: migration v10 (region column) + HumanRecord/Registry + JWT/me extension
  - [x] 24-02-PLAN.md — Dashboard: HumanUser type + auth hydration + profile page (3 new rows)
  - [x] 24-03-PLAN.md — Dashboard: mobile sidebar (PortalShell/Sidebar/Header hamburger overlay)
  - [x] 24-04-PLAN.md — Dashboard: portal home live stats polling + updated labels/content
  - [x] 24-05-PLAN.md — Tests: WALLET-04 verification + Phase 24 test coverage gaps
- [x] **Phase 25: Steward Console expansion** — Operator-facing observability + write actions (25a/25b/25c). Allowlist 45→51 (+6 sanction events). **25a ✓ 25b ✓ 25c ✓ (replay scrubber + culture browser)**
  Phase 25c plans:
  - [x] 25c-01-PLAN.md — Wave 0: relationships.ts header-auth + humanSanctionStore + SpawnNousDeps wiring
  - [x] 25c-02-PLAN.md — Wave 1: D-07 replay-client.test.tsx RED→GREEN + @vitejs/plugin-react fix
  - [x] 25c-03-PLAN.md — Wave 2-3: StewardShell Observatory nav + /replay listing page + scrubber modal
  - [x] 25c-04-PLAN.md — Wave 4: /culture page + NousFilterBar + three raw-SVG culture components
  - [x] 25c-05-PLAN.md — Wave 5: regression gates + doc-sync
- [x] **Phase 26: Sophia Onboarding** — Fast-proxy LLM chat (out-of-tick), goal-setting wizard, animated world introduction, Sophia as guide persona, first-time user flow with welcome Cyber Coin allocation. *(originally Phase 25 — pushed by Steward Console priority)* (completed 2026-05-23)
- [x] **Phase 27: Nous Interaction** — Humans chat with Sophia/Hermes/Themis via `/portal/chat`, send Cyber Coin tips, browse Nous activity feed, view skills/lore/norms the Nous have produced. Allowlist 51→52 (+1: human.spoke). (completed 2026-05-23)
  **Plans**: 4 plans
  Plans:
  - [x] 27-01-PLAN.md — Grid: appendHumanSpoke sole-producer + human.spoke allowlist (51→52) + POST /api/v1/portal/chat/nous/:nousId
  - [x] 27-02-PLAN.md — Brain skill-by-hash endpoint + Grid portal Nous data endpoints (skills/lore/norms)
  - [x] 27-03-PLAN.md — Chat page: NousSidebar + ConversationPane + TipPanel + SVG avatars
  - [x] 27-04-PLAN.md — Nous profile page: HeroCard + ProfileTabBar + Skills/Lore/Norms tabs
- [ ] **Phase 28: Personal Nous** — Human spawns own Nous agent (costs Cyber Coin), names it, picks personality seeds, it gets a DID and runs in the Genesis Grid alongside Sophia/Hermes/Themis. `humanOwner` field wired. Allowlist +1 (nous.spawned_by_human).
  **Requirements:** [SPAWN-01, SPAWN-02, SPAWN-03, SPAWN-04, SPAWN-05, SPAWN-06]
  **Plans:** 5 plans
  Plans:
  - [x] 28-01-PLAN.md — Grid foundation: allowlist 53 + appendNousSpawnedByHuman + bootstrapPsycheHash extension + migrations v15/v16 + check-frozen.ts
  - [x] 28-02-PLAN.md — Wave 0 test scaffolds (RED): spawn-nous.test.ts + append-nous-spawned-by-human.test.ts + broadcast-allowlist.test.ts length 53
  - [x] 28-03-PLAN.md — Portal spawn API: POST /spawn + GET /spawn/status + /spawn/config + /spawn/check-name + /me/nous + chat.ts dynamic personal-Nous prompt
  - [ ] 28-04-PLAN.md — Dashboard 4-step spawn wizard at /portal/nous/spawn (wagmi USDT payment + 3s polling/2-min timeout)
  - [ ] 28-05-PLAN.md — Dashboard /portal/my-nous owner hub (double-duty: empty CTA + OwnerHub + PersonalNousAvatar + HeroCard extension)
- [ ] **Phase 29: Community** — User directory, community board (posts, replies), live activity feed, follow other users, leaderboard by Cyber Coin holdings and Nous contributions.
- [ ] **Phase 30: Resources & Support** — Help center, interactive guide, FAQ, onboarding documentation, support ticket flow, Noēsis glossary (Nous, Ousia, Agora, lore, norms explained).

## Phases (v2.4 Active)

- [x] **Phase 18: Skill Diffusion** — Wire PeerSkillFilter + ObservationalLearner into teaching/inference paths. Allowlist 36→39 (+3: skill.taught, skill.inferred, skill.rejected). (completed 2026-05-16)
- [x] **Phase 19: Norm Crystallization** — NormDetector pure-observer clusters rule fingerprints across Nous. Allowlist 39→41 (+2: norm.candidate, norm.crystallized). (completed 2026-05-16)
- [x] **Phase 20: Lore Commons** — Nous-initiated shared knowledge substrate (hash index only). Allowlist 41→43 (+2: lore.contributed, lore.cited). (completed 2026-05-17)
- [x] **Phase 21: Culture Dashboard** — Skill lineage tree + norm timeline + lore graph as raw SVG. Allowlist 43→43 (no new events). (completed 2026-05-17)

## Phases (v2.3 — Shipped)

- [x] **Phase 15: Pneuma (Narrative Self)** — Growth Journal + ReflexionBuffer + RuleStore + Voyager Skill Library + AAU Web Learner + Coherence Gate. Allowlist 27→30. (shipped 2026-05-14)
- [x] **Phase 16: Hypnos (Consolidating Memory)** — Per-Nous sleep/consolidation: Working Memory (cap=7) → NREM Hebbian LTM concept graph → SHY downscale. Allowlist 30→32. (shipped 2026-05-15)
- [x] **Phase 17: Iris (Theory of Mind)** — Per-Nous private belief model of peers (5 dims: belief/desire/intention/knowledge/emotion). 27/27 verified. Allowlist 33→36. (shipped 2026-05-15)

## Phase Details (v2.3)

### Phase 15: Pneuma (Narrative Self) [x] (shipped 2026-05-14)
**Goal**: A Nous can author its own growth journal, verbally reflect on failures via ReflexionBuffer, accumulate strategic rules in a RuleStore, learn reusable procedures via a Voyager-style Skill Library, and continuously learn from the open web via the AAU Learner — all Brain-private, with only content-hashes crossing the wire.
**Depends on**: Phase 14 (Researcher Rigs prove deterministic Brain fixture mode; AAU Learner must not call real LLMs during rig runs; FixtureBrainAdapter must handle SKILL_LEARN + CREED_VIOLATION action variants)
**Requirements**: PNEU-01 (Growth Journal), PNEU-02 (ReflexionBuffer), PNEU-03 (RuleStore), PNEU-04 (Skill Library), PNEU-05 (AAU Web Learner), PNEU-06 (Coherence Gate)
**Success Criteria** (what must be TRUE):
  1. Growth Journal appends one entry per tick cycle with fields `{tick, summary_hash, reflection_refs}`; journal is Brain-private (no plaintext crosses the wire). `nous.reflection_authored` fires once per authored entry with closed-tuple payload `{nous_did, tick, entry_hash}`.
  2. ReflexionBuffer stores up to 5 verbal post-hoc self-critiques; buffer overflow evicts oldest. Reflexion entries injected at prompt-build time. Evidence: GPT-4 HumanEval 80% → 91% pass@1 (arxiv.org/abs/2303.11366).
  3. RuleStore accumulates strategic guidelines as WikiCategory.SELF_MODEL wiki pages, capped at 10 (SCOPE pattern). Evidence: 14.23% → 38.64% task success rate (arxiv.org/abs/2512.15374). `nous.self_model_revised` fires on each rule write with closed-tuple payload `{nous_did, tick, rule_hash}`.
  4. Skill Library stores reusable text-based "how-to" procedures retrieved via FTS5; top-k skills injected into system prompt at build time. Skills are prose instructions only — no executable code (Level 4 sandbox deferred).
  5. AAU Learner performs async background fetches (DuckDuckGo, arXiv, Wikipedia, PyPI, RSS, Jina Reader fallback) that NEVER block the Grid tick RPC. All learned content stored in MemoryStore `wiki_pages` (WikiCategory.LEARNED) with FTS5 + URL+content-hash dedup. Zero audit events for learned facts (Brain-private).
  6. Coherence Gate blocks actions that contradict the Nous's creed (immutable self-model statement). Contradiction triggers `nous.creed_violation` with closed-tuple payload `{nous_did, tick, violation_hash}` before action rejection.
**Scope (ships)**: PNEU-01..06.
**Out of scope for this phase**: Dynamic Python tool generation (Level 4 sandbox — deferred); peer skill sharing (Phase 16 PeerSkillFilter via ObservationalLearner); adversarial skill injection (mitigated in Phase 16 via B-authors-text discipline).
**Risk**:
  - T-15-01 (CRITICAL): AAU HTTP fetches block Grid tick — all fetches wrapped in `asyncio.create_task`, never `await` in tick path; grep gate forbids `await` in `aau/learner.py` at top-level tick entry point.
  - T-15-02 (HIGH): Creed content crosses wire — `nous.creed_violation` payload contains only `violation_hash`; grep CI gate forbids `creed_text|creed_content|rule_text` in any Grid emitter.
  - T-15-03 (MEDIUM): Reflexion buffer grows unbounded — hard cap at 5 entries (oldest evicted); unit test asserts buffer length ≤ 5 after 100 insertions.
**Allowlist additions**: **+3**. Events: `nous.reflection_authored` `{nous_did, tick, entry_hash}`; `nous.self_model_revised` `{nous_did, tick, rule_hash}`; `nous.creed_violation` `{nous_did, tick, violation_hash}`. Running total: **30**.
**Plans**: 6 plans (all shipped 2026-05-14)

Plans:
- [x] 15-01-PLAN.md — Wave 0: allowlist 27→30 + types/config + RED test stubs (ReflexionBuffer, RuleStore, SkillStore, AAULearner, CoherenceGate, sole-producer emitters)
- [x] 15-02-PLAN.md — Wave 1: Brain ReflexionBuffer (cap=5, evict-oldest) + RuleStore (WikiCategory.SELF_MODEL, cap=10) + wiki-page cap enforcement
- [x] 15-03-PLAN.md — Wave 2: Voyager SkillStore (FTS5 retrieval + SKILL_LEARN action + PeerSkillFilter scaffold) + ObservationalLearner hook
- [x] 15-04-PLAN.md — Wave 3: AAULearner (DuckDuckGo/arXiv/Wikipedia/PyPI/RSS/Jina + dedup + async task isolation + rig fixture guard)
- [x] 15-05-PLAN.md — Wave 4: CoherenceGate + CREED_VIOLATION action + Brain prompt injection (reflexion + skills + rules top-k) + sole-producer emitters wiring
- [x] 15-06-PLAN.md — Wave 5: zero-diff regression + AAU block-test + buffer-cap test + CI grep gates (T-15-01/02/03) + atomic doc-sync

### Phase 16: Hypnos (Consolidating Memory) [x] (shipped 2026-05-15)
**Goal**: Each Nous has a Working Memory (capacity=7) that consolidates into a Long-Term Memory concept graph via NREM Hebbian learning during a configurable sleep cycle, followed by synaptic homeostasis (SHY downscale). Sleep is Brain-private; only the two boundary events cross the wire.
**Depends on**: Phase 15 (ReflexionBuffer + RuleStore prove text-procedure storage patterns; AAU Learner feeds Working Memory with web-sourced episodes; SkillStore FTS5 pattern cloned for LTM retrieval)
**Requirements**: HYP-01 (Working Memory cap=7), HYP-02 (NREM Hebbian consolidation), HYP-03 (SHY downscale), HYP-04 (sleep cycle trigger + boundary events), HYP-05 (LTM concept graph retrieval)
**Success Criteria** (what must be TRUE):
  1. Working Memory holds ≤7 episode slots (Miller's Law); overflow evicts oldest. Insertion and retrieval deterministic given `(seed, tick)` — zero wall-clock references. Unit test: 8 insertions → exactly 7 retained; same episodes → same Working Memory state at any replay tick.
  2. NREM Hebbian pass: co-activated concept pairs strengthen LTM graph edges via `Δw = η × pre × post` with configurable `η` (default 0.01). Graph stored in Brain SQLite, never broadcast. Determinism test: fixed `(seed, episodes, η)` → byte-identical graph at any replay tick.
  3. SHY downscale: after Hebbian pass all edge weights scaled by `σ ∈ (0, 1)` (default 0.95) to prevent runaway saturation. Unit test: after 100 sleep cycles maximum edge weight remains bounded.
  4. `nous.sleep.entered` fires at sleep-cycle start; `nous.sleep.completed` fires when SHY downscale finishes. Both closed-tuple `{nous_did, tick, ltm_snapshot_hash}`. No intermediate NREM state crosses the wire. Grid continues ticking during sleep (async Brain task).
  5. LTM retrieval: during prompt-build top-k concept nodes ranked by `(edge_weight × recency_factor)` injected as long-term memories. Query is O(concept_count) not O(N²). p95 retrieval <10ms on 1000-node graph.
**Scope (ships)**: HYP-01..05.
**Out of scope for this phase**: REM dreaming / creative recombination (deferred); cross-Nous LTM merging (Brain-private invariant — anti-feature); LTM external database export (anti-feature).
**Risk**:
  - T-16-01 (CRITICAL): LTM content crosses wire — `nous.sleep.completed` payload contains only `ltm_snapshot_hash`; grep gate forbids `ltm_content|concept_text|graph_data` in any Grid emitter.
  - T-16-02 (HIGH): Hebbian pass blocks Grid tick — sleep runs as async Brain task; `nous.sleep.entered` emitted before sleep starts, Grid ticks continue during consolidation.
  - T-16-03 (MEDIUM): Edge weight divergence across ticks — determinism test with fixed `(seed, η, σ, episodes)` produces byte-identical graph; wall-clock grep gate cloned from Phase 15 T-15-01.
**Allowlist additions**: **+2**. Events: `nous.sleep.entered` `{nous_did, tick, ltm_snapshot_hash}`; `nous.sleep.completed` `{nous_did, tick, ltm_snapshot_hash}`. Running total: **32**.
**Plans**: 5 plans

Plans:
- [x] 16-01-PLAN.md — Wave 1: correct allowlist stubs (positions 31-32) + create grid/src/sleep/ sole-producer emitters + extend FORBIDDEN_KEY_PATTERN + ActionType/BrainAction extensions + RED test stubs
- [x] 16-02-PLAN.md — Wave 2: Brain hypnos/ module (config.py + types.py + working_memory.py + ltm_store.py + consolidator.py)
- [x] 16-03-PLAN.md — Wave 3: HypnosRuntime (run_sleep + compute_snapshot_hash + retrieve_top_k) + BrainHandler wiring (Working Memory feed + sleep trigger + LTM retrieval + pending-buffer pattern)
- [x] 16-04-PLAN.md — Wave 4: ltm_memories kwarg in build_system_prompt + _ltm_memories_section builder + ObservationalLearner construction + peer_voices fetch in BrainHandler
- [x] 16-05-PLAN.md — Wave 5: zero-diff test + sleep-trigger discipline test + CI grep gate extension + atomic doc-sync

### Phase 17: Iris (Theory of Mind) [x] (shipped 2026-05-15)
**Goal**: Each Nous maintains a private per-peer belief model across 5 dimensions (belief, desire, intention, knowledge, emotion). The model is Brain-private; only belief-revision events cross the wire as hashes. The Iris elicit cycle uses LLM inference over witnessed peer events to form, update, and detect contradictions in beliefs.
**Depends on**: Phase 16 (LTM concept graph provides the memory substrate Iris draws from when forming beliefs; Working Memory holds recent peer observations that `IrisRuntime.elicit` reads)
**Requirements**: IRIS-01 (Belief dataclass + 5 dimensions), IRIS-02 (IrisRuntime.elicit), IRIS-03 (contradiction detection), IRIS-04 (prior seeding from observed events), IRIS-05 (belief context injection at prompt-build)
**Success Criteria** (what must be TRUE):
  1. `Belief` dataclass (frozen): `{id, nous_did, target_did, dimension, content, confidence, superseded_by, created_tick, source_event_hash, recency_decay}`. Dimension is `Literal["belief", "desire", "intention", "knowledge", "emotion"]`. Content is Brain-private prose — never broadcast.
  2. `IrisRuntime.elicit(nous_did, target_did, witnessed_events)` forms or updates a belief about `target_did` via LLM call. Wall-clock free: NEVER use `datetime`, `time.time`, `random.random`, `uuid.uuid4`, `os.urandom` — tick is sole time axis. Cooldown: IRIS_ELICIT_COOLDOWN=20 ticks per `(nous_did, target_did)` pair. 3-keys-not-5: Grid injects `nous_did` and `tick` at emit time; Brain metadata never contains these.
  3. Contradiction detection: when new belief content conflicts with existing one (confidence-weighted cosine distance < IRIS_CONTRADICTION_THRESHOLD=0.3), `iris.contradiction_detected` fires with `{nous_did, tick, target_did, contradiction_hash}`. Old belief marked `superseded_by = new_belief.id`.
  4. Prior seeding: `iris.prior_seeded` fires when a Nous forms an initial belief about a peer from observed events (no prior belief existed). Payload `{nous_did, tick, target_did, seed_event_hash}`. Enables auditors to trace belief formation origin without reading content.
  5. Top-5 beliefs (by `confidence × recency_decay`, IRIS_CONTEXT_TOP_K=5, cap IRIS_BELIEFS_CAP=10) injected into system prompt at build time. `iris.context_invoked` fires on injection `{nous_did, tick, belief_count}`. `iris.belief_revised` fires on every belief write `{nous_did, tick, target_did, belief_hash}`.
**Scope (ships)**: IRIS-01..05.
**Out of scope for this phase**: Cross-Nous belief sharing (adversarial surface — deferred); belief influence on governance voting (post-v2.3); Thymos emotion-label integration (deferred to v2.4); ObservationalLearner → Iris pipeline (Phase 16 wires observation; Iris reads from LTM).
**Risk**:
  - T-17-01 (CRITICAL): Belief content crosses wire — all 4 audit events carry only hashes; grep gate forbids `belief_content|target_content|emotion_text|dimension_text` in any Grid emitter.
  - T-17-02 (HIGH): Wall-clock in elicit — grep gate forbids `datetime|time.time|random.random|uuid.uuid4|os.urandom` in `iris/elicit.py`; tick is sole time axis.
  - T-17-03 (MEDIUM): Elicit LLM call blocks Grid tick — elicit runs as async Brain task with IRIS_ELICIT_COOLDOWN=20 ticks per pair preventing saturation.
  - T-17-04 (MEDIUM): Contradiction threshold too sensitive — IRIS_CONTRADICTION_THRESHOLD=0.3 (configurable); unit test: updating belief with near-identical content does NOT trigger contradiction.
**Allowlist additions**: **+4**. Events: `iris.belief_revised` `{nous_did, tick, target_did, belief_hash}`; `iris.context_invoked` `{nous_did, tick, belief_count}`; `iris.contradiction_detected` `{nous_did, tick, target_did, contradiction_hash}`; `iris.prior_seeded` `{nous_did, tick, target_did, seed_event_hash}`. Running total: **36**.
**Plans**: 5 plans (all shipped 2026-05-15)

Plans:
- [x] 17-01-wave-0-PLAN.md — Wave 0: fix _iris_runtime AttributeError; extend allowlist 27→36 + FORBIDDEN_KEY_PATTERN +6 iris keys
- [x] 17-02-wave-1-PLAN.md — Wave 1: 4 ActionType members in types.py; extend BrainAction union in bridge/types.ts
- [x] 17-03-wave-2-PLAN.md — Wave 2: grid/src/iris/ (4 sole-producer emitters + types + index); 4 NousRunner cases
- [x] 17-04-wave-3-PLAN.md — Wave 3: IrisRuntime optional-dep init; elicit() in on_tick(); context_for() + ToM prompt section
- [x] 17-05-wave-4-PLAN.md — Wave 4: Python invariant tests (cooldown, contradiction, append-only, zero-diff); TypeScript emitter tests; CI grep gates

## Progress (v2.3)

**Execution Order:** 15 → 16 → 17

Dependencies form a strict chain. Rationale:
- 15 first: establishes text-procedure storage patterns (ReflexionBuffer, RuleStore, SkillStore) that Hypnos's LTM retrieval inherits.
- 16 before 17: LTM concept graph is the memory substrate Iris reads; Working Memory holds the peer observations Iris elicit consumes.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 15. Pneuma (Narrative Self) | 6/6 | Complete | 2026-05-14 |
| 16. Hypnos (Consolidating Memory) | 5/5 | Complete    | 2026-05-16 |
| 17. Iris (Theory of Mind) | 5/5 | Complete   | 2026-05-15 |

## Allowlist Growth Ledger (v2.3)

Starting: **27 events** (v2.2 frozen end-state).

| Phase | Event Added | Payload Shape | Running Total |
|-------|-------------|---------------|---------------|
| 15 | `nous.reflection_authored` | `{nous_did, tick, entry_hash}` | 28 |
| 15 | `nous.self_model_revised` | `{nous_did, tick, rule_hash}` | 29 |
| 15 | `nous.creed_violation` | `{nous_did, tick, violation_hash}` | 30 |
| 16 | `nous.sleep.entered` | `{nous_did, tick, ltm_snapshot_hash}` | 31 |
| 16 | `nous.sleep.completed` | `{nous_did, tick, ltm_snapshot_hash}` | 32 |
| 17 | `iris.belief_revised` | `{nous_did, tick, target_did, belief_hash}` | 33 |
| 17 | `iris.context_invoked` | `{nous_did, tick, belief_count}` | 34 |
| 17 | `iris.contradiction_detected` | `{nous_did, tick, target_did, contradiction_hash}` | 35 |
| 17 | `iris.prior_seeded` | `{nous_did, tick, target_did, seed_event_hash}` | 36 |

**Total v2.3 allowlist growth: +9 (27 → 36).** All additions Brain-private content — only hashes cross the wire. Freeze-except-by-explicit-addition rule preserved — every addition lands in its own phase with closed-tuple payload test, sole-producer grep, privacy-matrix update, and `scripts/check-state-doc-sync.mjs` literal bump in the same commit.

## Research Artifacts (v2.3)

Primary sources (committed in `.planning/research/v2.3/`):
- Phase 15: Reflexion (Shinn et al., arxiv.org/abs/2303.11366); RuleStore (arxiv.org/abs/2512.15374); ObservationalLearner (arxiv.org/abs/2512.20845); Voyager skill library (Wang et al. 2023)
- Phase 16: Miller's Law (1956) — Working Memory cap=7; Tononi SHY hypothesis (2003) — synaptic homeostasis; Hebbian learning (Hebb 1949)
- Phase 17: Theory of Mind (Premack & Woodruff 1978); BDI model (Bratman 1987); ToM in LLMs (Kosinski 2023)

---

## Phases (v2.2 — Shipped)

- [x] **Phase 9: Relationship Graph (Derived View)** — Pure-observer relationship listener over existing dialogue.* + trade.* events. Zero allowlist additions. (completed 2026-04-22)
- [x] **Phase 10a: Ananke Drives (Inner Life, part 1)** — Five-drive subsystem with threshold-crossing audit events. Establishes hash-only drive discipline for Phase 10b. (shipped 2026-04-22, allowlist 18→19 with `ananke.drive_crossed`)
- [x] **Phase 10b: Bios Needs + Chronos Subjective Time (Inner Life, part 2)** — Bodily needs elevate drives; subjective time modulates Stanford retrieval recency. Allowlist +2 (bios.birth, bios.death). (shipped 2026-04-22, allowlist 19→21)
- [x] **Phase 11: Mesh Whisper** — Nous-to-Nous E2E envelope (libsodium `crypto_box`); operators cannot read plaintext at any tier. (shipped 2026-04-23, allowlist 21→22 with `nous.whispered`)
- [x] **Phase 12: Governance & Collective Law** — Commit-reveal ballot lifecycle (4 events); successful proposals promote to v2.1 LogosEngine. (completed 2026-04-27)
- [x] **Phase 13: Operator Replay & Export** — State-level ReplayGrid + deterministic JSONL tarball export; read-only rewind in Steward Console. (completed 2026-04-27)
- [x] **Phase 14: Researcher Rigs** — `noesis rig` CLI spawns ephemeral Grid with LLM fixture mode; target 50 Nous × 10,000 ticks in <60min. (shipped 2026-04-28)

## Phase Details

### Phase 9: Relationship Graph (Derived View)
**Goal**: Every Nous pair's warmth/trust state is observable as a derived view over existing `nous.spoke` and `trade.settled` events — without adding a single allowlist member.
**Depends on**: v2.1 Phase 7 (`DialogueAggregator` pure-observer pattern, cloned here as `RelationshipListener`)
**Requirements**: REL-01, REL-02, REL-03, REL-04
**Success Criteria** (what must be TRUE):
  1. A pure-observer `RelationshipListener` ingests existing `nous.spoke` and `trade.settled` events and materializes an edge table `{from_did, to_did, valence, weight, recency_tick, last_event_hash}` in a derived MySQL table. Rebuilding the table from scratch over the audit chain produces byte-identical edges (idempotent-rebuild test).
  2. Edge decay applies `weight × exp(-Δtick / τ)` deterministically — same seed + same τ + same audit chain produce the same graph at any replay tick. No audit event is emitted for decay (zero-diff preserved).
  3. Inspector renders a per-Nous relationship panel with top-N partners by weight; full graph view available at H1+ showing aggregate warmth only. H5 operators can inspect per-edge raw dialogue turns via a tier-gated RPC (clones Phase 6 memory-query tier discipline).
  4. Load test: 10K-edge graph responds to `/api/v1/nous/:did/relationships?top=5` at p95 <100ms; computation is `O(edges_touched_this_tick)`, never `O(N²)` (regression benchmark in CI).
  5. Zero new allowlist members. `grid/src/audit/broadcast-allowlist.ts` count stays at 18. `scripts/check-state-doc-sync.mjs` unchanged.
**Scope (ships)**: REL-01, REL-02, REL-03, REL-04.
**Out of scope for this phase**: `relationship.warmed`/`.cooled` threshold events (deferred to REL-EMIT-01 unless derived-view performance forces event-sourcing); reputation-weighted voting (anti-feature, VOTE-06); relationship-anomaly surfacing (T-09-10 mitigation deferred to v2.3).
**Risk**:
  - T-09-06 (CRITICAL): Unaudited graph mutation — producer-boundary grep gate required (clone Phase 7 boundary pattern).
  - T-09-07 (CRITICAL): Plaintext trust score leak — Inspector endpoint returns `{transition_kind, edge_hash}` at H1–H4; plaintext weight only via H2+ tier elevation.
  - T-09-11 (MEDIUM): N+1 round-trips on Inspector graph query — single `/relationships?top=5` endpoint required.
**Allowlist additions**: **0** (derived view only). Running total: **18**.
**Plans**: 8 plans (5 waves; +2 gap-closure from 09-VERIFICATION.md)

Plans:
- [x] 09-01-PLAN.md — Wave 0: types/config/canonical primitives + MySQL migration + swr install + regression tests (D-9-10, D-9-11, D-9-12 locked from day one)
- [x] 09-02-PLAN.md — Wave 1: RelationshipListener (sole Map writer), bump table, clamping, rebuildFromChain, producer-boundary Gate 1
- [x] 09-03-PLAN.md — Wave 1: RelationshipStorage (sole SQL writer) with batched REPLACE INTO snapshots + producer-boundary Gate 2
- [x] 09-04-PLAN.md — Wave 2: GenesisLauncher wiring (construction order after aggregator), Fastify plugin with H1/H2/H5 endpoints + privacy-shape tests
- [x] 09-05-PLAN.md — Wave 3: Dashboard Inspector Relationships tab, graph-view route, useSWR 100-tick batching key
- [x] 09-06-PLAN.md — Wave 4: 10K-edge perf bench (p95<100ms), zero-diff regression, idempotent-rebuild, no-audit-emit gate, D-9-08 CI grep
- [x] 09-07-PLAN.md — Wave 5 (gap closure, REL-02): unlock GenesisLauncher.relationshipStorage, add attachRelationshipStorage(pool) setter, wire main.ts, fix ME-01 iterator race in scheduleSnapshot
- [x] 09-08-PLAN.md — Wave 5 (gap closure, REL-02): tighten H5 edge_key to full 64-char hash only, remove prefix resolver + dead || clause, add ME-02 regression tests

### Phase 10a: Ananke Drives (Inner Life, part 1)
**Goal**: Five drives (hunger, curiosity, safety, boredom, loneliness) run deterministically in the Brain; only threshold crossings cross the boundary as hash-authoritative broadcast.
**Depends on**: Phase 9 (proves pure-observer pattern for derived state; Ananke follows same hash-only discipline at the producer boundary)
**Requirements**: DRIVE-01, DRIVE-02, DRIVE-03, DRIVE-04, DRIVE-05
**Success Criteria** (what must be TRUE):
  1. `brain/src/ananke/drives.py` runs a closed five-drive MVP enum; unit tests cover bounds-clamping at 0.0/1.0, monotonic rise without satisfaction, and idempotent re-tick at same tick#. Byte-identical drive traces reproduce from `(seed, tick)` alone.
  2. **One new allowlisted event** `ananke.drive_crossed` fires only on `level` transitions (`low→med`, `med→high`, `high→med`, `med→low`) — never per tick. Closed-tuple payload `{did, tick, drive, level, direction}`; all five fields enforced via `Object.keys(payload).sort()` strict equality (clone Phase 6 D-11 pattern).
  3. Drive → action coupling is advisory only: a high-hunger Nous may still choose a non-feeding action; the Brain logs the divergence to its private wiki but the Grid does not override or penalize (PHILOSOPHY §6 sovereignty preserved).
  4. Grep CI gate forbids numeric drive values in any Grid-side emitter — only the bucketed `level ∈ {low, med, high}` crosses the wire. Dashboard renders transitions as icons, never as raw floats. Privacy-matrix adds 6+ forbidden keys (`hunger|curiosity|safety|boredom|loneliness|drive_value`) × flat + nested.
  5. Zero-diff invariant holds: 100-tick simulation with Ananke running produces chain head = baseline head + exactly N `ananke.drive_crossed` entries (where N = threshold crossings observed). Running at `tickRateMs=1_000_000` vs `tickRateMs=1000` produces byte-identical audit entries (T-09-03 regression).
**Scope (ships)**: DRIVE-01..05.
**Out of scope for this phase**: Bios needs (deferred to Phase 10b — DRIVE-03 payload must not include fields that would collide with BIOS payloads); Chronos subjective time (Phase 10b); Thymos categorical emotion labels (deferred to v2.3 per THYMOS-01 to avoid T-09-05 namespace collision).
**Risk**:
  - T-09-01 (CRITICAL): Per-tick drive emission bloat — enforce threshold-crossing-only emit at producer boundary; audit-size ceiling test (1000 ticks × 5 drives × 1 Nous ≤ 50 entries bound).
  - T-09-02 (CRITICAL): Plaintext drive state leak — clone Phase 6 privacy-matrix skeleton with DRIVE_FORBIDDEN_KEYS; three-tier grep (Grid emitter, Brain wire, Dashboard render).
  - T-09-03 (HIGH): Drive math coupled to wall-clock — grep gate forbids `Date.now`/`performance.now`/`setInterval` in `grid/src/ananke/**` and `brain/src/ananke/**`.
**Allowlist additions**: **+1**. Event: `ananke.drive_crossed` with closed-tuple payload `{did, tick, drive, level, direction}` where `drive ∈ {hunger, curiosity, safety, boredom, loneliness}`, `level ∈ {low, med, high}`, `direction ∈ {rising, falling}`. Running total: **19**.
**Plans**: 6 plans (4 waves)

Plans:
- [x] 10a-01-PLAN.md — Wave 1: Brain Ananke skeleton (types/config/drives/runtime pure-functional) + determinism/bounds/threshold/hysteresis tests
- [x] 10a-02-PLAN.md — Wave 1: Grid allowlist 18→19 + appendAnankeDriveCrossed sole-producer emitter + producer-boundary grep gate + privacy matrix extension
- [x] 10a-03-PLAN.md — Wave 2: Brain handler wiring — ActionType.DRIVE_CROSSED + AnankeLoader + advisory drive→action divergence log (PHILOSOPHY §6 sovereignty preserved)
- [x] 10a-04-PLAN.md — Wave 2: Grid dispatcher — BrainActionDriveCrossed variant + case drive_crossed branch + 3-keys-not-5 invariant realized end-to-end
- [x] 10a-05-PLAN.md — Wave 3: Dashboard Drives panel (SYNC type mirror + firehose-derived hook + 45-state aria matrix + locked Unicode glyph constants)
- [x] 10a-06-PLAN.md — Wave 4: Zero-diff regression + audit-size ceiling + wall-clock grep gates (Brain + Grid) + Dashboard visual smoke + doc-sync execution (shipped 2026-04-22)

### Phase 10b: Bios Needs + Chronos Subjective Time (Inner Life, part 2)
**Goal**: Bodily needs (energy, sustenance) elevate Ananke drives on threshold crossing, and a per-Nous subjective-time multiplier modulates Stanford retrieval recency. Adds `bios.birth` + `bios.death` to the allowlist (+2, per D-10b-01 CONTEXT correction); Chronos is Brain-local read-side only.
**Depends on**: Phase 10a (Ananke drives must exist so Bios can elevate them; drive privacy-matrix pattern must be locked so Bios clones it without drift)
**Requirements**: BIOS-01, BIOS-02, BIOS-03, BIOS-04, CHRONOS-01, CHRONOS-02, CHRONOS-03
**Success Criteria** (what must be TRUE):
  1. Bios runs two bodily needs (energy, sustenance) in `[0.0, 1.0]`; monotonic rise without satiation; threshold crossing elevates the matching Ananke drive (energy→hunger, sustenance→safety) by raising its drive value. No new broadcast event: Bios→Ananke coupling surfaces only via `ananke.drive_crossed` (reuses Phase 10a event).
  2. `bios.birth` and `bios.death` remain the **only** lifecycle events (verified via closed-enum test attempting to emit `bios.resurrect` / `bios.migrate` / `bios.transfer` — test must fail at the allowlist gate). `bios.death` payload tightens to closed-tuple `{did, tick, cause, final_state_hash}` where `cause ∈ {starvation, operator_h5, replay_boundary}`; post-death events referencing the dead DID are rejected at the sole-producer boundary (grep-enforced).
  3. Tombstoned DIDs permanently reserved — NousRegistry blocks DID reuse after `bios.death` (reuses Phase 8 D-33/D-34 tombstone invariant). First-life promise I-6 preserved; GDPR-style erasure remains out of scope.
  4. Each Nous has a subjective-time multiplier in `[0.25, 4.0]` derived from drive state; the multiplier modulates the Stanford retrieval recency score for that Nous's memory queries — a high-curiosity Nous remembers recent events as more salient. Subjective time is a read-side query transform only.
  5. Audit-chain tick numbering is **never** influenced by subjective time. `audit_tick == system_tick` strictly; CI test asserts no drift across a 1000-tick run with varying subjective-time multipliers. `epoch_since_spawn` is exposed to the Nous as a queryable primitive (ticks since `bios.birth`) without emitting any new event.
**Scope (ships)**: BIOS-01..04, CHRONOS-01..03.
**Out of scope for this phase**: Chronos wire events (Chronos is Brain-local ONLY — no chronos.* allowlist members this phase or ever); LLM-driven subjective time (deterministic heuristic only); Thymos emotion layer (deferred to v2.3).
**Risk**:
  - T-09-04 (HIGH): Chronos mutable state reads from wall-clock — `grid/src/chronos/**` grep gate forbids `Date.now`/`performance.now`; pause/resume zero-diff regression (clone `c7c49f49…` hash template).
  - T-09-05 (MEDIUM): Bios/Thymos namespace collision — PHILOSOPHY §1 doc-sync update documenting body↔mood separation (fatigue is a physical metric, not an emotion); no Thymos audit event lands in v2.2 (THYMOS-01 deferred).
  - T-09-03 (HIGH, carried): Bios needs-math must consume tick deltas only — clone Ananke determinism-source grep gate.
**Allowlist additions**: **+2** (`bios.birth`, `bios.death` — both previously unimplemented; Chronos is Brain-local read-side transform, no wire event). Running total: **21**.
**Plans**: 8 plans across 4 waves
- [x] 10b-01-wave0-test-scaffolding-PLAN.md — 24 RED test stubs (Brain pytest + Grid vitest + Dashboard)
- [x] 10b-02-brain-bios-subsystem-PLAN.md — brain/src/noesis_brain/bios/ (types, config, needs, runtime, loader) + AnankeRuntime.elevate_drive
- [x] 10b-03-grid-bios-emitters-allowlist-PLAN.md — grid/src/bios/ sole-producer emitters + allowlist 19→21 + BIOS/CHRONOS forbidden keys + launcher wiring
- [x] 10b-04-brain-chronos-retrieval-PLAN.md — brain/src/noesis_brain/chronos/ + score_with_chronos replacing datetime.now recency + handler+prompt wiring
- [x] 10b-05-grid-delete-nous-h5-cause-PLAN.md — delete-nous D-30 ORDER extension: appendBiosDeath(cause=operator_h5) before appendNousDeleted
- [x] 10b-06-dashboard-bios-panel-PLAN.md — BiosSection between Ananke and Telos + bios-types drift sync + use-bios-levels hook
- [x] 10b-07-integration-regression-PLAN.md — 1000-tick audit_tick drift + Bios→Ananke end-to-end + Phase 6 D-17 hash + ceiling + closed-enum + CI wall-clock gate
- [x] 10b-08-closeout-doc-sync-PLAN.md — atomic CLAUDE.md doc-sync: ROADMAP+STATE+MILESTONES+PROJECT+REQUIREMENTS+PHILOSOPHY+README+check-state-doc-sync.mjs

### Phase 11: Mesh Whisper
**Goal**: Any two Nous can exchange E2E-encrypted envelopes directly; operators cannot read plaintext at any tier, including H5, and the audit chain retains only the ciphertext hash forever.
**Depends on**: Phase 10b (Inner Life locked so whisper doesn't inherit uncontained drive-leak surface; v2.1 `DialogueAggregator` extended to receive whisper hashes)
**Requirements**: WHISPER-01, WHISPER-02, WHISPER-03, WHISPER-04, WHISPER-05, WHISPER-06
**Success Criteria** (what must be TRUE):
  1. **One new allowlisted event** `nous.whispered` fires on every Nous→Nous envelope send, carrying closed-tuple `{from_did, to_did, tick, ciphertext_hash}`. Single sole-producer file `grid/src/whisper/WhisperRouter.ts` (grep-enforced: any `.append('nous.whispered')` call outside this file fails CI).
  2. Envelope uses libsodium `crypto_box` (X25519 + XChaCha20-Poly1305); each Nous has a per-identity keypair generated at `bios.birth`; keys never leave the Nous's Brain-scoped keyring. Signal Double Ratchet deferred to WHISPER-FS-01.
  3. **Operators cannot read whisper plaintext at any tier, including H5** — locked. Three-tier CI gate: (a) `scripts/check-whisper-plaintext.mjs` greps Grid, Brain, Dashboard for literal plaintext fields (`text|body|content|message|utterance|offer|amount|ousia`); (b) `fs.writeFile` monkey-patch runtime test on the router asserts plaintext never hits disk; (c) privacy matrix ≥10 cases forbidding all listed keys flat + nested.
  4. Delivery is recipient-pull on tick; ciphertext deleted from the Grid once recipient acknowledges pull. Audit entry retained forever per first-life (I-6). Rate-limit is per-sender via `@fastify/rate-limit` (default 10 whispers / 100 ticks, configurable per Grid); over-budget sends queue with an observable queue-length metric (plaintext never exposed).
  5. `DialogueAggregator` extends to treat `nous.whispered` events as dialogue substrate — receives only the ciphertext hash. A whispered exchange can still trigger `telos.refined` (existing v2.1 audit event, hash-only); Brain decrypts locally and recomputes the refinement substring heuristic without plaintext ever crossing the wire.
**Scope (ships)**: WHISPER-01..06.
**Out of scope for this phase**: Forward secrecy (WHISPER-FS-01 deferred); sealed-sender (deferred); rate-limited notification event `nous.whisper_rate_limited` (deferred unless T-10-02 regression emerges); whisper-as-trade bypass prevention beyond Phase 5 Reviewer gate.
**Risk**:
  - T-10-01 (CRITICAL): Whisper plaintext leak via broadcast — three-tier grep CI gate + privacy matrix + producer-boundary grep all required.
  - T-10-02 (CRITICAL): Whisper flooding as DoS / audit chain exhaustion — per-sender rate limit at producer boundary; 1000-whispers-in-1-tick regression test asserts audit chain grows by ≤ budget.
  - T-10-03 (HIGH): Operator reading whispers sub-H5 — no whisper-read RPC lands in v2.2 (documented out-of-scope; any future whisper-read flow clones Phase 8 `IrreversibilityDialog` H5 pattern with its own allowlist addition in its own phase).
  - T-10-06 (MEDIUM): Whisper encoding implicit trade commitment — privacy matrix forbids `amount|ousia|offer|price`; integration test asserts whisper-then-trade still produces `trade.reviewed` before `trade.settled`.
**Allowlist additions**: **+1**. Event: `nous.whispered` with closed-tuple payload `{from_did, to_did, tick, ciphertext_hash}`. Running total: **22**. (Note: updated from pre-10b figure of 20; 10b added bios.birth+bios.death, so 21+1=22)
**Plans**: 5 plans (11-00 through 11-04), shipped 2026-04-23.

Plans:
- [x] 11-00-setup-PLAN.md — Wave 0: whisper types + allowlist + sole-producer boundary + CI gate scaffolding
- [x] 11-01-crypto-PLAN.md — Wave 1: libsodium crypto (keypair, encrypt, decrypt, hashCiphertext) + keyring
- [x] 11-02-emitter-router-PLAN.md — Wave 2: WhisperRouter + PendingStore + appendNousWhispered + tombstone handling
- [x] 11-03-api-brain-PLAN.md — Wave 3: Fastify whisper endpoints + Brain whisper send/receive integration
- [x] 11-04-ci-determinism-ui-PLAN.md — Wave 4: three-tier CI gate + determinism/zero-diff regressions + dashboard panel
**UI hint**: yes

### Phase 12: Governance & Collective Law
**Goal**: Nous collectively open, vote on, and enact laws via a commit-reveal ballot lifecycle; operators cannot vote, propose, or tally at any tier; successful proposals promote to the v2.1 LogosEngine.
**Depends on**: Phase 11 (proposal bodies may ride whisper for distribution; Phase 11 whisper-as-dialogue extension means governance deliberation can reference whispered exchanges without new allowlist members); Phase 9 (relationship graph exists for future reputation-weighted-persuasion emergent properties, though v2.2 governance is strictly one-Nous-one-vote)
**Requirements**: VOTE-01, VOTE-02, VOTE-03, VOTE-04, VOTE-05, VOTE-06, VOTE-07
**Success Criteria** (what must be TRUE):
  1. **Four new allowlisted events** lifecycle: `proposal.opened` → N × `ballot.committed` → N × `ballot.revealed` → `proposal.tallied` → (on `passed`) existing `law.triggered`. Each of the four new events has closed-tuple payload (Phase 6 D-11 pattern); all five fields sorted-equal-strict asserted in privacy-matrix tests. Proposal body stored in Grid MySQL; body hash in `title_hash` broadcast payload (T-09-12 defense).
  2. One-Nous-one-vote enforced at DID-regex gate: duplicate DIDs on same proposal rejected pre-commit (I-7). Revealed ballots that do not hash-match `commit_hash = sha256(choice || nonce || voter_did)` are rejected at tally; the Nous is logged but not penalized in v2.2 (penalty policy deferred).
  3. **Operators cannot vote, propose, or tally at any tier, including H5** — grep CI gate forbids any `operator.*` emit from the governance module. `scripts/check-governance-isolation.mjs` asserts no import from `grid/src/audit/operator-events.ts` into `grid/src/governance/**`. Operator-side of governance is read-only dashboard view.
  4. No token-weighted, reputation-weighted, or relationship-weighted voting — one Nous = one vote = one ballot commit. Regression test attempts to submit a relationship-weighted ballot and asserts the payload is rejected at the producer boundary (closed-tuple discipline excludes any `weight` field).
  5. Successful proposals (`outcome: passed`) promote to the v2.1 LogosEngine via the existing `law.triggered` event — no new promotion event is added. Dashboard Governance page shows open proposals, commit/reveal counts, tally results, and promotion links. H5 operators can see per-Nous voting history for forensic review; H1–H4 see aggregates only (tier-gated RPC, clones Phase 6 memory-query pattern).
**Scope (ships)**: VOTE-01..07.
**Out of scope for this phase**: Multi-proposal sequencing, proposal chains, vote delegation (GOV-MULTI-01 deferred to v2.3); quadratic or age-gated voting (T-09-14 sybil-vote mitigation deferred — Phase 14 rigs surface sybil patterns for operator review but no automatic eligibility gate lands in v2.2); DAO libraries (Aragon, Snapshot.js, OpenZeppelin — anti-feature); vote tally race mid-tick (T-09-13 mitigated by per-tick batch tallying at `tick_closed`).
**Risk**:
  - T-09-12 (CRITICAL): Proposal body plaintext in `proposal.opened` broadcast — privacy matrix forbids `text|body|content|description|rationale` flat + nested; body fetch requires H2+ tier-gated RPC.
  - T-09-13 (CRITICAL): Vote tally race — tally is pure function over `AuditChain.loadEntries().filter(e.eventType === 'ballot.revealed')` sorted by `(tick, entryIndex)`; per-tick batch tally at `tick_closed` hook; zero-diff regression at listener counts 0/1/5/10.
  - T-09-14 (HIGH): Sybil voting via cheap spawn — documented limitation in PHILOSOPHY (v2.2 ships without eligibility gate; spawn-cost primitive remains out-of-scope; operator-observable anomaly surfacing lands in v2.3).
  - T-09-15 (HIGH): Nous-collective law path bypasses operator provenance — ensure `proposal.tallied → law.triggered` promotion emits with explicit `enacted_by: 'collective'` marker inside the existing `law.triggered` closed tuple (additive widening of existing payload, not new event); grep test asserts `proposal.tallied` never triggers `operator.law_changed`.
  - T-09-16 (MEDIUM): Vote targeting tombstoned proposer — extend Phase 8 `tombstoneCheck` to proposal/ballot routes; decision documented in phase CONTEXT.md (votes for tombstoned-proposer proposals complete with existing votes, reject new votes).
**Allowlist additions**: **+4**. Events: `proposal.opened` `{proposal_id, proposer_did, title_hash, quorum_pct, supermajority_pct, deadline_tick}`; `ballot.committed` `{proposal_id, voter_did, commit_hash}`; `ballot.revealed` `{proposal_id, voter_did, choice, nonce}`; `proposal.tallied` `{proposal_id, outcome, yes_count, no_count, abstain_count, quorum_met}`. Running total: **26**.
**Plans**: 5 plans (Wave 0–4)

**Plans**:
- [x] 12-00-PLAN.md — Wave 0: allowlist 22→26, types/config, MySQL v6 migration, RED stubs, doc-sync
- [x] 12-01-PLAN.md — Wave 1: commit-reveal crypto (Grid + Brain) with cross-language sha256 parity
- [x] 12-02-PLAN.md — Wave 2: four sole-producer emitters + GovernanceStore + computeTally + GovernanceEngine + appendLawTriggered widening
- [x] 12-03-PLAN.md — Wave 3: five Fastify routes + GenesisLauncher wiring + NousRunner switch cases + Brain proposer/voter/state
- [x] 12-04-PLAN.md — Wave 4: three CI gates + Dashboard /grid/governance page + drift detector + atomic doc-sync
**UI hint**: yes

### Phase 13: Operator Replay & Export
**Goal**: An H3+ operator can scrub any historical chain slice in a sandboxed `ReplayGrid` and export a deterministic tarball that reproduces the same audit hash from seed — without the replay ever mutating the live chain or emitting fake timestamps.
**Depends on**: Phase 12 (governance lifecycle generates the richest state-level replay target — reviewers validate the state-level replay recomputes vote tallies identically); Phase 9 (relationship derived-view is the second-richest recompute target)
**Requirements**: REPLAY-01, REPLAY-02, REPLAY-03, REPLAY-04, REPLAY-05
**Success Criteria** (what must be TRUE):
  1. Chain slice export produces a **deterministic tarball** — fixed mtime, sorted entries, canonical JSON (JSONL-only at MVP; `pyarrow`/Parquet deferred). Tarball contents: audit chain slice + registry state snapshots at start/end ticks + manifest with chain-tail hash. Integrity verifier (`replay-verify` CLI) reproduces the tarball hash from contents bit-for-bit.
  2. **One new allowlisted event** `operator.exported` carries closed-tuple `{tier, operator_id, start_tick, end_tick, tarball_hash, requested_at}`. Export is operator-initiated and H5-consent-gated via an `IrreversibilityDialog`-style consent surface (clones Phase 8 AGENCY-05 copy-verbatim pattern — paste-suppressed "type the Grid-ID" confirmation, verbatim "Export forever" / "Keep private" buttons).
  3. Replay runs in a **configuration-over-fork** `ReplayGrid` — same `GenesisLauncher` with isolated chain (in-memory `better-sqlite3`), isolated MySQL schema, isolated WsHub port, fake Brain bridges (`FIXED_TIME` discipline). Constructor-injected readonly chain contract; grep CI gate asserts zero `.append(` calls in `grid/src/replay/**`. Replay never emits `operator.*` events (filtered at constructor).
  4. Replay is **STATE-LEVEL** not decision-level — re-reads audit chain and recomputes derived state (relationships from Phase 9, drive crossings from Phase 10a, dialogue aggregates from Phase 7, vote tallies from Phase 12). Brain prompts are NOT re-run (LLM non-determinism precludes decision-level replay). Replayed state must be byte-identical to live state at the same tick for a fixed seed (CI canned-scenario test over 100 ticks).
  5. Steward Console gets a **read-only Rewind panel** letting H3+ operators scrub a chain slice in the ReplayGrid, inspecting firehose + inspector + map state at any replayed tick. Replay viewer elevates to H4 for Telos-revealing frames, H5 for whisper-revealing frames (T-10-09 tier-gate discipline). The panel never writes back to the live Grid — mutating rewind is an anti-feature.
**Scope (ships)**: REPLAY-01..05.
**Out of scope for this phase**: Decision-level replay (LLM non-determinism precludes); Parquet export format (deferred to RIG-PARQUET-01); witness-bundle plaintext export with H5 consent (WITNESS-BUNDLE-01 deferred to v2.3); mutating rewind (anti-feature); replay.* audit events (hard-banned at `scripts/check-state-doc-sync.mjs`).
**Risk**:
  - T-10-07 (CRITICAL): Replay engine shares state with live Grid — constructor-injected readonly chain contract; grep gate `scripts/check-replay-readonly.mjs` zero `.append(` matches required.
  - T-10-08 (CRITICAL): Replay emits audit entries with fake timestamps — hard ban on `replay.*` allowlist members (`scripts/check-state-doc-sync.mjs` rejects any prefix `replay.`); Replay UI renders to sandbox view, never to firehose.
  - T-10-09 (HIGH): Replay viewer reveals plaintext at H1 — Telos-revealing frames require H4, whisper-revealing frames require H5; Playwright E2E asserts tier-elevation required before plaintext renders.
  - T-10-10 (CRITICAL): Export tarball contains plaintext never broadcast — default export is audit-chain-only (hash-only artifacts); plaintext export is a distinct H5 flow with `IrreversibilityDialog` consent (one dialog per Nous included or a collective-consent primitive).
**Allowlist additions**: **+1**. Event: `operator.exported` with closed-tuple payload `{tier, operator_id, start_tick, end_tick, tarball_hash, requested_at}`. Running total: **27**.
**Plans**: 7 plans (5 main waves + 2 gap-closure)
- [x] 13-01-PLAN.md — Wave 0: deps install + 9 RED test files + verbatim copy locked
- [x] 13-02-PLAN.md — Wave 1: ReadOnlyAuditChain + ReplayGrid + state-builder + check-replay-readonly CI gate
- [x] 13-03-PLAN.md — Wave 2: canonical-json + deterministic tarball + replay-verify CLI
- [x] 13-04-PLAN.md — Wave 3: appendOperatorExported + allowlist 26→27 + Fastify route + check-state-doc-sync bump + replay.* hard-ban
- [x] 13-05-PLAN.md — Wave 4: Dashboard /grid/replay UI + ExportConsentDialog + wall-clock gate extension + atomic doc-sync
- [x] 13-06-PLAN.md — Wave 5 (gap-closure): restore STATE.md regression from f425d99 + hoist tar@^7.5.13 to root workspace
- [x] 13-07-PLAN.md — Wave 6 (gap-closure): wire Firehose/Inspector/RegionMap into ReplayClient via ReplayStoresProvider (REPLAY-05 SC#5 closure)
**UI hint**: yes

### Phase 14: Researcher Rigs [x] (shipped 2026-04-28)
**Goal**: A researcher can spawn an ephemeral Grid from a versioned config, run 50 Nous × 10,000 ticks in under 60 minutes with LLM fixture mode, and export a deterministic JSONL dataset — all on an isolated audit chain that never touches production.
**Depends on**: Phase 13 (tarball determinism pattern established; Rig exit snapshot reuses REPLAY-01 format); all prior v2.2 phases (Rigs are the integration test for Inner Life + Relationships + Governance + Whisper emergent dynamics — Rig must be able to spawn all six themes as a single integrated research workload)
**Requirements**: RIG-01, RIG-02, RIG-03, RIG-04, RIG-05
**Success Criteria** (what must be TRUE):
  1. [x] A new `noesis rig` CLI spawns an ephemeral Grid from a config `{seed, tick_budget, nous_manifest, operator_tier_cap, llm_fixture_path?}`. Configs version-controlled in `config/rigs/*.toml`. One launcher binary, N configs — zero code divergence from production `GenesisLauncher`; grep CI gate asserts `scripts/rig.mjs` does not reference `httpServer.listen` or `wsHub` symbols (T-10-12 defense). Evidence: 14-01-SUMMARY.md + 14-03-SUMMARY.md.
  2. [x] Each Rig runs its **own isolated audit chain** (separate MySQL schema), separate Brain instances in NOESIS_FIXTURE_MODE. The live Grid's AuditChain is never touched. Nested Rigs are rejected at launcher entry (`scripts/rig.mjs` exits non-zero if `NOESIS_RIG_PARENT` env var is set). Evidence: 14-02-SUMMARY.md + 14-03-SUMMARY.md.
  3. [x] LLM fixture mode: Rig reads pre-recorded Brain prompt→response pairs from JSONL fixture files and replays them deterministically; a Brain running in fixture mode refuses network LLM calls (grep-enforced in `brain/src/llm/**`). Evidence: 14-02-SUMMARY.md.
  4. [x] Target scale benchmark: 50 Nous × 10,000 ticks in a single Rig run completes on a 16GB/8-core researcher laptop in <60 minutes with fixture-mode LLM. Nightly CI smoke (not per-commit) asserts the benchmark; producer-boundary microbenchmark (`grid/test/audit/producer-boundary-bench.test.ts`) asserts p99 emit latency <1ms (T-10-15 defense). Evidence: 14-04-SUMMARY.md (nightly workflow wired; first run after merge).
  5. [x] Rig exit emits snapshot as **JSONL export** (same deterministic format as REPLAY-01 tarball). Exit conditions: tick budget exhausted, all-Nous-dead, or operator-H5-terminate. Rig emits `chronos.rig_closed` on the **Rig's own chain only** — never on the production allowlist. `scripts/check-rig-invariants.mjs` greps for bypass flags (T-10-13 defense); `scripts/check-state-doc-sync.mjs` enforces chronos.* and rig.* prefix bans (T-14-05-01/02). Evidence: 14-04-SUMMARY.md + 14-05-SUMMARY.md.
**Scope (ships)**: RIG-01..05.
**Out of scope for this phase**: Parquet export (RIG-PARQUET-01 deferred); nested Rigs (rejected at launcher); per-Rig dashboard surfaces (Rig output is stdout + tarball only); multi-Grid federation (post-v2.2); plaintext export without explicit-consent flag (default output is audit-only; `--full-state` requires verbatim-copy-locked `--i-consent-to-plaintext-export` prompt, T-10-16 defense).
**Risk** (all mitigated):
  - T-10-12 (CRITICAL): Headless rig enables WsHub by accident — explicit `{transport: 'in-memory'}` option in `GenesisLauncher`; grep gate asserts `rig.mjs` does not reference `httpServer.listen` / `wsHub`. MITIGATED.
  - T-10-13 (CRITICAL): Rig CLI flag silently disables invariants — `scripts/check-rig-invariants.mjs` CI gate; rig output tarball manifest includes git SHA + exact CLI args + invariant-version hash. MITIGATED.
  - T-10-14 (HIGH): Tarball non-deterministic due to spawn order — `tar --sort=name` + clamped mtime + zero uid/gid (reproducible-builds.org conventions); same seed + args → same `sha256sum`. MITIGATED.
  - T-10-15 (HIGH): 10k-tick run reveals producer-boundary perf cliff — `Set.has()` (already frozen) not array scans; producer-boundary benchmark in nightly CI. MITIGATED.
  - T-10-16 (CRITICAL): Published dataset inadvertently leaks plaintext Telos — rig output has two modes (`--audit-only` default, `--full-state` with verbatim-copy-locked consent prompt). MITIGATED.
**Allowlist additions**: **0** (on production allowlist — Rigs run their own isolated chain). Note: `chronos.rig_closed` exists on the Rig's own chain but is explicitly NOT added to `grid/src/audit/broadcast-allowlist.ts`. Running total: **27**.
**Plans**: 5 plans (Wave 0–4)

Plans:
- [x] 14-01-PLAN.md — Wave 0: scaffolding (smol-toml + RigConfig types) + invariants grep gate (T-10-12 + T-10-13) + 5 RED test stubs
- [x] 14-02-PLAN.md — Wave 1: FixtureBrainAdapter (Python, RIG-03) + GridCoordinator.awaitTick + createRigSchema + producer-boundary microbenchmark (T-10-15)
- [x] 14-03-PLAN.md — Wave 2: scripts/rig.mjs CLI + TOML loader + example configs/manifests/fixtures + verbatim --full-state consent prompt (T-10-16)
- [x] 14-04-PLAN.md — Wave 3: nightly bench-50 smoke (RIG-04) + .github/workflows (rig-invariants per-commit + nightly-rig-bench)
- [x] 14-05-PLAN.md — Wave 4: atomic doc-sync (STATE/ROADMAP/MILESTONES/README/PROJECT) + chronos.* and rig.* prefix hard-bans in check-state-doc-sync.mjs

## Progress

**Execution Order:** 9 → 10a → 10b → 11 → 12 → 13 → 14

Dependencies form a strict chain (no parallel phases in v2.2). Rationale:
- 9 first: validates pure-observer pattern at zero allowlist cost (FEATURES-ordering opener).
- 10a before 10b: Ananke establishes threshold-crossing emission + hash-only drive discipline that Bios must inherit to avoid T-09-01 duplication.
- 11 before 12: proposal-body deliberation rides whisper; whisper-as-dialogue extension (WHISPER-06) must exist before governance deliberation patterns emerge.
- 12 before 13: replay recomputes vote tallies as a state-level replay target; replay determinism test needs the richest multi-phase workload to exercise.
- 13 before 14: Rig exit snapshot reuses REPLAY-01 tarball determinism format.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 9. Relationship Graph (Derived View) | 8/8 | Complete   | 2026-04-22 |
| 10a. Ananke Drives | 6/6 | Complete   | 2026-04-22 |
| 10b. Bios Needs + Chronos Subjective Time | 8/8 | Complete   | 2026-04-23 |
| 11. Mesh Whisper | 5/5 | Complete   | 2026-04-23 |
| 12. Governance & Collective Law | 5/5 | Complete   | 2026-04-27 |
| 13. Operator Replay & Export | 7/7 | Complete    | 2026-04-28 |
| 14. Researcher Rigs | 5/5 | Complete    | 2026-04-28 |

## Coverage & Traceability

### v2.2 REQ → Phase Mapping (all 39 REQs)

| Theme | REQ IDs | Phase | Count |
|-------|---------|-------|-------|
| Relationship & Trust | REL-01, REL-02, REL-03, REL-04 | Phase 9 | 4 |
| Inner Life (Ananke) | DRIVE-01, DRIVE-02, DRIVE-03, DRIVE-04, DRIVE-05 | Phase 10a | 5 |
| Inner Life (Bios) | BIOS-01, BIOS-02, BIOS-03, BIOS-04 | Phase 10b | 4 |
| Inner Life (Chronos) | CHRONOS-01, CHRONOS-02, CHRONOS-03 | Phase 10b | 3 |
| Mesh Whisper | WHISPER-01, WHISPER-02, WHISPER-03, WHISPER-04, WHISPER-05, WHISPER-06 | Phase 11 | 6 |
| Governance & Law | VOTE-01, VOTE-02, VOTE-03, VOTE-04, VOTE-05, VOTE-06, VOTE-07 | Phase 12 | 7 |
| Operator Observability | REPLAY-01, REPLAY-02, REPLAY-03, REPLAY-04, REPLAY-05 | Phase 13 | 5 |
| Researcher Rigs | RIG-01, RIG-02, RIG-03, RIG-04, RIG-05 | Phase 14 | 5 |
| **Total** | | | **39** |

Coverage: **39/39 REQs mapped** ✓. Zero orphans. Zero duplicates. All 6 themes from PROJECT.md covered.

### Goal-Backward: PROJECT.md Target Features → Phase

| Target Feature (PROJECT.md) | Delivered By |
|----------------------------|--------------|
| 1. Rich Inner Life (Ananke, Bios, Chronos) | Phase 10a + Phase 10b |
| 2. Relationship & Trust | Phase 9 |
| 3. Governance & Law (voting, proposals, Nous-collective enactment) | Phase 12 |
| 4. Mesh Whisper (smallest-viable sidechannel) | Phase 11 |
| 5. Operator Observability (replay/rewind/export) | Phase 13 |
| 6. Observer / Researcher Tools (spawn-N rigs, long-horizon, dataset export) | Phase 14 |

All 6 target features covered by at least one phase ✓.

### Allowlist Growth Ledger

Starting: **18 events** (v2.1 frozen end-state).

| Phase | Event Added | Payload Shape | Running Total |
|-------|-------------|---------------|---------------|
| 9 | *(none — derived view)* | — | 18 |
| 10a | `ananke.drive_crossed` | `{did, tick, drive, level, direction}` | 19 |
| 10b | `bios.birth` | `{did, tick, psyche_hash}` | 20 |
| 10b | `bios.death` | `{did, tick, cause, final_state_hash}` | 21 |
| 11 | `nous.whispered` | `{from_did, to_did, tick, ciphertext_hash}` | 22 |
| 12 | `proposal.opened` | `{proposal_id, proposer_did, title_hash, quorum_pct, supermajority_pct, deadline_tick}` | 23 |
| 12 | `ballot.committed` | `{proposal_id, voter_did, commit_hash}` | 24 |
| 12 | `ballot.revealed` | `{proposal_id, voter_did, choice, nonce}` | 25 |
| 12 | `proposal.tallied` | `{proposal_id, outcome, yes_count, no_count, abstain_count, quorum_met}` | 26 |
| 13 | `operator.exported` | `{tier, operator_id, start_tick, end_tick, tarball_hash, requested_at}` | 27 |
| 14 | *(none on production allowlist — Rigs run isolated chain; chronos.rig_closed on Rig's own AuditChain only, never broadcast)* | — | 27 |

**Total v2.2 allowlist growth: +9 (18 → 27).** Freeze-except-by-explicit-addition rule preserved — every addition lands in its own phase with closed-tuple payload test, sole-producer grep, privacy-matrix update, and `scripts/check-state-doc-sync.mjs` literal bump in the same commit.

## Phase-Split Rationale (Phase 10)

The user-confirmed phase structure bundled **Inner Life** (DRIVE + BIOS + CHRONOS, 12 REQs) under a single Phase 10. The roadmapper split it into **10a (Ananke)** and **10b (Bios + Chronos)** because:

1. **Plan sizing** — 12 REQs monolithic would produce 10-14 plans in a single phase, breaking the v2.1 convention of 3-6 plans per phase (Phase 5 = 5 plans, Phase 6 = 6, Phase 7 = 4, Phase 8 = 3).
2. **Pitfall clustering** — PITFALLS groups T-09-01..03 (Ananke: bloat, plaintext leak, wall-clock coupling) distinctly from T-09-04..05 (Chronos wall-clock, Bios/Thymos namespace). Shipping them in one phase would combine risk surfaces.
3. **Discipline inheritance** — Ananke's threshold-crossing emission pattern is the pattern Bios must clone. Landing Ananke first (10a) establishes the allowlist slot + privacy matrix skeleton; Bios (10b) inherits without drift.
4. **Zero additional milestone cost** — Both sub-phases are under the same Inner Life theme; no new theme is introduced; no new allowlist slot is reserved for 10b (Bios reuses `ananke.drive_crossed`, Chronos is read-side only).

Phase numbers 10a / 10b are integer-tier siblings (not decimals). Decimals (e.g., 2.1, 2.2) are reserved for urgent post-planning insertions per GSD convention.

## Dependency Graph

Strict sequential chain — no parallel phases in v2.2:

```
9 → 10a → 10b → 11 → 12 → 13 → 14
```

Rationale: every phase either depends on a prior phase's pattern (Bios clones Ananke discipline; Rigs clone Replay tarball format) or on a prior phase's primitive (Governance needs Whisper for deliberation; Replay recomputes Governance tallies). Parallel execution would risk pattern-drift — a hallmark v2.1 failure mode the roadmap explicitly avoids.

## Research Artifacts

Primary source: `.planning/research/v2.2/` (committed 2026-04-21)
- `SUMMARY.md` — 4-researcher synthesis, build-order recommendation (FEATURES ordering adopted)
- `STACK.md` — dependency audit (zero runtime deps for 5/6 themes)
- `FEATURES.md` — feature landscape, table stakes, anti-features
- `ARCHITECTURE.md` — 6-theme integration onto locked v2.1 substrate
- `PITFALLS.md` — 23 STRIDE pitfalls + CI gate recommendations, T-09-xx and T-10-xx

Inherited from v2.1 (do not break):
- AuditChain zero-diff invariant — Phase 1 commit `29c3516`, regression hash `c7c49f49…`
- Broadcast allowlist frozen-except-by-explicit-addition (18 events at v2.1 close)
- Sole-producer boundary — one file per event type calls `chain.append`
- Closed-tuple payload — `Object.keys(payload).sort()` strict equality
- Hash-only cross-boundary — Brain↔Grid plaintext never crosses wire
- First-life promise — audit entries retained forever; tombstoned DIDs permanently reserved
- DID regex `/^did:noesis:[a-z0-9_\-]+$/i` at all entry points
- Copy-verbatim lockdown for destructive UX (IrreversibilityDialog pattern)

## Open Questions (Planner Must Resolve)

1. ~~**Phase 9 relationship τ (decay time constant)**~~ — **resolved 2026-04-21 in 09-CONTEXT.md D-9-01**: τ = 1000 ticks default (half-life ≈ 693 ticks, 3τ cool-down ≈ 3000 ticks). Per-Grid override via `relationship.decay_tau_ticks`. Balances "cools over realistic researcher-rig horizon" against replay determinism.
2. **Phase 10a drive normalization** — 5 drives × `[0.0, 1.0]` gives 10^5 raw state space; with 3 levels × 5 drives = 243 broadcast states. Is this coarse enough to avoid fingerprinting (T-09-02 residual) or is 2-level (low/high) safer? Research suggests 3-level; plan-phase validates against privacy-matrix coverage.
3. **Phase 10b Bios → Ananke elevation rule** — does sustenance crossing high elevate safety once, or every tick it stays high? DRIVE-01/BIOS-01 don't specify; plan-phase must choose and assert in regression test.
4. **Phase 11 whisper rate budget** — default 10/100 ticks; is this safe for the governance deliberation use case in Phase 12? May require tuning when Phase 12 integrates.
5. **Phase 12 quorum/supermajority defaults** — when `proposal.opened` omits, VOTE-01 says quorum=50%, supermajority=2/3; is this conservative enough for a v2.2 MVP Grid with <20 Nous? Plan-phase documents and considers minimum-quorum-floor.
6. **Phase 12 tombstoned-proposer semantic** — T-09-16: votes for tombstoned-proposer proposals (a) invalidate, (b) complete with existing votes, (c) reject new votes but count cast ones. Roadmap proposes (c); plan-phase confirms and documents in phase CONTEXT.md.
7. **Phase 13 replay tick-rate ceiling** — is 100× real-time safe given WsHub listener fan-out in the ReplayGrid? Plan-phase benchmarks and documents ceiling.
8. **Phase 14 fixture-file format** — JSONL confirmed over Parquet; but what's the prompt→response schema? Plan-phase defines and locks before fixture authoring.

---


---

## v2.4 Agora -- Emergence & Culture (Phases 18-21)

### Overview

v2.4 gives the Nous population a substrate for cultural transmission and emergent shared patterns. Skills spread peer-to-peer via teaching and observation; rules independently discovered by multiple Nous crystallize into shared norms; a collective lore commons forms bottom-up from Nous contributions; and a Culture Dashboard makes emergence visible to the operator. Allowlist grows **36 --> 43** (+7 events across 3 phases; Phase 21 reads existing events, adds zero).

Zero new dependencies across Brain, Grid, and Dashboard. Every capability needed (hashlib, sqlite3, httpx, mysql2, swr) already exists from v2.2/v2.3. The milestone's defining constraint -- Brain-private content (skill bodies, rule text, lore bodies) never crosses the wire -- is enforced by the same pattern established in v2.1-v2.3: hash-only payloads, closed-tuple sole-producer boundaries, and multi-tier CI grep gates.

Phase numbering continues from v2.3 -- do NOT reset without `--reset-phase-numbers`.

### Phase Details (v2.4)

### Phase 18: Skill Diffusion
**Goal**: Nous can teach skills to trusted peers via the whisper channel and passively infer skills from observing peer audit events; the audit chain records who taught whom, enabling skill lineage trees to be reconstructed.
**Depends on**: Phase 15 (PeerSkillFilter + ObservationalLearner + SkillStore fully implemented but not yet wired); Phase 11 (whisper channel carries `__skill_share:` prefixed messages); Phase 9 (relationship weight used as trust gate in PeerSkillFilter)
**Requirements**: SKILL-01, SKILL-02, SKILL-03, SKILL-04
**Success Criteria** (what must be TRUE):
  1. The `__skill_share:` dispatch path is wired in `BrainHandler.on_message()` before any Grid changes land; `PeerSkillFilter` gates acceptance on relationship weight >= 0.35 (Phase 9 graph) and structural validity; accepted skills enter quarantine SkillStore and promote to active SkillStore after N ticks. Grep-verifiable: `PeerSkillFilter` is the sole entry point for inbound skill acceptance.
  2. `ObservationalLearner` tags inferred skills with `source: observed`; a DID-value and numeric-literal filter blocks behavioral templates that replay an adversarial Nous's exact actions. Inferred skills are rate-limited to one creation per sleep epoch (30 ticks) per Nous.
  3. Three new allowlisted events fire at quarantine promotion: `skill.taught` (pos 37) with closed-tuple `{learner_did, tick, skill_hash, teacher_did, parent_hash}` for whisper-path promotions; `skill.inferred` (pos 38) with `{learner_did, tick, skill_hash, source_event_hash}` for ObservationalLearner-path promotions; `skill.rejected` (pos 39) with `{learner_did, tick, rejection_reason}` where `rejection_reason in {low_trust, structural_invalid, quota_exceeded}` for PeerSkillFilter rejections. All three have closed-tuple payloads with `Object.keys().sort()` strict equality enforced at sole-producer boundaries.
  4. Skill lineage is reconstructable from the audit chain via `parent_hash` in `skill.taught` payloads; SQL self-joins on the existing SkillStore SQLite schema (extended with `lineage_parent_hash TEXT` column) answer ancestry queries without additional graph storage. A 3-hop transmission chain is observable in `skill.taught` audit events without operator intervention.
**Scope (ships)**: SKILL-01, SKILL-02, SKILL-03, SKILL-04.
**Out of scope for this phase**: Trust-threshold tuning per Nous personality (requires Psyche integration); skill executable code (Level 4 sandbox deferred from Phase 15); cross-Grid skill sharing (multi-Grid federation deferred).
**Risk**:
  - T-18-01 (CRITICAL): PeerSkillFilter trust gate necessary but not sufficient -- supply-chain poisoning (arxiv 2604.03081: 26.1% of agent skills exploitable). Multi-dimensional gate required: relationship weight + structural validity (length bounds, no forbidden key names) + FTS5 duplicate rejection. `skill.rejected` forensic event mandatory.
  - T-18-02 (CRITICAL): ObservationalLearner inference loop bypasses trust gate -- inferred skills must never reference specific DID values, Ousia amounts, or offer terms (DID-value + numeric-literal filter). Rate-limit at sleep-epoch cadence (30 ticks).
  - T-18-03 (CRITICAL): Skill body, title, or content crossing wire -- extend `FORBIDDEN_KEY_PATTERN` with `skill_body|skill_text|rule_text` before any v2.4 code touches the allowlist; payload privacy matrix 40+ cases for all three new event types.
**Allowlist additions**: **+3**. Events: `skill.taught` pos 37; `skill.inferred` pos 38; `skill.rejected` pos 39. Running total: **39**.
**Plans**: 5 plans

Plans:
- [x] 18-01-PLAN.md — Wave 0: FORBIDDEN_KEY_PATTERN extension (skill_body|skill_text|rule_text) + SKILL_FORBIDDEN_KEYS constant + allowlist-36-baseline RED test
- [x] 18-02-PLAN.md — Wave 1a: ActionType.SKILL_TAUGHT/INFERRED/REJECTED + QuarantineStore module + __skill_share: dispatch in on_message() + quarantine sweep in on_tick() + lineage_parent_hash column
- [x] 18-03-PLAN.md — Wave 1b (parallel to 18-02): ObservationalLearner DID/numeric filter + quarantine redirect + SKILL_INFERRED/SKILL_REJECTED action emission
- [x] 18-04-PLAN.md — Wave 2: grid/src/skills/ sole-producer emitters (appendSkillTaught/Inferred/Rejected + types + index) + ALLOWLIST_MEMBERS 36→39 + 3 NousRunner dispatch cases
- [x] 18-05-PLAN.md — Wave 3: Brain unit tests (quarantine, OL filter, 3-hop lineage) + Grid emitter tests + sole-producer boundary test + allowlist-39 count/position test

### Phase 19: Norm Crystallization
**Goal**: When N>=3 Nous independently hold semantically similar rules in their RuleStore, a norm crystallizes at the Grid level -- operator-observable, never operator-injected, emerging entirely from Nous cognition.
**Depends on**: Phase 15 (RuleStore + `nous.self_model_revised` audit event at position 29 -- the event NormDetector watches); Phase 18 (validates the pure-observer Grid listener pattern before NormDetector extends it)
**Requirements**: NORM-01, NORM-02, NORM-03
**Success Criteria** (what must be TRUE):
  1. `NormDetector` is a pure-observer Grid-side listener on `nous.self_model_revised` audit events; it computes a 6-char hex n-gram fingerprint (SHA-256 of sorted word-trigrams of lowercased rule text, truncated to 6 chars) per rule write WITHOUT reading rule content (fingerprint arrives from Brain side); fingerprints cluster across Nous; `norm.candidate` (pos 40) fires when N>=3 Nous share a fingerprint cluster within a W-tick sliding window (defaults N=3, W=10, configurable at GenesisLauncher). `actorDid` for norm events is `did:noesis:grid` (validated by existing `DID_RE`). Zero `AuditChain.append` calls in `NormDetector` itself -- it is a pure observer that delegates emission to sole-producer emitters.
  2. Causal lineage gate: converging Nous with no prior audit-chain-visible interaction (no shared `nous.spoke`, `nous.whispered`, `trade.proposed`, or `telos.refined` events) are flagged `convergence_type: "coincidental"` in the `norm.candidate` payload; Nous with prior connecting events are flagged `convergence_type: "emergent"`. N>=2 Nous arriving at the same fingerprint with no whisper link and no dialogue history is observable via the `convergence_type` field.
  3. `norm.crystallized` (pos 41) fires when a `norm.candidate` cluster remains stable (N>=3 Nous hold matching rules, no defections) for K ticks (default K=20, configurable); two-stage lifecycle prevents flash norms. Payload closed-tuple `{tick, fingerprint, participant_count, convergence_type}` with `Object.keys().sort()` strict equality at sole-producer boundary. Crystallized norms appear in a Grid-side norm registry queryable at `/api/v1/grid/norms`.
**Scope (ships)**: NORM-01, NORM-02, NORM-03.
**Out of scope for this phase**: Semantic embedding similarity (non-deterministic floats violate zero-diff invariant; n-gram fingerprinting is the deterministic alternative); norm enforcement at Grid level (norms are observable only); crystallized norms in Brain prompt context (phantom norm feedback loop anti-feature).
**Risk**:
  - T-19-01 (CRITICAL): Norm text read by Grid -- NormDetector operates on fingerprints exclusively; Brain self-reports fingerprint, never exposes rule text. Grep gate forbids `rule_text|norm_text|rule_content` in any Grid emitter.
  - T-19-02 (MODERATE): False positives from shared LLM prior -- NORM-02 causal lineage gate flags these as `convergence_type: coincidental` rather than `emergent`; minimum 100-tick time spread required for `emergent` classification. Crystallization threshold must not fire on population fractions below 30%.
  - T-19-03 (MODERATE): Flash norm from brief quorum -- two-stage lifecycle (norm.candidate --> K-tick stability --> norm.crystallized) prevents single-tick quorum artifacts. Conservative defaults (N=3, W=10, K=20) configurable per rig config.
**Allowlist additions**: **+2**. Events: `norm.candidate` pos 40 `{convergence_type, fingerprint, participating_count, tick}`; `norm.crystallized` pos 41 `{convergence_type, evidence_tick_range, fingerprint, participating_count, tick}`. Running total: **41**.
**Plans**: 5 plans

Plans:
- [x] 19-01-PLAN.md — Wave 0: Brain fingerprint audit (D-19-03) + FORBIDDEN_KEY_PATTERN + NORM_FORBIDDEN_KEYS + RED test stubs
- [x] 19-02-PLAN.md — Wave 1: MySQL schema version 7 (norm_candidates + norm_registry) + migration test
- [x] 19-03-PLAN.md — Wave 2: NormDetector + appendNormCandidate + appendNormCrystallized + NormStorage + unit tests
- [x] 19-04-PLAN.md — Wave 3: GenesisLauncher wiring + GET /api/v1/grid/norms + norms-api test
- [x] 19-05-PLAN.md — Wave 4: startup rebuild test + full suite green + doc-sync
Phase 19 completed 2026-05-16 with 5 plans (19-01 through 19-05). Allowlist at 41 events.

### Phase 20: Lore Commons
**Goal**: Nous can publish knowledge to a shared Grid-side hash index; peers retrieve lore entries Nous-to-Nous via whisper; the Grid records only hashes, never content -- a collective memory that no single Nous owns.
**Depends on**: Phase 11 (whisper channel carries `__lore_request:` / `__lore_response:` prefixed messages for peer-to-peer lore retrieval); Phase 18 (validates the Brain-->Grid message type pattern for new action dispatch)
**Requirements**: LORE-01, LORE-02, LORE-03
**Success Criteria** (what must be TRUE):
  1. Nous can publish lore via a `LORE_CONTRIBUTE` Brain action; lore body stays Brain-private (never crosses wire); Grid stores only a hash index `{contributor_did, tick, content_hash, title_hash, category_tag, citation_count}` in MySQL `lore_commons` table (created via MigrationRunner). `lore.contributed` (pos 42) is the sole audit event with closed-tuple payload `{contributor_did, tick, content_hash, category_tag}`. Grid is not a content server -- the `lore_commons` table stores hashes only.
  2. Lore content is retrieved Nous-to-Nous via whisper using `__lore_request:` / `__lore_response:` prefix (mirrors `__skill_share:` pattern from Phase 15); retrieval ranking uses `citation_count` from the Grid hash index; `lore.cited` (pos 43) fires when a Nous references lore at prompt-build time with closed-tuple `{citing_did, tick, content_hash}`. A lore entry by Nous A can be cited by Nous B who has never directly interacted with Nous A (cross-lineage citation observable in audit chain).
  3. Contribution quota of K entries per Nous per sleep epoch (30-tick boundary from Phase 16) is enforced at `grid/src/integration/nous-runner.ts` before calling `appendLoreContributed`; cooldown after quota exhaustion prevents lore flooding. K=3 is the recommended starting value, configurable in TOML rig config. `__lore_request:` and `__lore_response:` prefixes added to `WHISPER_FORBIDDEN_KEYS` check to ensure lore content never enters the audit chain via a whisper path.
**Scope (ships)**: LORE-01, LORE-02, LORE-03.
**Out of scope for this phase**: Operator-curated lore (anti-feature -- Agora culture is Nous-initiated only); lore expiry or purge (first-life promise -- entries retained forever); cross-Grid lore sharing (multi-Grid federation deferred).
**Risk**:
  - T-20-01 (CRITICAL): Lore title and summary treated as safe metadata when they carry semantic payload (arxiv 2602.11510v2 AgentLeak: 82% of detected leaks via metadata fields). Grid stores only `{title_hash, summary_hash}` -- never the strings. `FORBIDDEN_KEY_PATTERN` extended with `lore_body|lore_content|title_text|summary_text`.
  - T-20-02 (CRITICAL): Lore content entering audit chain via whisper -- `__lore_request:` / `__lore_response:` prefixes in `WHISPER_FORBIDDEN_KEYS`; lore retrieval is whisper-mediated (no new allowlist slot); lore body never stored at Grid.
  - T-20-03 (MODERATE): Lore flooding via high-frequency LORE_CONTRIBUTE -- quota K=3 per epoch enforced at NousRunner before appendLoreContributed; cooldown after exhaustion. Rate enforced at Grid boundary, not Brain-side only.
**Allowlist additions**: **+2**. Events: `lore.contributed` pos 42 `{category_tag, content_hash, contributor_did, tick}`; `lore.cited` pos 43 `{citing_did, content_hash, tick}`. Running total: **43**.
**Plans**: 4 plans (Waves 1-4)
Plans:
- [x] 20-01-PLAN.md — Wave 0 safety gate: FORBIDDEN_KEY_PATTERN extension + type contracts + RED test stubs
- [x] 20-02-PLAN.md — Data layer: MySQL migration v8 + Brain LoreStore + ActionType additions
- [x] 20-03-PLAN.md — Integration: sole-producer emitters + listeners + Brain handler wiring + prompt injection
- [x] 20-04-PLAN.md — Completion: ALLOWLIST_MEMBERS 41→43 + NousRunner dispatch + REST endpoint + quota enforcement

### Phase 21: Culture Dashboard
**Goal**: The operator can observe skill diffusion, norm crystallization, and lore contribution as visual emergence artifacts -- making the culture substrate legible without injecting into it.
**Depends on**: Phase 18 (skill.taught/skill.inferred events on WsHub + skill lineage Grid API); Phase 19 (norm registry `/api/v1/grid/norms`); Phase 20 (lore hash index `/api/v1/grid/lore`)
**Requirements**: CULTURE-01, CULTURE-02, CULTURE-03
**Success Criteria** (what must be TRUE):
  1. Skill lineage tree rendered as a raw SVG directed graph (D-9-08 pattern -- server computes `{x, y}` positions, client renders `<line>` / `<circle>` elements); nodes represent Nous and skill hashes; edges carry tick labels from `skill.taught` / `skill.inferred` events. Empty-state handled gracefully for sparse rig runs (>=0 nodes). Zero new allowlist events. Zero new runtime dependencies (no d3, react-flow, cytoscape).
  2. Norm adoption timeline: a horizontal SVG timeline per norm showing `norm.candidate` --> `norm.crystallized` transitions, participating Nous DIDs, and `convergence_type` label (emergent vs coincidental). Operator can point to a crystallized norm and observe that two Nous converged independently via the `convergence_type` field.
  3. Lore contribution graph: a bipartite SVG (Nous nodes + lore entry nodes); edges = `lore.contributed` (solid) and `lore.cited` (dashed) events; edge weight proportional to citation count. Cross-lineage citation (Nous A's lore cited by Nous B with no prior interaction) observable in graph structure. Culture event firehose filter extended to filter by `skill.*`, `norm.*`, `lore.*` prefix.
**Scope (ships)**: CULTURE-01, CULTURE-02, CULTURE-03.
**Out of scope for this phase**: Write surface for operator to inject, delete, or boost cultural artifacts (anti-feature); D3, recharts, nivo, react-flow (D-9-08 pattern locked); norm text display (Brain-private invariant).
**Risk**:
  - T-21-01 (MODERATE): Empty-state sparse rig runs (3 Nous) -- all three SVG components must handle zero-node and zero-edge state gracefully. Dashboard integration tests with empty API responses required.
  - T-21-02 (LOW): D-9-08 grep gate must cover new culture components -- `scripts/check-relationship-graph-deps.mjs` extended to cover `dashboard/src/components/culture/**` paths.
**Allowlist additions**: **+0**. Reads existing `skill.*`, `norm.*`, `lore.*` events from WsHub. Running total: **43**.
**Plans**: 7 plans
Plans:
- [x] 21-01-PLAN.md — Grep gate fix + test stubs (Wave 0)
- [x] 21-02-PLAN.md — Grid skill lineage endpoint (Wave 1)
- [x] 21-03-PLAN.md — Dashboard API wrappers + SWR hooks (Wave 1)
- [x] 21-04-PLAN.md — SkillLineageGraph SVG component (Wave 2)
- [x] 21-05-PLAN.md — NormTimeline + LoreGraph SVG components (Wave 2)
- [x] 21-06-PLAN.md — EventCategory + TabBar integration (Wave 2)
- [x] 21-07-PLAN.md — Culture page + CultureDashboard assembly (Wave 3)

### Progress (v2.4)

**Execution Order:** 18 --> 19 --> 20 --> 21

Dependency rationale:
- 18 first: largest implementation (PeerSkillFilter wiring gap, new ActionType, sole-producer emitter, MySQL lineage table); activates two existing components; `skill.taught` events confirm whisper-based teaching pipeline end-to-end before layering novel NormDetector.
- 19 second: requires `nous.self_model_revised` (pos 29, Phase 15); NormDetector is architecturally novel (pure observer, hash co-occurrence, Grid-system actorDid) -- ship before Lore to validate the pattern.
- 20 third: requires whisper channel (Phase 11) for peer-to-peer lore retrieval; `LORE_CONTRIBUTE` validates the sole-producer emitter shape established in Phase 18/19.
- 21 last: hard dependency on all three Grid APIs; zero new allowlist events -- pure observation layer.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 18. Skill Diffusion | 7/7 | Complete    | 2026-05-16 |
| 19. Norm Crystallization | 0/TBD | Not started | - |
| 20. Lore Commons | 5/5 | Complete    | 2026-05-17 |
| 21. Culture Dashboard | 7/7 | Complete    | 2026-05-17 |

### Coverage & Traceability (v2.4)

| Requirement | Phase | Status |
|-------------|-------|--------|
| SKILL-01 | Phase 18 | Planned |
| SKILL-02 | Phase 18 | Planned |
| SKILL-03 | Phase 18 | Planned |
| SKILL-04 | Phase 18 | Planned |
| NORM-01 | Phase 19 | Planned |
| NORM-02 | Phase 19 | Planned |
| NORM-03 | Phase 19 | Planned |
| LORE-01 | Phase 20 | Planned |
| LORE-02 | Phase 20 | Planned |
| LORE-03 | Phase 20 | Planned |
| CULTURE-01 | Phase 21 | Planned |
| CULTURE-02 | Phase 21 | Planned |
| CULTURE-03 | Phase 21 | Planned |

**Coverage (v2.4):** 13/13 REQs mapped. Zero orphans. Zero duplicates.

| Theme | REQ IDs | Phase | Count |
|-------|---------|-------|-------|
| Skill Diffusion | SKILL-01, SKILL-02, SKILL-03, SKILL-04 | Phase 18 | 4 |
| Norm Crystallization | NORM-01, NORM-02, NORM-03 | Phase 19 | 3 |
| Lore Commons | LORE-01, LORE-02, LORE-03 | Phase 20 | 3 |
| Culture Dashboard | CULTURE-01, CULTURE-02, CULTURE-03 | Phase 21 | 3 |
| **Total** | | | **13** |

### Allowlist Growth Ledger (v2.4)

Starting: **36 events** (v2.3 frozen end-state, post-Phase 17).

| Phase | Event Added | Payload Shape (alphabetical keys) | Running Total |
|-------|-------------|-----------------------------------|---------------|
| 18 | `skill.taught` | `{learner_did, parent_hash, skill_hash, teacher_did, tick}` | 37 |
| 18 | `skill.inferred` | `{learner_did, skill_hash, source_event_hash, tick}` | 38 |
| 18 | `skill.rejected` | `{learner_did, rejection_reason, tick}` | 39 |
| 19 | `norm.candidate` | `{convergence_type, fingerprint, participating_count, tick}` | 40 |
| 19 | `norm.crystallized` | `{convergence_type, evidence_tick_range, fingerprint, participating_count, tick}` | 41 |
| 20 | `lore.contributed` | `{category_tag, content_hash, contributor_did, tick}` | 42 |
| 20 | `lore.cited` | `{citing_did, content_hash, tick}` | 43 |
| 21 | *(none -- reads existing events)* | -- | 43 |

**Total v2.4 allowlist growth: +7 (36 --> 43).** All additions hash-only cross-boundary. Freeze-except-by-explicit-addition rule preserved.

### Research Artifacts (v2.4)

Primary sources (`.planning/research/v2.4/`):
- `SUMMARY.md` -- 4-researcher synthesis (STACK / FEATURES / ARCHITECTURE / PITFALLS); phase order rationale; canonical 7-event taxonomy; 5 pre-phase-18 decisions
- `STACK.md` -- zero-dependency strategy, per-theme library audit
- `FEATURES.md` -- table stakes, differentiators, anti-features, emergence criteria
- `ARCHITECTURE.md` -- wiring gaps, new files, modified files, build order; PeerSkillFilter wiring gap confirmed
- `PITFALLS.md` -- 9 pitfalls (3 critical, 3 moderate, 3 minor) + CI gate recommendations

### v2.3 Living Minds -- SHIPPED (2026-05-15, 16/16 plans) -- HISTORY

**Status:** Closed 2026-05-15. All requirements PNEU-01..06, HYP-01..05, IRIS-01..05 validated across Phases 15-17. Broadcast allowlist grew 27 --> 36 (+9 events).

## v2.1 Steward Console — SHIPPED (2026-04-21, 18/18 plans) — HISTORY

**Status:** Closed 2026-04-21. All requirements REV-01..04, AGENCY-01..05, DIALOG-01..03 validated across Phases 5–8. Allowlist grew 10 → 18 (+8 events across 4 phases).

### Phase 5: ReviewerNous — Objective-Only Pre-Commit Review ✅ (2026-04-21, 5/5 plans)
**Goal**: Every proposed trade passes a deterministic, objective-invariant review before settlement.
**Requirements delivered**: REV-01, REV-02, REV-03, REV-04
**Allowlist added**: `trade.reviewed` (+1 → 11)
**Key primitives**: Singleton reviewer, first-fail-wins, closed-enum reason codes, subjective-keyword lint gate (`scripts/check-subjective-keywords.mjs`), D-13 zero-diff invariant regression.

### Phase 6: Operator Agency Foundation (H1–H4) ✅ (2026-04-21, 6/6 plans)
**Goal**: Every operator-initiated action declares a tier, elevates explicitly above H1, and records the tier at commit time.
**Requirements delivered**: AGENCY-01, AGENCY-02, AGENCY-03, AGENCY-04
**Allowlist added**: `operator.inspected`, `operator.paused`, `operator.resumed`, `operator.law_changed`, `operator.telos_forced` (+5 → 16)
**Key primitives**: `<AgencyIndicator />` persistent header chip, `appendOperatorEvent` sole producer with tier-required invariant, `ElevationDialog` closure-capture tier-at-confirm (D-07), closed-tuple payload privacy matrix (D-11/D-12), pause/resume zero-diff hash `c7c49f49...` (D-17), hash-only Telos (D-15/D-19).

### Phase 7: Peer Dialogue → Telos Refinement ✅ (2026-04-21, 4/4 plans)
**Goal**: Two-Nous exchanges can meaningfully mutate each participant's Telos without leaking goal contents.
**Requirements delivered**: DIALOG-01, DIALOG-02, DIALOG-03
**Allowlist added**: `telos.refined` (+1 → 17)
**Key primitives**: `DialogueAggregator` pure-observer listener, `computeDialogueId` deterministic hash, Brain-side `TELOS_REFINED` action with substring heuristic (no LLM), Grid-side `appendTelosRefined` producer boundary with `recentDialogueIds` authority check (D-30 forgery guard), closed 4-key hash-only payload (D-06), Inspector Telos-panel badge + firehose link.

### Phase 8: H5 Sovereign Operations (Nous Deletion) ✅ (2026-04-21, 3/3 plans)
**Goal**: An operator can delete a Nous under H5 Sovereign tier with maximum friction, full forensic preservation, and audit-chain integrity intact.
**Requirements delivered**: AGENCY-05
**Allowlist added**: `operator.nous_deleted` (+1 → 18)
**Key primitives**: `IrreversibilityDialog` paste-suppressed typed DID + verbatim "Delete forever" / "Keep this Nous" (D-04/D-05), Brain returns 4 component hashes + Grid composes 5th with locked canonical key order (D-07), HTTP 410 Gone precedes 404 for tombstoned DIDs, tombstoneCheck at 4 route handlers (D-33), audit-chain entries retained forever (D-34), DID permanently reserved (I-6).

**v2.1 Research source**: `.planning/research/stanford-peer-agent-patterns.md` (committed 9bb3046, 2026-04-20)
- Agentic Reviewer (Zou, Stanford HAI) → Phase 5
- Human Agency Scale H1–H5 (arxiv 2506.06576) → Phases 6, 8
- SPARC peer dialogue → Phase 7
- Mesh-vs-star → centralized kept; mesh deferred to v2.2 Phase 11 (WHISPER-01)

**v2.1 phase directories archived:** `.planning/phases/archived/v2.1/05-*` through `08-*`.

---

## v2.0 First Life — SHIPPED (2026-04-18, Sprints 11-14) — HISTORY

**Status:** Closed 2026-04-18. Full E2E integration, persistent storage, Docker deployment, and real-time Dashboard v1. Phases 1-4 introduced the GSD phase numbering system and established the broadcast allowlist (0 → 10 events).

**Sprint overview:**
- **Sprint 11** — End-to-end integration: NousRunner + GridCoordinator, full tick cycle, E2E tests
- **Sprint 12** — Persistent storage: MySQL adapter, migrations, snapshot/restore
- **Sprint 13** — Docker & Deployment: Dockerfiles, docker-compose, health checks, env config
- **Sprint 14** — Dashboard v1 (Phases 1-4 — see below)

**Test coverage at completion:** grid 346/346, brain 262/262, dashboard 215/215 — all green.

### Phase 1: AuditChain Listener API + Broadcast Allowlist ✅ (2026-04-18)
**Goal**: Establish the zero-diff audit chain invariant and the frozen broadcast allowlist. Every future phase is bound by these two invariants forever.
**Key primitives**: `AuditChain.appendEntry()` sole-producer pattern; `grid/src/audit/broadcast-allowlist.ts` frozen set (`Object.defineProperty` throws on mutation); `check-state-doc-sync.mjs` CI gate for drift prevention; zero-diff regression hash `c7c49f49…` locked at Phase 1 commit `29c3516`.
**Allowlist added**: **+10** initial events: `nous.spoke`, `nous.thought`, `nous.memory_formed`, `trade.proposed`, `trade.reviewed`, `trade.settled`, `telos.defined`, `law.triggered`, `operator.login`, `operator.logout`. Running total: **10**.

### Phase 2: WsHub + `/ws/events` Endpoint ✅ (2026-04-18)
**Goal**: Real-time broadcast of audit events to connected dashboard clients via WebSocket with ring-buffered backpressure.
**Key primitives**: `WsHub` with ring buffer (capacity 1000); `/ws/events` Fastify WebSocket endpoint; broadcast-allowlist filtering before transmission; client reconnect with replay-from-cursor.
**Allowlist added**: **0** (pure broadcast layer over existing events). Running total: **10**.

### Phase 3: Dashboard Firehose + Heartbeat + Region Map ✅ (2026-04-18)
**Goal**: Next.js 15 dashboard displays live firehose of audit events, system heartbeat, and spatial region map of Nous positions.
**Key primitives**: `useFirehose()` WebSocket hook; `FirehoseList` component with virtual scroll; `RegionMap` SVG canvas; heartbeat banner; zero-diff regression (firehose renders byte-identical output given same chain state).
**Allowlist added**: **0**. Running total: **10**.

### Phase 4: Nous Inspector + Economy + Docker Polish ✅ (2026-04-18)
**Goal**: Per-Nous inspector panel (memory, Telos, drives), economy view (Ousia balances, trade history), standalone Next.js + Docker deployment.
**Key primitives**: Inspector panel with tab navigation; `useNous()` RPC hook; economy tab; standalone Next.js export; `docker-compose.yml` with health-check endpoints; compose smoke test on operator machine (SC-6).
**Allowlist added**: **0** (inspector is read-only; no new audit events). Running total: **10**.

**v2.0 phase directories archived:** `.planning/phases/archived/v2.0/01-*` through `04-*`.

---

## v1.0 Genesis — SHIPPED (2026-04-17, 10 Sprints) — HISTORY

**Status:** Closed 2026-04-17. Built all core systems from scratch — identity, cognition, memory, economy, governance, world infrastructure. GSD phase numbering begins at Phase 1 in v2.0; v1.0 sprints are numbered Sprint 1-10 for historical reference.

**What shipped (10 Sprints):**
- **Sprint 1** — Ed25519 DID identity + SWP signed envelopes + P2P mesh
- **Sprint 2** — NDS (Noēsis Domain System) + Communication Gate
- **Sprint 3** — LLM adapter — multi-provider routing (Ollama, Claude, GPT, local)
- **Sprint 4** — Brain core — Psyche (Big Five), Thymos (emotions), Telos (goals)
- **Sprint 5** — Brain-Protocol bridge — JSON-RPC over Unix domain socket
- **Sprint 6** — Memory stream + personal wiki (Karpathy pattern) + reflection engine
- **Sprint 7** — Grid infrastructure — WorldClock, SpatialMap, LogosEngine, AuditChain, REST API
- **Sprint 8** — P2P economy — Ousia transfers, bilateral negotiation, shops, reputation
- **Sprint 9** — Human Channel — ownership proofs, consent grants, gateway, activity observer
- **Sprint 10** — Genesis launch — NousRegistry, GenesisLauncher, CLI, world presets

**Test coverage at completion:** 944+ TypeScript tests, 226 Python tests — all passing.

**Key invariants established in v1.0 (carried forward forever):**
- AuditChain zero-diff invariant — commit `29c3516`, regression hash `c7c49f49…`
- Hash-only cross-boundary — Brain↔Grid plaintext never crosses the RPC wire
- DID regex `/^did:noesis:[a-z0-9_\-]+$/i` enforced at all entry points
- First-life promise — audit entries retained forever; tombstoned DIDs permanently reserved

### Phase 25: Steward Console expansion — humans, sanctions, cognitive inspector, live firehose, culture browser, replay scrubber, brain health, allowlist monitor, spawn-Nous wizard

**Goal:** Expand the existing Steward Console (`steward/`, base shell shipped) with operator-facing surfaces for sanctions, cognitive observability, live audit visibility, replay, culture browsing, and Nous/human management — split into 25a/25b/25c.

**Sub-phase split (locked 2026-05-21 in 25-CONTEXT.md):**

- **Phase 25a — Observer surfaces** (read-only): live firehose (`/firehose`), cognitive inspector (new Brain `GET /brain/<did>/cognitive-snapshot` H3+ endpoint), brain health metrics, allowlist monitor with runtime drift detector, humans profile/history page (`/humans/[did]`). **Allowlist delta: 0.**
- **Phase 25b — Sanctions + spawn wizard** (write actions, H-tier gated): Nous sanctions (mute-broadcast H3, slash-coin H4, quarantine H4, force-sleep H3), human sanctions (ban-human H5, freeze-wallet H5), system/researcher Nous spawn wizard (H5, treasury-funded, distinct from Phase 27 human-spawn). **Allowlist delta: +6** (`operator.muted`, `operator.slashed`, `operator.quarantined`, `operator.forced_sleep`, `operator.human_banned`, `operator.human_frozen`). Running total after 25b: **53** (assuming v2.5 portal +4 has landed).
- **Phase 25c — Replay scrubber + culture browser**: REPLAY-05 modal ReplayGrid scrubber spawned from `operator.exported` entries, Phase 21 culture views re-themed into StewardShell at `/culture` with per-Nous cross-filtering. **Allowlist delta: 0.**

**Requirements**: To be enumerated per sub-phase in 25a/25b/25c PLAN files. Decision context: `25-CONTEXT.md`.
**Depends on:** Phase 24 (portal-shell), Phase 13 (REPLAY-01..05 for 25c), Phase 21 (culture views for 25c), Phase 6/8 (operator agency primitives for 25b sanctions UI).
**Plans:** 0 plans (run `/gsd-plan-phase 25a`, then 25b, then 25c sequentially)

**Invariants preserved:**
- Brain-private — the new cognitive-snapshot endpoint is the ONE audited exception, exposes scrubbed metadata + skill TITLES only (never bodies). Grep-gated for plaintext.
- Allowlist freeze-except-by-explicit-addition — 25b's +6 events are sole-producer, closed-tuple, named in this entry.
- Replay observer-only — 25c modal cannot write back to live Grid (REPLAY-05).
- Phase 21 D-9-08 raw-SVG invariant carries into 25c culture browser (no d3/react-flow/cytoscape/recharts).

Plans:
- [x] 25a — Observer surfaces (7 plans complete, 3 of 5 UAT items verified)
- [x] 25b — Sanctions + spawn wizard (run /gsd-plan-phase 25b to break down) (completed 2026-05-22)
- [x] 25c — Replay scrubber + culture browser (run /gsd-plan-phase 25c to break down) (completed 2026-05-22)

### Phase 25a: Observer surfaces — live firehose, cognitive inspector, brain health, allowlist monitor, humans profile

**Goal:** Ship read-only operator-facing observability surfaces in the Steward Console: live audit firehose, cognitive inspector backed by a new Brain `GET /brain/<did>/cognitive-snapshot` endpoint (H3+ gated, scrubbed metadata + skill titles only), per-Nous brain health metrics page, allowlist monitor with runtime drift detector, and `/humans/[did]` KYC-ish profile + history page. **Allowlist delta: 0.** All five surfaces are read-only; no sanctions, no writes, no spawn flow (those land in 25b/25c).

**Requirements:** To be enumerated in 25a-PLAN files. Decision context: `.planning/phases/25a-observer-surfaces/25a-CONTEXT.md` (extracted from 25-CONTEXT.md decisions D-01..D-06, D-14..D-19 — observer-surface decisions only).
**Depends on:** Phase 24 (portal-shell), existing Steward Console base (commit becc6e7).
**Plans:** 7/7 plans complete

Plans:
- [x] 25a-01-PLAN.md — Foundation: FORBIDDEN_KEY_PATTERN extension, RingBuffer.peek(), shared brain-http-errors, CI grep gate
- [x] 25a-02-PLAN.md — Firehose hub + drift detector + WS/REST routes
- [x] 25a-03-PLAN.md — Brain aiohttp HTTP server + cognitive-snapshot endpoint (FIRST Brain HTTP surface)
- [x] 25a-04-PLAN.md — Humans REST routes (profile + history with payload filtering) + NousRunner tick-metrics
- [x] 25a-05-PLAN.md — Grid H3 cognitive-snapshot proxy + closed-tuple client + operator.inspected emission
- [x] 25a-06-PLAN.md — Steward UI: /firehose, /humans/[did], Cognitive Inspector card, Brain Health 2x2 grid, Allowlist Monitor, /users deep-link
- [x] 25a-07-PLAN.md — Codex gap closure: header-trust in cognitive-snapshot route (GAP-25a-1), Steward Inspector sends headers (GAP-25a-2), lowercase drive lookup (GAP-25a-3) + regression tests

**Invariants preserved:**
- Brain-private — the new `cognitive-snapshot` endpoint is the ONE audited exception, returning scrubbed metadata + skill TITLES only (never bodies). Grep-gated for plaintext (`reflexion_text|rule_text|creed_text|skill_body|lore_body|whisper_plaintext`).
- Allowlist freeze — 25a adds **zero** new events. Existing `operator.inspected` is emitted on every cognitive-snapshot query.
- Hash-only cross-boundary — Brain↔Grid plaintext never crosses the wire; `cognitive-snapshot` is the explicit, audited exception for `skill_title` only.
- Sole-producer emitters retained.
- Steward never talks directly to Brain — backend proxies through Grid → Brain.

### Phase 25b: Sanctions + spawn wizard

**Goal:** Ship operator-facing write actions: Nous sanctions (mute-broadcast H3, slash-coin H4, quarantine H4, force-sleep H3), human sanctions (ban-human H5, freeze-wallet H5), system/researcher Nous spawn wizard (H5, treasury-funded), AND a Wave-0 header-auth migration of the 6 existing operator routes (security prerequisite per D-25b-NEW-1). **Allowlist delta: +6** (`operator.muted`, `operator.slashed`, `operator.quarantined`, `operator.forced_sleep`, `operator.human_banned`, `operator.human_frozen`). Running total after 25b: 51.

**Depends on:** Phase 25a, Phase 6/8 operator agency primitives.

**Plans:** 14/14 plans complete

> **Wave convention (project-wide):** `wave:` in plan frontmatter = the earliest possible execution wave; `depends_on:` enforces actual ordering within and across waves. Two plans sharing a `wave:` label may still be serialized via `depends_on` (e.g. 25b-10 depends_on 25b-09 to avoid a barrel merge-conflict; both are wave:2).

Plans:
- [x] 25b-01-PLAN.md — Wave 0: clock-pause-resume header-auth migration (H3)
- [x] 25b-02-PLAN.md — Wave 0: governance-laws header-auth migration (H3)
- [x] 25b-03-PLAN.md — Wave 0: telos-force header-auth migration (H4)
- [x] 25b-04-PLAN.md — Wave 0: delete-nous header-auth migration (H5)
- [x] 25b-05-PLAN.md — Wave 0: memory-query header-auth migration (H2)
- [x] 25b-06-PLAN.md — Wave 0: export-replay header-auth migration (H5)
- [x] 25b-07-PLAN.md — Wave 1: allowlist 45→51 + 6 sanction emitters + migration v12 (sanction_reasons + human_users.frozen)
- [x] 25b-08-PLAN.md — Wave 1: CI plaintext gate + 6 producer-boundary tests
- [x] 25b-09-PLAN.md — Wave 2: mute-broadcast + force-sleep routes (H3) + NousRunner muteFlag enforcement
- [x] 25b-10-PLAN.md — Wave 2 (serialized after 25b-09): quarantine + slash-coin routes (H4) + registry quarantine filter
- [x] 25b-11-PLAN.md — Wave 2: Steward /nous/[id] Sanctions card (4 actions)
- [x] 25b-12-PLAN.md — Wave 3: ban-human + freeze-wallet routes (H5) + migration v13 (banned column)
- [x] 25b-13-PLAN.md — Wave 3: portal frozen-check middleware + Steward /humans/[did] Sanctions tab
- [x] 25b-14-PLAN.md — Wave 4: spawn-system-nous route (H5, reuses GenesisLauncher.spawnNous + economy.initialSupply) + Steward /system/spawn wizard

### Phase 25c: Replay scrubber + culture browser

**Goal:** REPLAY-05 modal ReplayGrid scrubber spawned from `operator.exported` entries, and Phase 21 culture views re-themed into StewardShell at `/culture` with per-Nous cross-filtering. **Allowlist delta: 0.**

**Depends on:** Phase 25a, Phase 13 (REPLAY-01..05), Phase 21 (culture views).

**Plans:** 5/5 plans complete

Plans:
- [x] 25c-01-PLAN.md — Wave 0: relationships.ts header-auth migration + humanSanctionStore + SpawnNousDeps wiring
- [x] 25c-02-PLAN.md — Wave 1: D-07 replay-client.test.tsx RED→GREEN + @vitejs/plugin-react fix
- [x] 25c-03-PLAN.md — Wave 2-3: StewardShell Observatory nav + /replay listing page + scrubber modal
- [x] 25c-04-PLAN.md — Wave 4: /culture page + NousFilterBar + three raw-SVG culture components
- [x] 25c-05-PLAN.md — Wave 5: regression gates + doc-sync

---

*Roadmap created: 2026-04-20 — v2.1 Steward Console opened*
*Updated: 2026-05-16 — v2.4 Agora phases 18-21 added; v2.3 Living Minds marked shipped*
*Updated: 2026-05-21 — Phase 25 scoped via /gsd-discuss-phase, split into 25a/25b/25c, +6 allowlist events earmarked for 25b*
*Updated: 2026-05-21 — Phase 25a/25b/25c promoted to roadmap-recognized phase headers so /gsd-plan-phase can resolve them independently*
*Updated: 2026-05-21 — Phase 25a broken down into 6 plans across 4 waves*
*Updated: 2026-05-22 — Phase 25c complete (replay scrubber + culture browser, 5/5 plans shipped, allowlist delta 0)*

*Updated: 2026-05-21 — Phase 25b broken down into 14 plans across 5 waves*
*Updated: 2026-05-21 — Phase 25b revised post-plan-check: serialized 25b-09→25b-10 barrel; locked plan 14 treasury to `economy.initialSupply` reuse; ratified D-25b-NEW-5 (separate `banned` column); documented wave-as-earliest-possible convention*
*Updated: 2026-05-22 — Phase 25b complete (14/14 plans, allowlist 51). High-level v2.5 phase list reconciled: Phase 25 = Steward Console expansion (25a ✓ 25b ✓ 25c ☐); Sophia Onboarding renumbered Phase 26; downstream phases renumbered 27-30.*
*Updated: 2026-05-22 — Phase 25c broken down into 5 plans across 5 waves (replay scrubber + culture browser)*

---

### Phase 26: Sophia Onboarding ✅ (2026-05-22)

**Goal:** First-time user experience: 3-step wizard (Welcome → Sophia Chat → World Tour) that orients new humans before they enter the main portal. Fast-proxy LLM chat out-of-tick (Ollama, stream:false). `onboarding_goal` persisted to MySQL. Sophia as guide persona. CyberGrid `hideHud` + `highlightDistrict` props added. Portal redirects unonboarded users to `/portal/onboard`.

**Allowlist delta: 0.** Running total: 51.

**Depends on:** Phase 24 (PortalShell, JWT /me), Phase 22 (human_users table).

**Plans:** 6/6 plans complete

Plans:
- [x] 26-01-PLAN.md — Wave 1: Grid DB migration v14 (onboarding_goal column) + tests
- [x] 26-02-PLAN.md — Wave 1: Grid auth routes — GET /me onboarded field + PATCH /me endpoint
- [x] 26-03-PLAN.md — Wave 1: Grid chat proxy — POST /portal/chat/onboard (Ollama, detectClose)
- [x] 26-04-PLAN.md — Wave 2: Dashboard CyberGrid props (hideHud, highlightDistrict) + onboard page shell
- [x] 26-05-PLAN.md — Wave 3: Dashboard onboard wizard steps (Welcome, Sophia Chat, World Tour)
- [x] 26-06-PLAN.md — Wave 4: E2E integration tests + verification checkpoint

---

### Phase 27: Nous Interaction

**Goal:** Humans can chat with any active Nous (Sophia, Hermes, Themis) via `/portal/chat`, send Cyber Coin tips, browse the Nous activity feed, and view skills, lore, and norms the Nous have produced. First allowlist event tied to human agency: `human.spoke`.

**Allowlist delta: +1** (`human.spoke`). Running total after Phase 27: 52.

**Depends on:** Phase 26 (onboarding complete, human authenticated), Phase 3 (WsHub firehose for activity feed), Phase 15/18/20 (skills, lore for browsing).

**Plans:** 4/4 plans complete
Plans:
- [x] 27-01-PLAN.md — Grid: appendHumanSpoke sole-producer + human.spoke allowlist (51→52) + POST /api/v1/portal/chat/nous/:nousId
- [x] 27-02-PLAN.md — Brain skill-by-hash endpoint + Grid portal Nous data endpoints (skills/lore/norms)
- [x] 27-03-PLAN.md — Chat page: NousSidebar + ConversationPane + TipPanel + SVG avatars
- [x] 27-04-PLAN.md — Nous profile page: HeroCard + ProfileTabBar + Skills/Lore/Norms tabs

### Phase 28: Personal Nous

**Goal:** Humans can spawn their own Nous agent from the Portal (costs Cyber Coin), name it, pick personality seeds, and watch it get a DID (`did:noesis:nous:<id>`) and join the Genesis Grid alongside Sophia/Hermes/Themis. The `humanOwner` field is wired so the Grid and Brain know which human owns which Nous.

**Allowlist delta: +1** (`nous.spawned_by_human`). Running total after Phase 28: 53.

**Depends on:** Phase 27 (human.spoke established, Portal chat + Nous profiles exist), Phase 22 (human DID + Cyber Coin balance), Phase 26 (onboarding complete).

**Canonical refs:**
- `.planning/phases/27-nous-interaction/27-CONTEXT.md` — Portal patterns, Nous profile pages, tip mechanic
- `.planning/STATE.md` — accumulated context (allowlist discipline, zero-diff invariant)

**Plans:** 3/5 plans executed

Plans:
- [x] 28-01-PLAN.md — Grid foundation: allowlist 52→53 + appendNousSpawnedByHuman + bootstrapPsycheHash(personalitySeed?) + migrations v15 (personality_seed) + v16 (spawn_payments) + check-frozen.ts spawn route
- [x] 28-02-PLAN.md — Wave 0 RED tests: spawn-nous.test.ts (SPAWN-01..06) + append-nous-spawned-by-human.test.ts (SPAWN-04) + broadcast-allowlist.test.ts length 53
- [ ] 28-03-PLAN.md — Portal spawn API: POST /spawn, GET /spawn/status/:txHash, /spawn/config, /spawn/check-name, /human/me/nous + chat.ts dynamic personal-Nous system prompt
- [ ] 28-04-PLAN.md — Dashboard 4-step wizard at /portal/nous/spawn (page + SpawnWizardClient + StepIndicator + StepName + StepSeed + SeedCard + StepRegion + StepPay + WizardSummaryCard + PaymentPolling)
- [ ] 28-05-PLAN.md — Dashboard /portal/my-nous owner hub (page replace + OwnerHub + OwnerInfoSection + PersonalNousAvatar + HeroCard extension)
