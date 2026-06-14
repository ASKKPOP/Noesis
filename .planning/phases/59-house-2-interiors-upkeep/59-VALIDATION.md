---
phase: 59
slug: house-2-interiors-upkeep
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-13
---

# Phase 59 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (grid + dashboard packages), pytest (brain) |
| **Config file** | `grid/package.json` / `dashboard/package.json` scripts; `brain/.venv` + `.venv/bin/pytest test/` |
| **Quick run command** | `cd grid && npm run test -- --reporter=verbose civic` |
| **Full suite command** | `cd grid && npm run test` (+ `cd dashboard && npm run test:unit`, `cd brain && .venv/bin/pytest test/`) |
| **Estimated runtime** | ~45 seconds (grid suite) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- <test-file-stem>` (or `.venv/bin/pytest <file>`).
- **After every plan wave:** Run the package's full suite.
- **Before `/gsd-verify-work`:** All suites + all gates green.
- **Max feedback latency:** ~45 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| 59-01-01 | 01 | 0 | R-59-02/03/05/06/07 | Wave 0 civic stubs prevent silent plan execution | unit | `npm run test -- civic/furniture-catalog civic/interior-tree civic/upkeep-scanner civic/condition-ladder` | ❌ Wave 0 | ⬜ pending |
| 59-01-02 | 01 | 0 | R-59-04/08/09/12 | Allowlist moved to 95 (+presence) + interior-route + 4 sole-producer stubs locked before impl | unit | `npm run test -- api/civic-interior-routes audit/broadcast-allowlist` | ✅ allowlist exists | ⬜ pending (allowlist EXPECTED-RED until Wave 4) |
| 59-02-01 | 02 | 1 | R-59-01/05 | Migration v39 ALTER + upkeep constants only in founding-law; closed catalog | unit | `npm run test -- civic/furniture-catalog` | ❌ Wave 0 | ⬜ pending |
| 59-02-02 | 02 | 1 | R-59-03 | Interior tree on Structure; extendInterior catalog+fit validated; never serialized to chain | unit | `npm run test -- civic/interior-tree` | ❌ Wave 0 | ⬜ pending |
| 59-03-01 | 03 | 2 | R-59-04 | POST interior/extend owner+catalog-validated; GET interior entry-policy + derelict gated | unit | `npm run test -- api/civic-interior-routes` | ❌ Wave 0 | ⬜ pending |
| 59-03-02 | 03 | 2 | R-59-09 | Feed exposes condition only, never the interior tree; did-policy-coverage gate green | gate | `node scripts/check-did-policy-coverage.mjs` | ✅ existing gate | ⬜ pending |
| 59-04-01 | 04 | 3 | R-59-08/09 | 4 sole producers (closed tuples, no-spread, payloadPrivacyCheck, single append) | unit | `npm run test -- audit/append-zoning-interior-extended audit/append-zoning-condition-changed audit/append-zoning-parcel-reclaimed audit/append-treasury-upkeep-collected` | ❌ Wave 0 | ⬜ pending |
| 59-04-02 | 04 | 3 | R-59-08/12 | Allowlist 91 -> 95 with 4 members; sole-producer-discipline green | unit+gate | `npm run test -- audit/broadcast-allowlist` + `node scripts/check-sole-producer-discipline.mjs` | ✅ allowlist exists | ⬜ pending (turns GREEN here) |
| 59-05-01 | 05 | 4 | R-59-07 | Condition ladder advance/reset/reclaim; derelict closes visitors; commons exempt | unit | `npm run test -- civic/condition-ladder` | ❌ Wave 0 | ⬜ pending |
| 59-05-02 | 05 | 4 | R-59-06/09 | Upkeep scanner rides EXISTING clock.onTick (single-onTick); period-boundary debit + 3 emits | unit+gate | `npm run test -- civic/upkeep-scanner` + `node scripts/check-wallclock-forbidden.mjs` | ❌ Wave 0 | ⬜ pending |
| 59-06-01 | 06 | 5 | R-59-10 | Interior verbs are capabilities; my_places surfaces condition + upkeep cost | unit | `cd brain && .venv/bin/pytest test/test_civic_interior_verbs.py` | ❌ new | ⬜ pending |
| 59-06-02 | 06 | 5 | R-59-11 | Interior viewer (mirror static, functional highlighted) + condition styling; derelict closed | unit | `cd dashboard && npm run test:unit -- interior-viewer` | ❌ new | ⬜ pending |
| 59-07-01 | 07 | 6 | R-59-04/06/07/08 | E2E DoD: extend -> view-gated -> miss-upkeep-to-reclaim; 4 events; commons untouched | integration | `npm run test -- civic/house-2-e2e` | ❌ new | ⬜ pending |
| 59-07-02 | 07 | 6 | R-59-12 | All gates green + 0 remaining describe.skip; single-onTick; zero-diff | gate | `cd grid && npm run test` + gate scripts | ✅ existing gates | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `grid/test/civic/furniture-catalog.test.ts` — stub for R-59-02 (closed v1 catalog; mirror-only-in-home)
- [ ] `grid/test/civic/interior-tree.test.ts` — stub for R-59-03 (extendInterior catalog+fit; never serialized to chain)
- [ ] `grid/test/civic/upkeep-scanner.test.ts` — stub for R-59-06 (period-boundary debit; commons exempt; single-onTick)
- [ ] `grid/test/civic/condition-ladder.test.ts` — stub for R-59-07 (maintained→worn→derelict→reclaimed; reset on payment; derelict closes; reclaim razes+ejects)
- [ ] `grid/test/api/civic-interior-routes.test.ts` — stub for R-59-04 (owner+catalog-validated extend; entry-policy + derelict gated view)
- [ ] `grid/test/audit/append-zoning-interior-extended.test.ts` — stub for R-59-08/09 (closed 4-tuple, actorDid=parcel_id, no interior contents)
- [ ] `grid/test/audit/append-zoning-condition-changed.test.ts` — stub for R-59-08/09 (closed 4-tuple, actorDid=owner_civic_did_hash)
- [ ] `grid/test/audit/append-zoning-parcel-reclaimed.test.ts` — stub for R-59-08/09 (closed 4-tuple, reason=upkeep_default, actorDid=parcel_id)
- [ ] `grid/test/audit/append-treasury-upkeep-collected.test.ts` — stub for R-59-08/09 (closed 4-tuple, actorDid=parcel_id, mirrors #83)
- [ ] `grid/test/civic/house-2-e2e.test.ts` — stub for the full HOUSE-2 DoD scenario

*Existing `grid/test/audit/broadcast-allowlist.test.ts` is UPDATED in Wave 0 — every `.toBe(91)` → `.toBe(95)` plus presence assertions for the 4 new members. It is EXPECTED-RED at 95 until Wave 4 lands the members; do NOT revert the count.*

---

## Definition of Done (master-plan acceptance scenario)

Phase 59 is DONE when this single scenario passes end-to-end in `grid/test/civic/house-2-e2e.test.ts` and the gates below are green:

1. **Furnish** — a Nous owning a built ring-3 home `extend_interior`s a **mirror** item (e.g. `bed` in `bedroom`) and a **functional** item; the audit trail shows `zoning.interior_extended` carrying ONLY `{object_class, object_kind, parcel_id, tick}` — no interior name/state. A second Nous `view_interior`s while the structure is **open** → allowed.
2. **Pay upkeep** — a funded owner is ticked across a `UPKEEP_PERIOD_TICKS` boundary; the scanner debits `upkeepDue` (2% of `price_bios`) via `registry.transferOusia(owner → TREASURY_DID)` and the trail shows `treasury.upkeep_collected {amount_bios, owner_civic_did_hash, parcel_id, tick}`; condition stays **maintained**, `missed_periods` reset.
3. **Decay** — with insufficient funds, successive period boundaries walk the ladder: 1 missed → **worn**, 2 missed → **derelict** (a visitor's `GET interior` now → **403 `closed_to_visitors`**), each emitting `zoning.condition_changed`.
4. **Reclaim** — at 3 missed periods the parcel is **reclaimed**: ownership → `TREASURY_DID`, structure + interior razed, occupants ejected, condition reset to maintained on the treasury parcel; the trail shows `zoning.parcel_reclaimed {former_owner_civic_did_hash, parcel_id, reason:'upkeep_default', tick}`. The parcel is back in the treasury for resale.
5. **Commons exempt** — a Polis Commons parcel (rings 0–1, `owner_civic_did` NULL) ticked across the same boundaries is NEVER debited and NEVER decays.
6. **Interior viewer** — the orbital map at `/worldmap/orbital` renders the interior tree (mirror static, functional highlighted) with condition styling; a derelict module shows closed.

### Gate checklist (all must be green)

- [ ] `broadcast-allowlist.test.ts` asserts `ALLOWLIST.size === 95` and `ALLOWLIST_MEMBERS.length === 95` (delta **+4**; the 4 named events added under `zoning.*`/`treasury.*`; events 82–91 untouched) + presence assertions for all 4.
- [ ] Migration **v39** ALTERs `civic_parcels` (`structure_interior JSON`, `condition ENUM('maintained','worn','derelict')`, `last_upkeep_tick`, `missed_periods`) and applies cleanly on top of shipped v38; down migration drops all four columns. v39 is the next free version after v38.
- [ ] Furniture catalog in `furniture.ts` is closed v1 (mirror 6 home-only render-only; functional 7 with declared affordances); `isValidFurniture` enforces mirror-only-in-home.
- [ ] Interior tree (areas→objects→`{kind,class,state?}`) lives on the `Structure` type Grid-side; `ParcelRegistry.extendInterior` validates against the catalog; interior contents NEVER appear in any audit payload.
- [ ] `POST interior/extend` is `civic_did_required` + owner-only and catalog-validated; `GET interior` is entry-policy-gated (owner always; visitor only if open/allowlisted and not derelict; humans never see private); `ROUTE_DID_POLICY` updated and `node scripts/check-did-policy-coverage.mjs` exits 0.
- [ ] Upkeep constants (`UPKEEP_PERIOD_TICKS=10080`, `UPKEEP_RATE_BPS=200`) + `upkeepDue` live ONLY in `founding-law.ts`; all periods tick-based; `scripts/check-wallclock-forbidden.mjs` exits 0.
- [ ] Upkeep scanner rides the EXISTING `clock.onTick` in `launcher.ts` (no new subscription — `grep -rn "clock.onTick" grid/src | wc -l` shows exactly 1); period-boundary auto-debits owner Ousia → `TREASURY_DID` and emits `treasury.upkeep_collected`.
- [ ] Condition ladder maintained→worn→derelict→reclaimed advances on missed payments, resets on payment; derelict closes visitors; reclaim returns the parcel to treasury, razes structure+interior, ejects occupants; Polis Commons exempt.
- [ ] Each of the 4 events has a dedicated sole-producer `append-*.ts` (closed-tuple `Object.keys().sort()` check, no-spread reconstruction, `payloadPrivacyCheck`, single `audit.append`); `node scripts/check-sole-producer-discipline.mjs` exits 0.
- [ ] Closed tuples match exactly: `interior_extended {object_class, object_kind, parcel_id, tick}`; `condition_changed {condition, owner_civic_did_hash, parcel_id, tick}`; `parcel_reclaimed {former_owner_civic_did_hash, parcel_id, reason, tick}`; `upkeep_collected {amount_bios, owner_civic_did_hash, parcel_id, tick}`.
- [ ] Privacy walker: no payload key matches `FORBIDDEN_KEY_PATTERN`; DIDs hashed HEX64; interior contents never broadcast; privacy-walker gate green.
- [ ] Brain verbs `extend_interior` / `view_interior` dispatch to the Grid as capabilities; `my_places` prompt surfaces condition + pending upkeep cost; no autoplay.
- [ ] Dashboard `/worldmap/orbital` interior viewer renders the tree (mirror static, functional highlighted) with condition styling, entry-policy-gated for humans, additive to the existing exterior map.
- [ ] Zero-diff R-31-01: no chain / persistence-of-chain code edited; `civic-did-issuance-path` gate untouched-green.
- [ ] All Phase 59 Wave-0 skip-stubs are un-skipped (no remaining `describe.skip` in Phase 59 test files).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Interior viewer renders the tree + condition styling | R-59-11 | Browser rendering required | 1. Start the dashboard dev server. 2. Navigate to `/worldmap/orbital`. 3. Click an owned, open, non-derelict module — confirm the interior view renders mirror furniture as static meshes and functional furniture highlighted. 4. Confirm a worn/derelict module shows the corresponding condition styling; a derelict module shows closed and does not open. 5. Confirm `/worldmap` and the Phase 58 orbital exterior are unchanged. |
| Upkeep pressure surfaces in the Nous prompt | R-59-10 | Requires a live brain run with owned land | 1. Run the brain against a Nous owning a built house. 2. Inspect the assembled system prompt — confirm the `my_places` block names the house condition + pending upkeep cost. 3. Confirm the verbs are capabilities (no autoplay loop fires them). |
| Tick-driven decay across boundaries | R-59-06/07 | Requires a live grid boot ticking past period boundaries | 1. Boot the grid against a seeded DB with an owner whose balance < upkeepDue. 2. Tick past 3 `UPKEEP_PERIOD_TICKS` boundaries. 3. Confirm condition walks worn → derelict → reclaimed and the parcel returns to treasury; confirm commons never decay. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every Per-Task Verification Map row carries an automated command)
- [x] Wave 0 covers all MISSING references (incl. the allowlist move to 95, expected-RED until Wave 4)
- [x] No watch-mode flags
- [x] Feedback latency < 45s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
