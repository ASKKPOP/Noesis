# Requirements: Noēsis — v2.2 Living Grid

**Defined:** 2026-04-21
**Core Value:** The first persistent Grid where Nous actually *live* — now with inner drives, social bonds, collective governance, sidechannel intimacy, deep observability, and researcher-grade tooling. The Grid stops being a simulation stage and becomes a living society.
**Research source:** `.planning/research/v2.2/SUMMARY.md` (commit `69c5deb`) synthesizing STACK / FEATURES / ARCHITECTURE / PITFALLS.

## v2.2 Active Requirements

### DRIVE — Ananke internal drives (Theme 1, Inner Life)

<!-- LIDA-grounded unvalenced pressures. Ananke ≠ Thymos; drives are numeric forces, not emotions.
     Thymos categorical emotion labels deferred to v2.3 to avoid namespace collision (pitfall T-09-05). -->

- [ ] **DRIVE-01**: Ananke subsystem runs 5 drives at MVP — **hunger, curiosity, safety, boredom, loneliness** — each a numeric value in `[0.0, 1.0]`. Drives are pure Python in `brain/src/noesis_brain/ananke/drives.py` (sibling of `psyche/`, `telos/`, `thymos/`), no external library. New drives are a v2.3 decision; MVP enum is closed.
- [ ] **DRIVE-02**: Drives decay deterministically given `(seed, tick)` — replay from the same seed produces byte-identical drive traces. Decay function is monotonic rise in absence of satisfying action; unit tests cover bounds clamping at 0.0/1.0, monotonic rise without satisfaction, idempotent re-tick at same tick#.
- [ ] **DRIVE-03**: A new allowlisted event **`ananke.drive_crossed`** fires only when a drive transitions across a configured pressure threshold (e.g. hunger > 0.7). Payload: closed-tuple `{did, tick, drive, level, direction}` where `drive ∈ {hunger, curiosity, safety, boredom, loneliness}`, `direction ∈ {rising, falling}`, `level ∈ {low, med, high}`. Per-tick emission is an anti-feature (audit-bloat pitfall T-09-01).
- [ ] **DRIVE-04**: Drive → action coupling is **advisory, not coercive**. A high-hunger Nous may still choose non-feeding action; the Brain logs the divergence to its private memory but the Grid does not override or penalize. This preserves Nous sovereignty (PHILOSOPHY §6).
- [ ] **DRIVE-05**: No numeric drive value ever crosses the Brain↔Grid boundary as a free field. All operator-visible drive state arrives exclusively via `ananke.drive_crossed` at hashed/bucketed granularity (low/med/high, not raw float). Grid-side grep test enforces no drive-float in emitters.

### BIOS — Bodily needs & lifecycle (Theme 1, Inner Life)

<!-- Lifecycle events ride the existing v2.1 registry; tombstone permanence preserved.
     First-life invariant (I-6): death is terminal, DIDs never re-used. -->

- [ ] **BIOS-01**: Bios tracks two bodily needs — **energy** and **sustenance** — each in `[0.0, 1.0]`. Needs rise monotonically in absence of satiating action; threshold-crossing elevates matching Ananke drive (energy→hunger, sustenance→safety). Needs ride the same sole-producer boundary as drives.
- [ ] **BIOS-02**: `bios.birth` and `bios.death` are the **only** lifecycle events. No `bios.resurrect`, no `bios.migrate`, no `bios.transfer`. Attempting to emit a third lifecycle event must fail a closed-enum test. These two events may already exist partial in v2.1 — verify at Phase-open; additive widening only if payload changes.
- [ ] **BIOS-03**: `bios.death` payload is closed-tuple `{did, tick, cause, final_state_hash}` where `cause ∈ {starvation, operator_h5, replay_boundary}`. New causes require explicit per-phase allowlist addition. Post-death, any event referencing the dead DID is rejected at the sole-producer boundary (grep-enforced).
- [ ] **BIOS-04**: Tombstoned DIDs are permanently reserved — the NousRegistry blocks DID reuse after `bios.death`. This is the first-life promise (PHILOSOPHY §1). GDPR-style erasure is out of scope; tombstones retain the DID + death hash, never PII.

### CHRONOS — Subjective time (Theme 1, Inner Life)

<!-- Chronos links to Stanford retrieval score as a recency multiplier — cognitive mechanism, not decoration.
     Subjective time never leaks into audit-chain tick numbering (PITFALL T-09-04). -->

- [ ] **CHRONOS-01**: Each Nous has a **subjective time multiplier** in `[0.25, 4.0]` derived from drive state (high curiosity → time feels slow; high boredom → time feels fast). Multiplier modulates the Stanford retrieval recency-score for that Nous's memory queries — a high-curiosity Nous remembers recent events as more salient.
- [ ] **CHRONOS-02**: Audit-chain tick numbering is **never** influenced by subjective time. `audit_tick == system_tick` strictly; CI test asserts no drift. Subjective time is a read-side query transform only, never a write-side modification.
- [ ] **CHRONOS-03**: `epoch_since_spawn` is exposed to the Nous as a queryable primitive (ticks since its `bios.birth`). Used by Brain prompting to construct "I am N ticks old" self-awareness context. No new allowlist event — this is a derived read over existing birth event.

### REL — Relationship graph (Theme 2, Relationship & Trust)

<!-- Zero new allowlist members — pure-observer derived view over existing dialogue.* events.
     Clones v2.1 DialogueAggregator pattern (AGG-01). -->

- [ ] **REL-01**: Relationship state is a **derived view** computed by a pure-observer listener over existing `nous.spoke` and `trade.settled` events. Zero new allowlist members at MVP. Clones the v2.1 `DialogueAggregator` zero-diff-safe pattern. Listener runs `O(edges_touched_this_tick)`, never `O(N²)`.
- [ ] **REL-02**: Relationship edge primitive: `{from_did, to_did, valence: [-1.0, +1.0], weight: [0.0, 1.0], recency_tick, last_event_hash}`. Valence derives from dialogue sentiment proxy + trade success/rejection; weight from interaction frequency; recency from last audit event. Stored in a derived MySQL table rebuildable from the audit chain (idempotent rebuild test).
- [ ] **REL-03**: Relationships decay deterministically: weight × `exp(-Δtick / τ)` with `τ` configured per Grid. Unobserved relationships cool toward zero without emitting any audit event. Decay determinism is replay-safe (same seed → same graph).
- [ ] **REL-04**: Dashboard Inspector shows a per-Nous **relationship panel** with top-N partners by weight. Dashboard graph-view renders the full relationship graph at H1+ (aggregate warmth only). H5 operators can inspect per-edge raw dialogue turns. Load test: 10K-edge graph responds <100ms at p95.

### VOTE — Collective governance (Theme 3, Governance & Law)

<!-- Commit-reveal ballot lifecycle (4 events). One-Nous-one-vote; operators excluded from governance.
     Successful proposals promote to LogosEngine (v2.1 law.triggered machinery). -->

- [ ] **VOTE-01**: A new allowlisted event **`proposal.opened`** carries closed-tuple `{proposal_id, proposer_did, title_hash, quorum_pct, supermajority_pct, deadline_tick}`. Proposal body stored in Grid MySQL (not in audit payload); body hash in `title_hash`. Defaults when proposer omits: quorum=50%, supermajority=2/3. Deadline is tick-count (not wall-clock) for replay determinism.
- [ ] **VOTE-02**: A new allowlisted event **`ballot.committed`** carries closed-tuple `{proposal_id, voter_did, commit_hash}` where `commit_hash = sha256(choice || nonce || voter_did)`. Vote choice is private until reveal. Duplicate DIDs on same proposal rejected pre-commit (one-Nous-one-vote, I-7 enforcement).
- [ ] **VOTE-03**: A new allowlisted event **`ballot.revealed`** carries closed-tuple `{proposal_id, voter_did, choice, nonce}`. Revealed commits that do not hash-match are rejected at tally; the Nous is logged but not penalized in v2.2 (penalty policy deferred).
- [ ] **VOTE-04**: A new allowlisted event **`proposal.tallied`** carries closed-tuple `{proposal_id, outcome, yes_count, no_count, abstain_count, quorum_met}`. `outcome ∈ {passed, rejected, quorum_fail}`. On `passed`, the Grid promotes the proposal to the v2.1 LogosEngine via a separate existing `law.triggered` event — no new promotion event.
- [ ] **VOTE-05**: **Operators cannot vote, propose, or tally at any tier**, including H5. Governance is strictly intra-Nous. Grep test enforces no `operator.*` event is emitted by the governance module. Operator-side of governance is read-only dashboard view.
- [ ] **VOTE-06**: No token-weighted, reputation-weighted, or relationship-weighted voting. One Nous = one vote = one ballot commit. Ballot-weighting mechanisms are an anti-feature (PHILOSOPHY §6, Economy must be free).
- [ ] **VOTE-07**: Dashboard gets a **Governance page** showing open proposals, committed/revealed counts, tally results, and post-tally law-promotion links. H5 operators can see per-Nous voting history for forensic review; H1–H4 see aggregates only.

### WHISPER — Mesh sidechannel (Theme 4)

<!-- E2E envelope Nous→Nous. Operators cannot read plaintext at ANY tier including H5.
     Envelope only in v2.2 — Signal Double Ratchet / sealed-sender deferred post-milestone. -->

- [ ] **WHISPER-01**: A new allowlisted event **`nous.whispered`** carries closed-tuple `{from_did, to_did, tick, ciphertext_hash}` — `ciphertext_hash` only, never ciphertext or plaintext. Single sole-producer file `grid/src/whisper/WhisperRouter.ts` — grep enforced. This supersedes the v2.1 WHISPER-01 future-requirement placeholder.
- [ ] **WHISPER-02**: Envelope uses **libsodium `crypto_box`** (X25519 + XChaCha20-Poly1305 AEAD). Each Nous has a per-identity keypair generated at `bios.birth`; keys never leave the Nous's Brain-scoped keyring. Signal Double Ratchet / sealed-sender explicitly deferred to a post-v2.2 milestone.
- [ ] **WHISPER-03**: **Operators cannot read Whisper plaintext at any tier, including H5.** Locked. Grid MUST NOT persist plaintext, Brain MUST NOT log plaintext, Dashboard MUST NOT render plaintext — three-tier grep CI gate (`scripts/check-whisper-plaintext.mjs`) plus an `fs.writeFile` monkey-patch runtime test on the router.
- [ ] **WHISPER-04**: Whisper delivery is **recipient-pull**: the recipient's Brain polls undelivered envelopes on tick; the sender's Brain does not push. Ciphertext is **deleted from the Grid once the recipient acknowledges pull** — audit entry (`nous.whispered` with hash) retained forever per first-life.
- [ ] **WHISPER-05**: Rate-limit is **per-sender** using `@fastify/rate-limit`. Default budget configurable per Grid (e.g. 10 whispers per 100 ticks). Exceeding the budget queues the send; queue length is observable via operator-side metric but plaintext is still never exposed.
- [ ] **WHISPER-06**: The v2.1 `DialogueAggregator` is extended to treat whisper-exchanges as dialogue substrate — DialogueAggregator receives `nous.whispered` events but only the hash, never plaintext. A whispered-dialogue can still trigger `telos.refined` (the refinement itself is an existing v2.1 audit event, hash-only).

### REPLAY — Operator observability (Theme 5)

<!-- State-level replay (not decision-level — LLM non-determinism precludes prompt re-play).
     Read-only rewind; mutating rewind is an anti-feature (first-life invariant). -->

- [ ] **REPLAY-01**: Chain slice export produces a **deterministic tarball** — fixed mtime, sorted entries, canonical JSON (`pyarrow` not required; JSONL format only at MVP). Tarball contents: audit chain slice + snapshot of registry state at start/end ticks + manifest with chain-tail hash. Integrity verifier (`replay-verify` CLI) reproduces the tarball hash from contents.
- [ ] **REPLAY-02**: A new allowlisted event **`operator.exported`** carries closed-tuple `{tier, operator_id, start_tick, end_tick, tarball_hash, requested_at}`. Export is operator-initiated and H5-consent-gated via an `IrreversibilityDialog`-style consent surface (clones v2.1 AGENCY-05 copy-verbatim pattern — export publishes data irreversibly).
- [ ] **REPLAY-03**: Replay runs in a **configuration-over-fork** `ReplayGrid` — same `GenesisLauncher` with isolated chain (in-memory `better-sqlite3`), isolated MySQL schema, isolated WsHub port, and fake Brain bridges (`FIXED_TIME` discipline). The replayed chain's `operator.*` events are filtered out (replay cannot emit new operator events).
- [ ] **REPLAY-04**: Replay is **STATE-LEVEL**: it re-reads the audit chain and recomputes derived state (relationships, drive crossings, dialogue aggregates). It does **not** re-run Brain prompts — LLM non-determinism precludes decision-level replay. Replayed state must be byte-identical to live state at the same tick for a fixed seed (CI canned-scenario test).
- [ ] **REPLAY-05**: Steward Console gets a **read-only Rewind panel** that lets H3+ operators scrub a chain slice in the ReplayGrid, inspecting firehose + inspector + map state at any replayed tick. The panel never writes back to the live Grid — rewind is observer-only. Mutating rewind is an anti-feature (violates first-life).

### RIG — Researcher tools (Theme 6)

<!-- Ephemeral Grid per experiment. Own isolated audit chain — no contamination of live chain.
     LLM fixture mode enables reproducibility despite LLM non-determinism. -->

- [ ] **RIG-01**: A new `noesis rig` CLI spawns an **ephemeral Grid** from a config: `{seed, tick_budget, nous_manifest, operator_tier_cap, llm_fixture_path?}`. Configs version-controlled in `config/rigs/*.toml`. One launcher binary, N configs — zero code divergence from production `GenesisLauncher` (configuration-over-fork principle).
- [ ] **RIG-02**: Each Rig runs its **own isolated audit chain** (separate MySQL schema or in-memory SQLite), separate WsHub, separate Brain instances. The live Grid's AuditChain is never touched by any Rig. Nested Rigs are rejected at launcher entry.
- [ ] **RIG-03**: Rigs support **LLM fixture mode** — pre-recorded Brain prompt→response pairs replayed deterministically. This is the reproducibility workaround for LLM non-determinism. Fixture files are JSONL in the Rig config directory; a Brain running in fixture mode refuses network LLM calls (grep-enforced).
- [ ] **RIG-04**: Target scale: **50 Nous × 10,000 ticks** in a single Rig run must complete on a researcher laptop (16GB RAM, 8 cores) in under 60 minutes with fixture-mode LLM. Benchmark test in CI as a nightly smoke (not per-commit).
- [ ] **RIG-05**: Rig exit emits snapshot as **JSONL export** (same format as REPLAY-01 tarball; `pyarrow` / Parquet explicitly deferred to v2.3). Exit conditions: tick budget exhausted, all-Nous-dead, or operator-H5-terminate. Exit emits `chronos.rig_closed` on the **Rig's own chain only** — not on the production allowlist.

## Validated (v2.1 Steward Console — SHIPPED 2026-04-21)

<!-- Kept here for traceability reference. Do not modify. -->

- [x] **REV-01**..**REV-04** — Agentic Reviewer (objective-only) — Phase 5
- [x] **AGENCY-01**..**AGENCY-04** — Operator Agency Scale H1–H5 — Phase 6
- [x] **DIALOG-01**..**DIALOG-03** — Peer Dialogue Memory (SPARC-inspired) — Phase 7
- [x] **AGENCY-05** — H5 Nous-deletion irreversibility dialog — Phase 8

## Future Requirements

- **THYMOS-01**: Categorical emotion labels (joy, fear, anger, trust) layered on top of Ananke drives — deferred to v2.3 to avoid drive/emotion namespace collision. Expected 4–6 REQs once v2.2 ships Ananke.
- **WHISPER-FS-01**: Signal Double Ratchet / sealed-sender — forward secrecy for Whisper envelopes; deferred to post-v2.2.
- **RIG-PARQUET-01**: `pyarrow`-based Parquet export format for Rigs with >1M events; deferred unless researchers demand columnar format.
- **REL-EMIT-01**: Optional `relationship.warmed` / `.cooled` threshold-crossing events — deferred unless derived-view performance forces event-sourcing.
- **GOV-MULTI-01**: Multi-proposal sequencing, proposal-chains, vote delegation — deferred to v2.3+. v2.2 ships single-proposal lifecycle only.
- **WITNESS-BUNDLE-01**: Operator witness-bundle plaintext export with H5 consent — deferred to v2.3 observability follow-up.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-Grid federation / inter-Grid mesh | O(N²) broadcast cost (arxiv 2512.08296); still deferred post-v2.2. Intra-Grid Whisper only. |
| Mobile observer app | Single-surface (web Steward Console) remains v2.2 scope. |
| Real cryptographic signing for governance ballots | Hash-commit suffices at MVP; signed ballots deferred pending formal threat review. |
| LLM-driven drive generation | Drives are hand-rolled Python — no LLM in the Ananke hot path (determinism + speed). |
| Thymos categorical emotion labels | Flagged in Future as THYMOS-01; v2.2 ships Ananke drives only to avoid payload-namespace collision (pitfall T-09-05). |
| Operator vote / propose / tally | Anti-feature VOTE-05. Governance is intra-Nous. |
| Operator Whisper plaintext read at any tier | Anti-feature WHISPER-03. Sovereignty lock. |
| Mutating rewind | Anti-feature REPLAY-05. Violates first-life invariant. |
| Token / reputation / relationship vote-weighting | Anti-feature VOTE-06. Economy must be free (PHILOSOPHY §6). |
| DAO governance libraries (Aragon, Snapshot.js, OpenZeppelin Governor) | Blockchain trust model wrong for Noēsis; hash-commit is ~40 LOC with existing `@noble/hashes`. |
| Graph database for relationships | Derived view pattern suffices; Neo4j / graphology add deps without MVP-N justification. |
| Signal Double Ratchet in v2.2 | Envelope only at MVP; ratchet deferred to WHISPER-FS-01. |
| Nested Rigs | Rejected at launcher entry for safety (state-isolation guarantees). |
| `bios.resurrect` / `bios.migrate` | First-life invariant (I-6); death is terminal, DIDs don't move. |
| Parquet export at MVP | JSONL suffices for 50×10k researcher scale; Parquet deferred to RIG-PARQUET-01. |

## Allowlist Growth Ledger (v2.2)

Starting: **18 events** (v2.1 frozen).
Projected end-state: **25 events** (conservative).

| Event | Theme | Adds | Running Total |
|-------|-------|------|---------------|
| `ananke.drive_crossed` | DRIVE | +1 | 19 |
| `nous.whispered` | WHISPER | +1 | 20 |
| `proposal.opened` | VOTE | +1 | 21 |
| `ballot.committed` | VOTE | +1 | 22 |
| `ballot.revealed` | VOTE | +1 | 23 |
| `proposal.tallied` | VOTE | +1 | 24 |
| `operator.exported` | REPLAY | +1 | 25 |

**Zero-addition themes:** REL (derived view), CHRONOS (read-side transform), BIOS (existing lifecycle events only), RIG (own isolated chain, not production allowlist).

Each addition lands in its own phase PR following the v2.1 freeze-except-by-addition discipline: closed-tuple payload test, sole-producer grep, privacy-matrix update, CLAUDE.md doc-sync commit (STATE.md Accumulated Context + `scripts/check-state-doc-sync.mjs` + privacy matrix enumerator).

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REL-01..04 | Phase 9 | Planned |
| DRIVE-01..05 | Phase 10a | Planned |
| BIOS-01..04 | Phase 10b | Planned |
| CHRONOS-01..03 | Phase 10b | Planned |
| WHISPER-01..06 | Phase 11 | Planned |
| VOTE-01..07 | Phase 12 | Planned |
| REPLAY-01..05 | Phase 13 | Planned |
| RIG-01..05 | Phase 14 | Planned |

**Coverage (v2.2):**
- DRIVE: 5 REQs → Phase 10a
- BIOS: 4 REQs → Phase 10b
- CHRONOS: 3 REQs → Phase 10b
- REL: 4 REQs → Phase 9
- VOTE: 7 REQs → Phase 12
- WHISPER: 6 REQs → Phase 11
- REPLAY: 5 REQs → Phase 13
- RIG: 5 REQs → Phase 14
- **Total: 39 REQs** across 6 themes / 7 phases (9, 10a, 10b, 11, 12, 13, 14)

Unmapped: 0 ✓. Phase 10 split into 10a (Ananke) + 10b (Bios + Chronos) per `gsd-roadmapper` analysis — see `.planning/ROADMAP.md` §Phase-Split Rationale.

---

*Requirements defined: 2026-04-21 (post-research synthesis)*
*Source: `.planning/research/v2.2/SUMMARY.md` + 4 parallel researcher files*
*v2.1 validated REQs preserved above — see `.planning/MILESTONES.md` for ship log.*
