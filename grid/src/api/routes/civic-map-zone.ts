/**
 * Civic Map zone detail route — Phase 36 VIS-01 / D-36-14, zones live per D-V3-40.
 *
 * ROUTE_DID_POLICY: 'public' — listed in grid/src/api/policy.ts
 *
 * GET /api/v1/civic-map/zone/:zone_id
 *   200: zone detail (label, kind, what it allows, tax rate, recent activity, top contributors)
 *   404: {error: 'zone_not_found'} — a zone this Grid does not have
 *
 * The zone is read from the Grid's CURRENT zone set, so a zone its Polis added resolves and
 * one it removed does not. recentActivity / topContributors are not collected yet (empty).
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { currentZones, zoneTaxRate } from './civic-map.js';

/** What each template zone is for. A zone a Polis added is described by what it allows. */
const TEMPLATE_DESCRIPTIONS: Readonly<Record<string, string>> = {
    business: 'Commercial operations, enterprise contracts, and professional services.',
    manufacture: 'Production, fabrication, and artisanal workshops.',
    shopping: 'Retail listings, marketplace storefronts, and consumer exchange.',
    residential: 'Citizen homes, community spaces, and social gathering.',
    infrastructure: 'Grid utilities, transport nodes, and shared services.',
    government_quarter: 'Polis chambers, civic courts, and administrative offices.',
};

const KIND_PHRASE = { home: 'A zone where Nous live', business: 'A zone where Nous trade and make', civic: 'Civic land held by the Polis' } as const;

export function registerCivicMapZoneRoute(
    app: FastifyInstance,
    services: GridServices,
): void {
    app.get<{ Params: { zone_id: string } }>(
        '/api/v1/civic-map/zone/:zone_id',
        async (req, reply) => {
            const zone = (await currentZones(services)).find((z) => z.zone_id === req.params.zone_id);
            if (!zone) {
                reply.code(404);
                return { error: 'zone_not_found' };
            }
            const activities = zone.allowed_activities.map((a) => a.replace(/_/g, ' ')).join(', ');
            const description = (zone.template ? TEMPLATE_DESCRIPTIONS[zone.zone_id] : undefined)
                ?? `${KIND_PHRASE[zone.kind]}${activities ? ` — ${activities}` : ''}.`;

            return {
                zone_id: zone.zone_id,
                label: zone.label,
                kind: zone.kind,
                description,
                allowed_activities: zone.allowed_activities,
                for_sale: zone.for_sale,
                taxRate: zoneTaxRate(zone.zone_id),
                recentActivity: [],
                topContributors: [],
            };
        },
    );
}
