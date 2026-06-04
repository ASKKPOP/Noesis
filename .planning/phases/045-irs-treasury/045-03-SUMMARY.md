---
phase: 045-irs-treasury
plan: 03
status: complete
completed: 2026-06-03
---

# Phase 45 — Plan 03 Summary (Routes + Doc-Sync)

## Routes registered (3) + ROUTE_DID_POLICY delta (+3)
| Route | Policy |
|-------|--------|
| `GET /api/v1/irs/treasury` | `public` (Cache-Control: public, max-age=10) |
| `POST /api/v1/irs/disburse` | `government_only` (verifyDisbursementAuth, legislation_ref JWT) |
| `GET /api/v1/irs/audit/:period` | `public` (period `<from>-<to>` or `current`) |

`registerIrsRoutes` wired into `buildServer()` (import + `void registerIrsRoutes(app, services)` next to `registerMarketRoutes`).

## Emit-order verification (both layers)
- **Source order (awk):** `appendIrsDisbursementAuthorized` < `store.disburse` < `appendIrsDisbursementExecuted` → **ORDER_OK**.
- **Runtime (it-block):** `irs-routes.test.ts` mints a real ES256 Government JWT, seeds a sufficient treasury balance, asserts `authorizedIdx < executedIdx` on the in-memory audit chain → **passes**.

## ⚠️ Required deviation from plan (defect in plan's STEP A)
The plan specified `civic_did: GOV_SESSION_ISSUER_DID` for the executed event, but `appendIrsDisbursementExecuted` (Phase 41) validates `civic_did` against `CIVIC_DID_RE = /^did:civic:noesis:.../i` (must not change — Pitfall 3). `GOV_SESSION_ISSUER_DID` = `did:gov:noesis:genesis-polis` **fails** that regex → would throw → 500 on the success path. **Resolution:** the disburse route emits `civic_did = 'did:civic:noesis:treasury'` (the civic treasury source). The Government authorizer is still captured (hashed) on `irs.disbursement_authorized`. Recorded as **D-45-06** in STATE.md.

## Test status (deps installed via `npm install` — see env note)
- `irs-routes.test.ts` → **8/8 GREEN** (was RED in Plan 01).
- IRS regression set (allowlist + 2 producers + routes) → **125 passed**.
- TSC (`npx tsc --noEmit`) → **0 errors**.

## Full-suite regression proof (baseline comparison)
The fresh `npm install` shifted the toolchain (vitest 4.1.8 → 2.1.9), surfacing **pre-existing** failures in unrelated route tests (auth `401`-vs-`404`). Measured baseline vs. with-changes to prove Phase 45 is clean:

| | Failed | Passed |
|---|---|---|
| Baseline (HEAD, my work stashed) | 131 | 2741 |
| With Phase 45 changes | 130 | 2765 |

**+24 passing, −1 failing** — Phase 45 introduced **zero** new failures. The 130 failures are pre-existing/environmental (dependency/toolchain), not Phase 45.

## Doc-sync grep counts (all green)
- STATE: `Phase 45 SHIPPED` ×2, `v3.0 Phase 45 close-out (locked 2026-05-28)` ×1, `Current focus … Phase 46` ×1.
- ROADMAP: `[x] **Phase 45: IRS Treasury**` ×1, `3/3 plans complete` ×1, `045-0{1,2,3}-PLAN.md` ×1 each, progress row `| 45. IRS Treasury | 3/3 | Complete` ×1, `fee_bios` ×0, `Running total: **75**` ≥1, `Running total: **74**` ×0, `(72 → 75)` ≥1, `(71 → 74)` ×0.
- REQUIREMENTS: `IRS-0X | 45 | Validated` ×4, `Pending` ×0, `[x] **IRS-0X**` ×4.

## CI gates run
- `check-sole-producer-discipline` → OK (58 sole-producer files incl. new producer).
- `check-did-policy-coverage` → OK (59 inline routes covered, 0 violations — the 3 IRS routes covered).
- `check-civic-did-issuance-path` → OK (Portal-gating invariant preserved).
- `check-no-silent-catch`, `check-wallclock-forbidden`, `check-ws-redaction-zero-diff` (R-31-01) → OK.
- `check-state-doc-sync` → **was stale (hardcoded Phase 43 count 68; red since Phase 44 shipped at 72)**. Brought current to 75 (count literal + required-array + irs.* presence checks + success message). Now **OK**.

## MILESTONES.md
**NOT touched** — Phase 45 is mid-milestone (v3.0). STATE/ROADMAP/REQUIREMENTS sync is sufficient per CLAUDE.md "Phase ships" row.

## Total Phase 45 outcome
Allowlist **72 → 75** · 3 plans · 3 routes · 1 new sole-producer (`append-irs-disbursement-authorized.ts`) · 1 new store class (`IrsStore`) · 1 new auth verifier (`verifyDisbursementAuth`). Next focus: **Phase 46 Government v3**.

## Environment note
Dependencies were **not installed** at session start (`grid/node_modules` partial; no `fastify`/`jose`), so route/integration tests (incl. pre-existing `market-routes`/`p2p-routes`) could not run. Ran `npm install` (1585 packages) to enable them. This is what surfaced the pre-existing toolchain-shifted failures documented above.
