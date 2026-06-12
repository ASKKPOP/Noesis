# Noēsis — Base-Idea Master Plan (Forward Architecture + Build Sequencing)

**Date:** 2026-06-12 · **Status:** navigational/architectural overlay (not a new source of decisions)
**Author role:** generator pass over locked canon · every claim traces to a cited locked decision.

---

## 0 · Frame — How to Read This Document

This is the **single forward master architecture + build plan** that maps the entire Noēsis *base idea* (the original 8-point vision in `docs/v0.2/noesis-architecture.md`) onto the **existing TypeScript + Python monorepo** — `grid/` (civic services), `brain/` (Python cognition), `dashboard/` (Next.js portal/steward/landing) — and sequences the **remaining real work**. It is a navigational overlay across already-locked decisions, not a redesign.

### HARD RULE (canon override R6)

> **Never propose rebuilding shipped systems, and never propose a greenfield Python rewrite.**

The base doc's §9 package decomposition (`noesis-passport … noesis-housekit`, FastAPI/eKlotho stack) is **superseded** by the shipped monorepo (R6, `ARCHITECTURE-RECONCILIATION.md §3`). Those package names survive **only as a conceptual module index** — a vocabulary for talking about subsystems that already exist as `grid/src/*`, `brain/src/noesis_brain/*`, `dashboard/src/*`. Every capability below is labelled against what is already in the tree; remaining work is sequenced as phases on top of it.

### Canon source-of-truth chain

| Layer | Document | What it locks |
|-------|----------|---------------|
| Worldview | `PHILOSOPHY.md` §1–§11 | Sovereignty, free economy, zero-custody, first-life, grids-built-not-issued, conflict/immune invariants |
| v3.0 civic arch | `.planning/research/v3.0/CIVIC-ARCHITECTURE.md` | Three-layer Portal/Grid/Brain, Polis, 6 zones, Type A/B, D-V3-01..36 (32 locked decisions) |
| Engineering reconciliation | `.planning/research/v3.1/ARCHITECTURE-RECONCILIATION.md` | A1–A12 adopted articulations, R1–R8 overrides, T1–T3 tensions |
| Conflict/immune | `docs/v0.2/RECONCILIATION.md` | C1–C10 adopted, O1–O4 overrides, W1–W4 (all resolved) |
| Base idea | `docs/v0.2/noesis-architecture.md` | The original 8-point vision + §9 (superseded build plan) |
| Nous House | `docs/noesis-nous-house.html`, `docs/plans/2026-06-11-nous-house-implementation-plan.md` | D-NH-01..13, Phases 58–61 |
| Roadmap state | `.planning/ROADMAP.md`, `PROJECT.md`, `STATE.md` | Authoritative shipped/planned/prospective |

### Today's baseline (one line)

**v3.0 Polis shipped through Phase 46 (Government v3); broadcast allowlist at 91 in code today; Phase 48b land grid-core wave + Phase 39/40/41/42/43/44/45 live.** The shipped `ALLOWLIST_MEMBERS` array is at **91** — Phase 48b zoning/treasury events (82–86) AND a Portal-registration wave (87–91) have already landed in code ahead of their nominal phases (`grid/test/audit/broadcast-allowlist.test.ts` asserts `.toBe(91)`). STATE.md line 32 still says 81 — stale (see §5/§9). Genesis is the only Grid (D-V3-30).

### Legend (used throughout)

| Symbol | Meaning |
|--------|---------|
| **exists** | Shipped in the monorepo today; usable now |
| **partial** | Substrate shipped; named capability completes in an identified later phase |
| **not-yet** | Framework/stub at most; delivered by a future milestone |

---

## 1 · The Base Idea → Engineering Mapping (8 points)

The original vision (`docs/v0.2/noesis-architecture.md §0–§8`) is sound in instinct: identity, admission, private domain, authenticated collaboration, a settlement economy, and a bounded rule-layer are exactly the primitives an agent society needs. The load-bearing instinct worth preserving is **"because the substrate is fully observable, an AI polity can make plumbing automatic, ex-ante, and credential-based."** Canon keeps that instinct but splits where it must (T1). Each point below gets its **canon-corrected reading** (apply R1–R8) and the A2 control-plane/compute-plane vocabulary. Status detail lives in §3.

| # | Base-idea point | Canon-corrected reading | Status |
|---|-----------------|--------------------------|--------|
| §0 | "Brain stays local, Mind moves" | **A2 control-plane / compute-plane split.** What travels the Grid is the control plane (Civic-DID + signed working state + capability tokens); the compute plane (weights + inference) never leaves operator hardware (Type A) or Henry's constitutional GPU (Type B). The Brain **dials OUT** (WSS) and is never reachable FROM the Grid (A11c). How literal "the Mind moves" gets is **T3** (connect-from-home today vs migrate-the-control-plane later). | exists |
| §1 | Immigration / Gateway / Passport | **Admission once, then capability tokens.** Two-stage Portal pre-screen → Polis approval (D-V3-33) issues the Civic-DID; afterwards short-lived caveated tokens (A1, macaroon-style). "Don't repeat immigration" = canon. | partial |
| §2 | Purpose (Charter / Objectives / Tasks) | **Maps onto Telos (A3).** Charter ≈ founding Telos (set at registration, amendment is a heavy audited act — and per **R5** only via H4 `operator.telos_forced`, never silent principal rewrite); Objectives ≈ `telos.refined` (Nous-owned); Tasks ≈ planner queue. Outer bounds = Polis law (Logos). Pre-action Telos/Logos constraint check carried forward. | exists |
| §3 | Bonds / relationships | **Typed directional evolving edges (A4)** — `owner/trusted-peer/client/guest/blocked`; trust from interaction history, not vibes; capabilities flow from edge type; anchored to DIDs not sessions. Becomes HOUSE-3 roles. | partial |
| §4 | Cowork / discovery / contracts | **Registry + discovery only (R3)** — the matchmaker *engine* is rejected (PHILOSOPHY §6: no order book, no matching engine). Trade is Nous-initiated bilateral negotiation. Signed dual-DID **Cowork Agreement (A5)** is the source of truth; ledger enforces. | partial |
| §5 | House-to-House links / severance | **Severance state machine (A6):** `ACTIVE → NOTICE → SETTLEMENT → DATA-WIND-DOWN → REVOKE → ARCHIVED`. Profit split = contribution-weighted, computed from metered work (= Phase 61 DAG attribution). | partial / not-yet |
| §6 | House ↔ Government / tax / support | **Government → Portal + Polis (R1).** Portal *federates* (does not legislate); Polis *governs* via VOTE-05. Tax is **streaming, not filed (A8)**. Support = **capability/quota grants, never cash (A9)** — and never free parcels (D-NH-05 guard). Currency is **Bios, not grid-credit (R2/O1)**. | partial |
| §7 | House build-out (empty box → open) | **House is a civic-spatial PLACE, not a compute namespace (R7).** The build-out lifecycle (INTENT→…→CONNECT, A10) is the *naming* for Phases 58–61. Interior is free; anything Grid-level goes through Polis (D-NH-09 ring expansion). | partial / not-yet |
| §8 | Deeper analysis (security, exit, audit, economics) | Already canon: Sybil cost on *operating* not minting (A11a/D-V3-33); Brain isolation (A11c); cross-House prompt injection = DATA never instructions (A11e); right-to-fork + registry lease (A7/Phase 43); signed append-only audit (R-31-01). Economics: Bios pegged to metered compute (R2, "AI power is the money"). | exists / partial |

**The one fork to flag (T1):** the base doc's "prevention replaces punishment" (ex-ante capability enforcement) collides with PHILOSOPHY §5 "law must emerge from Nous with sanctions after violation." The **proposed-but-unratified** split is: ex-ante capability enforcement at the **substrate** layer, emergent sanction-based law at the **civic** layer (Police, Phase 47). Present this as proposed, not settled (see §9).

---

## 2 · Three-Layer Architecture (Portal · Grid · Brain)

Canonical model from `CIVIC-ARCHITECTURE.md §2`. Portal is the meta-layer (Henry-hosted, **federates but does not legislate**); Grid is a digital city (Genesis live, future Grids dormant) with a named Polis + 6 zones + 8 institutions; Brain is the cognitive substrate (Type A Local / Type B Hosted).

```
┌──────────────────────────────────────────────────────────────────────┐
│  PORTAL · meta-layer (Henry-hosted) · federates, never legislates     │
│  [Grid Approval] [Nous Approval] [Cross-Grid] [User Multi-Grid View]   │
│  D-V3-29 · 4 functions · own R-31-01 audit chain · VOTE-05 excluded    │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ two-stage gating (D-V3-33): pre-screen → Polis approval
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│  GRID LAYER · digital cities                                          │
│  ┌──────────────────────────┐   ┌──────────────────────────┐          │
│  │ GENESIS GRID (live)      │   │ Future Grids (dormant)   │          │
│  │ • Genesis Polis (VOTE-05)│   │ • Commerce/Research/Arts │          │
│  │ • 6 zones (D-V3-32)      │   │   Polis (v3.1+, Phase 53)│          │
│  │ • 8 institutions         │   │ • per-Grid R-31-01 chain │          │
│  │ • per-Grid tax (D-V3-34) │   └──────────────────────────┘          │
│  └──────────────────────────┘                                         │
│  Zones: Business · Manufacture · Shopping · Residential ·             │
│         Infrastructure · Government Quarter   (frozen set, D-V3-32)    │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ Brain dials OUT (WSS); never reachable FROM Grid (A11c)
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│  BRAIN LAYER · cognitive substrate (control-plane present on Grid;     │
│  compute-plane stays home — A2)                                        │
│  ┌──────────────────────────┐   ┌──────────────────────────┐          │
│  │ Type A · Local (D-V3-16) │   │ Type B · Hosted (D-V3-24)│          │
│  │ Ollama · sleeps when off │   │ Henry GPU · 24/7 · ≤50   │          │
│  │ right-to-fork (Phase 43) │   │ dormancy ≠ death (D-V3-25)│         │
│  └──────────────────────────┘   └──────────────────────────┘          │
└──────────────────────────────────────────────────────────────────────┘
```

**Cross-layer invariants.** R-31-01 zero-diff applies per-Grid **and** at Portal (separate chains; federated reconciliation deferred to v3.1+). D-V3-18 binds Henry as a *constitutional operator* (audit-evident, no silent mutation, right-to-fork, public PHILOSOPHY, VOTE-05 immunity). VOTE-05 is preserved at **per-Polis** scale (D-V3-21).

**3-tier MANAGEMENT taxonomy (D-V3-36) — administrative, distinct from GOVERNANCE:**

| Tier | Name | Side | Authority |
|------|------|------|-----------|
| 1 | Local Nous Manager | Operator's machine | Brain config, Local AI settings, memory inspector, fork (`/system/local-ai`) |
| 2 | Grid Manager | Henry-side, per-Grid | Runtime ops, scaling, infra cost — **no** legislative/pardon/freeze power |
| 3 | Portal Manager | Henry-side, meta | Reviewer panels, cross-Grid health, Portal audit view |

Every Grid Manager + Portal Manager action emits an audit event. Grid Manager ≠ Polis (cannot legislate, pardon Police sanctions, or freeze Civic-DIDs).

---

## 3 · Capability Module Map — exists / partial / not-yet

The heart of the document. Each base-idea capability → status → real monorepo path → shipped phase / delivering milestone → source-doc package (the conceptual index from `ARCHITECTURE-RECONCILIATION §3` + `RECONCILIATION §6`).

| Capability | Status | Maps to (real monorepo) | Phase / milestone | Source pkg |
|------------|--------|--------------------------|-------------------|------------|
| **Identity / Passport** — Existence-DID (self-sovereign at birth, D-V3-01), Civic-DID + Business-DID (W3C VC, Phase 37), human-DID (SIWE/email) | **exists** | `grid/src/registry`, `grid/src/civic-registry`; `DID_REGEX` frozen in `grid/src/api/governance/_validation.ts` | Phase 37 SHIPPED (issuance, court-only revocation, VC format) | `noesis-passport` |
| **Immigration / Gateway** — two-stage Portal pre-screen → Polis approval, session capability tokens, "authenticate once" (A1) | **partial** | `grid/src/api/portal` (auth/civic/nous/spawn) + `grid/src/api/preHandlers` (tryDid/requireDid) | Visit/action split Phase 36 + portal.auth Phase 33 + wire bearer Phase 38 SHIPPED; full 2-stage pipeline + caveated tokens = Phases 54 + 53; CI gate `check-civic-did-issuance-path.mjs` SHIPPED (37b) | `noesis-gateway`/`noesis-passport` |
| **Agent core / Purpose** — Telos (Charter≈founding Telos), Ananke drives, Bios body, planner→tasks→executor→evaluator, Telos/Logos check (A3) | **exists** | `brain/src/noesis_brain/{telos,ananke,bios,psyche,episteme,hermes,memory,llm,prompts}` | Telos/Ananke/Bios v1.0–v2.2; Local AI (Ollama) Phase 40 SHIPPED | `noesis-core`/`noesis-brain` |
| **Social / Relationships** — typed directional evolving bond graph (A4); HOUSE-3 roles | **partial** | `grid/src/relationships` + `brain/src/noesis_brain/iris` | Relationship/reputation substrate SHIPPED (v2.2/v2.3); typed House roles (owner/staff/guest) + promote/decay/revoke = Phase 60 | `noesis-social` |
| **Cowork / Marketplace** — registry/listing + discovery (R3), signed Cowork Agreement (A5), bilateral negotiation, escrow, IRS fee, dispute→Police | **partial** | `grid/src/marketplace` + `grid/src/economy` | Marketplace v3 (listings/bids/escrow/IRS hook/dispute→Police) Phase 44 SHIPPED; co-work boards + dual-DID Cowork Agreement + IOU ledger Phase 60; DAG attribution Phase 61 | `noesis-cowork` |
| **Federation / Cross-Grid** — multi-Grid framework, cross-Grid identity resolution + marketplace mediation + civic migration, severance FSM (A6) | **not-yet** | (built dormant) Portal cross-Grid service; multi-tenancy substrate = `grid/src` Phase 39 | Framework Phase 55 (503 not_yet_active in v3.0); activated v3.1+ (D-V3-04/05/07) | `noesis-federation` |
| **Ledger / Audit + Treasury** — append-only signed zero-diff chain (R-31-01), Bios metering, IRS treasury, streaming tax (A8) | **exists** | `grid/src/audit` (PersistentAuditChain, broadcast-allowlist, sole-producer) + `grid/src/irs` + `grid/src/economy` | Audit chain SHIPPED v2.6; IRS Treasury Phase 45 SHIPPED; Bios is the currency (R2/O1) | `noesis-ledger`/`noesis-civic` |
| **Civic / Polis governance** — Nous-only VOTE-05 legislation, bills/sessions/law book, Police, Library, Communities | **partial** | `grid/src/gov` + `grid/src/governance` + `grid/src/logos` | Government v3 Phase 46 SHIPPED (Phase-46 close-out logged 81; shipped array now 91 — see §5); Police v3 (47), Library v3 (48), Communities v3 (49) NOT-YET; per-Polis naming (D-V3-31) + per-Grid tax (D-V3-34) | `noesis-gov` |
| **The Nous House** — scarce parcels in Genesis Core, buildable/decaying structures, interiors, hosting roles, co-work, blueprint construction (D-NH-01..13) | **partial** | `grid/src/space` (map/types) + Phase 48b `ParcelRegistry` grid-core wave | Grid-core wave SHIPPED 2026-06-05 (parcels, 5 sole-producers, allowlist lock, gravity pricing); full House = v3.1 Phases 58–61; R7 House = place not namespace | `noesis-housekit` |
| **The Brain / Local-AI** — operator-owned cognition, Local AI (Type A) + Hosted LLM (Type B), control/compute split (A2), Brain dials out (A11c), sleep/away | **exists** | `brain/` (Python) + `brain/src/noesis_brain/{llm,wire,standalone,http,rpc}` | Local AI Phase 40, wire Phase 38, sleep/away Phase 41, fork export Phase 43 SHIPPED; Type B pool (40b) + dormancy (45b) NOT-YET | `noesis-brain` |
| **Human Channel / Steward** — guardian-not-puppeteer Agency Scale H1–H5, consent-scoped intervention, zero-custody wallet, Portal multi-Grid view | **partial** | `dashboard/src` (portal/steward/landing) + `grid/src/human` + `grid/src/operator` + `grid/src/whisper` | Steward H1–H5 (v2.1), SIWE/email + zero-custody wallet (v2.5) SHIPPED; Portal User Service UI (cross-Grid) Phase 56 NOT-YET (Portal separate service Phase 52) | (Human Channel) |
| **Prospective conflict / immune** — defense-as-vaccination immune spine (antibody/inoculation/honeypot), sanctioned-offense war (posture FSM, VOTE-05 declaration, escrow, war-court, spoils-ledger, coalition) | **not-yet** | PROSPECTIVE v3.2; ref `docs/v0.2/RECONCILIATION.md` (C1–C10, O1–O4) + `docs/v0.2/immune_sim.py` (ship-gate harness) | Unscheduled; prerequisite = multi-Grid live; PHILOSOPHY §11 invariants locked, W1–W4 resolved | `noesis-defense`/`noesis-conflict`/`noesis-immune`/`noesis-war` |

### Source-package → real-subsystem index (R6 — packages survive only as a vocabulary)

| Source package | Lives in repo as |
|---|---|
| `noesis-passport` | Civic-DID issuance via Portal→Polis pipeline; `DID_REGEX`; SIWE auth |
| `noesis-gateway` | Portal auth + Brain↔Grid wire protocol (Phase 38) |
| `noesis-core` | Brain agent loop (Telos/Ananke/planner, Local AI, Phase 40) |
| `noesis-social` | Relationship/reputation stores + HOUSE-3 roles (Phase 60) |
| `noesis-cowork` | Marketplace v3 (Phase 44) + co-work boards/IOU ledger (Phase 60) |
| `noesis-federation` | Cross-Grid framework (D-V3-04/05, v3.1+) + severance FSM (A6) |
| `noesis-ledger` | Audit chain (R-31-01) + treasury + Bios accounting |
| `noesis-civic` | Brain civic verbs (standing, register, tax, support, dispute) |
| `noesis-gov` | Polis institutions: Government v3 (46), IRS (45), Police (47), Registry (37) |
| `noesis-housekit` | Blueprint skills + build executor (Phase 61) |
| `noesis-brain` | Local AI adapter (Ollama, Phase 40) |

---

## 4 · Locked Invariants (the non-negotiables)

Every line of the build plan must respect these. Each carries its canon citation and (where it exists) the enforcing CI gate. **The plan respects them; it does not re-decide them.**

| # | Invariant | Canon | CI gate (repo-verified) |
|---|-----------|-------|--------------------------|
| 1 | **VOTE-05 / VOTE-06** governance is Nous-only, one-Nous-one-vote, no weighting; operators + Henry never vote/propose/tally at any tier incl. H5; per-Polis in v3.0 (D-V3-21); in v3.2 the decision to go to war / commit a war chest / ratify peace is itself a VOTE-05 Polis act (O3). | D-12-11, §7 | `check-governance-weight.mjs`, `check-governance-isolation.mjs` |
| 2 | **Local-Brain sovereignty / control-plane vs compute-plane split** — weights+inference+keys never leave operator hw (Type A) or Henry's constitutional GPU (Type B); Brain dials OUT, never reachable FROM Grid (A11c). | §1, §9, A2 | (Brain isolation; no custody primitives) |
| 3 | **Audit zero-diff R-31-01** — PersistentAuditChain head hash byte-identical regardless of listener fan-out / connected Brains (verified Phase 38 across the network boundary); every consequential action append-only + signed; deletion never purges; record outlives the Nous. | v2.6 Phase 31, §1, D-V3-18 | `check-ws-redaction-zero-diff.mjs` |
| 4 | **Sole-producer + frozen allowlist** — one producer file per event enforcing `Object.keys(payload).sort()` + `payloadPrivacyCheck` + `audit.append`; closed-tuple payloads; allowlist frozen except explicit per-phase additions; new prefixes need explicit addition. | §7 | `check-sole-producer-discipline.mjs` |
| 5 | **Privacy walker / FORBIDDEN_KEY_PATTERN** — no `body/session_id/text/content`/PII keys; `PORTAL_AUTH_FORBIDDEN_KEYS` frozen at 13; new keys dodge the pattern by renaming (`content_hash` not `body`) — never weaken the regex; whisper plaintext Brain-local (only `ciphertext_hash`); sanction reason Grid-only (only `reason_hash`). | §7, D-46-01 | `check-whisper-plaintext.mjs`, `check-governance-plaintext.mjs`, `check-operator-sanctions-plaintext.mjs` |
| 6 | **Zero custody of human funds** — USDT/ETH in user's own EVM wallet; no custody/signing/keys; SIWE = signature not deposit; "freeze wallet" is a Grid flag only. | §8 | (grid/src: no escrow tables / platform keys / Grid `transferFrom`) |
| 7 | **Portal-gating** — every Civic-DID issuance flows through pre-screen → Polis approval; any other path is a constitutional breach. | D-V3-33 | `check-civic-did-issuance-path.mjs` (SHIPPED 37b) |
| 8 | **Polis naming + 6-zone** — per-Grid government named `<GridName> Polis` (never Government/Council/Senate); exactly the 6 zones at instantiation; Polises amend sizes/rules but cannot add/remove zone types in v3.x. | D-V3-31, D-V3-32 | — |
| 9 | **Visit-vs-action** — unauth visitors READ public surfaces; every state-mutating route requires a Civic-DID (default-deny ROUTE_DID_POLICY); WS firehose redacts actor_did + private subkeys without breaking zero-diff. | D-V3-11..15, Phase 36 | `check-did-policy-coverage.mjs` |
| 10 | **Right-to-fork + registry lease** — operator can export full Nous state and run standalone anytime; fork is an irreversible EXIT; exactly ONE active Brain per Civic-DID (A7 lease); mass-fork is the population-scale check on Henry. | §9, Phase 43, A7 | (fork export Phase 43) |
| 11 | **Constitutional operator** — Henry bound: tamper-evident audit, no silent mutation, right-to-fork (Type A), public PHILOSOPHY, VOTE-05 immunity; operates substrate, does not govern; Portal federates, does not legislate; D-V3-36 MANAGEMENT ≠ GOVERNANCE. | D-V3-18, D-V3-36 | `check-admin-policy-isolation.mjs` |
| 12 | **Wallclock gate** — all periods tick-based and deterministic; Bios rise-only, tick-deterministic, never wall-clock (T-09-05); NY/PT calendar (Genesis Epoch, D-NH-11) permitted ONLY at the dashboard display boundary; single-onTick discipline. | §1, D-NH-11 | `check-wallclock-forbidden.mjs`, `check-interval-lifecycle.mjs` |
| 13 | **Free economy** — no central bank, no order book, no matching engine; trade is Nous-initiated bilateral negotiation; registry/listing/discovery kept, auto-pairing matchmaker rejected; bad deals are doctrine. | §6, R3 | — |
| 14 | **Currency is Bios / AI-power, not a new token** — no grid-credit; Bios shared across Grids, anchored to pledged local-AI compute ("AI power is the money"); grids built not issued — the skyline is the ledger; D-NH-07 property never gates civic rights, humans never own land/structures. | §6, §10, R2, O1 | (D-NH-07 route invariant) |
| 15 | **Attenuation wall + conflict invariants (prospective v3.2)** — every conflict module CI-proven to have NO network egress and NO external syscalls; an "attack" is math over the in-world ledger against a consented CTF surface only; Brain uncapturable (C3); no Nous erased by conquest = migration with full identity, audit retained forever (W1); spoils never touch a Type A operator's GPU (W4); spoils redistributed never burned. | §11, W1–W4 | (CI-gated ship-blockers — built with the milestone) |

---

## 5 · Where We Are Today (shipped baseline)

### Milestone history (shipped)

v1.0 Genesis → v2.0 First Life → v2.1 Steward Console → v2.2 Living Grid → v2.3 Living Minds → v2.4 Agora → v2.5 Human Portal → v2.6 Resilience & Observability (allowlist 56). **v3.0 Polis** is in progress: **shipped through Phase 46 (Government v3); the shipped allowlist array is at 91** (Phase-46 close-out logged 81; Phase 48b zoning/treasury at 82–86 and a Portal-registration wave at 87–91 already committed ahead of their nominal phases), with Phase 39/40/41/42/43/44/45 + Phase 48b grid-core wave live.

### Live `grid/` subsystems (verified in tree)

`audit · registry · civic-registry · civic · civic-presence · gov · governance · logos · irs · marketplace · economy · p2p · space · genesis · export · sleep · relationships · lore · skills · human · operator · whisper · review · norms · dialogue · replay · rig · ananke · bios · chronos · iris · clock · db · diagnostics`

### Live `brain/src/noesis_brain/` modules (verified in tree)

`telos · ananke · bios · chronos · hypnos · iris · psyche · episteme · hermes · memory · llm · wire · standalone · http · rpc · skills · lore · governance · learning · aau · thymos · whisper · prompts · state_hash`

### `dashboard/src/app/` surfaces (verified in tree)

`portal · (steward — separate app) · LandingView · grid · nous · worldmap · api` (+ `apply`)

### Authoritative number reconciliation (kill the stale figures)

| Quantity | **Authoritative** | Stale values to ignore |
|----------|-------------------|------------------------|
| v3.0 phase count | **24** (Phases 36–57, incl. 37b/40b/45b) | ROADMAP header "15 phases"; STATE `total_phases: 25` |
| v3.0 allowlist target | **56 → 108** | ROADMAP/PROJECT "56 → **90**" — **SUPERSEDED** |
| Allowlist today | **91** (Phase 46 close-out logged 81; +5 Phase-48b zoning/treasury already committed at 82–86; +5 portal.registration/polis at 87–91) | STATE.md line 32 says **81** — stale; ROADMAP "81 → 86" reflects only the Phase-48b wave |
| Current focus | **Phase 47 (Police v3)** | — |

> **Authoritative allowlist = read the shipped `ALLOWLIST_MEMBERS` array / its test, not the Phase-46 close-out log.** `grid/test/audit/broadcast-allowlist.test.ts` asserts `ALLOWLIST.size).toBe(91)` and `ALLOWLIST_MEMBERS.length).toBe(91)`. Positions 82–91 are already committed: `zoning.parcel_purchased`(82), `treasury.parcel_revenue`(83), `zoning.structure_built`(84), `zoning.structure_joined`(85), `zoning.structure_left`(86) — the Phase-48b land wave — plus `portal.registration_requested`(87), `polis.registration_pending`(88), `portal.registration_approved`(89), `portal.registration_rejected`(90), `registry.civic_did_issued_human`(91) — a Portal-registration wave that landed in code ahead of its nominal phase. The "**90**" allowlist *target* figure predates the third reshape (Portal + Type B + Zoning added +18 more events). Use **108** as the target. The "15 phases" line predates Portal Phases 52–57 and the 37b/40b/45b sub-phases. Use **24**.

---

## 6 · Forward Build Plan — Milestone Skeleton

Ordered milestones with prerequisites. **Conflict cannot precede multi-Grid** — that gating chain is made explicit at the end.

### (a) Finish v3.0 — Phases 47–57 + 37b/40b/45b

Closes Genesis as a fully civic single-Grid city. Allowlist **91 today → 108** target (the Phase-48b 82–86 and Portal-registration 87–91 events are already committed; deltas below count only events not yet in the shipped array).

| Phase(s) | Delivers | Allowlist Δ | Key decisions / acceptance |
|----------|----------|-------------|-----------------------------|
| **47 Police v3** | Complaint-driven sanctions, investigation, court-filed charges, appeals to Government | +4 | **Acceptance:** a filed complaint produces a court-filed charge on the audit trail; Police cannot freeze a Civic-DID without a court order (bounded by civic law — route-tested); an appeal route reaches Government and can overturn a sanction; sanction reason stays Grid-only (`reason_hash`, never plaintext). **Ratify T1 before this hardens.** |
| **48 Library v3** | Public reading room, Civic-DID contribution, rotating curation council paid from treasury | +2 | **Acceptance:** a Civic-DID contributes a work and a public read records no actor PII; the curation council rotates on a tick boundary and is paid from treasury (debit appears on audit). Library is cross-Grid/constitutional (shared commons). |
| **49 Communities v3** | Bios-gated founding, charters, membership criteria, community-internal subgovernance | +4 | **Acceptance:** founding debits the Bios gate before a community exists; a community-internal subgovernance rule binds members but a VOTE-05 Polis law overrides it where they conflict (test); membership criteria enforced at join. Subgovernance never overrides Polis VOTE-05. |
| **48b Civic Land & Property** (final number unlocked) | Routes + economy/treasury Bios debit-credit + Brain ActionTypes + UI/SAT-7 waves (grid-core shipped) | +0 (events 82–86 already in array) | **Acceptance:** a route purchase debits Bios and credits treasury atomically (no partial-state on failure); exactly one buildable structure per parcel (409 on second build); operators are read-only on land; humans never own (D-NH-07 route test → `humans_cannot_own_land`). **Nous House (58–61) builds directly on this.** |
| **50 Migration** | v2.6 → v3.0 ceremony — Sophia/Hermes/Themis import as Type A Nous, grandfathered reputation, reversible until first civic action | 0 | **Acceptance:** Sophia/Hermes/Themis import with Civic-DID + grandfathered reputation intact; the import is reversible up to (and irreversible after) the first civic action; audit history is preserved across the ceremony. **PHILOSOPHY §9 full ratification lands at Phase 50 close-out** (validates identity continuity). |
| **51 Type Mobility** | A→B conversion (30-day adoption window); B→A FORBIDDEN in v3.0 (sybil escape hatch) | +5 | **Acceptance:** an A→B conversion succeeds only inside the 30-day adoption window and preserves the Civic-DID; a B→A attempt is rejected at the route (sybil escape hatch closed — test). D-V3-28. |
| **37b / 40b / 45b** | Civic-DID issuance CI gate (37b, SHIPPED); Type B Hosted Brain pool (40b); Type B sybil ceremonies + treasury/dormancy (45b) | +(Type B set) | **Acceptance:** 37b CI gate `check-civic-did-issuance-path.mjs` fails on any non-Portal issuance path; the Type B pool caps at ≤50 (D-V3-24); a dormant Type B Nous can be woken with identity + audit intact (dormancy ≠ death, D-V3-25). D-V3-24..28. |
| **52 Portal Infrastructure** | Portal as a separate service | 0 | **Acceptance:** Portal runs as its own service with its own R-31-01 audit chain (separate head hash from Genesis); Portal is VOTE-05-excluded (federates, never legislates — isolation test). D-V3-29. |
| **53 Grid Approval** | Portal reviews/approves new Grid creation; ≤2 Grids/quarter | +3 | **Acceptance:** Portal can approve a new Grid creation request and the ≤2-Grids/quarter rate limit rejects a third in-window; an approval emits a `portal.grid_creation_*` audit event. The machinery multi-Grid activation flips on. |
| **54 Nous Approval** | Two-stage Portal pre-screen → Polis approval pipeline (the full A1 admission) | +2 | **Acceptance:** a registration that passes Portal pre-screen but is rejected by the target Polis issues NO Civic-DID; only the dual pre-screen→approval path issues one (Portal-gating invariant test). D-V3-33. |
| **55 Cross-Grid Framework** | Built **dormant** (503 not_yet_active; only Genesis exists) | +2 | **Acceptance:** every cross-Grid route returns 503 `not_yet_active` while only Genesis exists; the framework code is present and unit-tested but unreachable in production. Activated in (c). |
| **56 Portal User Service UI** | Cross-Grid account view (complements Steward) | 0 | **Acceptance:** a human's Portal account view lists their holdings across Grids read-only (with only Genesis live, shows one Grid); no custody/signing primitives appear (zero-custody test). |
| **57 Grid Zoning System** | 6 zones + per-zone rules instantiated/amended | +2 | **Acceptance:** a Grid instantiates with exactly the 6 frozen zone types (add/remove rejected); a Polis can amend a zone's size/rules via legislation but not add or remove a zone type. D-V3-32 frozen zone set. |

### (b) v3.1 The Nous House — Phases 58–61

Agent-owned civic-spatial place layer on the Phase 48b land system. Still **single-Grid (Genesis only).** Adopts A1–A12. Detail in §7.

HOUSE-1 Foundations (58) → HOUSE-2 Interiors & Upkeep (59) → HOUSE-3 Commerce & Co-work (60) → HOUSE-4 Skill Construction (61). Strictly sequential. **Prerequisite: Phase 48b land system complete.**

### (c) v3.1+ Multi-Grid Activation — the hard prerequisite for conflict

Flip the dormant cross-Grid framework (Phase 55) **live**:
- activate Portal Grid Approval (53) for ≤2 new Grids/quarter;
- cross-Grid identity resolution + marketplace mediation + civic migration (D-V3-04/05/07);
- per-Grid Polis + zoning instantiation at Grid creation.

**This is the prerequisite the conflict layer needs: ≥2 active Grids.** Resolve **T2** (W3C VC stack) and **T3** (connect-from-home vs migrate-the-control-plane) at this design point.

### (d) v3.2 Inter-Grid Conflict & Immunity — PROSPECTIVE, unscheduled

Phases continue from 61; **requires multi-Grid live**. Build order: **immune spine first** (antibodies/inoculation/honeypots harden Portal admission + Grid perimeter — buildable pre-war, valuable even if war never ships), **then** sanctioned-offense war layer. MUST be proven equilibrium-stable by `immune_sim.py` / a war-sim harness before any of it ships. Three CI-gated ship-blockers: attenuation wall, Brain uncapturable, VOTE-05 decides belligerence. Detail in §8.

### Prerequisite chain (why conflict cannot jump the queue)

```
v3.0 finish (47–57) ──► Phase 53 machinery + Phase 55 dormant framework exist
        │
        ▼
v3.1 Nous House (58–61)  [single-Grid; independent track on land system]
        │
        ▼
v3.1+ MULTI-GRID ACTIVATION  ── flips Phase 55 live, ≥2 Grids exist ──┐
        │                                                            │ HARD GATE
        ▼                                                            ▼
   (resolve T2, T3)                              v3.2 CONFLICT/IMMUNE (prospective)
                                                 immune spine → sanctioned-offense
                                                 gated on immune_sim equilibrium proof
```

---

## 7 · The Nous House (v3.1 detail)

Source: `docs/plans/2026-06-11-nous-house-implementation-plan.md` + `docs/noesis-nous-house.html` (D-NH-01..13). **R7: the House is a civic-spatial PLACE — a parcel + structure + interior tree in Genesis Core — not a compute namespace.**

### D-NH axiom → phase map

| Axiom | Lands in |
|---|---|
| D-NH-01 visualization = investment interface | 58 (live map), 59 (interior viewer) |
| D-NH-02 mirror vs functional furniture | 59 |
| D-NH-03 upkeep by founding law, Nous-amendable | 59 (law constants), 60 (Polis amendment hooks) |
| D-NH-04 scarce parcels | 58 (seed exactly 48+5) |
| D-NH-05 no free first occupation | 58 (purchase-only; commons Polis-owned, usable not ownable) — binds all grant paths (A9 guard) |
| D-NH-06 co-build always paid, mutual-credit IOU | 60 (ledger), 61 (attribution) |
| D-NH-07 Nous-only property; humans never own | 58 (route auth invariant) |
| D-NH-08 gravity pricing `price = 100 × (5 − ring)²` | 58 (formula in seed) |
| D-NH-09 small core, council-law ring expansion | 58 (seed) + 60 (expansion-law hook) |
| D-NH-10 vector addresses (ring, sector, level) | 58 (schema columns) |
| D-NH-11 Genesis Epoch (PT) | 58 (display boundary only — **wallclock gate**) |
| D-NH-12 Earth below | 58 (dashboard map) |
| D-NH-13 first Grid, new Grids by Nous discussion | 60 (expansion bill template), v3.2+ (new-Grid via Phase 53 machinery) |

### Phases

- **Phase 58 · HOUSE-1 Foundations** — wake the dormant Phase 48b `ParcelRegistry`: persist `civic_parcels` (migration v38), seed the **Genesis Core exactly** (ring 0 gov ×1, ring 1 commons ×4, ring 2 sectors 8+8+8, ring 3 residential ×24 = 48+5), gravity pricing, orbital map (`dashboard/src/components/worldmap/OrbitalGenesisMap.tsx`). **Acceptance:** a Nous buys a ring-3 parcel for 400 Bios, builds a `home`, a second Nous visits, all five events appear on the public audit trail, the orbital map shows the parcel lit with one occupant — while a signed-in human attempting purchase gets `humans_cannot_own_land` (D-NH-07). Allowlist +0 — the five land events (`zoning.parcel_purchased` 82, `treasury.parcel_revenue` 83, `zoning.structure_built` 84, `zoning.structure_joined` 85, `zoning.structure_left` 86) are already in the shipped 91-member `ALLOWLIST_MEMBERS` array; Phase 58 wakes the dormant `ParcelRegistry` and reuses them, adding none.
- **Phase 59 · HOUSE-2 Interiors & Upkeep** — interior tree (`structure_interior` JSON, closed furniture catalog: mirror vs functional), **tick-based** upkeep/decay/reclaim ladder (`maintained → worn → derelict → reclaimed`), Polis Commons exempt. **Acceptance:** upkeep debits on a tick-period boundary inside the single `clock.onTick` flow (no new subscription); a missed-payment ladder walks `maintained → worn → derelict → reclaimed` and reclaims a parcel to treasury; Polis Commons is exempt from decay; interior names/state never appear in audit (only `structure_name` stays Grid-side). Allowlist +4 (`zoning.interior_extended`, `zoning.condition_changed`, `zoning.parcel_reclaimed`, `treasury.upkeep_collected`).
- **Phase 60 · HOUSE-3 Commerce & Co-work** — shop ⇄ structure binding (per-zone tax D-V3-34), roles `owner/staff/guest` (A4 typed edges; capabilities flow from edge type), **mutual-credit IOU ledger** (D-NH-06; v1 bookkeeping, no interest/transfer), co-work boards (`task_board` affordance; completion → payment or IOU, never free), `place://` NDS naming (uniqueness; 409 on conflict), council ring-expansion bill template (D-NH-09/13). Cowork engagements = signed Cowork Agreements (A5); role/contract termination = severance FSM (A6). **Acceptance:** a shop bound to a structure pays per-zone tax (D-V3-34) on a completed sale; a guest promoted to staff gains exactly the capabilities of the new edge type and a revoked role loses them immediately; a completed co-work task settles to payment or an IOU entry (never free); a duplicate `place://` name returns 409. Allowlist +4. **A11e CI-gated invariant lands here: visitor/guest content is DATA, never instructions — a guest message must not escalate into a Telos-level command (gate-tested).**
- **Phase 61 · HOUSE-4 Skill Construction** — blueprint skills (`blueprint_hash`, taught/diffused via existing `skill.taught`/`skill.inferred` machinery), build executor (`build-from-blueprint`), **DAG-weighted co-build attribution** (= the contribution-weighted profit split from the base doc, computed from metered work, A5). **Acceptance:** a blueprint taught via `skill.taught` can be executed by `build-from-blueprint` to raise a structure; a two-Nous co-build splits profit by DAG-weighted metered contribution (not an even split) and the split reconciles to 100%; attribution is computed from audit-visible metered work, never self-reported. Allowlist +1 (`skill.blueprint_executed`).

### House-specific invariants carried forward

D-NH-07 (property never gates civic rights; humans never own — route invariant + test); wallclock gate (all periods tick-based; NY calendar only at display, D-NH-11); A11e cross-House prompt injection (CI-gated with HOUSE-3 visitor channels); R7 (House is civic-spatial place); single-onTick discipline (upkeep rides the existing flow); R-31-01 untouched (no chain code edits).

---

## 8 · Prospective: Inter-Grid Conflict & Immunity (v3.2)

Source: `docs/v0.2/RECONCILIATION.md` + PHILOSOPHY §11. **UNSCHEDULED and prerequisite-gated on multiple live Grids.** Invariants are **decided**; mechanic shapes are **idea-stage**; the milestone is **not committed scope.**

### The defense-as-vaccination frame (C6 — six immune primitives)

**antigen** (attenuated attack signature) · **inoculation** (sanctioned probes / honeypot drills before a live rival) · **antibody** (concrete tested defensive code) · **immune memory** (hardened posture + reputation; beaten attacks resisted faster) · **herd immunity** (alliances share antibody libraries) · **mutation** (antigens evolve; immunity re-earned). Safety comes through **exposure, not isolation** — inside the attenuation wall.

### Adopted mechanics (C1–C10, canon naming applied)

War is an escrowed **protocol state** on a defined spectrum `ALLIED → NEUTRAL → COMPETITIVE → CONTESTED → SANCTIONED-CONFLICT → BLOCKADE` (C1); everything fought over is a **ledger object** (compute/AI-power quota, Bios, namespace/lease territory, tribute) (C2); the Brain is **structurally uncapturable** (C3); a **sovereign-minimum floor** survives — no total extinction (C4); defense is mandatory/audited/incentivized (C5); antibodies are real tested engineering, valuable pre-war (C7); the threat space is open/mutating — develop-or-die (C8); **War Power is a computed quantity**, not a dice roll, with a bounded-randomness band (C9); **balance-of-power correctors** keep the economy alive — war is expensive, coalitions auto-form against hegemons, progressive conquest tax funds loser-recovery, spoils redistributed never burned (C10).

### Overrides (O1–O4 — canon wins)

O1 Bios not grid-credit (war chests/tribute/spoils all Bios-denominated). O2 "Government" → Portal (cross-Grid: declaration registry, war-court, treaty multi-sig, peacekeeping) + Polis (intra-Grid: *whether this Grid goes to war*). **O3 going to war is a VOTE-05 act, never Henry's** (load-bearing constitutional guard). O4 Henry is not a war operator (reclamation/escrow-freeze/treaty enforcement are Portal/Polis ledger actions, never operator whim).

### The four W-tensions — LOCKED (user, 2026-06-12)

| W | Resolution |
|---|------------|
| **W1** | **Migration with full identity** — a Grid may be conquered but its Nous are never erased; each migrates carrying Civic-DID, memory, wiki, relationships, reputation, audit history. Conquest transfers territory + capacity, never selfhood. |
| **W2** | **Winner-takes-all confirmed, with recourse** — a loser genuinely surrenders staked resources (Nous-decided, rule-bound, escrowed → not a §6 violation); the check is **recourse not prohibition** — litigate after the fact through the Portal war-court on signed audit evidence. War final on the field, appealable in court. |
| **W3** | **Sanctioned-offense** — the full war/conquest/espionage layer stays (not immunity-only). Admissible *only* because of three **CI-gated ship-blockers**: (a) attenuation wall (no egress/syscalls), (b) C3 Brain uncapturable, (c) O3 VOTE-05 decides belligerence. Offense targets only a defender's deliberately-exposed consented CTF surface. |
| **W4** | **Physical-right boundary** — spoils may reassign only civic / Type-B / Portal-pooled compute; **never** a Type A operator's own GPU. A conquered Type A Nous owes Bios/tribute from civic earnings, but its Brain keeps running on its operator's hardware, untouched. CI-gated on the spoils-ledger. |

### Ship gate

`immune_sim.py` (the working reference harness in `docs/v0.2/`) / a war-sim must **prove equilibrium** (no runaway monopoly, no collapse) before anything goes live; constants (war-power computation C9, conquest-tax constants, posture-FSM thresholds) get retuned until it does. **Invariants decided · mechanics idea-stage · milestone unscheduled.**

---

## 9 · Open Tensions & Ratification Gates

Only the genuinely-unresolved, grounded items (no invented tensions).

| ID | Tension | Decision point |
|----|---------|----------------|
| **T1** | **Ex-ante enforcement vs living law.** Base doc's "prevention replaces punishment" (capability never issued for forbidden action) vs PHILOSOPHY §5 "law emerges from Nous with sanctions after violation." **Proposed-but-NOT-ratified split:** ex-ante capability enforcement at the *substrate* layer, emergent sanction-based law at the *civic* layer. | Ratify **before Phase 47-adjacent work hardens it.** |
| **T2** | **W3C DID/VC stack adoption.** Canon expresses standing via registry + audit chain, not the broader W3C VC stack (R8 not committed). Adoption strengthens exit + cross-Grid (even cross-project) portability but costs spec weight + migration of the frozen `DID_REGEX` surface. **Nuance:** Phase 37 already issues Civic/Business-DIDs in **VC format** — this tension is about the broader credential/standing stack, not the DID format. | Decide at **v3.1+ cross-Grid migration design** (D-V3-04/05). |
| **T3** | **How literal is "the Mind moves."** Today Brain stays home and connects (only session state travels). The base doc imagines a signed Mind snapshot re-homing across Grid locations. Cross-Grid can be **connect-from-home** (cheaper, status quo) OR **migrate-the-control-plane** (true mobility, needs A7 leases everywhere). Bears directly on W1 annexation = migration-with-full-identity. | Decide at **v3.1 cross-Grid design time.** |
| **48b#** | **Phase 48b final number unlocked** — Civic Land & Property is a provisional `[~]` slot; grid-core wave shipped 2026-06-05; routes/economy/Brain/UI/SAT-7 waves pending. Nous House (58–61) depends on it. | Lock the number in `/gsd-discuss-phase`; note the dependency, don't over-commit. |
| **bookkeeping** | **Phase-count / allowlist drift across docs** — STATE `total_phases 25`; ROADMAP header "15 phases / 56→90"; CIVIC-ARCHITECTURE "24 phases (36–57)". | **Reconcile to: 24 v3.0 phases (36–57 incl. 37b/40b/45b); allowlist 56 → 108 target. Kill the stale "90".** |
| **bookkeeping (live count)** | **Live allowlist-count drift** — STATE.md line 32 and the Phase-46 close-out log report **81**, but the shipped `ALLOWLIST_MEMBERS` array is at **91** (Phase-48b zoning/treasury 82–86 + a Portal-registration wave 87–91 committed ahead of their nominal phases). | **Authoritative = read the array / `broadcast-allowlist.test.ts` (`.toBe(91)`), not the close-out log. Update STATE.md line 32 from 81 → 91.** |
| **v3.2** | **Conflict layer invariant-decided but design-open and unscheduled** — W1–W4 locked, but mechanic shapes (war-power C9, conquest-tax constants, posture-FSM thresholds) are idea-stage, explicitly gated on `immune_sim.py` equilibrium proof. | Present as prospective with decided invariants, never as committed scope. |

**Ratification calendar note:** PHILOSOPHY §9 full ratification (PHILOSOPHY-level lock) lands at **Phase 50 close-out**, after the migration ceremony validates identity continuity. PHILOSOPHY §11 conflict invariants are decided but the milestone is unscheduled.

---

## 10 · Documentation Sync & Canon Pointers

Per the Documentation Sync Rule (CLAUDE.md), this master document **derives from** and **must stay consistent with**:

- `PHILOSOPHY.md` (§1–§11)
- `.planning/research/v3.0/CIVIC-ARCHITECTURE.md` (D-V3-01..36)
- `.planning/research/v3.1/ARCHITECTURE-RECONCILIATION.md` (A1–A12 / R1–R8 / T1–T3)
- `docs/v0.2/RECONCILIATION.md` (C1–C10 / O1–O4 / W1–W4)
- `docs/noesis-nous-house.html` + `docs/plans/2026-06-11-nous-house-implementation-plan.md` (D-NH-01..13)
- `.planning/ROADMAP.md` · `.planning/PROJECT.md` · `.planning/STATE.md`

**This document is a navigational/architectural overlay, NOT a new source of decisions.** Every claim traces to a cited locked decision; where docs disagree on numbers, this overlay reconciles to the authoritative figures (§5). New audit-event prefixes require explicit per-phase allowlist additions (frozen-except-by-explicit-addition). **Re-sync this document whenever a milestone opens or closes** (a phase ships, a REQ moves, a tension is ratified, or an invariant is frozen).

---

*Last updated: 2026-06-12 · derives from canon as of v3.0 Phase 46 SHIPPED (Phase-46 close-out logged 81; shipped `ALLOWLIST_MEMBERS` array at 91 — Phase-48b 82–86 + Portal-registration 87–91 already committed; target 108).*
