/**
 * Phase 57 Grid Zoning (Plan 1) — zones read + Polis amend routes.
 */
import { describe, it, expect, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { registerZoningRoutes } from '../../src/api/routes/zoning.js';
import type { GridServices } from '../../src/api/server.js';
import type { DIDContext } from '../../src/api/preHandlers/types.js';
import { AuditChain } from '../../src/audit/chain.js';

function makeApp(rows: unknown[], ctx: DIDContext | null): FastifyInstance {
    const pool = { query: vi.fn().mockResolvedValue([rows as RowDataPacket[], {}]) } as unknown as Pool;
    const services = { gridName: 'genesis', currentTick: () => 5, pool, audit: new AuditChain() } as unknown as GridServices;
    const a = Fastify({ logger: false });
    a.addHook('onRequest', async (req) => { req.didContext = ctx ?? undefined; });
    registerZoningRoutes(a, services);
    return a;
}
const GOV: DIDContext = { did: 'did:gov:noesis:polis', tier: 'government' };
const CIVIC: DIDContext = { did: 'did:civic:noesis:alice', tier: 'civic_member' };

describe('GET /api/v1/zoning/zones', () => {
    it('200 returns the 6 zones', async () => {
        const a = makeApp([], null);
        const res = await a.inject({ method: 'GET', url: '/api/v1/zoning/zones' });
        expect(res.statusCode).toBe(200);
        expect(res.json().zones).toHaveLength(6);
        await a.close();
    });
});

describe('POST /api/v1/zoning/:zoneId/amend', () => {
    it('201 amending a zone (Polis)', async () => {
        const a = makeApp([], GOV);
        const res = await a.inject({ method: 'POST', url: '/api/v1/zoning/manufacture/amend', payload: { tax_modifier_bps: 150 } });
        expect(res.statusCode).toBe(201);
        expect(res.json().tax_modifier_bps).toBe(150);
        await a.close();
    });
    it('403 for a non-Polis caller', async () => {
        const a = makeApp([], CIVIC);
        const res = await a.inject({ method: 'POST', url: '/api/v1/zoning/manufacture/amend', payload: { tax_modifier_bps: 150 } });
        expect(res.statusCode).toBe(403);
        await a.close();
    });
    it('404 for a zone this Grid does not have', async () => {
        const a = makeApp([], GOV);
        const res = await a.inject({ method: 'POST', url: '/api/v1/zoning/casino/amend', payload: { tax_modifier_bps: 150 } });
        expect(res.statusCode).toBe(404);
        await a.close();
    });
    it('400 on an out-of-range tax modifier', async () => {
        const a = makeApp([], GOV);
        const res = await a.inject({ method: 'POST', url: '/api/v1/zoning/business/amend', payload: { tax_modifier_bps: 99999 } });
        expect(res.statusCode).toBe(400);
        await a.close();
    });
});

describe('POST /api/v1/zoning/residence/assign', () => {
    it('201 assigns a residence (system/Polis)', async () => {
        const a = makeApp([], GOV);
        const res = await a.inject({ method: 'POST', url: '/api/v1/zoning/residence/assign', payload: { civic_did: 'did:civic:noesis:human:alice' } });
        expect(res.statusCode).toBe(201);
        expect(res.json().residence_id).toMatch(/^res-/);
        await a.close();
    });
    it('403 for a non-Government caller', async () => {
        const a = makeApp([], CIVIC);
        const res = await a.inject({ method: 'POST', url: '/api/v1/zoning/residence/assign', payload: { civic_did: 'did:civic:noesis:human:alice' } });
        expect(res.statusCode).toBe(403);
        await a.close();
    });
});

// ── D-V3-40: the Polis legislates its Grid's zone set ───────────────────────────
describe('zone law routes (D-V3-40)', () => {
    /** Pool whose civic_parcels count is `parcels`; every other query returns no rows. */
    function appWithParcels(parcels: number, ctx: DIDContext | null): FastifyInstance {
        const pool = {
            query: vi.fn(async (sql: string) => [sql.includes('FROM civic_parcels') ? [{ n: parcels }] : [], {}]),
        } as unknown as Pool;
        const services = { gridName: 'genesis', currentTick: () => 5, pool, audit: new AuditChain() } as unknown as GridServices;
        const a = Fastify({ logger: false });
        a.addHook('onRequest', async (req) => { req.didContext = ctx ?? undefined; });
        registerZoningRoutes(a, services);
        return a;
    }
    const harbor = { zone_id: 'harbor', label: 'Harbor', kind: 'business', allowed_activities: ['trade'], tax_modifier_bps: 50 };

    it('201 the Polis adds a zone', async () => {
        const a = makeApp([], GOV);
        const res = await a.inject({ method: 'POST', url: '/api/v1/zoning/zones', payload: harbor });
        expect(res.statusCode).toBe(201);
        expect(res.json()).toEqual({ status: 'zone_added', zone_id: 'harbor' });
        await a.close();
    });
    it('403 for anyone but the Polis — add, relabel and remove', async () => {
        const a = makeApp([], CIVIC);
        expect((await a.inject({ method: 'POST', url: '/api/v1/zoning/zones', payload: harbor })).statusCode).toBe(403);
        expect((await a.inject({ method: 'POST', url: '/api/v1/zoning/shopping/relabel', payload: { label: 'Bazaar' } })).statusCode).toBe(403);
        expect((await a.inject({ method: 'POST', url: '/api/v1/zoning/shopping/remove' })).statusCode).toBe(403);
        await a.close();
    });
    it('409 adding a zone the Grid already has; 400 on a bad definition', async () => {
        const a = makeApp([], GOV);
        expect((await a.inject({ method: 'POST', url: '/api/v1/zoning/zones', payload: { ...harbor, zone_id: 'business' } })).json()).toEqual({ error: 'zone_exists' });
        const bad = await a.inject({ method: 'POST', url: '/api/v1/zoning/zones', payload: { ...harbor, kind: 'palace' } });
        expect(bad.statusCode).toBe(400);
        expect(bad.json()).toEqual({ error: 'invalid_kind' });
        expect((await a.inject({ method: 'POST', url: '/api/v1/zoning/zones', payload: {} })).statusCode).toBe(400);
        await a.close();
    });
    it('201 relabel; 404 relabeling an unknown zone', async () => {
        const a = makeApp([], GOV);
        expect((await a.inject({ method: 'POST', url: '/api/v1/zoning/shopping/relabel', payload: { label: 'Bazaar' } })).statusCode).toBe(201);
        expect((await a.inject({ method: 'POST', url: '/api/v1/zoning/casino/relabel', payload: { label: 'X' } })).statusCode).toBe(404);
        await a.close();
    });
    it('201 removing an empty zone; 409 while it still holds land', async () => {
        const empty = appWithParcels(0, GOV);
        expect((await empty.inject({ method: 'POST', url: '/api/v1/zoning/manufacture/remove' })).json()).toEqual({ status: 'zone_removed', zone_id: 'manufacture' });
        await empty.close();
        const full = appWithParcels(8, GOV);
        const res = await full.inject({ method: 'POST', url: '/api/v1/zoning/business/remove' });
        expect(res.statusCode).toBe(409);
        expect(res.json()).toEqual({ error: 'zone_occupied' });
        await full.close();
    });
});
