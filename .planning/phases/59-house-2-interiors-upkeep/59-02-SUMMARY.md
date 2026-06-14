---
phase: 59
plan: 02
wave: 1
type: execute-summary
status: COMPLETE
requirements: [R-59-01, R-59-02, R-59-03, R-59-05]
---

# Phase 59 · Wave 1 — HOUSE-2 storage + data model (SUMMARY)

Laid the HOUSE-2 persistence + data-model foundation on top of Phase 58. Two TDD
tasks delivered; both target test stubs un-skipped and green; tsc clean; no
regressions; allowlist SOURCE untouched at 91 (the +4 is Wave 4).

## Delivered

### Task 1 — migration v39 + upkeep constants + furniture catalog
- **`grid/src/db/schema.ts`** — migration **v39** (`add_interior_upkeep_to_civic_parcels`),
  next free after shipped v38. `up` ALTERs `civic_parcels` ADD `structure_interior JSON NULL`,
  `condition ENUM('maintained','worn','derelict') NOT NULL DEFAULT 'maintained'`,
  `last_upkeep_tick INT UNSIGNED NULL`, `missed_periods TINYINT UNSIGNED NOT NULL DEFAULT 0`.
  `down` DROPs all four (reverse order). Matches the existing ALTER migration style; applies on top of v38.
- **`grid/src/civic/founding-law.ts`** — single upkeep patch point added:
  `UPKEEP_PERIOD_TICKS = 10080`, `UPKEEP_RATE_BPS = 200`,
  `RECLAIM_GRACE_PERIODS = { worn: 1, derelict: 2, reclaim: 3 } as const`,
  `upkeepDue(parcel) = Math.floor(parcel.priceBios * UPKEEP_RATE_BPS / 10000)`. No upkeep constant anywhere else.
- **`grid/src/civic/furniture.ts`** (NEW) — frozen closed v1 `FURNITURE_CATALOG`
  (6 mirror: bed/closet/shelf/kitchen/bathroom/decor with empty affordances;
  7 functional: work_desk[billing,accounting]/sim_board/meeting_table/game_table/task_board/skill_terminal/shop_counter).
  `isValidFurniture(kind, structureType)` is the SINGLE gate — unknown→false;
  mirror→true only when `structureType === 'home'`; functional→true anywhere.

### Task 2 — interior tree type + extendInterior + ParcelStore writers/hydrate
- **`grid/src/civic/types.ts`** — surgical additions: `Interior`/`InteriorArea`/`InteriorObject`
  types; `Structure.interior?: Interior`; `Parcel.condition: ParcelCondition` (default maintained),
  `Parcel.lastUpkeepTick?: number`, `Parcel.missedPeriods: number` (default 0). Existing fields intact.
- **`grid/src/civic/parcel-registry.ts`** — `extendInterior(address, ownerDid, {area, kind})`:
  owner-only (throws `not_owner`), validates via `isValidFurniture` (throws `invalid_furniture`),
  find-or-create area + append `{kind, class}` from the catalog, returns the mutated Structure.
  Lazily provisions a parcel+structure (zone inferred from address) so it works on a fresh
  registry instance. `clone`/`cloneStructure` deep-copy the interior tree. The tree lives ONLY in
  registry/DB state — never handed to an append-* producer.
- **`grid/src/civic/parcel-store.ts`** — `persistInterior` (DB-first UPDATE structure_interior JSON),
  `persistCondition`, `persistUpkeep`, `persistReclaim` (Wave 4); `ParcelRow` + `rowToParcel`
  extended to read the 4 new columns; `hydrate()` now loads interior/condition/last_upkeep_tick/
  missed_periods on boot. Mirrors the Phase 58 DB-first write-through pattern.
- **`grid/src/audit/append-zoning-interior-extended.ts`** (NEW, source only) — sole-producer for
  `zoning.interior_extended` (closed 4-tuple `{object_class, object_kind, parcel_id, tick}`,
  actorDid = parcel_id, full triad). Created in Wave 1 because the interior-tree contract test
  verifies the interior-never-broadcast boundary against it. Its allowlist MEMBER + TEST stub are
  Wave 4 (the test stub remains `describe.skip`).

## Verification

- `npm run test -- civic/furniture-catalog civic/interior-tree` → **20 passed** (13 + 7).
- `npx tsc --noEmit` → **clean, exit 0, no new errors**.
- Phase 58 civic suites (parcel-store/registry/seed/append-zoning-producers) → **63 passed, no regressions**.
- `node scripts/check-sole-producer-discipline.mjs` → **OK (75 files, full triad)**.
- Allowlist SOURCE: `ALLOWLIST_MEMBERS.length === 91` (unchanged); none of the 4 new event names
  present in `broadcast-allowlist.ts`. The +4 → 95 is Wave 4.

## Invariants honored
- Interior tree never serialized into any audit payload (D-NH-02 / D-59-08).
- No new `clock.onTick` subscription (single-onTick).
- Allowlist source frozen at 91; `broadcast-allowlist.test.ts` + `human-civic-application.test.ts`
  remain EXPECTED-RED at 95 (untouched).
- Other Wave-0 stubs (upkeep-scanner, condition-ladder, parcels-wiring, civic-interior-routes,
  the 3 remaining append test stubs + the interior-extended test stub, house-2-e2e) remain `describe.skip`.

## EXPECTED-RED (left untouched, by design)
- `test/audit/human-civic-application.test.ts` (carries the allowlist-size assertion) expects 95 → red at 91.
- `test/audit/broadcast-allowlist.test.ts` expects 95 → red at 91.
