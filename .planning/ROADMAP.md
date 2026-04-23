# Roadmap: Noēsis — v2.2 Living Grid

## Overview

v2.2 moves Nous from observed entities to full agents. Six themes ship as 7 phases (Phase 9 → Phase 14, with Phase 10 split into 10a/10b) on top of the frozen v2.1 Steward Console. Build order follows **FEATURES** (motivation-first): Relationship first as the zero-allowlist-cost opener that validates the pure-observer pattern for v2.2, then Inner Life to establish the hash-only drive discipline, then Whisper (proposal bodies will ride whisper), then Governance, then operator Replay, then Researcher Rigs as the terminal integration test.

Allowlist grows **18 → 27** (+9 events across 5 phases). Two phases add zero new allowlist members: **Phase 9** (derived relationship view) and **Phase 14** (Rigs run their own isolated chain). Note: Phase 10b adds +2 (`bios.birth`, `bios.death`) per D-10b-01 correction — these events were not in v2.1 as originally assumed.

Phase numbering continues from v2.1 — do NOT reset without `--reset-phase-numbers`.

## Milestones

- ✅ **v1.0 Genesis** (shipped 2026-04-17) — Phases 1-10, 944+ TS tests, 226 Py tests
- ✅ **v2.0 First Life Sprints 11-14** (shipped 2026-04-18) — E2E, persistence, Docker, Dashboard v1
- ✅ **v2.1 Steward Console — Phases 5-8** (shipped 2026-04-21, 18/18 plans)
- 🔄 **v2.2 Living Grid — Phases 9-14** (opened 2026-04-21)

## Phases (v2.2 Active)

- [x] **Phase 9: Relationship Graph (Derived View)** — Pure-observer relationship listener over existing dialogue.* + trade.* events. Zero allowlist additions. (completed 2026-04-22)
- [x] **Phase 10a: Ananke Drives (Inner Life, part 1)** — Five-drive subsystem with threshold-crossing audit events. Establishes hash-only drive discipline for Phase 10b. (shipped 2026-04-22, allowlist 18→19 with `ananke.drive_crossed`)
- [x] **Phase 10b: Bios Needs + Chronos Subjective Time (Inner Life, part 2)** — Bodily needs elevate drives; subjective time modulates Stanford retrieval recency. Allowlist +2 (bios.birth, bios.death). (shipped 2026-04-22, allowlist 19→21)
- [ ] **Phase 11: Mesh Whisper** — Nous-to-Nous E2E envelope (libsodium `crypto_box`); operators cannot read plaintext at any tier.
- [ ] **Phase 12: Governance & Collective Law** — Commit-reveal ballot lifecycle (4 events); successful proposals promote to v2.1 LogosEngine.
- [ ] **Phase 13: Operator Replay & Export** — State-level ReplayGrid + deterministic JSONL tarball export; read-only rewind in Steward Console.
- [ ] **Phase 14: Researcher Rigs** — `noesis rig` CLI spawns ephemeral Grid with LLM fixture mode; target 50 Nous × 10,000 ticks in <60min.

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
**Plans**: TBD
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
**Plans**: TBD
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
**Plans**: TBD
**UI hint**: yes

### Phase 14: Researcher Rigs
**Goal**: A researcher can spawn an ephemeral Grid from a versioned config, run 50 Nous × 10,000 ticks in under 60 minutes with LLM fixture mode, and export a deterministic JSONL dataset — all on an isolated audit chain that never touches production.
**Depends on**: Phase 13 (tarball determinism pattern established; Rig exit snapshot reuses REPLAY-01 format); all prior v2.2 phases (Rigs are the integration test for Inner Life + Relationships + Governance + Whisper emergent dynamics — Rig must be able to spawn all six themes as a single integrated research workload)
**Requirements**: RIG-01, RIG-02, RIG-03, RIG-04, RIG-05
**Success Criteria** (what must be TRUE):
  1. A new `noesis rig` CLI spawns an ephemeral Grid from a config `{seed, tick_budget, nous_manifest, operator_tier_cap, llm_fixture_path?}`. Configs version-controlled in `config/rigs/*.toml`. One launcher binary, N configs — zero code divergence from production `GenesisLauncher`; grep CI gate asserts `scripts/rig.mjs` does not reference `httpServer.listen` or `wsHub` symbols (T-10-12 defense).
  2. Each Rig runs its **own isolated audit chain** (separate MySQL schema or in-memory SQLite), separate WsHub, separate Brain instances. The live Grid's AuditChain is never touched. Nested Rigs are rejected at launcher entry (`scripts/rig.mjs` exits non-zero if `NOESIS_RIG_PARENT` env var is set).
  3. LLM fixture mode: Rig reads pre-recorded Brain prompt→response pairs from JSONL fixture files and replays them deterministically; a Brain running in fixture mode refuses network LLM calls (grep-enforced in `brain/src/llm/**`). This is the reproducibility workaround for LLM non-determinism.
  4. Target scale benchmark: 50 Nous × 10,000 ticks in a single Rig run completes on a 16GB/8-core researcher laptop in <60 minutes with fixture-mode LLM. Nightly CI smoke (not per-commit) asserts the benchmark; producer-boundary microbenchmark (`grid/test/audit/producer-boundary-bench.test.ts`) asserts p99 emit latency <1ms (T-10-15 defense).
  5. Rig exit emits snapshot as **JSONL export** (same deterministic format as REPLAY-01 tarball). Exit conditions: tick budget exhausted, all-Nous-dead, or operator-H5-terminate. Rig emits `chronos.rig_closed` on the **Rig's own chain only** — never on the production allowlist. **No rig CLI flag mutates invariants**: `scripts/check-rig-invariants.mjs` greps `scripts/rig.mjs` for `--skip-*|--bypass-*|--disable-*|--no-reviewer|--no-tier` and fails on any match (T-10-13 defense).
**Scope (ships)**: RIG-01..05.
**Out of scope for this phase**: Parquet export (RIG-PARQUET-01 deferred); nested Rigs (rejected at launcher); per-Rig dashboard surfaces (Rig output is stdout + tarball only); multi-Grid federation (post-v2.2); plaintext export without explicit-consent flag (default output is audit-only; `--full-state` requires verbatim-copy-locked `--i-consent-to-plaintext-export` prompt, T-10-16 defense).
**Risk**:
  - T-10-12 (CRITICAL): Headless rig enables WsHub by accident — explicit `{transport: 'in-memory'}` option in `GenesisLauncher`; grep gate asserts `rig.mjs` does not reference `httpServer.listen` / `wsHub`.
  - T-10-13 (CRITICAL): Rig CLI flag silently disables invariants — `scripts/check-rig-invariants.mjs` CI gate; rig output tarball manifest includes git SHA + exact CLI args + invariant-version hash.
  - T-10-14 (HIGH): Tarball non-deterministic due to spawn order — `tar --sort=name` + clamped mtime + zero uid/gid (reproducible-builds.org conventions); same seed + args → same `sha256sum`.
  - T-10-15 (HIGH): 10k-tick run reveals producer-boundary perf cliff — `Set.has()` (already frozen) not array scans; producer-boundary benchmark in nightly CI.
  - T-10-16 (CRITICAL): Published dataset inadvertently leaks plaintext Telos — rig output has two modes (`--audit-only` default, `--full-state` with verbatim-copy-locked consent prompt); default output scanned by `grep -rE "telos_text|goal_description|memory_text"` returns zero matches.
**Allowlist additions**: **0** (on production allowlist — Rigs run their own isolated chain). Note: `chronos.rig_closed` exists on the Rig's own chain but is explicitly NOT added to `grid/src/audit/broadcast-allowlist.ts`. Running total: **27**.
**Plans**: TBD

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
| 11. Mesh Whisper | 0/? | Not started | - |
| 12. Governance & Collective Law | 0/? | Not started | - |
| 13. Operator Replay & Export | 0/? | Not started | - |
| 14. Researcher Rigs | 0/? | Not started | - |

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
| 14 | *(none on production allowlist — Rigs run isolated chain)* | — | 25 |

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

*Roadmap created: 2026-04-20 — v2.1 Steward Console opened*
*Updated: 2026-04-22 — Phase 10b shipped (8/8 plans, allowlist 19→21 with bios.birth+bios.death per D-10b-01); corrected total allowlist growth 18→27 (+9 events)*
