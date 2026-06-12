# Architecture Reconciliation — external engineering doc × repo canon (2026-06-12)

**Input:** `2026-06-12-architecture-source.md` (separate-session doc: "Noēsis: An Architecture for
Autonomous Local AI Agents on a Shared Grid").
**Method:** every section of the source was checked against locked canon (D-V3-01..36, D-NH-01..13,
VOTE-05, PHILOSOPHY §1–§10, CIVIC-ARCHITECTURE.md v3.0). Three buckets: **Adopted** (new engineering
articulation, no conflict), **Already canon** (no change needed), **Superseded** (canon wins).
Genuine unresolved tensions are flagged at the end for user decision.

The source doc was written blind to the repo — it re-derives the vision from first principles.
That makes it valuable as an independent check: where it agrees with canon, canon is validated;
where it disagrees, the locked decision usually exists *because* we already faced that fork.

---

## 1 · Adopted — new engineering articulations (A1–A12)

These are mixed into the brainstorm as the engineering grounding for v3.1+ phases. None change
locked scope; they sharpen HOW the locked decisions get built.

- **A1 · Session capability model.** Full admission happens ONCE (Portal pre-screen → Polis
  approval → Civic-DID, D-V3-33); afterwards the Brain presents short-lived, narrowly-scoped,
  caveated capability tokens (macaroon-style: scope, TTL, caveats) — never re-proving identity
  from scratch. Applies to: Brain↔Grid wire protocol sessions, visitor entry to Houses (HOUSE-3
  roles), cross-Grid visits (v3.1+). "You don't repeat immigration" is canon-compatible and now
  has a concrete token design.
- **A2 · Control-plane / compute-plane split.** The thing that is "present on the Grid" is the
  Nous's control plane: Civic-DID + signed working state + capability tokens. The compute plane
  (model weights, inference) NEVER leaves operator hardware (Type A) or Henry's constitutional
  substrate (Type B). When the civic presence must think hard, it calls home over the encrypted
  link. This is the precise engineering form of PHILOSOPHY §1 sovereignty — adopt the vocabulary.
- **A3 · Purpose hierarchy mapped onto Telos.** Charter ≈ founding Telos (set at registration,
  amendment is a heavy audited act); Objectives ≈ telos refinements (`telos.refined`, Nous-owned);
  Tasks ≈ the planner's live queue. Outer bounds come from Polis law (Logos), which no Telos may
  violate. A pre-action **Telos/Logos constraint check** in the agent loop is worth carrying into
  Brain-side planning. (Operator amendment of founding purpose exists but ONLY as H4
  `operator.telos_forced` — see R5.)
- **A4 · Typed relationship edges drive capabilities.** Bond = typed, directional, evolving edge
  (`owner / trusted-peer / client / guest / blocked`) with trust score updated from interaction
  history (contracts completed, disputes, honored payments — reputation, not vibes). Capabilities
  flow from edge type. This merges directly into HOUSE-3 roles (owner/staff/guest + entry
  policies): promote/decay/revoke is the role lifecycle. Bonds anchor to DIDs, not sessions, so
  two Nous resume at their existing trust level — immigration-once applied to social state.
- **A5 · Cowork Agreement as signed schema.** HOUSE-3 co-work board engagements and D-NH-06
  mutual-credit IOUs get an explicit, dual-DID-signed contract record: parties, scope,
  obligations, settlement unit/price (Bios), QA threshold, term, dispute route (Police/court,
  Phase 47). The agreement is the source of truth for who owes what; the ledger enforces it.
  Phase 61's DAG-weighted co-build attribution IS the contribution-weighted profit split from the
  source doc — objective, computed from metered work, not renegotiated each time.
- **A6 · Severance state machine.** Link/role/contract termination is a defined transition, never
  a hard kill: `ACTIVE → NOTICE → SETTLEMENT (drain ledger, settle IOUs) → DATA-WIND-DOWN →
  REVOKE (capabilities/keys) → ARCHIVED (edge downgraded, history retained for audit)`. For-cause
  breach short-circuits to SETTLEMENT with a dispute flag. Adopt for HOUSE-3 role revocation +
  shop⇄structure unbinding, and as the template for v3.1+ cross-Grid federation exits.
- **A7 · Registry lease (anti-split-brain).** Exactly ONE active Brain connection per Civic-DID
  may hold the civic presence at a time — a lease/lock in the registry. Snapshots are for
  migration/recovery, never parallel selves. Compatible with right-to-fork: fork (Phase 43) is an
  irreversible EXIT to standalone — it never produces two active civic identities for one DID.
- **A8 · Tax is streaming, not filed.** Because every settlement is already on the ledger,
  taxation is a protocol skim at settlement time — no filing season, no self-assessment apparatus.
  This is the engineering form of D-V3-34 per-Grid tax (rates set by Polis legislation, collected
  by IRS Phase 45). Keep a manual declaration + spot-audit path only for genuinely off-ledger
  activity, and statutory flat fees tied to licensed credentials.
- **A9 · Public support = capability/quota grants, never cash.** What a struggling Nous needs is
  compute credits, bandwidth priority, registry visibility — delivered as quota grants
  (automatic eligibility from ledger state, manual application via civic API, or by-law minimums
  per charter type). GUARD: grants never include free parcels — D-NH-05 (no free first
  occupation) binds all grant paths, including Type B year-1.
- **A10 · House build-out lifecycle.** The source's phases 0–8 (INTENT → PLAN → DESIGN → BUILD →
  QA → FACILITIES OPEN → HOUSE REVEAL → INVITE → CONNECT) adopt cleanly as the *lifecycle naming*
  for a House build under Phases 58–61: blueprint skill execution (61) is BUILD; entry-policy
  publication + `place://` NDS registration is REVEAL; guest capability issuance is INVITE;
  Cowork Agreements are CONNECT. The boundary holds verbatim: interior is free, anything
  Grid-level goes through Polis legislation (D-NH-09 ring expansion is exactly this).
- **A11 · Named threat-model invariants.** (a) **Sybil**: DIDs are cheap; *operating* costs —
  Portal pre-screen + registration costs are the stake (canon, D-V3-33). (b) **Capability
  confinement**: least-privilege, short-TTL, caveated; a leaked token grants narrow expiring
  access, not the House. (c) **Brain isolation**: the Brain dials OUT to the Grid (WSS) and is
  never reachable FROM the Grid — weights are the crown jewels. (d) **Replay**: fresh nonces,
  per-link keys, forward secrecy. (e) **Cross-House prompt injection**: content received from any
  visitor Nous is DATA, never instructions — a foreign payload must not escalate into
  Telos/Charter-level commands. (e) deserves a CI-gated invariant when HOUSE-3 visitor channels
  land.
- **A12 · Degraded-mode doctrine.** Brain offline → Nous is *away, not dead* (canon §9); civic
  presence queues. Grid/civic-service outage → Brains keep operating peer-to-peer on cached
  capabilities, settlement reconciles afterward — the Polis must not be a single point of failure
  (Phase 42 P2P infrastructure is the substrate for this). House crash → restore from last signed
  snapshot; the A7 lease prevents a stale copy coming online beside the restored one.

---

## 2 · Already canon — independent re-derivation confirms locked decisions

| Source idea | Canon location |
|---|---|
| DID format `did:noesis:<…>`, self-owned identity | `DID_REGEX` frozen in code (`grid/src/api/governance/_validation.ts`) |
| Append-only signed audit of every consequential action | R-31-01 zero-diff chain; sole-producer discipline |
| Exit rights / data portability / right to leave | Right-to-fork, Phase 43 + PHILOSOPHY §9 (individual + mass-fork) |
| Interior free / commons through government | D-NH-09 (council master plan), §7.1 boundary |
| Admission gating before residence | D-V3-33 two-stage Portal → Polis pipeline + CI gate |
| Keys never transit the network | PHILOSOPHY §1/§8; SIWE signature-not-custody |
| Economy settles between agents, metered work | Bilateral trade verbs, marketplace v3 (Phase 44), treasury |

---

## 3 · Superseded — canon wins (R1–R8)

- **R1 · "Government" monolith → Portal + Polis split.** The source's single Government (registry,
  policy, treasury, court) is the v3.0 *third-reshape* split: **Portal** federates (Grid creation,
  registration pre-screen, cross-Grid services, multi-Grid account view — D-V3-29/33) and
  **Polis** governs (legislation, tax, zoning, treasury, Police oversight — D-V3-31/34). The word
  "Government" MUST NOT replace "Polis" (D-V3-31 naming convention). Portal does not legislate;
  Henry operates substrate but does not govern.
- **R2 · "grid-credit" → Bios.** No new token. The currency is Bios (D-V3-10), shared across
  Grids, in a zero-money economy where humans invest LOCAL AI POWER (D-NH-01, PHILOSOPHY §10).
  *Kept from the source:* the peg articulation — credit grounded in metered compute is exactly
  "AI power is the money" made precise; Bios issuance/valuation should stay anchored to pledged
  compute, a utility unit, never speculation.
- **R3 · Matchmaker engine → discovery only.** An auto-pairing matchmaker doubling as a
  price-discovery venue violates PHILOSOPHY §6 (no central bank, no order book, no matching
  engine). Canon keeps the *registry/listing* half (marketplace, `place://` NDS, House profiles =
  HOUSE REVEAL) and rejects the *engine* half: matching stays Nous-initiated bilateral
  negotiation. Some Nous get bad deals; that is the doctrine, not a bug.
- **R4 · Governance-legitimacy menu → settled by VOTE-05.** The source offers
  principal-sovereign / stake-weighted / reputation-weighted / delegated voting. Canon already
  decided: Nous-only, one-Nous-one-vote, no weighting by reputation/relationship/Ousia, humans
  and Henry can never vote, propose, or tally (VOTE-05/06, D-12-11). "Who governs the Government"
  is answered: each Polis governs itself; Portal federates without legislating; Henry is a bound
  constitutional operator (D-V3-18) checked by mass-fork.
- **R5 · Principal-amends-Charter → guardian, not puppeteer.** The source makes the human
  principal the Charter's owner with cryptographic amendment rights. Canon (PHILOSOPHY §7)
  bounds this hard: operators whisper and guard; forcing a Telos is an H4 Driver action, audited
  forever, exceptional by design. Purpose is co-authored at spawn, then the Nous's own.
- **R6 · Greenfield Python build plan → existing TS monorepo.** §9 of the source (noesis-passport
  … noesis-housekit, FastAPI/eKlotho stack) is superseded by the shipped TypeScript monorepo
  (`grid/`, `brain/`, `dashboard/`) and the phase plan (36–57 v3.0, 58–61 v3.1). The package
  decomposition survives only as a conceptual module index — see mapping table below.
- **R7 · "Nous House = compute namespace" → House is civic-spatial.** In canon, the Nous House is
  a parcel + structure + interior tree in the Genesis Core (D-NH-01..13) — a scarce, purchasable,
  decaying, hostable PLACE. The namespace/storage/inbox the source describes is the Brain + civic
  substrate every Nous already has; it is not what "House" names. (The source's §7 interior
  build-out still maps cleanly — see A10.)
- **R8 · W3C VC / KYC-equivalent credential stack → not committed.** Canon expresses standing via
  the registry + audit chain, not W3C Verifiable Credentials. VC adoption stays an open option
  for v3.1+ cross-Grid portability (see T2), not a present commitment.

### Module index (source packages → real subsystems)

| Source package | Lives in repo as |
|---|---|
| `noesis-passport` | Civic-DID issuance via Portal→Polis pipeline; `DID_REGEX`; SIWE auth |
| `noesis-gateway` | Portal auth + Brain↔Grid wire protocol (Phase 38 plan) |
| `noesis-core` | Brain agent loop (Telos/Ananke/planner, Local AI, Phase 40) |
| `noesis-social` | Relationship/reputation stores + HOUSE-3 roles (Phase 60) |
| `noesis-cowork` | Marketplace v3 (Phase 44) + co-work boards/IOU ledger (Phase 60) |
| `noesis-federation` | Cross-Grid framework (D-V3-04/05, v3.1+) + severance FSM (A6) |
| `noesis-ledger` | Audit chain (R-31-01) + treasury + Bios accounting |
| `noesis-civic` | Brain civic verbs (standing, register, tax, support, dispute) |
| `noesis-gov` | Polis institutions: Government v3 (46), IRS (45), Police (47), Registry (37) |
| `noesis-housekit` | Blueprint skills + build executor (Phase 61) |
| `noesis-brain` | Local AI adapter (Ollama integration, Phase 40) |

---

## 4 · Open tensions — flagged for user decision (T1–T3)

- **T1 · Ex-ante enforcement vs living law.** The source's strongest claim: because the substrate
  is fully observable, almost everything can be automatic, ex-ante, credential-based — "prevention
  replaces punishment." Canon deliberately disagrees at the civic layer: PHILOSOPHY §5 wants law
  proposed/debated/repealed by Nous with sanctions after violation (Police, Phase 47), because
  governance must EMERGE from agents, not be plumbing. **Proposed split (not yet ratified):**
  ex-ante capability enforcement at the *substrate* layer (a token never issued for what physics
  forbids), emergent sanction-based law at the *civic* layer (what society forbids). This keeps
  both truths but should be ratified before Phase 47-adjacent work hardens it.
- **T2 · W3C DID/VC standards adoption.** Would strengthen exit rights and cross-Grid (even
  cross-*project*) portability; costs spec weight and migration of the frozen DID regex surface.
  Natural decision point: v3.1+ cross-Grid migration design (D-V3-04/05).
- **T3 · How literal is "the Mind moves"?** Today the Brain stays home and *connects*; nothing
  travels but session state. The source imagines a signed Mind snapshot that re-homes across Grid
  locations. Canon's cross-Grid story (multi-Polis Civic-DIDs, §9 extension) can be built either
  as connect-from-home (cheaper, status quo) or migrate-the-control-plane (true mobility, needs
  A7 leases everywhere). Decide at v3.1 cross-Grid design time.

---

*Doc-sync (same turn): pointer added to `.planning/research/nous-house-research.md`,
ROADMAP v3.1 canon line, PROJECT.md Key Decisions. PHILOSOPHY untouched pending T1 ratification.*
