# Phase 60 — Nous House HOUSE-3 Commerce & Co-work — COMPLETION REPORT

**Status:** ✅ COMPLETE · all 8 waves shipped · Definition of Done proven
**Date:** 2026-06-14
**Allowlist delta:** +4 (95 → 99; `zoning.role_granted`, `zoning.role_revoked`, `treasury.structure_revenue`, `zoning.cowork_session`)

---

## Definition of Done — PROVEN

`grid/test/civic/house-3-e2e.test.ts` runs the master-plan HOUSE-3 acceptance scenario
end-to-end against a seeded Genesis Core (built on the Phase 58/59 buy→build→furnish path,
driven through the real HTTP routes + the real commerce/co-work/severance modules composed
exactly as `main.ts`/`market.ts`/`engine.ts` wire them) and passes:

> An owner grants a **staff** role to a second Nous → `zoning.role_granted` (hashed 5-tuple;
> `roleOf === 'staff'`). The owner posts a task to the co-work board; the staff Nous claims +
> completes it. The **funded** path (real HTTP `board/post`→`claim`→`complete`) transfers Ousia
> host→worker (OWNER −50 / STAFF +50, `outstandingFor → 0`); the **unfunded** path records an
> IOU (`completeTask({funded:false, recordIou})` — never free, `outstandingFor(OWNER) === 40`).
> Both emit `zoning.cowork_session` carrying ONLY `{end_tick, parcel_id, participant_count,
> participants_hash, start_tick}` (no board/task text). The owner **binds** a shop + **names** it
> `place://aurora-cafe.genesis`; a sale at the addressed shop emits `treasury.structure_revenue
> {amount_bios:100, parcel_id, tick, zone_tax_bps:1000}` at the zone tax. A **second** attempt to
> register `aurora-cafe` → **409 `place_name_taken`**. A **ring-expansion** bill enacted via
> `gov.law_enacted` (`{action:'seed_ring', ring:4}`) seeds 24 frontier-priced ring-4 parcels —
> idempotent, no audit emit. **Revoking** the staff role drains the IOU ledger (`outstandingFor → 0`)
> then traverses the severance FSM to **ARCHIVED** → `zoning.role_revoked`. A **human**
> (`did:civic:noesis:human:*`) attempting any role grant → **403** (D-NH-07). No raw DID appears in
> any payload (all HEX64); no board/task/scope/place content ever crosses the chain.

---

## Waves

| Wave | Plan | Ships |
|---|---|---|
| 0 | 60-01 | skip-stubs for all HOUSE-3 test surfaces (deferred-import pattern) |
| 1 | 60-02 | `roles.ts` (`ROLE_CAPABILITIES` owner⊇staff⊇guest, `isHumanDid`), `grantRole`/`revokeRole`/`roleOf`, severance FSM scaffolding |
| 2 | 60-03 | `cowork.ts` (CoworkAgreement + task board), `credit-ledger.ts` (IOU record/settle/outstanding + caps), severance ledger-drain |
| 3 | 60-04 | `place-registry.ts` (`place://` uniqueness 409), shop⇄structure binding + `ZONE_TAX_BPS`/`structureRevenueDue` |
| 4 | 60-05 | civic-commerce HTTP routes (roles/invite/bind-shop/name/board) + audit producers (#96–99) |
| 5 | 60-06 | ring-expansion TEMPLATE (consumes `gov.law_enacted`; `seed_ring` + `amend_law`); cross-house-injection CI gate A11e |
| 6 | 60-07 | 8 brain commerce verbs + commerce `my_places`; dashboard commerce surfaces (additive) |
| 7 | 60-08 | HOUSE-3 E2E Definition-of-Done + all gates green |

---

## Invariants & gates (independently re-verified)

- **zero-diff R-31-01** — no chain / persistence-of-chain edits; the 4 events ride new standard
  sole-producer triads (closed-tuple `Object.keys().sort()` + no-spread reconstruction +
  `payloadPrivacyCheck` + single `audit.append`).
- **single-onTick R-H-03** — exactly 2 pre-existing `.onTick(` subscriptions (launcher +
  grid-coordinator); this phase added none. Ring expansion is event-driven off the existing
  governance dispatch; co-work/severance are request-driven.
- **VOTE-05** — ring expansion reuses the Phase 46 bill → co-sponsorship → VOTE-05 → `gov.law_enacted`
  pipeline verbatim; no new governance path or event.
- **D-NH-07** — humans never own/staff land; `isHumanDid` rejection on role grant (403).
- **Gates green:** sole-producer-discipline, wallclock-forbidden, civic-did-issuance-path,
  **cross-house-injection (NEW A11e)**, broadcast-allowlist (99, all 4 members asserted),
  privacy walker (no `FORBIDDEN_KEY_PATTERN` match; no content broadcast).
- **Full grid suite:** 349 files / 3277 tests green.

---

## Decisions / discrepancies

- **`reason` enum on revoke:** the route emits `reason:'owner_revoked'` (`civic-parcels.ts:638`),
  not the plan's misnamed `'severance_complete'`. Per R6 (no-rewrite) the E2E asserts the real
  emitted value. `'severance_complete'` remains a valid, currently un-emitted enum member.
- **E2E composition for un-mockable paths:** `treasury.structure_revenue` (needs full
  `MarketplaceStore`) and `gov.law_enacted` (needs the proposal/ballot/tally engine) are exercised
  by composing the EXACT production paths (`getByOwner`→`structureRevenueDue`→`transferOusia`→
  `appendTreasuryStructureRevenue`; `ring-expansion.onLawEnacted`) — the same pattern house-2-e2e
  uses to drive `onUpkeepTick` directly. No source edited.

---

## Side-fix

- brain `ananke` ActionType count 34→44 orphan (`a6dcb00`) — Phase 59 (+2 interior) / Phase 60
  (+8 commerce) grew the closed enum; the targeted verb tests never exercised the count assertion.
  Full brain suite now 904 passed.

---

## Open task chips (carried)

- `whisper.tsx` + `inspector.test.tsx` + `delete-flow.test.tsx` — the user's own separate session
  (out-of-scope for every grid wave; never touched).
- flaky skill-producer-boundary — temp-file race with the civic-did-issuance gate test; passes in isolation.

Commits: 60-01..60-07 (Waves 0–6) + `d2068cd` (Wave 7 E2E) + `a6dcb00` (brain count side-fix).
**Next:** Phase 61 HOUSE-4 Skill Construction (allowlist +1 → 100, `skill.blueprint_executed`).
