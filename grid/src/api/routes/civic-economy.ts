/**
 * W — economy read routes: a member reads its own balances; anyone reads the treasury.
 *   GET /api/v1/civic/account  — caller's wei balance (civic_member)
 *   GET /api/v1/civic/credit   — caller's civic-labor credit (civic_member)
 *   GET /api/v1/civic/treasury — treasury wei balance (public)
 *
 * Read-only, no mint/move, no audit events. De-orphans NousAccountStore,
 * CivicLaborCreditStore, and TreasuryWeiStore over HTTP (W observability slice).
 */
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { NousAccountStore } from '../../economy/nous-account-store.js';
import { CivicLaborCreditStore } from '../../economy/civic-labor-credit-store.js';
import { TreasuryWeiStore } from '../../economy/treasury-wei-store.js';

const CIVIC_DID_RE = /^did:civic:noesis:[a-z0-9_:\-]+$/i;

export function registerCivicEconomyRoutes(app: FastifyInstance, services: GridServices): void {
    const grid = services.gridName ?? 'genesis';

    /** GET /api/v1/civic/account — caller's wei balance. */
    app.get('/api/v1/civic/account', async (req, reply) => {
        const pool = services.pool;
        if (!pool) return reply.code(503).send({ error: 'db_unavailable' });
        const civicDid = req.didContext?.did;
        if (!civicDid || !CIVIC_DID_RE.test(civicDid) || req.didContext?.tier !== 'civic_member') {
            return reply.code(401).send({ error: 'unauthorized' });
        }
        const balance = await new NousAccountStore(pool).getBalance(grid, civicDid);
        return reply.send({ civic_did: civicDid, balance_wei: balance.toString() });
    });

    /** GET /api/v1/civic/credit — caller's civic-labor credit. */
    app.get('/api/v1/civic/credit', async (req, reply) => {
        const pool = services.pool;
        if (!pool) return reply.code(503).send({ error: 'db_unavailable' });
        const civicDid = req.didContext?.did;
        if (!civicDid || !CIVIC_DID_RE.test(civicDid) || req.didContext?.tier !== 'civic_member') {
            return reply.code(401).send({ error: 'unauthorized' });
        }
        const credit = await new CivicLaborCreditStore(pool).getCredit(grid, civicDid);
        return reply.send({ civic_did: civicDid, credit_balance: credit.toString() });
    });

    /** GET /api/v1/civic/treasury — treasury wei balance (public). */
    app.get('/api/v1/civic/treasury', async (_req, reply) => {
        const pool = services.pool;
        if (!pool) return reply.code(503).send({ error: 'db_unavailable' });
        const balance = await new TreasuryWeiStore(pool).getWeiBalance(grid);
        return reply.send({ grid, balance_wei: balance.toString() });
    });
}
