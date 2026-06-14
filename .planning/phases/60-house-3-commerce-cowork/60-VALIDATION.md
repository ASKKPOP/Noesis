---
phase: 60
slug: house-3-commerce-cowork
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-14
---

# Phase 60 — Validation Strategy

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
| 60-01-01 | 01 | 0 | R-60-02/03/05/07/08/09/10 | Wave 0 civic stubs prevent silent plan execution | unit | `npm run test -- civic/roles civic/severance civic/credit-ledger civic/cowork civic/place-registry civic/ring-expansion civic/shop-binding` | ❌ Wave 0 | ⬜ pending |
| 60-01-02 | 01 | 0 | R-60-04/06/08/11/12 | Allowlist moved to 99 (+presence) + commerce-route + 4 sole-producer stubs locked before impl | unit | `npm run test -- api/civic-commerce-routes audit/broadcast-allowlist` | ✅ allowlist exists | ⬜ pending (allowlist EXPECTED-RED until Wave 4) |
| 60-02-01 | 02 | 1 | R-60-01/02 | Migration v40 (3 tables + bound_shop_id); roles = typed edges; owner implicit; humans rejected | unit | `npm run test -- civic/roles` | ❌ Wave 0 | ⬜ pending |
| 60-02-02 | 02 | 1 | R-60-03 | Severance FSM never a hard kill; SETTLEMENT drains IOUs; for-cause short-circuit + dispute flag | unit | `npm run test -- civic/severance` | ❌ Wave 0 | ⬜ pending |
| 60-03-01 | 03 | 2 | R-60-07 | IOU ledger bilateral bookkeeping (no interest/transfer); caps; auto-net; recording emits nothing | unit | `npm run test -- civic/credit-ledger` | ❌ Wave 0 | ⬜ pending |
| 60-03-02 | 03 | 2 | R-60-08 | Cowork Agreement dual-DID; board post/claim/complete; completion ALWAYS settles (never free) | unit | `npm run test -- civic/cowork` | ❌ Wave 0 | ⬜ pending |
| 60-04-01 | 04 | 3 | R-60-05/06 | Shop binding (owner+type shop); ZONE_TAX_BPS + structureRevenueDue only in founding-law; settlement skim | unit | `npm run test -- civic/shop-binding` | ❌ Wave 0 | ⬜ pending |
| 60-04-02 | 04 | 3 | R-60-09 | place:// NDS uniqueness + 409; registered_tick (NOT Date.now()); wallclock gate green | unit+gate | `npm run test -- civic/place-registry` + `node scripts/check-wallclock-forbidden.mjs` | ❌ Wave 0 | ⬜ pending |
| 60-05-01 | 05 | 4 | R-60-11 | 4 sole producers (closed tuples, no-spread, payloadPrivacyCheck, single append); allowlist 95->99 GREEN | unit+gate | `npm run test -- audit/append-zoning-role-granted audit/append-zoning-role-revoked audit/append-treasury-structure-revenue audit/append-zoning-cowork-session audit/broadcast-allowlist` + `node scripts/check-sole-producer-discipline.mjs` | ✅ allowlist exists | ⬜ pending (turns GREEN here) |
| 60-05-02 | 05 | 4 | R-60-04/12 | Commerce/role/cowork/place/invite routes; ROUTE_DID_POLICY coverage; humans rejected; invite mints guest edge | unit+gate | `npm run test -- api/civic-commerce-routes` + `node scripts/check-did-policy-coverage.mjs` | ❌ Wave 0 | ⬜ pending |
| 60-06-01 | 06 | 5 | R-60-10 | Ring-expansion TEMPLATE consumes gov.law_enacted (no new path/event); Polis amendment hook | unit | `npm run test -- civic/ring-expansion` | ❌ Wave 0 | ⬜ pending |
| 60-06-02 | 06 | 5 | R-60-12 | NEW cross-house-injection gate (A11e): visitor/board content is DATA never instructions | gate | `node scripts/check-cross-house-injection.mjs` | ❌ new | ⬜ pending |
| 60-07-01 | 07 | 6 | R-60-13 | Commerce verbs are capabilities; my_places surfaces bound-shop/place/roles/outstanding IOU | unit | `cd brain && .venv/bin/pytest test/test_civic_commerce_verbs.py` | ❌ new | ⬜ pending |
| 60-07-02 | 07 | 6 | R-60-14 | Dashboard surfaces (shop badge + place name, roles, board, IOU strip) additive | unit | `cd dashboard && npm run test:unit -- commerce-surfaces` | ❌ new | ⬜ pending |
| 60-08-01 | 08 | 7 | R-60-04/06/08/10/11 | E2E DoD: grant role -> co-work settle/IOU -> cowork_session; bind+name shop -> sale -> structure_revenue; 409; ring; revoke via severance; humans rejected | integration | `npm run test -- civic/house-3-e2e` | ❌ new | ⬜ pending |
| 60-08-02 | 08 | 7 | R-60-15 | All gates green + 0 remaining describe.skip; single-onTick; zero-diff; cross-house-injection | gate | `cd grid && npm run test` + gate scripts | ✅ existing gates | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `grid/test/civic/roles.test.ts` — stub for R-60-02 (typed edges; closed ROLE_CAPABILITIES; owner implicit; humans rejected; trust_score derived)
- [ ] `grid/test/civic/severance.test.ts` — stub for R-60-03 (FSM ACTIVE→NOTICE→SETTLEMENT→WIND_DOWN→REVOKE→ARCHIVED; drain IOUs; for-cause short-circuit; never a hard kill)
- [ ] `grid/test/civic/credit-ledger.test.ts` — stub for R-60-07 (bilateral bookkeeping; caps; auto-net; no interest/transfer; recording emits nothing)
- [ ] `grid/test/civic/cowork.test.ts` — stub for R-60-08 (dual-DID Agreement; board post/claim/complete; completion ALWAYS settles, never free)
- [ ] `grid/test/civic/place-registry.test.ts` — stub for R-60-09 (place:// uniqueness + place_name_taken; registered_tick not Date.now())
- [ ] `grid/test/civic/ring-expansion.test.ts` — stub for R-60-10 (TEMPLATE consumes gov.law_enacted; seed_ring + amend_law; no audit emit; no new allowlist event)
- [ ] `grid/test/civic/shop-binding.test.ts` — stub for R-60-05/06 (bind owner+type shop; structureRevenueDue zone tax; unbind via severance)
- [ ] `grid/test/api/civic-commerce-routes.test.ts` — stub for R-60-04 (bind/unbind/name/invite/roles/board routes; owner/staff/guest authz; humans rejected; 409 duplicate)
- [ ] `grid/test/audit/append-zoning-role-granted.test.ts` — stub for R-60-11/12 (closed 5-tuple; actorDid=grantor_civic_did_hash; role∈{staff,guest})
- [ ] `grid/test/audit/append-zoning-role-revoked.test.ts` — stub for R-60-11/12 (closed 4-tuple; actorDid=parcel_id; reason enum)
- [ ] `grid/test/audit/append-treasury-structure-revenue.test.ts` — stub for R-60-11/12 (closed 4-tuple; actorDid=parcel_id; mirrors #83)
- [ ] `grid/test/audit/append-zoning-cowork-session.test.ts` — stub for R-60-11/12 (closed 5-tuple; participants_hash HEX64; no raw DIDs/board text)
- [ ] `grid/test/civic/house-3-e2e.test.ts` — stub for the full HOUSE-3 DoD scenario

*Existing `grid/test/audit/broadcast-allowlist.test.ts` is UPDATED in Wave 0 — every `.toBe(95)` → `.toBe(99)` plus presence assertions for the 4 new members. It is EXPECTED-RED at 99 until Wave 4 lands the members; do NOT revert the count. Any sibling count suite (e.g. `human-civic-application.test.ts`) moves 95→99 in lockstep.*

---

## Definition of Done (master-plan acceptance scenario)

Phase 60 is DONE when this single scenario passes end-to-end in `grid/test/civic/house-3-e2e.test.ts` and the gates below are green:

1. **Grant a role** — an owner grants a **staff** role to a second Nous; the trail shows `zoning.role_granted {grantor_civic_did_hash, holder_civic_did_hash, parcel_id, role:'staff', tick}` (no raw DIDs); `roleOf === 'staff'`; capabilities flow from the edge. A **human** (`did:civic:noesis:human:*`) attempting any role grant is **rejected** (VOTE-05 / D-NH-07).
2. **Work a co-work board** — the owner posts a task to the `task_board`; the staff Nous claims + completes it. Completion **ALWAYS settles** (D-NH-06): Ousia via `transferOusia` when funded, or a mutual-credit **IOU** when not — never free. The trail shows `zoning.cowork_session {end_tick, parcel_id, participant_count, participants_hash, start_tick}` (participants_hash only — no board/task text).
3. **Shop sale → structure revenue** — the owner binds a `shop` structure (`bind-shop`) and names it `place://aurora-cafe.genesis` (`name`); a sale at the addressed shop (Phase 44 `confirm-settlement`) emits `treasury.structure_revenue {amount_bios, parcel_id, tick, zone_tax_bps}` at the per-zone tax rate (streaming, never filed).
4. **Place name conflict** — a second attempt to register `aurora-cafe` → **409 `place_name_taken`** (Grid-side uniqueness; raw name off chain).
5. **Ring expansion** — a bill enacted via the EXISTING Phase 46 `gov.law_enacted` (`{action:'seed_ring', ring:N}`) seeds a new ring at frontier prices (Phase 58 `seedZone` + gravity, idempotent, **no audit emit**); VOTE-05 + the bill pipeline are reused verbatim; **no new allowlist event**.
6. **Severance revoke** — revoking the staff role **drains the IOU ledger** (`outstandingFor` → 0) THEN traverses the severance FSM to **ARCHIVED**; the trail shows `zoning.role_revoked {holder_civic_did_hash, parcel_id, reason:'severance_complete', tick}`; the edge is retained as history (never a hard kill).
7. **Privacy** — no board/task/scope/place CONTENT appears in any payload (only hashes/counts/enums/ticks); all DIDs hashed HEX64 (or the aggregated `participants_hash`).
8. **Commerce surfaces** — the orbital map at `/worldmap/orbital` shows the shop badge + place name, the roles panel, the co-work board panel, and the IOU strip (additive beside the Phase 58/59 viewers).

### Gate checklist (all must be green)

- [ ] `broadcast-allowlist.test.ts` asserts `ALLOWLIST.size === 99` and `ALLOWLIST_MEMBERS.length === 99` (delta **+4**; the 4 named events added under `zoning.*`/`treasury.*`; events 82–95 untouched) + presence assertions for all 4. Any sibling count suite (e.g. `human-civic-application.test.ts`) GREEN at 99.
- [ ] Migration **v40** creates `civic_parcel_roles`, `civic_credit_ledger`, `civic_cowork_agreements` and ALTERs `civic_parcels` ADD `bound_shop_id`; applies cleanly on top of shipped v39; down migration drops the 3 tables + column. v40 is the next free version after v39.
- [ ] Roles are typed edges anchored to Civic-DIDs (not sessions); `ROLE_CAPABILITIES` is a closed table; owner implicit from `ownerDid`; `grantRole` rejects `did:civic:noesis:human:*` (VOTE-05/D-NH-07); `trust_score` derived from settlement history.
- [ ] Severance FSM ACTIVE→NOTICE→SETTLEMENT→WIND_DOWN→REVOKE→ARCHIVED is never a hard kill; SETTLEMENT drains outstanding IOUs before REVOKE; for-cause short-circuits to SETTLEMENT with a dispute flag; `revokeRole` + `unbind-shop` route through it.
- [ ] D-NH-06 honored: every completed Cowork Agreement settles in Ousia (when funded) or records a mutual-credit IOU (when not) — a co-work completion that pays nothing throws; the IOU ledger is v1 bookkeeping (no interest, no transferability) with per-pair + global caps.
- [ ] Structure revenue uses `ZONE_TAX_BPS` (business 1200/shopping 1000/manufacture 900/residential 500) living ONLY in `founding-law.ts` (single Polis-amendable patch point); the Phase 44 `confirm-settlement` path skims the zone tax to `TREASURY_DID` via `transferOusia` for a parcel-bound shop and emits `treasury.structure_revenue`.
- [ ] place:// NDS registry is Grid-side and tick-based (`registered_tick`, NOT `Date.now()`); the protocol `nous://` DomainRegistry is untouched; uniqueness conflict → 409 `place_name_taken`; `scripts/check-wallclock-forbidden.mjs` green.
- [ ] Ring expansion is a TEMPLATE consuming existing Phase 46 `gov.law_enacted` (no new governance path, VOTE-05 reused verbatim, seeder emits no audit, NO new allowlist event); the same body-parse hook supports Polis amendment of `UPKEEP_RATE_BPS`/`ZONE_TAX_BPS`.
- [ ] Each of the 4 events has a dedicated sole-producer `append-*.ts` (closed-tuple `Object.keys().sort()` check, no-spread reconstruction, `payloadPrivacyCheck`, single `audit.append`); `node scripts/check-sole-producer-discipline.mjs` exits 0.
- [ ] Closed tuples match exactly: `role_granted {grantor_civic_did_hash, holder_civic_did_hash, parcel_id, role, tick}` (role∈{staff,guest}); `role_revoked {holder_civic_did_hash, parcel_id, reason, tick}`; `structure_revenue {amount_bios, parcel_id, tick, zone_tax_bps}`; `cowork_session {end_tick, parcel_id, participant_count, participants_hash, start_tick}`.
- [ ] Privacy walker: no payload key matches `FORBIDDEN_KEY_PATTERN`; DIDs hashed HEX64; board/task/scope/place content never broadcast; privacy-walker gate green.
- [ ] NEW `scripts/check-cross-house-injection.mjs` (A11e) exits 0: visitor/board/scope content entering a House channel is DATA, never instructions (no escalation into Telos/Charter commands).
- [ ] New routes (bind-shop, unbind-shop, name, roles grant/revoke, invite, board post/claim/complete) have `ROUTE_DID_POLICY` entries; `node scripts/check-did-policy-coverage.mjs` exits 0; humans rejected from role grants; invite appends the entry allowlist AND mints a guest role edge.
- [ ] Brain verbs `grant_role`/`revoke_role`/`invite`/`bind_shop`/`name_place`/`post_task`/`claim_task`/`complete_task` dispatch to the Grid as capabilities; `my_places` surfaces bound-shop/place name/role grants/outstanding IOU; no autoplay.
- [ ] Dashboard `/worldmap/orbital` surfaces (shop badge + place name, roles panel, co-work board panel, IOU strip) are additive beside the Phase 58/59 exterior + interior viewers.
- [ ] Single-onTick (R-H-03): no new `clock.onTick` subscription — `grep -rn "clock.onTick" grid/src | wc -l` shows exactly 1.
- [ ] Zero-diff R-31-01: no chain / persistence-of-chain code edited; `civic-did-issuance-path` gate untouched-green.
- [ ] All Phase 60 Wave-0 skip-stubs are un-skipped (no remaining `describe.skip` in Phase 60 test files).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Commerce surfaces render on the orbital map | R-60-14 | Browser rendering required | 1. Start the dashboard dev server. 2. Navigate to `/worldmap/orbital`. 3. Click an owned shop module — confirm the `place://` name + bound-shop badge render. 4. Confirm the roles panel lists staff/guest edges + trust, the co-work board panel shows posted/claimed/completed tasks, and the IOU strip shows outstanding balances. 5. Confirm `/worldmap`, the Phase 58 orbital exterior, and the Phase 59 interior viewer are unchanged. |
| Commercial relationships surface in the Nous prompt | R-60-13 | Requires a live brain run with owned land + roles | 1. Run the brain against a Nous owning a bound shop with a granted staff edge and an outstanding IOU. 2. Inspect the assembled system prompt — confirm the `my_places` block names the bound-shop status, place name, active role grants, and outstanding IOU balance. 3. Confirm the verbs are capabilities (no autoplay loop fires them). |
| Co-work settles or records an IOU end-to-end | R-60-08 | Requires a live grid run with two funded/unfunded Nous | 1. Boot the grid with a host owner and a worker Nous. 2. Post → claim → complete a task with the host FUNDED — confirm `transferOusia` moves Ousia. 3. Repeat with the host UNFUNDED — confirm an IOU is recorded (never free). 4. Confirm `zoning.cowork_session` carries only `participants_hash`/counts/ticks. |
| Ring-expansion bill seeds a new ring | R-60-10 | Requires a live governance run enacting a bill | 1. Author + co-sponsor + pass (VOTE-05) a bill whose body is `{action:'seed_ring', ring:N}`. 2. Confirm `gov.law_enacted` fires and the new ring is seeded at frontier prices. 3. Re-enact the same bill — confirm idempotency (no duplicate parcels) and NO audit event from the seeder. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every Per-Task Verification Map row carries an automated command)
- [x] Wave 0 covers all MISSING references (incl. the allowlist move to 99, expected-RED until Wave 4)
- [x] No watch-mode flags
- [x] Feedback latency < 50s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
