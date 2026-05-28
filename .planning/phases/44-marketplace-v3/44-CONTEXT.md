# Phase 44: Marketplace v3 - Context

**Gathered:** 2026-05-27 (updated 2026-05-27 — discuss-phase session)
**Status:** Ready for planning

<domain>
## Phase Boundary

Civic commerce layer: Business-DID-gated listings, Civic-DID-gated bidding, Grid-held escrow,
IRS fee deduction on settlement, dispute routing to a forward-compatible Police investigation stub.

Ships: MKT-01..06 (full backend), Steward listing browse + create form.
Does NOT ship: bid/accept/settle/dispute in Steward UI (API-only); full Police integration (Phase 47); IRS treasury management (Phase 45); auction mechanics; service contracts; cross-currency.

</domain>

<decisions>
## Implementation Decisions

### Allowlist
- **D-44-01:** Allowlist baseline is **68** (not 67 — Phase 43 added `operator.nous_forked` → 68). Phase 44 adds +4: `market.listing_created`, `market.bid_placed`, `market.settled`, `market.disputed`. New total: **72**. ROADMAP has a stale "67 → 71" that must be corrected to "68 → 72" in the same commit that ships Phase 44.

### IRS Fee Integration
- **D-44-02:** IRS fee rate is **NOT hardcoded**. Read from `grid_config` table (key: `irs_fee_rate`), seeded at `0.02` (**2%**) in the Phase 44 DB migration. Phase 45 replaces this with full treasury management. The `market.settled` sole-producer deducts fee in the same DB transaction that transfers escrow to seller. (Discuss-phase session 2026-05-27: user chose 2%, not 3% — corrected from earlier draft.)
- **D-44-03:** `irs.tax_collected` sole-producer is **created in Phase 44** (same discipline: 9-step guard, closed-tuple payload `{amount_bios, listing_id, payer_civic_did_hash, tick, total_treasury_after}`). It is appended to the audit chain atomically after `market.settled`. It is **NOT added to broadcast-allowlist in Phase 44** — it stays audit-chain-only until Phase 45 adds it (+3 allowlist delta). This mirrors the Phase 41 `irs.disbursement_executed` pattern. Phase 44 creates a minimal `civic_treasury` table (columns: `grid_name, balance_bios BIGINT, last_updated_tick INT`) to hold the actual Bios — Phase 45 inherits and extends it.

### Police Forward-Compatibility
- **D-44-04:** Phase 44 creates a `marketplace_disputes` DB table (migration v33+). Columns: `dispute_id UUID PK`, `listing_id`, `complainant_civic_did_hash`, `dispute_status ENUM('pending_police','resolved','closed')`, `settled_audit_entry_id` (FK to audit_trail), `created_at_tick INT`. When buyer raises dispute, Grid: (1) emits `market.disputed`, (2) freezes the escrow row (`escrow_status = 'frozen'`), (3) inserts into `marketplace_disputes` with `dispute_status = 'pending_police'`. Phase 47 reads from `marketplace_disputes` to populate its investigation queue. Route returns `{dispute_id}` so both phases share a stable identifier.
- **D-44-05:** Phase 44 **ships a stub `POST /api/v1/police/investigate` endpoint** (ROUTE_DID_POLICY: `civic_did_required`). It accepts `{source_type: 'marketplace_dispute', source_ref: dispute_id}`, inserts a row into `police_investigations` table with `status = 'pending'`, and returns `{investigation_id}`. No investigation logic — Phase 47 activates full logic. This ensures the route exists and is callable from the marketplace dispute handler. Phase 47 reads `police_investigations WHERE status = 'pending'` for its queue. (Discuss-phase session 2026-05-27: user chose stub approach over audit-event-only.)

### Settlement Timeout
- **D-44-05b:** If both `buyer_confirmed` and `seller_confirmed` don't arrive within the settlement timeout, Grid **automatically fires `market.disputed`** and calls `POST /api/v1/police/investigate`. Default: **7 ticks** stored as `grid_config` key `market_settlement_timeout_ticks`. Polis-configurable via Phase 46 legislation. Chronos tick listener checks open escrow rows: `WHERE status = 'accepted' AND accepted_at_tick + timeout_ticks < current_tick`. No auto-refund — escrow stays frozen until Police resolves (Phase 47).

### Reputation Scoring
- **D-44-06:** Seller reputation = `settled_count / (settled_count + disputed_count)` as a `FLOAT(5,4)` (0.0–1.0). Stored as a materialized column `reputation_score` on the `marketplace_sellers` view (or computed per-query from `marketplace_trades` table — Claude's discretion on whether to materialize or compute). Default for new sellers: **1.0** (no disputes = perfect).
- **D-44-07:** Listing browse (`GET /api/v1/market/listings`) returns `reputation_score: number` per listing. New sellers without any trades return `reputation_score: 1.0`.

### Steward UI
- **D-44-08:** Steward UI for Phase 44 = **listing browse + create listing form** at `/economy` (replace v2.x `economy/page.tsx`). The v2.x `ShopRegistry` shop data is removed from this page.
  - Browse: category filter, `max_price` filter, reputation score displayed per listing, deterministic pagination by `(tick, listing_id)`.
  - Create: form for Business-DID holders (title, description, price in Bios, category, expiration ≤ 90 days). Non-Business-DID holders see a disabled form with "Business-DID required" message.
- **D-44-09:** Bid/accept/settle/dispute flows are **API-only in Phase 44** — no Steward UI for those. Full trade flow UI comes in a future dedicated UI phase.

### Bid Mechanics
- **D-44-10:** Offer/accept only — no auctions, no counter-offers. Buyer bids at listing price or offers a lower price. Seller accepts or rejects. No "counter" endpoint. Escrow is funded **at accept time** (not bid time) — Grid checks buyer Bios balance when seller accepts, transfers to escrow row, rejects with `insufficient_bios` if balance too low.

### DB Migrations
- **D-44-11:** Phase 44 adds migrations v33–v35 (tentative). Tables needed: `marketplace_listings`, `marketplace_bids`, `marketplace_escrow`, `marketplace_disputes`. The existing `shop-registry.ts` (in-memory, Ousia currency) is NOT deleted in Phase 44 — it may have other consumers. New civic marketplace is additive.

### Claude's Discretion
- Whether reputation is materialized on a view/column or computed per-query on browse.
- Exact index strategy on `marketplace_listings` for `(category, price_bios, expires_at_tick)` filter queries.
- Whether `marketplace_sellers` is a view or computed inline on the listings query.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 44 scope + requirements
- `.planning/ROADMAP.md` §Phase 44 — Goal, success criteria 1–5, out-of-scope, allowlist additions (note: stale 67→71 must be corrected to 68→72)
- `.planning/REQUIREMENTS.md` §MKT-01..06 — Acceptance criteria for all 6 marketplace requirements

### Architecture + constitutional constraints
- `.planning/research/v3.0/CIVIC-ARCHITECTURE.md` — Three-layer Portal/Grid/Brain canonical source-of-truth
- `.planning/STATE.md` §v3.0 Key Decisions — D-V3-22 (IRS fee funds civic infrastructure), D-V3-33 (Portal-gating invariant)

### Audit discipline (mandatory pattern)
- `grid/src/audit/append-p2p-peer-announced.ts` — Most recent sole-producer with 9-step guard; follow this pattern for all 5 new event producers (market.* × 4 + irs.tax_collected)
- `grid/src/audit/broadcast-allowlist.ts` — Allowlist source-of-truth; must be updated to 72 members

### Existing code to wire / replace
- `grid/src/api/routes/market-listings.ts` — Phase 36 stub `GET /api/v1/market/listings` — wire to real DB in Phase 44
- `grid/src/db/schema.ts` — Migration runner; Phase 44 adds v33–v35 here (marketplace tables)
- `grid/src/db/stores/registry-store.ts` — Existing Business-DID lookup pattern to use for auth checks
- `steward/src/app/economy/page.tsx` — Replace with civic marketplace browse + create form

### IRS pre-pattern
- `grid/src/audit/append-irs-disbursement-executed.ts` — Phase 41 IRS event pattern; `irs.tax_collected` follows the same structure (audit-chain-only until Phase 45)

### Police forward-compat contract
- `grid/src/api/policy.ts` — `police_only` policy type already declared; Phase 44 does NOT add police routes but must not conflict with them

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `grid/src/civic-registry/business-did-store.ts` — Look up Business-DID by civic_did; use for MKT-01 create-listing auth gate
- `grid/src/db/grid-store.ts` — Pattern for Grid-level DB store classes; Phase 44 adds `MarketplaceStore`
- `grid/src/api/routes/p2p.ts` — Most recent multi-route file (206 lines, 5 routes); follow its pattern for the marketplace route file
- `grid/src/audit/append-irs-disbursement-executed.ts` — Template for `irs.tax_collected` sole-producer

### Established Patterns
- **Sole-producer 9-step guard** — All new audit event files follow: (1) format, (2) type, (3) literal/enum, (4) regex/range, (5) closed-tuple, (6) explicit reconstruction, (7) privacy, (8) commit
- **ROUTE_DID_POLICY** — Every new route must be added to `grid/src/api/policy.ts`; CI gate `check-route-did-policy.mjs` fails build on missing entries
- **Migration runner** — Add migrations to `MIGRATIONS` array in `grid/src/db/schema.ts` as new `{version, name, up, down}` entries
- **Grid config reads** — `grid_config` table stores k/v pairs; Phase 44 seeds `irs_fee_rate = '0.03'` via migration

### Integration Points
- Marketplace routes connect to: `BusinessDidStore` (listing auth), `CivicDidStore` (bid auth), `AuditChain` (4 new events), `grid_config` (IRS fee rate), new `MarketplaceStore` (listings/bids/escrow/disputes)
- Phase 36 stub route `market-listings.ts` must be replaced (not just extended) with the full marketplace route handler
- Steward `/economy` page imports: likely needs `useSession` or auth context to detect Business-DID status for create form gating

</code_context>

<specifics>
## Specific Ideas

- IRS fee rate must be configurable from day 1 (user explicitly rejected hardcoding). Stored in `grid_config` as `irs_fee_rate`, seeded at **2%** (0.02). Range 1-3% per IRS-01; Polis can legislate a change via Phase 46.
- New sellers start at `1.0` reputation (100%), decays when disputes land.
- Police integration: stub `POST /api/v1/police/investigate` ships in Phase 44; it creates a `police_investigations` row with `status = 'pending'`. Phase 47 activates full investigation.
- Settlement timeout: 7 ticks default, grid_config key `market_settlement_timeout_ticks`. Chronos tick handler fires auto-dispute on expiry.
- Economy page URL `/economy` kept (user prefers upgrading in-place over new `/marketplace` route).

</specifics>

<deferred>
## Deferred Ideas

- Bid/accept/settle/dispute Steward UI flows — API-only in Phase 44; full trade flow UI in a future dedicated UI phase
- Auction-style bidding (English/Dutch) — explicitly out of scope per ROADMAP v3.0
- Service contracts (multi-tick deliverables) — explicitly out of scope per ROADMAP v3.0
- Cross-currency (USDT/ETH) — zero-custody invariant; Bios only in v3.0
- Reputation weighting with civic standing (civic_age_ticks factor) — deferred; Phase 44 uses simple ratio only
- Full IRS treasury management (`irs.tax_collected` on broadcast allowlist) — Phase 45

</deferred>

---

*Phase: 44-marketplace-v3*
*Context gathered: 2026-05-27*
