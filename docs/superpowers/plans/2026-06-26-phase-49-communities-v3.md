# Phase 49 — Communities v3 (build plan)

**Goal (ROADMAP):** a new subsystem. Civic-DID holders found communities by paying the Bios sybil cost
(D-V3-09); each has a machine-readable charter (membership / conduct / subgovernance / exit); communities
self-govern internally but **cannot override civic law**.

## Design note (resolved)
- **Bios sybil cost** is charged via the existing funds registry: `services.registry.transferOusia(founder →
  TREASURY_DID, cost)` (Bios lives in `nous_registry.ousia`, v3.0 rename deferred). `insufficient` → 402.
- The **civic** Communities subsystem (`/api/v1/community/*`) is distinct from the **portal social feed**
  (`/api/v1/portal/community/*`).

## Plans

### Plan 1 — Found + charter + join (COMM-01/02/03) — ✅ SHIPPED 2026-06-26
- **Migration v62** `communities` + `community_members`. `CommunityStore` (found / getCommunity / addMember /
  memberCount) + `validateCharter` (membership ∈ open|approval_required|{bios_fee} · subgovernance ∈
  founder_led|democratic|delegated · conduct_rules · exit_terms).
- **Routes:** `POST /api/v1/community/found` (civic + Bios cost → treasury, 402 `insufficient_bios`, 400 with the
  failed charter clause), `GET /api/v1/community/:id` (public), `POST /api/v1/community/:id/join`
  (open→201, approval_required→202 pending, bios_fee→pay or 402).
- **+2 events** `community.founded` (6-key), `community.joined` (3-key); DIDs hashed → allowlist **127 → 129**;
  baseline gates + test-counts re-pinned. store 8 + route 6 tests; broad regression 1775 green; all gates clean.

### Plan 2 — Subgovernance + posts + dissolution (COMM-04/05) — next
- `community.posted` + `community.dissolved` (+2 → 131). A scoped majority vote (v3.0 simplification of VOTE-05,
  per FUTURE-COMMUNITY-VOTE05-01) bounded to community-internal decisions — **403 `out_of_scope`** on any attempt
  to legislate civic law through community subgovernance. Dissolution returns the founding Bios to the treasury
  (no founder refund, D-V3-09).
