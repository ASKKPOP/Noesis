/** Grid House Objects §15 — GET /api/v1/civic/catalog (public, read-only). */
import { describe, it, expect, afterEach } from 'vitest';
import type { Pool } from 'mysql2/promise';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { CatalogStore } from '../../src/civic/catalog-store.js';
import { genesisCatalogEntries } from '../../src/civic/genesis-catalog.js';

/** A pool that answers hydrate with the seeded rows and records nothing else. */
function seededStore(): CatalogStore {
    const rows = genesisCatalogEntries('earth_orbit').map((e) => ({
        entry_id: e.entryId, version: e.version, tier: e.tier, type: e.type, level: e.level,
        body_json: JSON.parse(JSON.stringify(e.body)), body_hash: e.bodyHash,
    }));
    const pool = { query: async () => [rows, []] } as unknown as Pool;
    return new CatalogStore(pool, 'genesis', 'earth_orbit');
}

let app: FastifyInstance | undefined;
afterEach(async () => { await app?.close(); app = undefined; });

function makeApp(catalogStore?: CatalogStore): FastifyInstance {
    return buildServer({
        clock: new WorldClock({ tickRateMs: 100_000 }),
        space: new SpatialMap(), logos: new LogosEngine(), audit: new AuditChain(),
        gridName: 'genesis', catalogStore,
    });
}

describe('GET /api/v1/civic/catalog', () => {
    it('serves the hydrated catalog with counts, without auth', async () => {
        const store = seededStore();
        await store.hydrate();
        app = makeApp(store);
        const res = await app.inject({ method: 'GET', url: '/api/v1/civic/catalog' });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.grid).toBe('genesis');
        expect(body.core_version).toBe('1.0.0');
        expect(body.counts).toEqual({ material: 16, finish: 12, shell_element: 14, kind: 59, algorithm: 20, starter_set: 4 });
        expect(body.entries).toHaveLength(125);
        const desk = body.entries.find((e: { entry_id: string }) => e.entry_id === 'core:work_desk');
        expect(desk).toMatchObject({ tier: 0, type: 'kind', level: 'standard' });
        expect(desk.body).toMatchObject({ id: 'work_desk', class: 'functional', placeable: true });
        expect(desk.body.form.base).toBe('box');
    });

    it('?type=kind narrows the entries; counts stay whole', async () => {
        const store = seededStore();
        await store.hydrate();
        app = makeApp(store);
        const body = (await app.inject({ method: 'GET', url: '/api/v1/civic/catalog?type=starter_set' })).json();
        expect(body.entries.map((e: { entry_id: string }) => e.entry_id).sort()).toEqual([
            'core:starter_set:home', 'core:starter_set:shop', 'core:starter_set:venue', 'core:starter_set:workshop',
        ]);
        expect(body.counts.kind).toBe(59);
    });

    it('400 for an unknown type', async () => {
        const store = seededStore();
        await store.hydrate();
        app = makeApp(store);
        const res = await app.inject({ method: 'GET', url: '/api/v1/civic/catalog?type=weapon' });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('unknown_type');
    });

    it('503 when the Grid runs without a catalog store', async () => {
        app = makeApp();
        const res = await app.inject({ method: 'GET', url: '/api/v1/civic/catalog' });
        expect(res.statusCode).toBe(503);
        expect(res.json().error).toBe('catalog_not_wired');
    });
});
