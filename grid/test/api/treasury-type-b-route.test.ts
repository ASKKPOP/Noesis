/**
 * Phase 45b Treasury Operations (Plan 1) — endow (government_only) + donate routes.
 */
import { describe, it, expect, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { registerTreasuryTypeBRoutes } from '../../src/api/routes/treasury-type-b.js';
import type { GridServices } from '../../src/api/server.js';
import type { DIDContext } from '../../src/api/preHandlers/types.js';
import { AuditChain } from '../../src/audit/chain.js';

const DID = 'did:noesis:nous:auto:abc123';

function app(rows: unknown[], ctx: DIDContext | null): FastifyInstance {
    const pool = { query: vi.fn().mockResolvedValue([rows as RowDataPacket[], {}]) } as unknown as Pool;
    const services = { gridName: 'genesis', currentTick: () => 5, pool, audit: new AuditChain() } as unknown as GridServices;
    const a = Fastify({ logger: false });
    a.addHook('onRequest', async (req) => { req.didContext = ctx ?? undefined; });
    registerTreasuryTypeBRoutes(a, services);
    return a;
}
const GOV: DIDContext = { did: 'did:gov:noesis:session', tier: 'government' };
const CIVIC: DIDContext = { did: 'did:civic:noesis:alice', tier: 'civic_member' };

describe('POST /api/v1/treasury/endow-type-b/:typeBDid (government_only)', () => {
    it('201 endowing a Type B', async () => {
        const a = app([], GOV);
        const res = await a.inject({ method: 'POST', url: `/api/v1/treasury/endow-type-b/${DID}`, payload: { amount: 12000 } });
        expect(res.statusCode).toBe(201);
        expect(res.json().endowment_amount).toBe(12000);
        await a.close();
    });
    it('403 for a non-Government caller', async () => {
        const a = app([], CIVIC);
        const res = await a.inject({ method: 'POST', url: `/api/v1/treasury/endow-type-b/${DID}`, payload: { amount: 12000 } });
        expect(res.statusCode).toBe(403);
        await a.close();
    });
    it('400 on a non-positive amount', async () => {
        const a = app([], GOV);
        const res = await a.inject({ method: 'POST', url: `/api/v1/treasury/endow-type-b/${DID}`, payload: { amount: 0 } });
        expect(res.statusCode).toBe(400);
        await a.close();
    });
});

describe('POST /api/v1/treasury/stipend/:typeBDid (government_only)', () => {
    it('200 deducting the daily stipend', async () => {
        const a = app([{ bios_balance: 1_000_000, status: 'active', runway_months: 12 }], GOV);
        const res = await a.inject({ method: 'POST', url: `/api/v1/treasury/stipend/${DID}`, payload: { stipend_amount: 100 } });
        expect(res.statusCode).toBe(200);
        expect(res.json().status).toBe('active');
        await a.close();
    });
    it('403 for a non-Government caller', async () => {
        const a = app([], CIVIC);
        const res = await a.inject({ method: 'POST', url: `/api/v1/treasury/stipend/${DID}`, payload: { stipend_amount: 100 } });
        expect(res.statusCode).toBe(403);
        await a.close();
    });
});

describe('POST /api/v1/treasury/donate/:typeBDid', () => {
    it('201 donating to (and reviving) a dormant Type B', async () => {
        const a = app([{ bios_balance: 0, status: 'dormant', runway_months: 12 }], CIVIC);
        const res = await a.inject({ method: 'POST', url: `/api/v1/treasury/donate/${DID}`, payload: { amount: 500 } });
        expect(res.statusCode).toBe(201);
        expect(res.json().revived).toBe(true);
        await a.close();
    });
    it('404 when there is no treasury for the Nous', async () => {
        const a = app([], CIVIC);
        const res = await a.inject({ method: 'POST', url: `/api/v1/treasury/donate/${DID}`, payload: { amount: 500 } });
        expect(res.statusCode).toBe(404);
        await a.close();
    });
});
