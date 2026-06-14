# Phase 60 · Wave 0 (60-01) — HOUSE-3 TDD Skip-Stub Scaffold — SUMMARY

**Status:** COMPLETE. 13 new `describe.skip` test files locking every HOUSE-3 contract; the
broadcast-allowlist count suites moved 95 → 99 (EXPECTED-RED until Wave 4 / 60-05). Zero
`grid/src` changes — the allowlist SOURCE stays at 95 by design.

## What landed

### 13 new skip-stub test files (every block `describe.skip` → reported SKIPPED)

| File | Coverage | REQ |
|------|----------|-----|
| `grid/test/civic/roles.test.ts` | closed `ROLE_CAPABILITIES` (owner ⊇ staff ⊇ guest); `grantRole`/`revokeRole`/`roleOf`; RoleEdge anchored to Civic-DID (re-grant resumes trust_score); owner edge implicit from `ownerDid`; `did:civic:noesis:human:*` rejected; trust_score derived | R-60-02 |
| `grid/test/civic/severance.test.ts` | FSM `ACTIVE→NOTICE→SETTLEMENT→WIND_DOWN→REVOKE→ARCHIVED`; SETTLEMENT drains IOUs before REVOKE; capabilities removed only at REVOKE; edge retained at ARCHIVED (never hard kill); for-cause short-circuits to SETTLEMENT | R-60-03 |
| `grid/test/civic/credit-ledger.test.ts` | `recordIou`/`settleIou`/`outstandingFor`; auto-net on payment + counter-IOU; per-pair + global caps; v1 bookkeeping (no interest, no transfer); recording emits nothing on chain | R-60-07 |
| `grid/test/civic/cowork.test.ts` | `CoworkAgreement` dual-DID schema; board post/claim/complete; completion ALWAYS settles (Ousia or IOU, never free); pays-nothing throws; `zoning.cowork_session` closed 5-tuple with `participants_hash` only | R-60-08 |
| `grid/test/civic/place-registry.test.ts` | `registerPlace` → `place://<name>.<grid>`; duplicate → `place_name_taken` (409); `registered_tick` not `Date.now()`/`registeredAt`; raw names off chain | R-60-09 |
| `grid/test/civic/ring-expansion.test.ts` | `onLawEnacted` consumes existing `gov.law_enacted`; `{action:'seed_ring', ring:N}` → `seedZone` (idempotent, no audit emit); same hook amends `ZONE_TAX_BPS`/`UPKEEP_RATE_BPS`; non-template body ignored; no new allowlist event | R-60-10 |
| `grid/test/civic/shop-binding.test.ts` | `bindShop` owner-only + structure type `shop`; `structureRevenueDue = floor(amount * ZONE_TAX_BPS[zone] / 10000)` (business 1200 / shopping 1000 / manufacture 900 / residential 500); `unbindShop` routes through severance FSM | R-60-05, R-60-06 |
| `grid/test/api/civic-commerce-routes.test.ts` | bind/unbind-shop, name, invite, roles grant/revoke, board post/claim/complete; owner/staff/guest authorization; humans rejected from role grants; place duplicate → 409 | R-60-04/05/08/09 |
| `grid/test/audit/append-zoning-role-granted.test.ts` | closed 5-tuple `{grantor_civic_did_hash, holder_civic_did_hash, parcel_id, role, tick}`; role ∈ {staff,guest}; `actorDid = grantor_civic_did_hash`; HEX64; closed-tuple + privacy | R-60-11 |
| `grid/test/audit/append-zoning-role-revoked.test.ts` | closed 4-tuple `{holder_civic_did_hash, parcel_id, reason, tick}`; reason ∈ {owner_revoked,for_cause,severance_complete}; `actorDid = parcel_id` | R-60-11 |
| `grid/test/audit/append-treasury-structure-revenue.test.ts` | closed 4-tuple `{amount_bios, parcel_id, tick, zone_tax_bps}`; `actorDid = parcel_id` (mirrors #83 — NO buyer/seller DID) | R-60-06, R-60-11 |
| `grid/test/audit/append-zoning-cowork-session.test.ts` | closed 5-tuple `{end_tick, parcel_id, participant_count, participants_hash, start_tick}`; `participants_hash` HEX64; NO raw DIDs/board text | R-60-08, R-60-11 |
| `grid/test/civic/house-3-e2e.test.ts` | full HOUSE-3 scenario: grant staff → post/claim/complete co-work → settle/IOU → cowork_session; bind+name shop → sale → structure_revenue; duplicate name 409; ring-expansion via `gov.law_enacted`; revoke via severance to ARCHIVED; humans rejected | R-60-02..11 |

All stubs use the Phase 58/59 **deferred-dynamic-import** pattern: not-yet-existing symbols are
loaded via `await import(...)` inside the `describe.skip` body so module resolution is deferred
until the suite is un-skipped by its owning wave.

### 2 updated count suites (95 → 99, EXPECTED-RED)

- `grid/test/audit/broadcast-allowlist.test.ts` — all 9 `.toBe(95)` → `.toBe(99)` (both
  `ALLOWLIST.size` and `ALLOWLIST_MEMBERS.length`); new `Phase 60 (HOUSE-3 / D-60-09)` describe
  block with presence assertions for `zoning.role_granted`, `zoning.role_revoked`,
  `treasury.structure_revenue`, `zoning.cowork_session`. Events 82–95 ordering untouched.
- `grid/test/audit/human-civic-application.test.ts` — the lone count assertion `.toBe(95)` →
  `.toBe(99)` in lockstep.

## EXPECTED-RED — by design, green at Wave 4 (60-05)

`npm run test -- audit/broadcast-allowlist` is **RED at 99**: 13 failing assertions (9 count
assertions now expecting 99 + the 4 Phase 60 presence assertions). This is the intended drift
guard — the allowlist SOURCE (`grid/src/audit/broadcast-allowlist.ts`) is still at **95**, and
Wave 0 makes **zero `grid/src` changes**. Wave 4 / 60-05 lands the 4 members under the
pre-cleared `zoning.*`/`treasury.*` prefixes and turns this suite GREEN at 99.

Do NOT "fix" this suite by adding members to the source during Wave 0–3.

## Self-check (verbatim)

- 13 stub suites: **13 skipped (13) / 95 tests skipped** — exit 0.
- `npm run test -- audit/broadcast-allowlist`: **1 failed / 13 failed | 102 passed** — EXPECTED-RED at 99.
- `git status --short grid/src`: **empty** (zero source changes).
- `grep -rc "toBe(95)" grid/test/audit/broadcast-allowlist.test.ts grid/test/audit/human-civic-application.test.ts`: **0 / 0**.
- `grep -rc "toBe(99)" …`: broadcast = **9**, human-civic = **1**.
- 4 presence assertions present in broadcast-allowlist.test.ts.

### Note: residual `toBe(95)` in `health-detailed-route.test.ts`

Two `toBe(95)` remain in `grid/test/health-detailed-route.test.ts` (lines 336–337:
`persisted_max_id`/`in_memory_length`). These are **audit-chain length / id-95 assertions,
unrelated to the broadcast-allowlist member count** — they describe a chain holding 95 entries,
not the allowlist size. Bumping them to 99 would falsely break OBS health-divergence tests.
Per the surgical-changes invariant they were left untouched; only the allowlist-count suites
moved 95 → 99.

---
*Wave 0 of 8 · 60-01 · TDD skip-stub scaffold · committed nothing (autonomous-execution rule).*
