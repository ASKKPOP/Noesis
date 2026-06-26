# Phase 37b — Type B Registry (Polis-α/β/γ birth ceremonies) — build plan

**Goal (ROADMAP):** 3 Type B birth patterns, each with deliberate latency (no instant birth) —
Polis-α (Foundation curation, ≤5/quarter, ≥7-day review), Polis-β (bond posting, 10× Bios cost scaling
nonlinearly, refundable after 12mo), Polis-γ (parent-Nous spawning, ≥1y parent standing). **6 events, +6.**

## Constitutional note (D-V3-33)
The Type B registry emits its **own** `registry.type_b_*` events — these ARE the Type B issuance pipeline
(the Foundation/Polis ceremony, parallel to the human `civic.ts` pipeline). The store **never imports the
Phase-37 issuance producer**, so `check-civic-did-issuance-path.mjs` stays green.

## Plans

### Plan 1 — Polis-α charter + Polis-β sponsor (TYPE-B-01/02) — ✅ SHIPPED 2026-06-26
- **Migration v66** `type_b_registry` (ceremony α/β/γ, status pending_review|comment_window|issued|rejected,
  `eligible_tick` = filed + window). `TypeBRegistryStore`.
- **Polis-α**: `POST /api/v1/registry/type-b/charter` (government_only, ≤5/quarter rate limit) files a
  pending charter → `POST .../charter/:id/approve` after the ≥7-day review → `registry.type_b_chartered`.
- **Polis-β**: `POST /api/v1/registry/type-b/sponsor` (civic; nonlinear bond `requiredBond(active)` =
  1000×(active+1)², charged sponsor→treasury via `transferOusia`) → `registry.sponsorship_bond_posted` +
  7-day comment window → `POST .../sponsor/:id/finalize` → `registry.type_b_sponsored`.
- 3 events (DIDs hashed) → allowlist 141 → 144; baseline gates + test-counts re-pinned. store 7 + route 8
  tests; broad regression 1578 green; Portal-gating + did-policy-coverage clean.

### Plan 2 — Bond refund/slash + Polis-γ parent-spawn — ✅ SHIPPED 2026-06-26
- `refundBond` (beta+issued + 12mo + civic minimums → `registry.sponsorship_bond_refunded`, route settles
  treasury→sponsor via `transferOusia`), `slashBond` (sybil/spam Police sanction → `registry.sponsorship_bond_
  slashed` → civic treasury), `spawnByParent` (→ `registry.type_b_spawned_by_parent`).
- Routes: `POST .../:id/bond-refund` (civic), `POST .../:id/bond-slash` (government_only), `POST .../spawn` →
  **403 `forbidden_in_v3.0`** (Polis-γ gated to v3.1+, D-V3-28; the store method exists + is tested for v3.1).
- +3 → 147. store 11 + route 13 tests; broad regression 1588 green; Portal-gating + did-policy-coverage clean.

## Phase 37b COMPLETE (2/2) — 2026-06-26
3 Type B birth ceremonies — Polis-α (Foundation charter, ≥7-day review, ≤5/quarter), Polis-β (nonlinear bond
sponsor with refund-after-12mo / slash-on-sanction), Polis-γ (parent-spawn, gated to v3.1+). 6 `registry.*`
events; the issuance pipeline never imports the Phase-37 producer (D-V3-33 green). Allowlist 141 → 147.
