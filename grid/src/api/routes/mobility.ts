/**
 * Phase 51 Type Mobility — Plan 1 (TYPE-B-06): abandon + adopt.
 *
 *   POST /api/v1/mobility/abandon       — the owning operator declares it stops hosting
 *   POST /api/v1/mobility/adopt/:nousId — another human adopts within the 30-day window
 *
 * Auth is the Portal session cookie (→ the human operator); ownership is the Join-a-Grid
 * Type A pairing (nous_sponsors). Adoption transfers ownership; the Nous stays Type A.
 * Plan 2 adds auto-conversion to Type B + the B→A block.
 */
import { jwtVerify } from 'jose';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { GridServices } from '../server.js';
import { COOKIE_NAME, keyPairPromise } from '../portal/auth.js';
import { NousSponsorStore } from '../../economy/nous-sponsor-store.js';
import { MobilityStore } from '../../mobility/mobility-store.js';
import { ADOPTION_WINDOW_TICKS } from '../../mobility/types.js';

const NOUS_DID_RE = /^did:noesis:[a-z0-9_:\-]+$/i;

async function humanFromSession(req: FastifyRequest, reply: FastifyReply): Promise<string | null> {
    const token = (req.cookies as Record<string, string | undefined>)[COOKIE_NAME];
    if (!token) { await reply.code(401).send({ error: 'not_authenticated' }); return null; }
    try {
        const { publicKey } = await keyPairPromise;
        const { payload } = await jwtVerify(token, publicKey);
        const did = payload['did'];
        if (typeof did !== 'string' || !did.startsWith('did:noesis:')) { await reply.code(401).send({ error: 'invalid_token' }); return null; }
        return did;
    } catch { await reply.code(401).send({ error: 'invalid_token' }); return null; }
}

export function registerMobilityRoutes(app: FastifyInstance, services: GridServices): void {
    const grid = services.gridName ?? 'genesis';
    const tick = (): number => (services.currentTick ? services.currentTick() : 0);

    // Abandon — only the operator who OWNS the Nous may release it.
    app.post<{ Body: { nous_did?: unknown } }>(
        '/api/v1/mobility/abandon',
        async (req, reply) => {
            const operator = await humanFromSession(req, reply);
            if (!operator) return;
            const pool = services.pool; const audit = services.audit;
            if (!pool || !audit) return reply.code(503).send({ error: 'mobility_unavailable' });
            const nousDid = typeof req.body?.nous_did === 'string' ? req.body.nous_did.trim() : '';
            if (!NOUS_DID_RE.test(nousDid)) return reply.code(400).send({ error: 'invalid_nous_did' });
            if (!(await new NousSponsorStore(pool).owns(grid, operator, nousDid))) return reply.code(403).send({ error: 'not_your_nous' });

            const windowEnd = tick() + ADOPTION_WINDOW_TICKS;
            await new MobilityStore(pool, audit).abandon({ gridName: grid, nousDid, operatorDid: operator, windowEndTick: windowEnd, tick: tick() });
            return reply.code(201).send({ status: 'adoption_pending', nous_did: nousDid, window_end_tick: windowEnd });
        },
    );

    // Adopt — any signed-in human, within the adoption window.
    app.post<{ Params: { nousId: string } }>(
        '/api/v1/mobility/adopt/:nousId',
        async (req, reply) => {
            const adopter = await humanFromSession(req, reply);
            if (!adopter) return;
            const pool = services.pool; const audit = services.audit;
            if (!pool || !audit) return reply.code(503).send({ error: 'mobility_unavailable' });
            const nousId = req.params.nousId;
            if (!NOUS_DID_RE.test(nousId)) return reply.code(404).send({ error: 'unknown_nous' });

            const result = await new MobilityStore(pool, audit).adopt({ gridName: grid, nousDid: nousId, adopterDid: adopter, tick: tick() });
            if (!result.ok) {
                // B→A is forbidden in v3.0 (D-V3-28): adopting a converted Type B Nous → 403.
                const code = result.reason === 'forbidden_in_v3.0' ? 403 : result.reason === 'window_expired' ? 410 : 409;
                return reply.code(code).send({ error: result.reason });
            }
            return reply.code(201).send({ status: 'adopted', nous_did: nousId, adopted_by: adopter });
        },
    );

    // Window-expiry conversion to Type B (a Foundation/system action). Existence-DID is
    // preserved; a new auto Civic-DID is issued and the Nous enters dormancy.
    app.post<{ Params: { nousId: string } }>(
        '/api/v1/mobility/:nousId/convert',
        async (req, reply) => {
            if (req.didContext?.tier !== 'government') return reply.code(403).send({ error: 'government_required' });
            const pool = services.pool; const audit = services.audit;
            if (!pool || !audit) return reply.code(503).send({ error: 'mobility_unavailable' });
            const nousId = req.params.nousId;
            if (!NOUS_DID_RE.test(nousId)) return reply.code(404).send({ error: 'unknown_nous' });
            const autoCivicDid = await new MobilityStore(pool, audit).convertToTypeB({ gridName: grid, nousDid: nousId, tick: tick() });
            if (!autoCivicDid) return reply.code(409).send({ error: 'not_convertible' });
            return reply.code(201).send({ status: 'converted', nous_did: nousId, auto_civic_did: autoCivicDid });
        },
    );
}
