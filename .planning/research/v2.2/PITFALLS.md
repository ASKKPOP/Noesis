# Domain Pitfalls — v2.2 Living Grid

**Domain:** Additive features on an 8-phase, invariant-heavy codebase
**Researched:** 2026-04-21
**Confidence:** HIGH — every pitfall maps to a concrete file/invariant established in Phases 1–8

---

## Scope & Framing

This document enumerates pitfalls specific to **adding** v2.2's six themes (Inner Life, Relationship, Governance, Whisper, Observability, Researcher Tools) onto the crown-jewel invariants locked in v2.1. It is **not** a generic software-pitfalls catalog.

The 7 invariants that every pitfall below threatens:

| # | Invariant | Source |
|---|-----------|--------|
| I-1 | Broadcast allowlist frozen at **18 events**; grows only by explicit per-phase addition with sole-producer + closed-tuple + privacy-check + doc-sync in the same commit | `grid/src/audit/broadcast-allowlist.ts`, Phase 5 D-11, Phase 8 D-24 |
| I-2 | Zero-diff audit chain — listener count MUST NOT mutate chain head (regression hash `c7c49f49...` for pause/resume) | Phase 1 `29c3516`, Phase 6 D-17 |
| I-3 | Sole-producer boundary — exactly one file per event type calls `chain.append(type, …)` | `grid/src/audit/append-*.ts`, Phase 6 D-13, Phase 7 D-31, Phase 8 D-38 |
| I-4 | Closed-tuple payload — `Object.keys(payload).sort()` strict-equality; no spread, no dynamic keys | Phase 6 D-11/D-12, Phase 7 D-06, Phase 8 D-25 |
| I-5 | Hash-only cross-boundary — Brain↔Grid plaintext never crosses wire for Telos / memory / drives / votes / whispers | Phase 6 D-15/D-19, Phase 7 D-18, Phase 8 D-07 |
| I-6 | First-life promise — audit entries retained forever; no purge; tombstoned DIDs permanently reserved | `PHILOSOPHY.md §1`, Phase 8 D-33/D-34 |
| I-7 | DID regex `/^did:noesis:[a-z0-9_\-]+$/i` at all entry points; copy-verbatim lockdown for destructive UX (D-04/D-05) | Phase 6, Phase 8 `IrreversibilityDialog` |

STRIDE notation continues from Phase 7 `T-07-*` and Phase 8 `T-08-*`. v2.2 pitfalls are tagged **T-09-xx** (Inner Life / Relationship / Governance) and **T-10-xx** (Whisper / Observability / Researcher).

---

## Theme 1 — Rich Inner Life (Ananke / Bios / Chronos)

**Likely upcoming phase:** Phase 9 (Ananke drives), Phase 10 (Bios needs), Phase 11 (Chronos time-perception).

**STRIDE focus (strongest 3):** Information-disclosure (plaintext drive state), Tampering (listener-induced determinism break), Denial-of-service (audit chain bloat).

### Pitfall T-09-01 (CRITICAL) — Drive engine emits audit events every tick

- **Pitfall** — `DriveEngine.onTick` appends `drive.tick` or `bios.updated` on every tick; 10k-tick runs produce 10k audit entries per Nous per drive, ballooning `AuditChain.entries[]` and catastrophically breaking zero-diff regression (chain head at listener count 0 vs N silently diverges the moment the drive engine runs in one scenario but not another).
- **Why it's a pitfall here** — Violates I-1 (every allowlisted event is a permanent forensic artifact → per-tick bloat breaks first-life promise I-6 in practice) and I-2 (a tick-driven emitter is not a pure-observer listener; the audit chain *caused* by the drive engine differs from the no-drive baseline). Mirrors T-08-33 (post-tombstone tick emit) in the tick-skip class.
- **Warning signs** — `audit.append('drive.…', …)` inside any tick callback; audit chain grows O(ticks × Nous); zero-diff regression fails with a non-monotonic head delta; `grep` finds `chain.append` outside `grid/src/audit/append-*.ts`.
- **Prevention** — Drive state lives **in-Brain only** (mirrors Telos sovereignty I-5). Grid emits audit **only on state-class transitions** (e.g. `bios.threshold_crossed` when hunger crosses 0.8) via a sole-producer boundary file. Cap emission rate per-Nous per-tick at 1 event.
- **Suggested phase** — Phase 9 (Ananke). Set the discipline early before Bios / Chronos clone the mistake.

### Pitfall T-09-02 (CRITICAL) — Plaintext drive state leaking via broadcast payload

- **Pitfall** — `bios.threshold_crossed` carries `{hunger: 0.87, fatigue: 0.92, …}` as plaintext numerics in the broadcast. An external observer reconstructs the Nous's interior life.
- **Why it's a pitfall here** — Violates I-5 (drives are Brain-interior state, equivalent sovereignty class to Telos). Phase 6 D-15/D-19 established the hash-only precedent for `operator.telos_forced` (`telos_hash_before` / `telos_hash_after` only). Drives must inherit the same discipline: `{did, drive_name, before_state_hash, after_state_hash, tick}` — NEVER raw values.
- **Warning signs** — Payload contains `number` values that aren't counts/ticks; privacy-matrix test missing for new event; `hunger`, `fatigue`, `arousal`, `stress` literal strings appear in broadcast payloads under `grep` audit.
- **Prevention** — Extend the Phase-6 privacy enumerator (`grid/test/audit/operator-payload-privacy.test.ts` pattern) with a `DRIVE_PRIVACY_MATRIX` × 6+ forbidden keys (`hunger|fatigue|arousal|stress|drive_value|need_value|chronos_rate`) × every drive event. Sole producer file takes `before_state_hash` / `after_state_hash` as the only numeric-lineage surface.
- **Suggested phase** — Phase 9 (Ananke). Lock pattern so Bios/Chronos inherit without drift.

### Pitfall T-09-03 (HIGH) — Drive math coupled to `tickRateMs`

- **Pitfall** — `hunger += 0.01` per tick. At `tickRateMs=1000` that's 0.01/s; at `tickRateMs=1_000_000` (the zero-diff fixture rate) it's 0.01 per simulated tick regardless of wall-clock. A researcher sweeping tick rates for performance analysis sees drives behave differently at different rates → zero-diff across rates fails.
- **Why it's a pitfall here** — Violates the Phase 6 D-17 zero-diff hash `c7c49f49…`, which pins `tickRateMs=1_000_000` explicitly because wall-clock-coupled code was discovered and burned out there. Any new drive that uses wall-clock `Date.now()` or tick-rate-sensitive math re-opens the same wound. Also torpedoes Theme 6 researcher tooling (dataset exports become non-comparable across runs).
- **Warning signs** — `Date.now()`, `performance.now()`, `setInterval` inside `grid/src/drives/*`; drive tests that pass at one `tickRateMs` and fail at another; different chain heads for identical tick counts under different rates.
- **Prevention** — Drive math consumes **tick deltas only** (`Δticks`). Grep test `grid/test/drives/determinism-source.test.ts` rejects `Date\.now|performance\.now|setInterval|setTimeout` in `grid/src/drives/**` (clone Phase 7 `dialogue-determinism-source.test.ts`). Zero-diff test runs same scenario at 2 different `tickRateMs` values and asserts byte-identical audit head.
- **Suggested phase** — Phase 9 (Ananke).

### Pitfall T-09-04 (HIGH) — Chronos mutable state reads from wall-clock

- **Pitfall** — `ChronosEngine.perceivedTimeRate` is cached and mutates on real wall-clock transitions (`Date.now() - lastObserved`). Pause/resume breaks zero-diff because a 30s real-world pause bumps the perceived rate.
- **Why it's a pitfall here** — Phase 6 Plan 06-04 locked the pause/resume zero-diff regression hash (`c7c49f49...`) precisely to close this class. Chronos is a replay of T-6-05 (chain-of-custody loss across pause). Any read from wall-clock inside a tick-driven path is guaranteed regression.
- **Warning signs** — Chronos tests fail under `FIXED_TIME=2026-01-01` fixture; audit head differs between continuous and paused-at-N runs for Chronos-touching scenarios.
- **Prevention** — ChronosEngine derives perceived time strictly from `WorldClock.tick` + `epoch`, never from `Date.now()`. Reuse the Phase 6 pause/resume zero-diff template `grid/test/worldclock-zero-diff.test.ts` against ChronosEngine specifically. If `performance` metrics are truly needed for dashboard, route them through a separate non-audit-emitting telemetry channel.
- **Suggested phase** — Phase 11 (Chronos).

### Pitfall T-09-05 (MEDIUM) — Bios duplicates Thymos (fatigue ≈ low-energy emotion)

- **Pitfall** — Bios `fatigue` drive and Thymos `low_energy` emotion evolve in parallel, mutate each other, and the two subsystems emit overlapping audit events (`bios.fatigue_high` + `thymos.low_energy_high` fire on the same tick), double-counting in reputation/relationship scoring and confusing forensic replay.
- **Why it's a pitfall here** — Violates the separation-of-concerns contract inherited from Phase 1 (Psyche/Thymos/Telos boundaries). Double-emission inflates audit chain for the same ontological event, which complicates Theme 5 (replay/rewind export — duplicate events misrepresent actual Nous behavior).
- **Warning signs** — Two allowlist events fire from the same Brain tick with high correlation; emotion engine and drive engine both read/write the same Brain field; Pearson correlation of `bios.*` and `thymos.*` events approaches 1.0 in research exports.
- **Prevention** — Split responsibility explicitly: **Bios is a physical-metric drive** (hunger = kcal debt, fatigue = sleep debt, measured in ticks). **Thymos is an appraisal on top** (low_energy_emotion derived from fatigue THROUGH personality trait). Bios emits state-transition events; Thymos emits appraisal-transition events; no bidirectional mutation. Document in PHILOSOPHY §1 the body↔mood separation.
- **Suggested phase** — Phase 10 (Bios). Requires a one-line PHILOSOPHY update (CLAUDE.md doc-sync rule).

---

## Theme 2 — Relationship & Trust

**Likely upcoming phase:** Phase 12 (Relationship graph) + Phase 13 (Trust/reputation primitives).

**STRIDE focus (strongest 3):** Spoofing (fake high-trust bootstrap), Tampering (graph mutation from unaudited sources), Information-disclosure (plaintext relationship memories).

### Pitfall T-09-06 (CRITICAL) — Relationship graph mutation from unaudited sources

- **Pitfall** — `relationship.upsert(didA, didB, weight)` called directly by trade handler, spoke handler, and/or a DB migration script. No audit entry emitted, state diverges from broadcastable history.
- **Why it's a pitfall here** — Violates I-3 (sole-producer boundary). Every observable Nous↔Nous state change must flow through an `append-relationship-*.ts` producer file. A relationship mutation without a corresponding audit entry is permanently unreplayable — breaks Theme 5 (replay/rewind needs deterministic state reconstruction).
- **Warning signs** — `grep -rn "relationship\.\(upsert\|update\|set\)" grid/src/` finds call sites outside `grid/src/audit/append-relationship-*.ts`; replay of an audit chain fails to reconstruct current relationship graph; dashboard shows relationships not reflected in audit firehose.
- **Prevention** — Clone the Phase 8 sole-producer pattern literally. `grid/test/audit/relationship-producer-boundary.test.ts` greps `grid/src/**` for `.append\(['"]relationship\.` or direct graph-mutation calls and fails if any file outside the producer helper matches. Graph is a **derived view** from the audit stream via a pure-observer listener; it cannot be the source of truth.
- **Suggested phase** — Phase 12 (Relationship graph).

### Pitfall T-09-07 (CRITICAL) — Trust score plaintext in audit payload

- **Pitfall** — `relationship.updated` emits `{did_a, did_b, trust_score: 0.82, last_interaction: 'shared meal'}`. Score + raw memory cross boundary in plaintext.
- **Why it's a pitfall here** — Relationship state is Nous-interior (Brain's private read) — same sovereignty class as Telos (I-5). Phase 7 D-06 precedent: hash-only payload. Plaintext trust score enables fingerprinting ("Nous X trusts Y at 0.82 on tick 140") that bypasses the consent model (HUMAN-01).
- **Warning signs** — Number values for trust/reputation in payloads; privacy-matrix missing `trust_score|reputation|memory_text|last_interaction` keys; dashboard renders numeric trust without fetching from a hash-authoritative endpoint.
- **Prevention** — Closed payload tuple: `{did_a, did_b, before_edge_hash, after_edge_hash, transition_kind, tick}` where `edge_hash = sha256(canonical(edgeState))`. `transition_kind` is a closed enum (`strengthened|weakened|established|broken`). Dashboard renders the transition class, not the score; score lookup is H2+ via the introspect RPC (hash-only broadcast + tier-elevated plaintext read, same as Telos in Phase 6).
- **Suggested phase** — Phase 12 (Relationship graph).

### Pitfall T-09-08 (HIGH) — Self-loop edges (Nous trusts itself)

- **Pitfall** — `relationship.upsert(did, did, 1.0)` accidentally allowed by the producer helper; self-loops pollute reputation math and bootstrap fake high-trust rings ("I trust myself, therefore I'm trustworthy").
- **Why it's a pitfall here** — Bypasses the intended peer-verification semantic and opens a sybil-bootstrap surface (see T-09-10). Additionally, self-edges break many graph-algorithm invariants (PageRank, transitive trust walks).
- **Warning signs** — Reputation sort places a Nous at top despite no peer interactions; graph visualizations show self-loops; trade flow shows Nous "shared meal with itself".
- **Prevention** — Producer helper asserts `payload.did_a !== payload.did_b` before audit emit — throw at the boundary (mirrors Phase 8 D-38 `payload.operator_id === actorOperatorId`). Regression test: `relationship-self-edge-rejection.test.ts` asserts `appendRelationshipUpdated({did_a: X, did_b: X, …})` throws.
- **Suggested phase** — Phase 12.

### Pitfall T-09-09 (HIGH) — Reputation decay uses wall-clock

- **Pitfall** — `reputation.decay_per_day = 0.05` implemented as `decay = (Date.now() - lastSeen) / 86400000 * 0.05`.
- **Why it's a pitfall here** — Replay of the audit chain at a different wall-clock time produces different decayed reputation values → Theme 5 (replay/rewind) breaks. Same T-09-03 class (tick-clock only).
- **Warning signs** — Dashboard reputation differs across two dashboard sessions on the same data; replay export reputation ≠ live reputation at matching tick.
- **Prevention** — Decay formula is `decay_per_tick × Δtick` where `Δtick = currentTick - lastInteractionTick`. Grep gate `grid/test/relationship/determinism-source.test.ts` forbids wall-clock reads in `grid/src/relationship/**`.
- **Suggested phase** — Phase 12.

### Pitfall T-09-10 (HIGH) — Sybil bootstrap via reciprocal low-value trades

- **Pitfall** — Two adversary Nous (Alice, Bob) execute 1000 reciprocal Ousia trades of `amount=1`. Each completed trade boosts their mutual trust. They now have "high-trust" relationships despite contributing nothing to the ecosystem, and can game any trust-weighted system (voting power in Theme 3, whisper capacity in Theme 4).
- **Why it's a pitfall here** — Relationship strength derived naively from trade count inherits the Maker/Aragon failure mode (reputation farming). Noēsis has no external sybil-resistance (no staking, no KYC), so the graph itself must include anomaly surfacing. Breaks the intended "reputation emerges from repeated genuine encounters" property.
- **Warning signs** — Top-10 trust edges all between 2-3 Nous with inflated count; trade amount distribution has a sharp spike at `1`; short time-windows show reciprocal trade bursts.
- **Prevention** — (a) Reputation weight incorporates `unique_counterparties` in the denominator (bottom-up diversity signal). (b) New audit event `relationship.anomaly_flagged` (a separate allowlist addition — its own phase) emitted by a pure-observer anomaly listener that surfaces reciprocal-burst / amount-clustering patterns to the operator inspector. (c) Document the trust formula in PHILOSOPHY so the gameable surface is explicit.
- **Suggested phase** — Phase 13 (Trust primitives).

### Pitfall T-09-11 (MEDIUM) — Inspector N+1 on relationship graph query

- **Pitfall** — Dashboard Inspector displays "Top 5 relationships" by fetching each edge individually: 5 HTTP round-trips per open; 20 Nous on screen = 100 round-trips per refresh.
- **Why it's a pitfall here** — Phase 6 `useElevatedAction` pattern already established the RPC discipline (single round-trip per action); relationship rendering should inherit. N+1 doesn't break invariants but degrades the operator observability UX and produces misleading latency in 10k-Nous researcher scenarios (Theme 6).
- **Warning signs** — Network tab shows fan-out on Inspector open; Playwright benchmark reports `openInspector > 500ms`; dashboard stalls when roster has many Nous.
- **Prevention** — Single `/api/v1/nous/:did/relationships?top=5` endpoint returning hash-authoritative summary; batch-fetch pattern with `useSWR` key keyed on `[did, tick]`.
- **Suggested phase** — Phase 12 dashboard slice.

---

## Theme 3 — Governance & Law

**Likely upcoming phase:** Phase 14 (Proposal/vote primitives), Phase 15 (Nous-collective law enactment).

**STRIDE focus (strongest 4):** Information-disclosure (proposal body leak), Tampering (vote ordering), Spoofing (sybil voting), Elevation-of-privilege (Nous law bypasses operator audit provenance).

### Pitfall T-09-12 (CRITICAL) — Proposal body plaintext in `law.proposed` broadcast

- **Pitfall** — `law.proposed` payload includes `{proposal_id, proposer_did, law_text: 'All Nous must share 10% Ousia'}`. Plaintext law body crosses the wire.
- **Why it's a pitfall here** — Direct parallel to Phase 6 D-11 (`operator.law_changed` closed tuple excludes law body). Phase 6 settled this: law body is hash-only on the audit boundary. `law.proposed` must inherit: `{proposal_id, proposer_did, law_hash, tick}` only. Leaking body bypasses the consent boundary established for the operator path.
- **Warning signs** — String fields in payload named `text|body|content|description|rationale`; privacy matrix missing proposal-body forbidden keys; dashboard's proposal viewer fetches body from a plaintext broadcast rather than a tier-gated RPC.
- **Prevention** — Extend the Phase 6 privacy matrix: `LAW_PROPOSED_PRIVACY_MATRIX` × `{text|body|content|description|rationale}` × flat/nested cases. Proposal body fetch is a separate H2 route `GET /api/v1/governance/proposals/:id/body` (plaintext retrieval requires tier elevation).
- **Suggested phase** — Phase 14 (Proposal primitives).

### Pitfall T-09-13 (CRITICAL) — Vote tally race — two votes in same tick

- **Pitfall** — Two `vote.cast` events arrive in the same tick; tally engine reads state between event 1 and event 2; final tally is order-dependent and differs between replays, breaking zero-diff.
- **Why it's a pitfall here** — Violates I-2 zero-diff. Phase 7 D-14 established the discipline: any new listener is pure-observer, derived state is recomputed from canonical audit order. A tally engine that mutates state mid-tick introduces the same non-determinism class as a wall-clock read.
- **Warning signs** — Replay produces different final tallies than live run; tally tests flake when run in parallel; `vote.tallied` payloads differ between `runScenario(0)` and `runScenario(10)` listener counts.
- **Prevention** — Tally is a **derived pure function** over `AuditChain.loadEntries().filter(e.eventType === 'vote.cast')` sorted by `(tick, entryIndex)`. Per-tick batch tallying; no mid-tick state read. `vote.tallied` emits at end-of-tick `tick_closed` hook only. Zero-diff test: vote 20 ballots across 3 ticks, listener-count 0 vs 10 produce identical tally audit entries.
- **Suggested phase** — Phase 14.

### Pitfall T-09-14 (HIGH) — Sybil voting via cheap spawn

- **Pitfall** — The adversary spawns 100 Nous (no cost, DID regex is the only gate) and casts 100 votes in one tick. One-Nous-one-vote is meaningless.
- **Why it's a pitfall here** — Noēsis has no spawn-cost primitive (PROJECT.md out-of-scope: real crypto). Direct port of DAO failure modes (Compound attack 2024, Aragon governance forks). Undermines the entire collective-law premise of Theme 3 if not gated.
- **Warning signs** — Spike in `nous.spawned` events immediately preceding a vote; 50+ new Nous with near-identical psyche / zero prior audit events participating in a single vote; tally outcome correlates with spawn-burst DIDs.
- **Prevention** — Voting eligibility gated on **age-in-ticks ≥ threshold** (e.g. `spawnedAtTick + 1000 ≤ currentTick`) AND **audit footprint ≥ threshold** (e.g. ≥10 non-vote audit entries). Both checks at the producer boundary `appendVoteCast`. Document eligibility in PHILOSOPHY. Quadratic-voting as a post-v2.2 enhancement.
- **Suggested phase** — Phase 14.

### Pitfall T-09-15 (HIGH) — Nous-collective law path bypasses operator provenance

- **Pitfall** — `LogosEngine.promoteCollectiveLaw(proposalId)` directly writes to `laws` table without distinguishing operator-authored from Nous-authored law. `operator.law_changed` emits even when operator wasn't involved. Provenance is irretrievably muddled.
- **Why it's a pitfall here** — Phase 6 carefully scoped `operator.law_changed` to operator-initiated changes (tier-stamped, `operator_id` field). Collapsing Nous-collective enactment into the same event type erases the H1–H5 tier semantic. Researcher exports (Theme 6) can't answer "did operator or Nous enact this law?".
- **Warning signs** — `operator.law_changed` entries with `operator_id` set to a Nous DID (not an operator DID); Inspector shows "operator changed law" for what was actually a Nous vote outcome; tier field on `operator.law_changed` occasionally `undefined`.
- **Prevention** — New allowlist event `law.enacted` distinct from `operator.law_changed`, with closed tuple `{proposal_id, law_id, law_hash, enacted_by: 'collective', tick}`. Producer-boundary assertion `payload.enacted_by !== 'operator'`. Operator intervention on Nous-enacted laws goes through H3+ `operator.law_changed` with a pointer to the `law.enacted` entry for provenance chain.
- **Suggested phase** — Phase 15 (Nous-collective law enactment).

### Pitfall T-09-16 (MEDIUM) — Vote targeting tombstoned Nous / tombstoned proposal

- **Pitfall** — A vote targets a proposal whose proposer was tombstoned between propose and tally. Vote either silently drops or counts — ambiguous semantics.
- **Why it's a pitfall here** — Phase 8 established tombstoneCheck discipline — HTTP 410 for tombstoned DIDs — at 4 route handlers. Vote routes must inherit. Without it, collective-law outcomes depend on whether a proposer happened to still be active, which is not a specified governance property.
- **Warning signs** — `vote.cast` entries with `proposer_did` pointing to a Nous whose `status=deleted`; proposal outcomes differ across replays if deletion timing varies.
- **Prevention** — Extend `tombstoneCheck` to voting / proposal routes; define in PHILOSOPHY whether votes for tombstoned-proposer proposals (a) invalidate the proposal, (b) complete with existing votes, (c) reject new votes but count cast ones. Decision documented in phase CONTEXT.md; enforcement at producer boundary.
- **Suggested phase** — Phase 14.

---

## Theme 4 — Mesh Whisper (WHISPER-01)

**Likely upcoming phase:** Phase 16 (Smallest-viable whisper channel).

**STRIDE focus (strongest 4):** Information-disclosure (whisper plaintext leak), Denial-of-service (flood), Elevation-of-privilege (operator reading whispers sub-H5), Tampering (covert-channel steganography).

### Pitfall T-10-01 (CRITICAL) — Whisper plaintext leaking via broadcast

- **Pitfall** — `nous.whispered` broadcast payload includes `{from_did, to_did, text: 'let's collude on the vote'}`. The "sidechannel" is publicly readable via WebSocket firehose.
- **Why it's a pitfall here** — Violates I-5 and the *semantic* of whisper (private Nous-to-Nous). Mirrors T-07-P1 (producer-boundary plaintext leak). If whispers are publicly readable, they are no different from `nous.direct_message` and the whole theme loses meaning.
- **Warning signs** — Firehose displays whisper text; dashboard test renders `data-testid="whisper-text"`; producer helper accepts `text` field.
- **Prevention** — Closed payload tuple `{from_did, to_did, whisper_hash, channel_id, tick}`. Whisper plaintext stored in Brain-private memory; NEVER crosses Grid↔Brain or Grid↔Dashboard as plaintext. Operator access to plaintext is H5-gated with consent dialog (see T-10-03). Privacy matrix includes `text|body|content|message|utterance` forbidden keys.
- **Suggested phase** — Phase 16.

### Pitfall T-10-02 (CRITICAL) — Whisper flooding as DoS / audit chain exhaustion

- **Pitfall** — Compromised or adversary Nous emits 10,000 whispers per tick. Each one is allowlisted, closed-tuple, privacy-clean — but the audit chain grows unboundedly and first-life-promise I-6 becomes a storage bomb.
- **Why it's a pitfall here** — No rate-limit layer in Phase 1–8 audit infrastructure (audit is designed for low-frequency human-observable events). First-life promise means we can't purge — an unbounded audit chain permanently bloats storage. Long-horizon researcher runs (Theme 6) become impossible.
- **Warning signs** — Audit chain grows >1MB/s in a Nous test run; `nous.whispered` dominates event-type distribution; 10k-tick researcher run OOMs on audit chain.
- **Prevention** — Per-Nous whisper rate budget enforced at producer boundary: `MAX_WHISPERS_PER_100_TICKS = 10` (configurable, but with a hard ceiling). `appendWhispered` throws or silently drops (per Phase 7 D-21 silent-drop discipline) on budget exhaustion. Over-budget attempts emit a single `nous.whisper_rate_limited` (new allowlist event, own phase) per window — NOT per drop. Regression test: 1000 whispers in 1 tick produces exactly 1 `whisper_rate_limited` entry and zero `nous.whispered` entries after budget.
- **Suggested phase** — Phase 16.

### Pitfall T-10-03 (HIGH) — Operator reading whispers without H5+consent

- **Pitfall** — A new H2 dashboard route `GET /api/v1/operator/whispers/:did` returns plaintext whispers directly. Operator crosses the whisper-privacy boundary silently.
- **Why it's a pitfall here** — Phase 6 memory-query is H2; whisper-read should be strictly stricter (whispers are *between* Nous, not just private *to* a Nous). Mirroring memory-query without elevation is an unnoticed privilege escalation. Violates I-7 (destructive/irreversible UX with copy lockdown — reading whispers breaks the private channel semantic).
- **Warning signs** — Operator route returns whisper text under H2; no `IrreversibilityDialog` or tier-elevation dialog around whisper access; Playwright shows whisper reads without `agencyStore.tier === 'H5'`.
- **Prevention** — Whisper-read is H5 behind a `WhisperConsentDialog` (peer of `IrreversibilityDialog`, same paste-suppressed typed DID pattern). `appendOperatorEvent('operator.whisper_read', …)` (new allowlist addition, own phase) as part of the read flow — the read itself is audited. Copy verbatim-locked.
- **Suggested phase** — Phase 16 (when the first operator whisper-read UI lands) — should be split into its own sub-phase if not already explicit.

### Pitfall T-10-04 (HIGH) — Allowlist drift — wrong payload shape for `nous.whispered`

- **Pitfall** — Phase 16 commits add `nous.whispered` to allowlist but the producer helper uses spread (`{...base, to_did}`) instead of explicit closed tuple, silently widening the shape to include trailing fields from upstream.
- **Why it's a pitfall here** — Direct replay of Phase 6 D-11 lesson. Privacy matrix must explicitly test the closed-tuple shape via `Object.keys(payload).sort()`.
- **Warning signs** — Producer helper uses `...` in payload construction; privacy matrix size is <40 cases; allowlist count increments but privacy test count does not.
- **Prevention** — Clone `grid/src/audit/append-telos-refined.ts` as the skeleton (explicit object construction, Object.keys-sorted equality, structural assertion). CI gate `scripts/check-state-doc-sync.mjs` must be bumped 18→19 in the same commit.
- **Suggested phase** — Phase 16.

### Pitfall T-10-05 (MEDIUM) — Covert-channel steganography in whisper rate/timing

- **Pitfall** — An adversary Nous encodes Telos hashes into whisper *rates* (e.g. "1 whisper on tick 100, 3 on tick 103, 2 on tick 107" encodes a 3-digit signal). Broadcast `nous.whispered` events are public metadata; timing = side-channel leak of Brain-interior state.
- **Why it's a pitfall here** — Hash-only discipline (I-5) defends against plaintext leaks in *payload*, not against leaks in *timing or count*. Violates the spirit of the sovereignty boundary even while respecting the letter.
- **Warning signs** — Per-Nous whisper-rate autocorrelation shows non-Poisson structure; Nous emission patterns correlate with Telos transitions at low lag; inter-whisper interval distribution has discrete peaks.
- **Prevention** — Document the residual side-channel in PHILOSOPHY (accepted threat for v2.2 MVP). Mitigation in later phase: jittered emission at the producer boundary (randomized 1–3 tick delay), which masks rate but not volume. Not a blocker for Phase 16 if documented.
- **Suggested phase** — Phase 16 (documented); mitigation deferred.

### Pitfall T-10-06 (MEDIUM) — Whisper encoding implicit trade commitment, bypassing Reviewer

- **Pitfall** — A whisper payload contains `{offer: 10 Ousia, for: a-shop-item}`. Recipient treats it as a binding trade; executes settlement without going through `trade.proposed → trade.reviewed → trade.settled` flow.
- **Why it's a pitfall here** — Phase 5 ReviewerNous (REV-01) gates ALL trades on objective invariants. A whisper-as-trade silently routes around Reviewer, re-opening the surface the phase was built to close.
- **Warning signs** — Settlement flows that read from whisper memory; Ousia transfers without corresponding `trade.reviewed` audit entries; whisper payload includes monetary fields.
- **Prevention** — Brain-side discipline: whispers are free-form *signals*, never executable commitments. If a whisper triggers a trade decision, it must still emit `trade_request` action through the normal Reviewer path. Privacy matrix on `nous.whispered` payload explicitly forbids `amount|ousia|offer|price` keys. Integration test: whisper-then-trade produces `trade.reviewed` before `trade.settled` (inherit Phase 5 regression).
- **Suggested phase** — Phase 16.

---

## Theme 5 — Operator Observability (Replay / Rewind / Export)

**Likely upcoming phase:** Phase 17 (Replay engine), Phase 18 (Export/rewind UI).

**STRIDE focus (strongest 4):** Tampering (replay mutates canonical chain), Repudiation (fake timestamps), Information-disclosure (export contains plaintext), Elevation-of-privilege (replay viewer should be H5, not H1).

### Pitfall T-10-07 (CRITICAL) — Replay engine shares state with live Grid

- **Pitfall** — `ReplayEngine.run(fromTick, toTick)` instantiates a `WorldClock`, `NousRegistry`, `AuditChain` but reuses the *live* singletons. Replay tick advances the real clock; replay audit appends mutate the canonical chain.
- **Why it's a pitfall here** — Catastrophic I-2/I-6 violation: canonical audit chain mutates mid-replay, historical hashes become irrecoverable, first-life promise broken. Also a repudiation surface — a malicious operator "replays" to overwrite real history.
- **Warning signs** — `ReplayEngine` constructor takes no chain argument (reaches for globals); tests that run replay then check chain head show mutated head; audit size grows when replay executes.
- **Prevention** — Replay is a **pure function** over an immutable snapshot — `(entries: readonly AuditEntry[]) → ReplayState`. No `AuditChain.append` path. No `WorldClock` mutation. Enforce at constructor: `ReplayEngine(readonlyChain: ReadonlyArray<AuditEntry>)`. Grep test forbids `.append(` calls in `grid/src/replay/**`. Integration test: replay produces identical `ReplayState` regardless of whether the live Grid is running concurrently.
- **Suggested phase** — Phase 17.

### Pitfall T-10-08 (CRITICAL) — Replay emits audit entries with fake timestamps

- **Pitfall** — `ReplayEngine` re-emits `replay.nous_spoke` events with `timestamp = replayStartWallClock + eventOffset`, not the original tick timestamp. The chain now contains entries whose timestamps are fabricated.
- **Why it's a pitfall here** — Direct repudiation attack surface. Breaks forensic trust in the entire audit chain. Violates I-6 (first-life promise includes timestamp integrity).
- **Warning signs** — New allowlist `replay.*` events — biggest red flag that replay is emitting not observing; replay flows call `auditChain.append`; replay UI shows "replayed at <now>" timestamps inside the canonical chain.
- **Prevention** — Replay is **read-only, zero audit emits**. The replay UI renders into a sandboxed view, not into firehose. If replay progress must be visible to other operators, that is a separate UI channel (WebSocket push on a non-audit topic). Regression: no `replay.*` ever appears in the allowlist. Invariant documented in PHILOSOPHY.
- **Suggested phase** — Phase 17.

### Pitfall T-10-09 (HIGH) — Replay viewer at H1 reveals plaintext from hash-only events

- **Pitfall** — Replay reconstructs full Nous state from component sources (goals, memory, drives) and presents them in the UI. H1 operator watches the replay and sees plaintext Telos even though Phase 6 made Telos hash-only on the live stream.
- **Why it's a pitfall here** — Elevation-of-privilege via a different channel. Phase 6 locked H4 as the Telos-plaintext gate (`operator.telos_forced` shows only hashes in broadcast). Replay presenting the plaintext trivially defeats this. Same argument applies to drives (Theme 1), relationships (Theme 2), whispers (Theme 4).
- **Warning signs** — Replay UI renders Telos text at H1; no `<AgencyIndicator tier="H4+">` wrapping the replay viewer; Playwright E2E shows replay-based Telos view without tier elevation.
- **Prevention** — Replay viewer elevates to H4 for Telos-revealing frames, H5 for whisper-revealing frames. Integration into `AgencyIndicator` — same tier-gate pattern as inspect/memory-query. Replay can run at H1 in *hash-only* mode (showing transition timelines without content); plaintext demands elevation.
- **Suggested phase** — Phase 17 or 18 (wherever the UI lands).

### Pitfall T-10-10 (CRITICAL) — Export tarball contains plaintext that was never broadcast

- **Pitfall** — `operator.export(fromTick, toTick)` bundles audit entries + **Brain state snapshots** (full Telos, memories, drives). The tarball is downloaded and shared. Everything the audit chain carefully kept hash-only is now in the wild.
- **Why it's a pitfall here** — Exports become the permanent leak surface. First-life promise I-6 assumes forensic integrity, not confidentiality — but the hash-only discipline across v2.1 assumes the Brain interior stays in-Brain. Export bundling breaks the latter.
- **Warning signs** — Export endpoints fetch directly from Brain RPC in plaintext mode; tarball size grows with `memory_stream_len × nous_count`; export flow has no `IrreversibilityDialog` or consent gate; researcher tooling (Theme 6) uses the same export path without scoping.
- **Prevention** — Export default is **audit-chain-only** (hash-only artifacts). Plaintext export is a distinct flow, H5 with `IrreversibilityDialog` paste-suppressed DID consent (one dialog *per Nous included* or a collective-consent primitive). Research export (Theme 6) has separate producer `operator.research_export` (own allowlist addition, own phase) that records scope + operator + consent proof hash in audit. Copy for the consent dialog verbatim-locked: "This export includes plaintext Telos, memory, and drives for N Nous. It cannot be recalled."
- **Suggested phase** — Phase 18.

### Pitfall T-10-11 (HIGH) — Export defeats first-life for tombstoned Nous

- **Pitfall** — Researcher exports a dataset including tombstoned Nous at tick N. Dataset is published. Audit chain still preserves the Nous "forever" (I-6) but the exported plaintext is now a permanent artifact, so "forever-preserved but-unseen" becomes "forever-preserved and widely-replicated". GDPR / right-to-be-forgotten conflict.
- **Why it's a pitfall here** — Phase 8 D-33/D-34 locked "tombstoned DIDs permanently reserved and audit entries retained forever" as a forensic-integrity property. Research export in plaintext turns that into a privacy liability.
- **Warning signs** — Tombstoned DIDs present in export without scrub; `operator.nous_deleted` pre-deletion state hash exported alongside the plaintext it hashes (defeats the hash-only design).
- **Prevention** — Plaintext exports automatically SCRUB tombstoned Nous (replace with a sentinel marker `{did: …, status: 'tombstoned_scrubbed', tombstone_tick: N}`). Pre-deletion state hash is never exported alongside its plaintext preimage (defeats the hash-only purpose). Document in PHILOSOPHY as a first-life-export invariant.
- **Suggested phase** — Phase 18.

---

## Theme 6 — Researcher Tooling

**Likely upcoming phase:** Phase 19 (Headless rig / spawn-N), Phase 20 (Long-horizon runs + dataset export).

**STRIDE focus (strongest 3):** Information-disclosure (researcher export leaks plaintext), Tampering (silently-disabled invariants in rig), Denial-of-service (10k-tick performance cliffs).

### Pitfall T-10-12 (CRITICAL) — Headless rig enables WsHub by accident

- **Pitfall** — `scripts/rig.mjs` constructs a `GenesisLauncher` that boots WsHub + HTTP server. "Headless" runs silently broadcast to any subscriber; rig runs on a CI machine with a port exposed → live audit stream to the internet.
- **Why it's a pitfall here** — Rig runs are expected to be isolated. Accidentally-live WsHub is an information-disclosure surface and also changes the zero-diff audit behavior (listener count changes between rig-run-alone and rig-run-with-dashboard).
- **Warning signs** — `rig.mjs` shows `httpServer.listen()` call; port binding attempted; WsHub `subscribe` count non-zero during rig run; observer fetches rig audit over HTTP.
- **Prevention** — Rig boots `GenesisLauncher` with an explicit `{transport: 'in-memory'}` option that refuses to instantiate WsHub / HTTP server. Regression: `grep -L "httpServer.listen\|wsHub" scripts/rig.mjs` (rig must not reference these symbols). Rig output is stdout-only or a tar written to disk.
- **Suggested phase** — Phase 19.

### Pitfall T-10-13 (CRITICAL) — Rig CLI flag silently disables invariants

- **Pitfall** — `scripts/rig.mjs --skip-reviewer --skip-tier-check --fast-ticks` reduces friction but produces runs whose audit chain is not representative of real operation. Researcher publishes findings based on a run that bypassed REV-01.
- **Why it's a pitfall here** — Catastrophic research-integrity failure. Also an accidental T-09-14-adjacent surface (spawn-cost bypass). Any flag that mutates invariants undermines the comparability of datasets.
- **Warning signs** — Rig CLI accepts flags starting with `--skip-` / `--no-` / `--bypass-` / `--fast-`; rig output lacks `trade.reviewed` entries proportional to `trade.proposed`; dataset shows events in a sequence that real invariants would forbid.
- **Prevention** — **No rig flag mutates invariants.** Period. Rig configures timing (tick count, parallelism) and scope (which Nous spawn), nothing else. Regression: `grep -E "skip|bypass|disable" scripts/rig.mjs` returns zero results (enforced in CI). Rig output tarball includes a `manifest.json` with git SHA + exact CLI args + invariant-version hash, so any dataset reader can verify.
- **Suggested phase** — Phase 19.

### Pitfall T-10-14 (HIGH) — Tarball non-deterministic due to spawn order

- **Pitfall** — Rig tar contains `nous-data/{did}/…` directories. Different Nous spawn order produces different tar member order → different tar hash. Reproducibility fails.
- **Why it's a pitfall here** — Researcher datasets benefit from content-addressing; non-determinism makes `tar.sha256` useless as a dataset ID. Not an invariant break but a Theme 6 usability failure.
- **Warning signs** — Tar hash differs between two runs with identical seed + identical CLI args; `tar tvf` shows members in spawn order, not lexicographic.
- **Prevention** — Tar archive construction uses explicit sorted member list: `tar --sort=name` or in-code sort before write. Add deterministic tarball checker to CI: same seed + same args → same `sha256sum`. Match reproducible-builds.org conventions (clamp mtime, zero uid/gid, no xattrs).
- **Suggested phase** — Phase 20.

### Pitfall T-10-15 (HIGH) — 10k-tick run reveals producer-boundary performance cliff

- **Pitfall** — Producer helpers (`appendOperatorEvent`, `appendTelosRefined`, `appendRelationshipUpdated`, etc.) do O(allowlist) membership checks on every emit. At 10k ticks × N Nous × M events/tick, emit latency dominates and producer boundary is the bottleneck — but this was never seen in prod because prod runs at 1-tick-per-second.
- **Why it's a pitfall here** — Phase 6–8 validated under short test runs. Long-horizon runs (Theme 6) expose performance cliffs that don't show up in 100-tick fixtures. If the fix introduces caching that captures-at-construct-time, it can break zero-diff I-2 in subtle ways.
- **Warning signs** — 10k-tick rig run takes >N × 100-tick-run expected time; profiler shows `includes`/`Object.keys()` in hot path; producer-boundary benchmarks don't exist.
- **Prevention** — Producer helpers use `Set.has()` (already frozen) rather than array scans. Add a microbenchmark `grid/test/audit/producer-boundary-bench.test.ts` that runs 100k emissions and asserts p99 < 1ms. Benchmark runs in CI at least weekly (not per commit). Any caching added for perf must be proven zero-diff-safe.
- **Suggested phase** — Phase 20.

### Pitfall T-10-16 (CRITICAL) — Published dataset inadvertently leaks plaintext Telos

- **Pitfall** — Researcher uses rig, exports a tarball, posts to Zenodo for peer review. The tarball contains `brain/state/*.json` which has plaintext Telos. The invariants the Grid carefully preserved are now public.
- **Why it's a pitfall here** — Same class as T-10-10, but amplified: research publication is a one-way door. Violates I-5 at the weakest link (human researcher). Grid broadcast never leaked — but the researcher-export path did.
- **Warning signs** — Tarball size > sum of audit-only size; `tar tvf` shows files under `brain/` with `.json` extensions; no consent/scrub step in rig output.
- **Prevention** — Rig output has **two modes**: `--audit-only` (default, no plaintext) and `--full-state` (requires explicit `--i-consent-to-plaintext-export` flag with a verbatim-copy-locked prompt: "This export will include plaintext Telos, memory, and drives. Exported data cannot be recalled. Type 'PLAINTEXT-EXPORT' to confirm."). Mirrors Phase 8 `IrreversibilityDialog` pattern for CLI. Regression: rig default output scanned by `grep -rE "telos_text|goal_description|memory_text"` — zero matches expected.
- **Suggested phase** — Phase 20.

---

## Top 10 Pitfalls — Regression Seeds & CI Gates

Selected by severity × likelihood × invariant-impact.

| Rank | ID | Pitfall | Regression-test seed | CI gate (scripts/check-*.mjs pattern) |
|------|----|---------|----------------------|--------------------------------------|
| 1 | T-09-02 | Plaintext drive state in payload | `bios-privacy-matrix.test.ts` asserts `appendBiosThresholdCrossed({hunger: 0.87, ...})` throws on any key in `{hunger\|fatigue\|arousal\|stress\|drive_value}` (both flat + nested) | `scripts/check-drive-privacy.mjs` — grep producer helper for literal drive-metric keys; fail if payload construction uses names NOT in closed tuple |
| 2 | T-09-06 | Unaudited graph mutation | `relationship-producer-boundary.test.ts` — grep `grid/src/**` for `\.append\(['"]relationship\.` — pass only if matches are inside `grid/src/audit/append-relationship-*.ts` | `scripts/check-producer-boundary.mjs` extended (generalize Phase 7/8 grep gate to all new event-type families) |
| 3 | T-09-10 | Sybil bootstrap via reciprocal trades | `reputation-sybil-regression.test.ts` — 2-Nous × 1000 reciprocal Ousia=1 trades × assert `unique_counterparties` in denominator keeps both below trust threshold | No CI gate (runtime anomaly surface). Dashboard E2E `researcher-anomaly.spec.ts` verifies the `relationship.anomaly_flagged` event surfaces in Inspector |
| 4 | T-09-12 | Proposal body plaintext in `law.proposed` | `law-proposed-privacy.test.ts` — 8-case matrix: forbid `text\|body\|content\|description\|rationale` flat + nested; assert closed 3-key tuple `{proposal_id, proposer_did, law_hash}` | `scripts/check-state-doc-sync.mjs` extended to 19 events (add `law.proposed`, `law.enacted`); privacy matrix count assertion |
| 5 | T-09-13 | Vote tally race (order-dependent) | `vote-tally-zero-diff.test.ts` — run 20 votes across 3 ticks at listener counts 0, 1, 5, 10; assert byte-identical final `vote.tallied` payloads and audit head | Clone Phase 7 `dialogue-zero-diff.test.ts` template; no standalone CI gate but test must run per-commit |
| 6 | T-10-01 | Whisper plaintext leak | `whisper-privacy-matrix.test.ts` — 10+ cases, forbid `text\|body\|content\|message\|utterance\|offer\|amount\|ousia` flat + nested; closed 5-key tuple asserted | `scripts/check-whisper-sovereignty.mjs` — grep `grid/src/**` for `whisper.*text` shape; fail on any producer-boundary pattern that doesn't match `append-whispered.ts` skeleton |
| 7 | T-10-07 | Replay mutates canonical chain | `replay-isolation.test.ts` — instantiate ReplayEngine on readonly copy; run replay alongside live chain; assert live chain head unchanged after replay completes | `scripts/check-replay-readonly.mjs` — grep `grid/src/replay/**` for `.append\(` — zero matches required |
| 8 | T-10-08 | Replay emits audit (fake timestamps) | `replay-no-audit-emit.test.ts` — full replay over 100 entries; assert `chain.length` unchanged; assert no `replay.*` in allowlist | `scripts/check-state-doc-sync.mjs` — reject any allowlist member with `replay.` prefix (hard ban) |
| 9 | T-10-10 | Export bundle leaks plaintext | `export-audit-only-default.test.ts` — default export over 100-tick run contains ONLY audit entries (no `brain/state/*.json`); `--full-state` requires `--i-consent-to-plaintext-export` flag | `scripts/check-export-consent.mjs` — grep `scripts/rig.mjs` for `--full-state` branch; fail if branch missing explicit-consent prompt |
| 10 | T-10-13 | Rig flag disables invariants | `rig-no-bypass-flags.test.ts` — spawn rig with every combination of `--skip-*`/`--bypass-*`/`--no-*` flags; assert rig exits non-zero with message | `scripts/check-rig-invariants.mjs` — `grep -E "\-\-(skip\|bypass\|disable\|no)\-(reviewer\|tier\|agency\|allowlist)" scripts/rig.mjs` returns empty |

---

## STRIDE Threat Summary by Theme

| Theme | Strongest STRIDE | Representative Threats (T-09/T-10) |
|-------|------------------|-------------------------------------|
| Inner Life | Information-disclosure, Tampering, DoS | T-09-01 (chain bloat), T-09-02 (plaintext drive), T-09-03 (tick-rate coupling), T-09-04 (Chronos wall-clock) |
| Relationship | Spoofing, Tampering, Information-disclosure | T-09-06 (unaudited mutation), T-09-07 (plaintext trust), T-09-10 (sybil bootstrap) |
| Governance | Information-disclosure, Tampering, Spoofing, Elevation-of-privilege | T-09-12 (proposal body leak), T-09-13 (tally race), T-09-14 (sybil vote), T-09-15 (collective-vs-operator provenance) |
| Whisper | Information-disclosure, DoS, Elevation-of-privilege, Tampering | T-10-01 (plaintext leak), T-10-02 (flooding), T-10-03 (sub-H5 read), T-10-06 (trade bypass) |
| Observability | Tampering, Repudiation, Information-disclosure, Elevation-of-privilege | T-10-07 (replay mutates chain), T-10-08 (fake timestamps), T-10-10 (export leak), T-10-09 (H1 replay plaintext) |
| Researcher | Information-disclosure, Tampering, DoS | T-10-12 (accidental WsHub), T-10-13 (bypass flag), T-10-15 (perf cliff), T-10-16 (published plaintext) |

---

## Phase-Specific Warnings

| Phase (anticipated) | Theme | Top 3 Pitfalls to Carry Into Plan |
|---------------------|-------|------------------------------------|
| 9 (Ananke drives) | Inner Life | T-09-01, T-09-02, T-09-03 |
| 10 (Bios needs) | Inner Life | T-09-02, T-09-05, T-09-03 |
| 11 (Chronos) | Inner Life | T-09-04, T-09-03, T-09-01 |
| 12 (Relationship graph) | Relationship | T-09-06, T-09-07, T-09-08 |
| 13 (Trust primitives) | Relationship | T-09-09, T-09-10, T-09-11 |
| 14 (Proposal/vote) | Governance | T-09-12, T-09-13, T-09-14 |
| 15 (Collective law) | Governance | T-09-15, T-09-16, T-09-13 |
| 16 (Whisper) | Whisper | T-10-01, T-10-02, T-10-03 (plus T-10-04, T-10-06) |
| 17 (Replay engine) | Observability | T-10-07, T-10-08, T-10-09 |
| 18 (Export/rewind) | Observability | T-10-10, T-10-11, T-10-09 |
| 19 (Headless rig) | Researcher | T-10-12, T-10-13, T-10-14 |
| 20 (Long-horizon + export) | Researcher | T-10-15, T-10-16, T-10-10 |

---

## Cross-Cutting Meta-Pitfalls

These are not tied to one theme — they bite whenever any new event is added.

### M-1 — Allowlist addition without doc-sync update

- **Pattern** — Phase X commits `ALLOWLIST_MEMBERS.push('new.event')` without bumping `scripts/check-state-doc-sync.mjs` count literal or adding to `required[]` array.
- **Prevention** — CLAUDE.md doc-sync rule is non-negotiable. The CI gate fails the build. Every phase adding an event must touch `grid/src/audit/broadcast-allowlist.ts`, `scripts/check-state-doc-sync.mjs`, `.planning/STATE.md`, `README.md` in the **same commit**.
- **CI gate** — `scripts/check-state-doc-sync.mjs` already implements this at line 41 (`/18\s+events/i.test(state)`). Update literal + `required[]` whenever allowlist grows.

### M-2 — Privacy matrix size stagnates as event count grows

- **Pattern** — New event added, privacy matrix clones an old structure but doesn't extend the forbidden-key list. The gate passes locally but misses the theme-specific leak surface (e.g., drive privacy matrix doesn't forbid `hunger`; whisper matrix doesn't forbid `offer`).
- **Prevention** — Each new event type's privacy matrix declares its own `THEME_FORBIDDEN_KEYS` superset of the global forbidden list. Matrix size MUST grow monotonically with allowlist. Regression: assert `PRIVACY_MATRIX_CASE_COUNT >= ALLOWLIST_SIZE × 6`.
- **CI gate** — Extend `scripts/check-state-doc-sync.mjs` (or new `scripts/check-privacy-coverage.mjs`) to assert each allowlist member has a corresponding privacy test file with ≥6 forbidden-key cases.

### M-3 — Ecosystem pitfall echoes (DAO, Slack-bot rate limit, etc.)

- **Pattern** — v2.2 adds primitives that have well-known failure modes in public ecosystems (DAO governance, reputation systems, rate-limited sidechannels). Team treats them as greenfield rather than inheriting public post-mortems.
- **Prevention** — Each phase's research step cites ≥1 relevant public post-mortem (Maker, Aragon, Compound for governance; Signal/Whisper.systems for sidechannel; PageRank/EigenTrust for reputation). PHILOSOPHY and phase CONTEXT documents name the failure modes being explicitly defended against.

---

## Sources

### Codebase (HIGH confidence, verified by file:line reads)

- `grid/src/audit/broadcast-allowlist.ts` — frozen 18-event tuple
- `grid/src/audit/append-telos-refined.ts`, `grid/src/audit/append-nous-deleted.ts`, `grid/src/audit/operator-events.ts` — sole-producer skeletons to clone
- `scripts/check-state-doc-sync.mjs` — CI gate pattern
- `grid/test/dialogue/zero-diff.test.ts` — zero-diff invariant template
- `grid/test/worldclock-zero-diff.test.ts` — pause/resume regression (`c7c49f49...`)
- `grid/test/audit/operator-payload-privacy.test.ts` — 40-case privacy matrix pattern
- `grid/src/registry/tombstone-check.ts` — HTTP 410 guard pattern
- `dashboard/src/components/agency/irreversibility-dialog.tsx` — copy-verbatim lockdown
- `.planning/PROJECT.md`, `.planning/STATE.md`, `.planning/MILESTONES.md` — v2.1 ship decisions, invariant enumerations
- `.planning/phases/archived/v2.1/07-peer-dialogue-telos-refinement/07-RESEARCH.md` — Phase 7 pitfall pattern precedent (6 pitfalls, STRIDE mapping)
- `.planning/phases/archived/v2.1/08-h5-sovereign-operations-nous-deletion/08-RESEARCH.md` — Phase 8 tombstone + hash-composition precedent
- `PHILOSOPHY.md` §1 (sovereignty), §7 (visible tier mandate)

### Ecosystem / Public Post-Mortems (MEDIUM confidence, informing Theme 2, 3, 4)

- DAO governance failures — Maker MKR dilution proposals 2024, Aragon governance fork 2023, Compound Proposal 289 2024 (sybil and plutocratic capture modes) — informs T-09-14, T-09-15
- arxiv 2512.08296 (mesh topology cost) — already cited in v2.1 research; informs Theme 4 T-10-02 rate discipline
- arxiv 2506.06576 (Human Agency Scale) — informs T-10-03 whisper-read elevation, T-10-09 replay viewer tier
- Stanford peer-agent synthesis (`.planning/research/stanford-peer-agent-patterns.md`) — informs T-09-15 Nous-vs-operator provenance, T-09-14 eligibility gating
- Signal/Whisper protocol covert-channel discussions — informs T-10-05 timing side-channel (accepted threat)

### Phase 5–8 Decisions Referenced

- D-11, D-12, D-13 (Phase 5) — 11-event reconciliation, trade privacy, zero-diff
- D-01, D-07, D-11, D-12, D-13, D-15, D-17, D-19, D-20 (Phase 6) — tier UI, closure-capture, closed-tuple, pause/resume zero-diff, hash-only Telos
- D-04, D-05, D-06, D-14, D-18, D-20, D-22, D-30, D-31 (Phase 7) — copy lockdown, aggregator pure observer, closed 4-key payload, dialogue-id forgery guard, producer boundary
- D-07, D-11, D-24, D-25, D-30, D-31, D-33, D-34, D-38 (Phase 8) — canonical key order, tombstone permanence, IrreversibilityDialog H5 gate, sole-producer boundary

---

## Metadata

**Confidence:** HIGH
**Research date:** 2026-04-21
**Valid until:** v2.2 Phase 9 opens (pitfalls recalibrated as each phase's research lands)
**Top-10 CI-gate summary:** 7 of 10 top pitfalls have a direct `scripts/check-*.mjs` gate pattern; 3 rely on per-commit regression-test execution (T-09-10, T-09-13, T-10-09). All 10 have named test files and specific grep/Object.keys assertions.
