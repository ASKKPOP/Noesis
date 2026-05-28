---
phase: 44
plan: "01"
subsystem: grid/test
tags: [marketplace, tdd-scaffold, wave-0, broadcast-allowlist, audit-events]

dependency-graph:
  requires: []
  provides:
    - "Wave 0 TDD stubs: 9 test files covering all Phase 44 deliverables"
    - "RED gate: broadcast-allowlist.test.ts asserts length===72 (fails until Plan 03)"
    - "Invariant: irs.tax_collected NOT on allowlist in Phase 44 (D-44-03)"
  affects:
    - grid/test/audit/broadcast-allowlist.test.ts
    - grid/test/append-market-listing-created.test.ts
    - grid/test/append-market-bid-placed.test.ts
    - grid/test/append-market-settled.test.ts
    - grid/test/append-market-disputed.test.ts
    - grid/test/append-irs-tax-collected.test.ts
    - grid/test/marketplace-store.test.ts
    - grid/test/market-routes.test.ts
    - grid/test/police-stub.test.ts
    - grid/test/settlement-timeout.test.ts

tech-stack:
  added: []
  patterns:
    - "describe.skip with dynamic import in beforeAll (avoids vitest static-import failure on non-existent modules)"
    - "9-step sole-producer guard discipline for audit event test stubs"
    - "Intentional RED gate: combined length + toContain in single it() to count as exactly 1 failure"

key-files:
  created:
    - grid/test/append-market-listing-created.test.ts
    - grid/test/append-market-bid-placed.test.ts
    - grid/test/append-market-settled.test.ts
    - grid/test/append-market-disputed.test.ts
    - grid/test/append-irs-tax-collected.test.ts
    - grid/test/marketplace-store.test.ts
    - grid/test/market-routes.test.ts
    - grid/test/police-stub.test.ts
    - grid/test/settlement-timeout.test.ts
  modified:
    - grid/test/audit/broadcast-allowlist.test.ts

decisions:
  - "Dynamic import in beforeAll instead of static top-level import: vitest 2.x fails on missing static imports even inside describe.skip; dynamic import inside beforeAll is only executed when the block runs (which skip prevents)"
  - "Single combined it() for Phase 44 RED gate: merging length===72 + 4 toContain assertions into one it() ensures exactly 1 failing test count, not 5"
  - "irs.tax_collected stub uses describe.skip like others despite being audit-chain-only (not on allowlist): the stub tests the append function in isolation regardless of allowlist status"

metrics:
  duration: "~25 minutes"
  completed: "2026-05-27"
  tasks_completed: 2
  tasks_total: 2
  files_created: 9
  files_modified: 1
---

# Phase 44 Plan 01: Wave 0 Test Infrastructure Summary

Wave 0 TDD scaffold for Phase 44 Marketplace v3 — 9 new describe.skip test stub files plus broadcast-allowlist RED gate locking the Phase 44 allowlist target (68 → 72 members) before any implementation lands.

## One-liner

Wave 0 TDD scaffold: 9 describe.skip stub files + broadcast-allowlist RED gate (length===72, 1 intentional failure) enforcing test-first discipline for Phase 44 market.* and irs.tax_collected audit events.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | 5 sole-producer audit event test stubs | 6c18cf9 | append-market-*.test.ts + append-irs-tax-collected.test.ts |
| 2 | 4 store/route/police/timeout stubs + allowlist RED gate | 3c16564 | marketplace-store.test.ts, market-routes.test.ts, police-stub.test.ts, settlement-timeout.test.ts, broadcast-allowlist.test.ts |

## What Was Built

### 5 Sole-Producer Audit Event Stubs (Task 1)

Each file follows the 9-step guard discipline pattern:

- `append-market-listing-created.test.ts` — `market.listing_created`, EXPECTED_KEYS: `['category', 'listing_id', 'price_bios', 'seller_business_did_hash', 'tick']`. Includes description-key-forbidden test.
- `append-market-bid-placed.test.ts` — `market.bid_placed`, EXPECTED_KEYS: `['bidder_civic_did_hash', 'listing_id', 'offer_price_bios', 'tick']`
- `append-market-settled.test.ts` — `market.settled`, EXPECTED_KEYS: `['buyer_civic_did_hash', 'irs_fee_bios', 'listing_id', 'price_bios', 'seller_business_did_hash', 'tick']`. Special: `irs_fee_bios=0` is valid.
- `append-market-disputed.test.ts` — `market.disputed`, EXPECTED_KEYS: `['complainant_civic_did_hash', 'dispute_id', 'listing_id', 'tick']`
- `append-irs-tax-collected.test.ts` — `irs.tax_collected` (audit-chain-only), EXPECTED_KEYS: `['amount_bios', 'listing_id', 'payer_civic_did_hash', 'tick', 'total_treasury_after']`. Does NOT assert allowlist presence.

### 4 Store/Route/Police/Timeout Stubs (Task 2)

- `marketplace-store.test.ts` — 21 stubs across createListing, placeBid, settleTrade, disputeListing
- `market-routes.test.ts` — 19 stubs across 5 HTTP routes (POST /market/listings, bids, settle, dispute; GET /market/listings)
- `police-stub.test.ts` — 5 stubs for D-44-05 police 501 endpoint
- `settlement-timeout.test.ts` — 7 stubs for D-44-05b Chronos expiry handler

### broadcast-allowlist.test.ts Extension (Task 2)

Added `describe('ALLOWLIST_MEMBERS Phase 44 ...')` block with:
- **1 intentionally failing test** (RED gate): `expect(ALLOWLIST_MEMBERS.length).toBe(72)` + 4 `toContain` market.* checks in a single `it()`. Fails until Plan 03 adds the events to ALLOWLIST_MEMBERS.
- **1 passing invariant** (D-44-03): `expect(ALLOWLIST_MEMBERS).not.toContain('irs.tax_collected')`. Passes today; must never regress.

## Verification

```
Tests  1 failed | 89 passed (90)   # broadcast-allowlist — exactly 1 intentional RED failure
Tests  57 skipped (57)             # 4 new stub files — all skipped as designed
Tests  5 skipped (5)               # 5 sole-producer stubs — all skipped
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vitest 2.x fails on static top-level imports of non-existent modules even inside describe.skip**

- **Found during:** Task 1, first run of sole-producer stubs
- **Issue:** Plan assumed `describe.skip` would prevent static `import { fn } from '../src/audit/append-market-listing-created.js'` from resolving — vitest throws `Failed to load url` before any describe block executes
- **Fix:** Replaced all top-level value imports of implementation modules with `beforeAll(async () => { const mod = await import('...') })` pattern inside the describe.skip block. The dynamic import is only executed if the block actually runs, which skip prevents.
- **Files modified:** All 5 sole-producer stub files
- **Commit:** 6c18cf9

**2. [Rule 1 - Bug] Files initially written to main repo instead of worktree**

- **Found during:** Task 1 git add step
- **Issue:** Write tool paths resolved to `/Users/desirey/Programming/src/Noesis/grid/test/` (main repo) instead of the worktree path
- **Fix:** Copied files to worktree path `/Users/desirey/Programming/src/Noesis/.claude/worktrees/agent-a3aae67f883f8b353/grid/test/`, removed from main repo
- **Commit:** 6c18cf9

## Known Stubs

All 9 test files are intentional Wave 0 stubs (`describe.skip`). They will be activated (`.skip` removed) as Plans 02-05 implement the corresponding features. This is the designed state — not a deficiency.

## Threat Flags

None — this plan creates test files only; no new production code, no new network endpoints, no auth paths, no schema changes.

## Self-Check: PASSED

- 6c18cf9 exists: confirmed
- 3c16564 exists: confirmed
- All 9 test files exist in worktree grid/test/
- broadcast-allowlist.test.ts Phase 44 block: 1 failure (RED gate), 1 passing invariant
