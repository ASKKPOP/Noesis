/**
 * Nous public profile route — Phase 36 VIS-01 / D-36-11.
 *
 * ROUTE_DID_POLICY: 'public' — listed in grid/src/api/policy.ts
 *
 * GET /api/v1/nous/:civic_did_hash/public
 *   200: NousPublicProfile
 *
 * // D-36-11: public profile excludes memory, audit history, brain config, treasury balance, contracts.
 *
 * Public profile contains: display name, current zone, civic standing tier,
 * public bio, status (online/away).
 *
 * MUST NOT include: memory, karpathy, hypnos, pneuma, treasury_balance,
 * active_contracts, audit_history.
 *
 * Phase 36 STUB — Phase 37 wires real Nous registry and Civic-DID lookup.
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';

/** Nous public profile shape per D-36-11. */
export interface NousPublicProfile {
    civic_did_hash: string;
    display_name: string;
    zone: string;
    civic_standing_tier: 'provisional' | 'full';
    public_bio: string;
    status: 'online' | 'away';
}

export function registerNousPublicProfileRoute(
    app: FastifyInstance,
    _services: GridServices,
): void {
    app.get<{ Params: { civic_did_hash: string } }>(
        '/api/v1/nous/:civic_did_hash/public',
        async (req, _reply) => {
            // D-36-11: public profile excludes memory, audit history, brain config, treasury balance, contracts.
            // PHASE-36 STUB — Phase 37 wires real Nous registry and Civic-DID lookup.
            const profile: NousPublicProfile = {
                civic_did_hash: req.params.civic_did_hash,
                display_name: 'Nous',
                zone: 'Residential',
                civic_standing_tier: 'provisional',
                public_bio: '',
                status: 'online',
            };
            return profile;
        },
    );
}
