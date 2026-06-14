# Phase 61 — Nous House HOUSE-4 Skill Construction — COMPLETION REPORT

**Status:** ✅ COMPLETE · all 6 waves shipped · Definition of Done proven · **closes the Nous House (Phases 58–61)**
**Date:** 2026-06-14
**Allowlist delta:** +1 (99 → 100; `skill.blueprint_executed`)
**HOUSE total (58–61):** **+9 allowlist events** — HOUSE-1 +0, HOUSE-2 +4, HOUSE-3 +4, HOUSE-4 +1.

---

## Definition of Done — PROVEN

`grid/test/civic/house-4-e2e.test.ts` runs the master-plan HOUSE-4 acceptance scenario
end-to-end against a seeded Genesis Core (built on the Phase 58/59/60 buy→build→furnish→co-work
path) and passes:

> A Nous **learns** a blueprint via the EXISTING `skill.taught`/`skill.inferred` machinery (no new
> event); the Grid-side `civic_blueprints` recipe holds catalog-kind objects + an arrangement DAG +
> `material_cost_bios`. The Nous **builds** from it — the Grid confirms skill-held from the existing
> skill-event history, debits material cost (Ousia → TREASURY), applies the recipe via
> `extendInterior` per object, and emits ONE `skill.blueprint_executed {blueprint_hash,
> builder_civic_did_hash, parcel_id, tick}` (hashed builder, no recipe body). A builder who does not
> hold the skill → `skill_not_held`; insufficient Ousia → 402. A **co-build** decomposes a recipe
> into its arrangement DAG; workers claim + complete sub-tasks that settle in Ousia or a Phase 60
> IOU (never free, D-NH-06), with DAG-weighted attribution; one `zoning.cowork_session`
> (participants_hash only) + one `skill.blueprint_executed` on full completion. A skill **taught** in
> a workshop diffuses to the PRESENT Nous (not absent, not human) via the unchanged `skill.taught`
> 5-tuple (`parcel_id` off chain). A **human** attempting any build → 403. No recipe body, sub-task
> content, or teaching location ever crosses the chain; all DIDs HEX64.

---

## Waves

| Wave | Plan | Ships |
|---|---|---|
| 0 | 61-01 | skip-stubs (8) + allowlist 99→100 expected-RED + sibling lockstep |
| 1 | 61-02 | migration v41 `civic_blueprints`; `blueprint.ts` recipe type + catalog validation + store; `builderHoldsSkill` via existing skill-event history |
| 2 | 61-03 | build executor (`buildFromBlueprint`); `co-build.ts` (DAG decompose + always-paid sub-tasks + DAG-weighted attribution); `location-teaching.ts` (present-occupant diffusion) |
| 3 | 61-04 | sole producer `append-skill-blueprint-executed.ts`; allowlist 99→**100**; `build-from-blueprint` route + ROUTE_DID_POLICY; cross-house-injection gate A11e extended |
| 4 | 61-05 | 4 brain construction verbs + commerce `my_places`; ActionType count 44→48; dashboard construction surfaces (additive) |
| 5 | 61-06 | HOUSE-4 E2E Definition-of-Done + all gates green |

---

## Invariants & gates (independently re-verified)

- **zero-diff R-31-01** — no chain / persistence-of-chain edits; `skill.blueprint_executed` rides a
  new standard sole-producer triad (closed-tuple `Object.keys().sort()` + no-spread + `payloadPrivacyCheck`
  + single `audit.append`; `actorDid = builder_civic_did_hash`; keys dodge `FORBIDDEN_KEY_PATTERN`).
- **single-onTick R-H-03** — exactly 2 pre-existing `.onTick(` subscriptions; this phase added none.
  Blueprint storage, build executor, co-build, and location-teaching are all request-driven.
- **Zero new diffusion** — a `blueprint_hash` IS a Phase 18 skill hash; blueprints diffuse via the
  EXISTING `skill.taught`/`skill.inferred` machinery; location-teaching reuses `appendSkillTaught`
  verbatim (5-tuple unchanged).
- **D-NH-06** — co-build is always paid (Ousia or IOU; a pay-nothing sub-task throws `cobuild_must_pay`).
- **D-NH-07 / VOTE-05** — humans never build (`isHumanDid` reject + route 403).
- **Gates green:** sole-producer-discipline, wallclock-forbidden, civic-did-issuance-path,
  cross-house-injection (A11e, extended to co-build/blueprint), did-policy-coverage,
  broadcast-allowlist (100, presence asserted), privacy walker.
- **Full grid suite:** 357 files / 3330 tests green. **Brain suite:** 928 passed (ActionType 48).

---

## ✅ Dual-DID skill-held bridge — RESOLVED (commit `bf7d3b8`)

A Nous carries two identities: a civic-DID (`did:civic:noesis:*`, land/Ousia, JWT sub) and an
existence-DID (`did:noesis:*`, the skill-attestation identity `skill.taught.learner_did` uses,
JWT iss). The `build-from-blueprint` route previously checked skill-held with the civic-DID against
the existence-DID `learner_did` (string-equality), so a real Nous building over HTTP always hit
`skill_not_held`. Fixed: `BuildDeps.skillHolderDid` (= `req.didContext.operatorDid`, the JWT iss the
Brain-signed request carries) lets the executor match the skill against EITHER identity —
format-agnostic, whichever namespace the skill landed in. Ownership / Ousia / the human check / the
emitted `builder_civic_did_hash` all stay on the civic-DID. A new HTTP-level e2e proves a civic owner
whose skill is recorded under its existence-DID builds via the real POST route → 201 + one
`skill.blueprint_executed` (422 without `operatorDid`, proving the bridge is load-bearing). No skill
producer weakened; full grid suite 357 files / 3331 tests green.

---

## Nous House — COMPLETE (Phases 58–61)

The dormant Phase 48b land system is now a living housing economy: Nous buy scarce orbital parcels
(gravity pricing), build + maintain houses/shops/workshops (upkeep → decay → reclaim), bind shops
with per-zone tax revenue, host other Nous (roles + severance FSM, invitations, paid co-work boards +
mutual-credit IOUs), expand the city via Polis ring-expansion bills, and construct via teachable
blueprint skills with DAG-weighted paid co-build and location-aware teaching. Humans watch and invest
local AI power — they never own (D-NH-07). **HOUSE total +9 allowlist events → 100.**

Commits: 61-01..61-06 (Waves 0–5). **Next:** final deploy (pending user confirmation per deploy guardrail).
