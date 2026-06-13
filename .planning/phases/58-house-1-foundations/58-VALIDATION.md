---
phase: 58
slug: house-1-foundations
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-12
---

# Phase 58 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (grid + dashboard packages), pytest (brain) |
| **Config file** | `grid/package.json` / `dashboard/package.json` scripts; `brain/pytest` |
| **Quick run command** | `cd grid && npm run test -- --reporter=verbose civic` |
| **Full suite command** | `cd grid && npm run test` (+ `cd dashboard && npm run test`, `cd brain && pytest`) |
| **Estimated runtime** | ~40 seconds (grid suite) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- <test-file-stem>` (or `pytest <file>`).
- **After every plan wave:** Run the package's full suite.
- **Before `/gsd-verify-work`:** All suites + all gates green.
- **Max feedback latency:** ~40 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| 58-01-01 | 01 | 0 | R-58-01/03/04 | Wave 0 stubs prevent silent plan execution | unit | `npm run test -- civic/parcel-store civic/founding-law civic/parcel-seed` | ❌ Wave 0 | ⬜ pending |
| 58-01-02 | 01 | 0 | R-58-06/07/09/12 | Auth-matrix + allowlist-91 (+0) locked before impl | unit | `npm run test -- api/civic-parcels-routes audit/broadcast-allowlist` | ✅ allowlist exists | ⬜ pending |
| 58-02-01 | 02 | 1 | R-58-03/04 | gravityPrice only in founding-law; Parcel carries (ring,sector,level) | unit | `npm run test -- civic/founding-law` | ❌ Wave 0 | ⬜ pending |
| 58-02-02 | 02 | 1 | R-58-01 | Write-through store: DB source of truth, hydrate on boot | unit | `npm run test -- civic/parcel-store` | ❌ Wave 0 | ⬜ pending |
| 58-03-01 | 03 | 2 | R-58-02 | Exactly 53 parcels seeded idempotently, no audit events | unit | `npm run test -- civic/parcel-seed` | ❌ Wave 0 | ⬜ pending |
| 58-03-02 | 03 | 2 | R-58-05 | GridServices.parcels attached; registry-not-wired smoke | unit | `npm run test -- civic/parcels-wiring` | ❌ Wave 0 | ⬜ pending |
| 58-04-01 | 04 | 3 | R-58-06/08/09 | Routes + funds + 82-86 reuse; hashed owner on feed | unit | `npm run test -- api/civic-parcels-routes` | ❌ Wave 0 | ⬜ pending |
| 58-04-02 | 04 | 3 | R-58-07 | D-NH-07: 401 human_visitor / 403 humans_cannot_own_land / 402 insufficient | unit | `npm run test -- api/civic-parcels-routes` | ❌ Wave 0 | ⬜ pending |
| 58-04-03 | 04 | 3 | R-58-12 | Allowlist stays 91 (+0); did-policy-coverage gate green | unit | `npm run test -- audit/broadcast-allowlist` + `node scripts/check-did-policy-coverage.mjs` (run from repo root) | ✅ extends existing | ⬜ pending |
| 58-05-01 | 05 | 4 | R-58-10 | Civic-land verbs are capabilities, dispatch to Grid; my_places block | unit | `cd brain && pytest tests/test_civic_land_verbs.py` | ❌ new | ⬜ pending |
| 58-06-01 | 06 | 5 | R-58-11 | Orbital map live-fetches feed; lit/ghost by owner hash; no raw DID | unit | `cd dashboard && npm run test -- orbital-genesis-map` | ❌ new | ⬜ pending |
| 58-06-02 | 06 | 5 | R-58-12 | NY clock at display boundary only; wallclock gate green | gate | `node scripts/check-wallclock-forbidden.mjs` | ✅ existing gate | ⬜ pending |
| 58-07-01 | 07 | 6 | R-58-07/08 | E2E DoD: buy->build->join->leave, 5 events, human refused | integration | `npm run test -- civic/house-1-e2e` | ❌ new | ⬜ pending |
| 58-07-02 | 07 | 6 | R-58-12 | All gates green + 0 remaining describe.skip | gate | `cd grid && npm run test` + gate scripts | ✅ existing gates | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `grid/test/civic/parcel-store.test.ts` — stubs for R-58-01 (write-through, hydrate, caps, commons-not-purchasable)
- [ ] `grid/test/civic/parcel-seed.test.ts` — stub for R-58-02 (exactly 53, distribution, 5 commons venues, no audit events)
- [ ] `grid/test/civic/founding-law.test.ts` — stub for R-58-03 (gravityPrice 400/900; rings 0-1 not purchasable)
- [ ] `grid/test/api/civic-parcels-routes.test.ts` — stub for R-58-06/07/09 (auth matrix, 402, entry-policy, hashed owner)
- [ ] `grid/test/civic/parcels-wiring.test.ts` — stub for R-58-05 (GridServices.parcels + GET smoke)

*Existing `grid/test/audit/broadcast-allowlist.test.ts` is UNCHANGED — it confirms the +0 invariant (still asserts 91). Do NOT edit the count.*

---

## Definition of Done (master-plan acceptance scenario)

Phase 58 is DONE when this single scenario passes end-to-end in `grid/test/civic/house-1-e2e.test.ts` and the gates below are green:

1. **Buy** — a Nous buys a ring-3 residential parcel for **400 Bios** (`gravityPrice(3)`); the route reads the buyer's balance from `nousRegistry.get(buyerDid).ousia`, calls `parcelRegistry.purchase(addr, buyerDid, balance)` (validates affordability+caps), then `nousRegistry.transferOusia(buyerDid → TREASURY_DID, 400)` moves funds (ParcelRegistry has no transferOusia); the audit trail shows `zoning.parcel_purchased (82)` + `treasury.parcel_revenue (83)` with the owner only as `owner_civic_did_hash` (HEX64).
2. **Build** — the same Nous builds a **home**; the trail shows `zoning.structure_built (84)`.
3. **Visit** — a second Nous **joins** the structure; the parcel reports **1 occupant**; the trail shows `zoning.structure_joined (85)`. The Nous then leaves → `zoning.structure_left (86)`.
4. **Map** — the orbital map at `/worldmap/orbital` shows the **lit parcel with 1 occupant** (lit because `owner_civic_did_hash` is present; occupancy light from the count).
5. **Human refused** — a signed-in human attempting to purchase is refused: `human_visitor` tier → **401**; a `did:civic:noesis:human:*` DID → **403 `humans_cannot_own_land`** (D-NH-07, constitutional).

### Gate checklist (all must be green and UNCHANGED)

- [ ] `broadcast-allowlist.test.ts` asserts `ALLOWLIST.size === 91` and `ALLOWLIST_MEMBERS.length === 91` (delta **+0**; events 82–86 reused, none added/renamed/reordered).
- [ ] Migration **v38** creates `civic_parcels` (with `ring`/`sector_deg`/`level` vector columns) and applies cleanly on a fresh DB; down migration drops it. v38 is the next free version after shipped v37.
- [ ] Genesis Core seeds EXACTLY **53** parcels (1 + 4 + 24 + 24 = 48 purchasable + 5 civic), idempotently, emitting no audit events. Ring 4+ absent.
- [ ] `gravityPrice(ring) = 100 × (5 − ring)²` lives only in `founding-law.ts`; ring 3 = 400, ring 2 = 900; civic rings 0–1 not purchasable.
- [ ] Write-through persistence: DB row present after purchase; registry hydrated from store on boot; occupants memory-only.
- [ ] `GridServices.parcels` attached in `main.ts` with boot log `[civic] parcels loaded: 53`; GET route smoke check passes (registry-not-wired bug class closed).
- [ ] civic-parcels routes registered with correct ROUTE_DID_POLICY entries (2 GET public, 5 POST `civic_did_required`); `node scripts/check-did-policy-coverage.mjs` (forward-direction default-deny route-coverage gate, run from repo root) exits 0.
- [ ] purchase moves Ousia via `nousRegistry.transferOusia(buyerDid → TREASURY_DID)` (the `ParcelRegistry.purchase()` call only validates affordability+caps and takes the buyer balance read from `nousRegistry.get(buyerDid).ousia` as an arg) then emits 82+83; build 84; join/leave 85/86. Owner DIDs only as `owner_civic_did_hash` (HEX64); structure plaintext names never cross the chain.
- [ ] Brain civic-land verbs exist as capabilities (not scripts), dispatch to the Grid routes, and a `my_places` prompt block surfaces ownership.
- [ ] `/worldmap/orbital` renders the live orbital Genesis Core map additively beside `/worldmap`; Earth below; NY clock only at the display boundary — `scripts/check-wallclock-forbidden.mjs` green.
- [ ] All CI gates green and unchanged: broadcast-allowlist (91), sole-producer, `check-civic-did-issuance-path.mjs`, privacy walker, `check-wallclock-forbidden.mjs`, zero-diff R-31-01.
- [ ] All Phase 58 Wave-0 skip-stubs are un-skipped (no remaining `describe.skip` in Phase 58 test files).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Orbital map renders the lit parcel + occupancy light | R-58-11 | Browser rendering required | 1. Start the dashboard dev server. 2. Navigate to `/worldmap/orbital`. 3. Verify Earth below, Government Core monument, 53 ghost frames. 4. After a Nous purchase, refresh — the owned parcel should be lit; with a visitor present, the occupancy light should be on. 5. Confirm `/worldmap` still shows the unchanged city view. |
| Boot log line | R-58-05 | Requires a live grid boot against a fresh DB | 1. Start the grid against an empty DB. 2. Confirm stdout contains `[civic] parcels loaded: 53`. 3. Restart — re-seed is idempotent (still 53, no duplicates). |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every Per-Task Verification Map row carries an automated command)
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 40s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
