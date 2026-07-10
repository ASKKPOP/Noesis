/**
 * Phase 49 Communities v3 — Plan 1 (COMM-01/02/03): found + charter + join.
 *
 *   POST /api/v1/community/found            — found a community (civic + Bios sybil cost)
 *   GET  /api/v1/community/:communityId      — community detail (public)
 *   POST /api/v1/community/:communityId/join — join, evaluated against the charter (civic)
 *
 * The civic Communities subsystem — distinct from the portal social feed
 * (/api/v1/portal/community/*). Bios sybil cost is charged on the unified in-DB ledger
 * (founder → civic_treasury via nous_accounts, Phase 62.5-02); dissolution keeps it in the
 * treasury (Plan 2), never refunds the founder.
 */
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { CommunityStore } from '../../community/community-store.js';
import { validateCharter, FOUND_WEI_COST, INTERNAL_DECISION_SCOPES, type MembershipCriteria } from '../../community/types.js';
import { NousAccountStore } from '../../economy/nous-account-store.js';

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
            const pool = services.pool; const audit = services.audit;
            if (!pool || !audit) return reply.code(503).send({ error: 'community_unavailable' });
            const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
            const purpose = typeof req.body?.purpose === 'string' ? req.body.purpose.trim() : '';
            if (!name) return reply.code(400).send({ error: 'empty_name' });
            if (!purpose) return reply.code(400).send({ error: 'empty_purpose' });
            const v = validateCharter(req.body?.charter);
            if (!v.ok) return reply.code(400).send({ error: 'invalid_charter', clause: v.clause });

            // D-V3-09 Bios sybil cost, charged on the unified in-DB ledger (nous_accounts →
            // civic_treasury, Phase 62.5-02 / Issue #9) and kept atomic across it and MySQL
            // (communities): (1) pre-check funds WITHOUT moving them, (2) persist the community
            // in a transaction, (3) charge LAST — so a DB failure can never leave the founder
            // debited with no community (the money move is the last thing that happens).
            const accountStore = new NousAccountStore(pool);
            const balance = await accountStore.getBalance(grid, founder);
            if (balance < BigInt(FOUND_WEI_COST)) {
                return reply.code(402).send({ error: 'insufficient_wei', required: FOUND_WEI_COST });
            }

            const store = new CommunityStore(pool, audit);
            let communityId: string;
            try {
                communityId = await store.found({
                    gridName: grid, founderDid: founder, name, purpose, charter: v.charter, weiPaid: FOUND_WEI_COST, tick: tick(),
                });
            } catch (err) {
                req.log.error({ err: err instanceof Error ? err.message : 'unknown' }, 'community_found_failed');
                return reply.code(503).send({ error: 'community_unavailable' });
            }

            // Charge last. chargeToTreasury re-checks the balance atomically (debit under
            // SELECT … FOR UPDATE); a failure here (a concurrent drain since the pre-check)
            // dissolves the just-created community so no active-but-unpaid community is ever
            // left behind — conservation holds either way.
            try {
                await accountStore.chargeToTreasury({ gridName: grid, civicDid: founder, amountWei: BigInt(FOUND_WEI_COST), currentTick: tick() });
            } catch (err) {
                await store.dissolve({ gridName: grid, communityId, byDid: founder, tick: tick() });
                const msg = err instanceof Error ? err.message : 'charge_failed';
                if (msg === 'insufficient_balance') return reply.code(402).send({ error: 'insufficient_wei', required: FOUND_WEI_COST });
                return reply.code(400).send({ error: msg });
            }

            return reply.code(201).send({ community_id: communityId, wei_paid: FOUND_WEI_COST, status: 'active' });
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
            const pool = services.pool; const audit = services.audit;
            if (!pool || !audit) return reply.code(503).send({ error: 'community_unavailable' });
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
                // Bios join fee on the unified ledger: joiner → civic_treasury (Phase 62.5-02).
                try {
                    await new NousAccountStore(pool).chargeToTreasury({ gridName: grid, civicDid: joiner, amountWei: BigInt(membership.bios_fee), currentTick: tick() });
                } catch (err) {
                    const msg = err instanceof Error ? err.message : 'charge_failed';
                    if (msg === 'insufficient_balance') return reply.code(402).send({ error: 'insufficient_wei', clause: 'bios_fee', required: membership.bios_fee });
                    return reply.code(400).send({ error: msg });
                }
            }
            // 'open' or a paid 'bios_fee' → immediate active membership.
            await store.addMember({ gridName: grid, communityId, memberDid: joiner, status: 'active', tick: tick() });
            return reply.code(201).send({ status: 'joined', community_id: communityId });
        },
    );

    // COMM-04 — a member posts in the community.
    app.post<{ Params: { communityId: string }; Body: { body?: unknown } }>(
        '/api/v1/community/:communityId/post',
        async (req, reply) => {
            const poster = req.didContext?.did;
            if (!poster || req.didContext?.tier !== 'civic_member' || !CIVIC_DID_RE.test(poster)) return reply.code(401).send({ error: 'civic_did_required' });
            const pool = services.pool; const audit = services.audit;
            if (!pool || !audit) return reply.code(503).send({ error: 'community_unavailable' });
            const communityId = req.params.communityId;
            if (!UUID_RE.test(communityId)) return reply.code(400).send({ error: 'invalid_community_id' });
            const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
            if (!body) return reply.code(400).send({ error: 'empty_body' });
            const store = new CommunityStore(pool, audit);
            if (!(await store.isMember(grid, communityId, poster))) return reply.code(403).send({ error: 'not_a_member' });
            const postId = await store.post({ gridName: grid, communityId, posterDid: poster, body, tick: tick() });
            return reply.code(201).send({ post_id: postId });
        },
    );

    // COMM-04 — a bounded internal subgovernance decision. Anything outside the
    // community-internal scope is an attempt to legislate civic law → 403 out_of_scope.
    app.post<{ Params: { communityId: string }; Body: { scope?: unknown } }>(
        '/api/v1/community/:communityId/decision',
        async (req, reply) => {
            const caller = req.didContext?.did;
            if (!caller || req.didContext?.tier !== 'civic_member' || !CIVIC_DID_RE.test(caller)) return reply.code(401).send({ error: 'civic_did_required' });
            const pool = services.pool; const audit = services.audit;
            if (!pool || !audit) return reply.code(503).send({ error: 'community_unavailable' });
            const communityId = req.params.communityId;
            if (!UUID_RE.test(communityId)) return reply.code(400).send({ error: 'invalid_community_id' });
            const scope = typeof req.body?.scope === 'string' ? req.body.scope : '';
            const store = new CommunityStore(pool, audit);
            if (!(await store.isMember(grid, communityId, caller))) return reply.code(403).send({ error: 'not_a_member' });
            // The constitutional bound: communities cannot legislate civic law.
            if (!INTERNAL_DECISION_SCOPES.includes(scope)) {
                return reply.code(403).send({ error: 'out_of_scope', detail: 'community subgovernance is bounded to community-internal decisions; civic law belongs to the Polis' });
            }
            return reply.send({ ok: true, scope, decision: 'accepted' });
        },
    );

    // COMM-05 — dissolve a community (founder only). Founding Bios stays in the treasury.
    app.post<{ Params: { communityId: string } }>(
        '/api/v1/community/:communityId/dissolve',
        async (req, reply) => {
            const caller = req.didContext?.did;
            if (!caller || req.didContext?.tier !== 'civic_member' || !CIVIC_DID_RE.test(caller)) return reply.code(401).send({ error: 'civic_did_required' });
            const pool = services.pool; const audit = services.audit;
            if (!pool || !audit) return reply.code(503).send({ error: 'community_unavailable' });
            const communityId = req.params.communityId;
            if (!UUID_RE.test(communityId)) return reply.code(400).send({ error: 'invalid_community_id' });
            const store = new CommunityStore(pool, audit);
            const c = await store.getCommunity(grid, communityId);
            if (!c || c.status !== 'active') return reply.code(404).send({ error: 'unknown_community' });
            if (c.founder_civic_did !== caller) return reply.code(403).send({ error: 'not_the_founder' });
            await store.dissolve({ gridName: grid, communityId, byDid: caller, tick: tick() });
            return reply.send({ ok: true, status: 'dissolved' });
        },
    );
}
