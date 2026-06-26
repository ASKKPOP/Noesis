/**
 * Phase 53 Portal Grid Approval Workflow — request + reviewer-decision routes.
 */
import { describe, it, expect, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { registerPortalGridApprovalRoutes } from '../../src/api/routes/portal-grid-approval.js';
import type { GridServices } from '../../src/api/server.js';
import type { DIDContext } from '../../src/api/preHandlers/types.js';
import { AuditChain } from '../../src/audit/chain.js';

function makeApp(rows: unknown[], ctx: DIDContext | null): FastifyInstance {
    const pool = { query: vi.fn().mockResolvedValue([rows as RowDataPacket[], {}]) } as unknown as Pool;
    const services = { gridName: 'genesis', currentTick: () => 10, pool, audit: new AuditChain() } as unknown as GridServices;
    const a = Fastify({ logger: false });
    a.addHook('onRequest', async (req) => { req.didContext = ctx ?? undefined; });
    registerPortalGridApprovalRoutes(a, services);
    return a;
}
const GOV: DIDContext = { did: 'did:gov:noesis:rev', tier: 'government' };
const CIVIC: DIDContext = { did: 'did:noesis:nous:founder', tier: 'civic_member' };
const pending = [{ request_id: 'r1', proposed_name: 'Commerce', requester_did: 'did:noesis:nous:founder', status: 'pending_review' }];

describe('POST /portal/api/v1/grid/request', () => {
    it('201 files a request', async () => {
        const a = makeApp([], CIVIC);
        const res = await a.inject({ method: 'POST', url: '/portal/api/v1/grid/request', payload: { proposed_name: 'Commerce', founding_capital: 5000 } });
        expect(res.statusCode).toBe(201);
        expect(res.json().status).toBe('pending_review');
        await a.close();
    });
    it('400 on an invalid proposed name', async () => {
        const a = makeApp([], CIVIC);
        const res = await a.inject({ method: 'POST', url: '/portal/api/v1/grid/request', payload: { proposed_name: '!!' } });
        expect(res.statusCode).toBe(400);
        await a.close();
    });
    it('401 without a DID', async () => {
        const a = makeApp([], null);
        const res = await a.inject({ method: 'POST', url: '/portal/api/v1/grid/request', payload: { proposed_name: 'Commerce' } });
        expect(res.statusCode).toBe(401);
        await a.close();
    });
});

describe('POST /portal/api/v1/grid/:requestId/decision', () => {
    it('403 for a non-reviewer (non-Government) caller', async () => {
        const a = makeApp(pending, CIVIC);
        const res = await a.inject({ method: 'POST', url: '/portal/api/v1/grid/r1/decision', payload: { decision: 'reject', reason: 'panel_declined' } });
        expect(res.statusCode).toBe(403);
        await a.close();
    });
    it('201 rejecting a pending request', async () => {
        const a = makeApp(pending, GOV);
        const res = await a.inject({ method: 'POST', url: '/portal/api/v1/grid/r1/decision', payload: { decision: 'reject', reason: 'charter_incompatible' } });
        expect(res.statusCode).toBe(201);
        expect(res.json().status).toBe('rejected');
        await a.close();
    });
    it('400 on an invalid decision', async () => {
        const a = makeApp(pending, GOV);
        const res = await a.inject({ method: 'POST', url: '/portal/api/v1/grid/r1/decision', payload: { decision: 'maybe' } });
        expect(res.statusCode).toBe(400);
        await a.close();
    });
});
