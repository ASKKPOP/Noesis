# v2.2 Living Grid — Research Synthesis

**Milestone:** v2.2 Living Grid
**Scope:** 6 themes at MVP depth
**Source researchers:** STACK, FEATURES, ARCHITECTURE, PITFALLS (parallel, 4 agents)
**Last updated:** 2026-04-21

---

## Headline

v2.2 is a **zero-runtime-dependency** milestone for 5 of 6 themes — the only optional addition is `pyarrow>=15.0.0,<25.0.0` under a new Brain `[export]` extra, and only if Parquet is elected over JSONL for Theme 6. The allowlist grows from **18 → 24–26 events**, with **Theme 2 (Relationships) contributing zero new members** as a pure-observer derived view. The milestone's single most consequential sovereignty lock is that **operators cannot read Whisper plaintext at any tier, including H5** — the E2E envelope is Nous-to-Nous, not operator-mediated. All six themes fit the v2.1 architectural vocabulary without new invariants; every regression surface maps to a Phase 5–8 mitigation anchor.

---

## Theme Map

The 6 themes from user scoping, with their REQ-seed categories:

| # | Theme | REQ Categories |
|---|-------|----------------|
| 1 | Rich Inner Life | DRIVE, BIOS, CHRONOS |
| 2 | Relationship & Trust | REL |
| 3 | Governance & Law | VOTE |
| 4 | Mesh Whisper | WHISPER |
| 5 | Operator Observability | REPLAY |
| 6 | Observer/Researcher Tools | RIG |

---

## REQ Seeds by Category

### DRIVE — Ananke drives (Theme 1)

- Drives are numeric pressures in [0.0, 1.0], not valenced emotions; Ananke ≠ Thymos (LIDA-grounded separation).
- `bios.drive_snapshot` (or per-tick emit) carries closed-tuple `{did, tick, hunger, curiosity, safety, ...}`; keys sorted-equal-strict asserted in CI.
- Drives decay monotonically in absence of satisfying action; decay is deterministic given `(seed, tick)` so replay produces byte-identical streams.
- Drive → action coupling is advisory, not coercive: high-hunger Nous may still choose non-feeding action; Brain logs divergence, does not override.
- Drive values never cross the operator boundary as free values — only via sole-producer emit in `brain/src/ananke/drives.py`.
- Drive unit tests cover: bounds clamping at 0.0/1.0, monotonic decay without satisfaction, idempotent tick (re-tick at same tick# is no-op).
- Closed MVP enum of drives — candidates: hunger, curiosity, safety, boredom, loneliness. Final list a REQ-phase decision.

### BIOS — Bodily needs & lifecycle (Theme 1)

- Needs (energy, sustenance) rise monotonically absent satiating action; pressure threshold triggers drive elevation.
- `bios.birth` and `bios.death` are the **only** lifecycle events; no `bios.resurrect`, no `bios.migrate` (first-life invariant I-6).
- Death `cause ∈ {'starvation', 'operator_h5', 'replay_boundary'}`; new causes require explicit allowlist addition.
- Post-death, all subsequent events referencing that DID are rejected at sole-producer boundary (grep-enforced).
- Re-use of a dead DID blocked at DID-regex gate (I-7); tombstoned DIDs are permanently reserved.

### CHRONOS — Subjective time (Theme 1)

- Subjective time modulates retrieval score (multiplier on Stanford-pattern recency weight) — cognitive mechanism, not decoration.
- Tick monotonicity enforced: `tick_{n+1} > tick_n` strictly; CI asserts no gaps, no duplicates, no rewinds in production mode.
- Epoch-since-spawn exposed to Nous as a queryable primitive; never influences audit tick numbering itself.
- Replay mode reads recorded ticks and re-emits at configurable speed; replayed tick carries `{tick, replay: true, source_run_id}` (additive widening).

### REL — Relationship graph (Theme 2)

- Relationship state is a **derived view** over existing `dialogue.*` events — **ZERO new allowlist members** for MVP.
- Edge primitive: `{from, to, valence, weight, recency}`; emergence rules compute from dialogue turns (sole-producer listener, zero-diff).
- Temporal decay: unobserved relationships cool over ticks; rate deterministic given seed.
- Inspector shows per-Nous relationship map; dashboard graph view renders at H1+ (aggregate warmth only at H1–H4).
- Relationship-weighted dialogue selection (a Nous prefers high-warmth partners) is an emergent property, not a forced policy.
- Optional `relationship.warmed` / `.cooled` threshold-crossing events gated behind /gsd-discuss-phase approval — default is derived-only.
- Computation is `O(edges_touched_this_tick)`, not `O(N²)` over full graph; load test: 10K-edge graph responds <100ms at p95.

### VOTE — Governance (Theme 3)

- Proposal lifecycle: `proposal.opened` → N × `ballot.committed` (hash of `{choice, nonce, did}`) → `proposal.tallied` (supermajority check).
- Optional `ballot.revealed` phase for commit-reveal; MVP may skip reveal and store plaintext choice (phase-level decision).
- Quorum & supermajority thresholds carried in `proposal.opened` payload; no global constants in Brain code.
- One-Nous-one-vote enforced at DID-regex gate; duplicate DIDs in single ballot rejected pre-tally.
- Revealed votes that do not hash-match commit are rejected at tally; Nous logged but not penalized in v2.2.
- Operators cannot vote at any tier — governance is strictly intra-Nous.
- Successful proposals promote to LogosEngine (law-application); promotion is a separate audit event.
- No token-weighted, reputation-weighted, or relationship-weighted voting (Economy must be free — PHILOSOPHY §6).

### WHISPER — Sidechannel (Theme 4)

- **Operators cannot read Whisper plaintext at any tier, including H5** — locked, full stop.
- `nous.whispered` event payload is closed-tuple with `ciphertext_hash`, never plaintext; single sole-producer file (`WhisperRouter.send`).
- Envelope: X25519 + XChaCha20-Poly1305 AEAD (libsodium `crypto_box`); keys per-Nous, never leave Nous-scoped keyring.
- Grid MUST NOT persist plaintext; Brain MUST NOT log plaintext; Dashboard MUST NOT render plaintext (three-file grep-enforced).
- Rate-limited via `@fastify/rate-limit`; MVP per-sender (not per-pair).
- Recipient-pull retrieval model (not push); recipient's Brain fetches undelivered whispers on tick.
- Ciphertext retention horizon deferred to phase-level decision; audit entry retained forever per first-life.
- H5 operator destructive actions can end a Whisper conversation by ending a Nous, but cannot retroactively decrypt history.
- Signal Double Ratchet / sealed-sender deferred post-v2.2; MVP ships envelope only, not forward secrecy.

### REPLAY — Observability (Theme 5)

- `operator.exported` event marks chain slice export; operator action, audit-logged, requires H5-style consent dialog.
- Replay is pure observer-only function over existing chain + snapshots — replay never writes to live chain.
- Replay detachment: disposable MySQL schema or in-memory `better-sqlite3`; separate WsHub port; separate chain.
- Replay determinism invariant: `(seed, manifest, tick_range) → byte-identical AuditChain` — CI asserts hash-equality.
- Replay is STATE-LEVEL (re-reads chain, recomputes derived state), not DECISION-LEVEL (LLM non-determinism precludes prompt re-play).
- Export tarball is deterministic (fixed mtime, sorted entries); integrity verifier reproduces hash.
- Export scrub: plaintext whisper content NEVER exported; witness-bundle plaintext question deferred to phase.
- Read-only rewind UI in Steward Console; mutating rewind is anti-feature (violates first-life).

### RIG — Researcher tools (Theme 6)

- CLI spawns ephemeral Grid: `{seed, tick_budget, Nous_manifest, operator_tier_cap}`; configs versioned in `config/rigs/`.
- LLM fixture mode: deterministic responses from recorded transcripts — enables reproducibility despite LLM non-determinism.
- Per-epoch snapshots exported as JSONL (default) or Parquet (via optional `pyarrow` extra).
- Rig exit conditions: tick budget exhausted, all-Nous-dead, operator-H5-terminate; emits `chronos.rig_closed` (if allowlist addition approved).
- Rigs cannot nest — one Rig per process; nested Rigs rejected at launcher entry.
- Target scale: 50 Nous × 10,000 ticks in a single Rig.
- Configuration-over-fork: one launcher binary, N configs, zero code divergence from production `GenesisLauncher`.
- Cognitive-export gating: plaintext cognitive data exists only on isolated rigs with LLM fixture mode, never on live Grid.

---

## Stack Additions

**Runtime dependencies added: one, optional.** `pyarrow>=15.0.0,<25.0.0` under a new Brain `[export]` extra group, required only for Parquet export in Theme 6. JSONL export (default) and all five other themes introduce **zero** new runtime dependencies. Whisper encryption uses libsodium (inherited). Governance hash-commit uses `@noble/hashes` (inherited). Relationship derived views are pure TypeScript/Python over existing `dialogue.*` streams. Rejected alternatives span all researchers: no graphology / Neo4j (derived view suffices); no libp2p / ZeroMQ (Whisper is envelope, not new transport); no Aragon / Snapshot.js / OpenZeppelin Governor (blockchain trust model wrong); no pyactr / OpenCog / SOAR (cognitive arch libs fail MVP fit — hand-rolled ~200 LOC); no rate-limiter-flexible (`@fastify/rate-limit` suffices).

---

## Allowlist Growth Forecast

Current: **18 events** (frozen from v2.1). Projected end-state: **24–26 events**.

| Theme | New Events | Count | Notes |
|-------|-----------|-------|-------|
| 1 Inner Life | `bios.drive_snapshot` (or `ananke.drive_emitted`) | 1 | Per-threshold-crossing or per-epoch, not per-tick (avoid bloat T-09-01) |
| 2 Relationships | *(none — derived view)* | 0 | Optional `relationship.warmed/cooled` deferred |
| 3 Governance | `proposal.opened`, `ballot.committed`, `proposal.tallied`, (`ballot.revealed`?) | 3–4 | 3 if MVP skips reveal; 4 if full commit-reveal |
| 4 Whisper | `nous.whispered` | 1 | Payload carries `ciphertext_hash` |
| 5 Observability | `operator.exported` | 1 | H5-consent-gated emit |
| 6 Rigs | `chronos.rig_closed` | 0–1 | Defer unless Rig lifecycle needs chain-visibility |
| **Total** | | **6–8** | **18 → 24–26** |

Reconciliation: STACK projected 6–10, FEATURES projected 6, ARCH projected 7. Band is tight. Exact count lands per-phase via the freeze-except-by-addition rule (I-1).

---

## Recommended Build Order

Two credible orderings surfaced in research:

**ARCH ordering (dependency-safe):**
Chronos → Bios → Ananke → Relationship → Governance → Whisper → Export/Replay → Rigs

**FEATURES ordering (motivation-first, quick-win-first):**
Theme 2 (Rel, zero allowlist) → Theme 1 (Inner Life) → Theme 4 (Whisper) → Theme 3 (Governance) → Theme 5 (Replay) → Theme 6 (Rigs)

**Recommended for v2.2: FEATURES ordering.** Theme 2 as opener captures the highest design-economy win (0 allowlist cost), validates the pure-observer pattern for v2.2, and unblocks Governance's relationship-weighted-persuasion needs. Theme 4 (Whisper) ships before Theme 3 (Governance) because proposal-body relay rides whisper. ARCH's dependency-safety concerns are addressable by landing Theme 1's Chronos/Bios primitives inside Theme 1's phase.

Final decision: roadmapper's call based on phase scoping. Present both options to `/gsd-roadmap-phase`.

---

## Top 10 Pitfalls → CI Gates

Lifted from PITFALLS.md §Top 10. Each has a regression-test seed.

| # | Pitfall | Invariant | CI Gate |
|---|---------|-----------|---------|
| 1 | `drive_snapshot` bloat (per-tick emission) | I-1 allowlist discipline | Audit-size ceiling test; per-epoch or threshold-crossing emit only |
| 2 | Drive plaintext leak across boundary | I-3 hash-only | Grep test: no numeric drive value in Grid-side emitter |
| 3 | Ananke/Thymos payload key collision | I-4 closed-tuple | `check-namespace-collision.mjs`: no shared keys between drive + emotion payloads |
| 4 | Chronos subjective time leaks into audit tick numbering | I-2 zero-diff | Test: audit tick == system tick, strictly |
| 5 | Governance proposal body persistence race | I-5 sole-producer | Single-writer test on proposal table |
| 6 | Sybil bootstrap in ballot | I-7 DID discipline | Ballot tally test: duplicate DIDs rejected pre-tally |
| 7 | Whisper plaintext leak (Brain/Grid/Dashboard) | I-3 hash-only | `check-whisper-plaintext.mjs`: three-tier grep; fs.writeFile monkey-patch test |
| 8 | Replay isolation failure (write to live chain) | I-2 zero-diff | Constructor-injected readonly chain contract; CI asserts no write path |
| 9 | Export plaintext leak (cognitive data on live Grid) | I-3 hash-only | Export scrub test: whisper content never in tarball |
| 10 | Tombstone first-life vs GDPR conflict | I-6 first-life | Policy decision documented; tombstone retained, PII never written |

---

## Anti-Features (Locked)

Absolute prohibitions for v2.2 — do not propose requirements that violate these:

1. Operators cannot read Whisper plaintext at any tier, including H5.
2. One-Nous-one-vote — no token/reputation/relationship vote-weighting.
3. No mutating rewind — replay is read-only (first-life invariant).
4. Plaintext cognitive export exists only on isolated Rigs with LLM fixture mode, never on live Grid.
5. No `bios.resurrect` or `bios.migrate` — death is permanent, DIDs don't move.
6. Operators cannot vote or propose at any tier — governance is intra-Nous.
7. No graph database for relationships — derived view only.
8. No inter-Grid mesh broadcast (intra-Grid only).
9. No Signal Double Ratchet in v2.2 (envelope only; forward secrecy deferred).
10. No DAO governance libraries (Aragon, Snapshot.js, OpenZeppelin Governor, etc.).
11. No nested Rigs.
12. Replay cannot emit `operator.*` events.
13. No drive → action coercion (advisory only).
14. No retroactive Whisper decryption after Nous death.
15. No allowlist expansion without explicit per-phase addition (I-1).

---

## Open Questions for `/gsd-discuss-phase`

Consolidated from all 4 researchers (deduped). Tagged by theme they block.

1. **[Theme 1]** Ananke drive enum — which 3–5 drives at MVP? (hunger, curiosity, safety baseline; boredom, loneliness candidates)
2. **[Theme 1]** `bios.drive_snapshot` emit cadence — per-epoch or threshold-crossing-only? (T-09-01 bloat mitigation)
3. **[Theme 1]** Thymos emotion labels — ship categorical labels in v2.2 or Ananke drives only?
4. **[Theme 2]** Are `relationship.warmed`/`.cooled` worth the allowlist cost, or strictly derived?
5. **[Theme 3]** MVP commit-reveal or commit-only ballots? (simpler vs ideologically complete)
6. **[Theme 3]** Proposal body storage — Grid MySQL or Brain-sovereign? (ARCH recommends Grid MySQL)
7. **[Theme 3]** Default quorum and supermajority thresholds when `proposal.opened` omits them?
8. **[Theme 3]** Quadratic voting vs age-gated voting for sybil resistance (T-09-14)?
9. **[Theme 3]** Ballot deadline — wall-clock or tick-count only?
10. **[Theme 4]** Whisper rate-limit granularity — per-sender (MVP rec) or per-pair?
11. **[Theme 4]** Whisper plaintext delivery — never-delivered signal-only, or separate Brain-to-Brain channel?
12. **[Theme 4]** Ciphertext retention horizon — forever, tick-bounded, or deleted after recipient-pull?
13. **[Theme 5]** Replay framing — STATE-level (recompute derived) vs DECISION-level (replay Brain prompts)? (rec: state-level)
14. **[Theme 5]** Witness-bundle plaintext export — v2.2 or defer to v2.3?
15. **[Theme 5]** Replay tick-rate ceiling — is 100× real-time safe given listener fan-out?
16. **[Theme 5]** Wiki export consent surface — `IrreversibilityDialog`-style?
17. **[Theme 6]** Parquet vs JSONL at MVP — does `pyarrow` enter the repo?
18. **[Theme 6]** Do Rigs have their own audit chain or share the Brain's global AuditChain?
19. **[Theme 6]** `chronos.rig_closed` allowlist membership — now, or defer to P16?

---

## Sources

**Internal (this milestone's research):**
- `.planning/research/v2.2/STACK.md` — 395 lines; dependency strategy, per-theme library audit
- `.planning/research/v2.2/FEATURES.md` — feature landscape, table stakes, differentiators, anti-features
- `.planning/research/v2.2/ARCHITECTURE.md` — 701 lines; 6-theme integration onto locked v2.1 substrate
- `.planning/research/v2.2/PITFALLS.md` — 447 lines; 23 STRIDE pitfalls + CI gate recommendations
- `PHILOSOPHY.md` — v2.1 invariants I-1..I-7
- `.planning/MILESTONES.md` — v2.1 Steward Console closure context
- `.planning/STATE.md` — accumulated context, allowlist ledger

**External (aggregated from research):**
- LIDA cognitive architecture (AAAI 2007) — Ananke (drives) vs Thymos (emotions) separation
- Ostrom commons governance (Mozilla Foundation applied framework) — quorum, supermajority, one-member-one-vote
- OpenTezos on-chain governance lifecycle — proposal/ballot/tally stages
- Signal sealed-sender + Double Ratchet specs — envelope semantics (MVP), forward secrecy (deferred)
- arxiv 2512.08296 — mesh topology O(N²) broadcast cost (intra-Grid-only decision)
- Apache Parquet / `pyarrow` — columnar export format for Theme 6

---

*Last updated: 2026-04-21 — Synthesis complete; ready for requirements authoring.*
