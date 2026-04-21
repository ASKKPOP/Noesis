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

// ── Phase 6: Human Agency Scale (AGENCY-01..04) ──────────────────────────────

/**
 * SYNC: dashboard/src/lib/protocol/agency-types.ts (Phase 6 tier types).
 *
 * Two-source copy intentional — Grid and dashboard are separate packages
 * (per Phase 5 precedent; audit-types.ts follows the same rule). If one
 * side changes, update the other in the same commit.
 *
 * Authoritative tier definitions live in PHILOSOPHY.md §7. H5 Sovereign is
 * declared here for type completeness but is OUT OF SCOPE for Phase 6 —
 * the only H5 surface is a disabled affordance (see D-20).
 */
export type HumanAgencyTier = 'H1' | 'H2' | 'H3' | 'H4' | 'H5';

export const TIER_NAME: Record<HumanAgencyTier, string> = {
    H1: 'Observer',
    H2: 'Reviewer',
    H3: 'Partner',
    H4: 'Driver',
    H5: 'Sovereign',
};

/**
 * Session-scoped operator identity: `op:<uuid-v4>` per D-04.
 *
 * NOT a DID. DIDs are reserved for Nous (Phase 1 IDENT-01); widening that
 * semantic space risks downstream confusion. `op:*` is a distinct, compact
 * namespace stored in the dashboard's localStorage.
 *
 * Regex matches the RFC 4122 v4 UUID layout exactly:
 *   - Version nibble: `4`
 *   - Variant nibble: `8`, `9`, `a`, or `b`
 */
export const OPERATOR_ID_REGEX =
    /^op:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
