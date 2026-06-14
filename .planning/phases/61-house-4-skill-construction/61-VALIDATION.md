---
phase: 61
slug: house-4-skill-construction
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-14
---

# Phase 61 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (grid + dashboard packages), pytest (brain) |
| **Config file** | `grid/package.json` / `dashboard/package.json` scripts; `brain/.venv` + `.venv/bin/pytest test/` |
| **Quick run command** | `cd grid && npm run test -- --reporter=verbose civic` |
| **Full suite command** | `cd grid && npm run test` (+ `cd dashboard && npm run test:unit`, `cd brain && .venv/bin/pytest test/`) |
| **Estimated runtime** | ~50 seconds (grid suite) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- <test-file-stem>` (or `.venv/bin/pytest <file>`).
- **After every plan wave:** Run the package's full suite.
- **Before `/gsd-verify-work`:** All suites + all gates green.
- **Max feedback latency:** ~50 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| 61-01-01 | 01 | 0 | R-61-01/02/03/04/05/06 | Wave 0 civic stubs prevent silent plan execution | unit | `npm run test -- civic/blueprint civic/co-build civic/location-teaching` | ❌ Wave 0 | ⬜ pending |
| 61-01-02 | 01 | 0 | R-61-04/07/08 | Allowlist moved to 100 (+presence) + build-route + sole-producer stub locked before impl | unit | `npm run test -- api/civic-build-routes audit/broadcast-allowlist` | ✅ allowlist exists | ⬜ pending (allowlist EXPECTED-RED until Wave 3) |
| 61-02-01 | 02 | 1 | R-61-01/02 | Migration v41 (civic_blueprints); recipe = catalog-kind objects + DAG + material cost; row write emits nothing | unit | `npm run test -- civic/blueprint` | ❌ Wave 0 | ⬜ pending |
| 61-02-02 | 02 | 1 | R-61-03 | Skill-held check via EXISTING skill-event history (skill.taught/inferred learner_did match); no new skill store | unit | `npm run test -- civic/blueprint-skill-held` | ❌ Wave 0 | ⬜ pending |
| 61-03-01 | 03 | 2 | R-61-04 | Build executor: skill-held -> material debit -> extendInterior apply -> skill.blueprint_executed; humans rejected | unit | `npm run test -- civic/blueprint-executor` | ❌ Wave 0 | ⬜ pending |
| 61-03-02 | 03 | 2 | R-61-05 | Co-build DAG decomposition; sub-tasks paid (Ousia/IOU, never free); DAG-weighted attribution; reuses cowork_session | unit | `npm run test -- civic/co-build` | ❌ Wave 0 | ⬜ pending |
| 61-03-03 | 03 | 2 | R-61-06 | Location-aware teaching diffuses to present Nous via EXISTING producers; skill.taught tuple unchanged; humans excluded | unit | `npm run test -- civic/location-teaching` | ❌ Wave 0 | ⬜ pending |
| 61-04-01 | 04 | 3 | R-61-07 | Sole producer (closed 4-tuple, no-spread, payloadPrivacyCheck, single append); allowlist 99->100 GREEN | unit+gate | `npm run test -- audit/append-skill-blueprint-executed audit/broadcast-allowlist` + `node scripts/check-sole-producer-discipline.mjs` | ✅ allowlist exists | ⬜ pending (turns GREEN here) |
| 61-04-02 | 04 | 3 | R-61-04/08 | build-from-blueprint route; ROUTE_DID_POLICY coverage; humans rejected; cross-house-injection extended | unit+gate | `npm run test -- api/civic-build-routes` + `node scripts/check-did-policy-coverage.mjs` + `node scripts/check-cross-house-injection.mjs` | ❌ Wave 0 | ⬜ pending |
| 61-05-01 | 05 | 4 | R-61-09 | Build verbs are capabilities; my_places/skill prompt surfaces held blueprints; ActionType count 44->48 | unit | `cd brain && .venv/bin/pytest test/test_civic_construction_verbs.py test/ananke/test_loader.py` | ❌ new | ⬜ pending |
| 61-05-02 | 05 | 4 | R-61-10 | Dashboard surfaces (blueprint library, build panel, co-build DAG board, teach-here indicator) additive | unit | `cd dashboard && npm run test:unit -- construction-surfaces` | ❌ new | ⬜ pending |
| 61-06-01 | 06 | 5 | R-61-04/05/06/07 | E2E DoD: learn blueprint -> build-from-blueprint -> skill.blueprint_executed; co-build DAG paid attribution; location teaching diffuses; humans rejected | integration | `npm run test -- civic/house-4-e2e` | ❌ new | ⬜ pending |
| 61-06-02 | 06 | 5 | R-61-11 | All gates green + 0 remaining describe.skip; single-onTick; zero-diff; cross-house-injection; allowlist 100 | gate | `cd grid && npm run test` + gate scripts | ✅ existing gates | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `grid/test/civic/blueprint.test.ts` — stub for R-61-02 (recipe = catalog-kind objects + arrangement DAG + material_cost_bios; non-catalog kind rejected; civic_blueprints store; row write emits nothing; blueprint_hash IS a Phase 18 skill hash)
- [ ] `grid/test/civic/blueprint-skill-held.test.ts` — stub for R-61-03 (skill-held check via EXISTING skill.taught/inferred history; learner_did === builder for blueprint_hash; skill_not_held when absent; no new skill store)
- [ ] `grid/test/civic/blueprint-executor.test.ts` — stub for R-61-04 (skill-held -> material debit (insufficient 402) -> extendInterior per recipe object -> skill.blueprint_executed; owner OR co-build staff; humans rejected)
- [ ] `grid/test/civic/co-build.test.ts` — stub for R-61-05 (DAG decomposition; sub-task = Phase 60 board task; completion ALWAYS settles Ousia/IOU never free; DAG-weighted attribution; reuses zoning.cowork_session; no new allowlist event)
- [ ] `grid/test/civic/location-teaching.test.ts` — stub for R-61-06 (parcel_id selector; workshop diffuses to present Nous; reuses appendSkillTaught/Inferred; skill.taught 5-tuple unchanged; humans excluded)
- [ ] `grid/test/api/civic-build-routes.test.ts` — stub for R-61-04/08 (build-from-blueprint route; owner/co-build authz; humans rejected; skill_not_held; insufficient funds 402; ROUTE_DID_POLICY coverage)
- [ ] `grid/test/audit/append-skill-blueprint-executed.test.ts` — stub for R-61-07/08 (closed 4-tuple {blueprint_hash, builder_civic_did_hash, parcel_id, tick}; both hashes HEX64; actorDid = builder_civic_did_hash; no recipe/content key)
- [ ] `grid/test/civic/house-4-e2e.test.ts` — stub for the full HOUSE-4 DoD scenario

*Existing `grid/test/audit/broadcast-allowlist.test.ts` is UPDATED in Wave 0 — every `.toBe(99)` → `.toBe(100)` plus a presence assertion for `skill.blueprint_executed`. It is EXPECTED-RED at 100 until Wave 3 lands the member; do NOT revert the count. Any sibling count suite asserting 99 moves 99→100 in lockstep.*

---

## Definition of Done (master-plan acceptance scenario)

Phase 61 is DONE when this single scenario passes end-to-end in `grid/test/civic/house-4-e2e.test.ts` and the gates below are green:

1. **Learn a blueprint** — a Nous learns a `blueprint_hash` via the EXISTING Phase 18 skill machinery (`skill.taught` or `skill.inferred` with `learner_did === the Nous`); the Grid-side `civic_blueprints` row holds the recipe (catalog-kind objects + arrangement DAG + `material_cost_bios`). Learning emits the EXISTING `skill.taught`/`skill.inferred` event — NO new event.
2. **Build from blueprint (skill-held check)** — the Nous calls `build-from-blueprint {blueprint_hash}` on an owned parcel. The Grid confirms the builder HOLDS the skill from the EXISTING skill-event history → debits `material_cost_bios` (Ousia → `TREASURY_DID`; insufficient → 402) → applies the recipe via `extendInterior` for each object → the trail shows `skill.blueprint_executed {blueprint_hash, builder_civic_did_hash, parcel_id, tick}` (no raw DID, no recipe body). A builder who does NOT hold the skill → `skill_not_held`. A **human** (`did:civic:noesis:human:*`) attempting any build → **rejected** (VOTE-05 / D-NH-07).
3. **Co-build DAG decomposition + DAG-weighted paid attribution** — a build decomposes into atomic sub-tasks (the recipe's `arrangement` DAG). Each sub-task is a Phase 60 co-work board task carrying pay; completion **ALWAYS settles** (D-NH-06): Ousia when funded, else a Phase 60 IOU — never free. Attribution is **DAG-weighted** by completed-node weights (a participant's share = Σ completed-node weights ÷ Σ all-node weights). On full completion the executor applies the assembled recipe + emits ONE `skill.blueprint_executed`; sub-task settlement reuses `zoning.cowork_session` (NO new allowlist event).
4. **Location-aware teaching (structures become schools)** — a skill taught inside a `workshop` structure diffuses to the Nous PRESENT in that structure (the Phase 58 occupant map) via the EXISTING `appendSkillTaught` / `appendSkillInferred` producers; the present Nous gain the skill (a `skill.taught` per learner with the unchanged 5-tuple); humans present are never learners; the teaching location (`parcel_id`) stays Grid-side, off the chain.
5. **Privacy** — no recipe body, sub-task content, or teaching location appears in any payload (only `blueprint_hash`/hashed builder/`parcel_id`/`tick`); all DIDs hashed HEX64; the blueprint hash is a HEX64 skill hash.
6. **Construction surfaces** — the orbital map at `/worldmap/orbital` shows the blueprint library panel, the build panel (skill-held status), the co-build DAG board panel, and the teach-here indicator (additive beside the Phase 58/59/60 viewers).

### Gate checklist (all must be green)

- [ ] `broadcast-allowlist.test.ts` asserts `ALLOWLIST.size === 100` and `ALLOWLIST_MEMBERS.length === 100` (delta **+1**; `skill.blueprint_executed` added under `skill.*`; events 1–99 untouched) + a presence assertion for the new member. Any sibling count suite GREEN at 100.
- [ ] Migration **v41** creates `civic_blueprints` (recipe body JSON keyed by `blueprint_hash`); applies cleanly on top of shipped v40; down migration drops the table. v41 is the next free version after v40.
- [ ] A `blueprint_hash` is a Phase 18 skill hash; the recipe `{objects:[{kind, area}], arrangement (DAG), material_cost_bios}` has `kind`s restricted to the Phase 59 closed furniture catalog; a non-catalog kind is rejected by the existing `furniture.ts` gate; the `civic_blueprints` row write emits NO chain event.
- [ ] Diffusion is ZERO new code: blueprints diffuse via the EXISTING `skill.taught` / `skill.inferred` producers + audit-chain history; location-aware teaching only adds the present-occupant learner selector; the `skill.taught` 5-tuple is unchanged.
- [ ] The build executor verifies skill-held via the EXISTING skill-event history (a `skill.taught`/`skill.inferred` with `learner_did === builder` for `blueprint_hash`); `skill_not_held` when absent; the Brain attests, the Grid confirms; no new skill store.
- [ ] D-NH-06 honored: every claimed co-build sub-task settles in Ousia (when funded) or records a Phase 60 IOU (when not) — a sub-task completion that pays nothing throws; attribution is DAG-weighted by completed-node weights.
- [ ] The single new event has a dedicated sole-producer `append-skill-blueprint-executed.ts` (closed 4-tuple `Object.keys().sort()` check, no-spread reconstruction, `payloadPrivacyCheck`, single `audit.append`, `actorDid = builder_civic_did_hash`); `node scripts/check-sole-producer-discipline.mjs` exits 0.
- [ ] Closed tuple matches exactly: `skill.blueprint_executed {blueprint_hash, builder_civic_did_hash, parcel_id, tick}` (both hashes HEX64; `parcel_id` PARCEL_ID_RE; `tick` non-negative int).
- [ ] Privacy walker: no payload key matches `FORBIDDEN_KEY_PATTERN`; DIDs hashed HEX64; recipe body / sub-task content / teaching location never broadcast; privacy-walker gate green.
- [ ] `scripts/check-cross-house-injection.mjs` (A11e) exits 0 with coverage extended to the co-build / blueprint paths: co-build board content + recipe `arrangement` entering a House channel is DATA, never instructions.
- [ ] The `build-from-blueprint` route has a `ROUTE_DID_POLICY` entry; `node scripts/check-did-policy-coverage.mjs` exits 0; humans rejected from building.
- [ ] Brain verbs `learn_blueprint` / `build_from_blueprint` / `co_build` / `teach_here` dispatch to the Grid as capabilities; the `my_places` / skill prompt surfaces held blueprints + buildable parcels + teach-here; no autoplay. The `ActionType` count assertion is bumped 44 → 48.
- [ ] Dashboard `/worldmap/orbital` surfaces (blueprint library, build panel, co-build DAG board, teach-here indicator) are additive beside the Phase 58/59/60 viewers.
- [ ] Single-onTick (R-H-03): no new `clock.onTick` subscription — `grep -rn "clock.onTick" grid/src | wc -l` shows exactly 1.
- [ ] Zero-diff R-31-01: no chain / persistence-of-chain code edited; `civic-did-issuance-path` gate untouched-green.
- [ ] All Phase 61 Wave-0 skip-stubs are un-skipped (no remaining `describe.skip` in Phase 61 test files).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Construction surfaces render on the orbital map | R-61-10 | Browser rendering required | 1. Start the dashboard dev server. 2. Navigate to `/worldmap/orbital`. 3. Click an owned parcel — confirm the blueprint library panel (held hashes), the build panel (with skill-held status), and the co-build DAG board render. 4. Confirm a `workshop` structure shows the teach-here indicator. 5. Confirm `/worldmap`, the Phase 58 exterior, the Phase 59 interior viewer, and the Phase 60 commerce surfaces are unchanged. |
| Construction relationships surface in the Nous prompt | R-61-09 | Requires a live brain run with held blueprints | 1. Run the brain against a Nous holding a learned blueprint and owning a parcel. 2. Inspect the assembled system prompt — confirm the `my_places` / skill block names the held blueprints, the buildable parcels, and the teach-here context. 3. Confirm the verbs are capabilities (no autoplay loop fires them). |
| Co-build settles or records an IOU end-to-end | R-61-05 | Requires a live grid run with multiple funded/unfunded Nous | 1. Boot the grid with an owner and two worker Nous. 2. Decompose a blueprint into its DAG; post sub-tasks; have the workers claim + complete them with the host FUNDED — confirm `transferOusia` per sub-task. 3. Repeat with the host UNFUNDED — confirm a Phase 60 IOU is recorded (never free). 4. Confirm DAG-weighted attribution = Σ completed-node weights ÷ Σ all-node weights. 5. Confirm `zoning.cowork_session` carries only `participants_hash`/counts/ticks and `skill.blueprint_executed` fires once on full completion. |
| Location-aware teaching diffuses to present Nous | R-61-06 | Requires a live grid run with occupied workshop | 1. Boot the grid with a `workshop` structure holding 2 present Nous + 1 absent Nous. 2. Teach a blueprint inside the workshop with the `parcel_id` context. 3. Confirm the 2 present Nous receive `skill.taught` (and now hold the blueprint) and the absent Nous does not. 4. Confirm a present human visitor is NOT a learner. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every Per-Task Verification Map row carries an automated command)
- [x] Wave 0 covers all MISSING references (incl. the allowlist move to 100, expected-RED until Wave 3)
- [x] No watch-mode flags
- [x] Feedback latency < 50s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
