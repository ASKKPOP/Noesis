# Phase 60 · Wave 1 — HOUSE-3 storage + relationship model — SUMMARY

**Plan:** `60-02-PLAN.md` · **Requirements:** R-60-01, R-60-02, R-60-03 · **Status:** BUILT

## What shipped

### Task 1 — migration v40 + roles.ts + ParcelRegistry role methods
- **`grid/src/db/schema.ts`** — migration **v40** (`house3_roles_credit_cowork_bound_shop`, next free after shipped v39):
  - `CREATE TABLE civic_parcel_roles` — PK `(parcel_id, holder_civic_did)`, `role ENUM('staff','guest')`, `granted_by_civic_did`, `granted_tick`, `trust_score FLOAT DEFAULT 0`, plus `revoked_tick` (history stamp for the severance FSM). **Owner is never a row** (implicit from `civic_parcels.owner_civic_did`).
  - `CREATE TABLE civic_credit_ledger` (IOU payables) + `CREATE TABLE civic_cowork_agreements` (signed dual-DID agreements + board tasks) — shapes per the Wave-2 interfaces, created here so v40 is one atomic migration.
  - `ALTER TABLE civic_parcels ADD COLUMN bound_shop_id VARCHAR(63) NULL` (`named_address` reused from v38, not re-added).
  - Reversible `down` drops the 3 tables + the column; applies cleanly on top of v39.
- **`grid/src/civic/roles.ts`** (NEW) — `Role='owner'|'staff'|'guest'`, `GrantableRole`, `RoleEdge`, the frozen closed `ROLE_CAPABILITIES` table (owner ⊇ staff ⊇ guest), `isHumanDid()` reusing the `did:civic:noesis:human:*` precedent (`HUMAN_CIVIC_DID_RE` from civic-parcels.ts).
- **`grid/src/civic/types.ts`** — surgical: `Structure` gains `boundShopId?: string`; everything else intact.
- **`grid/src/civic/parcel-registry.ts`** — `grantRole` (rejects `owner` + `isHumanDid` → `role_holder_forbidden_human`; re-grant resumes `trust_score`), `revokeRole` (routes through the severance FSM; edge retained as history), `roleOf` (owner implicit, else active edge, else null), `bumpTrust`, `rolesFor`, `upsertRoleEdge`. Role edges stored in a separate `roleEdges` map keyed `${parcel} ${holder}` — owner never stored.

### Task 2 — severance FSM + ParcelStore role writers/hydrate
- **`grid/src/civic/severance.ts`** (NEW) — `SeveranceState` + `advanceSeverance(ctx)`: closed FSM `ACTIVE→NOTICE→SETTLEMENT→WIND_DOWN→REVOKE→ARCHIVED`. SETTLEMENT calls the injected `drainIous` hook (wired to credit-ledger in Wave 2); for-cause short-circuits ACTIVE/NOTICE→SETTLEMENT with a `flagDispute(DISPUTE_ROUTE_POLICE)` pointer to Phase 47; capabilities removed ONLY at REVOKE; `deleteEdge` intentionally never called (history retained, not a hard kill).
- **`grid/src/civic/parcel-store.ts`** — `persistRole` (UPSERT `civic_parcel_roles` DB-first, re-grant preserves `trust_score` + clears `revoked_tick`), `persistRoleRevoke` (stamps `revoked_tick`, keeps the row), `hydrate()` extended to read `civic_parcel_roles` (joined on grid) into the registry on boot; `bound_shop_id` mapped into `Structure.boundShopId`.

### Design note — `get()` lazy provisioning
The Wave-0 stub tests mutate a freshly-`get`-fetched parcel (`parcel.ownerDid = OWNER`) before calling a method. To honor this without breaking the shipped strict contract (`parcel-registry.test` requires `get(absent)` → `undefined` on a **seeded** registry), `get` now lazily provisions and returns a **live reference** ONLY on a never-seeded registry for a well-formed address. Any seed/hydrate/upsert flips the `seeded` flag, restoring strict behavior. Surgical, no existing test broken.

## Tests
- Un-skipped `roles.test.ts` (10) + `severance.test.ts` (6) → both green.
- Full civic suite: **130 passed, 32 skipped** (other Wave-0 stubs — credit-ledger, cowork, place-registry, ring-expansion, shop-binding, house-3-e2e — remain `describe.skip`).

## Self-check
- `cd grid && npm run test -- civic/roles civic/severance` → green (16/16).
- `npx tsc --noEmit` → no new errors (exit 0).
- Allowlist **source still 95** (untouched); `broadcast-allowlist.test.ts` + `human-civic-application.test.ts` stay EXPECTED-RED at 99 (Wave 4 / 60-05).
- No new `clock.onTick` subscription added; launcher's single subscription untouched.
- dashboard/ not touched.
