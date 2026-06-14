# Phase 59 — Nous House HOUSE-2 Interiors & Upkeep — COMPLETION REPORT

**Status:** ✅ COMPLETE · all 6 waves shipped · Definition of Done proven
**Date:** 2026-06-14
**Allowlist delta:** +4 (91 → 95; `zoning.interior_extended`, `zoning.condition_changed`, `zoning.parcel_reclaimed`, `treasury.upkeep_collected`)

---

## Definition of Done — PROVEN

`grid/test/civic/house-2-e2e.test.ts` runs the master-plan HOUSE-2 acceptance scenario
end-to-end against a seeded Genesis Core (built on the Phase 58 buy→build path, driven
through the real HTTP routes + the real `onUpkeepTick` scanner composed exactly as
`main.ts` wires it) and passes:

> An owner of a built ring-3 home **furnishes** a mirror item (`bed`) + a functional
> item (`work_desk`) — each emits `zoning.interior_extended` carrying ONLY
> `{object_class, object_kind, parcel_id, tick}` (no interior name/state). A second Nous
> **views** the interior while open → 200. A separate **funded** owner is ticked across
> a period boundary → `treasury.upkeep_collected {amount_bios:8, owner_civic_did_hash,
> parcel_id, tick}` (condition stays maintained, missed_periods reset). With the first
> owner's balance drained, successive boundaries **decay** the home maintained → **worn**
> → **derelict** (each emitting `zoning.condition_changed`; the visitor's GET interior now
> → **403 `closed_to_visitors`**), then **reclaim** at the third miss:
> `zoning.parcel_reclaimed {reason:'upkeep_default'}`, ownership → `TREASURY_DID`,
> structure + interior razed, occupants ejected, parcel back in the treasury for resale.
> A **Polis Commons** parcel (rings 0–1, owner NULL) ticked across the same boundaries is
> NEVER debited and NEVER decays. No raw owner DID appears in any payload (all HEX64); no
> interior name/state ever crosses the chain.

Four new events on the trail: `zoning.interior_extended (92)` · `zoning.condition_changed (93)`
· `zoning.parcel_reclaimed (94)` · `treasury.upkeep_collected (95)`.

---

## Waves delivered

| Wave | Plan | Delivered | Requirements |
|------|------|-----------|--------------|
| 0 | 59-01 | TDD skip-stub scaffold (furniture-catalog / interior-tree / upkeep-scanner / condition-ladder / civic-interior-routes / 4 append-* stubs / house-2-e2e) + allowlist moved to 95 (EXPECTED-RED) | R-59-02..09/12 |
| 1 | 59-02 | migration v39 ALTER + upkeep constants (`founding-law.ts`) + closed furniture catalog + interior tree on `Structure` + `extendInterior` | R-59-01/02/03/05 |
| 2 | 59-03 | `POST interior/extend` (owner + catalog-validated) + `GET interior` (entry-policy + derelict-gated); ROUTE_DID_POLICY; did-policy-coverage green | R-59-04/09 |
| 3 | 59-04 | 4 sole-producer `append-*.ts` (closed tuple + no-spread + payloadPrivacyCheck + single append) + allowlist 91→95 with 4 members | R-59-08/09/12 |
| 4 | 59-05 | condition ladder (advance/reset/reclaim, derelict closes visitors, commons exempt) + upkeep scanner riding the EXISTING `clock.onTick` (single-onTick) | R-59-06/07 |
| 5 | 59-06 | Brain verbs `extend_interior`/`view_interior` (capabilities, no autoplay) + `my_places` condition/upkeep prompt + dashboard `/worldmap/orbital` interior viewer | R-59-10/11 |
| 6 | 59-07 | **Definition-of-Done E2E + CI-gate confirmation** (this wave) | R-59-04/06/07/08/12 |

---

## Invariants held (frozen this phase)

- **Allowlist +4 (91 → 95)** — `broadcast-allowlist.test.ts` asserts 95 + presence of all
  4 new members; events 82–91 untouched; file **zero-diff** this wave.
- **Each of the 4 new events has the full sole-producer triad** — closed-tuple
  `Object.keys().sort()` check + explicit no-spread reconstruction + `payloadPrivacyCheck`
  + single `audit.append`. `check-sole-producer-discipline.mjs` green (78 producers).
- **D-NH-02 interior-never-broadcast / privacy walker** — only `object_class`/`object_kind`
  enums cross; interior names/state/tree never; DIDs hashed HEX64; no
  `FORBIDDEN_KEY_PATTERN` key.
- **D-NH-03 single-onTick upkeep (R-H-03)** — upkeep rides the EXISTING `clock.onTick`
  callback in `launcher.ts` (one subscription at line 490; `void onUpkeepTick` at 514).
  No new subscription added by Phase 59.
- **Wallclock gate (R-H-02)** — all upkeep periods/grace/condition timing are tick-based;
  tick→NY conversion only at the display boundary. `check-wallclock-forbidden.mjs` green.
- **Zero-diff audit chain (R-31-01)** — no chain / persistence-of-chain code edited;
  the 4 events ride new standard sole producers. The ONLY Phase-59-relevant file in the
  Wave 6 working-tree diff is the new e2e test. `check-civic-did-issuance-path.mjs` green.
- **Polis Commons exempt** — treasury-owned parcels (rings 0–1, owner NULL) never accrue
  upkeep and never decay or reclaim.
- **Furniture catalog closed v1** — 6 mirror (home-only) + 7 functional; mirror furniture
  valid ONLY in the owner's own home.
- **Genesis Core geometry frozen** at 53 parcels; six-zone invariant untouched.
- **D-NH-07** — humans never own/occupy land; humans never see private interiors; the
  upkeep machinery only ever debits Nous owners.

---

## CI gates — final state

| Gate | Result |
|------|--------|
| `broadcast-allowlist.test.ts` (95, +4) | ✅ green · 111 tests · zero-diff |
| `check-sole-producer-discipline.mjs` | ✅ exit 0 (78 producers) |
| `check-civic-did-issuance-path.mjs` | ✅ exit 0 (324 files) |
| `check-wallclock-forbidden.mjs` | ✅ exit 0 |
| privacy walker (`payloadPrivacyCheck`) | ✅ green (4 producers gated) |
| single-onTick invariant | ✅ one `clock.onTick(` in launcher; upkeep rides it |
| zero-diff R-31-01 | ✅ no chain/persistence file in the diff |
| Phase 59 `describe.skip(` call sites | ✅ 0 (17 files, 157 tests, 0 skipped) |
| full grid suite | ✅ 336 passed \| 6 skipped (3163 / 33) |

> The full-suite run occasionally trips the PRE-EXISTING race on
> `__test_violator_civic_issuance__.ts` (a temp file `check-civic-did-issuance-path.test.ts`
> creates/deletes while `skill-producer-boundary.test.ts` walks `src/`). Green on re-run;
> unrelated to Phase 59 and present before this wave.

---

## Phase requirements — all validated

R-59-01 (v39 persistence) · R-59-02 (closed catalog) · R-59-03 (interior tree) ·
R-59-04 (extend/view routes) · R-59-05 (upkeep founding-law constants) ·
R-59-06 (single-onTick scanner + upkeep_collected) · R-59-07 (condition ladder + reclaim) ·
R-59-08 (allowlist +4, sole producers) · R-59-09 (privacy boundary) ·
R-59-10 (brain verbs) · R-59-11 (interior viewer) · R-59-12 (all gates green, no skips).

**Phase 59 HOUSE-2 is COMPLETE.**
