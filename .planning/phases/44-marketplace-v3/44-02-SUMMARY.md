---
phase: 44
plan: "02"
subsystem: grid/src/marketplace, grid/src/db
tags: [marketplace, db, escrow, irs-fee, atomic-transaction, tdd]
status: complete
completed_at: 2026-05-28T06:00:36Z
key-files:
  created:
    - grid/src/marketplace/marketplace-store.ts
  modified:
    - grid/src/db/schema.ts
    - grid/test/marketplace-store.test.ts
---

# Phase 44 Plan 02: DB Migrations + MarketplaceStore

## What was built

3 DB migrations (v33-v35) adding 6 tables for the Marketplace v3 civic commerce layer:
- **v33**: `marketplace_listings`, `marketplace_bids`, `marketplace_escrow`
- **v34**: `marketplace_disputes`, `police_investigations`
- **v35**: `civic_treasury` + grid_config seed (`irs_fee_rate=0.02`, `market_settlement_timeout_ticks=7`)

`MarketplaceStore` class with 10 methods implementing all MKT-01..05 requirements.

## Key invariants implemented

| Invariant | Implementation |
|-----------|----------------|
| D-44-02 min price | `createListing` rejects `priceBios < 50n` with `Error('price_too_low')` |
| IRS fee floor | `irsFee = BigInt(Math.floor(Number(amountBios) * irsFeeRate))` |
| Atomic settle | `beginTransaction + FOR UPDATE + commit` covers seller credit + treasury + escrow + listing |
| Buyer balance at accept | `acceptBid` checks `ousia` inside transaction before creating escrow |
| Dispute before emit | `dispute()` freezes escrow + inserts dispute row atomically; caller emits audit after |
| `listExpiredEscrows` | Returns held escrows where `accepted_at_tick + timeoutTicks < currentTick` — consumed by Plan 04 |

## Test coverage

- All 10 methods unit-tested with mock Pool (vi.fn()) — 20 tests, all GREEN
- D-44-02 price guard verified: price=49n rejected, price=50n accepted (boundary)
- IRS fee FLOOR verified: 100 * 0.02 = 2, 101 * 0.02 = 2 (not 2.02 — floor rounds down)
- `acceptBid` insufficient_bios error path verified (buyer ousia=50, bid=100)
- `acceptBid` success path verified (buyer ousia=500, bid=100)
- `confirmSettlement` bothConfirmed=false (only buyer) and bothConfirmed=true (both) verified
- `listExpiredEscrows` timeout logic and empty-result path verified

## Commits

| Hash | Description |
|------|-------------|
| 3b5563a | feat(44-02): add migrations v33/v34/v35 — marketplace tables + civic_treasury + IRS config seed |
| 8cc1d45 | feat(44-02): implement MarketplaceStore — 10 methods, atomic settle, D-44-02 price guard |
| 3fca5c0 | test(44-02): un-skip marketplace-store tests with vi.mock Pool — all tests GREEN |

## Deviations

- settlement-timeout.ts moved to Plan 04 (revision iter 1) to avoid cross-wave-1 import of Plan 03's appendMarketDisputed
- Tests use vi.mock() pool pattern (no live DB harness in this project — consistent with existing test conventions)

## Self-Check: PASSED
