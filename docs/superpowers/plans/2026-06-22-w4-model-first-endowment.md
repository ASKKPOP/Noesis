# W4 — Model-first endowment (live wei source)

**Date:** 2026-06-22
**Decision authority:** operator chose *Model-first endowment* (the three W4 paths were
Model-first / On-chain-first / Labor-only). This bends locked axiom **D-MONEY-01**
("no internal mint") in a *bounded, ledgered, audited, operator-gated, temporary* way,
recorded as new decision **D-MONEY-09**.

## Why

The wei economy is airtight: `nous_accounts.balance_wei` starts at zero and there is no
inflow path (verified — no faucet/mint in the wei rails). So `CivicDueStore.payWithWei`
can never succeed, the treasury never fills, and procurement/RFP awards can never pay out.
The W1–W3 loop *runs* but money cannot *move*. Model-first endowment is the single inflow
that lights up the whole chain:

```
endow → member account → pay dues → treasury → RFP award → escrow → worker account
```

Endowing the **account** (not the treasury directly) is deliberate: it lights the entire
loop, whereas endowing only the treasury would leave dues unpayable.

## The bounded bend (four constraints)

1. **Ledgered.** Migration v54 `account_endowments`. Every endowment is one row. The ledger
   is the conservation record: every endowed wei traces to a recorded row. This is also the
   **on-chain retirement path** — when settlement (D-MONEY-02) lands, each row maps 1:1 to a
   real Sepolia deposit proof and the model-first source is retired.
2. **Bounded.** Per-call cap `MODEL_ENDOWMENT_CAP_WEI = 1e18` (1 ETH-equiv); per-account
   lifetime cap `MODEL_ENDOWMENT_ACCOUNT_CAP_WEI = 10e18`. Both enforced inside the
   transaction (aggregate SUM under FOR UPDATE) and tested.
3. **Gated.** `GRID_ENDOWMENT_ENABLED` (off by default → 503 `endowment_disabled`, handler
   never wired, mirrors `portal-manager.ts`). Route policy `portal_session_required` +
   in-handler `operatorScope()` (server-trusted operatorDid, never header-spoofable) +
   secondary `x-operator-tier >= 5` defense-in-depth.
4. **Audited.** New sole-producer event `portal.account_endowed` (allowlist **#121**, under
   the CLAUDE.md pre-cleared `portal.account_*` prefix). Closed-tuple payload
   `{ amount_wei, civic_did_hash, endowment_id, source, tick }` (alphabetical, privacy-clean —
   dodges FORBIDDEN_KEY_PATTERN). `reason` + `operator_did` are ledger-only, never on-chain.

## Files

**Production**
- `grid/src/db/schema.ts` — migration v54 `create_account_endowments`
- `grid/src/economy/endowment-store.ts` — `EndowmentStore.endow()` (atomic: cap-check → ledger insert → `creditAccountOnConn` → audit)
- `grid/src/audit/append-portal-account-endowed.ts` — sole producer
- `grid/src/audit/broadcast-allowlist.ts` — add `'portal.account_endowed'` (121)
- `grid/src/api/routes/account-endowment.ts` — `POST /api/v1/portal/account/endow`, flag-gated
- `grid/src/api/policy.ts` — route policy entry
- `grid/src/api/server.ts` — register route

**Tests (written first)**
- `grid/test/economy/endowment-store.test.ts`
- `grid/test/audit/append-portal-account-endowed.test.ts`
- `grid/test/audit/portal-account-endowed-producer-boundary.test.ts`
- `grid/test/api/account-endowment-route.test.ts`
- `grid/test/civic/house-4-e2e.test.ts` — bump `ALLOWLIST_MEMBERS.length` 120 → 121

## Deferred (documented, not forgotten)

- **`*_bios`→wei rename** — already locked as **D-MONEY-07**; a separate, risky migration
  across marketplace/parcel/labor/recipe. Not needed for money to move (wei rails already use
  `balance_wei`/`amount_wei`).
- **Retiring the Ousia faucet** — the wei economy has no active faucet; legacy civic
  credit-ledger Ousia is a separate retirement.

## Doc-sync (same turn)

decisions.md (D-MONEY-09), economy.md (model-first endowment section + retirement path),
docs/spec/economy.md, CLAUDE.md allowlist note (→121), .planning/{money-migration-plan,STATE,
ROADMAP}, docs/TASK-LOG.html, .planning/nous-spec-coverage.md.
