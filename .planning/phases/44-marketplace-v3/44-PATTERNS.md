# Phase 44: Marketplace v3 - Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 12 new/modified files
**Analogs found:** 12 / 12

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `grid/src/audit/append-market-listing-created.ts` | utility (sole-producer) | event-driven | `grid/src/audit/append-p2p-peer-announced.ts` | exact |
| `grid/src/audit/append-market-bid-placed.ts` | utility (sole-producer) | event-driven | `grid/src/audit/append-p2p-peer-announced.ts` | exact |
| `grid/src/audit/append-market-settled.ts` | utility (sole-producer) | event-driven | `grid/src/audit/append-p2p-peer-announced.ts` | exact |
| `grid/src/audit/append-market-disputed.ts` | utility (sole-producer) | event-driven | `grid/src/audit/append-p2p-peer-announced.ts` | exact |
| `grid/src/audit/append-irs-tax-collected.ts` | utility (sole-producer, audit-chain-only) | event-driven | `grid/src/audit/append-irs-disbursement-executed.ts` | exact |
| `grid/src/audit/broadcast-allowlist.ts` | config | event-driven | self (additive edit) | exact |
| `grid/src/db/schema.ts` | config (migration runner) | CRUD | self (additive edit) | exact |
| `grid/src/db/stores/marketplace-store.ts` | service | CRUD | `grid/src/civic-registry/business-did-store.ts` | role-match |
| `grid/src/api/routes/market.ts` | route handler (replaces stub) | request-response | `grid/src/api/routes/p2p.ts` | exact |
| `grid/src/api/policy.ts` | config | request-response | self (additive edit) | exact |
| `steward/src/app/economy/page.tsx` | component | request-response | self (full replacement — keep CSS/StewardShell patterns) | exact |
| `grid/src/genesis/launcher.ts` | service (wiring) | event-driven | self (additive edit — setInterval pattern) | exact |

---

## Pattern Assignments

### `grid/src/audit/append-market-listing-created.ts` (sole-producer, event-driven)

**Analog:** `grid/src/audit/append-p2p-peer-announced.ts` (lines 1–93)

**Imports pattern** (lines 22–24 of analog):
```typescript
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
```

**Regex constants pattern** (lines 26 of analog — adapt for new payload):
```typescript
const HEX64_RE = /^[0-9a-f]{64}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
```

**Interface + EXPECTED_KEYS pattern** (lines 28–36 of analog):
```typescript
/** Closed 5-key payload for market.listing_created. Keys ALPHABETICAL. */
export interface MarketListingCreatedPayload {
    readonly category: string;               // non-empty, ≤63 chars
    readonly listing_id: string;             // UUID_RE
    readonly price_bios: number;             // positive integer
    readonly seller_business_did_hash: string; // HEX64_RE — sha256(businessDid)
    readonly tick: number;                   // non-negative integer
}

const EXPECTED_KEYS = ['category', 'listing_id', 'price_bios', 'seller_business_did_hash', 'tick'] as const;
```

**8-step guard body pattern** (lines 44–93 of analog — adapt guards per field types):
```typescript
export function appendMarketListingCreated(
    audit: AuditChain,
    payload: MarketListingCreatedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendMarketListingCreated: payload must be a plain object`);
    }
    // 2. Regex guard: listing_id (UUID_RE).
    if (typeof payload.listing_id !== 'string' || !UUID_RE.test(payload.listing_id)) {
        throw new TypeError(`appendMarketListingCreated: listing_id must match UUID_RE, got ${JSON.stringify(payload.listing_id)}`);
    }
    // 2b. Regex guard: seller_business_did_hash (HEX64_RE).
    if (typeof payload.seller_business_did_hash !== 'string' || !HEX64_RE.test(payload.seller_business_did_hash)) {
        throw new TypeError(`...`);
    }
    // 3. Non-empty string guard: category.
    if (typeof payload.category !== 'string' || payload.category.length === 0) {
        throw new TypeError(`...`);
    }
    // 4. Positive integer guard: price_bios.
    if (!Number.isInteger(payload.price_bios) || payload.price_bios <= 0) {
        throw new TypeError(`...`);
    }
    // 5. Non-negative integer guard: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`...`);
    }
    // 6. Closed-tuple structural check (alphabetical key order matches EXPECTED_KEYS).
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendMarketListingCreated: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 7. Explicit reconstruction — no spread.
    const cleanPayload = {
        category: payload.category,
        listing_id: payload.listing_id,
        price_bios: payload.price_bios,
        seller_business_did_hash: payload.seller_business_did_hash,
        tick: payload.tick,
    };
    // 8. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(`appendMarketListingCreated: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }
    // 9. Commit to chain. actorDid = seller_business_did_hash.
    return audit.append('market.listing_created', payload.seller_business_did_hash, cleanPayload);
}
```

**Critical constraint:** `description` is in `FORBIDDEN_KEY_PATTERN` (broadcast-allowlist.ts line 583). The payload must NOT include a `description` key — only `listing_id` as DB reference.

---

### `grid/src/audit/append-market-bid-placed.ts` (sole-producer, event-driven)

**Analog:** `grid/src/audit/append-p2p-peer-announced.ts`

Same 8-step pattern as above. Payload spec (4 keys, alphabetical):
```typescript
export interface MarketBidPlacedPayload {
    readonly bidder_civic_did_hash: string; // HEX64_RE — sha256(civicDid)
    readonly listing_id: string;            // UUID_RE
    readonly offer_price_bios: number;      // positive integer
    readonly tick: number;                  // non-negative integer
}
const EXPECTED_KEYS = ['bidder_civic_did_hash', 'listing_id', 'offer_price_bios', 'tick'] as const;
// audit.append('market.bid_placed', payload.bidder_civic_did_hash, cleanPayload)
```

---

### `grid/src/audit/append-market-settled.ts` (sole-producer, event-driven)

**Analog:** `grid/src/audit/append-p2p-peer-announced.ts`

Payload spec (6 keys, alphabetical):
```typescript
export interface MarketSettledPayload {
    readonly buyer_civic_did_hash: string;     // HEX64_RE
    readonly irs_fee_bios: number;             // non-negative integer
    readonly listing_id: string;               // UUID_RE
    readonly price_bios: number;               // positive integer
    readonly seller_business_did_hash: string; // HEX64_RE
    readonly tick: number;                     // non-negative integer
}
const EXPECTED_KEYS = ['buyer_civic_did_hash', 'irs_fee_bios', 'listing_id', 'price_bios', 'seller_business_did_hash', 'tick'] as const;
// actorDid = buyer_civic_did_hash (the settling party per RESEARCH.md)
// audit.append('market.settled', payload.buyer_civic_did_hash, cleanPayload)
```

---

### `grid/src/audit/append-market-disputed.ts` (sole-producer, event-driven)

**Analog:** `grid/src/audit/append-p2p-peer-announced.ts`

Payload spec (4 keys, alphabetical):
```typescript
export interface MarketDisputedPayload {
    readonly complainant_civic_did_hash: string; // HEX64_RE
    readonly dispute_id: string;                  // UUID_RE
    readonly listing_id: string;                  // UUID_RE
    readonly tick: number;                        // non-negative integer
}
const EXPECTED_KEYS = ['complainant_civic_did_hash', 'dispute_id', 'listing_id', 'tick'] as const;
// audit.append('market.disputed', payload.complainant_civic_did_hash, cleanPayload)
```

---

### `grid/src/audit/append-irs-tax-collected.ts` (audit-chain-only sole-producer)

**Analog:** `grid/src/audit/append-irs-disbursement-executed.ts` (lines 1–80) — exact match for audit-chain-only pattern.

**Key difference from market.* producers:** Step 9 comment must say "NOT in broadcast allowlist — audit-chain only" (see analog line 78). The event is appended to the chain normally but is NOT in `ALLOWLIST_MEMBERS`.

**Imports** (lines 18–20 of analog — identical):
```typescript
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
```

**Payload spec** (5 keys, alphabetical — from D-44-03):
```typescript
export interface IrsTaxCollectedPayload {
    readonly amount_bios: number;           // positive integer
    readonly listing_id: string;            // UUID_RE
    readonly payer_civic_did_hash: string;  // HEX64_RE — buyer who paid IRS fee
    readonly tick: number;                  // non-negative integer
    readonly total_treasury_after: number;  // non-negative integer
}
const EXPECTED_KEYS = ['amount_bios', 'listing_id', 'payer_civic_did_hash', 'tick', 'total_treasury_after'] as const;
// audit.append('irs.tax_collected', payload.payer_civic_did_hash, cleanPayload)
// Comment: "NOT in broadcast allowlist — audit-chain only. Phase 45 adds to allowlist (+3 delta)."
```

---

### `grid/src/audit/broadcast-allowlist.ts` (additive edit — allowlist 68→72)

**Analog:** Self — additive edit to `ALLOWLIST_MEMBERS` array.

**Where to add** (after line 286, after `'operator.nous_forked'` entry):
```typescript
    // Phase 44 (MKT-06 / D-44-01) — Civic marketplace audit events. Allowlist 68 → 72.
    // market.listing_created: closed 5-key {category, listing_id, price_bios, seller_business_did_hash, tick}.
    //   Emitted ONLY via appendMarketListingCreated (grid/src/audit/append-market-listing-created.ts).
    // market.bid_placed: closed 4-key {bidder_civic_did_hash, listing_id, offer_price_bios, tick}.
    //   Emitted ONLY via appendMarketBidPlaced (grid/src/audit/append-market-bid-placed.ts).
    // market.settled: closed 6-key {buyer_civic_did_hash, irs_fee_bios, listing_id, price_bios, seller_business_did_hash, tick}.
    //   Emitted ONLY via appendMarketSettled (grid/src/audit/append-market-settled.ts).
    //   After emit, appendIrsTaxCollected fires audit-chain-only (NOT on allowlist until Phase 45).
    // market.disputed: closed 4-key {complainant_civic_did_hash, dispute_id, listing_id, tick}.
    //   Emitted ONLY via appendMarketDisputed (grid/src/audit/append-market-disputed.ts).
    'market.listing_created', // (69) {category, listing_id, price_bios, seller_business_did_hash, tick}
    'market.bid_placed',      // (70) {bidder_civic_did_hash, listing_id, offer_price_bios, tick}
    'market.settled',         // (71) {buyer_civic_did_hash, irs_fee_bios, listing_id, price_bios, seller_business_did_hash, tick}
    'market.disputed',        // (72) {complainant_civic_did_hash, dispute_id, listing_id, tick}
```

**Comment header update** (line 24 of analog — update "exactly these 68" to "exactly these 72" and add Phase 44 block reference):
```
// + Phase 43 + Phase 44) — exactly these 72 event types.
```

**CRITICAL — irs.tax_collected is NOT added to ALLOWLIST_MEMBERS in Phase 44.** It uses audit.append() normally but stays off the allowlist. Phase 45 adds it.

---

### `grid/src/db/schema.ts` (additive edit — migrations v33–v35)

**Analog:** Self — additive edit. Follow the existing `{version, name, up, down}` format (lines 530–592 of analog for migration v30–v32).

**Where to insert** (after the closing `},` of version 32 migration, before the closing `];` of the MIGRATIONS array at line 592):
```typescript
    // Phase 44 MKT-01..06 — Civic marketplace tables (listings, bids, escrow).
    {
        version: 33,
        name: 'marketplace_listings_bids_escrow',
        up: `
            CREATE TABLE IF NOT EXISTS marketplace_listings (
                listing_id          CHAR(36)        NOT NULL,
                grid_name           VARCHAR(63)     NOT NULL,
                seller_civic_did    VARCHAR(255)    NOT NULL,
                seller_business_did VARCHAR(255)    NOT NULL,
                title               VARCHAR(255)    NOT NULL,
                description         TEXT            NOT NULL,
                price_bios          BIGINT UNSIGNED NOT NULL,
                category            VARCHAR(63)     NOT NULL,
                status              ENUM('active','accepted','settled','expired','cancelled') NOT NULL DEFAULT 'active',
                created_at_tick     INT UNSIGNED    NOT NULL,
                expires_at_tick     INT UNSIGNED    NOT NULL,
                PRIMARY KEY (listing_id),
                INDEX idx_browse    (grid_name, status, category, price_bios),
                INDEX idx_seller    (grid_name, seller_civic_did),
                INDEX idx_expiry    (grid_name, expires_at_tick)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS marketplace_bids (
                bid_id              CHAR(36)        NOT NULL,
                listing_id          CHAR(36)        NOT NULL,
                grid_name           VARCHAR(63)     NOT NULL,
                bidder_civic_did    VARCHAR(255)    NOT NULL,
                offer_price_bios    BIGINT UNSIGNED NOT NULL,
                bid_message         VARCHAR(512),
                status              ENUM('pending','accepted','rejected','expired') NOT NULL DEFAULT 'pending',
                placed_at_tick      INT UNSIGNED    NOT NULL,
                PRIMARY KEY (bid_id),
                INDEX idx_listing   (listing_id),
                INDEX idx_bidder    (grid_name, bidder_civic_did)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS marketplace_escrow (
                escrow_id           CHAR(36)        NOT NULL,
                listing_id          CHAR(36)        NOT NULL,
                bid_id              CHAR(36)        NOT NULL,
                grid_name           VARCHAR(63)     NOT NULL,
                buyer_civic_did     VARCHAR(255)    NOT NULL,
                seller_civic_did    VARCHAR(255)    NOT NULL,
                amount_bios         BIGINT UNSIGNED NOT NULL,
                escrow_status       ENUM('held','frozen','settled','refunded') NOT NULL DEFAULT 'held',
                buyer_confirmed     TINYINT(1)      NOT NULL DEFAULT 0,
                seller_confirmed    TINYINT(1)      NOT NULL DEFAULT 0,
                accepted_at_tick    INT UNSIGNED    NOT NULL,
                settled_at_tick     INT UNSIGNED,
                PRIMARY KEY (escrow_id),
                UNIQUE KEY uq_listing (listing_id),
                INDEX idx_timeout   (grid_name, escrow_status, accepted_at_tick)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `
            DROP TABLE IF EXISTS marketplace_escrow;
            DROP TABLE IF EXISTS marketplace_bids;
            DROP TABLE IF EXISTS marketplace_listings
        `,
    },
    // Phase 44 MKT-05 / D-44-04 / D-44-05 — Dispute + Police stub tables.
    {
        version: 34,
        name: 'marketplace_disputes_police_investigations',
        up: `
            CREATE TABLE IF NOT EXISTS marketplace_disputes (
                dispute_id              CHAR(36)    NOT NULL,
                listing_id              CHAR(36)    NOT NULL,
                grid_name               VARCHAR(63) NOT NULL,
                complainant_civic_did_hash CHAR(64) NOT NULL,
                dispute_status          ENUM('pending_police','resolved','closed') NOT NULL DEFAULT 'pending_police',
                settled_audit_entry_id  BIGINT UNSIGNED,
                created_at_tick         INT UNSIGNED NOT NULL,
                PRIMARY KEY (dispute_id),
                INDEX idx_listing   (listing_id),
                INDEX idx_status    (grid_name, dispute_status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS police_investigations (
                investigation_id    CHAR(36)        NOT NULL,
                grid_name           VARCHAR(63)     NOT NULL,
                source_type         VARCHAR(63)     NOT NULL,
                source_ref          CHAR(36)        NOT NULL,
                status              ENUM('pending','open','closed','resolved') NOT NULL DEFAULT 'pending',
                opened_at_tick      INT UNSIGNED    NOT NULL,
                closed_at_tick      INT UNSIGNED,
                PRIMARY KEY (investigation_id),
                INDEX idx_source    (source_type, source_ref),
                INDEX idx_status    (grid_name, status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `
            DROP TABLE IF EXISTS police_investigations;
            DROP TABLE IF EXISTS marketplace_disputes
        `,
    },
    // Phase 44 D-44-02 / D-44-03 — Civic treasury table + IRS config seed.
    {
        version: 35,
        name: 'civic_treasury_seed_irs_config',
        up: `
            CREATE TABLE IF NOT EXISTS civic_treasury (
                grid_name           VARCHAR(63)     NOT NULL,
                balance_bios        BIGINT          NOT NULL DEFAULT 0,
                last_updated_tick   INT             NOT NULL DEFAULT 0,
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

### `grid/src/db/stores/marketplace-store.ts` (service, CRUD)

**Analog:** `grid/src/civic-registry/business-did-store.ts` (lines 1–96)

**Constructor pattern** (line 44–46 of analog — use Pool directly, same as BusinessDidStore):
```typescript
import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { randomUUID, createHash } from 'node:crypto';

export class MarketplaceStore {
    constructor(private readonly pool: Pool) {}
```

**Row interface + rowToRecord pattern** (lines 13–42 of analog — define one interface per table per query):
```typescript
interface ListingRow extends RowDataPacket {
    listing_id: string;
    grid_name: string;
    seller_civic_did: string;
    seller_business_did: string;
    title: string;
    price_bios: number;
    category: string;
    status: string;
    created_at_tick: number;
    expires_at_tick: number;
    reputation_score: number | null;
}
```

**Parameterized query pattern** (lines 47–81 of analog — always `this.pool.query<RowType[]>(sql, params)`):
```typescript
async createListing(params: {
    gridName: string;
    sellerCivicDid: string;
    sellerBusinessDid: string;
    title: string;
    description: string;
    priceBios: bigint;
    category: string;
    createdAtTick: number;
    expiresAtTick: number;
}): Promise<string> {
    const listingId = randomUUID();
    await this.pool.query(
        `INSERT INTO marketplace_listings
            (listing_id, grid_name, seller_civic_did, seller_business_did, title, description, price_bios, category, status, created_at_tick, expires_at_tick)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
        [listingId, params.gridName, params.sellerCivicDid, params.sellerBusinessDid,
         params.title, params.description, params.priceBios.toString(), params.category,
         params.createdAtTick, params.expiresAtTick],
    );
    return listingId;
}
```

**Transaction pattern** (from RESEARCH.md DB Transaction Boundary section — use `pool.getConnection()` for multi-statement transactions):
```typescript
async settle(params: {
    gridName: string;
    listingId: string;
    irsFeeRate: number;
    currentTick: number;
}): Promise<{ sellerPayout: bigint; irsFee: bigint; sellerCivicDid: string; buyerCivicDid: string; totalTreasuryAfter: bigint }> {
    const conn = await this.pool.getConnection();
    try {
        await conn.beginTransaction();
        // Step 1: Lock escrow row
        const [escrowRows] = await conn.query<RowDataPacket[]>(
            `SELECT escrow_id, amount_bios, buyer_civic_did, seller_civic_did, buyer_confirmed, seller_confirmed
             FROM marketplace_escrow
             WHERE listing_id = ? AND escrow_status = 'held'
             FOR UPDATE`,
            [params.listingId],
        );
        if (!escrowRows[0]) { await conn.rollback(); throw new Error('escrow_not_found'); }
        const escrow = escrowRows[0];
        if (!escrow.buyer_confirmed || !escrow.seller_confirmed) {
            await conn.rollback(); throw new Error('not_both_confirmed');
        }
        const amountBios = BigInt(escrow.amount_bios);
        const irsFee = BigInt(Math.floor(Number(amountBios) * params.irsFeeRate));
        const sellerPayout = amountBios - irsFee;
        // Steps 2–6: transfer Bios, update treasury, update escrow+listing status
        await conn.query(`UPDATE nous_registry SET ousia = ousia + ? WHERE grid_name = ? AND did = ?`,
            [sellerPayout.toString(), params.gridName, escrow.seller_civic_did]);
        await conn.query(
            `INSERT INTO civic_treasury (grid_name, balance_bios, last_updated_tick)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE balance_bios = balance_bios + VALUES(balance_bios), last_updated_tick = VALUES(last_updated_tick)`,
            [params.gridName, irsFee.toString(), params.currentTick]);
        await conn.query(`UPDATE marketplace_escrow SET escrow_status='settled', settled_at_tick=? WHERE escrow_id=?`,
            [params.currentTick, escrow.escrow_id]);
        await conn.query(`UPDATE marketplace_listings SET status='settled' WHERE listing_id=?`,
            [params.listingId]);
        const [treasuryRows] = await conn.query<RowDataPacket[]>(
            `SELECT balance_bios FROM civic_treasury WHERE grid_name = ?`, [params.gridName]);
        const totalTreasuryAfter = BigInt(treasuryRows[0]?.balance_bios ?? 0);
        await conn.commit();
        return { sellerPayout, irsFee, sellerCivicDid: escrow.seller_civic_did, buyerCivicDid: escrow.buyer_civic_did, totalTreasuryAfter };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}
```

**Read IRS fee rate BEFORE transaction** (from RESEARCH.md Pitfall 1 — read outside tx to avoid deadlock):
```typescript
async getConfigValue(gridName: string, key: string): Promise<string | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
        `SELECT config_value FROM grid_config WHERE grid_name = ? AND config_key = ?`,
        [gridName, key],
    );
    return rows[0]?.config_value ?? null;
}
```

**Browse with reputation subquery** (from RESEARCH.md Pattern — Reputation Scoring Decision):
```typescript
async browseListings(params: {
    gridName: string;
    category?: string;
    maxPriceBios?: bigint;
    currentTick: number;
    limit: number;
    offset: number;
}): Promise<Array<ListingRow & { reputation_score: number }>> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
        `SELECT l.*,
            COALESCE(
                rs.settled_count / NULLIF(rs.settled_count + rs.disputed_count, 0),
                1.0
            ) AS reputation_score
         FROM marketplace_listings l
         LEFT JOIN (
             SELECT e.seller_civic_did,
                 SUM(CASE WHEN e.escrow_status = 'settled' THEN 1 ELSE 0 END) AS settled_count,
                 SUM(CASE WHEN e.escrow_status = 'frozen'  THEN 1 ELSE 0 END) AS disputed_count
             FROM marketplace_escrow e WHERE e.grid_name = ? GROUP BY e.seller_civic_did
         ) rs ON rs.seller_civic_did = l.seller_civic_did
         WHERE l.grid_name = ? AND l.status = 'active'
           AND (? IS NULL OR l.category = ?)
           AND (? IS NULL OR l.price_bios <= ?)
           AND l.expires_at_tick > ?
         ORDER BY l.created_at_tick DESC, l.listing_id ASC
         LIMIT ? OFFSET ?`,
        [params.gridName,
         params.gridName,
         params.category ?? null, params.category ?? null,
         params.maxPriceBios != null ? params.maxPriceBios.toString() : null,
         params.maxPriceBios != null ? params.maxPriceBios.toString() : null,
         params.currentTick,
         params.limit, params.offset],
    );
    return rows as Array<ListingRow & { reputation_score: number }>;
}
```

---

### `grid/src/api/routes/market.ts` (route handler, request-response)

**Analog:** `grid/src/api/routes/p2p.ts` (lines 1–206)

**Module header + imports pattern** (lines 25–47 of analog — adapt for marketplace):
```typescript
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { createHash, randomUUID } from 'node:crypto';
import { appendMarketListingCreated } from '../../audit/append-market-listing-created.js';
import { appendMarketBidPlaced } from '../../audit/append-market-bid-placed.js';
import { appendMarketSettled } from '../../audit/append-market-settled.js';
import { appendMarketDisputed } from '../../audit/append-market-disputed.js';
import { appendIrsTaxCollected } from '../../audit/append-irs-tax-collected.js';
import { MarketplaceStore } from '../../marketplace/marketplace-store.js';

const CIVIC_DID_RE = /^did:civic:noesis:[a-z0-9-]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sha256Hex(input: string): string {
    return createHash('sha256').update(input).digest('hex');
}
```

**Export function signature pattern** (lines 49–52 of analog):
```typescript
export async function registerMarketRoutes(
    app: FastifyInstance,
    services: GridServices,
): Promise<void> {
```

**Route pattern: services guard + DID extraction** (lines 55–73 of analog — adapt per route):
```typescript
    // ── GET /api/v1/market/listings (public browse — replaces Phase 36 stub) ──────
    app.get<{ Querystring: { category?: string; max_price?: string; limit?: string; offset?: string } }>(
        '/api/v1/market/listings', async (req, reply) => {
        const pool = services.pool;
        if (!pool) return reply.code(503).send({ error: 'db_unavailable' });
        const tickFn = services.currentTick;
        if (!tickFn) return reply.code(503).send({ error: 'clock_unavailable' });
        const store = new MarketplaceStore(pool);
        const currentTick = tickFn();
        const { category, max_price, limit: limitStr, offset: offsetStr } = req.query;
        const limit = Math.min(50, Math.max(1, parseInt(limitStr ?? '20', 10) || 20));
        const offset = Math.max(0, parseInt(offsetStr ?? '0', 10) || 0);
        const maxPriceBios = max_price ? BigInt(max_price) : undefined;
        const listings = await store.browseListings({
            gridName: services.gridName,
            category,
            maxPriceBios,
            currentTick,
            limit,
            offset,
        });
        return reply.code(200).send({ listings });
    });

    // ── POST /api/v1/market/listing/create (business_did_required) ────────────────
    app.post<{ Body: { title: string; description: string; price_bios: number; category: string; expires_in_ticks: number } }>(
        '/api/v1/market/listing/create', async (req, reply) => {
        const pool = services.pool;
        if (!pool) return reply.code(503).send({ error: 'db_unavailable' });
        const tickFn = services.currentTick;
        if (!tickFn) return reply.code(503).send({ error: 'clock_unavailable' });

        const civicDid = req.didContext?.did;
        if (!civicDid || !CIVIC_DID_RE.test(civicDid) || req.didContext?.tier !== 'civic_member') {
            return reply.code(401).send({ error: 'unauthorized' });
        }
        // Business-DID auth gate (MKT-01 / D-V3-33)
        const businessDidStore = services.businessDidStore;
        if (!businessDidStore) return reply.code(503).send({ error: 'business_registry_unavailable' });
        const businesses = await businessDidStore.listByCivicDid(services.gridName, civicDid);
        const activeBusiness = businesses.find(b => b.status === 'active');
        if (!activeBusiness) {
            return reply.code(403).send({ error: 'business_did_required' });
        }
        // ... validate body, create listing, emit audit event
    });
```

**In `grid/src/api/server.ts`** — replace the old stub registration:
```typescript
// BEFORE (line 732):
registerMarketListingsRoute(app, services);

// AFTER:
void registerMarketRoutes(app, services);
// Also update import at line 38:
// import { registerMarketRoutes } from './routes/market.js';
// (delete the registerMarketListingsRoute import)
```

**Police stub route** (included in the same `market.ts` file or a separate `police-stub.ts` — planner's discretion; pattern is identical):
```typescript
    // ── POST /api/v1/police/investigate (civic_did_required stub — D-44-05) ────
    app.post<{ Body: { source_type: string; source_ref: string } }>(
        '/api/v1/police/investigate', async (req, reply) => {
        const pool = services.pool;
        if (!pool) return reply.code(503).send({ error: 'db_unavailable' });
        const tickFn = services.currentTick;
        if (!tickFn) return reply.code(503).send({ error: 'clock_unavailable' });
        const civicDid = req.didContext?.did;
        if (!civicDid || req.didContext?.tier !== 'civic_member') {
            return reply.code(401).send({ error: 'unauthorized' });
        }
        const { source_type, source_ref } = req.body ?? {};
        if (source_type !== 'marketplace_dispute' || !source_ref || !UUID_RE.test(source_ref)) {
            return reply.code(400).send({ error: 'invalid_source' });
        }
        const investigationId = randomUUID();
        const tick = tickFn();
        await pool.query(
            `INSERT INTO police_investigations (investigation_id, grid_name, source_type, source_ref, status, opened_at_tick)
             VALUES (?, ?, ?, ?, 'pending', ?)`,
            [investigationId, services.gridName, source_type, source_ref, tick],
        );
        return reply.code(201).send({ investigation_id: investigationId });
    });
```

---

### `grid/src/api/policy.ts` (additive edit)

**Analog:** Self — additive edit. Follow the Phase 42/43 block comment pattern (lines 247–258 of analog).

**Add after the Phase 43 FORK-01 entries** (after line 257 of analog):
```typescript
    // Phase 44 MKT-01..06 — Civic marketplace routes (8 new entries per RESEARCH.md Pattern 4).
    // GET /api/v1/market/listings is already 'public' (Phase 36 VIS-01, line 35 of policy.ts).
    'POST /api/v1/market/listing/create':               'business_did_required', // MKT-01
    'GET /api/v1/market/listing/:id':                    'public',               // MKT-02 single view
    'POST /api/v1/market/listing/:id/bid':               'civic_did_required',   // MKT-03
    'POST /api/v1/market/listing/:id/accept':            'civic_did_required',   // MKT-03 seller accept
    'POST /api/v1/market/listing/:id/reject':            'civic_did_required',   // MKT-03 seller reject
    'POST /api/v1/market/listing/:id/confirm-settlement': 'civic_did_required',  // MKT-04
    'POST /api/v1/market/listing/:id/dispute':           'civic_did_required',   // MKT-05
    'POST /api/v1/police/investigate':                   'civic_did_required',   // D-44-05 stub
```

---

### `grid/src/api/server.ts` (additive edit — GridServices + wiring)

**Two changes needed:**

1. Add `marketplaceStore` optional field to `GridServices` interface (follow `businessDidStore` field pattern at lines 299–305 of server.ts):
```typescript
    /**
     * Phase 44 MKT-01..06: MarketplaceStore for marketplace CRUD operations.
     * When absent, marketplace routes return 503 db_unavailable (they use services.pool directly).
     * Phase 44 routes use services.pool directly (same pool as businessDidStore).
     */
    // NOTE: Phase 44 routes use services.pool directly for MarketplaceStore construction.
    // No separate marketplaceStore field needed — MarketplaceStore is instantiated inline
    // in each route handler (same pattern as the Phase 36 stub which used no store at all).
```

2. Replace stub route registration (line 732 of server.ts):
```typescript
// Remove: registerMarketListingsRoute(app, services);
// Remove: import { registerMarketListingsRoute } from './routes/market-listings.js';
// Add:    import { registerMarketRoutes } from './routes/market.js';
// Add:    void registerMarketRoutes(app, services);
```

---

### `grid/src/genesis/launcher.ts` (additive edit — settlement timeout setInterval)

**Analog:** Self — additive edit. Follow the Phase 42 P2P cleanup `setInterval` pattern (lines 558–567 of launcher.ts).

**Class field declarations** (at the top of the GenesisLauncher class, alongside `_p2pCleanupInterval`):
```typescript
private _settlementTimeoutInterval: ReturnType<typeof setInterval> | null = null;
```

**In `start()` method** (add after Phase 42 `_p2pCleanupInterval = setInterval(...)` block, lines ~567):
```typescript
        // Phase 44 MKT-04/05 (D-44-05b) — settlement timeout loop.
        // Checks open escrow rows: WHERE status='accepted' AND accepted_at_tick + timeout_ticks < current_tick.
        // OBS-R-32-02 paired clearInterval is in stop() below.
        // IMPORTANT: Uses setInterval NOT clock.onTick — single onTick constraint (line 461 comment).
        this._settlementTimeoutInterval = setInterval(() => {
            const pool = this._pool;
            const audit = this.audit;
            const tick = this.clock.currentTick;
            if (!pool || tick === undefined) return;
            void checkSettlementTimeouts(pool, audit, tick, this.gridName)
                .catch(() => {});
        }, 1_000); // every 1s (~every tick at default 500ms tickRateMs)
```

**In `stop()` method** (after Phase 42 `_p2pCleanupInterval` clear, lines ~582–585):
```typescript
        // Phase 44 — OBS-R-32-02: clear settlement timeout interval.
        if (this._settlementTimeoutInterval !== null) {
            clearInterval(this._settlementTimeoutInterval);
            this._settlementTimeoutInterval = null;
        }
```

**`checkSettlementTimeouts` helper** — implement as a module-level async function in launcher.ts or a separate `grid/src/marketplace/settlement-timeout.ts` file (planner's discretion). Function signature:
```typescript
async function checkSettlementTimeouts(
    pool: Pool,
    audit: AuditChain,
    currentTick: number,
    gridName: string,
): Promise<void>
```

---

### `steward/src/app/economy/page.tsx` (component, request-response — full replacement)

**Analog:** Self (current file, lines 1–319) — full replacement, keeping StewardShell wrapper and CSS variable patterns.

**Shell + imports pattern** (lines 1–6 of current file — keep exactly):
```typescript
'use client';

import { useEffect, useState } from 'react';
import StewardShell from '@/components/StewardShell';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';
```

**State + async fetch pattern** (lines 43–88 of current file — adapt for listings + businessDid):
```typescript
export default function EconomyPage() {
    // Browse state
    const [listings, setListings] = useState<MarketListing[]>([]);
    const [listingsLoading, setListingsLoading] = useState(true);
    const [listingsError, setListingsError] = useState<string | null>(null);
    const [category, setCategory] = useState<string>('');
    const [maxPrice, setMaxPrice] = useState<string>('');
    const [offset, setOffset] = useState(0);

    // Business-DID gate state
    const [businessDid, setBusinessDid] = useState<string | null>(null);
    const [businessDidLoading, setBusinessDidLoading] = useState(true);

    // Create form state
    const [createTitle, setCreateTitle] = useState('');
    // ... etc

    async function fetchListings(nextOffset = 0) {
        setListingsLoading(true);
        setListingsError(null);
        try {
            const params = new URLSearchParams({ limit: '20', offset: String(nextOffset) });
            if (category) params.set('category', category);
            if (maxPrice) params.set('max_price', maxPrice);
            const res = await fetch(`${GRID_ORIGIN}/api/v1/market/listings?${params}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setListings(data.listings ?? []);
        } catch (e) {
            setListingsError(e instanceof Error ? e.message : 'Failed to fetch listings');
        } finally {
            setListingsLoading(false);
        }
    }

    useEffect(() => {
        // Check Business-DID status for create form gate
        void (async () => {
            const res = await fetch(`${GRID_ORIGIN}/api/v1/operator/me/nous`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setBusinessDid(data?.businessDid ?? null);
            }
            setBusinessDidLoading(false);
        })();
        void fetchListings(0);
    }, []);
```

**CSS variable pattern** (lines 96–317 of current file — keep all var(--serif), var(--mono), var(--sans), var(--ink), var(--muted), var(--rule) CSS variables; keep steward-card className; keep table/thead/tbody structure):
```tsx
    return (
        <StewardShell title="Economy" breadcrumb="Steward · Economy">
            {/* Browse section */}
            <div className="steward-card" style={{ marginBottom: 32 }}>
                {/* header with h2, filters */}
                {/* listings table with reputation_score column */}
                {/* pagination — same prev/next button pattern as current file lines 182–217 */}
            </div>

            {/* Create listing section */}
            <div className="steward-card">
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rule)' }}>
                    <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400, color: 'var(--ink)' }}>
                        Create Listing
                    </h2>
                </div>
                {businessDidLoading ? (
                    <div style={{ padding: '32px 20px', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                        Checking Business-DID status…
                    </div>
                ) : !businessDid ? (
                    <div style={{ padding: '32px 20px', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                        Business-DID required to create listings.{' '}
                        <a href="/economy/register-business" style={{ color: 'var(--ink)' }}>Register a Business-DID</a>
                    </div>
                ) : (
                    <form style={{ padding: '20px' }} onSubmit={handleCreate}>
                        {/* title, description, price_bios, category, expires_in_ticks inputs */}
                        {/* button style matching existing StewardShell button patterns */}
                    </form>
                )}
            </div>
        </StewardShell>
    );
}
```

**Open question for planner** (RESEARCH.md Open Question 2): Confirm whether `GET /api/v1/operator/me/nous` already returns a `businessDid` field. If not, the planner must add that field to the endpoint response or use `GET /api/v1/registry/business-did/by-civic/<civicDid>` as an alternative.

---

## Shared Patterns

### Business-DID Auth Gate
**Source:** `grid/src/civic-registry/business-did-store.ts` lines 73–81 + RESEARCH.md Pattern 5
**Apply to:** `POST /api/v1/market/listing/create` route handler
```typescript
const businesses = await businessDidStore.listByCivicDid(gridName, civicDid);
const activeBusiness = businesses.find(b => b.status === 'active');
if (!activeBusiness) {
    return reply.code(403).send({ error: 'business_did_required' });
}
```

### Civic-DID Extraction in Routes
**Source:** `grid/src/api/routes/p2p.ts` lines 61–65 (announce handler), lines 108–111 (signal handler)
**Apply to:** All `civic_did_required` marketplace routes
```typescript
const civicDid = req.didContext?.did;
if (!civicDid || !CIVIC_DID_RE.test(civicDid) || req.didContext?.tier !== 'civic_member') {
    return reply.code(401).send({ error: 'unauthorized' });
}
```

### SHA-256 Hash Helper
**Source:** `grid/src/api/routes/p2p.ts` lines 45–47
**Apply to:** All route handlers that emit audit events with `*_hash` fields
```typescript
function sha256Hex(input: string): string {
    return createHash('sha256').update(input).digest('hex');
}
```

### services.pool Guard
**Source:** `grid/src/api/routes/p2p.ts` lines 57–59 pattern (adapt for pool instead of p2p)
**Apply to:** All marketplace route handlers
```typescript
const pool = services.pool;
if (!pool) return reply.code(503).send({ error: 'db_unavailable' });
const tickFn = services.currentTick;
if (!tickFn) return reply.code(503).send({ error: 'clock_unavailable' });
```

### Privacy Gate Step (sole-producers)
**Source:** `grid/src/audit/append-p2p-peer-announced.ts` lines 84–90
**Apply to:** All 5 new sole-producer files
```typescript
const privacy = payloadPrivacyCheck(cleanPayload);
if (!privacy.ok) {
    throw new TypeError(
        `appendX: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
    );
}
```

### Migration Array Format
**Source:** `grid/src/db/schema.ts` lines 529–591 (versions 30–32)
**Apply to:** Three new migration entries (v33, v34, v35)
Each entry: `{ version: number, name: string, up: string, down: string }`

### setInterval OBS-R-32-02 Pattern
**Source:** `grid/src/genesis/launcher.ts` lines 558–567 (P2P cleanup) + lines 579–585 (stop cleanup)
**Apply to:** Settlement timeout interval in launcher.ts
Invariant: every `setInterval` in `start()` MUST have a paired `clearInterval` in `stop()`.

---

## No Analog Found

All files have direct analogs in the codebase. No external pattern references required.

---

## Metadata

**Analog search scope:** `grid/src/audit/`, `grid/src/api/routes/`, `grid/src/api/`, `grid/src/db/`, `grid/src/genesis/`, `grid/src/civic-registry/`, `steward/src/app/economy/`
**Files scanned:** 11 source files read directly
**Pattern extraction date:** 2026-05-28

**Key invariants for planner:**
1. `description` key is FORBIDDEN in all audit payloads — use `listing_id` as DB reference (FORBIDDEN_KEY_PATTERN in broadcast-allowlist.ts line 583 matches `description`).
2. `irs.tax_collected` is NOT added to `ALLOWLIST_MEMBERS` in Phase 44 — audit-chain-only until Phase 45.
3. Settlement timeout MUST use `setInterval` in `start()`, NOT `clock.onTick` (single-subscription constraint at launcher.ts line 461).
4. Escrow is funded at ACCEPT time, not bid time (D-44-10) — buyer Bios check inside the accept transaction.
5. Dispute flow: BEGIN/COMMIT to freeze escrow + insert dispute row FIRST, THEN emit audit event (Pitfall 4 from RESEARCH.md).
6. The Phase 36 stub file `market-listings.ts` is REPLACED (not extended) by `market.ts`. Update both the import and the `registerMarketListingsRoute` call in `server.ts`.
7. ALLOWLIST comment header at broadcast-allowlist.ts line 24 must be updated from "68" to "72" in the same commit.
