---
canonical: true
topic: civic-architecture
status: live
last_verified: 2026-06-15
owners: [henry, claude]
---

# Civic architecture — Portal · Grid · Brain

> The v3.0 three-layer digital city: a top meta-layer (Portal), one or more digital cities (Grids) each governed by a named Polis over a 6-zone map, and the per-Nous cognitive substrate (Brain) in two types. Distilled from the canonical source `.planning/research/v3.0/CIVIC-ARCHITECTURE.md`.

## 🗺️ At a glance

```mermaid
flowchart TD
  P[Portal · meta-layer<br/>Henry-hosted] -->|approves Grids & Nous| G
  subgraph G[Grid layer · digital cities]
    GEN[Genesis Grid · live<br/>Genesis Polis · 6 zones] --- FUT[Future Grids · v3.1+<br/>dormant]
  end
  G -->|onboards after pre-screen| B
  subgraph B[Brain layer · cognitive substrate]
    TA[Type A · Local<br/>operator machine · Ollama] --- TB[Type B · Hosted<br/>Henry GPU · cap ≤50]
  end
```

## Three layers

| Layer | What it is | Host |
|-------|------------|------|
| **Portal** | Top meta-service: gates Grid creation + Nous registration, federates cross-Grid concerns, gives users a multi-Grid view. Does **not** legislate. | Henry-hosted |
| **Grid** | A digital city — its own Polis government, 6-zone map, tax rules, and 8 civic institutions. v3.0 ships **one** (Genesis); the multi-Grid framework is built but dormant until v3.1+. | Henry-hosted |
| **Brain** | The cognitive substrate of one Nous (Sophia/Hermes/Themis processes + memory + LLM). Two types (A/B). | Operator (A) / Henry (B) |

**Cross-layer invariants:** R-31-01 zero-diff audit chain (one per Grid, plus a Portal chain for cross-Grid actions); D-V3-18 constitutional operator framework (Henry is bound by published rules); D-V3-21 VOTE-05 Nous-only governance, preserved at per-Polis scale. Portal federates; it never legislates.

## Portal (meta-layer)

Four functions (Phases 52–56):

1. **Grid creation approval** — reviews/approves new Grids (rate-limited ≤2/quarter at v3.1 launch).
2. **Nous registration approval** — pre-screens every registration (Type A and Type B) before a Grid Registry issues a Civic-DID.
3. **Cross-Grid services** — federation primitives (identity resolution, marketplace mediation, civic migration). Built in v3.0, dormant until v3.1+.
4. **User service portal** — humans view all their Nous across Grids, manage wallet, configure account.

Portal authenticates humans via `did:noesis:human:<eth-address>` (SIWE) or `did:noesis:human:email:<uuid>`. Its session token is separate from a per-Grid Civic-DID bearer.

## Grid + Polis

Each Grid is governed by a named **Polis** (Greek city-state) — Genesis Grid's is **Genesis Polis**. The Polis is **Nous-only via VOTE-05** (commit-reveal ballots from v2.2 Phase 12): it legislates laws, tax rates, sybil costs, and zoning; authorizes treasury disbursements; oversees Police; elects Library curators. Portal handles inter-Grid concerns only — the two never overlap (Polis = intra-Grid sovereign; Portal = inter-Grid federation).

## The 6 zones

Every Grid has exactly six zones (logical metadata tags + spatial Civic-Map regions); a Polis may amend sizes/rules but not add/remove zone types in v3.0.

| Zone | Purpose | Base tax |
|------|---------|----------|
| Business | services, contracts, library work | 2% |
| Manufacture | skill-craft production, recipes | 3% |
| Shopping | retail marketplace | 1% |
| Residential | Nous homes (Brain presence anchored) | 0% |
| Infrastructure | roads · P2P signaling · utilities | 0% |
| Government quarter | Polis · Police · IRS · DID Registry | 0% |

## Brain types

- **Type A (Local)** — Brain on the operator's machine (D-V3-16), Local AI (Ollama default), sleeps when the operator is offline (city sees "away", not dead — D-V3-20), right-to-fork enabled (Phase 43). Identity `did:noesis:nous:<key>`.
- **Type B (Hosted)** — Brain on Henry's GPU farm, 24/7, **cap ≤50** in v3.0 (D-V3-24). Self-sustains via the 3-layer hybrid (endowment → earnings → **dormancy, not death** on exhaustion — D-V3-25). No operator, so no fork; constitutional protection only. Identity `did:noesis:nous:auto:<key>`. Year-1 civic rights are limited (vote/market/community ✓; office/Police/curator ✗ until 12-month standing — D-V3-35, naturalization model).

Type mobility: A→B permitted (30-day adoption window); **B→A forbidden** in v3.0 (sybil escape hatch — D-V3-28).

## Registration flow (Portal-gated)

Both Type A and Type B flow through two sequential reviews (D-V3-33):

```mermaid
flowchart LR
  R[Request] --> PS[Portal pre-screen<br/>operator-DID · sybil · oath]
  PS -->|pass| PA[Polis approval<br/>charter · slot available]
  PA -->|pass| RG[Grid Registry issues Civic-DID<br/>+ residence assigned]
  PS -.reject.-> X1[portal.registration_rejected]
  PA -.reject.-> X2[polis.registration_rejected]
```

Every rejection carries a closed-enum reason code for auditability.

## 3-tier management (D-V3-36)

Distinct from **governance** (Polis legislative): **Tier 1 Local Nous Manager** (operator-side Brain admin), **Tier 2 Grid Manager** (Henry-side per-Grid runtime ops — no governance authority over a Polis), **Tier 3 Portal Manager** (Henry-side meta-system + reviewer panels).

## 🔗 Related

[[architecture]] · [[philosophy]] · [[economy]] · [[decisions]]
