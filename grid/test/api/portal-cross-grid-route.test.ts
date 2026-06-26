/**
 * Phase 55 Portal Cross-Grid Framework (DORMANT v3.0) — read endpoints + 503 stub.
 */
import { describe, it, expect } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerPortalCrossGridRoutes } from '../../src/api/routes/portal-cross-grid.js';
import type { GridServices } from '../../src/api/server.js';

function makeApp(): FastifyInstance {
    const services = { gridName: 'genesis' } as unknown as GridServices;
    const a = Fastify({ logger: false });
    registerPortalCrossGridRoutes(a, services);
    return a;
}

describe('Phase 55 cross-Grid endpoints (dormant)', () => {
    it('GET /grids returns at most [Genesis]', async () => {
        const a = makeApp();
        const res = await a.inject({ method: 'GET', url: '/portal/api/v1/nous/did:noesis:account:x/grids' });
        expect(res.statusCode).toBe(200);
        expect(res.json().grids).toEqual([{ grid_name: 'genesis' }]);
        await a.close();
    });
    it('GET /identity resolves to Genesis-only Civic-DIDs', async () => {
        const a = makeApp();
        const res = await a.inject({ method: 'GET', url: '/portal/api/v1/identity/did:noesis:existence:x' });
        expect(res.statusCode).toBe(200);
        expect(res.json().civic_dids).toEqual([{ grid_name: 'genesis' }]);
        await a.close();
    });
    it('🔒 POST /cross-grid/marketplace/quote returns 503 not_yet_active (dormant)', async () => {
        const a = makeApp();
        const res = await a.inject({ method: 'POST', url: '/portal/api/v1/cross-grid/marketplace/quote', payload: {} });
        expect(res.statusCode).toBe(503);
        expect(res.json().error).toBe('not_yet_active');
        await a.close();
    });
    it('GET /audit/cross-grid returns a Genesis-scoped (empty) timeline', async () => {
        const a = makeApp();
        const res = await a.inject({ method: 'GET', url: '/portal/api/v1/audit/cross-grid?did=x' });
        expect(res.statusCode).toBe(200);
        expect(res.json().grids).toEqual(['genesis']);
        await a.close();
    });
});
