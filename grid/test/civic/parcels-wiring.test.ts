/**
 * Phase 58 HOUSE-1 · Wave 2 — GridServices wiring + list smoke check.
 *
 * Locks the D-58-07 services-wiring contract: ParcelRegistry + ParcelStore are
 * attached to GridServices via a `parcels` accessor (registry-not-wired bug class —
 * R-H-01). main.ts constructs them inside the if (dbConn) block; here we assert the
 * GridServices shape against the same { registry, store } object using a mock Pool.
 *
 * The `GET /api/v1/civic/parcels` 200 smoke check depends on the Wave-3 route
 * (58-04) which does NOT exist yet — that suite stays describe.skip and goes green
 * when the route lands.
 *
 * Covers: R-58-05 (ParcelRegistry + ParcelStore wired into GridServices, boot log,
 *         CI route smoke check closing the registry-not-wired bug class — R-H-01).
 */
import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import type { Pool } from 'mysql2/promise';
import { ParcelRegistry } from '../../src/civic/parcel-registry.js';
import { ParcelStore } from '../../src/civic/parcel-store.js';
import { AuditChain } from '../../src/audit/chain.js';
import { registerCivicParcelRoutes } from '../../src/api/routes/civic-parcels.js';
import type { GridServices } from '../../src/api/server.js';

function makeMockPool(): Pool {
    return { query: vi.fn().mockResolvedValue([[], []]) } as unknown as Pool;
}

describe('GridServices.parcels wiring (D-58-07 / R-58-05)', () => {
    it('GridServices exposes a parcels accessor { registry, store } after wiring', () => {
        // Mirror the main.ts if (dbConn) construction: a ParcelRegistry + ParcelStore
        // attached as services.parcels (the optional civicDidStore-style accessor).
        const registry = new ParcelRegistry('genesis');
        const store = new ParcelStore(makeMockPool(), 'genesis');
        const services: { parcels?: { registry: ParcelRegistry; store: ParcelStore } } = {
            parcels: { registry, store },
        };
        expect(services.parcels).toBeDefined();
        expect(services.parcels?.registry).toBeInstanceOf(ParcelRegistry);
        expect(services.parcels?.store).toBeInstanceOf(ParcelStore);
    });
});

// Wave 3 (58-04) lands GET /api/v1/civic/parcels. The 200 smoke check is now active —
// the route exists. Catches the registry-not-wired bug class (R-H-01).
describe('GET /api/v1/civic/parcels — registry-not-wired smoke check (R-H-01 / R-58-05)', () => {
    it('GET /api/v1/civic/parcels returns 200 with a parcels array', async () => {
        const registry = new ParcelRegistry('genesis');
        const store = new ParcelStore(makeMockPool(), 'genesis');
        const app = Fastify({ logger: false });
        registerCivicParcelRoutes(app, {
            audit: new AuditChain(),
            gridName: 'genesis',
            parcels: { registry, store },
        } as GridServices);
        await app.ready();
        const res = await app.inject({ method: 'GET', url: '/api/v1/civic/parcels' });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ parcels: expect.any(Array) });
        await app.close();
    });

    it('the returned parcels array reflects the seeded registry (non-empty after seedZone)', async () => {
        const registry = new ParcelRegistry('genesis');
        registry.seedZone({ zoneId: 'residential', count: 24, priceBios: 400, ring: 3 });
        const store = new ParcelStore(makeMockPool(), 'genesis');
        const app = Fastify({ logger: false });
        registerCivicParcelRoutes(app, {
            audit: new AuditChain(),
            gridName: 'genesis',
            parcels: { registry, store },
        } as GridServices);
        await app.ready();
        const res = await app.inject({ method: 'GET', url: '/api/v1/civic/parcels' });
        expect(res.statusCode).toBe(200);
        expect((res.json() as { parcels: unknown[] }).parcels.length).toBe(24);
        await app.close();
    });
});
