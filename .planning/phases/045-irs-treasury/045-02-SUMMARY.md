---
phase: 045-irs-treasury
plan: 02
status: complete
completed: 2026-06-03
---

# Phase 45 — Plan 02 Summary (Audit + Service Layer)

## Allowlist before/after
- **72 → 75.** Added at indices 72/73/74: `irs.tax_collected` (73), `irs.disbursement_authorized` (74, NEW), `irs.disbursement_executed` (75).
- Header comment updated: "exactly these 72 event types" → "75"; "+ Phase 44" → "+ Phase 44 + Phase 45".

## Files created vs modified
| File | Action |
|------|--------|
| `grid/src/audit/broadcast-allowlist.ts` | Modified — +3 IRS entries + header |
| `grid/src/audit/append-irs-disbursement-authorized.ts` | **Created** — sole-producer, 9-step discipline, closed 5-key tuple |
| `grid/src/irs/irs-store.ts` | **Created** — `IrsStore` (getTreasuryBalance, disburse w/ FOR UPDATE, getAuditHistory w/ explicit `event_type IN`) |
| `grid/src/civic-registry/government-session.ts` | Modified — appended `verifyDisbursementAuth`; `verifyGovernmentSession` untouched |

## Test fixes folded into Plan 02 (Plan 01 RED-gate gaps)
Two assertions in Plan 01's scaffolds were inconsistent with the production contract; both corrected:
1. **broadcast-allowlist.test.ts** — Phase 44 test `'irs.tax_collected is NOT on allowlist'` flipped to `IS on allowlist as of Phase 45` (the D-44-03 audit-chain-only invariant was explicitly time-boxed "until Phase 45"; Phase 45 promotes it).
2. **append-irs-disbursement-authorized.test.ts** — "rejects missing key" changed from `toThrow(/closed-tuple/)` to `toThrow(TypeError)`, matching the established codebase convention in `append-irs-tax-collected.test.ts`: a missing *validated* key trips its per-field guard before the closed-tuple check, so the contract is a generic `TypeError`. (Extra key still → `/closed-tuple/`.)

## Regression status — all GREEN
- `broadcast-allowlist.test.ts` + `append-irs-disbursement-authorized.test.ts` (10 it-blocks) + `append-irs-tax-collected.test.ts` → **117 passed**.
- `irs-routes.test.ts` → still RED (Plan 03 wires the routes).
- `append-irs-disbursement-executed.test.ts` → **does not exist on disk** (VALIDATION.md's "Phase 41 created ✅" was inaccurate). The producer `append-irs-disbursement-executed.ts` exists and was **not modified** (Pitfall 3 preserved), so there is no regression risk; flagged for the verification record.

## TSC status
`npx tsc --noEmit -p tsconfig.json` → **0 errors** (whole grid package).

## Pitfall encountered — `audit_trail.created_at` vs tick
`audit_trail` has **no simulation-tick column**; `created_at` is `BIGINT NOT NULL`, populated by `AuditChain.append` with `Date.now()` (**millisecond epoch**, not a tick). `getAuditHistory` filters `created_at` by the `[fromTick, toTick]` params **as provided** — kept per the plan's SQL (route tests mock the pool, so this is not test-gating). **Carry-forward to Plan 03:** the `/irs/audit/:period` route owns `:period` → range semantics; if period is expressed in ticks it will not line up with epoch-ms `created_at` in production. Plan 03 should either translate period→epoch range or document the limitation. Schema columns otherwise matched the plan exactly (civic_treasury: grid_name/balance_bios BIGINT/last_updated_tick INT; grid_config: config_key/config_value JSON).

## Pitfalls honored
- Pitfall 1 — config (`irs_fee_rate`) read OUTSIDE the transaction.
- Pitfall 3 — `irs.disbursement_executed` payload shape untouched.
- Pitfall 4 — explicit `event_type IN (?, ?, ?)`; zero `LIKE 'irs.%'` in SQL (only in warning comments).
