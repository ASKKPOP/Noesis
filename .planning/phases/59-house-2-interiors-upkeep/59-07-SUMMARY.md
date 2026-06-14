# Phase 59 · Wave 6 (plan 59-07) — Summary

**Wave:** 6 (final) · **Type:** execute · **Status:** COMPLETE
**Requirements:** R-59-04, R-59-06, R-59-07, R-59-08, R-59-12
**Date:** 2026-06-14

## What shipped

The HOUSE-2 Definition-of-Done end-to-end and confirmation that every CI gate is green
without weakening any of them.

### Task 1 — `grid/test/civic/house-2-e2e.test.ts` (authored, un-skipped)

A single end-to-end scenario built on the Phase 58 buy→build path, driven through the
real `registerCivicParcelRoutes` HTTP handlers + the real `onUpkeepTick` scanner wired
EXACTLY as production composes it in `main.ts` (parcel-registry ladder + Nous-registry
balance/transfer + store persist over a mock mysql2 Pool; treasury = `TREASURY_DID`).

The one test exercises all six DoD beats:

1. **Furnish** — Nous A buys + builds a ring-3 home, then `extend_interior`s a MIRROR
   item (`bed` in `bedroom`) + a FUNCTIONAL item (`work_desk` in `study`). Both emit
   `zoning.interior_extended` carrying ONLY the closed 4-tuple
   `{object_class, object_kind, parcel_id, tick}` — `bedroom`/`study`/`areas`/`state`
   never appear on the payload.
2. **View (open)** — Nous B GETs the interior while the structure is open → 200; joins
   as an occupant so the later reclaim ejection is observable.
3. **Pay (funded)** — Nous C (separate funded owner) is ticked across a
   `UPKEEP_PERIOD_TICKS` boundary → `treasury.upkeep_collected`
   `{amount_bios:8, owner_civic_did_hash, parcel_id, tick}`; funds move Nous C →
   treasury (exactly 8); condition stays `maintained`; `missed_periods` reset.
4. **Decay** — Nous A's balance drained to 0; successive period boundaries walk the
   ladder: 1st miss → `worn` + `zoning.condition_changed`; 2nd miss → `derelict` +
   `condition_changed`, and the visitor's GET interior now → 403 `closed_to_visitors`.
5. **Reclaim** — 3rd miss → `zoning.parcel_reclaimed {reason:'upkeep_default'}`;
   ownership → `TREASURY_DID`, structure + interior razed, occupants ejected, condition
   reset to `maintained`; parcel back in the treasury inventory for resale.
6. **Commons** — the ring-1 `genesis:infrastructure:0001` Polis Commons parcel
   (owner NULL) is ticked on every sweep yet is NEVER debited and NEVER decays; no event
   on the trail references it.

Plus the global privacy invariants: no raw `did:civic:` in any payload; every
DID-bearing key (`owner_civic_did_hash`, `former_owner_civic_did_hash`,
`buyer_civic_did_hash`, `visitor_civic_did_hash`) is HEX64; no interior name/state on
any payload across the whole run; all four new HOUSE-2 events present on the trail.

### Task 2 — gates confirmed (no edits)

All gates pass unchanged. No gate was weakened; no earlier-wave source needed a fix.

## Self-check evidence

- `npm run test -- civic/house-2-e2e` → **1 passed** (Test Files 1 passed).
- Full grid suite → **336 passed | 6 skipped** (3163 passed | 33 skipped).
  (One flaky run hit the PRE-EXISTING `__test_violator_civic_issuance__.ts` race
  between `check-civic-did-issuance-path.test.ts` and `skill-producer-boundary.test.ts`;
  green on re-run — unrelated to Phase 59.)
- `check-sole-producer-discipline.mjs` → exit 0 (78 sole-producer files OK).
- `check-civic-did-issuance-path.mjs` → exit 0 (324 files scanned).
- `check-wallclock-forbidden.mjs` → exit 0.
- `broadcast-allowlist.test.ts` → 111 passed; asserts `ALLOWLIST.size === 95` +
  `ALLOWLIST_MEMBERS.length === 95` + presence of all 4 new members; **git diff empty**
  (unchanged this wave).
- Phase 59 real `describe.skip(` call sites → **0** (substring grep matches are
  docstring comments only; vitest reports **0 skipped** across all 17 Phase 59 files,
  157 tests).
- Single-onTick → launcher has exactly ONE `clock.onTick(` (line 490); upkeep rides it
  via `void onUpkeepTick(event.tick, …)` (line 514). No new subscription.
- Zero-diff R-31-01 → no chain / persistence-of-chain file in the working-tree diff.

## Files modified

- `grid/test/civic/house-2-e2e.test.ts` — un-skipped + authored the DoD E2E (test-only).

No source, gate, or allowlist file was edited in this wave.
