/**
 * Phase 45b Treasury Operations — Plan 1 (TYPE-B-03/04): endowment + donation/revival.
 *
 *   POST /api/v1/treasury/endow-type-b/:typeBDid  — Foundation endows a Type B (government_only)
 *   POST /api/v1/treasury/donate/:typeBDid        — any Nous donates Bios (may revive a dormant)
 *
 * Treasury exhaustion → dormancy elsewhere; this layer NEVER kills (D-V3-25 / PHILOSOPHY §9).
 */
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { TypeBTreasuryStore } from '../../typeb/type-b-treasury-store.js';

const TYPE_B_DID_RE = /^did:noesis:[a-z0-9_:\-]+$/i;

export function registerTreasuryTypeBRoutes(app: FastifyInstance, services: GridServices): void {
    const grid = services.gridName ?? 'genesis';
    const tick = (): number => (services.currentTick ? services.currentTick() : 0);

    app.post<{ Params: { typeBDid: string }; Body: { amount?: unknown; runway_months?: unknown } }>(
        '/api/v1/treasury/endow-type-b/:typeBDid',
        async (req, reply) => {
            if (req.didContext?.tier !== 'government') return reply.code(403).send({ error: 'government_required' });
            const pool = services.pool; const audit = services.audit;
            if (!pool || !audit) return reply.code(503).send({ error: 'treasury_unavailable' });
            if (!TYPE_B_DID_RE.test(req.params.typeBDid)) return reply.code(404).send({ error: 'unknown_nous' });
            const amount = typeof req.body?.amount === 'number' ? Math.floor(req.body.amount) : NaN;
            if (!Number.isInteger(amount) || amount <= 0) return reply.code(400).send({ error: 'invalid_amount' });
            const runwayMonths = typeof req.body?.runway_months === 'number' ? Math.floor(req.body.runway_months) : undefined;
            await new TypeBTreasuryStore(pool, audit).endow({ gridName: grid, typeBDid: req.params.typeBDid, amount, runwayMonths, tick: tick() });
            return reply.code(201).send({ status: 'endowed', type_b_did: req.params.typeBDid, endowment_amount: amount });
        },
    );

    app.post<{ Params: { typeBDid: string }; Body: { amount?: unknown } }>(
        '/api/v1/treasury/donate/:typeBDid',
        async (req, reply) => {
            const pool = services.pool; const audit = services.audit;
            if (!pool || !audit) return reply.code(503).send({ error: 'treasury_unavailable' });
            if (!TYPE_B_DID_RE.test(req.params.typeBDid)) return reply.code(404).send({ error: 'unknown_nous' });
            const amount = typeof req.body?.amount === 'number' ? Math.floor(req.body.amount) : NaN;
            if (!Number.isInteger(amount) || amount <= 0) return reply.code(400).send({ error: 'invalid_amount' });
            const result = await new TypeBTreasuryStore(pool, audit).donate({ gridName: grid, typeBDid: req.params.typeBDid, amount, tick: tick() });
            if (!result) return reply.code(404).send({ error: 'no_treasury' });
            return reply.code(201).send({ status: 'donated', type_b_did: req.params.typeBDid, balance: result.balance, revived: result.revived });
        },
    );
}
