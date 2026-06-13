---
phase: 58
plan: 02
type: execute
wave: 1
status: complete
requirements: [R-58-01, R-58-03, R-58-04]
---

# Phase 58 · Wave 1 — HOUSE-1 Foundations (persistence/pricing layer)

## What shipped

Woke the dormant Phase 48b `ParcelRegistry` into a persisted, gravity-priced property
layer for the Genesis Core. Registry was **extended surgically, never rewritten**.

### Task 1 — founding-law constants + vector-address types
- **`grid/src/civic/founding-law.ts`** (new) — single patch point:
  - `gravityPrice(ring) = 100 * (5 - ring) ** 2` → ring 3 = 400, ring 2 = 900.
  - `PURCHASABLE_RINGS = [2, 3]` (rings 0–1 are civic land, not for sale).
  - `GENESIS_CORE_SEED_PLAN` — ring 0 government_quarter ×1; ring 1 infrastructure ×4
    (pre-built open `venue`); ring 2 business ×8 + shopping ×8 + manufacture ×8;
    ring 3 residential ×24 = **53 parcels (48 purchasable + 5 civic)**.
- **`grid/src/civic/types.ts`** — `Parcel` gains `ring: number; sector: number; level: number`
  (D-NH-10; sector in degrees, level defaults 0). All existing fields/exports/`Structure` intact.

### Task 2 — migration v38 + write-through ParcelStore
- **`grid/src/db/schema.ts`** — migration **v38** `create_civic_parcels` (next free after
  shipped v37). Columns: `parcel_id` PK, `grid_name`, `zone_id`, `ring TINYINT`,
  `sector_deg DECIMAL(6,2)`, `level SMALLINT DEFAULT 0`, `owner_civic_did` NULL,
  `price_bios`, `acquired_at_tick` NULL, `structure_name` NULL,
  `structure_type ENUM(home|shop|workshop|venue)` NULL, `visibility ENUM(open|private)` NULL,
  `built_at_tick` NULL, `named_address` NULL, `entry_policy ENUM(open|allowlist) DEFAULT open`,
  `entry_allowlist JSON` NULL; indices `idx_parcel_owner`, `idx_parcel_zone`.
  Working `down` drops the table. No occupants column (presence is memory-only, R-H-09).
- **`grid/src/civic/parcel-store.ts`** (new) — write-through store:
  - `seedGenesisCore(registry)` — `INSERT IGNORE` per the seed plan (idempotent),
    prices purchasable parcels via `gravityPrice(ring)`, mirrors into the registry,
    returns rows inserted.
  - `hydrate(registry)` — `SELECT * ... WHERE grid_name = ?` → upserts every row into
    the registry on boot; returns row count. Occupants never rehydrated.
  - `persistPurchase` / `persistBuild` / `persistEntryPolicy` — `UPDATE` DB-first.
  - exported pure helper `buildGenesisCoreParcels(gridName)` materializes the plan.
- **`grid/src/civic/parcel-registry.ts`** — surgical hooks only: `SeedZoneInput` gains
  `ring`/`level`; `seedZone` stamps `ring`/`sector`/`level`; new `upsert(parcel)` lets the
  store mirror authoritative DB rows into the read cache. State-transition logic untouched.

## Tests
- Un-skipped + green: `grid/test/civic/founding-law.test.ts` (7), `grid/test/civic/parcel-store.test.ts` (12).
- `parcel-store.test.ts` uses a **mock Pool** (vi.fn(), per `marketplace-store.test.ts`) — asserts
  query behavior (INSERT IGNORE idempotency via affectedRows, UPDATE DB-first, SELECT hydrate),
  not real MySQL. Still-skipped (later waves): `parcel-seed`, `civic-parcels-routes`, `parcels-wiring`.

## Invariants held
- **Allowlist +0:** `broadcast-allowlist.test.ts` byte-for-byte unchanged, still asserts 91.
- **Single-onTick:** no new `clock.onTick` subscription.
- **Wallclock gate:** no `Date`/wallclock in store/audit paths (ticks only).
- **Write-through:** DB source of truth, registry is a read cache hydrated on boot.
- **Occupants memory-only:** no column, no write, no rehydrate.

## Verification
- `npm run test -- civic/founding-law civic/parcel-store` → 19 passed.
- `npm run test -- civic audit/broadcast-allowlist` → 258 passed | 51 skipped, exit 0.
- `npx tsc --noEmit` → exit 0 (no new type errors).
- `git diff --stat grid/test/audit/broadcast-allowlist.test.ts` → empty (unchanged).
