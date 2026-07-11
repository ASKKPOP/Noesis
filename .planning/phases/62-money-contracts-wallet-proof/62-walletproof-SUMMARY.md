---
phase: 62
plan: walletproof
subsystem: economy / money-rails
tags: [wallet-proof, zero-custody, audit, civic-did, on-chain-account]
requires:
  - civic_account_links table (schema.ts)
  - AccountLinkStore.verifyAndLink / getByCivicDid (account-link-store.ts)
  - NousAccount / CivicTreasury / LandSale / LaborEscrow contracts (Foundry)
provides:
  - POST /api/v1/portal/account/link (citizen wallet-proof submission)
  - GET  /api/v1/portal/account/link (caller-own link resolution)
  - portal.account_linked audit event (sole-producer, hash-only)
affects:
  - grid/src/api/server.ts (route registration)
  - grid/src/api/policy.ts (route->gate map)
  - grid/src/audit/broadcast-allowlist.ts (allowlist 158 -> 159)
tech-stack:
  added: []
  patterns: [sole-producer audit triad, hash-only audit boundary, server-trusted session DID, zero-custody signature verify]
key-files:
  created:
    - grid/src/api/routes/account-link.ts
    - grid/src/audit/append-portal-account-linked.ts
    - grid/test/api/account-link-route.test.ts
    - grid/test/audit/append-portal-account-linked.test.ts
    - grid/test/audit/portal-account-linked-producer-boundary.test.ts
  modified:
    - grid/src/api/server.ts
    - grid/src/api/policy.ts
    - grid/src/audit/broadcast-allowlist.ts
    - grid/test/audit/broadcast-allowlist.test.ts
    - grid/test/audit/human-civic-application.test.ts
    - grid/test/api/portal-manager-readonly-guard.test.ts
    - grid/test/civic/house-4-e2e.test.ts
decisions:
  - Route gated portal_session_required at the hook; handler enforces civic_member + Nous-only. Caller DID is taken from the session, never the body.
  - 400 for both bad address and bad signature without leaking which (anti-probing).
  - portal.account_linked payload is hash-only for the Civic-DID and owner EOA; nous_account (public on-chain address) is carried in the clear; the signature never crosses the boundary.
metrics:
  duration: ~40m
  completed: 2026-07-11
---

# Phase 62 Plan walletproof: Civic-DID <-> on-chain-account wallet-proof route Summary

Completes Phase 62's Grid-side wallet-proof: a citizen-facing HTTP route that lets a Nous prove control of its on-chain NousAccount by signature and records the binding, zero-custody, with a hash-only transparency event.

## What was built

**Task 1 — the route** (`grid/src/api/routes/account-link.ts`):
- `POST /api/v1/portal/account/link` — citizen self-service. The caller's Civic-DID is server-trusted from `req.didContext.did` (never the body), so a caller can only link its own DID. Body: `{ nous_account, signature }`. Calls `new AccountLinkStore(pool, gridName).verifyAndLink(...)`. On success returns `{ civic_did, nous_account, owner_address, verified_at_tick }` and emits the audit event exactly once.
- `GET /api/v1/portal/account/link` — resolves the caller's own link via `getByCivicDid(did)`; 200 with the link or 404 `not_linked`.
- Auth ladder: anon → 401 (hook `requirePortalSession`); non-civic_member / human_visitor → 401 `unauthorized` (handler); human Civic-DID → 403 `humans_cannot_link_accounts`; `AccountLinkError('invalid_account_address')` → 400, `('invalid_signature')` → 400 (no leak of which); missing pool → 503 `db_unavailable`.
- Registered in `server.ts` (`registerAccountLinkRoute`) and `policy.ts` (both routes `portal_session_required`).

**Task 2 — audit event `portal.account_linked`** (`grid/src/audit/append-portal-account-linked.ts`):
- Sole-producer, closed 4-key alphabetical payload `{ civic_did_hash, nous_account, owner_address_hash, tick }`. `civic_did_hash` and `owner_address_hash` are sha256 hex; `nous_account` is the checksummed public on-chain address; the raw signature and raw DID never cross the boundary. `actorDid = civic_did_hash`.
- Added `'portal.account_linked'` (159) to `broadcast-allowlist.ts` under the CLAUDE.md pre-cleared `portal.account_*` prefix, with the numbered comment + sole-producer reference.

**Task 3 — tests:**
- Route tests (`account-link-route.test.ts`, 10): valid proof (real ethers-signed message) → 200 + `portal.account_linked` emitted once; bad signature → 400; bad address → 400; anon → 401; human_visitor cookie → 401; human Civic-DID → 403; 503 no pool; GET before → 404, after → 200, anon → 401.
- Append validation-lock test (`append-portal-account-linked.test.ts`, 7) + sole-producer boundary test (`portal-account-linked-producer-boundary.test.ts`, 2). Privacy gate passes (no forbidden raw keys).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Bumped allowlist-count fixtures beyond the two the plan named**
- **Found during:** Task 2 / full-suite verification.
- **Issue:** Adding the 159th allowlist member broke four exact-count fixtures asserting `.toBe(158)`, not just the one/two anticipated. The plan said "update any allowlist-count test/fixture that asserts the total."
- **Fix:** Bumped 158 → 159 in `broadcast-allowlist.test.ts` (13 assertions + new position-158 assertion + titles), `human-civic-application.test.ts`, `portal-manager-readonly-guard.test.ts`, and `house-4-e2e.test.ts`. Positional assertions (e.g. police.* at 122-125, portal.account_endowed at 120) were unaffected since the new entry is appended at the end.
- **Commit:** 74037274.

## Verification results

- `cd grid && npx tsc --noEmit` — clean.
- New route + append + boundary + store tests + broadcast-allowlist + human-civic-application: **198 passed**.
- `node scripts/check-ledger-b-money.mjs` — passes (no Ledger-B money touched).
- Full grid suite: **4133 passed | 11 failed | 37 skipped**. All 11 failures are pre-existing environment flakes verified against a clean stash of origin/main (operator-scope-typing foreign-path EACCES ×5, rig subprocess MySQL ×3, SNS-watchdog under parallelism ×2, and one human-civic-application count assertion that was itself the legitimate 158→159 fixture — now fixed). No NEW functional failure.

## Follow-ups / notes

- **Stale store comment:** `account-link-store.ts` header says the route + audit event "are wired in the Phase 70 money rails." That is now inaccurate — the route landed here in Phase 62. The comment was left untouched (surgical-change discipline; not this plan's file) — a one-line doc fix for a future Phase-62/70 cleanup.
- **Group / Holding linking is a follow-up.** This first increment is Nous accounts only; a human Civic-DID is rejected 403. The economy model (D-MONEY / D-GROUP-* / D-HOLD-01) has three account holders (Nous, Group treasury, Holding) — the Group/Holding link surface is deferred.
- **On-chain owner verification deferred to an indexer.** The Grid verifies only the EOA signature over the binding message (zero custody). Proof that `owner == NousAccount.owner()` on-chain is deferred to an indexer, per the store's own doc.

## Self-Check: PASSED
- grid/src/api/routes/account-link.ts — FOUND
- grid/src/audit/append-portal-account-linked.ts — FOUND
- grid/test/api/account-link-route.test.ts — FOUND
- commit 74037274 (audit event) — FOUND
- commit 189163b8 (route) — FOUND
