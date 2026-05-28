# Phase 44: Marketplace v3 - Research

**Researched:** 2026-05-28
**Domain:** Civic commerce — escrow, DID-gated listings, IRS fee, police stub, Chronos timeout
**Confidence:** HIGH

## Summary

Phase 44 is a codebase-internal wiring phase. Every pattern needed — sole-producer discipline, migration runner format, MarketplaceStore shape, ROUTE_DID_POLICY, Chronos tick handler, audit-chain-only events — is already established by Phases 36–43 and directly verifiable in the current codebase. No new libraries are required. No external dependencies need availability checks.

The key design decisions are already locked in CONTEXT.md. Research confirms those decisions are consistent with existing patterns. The main technical questions (schema columns, DB transaction boundary, settlement timeout wiring, reputation materialization, Steward UI gate) are answered here with direct codebase evidence.

**Primary recommendation:** Follow `append-p2p-peer-announced.ts` exactly for all 5 sole-producers. Use `main.ts`-style `setInterval` (not `clock.onTick`) for the settlement timeout loop. Compute reputation per-query on browse (not materialized) — simpler and sufficient for Phase 44 volume.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-44-01:** Allowlist baseline is **68** (Phase 43 added `operator.nous_forked`). Phase 44 adds +4: `market.listing_created`, `market.bid_placed`, `market.settled`, `market.disputed`. New total: **72**. ROADMAP stale "67→71" must be corrected to "68→72".
- **D-44-02:** IRS fee rate read from `grid_config` table (key: `irs_fee_rate`), seeded at `0.02` (2%) in Phase 44 migration. `market.settled` sole-producer deducts fee in the same DB transaction that transfers escrow to seller.
- **D-44-03:** `irs.tax_collected` sole-producer created in Phase 44 (9-step guard, closed-tuple `{amount_bios, listing_id, payer_civic_did_hash, tick, total_treasury_after}`). NOT added to broadcast-allowlist — audit-chain-only until Phase 45. Mirrors `append-irs-disbursement-executed.ts` pattern from Phase 41.
- **D-44-04:** `marketplace_disputes` table (migration v33+). `dispute_id UUID PK`, `listing_id`, `complainant_civic_did_hash`, `dispute_status ENUM('pending_police','resolved','closed')`, `settled_audit_entry_id FK`, `created_at_tick INT`. Dispute flow: emit `market.disputed`, freeze escrow row (`escrow_status = 'frozen'`), insert `marketplace_disputes` with `dispute_status = 'pending_police'`. Route returns `{dispute_id}`.
- **D-44-05:** Phase 44 ships stub `POST /api/v1/police/investigate` (ROUTE_DID_POLICY: `civic_did_required`). Accepts `{source_type: 'marketplace_dispute', source_ref: dispute_id}`, inserts `police_investigations` row with `status = 'pending'`, returns `{investigation_id}`. No investigation logic — Phase 47 activates full logic.
- **D-44-05b:** Settlement timeout = **7 ticks** (grid_config: `market_settlement_timeout_ticks`). Chronos tick listener checks open escrow rows: `WHERE status = 'accepted' AND accepted_at_tick + timeout_ticks < current_tick`. Auto-fires `market.disputed` + calls `POST /api/v1/police/investigate`. No auto-refund — escrow stays frozen until Police resolves.
- **D-44-06:** Seller reputation = `settled_count / (settled_count + disputed_count)` as `FLOAT(5,4)`. Default for new sellers: `1.0`.
- **D-44-07:** Browse (`GET /api/v1/market/listings`) returns `reputation_score: number` per listing.
- **D-44-08:** Steward `/economy` = listing browse + create form. Browse: category filter, max_price filter, reputation score displayed, deterministic pagination by `(tick, listing_id)`. Create form: title, description, price in Bios, category, expiration ≤ 90 days. Non-Business-DID holders see disabled form with "Business-DID required" message.
- **D-44-09:** Bid/accept/settle/dispute flows are API-only in Phase 44 — no Steward UI for those.
- **D-44-10:** Offer/accept only. Escrow funded **at accept time** (not bid time). Grid checks buyer Bios balance when seller accepts; transfers to escrow row; rejects with `insufficient_bios` if balance too low.
- **D-44-11:** Migrations v33–v35. Tables: `marketplace_listings`, `marketplace_bids`, `marketplace_escrow`, `marketplace_disputes`. Existing `shop-registry.ts` NOT deleted.

### Claude's Discretion
- Whether reputation is materialized on a view/column or computed per-query on browse.
- Exact index strategy on `marketplace_listings` for `(category, price_bios, expires_at_tick)` filter queries.
- Whether `marketplace_sellers` is a view or computed inline on the listings query.

### Deferred Ideas (OUT OF SCOPE)
- Bid/accept/settle/dispute Steward UI flows — API-only in Phase 44.
- Auction-style bidding (English/Dutch).
- Service contracts (multi-tick deliverables).
- Cross-currency (USDT/ETH) — Bios only.
- Reputation weighting with civic standing (`civic_age_ticks` factor).
- Full IRS treasury management (`irs.tax_collected` on broadcast allowlist) — Phase 45.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MKT-01 | Business-DID holders create marketplace listings via `POST /api/v1/market/listing/create`; Civic-DID holders without Business-DID receive `403 business_did_required` | BusinessDidStore.listByCivicDid() pattern verified; ROUTE_DID_POLICY `business_did_required` enum value exists in policy.ts |
| MKT-02 | Public browse `GET /api/v1/market/listings` with filters + seller reputation | Phase 36 stub confirmed at market-listings.ts; must be replaced; reputation computed per-query |
| MKT-03 | Civic-DID holders place bids; seller accepts/rejects | New `marketplace_bids` table; offer/accept only per D-44-10 |
| MKT-04 | Escrow held until both parties confirm; IRS fee on settle; reputation updates | Atomic DB transaction required; civic_treasury table introduced; bios balance in nous_registry.ousia |
| MKT-05 | Disputes auto-route to Police stub (`POST /api/v1/police/investigate`) | Stub endpoint ships; `police_investigations` table created; `marketplace_disputes` table tracks dispute state |
| MKT-06 | 4 sole-producer audit events: `market.listing_created`, `market.bid_placed`, `market.settled` (triggers `irs.tax_collected`), `market.disputed` | Pattern from append-p2p-peer-announced.ts; allowlist 68→72 |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Listing create (auth gate) | API / Grid | — | Business-DID check against DB; audit event emission — server-only |
| Listing browse (public) | API / Grid | Steward (UI display) | Read-only public data; Steward just renders what Grid returns |
| Bid placement + acceptance | API / Grid | — | State mutation; Bios balance check; audit event — Grid owns |
| Escrow hold + release | API / Grid (DB) | — | DB transaction atomicity; IRS fee calculation — Grid owns |
| IRS fee deduction | API / Grid (DB) | — | Atomic with settle; `irs.tax_collected` audit-chain-only until Phase 45 |
| Dispute routing | API / Grid | Police stub (same Grid) | `marketplace_disputes` table + `police_investigations` table both Grid-side |
| Settlement timeout | API / Grid (Chronos loop) | — | `setInterval` in launcher.start() — same pattern as Phase 42 P2P cleanup |
| Reputation computation | API / Grid | — | Computed per-query on browse; no Brain involvement |
| Listing browse UI | Steward / Frontend | — | Client-side fetch of `/api/v1/market/listings`; same pattern as existing Steward pages |
| Create listing form | Steward / Frontend | — | Business-DID gate via API call; disabled state in UI when no Business-DID |

---

## Standard Stack

### Core (no new dependencies required)

[VERIFIED: codebase grep 2026-05-28]

| Component | Version | Purpose | Status |
|-----------|---------|---------|--------|
| mysql2/promise | Existing | DB pool + parameterized queries | Already in grid/package.json |
| Fastify | Existing | Route registration | All routes follow FastifyInstance pattern |
| node:crypto (createHash, randomUUID) | Node built-in | UUID generation for listing_id, dispute_id, investigation_id; SHA-256 for hash fields | Used in p2p.ts exactly this way |
| vitest run | Existing | Test runner | `npm run test` in grid/ |
| Next.js (steward) | Existing | Steward UI page | `steward/src/app/economy/page.tsx` — full replacement |

**Installation:** No new packages required. Phase 44 is entirely internal wiring.

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (Steward /economy)
  │  GET /api/v1/market/listings (public)
  │  POST /api/v1/market/listing/create (business_did_required)
  ▼
Grid Fastify API
  ├─ requireDid preHandler (business_did_required gate)
  │    └─ BusinessDidStore.listByCivicDid(gridName, civicDid)
  ├─ MarketplaceStore (pool)
  │    ├─ createListing() → INSERT marketplace_listings
  │    ├─ browseListing() → SELECT + LEFT JOIN reputation subquery
  │    ├─ placeBid() → INSERT marketplace_bids
  │    ├─ acceptBid() → SELECT nous_registry.ousia (buyer balance check)
  │    │                 → BEGIN TRANSACTION
  │    │                 │  UPDATE nous_registry SET ousia = ousia - price WHERE did = buyer
  │    │                 │  INSERT marketplace_escrow
  │    │                 └─ COMMIT
  │    ├─ settle() → BEGIN TRANSACTION (atomic)
  │    │             │  irs_fee = FLOOR(price * irs_fee_rate)
  │    │             │  UPDATE nous_registry SET ousia = ousia + (price - irs_fee) WHERE did = seller
  │    │             │  UPDATE civic_treasury SET balance_bios = balance_bios + irs_fee
  │    │             │  UPDATE marketplace_escrow SET status = 'settled'
  │    │             └─ COMMIT
  │    │             → appendMarketSettled()
  │    │             → appendIrsTaxCollected() [audit-chain-only]
  │    └─ dispute() → BEGIN TRANSACTION
  │                    │  UPDATE marketplace_escrow SET status = 'frozen'
  │                    │  INSERT marketplace_disputes
  │                    └─ COMMIT
  │                   → appendMarketDisputed()
  │                   → POST /api/v1/police/investigate (internal call or direct DB insert)
  │
  ├─ AuditChain → 4 sole-producer files (market.* ×4)
  │                → 1 audit-chain-only file (irs.tax_collected, NOT on allowlist)
  │
  ├─ broadcast-allowlist.ts [68→72: +4 market.* events]
  │
  ├─ Police stub route: POST /api/v1/police/investigate
  │    └─ INSERT police_investigations (status='pending')
  │
  └─ Chronos tick handler (setInterval in launcher.start())
       └─ Every tick: SELECT marketplace_escrow WHERE status='accepted'
          AND accepted_at_tick + timeout_ticks < current_tick
          → for each expired: dispute() + police investigate
```

### Recommended Project Structure

```
grid/src/
├── audit/
│   ├── append-market-listing-created.ts   # sole-producer #69
│   ├── append-market-bid-placed.ts        # sole-producer #70
│   ├── append-market-settled.ts           # sole-producer #71
│   ├── append-market-disputed.ts          # sole-producer #72
│   └── append-irs-tax-collected.ts        # audit-chain-only (Phase 45 will add to allowlist)
├── marketplace/
│   └── marketplace-store.ts               # MarketplaceStore class
└── api/routes/
    ├── market-listings.ts                 # REPLACE Phase 36 stub with full implementation
    └── police-stub.ts                     # New file: stub POST /api/v1/police/investigate

steward/src/app/economy/
└── page.tsx                               # REPLACE v2.x ShopRegistry page with civic marketplace
```

---

## Pattern 1: Sole-Producer 9-Step Discipline

[VERIFIED: grid/src/audit/append-p2p-peer-announced.ts, append-irs-disbursement-executed.ts 2026-05-28]

Every new audit event file follows this exact structure — no variations permitted.

```typescript
// Source: grid/src/audit/append-p2p-peer-announced.ts (canonical template)
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const CIVIC_DID_RE = /^did:civic:noesis:[a-z0-9_:\-]+$/i;
const HEX64_RE = /^[0-9a-f]{64}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Closed-tuple payload — N keys, ALPHABETICAL ORDER. */
export interface MarketListingCreatedPayload {
    readonly category: string;          // non-empty
    readonly listing_id: string;        // UUID_RE
    readonly price_bios: number;        // positive integer
    readonly seller_business_did_hash: string;  // HEX64_RE (sha256 of business DID)
    readonly tick: number;              // non-negative integer
}

const EXPECTED_KEYS = ['category', 'listing_id', 'price_bios', 'seller_business_did_hash', 'tick'] as const;

export function appendMarketListingCreated(
    audit: AuditChain,
    payload: MarketListingCreatedPayload,
): AuditEntry {
    // 1. Type guard
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError('...');
    }
    // 2. Field regex guards (one per field)
    // 3. Non-negative integer guards (tick, price_bios)
    // 4. Enum guards (category if closed-set)
    // 5. Closed-tuple structural check
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`closed-tuple violation ...`);
    }
    // 6. Explicit reconstruction — no spread
    const cleanPayload = {
        category: payload.category,
        listing_id: payload.listing_id,
        price_bios: payload.price_bios,
        seller_business_did_hash: payload.seller_business_did_hash,
        tick: payload.tick,
    };
    // 7. payloadPrivacyCheck BEFORE chain.append
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) throw new TypeError(`privacy violation ...`);
    // 8. Commit to chain
    return audit.append('market.listing_created', payload.seller_business_did_hash, cleanPayload);
}
```

**Key requirement:** `irs.tax_collected` is audit-chain-only — step 8 calls `audit.append(...)` but the event is NOT added to `ALLOWLIST_MEMBERS` in Phase 44. This is identical to how `irs.disbursement_executed` was handled in Phase 41 (`append-irs-disbursement-executed.ts` line 78: "NOT in broadcast allowlist — audit-chain only").

---

## Pattern 2: Migration Runner Format

[VERIFIED: grid/src/db/schema.ts, latest version = 32 2026-05-28]

```typescript
// Source: grid/src/db/schema.ts — add after version 32
{
    version: 33,
    name: 'marketplace_listings_bids_escrow',
    up: `
        CREATE TABLE IF NOT EXISTS marketplace_listings ( ... );
        CREATE TABLE IF NOT EXISTS marketplace_bids ( ... );
        CREATE TABLE IF NOT EXISTS marketplace_escrow ( ... )
    `,
    down: `
        DROP TABLE IF EXISTS marketplace_escrow;
        DROP TABLE IF EXISTS marketplace_bids;
        DROP TABLE IF EXISTS marketplace_listings
    `,
},
{
    version: 34,
    name: 'marketplace_disputes_police_investigations',
    up: `
        CREATE TABLE IF NOT EXISTS marketplace_disputes ( ... );
        CREATE TABLE IF NOT EXISTS police_investigations ( ... )
    `,
    down: `
        DROP TABLE IF EXISTS police_investigations;
        DROP TABLE IF EXISTS marketplace_disputes
    `,
},
{
    version: 35,
    name: 'civic_treasury_seed_irs_config',
    up: `
        CREATE TABLE IF NOT EXISTS civic_treasury (
            grid_name       VARCHAR(63) NOT NULL,
            balance_bios    BIGINT      NOT NULL DEFAULT 0,
            last_updated_tick INT       NOT NULL DEFAULT 0,
            PRIMARY KEY (grid_name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        INSERT IGNORE INTO grid_config (grid_name, config_key, config_value)
        VALUES ('genesis', 'irs_fee_rate', '0.02'),
               ('genesis', 'market_settlement_timeout_ticks', '7')
    `,
    down: `
        DROP TABLE IF EXISTS civic_treasury;
        DELETE FROM grid_config WHERE config_key IN ('irs_fee_rate', 'market_settlement_timeout_ticks')
    `,
},
```

---

## Pattern 3: Chronos Tick Handler (Settlement Timeout)

[VERIFIED: grid/src/genesis/launcher.ts lines 558–567, start() method 2026-05-28]

The existing pattern in `launcher.start()` uses `setInterval` for periodic checks. The settlement timeout check follows the **same pattern** as the Phase 42 P2P cleanup interval — NOT inside `clock.onTick` (which is reserved for tick-cadenced reconcile, governance, and relationship snapshots per the single-onTick-subscription constraint documented at launcher.ts line 461 comment).

```typescript
// Source: grid/src/genesis/launcher.ts start() method — Phase 42 pattern
// Phase 44 settlement timeout — add after P2P cleanup interval in start()
this._settlementTimeoutInterval = setInterval(() => {
    const pool = this._pool;
    const audit = this.audit;
    const tick = this.clock.currentTick;
    if (!pool || tick === undefined) return;
    void checkSettlementTimeouts(pool, audit, tick, this.gridName)
        .catch(() => {});
}, 1_000); // every 1s (~every tick at default 500ms tickRateMs)
```

**Important constraint:** There is exactly ONE `clock.onTick` subscription registered in `bootstrap()` (launcher.ts line 461). Phase 44 MUST NOT add another `clock.onTick` subscription. Use `setInterval` as shown above. Paired `clearInterval` goes in `stop()` per OBS-R-32-02 invariant.

---

## Pattern 4: ROUTE_DID_POLICY Entries Required

[VERIFIED: grid/src/api/policy.ts 2026-05-28]

The CI gate `check-route-did-policy.mjs` fails the build if any route in `api/v1/` lacks an explicit ROUTE_DID_POLICY entry.

Phase 44 routes and their required policy values:

| Route | Policy | Rationale |
|-------|--------|-----------|
| `GET /api/v1/market/listings` | `'public'` | Already exists — visitor-accessible per D-36-03; keep unchanged |
| `POST /api/v1/market/listing/create` | `'business_did_required'` | MKT-01: Business-DID required to list |
| `GET /api/v1/market/listing/:id` | `'public'` | Single listing view — public browsing |
| `POST /api/v1/market/listing/:id/bid` | `'civic_did_required'` | MKT-03: Civic-DID required to bid |
| `POST /api/v1/market/listing/:id/accept` | `'civic_did_required'` | Seller action — requires Civic-DID |
| `POST /api/v1/market/listing/:id/reject` | `'civic_did_required'` | Seller action — requires Civic-DID |
| `POST /api/v1/market/listing/:id/confirm-settlement` | `'civic_did_required'` | Buyer/seller confirm — requires Civic-DID |
| `POST /api/v1/market/listing/:id/dispute` | `'civic_did_required'` | Buyer action — requires Civic-DID |
| `POST /api/v1/police/investigate` | `'civic_did_required'` | D-44-05: stub endpoint, Civic-DID required |

**Total new ROUTE_DID_POLICY entries: 8** (excluding the existing `GET /api/v1/market/listings`).

---

## Pattern 5: BusinessDidStore Lookup for Listing Auth

[VERIFIED: grid/src/civic-registry/business-did-store.ts 2026-05-28]

```typescript
// Source: grid/src/civic-registry/business-did-store.ts
const businesses = await businessDidStore.listByCivicDid(gridName, civicDid);
const activeBusiness = businesses.find(b => b.status === 'active');
if (!activeBusiness) {
    return reply.code(403).send({ error: 'business_did_required' });
}
```

The `BusinessDidStore` is already instantiated in `main.ts` and wired into `GridServices` via Phase 37. Phase 44 uses the same instance.

---

## Pattern 6: Multi-Route File Structure

[VERIFIED: grid/src/api/routes/p2p.ts, 206 lines, 5 routes 2026-05-28]

The Phase 36 stub `market-listings.ts` is a single-route stub (42 lines). Phase 44 replaces it entirely with a full multi-route file. Follow `p2p.ts` structure:

```typescript
// Source: grid/src/api/routes/p2p.ts pattern
export async function registerMarketRoutes(
    app: FastifyInstance,
    services: GridServices,
): Promise<void> {
    // GET /api/v1/market/listings (public browse — replaces stub)
    app.get('/api/v1/market/listings', async (req, reply) => { ... });

    // POST /api/v1/market/listing/create (business_did_required)
    app.post('/api/v1/market/listing/create', async (req, reply) => { ... });

    // ... 6 more routes
}
```

**In server.ts:** Replace `registerMarketListingsRoute` import with `registerMarketRoutes`. One import swap, same wiring location.

---

## Exact DB Schema for Phase 44 Tables

[VERIFIED: codebase analysis — following established patterns from schema.ts 2026-05-28]

### Table: marketplace_listings (migration v33)

```sql
CREATE TABLE IF NOT EXISTS marketplace_listings (
    listing_id          CHAR(36)        NOT NULL,           -- UUID
    grid_name           VARCHAR(63)     NOT NULL,
    seller_civic_did    VARCHAR(255)    NOT NULL,
    seller_business_did VARCHAR(255)    NOT NULL,
    title               VARCHAR(255)    NOT NULL,
    description         TEXT            NOT NULL,
    price_bios          BIGINT UNSIGNED NOT NULL,           -- in Bios units
    category            VARCHAR(63)     NOT NULL,
    status              ENUM('active','accepted','settled','expired','cancelled')
                                        NOT NULL DEFAULT 'active',
    created_at_tick     INT UNSIGNED    NOT NULL,
    expires_at_tick     INT UNSIGNED    NOT NULL,           -- max 90 days in ticks
    PRIMARY KEY (listing_id),
    INDEX idx_browse    (grid_name, status, category, price_bios),
    INDEX idx_seller    (grid_name, seller_civic_did),
    INDEX idx_expiry    (grid_name, expires_at_tick)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
```

### Table: marketplace_bids (migration v33)

```sql
CREATE TABLE IF NOT EXISTS marketplace_bids (
    bid_id              CHAR(36)        NOT NULL,           -- UUID
    listing_id          CHAR(36)        NOT NULL,
    grid_name           VARCHAR(63)     NOT NULL,
    bidder_civic_did    VARCHAR(255)    NOT NULL,
    offer_price_bios    BIGINT UNSIGNED NOT NULL,
    bid_message         VARCHAR(512),                       -- optional buyer message
    status              ENUM('pending','accepted','rejected','expired')
                                        NOT NULL DEFAULT 'pending',
    placed_at_tick      INT UNSIGNED    NOT NULL,
    PRIMARY KEY (bid_id),
    INDEX idx_listing   (listing_id),
    INDEX idx_bidder    (grid_name, bidder_civic_did)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
```

### Table: marketplace_escrow (migration v33)

```sql
CREATE TABLE IF NOT EXISTS marketplace_escrow (
    escrow_id           CHAR(36)        NOT NULL,           -- UUID
    listing_id          CHAR(36)        NOT NULL,
    bid_id              CHAR(36)        NOT NULL,
    grid_name           VARCHAR(63)     NOT NULL,
    buyer_civic_did     VARCHAR(255)    NOT NULL,
    seller_civic_did    VARCHAR(255)    NOT NULL,
    amount_bios         BIGINT UNSIGNED NOT NULL,           -- price at accept time
    escrow_status       ENUM('held','frozen','settled','refunded')
                                        NOT NULL DEFAULT 'held',
    buyer_confirmed     TINYINT(1)      NOT NULL DEFAULT 0,
    seller_confirmed    TINYINT(1)      NOT NULL DEFAULT 0,
    accepted_at_tick    INT UNSIGNED    NOT NULL,
    settled_at_tick     INT UNSIGNED,
    PRIMARY KEY (escrow_id),
    UNIQUE KEY uq_listing (listing_id),                     -- one escrow per listing
    INDEX idx_timeout   (grid_name, escrow_status, accepted_at_tick)  -- for timeout query
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
```

### Table: marketplace_disputes (migration v34)

```sql
CREATE TABLE IF NOT EXISTS marketplace_disputes (
    dispute_id              CHAR(36)    NOT NULL,           -- UUID (D-44-04)
    listing_id              CHAR(36)    NOT NULL,
    grid_name               VARCHAR(63) NOT NULL,
    complainant_civic_did_hash CHAR(64) NOT NULL,           -- sha256(civicDid) — privacy
    dispute_status          ENUM('pending_police','resolved','closed')
                                        NOT NULL DEFAULT 'pending_police',
    settled_audit_entry_id  BIGINT UNSIGNED,                -- FK → audit_trail.id
    created_at_tick         INT UNSIGNED NOT NULL,
    PRIMARY KEY (dispute_id),
    INDEX idx_listing   (listing_id),
    INDEX idx_status    (grid_name, dispute_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
```

### Table: police_investigations (migration v34)

Forward-compatible for Phase 47. Phase 44 only INSERTs with `status='pending'`.

```sql
CREATE TABLE IF NOT EXISTS police_investigations (
    investigation_id    CHAR(36)        NOT NULL,           -- UUID
    grid_name           VARCHAR(63)     NOT NULL,
    source_type         VARCHAR(63)     NOT NULL,           -- 'marketplace_dispute' in Phase 44
    source_ref          CHAR(36)        NOT NULL,           -- dispute_id or complaint_id
    status              ENUM('pending','open','closed','resolved')
                                        NOT NULL DEFAULT 'pending',
    opened_at_tick      INT UNSIGNED    NOT NULL,
    closed_at_tick      INT UNSIGNED,
    PRIMARY KEY (investigation_id),
    INDEX idx_source    (source_type, source_ref),
    INDEX idx_status    (grid_name, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
```

### Table: civic_treasury (migration v35)

Phase 44 creates this minimal table; Phase 45 inherits and extends.

```sql
CREATE TABLE IF NOT EXISTS civic_treasury (
    grid_name           VARCHAR(63)     NOT NULL,
    balance_bios        BIGINT          NOT NULL DEFAULT 0,
    last_updated_tick   INT             NOT NULL DEFAULT 0,
    PRIMARY KEY (grid_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
```

---

## Don't Hand-Roll

[VERIFIED: codebase patterns confirmed 2026-05-28]

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic escrow transfer | Custom two-phase commit | Single MySQL `BEGIN...COMMIT` transaction | MySQL InnoDB handles atomicity; no SAGA needed at this scale |
| IRS fee rounding | Custom rounding logic | `FLOOR(price * rate)` (integer Bios) | Bios is integer currency; favor seller (floor) is simpler and avoids fractional Bios |
| UUID generation | Custom ID generation | `node:crypto randomUUID()` | Already used in p2p.ts line 28; consistent throughout codebase |
| DID hash | Custom hash | `createHash('sha256').update(did).digest('hex')` | Standard pattern from p2p.ts line 45 `sha256Hex()` helper |
| Business-DID check | New auth mechanism | `BusinessDidStore.listByCivicDid()` (Phase 37) | Already wired in main.ts; reuse the injected instance |

**Key insight:** The most dangerous hand-roll temptation is the settle transaction. It must be a single BEGIN/COMMIT that: (1) checks buyer balance, (2) deducts from buyer, (3) transfers to seller minus fee, (4) adds fee to treasury, (5) updates escrow status. If any step is done outside the transaction, a server crash mid-settle leaves state inconsistent.

---

## Reputation Scoring Decision

**Recommendation: compute per-query (Claude's Discretion)**

[ASSUMED — performance estimate for Phase 44 scale]

A materialized `reputation_score` column on `marketplace_listings` requires an UPDATE trigger or background job whenever a listing settles or disputes — two separate code paths must remember to maintain the denormalized field. At Phase 44 scale (handful of listings), a per-query aggregation is cheaper to implement and maintain:

```sql
-- On browse query, join a subquery for settled/disputed counts per seller
SELECT
    l.*,
    COALESCE(
        rs.settled_count / NULLIF(rs.settled_count + rs.disputed_count, 0),
        1.0
    ) AS reputation_score
FROM marketplace_listings l
LEFT JOIN (
    SELECT
        e.seller_civic_did,
        SUM(CASE WHEN e.escrow_status = 'settled' THEN 1 ELSE 0 END) AS settled_count,
        SUM(CASE WHEN e.escrow_status = 'frozen' THEN 1 ELSE 0 END)  AS disputed_count
    FROM marketplace_escrow e
    WHERE e.grid_name = ?
    GROUP BY e.seller_civic_did
) rs ON rs.seller_civic_did = l.seller_civic_did
WHERE l.grid_name = ? AND l.status = 'active'
  AND (? IS NULL OR l.category = ?)
  AND (? IS NULL OR l.price_bios <= ?)
  AND l.expires_at_tick > ?
ORDER BY l.created_at_tick DESC, l.listing_id ASC
LIMIT ? OFFSET ?
```

`COALESCE(..., 1.0)` implements the D-44-06 "new sellers default to 1.0" requirement naturally.

If Phase 45+ introduces high-volume marketplace activity, Phase 45 can add a materialized `reputation_score FLOAT(5,4) DEFAULT 1.0` column on `marketplace_listings` at that time. No Phase 44 code needs to change — just add the column and a background updater.

---

## Audit Event Payload Specifications

[VERIFIED: CONTEXT.md locked decisions D-44-01..06 + broadcast-allowlist.ts pattern analysis 2026-05-28]

All payloads must: (a) keys in alphabetical order, (b) no forbidden keywords from FORBIDDEN_KEY_PATTERN, (c) hash-only for DID fields crossed into audit chain.

**NOTE on `description` field:** The `FORBIDDEN_KEY_PATTERN` in broadcast-allowlist.ts includes `description` as a forbidden key. None of the market event payloads should include `description` — use `listing_id` + DB lookup instead. Listing title/description lives in the DB, not the audit chain.

### market.listing_created (allowlist #69)
```
{
    category: string,              // non-empty, ≤63 chars
    listing_id: string,            // UUID_RE
    price_bios: number,            // positive integer
    seller_business_did_hash: string,  // HEX64_RE — sha256(businessDid)
    tick: number                   // non-negative integer
}
```

### market.bid_placed (allowlist #70)
```
{
    bidder_civic_did_hash: string, // HEX64_RE — sha256(civicDid)
    listing_id: string,            // UUID_RE
    offer_price_bios: number,      // positive integer
    tick: number                   // non-negative integer
}
```

### market.settled (allowlist #71)
```
{
    buyer_civic_did_hash: string,  // HEX64_RE
    irs_fee_bios: number,          // non-negative integer
    listing_id: string,            // UUID_RE
    price_bios: number,            // positive integer
    seller_business_did_hash: string, // HEX64_RE
    tick: number                   // non-negative integer
}
```
Note: `market.settled` actorDid = `buyer_civic_did_hash` (the settling party).
After emitting `market.settled`, atomically append `irs.tax_collected` (audit-chain-only).

### market.disputed (allowlist #72)
```
{
    complainant_civic_did_hash: string, // HEX64_RE
    dispute_id: string,                 // UUID_RE
    listing_id: string,                 // UUID_RE
    tick: number                        // non-negative integer
}
```

### irs.tax_collected (audit-chain-only — NOT on allowlist in Phase 44)
```
{
    amount_bios: number,           // positive integer
    listing_id: string,            // UUID_RE
    payer_civic_did_hash: string,  // HEX64_RE — buyer who paid IRS fee
    tick: number,                  // non-negative integer
    total_treasury_after: number   // non-negative integer
}
```
Mirrors `append-irs-disbursement-executed.ts` pattern exactly. Phase 45 will add this to ALLOWLIST_MEMBERS (+3 delta: tax_collected, disbursement_authorized, disbursement_executed).

---

## DB Transaction Boundary for Settle

[VERIFIED: MySQL InnoDB, existing pattern in nous_registry for ousia balance 2026-05-28]

The settle operation is the most complex transaction in Phase 44. The exact sequence inside one `BEGIN...COMMIT`:

```sql
-- Step 1: Lock the escrow row
SELECT escrow_id, amount_bios, buyer_civic_did, seller_civic_did
FROM marketplace_escrow
WHERE listing_id = ? AND escrow_status = 'held'
FOR UPDATE;

-- Step 2: Verify both parties confirmed (buyer_confirmed=1, seller_confirmed=1)
-- (abort if not both confirmed)

-- Step 3: Read irs_fee_rate from grid_config (can be done outside tx)
-- irs_fee = FLOOR(amount_bios * rate)
-- seller_payout = amount_bios - irs_fee

-- Step 4: Transfer to seller (Bios is in nous_registry.ousia)
UPDATE nous_registry
SET ousia = ousia + ?  -- seller_payout
WHERE grid_name = ? AND did = ?;  -- seller_civic_did

-- Step 5: Add fee to civic_treasury
INSERT INTO civic_treasury (grid_name, balance_bios, last_updated_tick)
VALUES (?, ?, ?)
ON DUPLICATE KEY UPDATE
    balance_bios = balance_bios + VALUES(balance_bios),
    last_updated_tick = VALUES(last_updated_tick);

-- Step 6: Update escrow + listing status
UPDATE marketplace_escrow SET escrow_status = 'settled', settled_at_tick = ? WHERE escrow_id = ?;
UPDATE marketplace_listings SET status = 'settled' WHERE listing_id = ?;

-- COMMIT
-- Then (outside transaction, fire-and-forget): appendMarketSettled() + appendIrsTaxCollected()
```

**Note on Bios balance location:** `nous_registry.ousia` is the Bios balance column [VERIFIED: grid/src/db/schema.ts line 64]. The v3.0 rename from `ousia` to `bios` does NOT happen in Phase 44 — Phase 44 uses the existing `ousia` column. Phase 50 (migration) or a dedicated rename phase handles that.

---

## Steward /economy Page Pattern

[VERIFIED: steward/src/app/system/local-ai/page.tsx — civicDid loading pattern 2026-05-28]

```typescript
// steward/src/app/economy/page.tsx — full replacement
'use client';
import { useEffect, useState } from 'react';
import StewardShell from '@/components/StewardShell';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

export default function EconomyPage() {
    const [listings, setListings] = useState([]);
    const [businessDid, setBusinessDid] = useState<string | null>(null);
    const [businessDidLoading, setBusinessDidLoading] = useState(true);

    // Check if operator has a Business-DID (determines create form state)
    useEffect(() => {
        void (async () => {
            // Fetch operator's Nous civic profile to check for business_did
            const res = await fetch(`${GRID_ORIGIN}/api/v1/operator/me/nous`, {
                credentials: 'include',
            });
            if (!res.ok) { setBusinessDidLoading(false); return; }
            const data = await res.json();
            // Look for an active business DID in the Nous profile
            setBusinessDid(data?.businessDid ?? null);
            setBusinessDidLoading(false);
        })();
    }, []);

    // ...browse listings fetch, pagination, category filter
    return (
        <StewardShell title="Economy" breadcrumb="Economy">
            {/* Browse section */}
            {/* Create listing form — disabled with message if !businessDid */}
            {!businessDid && !businessDidLoading && (
                <p>Business-DID required to create listings.</p>
            )}
            {businessDid && (
                <form>...</form>
            )}
        </StewardShell>
    );
}
```

**Design note:** The `business_did_required` check for the create form is **cosmetic** in Steward — the API enforces it at the Grid layer. Steward simply disables the form UI. The API route will still return `403 business_did_required` if someone bypasses the UI.

---

## Common Pitfalls

### Pitfall 1: IRS Fee Rate Outside Transaction
**What goes wrong:** Reading `grid_config.irs_fee_rate` inside the settle transaction causes a table lock that can cause deadlocks when many settlements happen simultaneously.
**Why it happens:** `grid_config` is a shared config table; locking it during settle is unnecessary.
**How to avoid:** Read `irs_fee_rate` from `grid_config` BEFORE starting the settle transaction. It's a runtime-stable value (Polis only changes it via Phase 46 legislation). Cache it in-memory on the `MarketplaceStore` with a 60s TTL or just read once per settle outside the transaction boundary.
**Warning signs:** Test with 2+ concurrent settlements; look for MySQL deadlock errors in Pino logs.

### Pitfall 2: Settlement Timeout Using clock.onTick
**What goes wrong:** Adding a second `clock.onTick` subscriber in `launcher.ts` violates the single-subscription constraint documented at launcher.ts line 461. This can break the existing reconcile/governance tick sequence.
**Why it happens:** `clock.onTick` looks like the natural place for "check every tick."
**How to avoid:** Use `setInterval` in `start()` exactly as the P2P cleanup does (launcher.ts line 560). Add paired `clearInterval` in `stop()`.
**Warning signs:** Tests importing `GenesisLauncher` throw or timeout; `clock.onTick` already has a subscription.

### Pitfall 3: description Field in Audit Payload
**What goes wrong:** Including `description` in a `market.*` payload fails the `payloadPrivacyCheck` because `description` matches `FORBIDDEN_KEY_PATTERN` (added in Phase 12 governance extension).
**Why it happens:** The natural instinct is to include listing description in the audit event.
**How to avoid:** Use `listing_id` as the reference. Listing title and description live in `marketplace_listings` DB table — consumers do a DB lookup on `listing_id`.
**Warning signs:** `payloadPrivacyCheck` throws at step 7 with `offendingKeyword: 'description'`.

### Pitfall 4: Forgetting to Freeze Escrow Before Dispute
**What goes wrong:** Race condition where a dispute fires but escrow row isn't frozen yet — a concurrent settlement could succeed, defeating the dispute freeze.
**Why it happens:** The dispute handler emits the `market.disputed` event before updating the DB.
**How to avoid:** The dispute flow is: (1) BEGIN TRANSACTION, (2) UPDATE escrow SET status='frozen', (3) INSERT marketplace_disputes, (4) COMMIT, (5) THEN emit `market.disputed` + call police stub. Audit events are emitted AFTER the DB transaction commits — same pattern as all other sole-producers.
**Warning signs:** Tests with concurrent settle+dispute show incorrect escrow status.

### Pitfall 5: Allowlist Comment Header Drift
**What goes wrong:** The comment header in `broadcast-allowlist.ts` still says "exactly these 68 event types" after Phase 44 adds +4. The CI gate `check-sole-producer-discipline.mjs` may not catch comment drift.
**Why it happens:** Comment is not machine-verified.
**How to avoid:** In the same commit that adds the 4 new entries to `ALLOWLIST_MEMBERS`, update the comment to "exactly 72 event types" and update the Phase 43/44 block comment.
**Warning signs:** Comment says 68 but array has 72 entries.

### Pitfall 6: Buyer Bios Check at Bid Time vs Accept Time
**What goes wrong:** Checking buyer Bios balance at bid placement (not accept time) allows a buyer to place multiple bids across different listings they can't afford, then accept whichever seller accepts first.
**Why it happens:** D-44-10 states escrow is funded AT ACCEPT TIME. Checking at bid time is simpler but wrong per the spec.
**How to avoid:** The `POST /api/v1/market/listing/:id/accept` route (seller-initiated) triggers the balance check and escrow funding. `POST /api/v1/market/listing/:id/bid` only inserts the bid row — no Bios movement.
**Warning signs:** `marketplace_escrow` has rows with amounts larger than the buyer's current `nous_registry.ousia`.

---

## State of the Art

| Old Approach | Current Approach | Changed | Impact |
|--------------|------------------|---------|--------|
| Ousia P2P trades (v1.0 `trade.proposed`) | Civic marketplace with escrow + DID gates | Phase 44 | New tables; old trade routes preserved per D-44-11 |
| Hardcoded IRS fee | `grid_config` key `irs_fee_rate` | Phase 44 | Polis-legislatable via Phase 46 |
| Police stub absent | `POST /api/v1/police/investigate` stub | Phase 44 | Phase 47 activates full logic; stub ensures stable integration point |
| Phase 36 market stub (empty listings) | Full MarketplaceStore with real DB | Phase 44 | `registerMarketListingsRoute` → `registerMarketRoutes` |

**Deprecated/outdated:**
- Phase 36 stub `market-listings.ts` (42 lines, empty return): REPLACED entirely by the full marketplace route file.
- ROADMAP.md "67→71" allowlist note: Must be corrected to "68→72" per D-44-01.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (version from package.json) |
| Config file | None — Vitest uses `package.json` scripts |
| Quick run command | `cd /Users/desirey/Programming/src/Noesis/grid && npm run test -- --reporter=verbose marketplace` |
| Full suite command | `cd /Users/desirey/Programming/src/Noesis/grid && npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MKT-01 | Business-DID gate on create listing | unit | `npm run test -- marketplace-store` | ❌ Wave 0 |
| MKT-01 | 403 on non-Business-DID create | unit | `npm run test -- market-routes` | ❌ Wave 0 |
| MKT-02 | Browse returns listings with reputation | unit | `npm run test -- marketplace-store` | ❌ Wave 0 |
| MKT-03 | Bid placement; accept flow | unit | `npm run test -- market-routes` | ❌ Wave 0 |
| MKT-04 | Atomic settle with IRS deduction | unit | `npm run test -- marketplace-store` | ❌ Wave 0 |
| MKT-05 | Dispute freezes escrow + routes to police | unit | `npm run test -- market-routes` | ❌ Wave 0 |
| MKT-05 | Police stub inserts investigation row | unit | `npm run test -- police-stub` | ❌ Wave 0 |
| MKT-06 | 4 sole-producer closed-tuple validity | unit | `npm run test -- append-market` | ❌ Wave 0 |
| D-44-03 | irs.tax_collected NOT on allowlist | unit | `npm run test -- broadcast-allowlist` | ✅ extends existing |
| D-44-05b | Timeout handler triggers dispute | unit | `npm run test -- settlement-timeout` | ❌ Wave 0 |
| D-44-01 | ALLOWLIST_MEMBERS.length === 72 | unit | `npm run test -- broadcast-allowlist` | ✅ extends existing |

### Sampling Rate
- **Per task commit:** `npm run test -- --reporter=verbose <test-file-stem>`
- **Per wave merge:** `npm run test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `grid/test/marketplace-store.test.ts` — covers MKT-01/02/04 store layer
- [ ] `grid/test/market-routes.test.ts` — covers MKT-01/03/05 route layer
- [ ] `grid/test/police-stub.test.ts` — covers D-44-05 stub endpoint
- [ ] `grid/test/settlement-timeout.test.ts` — covers D-44-05b Chronos handler
- [ ] `grid/test/append-market-listing-created.test.ts` — sole-producer unit test (×4 files)
- [ ] `grid/test/append-irs-tax-collected.test.ts` — audit-chain-only sole-producer

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `requireDid` preHandler (business_did_required/civic_did_required) — already wired |
| V3 Session Management | no | Civic-DID bearer JWT stateless |
| V4 Access Control | yes | ROUTE_DID_POLICY enforcement; `BusinessDidStore.listByCivicDid` for listing gate |
| V5 Input Validation | yes | Closed-tuple guards in sole-producers; route input validation with regex guards |
| V6 Cryptography | no | No new crypto beyond existing sha256 helper |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Buyer double-spend (bid on multiple listings with one balance) | Tampering | Escrow funded at accept time with balance check inside DB transaction (`FOR UPDATE` row lock) |
| Spoofed Business-DID on listing create | Spoofing | `BusinessDidStore.listByCivicDid()` server-side check against `business_did_registry` table |
| Replay settle after dispute freeze | Tampering | Settle query checks `escrow_status = 'held'` with `FOR UPDATE`; frozen escrow returns 409 |
| IRS fee drain (attacker manually sets irs_fee_rate to 100%) | Tampering | `grid_config` write-protected by operator auth; Phase 46 Polis legislation required for changes |
| Police stub SSRF (if internal call used) | Elevation of Privilege | Stub does direct DB insert, not an HTTP call to self — no SSRF surface |

---

## Open Questions

1. **Buyer Bios balance column naming**
   - What we know: `nous_registry.ousia BIGINT` is the current Bios balance column [VERIFIED: schema.ts line 64]
   - What's unclear: v3.0 uses "Bios" terminology throughout docs; `ousia` is the v1.0/v2.x name. Is there a migration planned?
   - Recommendation: Use `nous_registry.ousia` in Phase 44 — do NOT rename in this phase. Document the mapping in MarketplaceStore comments. Phase 50 migration owns any rename.

2. **`GET /api/v1/operator/me/nous` response shape for businessDid**
   - What we know: This endpoint exists (Phase 39); Steward local-ai page calls it to get `civicDid`
   - What's unclear: Whether it currently returns `businessDid` in its response, or whether Steward needs to make a separate call to check Business-DID status
   - Recommendation: Add a `business_did?: string | null` field to the `GET /api/v1/operator/me/nous` response in the same plan that wires the create-listing form gate. Alternatively, call `GET /api/v1/registry/business-did/by-civic/<civicDid>` (Phase 37 endpoint) from Steward.

3. **`registerMarketListingsRoute` vs `registerMarketRoutes` in server.ts**
   - What we know: `server.ts` imports and calls `registerMarketListingsRoute` from `market-listings.ts`
   - What's unclear: Whether to rename the exported function or use a different file name
   - Recommendation: Create `grid/src/api/routes/market.ts` as the new full-featured file; update `server.ts` to import `registerMarketRoutes` from `./routes/market.js`; delete the old stub file.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified — Phase 44 is purely internal wiring of existing Grid codebase with no new external services, CLIs, or tools required).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Reputation computed per-query (not materialized) is adequate for Phase 44 volume | Reputation Scoring Decision | If browse query becomes slow, Phase 45 adds materialized column — no architectural change |
| A2 | `nous_registry.ousia` is the correct Bios balance column for marketplace Bios transfers | DB Transaction Boundary | If Bios is tracked elsewhere, settle transaction needs different SQL; verify before Plan 02 |
| A3 | Settlement timeout uses `setInterval` in `launcher.start()` rather than `clock.onTick` | Pitfall 2 / Chronos Pattern | Confirmed by launcher.ts analysis; NOT an assumption — this is VERIFIED behavior |
| A4 | `GET /api/v1/operator/me/nous` needs an update to return `businessDid` for Steward gate | Steward /economy Pattern | If the endpoint already returns it, no change needed; if not, one additional field addition required |

**Claims A3 is verified, not assumed. All other verified claims are sourced from direct codebase reads.**

---

## Sources

### Primary (HIGH confidence)

- `grid/src/audit/append-p2p-peer-announced.ts` — canonical 9-step sole-producer template (read 2026-05-28)
- `grid/src/audit/append-irs-disbursement-executed.ts` — audit-chain-only event pattern (read 2026-05-28)
- `grid/src/audit/broadcast-allowlist.ts` — allowlist baseline = 68, full ALLOWLIST_MEMBERS array (read 2026-05-28)
- `grid/src/api/policy.ts` — ROUTE_DID_POLICY enum values + existing entries (read 2026-05-28)
- `grid/src/api/routes/market-listings.ts` — Phase 36 stub confirmed, ready for replacement (read 2026-05-28)
- `grid/src/api/routes/p2p.ts` — multi-route file structure template (read 2026-05-28)
- `grid/src/db/schema.ts` — latest migration = v32; `nous_registry.ousia` column; `grid_config` table confirmed (read 2026-05-28)
- `grid/src/genesis/launcher.ts` — `start()` setInterval pattern; single `clock.onTick` constraint (read 2026-05-28)
- `grid/src/civic-registry/business-did-store.ts` — `listByCivicDid()` lookup pattern (read 2026-05-28)
- `grid/src/civic-registry/civic-did-store.ts` — confirmed constructor `(pool: Pool)` shape (read 2026-05-28)
- `.planning/phases/44-marketplace-v3/44-CONTEXT.md` — all locked decisions (read 2026-05-28)
- `.planning/REQUIREMENTS.md` §MKT-01..06 — acceptance criteria (read 2026-05-28)
- `.planning/STATE.md` — Phase 43 close-out; allowlist at 68 confirmed (read 2026-05-28)

### Secondary (MEDIUM confidence)

- `grid/src/main.ts` — `createGridApp` wiring confirms `CivicDidStore`, `BusinessDidStore`, `PresenceService` injection pattern
- `steward/src/app/system/local-ai/page.tsx` — `civicDid` loading pattern for Steward Business-DID gate

### Tertiary (LOW confidence)

- Reputation per-query performance estimate (A1) — no load test; justified by Phase 44 MVP scale

---

## Metadata

**Confidence breakdown:**
- Schema design: HIGH — follows exact patterns from schema.ts; all column types derived from existing tables
- Sole-producer payloads: HIGH — directly derived from locked decisions + FORBIDDEN_KEY_PATTERN analysis
- Chronos wiring: HIGH — verified from launcher.ts source; single onTick constraint confirmed
- Reputation approach: MEDIUM — per-query is simpler; materialization deferred if needed
- Steward page: MEDIUM — pattern from local-ai/page.tsx; Open Question 2 (businessDid field) needs resolution in Wave 0 plan

**Research date:** 2026-05-28
**Valid until:** 2026-06-28 (stable codebase; no fast-moving external dependencies)
