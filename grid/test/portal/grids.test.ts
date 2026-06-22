/**
 * Portal Grid discovery (spec §2) — GridRegistry + GET /api/v1/portal/grids.
 * Multi-Grid framework: the Portal's index of active Grids (v3.0 seeds Genesis).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/api/server.js';
import { GridRegistry } from '../../src/registry/grid-registry.js';
import { EARTH_ORBIT, GRID_ENVIRONMENTS } from '../../src/registry/grid-environments.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import type { FastifyInstance } from 'fastify';

function genesisRegistry(): GridRegistry {
    const r = new GridRegistry();
    r.register({
        gridId: 'genesis', name: 'Genesis', gridDomain: 'genesis.noesis',
        polisName: 'Genesis Polis', description: 'The first Grid.', status: 'active',
        environment: EARTH_ORBIT,
    });
    return r;
}

describe('GridRegistry', () => {
    it('registers, gets, and lists active grids', () => {
        const r = genesisRegistry();
        expect(r.get('genesis')?.name).toBe('Genesis');
        expect(r.all()).toHaveLength(1);
        expect(r.active()).toHaveLength(1);
    });

    it('excludes non-active grids from active()', () => {
        const r = genesisRegistry();
        r.register({ gridId: 'commerce', name: 'Commerce', gridDomain: 'commerce.noesis', polisName: 'Commerce Polis', description: 'x', status: 'forming', environment: GRID_ENVIRONMENTS['Moon'] });
        expect(r.all()).toHaveLength(2);
        expect(r.active().map((g) => g.gridId)).toEqual(['genesis']);
    });

    it('rejects a duplicate gridId', () => {
        const r = genesisRegistry();
        expect(() => r.register({ gridId: 'genesis', name: 'Dup', gridDomain: 'x', polisName: 'y', description: 'z', status: 'active', environment: EARTH_ORBIT }))
            .toThrow();
    });
});

function makeApp(gridRegistry?: GridRegistry): FastifyInstance {
    return buildServer({
        clock: new WorldClock({ tickRateMs: 100_000 }),
        space: new SpatialMap(),
        logos: new LogosEngine(),
        audit: new AuditChain(),
        gridName: 'genesis',
        gridRegistry: gridRegistry as never,
    });
}

describe('GET /api/v1/portal/grids (spec §2)', () => {
    let app: FastifyInstance;
    beforeAll(() => { app = makeApp(genesisRegistry()); });
    afterAll(async () => { await app.close(); });

    it('lists active Grids', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/portal/grids' });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.count).toBe(1);
        expect(body.grids[0]).toMatchObject({ grid_id: 'genesis', name: 'Genesis', polis: 'Genesis Polis', status: 'active' });
        expect(body.grids[0].celestial_body).toBe('Earth-orbit');
        expect(body.grids[0].environment).toMatchObject({ name: 'Earth-orbit', gravity_ms2: 9.81, min_stable_altitude_km: 160 });
    });

    it('?q= filters by name', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/portal/grids?q=zzz' });
        expect(res.json().count).toBe(0);
    });

    it('503 when the grid registry is not wired', async () => {
        const bare = makeApp(undefined);
        const res = await bare.inject({ method: 'GET', url: '/api/v1/portal/grids' });
        expect(res.statusCode).toBe(503);
        await bare.close();
    });
});
