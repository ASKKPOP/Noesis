# Phase 60 · Wave 4 (plan 60-05) — Summary

**Status:** BUILT — all acceptance criteria green.
**Scope:** 4 sole-producer audit events (allowlist 95→99) + the commerce/role/cowork/place/invite routes that emit them + ROUTE_DID_POLICY coverage.

## Delivered

### Task 1 — 4 sole-producer triads + allowlist 95→99
Each clones the `append-treasury-parcel-revenue.ts` (#83) triad exactly: per-field validation → `Object.keys(payload).sort()` closed-tuple check (foreign key THROWS) → explicit no-spread reconstruction → `payloadPrivacyCheck` gate → single `audit.append`. Closed tuples ALPHABETICAL.

- `grid/src/audit/append-zoning-role-granted.ts` (96) — `{grantor_civic_did_hash, holder_civic_did_hash, parcel_id, role, tick}`; both DIDs HEX64; `role ∈ {staff, guest}` (owner rejected — implicit, never granted); `actorDid = grantor_civic_did_hash`.
- `grid/src/audit/append-zoning-role-revoked.ts` (97) — `{holder_civic_did_hash, parcel_id, reason, tick}`; `reason ∈ {owner_revoked, for_cause, severance_complete}`; `actorDid = parcel_id`.
- `grid/src/audit/append-treasury-structure-revenue.ts` (98) — `{amount_bios, parcel_id, tick, zone_tax_bps}`; positive ints; `actorDid = parcel_id` (mirrors #83 — NO buyer/seller DID on chain).
- `grid/src/audit/append-zoning-cowork-session.ts` (99) — `{end_tick, parcel_id, participant_count, participants_hash, start_tick}`; `participants_hash` HEX64 (single hash over the sorted DID set); `actorDid = parcel_id`.

`grid/src/audit/broadcast-allowlist.ts` — appended the 4 members under the pre-cleared `zoning.*`/`treasury.*` prefixes with sole-producer reference comments. Events 82–95 untouched and unreordered.

Un-skipped the 4 `append-*.test.ts` suites; `broadcast-allowlist.test.ts` (already authored at 99) and `human-civic-application.test.ts` pass at 99.

### Task 2 — routes + ROUTE_DID_POLICY coverage
`grid/src/api/routes/civic-parcels.ts` — new routes, each emitting via the Wave-4 producers (or none for name, which is name_hash-only):
- `POST .../bind-shop` / `.../unbind-shop` — owner-only; non-owner → 403 `not_owner`; non-shop → 422 `structure_not_shop`; unbind routes through `parcelRegistry.unbindShop` (severance FSM → `ARCHIVED`).
- `POST .../name {place_name}` — owner-only; duplicate → 409 `place_name_taken`; NO chain event (place names stay Grid-side).
- `POST .../invite {invitee_civic_did}` — owner/staff; appends to the Phase 58 entry allowlist via `setEntryPolicy` AND mints a guest edge via `grantRole(..., 'guest', ...)` → emits `zoning.role_granted`; `did:civic:noesis:human:*` invitee → 403.
- `POST .../roles {holder_civic_did, role}` (owner-only, staff|guest) → `zoning.role_granted`; `POST .../roles/revoke` → `revokeRole` (severance) → `zoning.role_revoked`; human holder → 403.
- `POST .../board/post|claim|complete` — owner/staff post; any role claims; host completes; completion ALWAYS settles (Ousia or IOU via `completeTask`) and emits `zoning.cowork_session` (participants_hash only — no board/scope/DID content).

`grid/src/api/routes/market.ts` — filled the Wave-3 structure-revenue emit point: the parcel-bound-shop skim now calls `appendTreasuryStructureRevenue` (was a `void ZONE_TAX_BPS` placeholder).

`grid/src/api/policy.ts` — added a `civic_did_required` `ROUTE_DID_POLICY` entry for every new route (9 entries).

`grid/src/civic/place-registry.ts` — added a `_resetPlace()` test-isolation helper (mirrors `_resetCowork`/`_resetLedger`).

`grid/test/api/civic-commerce-routes.test.ts` — rewritten from the Wave-0 stub to wire a real `ParcelRegistry` + `AuditChain` + `NousRegistry` + mock store (mirrors `civic-interior-routes.test.ts`); 26 tests green.

## Self-check / verification

- `cd grid && npm run test -- audit api/civic-commerce-routes` → **72 files / 782 tests passed** (broadcast-allowlist GREEN at 99 with the 4 presence assertions).
- `node scripts/check-sole-producer-discipline.mjs` → OK (82 sole-producer files, full triad) — **exit 0**.
- `node scripts/check-did-policy-coverage.mjs` → OK (67 inline routes covered, 178 entries, 0 violations) — **exit 0**.
- `node scripts/check-wallclock-forbidden.mjs` → OK — exit 0.
- `npx tsc --noEmit` → **no errors** (no NEW errors).
- Full `npm run test` → 347 files / 3268 passed, 0 failed on a clean run. (`test/skills/skill-producer-boundary.test.ts` showed a one-off parallel-isolation flake in one run; it is a disk-scanning test, passes in isolation and on re-run, and contains/touches no `skill.*` references in any Wave-4 file — confirmed unrelated.)

## Invariants confirmed

- **Events 82–95 unchanged / unreordered** (delta = exactly +4 → 99).
- **One producer per event** (sole-producer-discipline exit 0).
- **No raw board/scope/name/DID content in any producer** — only enums/counts/hashes; all DIDs HEX64 (or aggregated `participants_hash`); no `FORBIDDEN_KEY_PATTERN` key.
- **Humans rejected from role edges** — invite/roles/roles-revoke all 403 a `did:civic:noesis:human:*` DID.
- **No new `clock.onTick`** — all settlement/mutation request-driven (touched files add none).
- **dashboard/ untouched.**
