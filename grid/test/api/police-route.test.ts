/**
 * Phase 47 Police v3 (Plan 1) — complaint + investigation routes.
 *
 *   POST /api/v1/police/complaint                          (POL-01)
 *   POST /api/v1/police/complaint/:complaintId/investigate (POL-02)
 *   GET  /api/v1/police/complaints
 *
 * civic_member-gated; no operator/Police-direct sanction path (D-V3-18).
 */
import { describe, it, expect, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { AuditChain } from '../../src/audit/chain.js';
import { registerPoliceRoutes } from '../../src/api/routes/police.js';
import type { GridServices } from '../../src/api/server.js';
import type { DIDContext } from '../../src/api/preHandlers/types.js';

const ALICE = 'did:civic:noesis:alice';
const BOB = 'did:civic:noesis:bob';
const LAW = '11111111-1111-4111-8111-111111111111';
const aliceCtx = (): DIDContext => ({ did: ALICE, tier: 'civic_member' });

function app(opts: { ctx?: DIDContext | null; rows?: unknown[] }): FastifyInstance {
    const pool = { query: vi.fn().mockResolvedValue([(opts.rows ?? []) as RowDataPacket[], {}]) } as unknown as Pool;
    const services = { gridName: 'genesis', currentTick: () => 5, pool, audit: new AuditChain() } as unknown as GridServices;
    const a = Fastify({ logger: false });
    if (opts.ctx !== undefined) a.addHook('onRequest', async (req) => { req.didContext = opts.ctx ?? undefined; });
    registerPoliceRoutes(a, services);
    return a;
}

describe('POST /api/v1/police/complaint (POL-01)', () => {
    it('201 with a complaint_id for a valid complaint', async () => {
        const a = app({ ctx: aliceCtx() });
        const res = await a.inject({ method: 'POST', url: '/api/v1/police/complaint', payload: { accused_civic_did: BOB, cited_law_id: LAW, evidence_event_ids: ['e1', 'e2'] } });
        expect(res.statusCode).toBe(201);
        expect(res.json().complaint_id).toMatch(/^[0-9a-f-]{36}$/i);
        await a.close();
    });
    it('401 without civic context', async () => {
        const a = app({ ctx: null });
        const res = await a.inject({ method: 'POST', url: '/api/v1/police/complaint', payload: { accused_civic_did: BOB, cited_law_id: LAW } });
        expect(res.statusCode).toBe(401);
        await a.close();
    });
    it('400 on an invalid accused DID', async () => {
        const a = app({ ctx: aliceCtx() });
        const res = await a.inject({ method: 'POST', url: '/api/v1/police/complaint', payload: { accused_civic_did: 'nope', cited_law_id: LAW } });
        expect(res.statusCode).toBe(400);
        await a.close();
    });
    it('400 when accusing yourself', async () => {
        const a = app({ ctx: aliceCtx() });
        const res = await a.inject({ method: 'POST', url: '/api/v1/police/complaint', payload: { accused_civic_did: ALICE, cited_law_id: LAW } });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('cannot_accuse_self');
        await a.close();
    });
    it('400 on an invalid cited_law_id', async () => {
        const a = app({ ctx: aliceCtx() });
        const res = await a.inject({ method: 'POST', url: '/api/v1/police/complaint', payload: { accused_civic_did: BOB, cited_law_id: 'not-a-uuid' } });
        expect(res.statusCode).toBe(400);
        await a.close();
    });
});

describe('POST /api/v1/police/complaint/:id/investigate (POL-02)', () => {
    const CID = '22222222-2222-4222-8222-222222222222';
    it('201 opening an investigation on a filed complaint', async () => {
        const a = app({ ctx: aliceCtx(), rows: [{ complaint_id: CID, accused_civic_did: BOB, cited_law_id: LAW, status: 'filed', filed_at_tick: 1 }] });
        const res = await a.inject({ method: 'POST', url: `/api/v1/police/complaint/${CID}/investigate` });
        expect(res.statusCode).toBe(201);
        expect(res.json().investigation_id).toMatch(/^[0-9a-f-]{36}$/i);
        await a.close();
    });
    it('404 for an unknown complaint', async () => {
        const a = app({ ctx: aliceCtx(), rows: [] });
        const res = await a.inject({ method: 'POST', url: `/api/v1/police/complaint/${CID}/investigate` });
        expect(res.statusCode).toBe(404);
        await a.close();
    });
    it('409 when the complaint is not in filed status', async () => {
        const a = app({ ctx: aliceCtx(), rows: [{ complaint_id: CID, status: 'investigating' }] });
        const res = await a.inject({ method: 'POST', url: `/api/v1/police/complaint/${CID}/investigate` });
        expect(res.statusCode).toBe(409);
        await a.close();
    });
});

describe('GET /api/v1/police/complaints', () => {
    it('returns the list for a civic member', async () => {
        const a = app({ ctx: aliceCtx(), rows: [{ complaint_id: '33333333-3333-4333-8333-333333333333', accused_civic_did: BOB, cited_law_id: LAW, status: 'filed', filed_at_tick: 1 }] });
        const res = await a.inject({ method: 'GET', url: '/api/v1/police/complaints' });
        expect(res.statusCode).toBe(200);
        expect(res.json().count).toBe(1);
        await a.close();
    });
    it('401 without civic context', async () => {
        const a = app({ ctx: null });
        const res = await a.inject({ method: 'GET', url: '/api/v1/police/complaints' });
        expect(res.statusCode).toBe(401);
        await a.close();
    });
});
