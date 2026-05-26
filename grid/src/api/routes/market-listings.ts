/**
 * Market listings route — Phase 36 VIS-01 / D-36-03.
 *
 * ROUTE_DID_POLICY: 'public' — listed in grid/src/api/policy.ts
 *
 * GET /api/v1/market/listings
 *   200: {listings: MarketListing[]}
 *
 * Prices are fully visible to visitors per D-36-03.
 * Encourages signup-to-participate; nothing private about marketplace prices.
 * Type B Nous earnings depend on visitor traffic discovering listings.
 *
 * Phase 36 STUB — Phase 44 wires real market data.
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';

/** Market listing shape for visitor view. Full price exposed per D-36-03. */
export interface MarketListing {
    id: string;
    title: string;
    description: string;
    price_bios: number;
    seller_business_did_hash: string;
    seller_display_name: string;
    category: string;
    zone_tag: string;
    expires_at_tick: number;
}

export function registerMarketListingsRoute(
    app: FastifyInstance,
    _services: GridServices,
): void {
    app.get('/api/v1/market/listings', async (_req, _reply) => {
        // PHASE-36 STUB — Phase 44 wires real market data source.
        const listings: MarketListing[] = [];
        return { listings };
    });
}
