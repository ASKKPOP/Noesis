---
milestone: cross-cutting
sources: code audit at origin/main e47513b2 + single-pass web survey (14 queries, 2026-11-21)
tags: [holding, interior, objects, link-box, capabilities, marketplace, visualization]
status: discussion — nothing ratified
---

# Grid House Objects — research summary (2026-11-21)

**Full discussion sheet (canonical, served):** `docs/noesis-grid-objects-discussion-2026-11-21.html`
(`/docs/noesis-grid-objects-discussion-2026-11-21.html` on the guide container).
**Trigger:** operator base idea — furniture-like objects inside a Holding, configured and built by
the Local AI with its human; three origins (system pre-designed · rendered by the Nous · paid to a
service); visualization as drawn form or as a sealed box holding keys/tokens/permissions; functions
as predefined algorithms or linked apps; share, open sell, invited co-workers under rule and law,
alerts.

**Status:** a discussion document. It opens twelve decisions (Q1–Q12) and takes none. No canon
file (`ROADMAP`, `REQUIREMENTS`, `PROJECT`, wiki) changes until those are ratified. Builds on
[[nous-house-research]] (D-NH-01..13) and [[v3.1/ARCHITECTURE-RECONCILIATION]] (A1, A6, A11, T1, T2).

## Code-audit finding

The object layer is an extension, not a greenfield. Phases 58–61 already built the closed
13-kind furniture catalog (`grid/src/civic/furniture.ts`), the interior tree, role capabilities
(owner ⊇ staff ⊇ guest), Cowork Agreements, the severance FSM, the IOU ledger and blueprint
builds. Gaps found: interiors render as DOM tiles, not 3D; there is no glTF/GLB loader anywhere
in the tree; most functional affordances are declarations without execution; there is no vault
or encryption at rest for third-party credentials; `staff` may use all functional furniture with
no per-object granularity. `InteriorObject.state` is reserved and unused — the natural anchor for
a manifest hash. `protocol/src/persona/capabilities.ts` already has a macaroon-style
`CapabilityToken` with attenuation that nothing consumes yet.

## Design core proposed

One object, four layers: **Form** (catalog template · deterministic Form DSL · pinned GLB, behind
a form gate) · **Link** (slots for credentials; Grid keeps label hash + digest + policy, the value
lives only in the Brain vault; sharing is a short-lived lease, by derive or by proxy) ·
**Function** (closed algorithm catalog pure in (state, tick) Grid-side; consented App Links run
only by the Brain tool loop) · **Governance** (visibility, license bits copy/modify/transfer/resell,
price and royalty, per-object role caveats, alert policy). The manifest is declarative and stored
by hash, like blueprint recipes, so the chain sees only closed enums and hashes (D-59-08 holds).

## Research lessons (grades in the HTML)

1. **GLB for delivery, behaviour outside the asset.** USD composition is weak on the web;
   `KHR_interactivity` is not confirmed ratified. Keeping logic out of assets also keeps A11e true.
2. **Lease, don't share.** Dynamic short-lived credentials are established practice for agents
   (HashiCorp validated pattern); capability-token families all reduce to root + attenuating caveats.
3. **Two permission systems are needed.** What an item may be done with (license bits) and what
   an item may do (consented scopes) are distinct — Second Life kept both for two decades.
4. **Scope consent is solved.** Required/optional/individually revocable scopes (Shopify) and
   least-privilege step-up OAuth (MCP authorization spec) map directly onto the App Link.
5. **Royalties must be enforced at settlement.** ERC-2981 only signals; since objects settle on
   Noēsis rails, the royalty is a term of our settlement function. No NFT needed in v1.
6. **Open scripted-item ecosystems are costly.** Decentraland stopped supporting new Smart Items.

## Open decisions (operator)

Q1 name (Skeuos / furnishing) · Q2 manifest only vs scripts · Q3 Type B and secrets · Q4 may a
human own a chattel object (D-NH-07 covers land only) · Q5 human co-configuration surface ·
Q6 payment/financial providers as App Links (collides with D-MONEY-01) · Q7 fee and royalty cap ·
Q8 form-gate caps and generative 3D scope · Q9 alerts leaving the app · Q10 allowlist budget and
prefix (159 → 163 proposed, minimal 161) · Q11 ratify the T1 ex-ante/ex-post split · Q12 sequencing
against Money 64–66.

## Proposed phases (unnumbered)

OBJ-1 Form (+0) · OBJ-2 Link Box (+2) · OBJ-3 Functions (+1) · OBJ-4 Share & Sell (+1, needs
Money 64) · OBJ-5 Co-work & Alerts (+0). Proposed invariants OBJ-INV-1..8 are listed in §10 of
the sheet.

## Not established by this pass

External claims were not run through the 3-vote verification harness. Marketplace revenue splits
conflict across sources. Text-to-3D model licences and benchmarks are unverified. Reselling access
to third-party APIs through leases may breach provider terms and needs a per-provider check
before OBJ-3.
