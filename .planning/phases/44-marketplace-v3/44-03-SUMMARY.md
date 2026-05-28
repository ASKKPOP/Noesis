---
phase: 44
plan: "03"
subsystem: audit
tags: [marketplace, audit, sole-producer, allowlist, civic-commerce, irs]
dependency_graph:
  requires: [44-01]
  provides: [appendMarketListingCreated, appendMarketBidPlaced, appendMarketSettled, appendMarketDisputed, appendIrsTaxCollected, allowlist-72]
  affects: [44-04, 44-05]
tech_stack:
  added: []
  patterns: [9-step-guard, closed-tuple, payloadPrivacyCheck, audit-chain-only]
key_files:
  created:
    - grid/src/audit/append-market-listing-created.ts
    - grid/src/audit/append-market-bid-placed.ts
    - grid/src/audit/append-market-settled.ts
    - grid/src/audit/append-market-disputed.ts
    - grid/src/audit/append-irs-tax-collected.ts
  modified:
    - grid/src/audit/broadcast-allowlist.ts
    - grid/test/append-market-listing-created.test.ts
    - grid/test/append-market-bid-placed.test.ts
    - grid/test/append-market-settled.test.ts
    - grid/test/append-market-disputed.test.ts
    - grid/test/append-irs-tax-collected.test.ts
    - grid/test/audit/broadcast-allowlist.test.ts
decisions:
  - "D-44-03: irs.tax_collected is audit-chain-only in Phase 44 — NOT added to ALLOWLIST_MEMBERS; Phase 45 adds it (+3 delta with disbursement_authorized + disbursement_executed)"
  - "market.listing_created payload excludes description/title fields (match FORBIDDEN_KEY_PATTERN); listing_id is the DB reference"
  - "irs_fee_bios in market.settled is non-negative integer (0 valid for FLOOR(price*rate)=0 edge case per D-44-02)"
metrics:
  duration: "4m 27s"
  completed_date: "2026-05-27"
  tasks_completed: 3
  files_created: 5
  files_modified: 7
---

# Phase 44 Plan 03: Audit Event Producers (market.* + irs.tax_collected) Summary

5 sole-producer files for Phase 44 marketplace v3: 4 market.* events on broadcast allowlist (positions 69-72) + 1 irs.tax_collected audit-chain-only; ALLOWLIST_MEMBERS grown from 68 to 72; all 147 tests pass GREEN; R-31-01 zero-diff invariant preserved.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create 4 market.* sole-producer files + un-skip tests | 9c30ceb | append-market-{listing-created,bid-placed,settled,disputed}.ts + 4 test files |
| 2 | Create append-irs-tax-collected.ts (audit-chain-only) + un-skip test | 1991b89 | append-irs-tax-collected.ts + test file |
| 3 | Add 4 market.* entries to ALLOWLIST_MEMBERS (68 → 72) + update tests | e51f35a | broadcast-allowlist.ts + broadcast-allowlist.test.ts |

## Artifacts

### New Sole-Producer Files

**`grid/src/audit/append-market-listing-created.ts`**
- Event: `market.listing_created` (allowlist position 69)
- Payload: closed 5-key `{category, listing_id, price_bios, seller_business_did_hash, tick}`
- actorDid: `seller_business_did_hash`
- Guards: type, UUID (listing_id), HEX64 (seller_business_did_hash), non-empty ≤63 chars (category), positive int (price_bios), non-negative int (tick), closed-tuple, reconstruction, privacy

**`grid/src/audit/append-market-bid-placed.ts`**
- Event: `market.bid_placed` (allowlist position 70)
- Payload: closed 4-key `{bidder_civic_did_hash, listing_id, offer_price_bios, tick}`
- actorDid: `bidder_civic_did_hash`
- Guards: type, UUID (listing_id), HEX64 (bidder_civic_did_hash), positive int (offer_price_bios), non-negative int (tick), closed-tuple, reconstruction, privacy

**`grid/src/audit/append-market-settled.ts`**
- Event: `market.settled` (allowlist position 71)
- Payload: closed 6-key `{buyer_civic_did_hash, irs_fee_bios, listing_id, price_bios, seller_business_did_hash, tick}`
- actorDid: `buyer_civic_did_hash`
- Guards: type, UUID (listing_id), HEX64 (buyer + seller), positive int (price_bios), non-negative int (irs_fee_bios — 0 valid), non-negative int (tick), closed-tuple, reconstruction, privacy
- Note: caller fires appendIrsTaxCollected after this event (audit-chain-only per D-44-03)

**`grid/src/audit/append-market-disputed.ts`**
- Event: `market.disputed` (allowlist position 72)
- Payload: closed 4-key `{complainant_civic_did_hash, dispute_id, listing_id, tick}`
- actorDid: `complainant_civic_did_hash`
- Guards: type, UUID (dispute_id + listing_id), HEX64 (complainant_civic_did_hash), non-negative int (tick), closed-tuple, reconstruction, privacy

**`grid/src/audit/append-irs-tax-collected.ts`**
- Event: `irs.tax_collected` (AUDIT-CHAIN-ONLY — NOT in ALLOWLIST_MEMBERS per D-44-03)
- Payload: closed 5-key `{amount_bios, listing_id, payer_civic_did_hash, tick, total_treasury_after}`
- actorDid: `payer_civic_did_hash`
- Guards: type, UUID (listing_id), HEX64 (payer_civic_did_hash), positive int (amount_bios), non-negative int (tick + total_treasury_after), closed-tuple, reconstruction, privacy
- Banner comment: "AUDIT-CHAIN-ONLY — NOT on ALLOWLIST_MEMBERS in Phase 44; Phase 45 adds it"

### Modified Files

**`grid/src/audit/broadcast-allowlist.ts`**
- File-header comment updated: `exactly these 68 event types` → `exactly these 72 event types`
- Added `+ Phase 44` to the phase list in the header
- Phase 44 block comment inserted after `operator.nous_forked` (Phase 43 position 68)
- 4 new entries appended at positions 69-72: `market.listing_created`, `market.bid_placed`, `market.settled`, `market.disputed`
- `irs.tax_collected` NOT added (D-44-03)

**`grid/test/audit/broadcast-allowlist.test.ts`**
- Updated stale `toBe(68)` → `toBe(72)` in default-deny, Phase 42, Phase 43 describe blocks
- Updated test description strings to reflect Phase 44 current state
- Phase 44 test block (length===72 + 4 toContain + not.toContain('irs.tax_collected')) now GREEN

## Test Results

```
Test Files  6 passed (6)
     Tests  147 passed (147)
  Duration  365ms
```

- 45 tests for 4 market.* producers (append-market-{listing-created,bid-placed,settled,disputed})
- 12 tests for append-irs-tax-collected
- 90 tests for broadcast-allowlist (length===72 GREEN)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated stale length===68 assertions in broadcast-allowlist.test.ts**
- **Found during:** Task 3 verification
- **Issue:** The test file had 5 `toBe(68)` assertions in default-deny, Phase 42, and Phase 43 describe blocks that were written when the count was 68. After adding 4 market.* entries, the count became 72, causing 5 test failures.
- **Fix:** Updated all stale `toBe(68)` → `toBe(72)` and updated the description strings to accurately describe current state. The Phase 44 describe block (added by Plan 01) already had the correct `toBe(72)` assertion — this was the "target" that Plan 01 seeded and Plan 03 was meant to make GREEN.
- **Files modified:** `grid/test/audit/broadcast-allowlist.test.ts`
- **Commit:** e51f35a

## Security / Threat Model Verification

| Threat | Status |
|--------|--------|
| T-44-03-01: Closed-tuple bypass via extra key | Mitigated — step 6 in all 5 producers enforces exact EXPECTED_KEYS |
| T-44-03-02: Listing description / PII leak via audit | Mitigated — payloadPrivacyCheck (step 8) + closed-tuple (step 6) reject 'description' key |
| T-44-03-03: Duplicate producer (sole-producer discipline) | Preserved — CI gate check-sole-producer-discipline.mjs covers new files |
| T-44-03-04: Allowlist drift | Mitigated — length===72 test is GREEN; comment header updated to "72" |
| T-44-03-05: irs.tax_collected accidentally promoted | Mitigated — `grep -c "'irs.tax_collected'" broadcast-allowlist.ts` returns 0; not.toContain test GREEN |
| T-44-03-06: Audit chain zero-diff broken | Preserved — R-31-01 audit-persistence-wiring test passes (4/4) |

## R-31-01 Zero-Diff Verification

```
Test Files  1 passed (1)
     Tests  4 passed (4) — audit-persistence-wiring.test.ts
```

Chain head hash is independent of allowlist membership. New entries at END of ALLOWLIST_MEMBERS array do not affect chain ordering.

## Known Stubs

None — all 5 producer files are fully implemented with real 9-step guard logic. Plan 04 (route handlers) consumes these producers.

## Self-Check: PASSED

- grid/src/audit/append-market-listing-created.ts: EXISTS
- grid/src/audit/append-market-bid-placed.ts: EXISTS
- grid/src/audit/append-market-settled.ts: EXISTS
- grid/src/audit/append-market-disputed.ts: EXISTS
- grid/src/audit/append-irs-tax-collected.ts: EXISTS
- Commits 9c30ceb, 1991b89, e51f35a: ALL PRESENT in git log
- ALLOWLIST_MEMBERS.length: 72 (verified by test)
- irs.tax_collected: NOT in ALLOWLIST_MEMBERS (verified by grep returning 0)
- All 147 tests: PASSING
- npx tsc --noEmit: exits 0
