/**
 * Phase 54 Portal Nous Approval (NOUS track) — request / prescreen / polis-review routes.
 */
import { describe, it, expect, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { registerPortalNousApprovalRoutes } from '../../src/api/routes/portal-nous-approval.js';
import type { GridServices } from '../../src/api/server.js';
import type { DIDContext } from '../../src/api/preHandlers/types.js';
import { AuditChain } from '../../src/audit/chain.js';

function makeApp(rows: unknown[], ctx: DIDContext | null): FastifyInstance {
    const pool = { query: vi.fn().mockResolvedValue([rows as RowDataPacket[], {}]) } as unknown as Pool;
    const services = { gridName: 'genesis', currentTick: () => 5, pool, audit: new AuditChain() } as unknown as GridServices;
    const a = Fastify({ logger: false });
    a.addHook('onRequest', async (req) => { req.didContext = ctx ?? undefined; });
    registerPortalNousApprovalRoutes(a, services);
    return a;
}
const GOV: DIDContext = { did: 'did:gov:noesis:polis', tier: 'government' };
const CIVIC: DIDContext = { did: 'did:noesis:human:op', tier: 'civic_member' };
const NOUS = 'did:civic:noesis:nous:sophia';
const pendingRow = [{ request_id: 'r1', nous_type: 'A', registrant_did: 'did:noesis:human:op', nous_did: NOUS, target_grid: 'genesis', status: 'polis_pending' }];

describe('POST /portal/api/v1/nous/request', () => {
    it('201 for a valid Type A request', async () => {
        const a = makeApp([], CIVIC);
        const res = await a.inject({ method: 'POST', url: '/portal/api/v1/nous/request', payload: { type: 'A', nous_did: NOUS, operator_did: 'did:noesis:human:op', target_grid_id: 'genesis', civic_oath_signature: '0xsig' } });
        expect(res.statusCode).toBe(201);
        expect(res.json().status).toBe('requested');
        await a.close();
    });
    it('400 Type A without operator_did', async () => {
        const a = makeApp([], CIVIC);
        const res = await a.inject({ method: 'POST', url: '/portal/api/v1/nous/request', payload: { type: 'A', nous_did: NOUS, civic_oath_signature: '0xsig' } });
        expect(res.statusCode).toBe(400);
        await a.close();
    });
    it('400 without an oath signature', async () => {
        const a = makeApp([], CIVIC);
        const res = await a.inject({ method: 'POST', url: '/portal/api/v1/nous/request', payload: { type: 'A', nous_did: NOUS, operator_did: 'did:noesis:human:op' } });
        expect(res.statusCode).toBe(400);
        await a.close();
    });
    it('401 without a DID', async () => {
        const a = makeApp([], null);
        const res = await a.inject({ method: 'POST', url: '/portal/api/v1/nous/request', payload: { type: 'A', nous_did: NOUS, operator_did: 'x', civic_oath_signature: 's' } });
        expect(res.statusCode).toBe(401);
        await a.close();
    });
});

describe('POST /portal/api/v1/nous/:requestId/prescreen', () => {
    it('403 for a non-reviewer', async () => {
        const a = makeApp([{ request_id: 'r1', nous_type: 'A', registrant_did: 'x', nous_did: NOUS, target_grid: 'genesis', status: 'requested' }], CIVIC);
        const res = await a.inject({ method: 'POST', url: '/portal/api/v1/nous/r1/prescreen', payload: { pass: true } });
        expect(res.statusCode).toBe(403);
        await a.close();
    });
    it('201 forwarding to Polis on pass', async () => {
        const RID = '0a1b2c3d-4e5f-6071-8293-a4b5c6d7e8f9'; // UUID (polis.registration_pending requires it)
        const a = makeApp([{ request_id: RID, nous_type: 'A', registrant_did: 'x', nous_did: NOUS, target_grid: 'genesis', status: 'requested' }], GOV);
        const res = await a.inject({ method: 'POST', url: `/portal/api/v1/nous/${RID}/prescreen`, payload: { pass: true } });
        expect(res.statusCode).toBe(201);
        expect(res.json().status).toBe('polis_pending');
        await a.close();
    });
});

describe('POST /api/v1/gov/charter/review/:requestId', () => {
    it('201 Polis approval (+ residence)', async () => {
        const a = makeApp(pendingRow, GOV);
        const res = await a.inject({ method: 'POST', url: '/api/v1/gov/charter/review/r1', payload: { decision: 'approve' } });
        expect(res.statusCode).toBe(201);
        expect(res.json().status).toBe('approved');
        expect(res.json().residence_id).toMatch(/^res-/);
        await a.close();
    });
    it('403 for a non-Polis caller', async () => {
        const a = makeApp(pendingRow, CIVIC);
        const res = await a.inject({ method: 'POST', url: '/api/v1/gov/charter/review/r1', payload: { decision: 'approve' } });
        expect(res.statusCode).toBe(403);
        await a.close();
    });
});
