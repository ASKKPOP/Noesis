# Phase 58 · Wave 2 (58-03) — Summary

**Genesis Core seeding + GridServices wiring.** Built on Wave 1 (founding-law.ts, parcel-store.ts, migration v38 — already green).

## Delivered

### Task 1 — Genesis Core seeding (exactly 53, idempotent, zero audit)
- `grid/src/civic/parcel-store.ts` — `seedGenesisCore(registry)` was already complete from Wave 1 (INSERT IGNORE per `GENESIS_CORE_SEED_PLAN`, mirrors into registry, returns inserted count). No source change required; verified by un-skipped tests.
- `grid/test/civic/parcel-seed.test.ts` — rewritten + un-skipped. The Wave-0 stub referenced a non-existent API (`p.zone`, `p.prebuilt`); replaced with the real `SeedPlanEntry` shape (`zoneId`, `prebuiltStructure`) plus mock-Pool behavioral tests. 13 tests:
  - count 53; distribution 1 + 4 + 24 + 24; ring 0 gov×1, ring 1 infra×4, ring 2 business/shopping/manufacture 8+8+8, ring 3 residential×24; ring 4+ absent.
  - gravityPrice(2)=900, gravityPrice(3)=400 on materialized parcels; civic rings 0–1 price 0; 5 commons = ring-1 ×4 `venue`/`open`.
  - `seedGenesisCore` inserts exactly 53 rows on a mock Pool and mirrors 53 into the registry; **idempotent** (mock `affectedRows=0` → 0 inserted); **zero audit** (`vi.spyOn(AuditChain.prototype, 'append')` never called).

### Task 2 — GridServices wiring + boot log
- `grid/src/api/server.ts` — added optional `parcels?: { registry: ParcelRegistry; store: ParcelStore }` to the `GridServices` interface, mirroring the `civicDidStore?:` import('...') style (surgical).
- `grid/src/main.ts` — inside the `if (dbConn)` block: construct `ParcelRegistry` + `ParcelStore` (gridName from `config.genesisConfig.gridName`), `await seedGenesisCore()` then `await hydrate()`, emit `[civic] parcels loaded: ${parcelCount}`, hoist `parcels` and attach `...(parcels ? { parcels } : {})` to the `buildServer` call (mirrors the `civicDidStore` hoist/attach precedent). Enclosing `createGridApp` is already `async`.
- `grid/test/civic/parcels-wiring.test.ts` — un-skipped ONLY the `GridServices.parcels` accessor assertion (asserts `{ registry, store }` are `instanceof` the right classes via a mock Pool). The `GET /api/v1/civic/parcels` 200 suite stays `describe.skip` (depends on the Wave-3 route 58-04 which does not exist yet).

## Invariants held
- **Allowlist +0:** `broadcast-allowlist.test.ts` byte-for-byte unchanged at 91; seeding emits no events.
- **No new clock.onTick:** seeding is a one-time boot call.
- **No occupants persistence.** Mock Pool only (no live MySQL), marketplace-store pattern.
- **Wave-3 gating preserved:** `civic-parcels-routes.test.ts` fully skipped; the GET smoke assertion stays skipped.

## Self-check / verification
- `npm run test -- civic/parcel-seed civic/parcels-wiring` → 14 passed | 2 skipped (parcel-seed 13/13; parcels-wiring 1 pass + 2 skipped GET).
- `npm run test -- civic audit/broadcast-allowlist` → 272 passed | 41 skipped, exit 0 (civic-parcels-routes 12 skipped).
- `npx tsc --noEmit` → exit 0 (no new errors).
- `git diff --stat grid/test/audit/broadcast-allowlist.test.ts` → empty (unchanged).

## Next (Wave 3 / 58-04)
Civic-parcels HTTP routes (list/detail/purchase/build/join/leave/entry-policy); un-skip the GET smoke check in `parcels-wiring.test.ts` and `civic-parcels-routes.test.ts`.
