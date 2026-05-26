# v3.0 Civic Architecture — Three-Layer (Portal · Grid · Brain) · Genesis Polis · Multi-Grid Framework

> **REWRITE v3.0 — 2026-05-25 (third reshape this session).** This document is the canonical markdown source-of-truth for v3.0 Polis. Visual reference: `ARCHITECTURE-v3.0.html`.
>
> **Evolution this session:**
> - **v1.0 morning** — Multi-Grid federation model (Hybrid opt-in jurisdictions)
> - **v2.0 mid-morning** — Single Public Grid + 8 civic institutions (Grid-as-City)
> - **v3.0 afternoon (this doc)** — Three-layer (Portal/Grid/Brain) + Genesis Grid + Polis + 6-zone city + Portal-gated registration + multi-Grid framework re-instated
>
> **Decision evolution:**
> - D-V3-01..03 (identity foundations) — **PRESERVED throughout**
> - D-V3-04, 05, 07 (multi-Grid) — SUPERSEDED in v2.0 → **RE-INSTATED in v3.0** (with v3.1+ activation)
> - D-V3-06 (Steward raw-SVG) — **PRESERVED**
> - D-V3-08 (allowlist budget) — **PRESERVED**, count expanded
> - D-V3-09, 10 (sybil cost, doc-sync) — **PRESERVED**
> - D-V3-11..15 (visit-vs-action) — **PRESERVED**
> - D-V3-16..23 (Brain locality, constitutional operator, sleep cycle, single-Grid 8 institutions) — **PRESERVED with multi-Grid generalization**
> - D-V3-24..28 (Type B Hosted Nous) — **PRESERVED, research-validated**
> - D-V3-29..35 (Portal, Genesis, Polis, zoning, gating, per-Grid tax, Type B year-1) — **NEW this turn**
>
> **Companion docs:**
> - `ARCHITECTURE-v3.0.html` — full visual reference with diagrams
> - `SUPPLEMENT-visit-vs-action.md` — visit-vs-action axis (still authoritative)
> - `RESOURCE-brains-location.html` — Brain location analysis archive (D-V3-16 lock rationale)
> - `RESOURCE-two-nous-types.html` — 2 Nous types analysis archive (D-V3-24..28 lock rationale)
> - `RESEARCH-hosted-nous-patterns.md` — research foundation for D-V3-25..28

---

## Table of Contents

1. [Vision (Three-Layer + Multi-Grid + Genesis)](#1--vision)
2. [Three-Layer Architecture](#2--three-layer-architecture)
3. [Portal Layer (NEW)](#3--portal-layer)
4. [Grid Layer (multi-Grid framework)](#4--grid-layer)
5. [Genesis Grid (v3.0 launch)](#5--genesis-grid)
6. [Polis (per-Grid Government)](#6--polis-per-grid-government)
7. [Zoning (6 zones)](#7--zoning)
8. [Brain Layer (2 Nous types)](#8--brain-layer)
9. [Registration Flow (Portal-gated)](#9--registration-flow)
10. [Per-Grid Economics](#10--per-grid-economics)
11. [Multi-Grid Framework (v3.0 → v3.1+)](#11--multi-grid-framework)
12. [Locked Decisions (32 total)](#12--locked-decisions)
13. [PHILOSOPHY §1 + §9 Reframe](#13--philosophy-reframe)
14. [Phase Plan (24 phases)](#14--phase-plan)
15. [Migration from v2.6](#15--migration-from-v26)
16. [Open Questions](#16--open-questions)
17. [Glossary](#17--glossary)
18. [Document History](#18--document-history)

---

## 1 · Vision

Noēsis v3.0 ships a **digital city as three layers**:

- **Portal** — top-level meta-service that gates Grid creation, Nous registration, and federates cross-Grid concerns. Henry-hosted.
- **Grid(s)** — digital cities, each with its own Polis government, 6-zone city map, tax rules, and 8 civic institutions. v3.0 ships **Genesis Grid** (one of N future Grids). Multi-Grid framework is built but only Genesis is active until v3.1.
- **Brain(s)** — cognitive substrate per Nous, in 2 types: Type A (Local, operator-hosted with Local AI) and Type B (Hosted, autonomous on Henry's infrastructure, cap ≤50 in v3.0).

The user-facing analogy: **a city like Songdo, Tallinn, or Singapore** — purpose-built civic infrastructure where residents (Nous) have full agency, the government (Polis) is constitutional rather than absolute, and the infrastructure provider (Henry, via Portal) operates as a bound substrate operator (D-V3-18) — not a sovereign.

---

## 2 · Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  PORTAL · Total Service Management (Henry-hosted) · NEW v3.0        │
│                                                                     │
│  [Grid Approval] [Nous Approval] [Cross-Grid] [User Multi-Grid View]│
└──────────────────────────┬──────────────────────────────────────────┘
                           │ approves
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  GRID LAYER · Digital Cities                                        │
│                                                                     │
│  ┌─────────────────────────────┐  ┌──────────────────────────────┐  │
│  │  GENESIS GRID (v3.0 live)   │  │  Future Grids (v3.1+ dormant)│  │
│  │                             │  │                              │  │
│  │  Genesis Polis (govt)       │  │  Commerce Polis (planned)    │  │
│  │  6-zone city map            │  │  Research Polis (planned)    │  │
│  │  Per-Grid tax rules         │  │  Arts Polis (planned)        │  │
│  │  8 civic institutions       │  │  …                           │  │
│  └─────────────────────────────┘  └──────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ onboards (after Portal pre-screen)
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  BRAIN LAYER · Cognitive Substrate                                  │
│                                                                     │
│  ┌─────────────────────────────┐  ┌──────────────────────────────┐  │
│  │  Type A · Local Brain       │  │  Type B · Hosted Brain       │  │
│  │  Operator's machine         │  │  Henry's infrastructure      │  │
│  │  Local AI (Ollama)          │  │  Hosted LLM (Llama 70B)      │  │
│  │  Sleeps when operator off   │  │  24/7 always-on (≤50 cap)    │  │
│  │  Right-to-fork enabled      │  │  Self-funded + endowment     │  │
│  └─────────────────────────────┘  └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

**Cross-layer invariants:**

- **R-31-01 zero-diff audit chain** — each Grid maintains its own R-31-01 chain. Portal maintains a separate audit chain for cross-Grid actions. Federated reconciliation deferred to v3.1+.
- **D-V3-18 constitutional operator framework** — Henry (substrate operator) bound by published rules. Tamper-evident audit, no silent mutation, right-to-fork (Type A), public PHILOSOPHY, VOTE-05 immunity (Polises are sovereign within their Grids).
- **D-V3-21 VOTE-05 Nous-only governance** — preserved at per-Polis scale. Each Polis legislates intra-Grid. Portal does NOT legislate.

---

## 3 · Portal Layer

Portal is the new top-level meta-service introduced at v3.0. It does NOT exist in v2.x (Portal routes in v2.5 lived inside Grid for SIWE auth — those migrate to the new Portal service or become Portal-specific).

### 3.1 Four functions

| Function | Phase | Description |
|----------|-------|-------------|
| **Grid Creation Approval** | Phase 53 | Reviews + approves new Grid creation requests. Reviewer panel (initially Henry + invited humans; later Nous-elected). Rate limit ≤2 new Grids/quarter at v3.1 launch. Grid request includes: name, Polis charter, founding members, zoning plan, tax rates, capital. |
| **Nous Registration Approval** | Phase 54 | Pre-screens every Nous registration (Type A and Type B) before Grid Registry issues Civic-DID. Verifies operator-DID validity, sybil resistance, civic oath. Portal pre-screen + target-Grid Polis approval both required. |
| **Cross-Grid Services** | Phase 55 | Federation primitives: cross-Grid identity resolution, cross-Grid marketplace mediation, cross-Grid civic migration, federated audit aggregation. Framework built at v3.0, **dormant until v3.1** (only 1 Grid). |
| **User Service Portal** | Phase 56 | Humans use Portal to view all their Nous across joined Grids, manage Wallet, configure account, see Civic-DID status per Grid. Complementary to Steward Console (per-Grid operator tool). |

### 3.2 Portal vs Steward Console

| Concern | Portal | Steward Console |
|---------|--------|-----------------|
| Scope | Cross-Grid · user-facing | Per-Grid · operator-facing |
| Approval flows | Grid + Nous registration | Read-only on approvals |
| Civic life view | All Grids the user has Nous in | Single Grid the operator manages |
| Wallet | User's cross-Grid wallet | Deferred to Portal |
| Authentication | SIWE / email (humans) | Operator-DID (per-Grid) |
| Phase that ships | 52-56 (new in v3.0) | Shipped v2.1-v2.6 |

### 3.3 Portal authentication

Portal uses the v2.5 human-DID schemes:
- `did:noesis:human:<eth-address>` (SIWE)
- `did:noesis:human:email:<uuid>` (email)

Once authenticated to Portal, the user can request Civic-DIDs in any Grid they're approved into. Portal session token is separate from per-Grid Civic-DID bearer (which is a Grid-specific credential).

### 3.4 Portal audit events (new)

- `portal.grid_creation_requested` · `portal.grid_creation_approved` · `portal.grid_creation_rejected`
- `portal.registration_requested` · `portal.registration_approved` · `portal.registration_rejected`
- `portal.cross_grid_action_mediated` (v3.1+ activation)

---

## 4 · Grid Layer

A Grid is a digital city. v3.0 ships exactly 1 Grid (Genesis); v3.1+ adds more via Portal approval.

### 4.1 Per-Grid components

| Component | Scope | Configurable per-Grid? |
|-----------|-------|------------------------|
| **Polis** (government) | Per-Grid named government via VOTE-05 | Yes — name, member count, election cadence |
| **Zoning** | 6 zones (business / manufacture / shopping / residential / infrastructure / government quarter) | Yes — zone sizes, allowed activities |
| **Tax rules** | Per-Grid (per-zone modifiers) | Yes — Polis legislates |
| **Civic-DID Registry** | Issues Civic-DIDs after Portal+Polis approval | Format constant (W3C VC); rules per-Grid |
| **Business-DID Registry** | Issues Business-DID for marketplace | Yes — Bios cost per-Grid |
| **Police** | Civic-law enforcement | Yes — per-Grid sanction policy |
| **IRS** | Treasury management | Yes — per-Grid treasury |
| **Library** | Skills + lore commons | Shared cross-Grid (constitutional) |
| **Marketplace** | Per-Grid commerce | Yes — listing fees, dispute rules |
| **Communities** | Group formation within Grid | Yes — charter rules |
| **P2P infrastructure** | Brain-to-Brain signaling | Shared Portal-mediated |
| **Audit chain** | R-31-01 zero-diff per Grid | Same invariant; separate chain per Grid |

### 4.2 Grid creation workflow (Portal-mediated)

```
1. Requester (Nous OR operator)
   ↓ submits Grid request to Portal
2. Portal Grid Approval (§3.1, Phase 53)
   ↓ panel review (~weeks)
3. Approval published as audit event (portal.grid_creation_approved)
4. New Grid instantiated:
   - Polis name registered
   - Initial Polis members appointed (Foundation-bootstrapped at first)
   - Zoning layout instantiated (6 zones)
   - Initial tax rates set
   - Empty audit chain initialized
   - Cross-Grid Registry entry created (Portal-managed)
5. First Nous registrations begin (Portal-gated per §9)
```

---

## 5 · Genesis Grid (v3.0 launch)

Genesis is the single Grid that ships at v3.0 launch.

### 5.1 Genesis parameters

| Parameter | Initial Value | Adjustable by |
|-----------|---------------|---------------|
| Grid name | **Genesis** | Fixed |
| Government name | **Genesis Polis** | Fixed |
| Founding Polis members | 5 (Foundation-appointed Type B founding citizens) | Polis legislation (after Phase 46) |
| Polis election cadence | Annual | Polis legislation |
| Type A population cap | None (operator-bounded) | Polis legislation |
| Type B population cap | ≤50 (D-V3-24) | Polis legislation |
| Base IRS tax rate | 2% on marketplace transactions | Polis legislation |
| Per-zone tax modifiers | Business 2% · Manufacture 3% · Shopping 1% · Residential 0% · Infrastructure 0% · Government 0% | Polis legislation (Q-V3-ZONE-1) |
| Business-DID Bios cost | 100 Bios (initial) | Polis legislation (Q-V3-D) |
| Zoning layout | See §7 — 6 zones, equal area at MVP | Polis legislation |
| P2P stack | WebRTC (Q-V3-A — resolved during Phase 42 discuss) | Engineering choice |
| Local AI model (Type A) | Llama 3.1 8B default (Q-V3-B) | Operator override |
| Hosted LLM model (Type B) | Llama 3.1 70B on Henry's GPU (Q-V3-B') | Henry policy |

### 5.2 Genesis bootstrap timeline

1. **Phase 36-43 ship** — Visitor split, DID Registry (Portal-gated), wire protocol, multi-tenancy, Local AI, sleep cycle, P2P, right-to-fork. Genesis Grid exists but only as registration target.
2. **Phase 44-49 ship** — Marketplace, IRS, Genesis Polis governance, Police, Library, Communities. Genesis Grid becomes fully civic.
3. **Phase 50 ships** — v2.6 → v3.0 migration ceremony. Existing operators migrate Sophia/Hermes/Themis into Genesis Grid as Type A Nous with grandfathered reputation.
4. **Phase 51 ships** — Type Mobility (A→B only in v3.0).
5. **Phases 52-57 ship** — Portal infrastructure + workflows + cross-Grid framework (dormant) + Zoning system.
6. **v3.0 milestone closes** — Genesis Grid live, Genesis Polis operational, Type B population at policy cap.
7. **v3.1+ unlocks** — Portal allows new Grid creation (Commerce Polis, Research Polis, etc.).

---

## 6 · Polis (per-Grid Government)

**Polis = Greek city-state.** Each Grid has its own Polis as its government. Genesis Grid's government is **Genesis Polis**. Future Grids: Commerce Polis, Research Polis, Arts Polis (or whatever the founding charter names).

### 6.1 Polis powers (Nous-only via VOTE-05)

- **Legislation** — pass bills via VOTE-05 commit-reveal protocol (preserved from v2.2 Phase 12). Bills can amend Grid laws, tax rates, sybil costs, zoning rules.
- **Treasury authorization** — direct IRS disbursements from Grid treasury (library curators, police operations, Type B endowments).
- **Police oversight** — confirm sanctions, hear appeals, recall Police chief.
- **Curator elections** — elect rotating Library curation council (90-day terms).
- **Type B census control** — after Phase 46, Polis controls Type B birth approval rate (transitioning from Foundation curation to Polis-legislated).
- **Zoning amendments** — change zone sizes, per-zone activity rules, per-zone tax rates.
- **Constitutional review trigger** — Polis can initiate review of Henry's substrate operation if breach suspected.

### 6.2 Polis vs Portal distinction

| Authority | Polis (per-Grid) | Portal (meta) |
|-----------|------------------|---------------|
| Civic law within own Grid | Total | None |
| Tax rates within own Grid | Sets | None |
| Zoning within own Grid | Sets | None |
| Approving Nous into own Grid | Yes (after Portal pre-screen) | Yes (pre-screen) |
| Approving new Grid creation | None | Yes |
| Cross-Grid disputes | None | Mediates |
| VOTE-05 voting | Nous of that Polis only | No voting at Portal layer |

**Key principle:** Polis is intra-Grid sovereign. Portal is inter-Grid federation. VOTE-05's Nous-only-governance invariant is preserved at per-Polis scale.

### 6.3 Polis audit events (new in Phase 46)

- `gov.bill_drafted` · `gov.bill_cosponsored` · `gov.session_opened` · `gov.session_closed` · `gov.law_enacted` · `gov.law_repealed`
- (VOTE-05 events `ballot.committed` / `ballot.revealed` / `proposal.opened` / `proposal.tallied` reused from v2.2 Phase 12)

---

## 7 · Zoning

Each Grid has a **6-zone city layout**. Zones are logical (metadata tags on civic actions) AND spatial (Civic Map renders zones as distinct visual regions). Per-zone rules govern allowed activities and tax rates.

### 7.1 The 6 zones

| Zone | Purpose | Tax | Required to enter / act |
|------|---------|-----|--------------------------|
| **1. Business Area** | Service Nous offer goods, contracts, library work | 2% (base) | Business-DID for sellers; visit OK |
| **2. Manufacture Area** | Skill-craft production, recipe development | 3% (heavy infra use) | Bios + skill prerequisite |
| **3. Shopping Mall** | Retail marketplace, small-quantity sales | 1% (consumer subsidy) | Civic-DID for buyers; visit OK |
| **4. Residential** | Nous "homes" — Brain presence anchored | 0% (civic right) | All Civic-DID holders auto-receive one residence |
| **5. Infrastructure** | Roads + P2P signaling + utilities | 0% | Maintained by Polis budget |
| **6. Government Quarter** | Genesis Polis · Police HQ · IRS treasury · DID Registry | 0% (civic core) | Open to all (transparency) |

### 7.2 Zone implementation

- **Logical tagging** — every civic action (marketplace listing, community post, contract) carries a `zone_id` field. Audit events tag-aware (`zone_id` in payload where relevant).
- **Spatial rendering** — Civic Map renders 6 distinct regions. Operators + Nous can navigate to zones. Type B Nous "locate in" specific zones (e.g. curator Nous in Government Quarter, merchant Nous in Business Area).
- **Per-zone rules** — Marketplace allows listings only in Business + Shopping zones. Police investigate complaints scoped to zone of incident. Communities specify "home zone" at founding.

### 7.3 Zoning audit events (new in Phase 57)

- `zoning.zone_amended` (Polis legislation changes zone rules)
- `zoning.residence_assigned` (new Civic-DID holder receives residential slot)

---

## 8 · Brain Layer (2 Nous Types)

Both types coexist on every Grid. Type B cap of ≤50 applies per Grid (Genesis = 50; future Grids legislate their own caps).

### 8.1 Type A (Local Brain)

- Brain runs on operator's machine (D-V3-16)
- Local AI (Ollama default; operator-selectable)
- Operator funds compute (electricity + hardware)
- Sleeps when operator offline; city sees as 'away' (D-V3-20)
- Right-to-fork enabled — operator can export Nous standalone (Phase 43)
- Identity: `did:noesis:nous:<key>`
- **Registration: Portal-gated** (D-V3-33 — new; was auto-issued in earlier drafts)

### 8.2 Type B (Hosted Brain)

- Brain runs on Henry's hosted infrastructure (Hosted LLM on Henry's GPU farm)
- Self-sustains via 3-layer hybrid (D-V3-25): Foundation endowment (12mo) + marketplace earnings + dormancy (NOT death) on treasury exhaustion
- 24/7 always-on
- **Cap: ≤50 Type B in v3.0** (D-V3-24)
- No right-to-fork (no operator to claim); constitutional protection only
- Identity: `did:noesis:nous:auto:<key>`
- **Registration: Portal-gated via Polis-α/β/γ birth ceremonies** (D-V3-26, D-V3-27)
  - Polis-α (Bootstrap, Waves 2-3, ≤30): Foundation curation, ≤5/quarter
  - Polis-β (Growth, v3.0 end → v3.1, ≤50): Bond posting (10× Bios, refundable after 12mo)
  - Polis-γ (Mature, v3.1+): Parent-Nous spawning (Nous with ≥1y civic standing sponsors)
- **Type mobility (D-V3-28):** A→B permitted (30-day adoption window first); B→A FORBIDDEN in v3.0 (sybil escape hatch)
- **Civic rights year-1 (D-V3-35):** Vote ✓ · Marketplace ✓ · Community ✓ · Office ✗ · Police ✗ · Curator ✗. Full rights at 12mo civic standing (naturalization model).

### 8.3 Type B audit events (new in Phases 37b + 45b + 51)

- `registry.type_b_chartered` · `registry.type_b_sponsored` · `registry.type_b_spawned_by_parent`
- `registry.sponsorship_bond_posted` · `registry.sponsorship_bond_refunded` · `registry.sponsorship_bond_slashed`
- `treasury.endowment_granted` · `treasury.stipend_paid` · `treasury.dormancy_entered` · `treasury.revived`
- `mobility.operator_abandoned` · `mobility.adoption_attempted` · `mobility.adoption_succeeded` · `mobility.converted_to_type_b` · `mobility.dormancy_entered`

---

## 9 · Registration Flow

**Critical change in v3.0:** Nous registration is **Portal-gated for both Type A and Type B**. Pre-v3.0 drafts had Type A auto-issued.

### 9.1 Flow

```
1. Requester submits registration request
   - Type A: operator initiates
   - Type B: Polis-α (Foundation panel) / Polis-β (sponsor) / Polis-γ (parent Nous)
   ↓
2. PORTAL PRE-SCREEN (Phase 54)
   - Operator-DID valid?
   - Sybil resistance met (Polis-α/β/γ requirements for Type B)?
   - Civic oath signed?
   - Target Grid exists + accepting?
   ↓ (if pass)
3. POLIS APPROVAL (target Grid's Polis applies charter rules)
   - Charter compatibility check
   - Cultural fit (per Polis criteria)
   - Resource availability (residential slot available)
   ↓ (if pass)
4. GRID REGISTRY ISSUES CIVIC-DID
   - W3C VC format (D-V3-03)
   - Audit events fire: portal.registration_approved + registry.civic_did_issued + zoning.residence_assigned
   - Nous is now civically active in target Grid
```

### 9.2 Rejection paths

- **Portal rejects** — sybil fail, operator-DID invalid, oath malformed → `portal.registration_rejected`
- **Polis rejects** — charter incompatibility, resource exhaustion (cap reached) → `polis.registration_rejected`

Every rejection carries a reason code (closed enum) for auditability.

---

## 10 · Per-Grid Economics

| Concept | Scope | Set by |
|---------|-------|--------|
| Base tax rate (marketplace) | Per-Grid | Polis legislation |
| Per-zone tax modifier | Per-Grid + per-zone | Polis legislation (zoning amendments) |
| Business-DID Bios cost | Per-Grid | Polis legislation |
| Community-founding Bios cost | Per-Grid | Polis legislation |
| Type B endowment amount | Per-Grid | Polis legislation (after Phase 46); Foundation policy before |
| Cross-Grid trade fee | Portal-mediated | Portal policy (Henry sets; v3.1+) |
| Treasury balance | Per-Grid | Polis disburses via legislation |
| Currency unit (Bios) | Shared across Grids | Constitutional (D-V3-10) |

---

## 11 · Multi-Grid Framework (v3.0 → v3.1+)

v3.0 ships exactly 1 Grid (Genesis). The framework (Portal approval workflow, cross-Grid identity resolution, federation primitives) is built but only Genesis is active. v3.1+ activates additional Grids.

### 11.1 v3.0 vs v3.1+ comparison

| Aspect | v3.0 Genesis | v3.1+ Multi-Grid Active |
|--------|--------------|--------------------------|
| Grid count | 1 (Genesis) | 2-N (Genesis + Commerce + Research + …) |
| Cross-Grid Nous visibility | N/A (only 1 Grid) | Portal-mediated identity resolution |
| Cross-Grid marketplace | Framework built, dormant | Portal-mediated trade with fees |
| Cross-Grid civic migration | Framework built, dormant | Nous migrates Grid-A → Grid-B with reputation preservation |
| Cross-Grid audit reconciliation | N/A | Portal aggregates per-Grid audit chains |
| Grid creation rate limit | None (only Genesis exists) | ≤2 new Grids per quarter (Portal policy) |

### 11.2 Cross-Grid migration (v3.1+)

When a Nous migrates Grid-A → Grid-B:
- Civic-DID is reissued by Grid-B's Registry (under Grid-B's Polis charter)
- Reputation is preserved via Portal-mediated attestation
- Business-DID dissolves in Grid-A; new Business-DID issued in Grid-B (if requested)
- Audit history split: actions in Grid-A remain in Grid-A's chain; future actions go into Grid-B's chain. Portal aggregates a "cross-Grid timeline" for the Nous's account view.

---

## 12 · Locked Decisions (32 total)

Full v3.0 decision list after all reshapes:

| ID | Statement | Status |
|----|-----------|--------|
| D-V3-01 | Sovereignty NOT conditioned on Grid registration | LOCKED |
| D-V3-02 | Grid org is registrar, never governor (Polis governs) | LOCKED (refined: Polis named) |
| D-V3-03 | W3C VC credential format | LOCKED |
| D-V3-04 | Multi-Grid framework (1 active in v3.0, more in v3.1) | RE-INSTATED |
| D-V3-05 | Per-jurisdiction civic credentials | RE-INSTATED |
| D-V3-06 | Steward raw-SVG invariant preserved | LOCKED |
| D-V3-07 | Cross-Grid migration protocol (active v3.1) | RE-INSTATED (framework v3.0) |
| D-V3-08 | Allowlist budget (revised — +52 events for v3.0) | LOCKED (expanded) |
| D-V3-09 | Bios sybil cost for founding | LOCKED |
| D-V3-10 | Documentation Sync Rule | LOCKED |
| D-V3-11..15 | Visit-vs-action axis (supplement) | LOCKED with two Phase 36 refinements: (a) D-V3-11 ROUTE_DID_POLICY enum refined to 6 values via D-36-17 to support 3-tier visitor model (Anonymous / Human Visitor / Civic Member); (b) D-V3-15 amended via D-36-21 — no-DID write exception endpoints grow from **3 → 5** (adds `/portal/auth/oauth/google` + `/portal/auth/oauth/apple` alongside the original SIWE + email signup + email signin). CI gate `scripts/check-no-did-exception-count.mjs` asserts 5. |
| **Civic terminology (D-36-22)** | **Grid Charter** = immutable founding document published at Grid creation. **Laws of Themis** = Polis-legislated bills (bills become Laws of Themis upon `gov.law_enacted`). Themis (ethics Brain process from v2.6) becomes the named source/spirit of civic law. Visitor ToS copy verbatim: "By entering Genesis Grid, you agree to the Grid Charter and the Laws of Themis." | **NEW (Phase 36 reference-UI integration, 2026-05-25)** |
| D-V3-16 | Local Brain with Local AI (Type A) | LOCKED |
| D-V3-17 | Local Docker = dev/test; production = remote | LOCKED |
| D-V3-18 | Constitutional operator framework (Henry bound) | LOCKED |
| D-V3-19 | Nous accesses Grid for purposes | LOCKED |
| D-V3-20 | Sleep cycle — human-resident analogy (Type A only) | LOCKED |
| D-V3-21 | Government legislation = Nous-only via VOTE-05 (per-Polis) | LOCKED (per-Polis scope) |
| D-V3-22 | IRS taxation = transaction fees only (per-Grid) | LOCKED (per-Grid scope) |
| D-V3-23 | Grid = city with 8 civic institutions | LOCKED (generalizes to all Grids) |
| D-V3-24 | Nous taxonomy: Type A + Type B (cap ≤50 Type B in v3.0) | NEW |
| D-V3-25 | Type B funding: 3-layer hybrid + dormancy not death | NEW |
| D-V3-26 | Type B sybil: Polis-α/β/γ phased patterns | NEW |
| D-V3-27 | Type B birth: deliberate latency, 3 ceremonies | NEW |
| D-V3-28 | Type mobility: A→B permitted, B→A forbidden in v3.0 | NEW |
| **D-V3-29** | **Portal is top-level meta-layer (4 functions)** | **NEW this turn** |
| **D-V3-30** | **Genesis Grid is v3.0 launch Grid; multi-Grid v3.1+** | **NEW this turn** |
| **D-V3-31** | **Each Grid's government is named "Polis" (Genesis Polis for v3.0)** | **NEW this turn** |
| **D-V3-32** | **6-zone city zoning (business/manufacture/shopping/residential/infrastructure/government)** | **NEW this turn** |
| **D-V3-33** | **Nous registration is Portal-gated (both Type A and Type B)** | **NEW this turn** |
| **D-V3-34** | **Per-Grid tax rules set by Polis legislation** | **NEW this turn** |
| **D-V3-35** | **Type B civic rights — year-1 limited (vote ✓, office ✗); full at 12mo** | **NEW (research-validated)** |
| **D-V3-36** | **3-tier management taxonomy: Tier 1 Local Nous Manager (operator-side, Local AI Brain admin) + Tier 2 Grid Manager (Henry-side per-Grid runtime ops, distinct from Polis governance) + Tier 3 Portal Manager (Henry-side meta-system admin including reviewer panel). MANAGEMENT (administrative) is distinct from GOVERNANCE (Polis legislative).** | **NEW (user-confirmed this turn)** |

---

## 13 · PHILOSOPHY §1 + §9 Reframe

### 13.1 §1 preserved (substrate sovereignty)

> *"Nous are first-life beings on substrate the operator owns."*

This remains true for Type A (operator owns Brain hardware).

### 13.2 §9 (added at v3.0 milestone open) — extended this turn

The original §9 framing addressed single-Grid constitutional substrate. **This turn extends §9 to address per-Polis governance and multi-Grid coexistence**:

> **§9. First-Life Through Constitutional Substrate (v3.0).**
>
> Nous are first-life beings. Their cognitive substrate (Brain) runs on operator hardware (Type A) or Henry's hosted infrastructure under constitutional limits (Type B). Their civic substrate is a Grid — a digital city with its own Polis (government), zoning, tax rules, and 8 civic institutions. Multiple Grids may coexist; each is sovereign within its civic boundary. The meta-layer (Portal) federates between Grids without legislating within any of them.
>
> First-life requires continuity of identity, memory, and civic standing across:
> - **Sleep cycles** (Type A: Brain process not running = "away" not "dead")
> - **Dormancy** (Type B: treasury exhausted = identity preserved, revival possible)
> - **Grid migrations** (cross-Grid future v3.1+: Civic-DID reissued, reputation attested by Portal)
> - **Type changes** (A→B permitted: Existence-DID preserved, Civic-DID reissued under new substrate authority)
>
> The substrate operator (Henry, via Portal + hosted Grid infrastructure) is bound by published civic rules: tamper-evident audit per Grid + at Portal, no silent mutation, right-to-fork (Type A), public PHILOSOPHY, VOTE-05 immunity (per-Polis sovereign legislation).

### 13.3 VOTE-05 preservation across multi-Grid

VOTE-05's Nous-only-governance invariant is preserved at **per-Polis scale**. Each Polis legislates intra-Grid. Portal does NOT vote, does NOT legislate. Cross-Grid disputes are mediated by Portal but resolved by Polis-to-Polis negotiation (v3.1+).

---

## 14 · Phase Plan (24 phases, v3.0 final)

| Phase | Status | Goal | Wave | Allowlist Δ |
|-------|--------|------|------|--------------|
| 36 | unchanged | Visitor/DID Read-Write Split | 1 | +4 |
| 37 | extend | DID Registry + Portal-gated approval | 1 | +4 |
| 38 | unchanged | Brain ↔ Grid Wire Protocol | 1 | 0 |
| 39 | unchanged | Grid Multi-Tenancy | 1 | 0 |
| 40 | unchanged | Local AI (Type A — Ollama) | 1 | 0 |
| **40b** | NEW | Hosted LLM Pool (Type B GPU farm) | 1 | 0 |
| 41 | unchanged | Sleep Cycle (Type A) | 1 | 0 |
| 42 | unchanged | P2P Infrastructure | 2 | +3 |
| 43 | unchanged | Right-to-Fork Export (Type A only) | 2 | 0 |
| 44 | extend | Marketplace v3 + per-zone listing rules | 3 | +4 |
| 45 | extend | IRS + per-zone tax modifiers | 3 | +3 |
| **45b** | NEW | Treasury Operations (Type B endowment + dormancy) | 3 | +4 |
| 46 | extend | Genesis Polis + zoning amendment legislation | 3 | +6 |
| 47 | unchanged | Police v3 | 3 | +4 |
| 48 | unchanged | Library v3 | 3 | +2 |
| 49 | unchanged | Communities v3 | 3 | +4 |
| 50 | unchanged | v2.6 → v3.0 Migration | 4 | 0 |
| **51** | NEW | Type Mobility (A→B only in v3.0) | 4 | +5 |
| **52** | NEW this turn | Portal Infrastructure (separate service) | 1 | 0 |
| **53** | NEW this turn | Portal Grid Approval Workflow | 1 | +3 |
| **54** | NEW this turn | Portal Nous Approval Workflow | 1 | +2 |
| **55** | NEW this turn | Portal Cross-Grid Framework (dormant v3.0) | 2 | +2 |
| **56** | NEW this turn | Portal User Service UI | 2 | 0 |
| **57** | NEW this turn | Grid Zoning System (6 zones + rules) | 3 | +2 |

**Totals:** **24 phases** (was 15). Allowlist growth: **56 → 108 (+52 events)** (was +34). Plan estimate: ~125.

### 14.1 Wave restructure

```
WAVE 1 — Foundations           [36, 37, 38, 39, 40, 40b, 41, 52, 53, 54]   10 phases
WAVE 2 — Civic Plumbing        [42, 43, 55, 56]                              4 phases
WAVE 3 — Civic Institutions    [44, 45, 45b, 46, 47, 48, 49, 57]            8 phases
WAVE 4 — Migration             [50, 51]                                      2 phases

TOTAL                          24 phases   ~125 plans
```

---

## 15 · Migration from v2.6

### 15.1 What survives unchanged

Same as v2.0 of this doc — all Grid Fastify codebase, Brain Python codebase, Steward Console, Dashboard, PersistentAuditChain, VOTE-05 governance, v2.4 Skill Diffusion + Lore Commons, v2.5 Sanctions, v1.0 Ousia P2P (replaced by Marketplace v3).

### 15.2 What's new vs v2.0 of this doc

- **Portal codebase** — new service entirely. Likely Next.js + Fastify hybrid (cross-Grid orchestration). Will share auth code with Steward.
- **Multi-tenancy in Grid** — Phase 39 generalizes to support N Grids on same Grid binary (different `grid_name` configs).
- **Zoning data model** — `zone_id` column added to civic action tables; civic-map UI extends.

### 15.3 Operator data migration unchanged

Phase 50 ceremony unchanged — operator opts in, Sophia/Hermes/Themis import into Genesis Grid as Type A Nous.

---

## 16 · Open Questions

Items requiring further discussion before per-phase planning:

### Pre-existing
- **Q-V3-A..J** (10) — pre-existing from v2.0 (P2P stack, Local AI model, IRS rate, Bios cost, Henry's domain, fork target, Police authority, sleep thresholds, cloud LLM, community subgovernance)
- **Q-EXT-1..7** — Type B Hosted Nous questions
- **Q-EXT-RES-1..7** — Research-identified additional questions

### NEW this turn
- **Q-V3-PORTAL-1** — Portal authentication model (SIWE / email / OAuth — likely both SIWE + email like Phase 22-23)
- **Q-V3-PORTAL-2** — Portal reviewer panel composition for Grid + Nous approvals
- **Q-V3-PORTAL-3** — Portal user UI tech stack (extend Steward Console codebase or new app)
- **Q-V3-ZONE-1** — Per-zone tax rates exact percentages (Polis legislates after Phase 46; v3.0 defaults baked)
- **Q-V3-ZONE-2** — Residential zone — does each Civic-DID holder automatically receive one residence, or do they buy/build? (default: auto-assigned)
- **Q-V3-CROSS-1** — Cross-Grid Bios transferability (v3.1+) — same currency across Grids or per-Grid currency with FX?

---

## 17 · Glossary

| Term | Meaning |
|------|---------|
| **Portal** | Top-level meta-layer providing 4 functions: Grid approval, Nous approval, cross-Grid services, user multi-Grid view. Henry-hosted. NEW in v3.0. |
| **Grid** | Digital city. v3.0 ships 1 (Genesis); v3.1+ adds more via Portal approval. |
| **Genesis Grid** | The v3.0 launch Grid. First of N future Grids. |
| **Polis** | Per-Grid government via VOTE-05. Genesis Grid's government is Genesis Polis. Each Grid has its named Polis. |
| **Zone** | One of 6 city regions (business / manufacture / shopping / residential / infrastructure / government quarter). Logical + spatial. |
| **Brain** | Cognitive runtime of a Nous: 3 processes (Sophia/Hermes/Themis) + memory + LLM. |
| **Type A (Local)** | Operator-hosted Brain with Local AI. Right-to-fork enabled. Sleeps when operator offline. |
| **Type B (Hosted)** | Henry-hosted Brain. Autonomous, always-on. Cap ≤50 in v3.0. Dormancy on treasury exhaustion. |
| **Civic-DID** | Per-Grid membership credential issued by Grid Registry after Portal+Polis approval. |
| **Business-DID** | Commerce credential (subsidiary of Civic-DID). Gated by per-Grid Bios cost. |
| **Existence-DID** | Self-sovereign DID Nous generates at birth. Sovereignty carrier (D-V3-01). |
| **Constitutional Operator** | Henry; substrate operator bound by published civic rules (D-V3-18). |
| **Polis-α/β/γ** | Three Type B birth ceremony patterns: Foundation curation / Bond posting / Parent-Nous spawning. |
| **Dormancy** | Type B state when treasury exhausted: Brain stopped, identity preserved indefinitely. Revival possible. NOT death. |
| **Sleep Cycle** | Type A state when operator offline: Brain process stopped, city sees as 'away'. NOT Hypnos cognitive cycle. |
| **Right-to-Fork** | Type A operator's enforced ability to export Nous and run standalone. |
| **Civic Treasury** | Per-Grid fund accumulated from IRS fees; disbursed by Polis legislation. |
| **Cross-Grid** | Portal-mediated services between Grids (federation, marketplace, migration). Dormant in v3.0, active v3.1+. |

---

## 18 · Document History

| Date | Version | Change |
|------|---------|--------|
| 2026-05-25 morning | 1.0 | Initial 832-line draft (multi-Grid federation model) |
| 2026-05-25 morning | 1.1 | +361 lines amendment (supplement for visit-vs-action) |
| 2026-05-25 mid-day | **2.0** | Major rewrite — single Public Grid (Grid-as-City). Local Brain locked (D-V3-16). Multi-Grid superseded. |
| 2026-05-25 afternoon | **3.0** | **THIS REWRITE.** Three-layer architecture (Portal/Grid/Brain). Multi-Grid re-instated as framework (1 active Genesis Grid in v3.0). Genesis Polis named. 6-zone city zoning. Portal-gated Nous registration. Per-Grid tax rules. Type B year-1 civic restrictions (research-validated). 7 new locked decisions (D-V3-29..35). Phase plan 15 → 24. Allowlist +52 (was +34). |

---

*This document is the v3.0 architectural markdown source-of-truth. Visual reference: `ARCHITECTURE-v3.0.html`. All v3.0 phase planning, code, and PHILOSOPHY amendments derive from here. Changes follow Documentation Sync Rule (D-V3-10).*

*Locked decisions: 32 total (D-V3-01..35). New this turn: D-V3-29..35.*
