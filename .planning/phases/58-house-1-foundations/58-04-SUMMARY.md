---
phase: 58
plan: 04
type: summary
wave: 3
status: complete
requirements: [R-58-06, R-58-07, R-58-08, R-58-09, R-58-12]
---

# Phase 58 · Wave 3 — civic-parcels HTTP routes (SUMMARY)

## What shipped

Exposed the Wave 1–2 ParcelRegistry/ParcelStore over HTTP for the Genesis Core.

### New: `grid/src/api/routes/civic-parcels.ts` — `registerCivicParcelRoutes(app, services)`
7 endpoints:
- `GET /api/v1/civic/parcels` — public map feed. Per-parcel: `id, zone, ring, sector,
  level, status, price_bios, structure {type, visibility}` (NO plaintext name),
  `occupant_count`, and `owner_civic_did_hash` (HEX64 sha256, `null` when unclaimed —
  never a raw owner DID).
- `GET /api/v1/civic/parcels/:id` — public detail (same projection).
- `POST :id/purchase` — funds path EXACTLY per D-58-06: read `buyer.ousia` from
  **nousRegistry** (`services.registry`; 404 `buyer_not_found` if absent) →
  `parcelRegistry.purchase(addr, buyerDid, buyer.ousia)` validates affordability+caps
  ONLY (`insufficient_funds` → 402) → `nousRegistry.transferOusia(buyerDid, TREASURY_DID,
  price)` MOVES funds (belt-and-suspenders 402) → `store.persistPurchase` →
  `parcelRegistry.stampAcquired(addr, currentTick)` → `appendZoningParcelPurchased(82)` +
  `appendTreasuryParcelRevenue(83)`. → 201.
- `POST :id/build` → `parcelRegistry.build` → `store.persistBuild` →
  `appendZoningStructureBuilt(84)` (name_hash + owner_civic_did_hash both HEX64). → 201.
- `POST :id/join` → `parcelRegistry.join` → `appendZoningStructureJoined(85)` (200);
  `POST :id/leave` → `parcelRegistry.leave` → `appendZoningStructureLeft(86)` (200).
  Occupants memory-only — no store write.
- `POST :id/entry-policy` → `parcelRegistry.setEntryPolicy` → `store.persistEntryPolicy` (200).

Guard: 503 `civic_parcels_unavailable` / `civic_registry_unavailable` when
`services.parcels` or `services.registry` is missing.

### LOAD-BEARING: two distinct registries, never conflated
- `parcelRegistry = services.parcels.registry` — land state only (`purchase` validates,
  does NOT move funds; `stampAcquired/build/join/leave/setEntryPolicy`). NO `transferOusia`.
- `nousRegistry = services.registry` — funds (`get(did)?.ousia` read,
  `transferOusia(from, TREASURY_DID, amount)` move). `TREASURY_DID` reused from `routes/registry.ts`.

### D-NH-07 enforcement (`requireCivicWriter` helper)
- Tier gate: anon / `human_visitor` / `government` → 401 (route enforces `civic_member`
  tier itself, mirroring `civic-message.ts`, so it holds even without the global policy hook).
- Defensive: a resolved `did:civic:noesis:human:*` DID → 403 `humans_cannot_own_land`.
- Operators read-only — no write path reaches them.

### Owner hashing / privacy (D-58-08)
Owner DIDs appear ONLY as `owner_civic_did_hash` (HEX64) — on the feed AND in every
zoning.*/treasury.* payload, via `sha256Hex` (the same HEX64 owner-hash discipline the
append-zoning-* producers expect; they validate HEX64 on input). Structure plaintext
names never enter any payload (`name_hash` only on event 84).

### Wiring
- `grid/src/api/policy.ts` — `ROUTE_DID_POLICY`: 2 GETs `public`, 5 POSTs `civic_did_required`.
- `grid/src/api/server.ts` — `registerCivicParcelRoutes(app, services)` guarded on `services.parcels`.

### Tests
- `grid/test/api/civic-parcels-routes.test.ts` — un-skipped; full auth matrix
  (anon 401, human_visitor 401, government 401, `did:civic:noesis:human:*` 403
  `humans_cannot_own_land`, Nous `civic_member` 201), 402 `insufficient_funds`, funds
  move (buyer −400 / treasury +400) + events 82/83, build 84 + join/leave 85/86,
  entry-policy toggle, `owner_civic_did_hash` HEX64 + no raw `did:civic:` owner string,
  structure name absent from chain. (11 tests green.)
- `grid/test/civic/parcels-wiring.test.ts` — the 2 Wave-2-gated GET smoke tests
  un-gated and green against the live route.

## Invariants held
- **No new broadcast event** — events 82–86 reused; no new append-* file created.
  `broadcast-allowlist.test.ts` byte-for-byte UNCHANGED (91 / +0).
- Route-coverage gate `node scripts/check-did-policy-coverage.mjs` exits 0.
- Wallclock: ticks only (`currentTick(services)`); no `Date`. No new `clock.onTick`.

## Self-check
- `node scripts/check-did-policy-coverage.mjs` → **OK, 66 inline routes covered, 0 violations, exit 0**.
- `cd grid && npm run test -- api/civic-parcels-routes civic/parcels-wiring audit/broadcast-allowlist` → **121 passed (3 files)**.
- `cd grid && npm run test -- civic api audit/broadcast-allowlist` → **649 passed | 27 skipped (pre-existing DB-gated), 0 failed**.
- `npx tsc --noEmit` → **exit 0, no new errors**.
- `git diff --stat grid/test/audit/broadcast-allowlist.test.ts` → **empty (unchanged)**.
- New files: only `grid/src/api/routes/civic-parcels.ts` — **no new append-* file**.
