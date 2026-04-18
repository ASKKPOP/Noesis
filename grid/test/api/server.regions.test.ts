import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import type { FastifyInstance } from 'fastify';

function seedServer(seedRegions: boolean): { app: FastifyInstance; clock: WorldClock } {
    const clock = new WorldClock({ tickRateMs: 100_000 });
    const space = new SpatialMap();
    const logos = new LogosEngine();
    const audit = new AuditChain();

    if (seedRegions) {
        space.addRegion({
            id: 'agora', name: 'Agora Central', description: 'Main plaza',
            regionType: 'public', capacity: 100, properties: {},
        });
        space.addRegion({
            id: 'market', name: 'Market District', description: 'Trading hub',
            regionType: 'public', capacity: 50, properties: {},
        });
        space.addConnection({
            fromRegion: 'agora', toRegion: 'market',
            travelCost: 5, bidirectional: true,
        });
    }

    const app = buildServer({ clock, space, logos, audit, gridName: 'genesis' });
    return { app, clock };
}

describe('GET /api/v1/grid/regions — returns regions + connections', () => {
    let app: FastifyInstance;
    let clock: WorldClock;

    beforeAll(async () => {
        ({ app, clock } = seedServer(true));
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
        clock.stop();
    });

    it('returns both regions array and connections array', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/grid/regions' });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(Array.isArray(body.regions)).toBe(true);
        expect(body.regions.some((r: { id: string }) => r.id === 'agora')).toBe(true);
        expect(Array.isArray(body.connections)).toBe(true);
        expect(body.connections).toHaveLength(1);
        expect(body.connections[0]).toEqual({
            fromRegion: 'agora',
            toRegion: 'market',
            travelCost: 5,
            bidirectional: true,
        });
    });

    it('is read-only: mutating response body does not mutate internal state', async () => {
        const first = await app.inject({ method: 'GET', url: '/api/v1/grid/regions' });
        const firstBody = first.json();
        firstBody.connections.push({
            fromRegion: 'x', toRegion: 'y', travelCost: 1, bidirectional: false,
        });

        const second = await app.inject({ method: 'GET', url: '/api/v1/grid/regions' });
        const secondBody = second.json();
        expect(secondBody.connections).toHaveLength(1);
    });
});

describe('GET /api/v1/grid/regions — empty space', () => {
    let app: FastifyInstance;
    let clock: WorldClock;

    beforeAll(async () => {
        ({ app, clock } = seedServer(false));
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
        clock.stop();
    });

    it('returns empty arrays for both regions and connections', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/grid/regions' });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.regions).toEqual([]);
        expect(body.connections).toEqual([]);
    });
});
