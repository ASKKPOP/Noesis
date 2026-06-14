# Phase 59 · Wave 2 — Interior HTTP Routes (59-03) — SUMMARY

**Status:** BUILT — green. R-59-04, R-59-09.

## What shipped

### `grid/src/api/routes/civic-parcels.ts` (extended)
- **`POST /api/v1/civic/parcels/:id/interior/extend`** (`civic_did_required`): reuses the Phase 58 `requireCivicWriter` (401 anon/human-visitor, 403 `humans_cannot_own_land`, 503 missing-registry). Then owner-only → else **403 `not_owner`**; `isValidFurniture(kind, structure.type)` false (or non-string kind) → **422 `invalid_furniture`** (single catalog gate reused, not re-implemented); `parcelRegistry.extendInterior` mutates the Grid-side tree → `store.persistInterior(...)` DB-first; **200** with the owner-visible structure summary (full tree — owner may see it).
- **`GET /api/v1/civic/parcels/:id/interior`** (entry-policy-gated): owner always (full tree, even derelict); a **human cookie session on a non-open interior → 403** (D-NH-07 — humans never see private); `condition === 'derelict'` → **403 `closed_to_visitors`** for all non-owners; otherwise visitor allowed only if structure open OR (Nous) allowlisted; else 403 `closed_to_visitors`.
- **Public feed (`GET parcels`)** now serializes `condition` in `publicView` — exterior + condition only. The interior tree is NEVER serialized (asserted).
- **EMIT SEAM:** exported typed helper `INTERIOR_EXTEND_EMIT_SEAM(input)` materializes the EXACT closed 4-tuple `{object_class, object_kind, parcel_id, tick}` from catalog enums (`FURNITURE_CATALOG[kind].class/.kind`) — never interior names/state. The extend route builds the payload at a `// TODO(Wave 4): replace with appendZoningInteriorExtended(...)` call site and does **NOT** emit (allowlist member lands Wave 4; emitting now would throw).

### `grid/src/api/policy.ts` (ROUTE_DID_POLICY)
- `POST .../interior/extend` → `civic_did_required`
- `GET .../interior` → `public` (consistent with the Phase 58 detail-read GET feeds; the handler does its own entry-policy + derelict + D-NH-07 gating).

### `grid/test/api/civic-interior-routes.test.ts` (un-skipped, rewritten to the Phase 58 real-registry pattern)
10 tests: non-owner 403 `not_owner`; bad kind 422 `invalid_furniture`; owner+valid mirror-in-home 200 (tree mutated + `persistInterior` mirrored); SEAM carries only the 4-tuple (no `bedroom` leak); owner always; visitor open-non-derelict 200; visitor derelict 403 `closed_to_visitors`; owner-views-own-derelict 200; human private refused; feed exposes `condition` but has NO `interior`/`areas`/`bedroom` key.

## Self-check
- `node scripts/check-did-policy-coverage.mjs` → **exit 0** (67 inline routes covered, 169 entries, 0 violations).
- `cd grid && npm run test -- api/civic-interior-routes` → **10 passed / 10**.
- `cd grid && npx tsc --noEmit` → **exit 0** (no new errors).
- Phase 58 `api/civic-parcels-routes` regression → **11 passed / 11** (condition field added cleanly).
- Public feed has **no interior tree** — only exterior + `condition` (asserted).
- `broadcast-allowlist.ts` SOURCE untouched at **91** (last numbered member `registry.civic_did_issued_human (91)`); `broadcast-allowlist.test.ts` + `human-civic-application.test.ts` remain EXPECTED-RED at 95 until Wave 4.
- Other Wave-0 stubs still `describe.skip`: upkeep-scanner, condition-ladder, the 4 append-* suites, house-2-e2e.

## Wave 4 handoff
Replace the route's `INTERIOR_EXTEND_EMIT_SEAM(...)` call site with `appendZoningInteriorExtended(services.audit, payload)` once the allowlist member + sole-producer land. The payload shape is frozen by the seam helper.
