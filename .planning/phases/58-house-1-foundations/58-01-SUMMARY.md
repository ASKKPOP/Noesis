---
phase: 58
plan: 01
type: summary
wave: 0
status: complete
---

# Phase 58 · Wave 0 — TDD skip-stub scaffold (HOUSE-1 Foundations)

Locks every HOUSE-1 contract in skip-stub test files **before** any implementation
lands, and re-confirms the broadcast-allowlist stays at **91 (delta +0)**. No
`grid/src` code was touched — Wave 0 ships test files only.

## 5 new skip-stub test files

| File | describe.skip blocks | Contract locked | R-58 coverage |
|------|----------------------|-----------------|---------------|
| `grid/test/civic/founding-law.test.ts` | gravity pricing; GENESIS_CORE_SEED_PLAN shape | `gravityPrice(3)===400`, `gravityPrice(2)===900`, `=== 100*(5-ring)**2`; rings 0–1 not in `PURCHASABLE_RINGS` (`[2,3]`); plan totals 53 | **R-58-03**, R-58-02 |
| `grid/test/civic/parcel-store.test.ts` | seed idempotency + write-through; gravity prices + caps + civic-land guard | INSERT-IGNORE idempotency, DB-first write-through, `hydrate()` on boot, occupants NOT persisted (R-H-09), ≤1 home / ≤1 business `cap_exceeded`, commons `zone_not_purchasable`, seeded prices 400/900 | **R-58-01**, R-58-02, R-58-03 |
| `grid/test/civic/parcel-seed.test.ts` | exactly 53 parcels; pre-built commons + no audit | distribution 1 (gov_quarter) + 4 (infrastructure) + 24 (business 8 / shopping 8 / manufacture 8) + 24 (residential) = 53; 5 civic parcels carry pre-built `venue`/`open` structures; seed emits NO audit events | **R-58-02** |
| `grid/test/api/civic-parcels-routes.test.ts` | D-NH-07 auth matrix; funds + failure codes; public feed privacy | anon→401, `human_visitor`→401, `did:civic:noesis:human:*`→403 `humans_cannot_own_land`, Nous→201; `insufficient_funds`→402; funds→TREASURY_DID then events 82/83 (build 84, join/leave 85/86); entry-policy toggle; `owner_civic_did_hash` HEX64, never raw `did:civic:` on the feed | **R-58-06, R-58-07, R-58-08, R-58-09** |
| `grid/test/civic/parcels-wiring.test.ts` | GridServices.parcels wiring; list smoke check | `services.parcels = { registry, store }` accessor + boot log `[civic] parcels loaded: N`; `GET /api/v1/civic/parcels` → 200 with `parcels` array (registry-not-wired bug class, R-H-01) | **R-58-05** |

All 5 use `describe.skip(...)`, so Vitest reports the new blocks **skipped, not
failed** — 42 stub tests across the 5 files (founding-law 7 · parcel-store 11 ·
parcel-seed 8 · civic-parcels-routes 12 · parcels-wiring 4).

## Wave-1+ symbol references

The stubs reference the real Wave-1 symbol names from the plan's `<interfaces>`:
`gravityPrice`, `PURCHASABLE_RINGS`, `GENESIS_CORE_SEED_PLAN`
(`grid/src/civic/founding-law.ts`); `ParcelStore` (`parcel-store.ts`);
`registerCivicParcelRoutes` (`grid/src/api/routes/civic-parcels.ts`); plus the live
`ParcelRegistry`. Each later wave deletes the `.skip` it satisfies.

### Deviation from the plan's stated assumption (load-deferral)

The plan asserts a *static* `import` of a not-yet-existing module is "acceptable
inside describe.skip because the bodies never execute." Under this repo's Vitest
config that is **false** — Vite resolves every static import at module-transform
time, before `.skip` is consulted, so the suite errored with `Failed to load url`.

Fix (no behavior change to the contracts): the missing-module symbols are loaded
via a **dynamic `import()` inside a `beforeAll` within the skipped suite**. The
`beforeAll` never runs under `.skip`, so the module is never resolved; the symbol
names still appear and the contracts are still expressed. Live modules that already
exist (`ParcelRegistry`) keep their normal static import. Wave 1/3 delete the
`.skip` and the dynamic imports resolve against the real files. This is the only
deviation; it is the minimal change that keeps the files green-skipped today.

## +0 allowlist confirmation

- `grid/test/audit/broadcast-allowlist.test.ts` is **byte-for-byte unchanged**:
  `git diff --stat grid/test/audit/broadcast-allowlist.test.ts` → empty.
- Still asserts `ALLOWLIST.size === 91` and `ALLOWLIST_MEMBERS.length === 91`.
- HOUSE-1 events **82–86** (`zoning.parcel_purchased`, `treasury.parcel_revenue`,
  `zoning.structure_built`, `zoning.structure_joined`, `zoning.structure_left`)
  are already present (Phase 48b) and are **reused as-is**. No event added,
  renamed, or reordered. **Delta = +0.**

## Verification

- `cd grid && npm run test -- civic audit/broadcast-allowlist` → **exit 0**;
  `12 passed | 9 skipped` files, `239 passed | 69 skipped` tests; allowlist green
  at 91 (107 tests).
- `git diff --stat grid/test/audit/broadcast-allowlist.test.ts` → **no changes**.
- `git status --porcelain grid/src` → **no src changes**.
