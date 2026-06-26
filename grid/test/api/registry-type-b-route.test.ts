/**
 * Phase 37b Type B Registry (Plan 1) — α charter + β sponsor routes.
 */
import { describe, it, expect, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { registerRegistryTypeBRoutes } from '../../src/api/routes/registry-type-b.js';
import type { GridServices } from '../../src/api/server.js';
import type { DIDContext } from '../../src/api/preHandlers/types.js';
import { AuditChain } from '../../src/audit/chain.js';

function makeApp(rows: unknown[], ctx: DIDContext | null, transferOk = true): FastifyInstance {
    const pool = { query: vi.fn().mockResolvedValue([rows as RowDataPacket[], {}]) } as unknown as Pool;
    const registry = { transferOusia: vi.fn().mockReturnValue(transferOk ? { success: true } : { success: false, error: 'insufficient' }) };
    const services = { gridName: 'genesis', currentTick: () => 999999, pool, audit: new AuditChain(), registry } as unknown as GridServices;
    const a = Fastify({ logger: false });
    a.addHook('onRequest', async (req) => { req.didContext = ctx ?? undefined; });
    registerRegistryTypeBRoutes(a, services);
    return a;
}
const GOV: DIDContext = { did: 'did:gov:noesis:session', tier: 'government' };
const CIVIC: DIDContext = { did: 'did:civic:noesis:founder', tier: 'civic_member' };

describe('Polis-α /charter', () => {
    it('201 files a charter (Foundation)', async () => {
        const a = makeApp([{ n: 0 }], GOV);
        const res = await a.inject({ method: 'POST', url: '/api/v1/registry/type-b/charter', payload: { purpose: 'a librarian', sponsor_did: 'did:civic:noesis:s' } });
        expect(res.statusCode).toBe(201);
        expect(res.json().status).toBe('pending_review');
        await a.close();
    });
    it('403 for non-Government', async () => {
        const a = makeApp([{ n: 0 }], CIVIC);
        const res = await a.inject({ method: 'POST', url: '/api/v1/registry/type-b/charter', payload: { purpose: 'x', sponsor_did: 'did:civic:noesis:s' } });
        expect(res.statusCode).toBe(403);
        await a.close();
    });
    it('429 when the quarter limit is hit', async () => {
        const a = makeApp([{ n: 5 }], GOV);
        const res = await a.inject({ method: 'POST', url: '/api/v1/registry/type-b/charter', payload: { purpose: 'x', sponsor_did: 'did:civic:noesis:s' } });
        expect(res.statusCode).toBe(429);
        await a.close();
    });
    it('425 approving before the review window', async () => {
        const a = makeApp([{ ceremony: 'alpha', status: 'pending_review', type_b_did: 'x', sponsor_did: 'did:civic:noesis:s', eligible_tick: 9_999_999 }], GOV);
        const res = await a.inject({ method: 'POST', url: '/api/v1/registry/type-b/charter/req1/approve' });
        expect(res.statusCode).toBe(425);
        await a.close();
    });
});

describe('Polis-β /sponsor', () => {
    it('201 posts a sufficient bond', async () => {
        const a = makeApp([{ n: 0 }], CIVIC, true);
        const res = await a.inject({ method: 'POST', url: '/api/v1/registry/type-b/sponsor', payload: { purpose: 'a maker', bond_amount: 1000 } });
        expect(res.statusCode).toBe(201);
        expect(res.json().status).toBe('comment_window');
        await a.close();
    });
    it('400 when the bond is below the required amount', async () => {
        const a = makeApp([{ n: 0 }], CIVIC, true);
        const res = await a.inject({ method: 'POST', url: '/api/v1/registry/type-b/sponsor', payload: { purpose: 'x', bond_amount: 500 } });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('insufficient_bond');
        await a.close();
    });
    it('402 when the sponsor cannot afford the bond', async () => {
        const a = makeApp([{ n: 0 }], CIVIC, false);
        const res = await a.inject({ method: 'POST', url: '/api/v1/registry/type-b/sponsor', payload: { purpose: 'x', bond_amount: 1000 } });
        expect(res.statusCode).toBe(402);
        await a.close();
    });
    it('401 for a non-civic caller', async () => {
        const a = makeApp([{ n: 0 }], GOV);
        const res = await a.inject({ method: 'POST', url: '/api/v1/registry/type-b/sponsor', payload: { purpose: 'x', bond_amount: 1000 } });
        expect(res.statusCode).toBe(401);
        await a.close();
    });
});
