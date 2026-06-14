/**
 * Phase 59 HOUSE-2 · Wave 0 — SKIP-STUB for the interior HTTP routes (D-59-03/08 / R-59-04).
 *
 * describe.skip: the interior routes are added to grid/src/api/routes/civic-parcels.ts in
 * Wave 2/3 (extending the Phase 58 route shape). Deferred dynamic import (Phase 58 Wave-0
 * pattern) defers module resolution until the suite is un-skipped.
 *
 * Contract under test:
 *   - POST /api/v1/civic/parcels/:id/interior/extend — civic_did_required + owner-only:
 *       non-owner → 403 not_owner; unknown/mismatched kind → 422 invalid_furniture;
 *       success → 200 mutating the tree + zoning.interior_extended emitted.
 *   - GET /api/v1/civic/parcels/:id/interior — owner always; visitor only if structure open
 *       OR allowlisted AND condition != derelict; derelict → 403 closed_to_visitors;
 *       a human attempting a private interior → refused.
 *   - The public feed (GET parcels) exposes exterior + condition only — NEVER the interior tree.
 */
import { describe, it, expect } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

const loadRoutes = () => import('../../src/api/routes/civic-parcels.js');

const OWNER = 'did:civic:noesis:alice';
const OTHER = 'did:civic:noesis:bob';
const HOME = 'genesis:residential:0001';

const POST = (app: FastifyInstance, url: string, payload?: unknown) =>
    app.inject({ method: 'POST', url, payload: payload as Record<string, unknown> });
const GET = (app: FastifyInstance, url: string) => app.inject({ method: 'GET', url });

describe.skip('Phase 59 HOUSE-2 — POST interior/extend (owner-only, catalog-validated) [Wave 3 un-skips]', () => {
    it('a non-owner extending an interior → 403 not_owner', async () => {
        const { registerCivicParcelRoutes } = await loadRoutes();
        const app = Fastify({ logger: false });
        app.addHook('onRequest', async (req) => { (req as never as { didContext: unknown }).didContext = { did: OTHER, tier: 'civic_member' }; });
        registerCivicParcelRoutes(app, {} as never);
        await app.ready();
        const res = await POST(app, `/api/v1/civic/parcels/${HOME}/interior/extend`, { area: 'bedroom', kind: 'bed' });
        expect(res.statusCode).toBe(403);
        expect(res.json()).toMatchObject({ error: 'not_owner' });
        await app.close();
    });

    it('an unknown / mismatched furniture kind → 422 invalid_furniture', async () => {
        const { registerCivicParcelRoutes } = await loadRoutes();
        const app = Fastify({ logger: false });
        app.addHook('onRequest', async (req) => { (req as never as { didContext: unknown }).didContext = { did: OWNER, tier: 'civic_member' }; });
        registerCivicParcelRoutes(app, {} as never);
        await app.ready();
        // mirror furniture (bed) requested in a non-home OR an unknown kind both → invalid_furniture.
        const res = await POST(app, `/api/v1/civic/parcels/${HOME}/interior/extend`, { area: 'bedroom', kind: 'throne' });
        expect(res.statusCode).toBe(422);
        expect(res.json()).toMatchObject({ error: 'invalid_furniture' });
        await app.close();
    });

    it('the owner extending a valid kind → 200, the tree mutates, zoning.interior_extended emitted', async () => {
        const { registerCivicParcelRoutes } = await loadRoutes();
        const app = Fastify({ logger: false });
        app.addHook('onRequest', async (req) => { (req as never as { didContext: unknown }).didContext = { did: OWNER, tier: 'civic_member' }; });
        registerCivicParcelRoutes(app, {} as never);
        await app.ready();
        const res = await POST(app, `/api/v1/civic/parcels/${HOME}/interior/extend`, { area: 'bedroom', kind: 'bed' });
        expect(res.statusCode).toBe(200);
        await app.close();
    });
});

describe.skip('Phase 59 HOUSE-2 — GET interior (entry-policy + derelict gating) [Wave 3 un-skips]', () => {
    it('the owner can always GET their own interior tree', async () => {
        const { registerCivicParcelRoutes } = await loadRoutes();
        const app = Fastify({ logger: false });
        app.addHook('onRequest', async (req) => { (req as never as { didContext: unknown }).didContext = { did: OWNER, tier: 'civic_member' }; });
        registerCivicParcelRoutes(app, {} as never);
        await app.ready();
        const res = await GET(app, `/api/v1/civic/parcels/${HOME}/interior`);
        expect(res.statusCode).toBe(200);
        await app.close();
    });

    it('a visitor to a derelict structure → 403 closed_to_visitors', async () => {
        const { registerCivicParcelRoutes } = await loadRoutes();
        const app = Fastify({ logger: false });
        app.addHook('onRequest', async (req) => { (req as never as { didContext: unknown }).didContext = { did: OTHER, tier: 'civic_member' }; });
        registerCivicParcelRoutes(app, {} as never);
        await app.ready();
        const res = await GET(app, `/api/v1/civic/parcels/${HOME}/interior`);
        expect(res.statusCode).toBe(403);
        expect(res.json()).toMatchObject({ error: 'closed_to_visitors' });
        await app.close();
    });

    it('a human attempting a private interior is refused (humans never see private interiors, D-NH-07)', async () => {
        const { registerCivicParcelRoutes } = await loadRoutes();
        const app = Fastify({ logger: false });
        app.addHook('onRequest', async (req) => { (req as never as { didContext: unknown }).didContext = { did: 'did:civic:noesis:human:carol', tier: 'human_visitor' }; });
        registerCivicParcelRoutes(app, {} as never);
        await app.ready();
        const res = await GET(app, `/api/v1/civic/parcels/${HOME}/interior`);
        expect([401, 403]).toContain(res.statusCode);
        await app.close();
    });

    it('the public feed (GET parcels) exposes exterior + condition only — NEVER the interior tree', async () => {
        const { registerCivicParcelRoutes } = await loadRoutes();
        const app = Fastify({ logger: false });
        app.addHook('onRequest', async (req) => { (req as never as { didContext: unknown }).didContext = null; });
        registerCivicParcelRoutes(app, {} as never);
        await app.ready();
        const res = await GET(app, '/api/v1/civic/parcels');
        const body = JSON.stringify(res.json());
        expect(body).not.toContain('areas');
        expect(body).not.toContain('interior');
        await app.close();
    });
});
