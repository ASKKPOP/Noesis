# Phase 60 · Wave 7 (60-08) — HOUSE-3 E2E Definition-of-Done + all gates green

**Status:** ✅ DONE — closes Phase 60 (HOUSE-3 Commerce & Co-work).

## What landed

`grid/test/civic/house-3-e2e.test.ts` rewritten from the Wave-0 skip-stub into a real
end-to-end test against a seeded Genesis Core (mirrors `house-2-e2e.test.ts` wiring: real
`AuditChain`, `ParcelRegistry` seeded via `buildGenesisCoreParcels('genesis')`, `NousRegistry`
with treasury + Nous spawned with Ousia, `ShopRegistry` via `attachShopRegistry`, `ParcelStore`
over a mock mysql2 `Pool`, swappable per-request `didContext`).

End-to-end scenario proven:
1. **ROLE** — owner grants `staff` → `zoning.role_granted` (hashed 5-tuple); `roleOf === 'staff'`.
2. **COWORK** — **funded** path through real HTTP `board/post`→`claim`→`complete` (`transferOusia`
   host→worker, OWNER −50 / STAFF +50, `outstandingFor → 0`) **and** **unfunded/IOU** path through
   the same production module (`completeTask({funded:false, recordIou})`, never free,
   `outstandingFor(OWNER) === 40`). Both emit `zoning.cowork_session` (participants_hash only).
3. **SHOP/PLACE** — `bind-shop` + name `place://aurora-cafe.genesis` → sale →
   `treasury.structure_revenue {amount_bios:100, parcel_id, tick, zone_tax_bps:1000}` at zone tax.
4. **UNIQUENESS** — duplicate `aurora-cafe` → `409 place_name_taken`.
5. **RING** — `onLawEnacted({action:'seed_ring', ring:4})` seeds 24 ring-4 parcels, idempotent,
   no audit emit (the exact fire-and-forget hook `governance/engine.ts:82-83` runs).
6. **SEVERANCE** — revoke drains the IOU ledger (`outstandingFor → 0`) then the severance FSM to
   ARCHIVED → `zoning.role_revoked`.
7. **HUMAN** — a `did:civic:noesis:human:*` role grant → `403` (D-NH-07).
8. **PRIVACY** — walk over the **real run's** `audit.all()`: no raw `did:civic:`, no board/task/
   scope/place content, every hash value HEX64.

## Decisions / discrepancies recorded

- **`reason` enum on revoke:** the plan must_have text said `reason:'severance_complete'`, but the
  revoke route emits `'owner_revoked'` (`civic-parcels.ts:638`: `forCause ? 'for_cause' : 'owner_revoked'`).
  Per R6 (no-rewrite), the test asserts the **real** emitted value rather than weakening source.
  `'severance_complete'` remains a valid (currently un-emitted) enum member in
  `append-zoning-role-revoked.ts`. The IOU-drain + FSM-to-ARCHIVED behavior the plan cares about is
  fully asserted regardless.
- **structure_revenue / gov.law_enacted** are not driveable from a mock-pool e2e (they require a full
  `MarketplaceStore` and the proposal/ballot/tally engine respectively). The test composes the **exact
  production paths** those routes run (`getByOwner` → `structureRevenueDue` → `transferOusia` →
  `appendTreasuryStructureRevenue`; `ring-expansion.onLawEnacted`) — the same pattern house-2-e2e uses
  to drive `onUpkeepTick` directly. No source edited.

## Verification (independently re-run, not from agent report)

- Full grid suite: **349 files / 3277 tests passed** (34 pre-existing skips, none in HOUSE-3).
- `house-3-e2e` isolated: 1 passed; no active `describe.skip`.
- `audit/broadcast-allowlist`: 115 passed; `ALLOWLIST.size === 99`; all 4 HOUSE-3 events present.
- Gates: `check-sole-producer-discipline`, `check-wallclock-forbidden`, `check-civic-did-issuance-path`,
  `check-cross-house-injection` — all exit 0.
- Single-onTick: exactly 2 pre-existing `.onTick(` subscriptions; this wave added none.
- Zero-diff R-31-01: only `grid/test/civic/house-3-e2e.test.ts` changed in grid; no `grid/src`/chain edit.

## Allowlist

99 (HOUSE-2 95 +4 HOUSE-3: `zoning.role_granted`, `zoning.role_revoked`, `treasury.structure_revenue`,
`zoning.cowork_session`).

Commit: `d2068cd`.
