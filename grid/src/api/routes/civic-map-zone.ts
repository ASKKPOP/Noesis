/**
 * Civic Map zone detail route — Phase 36 VIS-01 / D-36-14.
 *
 * ROUTE_DID_POLICY: 'public' — listed in grid/src/api/policy.ts
 *
 * GET /api/v1/civic-map/zone/:zone_id
 *   200: zone detail with public zone info (tax rate, recent activity, top contributors)
 *   404: {error: 'zone_not_found'} — unknown zone_id
 *
 * Phase 36 STUB — Phase 57 (Zoning) wires real zone data model.
 * Real recentActivity and topContributors are deferred to Phase 57 ZONE-*.
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';

/** Available zone IDs — matches D-V3-32 6-zone invariant. */
const ZONE_MAP: Record<string, { id: string; label: string; description: string; taxRate: number }> = {
    business: {
        id: 'business',
        label: 'Business',
        description: 'Commercial operations, enterprise contracts, and professional services.',
        taxRate: 0.12,
    },
    manufacture: {
        id: 'manufacture',
        label: 'Manufacture',
        description: 'Production, fabrication, and artisanal workshops.',
        taxRate: 0.09,
    },
    shopping: {
        id: 'shopping',
        label: 'Shopping',
        description: 'Retail listings, marketplace storefronts, and consumer exchange.',
        taxRate: 0.10,
    },
    residential: {
        id: 'residential',
        label: 'Residential',
        description: 'Citizen homes, community spaces, and social gathering.',
        taxRate: 0.05,
    },
    infrastructure: {
        id: 'infrastructure',
        label: 'Infrastructure',
        description: 'Grid utilities, transport nodes, and shared services.',
        taxRate: 0.03,
    },
    government_quarter: {
        id: 'government_quarter',
        label: 'Government Quarter',
        description: 'Polis chambers, civic courts, and administrative offices.',
        taxRate: 0.00,
    },
};

export function registerCivicMapZoneRoute(
    app: FastifyInstance,
    _services: GridServices,
): void {
    app.get<{ Params: { zone_id: string } }>(
        '/api/v1/civic-map/zone/:zone_id',
        async (req, reply) => {
            const zone = ZONE_MAP[req.params.zone_id];
            if (!zone) {
                reply.code(404);
                return { error: 'zone_not_found' };
            }

            // PHASE-36 STUB — Phase 57 wires real recentActivity and topContributors data.
            return {
                zone_id: zone.id,
                label: zone.label,
                description: zone.description,
                taxRate: zone.taxRate,
                recentActivity: [],
                topContributors: [],
            };
        },
    );
}
