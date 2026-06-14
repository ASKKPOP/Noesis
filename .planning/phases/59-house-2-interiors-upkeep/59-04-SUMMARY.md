# Phase 59 · Wave 3 (plan 59-04) — Summary

**Wave:** 3 (audit-critical) · **Status:** COMPLETE · **Date:** 2026-06-14

## Objective
Land the four new sole-producer audit events and flip the broadcast allowlist 91 → 95 GREEN. Interior CONTENTS never broadcast.

## Delivered

### Four sole producers (full Phase-58 triad cloned)
- `grid/src/audit/append-zoning-interior-extended.ts` (#92) — closed 4-tuple `{object_class, object_kind, parcel_id, tick}`; `object_class ∈ {mirror,functional}`; actorDid = `parcel_id`. Existed from Wave 1; verified to be the full triad + JSDoc Wave reference corrected (allowlist member + route emit land Wave 3, not Wave 4).
- `grid/src/audit/append-zoning-condition-changed.ts` (#93) — NEW. Closed 4-tuple `{condition, owner_civic_did_hash, parcel_id, tick}`; `condition ∈ {maintained,worn,derelict}`; `owner_civic_did_hash` HEX64; actorDid = `owner_civic_did_hash`.
- `grid/src/audit/append-zoning-parcel-reclaimed.ts` (#94) — NEW. Closed 4-tuple `{former_owner_civic_did_hash, parcel_id, reason, tick}`; `former_owner_civic_did_hash` HEX64; `reason ∈ {upkeep_default}`; actorDid = `parcel_id` (land returns to treasury).
- `grid/src/audit/append-treasury-upkeep-collected.ts` (#95) — NEW. Closed 4-tuple `{amount_bios, owner_civic_did_hash, parcel_id, tick}`; `amount_bios` positive int; `owner_civic_did_hash` HEX64; actorDid = `parcel_id` (mirrors #83 land-attribution).

Each: JSDoc header (allowlist position + actorDid rationale), `PARCEL_ID_RE`, type guard, per-field validation (positive int / non-negative int / `HEX64_RE` / enum membership), `Object.keys(payload).sort()` deep-equals sorted `EXPECTED_KEYS` (5th key THROWS), explicit no-spread reconstruction, `payloadPrivacyCheck` gate, single `audit.append`.

### Allowlist 91 → 95
- `grid/src/audit/broadcast-allowlist.ts` — appended 4 members in order #92,#93,#94,#95 under the pre-cleared `zoning.*` / `treasury.*` prefixes, each with a sole-producer reference comment. Events 82–91 untouched (zero removals in diff).

### Route seam filled
- `grid/src/api/routes/civic-parcels.ts` — added `appendZoningInteriorExtended` import; the POST `:id/interior/extend` handler now calls the real producer with ONLY `{object_class, object_kind, parcel_id, tick}` (catalog enums + currentTick). Removed the `_emitPayload`/`void` Wave-2 placeholder. Interior names/state never passed.

### Tests un-skipped → GREEN
- The 4 append test stubs (`describe.skip` → `describe`): interior-extended 7, condition-changed 9, parcel-reclaimed 9, upkeep-collected 8 — all pass.
- `broadcast-allowlist.test.ts` (111 tests) GREEN at 95; `human-civic-application.test.ts` (12) GREEN.

### Untouched (later waves)
- `upkeep-scanner.test.ts`, `condition-ladder.test.ts`, `house-2-e2e.test.ts` remain `describe.skip`.

## Self-check / Verification
- `cd grid && npm run test -- audit` → **67 files, 719 tests passed**.
- Targeted: `broadcast-allowlist` (111) + 4 append suites (33) + `human-civic-application` (12) → **156 passed**.
- `node scripts/check-sole-producer-discipline.mjs` → **EXIT 0** (78 sole-producer files, full triad).
- `cd grid && npx tsc --noEmit` → **0 errors** (none in any touched file).
- Events 82–91: unchanged in order and count (no removals in allowlist diff).
- No interior-content key in any producer; all DIDs HEX64; no `FORBIDDEN_KEY_PATTERN` match.

## Requirements satisfied
R-59-08 (allowlist +4 with sole-producer triad + presence assertions), R-59-09 (privacy boundary — interior contents never broadcast, hashed DIDs, walker green), R-59-12 (broadcast-allowlist 95 + sole-producer gate green; no remaining describe.skip in the 4 append files).
