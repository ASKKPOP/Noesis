/**
 * Phase 49 Communities v3 (Plan 1) — found + charter + join routes.
 */
import { describe, it, expect, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { AuditChain } from '../../src/audit/chain.js';
import { registerCommunityRoutes } from '../../src/api/routes/community.js';
import type { GridServices } from '../../src/api/server.js';
import type { DIDContext } from '../../src/api/preHandlers/types.js';

const ALICE = 'did:civic:noesis:alice';
const aliceCtx = (): DIDContext => ({ did: ALICE, tier: 'civic_member' });
const CID = '22222222-2222-4222-8222-222222222222';
const CHARTER = { membership: 'open', subgovernance: 'founder_led', conduct_rules: 'be kind', exit_terms: 'leave anytime' };

/** transferOusia mock: ok=true → success, ok=false → insufficient. */
function app(opts: { ctx?: DIDContext | null; rows?: unknown[]; biosOk?: boolean }): FastifyInstance {
    const pool = { query: vi.fn().mockResolvedValue([(opts.rows ?? []) as RowDataPacket[], {}]) } as unknown as Pool;
    const registry = { transferOusia: vi.fn(() => (opts.biosOk === false ? { success: false, error: 'insufficient' } : { success: true, fromBalance: 0, toBalance: 0 })) };
    const services = { gridName: 'genesis', currentTick: () => 5, pool, audit: new AuditChain(), registry } as unknown as GridServices;
    const a = Fastify({ logger: false });
    if (opts.ctx !== undefined) a.addHook('onRequest', async (req) => { req.didContext = opts.ctx ?? undefined; });
    registerCommunityRoutes(a, services);
    return a;
}
const activeCommunity = (charter: object = CHARTER) => [{ community_id: CID, founder_civic_did: ALICE, name: 'Stoics', charter_json: JSON.stringify(charter), charter_hash: 'h', status: 'active', founded_tick: 1 }];

describe('POST /api/v1/community/found (COMM-01/02)', () => {
    it('201 founding with a valid charter + paid Bios', async () => {
        const a = app({ ctx: aliceCtx(), biosOk: true });
        const res = await a.inject({ method: 'POST', url: '/api/v1/community/found', payload: { name: 'Stoics', purpose: 'study', charter: CHARTER } });
        expect(res.statusCode).toBe(201);
        expect(res.json().community_id).toMatch(/^[0-9a-f-]{36}$/i);
        await a.close();
    });
    it('401 without a Civic-DID', async () => {
        const res = await app({ ctx: null }).inject({ method: 'POST', url: '/api/v1/community/found', payload: { name: 'x', purpose: 'y', charter: CHARTER } });
        expect(res.statusCode).toBe(401);
    });
    it('400 invalid charter (reports the failed clause)', async () => {
        const a = app({ ctx: aliceCtx() });
        const res = await a.inject({ method: 'POST', url: '/api/v1/community/found', payload: { name: 'x', purpose: 'y', charter: { ...CHARTER, subgovernance: 'dictator' } } });
        expect(res.statusCode).toBe(400);
        expect(res.json().clause).toBe('subgovernance');
        await a.close();
    });
    it('402 insufficient Bios for the sybil cost', async () => {
        const a = app({ ctx: aliceCtx(), biosOk: false });
        const res = await a.inject({ method: 'POST', url: '/api/v1/community/found', payload: { name: 'x', purpose: 'y', charter: CHARTER } });
        expect(res.statusCode).toBe(402);
        expect(res.json().error).toBe('insufficient_bios');
        await a.close();
    });
});

describe('POST /api/v1/community/:id/join (COMM-03)', () => {
    it('201 immediate join on an open charter', async () => {
        const a = app({ ctx: aliceCtx(), rows: activeCommunity() });
        const res = await a.inject({ method: 'POST', url: `/api/v1/community/${CID}/join` });
        expect(res.statusCode).toBe(201);
        expect(res.json().status).toBe('joined');
        await a.close();
    });
    it('202 pending on an approval_required charter', async () => {
        const a = app({ ctx: aliceCtx(), rows: activeCommunity({ ...CHARTER, membership: 'approval_required' }) });
        const res = await a.inject({ method: 'POST', url: `/api/v1/community/${CID}/join` });
        expect(res.statusCode).toBe(202);
        expect(res.json().status).toBe('pending');
        await a.close();
    });
    it('402 when a bios_fee charter cannot be paid', async () => {
        const a = app({ ctx: aliceCtx(), rows: activeCommunity({ ...CHARTER, membership: { bios_fee: 50 } }), biosOk: false });
        const res = await a.inject({ method: 'POST', url: `/api/v1/community/${CID}/join` });
        expect(res.statusCode).toBe(402);
        await a.close();
    });
    it('404 for an unknown community', async () => {
        const a = app({ ctx: aliceCtx(), rows: [] });
        const res = await a.inject({ method: 'POST', url: `/api/v1/community/${CID}/join` });
        expect(res.statusCode).toBe(404);
        await a.close();
    });
});

describe('GET /api/v1/community/:id (public)', () => {
    it('200 with charter + member count', async () => {
        const a = app({ ctx: null, rows: activeCommunity() });
        const res = await a.inject({ method: 'GET', url: `/api/v1/community/${CID}` });
        expect(res.statusCode).toBe(200);
        expect(res.json().community.name).toBe('Stoics');
        await a.close();
    });
});

describe('Community Plan 2 (COMM-04/05)', () => {
    it('POST /post — 201 for a member', async () => {
        const a = app({ ctx: aliceCtx(), rows: [{ '1': 1 }] }); // isMember true
        const res = await a.inject({ method: 'POST', url: `/api/v1/community/${CID}/post`, payload: { body: 'hello' } });
        expect(res.statusCode).toBe(201);
        await a.close();
    });
    it('POST /post — 403 for a non-member', async () => {
        const a = app({ ctx: aliceCtx(), rows: [] });
        const res = await a.inject({ method: 'POST', url: `/api/v1/community/${CID}/post`, payload: { body: 'hello' } });
        expect(res.statusCode).toBe(403);
        await a.close();
    });
    it('POST /decision — 200 for an internal scope', async () => {
        const a = app({ ctx: aliceCtx(), rows: [{ '1': 1 }] });
        const res = await a.inject({ method: 'POST', url: `/api/v1/community/${CID}/decision`, payload: { scope: 'membership_policy' } });
        expect(res.statusCode).toBe(200);
        await a.close();
    });
    it('🔒 POST /decision — 403 out_of_scope when trying to legislate civic law', async () => {
        const a = app({ ctx: aliceCtx(), rows: [{ '1': 1 }] });
        const res = await a.inject({ method: 'POST', url: `/api/v1/community/${CID}/decision`, payload: { scope: 'civic_law' } });
        expect(res.statusCode).toBe(403);
        expect(res.json().error).toBe('out_of_scope');
        await a.close();
    });
    it('POST /dissolve — 200 for the founder', async () => {
        const a = app({ ctx: aliceCtx(), rows: activeCommunity() }); // founder = ALICE
        const res = await a.inject({ method: 'POST', url: `/api/v1/community/${CID}/dissolve` });
        expect(res.statusCode).toBe(200);
        await a.close();
    });
    it('POST /dissolve — 403 for a non-founder', async () => {
        const a = app({ ctx: aliceCtx(), rows: [{ community_id: CID, founder_civic_did: 'did:civic:noesis:bob', name: 'x', charter_json: JSON.stringify(CHARTER), charter_hash: 'h', status: 'active', founded_tick: 1 }] });
        const res = await a.inject({ method: 'POST', url: `/api/v1/community/${CID}/dissolve` });
        expect(res.statusCode).toBe(403);
        await a.close();
    });
});
