# Phase 44: Marketplace v3 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27 (Session 1)
**Phase:** 44-marketplace-v3
**Areas discussed:** Police forward-compat, Reputation scoring, Steward UI scope, IRS fee

---

# Session 2 — 2026-05-27 (discuss-phase revisit)

**Areas discussed:** Counter-offers in bids, Settlement timeout, IRS fee in Phase 44, Police route in Phase 44

---

## Counter-offers in bids

| Option | Description | Selected |
|--------|-------------|----------|
| No counter-offers — offer/accept only | Simple state machine. ROADMAP §Phase 44 explicit. MKT-03 "counters" is copy error. | ✓ |
| Counter-offers supported | Richer UX, adds 2 extra audit events, more complex state machine. | |

**User's choice:** No counter-offers — offer/accept only
**Notes:** ROADMAP wins over MKT-03 wording. Offer → accept/reject → escrow. No counter-offer endpoint.

---

## Settlement timeout

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-dispute after N ticks | If both confirmations don't arrive, auto-fire market.disputed + Police stub. N in grid_config. | ✓ |
| Eternal escrow — only Police can unfreeze | No auto-trigger. Creates DoS risk (buyer ghosts). | |
| Auto-refund buyer after timeout | After N ticks, refund buyer. Creates perverse incentive to ghost. | |

**User's choice:** Auto-dispute after N ticks (7 ticks default, Polis-configurable)
**Notes:** `grid_config` key `market_settlement_timeout_ticks = 7`. Chronos tick listener triggers.

---

## IRS fee in Phase 44

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 44 creates civic_treasury table (proto-IRS) | Minimal table, real Bios accounting from day 1. Phase 45 inherits. | ✓ |
| Audit-chain-only: no actual treasury table | irs.tax_collected fires but Bios goes nowhere. Phase 45 retroactively creates treasury. | |

**User's choice:** Phase 44 creates `civic_treasury` table (proto-IRS)
**Notes:** Minimal `civic_treasury` table in Phase 44. `irs.tax_collected` audit-chain-only (Phase 45 adds to allowlist). IRS rate: 2% (grid_config key `irs_fee_rate = 0.02`). Note: prior session seeded 3%; this session corrected to 2%.

---

## Police route in Phase 44

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 44 ships stub POST /api/v1/police/investigate | Route exists, creates police_investigations row (status: pending). Phase 47 activates. | ✓ |
| market.disputed only — no Police route | Phase 47 reads from audit chain backlog. | |
| Use existing Phase 47 stub (if exists) | Check codebase first. | |

**User's choice:** Stub `POST /api/v1/police/investigate` in Phase 44
**Notes:** ROUTE_DID_POLICY: `civic_did_required`. Creates `police_investigations` table with `status = 'pending'`. Phase 47 reads from this table. Updates D-44-05 from prior session (prior said "no Police route in Phase 44").

---

---

## Police Forward-Compatibility

| Option | Description | Selected |
|--------|-------------|----------|
| Audit + freeze only | Emit `market.disputed`, freeze escrow, `dispute_status = 'pending_police'`. No stub table. | |
| Investigation stub table | Create `marketplace_disputes` table. Phase 47 reads from it. Route returns `{dispute_id}`. | ✓ |
| Call Police route (fail-safe) | POST /api/v1/police/investigate wrapped in try/catch. Phase 47 makes it real. | |

**User's choice:** Investigation stub table
**Notes:** Store `settled_audit_entry_id` in dispute row so Phase 47 can pull full trade audit history for evidence.

---

## Reputation Scoring

| Option | Description | Selected |
|--------|-------------|----------|
| Simple ratio: settled/(settled+disputed) | Percentage of successful trades. Computable from marketplace tables. | ✓ |
| Weighted: ratio + civic standing | 70% trade ratio + 30% civic age. Matches MKT-02 wording but adds complexity. | |
| Defer — show trade count only | Display raw numbers, no score. Full reputation deferred. | |

**User's choice:** Simple ratio
**Notes:** New sellers (0 trades) default to 1.0 (100%) — "no disputes = perfect". User chose 100% over null/omit.

---

## Steward UI Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full marketplace browser + trade flow | Complete MKT-01..05 in Steward, including bid/accept/settle/dispute. | |
| Listing browse + post only | Browse + create form. Bid/accept/settle/dispute API-only. | ✓ |
| Minimal update — wire the stub | Wire Phase 36 stub to real DB. No new components. | |

**User's choice:** Listing browse + post only
**Notes:** Bid/accept/settle/dispute flows deferred to a future dedicated UI phase.
URL: `/economy` (replace in place, not `/marketplace`). User explicitly chose to upgrade existing page.

---

## IRS Fee Rate

| Option | Description | Selected |
|--------|-------------|----------|
| 3% hardcoded | Named constant IRS_FEE_RATE = 0.03 | |
| 1% hardcoded | Lower bound | |
| 2% hardcoded | Mid-point | |
| Configurable from grid_config | DB key `irs_fee_rate`, seeded at 3% | ✓ |

**User's choice:** Configurable from `grid_config`, seeded at 0.03
**Notes:** User explicitly rejected hardcoding with "do not hardcode never". Phase 44 seeds the config value; Phase 45 adds full treasury management.

---

## Claude's Discretion

- Whether reputation is materialized or computed per-query
- Index strategy on marketplace_listings for filter queries
- Whether marketplace_sellers is a DB view or inline computation

## Deferred Ideas

- Bid/accept/settle/dispute Steward UI — future UI phase
- Auction-style bidding — out of scope per ROADMAP
- Service contracts — out of scope per ROADMAP
- Reputation weighting with civic standing — simple ratio only in Phase 44
- IRS tax_collected on broadcast allowlist — Phase 45
