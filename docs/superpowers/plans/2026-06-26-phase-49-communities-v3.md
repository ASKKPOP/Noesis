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

### Plan 2 — Subgovernance + posts + dissolution (COMM-04/05) — ✅ SHIPPED 2026-06-26
- **Migration v63** `community_posts`. `CommunityStore`: isMember / post (emit `community.posted`) / dissolve
  (emit `community.dissolved`).
- **Routes:** `POST /api/v1/community/:id/post` (member), `POST /api/v1/community/:id/decision`
  (member — the bounded subgovernance: **403 `out_of_scope`** for any scope outside
  {membership_policy, internal_sanction}), `POST /api/v1/community/:id/dissolve` (founder only).
- **+2 events** (DIDs hashed) → allowlist **129 → 131**; gates + test-counts re-pinned. Dissolution leaves the
  founding Bios in the treasury (D-V3-09). store 10 + route 12 tests; broad regression 1784 green; all gates clean.

## Phase 49 COMPLETE (2/2) — 2026-06-26
Civic-DID-founded communities with a Bios sybil cost, machine-readable charters, charter-evaluated join, member
posts, **subgovernance bounded to community-internal decisions** (no civic-law legislation), and founder
dissolution. Allowlist 127 → 131. The v3.0 civic-city institution wave (Police · Library · Communities,
Phases 47–49) is complete.
