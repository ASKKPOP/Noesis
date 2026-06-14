# Phase 61 · Wave 5 (61-06) — HOUSE-4 E2E Definition-of-Done + all gates green

**Status:** ✅ DONE — closes Phase 61 (HOUSE-4 Skill Construction) and the entire Nous House (Phases 58–61).

## What landed

`grid/test/civic/house-4-e2e.test.ts` rewritten from the Wave-0 skip-stub into a real
end-to-end test against a seeded Genesis Core (mirrors `house-3-e2e.test.ts` wiring).

End-to-end scenario proven:
1. **LEARN** — a Nous learns a `blueprint_hash` via the EXISTING `skill.taught` machinery
   (no new event); a `civic_blueprints` recipe holds catalog-kind objects + arrangement DAG +
   `material_cost_bios`.
2. **BUILD** — `builderHoldsSkill` (from the existing skill-event history) → debit
   `material_cost_bios` (Ousia → TREASURY) → `extendInterior` per recipe object → ONE
   `skill.blueprint_executed {blueprint_hash, builder_civic_did_hash, parcel_id, tick}` (hashed
   builder, no recipe body).
3. **NEGATIVE** — `skill_not_held`; insufficient Ousia → 402.
4. **CO-BUILD** — decompose the arrangement DAG (n1 w2 → n2 w1); **funded** (`transferOusia`,
   settlement `ousia`) **and** **IOU** (`recordIou`, settlement `iou`, never free); DAG-weighted
   attribution 2/3 vs 1/3; one `zoning.cowork_session` (participants_hash) + one
   `skill.blueprint_executed` on full completion.
5. **TEACH** — `teachHere` in a workshop diffuses to PRESENT Nous (not absent, not human);
   `skill.taught` 5-tuple unchanged; `parcel_id` off chain.
6. **HUMAN** — build rejected 403 (direct guard + the real HTTP route `humans_cannot_own_land`).
7. **PRIVACY** — walk over the **real run's** `audit.all()`: no recipe body / sub-task content /
   teaching location; hashed DIDs HEX64.

## Verification (independently re-run)

- Full grid suite: **357 files / 3330 tests passed** (34 pre-existing skips, none in HOUSE-4).
- `house-4-e2e` isolated: 2 passed; no active `describe.skip`.
- `audit/broadcast-allowlist`: green; `ALLOWLIST.size === 100`; `skill.blueprint_executed` present.
- Gates: sole-producer-discipline, wallclock-forbidden, civic-did-issuance-path,
  cross-house-injection, did-policy-coverage — all exit 0.
- single-onTick: exactly 2 pre-existing `.onTick(` subscriptions; this wave added none.
- zero-diff R-31-01: only `grid/test/civic/house-4-e2e.test.ts` changed in grid.

## E2E composition note (same pattern as house-3-e2e)

The skill-held BUILD / CO-BUILD / TEACH branches drive the production composition directly
(`buildFromBlueprint` / co-build module fns / `teachHere` with real deps) rather than over HTTP,
because of the **dual-DID gap below**. The HUMAN-rejected branch IS exercised through the real
HTTP route (403).

## ⚠ Flagged follow-up — dual-DID skill-held mismatch (build-from-blueprint route)

The skill machinery records `skill.taught.learner_did` as the **existence-DID**
(`did:noesis:nous:*` — `nous-runner.ts:804` uses `this.nousDid`, the core-registry key). The
`build-from-blueprint` HTTP route (`civic-parcels.ts:272`) passes the **civic-DID**
(`buyerDid`, `did:civic:noesis:*`) into `builderHoldsSkill`, which does a string-equality match
(`learner_did === builderDid`). The two DID forms never string-equal, so a real Nous building
over HTTP would always hit `skill_not_held`. This does NOT break the phase (DoD met, gates green,
non-destructive — the route simply rejects), but the route is functionally inert until the
skill-held check resolves the civic-DID ↔ existence-DID (e.g. via the `tryDid.ts` JWT mapping:
`iss = did:noesis:nous:*`, `sub = did:civic:noesis:*`). **Tracked as a follow-up task; surfaced
to the user for fix-before-deploy vs deploy-then-fix.**

Commit: `fc5f0f4`.
