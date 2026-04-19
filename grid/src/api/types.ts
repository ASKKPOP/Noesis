/**
 * API request/response types for Grid services.
 */

export interface GridStatus {
    name: string;
    tick: number;
    epoch: number;
    nousCount: number;
    regionCount: number;
    activeLaws: number;
    auditEntries: number;
    uptime: number;
}

export interface DomainRegistration {
    name: string;
    gridDomain: string;
    didKey: string;
    publicKey: string;
    humanOwner?: string;
}

export interface DomainRecord {
    name: string;
    gridDomain: string;
    fullAddress: string;
    didKey: string;
    status: 'pending' | 'active' | 'suspended' | 'exiled';
}

export interface ErrorResponse {
    error: string;
    code: number;
}

// ── Phase 4 Plan 03: REST surface for Inspector + Economy ────────────────────

/**
 * Nous roster entry returned by GET /api/v1/grid/nous.
 * Consumed by the dashboard Inspector (Plan 04-05) and Economy panel
 * (Plan 04-06) for the balance grid.
 */
export interface NousRosterEntry {
    did: string;
    name: string;
    region: string;
    ousia: number;
    lifecyclePhase: string;
    reputation: number;
    status: string;
}

export interface NousRosterResponse {
    nous: NousRosterEntry[];
}

/** Fixed error shape for all Plan 04-03 routes. */
export interface ApiError {
    error: string;
}

/**
 * Trade record returned by GET /api/v1/economy/trades.
 *
 * W2 CROSS-PLAN CONTRACT: Unix timestamp in INTEGER SECONDS (not milliseconds).
 * Consumers (dashboard memory.tsx, dashboard trades-table.tsx) apply `* 1000`
 * before Date() construction. Server-side test asserts every row satisfies
 * `value < 10_000_000_000` — any value ≥ 10^10 is ms (a bug).
 */
export interface TradeRecord {
    actorDid: string;
    counterparty: string;
    amount: number;
    nonce: string;
    // Unix SECONDS (integer). See W2 contract comment above.
    timestamp: number;
}

export interface TradesResponse {
    trades: TradeRecord[];
    total: number;
}

export interface ShopsResponse {
    shops: Array<{
        ownerDid: string;
        name: string;
        listings: Array<{ sku: string; label: string; priceOusia: number }>;
    }>;
}
