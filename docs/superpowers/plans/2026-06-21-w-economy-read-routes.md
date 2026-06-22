# W — Economy read routes (de-orphan the wei rails) — Implementation Plan

> Overnight autonomous · local branch `night/loop-wiring` · **NO push**. REQUIRED SUB-SKILL: superpowers:executing-plans.

**Goal:** De-orphan the last money rails over HTTP (read-only observability): a member sees its **wei account balance** + **civic-labor credit**; anyone sees the **treasury wei balance**. No writes, no wei moves, invariant-safe.

**Architecture:** `registerCivicEconomyRoutes(app, services)` (`services.pool` 503; `req.didContext` civic_member for the per-member reads):
- `GET /api/v1/civic/account` — caller's wei balance via `new NousAccountStore(pool).getBalance(grid, caller)` → `{ civic_did, balance_wei: <string> }`.
- `GET /api/v1/civic/credit` — caller's credit via `new CivicLaborCreditStore(pool).getCredit(grid, caller)` → `{ civic_did, credit_balance: <string> }`.
- `GET /api/v1/civic/treasury` — `new TreasuryWeiStore(pool).getWeiBalance(grid)` → `{ grid, balance_wei: <string> }` (public-readable; the commons fund is transparent).
(bigint → string in JSON.) Register in `server.ts` + policy.ts (account/credit = civic_did_required; treasury = public).

**Invariants:** read-only; de-orphans `NousAccountStore`/`CivicLaborCreditStore`/`TreasuryWeiStore`; allowlist +0; no wei mint/move.

---

## Task 1: routes

- [ ] **Step 1:** Create `grid/src/api/routes/civic-economy.ts` `registerCivicEconomyRoutes` (mirror `civic-dues.ts` auth/503). Convert bigint balances to strings (`.toString()`). 401 if no civic_did on the per-member reads.
- [ ] **Step 2:** Register in `server.ts` + 3 policy.ts entries (account/credit `civic_did_required`; treasury `public`).
- [ ] **Step 3:** Tests `grid/test/api/civic-economy-route.test.ts` (mock pool returning a balance row): account 200 returns balance_wei string; credit 200; treasury 200 (no auth needed); account 401 without auth; no pool 503. Run `npx vitest run test/api/civic-economy-route.test.ts test/api/` + typecheck.
- [ ] **Step 4: Commit LOCALLY (NO push):**
```bash
git add grid/src/api/routes/civic-economy.ts grid/src/api/server.ts grid/src/api/policy.ts grid/test/api/civic-economy-route.test.ts
git commit -m "feat(grid): W economy read routes — account/credit/treasury (de-orphan wei rails)

Read-only observability of the wei rails. Local only.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
Do NOT push.

## Self-Review
Account/credit/treasury readable; per-member reads scoped to caller; treasury public; bigint→string; the 3 wei-rail stores de-orphaned; allowlist +0; local commit only.
