# Phase 58 — Nous House HOUSE-1 Foundations — COMPLETION REPORT

**Status:** ✅ COMPLETE · all 6 waves shipped · Definition of Done proven
**Date:** 2026-06-13
**Allowlist delta:** +0 (91 → 91, events 82–86 reused as-is)

---

## Definition of Done — PROVEN

`grid/test/civic/house-1-e2e.test.ts` runs the master-plan acceptance scenario
end-to-end against a seeded Genesis Core and passes:

> A Nous buys a ring-3 residential parcel for **400 Bios** (`gravityPrice(3)`),
> builds a **home**, a second Nous **visits** (parcel reports **1 occupant**),
> all **five** events appear on the public audit trail with the owner only as
> `owner_civic_did_hash` (HEX64), and a signed-in human is refused —
> `human_visitor` → **401**, `did:civic:noesis:human:*` → **403
> `humans_cannot_own_land`**.

Five events on the trail: `zoning.parcel_purchased (82)` · `treasury.parcel_revenue (83)`
· `zoning.structure_built (84)` · `zoning.structure_joined (85)` · `zoning.structure_left (86)`.

---

## Waves delivered

| Wave | Plan | Delivered | Requirements |
|------|------|-----------|--------------|
| 0 | 58-01 | TDD skip-stub scaffold (parcel-store / parcel-seed / founding-law / civic-parcels-routes / parcels-wiring) | R-58-01/03/04/06/07/09/12 |
| 1 | 58-02 | founding-law (gravityPrice, seed plan) + vector-address types + migration v38 + ParcelStore (write-through) | R-58-01/03/04 |
| 2 | 58-03 | `seedGenesisCore` (53 parcels, idempotent, no audit events) + GridServices wiring + boot log | R-58-02/05 |
| 3 | 58-04 | civic-parcels HTTP routes (purchase/build/join/leave/entry-policy) reusing events 82–86; funds via `transferOusia`; hashed owner; D-NH-07 auth matrix | R-58-06/07/08/09 |
| 4 | 58-05 | Brain civic-land verbs as capabilities + `my_places` prompt block | R-58-10 |
| 5 | 58-06 | `/worldmap/orbital` live orbital Genesis Core map (additive) | R-58-11 |
| 6 | 58-07 | **Definition-of-Done E2E + CI-gate confirmation** (this wave) | R-58-07/08/12 |

---

## Invariants held (frozen this phase)

- **Allowlist +0** — `broadcast-allowlist.test.ts` still asserts 91; file **zero-diff**.
- **D-NH-07** — humans never own/occupy land (401 by tier, 403 defensively).
- **Genesis Core = exactly 53 parcels** (48 purchasable + 5 civic); ring 4+ absent.
- **Gravity pricing** `100 × (5 − ring)²`, constants only in `founding-law.ts`; ring 3 = 400, ring 2 = 900.
- **Vector addresses** (ring, sector, level) — no 2D assumption.
- **Write-through persistence** — DB source of truth, registry a read cache; occupants memory-only.
- **Zero-diff audit chain (R-31-01)** — no chain / persistence-of-chain code edited;
  new events ride the existing 5 sole producers. The ONLY phase-diff file in Wave 6
  is the new e2e test.
- **Wallclock gate** green — tick→NY conversion only at the dashboard display boundary.
- **Privacy** — DIDs hashed HEX64; structure plaintext names never cross the chain.

---

## CI gates — final state

| Gate | Result |
|------|--------|
| `broadcast-allowlist.test.ts` (91, +0) | ✅ green · zero-diff |
| `check-wallclock-forbidden.mjs` | ✅ exit 0 |
| `check-civic-did-issuance-path.mjs` | ✅ exit 0 |
| `check-sole-producer-discipline.mjs` | ✅ exit 0 |
| `check-did-policy-coverage.mjs` | ✅ exit 0 |
| privacy walker (audit tests) | ✅ green |
| zero-diff R-31-01 | ✅ holds |
| `describe.skip(` in Phase 58 files | ✅ 0 everywhere |

Full grid suite: **3048 passed**, 33 skipped, 1 failed — the single failure is the
**pre-existing, unrelated** `whisper/whisper-crypto.test.ts` libsodium `sodium.ready`
init issue, confirmed failing on clean `HEAD` without any Phase 58 file present. Out of
scope; left untouched per the never-weaken-a-gate rule.

---

## Carried forward to HOUSE-2 (Phase 59)

- First `+N` allowlist additions (+4): `zoning.interior_extended`, `zoning.condition_changed`,
  `zoning.parcel_reclaimed`, `treasury.upkeep_collected`.
- Upkeep / decay / condition ladder + first `clock.onTick` subscription for upkeep timing.
- Interior tree / mirror / functional furniture / interior viewer.
- Ousia/Bios unification question recorded for Polis-era treasury cleanup (R-H-08).
- Occupant persistence across restart deferred (R-H-09, presence is memory-only — accepted).
