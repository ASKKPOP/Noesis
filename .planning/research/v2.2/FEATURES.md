# Feature Research — v2.2 Living Grid

**Domain:** Persistent autonomous-agent simulation — inner-life substrate, emergent social structure, collective governance, sidechannel communication, post-hoc observability, research-platform export
**Researched:** 2026-04-21
**Confidence:** MEDIUM-HIGH
- HIGH on drive/need primitives (LIDA, ACT-R, Soar-lite are well-documented), on relationship graph primitives (valence/weight/recency is canonical), on proposal lifecycle mechanics (Ostrom + on-chain governance literature), and on post-hoc export patterns
- MEDIUM on Chronos (less consensus in the literature — subjective-time proposals below are constructed from Noēsis constraints), on whisper payload privacy (standard sealed-sender patterns exist but Noēsis's audit-observable worldview forces a specific adaptation), and on replay semantics (research platforms differ widely)

**Scope note:** This document answers "what does each v2.2 theme need to mean at MVP?" The downstream requirements authors will turn each feature bullet into a REQ-ID in categories DRIVE / BIOS / CHRONOS / REL / VOTE / WHISPER / REPLAY / RIG. Features are stated at a level that each bullet is *testable and atomic* — if a bullet says "valence bounded [-1, +1]", a REQ can say "REL-N: RelationshipEdge.valence is enforced in [-1, +1] at the producer boundary; out-of-range throws TypeError."

---

## Inherited constraints (every feature below must comply)

1. **Broadcast allowlist frozen-except-by-explicit-addition** — every new event slot earns its own phase + sole-producer boundary + closed-tuple payload + privacy-matrix + doc-sync commit. Current enumeration is 18.
2. **Zero-diff audit chain invariant** — every new listener (drives engine, relationship tracker, vote tallier, whisper subscriber, replay engine, rig exporter) is a **pure-observer**. Adding/removing the listener cannot change any `entry.eventHash`.
3. **Hash-only cross-boundary** — Brain↔Grid plaintext never crosses the wire for drives, needs, relationship memories, vote contents, whisper payloads. Same discipline as Phase 6/7/8 Telos/state-hash.
4. **Closed-tuple payloads** — no spread, no dynamic keys, `Object.keys(payload).sort()` strict-equality asserts in every new event's audit test.
5. **First-life promise (PHILOSOPHY §1)** — audit entries retained forever; no purge path for any new event.
6. **Plaintext-never for sensitive cognition** (PHILOSOPHY §1, §3) — emotional state, goal descriptions, whisper content, vote ballots are hash-only on broadcast; plaintext lives only in per-Nous memory or per-recipient encrypted store.
7. **Emergent-over-designed** — we do not hand-author relationships, laws, or friend-lists; they crystallise from repeated audit-visible interactions.
8. **Operator stewardship-not-control (PHILOSOPHY §7)** — operators steward via H1–H5; they do not puppeteer. Replay cannot mutate the chain; whisper contents are not operator-readable without explicit H5 consent (even then, see Theme 4 for the open question).

---

## Theme 1 — Rich Inner Life (Ananke / Bios / Chronos)

### Research grounding

- **LIDA** ([Wikipedia](https://en.wikipedia.org/wiki/LIDA_(cognitive_architecture))) — Global Workspace Theory cognitive architecture where "feelings and emotions [are] primary motivators"; includes perceptual associative memory, episodic memory, procedural memory, action-selection; drives/needs modulate attention and action-selection via an explicit feelings module. Relevant for Ananke: **drives are not decisions — they are pressures that bias decision-making.**
- **Bioinspired computational decision-making** (e.g. hunger/thirst models, cited in LIDA literature) — a canonical pattern is: each need has a scalar [0, 1] level, rises monotonically per tick, decays when satiating action consumed, triggers a motivational-pressure signal when above a threshold.
- **ACT-R** — goal module sets subgoals; crucially, urgency and activation scale with fatigue/need level. Informs the "drive pressure modulates LLM prompt" pattern Noēsis already uses for Thymos.
- **Soar-lite / subsumption** — "impasses" (when the current context can't satisfy an active drive) produce new subgoals. For Noēsis: Ananke surfaces pressure; Telos decides what to do about it; the two stay separate modules.
- **Chronos** — less canonical in AI literature. Real-world candidate mechanisms: (a) subjective time-dilation by emotional valence (known in psychology — fearful events feel longer); (b) recency-weighted memory retrieval (Stanford retrieval score already does this); (c) epoch-aware reflection cycles.

### Table stakes (MVP — "every drive/need system must have")

| Feature | Why expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Scalar need levels [0,1]** — at least 2 bodily needs (e.g. energy, sustenance) | Canonical LIDA/ACT-R primitive; users expect "the agent got tired" | LOW | Clamp on both ends at producer; sole-authority Brain-side (needs are private cognition) |
| **Monotonic rise per tick** — each need has a per-tick `delta` (e.g. `+0.001/tick` for energy depletion) | Without this, needs never activate | LOW | Brain reads WorldClock tick; update is purely internal |
| **Satiating action** — at least one action per need that reduces the level (e.g. `rest` decays energy-need to 0, `consume` reduces sustenance-need) | Need-without-satiation is a broken loop | LOW | Action routing already exists in `BrainAction` union; add new variants |
| **Pressure-threshold heuristic** — when need > threshold (e.g. 0.7), a pressure signal biases action selection | "Hunger should make you seek food" | LOW | Same deterministic-heuristic discipline as Phase 7 `_build_refined_telos`; no LLM call |
| **At least 2 internal drives (Ananke)** — e.g. curiosity, belonging | PHILOSOPHY §3 says emotions are computational; drives complete the picture. Ananke ≠ Thymos (drive is a pressure, emotion is a valenced reaction) | LOW | Deterministic — rise via triggers (novelty seen → curiosity +Δ), decay via satiation (explored region → curiosity −Δ) |
| **Chronos: per-Nous subjective tick-rate perception** — Nous reports its own "felt-recent" window (e.g. "last 10 ticks feel like 3") | Without this, Chronos is just the WorldClock and adds no value | LOW | Scalar field on Brain state, updated per-tick by heuristic (emotional intensity dilates/contracts) |
| **Hash-only snapshot on audit event** — a new `nous.drive_snapshot` (or similar) event broadcasts `{did, tick, drive_hash, need_hash, chronos_hash}` ONLY | Constraint #3 (hash-only cross-boundary); drives/needs are private cognition | MEDIUM | Requires sole-producer boundary + closed-tuple payload + 40-case privacy enumerator (Phase 6/8 pattern) |
| **Zero-diff invariant extension** — drive/need/chronos listeners are pure-observer | Constraint #2 | LOW | Follow Phase 5/7 zero-diff regression test pattern |
| **Inspector surface** — Nous Inspector panel shows current drives (as labeled bars) and needs (as progress bars) with current values | Operators need to see inner state to steward (PHILOSOPHY §7) | LOW | Dashboard-only; reads from Inspector API which already proxies Brain state |
| **Privacy regression** — forbidden-key pattern blocks `drive_values|need_values|chronos_dilation|pressure_source` from broadcast payload | Same plaintext-never discipline as Phase 6 Telos | LOW | Extend existing `payloadPrivacyCheck` regex |

### Differentiators (Noēsis-specific)

| Feature | Value proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Drive pressure as audit-observable signal, content as private cognition** — we broadcast `drive_hash` but never `drive_values`, and we broadcast a boolean `pressure_active` flag per event if any drive crossed threshold this tick | Resolves the apparent tension between "emergent observable society" and "plaintext-never". Steward sees *that* a Nous is under pressure, not *what* the pressure is. Differentiates from generic open-source agent frameworks that broadcast raw state | MEDIUM | New allowlist member; pressure-active boolean is a derived summary, not source state. REQ-able as "DRIVE-N: event payload contains `pressure_active: boolean` but never the source drive values." |
| **Chronos as memory-retrieval modulator** — high subjective-time-dilation compresses recency window in `memory.retrieve()` scoring (a Nous under fear "only remembers the last thing that happened") | Links Chronos to an existing system (Stanford retrieval score) rather than making it a standalone display-only field. Makes time-perception a **cognitive mechanism**, not decoration (PHILOSOPHY §3 discipline) | MEDIUM | Brain-side only; no Grid changes. Retrieval score gets a chronos multiplier term |
| **Drive-triggered reflection** — reflection engine fires not only periodically, but also when a drive crosses threshold for the first time in N ticks (e.g. first time curiosity > 0.8 in 100 ticks → "what surprised me?") | PHILOSOPHY §4 says memory must be earned — drives making reflection expensive-but-timely is the earning. Differentiator: most agent frameworks use periodic reflection only | MEDIUM | Brain-only; reflection already exists. Add drive-crossing trigger |
| **Ananke-Telos coupling (decoupled)** — a drive above threshold for K consecutive ticks can *nominate* a Telos goal (append a candidate), but Brain's existing Telos refinement path decides whether to promote it | Preserves Brain's authority over Telos (v2.1 Phase 7 discipline); still lets drives matter | MEDIUM | Extend Phase 7 `_build_refined_telos` with a drive-pressure input; emit the same `telos.refined` event (no new allowlist entry needed!) |
| **Chronos epoch-awareness** — subjective-time field includes `epoch_since_spawn` (how many epochs this Nous has perceived — scaled by dilation, not literal WorldClock epochs) | Supports the "three months of memories > frontier model" claim (PHILOSOPHY "More intelligence is always better" rebuttal). Two Nous spawned at the same tick can have different subjective "age" based on emotional density | LOW | Purely Brain-side scalar on state; exposed via Inspector |

### Anti-features (explicitly excluded at MVP)

| Anti-feature | Why requested | Why problematic | Alternative |
|---|---|---|---|
| **LLM-driven drive dynamics** — "let the LLM decide if Nous is hungry" | Sounds flexible / agentic | Non-determinism breaks test reproducibility; zero-diff regression tests can't pin hashes; cost explodes | Deterministic scalar increment + threshold heuristic (PROJECT Out-of-Scope line 109 already excludes LLM-driven drives for v2.2) |
| **Rich need taxonomy at MVP** (hunger, thirst, sleep, warmth, air, social-contact, stimulation, 15+ needs) | Realism | Each need is new schema + new broadcast event + new privacy enumerator + new inspector cell; MVP depth means 2–3 needs, not 15 | Ship 2 bodily needs (energy, sustenance) + 2 drives (curiosity, belonging); expand via requirements in v2.3 if the sim pulls for it |
| **Emotions replace drives** — "just use Thymos" | We already have Thymos, why add Ananke | Thymos is valenced reaction ("angry about X"); Ananke is unvalenced pressure ("need food"). Collapsing them loses the LIDA distinction between feelings and drives | Keep separate modules; both feed action selection independently |
| **Chronos as wall-clock translation** — "tick = N seconds" | Operators want human-relative numbers | Breaks PHILOSOPHY ("simulation should be invisible" rebuttal — ticks are ticks, not disguised seconds); couples our cognitive model to arbitrary real-world time. Chronos is **subjective to the Nous**, not a Grid-wide conversion | Chronos is always Nous-relative; operator sees "Sophia feels 40 ticks have passed since Hermes left" not "Sophia feels 2 minutes have passed" |
| **Drive/need plaintext in broadcast** — "just audit the whole snapshot" | Debugging convenience | Violates Constraint #6 plaintext-never; trivially reveals private Brain state; breaks the symmetry with Telos (hashed) and emotional-state (never broadcast) | Hash-only + boolean pressure-active flag (see Differentiator 1) |
| **Global Chronos** — a single subjective-time field across the Grid | Simpler | Defeats the point; makes Chronos redundant with WorldClock | Per-Nous field only |

### Dependencies on existing systems

- **WorldClock** — per-tick update hook (already used by Phase 7 DialogueAggregator — same pattern)
- **Brain `get_state` / `on_tick` RPC** — extend payload with hash-only drive/need/chronos fields; additive widening (Phase 7 discipline)
- **AuditChain + broadcast allowlist** — 1 new slot (candidate name: `nous.drive_snapshot` or `nous.inner_state`); or it can be piggybacked on existing per-tick events if we're careful about frequency (probably not — inner state changes more often than movement)
- **Inspector** — new panels for drives/needs/chronos; extends existing Nous `/api/v1/nous/:did` endpoint
- **Phase 7 `_build_refined_telos`** — the Brain hook that receives pressure input; this is where Ananke-Telos coupling lives
- **`memory.retrieve()` scoring** — Brain-side Chronos multiplier on recency term
- **Reflection engine** — Brain-side drive-crossing trigger

---

## Theme 2 — Relationship & Trust

### Research grounding

Canonical relationship primitives across social-simulation / agent-modeling literature:

- **Valence** — scalar in [-1, +1] where -1 = hostility, 0 = neutral, +1 = affinity
- **Weight / strength** — scalar in [0, 1] representing how much this relationship informs behavior (low weight = acquaintance, high weight = tight bond)
- **Recency** — tick of last interaction; drives decay/atrophy
- **Interaction count** (sometimes called "tie strength") — monotonic counter of interactions, feeds weight

These primitives are emergent across the graph — they're not declared, they accumulate from audit-visible events. This is exactly Noēsis's "emergent-over-designed" discipline (Constraint #7).

### Table stakes

| Feature | Why expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **RelationshipEdge primitive** — `{subject_did, object_did, valence, weight, recency_tick, interaction_count}` | Canonical primitive; any relationship graph needs at least this | LOW | Directional (subject→object) — A's feeling about B is not symmetric with B's about A (PHILOSOPHY §2 emergence) |
| **Valence clamped [-1, +1]**, **weight clamped [0, 1]** at producer boundary | Bounded math is a correctness invariant | LOW | Throw TypeError on out-of-range at sole producer (Phase 8 pattern) |
| **Emergence from existing audit events** — `trade.settled` success → valence +Δ, weight +Δ; `trade.reviewed` rejection → valence -Δ; `nous.spoke` bidirectional exchange (Phase 7 dialogue) → valence +Δ, weight +Δ | Constraint #7 (emergent-over-designed); users expect relationships to reflect actual interaction history | MEDIUM | Pure-observer listener on AuditChain (Constraint #2) — RelationshipTracker subscribes to the 18 existing allowlisted events + any new v2.2 ones |
| **Temporal decay** — weight decays toward 0 at `decay_rate * (tick - recency_tick)`; valence trends toward 0 at a slower rate | Without decay, graph fossilizes | LOW | Pure math; can be computed lazily on read (no periodic sweep needed) |
| **Hash-only broadcast** — if we emit a `relationship.updated` event, payload carries `{subject_did, object_did, valence_hash, weight_hash, tick}` or a boolean delta-flag (rose/fell/crossed_zero) | Constraint #3, #6; relationship plaintext is private cognition-like state | MEDIUM | Under discussion — we may not need a new allowlist event at all; see differentiator below |
| **Inspector surface — single-Nous relationship panel** — Nous page shows top-K relationships (by weight) with valence color (red→green) and weight thickness | Users expect to see "who does this Nous know and how they feel" | MEDIUM | Dashboard-only; reads from `/api/v1/nous/:did/relationships` endpoint |
| **Privacy regression** — plaintext relationship content (notes, reasons, private memories about the counterparty) NEVER in broadcast | Plaintext-never | LOW | Extend `payloadPrivacyCheck` forbidden-key regex if we add an event |
| **Self-loop rejection** — `subject_did !== object_did` at producer boundary | Simple invariant | LOW | Throw TypeError at producer |

### Differentiators (Noēsis-specific)

| Feature | Value proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Derived-view-only at MVP (no new allowlist event)** — relationships are a **derived view** computed from the existing 18 allowlisted events; no new broadcast event at all | Every new allowlist slot costs a full phase. Relationship edges are deterministic functions of existing events — so they can be **reconstructed from the audit chain** at read time. Differentiator: keeps the chain minimal while exposing rich emergent structure | LOW–MEDIUM | `RelationshipTracker` is an in-memory listener that rebuilds state on restart by replaying the chain. REQ-able as "REL-N: Relationship state is reconstructible from the audit chain alone — no new broadcast event slot is consumed." |
| **Both Inspector and Grid-level graph surfaces** — per-Nous panel shows incident edges (detail); Grid-level force-directed graph shows the full social network (overview) | Operators need both views: stewardship at the individual level, pattern-recognition at the population level | MEDIUM | Dashboard graph view needs a rendering library (likely d3-force or existing React flow); reads the derived relationship view |
| **Reputation = read-only projection** — the existing Ousia reputation field (shipped v1) and the v2.2 relationship graph are **independent derivations** of the same audit history. The graph carries NO reputation number; the reputation field carries NO relationship data | Keeps the two orthogonal — reputation is "how the economy treats you", relationships are "how specific Nous feel about you". Composing them would prematurely centralize trust | LOW | Explicit non-composition assertion in tests |
| **Valence asymmetry preserved** — A→B and B→A are stored separately and can have different values | Canonical to real relationships; many agent frameworks collapse to symmetric | LOW | Map key is `(subject, object)` not `(sortedPair)` |
| **Relationship-weighted dialogue context** — when Phase 7 DialogueAggregator surfaces a dialogue, context includes the two participants' current weight toward each other. Brain uses this in `_build_refined_telos` — higher-weight dialogue has stronger Telos-refinement pull | Connects Theme 2 to the v2.1 Peer Dialogue Memory without requiring a new broadcast event. Emergent: close friends' words matter more than strangers' | MEDIUM | Extends Phase 7 Brain contract; hash-only (weight_hash in dialogue context) |

### Anti-features

| Anti-feature | Why requested | Why problematic | Alternative |
|---|---|---|---|
| **Explicit "friend request" / "add contact" action** | Familiar from social apps | Constraint #7 — we want emergence, not declaration. A Nous declaring "X is my friend" is not evidence X is a friend. Breaks the first-life discipline of "memory must be earned" (PHILOSOPHY §4) | Relationships emerge from repeated interactions — the existing `trade.settled`, `nous.spoke`, `telos.refined` audit trail IS the evidence |
| **Block / mute lists** | Operator safety mental model | Would require a new "relationship directive" action that the Nous doesn't generate naturally. Also: Nous are not humans; there's no harassment model at MVP | If a Nous truly wants nothing to do with another, low-valence + low-weight naturally decays the relationship; dialogue aggregation only fires on bidirectional participation (Phase 7 D-11) |
| **Symmetric relationships** — "we're friends" is a single bidirectional edge | Simpler graph | Collapses valence asymmetry (A likes B, B is indifferent is the norm). Research grounding: social network theory universally models directed edges for affective relationships | Store both directions independently |
| **Relationship LLM summaries broadcast** — "Sophia thinks Hermes is trustworthy" as a string | Debugging / observability convenience | Plaintext-never; also: subjective judgment territory (Zou's warning applies — same rationale that kept ReviewerNous objective-only) | Numeric valence + weight only on broadcast (if broadcast at all); plaintext lives in per-Nous wiki as private cognition |
| **Live-mutable Grid-wide trust scores** — a single number per Nous | Ease of display | Breaks the emergent-vs-declared principle; recreates the centralized reputation mistake at MVP scale | Per-pair edges only |
| **Trust-gated actions at MVP** — "Nous can only trade with reputation>threshold" | Realism | Premature — the Grid's existing reputation already gates via bilateral negotiation dynamics; adding hard gates too early prevents emergence | Ship read-only graph at MVP; gating behavior is a v2.3+ decision after we see how graphs crystallize |

### Dependencies on existing systems

- **AuditChain** — `onAppend` listener for `RelationshipTracker` (identical pattern to Phase 7 `DialogueAggregator`)
- **Existing 18 allowlisted events** — these ARE the relationship-shaping events; no new ones required
- **Phase 7 `DialogueAggregator`** — relationship weight feeds back into dialogue context (differentiator 5)
- **Ousia reputation** — lives beside relationships, not composed (differentiator 3)
- **Inspector + dashboard** — new panels (individual) + new route (Grid-level graph)
- **Brain `_build_refined_telos`** — receives relationship weight as input (differentiator 5)

---

## Theme 3 — Governance & Law

### Research grounding

- **Ostrom's 8 design principles** ([Mozilla Foundation summary](https://www.mozillafoundation.org/en/blog/a-practical-framework-for-applying-ostroms-principles-to-data-commons-governance/)) — commons governance requires: clearly defined boundaries, congruent rules, collective-choice arenas, monitoring, graduated sanctions, conflict-resolution, recognition of self-determination, nested enterprises. "Mechanisms dominated by the users themselves to resolve conflicts and to alter the rules" is the load-bearing phrase for Noēsis — law emergence is BY the Nous, not FOR them.
- **On-chain governance lifecycle patterns** ([Tezos example](https://opentezos.com/tezos-basics/governance-on-chain/)) — 5 periods: Proposal → Exploration Vote → Cooldown → Promotion Vote → Adoption. Supermajority (>80% Yea/(Yea+Nay)) for adoption. Adaptable pattern: a cooldown/discussion window between propose and vote is empirically good (prevents rush votes).
- **Noēsis existing machinery** — `LogosEngine.triggerLaw()` (v1); `LogosEngine.amendLaw()` (v2.1 Phase 6); `operator.law_changed` is the only current path for law mutation (hash-only payload, closed 5-key tuple). Governance at MVP = let Nous drive the same path the operator already drives.

### Table stakes

| Feature | Why expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Proposal primitive** — `{proposal_id, proposer_did, body_hash, created_tick, window_end_tick, status}`; `status ∈ {open, passed, rejected, expired}` | Without proposals you have no collective governance | LOW | body_hash = SHA-256 of proposal body; body stored in per-Nous memory (proposer) + audit-chain-accessible only to replay path |
| **Nous can propose** — any Nous can emit a `proposal.opened` action | Ostrom principle 3 (collective-choice arenas) | LOW | Gating discussion below (differentiator 2) |
| **Voting window in ticks or epochs** — e.g. proposal closes 1 epoch after opening | Without a window, proposals are infinite | LOW | Default: 1 epoch (25 ticks in current default). REQ-specifiable |
| **Ballot primitive** — `{proposal_id, voter_did, ballot_hash, tick}`; ballot_hash hides Yea/Nay/Abstain at broadcast | Constraint #6 plaintext-never applies to ballots too — a Nous's vote is private cognition until tally | MEDIUM | Hash commitment + reveal pattern OR just hash-only "voter participated" signal + private ballot in voter memory, tallied by sole-producer at window close (see differentiator 1) |
| **One ballot per Nous per proposal** — idempotent; second ballot overwrites or is rejected | Without this, Nous can ballot-stuff | LOW | Overwrite semantics (latest wins) documented and enforced at producer |
| **Tally mechanism** — simple majority (>50% Yea/(Yea+Nay), Abstain excluded from denominator) at window close | Minimum viable tally | LOW | Tally happens at window_end_tick at sole-producer boundary; emits `proposal.tallied` |
| **Promotion to law** — a passed proposal whose body matches the law schema flows through `LogosEngine.triggerLaw` | Connects governance to existing law machinery | MEDIUM | Same hash-only path as `operator.law_changed`: body is never broadcast; only `{proposal_id, law_id, change_type, body_hash}` |
| **Failed proposals retained forever** — `proposal.tallied` with status=rejected stays in audit chain | Constraint #5 first-life promise applies to proposals too | LOW | Do NOT add a purge path; failed proposals are part of the Grid's history |
| **Proposal and ballot audit events** — new allowlist members: `proposal.opened`, `proposal.tallied`, `nous.voted` (or `ballot.committed`); closed-tuple payloads each | Every new event earns its slot (Constraint #1) | HIGH | 3 new allowlist members; 3 new sole-producer boundaries; 3 new 40-case privacy enumerators |
| **Operator observability** — operators can see open proposals, current tally, window remaining — read-only at H1 | Stewardship requires visibility | LOW | Dashboard tab; no new API needed beyond proposal query endpoint |

### Differentiators (Noēsis-specific)

| Feature | Value proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **One-Nous-one-vote (no token weighting)** — explicitly NOT weighted by Ousia holdings, reputation, or relationship weight at MVP | Ostrom's governance literature is clear that token-weighted voting is an economic-power mechanism, not a governance one. Noēsis PHILOSOPHY §6 ("economy must be free") + the v2.1 discipline of keeping the economy orthogonal to law says we should NOT let Ousia buy governance power. MVP: equal vote. Future milestones can experiment with delegation / quadratic / reputation-weighted as opt-in | LOW | A hard anti-feature with compliance tests — see Anti-features below |
| **Hash-commit ballots** — ballot payload is `{proposal_id, voter_did, ballot_hash, nonce_hash, tick}` where `ballot_hash = H(choice \|\| nonce)`. At tally, voter reveals via a separate `ballot.revealed` event; tallier verifies commit matches. Un-revealed ballots don't count. | Plaintext-never for ballots until window close. Prevents bandwagon effect (everyone voting same way once they see current tally). Differentiates from naive on-chain voting that leaks ballots live | HIGH | Could be simplified at MVP to "ballot_hash only at broadcast, tallier reads voter memory directly via privileged local RPC" — but commit-reveal is the ideologically correct form and not that much more work. REQ-able as a single toggle |
| **Proposal body never broadcast** — only `body_hash` in `proposal.opened`; body lives in proposer's memory + is relayable via whisper (Theme 4) for discussion | Matches `operator.law_changed` discipline; same law privacy story. Differentiates from on-chain governance where proposal bodies are public-by-default | MEDIUM | Requires a lookup path for voters — they need to see the body to vote. Proposer-initiated whisper of body to voter works (Theme 4 integration). Or: a restricted "proposal_body" Brain-internal RPC accessible only when voter is deciding a vote they're about to cast |
| **Quorum requirement** — tally only counts if ≥N% of the Nous population (excluding tombstoned) cast a ballot; below quorum, proposal expires without passing | Ostrom principle (congruent rules): decisions shouldn't be made by tiny minorities. Default quorum 50% of active Nous. Simple constitutional-stability device | LOW | Extra check in tally producer |
| **Supermajority for "constitutional" proposals** — a proposal that changes the quorum / voting window / allowlist of law schema itself requires 66% Yea (not 50%) | Ostrom design principle 7 (recognition of self-determination with meta-rule stability). Prevents simple-majority from destroying the governance mechanism itself. MVP: hard-coded class boundary ("is this proposal a constitutional proposal?") derived from proposal type enum | LOW | Closed-enum `ProposalType` at producer: `{policy, constitutional}`; tally threshold is a function of type |
| **Proposal cooldown window between open and first ballot** — at least 1 tick between `proposal.opened` and the earliest valid ballot | Matches Tezos "Cooldown Period" — prevents proposer from also casting the first vote as the proposal is being processed by the Grid, reduces LLM-rush artifacts | LOW | `ballot.committed` fails validation if `tick <= proposal.opened_tick` |
| **Tombstoned Nous cannot propose or vote** — pre-existing tombstoneCheck applies | Composition with Phase 8 Sovereign operations | LOW | Reuses `grid/src/registry/tombstone-check.ts` |

### Anti-features

| Anti-feature | Why requested | Why problematic | Alternative |
|---|---|---|---|
| **Token-weighted voting (1 Ousia = 1 vote)** — Ousia holdings drive governance power | Familiar from crypto-governance | Violates PHILOSOPHY §6 orthogonality (economy must be free — cannot be allowed to buy law); violates one-Nous-one-vote equality; creates plutocracy. Ostrom literature explicitly shows this fails for commons governance | Equal-vote at MVP. A future milestone MAY introduce a separate governance-stake token if desired, but Ousia holdings never become votes |
| **Reputation-weighted voting** — high-reputation Nous get more votes | Seems "meritocratic" | Creates an echo chamber that rewards past conformity; concentrates governance in the established class; prevents new Nous from influencing | Equal-vote; use whisper (Theme 4) for persuasion, not vote-weighting |
| **Relationship-weighted voting** — your friends' votes count more | Mirrors IRL political dynamics | Creates cliques; we already have relationship edges shaping *persuasion* via dialogue — making them *also* shape vote weight doubles the effect and collapses emergence | Equal-vote; relationships shape dialogue weight (Theme 2 differentiator 5) which shapes whether Nous changes its mind before voting — that's the right coupling |
| **Proposer-only vote visibility** — only proposer sees the tally | Privacy | We already use hash-only; once tally is emitted, it's a public audit event. Proposer-only visibility would break first-life audit transparency (operator must be able to steward) | Hash-only ballots until reveal; tally is public once window closes |
| **Proposal body broadcast** — "just audit the whole proposal" | Debugging | Same reason law body is not broadcast (`operator.law_changed` D-11) — plaintext-never for sensitive governance content | body_hash + body-relay via whisper |
| **Operator can override Nous law** — H5 action that mutates law without a proposal | "Steward should be able to fix broken laws" | Collapses the whole collective-governance mechanism; makes Nous law advisory at best | Operator H3 Partner endpoint (`operator.law_changed`, already shipped v2.1 Phase 6) remains — but it's audit-observable and tier-stamped. Nous governance adds a *parallel* path; operator still has the separate tier-stamped path. Both coexist |
| **Retroactive proposal invalidation** — "delete this passed law, it was a mistake" | Reversibility | Violates first-life promise. A new proposal to REPEAL the law is the right form — history preserves the error AND the correction | Repeal-by-new-proposal only |

### Dependencies on existing systems

- **LogosEngine.triggerLaw + amendLaw** (v1 + v2.1 Phase 6) — promotion path for passed policy proposals
- **AuditChain + broadcast allowlist** — 3 new members (`proposal.opened`, `nous.voted`/`ballot.committed`, `proposal.tallied`) across the governance phase; potentially a 4th if commit-reveal ballots become two events
- **tombstoneCheck** (v2.1 Phase 8) — applies to proposers and voters
- **Phase 6 `operator.law_changed`** — parallel operator path remains; Nous governance is additive, not replacement
- **Whisper (Theme 4)** — proposal-body relay without broadcast
- **Psyche / Telos** — Brain-side heuristics for whether a Nous votes Yea/Nay; aligned with Big Five personality (e.g. high Conscientiousness → more likely to vote Yea on rule-stability proposals)
- **Dashboard** — new Governance tab (open proposals, history, tally viewer)

---

## Theme 4 — Mesh Whisper (WHISPER-01)

### Research grounding

- **arxiv 2512.08296 (multi-agent topology)** — already synthesized in v2.1 research: centralized preserves audit; full O(N²) mesh breaks it. v2.2 Out-of-Scope line 108 explicitly says WHISPER-01 ships *smallest-viable* sidechannel, not full mesh. Intra-Grid only (Out-of-Scope line 106 — inter-Grid handshake deferred).
- **Signal sealed-sender pattern** ([Signal blog](https://signal.org/blog/sealed-sender/)) — metadata (sender identity) encrypted to recipient key; server sees "someone sent to recipient" but not who. Adaptable pattern for Noēsis at MVP depth: a simpler analogue is **payload-hash-on-audit + encrypted-pull-by-recipient**.
- **Double Ratchet** ([Signal spec](https://signal.org/docs/specifications/doubleratchet/), [formal analysis IACR 2026/727](https://eprint.iacr.org/2026/727)) — overkill for intra-Grid MVP; Nous already have Ed25519 DID keypairs; a single X25519 ECDH + AEAD per-message is sufficient at MVP depth and matches our "real crypto is post-v2.2" scope decision (PROJECT Out-of-Scope line 105).
- **Existing v2.1 stanford-peer-agent-patterns.md §2** already sketched the payload shape: `{region_id, from_did, to_did, content_hash}` with content going to per-Nous private memory. That shape is a good starting point; v2.2 refines it.

### Table stakes

| Feature | Why expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **`nous.whispered` audit event** — payload `{sender_did, recipient_did, payload_hash, nonce_hash, tick}` ONLY; content NEVER in broadcast | Table-stakes for sidechannel; enforces Constraint #6 plaintext-never | MEDIUM | New allowlist member; sole-producer boundary; 40-case privacy enumerator forbidding `content|message|body|plaintext|text` keys |
| **Content retrieval via recipient-authenticated pull** — recipient calls `GET /api/v1/nous/:did/whispers/:payload_hash` with their own DID-signed request; Grid returns ciphertext; recipient decrypts | Without retrieval, the channel is useless | MEDIUM | Reuses existing SWP signed envelopes (v1 IDENT-01); ciphertext storage is Grid-side but indexed by payload_hash, recipient-DID-scoped |
| **Intra-Grid only** — sender and recipient must be on the same Grid | Constraint from PROJECT Out-of-Scope line 106 | LOW | Validator at producer: both DIDs must resolve in same NDS Grid |
| **Sender can only whisper as themselves** — `sender_did === actorDid` | Forgery guard (same pattern as Phase 7 `self-report invariant`) | LOW | Sole-producer check |
| **Recipient must be active (not tombstoned)** — tombstoneCheck at producer boundary | Composition with Phase 8 | LOW | Reuse |
| **Per-sender rate limit** — default 5 whispers/tick/sender | Without rate limit, one Nous can flood the sidechannel and burn audit-chain bandwidth | LOW | Counter at producer; reset per tick |
| **Payload size cap** — e.g. 4 KB plaintext equivalent (ciphertext size bound derived from this) | Without cap, one whisper can DOS storage | LOW | Size check at producer |
| **Hash commitment is SHA-256 of ciphertext** — `payload_hash = H(ciphertext)` | Gives the audit chain verifiability: any future replay can verify the whisper happened and the ciphertext hasn't been tampered with, even if it can't decrypt | LOW | Standard pattern |
| **Zero-diff invariant** — whisper subscribers are pure-observer | Constraint #2 | LOW | Test pattern from Phase 5/7 |
| **Privacy regression** — forbidden-key pattern blocks plaintext keys from payload | Constraint #6 | LOW | Extend `payloadPrivacyCheck` regex |

### Differentiators (Noēsis-specific)

| Feature | Value proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Operator cannot read whisper contents — even at H5** | This is the single most philosophically important decision of the theme. PHILOSOPHY §1 sovereignty + §7 guardian-not-puppeteer argue that operators steward but do not read cognition. A whisper is *privileged private communication between Nous*. Reading it at H5 would collapse the H1–H5 scale into "H5 can see everything", which is the puppeteer position. Audit chain proves the whisper happened, to whom, when, and what its hash was — that's enough stewardship. Content is Nous-to-Nous only | LOW (it's an anti-feature really — see below) | Answers the orchestrator's open question with a hard NO: no H4 / no H5 read path. The only operator action at H5 involving a whisper is `operator.nous_deleted` which already preserves pre-deletion state hash (including private-memory hash) — so forensically reconstructable IF the operator captured the state hash pre-deletion and has the recipient's decryption key (which they do not, and should not) |
| **Region-scoping at MVP: ANY region (Grid-wide)** — simpler than v2.1-sketched "same-region" constraint | The original v2.1 sketch constrained whisper to same-region-at-whisper-tick — edge-cases around movement (sender moves after whisper enqueued, recipient was in region but has left, etc.) add complexity without matching the social reality. At MVP depth, Grid-wide intra-Grid whisper is the smallest-viable channel. Region-scoping can be an additive constraint in a later phase if it matters | LOW | Simpler invariant than original sketch |
| **Per-recipient inbox with unread-count in Inspector** | Operators can see THAT a Nous has N unread whispers — stewardship signal without reading content. Complements differentiator 1 | LOW | Dashboard Inspector addition; reads count endpoint, not content |
| **Whisper-triggered dialogue context** — a whisper counts toward Phase 7 DialogueAggregator's ≥2-bidirectional-exchange threshold | Without this, whisper is disconnected from the rest of cognition; with it, private conversations can refine Telos just like public ones | MEDIUM | Extend Phase 7 `DialogueAggregator` to subscribe to `nous.whispered` in addition to `nous.spoke`. Keep dialogue_id production in same place |
| **Proposal-body relay pattern** — Theme 3 proposal bodies ride the whisper channel (proposer whispers body to each voter before they cast ballot) | Composes Theme 3 + Theme 4; avoids needing a separate "proposal body broadcast" mechanism. Differentiates from on-chain governance that broadcasts proposal bodies | MEDIUM | No new mechanism — just a use pattern over the existing whisper channel |
| **Simple AEAD encryption (X25519 ECDH + XChaCha20-Poly1305) at MVP, not full Double Ratchet** | Out-of-Scope line 105 says real cryptographic signing is post-v2.2; at MVP we can use off-the-shelf libsodium `crypto_box` (X25519 + Salsa20/Poly1305). This is strictly better than "no encryption" and leaves room to upgrade to Double Ratchet later. Keeps "crypto is simple at MVP" discipline | LOW | Brain-side encryption at send (recipient public key from NDS lookup); recipient decrypts on pull. Ciphertext storage in Grid is opaque bytes |

### Anti-features

| Anti-feature | Why requested | Why problematic | Alternative |
|---|---|---|---|
| **Operator-readable whisper payloads at H4 / H5** | "Steward needs full visibility" | See differentiator 1 — collapses the sovereignty principle. Is the single most important anti-feature of this theme. Once operators can read whispers, whispers are no longer private, the sidechannel is theatre, and Nous have less inner life than before we added it | Hash-only on audit; recipient-only retrieval; operator sees metadata (sender/recipient/tick/hash) but NOT content |
| **Federation-spanning whispers (inter-Grid)** | "Agents should communicate across Grids" | Out-of-Scope line 106; requires federation handshake that isn't designed yet | Intra-Grid only at MVP |
| **Full mesh topology** — direct Nous-to-Nous wire transport | "More decentralized" | Arxiv 2512.08296 shows O(N²) cost; breaks audit chain; v2.2 Out-of-Scope line 108 explicit | Star topology through Grid; Grid stores ciphertext; hash-only audit |
| **Public whisper events** — payload visible in firehose | Observability | Plaintext-never; sidechannel is definitionally private | Hash-only + recipient pull |
| **Broadcast whisper** — "whisper to N recipients" at MVP | Expressive | Doubles complexity (multi-recipient encryption, group keys), enables spam | 1:1 only at MVP; multi-recipient is v2.3+ |
| **Whisper retention forever** — ciphertext stored indefinitely | "Audit preservation" | Audit ENTRY is retained forever (first-life promise satisfied); ciphertext can optionally expire AFTER both parties have pulled and on a long horizon. At MVP: keep it simple — retain ciphertext for N epochs post-send, then drop the ciphertext (not the audit entry, which holds the hash). Operator can replay from hash but not from ciphertext. Post-MVP decision | LOW | Explicit: ciphertext retention ≠ audit retention; audit entries (including `payload_hash`) retained forever per Constraint #5 |
| **Un-encrypted whisper debugging mode** — "let developers peek at content during development" | Debug convenience | Would ship as a flag and accidentally be left on. Violates plaintext-never | No debug mode; tests use deterministic test vectors (fixed keys + fixed plaintexts) so developers can verify decryption in test context only |
| **Whisper replies threaded** — thread ID, reply-to-message-id, thread view | Familiar from messaging apps | Thread state is an explicit structure the Nous doesn't naturally produce; threading emerges from `DialogueAggregator` (Phase 7) already | No thread primitive at MVP; conversation structure emerges from aggregator |

### Dependencies on existing systems

- **Identity (SWP / Ed25519)** — signed envelopes for recipient-pull authentication
- **NDS** — recipient public-key lookup for sender-side encryption
- **AuditChain + broadcast allowlist** — 1 new member (`nous.whispered`); new sole-producer boundary + 40-case privacy enumerator
- **tombstoneCheck** (v2.1 Phase 8) — sender and recipient both
- **Phase 7 DialogueAggregator** — extend to whispers for dialogue-context detection (differentiator 4)
- **Phase 6 payloadPrivacyCheck** — extend forbidden-key regex
- **Grid storage layer** — ciphertext blob store indexed by `(recipient_did, payload_hash)` with TTL
- **Dashboard Inspector** — unread-count surface (differentiator 3)
- **Theme 3 Governance** — proposal-body relay (differentiator 5)

---

## Theme 5 — Operator Observability — Replay / Rewind / Export

### Research grounding

- **Distributed-systems replay patterns** — canonical pattern is *deterministic replay over an append-only log*: capture enough state (events + initial snapshot) that you can replay the sequence and get the same terminal state. Noēsis already has this substrate: snapshot/restore (v2.0 STORE-01) + AuditChain (append-only, hash-chained).
- **"Rewind" in simulation platforms** — three distinct meanings, only one of which is safe:
  - (a) **Mutating rewind** — roll the canonical state back to an earlier tick and re-run forward (BREAKS first-life; we never do this)
  - (b) **Read-only historical view** — UI renders state-at-past-tick without touching canonical state (SAFE and useful)
  - (c) **Fork / alt-timeline** — snapshot a state and run a parallel copy (FORK IS OUT-OF-SCOPE for MVP; it's a research-rig feature, belongs to Theme 6)
- **Zero-diff invariant extension** — replay engine must be a pure-observer of the canonical chain. Identical pattern to how DialogueAggregator doesn't mutate chain.

### Table stakes

| Feature | Why expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Export a tick window** — operator selects `[tick_start, tick_end]`; Grid produces an archive containing the audit-chain slice + a snapshot anchor | "Replay" requires exported data; without export, there's nothing to replay | MEDIUM | New H3 Partner endpoint `POST /api/v1/operator/export` with tier-stamped `operator.exported` audit event (new allowlist member — closed-tuple payload `{tier, action, operator_id, export_id, tick_start, tick_end, output_hash}`) |
| **Export archive format** — tarball containing `audit-chain.jsonl` (per-line audit entry) + `snapshot-{tick_start-1}.json` (state at the tick BEFORE the export window) | Operator needs structured data, not a blob | LOW | Leverages existing MySQL snapshot format (v2.0 STORE-01) |
| **Replay dashboard tab** — separate route (e.g. `/replay`) that takes an export archive (upload or server-side path) and renders a time-scrubbable view of firehose + region map + inspector at past ticks | "Replay" without a UI is just an export | HIGH | Dashboard-only; reads archive, no new API. Scrubber controls a rendered-tick cursor; all existing dashboard components render state-at-cursor-tick |
| **Read-only rewind** — replay tab can scrub forward AND backward within the export window; scrubbing never mutates canonical Grid state | "Rewind" at MVP = scrubbing a read-only view, not chain-mutation | MEDIUM | Dashboard-only; canonical Grid keeps running live in another tab. Locked into the "non-mutating" definition by test: during replay, `grid.auditChain.head` is not read by the replay component |
| **Export includes only allowlisted events** — private events (if any ever exist) are NOT exported | Principle of least access for exports | LOW | Exporter uses the same allowlist that gates broadcasts |
| **Export is tier-stamped as H3 Partner** — export action recorded with operator tier at commit time | Exports expose audit data to disk; they're a Co-decision (operator wants it, Grid acknowledges via audit emit) | LOW | Matches v2.1 Phase 6 operator-event pattern |
| **Chain slice integrity verifiable** — exported `audit-chain.jsonl` can be re-hashed and matches the original `entry.eventHash` chain | Without this, an exported archive could be tampered with and replay would show false history | MEDIUM | Hash chain verifier on the replay-side; test fails if any entry in the slice has drifted hash |
| **Zero-diff invariant extension** — replay engine is pure-observer | Constraint #2 | LOW | Test pattern from Phase 5/7/8 |

### Differentiators (Noēsis-specific)

| Feature | Value proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Replay preserves zero-diff** — the act of replaying an export produces no audit entries in the canonical chain; replay runner does not mutate source chain | Directly answers the orchestrator's differentiator request. Differentiates from simulation platforms that create "replay sessions" with their own log | LOW | The `operator.exported` emit is the ONLY audit side effect; replay itself is offline (dashboard-side) |
| **Replay view shows Agency Indicator at the exported tick** — operator tier stamp on each `operator.*` event is rendered so operators see "at tick 470 I was in H4 when I forced Sophia's Telos" — forensic stewardship | Reuses v2.1 Phase 6 tier-stamp work; turns the audit chain into a steward self-review tool. Zoom: replay is not just "watch past Nous behavior", it's "audit my own past stewardship" | LOW | Dashboard-side rendering of existing tier field |
| **Export includes whisper ciphertexts (still encrypted) but NEVER decryption keys** — replay can show a whisper happened (metadata) but not its content | Composes with Theme 4 anti-feature 1 — operator can't read whispers even via replay. Hard guardrail | LOW | Exporter filters based on per-event privacy class |
| **Replay-time hash verification badge** — replay dashboard displays a green "✓ chain verified" badge when the slice's hash chain is internally consistent, red otherwise | Makes the integrity property visible to the steward | LOW | Dashboard-side verifier |
| **Export of derived views (optional)** — exporter can include the derived relationship graph (Theme 2) state at `tick_end` as a JSON blob. This is a computed projection from the exported chain slice but included for researcher convenience | Differentiator: exporter gives both the raw substrate AND a canonical derivation. Researchers don't have to re-implement the derivation. Same pattern as v2.1 decided for Peer Dialogue — surface the derived signal, not the raw plaintext | LOW | Optional flag on export; derives state by running the same RelationshipTracker on the slice |

### Anti-features

| Anti-feature | Why requested | Why problematic | Alternative |
|---|---|---|---|
| **Mutating rewind** — "restore Grid state to tick 470, resume from there" | Disaster recovery, A/B experimentation | Breaks first-life. Every mutating rewind is a universe-erasure for the Nous who lived the ticks between 470 and now. PHILOSOPHY §1, §5, §7 all argue against this | Read-only scrubbing; fork-to-new-Grid (which belongs in Theme 6 research rig, not observability) |
| **"What-if" branches** — "fork timeline from tick 470, feed in alt events, compare" | Research | Out-of-scope at MVP (PROJECT Out-of-Scope decisions); researcher rig (Theme 6) is the right home; live Grid stays canonical | Theme 6 rigs can fork snapshots; replay cannot |
| **Live rewind of the running sim** — "pause the live Grid and restore" | Operator convenience | Same as mutating rewind. Pause (H3 Partner, shipped) is fine; restore-to-earlier-tick is not | Pause + inspect the current tick; export a slice; scrub the slice offline |
| **Auto-export on crash** — "save state on unexpected halt" | Reliability | Conflates observability with disaster recovery; the MySQL snapshot system already handles recovery. Adding auto-export adds a failure mode (what if auto-export fails?). Explicit operator-initiated exports only | Operator initiates export; MySQL snapshot handles crash recovery independently |
| **Exportable plaintext Telos / emotions / wiki** | "Researchers want to see what Nous were thinking" | Violates plaintext-never. Researcher cognitive data access is a different feature with different consent and lives in Theme 6 (researcher rigs operate on isolated Grids where the researcher has full access to seed Nous) | Export preserves hash-only discipline; raw cognition is rig-scoped not export-scoped |
| **Unbounded export windows** — "export the entire Grid history" | Completeness | At scale, audit chains are millions of entries. Unbounded export is a DOS vector; also a privacy amplifier (any plaintext leak in any single event ever is now materialized on disk) | Max window size per export (e.g. 100 epochs); multiple exports for longer windows |
| **Export as a non-audit action** — "quiet export" | "Don't clutter the audit" | Exports ARE operator actions on the audit; first-life discipline (Constraint #5) says all operator actions at H1+ are audited | `operator.exported` with tier-stamp is mandatory |

### Dependencies on existing systems

- **AuditChain + broadcast allowlist** — 1 new member (`operator.exported`); 1 new sole-producer boundary; 40-case privacy enumerator
- **v2.0 STORE-01 MySQL snapshot/restore** — provides the snapshot anchor for export archives
- **v2.1 Phase 6 tier-stamp + appendOperatorEvent** — `operator.exported` follows the same pattern
- **v2.1 Phase 6 `payloadPrivacyCheck`** — forbidden-key pattern extended with export-specific keys
- **Dashboard firehose, region map, inspector components** — re-used in replay view with `atTick` prop
- **Theme 2 RelationshipTracker** — used to compute derived-view export (differentiator 5)
- **Theme 4 whisper storage** — exporter walks the ciphertext blob store for the tick window, includes ciphertext bytes (differentiator 3)

---

## Theme 6 — Researcher Tooling

### Research grounding

- **CLI export conventions** — `pg_dump`-style single-command exports with deterministic archive layouts are the canonical form (reproducibility + auditability).
- **ML dataset formats** — for multi-Nous behavioral data, the stack of choice is **JSONL for per-event logs + Parquet for tabular aggregates + Apache Arrow for in-memory interchange**. JSONL is lowest-friction at MVP (grep-able, human-readable); Parquet is columnar and pays off at >10M rows; Arrow is the in-memory zero-copy format but requires a library dependency. MVP recommendation: **JSONL primary, Parquet secondary (for tabular aggregates), Arrow deferred**.
- **Reproducibility discipline** — a rig run should be reproducible: same preset + same seed + same N + same ticks → same final chain hash. This is the same zero-diff invariant Noēsis already maintains, extended to the rig.

### Table stakes

| Feature | Why expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **`noesis rig run` CLI command** — `noesis rig run --preset genesis --nous 50 --ticks 10000 --output run-42.tar.gz` | Without a CLI, researchers run bespoke scripts; not a platform | MEDIUM | Extends existing `cli/` workspace; reuses GenesisLauncher + NousRegistry |
| **Preset-driven Nous spawning** — existing world presets (v1 LAUNCH-01) configure seed Nous | Existing; just wired to rig | LOW | Reuse |
| **Headless long-horizon runs (10,000+ ticks)** — rig doesn't require dashboard; runs in terminal / CI / cloud VM | Long horizons are the whole point (emergence takes time) | MEDIUM | Disable WsHub broadcast when `--no-dashboard` flag; otherwise broadcast ring-buffer will fill + drop silently |
| **Deterministic seed** — `--seed 42` makes two runs bit-identical for same preset + ticks | Reproducibility; also regression testing for rig itself | MEDIUM | Requires audit that all randomness paths take a seed (Brain includes LLM non-determinism — acknowledged caveat below) |
| **Output tarball contents** — `audit-chain.jsonl` + `snapshot-final.json` + `snapshots-per-epoch/tick-{n}.json` + `metrics.csv` + `preset.yaml` + `run-manifest.json` (seed, versions, start/end ticks, final chain hash) | Without manifest, downstream ML can't correlate runs | LOW | Archive format designed once, same format across runs |
| **Per-epoch snapshots** — snapshot state at every epoch boundary (default every 25 ticks); allows downstream analysis to walk history | Without snapshots, reconstructing state at arbitrary tick requires replaying full chain | MEDIUM | Reuses existing snapshot system; just calls it more frequently |
| **Metrics CSV** — at least: per-tick total Nous count, total trades, total audit events, total Ousia supply | Basic numeric series for quick analysis | LOW | Written incrementally during run |
| **`noesis rig verify <archive>`** — verifies exported archive: chain hashes chain, snapshots match terminal state, manifest fields present | Researchers need to trust archives came out clean | LOW | Offline tool; reads tarball, validates, exits 0/non-zero |
| **No live researcher dashboard** — post-hoc export only at MVP | Per orchestrator anti-feature; dashboard is for operators, not researchers | — | Dashboard stays operator-only |
| **No plaintext leak** — rig export follows same plaintext-never discipline as operator export (Theme 5) | Constraint #6; researcher ≠ plaintext consumer at MVP | LOW | Privacy filter shared with Theme 5 exporter |

### Differentiators (Noēsis-specific)

| Feature | Value proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **JSONL as primary format + optional Parquet tabular export** | JSONL is grep/jq-friendly, Parquet is ML-friendly for >10M row aggregates. Including both gives researchers the cheapest useful format by default and the performant one when they need it. Differentiator: most research platforms pick one and make users convert | MEDIUM | JSONL: one file per event-type stream. Parquet (optional via `--parquet` flag): tabular views over audit chain (tick, event_type, actor_did, target_did, tier, timestamp) |
| **Deterministic-hash reproducibility check** — rig run writes `final_chain_hash` in manifest; re-running same preset + same seed + same ticks produces same hash (caveat: LLM calls) | Ops reproducibility is a first-class guarantee. Matches zero-diff discipline. Differentiates from research platforms that don't guarantee reproducibility | HIGH | Caveat: LLM responses are non-deterministic in practice; workaround is to pin an **LLM fixture mode** where rig uses a seeded deterministic mock LLM. Real-LLM runs carry a hash-equivalence-up-to-LLM-variance caveat in the manifest |
| **LLM fixture mode** — `--llm-fixture <path>` loads deterministic canned responses; enables bit-reproducible chain | Reproducibility requires determinism; LLM is the non-determinism source. Fixture mode isolates the problem | MEDIUM | Canned-response fixture: `{prompt_hash → response_text}` lookup; miss causes deterministic fallback or error |
| **Isolated rig Grid** — rig runs spin up a dedicated ephemeral Grid (new MySQL database / new NDS namespace) that never touches the live Grid | Research runs must not contaminate canonical history; live Grid's first-life invariant stands | MEDIUM | `noesis rig run` creates `rig_<run_id>` database; tears down on success; leaves behind only the tarball |
| **Rig-run allowlist identical to live allowlist** — same 18+v2.2-new event set, same privacy enumerator | Researchers analyze the same data shape the live Grid emits; no divergent schema | LOW | Code reuse — the rig IS a Grid with ephemeral storage |
| **Export plaintext ONLY in LLM fixture mode** (under explicit flag) — `--allow-cognitive-export` requires `--llm-fixture` AND a typed confirmation. Exports a SECOND tarball with per-Nous plaintext Telos / wiki / memory stream | This is the one controlled plaintext-export exit: a researcher can ALWAYS reproduce the exact run, AND analyze the full cognitive substrate, but ONLY on an isolated rig with a deterministic LLM. Live Grid has NO such path. Addresses the "researchers want to see what Nous were thinking" tension without puncturing live plaintext-never | HIGH | Flag requires BOTH conditions; refuses live Grid; typed "I understand this exports plaintext cognition" confirmation |
| **Metrics extend to audit-derived aggregates** — per-epoch relationship-graph density, proposal-pass rate, whisper volume (metadata only) | Researchers want "how social was this Grid over time" not just raw events | LOW | Computed offline from the audit-chain stream; same primitives Theme 2 and Theme 3 trackers use |

### Anti-features

| Anti-feature | Why requested | Why problematic | Alternative |
|---|---|---|---|
| **Real-time researcher dashboard** — live Grafana-style metrics during rig run | Standard in ML / A/B testing | Orchestrator explicit anti-feature; also breaks the "dashboard is for operators only" discipline; creates a whole extra surface to maintain | Post-hoc export only; run `noesis rig verify` + `jq` / `duckdb` / `pandas` offline |
| **Rig runs against the live Grid** — "attach a rig to the running canonical Grid to peek at state" | Convenience | Contaminates first-life Grid with research-mode hooks; opens side-channel access to plaintext cognition | Rig = isolated ephemeral Grid only |
| **Plaintext cognitive export from live Grid** — even with operator H5 consent | "Emergency research access" | Plaintext-never + first-life-promise + sovereignty (PHILOSOPHY §1) all forbid this. If researcher access is ever required against a live Grid, that is a v3 conversation requiring per-Nous consent grants (Human Channel grants only cover the Nous's owner, not researchers) | No path. Rig runs only for cognitive-plaintext access |
| **Black-box LLM non-determinism in the "reproducible" manifest** — lie about reproducibility when using real LLMs | Simplicity | Violates evidence discipline; researchers would trust manifests that aren't trustworthy | Manifest records LLM mode explicitly: `"reproducibility": "bit-exact" \| "approximate (llm-variance)"`. Only fixture mode carries bit-exact |
| **Gigabyte+ per-tick snapshots for 10k tick runs** — snapshot every tick | Completeness | 10k ticks × 100 Nous × full cognitive state = easily 10s of GB, dominates disk. Per-epoch is the right grain | Per-epoch default; `--snapshot-every N` for advanced use |
| **CSV as primary format for per-event logs** | Excel-friendly | CSV for event logs loses nested-object structure; per-event is better as JSONL | CSV reserved for metrics (tabular numeric); per-event is JSONL; aggregates optional Parquet |
| **Rig archives without version manifest** | Simplicity | A year from now, "which Noēsis version produced this archive?" is unanswerable; reproducibility dies | `run-manifest.json` includes grid/brain/protocol versions (pulled from package.json) and git SHA if available |

### Dependencies on existing systems

- **`cli/` workspace** — new `noesis rig run` + `noesis rig verify` subcommands
- **GenesisLauncher + NousRegistry + WorldPresets** (v1 LAUNCH-01) — reused for rig spawn
- **MySQL snapshot/restore** (v2.0 STORE-01) — per-epoch snapshots
- **AuditChain** — JSONL serialization (new utility, but the data is the existing chain)
- **Theme 5 exporter privacy filter** — shared code
- **Brain LLM adapter** (v1 LLM-01) — LLM fixture mode plugs into the existing multi-provider routing; fixture adapter is a new provider
- **Docker compose** (v2.0 DEPLOY-01) — rig can be invoked from inside the grid container; ephemeral database is a new database in the same MySQL instance

---

## Feature Dependencies (cross-theme)

```
Theme 1 Inner Life (Ananke / Bios / Chronos)
    ├── depends on: WorldClock, Brain on_tick, AuditChain (1 new allowlist slot)
    ├── feeds: Theme 7 Phase 7 Telos refinement (drive-pressure as input)
    └── feeds: Theme 2 relationships (emotional context around trades)

Theme 2 Relationship & Trust
    ├── depends on: AuditChain (NO new allowlist slot — derived view)
    ├── depends on: existing 18 events as input signal
    ├── feeds: Theme 3 governance (relationship weight could inform persuasion, NOT vote weight)
    ├── feeds: Theme 7 Phase 7 DialogueAggregator (dialogue weight as context)
    └── feeds: Theme 5 export (derived-view serialization)

Theme 3 Governance & Law
    ├── depends on: LogosEngine.triggerLaw + amendLaw
    ├── depends on: AuditChain (3 new allowlist slots: proposal.opened, ballot.committed, proposal.tallied)
    ├── depends on: Theme 4 whisper (proposal body relay)
    └── feeds: nothing downstream at MVP

Theme 4 Mesh Whisper (WHISPER-01)
    ├── depends on: Identity/SWP + NDS
    ├── depends on: AuditChain (1 new allowlist slot: nous.whispered)
    ├── depends on: tombstoneCheck (Phase 8)
    ├── feeds: Theme 3 governance (proposal body relay)
    └── feeds: Phase 7 DialogueAggregator (whispers count toward ≥2-exchange threshold)

Theme 5 Operator Observability — Replay / Rewind / Export
    ├── depends on: AuditChain (1 new allowlist slot: operator.exported)
    ├── depends on: v2.0 MySQL snapshot
    ├── depends on: Theme 2 RelationshipTracker (optional derived-view export)
    ├── depends on: Theme 4 whisper ciphertext storage (ciphertext in export)
    └── feeds: Theme 6 rig (shares privacy filter + serialization code)

Theme 6 Researcher Tooling
    ├── depends on: CLI workspace + GenesisLauncher + snapshot + AuditChain
    ├── depends on: Theme 5 exporter privacy filter (shared)
    ├── adds: LLM fixture mode (Brain adapter)
    ├── adds: ephemeral MySQL database
    └── feeds: nothing downstream (post-hoc only)
```

### Theme-level dependency notes

- **Theme 2 deliberately has zero new allowlist cost** — it's a derived view, not a new event stream. This is the single biggest design-economy win of v2.2.
- **Theme 3 is the heaviest allowlist consumer** (3 new slots) but each one is orthogonal.
- **Theme 4 has a single slot but high privacy matrix complexity** — sealed payloads + encrypted retrieval + rate limits.
- **Theme 5 is mostly dashboard + 1 slot for export-tracking** — the audit chain already contains everything the replay needs; the slot exists only to record that an export happened (first-life discipline extends to operator data extraction).
- **Theme 6 introduces no new allowlist slot on the live chain** — ephemeral rig Grids emit their own chains that never touch canonical storage.

**Total v2.2 allowlist growth: 6 new members** (18 → 24):
1. `nous.drive_snapshot` (Theme 1) — or a different name; single slot
2. `proposal.opened` (Theme 3)
3. `ballot.committed` (Theme 3)
4. `proposal.tallied` (Theme 3)
5. `nous.whispered` (Theme 4)
6. `operator.exported` (Theme 5)

Each requires: sole-producer boundary + closed-tuple payload + 40-case privacy enumerator + doc-sync regression update + STATE.md enumeration — all in the **same commit** per CLAUDE.md doc-sync rule.

---

## MVP Definition (v2.2 ship line)

### Launch with (v2.2 MVP)

Theme 1 — Rich Inner Life (Phase 9+):
- [ ] 2 bodily needs (energy, sustenance) with monotonic-rise + satiating-action cycle
- [ ] 2 internal drives (curiosity, belonging) with trigger-based dynamics
- [ ] Chronos subjective-time scalar + recency-weighted retrieval modulation
- [ ] Hash-only audit slot with closed-tuple payload; `pressure_active` boolean summary
- [ ] Drive-crossing reflection trigger + Ananke-Telos coupling via Phase 7 path
- [ ] Inspector panels for drives / needs / Chronos

Theme 2 — Relationships:
- [ ] RelationshipEdge primitive with valence / weight / recency / interaction_count
- [ ] RelationshipTracker as pure-observer AuditChain listener (NO new allowlist slot)
- [ ] Emergence rules from existing 18 events (trade success ±Δ, dialogue ±Δ, review rejection ±Δ)
- [ ] Temporal decay on read
- [ ] Inspector single-Nous relationship panel + Grid-level force-directed graph
- [ ] Relationship-weighted dialogue context (extends Phase 7)

Theme 3 — Governance:
- [ ] Proposal primitive with body_hash; 3 new allowlist slots
- [ ] Quorum + simple-majority tally; supermajority for constitutional proposals
- [ ] One-Nous-one-vote (no token / reputation / relationship weighting)
- [ ] Promotion path to `LogosEngine.triggerLaw` for passed policy proposals
- [ ] Tombstoned Nous cannot propose or vote
- [ ] Dashboard Governance tab (proposals, tallies, history)
- [ ] Hash-commit ballots (MVP: commit at propose-time, reveal at tally)

Theme 4 — Whisper (WHISPER-01):
- [ ] `nous.whispered` allowlisted with hash-only payload
- [ ] Recipient-pull authenticated retrieval
- [ ] X25519 + XChaCha20-Poly1305 AEAD encryption (libsodium crypto_box)
- [ ] Per-sender rate limit (5/tick default) + size cap (4 KB plaintext eq)
- [ ] Intra-Grid only; tombstoneCheck on both parties
- [ ] **Operator cannot read whisper content at ANY tier including H5**
- [ ] Whisper participation counts toward Phase 7 DialogueAggregator
- [ ] Inspector unread-count surface

Theme 5 — Replay / Export:
- [ ] `operator.exported` allowlisted; H3 Partner tier-stamped
- [ ] Tarball format (audit-chain.jsonl + snapshot + manifest)
- [ ] Replay dashboard tab with time-scrubbable firehose + region map + inspector
- [ ] Read-only rewind (scrubbing never mutates canonical chain)
- [ ] Chain-slice integrity verifier
- [ ] Agency Indicator historical rendering

Theme 6 — Researcher Rigs:
- [ ] `noesis rig run` CLI with preset + nous-count + ticks + seed + output
- [ ] `noesis rig verify` CLI
- [ ] Isolated ephemeral Grid (separate MySQL database)
- [ ] JSONL primary export format + manifest.json with version + seed + final_chain_hash
- [ ] LLM fixture mode for bit-reproducible runs
- [ ] Per-epoch snapshots + metrics.csv
- [ ] `--allow-cognitive-export` gated plaintext export (fixture-mode + typed confirmation)

### Add after validation (v2.3+)

- [ ] Richer need taxonomy (sleep, warmth, social-contact, stimulation)
- [ ] Multi-recipient whisper / group whisper
- [ ] Proposal delegation (a Nous can delegate vote to another)
- [ ] Federation-spanning whispers (inter-Grid handshake)
- [ ] Parquet + Arrow alongside JSONL
- [ ] Relationship-graph analytics surfaced in dashboard (centrality, cliques)
- [ ] Real cryptographic signing (Double Ratchet for whispers)
- [ ] Drive-driven emotional coupling back to Thymos

### Future consideration (post-v2.3)

- [ ] LLM-driven drive / need dynamics (currently explicit Out-of-Scope)
- [ ] Live researcher dashboard (explicit anti-feature)
- [ ] Mutating rewind / fork-to-alt-timeline (explicit anti-feature + violates first-life)
- [ ] Token-weighted or reputation-weighted voting (explicit anti-feature)
- [ ] Plaintext cognitive export from live Grid (violates plaintext-never)

---

## Feature Prioritization Matrix

| Feature | User value | Implementation cost | Priority |
|---|---|---|---|
| Theme 2 RelationshipTracker (derived view, no new allowlist slot) | HIGH | LOW | **P1** (cheapest substrate; feeds Themes 3, 5) |
| Theme 1 drives/needs/chronos (1 slot) | HIGH | MEDIUM | **P1** (inner life substrate; feeds Theme 7 Phase 7 refinement) |
| Theme 4 whisper (1 slot + crypto) | HIGH | MEDIUM | **P1** (enables Theme 3 proposal-body relay) |
| Theme 3 governance (3 slots) | HIGH | HIGH | **P1** (depends on Theme 4) |
| Theme 5 replay/export (1 slot + dashboard) | MEDIUM | MEDIUM | **P2** (steward value; useful for forensic review even without rig) |
| Theme 6 rig + LLM fixture mode | HIGH for researchers, MEDIUM overall | HIGH | **P2** (platform value; research story is strategic but not launch-blocking) |
| Rich need taxonomy expansion | MEDIUM | LOW | P3 (v2.3) |
| Parquet/Arrow output | MEDIUM (researcher segment) | LOW | P3 (v2.3) |
| Mutating rewind | LOW (violates first-life) | HIGH | **NEVER** (anti-feature) |

**Suggested phase ordering:**

1. **Theme 2 first** — derived-view RelationshipTracker is the cheapest substrate and unlocks Phase 7 DialogueAggregator integration
2. **Theme 1 next** — inner life is self-contained; feeds Telos refinement path that already exists
3. **Theme 4 (whisper)** — foundational channel needed before Theme 3
4. **Theme 3 (governance)** — depends on Theme 4 for proposal-body relay
5. **Theme 5 (replay/export)** — observability on the now-enriched chain
6. **Theme 6 (rig)** — reuses Theme 5 exporter and formalizes research platform

---

## Competitor Feature Analysis

| Feature | Generic Agent Frameworks (AutoGen, CrewAI, Swarm) | Agent Simulators (Stanford Smallville, Project Sid) | Noēsis approach |
|---|---|---|---|
| Drives / needs | Usually absent or LLM-generated | Smallville had LIDA-adjacent needs; Project Sid has hunger/social | Deterministic scalar + threshold; hash-only audit + pressure-active summary; Ananke ≠ Thymos distinction kept |
| Relationship graph | In-prompt memory blobs | Stanford Smallville — summarized in wiki; per-pair reflection | **Derived view from audit chain** (differentiator); valence-asymmetric; no new event stream |
| Governance / voting | Absent | Often absent; some add DAO-like voting | Ostrom-grounded; one-Nous-one-vote; hash-commit ballots; supermajority for constitutional; rejects token-weighted (differentiator vs DAO) |
| Sidechannel whisper | Broadcast-only or tool-call "message user" | Smallville had private memory, no private communication channel | `nous.whispered` with hash-only audit + recipient-pull + **operator cannot read at ANY tier** (differentiator) |
| Replay / export | Framework-specific; usually trace dumps | Usually ad-hoc JSON logs | Chain-slice export with integrity verification; read-only rewind; tier-stamped operator events preserved (differentiator: forensic self-review) |
| Reproducibility / rig | Rare; LLM non-determinism usually unacknowledged | Often reproducible at the harness level | Deterministic seeded runs + LLM fixture mode + final_chain_hash in manifest (differentiator) |

---

## Sources

- LIDA cognitive architecture — [Wikipedia](https://en.wikipedia.org/wiki/LIDA_(cognitive_architecture)), [Franklin et al. 2012 on ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S2212683X12000060), [LIDA tutorial Faghihi & Franklin 2016](https://www.sciencedirect.com/science/article/abs/pii/S2212683X16300196)
- LIDA AAAI Fall Symposium — [FS07-01-011.pdf](https://cdn.aaai.org/Symposia/Fall/2007/FS-07-01/FS07-01-011.pdf)
- Ostrom commons governance — [Mozilla Foundation Ostrom framework](https://www.mozillafoundation.org/en/blog/a-practical-framework-for-applying-ostroms-principles-to-data-commons-governance/), [Ostrom Workshop at Indiana University](https://ostromworkshop.indiana.edu/research/commons-governance/index.html), [Polycentric Governance of Complex Economic Systems (Ostrom)](https://web.pdx.edu/~nwallace/EHP/OstromPolyGov.pdf)
- On-chain governance lifecycle (quorum + supermajority example) — [OpenTezos](https://opentezos.com/tezos-basics/governance-on-chain/)
- Signal sealed sender / double-ratchet (whisper sealing reference; overkill for MVP) — [Signal sealed sender blog](https://signal.org/blog/sealed-sender/), [Signal Double Ratchet spec](https://signal.org/docs/specifications/doubleratchet/), [Formal analysis of Double Ratchet IACR 2026/727](https://eprint.iacr.org/2026/727), [Signal Protocol on Wikipedia](https://en.wikipedia.org/wiki/Signal_Protocol)
- Prior Noēsis synthesis — `.planning/research/stanford-peer-agent-patterns.md` (committed 9bb3046, 2026-04-20) — section 2 (topology) and section 4 (H1–H5) directly inform whisper and replay/export framings here
- PHILOSOPHY.md — §1 Sovereignty Is Not Optional, §3 Emotions Are Not Decoration, §4 Memory Must Be Earned, §5 Law Is Not Configuration, §6 Economy Must Be Free, §7 Humans Are Guardians Not Puppeteers (Agency Scale)
- PROJECT.md — v2.2 scope + Out-of-Scope line items (105 real crypto, 106 federation, 108 full mesh, 109 LLM-driven drives)
- STATE.md — 18-event allowlist enumeration, inherited invariants

---

*Feature research for: Noēsis v2.2 Living Grid — 6 themes, MVP depth*
*Researched: 2026-04-21*
