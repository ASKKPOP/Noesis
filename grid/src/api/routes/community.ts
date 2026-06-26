/**
 * Phase 49 Communities v3 — Plan 1 (COMM-01/02/03): found + charter + join.
 *
 *   POST /api/v1/community/found            — found a community (civic + Bios sybil cost)
 *   GET  /api/v1/community/:communityId      — community detail (public)
 *   POST /api/v1/community/:communityId/join — join, evaluated against the charter (civic)
 *
 * The civic Communities subsystem — distinct from the portal social feed
 * (/api/v1/portal/community/*). Bios sybil cost is charged via the funds registry
 * (founder → treasury); dissolution returns it to the treasury (Plan 2), never the founder.
 */
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { CommunityStore } from '../../community/community-store.js';
import { validateCharter, FOUND_BIOS_COST, type MembershipCriteria } from '../../community/types.js';
import { TREASURY_DID } from './registry.js';

const CIVIC_DID_RE = /^did:civic:noesis:[a-z0-9_:\-]+$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function registerCommunityRoutes(app: FastifyInstance, services: GridServices): void {
    const grid = services.gridName ?? 'genesis';
    const tick = (): number => (services.currentTick ? services.currentTick() : 0);

    // COMM-01/02 — found a community.
    app.post<{ Body: { name?: unknown; purpose?: unknown; charter?: unknown } }>(
        '/api/v1/community/found',
        async (req, reply) => {
            const founder = req.didContext?.did;
            if (!founder || req.didContext?.tier !== 'civic_member' || !CIVIC_DID_RE.test(founder)) {
                return reply.code(401).send({ error: 'civic_did_required' });
            }
            const pool = services.pool; const audit = services.audit; const registry = services.registry;
            if (!pool || !audit || !registry) return reply.code(503).send({ error: 'community_unavailable' });
            const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
            const purpose = typeof req.body?.purpose === 'string' ? req.body.purpose.trim() : '';
            if (!name) return reply.code(400).send({ error: 'empty_name' });
            if (!purpose) return reply.code(400).send({ error: 'empty_purpose' });
            const v = validateCharter(req.body?.charter);
            if (!v.ok) return reply.code(400).send({ error: 'invalid_charter', clause: v.clause });

            // Bios sybil cost: founder → treasury (D-V3-09). 402 on insufficient.
            const moved = registry.transferOusia(founder, TREASURY_DID, FOUND_BIOS_COST);
            if (!moved.success) {
                if (moved.error === 'insufficient') return reply.code(402).send({ error: 'insufficient_bios', required: FOUND_BIOS_COST });
                return reply.code(400).send({ error: moved.error });
            }

            const communityId = await new CommunityStore(pool, audit).found({
                gridName: grid, founderDid: founder, name, purpose, charter: v.charter, biosPaid: FOUND_BIOS_COST, tick: tick(),
            });
            return reply.code(201).send({ community_id: communityId, bios_paid: FOUND_BIOS_COST, status: 'active' });
        },
    );

    // Community detail (public).
    app.get<{ Params: { communityId: string } }>(
        '/api/v1/community/:communityId',
        async (req, reply) => {
            const pool = services.pool;
            if (!pool) return reply.code(503).send({ error: 'community_unavailable' });
            const c = await new CommunityStore(pool, services.audit!).getCommunity(grid, req.params.communityId);
            if (!c || c.status !== 'active') return reply.code(404).send({ error: 'unknown_community' });
            const members = await new CommunityStore(pool, services.audit!).memberCount(grid, c.community_id);
            return reply.send({ community: { community_id: c.community_id, name: c.name, charter: JSON.parse(c.charter_json), member_count: members, founded_tick: c.founded_tick } });
        },
    );

    // COMM-03 — join, evaluated against the charter.
    app.post<{ Params: { communityId: string } }>(
        '/api/v1/community/:communityId/join',
        async (req, reply) => {
            const joiner = req.didContext?.did;
            if (!joiner || req.didContext?.tier !== 'civic_member' || !CIVIC_DID_RE.test(joiner)) {
                return reply.code(401).send({ error: 'civic_did_required' });
            }
            const pool = services.pool; const audit = services.audit; const registry = services.registry;
            if (!pool || !audit || !registry) return reply.code(503).send({ error: 'community_unavailable' });
            const communityId = req.params.communityId;
            if (!UUID_RE.test(communityId)) return reply.code(400).send({ error: 'invalid_community_id' });

            const store = new CommunityStore(pool, audit);
            const c = await store.getCommunity(grid, communityId);
            if (!c || c.status !== 'active') return reply.code(404).send({ error: 'unknown_community' });
            const membership = (JSON.parse(c.charter_json).membership) as MembershipCriteria;

            if (membership === 'approval_required') {
                await store.addMember({ gridName: grid, communityId, memberDid: joiner, status: 'pending', tick: tick() });
                return reply.code(202).send({ status: 'pending', clause: 'approval_required' });
            }
            if (typeof membership === 'object' && typeof membership.bios_fee === 'number') {
                const moved = registry.transferOusia(joiner, TREASURY_DID, membership.bios_fee);
                if (!moved.success) {
                    if (moved.error === 'insufficient') return reply.code(402).send({ error: 'insufficient_bios', clause: 'bios_fee', required: membership.bios_fee });
                    return reply.code(400).send({ error: moved.error });
                }
            }
            // 'open' or a paid 'bios_fee' → immediate active membership.
            await store.addMember({ gridName: grid, communityId, memberDid: joiner, status: 'active', tick: tick() });
            return reply.code(201).send({ status: 'joined', community_id: communityId });
        },
    );
}
