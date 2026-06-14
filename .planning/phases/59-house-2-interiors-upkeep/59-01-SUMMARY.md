# Phase 59 · Wave 0 — HOUSE-2 TDD Skip-Stub Scaffold — SUMMARY

**Wave:** 0 (tests only — ZERO `grid/src` changes)
**Date:** 2026-06-13
**Discipline:** TDD skip-stub scaffold (mirrors Phase 58 Wave 0). Every new block is
`describe.skip` → reports SKIPPED, not failed. Not-yet-existing Wave-1/4 symbols are
deferred via dynamic `import()` inside the skipped suites, so module resolution never
runs before the implementation lands. Later waves un-skip the stubs they satisfy.

## Deliverables — 10 new skip-stub test files

| File | Coverage | Un-skipped by |
|------|----------|---------------|
| `grid/test/civic/furniture-catalog.test.ts` | R-59-02 — closed v1 catalog (6 mirror home-only render-only + 7 functional w/ affordances); `isValidFurniture` mirror-only-in-home; unknown → false; frozen catalog (13 entries) | Wave 1 |
| `grid/test/civic/interior-tree.test.ts` | R-59-03 — `extendInterior` mutates `interior.areas` tree (area-create + append + class tag); rejects unknown kind (`invalid_furniture`) + mirror-in-non-home; interior tree NEVER serialized to chain | Wave 1 |
| `grid/test/civic/upkeep-scanner.test.ts` | R-59-05/06 — founding-law constants (`UPKEEP_PERIOD_TICKS=10080`, `UPKEEP_RATE_BPS=200`, `upkeepDue`); period-boundary debit owner→`TREASURY_DID` + `treasury.upkeep_collected`; commons (rings 0–1, null owner) exempt; single-onTick invariant (source has NO `clock.onTick`) | Wave 1 / Wave 4 |
| `grid/test/civic/condition-ladder.test.ts` | R-59-07 — maintained→worn→derelict→reclaimed; reset on pay; derelict closes visitors (`closed_to_visitors`); reclaim razes+ejects+returns to `TREASURY_DID`; emits `zoning.condition_changed` + `zoning.parcel_reclaimed{upkeep_default}` | Wave 4 |
| `grid/test/api/civic-interior-routes.test.ts` | R-59-04 — POST interior/extend owner-only (403 `not_owner` / 422 `invalid_furniture` / 200 success); GET interior owner-always, visitor-if-open, derelict→403 `closed_to_visitors`, humans-refused; feed never exposes interior tree | Wave 3 |
| `grid/test/audit/append-zoning-interior-extended.test.ts` | R-59-04/09 — closed 4-tuple `{object_class, object_kind, parcel_id, tick}`; `actorDid=parcel_id`; 5th key throws; no interior names/state; no `FORBIDDEN_KEY_PATTERN` key | Wave 4 |
| `grid/test/audit/append-zoning-condition-changed.test.ts` | R-59-07/09 — closed 4-tuple `{condition, owner_civic_did_hash, parcel_id, tick}`; `actorDid=owner_civic_did_hash`; condition enum `{maintained,worn,derelict}`; HEX64 + PARCEL_ID_RE + closed-tuple + privacy | Wave 4 |
| `grid/test/audit/append-zoning-parcel-reclaimed.test.ts` | R-59-07/09 — closed 4-tuple `{former_owner_civic_did_hash, parcel_id, reason, tick}`; `reason='upkeep_default'`; `actorDid=parcel_id`; HEX64 + closed-tuple + privacy | Wave 4 |
| `grid/test/audit/append-treasury-upkeep-collected.test.ts` | R-59-06/09 — closed 4-tuple `{amount_bios, owner_civic_did_hash, parcel_id, tick}`; positive amount; `actorDid=parcel_id` (mirrors #83); HEX64 + closed-tuple + privacy | Wave 4 |
| `grid/test/civic/house-2-e2e.test.ts` | R-59-04/06/07/09/12 — full DoD: extend → view gated → miss upkeep through ladder to reclaim; commons untouched; no interior names/state on any payload | Wave 6 |

Total: **83 skipped tests** across 10 files, all green/skipped.

## The one non-stub change — broadcast-allowlist.test.ts → 95 (EXPECTED-RED)

`grid/test/audit/broadcast-allowlist.test.ts`:
- Moved **every** `.toBe(91)` → `.toBe(95)` (9 occurrences: `ALLOWLIST.size` + `ALLOWLIST_MEMBERS.length` across all membership describe blocks).
- Added a new `Phase 59 (HOUSE-2 / D-59-01)` describe block with **4 presence assertions** for the new members: `zoning.interior_extended`, `zoning.condition_changed`, `zoning.parcel_reclaimed`, `treasury.upkeep_collected`.
- Events 82–91 ordering untouched.

**This suite is EXPECTED-RED at 95 by design.** The allowlist SOURCE
(`grid/src/audit/broadcast-allowlist.ts`) intentionally stays at 91 in Wave 0 — Wave 4
lands the 4 members and turns this suite GREEN. The red-at-95 state is the drift guard
that fails CI if any accidental allowlist change happens before/after Wave 4. Do NOT add
the members to the source in Wave 0; do NOT make this test green until Wave 4.

Current state: **13 failed / 98 passed** (9 count assertions + 4 presence assertions
fail against the 91-member source) — this is the documented expected-RED, not a defect.

## Self-check

- Skip-stub run: `Test Files 10 skipped (10) · Tests 83 skipped (83)` — exit 0.
- broadcast-allowlist: `1 failed · 13 failed | 98 passed (111)` — EXPECTED-RED at 95 (green at Wave 4).
- `git status --short grid/src`: empty (zero source changes).
- grep counts: `toBe(91)=0`, `toBe(95)=9`, presence assertions = 4.

## Requirements touched (scaffold-level)

R-59-01 (persistence — implied by interior tree shape), R-59-02, R-59-03, R-59-04,
R-59-05, R-59-06, R-59-07, R-59-08 (allowlist 91→95 drift guard), R-59-12 (no remaining
`describe.skip` is a Wave-6 gate; Wave 0 deliberately ships them skip).
