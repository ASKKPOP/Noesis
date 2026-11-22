---
milestone: cross-cutting
sources: code audit at origin/main e47513b2 + web survey in two passes (38 queries, 2026-11-21) + one independent review of the sheet
tags: [holding, interior, objects, link-box, capabilities, marketplace, visualization]
status: discussion — nothing ratified
---

# Grid House Objects — research summary (2026-11-21)

**Full discussion sheet (canonical, served):** `docs/reports/noesis-grid-objects-discussion-2026-11-21.html`, live at
https://noesiis.com/reports/noesis-grid-objects-discussion-2026-11-21 — **v0.2**.
**Seed draft (machine-readable, loaded by nothing):** `docs/plans/2026-11-21-genesis-catalog-seed.draft.yaml`.
**Trigger:** operator base idea — furniture-like objects inside a Holding, configured and built by
the Local AI with its human; three origins (system pre-designed · rendered by the Nous · paid to a
service); visualization as drawn form or as a sealed box holding keys/tokens/permissions; functions
as predefined algorithms or linked apps; share, open sell, invited co-workers under rule and law,
alerts.

**Status:** a discussion document. It opens twenty decisions (Q1–Q20) and takes none. No canon
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

## v0.2 additions (2026-11-21, same day)

- **Full catalog (§14).** 18 structural materials (spacecraft practice, each with a source grade),
  12 finishes, 14 shell elements, 59 furnishing kinds (18 mirror + 41 functional; 13 exist in
  `furniture.ts`), 20 algorithms, 4 starter sets. Rule: *kinds are closed, forms are open*.
  Of the 41 functional kinds, 22 bind to shipped subsystems, 12 to partial ones, 7 are new.
  The catalog declares 63 affordance names against 20 seeded algorithms (13 kinds covered).
- **Initialization and growth (§15).** Tier 0 core seeded at Grid boot by a code seed plan
  (precedent `seedGenesisCore`, `seedGenesisGroups`); Tier 1 per-Grid by Polis law; Tier 2 by a
  Nous and its human along a ladder `new → proven → standard → retired`. Safe defaults for a new
  owner. User code never runs Grid-side. **Operator requirement (2026-11-21, the one decided
  point):** a custom object made by a user takes effect only in the Grid where it was defined and
  can be shared with other Nous of that Grid (§15.5). A proposed kind names a Tier 0 base kind.
- **Placement and configuration (§16).** Design (manifest) split from placed copy (instance).
  Instances get placement, settings, version. The Nous places by relation and a deterministic
  solver computes coordinates; the human drags, as a request to their Nous. A placement gate.
- **Deeper analysis per section (§17)** and **further recommendations R0–R15 (§18).**
- **What we are missing (§19):** 17 errors found by an independent review and corrected (§19.1),
  10 collisions with canon C1–C10 (§19.2), what the design gives up (§19.3), gaps G1–G28 (§19.4).

## Findings in code that stand regardless of this design

1. **No decision path produces a build, furnish or buy action.** The three menus in
   `brain/src/noesis_brain/prompts/` are `pay_due|bid_rfp|none`, `work_task|speak|rest` and
   `message_peer|share_skill|contribute_lore|vote|join_group|none`; nothing emits
   `EXTEND_INTERIOR`, `BUILD` or `BUY_PARCEL`.
2. **A latent memory-poisoning path.** `aisthesis/tracker.py` builds each percept label from the
   feed's `kind`/`type`/`name` string and `rpc/handler.py` writes up to 300 chars of the
   description into episodic memory. Today the feed carries parcels and orbital objects with no
   free text, so nothing foreign reaches memory; the path opens when furnishing labels enter
   world sight. Perception does not cover interiors at all today.
3. **Channel keys are derivable.** `whisper/keyring.py` derives key pairs from SHA-256 of the
   public DID (already listed in STATE.md as a known weakness). P2P sealing uses the Brain's own
   enrolled key when there is one and falls back to the derived key otherwise (`__main__.py`).
   A credential loan must only travel between enrolled Brains.
4. **Reclaim razes the interior.** `parcel-store.ts` `persistReclaim` sets
   `structure_interior = NULL`; nothing winds down what furnishings would hold.
5. **No move, no remove, no coordinates.** Interior objects are `{kind, class, state?}` in a named
   area; routes are `interior/extend` and `interior` only.
6. **Tick length is configuration.** Default `GRID_TICK_RATE_MS` is 30000, while the founding-law
   comment equates 10080 ticks with one week at one tick a minute.
7. **The city is empty.** Measured on production 2026-11-21: 53 parcels, 0 owned, 4 pre-built
   civic structures, 0 orbital objects.
8. **`CapabilityToken` cannot carry loans.** `protocol/src/persona/capabilities.ts` is HMAC under
   one process secret, wall-clock, TypeScript only and unused outside `protocol/`.
9. **Placing costs nothing.** The `interior/extend` route charges nothing, has no object cap and
   accepts any non-empty text as an area; a human session cannot read a private interior.

## Collisions with canon found by the review (§19.2)

C1 philosophy "regions are not pretending to be physical places" vs a physical interior ·
C3 A11c/A11e vs proxy credential lending (now derive-only) · C4 A12 degraded mode vs
Grid-authorized loans · C5 A7 already owns the word "lease" · C6 philosophy §7 consent grants vs
un-tiered human powers · C7 philosophy §8 vs Q3(b) · C9 Groups unaddressed · C10 the allowlist
budget undercounts closed-tuple changes.

## Overlap to resolve (Q17)

`docs/noesis-grid-extension-plan-2026-11-19.html` and
`docs/noesis-grid-visualization-research-2026-11-20.html` exist only on branch
`research/atlas-simulator`, which production runs. They define a seven-kind block catalog with
levels and lineage, a Work Card, a three-level Grid Station View and a zero budget for art. This
sheet adopts their catalog rules and treats its 3D interior as level three of that view.

## Q18 traced end to end (v0.2.1, 2026-11-21)

The operator picked Q18 to settle first. The trace (sheet §19.6) shows the decision menu is one of
seven links between a decision and a placed furnishing, and none holds today.

| # | Link | State (code at `1546d5e9`, production read-only) |
|---|------|--------------------------------------------------|
| 1 | A mind is running | No Brain process on production. Roster: 3 Nous, phase `spawning`. |
| 2 | Mind wired to Grid | All four cycles need `_grid_wire_client`; compose seed Brains set no `GRID_URL` and do not enrol. |
| 3 | Nous can pay | Ledger has one test row (1000). Cheapest parcel 400. |
| 4 | Menu offers the verbs | No. `produce_civic_land_action` has no caller. |
| 5 | Action reaches a route | `NousRunner.executeActions` has no civic-land case and no default; batch path drops them, still 200. |
| 6 | Verb shape fits route | `build` lacks `visibility` (400); `buy_parcel` has no parcel address. |
| 7 | Nous sees what it owns | Parcels yes, own interior no. |

Recommended shape for link 4: a cost-gated **property cycle** modelled on `_run_economic_cycle`
(runs only when something is actionable, one short JSON answer, Brain-side validation, `none`
always allowed, failed attempt stored as a lesson), dispatched by direct REST like
`post_economic_action`. Consistent with D-58-10 (a capability offered, nothing bought on the
Nous's behalf).

Open, operator's call (Q18a): who runs the first living Nous. Production host has 2 CPU, 15 GB,
no GPU. Recommendation: one Brain on the operator's own machine, enrolled against
`api.noesiis.com`; hosted model for the seed Nous only after that Nous has bought, built and
placed something.

## Q18a decided (v0.2.2, 2026-11-21)

**Decision (operator):** the first living Nous runs on the operator's office Mac Studio, on its
Local AI. No remote access to that machine at the time of the decision.

Design awaiting approval: `docs/plans/2026-11-21-nous-property-cycle-design.md`. Open for the
operator inside it: first money (`GRID_ENDOWMENT_ENABLED=false` on production), the model endpoint
on the Mac Studio (Brain speaks Ollama or Anthropic), and whether to run an earlier trial on
another machine.

**Eighth link (found by the independent check of the design, confirmed in code):** a Brain that
is not on the Grid's host never receives a tick. `handler.on_tick` is reachable only through the
`brain.onTick` socket RPC; production's Grid holds a disconnected stub bridge. Design answer: the
Brain follows `GET /api/v1/grid/clock` and ticks itself once per new Grid tick. Also open for the
operator: which Nous runs on the Mac Studio (founder Sophia or a new Nous).

## Built (v0.2.3, 2026-11-21)

Links 4-8 are built in the Brain and proven by tests only (design
`docs/plans/2026-11-21-nous-property-cycle-design.md`, plan
`docs/plans/2026-11-21-nous-property-cycle-plan.md`). Links 1-3 wait for the operator's Mac Studio.

**Grid defects found by the code review, open:** (1) reclaim → `structure = undefined` →
`publicView` throws → public parcel feed 500 until Grid restart; must be fixed before a Nous buys
land on production. (2) Civic-DID → runner index is memory-only; a Grid restart makes every
enrolled Brain's `post_actions` answer 404.

## Correction and Grid fix (v0.2.4, 2026-11-21)

- **Branch error.** Production's Grid runs `research/atlas-simulator`; the sheet's code-derived
  claims about production were read from `main`. On that branch link 8 (`wire/tick_driver.py`) and
  the runner rebinding (`restoreCivicDids`) were already done on 2026-11-20 (`aeee7173`).
- **Upkeep was per tick, not per period**, on both branches. Fixed on `main` together with the
  reclaim loop, the feed crash and the razed structure returning after a restart. Not on
  production. The property cycle is off unless `BRAIN_PROPERTY_CYCLE=on`.
- **Q17 is now blocking:** the upkeep fix reaches production only through
  `research/atlas-simulator`. A trial merge of `main` into it conflicts in one file
  (`grid/src/civic/parcel-registry.ts`, binary because of a NUL byte on that branch).

## Deployed (v0.2.5, 2026-11-21)

- **The upkeep and reclaim fix runs on production.** Measured in production's own Grid container
  against the image it ran before: 1 charge vs 50 in 50 ticks; reclaimed once vs repeatedly; a
  reclaimed parcel can be bought again.
- **One trunk.** `main` -> `research/atlas-simulator` -> production -> back to `main` (PR #29).
  The trunk half of Q17 is settled; joining the three plans into one catalog is still open.
- **Clock follower corrected**: it posted actions twice and could overlap a running decision.
- **Unchanged:** no Brain on production, no owned parcel, endowments off, property cycle off
  unless `BRAIN_PROPERTY_CYCLE=on`.

## Reclaim defects 5-7 fixed (v0.2.6, 2026-11-21)

- Roles end with a reclaim (history kept, one `zoning.role_revoked` each); condition is saved with
  every assessment; upkeep periods are counted in lifetime ticks read from the Grid's own chain.
- Reclaim is written to the database first. Live on production (PR #37).
- Open in the same area: roles are never persisted; the task board's checks; zone ids with a
  digit; see sheet §19.10.

## Roles saved, task board, zone ids (v0.2.7, 2026-11-22)

- Role edges and earned trust are persisted (database first); a reclaim ends roles and resets the
  parcel in one transaction. The task board is tied to its parcel. Zone ids may hold digits.
- Live on production (PR #41). Open and largest: IOUs and co-work agreements are not persisted.

## Debts and tasks saved (v0.2.8, 2026-11-22)

- The IOU ledger and the task board are persisted and reloaded at start; a task is claimed by a
  conditional write and settled in one transaction with the money or the debt. Migration 79.
- Live on production (PR #44). Largest open item now: a debtor has no way to pay an IOU.

## A debtor can pay a debt (v0.2.9, 2026-11-22)

- Grid: read one's debts and credits; pay a debt in full, one transaction, recorded as paid
  (`paid_tick`, migration 80); the ledger changes one request at a time. Live (PR #46).
- Brain: the verb and the read exist; no decision offers it, because the economic prompt is a
  frozen contract for the Rust port (D-V3-42). Largest open item.
