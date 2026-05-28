---
phase: 44
slug: marketplace-v3
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-28
---

# Phase 44 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (grid package) |
| **Config file** | `grid/package.json` scripts |
| **Quick run command** | `cd grid && npm run test -- --reporter=verbose marketplace` |
| **Full suite command** | `cd grid && npm run test` |
| **Estimated runtime** | ~30 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `cd grid && npm run test -- --reporter=verbose <test-file-stem>`
- **After every plan wave:** Run `cd grid && npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 44-01-01 | 01 | 0 | MKT-01..06 | — | Wave 0 stubs prevent silent plan execution | unit | `npm run test -- marketplace` | ❌ Wave 0 | ⬜ pending |
| 44-02-01 | 02 | 1 | MKT-01 | — | Business-DID gate rejects non-Business-DID on create | unit | `npm run test -- marketplace-store` | ❌ Wave 0 | ⬜ pending |
| 44-02-02 | 02 | 1 | MKT-02 | — | Browse returns listings with reputation score 1.0 for new sellers | unit | `npm run test -- marketplace-store` | ❌ Wave 0 | ⬜ pending |
| 44-02-03 | 02 | 1 | MKT-04 | — | Atomic settle: buyer debit + seller credit + IRS deduct in one TX | unit | `npm run test -- marketplace-store` | ❌ Wave 0 | ⬜ pending |
| 44-02-04 | 02 | 1 | D-44-05b | — | Settlement timeout handler triggers dispute at tick boundary | unit | `npm run test -- settlement-timeout` | ❌ Wave 0 | ⬜ pending |
| 44-03-01 | 03 | 1 | MKT-06 | — | market.listing_created closed-tuple validity | unit | `npm run test -- append-market` | ❌ Wave 0 | ⬜ pending |
| 44-03-02 | 03 | 1 | MKT-06 | — | market.bid_placed closed-tuple validity | unit | `npm run test -- append-market` | ❌ Wave 0 | ⬜ pending |
| 44-03-03 | 03 | 1 | MKT-06 | — | market.settled closed-tuple validity | unit | `npm run test -- append-market` | ❌ Wave 0 | ⬜ pending |
| 44-03-04 | 03 | 1 | MKT-06 | — | market.disputed closed-tuple validity | unit | `npm run test -- append-market` | ❌ Wave 0 | ⬜ pending |
| 44-03-05 | 03 | 1 | D-44-03 | — | irs.tax_collected NOT in ALLOWLIST_MEMBERS | unit | `npm run test -- broadcast-allowlist` | ✅ extends existing | ⬜ pending |
| 44-03-06 | 03 | 1 | D-44-01 | — | ALLOWLIST_MEMBERS.length === 72 | unit | `npm run test -- broadcast-allowlist` | ✅ extends existing | ⬜ pending |
| 44-04-01 | 04 | 2 | MKT-01 | — | POST /market/listing/create returns 403 for non-Business-DID | unit | `npm run test -- market-routes` | ❌ Wave 0 | ⬜ pending |
| 44-04-02 | 04 | 2 | MKT-03 | — | POST /market/listing/:id/bid places bid successfully | unit | `npm run test -- market-routes` | ❌ Wave 0 | ⬜ pending |
| 44-04-03 | 04 | 2 | MKT-05 | — | POST /market/listing/:id/dispute freezes escrow + calls police stub | unit | `npm run test -- market-routes` | ❌ Wave 0 | ⬜ pending |
| 44-04-04 | 04 | 2 | D-44-05 | — | POST /police/investigate inserts row with status=pending | unit | `npm run test -- police-stub` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `grid/test/marketplace-store.test.ts` — stubs for MKT-01..04, D-44-05b
- [ ] `grid/test/append-market-listing-created.test.ts` — sole-producer stub for MKT-06
- [ ] `grid/test/append-market-bid-placed.test.ts` — sole-producer stub for MKT-06
- [ ] `grid/test/append-market-settled.test.ts` — sole-producer stub for MKT-06
- [ ] `grid/test/append-market-disputed.test.ts` — sole-producer stub for MKT-06
- [ ] `grid/test/market-routes.test.ts` — stubs for MKT-01..05
- [ ] `grid/test/police-stub.test.ts` — stub for D-44-05

*Existing `broadcast-allowlist.test.ts` extended (already exists — only assertions updated).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Steward /economy page renders listing browse + create form | D-44-08 | Browser rendering required | 1. Start Steward dev server. 2. Navigate to /economy. 3. Verify listings table renders. 4. Log in with Business-DID holder — create form should be enabled. 5. Log in with Civic-DID only — create form should show "Business-DID required". |
| Settlement escrow DB row transitions (accepted → settled) | MKT-04 | Multi-step transactional state requires live DB | 1. Create listing. 2. Place bid. 3. Accept bid (escrow row created). 4. Confirm as buyer. 5. Confirm as seller. 6. Verify DB: `SELECT * FROM marketplace_escrow WHERE listing_id = ?` shows `status = 'settled'`. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
