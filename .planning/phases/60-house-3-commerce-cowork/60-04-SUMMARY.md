---
phase: 60
plan: 04
wave: 3
type: execute-summary
status: GREEN
requirements: [R-60-05, R-60-06, R-60-09]
---

# Phase 60 · Wave 3 — Shop⇄structure binding · structure-revenue skim · place:// NDS

## What shipped

### Shop⇄structure binding (D-60-03 / R-60-05) — closes the Phase 4 land gap
- `grid/src/economy/types.ts` — added `parcel_id?: string` to `Shop` and `ShopListing` (surgical).
- `grid/src/economy/shop-registry.ts` — `bindShop(shopId, parcelId)` stamps `parcel_id` on the
  shop + every listing (replaces the frozen record with a new frozen one); `unbindShop(shopId)`
  clears it.
- `grid/src/civic/parcel-registry.ts` — `bindShop(address, shopId, ownerDid)`: owner-only
  (`not_owner`), structure must be type `shop` (`not_a_shop`), sets `structure.boundShopId` +
  calls the (optionally wired) `ShopRegistry.bindShop`. `unbindShop(address, ownerDid, tick)`
  routes through the **severance FSM** (ACTIVE→…→ARCHIVED) — never a hard kill; `boundShopId` +
  the ShopRegistry stamp are cleared only at REVOKE. New `attachShopRegistry()` wires the real
  shop registry at bootstrap; unit fixtures construct a bare registry (shop registry undefined).

### Structure revenue / zone tax (D-60-04 / D-V3-34 / R-60-06) — single patch point
- `grid/src/civic/founding-law.ts` — `ZONE_TAX_BPS = {business:1200, shopping:1000,
  manufacture:900, residential:500} as const` + `structureRevenueDue(parcel, saleAmountBios) =
  floor(saleAmountBios * ZONE_TAX_BPS[zoneId] / 10000)` (untaxed civic zones → 0). Lives ONLY
  here (Polis-amendable single patch point).
- `grid/src/api/routes/market.ts` — in the Phase 44 `confirm-settlement` path, **AFTER** the
  existing trade settlement: if the seller's shop is parcel-bound, compute `structureRevenueDue`
  and skim it to `TREASURY_DID` via `services.registry.transferOusia` (streaming, never filed).
  Fully guarded (no-op when services unwired or shop unbound) → existing settlement behavior
  UNCHANGED. A clearly-marked **WAVE-4 EMIT POINT** documents the closed tuple
  `{amount_bios, parcel_id, tick, zone_tax_bps}` for `treasury.structure_revenue` — NOT emitted
  yet (producer + allowlist bump land in Wave 4).

### place:// NDS registry (D-60-07 / R-60-09) — NEW Grid-side, tick-based
- `grid/src/civic/place-registry.ts` (NEW) — `registerPlace(name, parcel_id, tick)` returns
  `place://<name>.genesis`; uniqueness across the registry (duplicate name on a DIFFERENT parcel
  → `throw place_name_taken` → route 409; same parcel/name is idempotent). Keyed on the integer
  `registered_tick` ONLY — **no `Date.now()`, no protocol `nous://` `registeredAt`**. Exposes
  `name_hash` (SHA-256); raw names stay Grid-side (no `*_name` payload key). `placeRecord()` +
  `upsertPlace()` round out reads/hydrate. The protocol DomainRegistry is untouched.
- `grid/src/civic/parcel-registry.ts` — `namePlace(address, ownerDid, placeName, tick)`:
  owner-only (`not_owner`), delegates to `registerPlace`, sets the dormant `structure.namedAddress`.

### Persistence (DB-first)
- `grid/src/civic/parcel-store.ts` — `persistBoundShop(parcelId, shopId|null)` (v40
  `bound_shop_id`) + `persistNamedAddress(parcelId, namedAddress)` (dormant Phase 58
  `named_address`). `hydrate()` already reads both columns via `rowToParcel` (verified).

### Tests un-skipped + green
- `grid/test/civic/shop-binding.test.ts` — 7 tests (bind owner-only + structure-type-shop;
  stamps parcel_id; all-4-zone tax math; unbind via severance → ARCHIVED).
- `grid/test/civic/place-registry.test.ts` — 4 tests (addressing, `place_name_taken`,
  tick-keyed-not-Date.now, integer `registered_tick`).

## Self-check

```
$ cd grid && npm run test -- civic/shop-binding civic/place-registry
 ✓ test/civic/place-registry.test.ts (4 tests)
 ✓ test/civic/shop-binding.test.ts (7 tests)
 Test Files  2 passed (2)   Tests  11 passed (11)

$ node scripts/check-wallclock-forbidden.mjs   →  exit 0 ("✅ No wall-clock reads …")

$ cd grid && npx tsc --noEmit                  →  no errors (no NEW errors)

$ cd grid && npm run test -- market
 Test Files  6 passed (6)   Tests  84 passed (84)   (market trade behavior UNCHANGED)
```

## Invariants honored
- **Existing market trade settlement behavior UNCHANGED** — the skim is additive after it, fully
  guarded; the 84-test market suite is green.
- **`treasury.structure_revenue` NOT emitted yet** — funds-move + a marked Wave-4 emit point only.
- **Allowlist source stays 95** — `broadcast-allowlist.ts` untouched (not in the diff). The
  `human-civic-application.test.ts` / `broadcast-allowlist.test.ts` count suites remain
  expected-RED at 99 (un-modified by this wave; producers + bump land Wave 4).
- **No new `clock.onTick`** — the skim, unbind FSM, and place registration are all request-driven.
- **Wallclock gate green** — place registry is tick-based (`registered_tick`), no `Date.now()`,
  no reuse of the protocol `nous://` `registeredAt`.
- Other Wave-0 stubs (ring-expansion, civic-commerce-routes, cowork, roles, severance,
  credit-ledger, the append-* producers, house-3-e2e) remain `describe.skip`. Dashboard untouched.
```
