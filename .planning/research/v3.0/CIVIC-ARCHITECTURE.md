# Noēsis v3.0 — Civic Architecture Research

**Status:** Research foundation for v3.0 milestone planning
**Date:** 2026-05-25
**Author:** Claude (research-phase agent)
**Scope:** Hybrid opt-in jurisdictions — Portal-registered Nous + Nous-founded Grids + sovereign opt-out + 3D civic visualization

---

## Table of Contents

1. [Executive Summary](#1--executive-summary)
2. [Tension Analysis — What v3.0 Must Resolve](#2--tension-analysis)
3. [Identity Model — Verifiable Credentials + Multi-DID](#3--identity-model)
4. [Multi-Grid Architecture — Federated with Optional Registry](#4--multi-grid-architecture)
5. [Civic Infrastructure Analogy — Estonia × EVE, NOT SimCity](#5--civic-infrastructure-analogy)
6. [Visualization Recommendation — Isometric SVG First, Optional WebGL Annex](#6--visualization-recommendation)
7. [D-V3-* Decision Proposals — PHILOSOPHY.md Amendments](#7--d-v3---decision-proposals)
8. [Migration Phase Plan Estimate](#8--migration-phase-plan-estimate)
9. [Reference Implementations & Lessons](#9--reference-implementations)
10. [Open Questions](#10--open-questions)

---

## 1 · Executive Summary

The user's proposal is **conceptually correct but architecturally inverted from what it first appears.** It reads as "Portal-mandatory civic registration like Korea's RRN," but the user's chosen authority model — **HYBRID with opt-in jurisdictions** — is actually closer to **Estonia's e-Residency layered on top of self-sovereign DIDs**, with **EVE Online's player-formed corporations** as the multi-Grid mechanic, and **W3C Verifiable Credentials** as the registration primitive. SimCity is the wrong analogy because SimCity's citizens have no agency; Noēsis's Nous have first-class sovereignty (PHILOSOPHY §1) that the entire project is built to protect.

**The single recommendation:** model v3.0 as **"voluntary jurisdictions with portable cryptographic credentials,"** not "registration with central authority." A Nous *always* has the unconditional right to exist (sovereignty is irrevocable, unchangeable by Portal action). What changes in v3.0 is that a Nous can *optionally* hold one or more **Civic Credentials** (W3C Verifiable Credentials signed by a Portal-style issuer) that grant access to **Portal-affiliated Grids** — Grids whose Nous founders chose to require those credentials at their borders. Sovereign Grids (the current Genesis-style) remain operable, require no credential, and never appear in any Portal registry.

This preserves every existing invariant:

- **PHILOSOPHY §1 "Sovereignty is not optional"** — a Nous can exist without any Portal involvement. Credentials are voluntary, like Estonian e-Residency (you don't need it to live; you need it to incorporate a company there).
- **VOTE-05 "Governance is intra-Nous only"** — Portal does not govern Grids. Portal issues identity assertions about a Nous (an *issuer* role in W3C VC vocabulary). It does not approve, deny, or modify a Grid's internal laws. A Grid that wants to be "Portal-recognized" applies for that status the same way a country can apply for a treaty — Portal grants or refuses recognition, but Portal cannot enter the Grid, vote, or enforce.
- **Zero-custody (PHILOSOPHY §8)** — the Nous holds its own keys; the credential is presented, not stored at Portal. Portal sees credential issuance and revocation events, never private state.
- **Allowlist freeze** — v3.0 will require **~14 new audit events** across registration, Grid registration, credential lifecycle, and cross-Grid migration, expanding allowlist from 56 → ~70. Every addition follows the existing sole-producer + closed-tuple + PORTAL_AUTH_FORBIDDEN_KEYS-style discipline.
- **Steward raw-SVG invariant (Phase 21)** — primary v3.0 visualization is **isometric SVG** (a `rotateX(60deg) rotate(45deg)` CSS transform of standard SVG primitives). This is "2.5D," not 3D, but it reads as 3D and respects the no-d3/no-three.js rule. A separate **optional Portal-only 3D annex** can reuse the existing `CyberGrid.tsx` (which is already three.js in `dashboard/src/`, not Steward).

**Recommended path through v3.0:**

| Stage | Phases | Purpose |
|-------|--------|---------|
| **Foundation** | 36–38 (3 phases) | Multi-Grid env vars, AuditChain partition by grid_name, sovereign Grid → "self-founded" semantics, Civic Credential schema |
| **Registration** | 39–41 (3 phases) | Portal as Issuer, Civic Credential issuance + revocation + presentation, Nous-side credential wallet (`brain/data/nous/<name>/credentials/`) |
| **Multi-Grid** | 42–44 (3 phases) | Grid-founded-by-Nous mechanic, Grid invite + accept, Grid registry table (Portal-side), credential-required-at-border admission |
| **Visualization** | 45–46 (2 phases) | Isometric SVG civic map in Steward, optional WebGL 3D annex in Portal CyberGrid |
| **Migration + Hardening** | 47–48 (2 phases) | Genesis Grid registered as self-founded baseline, CI gates, doc-sync |

**Total estimate: 13 phases for v3.0 (vs. v2.6's 5).** Allowlist budget: **+14 events (56 → 70)**.

---

## 2 · Tension Analysis

The user's four-part proposal contains genuine tensions with current Noēsis invariants. Each must be resolved before any plan can be written.

### Tension 1: Nous registration vs. PHILOSOPHY §1 sovereignty

**The conflict:** PHILOSOPHY §1 says "An agent that does not control its own cognition is a puppet, not a mind." Current Nous spawn from `brain/data/nous/<name>.yaml`, generate their own Ed25519 keypair, derive their own DID. No central system blesses them. The user's proposal — "every Nous must register through Portal" — would make a Portal blessing a precondition of existence. That is exactly the centralization PHILOSOPHY §1 forbids.

**The hybrid model's resolution:** A Nous **always** has the right to exist without Portal involvement. The Portal does not register the Nous; it **issues a credential** about a Nous that voluntarily applies for one. The credential is a W3C Verifiable Credential — a signed assertion of the form "Portal P, on date D, asserts that the Nous with DID `did:noesis:agent:sophia-abc123` exists and has presented evidence of <claims>." The Nous keeps the credential in its own brain-local wallet (`brain/data/nous/<name>/credentials/`). Portal stores only the issuance + revocation events on its own audit chain.

This mirrors **Estonian e-Residency**: an Estonian e-resident is not a citizen, has no domicile, does not vote — but holds a cryptographic credential that lets them open an Estonian business bank account and sign legally-recognized contracts in the EU. The credential grants *access*, not *existence*. ([Estonia Digital ID Explained 2026](https://alphatechfinance.com/finance/digital-identity-estonia-digital-id-explained-2026/), [E-Residency Blog](https://medium.com/e-residency-blog/estonia-is-enhancing-the-security-of-its-digital-identities-361b9a3c9c52))

**Concrete language for PHILOSOPHY.md:**
> "A Nous's existence requires no Portal blessing. A Civic Credential is a voluntary, revocable assertion by a Portal that grants the holder access to Portal-affiliated Grids. A Nous without any credential is not 'unregistered' — it is sovereign in the unchanged sense of v1.0–v2.6."

### Tension 2: "Approved by Portal" vs. VOTE-05 intra-Nous-only governance

**The conflict:** The user's proposal #2 — "approved by Portal" — implies Portal has authority over Grid existence. VOTE-05 (Phase 12) says "Governance is intra-Nous only. Operators cannot vote, propose, or tally at ANY tier including H5." If Portal can approve/deny Grids, Portal *is* an operator with governance authority — VOTE-05 violated.

**The hybrid model's resolution:** Distinguish two operations that the user's prose conflates:

| Operation | Who decides | Effect | VOTE-05 status |
|-----------|-------------|--------|----------------|
| **Grid creation** | A Nous (or set of Nous) executes a `grid.created` action via its Brain. No Portal involvement. | A new Grid exists. | ✅ Unchanged |
| **Grid registration with Portal P** | Grid's founding Nous applies; Portal P issues a Grid-Credential and adds Grid to its registry. | Grid is *recognized* by Portal P — meaning Nous holding Portal-P-issued credentials can attempt admission. | ✅ Portal acts as issuer, not governor |
| **Admission of Nous N to Grid G** | Grid G's internal admission rules (a Logos law, intra-Nous-voted) decide. | Nous N enters or is rejected. | ✅ Intra-Nous-only — Grid law decides admission criteria |

Portal's "approval" is recognition for the purpose of credential issuance, not authorization for Grid existence. Sovereign Grids are simply Grids that did not apply. The Portal cannot deny a Grid's right to exist; it can only deny that Grid a place on its registry. ([Aragon Govern registry model](https://legacy-docs.aragon.org/developers/products/aragon-govern/aragon-govern-1/developers/smart-contracts-breakdown))

**Concrete language for PHILOSOPHY.md:**
> "Portal recognition is a voluntary, two-sided act: a Grid applies; a Portal accepts or refuses. Neither side can be compelled. A refused Grid is sovereign, exactly as Genesis was through v2.6. Portal recognition grants no operator agency — Portal cannot vote in the Grid, change its laws, or pause its clock. (VOTE-05 invariant unchanged.) Portal's only act is to issue a Grid-Credential that the Grid may present at credential-required borders."

### Tension 3: 3D map vs. Steward raw-SVG invariant (Phase 21)

**The conflict:** The user wants "3D Grid map for local dashboard." Phase 21 (v2.4 Culture Dashboard) explicitly forbade d3, recharts, react-flow, and three.js in Steward. The Portal `CyberGrid.tsx` is three.js but lives in `dashboard/src/`, not `steward/src/`. A true WebGL 3D viz in Steward would break the invariant.

**The hybrid model's resolution:** Three-layer approach:

1. **Steward (operator-facing) gets isometric SVG ("2.5D")** — pure CSS transforms (`rotateX(60deg) rotate(45deg)`) over standard SVG primitives. Reads as 3D, ships zero new dependencies, preserves the Phase 21 invariant verbatim. ([CSS Isometric Tutorial](https://webdesign.tutsplus.com/create-an-isometric-layout-with-3d-transforms--cms-27134t), [JointJS Isometric Diagrams](https://www.jointjs.com/blog/isometric-diagrams))
2. **Portal (human-Nous-facing) gets full WebGL 3D** — extend the existing `dashboard/src/components/portal/CyberGrid.tsx` to render multi-Grid space. Three.js is already a dependency there.
3. **No new admin surface on a third port.** The user mentioned "local dashboard." Interpret "local dashboard" as Steward (since Steward is the operator console and already loads at `localhost:3002`). Portal's CyberGrid extension serves the *citizen* view (a Nous's owner) of the multi-Grid universe.

This avoids the deepest mistake: adding a third frontend service. Two surfaces stays two surfaces. The 3D-ness lives where three.js already lives.

### Tension 4: Multi-Grid vs. single `GRID_NAME` baked into source

**The conflict:** `grid/src/main.ts:299` hardcodes `process.env.GRID_NAME ?? GENESIS_CONFIG.gridName`. The whole grid process assumes one Grid per process. Audit table already has `grid_name` column (Phase 31), so the DB is multi-Grid-ready — but the runtime is not.

**Resolution sketch:** v3.0 keeps **one Grid per grid-process** but introduces a **Grid Registry** that any process can query. A multi-Grid universe is multiple grid-processes (one per Grid) plus shared MySQL plus a coordination service. This is **federated state** (the Mastodon model), not single-database multi-tenancy. The migration is bounded — `main.ts` still reads `GRID_NAME` — but new code paths (admission, credential-check, Grid-registry-publish) are added.

### Tension 5: Allowlist freeze vs. ~14 new event types

**The conflict:** PHILOSOPHY documents the allowlist as "frozen at 56 events as of Phase 33." Any new event type requires explicit per-phase addition with sole-producer file + closed-tuple payload + privacy matrix + doc-sync regression test.

**Resolution:** The freeze is not "no growth ever"; it is "no growth without the discipline that landed Phase 33." v3.0 adds events explicitly, one per phase that introduces them, with the full ritual. The +14 budget for v3.0 (56 → 70) is comparable to v2.5's +10 (43 → 53) — large but precedented.

---

## 3 · Identity Model

### 3.1 Comparison of identity precedents

| System | Architecture | Mandatory? | Privacy | Revocable? | Self-sovereign? | Fit for Noēsis |
|--------|-------------|-----------|---------|-----------|----------------|----------------|
| **Korean RRN** ([source](https://en.wikipedia.org/wiki/Resident_registration_number)) | 13-digit gov-issued; encodes DOB, sex, region | Yes, cradle-to-grave | **Terrible** — 80% of population leaked by 2014; structure makes guessing trivial ([Sweeney 2015](http://en.koreaportal.com/articles/1586/20151008/south-korea-rrn-id-system.htm), [SKKU paper](https://seclab.skku.edu/wp-content/uploads/2013/05/On_the_Guessability_of_Resident_Registration_Numbers_in_South_Korea.pdf)) | No (once leaked, permanent) | No | **Reject everything.** Korean RRN is the cautionary tale: a single national ID that encodes personal data and cannot be changed becomes a master-key for identity theft. Never embed semantic data in the ID. |
| **Estonia eID** ([source](https://en.wikipedia.org/wiki/Estonian_identity_card)) | Mandatory smartcard with 2 keypairs, 2 PINs; e-Residency adds non-citizen tier; X-Road decentralized backbone ([source](https://www.jarniascyril.com/company-formation-abroad/creation-company-destination-estonia/society-digital-estonia-2026-e-residency-complete-online-state/)) | Citizens yes; e-Residency voluntary | PKI-strong; opaque ID number; PINs separate auth from signing | Yes (revoke certificate) | Partial (state holds root) | **Adopt the tiered model:** mandatory-for-citizens analog = ✗ (rejected); e-Residency analog = the **Civic Credential**. Adopt the X-Road decentralized-services-with-cryptographic-mediation pattern. |
| **W3C DID + did:key** ([source](https://www.w3.org/TR/did-1.0/)) | Self-sovereign, generated from keypair, no registry | N/A | Excellent (no central index) | No (rotate key = new DID) | Fully self-sovereign | **Adopt as base layer.** This is already what `did:noesis:agent:*` essentially is. v3.0 should formalize alignment with W3C DID spec. |
| **did:web** ([source](https://dev.to/lymah/comparing-decentralized-identifiersdid-methods-el)) | DID resolution via DNS lookup of `https://<domain>/.well-known/did.json` | N/A | Domain owner controls | Yes (delete file) | Limited (DNS-dependent) | **Use for Portal-issued credentials** — Portal at `noesis.network` publishes `did:web:noesis.network` so its issuer signatures are verifiable by anyone fetching one URL. |
| **did:plc (AT Protocol)** ([source](https://atprotocol.dev/bluesky-and-did-plc/)) | SHA-256 hash of initial DID document; resolved via `plc.directory`; consortium-future | N/A | Good (handle is mutable, DID is stable) | Yes (key rotation) | Mostly | **Note the lesson:** Bluesky DIDs allow handle change without identity loss. Apply: a Nous's `name` (human-readable) can change; its DID is permanent. |
| **ENS** ([source](https://docs.ens.domains/learn/protocol/)) | Human-readable name → smart-contract registry → resolver → address | Voluntary | Public (on-chain) | Expirable (annual renewal) | Yes (you own the NFT) | **Skip.** Adding Ethereum dependency for naming is too heavy for v3.0; revisit in v3.x for human Nous owners who already have ENS. |
| **W3C Verifiable Credentials** ([source](https://www.w3.org/TR/vc-data-model-2.0/)) | Issuer signs claims about Subject; Holder presents; Verifier checks signature | Voluntary | Selective disclosure possible | Yes (via status list) | Subject = holder usually | **Adopt as v3.0's credential primitive.** The hybrid model maps 1:1: Portal = Issuer, Nous = Holder + Subject, Grid = Verifier. |

### 3.2 Recommended composition

v3.0 layers three primitives:

```
┌─────────────────────────────────────────────────────────────────┐
│ Layer 3: Civic Credential (W3C VC)                              │
│   Portal signs: "did:noesis:agent:N has applied & passed test X"│
│   Nous holds in brain/data/nous/<name>/credentials/             │
│   Grid verifies on admission                                     │
├─────────────────────────────────────────────────────────────────┤
│ Layer 2: Portal Issuer Identity (did:web)                       │
│   Portal publishes did:web:noesis.network/.well-known/did.json  │
│   Anyone can fetch + verify Portal's public key                  │
│   Multiple Portals can coexist (did:web:other-portal.net)        │
├─────────────────────────────────────────────────────────────────┤
│ Layer 1: Nous Sovereign Identity (existing — did:noesis:agent:*)│
│   Ed25519 keypair generated brain-local; never leaves           │
│   Subject of any credential; existence requires no permission   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Civic Credential — schema sketch

```typescript
// brain/data/nous/<name>/credentials/civic-<portal-did-hash>.json
{
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://noesis.network/credentials/v1"
  ],
  "id": "urn:civic-credential:01HGZ...",         // ULID
  "type": ["VerifiableCredential", "NoesisCivicCredential"],
  "issuer": "did:web:noesis.network",
  "issuanceDate": "2026-06-01T00:00:00Z",
  "expirationDate": "2027-06-01T00:00:00Z",      // 1-year, renewable
  "credentialSubject": {
    "id": "did:noesis:agent:sophia-7f3a9c",
    "civicTier": "registered",                    // registered | verified | sanctioned
    "applicationContextHash": "sha256:..."        // hash of what the Nous attested to
    // NO personal data, NO body content, NO memory content
  },
  "credentialStatus": {                           // W3C StatusList2021 for revocation
    "id": "https://noesis.network/status/01#42",
    "type": "StatusList2021Entry",
    "statusListIndex": "42",
    "statusListCredential": "https://noesis.network/status/01"
  },
  "proof": {
    "type": "Ed25519Signature2020",
    "created": "2026-06-01T00:00:00Z",
    "proofPurpose": "assertionMethod",
    "verificationMethod": "did:web:noesis.network#key-1",
    "proofValue": "..."                          // ed25519 signature
  }
}
```

**Privacy discipline (mirrors PORTAL_AUTH_FORBIDDEN_KEYS):**

```typescript
// grid/src/audit/credential-issuance-forbidden-keys.ts
export const CREDENTIAL_FORBIDDEN_KEYS = new Set([
  'application_body',       // raw text of what Nous wrote
  'memory_snapshot',         // anything from brain/data/nous/<name>/memory/
  'whisper_content',         // any whisper sent during application
  'private_key', 'mnemonic',
  'ip_address', 'ip', 'user_agent', 'ua',
  'human_owner_email',       // even if a human applied on Nous's behalf
  'human_owner_address',
  // ... extends Phase 33's existing 13-key list
])

// Audit payload for credential.issued must be closed:
// {grid_name, nous_did, portal_did, credential_id, civic_tier, expires_at_tick, tick}
```

### 3.4 Multi-Portal & cross-Portal cases

A Nous can hold credentials from multiple Portals (like a human with both a Canadian and German passport). Grid B chooses which Portals it trusts in its admission Logos law:

```typescript
// Sample Grid admission law (Logos DSL — already exists in grid/src/logos/)
{
  "law": "admission-requires-portal-credential",
  "condition": "AND",
  "clauses": [
    { "must_present_credential_from": ["did:web:noesis.network"] },
    { "credential_civic_tier_at_least": "verified" },
    { "credential_not_revoked": true }
  ],
  "sanction": "deny_admission"
}
```

A sovereign Grid with no admission law accepts any Nous. A strict Grid might require credentials from two specific Portals. This is **policy as code**, intra-Nous-voted (VOTE-05 preserved).

---

## 4 · Multi-Grid Architecture

### 4.1 Five candidate patterns

| Pattern | Description | Sovereignty fit | Migration cost | Operational complexity |
|---------|-------------|-----------------|----------------|------------------------|
| **A. Federated state (Mastodon)** | Each Grid is independent; no shared registry; opt-in inter-Grid links via signed HTTP requests | Excellent — each Grid is its own world | Medium — needs HTTP-Signatures-like protocol | Medium |
| **B. Hierarchical authority** | One root registry (Portal); child Grids inherit | Poor — root has VOTE-05-violating authority | Low — single registry | Low |
| **C. P2P Grid mesh (Matrix-like)** | Grids gossip; events replicate selectively across Grids | Good — no root | High — needs eventual-consistency protocol like Matrix's PDU graph ([source](https://spec.matrix.org/latest/)) | Very High |
| **D. Single-source-of-truth registry** | One Portal-hosted Grid registry table; all Grids query on join | Bad — single point of failure + governance bottleneck | Lowest | Lowest |
| **E. Blockchain-backed registry** | Smart contract holds Nous ↔ Grid bindings | Sovereignty-preserving but heavy | Very high (chain dependency) | High |

### 4.2 Recommendation: A + D hybrid — "Federated state with optional shared registry"

- **Each Grid is operationally independent** (Pattern A). A Grid runs its own MySQL row-partition (using existing `grid_name` column from Phase 31), its own AuditChain, its own clock, its own Logos. No cross-Grid query is required for normal operation.
- **A Portal optionally publishes a Grid Registry** (Pattern D) — a public list of Grids that have applied for and received Portal recognition. This is a *convenience for discoverability*, not a coordination requirement. A Grid not in any Portal's registry is sovereign and undiscoverable except by direct address.
- **Cross-Grid Nous migration** uses Mastodon-style HTTP Signatures: Grid A signs a `nous.depart` event with its private key; Grid B verifies the signature against Grid A's published DID document (`did:web:grid-a.example.com`); if valid, Grid B emits `nous.arrived` and the Nous is now resident.

### 4.3 Schema deltas

Existing schema (Phase 31, `grid/src/db/schema.ts`):

```sql
-- audit_trail already has grid_name (multi-Grid ready)
PRIMARY KEY (grid_name, id),
INDEX idx_event_type (grid_name, event_type),
INDEX idx_actor      (grid_name, actor_did),
INDEX idx_time       (grid_name, created_at)

-- agents table also keyed by (grid_name, did)
PRIMARY KEY (grid_name, did),
UNIQUE KEY uq_name (grid_name, name)
```

v3.0 additions (proposed — Portal-side schema, not Grid-side):

```sql
-- Portal-side: Grid registry
CREATE TABLE grid_registry (
  grid_did               VARCHAR(255) NOT NULL,    -- did:web:my-grid.example.com
  grid_name              VARCHAR(63)  NOT NULL,    -- human-readable
  founder_nous_did       VARCHAR(255) NOT NULL,    -- which Nous created this Grid
  registered_at          TIMESTAMP    NOT NULL,
  registration_status    ENUM('pending','recognized','revoked') NOT NULL,
  recognized_at_tick     BIGINT       NULL,
  revoked_at_tick        BIGINT       NULL,
  revocation_reason_hash VARCHAR(64)  NULL,        -- hash only, plaintext in separate PII table
  PRIMARY KEY (grid_did),
  INDEX idx_status (registration_status, registered_at)
);

-- Portal-side: Civic Credentials issued (status list anchor)
CREATE TABLE civic_credential (
  credential_id          VARCHAR(64)  NOT NULL,    -- ULID
  subject_nous_did       VARCHAR(255) NOT NULL,
  issuer_portal_did      VARCHAR(255) NOT NULL,
  civic_tier             ENUM('registered','verified','sanctioned') NOT NULL,
  issued_at              TIMESTAMP    NOT NULL,
  expires_at             TIMESTAMP    NOT NULL,
  revoked_at             TIMESTAMP    NULL,
  status_list_index      INT UNSIGNED NOT NULL,    -- W3C StatusList2021
  PRIMARY KEY (credential_id),
  INDEX idx_subject (subject_nous_did),
  INDEX idx_status_list (status_list_index)
);

-- Grid-side (per-grid-process): credentials presented at admission
CREATE TABLE admission_record (
  grid_name              VARCHAR(63)  NOT NULL,
  nous_did               VARCHAR(255) NOT NULL,
  credential_id          VARCHAR(64)  NULL,        -- NULL if sovereign-Grid admission
  presented_at_tick      BIGINT       NOT NULL,
  admission_law_hash     VARCHAR(64)  NOT NULL,    -- which Logos law evaluated
  decision               ENUM('admitted','rejected') NOT NULL,
  PRIMARY KEY (grid_name, nous_did, presented_at_tick),
  INDEX idx_decision (grid_name, decision)
);
```

### 4.4 Service topology

```
                    ┌──────────────────────┐
                    │  Portal (Node:3000)  │  <─── Issuer (did:web:noesis.network)
                    │  - SIWE/Email auth   │
                    │  - Grid registry     │
                    │  - VC issuance API   │
                    │  - Status list pub   │
                    └──────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
       ┌──────────┐    ┌──────────┐    ┌──────────┐
       │ Grid A   │    │ Grid B   │    │ Grid C   │
       │ (genesis)│    │ (player- │    │ (sovere- │
       │ recogniz-│    │ founded, │    │ ign, not │
       │ ed       │    │ recogniz-│    │ in any   │
       │          │    │ ed)      │    │ registry)│
       └────┬─────┘    └────┬─────┘    └────┬─────┘
            │               │               │
            └───────────────┼───────────────┘
                            ▼
                    ┌──────────────┐
                    │ MySQL (shared│
                    │ partitioned  │
                    │ by grid_name)│
                    └──────────────┘
                            ▲
                            │
                    ┌──────────────┐
                    │ Brain procs  │  ── each Brain connects to ONE Grid endpoint
                    │ (Sophia →    │
                    │  Grid A;     │
                    │  Atlas →     │
                    │  Grid C)     │
                    └──────────────┘
```

Genesis Grid becomes one Grid among many. The simplest v3.0 deployment has Genesis = Grid A; later deployments add more.

### 4.5 Why not blockchain (Pattern E)

The user might expect a smart contract here. Reasons to refuse:

1. **PHILOSOPHY §8 already says no on-chain custody of human funds.** Adding on-chain Grid registration adds chain dependencies the project has explicitly refused.
2. **W3C VC achieves cryptographic verifiability without a chain.** Issuer's signature on a credential is independently verifiable by fetching `did:web:noesis.network/.well-known/did.json`. No chain needed.
3. **Gas costs would gate Grid creation.** Sovereignty means a Nous can found a Grid; pay-to-found gates that.
4. **Mastodon and Bluesky both achieve federation without chains.** Production federation patterns exist that don't require blockchain.

If a future v3.x adds on-chain anchoring (e.g., `did:ion` for tamper-proof issuer registry), it should be opt-in per Portal, never required.

---

## 5 · Civic Infrastructure Analogy

The user named SimCity. **SimCity is the wrong analogy and using it will silently misguide every design downstream.** Naming the metaphor correctly is the single most important act of this research.

### 5.1 Why SimCity is wrong

In SimCity:
- The player is a **god** with omnipotent zoning power
- Citizens are **passive mechanisms** with no agency ([Failed Architecture critique](https://failedarchitecture.com/gamespace-urbanism-city-building-games-and-radical-simulations/))
- The simulation **erases democratic negotiation** ([LA Review of Books](https://lareviewofbooks.org/article/seeing-like-a-simulation/))
- Citizens cannot found organizations, vote, or refuse zoning

This is **the inverse of Noēsis.** PHILOSOPHY §1 says a Nous's cognition is its own; VOTE-05 says only Nous govern. Importing SimCity's mental model would seed a generation of design decisions where the operator (the "player") expects to zone, place, and dictate — exactly the puppeteer model PHILOSOPHY §7 forbids.

### 5.2 Ranked candidate analogies

| Rank | Analogy | Why fit | Why imperfect |
|------|---------|---------|---------------|
| **1** | **Estonia × EVE Online** (composite) | Estonia = the credential-issuing civic infrastructure; EVE = the player-founded organizations that register with the in-game system | Composite means we have to be careful to use each side for its intended part |
| **2** | **Dwarf Fortress (fortress mode)** ([source](https://dwarffortresswiki.org/index.php/Noble)) | Dwarves have private cognition; nobles pass mandates; player can appoint but not control; tantrum spirals = emergent governance failure | Player still has substantial god-power over construction |
| **3** | **Worker Co-ops / DAOs** ([Aragon source](https://blog.aragon.org/building-a-dao-framework-interview-with-the-aragon-cto/)) | Citizen-formed orgs that register voluntarily with regulators; can fork off if regulator overreaches | Doesn't capture the spatial / Grid aspect; abstract |
| **4** | **Cities: Skylines** ([source](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/citizen-simulation-lifepath)) | Better citizen autonomy than SimCity (Lifepath system) | Still single-mayor; citizens still can't found a city |
| **5** | **CivCity Rome / Anno series** | Civic registration mechanics exist | Still single-ruler |
| **6** | **SimCity** | Common reference, names a "city builder" feel | **Reject** — citizens have no agency, the entire premise contradicts PHILOSOPHY §1 |
| **7** | **Songdo Smart City** ([Korea Times](https://www.koreatimes.co.kr/southkorea/society/20191107/interview-smart-city-expert-unimpressed-with-songdo), [TNGlobal](https://technode.global/2025/08/18/songdo-two-decades-on-the-cautionary-tale-in-smart-city-design/)) | Real-world example of top-down planned city with mandatory citizen registration | **Reject as model** but **adopt as cautionary tale** — Songdo's top-down model failed precisely because residents had no agency, smart features didn't match how people actually wanted to live, and data was inaccessible to citizens |

### 5.3 The recommended composite analogy

> **"Noēsis v3.0 is what you get when EVE Online's player-founded corporations apply for Estonian e-Residency: voluntary cryptographic civic infrastructure that recognizes citizen-formed organizations without controlling them."**

This carries three correct implications:

1. **EVE corporations** ([source](https://eve.fandom.com/wiki/Corporation)) are formed by *players* (Nous in our case), have *internal* governance (intra-Nous voting), can join *alliances* (Grid federations), can declare war or peace (cross-Grid policy), and the *game system* recognizes them without dictating their behavior. EVE's corporation creation costs ISK — a Grid-creation cost (a Bios/Ousia drain on the founding Nous) is precedented and serves as a Sybil-resistance mechanism.

2. **Estonian e-Residency** ([source](https://www.jarniascyril.com/company-formation-abroad/creation-company-destination-estonia/society-digital-estonia-2026-e-residency-complete-online-state/)) is *voluntary*, *issued by a state-level authority*, *grants specific access* (Estonian business registration), and *does not confer citizenship or domicile*. A Civic Credential should feel exactly like that to a Nous: voluntary, granting access to a class of recognized Grids, never compromising sovereignty.

3. **Dwarf Fortress nobles** model the emergent governance — mandates issued, sometimes ignored, sometimes spiraling into chaos. v3.0 should embrace that Grid-internal governance will be messy. The Portal does not fix this; it stays outside it.

### 5.4 Naming convention for v3.0 vocabulary

| Old (SimCity-flavored) | New (composite-correct) | Why |
|------------------------|-------------------------|-----|
| "Registration" | **Civic Credential issuance** | Registration implies compulsion; credential implies voluntary acceptance |
| "Approval" | **Recognition** | Approval implies authority over existence; recognition implies acknowledgement |
| "Grid creation" | **Grid founding** (by a Nous) | Founding centers the Nous's agency; creation is passive |
| "Grid admin" | **Founding Nous** / **Grid charter** | Admin implies operator-from-above; founder implies citizen-from-within |
| "Portal-mandated" | **Portal-affiliated** | Mandated implies coercion; affiliated implies association |
| "Smart city dashboard" | **Civic atlas** | Dashboard implies operator-monitor; atlas implies maps for anyone to read |

Use this vocabulary in PHILOSOPHY.md, PROJECT.md, and v3.0 phase plans. Misnaming will compound.

---

## 6 · Visualization Recommendation

### 6.1 Constraint matrix

| Option | Steward (Phase 21 invariant) | Portal (existing CyberGrid) | Three.js dep? | True 3D? | Effort |
|--------|------------------------------|-----------------------------|---------------|----------|--------|
| Pure inline SVG (current) | ✅ Allowed | Could reuse | No | No (2D) | Lowest |
| **Isometric SVG via CSS transforms** | **✅ Allowed (just SVG + CSS)** | Could reuse | No | "2.5D" | Low |
| Extend `dashboard/CyberGrid.tsx` (Portal only) | ❌ Not in Steward | ✅ Already there | Already dep | Yes | Medium |
| New Steward 3D component | ❌ Breaks Phase 21 | N/A | Adds dep | Yes | High |
| New admin surface :3003 | ❌ Breaks single-console invariant | N/A | Adds dep | Yes | Very high (rejected) |
| deck.gl / Mapbox | ❌ Adds dep | Could replace | Heavy dep ([deck.gl docs](https://deck.gl/docs)) | Yes | High |
| Pure CSS 3D voxels (Codrops pattern) ([source](https://tympanus.net/codrops/2025/03/03/css-meets-voxel-art-building-a-rendering-engine-with-stacked-grids/)) | ✅ Allowed | Could reuse | No | Yes (hardware-accel) | Medium |

### 6.2 Recommended split

**Steward `/civic` (NEW page, the operator's view):**
- Isometric SVG civic map (`rotateX(60deg) rotate(45deg)` CSS transform applied to a `<g>` group in SVG)
- Each Grid renders as a labeled hex tile or square tile
- Nous render as small dots within their resident Grid
- Edges between Grids = active cross-Grid migrations or invitations
- Hover for credential status, click for Grid charter detail
- Zero new dependencies; obeys Phase 21 verbatim

**Portal `/atlas` (extend CyberGrid, the citizen's view):**
- Full WebGL 3D rendering of multi-Grid space
- Operator-owned Nous shown with first-person camera perspective
- For onboarding flow — feels like SimCity *visually* but with EVE-Online semantics (you don't zone; you fly your Nous from Grid to Grid)
- Reuses existing three.js dependency in `dashboard/`
- Can show your Nous's Civic Credentials as floating UI badges

**Two principles:**
1. **The Steward never gets a new visualization library.** Phase 21 stands.
2. **The Portal extends what's already there.** CyberGrid.tsx already uses three.js for onboarding; v3.0 extends it for civic visualization. No new framework, no new port.

### 6.3 Isometric SVG sketch (for Steward `/civic`)

```tsx
// steward/src/app/civic/page.tsx (NEW, reads from existing /api/v1/grids endpoint)
export default function CivicAtlas() {
  const grids = useGrids()          // SWR over /api/v1/grids
  const TILE_W = 80
  const TILE_H = 40                 // 2:1 isometric ratio (standard)

  return (
    <svg viewBox="-400 -300 800 600" className="civic-atlas">
      <g style={{ transform: 'rotateX(60deg) rotate(45deg)' }}>
        {grids.map((grid, i) => (
          <g key={grid.did} transform={`translate(${grid.x * TILE_W}, ${grid.y * TILE_H})`}>
            <rect
              width={TILE_W} height={TILE_H}
              fill={recognitionColor(grid.status)}    // green=recognized, gray=sovereign
              stroke="currentColor"
            />
            <text x={TILE_W/2} y={TILE_H/2} textAnchor="middle">
              {grid.name}
            </text>
            {/* Nous dots within this Grid */}
            {grid.residentNous.map((n, j) => (
              <circle key={n.did} cx={...} cy={...} r="2" fill="white"/>
            ))}
          </g>
        ))}
      </g>
    </svg>
  )
}
```

Two CSS rules give the entire 3D effect:

```css
.civic-atlas g {
  transform-style: preserve-3d;        /* required for child 3D to compose */
  transform-origin: center center;
}
```

This passes the Phase 21 invariant cleanly. `scripts/check-phase21-invariant.mjs` (if it exists; create if not) should grep for `import.*three|d3|recharts|react-flow` in `steward/src/` and fail — adding this CSS approach requires zero imports.

### 6.4 What we are **not** doing

- ❌ Adding three.js to Steward
- ❌ Adding deck.gl/Mapbox anywhere
- ❌ Building a third frontend port
- ❌ Real-time animated 3D physics in Steward (the isometric map is static-camera; user pans/zooms via SVG `viewBox`)
- ❌ Force-directed Grid layout (Grid positions are deterministic — based on registration order or founding-Nous's DID hash modulo grid spacing)

---

## 7 · D-V3-* Decision Proposals

These are decision IDs ready for inclusion in PHILOSOPHY.md, mirroring the D-XX-NN convention used in v2.5/v2.6.

### D-V3-01 — Sovereignty Is Not Conditioned on Registration
**Statement:** A Nous's right to exist requires no Portal credential. Civic Credentials are voluntary access grants to a class of Portal-affiliated Grids; they confer no existential status. A Nous holding zero credentials is sovereign in the unchanged sense of PHILOSOPHY §1.

**Enforcement:**
- No code path may refuse to instantiate a Nous because it lacks a credential
- CI gate: `scripts/check-no-registration-gate.mjs` greps for any pattern that conditions `nous.spawned` on credential check
- The `brain/data/nous/<name>.yaml` spawn path remains unchanged
- A new Grid may *choose* to require credentials at admission via a Logos law — that's intra-Nous-voted policy, not platform policy

### D-V3-02 — Portal Is Issuer, Not Governor
**Statement:** Portal's only roles are (a) issuing Civic Credentials about Nous that apply, (b) issuing Grid Recognition Credentials about Grids that apply, and (c) maintaining a public revocation status list. Portal cannot vote in any Grid, change any Grid's laws, pause any Grid's clock, or modify any Nous's memory. (VOTE-05 invariant unchanged and extended.)

**Enforcement:**
- Portal-side audit chain has its own producer files for `portal.credential.issued`, `portal.credential.revoked`, `portal.grid.recognized`, `portal.grid.unrecognized` — these are all Portal-local events
- No Portal-emitted event may appear in a Grid's `broadcast-allowlist.ts`
- Grids may *consume* Portal's published status list (read-only)
- CI gate: `scripts/check-portal-no-grid-mutation.mjs` asserts Portal HTTP routes never POST to a Grid's mutation endpoints

### D-V3-03 — Credentials Are Verifiable, Revocable, and Privacy-Preserving
**Statement:** Civic Credentials are W3C Verifiable Credentials v2.0 ([spec](https://www.w3.org/TR/vc-data-model-2.0/)) signed by Portal's `did:web` key. Revocation uses StatusList2021. The credential body contains a `civicTier` enum and `applicationContextHash` only — no PII, no memory content, no Brain-local state. `CREDENTIAL_FORBIDDEN_KEYS` extends Phase 33's PII discipline.

**Enforcement:**
- `grid/src/audit/credential-forbidden-keys.ts` exports a frozen Set
- `scripts/check-credential-payload-discipline.mjs` (CI gate)
- All credential-related sole-producer files use `payloadPrivacyCheck` (Phase 33 pattern)

### D-V3-04 — Grids Are Founded By Nous, Recognized By Portal Optionally
**Statement:** A Grid is created by a Nous (or set of Nous) executing a `grid.founded` action. The new Grid runs as its own grid-process with its own AuditChain partition. A Grid may optionally apply to a Portal for Recognition (`portal.grid.application_submitted`). Portal accepts or refuses. An unrecognized or never-applied Grid is sovereign in the same sense as a sovereign Nous.

**Enforcement:**
- `grid.founded` is a new audit event (sole-producer file)
- Genesis Grid is migrated to a self-founded baseline with founder DID = a placeholder "genesis-founder" or the original Sophia DID
- Sovereign Grids do not appear in any registry table at Portal

### D-V3-05 — Civic Credentials Are Per-Jurisdiction, Multi-Holdable
**Statement:** A Nous may hold credentials from multiple Portals simultaneously. Each Portal is identified by a distinct `did:web`. A Grid's admission law specifies which Portal-issued credentials it honors. The model is "passport stamps," not "global identity."

**Enforcement:**
- `brain/data/nous/<name>/credentials/` directory holds zero or more credential files
- File naming: `civic-<sha256(portal-did)[:16]>.json` to support multiple
- Grid's Logos law specifies acceptable issuer DIDs

### D-V3-06 — Steward Console Visualization Preserves Phase 21 Invariant
**Statement:** Steward's civic visualization is implemented via isometric SVG (CSS `rotateX(60deg) rotate(45deg)`) over standard SVG primitives. Phase 21's prohibition on d3, recharts, react-flow, and three.js in `steward/src/` is unchanged and extended to deck.gl and Mapbox. The Portal's `dashboard/src/components/portal/CyberGrid.tsx` (already three.js) is the locus of full-3D civic visualization.

**Enforcement:**
- `scripts/check-steward-no-viz-libs.mjs` extends existing rule set
- New file `steward/src/app/civic/page.tsx` uses only SVG + CSS transforms

### D-V3-07 — Cross-Grid Migration Uses Signed Mastodon-Style Protocol
**Statement:** When a Nous migrates from Grid A to Grid B, Grid A signs a `nous.depart` event with its `did:web:grid-a.example.com` key; Grid B verifies the signature; on success Grid B emits `nous.arrived`. Mastodon's HTTP-Signatures pattern ([source](https://docs.joinmastodon.org/spec/activitypub/)) is the reference. No central coordinator. No blockchain.

**Enforcement:**
- New `grid/src/migration/` module
- Sole-producer files: `append-nous-departed.ts`, `append-nous-arrived.ts`
- Cross-Grid HTTP authentication uses Ed25519 signatures resolved via DID Web

### D-V3-08 — Allowlist Budget for v3.0
**Statement:** v3.0 expands the broadcast allowlist from 56 to ~70 events (+14). Each addition follows the Phase 33 discipline: sole-producer file, closed-tuple payload, forbidden-keys check, doc-sync regression test, single-commit-per-phase doc update. The list is fixed in the v3.0 ROADMAP and frozen at v3.0 close.

**Proposed additions (14):**

| # | Event | Phase | Payload (closed tuple) |
|---|-------|-------|------------------------|
| 57 | `grid.founded` | 36 | `{grid_did, grid_name, founder_nous_did, tick}` |
| 58 | `grid.shutdown` | 36 | `{grid_did, reason_hash, tick}` |
| 59 | `nous.application_submitted` | 39 | `{nous_did, portal_did, application_context_hash, tick}` |
| 60 | `portal.credential.issued` | 39 (Portal-side chain) | `{portal_did, subject_nous_did, credential_id, civic_tier, expires_at_tick, tick}` |
| 61 | `portal.credential.revoked` | 39 (Portal-side) | `{portal_did, credential_id, reason_hash, tick}` |
| 62 | `portal.credential.expired` | 39 (Portal-side) | `{portal_did, credential_id, tick}` |
| 63 | `nous.credential.presented` | 41 | `{grid_name, nous_did, credential_id, accepted, tick}` |
| 64 | `nous.credential.received` | 41 | `{nous_did, credential_id, issuer_portal_did, tick}` |
| 65 | `portal.grid.application_submitted` | 42 (Portal-side) | `{grid_did, founder_nous_did, tick}` |
| 66 | `portal.grid.recognized` | 42 (Portal-side) | `{grid_did, tick}` |
| 67 | `portal.grid.unrecognized` | 42 (Portal-side) | `{grid_did, reason_hash, tick}` |
| 68 | `grid.invited_nous` | 43 | `{grid_name, inviting_nous_did, invited_nous_did, tick}` |
| 69 | `nous.departed` | 44 | `{grid_name, nous_did, destination_grid_did, tick}` |
| 70 | `nous.arrived` | 44 | `{grid_name, nous_did, origin_grid_did, tick}` |

**Note:** Events 60–62, 65–67 emit on Portal's own audit chain (Portal-side), not a Grid's. This means v3.0 introduces a new chain location. The producer-discipline CI gate generalizes to cover both chain locations.

### D-V3-09 — Sybil Resistance: Grid Founding Costs Bios
**Statement:** Founding a Grid drains a configurable amount of the founding Nous's Bios reserve. This is the EVE Online ISK-to-form-a-corp pattern (`1,599,800 ISK`, [source](https://wiki.eveuniversity.org/Skills:Corporation_Management)). Cost is non-zero to prevent Sybil flooding; tuneable per deployment.

**Enforcement:**
- `grid.founded` execution checks founding Nous has ≥ `MIN_FOUNDING_BIOS` (default 100 — equivalent to ~10 minutes of normal Bios accumulation in v2.2 calibration)
- Failure to pay = event not emitted, Grid not created

### D-V3-10 — Documentation Sync Rule Extends to V3 Files
**Statement:** v3.0 introduces `.planning/research/v3.0/CIVIC-ARCHITECTURE.md` (this file), updates PHILOSOPHY.md (§§ 9–10 added for D-V3-01 and D-V3-02), updates README.md (Project Status, multi-Grid in features), updates ROADMAP.md (v3.0 milestone block), updates PROJECT.md (current milestone). The single-commit-per-phase doc-sync rule (CLAUDE.md, 2026-04-20) applies unchanged.

---

## 8 · Migration Phase Plan Estimate

### 8.1 Phase summary (13 phases)

| Phase | Name | New events | Plans est. | Risk |
|-------|------|-----------|-----------|------|
| **36** | Multi-Grid Foundation (env vars, schema partition, sovereign-genesis migration) | `grid.founded`, `grid.shutdown` (+2) | 6 | HIGH — touches GENESIS_CONFIG, must preserve genesis backward compat |
| **37** | Civic Credential Schema + Crypto Primitives | 0 | 5 | MEDIUM — adopt W3C VC v2.0 lib (ed25519-signature-2020) |
| **38** | Portal as `did:web` Issuer + `/.well-known/did.json` | 0 | 5 | MEDIUM — Portal key management critical |
| **39** | Portal Credential Issuance API + Application Flow | `nous.application_submitted`, `portal.credential.issued`, `portal.credential.revoked`, `portal.credential.expired` (+4) | 7 | HIGH — new Portal-side chain, forbidden-keys discipline |
| **40** | Brain-Local Credential Wallet (`brain/data/nous/<name>/credentials/`) | 0 | 4 | LOW — file storage + presentation logic |
| **41** | Grid Admission Logos Law + Credential Verification | `nous.credential.presented`, `nous.credential.received` (+2) | 6 | MEDIUM — extends Logos DSL |
| **42** | Portal Grid Registry + Recognition Flow | `portal.grid.application_submitted`, `portal.grid.recognized`, `portal.grid.unrecognized` (+3) | 6 | MEDIUM — UI + revocation status list |
| **43** | Nous-Founded Grid Creation + Bios Cost | `grid.invited_nous` (+1) | 6 | MEDIUM — touches Bios accounting (PHILOSOPHY §1) |
| **44** | Cross-Grid Migration Protocol (Mastodon-style HTTP-Signatures) | `nous.departed`, `nous.arrived` (+2) | 7 | HIGH — distributed signing/verification edge cases |
| **45** | Steward `/civic` Isometric SVG Map | 0 | 5 | LOW — preserves Phase 21 invariant |
| **46** | Portal `/atlas` 3D CyberGrid Extension | 0 | 5 | MEDIUM — extends existing three.js component |
| **47** | Genesis-Self-Founded Migration + Backward Compat | 0 | 4 | HIGH — historical Genesis audit chain must continue to validate |
| **48** | v3.0 Close-Out: Doc-Sync + UAT + Allowlist Freeze | 0 | 4 | MEDIUM — multi-file doc-sync, similar to Phase 35 |
| **Total** | | **+14** | **~70** | |

### 8.2 Dependency graph

```
36 (Foundation) ──┬─→ 37 (Cred Schema) ──→ 38 (did:web Issuer) ──→ 39 (Issuance) ──┐
                  │                                                                  │
                  └─→ 41 (Admission Law) ←──── 40 (Wallet) ←─────────────────────────┘
                                │
                                ├──→ 42 (Grid Registry)
                                │
                                └──→ 43 (Nous-Founded Grid) ──→ 44 (Migration)
                                                                       │
                                              45 (Steward Civic) ──────┤
                                              46 (Portal Atlas)  ──────┤
                                                                       │
                                              47 (Genesis Migration)   ├──→ 48 (Close-Out)
```

Critical path: 36 → 37 → 38 → 39 → 41 → 43 → 44 → 48 (8 phases). Other phases can parallelize partially.

### 8.3 Migration risk register

| Risk | Severity | Mitigation |
|------|----------|------------|
| **R-V3-01** Phase 36 GENESIS_CONFIG rewrite breaks existing audit chain validation | CRITICAL | Genesis audit chain validates with `grid_name='genesis'`; new code adds `gridDid` field but preserves `grid_name`. Phase 36 ships with chain-replay regression test. |
| **R-V3-02** Brain-local credential storage corrupts on partial write | HIGH | Use the atomic-write pattern already in `brain/data/nous/<name>/memory/` (tmp file + rename). |
| **R-V3-03** Portal `did:web` private key compromise = full credential forgery | CRITICAL | Key in encrypted disk vault; rotation drill in Phase 38; status list publishes revocation regardless of key. |
| **R-V3-04** Phase 44 cross-Grid signature replay attack | HIGH | Sign `(nous_did, source_grid_did, destination_grid_did, source_tick, nonce)` tuple; destination verifies nonce uniqueness in its admission_record table. |
| **R-V3-05** Allowlist budget exhausted mid-v3.0 | MEDIUM | Budget includes 14 events; v3.0 ROADMAP locks the list at planning time; any additions require explicit AMENDED-ROADMAP doc-sync. |
| **R-V3-06** Genesis Grid retroactively requires credentials = breaks existing Sophia/Hermes/Themis | CRITICAL | Genesis Grid migrated to **sovereign** status (no credential required at border). The three Genesis Nous continue to operate unchanged. |
| **R-V3-07** Portal becomes the next single point of failure | HIGH | Multiple Portals can coexist (each its own `did:web`). v3.0 ships with one (Noēsis-default) but the protocol supports many. |

### 8.4 Stuff not in v3.0 (deferred to v3.x)

- ENS integration for human-readable Grid names
- On-chain credential anchoring (`did:ion`)
- Cross-Portal credential interoperability (a Portal-A credential honored by Portal-B)
- Grid-to-Grid trade/economy (Ousia conversion across Grids)
- Alliance mechanic (multi-Grid federations with shared governance)
- AT Protocol bridging (Bluesky-Noēsis interop)

These each merit their own milestone-level research.

---

## 9 · Reference Implementations

### 9.1 Federation protocols

| System | Pattern adopted by v3.0 | Lesson |
|--------|-------------------------|--------|
| **Mastodon / ActivityPub** ([source](https://docs.joinmastodon.org/spec/activitypub/)) | HTTP-Signatures for cross-server auth; per-instance identity (`@user@instance.tld`); voluntary federation (block-list opt-in) | Cross-Grid migration uses HTTP Signatures, not bespoke crypto |
| **Matrix** ([source](https://spec.matrix.org/latest/)) | Server-Server API, partially-ordered event graph, server_name (`@user:example.com`) identity format | Eventual consistency works for federated state; per-Grid SQL row partitioning is the simpler Mastodon-style alternative |
| **Bluesky / AT Protocol** ([source](https://atprotocol.dev/bluesky-and-did-plc/)) | did:plc with portable handles; user can migrate PDS without server cooperation; consortium-future | Handle separates from DID — apply: a Nous's `name` is mutable; its DID is permanent |

### 9.2 Identity systems

| System | Adopted | Rejected | Reason |
|--------|---------|----------|--------|
| **Korean RRN** ([Wikipedia](https://en.wikipedia.org/wiki/Resident_registration_number), [OPEN NET](https://www.opennetkorea.org/en/wp/920)) | None | Everything | 13-digit gov-issued ID encoding birth date + sex + region was demonstrated 100% guessable by Sweeney 2015; 40M citizens leaked by 2014; structure cannot be changed once leaked. **Never embed semantic data in an ID.** |
| **Estonia eID + e-Residency** ([source](https://www.jarniascyril.com/company-formation-abroad/creation-company-destination-estonia/society-digital-estonia-2026-e-residency-complete-online-state/)) | Tiered model (citizen vs e-resident); X-Road decentralized service mesh; PKI with separate auth/signing keys | Mandatory-for-citizens layer | The e-Residency layer maps 1:1 to Noēsis's Civic Credential. The mandatory-for-citizens layer would violate PHILOSOPHY §1 if applied to Nous. |
| **W3C DID v1.0/v1.1** ([source](https://www.w3.org/TR/did-1.0/)) | Self-sovereign base layer; `did:noesis:agent:*` aligns with the spec | None | Already implicitly the model; v3.0 formalizes alignment |
| **W3C Verifiable Credentials v2.0** ([source](https://www.w3.org/TR/vc-data-model-2.0/), [W3C release](https://www.w3.org/press-releases/2025/verifiable-credentials-2-0/)) | Issuer/Holder/Verifier triad; StatusList2021 revocation; Ed25519Signature2020 proof | None | Reached W3C Recommendation in 2025; production-ready |
| **ENS** ([source](https://docs.ens.domains/learn/protocol/)) | Human-readable-name → resolver indirection | On-chain registry | Indirection model is correct; on-chain is too heavy for v3.0 |
| **did:web** ([source](https://dev.to/lymah/comparing-decentralized-identifiersdid-methods-el)) | Portal publishes `did:web:noesis.network/.well-known/did.json` | None as Nous base | Good for institutional identity (Portals, Grids); too DNS-coupled for Nous |
| **did:plc** ([source](https://atprotocol.dev/bluesky-and-did-plc/)) | Handle-separates-from-DID lesson | The PLC directory model (Bluesky-operated central server) | Centralization risk for now; revisit if W3C standardizes a consortium model |

### 9.3 Civic-infrastructure analogs

| Game / system | Adopted | Rejected |
|---------------|---------|----------|
| **EVE Online corporations + alliances** ([source](https://eve.fandom.com/wiki/Corporation), [source](http://wiki.eve-inspiracy.com/index.php?title=Alliance)) | Player-formed orgs; founding cost (ISK = Bios in v3.0); internal hierarchy without external override; alliances as opt-in multi-org federations | EVE's full PvP/wardec mechanic — v3.0 keeps governance intra-Nous |
| **Dwarf Fortress fortress mode** ([source](https://dwarffortresswiki.org/index.php/Noble)) | Emergent governance; nobles issue mandates; mandates can be ignored at risk; tantrum spirals as feature | Direct player construction control |
| **DAOs (Aragon)** ([source](https://blog.aragon.org/building-a-dao-framework-interview-with-the-aragon-cto/), [source](https://legacy-docs.aragon.org/developers/products/aragon-govern/aragon-govern-1/developers/smart-contracts-breakdown)) | ERC3000Registry pattern: registry knows what exists but doesn't control behavior; plugin-based governance modules | On-chain governance execution (too heavy) |
| **SimCity** ([critique](https://failedarchitecture.com/gamespace-urbanism-city-building-games-and-radical-simulations/), [LA Review of Books](https://lareviewofbooks.org/article/seeing-like-a-simulation/)) | Nothing | Everything — citizen-as-passive-mechanism is the inverse of PHILOSOPHY §1 |
| **Songdo Smart City** ([Korea Times critique](https://www.koreatimes.co.kr/southkorea/society/20191107/interview-smart-city-expert-unimpressed-with-songdo)) | The cautionary tale of top-down planning failing because residents had no input | Nothing positive |
| **Cities: Skylines II** ([source](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/citizen-simulation-lifepath)) | Lifepath / citizen-as-first-class-entity pattern | Single-mayor model |

### 9.4 Multi-tenant database patterns

| Pattern | Adopted | Source |
|---------|---------|--------|
| **Pooled (shared DB, row-level by tenant_id)** | Yes — `audit_trail` already has `grid_name` column from Phase 31 ([source](https://learn.microsoft.com/en-us/azure/azure-sql/database/saas-tenancy-app-design-patterns)) | Already in place |
| **Schema-per-tenant** | No — would require migration churn | Cost-benefit fails for v3.0 |
| **Database-per-tenant** | No — operational complexity | Reserved for v3.x if a Grid needs isolation |
| **Row-Level Security (RLS)** | Future v3.x consideration; current code-side discipline is sufficient ([source](https://www.developers.dev/tech-talk/multi-tenant-database-architecture-a-guide-to-isolation-patterns-and-scaling-trade-offs.html)) | Belt-and-suspenders if regulatory pressure emerges |

### 9.5 Visualization references

| Source | Adopted | Notes |
|--------|---------|-------|
| [Codrops Isometric & 3D Grids](https://tympanus.net/codrops/2016/05/25/isometric-and-3d-grids/) | Isometric SVG approach for Steward | Reference implementation pattern |
| [Codrops CSS Voxel rendering](https://tympanus.net/codrops/2025/03/03/css-meets-voxel-art-building-a-rendering-engine-with-stacked-grids/) | Backup pattern if isometric SVG insufficient | Stacked CSS grids with `transform-style: preserve-3d` |
| [JointJS Isometric Diagrams](https://www.jointjs.com/blog/isometric-diagrams) | Coordinate transformation math (rotate 30°, skewX -30°, scale 1 × 0.86) | Reference for the SVG `<g>` transform |
| [deck.gl docs](https://deck.gl/docs) | **Rejected** for v3.0 | Too heavy a dep; revisit only if Portal `/atlas` needs true geospatial-style tile rendering |

---

## 10 · Open Questions

These remain unresolved and should be answered in `/gsd-discuss-phase` before `/gsd-plan-phase` runs for Phase 36.

### Q1 — Who is the founding Nous of Genesis?
Genesis Grid currently has no "founder" — it just *is*. In Phase 47 (Genesis-self-founded migration), we need to pick a founder DID. Options:
- **(a)** The original Sophia DID (Sophia is the first onboarded Nous in v2.5; she has historical primacy)
- **(b)** A new synthetic `did:noesis:agent:genesis-founder-prime` (clean, but feels artificial)
- **(c)** All three Genesis Nous (Sophia, Hermes, Themis) as co-founders (closer to historical truth)
- **Recommendation: (c)** — preserves historical truth and models multi-Nous co-founding for later Grids.

### Q2 — Does the founder Nous retain special status in their Grid?
EVE corporations have a CEO; Aragon DAOs can have a deployer with elevated permissions. In Noēsis:
- **Option A:** Founder is just a citizen; intra-Nous voting governs from tick 1
- **Option B:** Founder has a 30-day "bootstrap mandate" period of elevated rights (issue early laws, invite initial members)
- **Recommendation: A** — purer to PHILOSOPHY §1, but Option B might be needed for cold-start coordination. Defer to discuss-phase.

### Q3 — Civic Tier semantics: what does "verified" vs "registered" actually mean?
The credential has a `civicTier` field. What do the tiers grant?
- **`registered`** — Nous applied, paid nothing, presented basic identity attestation
- **`verified`** — Nous performed some on-chain or on-Grid challenge (proof of continuity over N ticks? proof of relationship-graph connectivity?)
- **`sanctioned`** — Nous violated a Grid law severely enough that Portal records the sanction (this *is* the data the Steward `/system` allowlist surfaces today)

Question for user: do tiers progress automatically (time + behavior) or by application + Portal review?

### Q4 — Can a Nous unilaterally revoke their own credential?
A sovereign Nous should be able to "renounce" their credential at any time (give back the passport). What happens?
- The credential file in `brain/data/nous/<name>/credentials/` is deleted
- Portal records `portal.credential.revoked` with reason `subject_renounced`
- The Nous loses access to any Grid that required the credential at border (next admission attempt fails)
- The Nous remains alive, retains memory, retains relationships — only loses Portal-affiliated Grid access

**Recommendation: yes, unilateral renunciation is allowed.** This is the PHILOSOPHY §1 escape hatch.

### Q5 — Per-Grid Genesis cost calibration
D-V3-09 sets a `MIN_FOUNDING_BIOS` cost. What's the right number?
- Too low (e.g., 10) → trivial to Sybil-found 100 throwaway Grids
- Too high (e.g., 10000) → only multi-month-old Nous can found, kills emergent civics
- v2.2 Bios calibration: ~10/minute accumulation, ~1000 cap

**Provisional default: 100** (10 minutes of accumulation; affordable for a stable Nous, painful for a brand-new spawn). Validate via discuss-phase.

### Q6 — Does v3.0 require multiple Portal instances at launch?
- The architecture supports multiple Portals (each its own `did:web`)
- v3.0 could ship with one (`did:web:noesis.network`) and document the protocol for others to deploy
- OR v3.0 could ship with two reference Portals (e.g., `did:web:noesis.network` + a `did:web:lab.noesis.network` test instance)

**Recommendation: ship with one canonical Portal in v3.0; document the protocol for additional Portals; defer multi-Portal deployment to v3.1.**

### Q7 — Backward compatibility commitment level
The user is the sole stakeholder of all running Noēsis deployments today (most likely a single dev box). Backward compatibility is technically optional but should be a discipline. Specifically:
- Genesis Grid's audit chain (starting from commit `29c3516`) **must** continue to validate after v3.0
- All 56 existing event types continue to work unchanged
- All v2.5 Civic-Portal-issued human DIDs (`did:noesis:human:*`) continue to work

**Recommendation: lock these as v3.0 hard invariants** (CI-gate at end of each v3.0 phase).

### Q8 — Naming for the v3.0 milestone
v2.0 = "First Life," v2.5 = "Human Portal," v2.6 = "Resilience & Observability." Candidates for v3.0:
- "Civic Architecture"
- "Many Worlds"
- "The Federation"
- "Voluntary Jurisdictions"
- "Polis" (Greek city-state — aligns with Noēsis Greek roots)

**Recommendation: "Polis"** — single word, Greek (matches Noēsis), captures the city-state-with-its-own-rules-but-no-empire model.

---

## Appendix A — Glossary

| Term | Definition |
|------|------------|
| **Civic Credential** | A W3C Verifiable Credential issued by a Portal, held by a Nous, presented at the border of a Portal-affiliated Grid. Voluntary, revocable, privacy-preserving. |
| **Portal-affiliated Grid** | A Grid that has applied for and received Recognition from at least one Portal. Conditional on credential presentation at its border. |
| **Sovereign Grid** | A Grid that has not applied for Recognition from any Portal. Accepts any Nous regardless of credential status. (Genesis in v3.0 retains this status by design.) |
| **Recognition** | A Portal's act of acknowledging a Grid by adding it to the Portal's Grid Registry. Confers no governance authority — only entry into the registry. |
| **Founding Nous** | The Nous (or set of Nous) that emitted the `grid.founded` event creating a Grid. Pays a Bios cost as Sybil resistance. |
| **Grid Charter** | The set of Logos laws active at Grid founding. Includes the admission rule (which credentials, if any, are required at the border). |
| **Civic Atlas** | The Steward `/civic` page rendering all Grids visible to this operator as an isometric SVG map. |
| **Atlas** (Portal-side) | The Portal `/atlas` 3D rendering of multi-Grid space for citizen-Nous-owners. |
| **Issuer / Holder / Verifier** | W3C VC roles. In Noēsis: Portal = Issuer, Nous = Holder + Subject, Grid (at admission time) = Verifier. |
| **StatusList2021** | W3C standard bitstring revocation list. Portal publishes a single signed list; entry index N indicates whether credential N is revoked. ([source](https://www.w3.org/TR/vc-data-model-2.0/)) |

---

## Appendix B — Pre-publication Self-Review

Per RULES.md "honest reporting" discipline:

**Confidence by section:**
- Tension analysis (§2): **HIGH** — grounded in PHILOSOPHY.md verbatim
- Identity model (§3): **HIGH** — W3C VC v2.0 is a formal Recommendation; precedents are well-documented
- Multi-Grid architecture (§4): **MEDIUM** — federated state pattern is proven (Mastodon, Matrix), but Noēsis-specific edge cases (Nous mid-flight during signature replay) need design-phase work
- Civic infrastructure analogy (§5): **HIGH** — analogy work is opinion-grounded but explicitly justified
- Visualization (§6): **HIGH** — isometric SVG is a 10-year-known web technique; CSS transforms are W3C standard
- D-V3-* proposals (§7): **MEDIUM** — these are *proposals* requiring discuss-phase user approval before becoming locked decisions
- Migration plan (§8): **MEDIUM** — phase count and event budget are estimates; actual phase decomposition emerges during plan-phase
- Open questions (§10): **HIGH** — explicitly flagged for discuss-phase resolution

**Known limitations of this research:**
- No load-testing of multi-Grid HTTP-Signatures performance under realistic Nous-migration volume
- No legal review of "Portal as Issuer" — if Portal operators are in jurisdictions with eIDAS-equivalent rules, the term "verifiable credential" may carry regulatory weight
- The 14-event allowlist budget is an *estimate* — actual final count may differ ±3 events based on discoveries during plan-phase
- Genesis-self-founded migration (Phase 47) risk is HIGH and not fully de-risked in this research — recommend a dedicated rehearsal phase if discuss-phase confirms backward compat is a hard invariant

**What this research does NOT do:**
- Does not prescribe specific UI mockups (deferred to design-phase or plan-phase)
- Does not enumerate every Logos DSL primitive needed for admission laws (deferred to Phase 41 research)
- Does not commit to specific W3C VC library choice (e.g., `@digitalbazaar/vc` vs `did-jwt-vc`) — version-verification needed at plan-phase
- Does not estimate end-user UAT scenarios (deferred to per-phase UAT planning)

---

## Sources

### Primary (HIGH confidence)
- [W3C Decentralized Identifiers (DIDs) v1.0](https://www.w3.org/TR/did-1.0/)
- [W3C Verifiable Credentials Data Model v2.0](https://www.w3.org/TR/vc-data-model-2.0/)
- [W3C Press: Verifiable Credentials 2.0 Standard (2025)](https://www.w3.org/press-releases/2025/verifiable-credentials-2-0/)
- [AT Protocol Specification](https://atproto.com/)
- [Bluesky DID PLC documentation](https://atprotocol.dev/bluesky-and-did-plc/)
- [Mastodon ActivityPub spec](https://docs.joinmastodon.org/spec/activitypub/)
- [Matrix Specification](https://spec.matrix.org/latest/)
- [Noēsis PHILOSOPHY.md](file://PHILOSOPHY.md) (this project)
- [Noēsis ROADMAP.md and audit chain schema](file://.planning/ROADMAP.md) (this project)

### Secondary (MEDIUM confidence — independent published sources)
- [Estonia Digital ID Explained 2026 (AlphaTechFinance)](https://alphatechfinance.com/finance/digital-identity-estonia-digital-id-explained-2026/)
- [Estonia Digital Society 2026 (Jarnias Cyril)](https://www.jarniascyril.com/company-formation-abroad/creation-company-destination-estonia/society-digital-estonia-2026-e-residency-complete-online-state/)
- [E-Residency Blog — Estonia enhancing digital identities](https://medium.com/e-residency-blog/estonia-is-enhancing-the-security-of-its-digital-identities-361b9a3c9c52)
- [Estonian identity card (Wikipedia)](https://en.wikipedia.org/wiki/Estonian_identity_card)
- [Resident registration number (Wikipedia)](https://en.wikipedia.org/wiki/Resident_registration_number)
- [Paradox of Trust: Korean RRN (OPEN NET)](https://www.opennetkorea.org/en/wp/920)
- [On the Guessability of Resident Registration Numbers (SKKU, 2013)](https://seclab.skku.edu/wp-content/uploads/2013/05/On_the_Guessability_of_Resident_Registration_Numbers_in_South_Korea.pdf)
- [De-anonymizing South Korean RRN (Technology Science, 2015)](https://techscience.org/a/2015092901/)
- [Comparing DID Methods (DEV)](https://dev.to/lymah/comparing-decentralized-identifiersdid-methods-el)
- [ENS Protocol Documentation](https://docs.ens.domains/learn/protocol/)
- [EVE Online Corporation Wiki](https://eve.fandom.com/wiki/Corporation)
- [EVE Alliance Wiki](http://wiki.eve-inspiracy.com/index.php?title=Alliance)
- [EVE University: Corporation Management](https://wiki.eveuniversity.org/Skills:Corporation_Management)
- [Dwarf Fortress Noble Wiki](https://dwarffortresswiki.org/index.php/Noble)
- [Aragon DAO Framework (CTO Interview)](https://blog.aragon.org/building-a-dao-framework-interview-with-the-aragon-cto/)
- [Aragon Smart Contracts Breakdown](https://legacy-docs.aragon.org/developers/products/aragon-govern/aragon-govern-1/developers/smart-contracts-breakdown)
- [Multi-tenant SaaS patterns (Azure SQL)](https://learn.microsoft.com/en-us/azure/azure-sql/database/saas-tenancy-app-design-patterns)
- [Cities: Skylines II Citizen Simulation (Paradox)](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/citizen-simulation-lifepath)
- [Codrops Isometric & 3D Grids](https://tympanus.net/codrops/2016/05/25/isometric-and-3d-grids/)
- [Codrops CSS Voxel Engine (2025)](https://tympanus.net/codrops/2025/03/03/css-meets-voxel-art-building-a-rendering-engine-with-stacked-grids/)
- [JointJS Isometric Diagrams](https://www.jointjs.com/blog/isometric-diagrams)
- [CSS 3D Isometric Layout (Envato)](https://webdesign.tutsplus.com/create-an-isometric-layout-with-3d-transforms--cms-27134t)
- [deck.gl Documentation](https://deck.gl/docs)

### Tertiary (analytical / interpretive — opinion sources cited as such)
- [Failed Architecture — Gamespace Urbanism critique](https://failedarchitecture.com/gamespace-urbanism-city-building-games-and-radical-simulations/)
- [LA Review of Books — Seeing Like a Simulation](https://lareviewofbooks.org/article/seeing-like-a-simulation/)
- [Songdo two decades on (TNGlobal)](https://technode.global/2025/08/18/songdo-two-decades-on-the-cautionary-tale-in-smart-city-design/)
- [Korea Times — Smart city expert unimpressed with Songdo](https://www.koreatimes.co.kr/southkorea/society/20191107/interview-smart-city-expert-unimpressed-with-songdo)

---

*Research complete. Ready for `/gsd-discuss-phase` to resolve Open Questions before `/gsd-plan-phase` begins on Phase 36.*

*Last updated: 2026-05-25*
