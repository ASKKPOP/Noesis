import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import type { FastifyInstance } from 'fastify';

function mockPool(rows: unknown[]): Pool {
    const query = vi.fn().mockResolvedValue([rows as RowDataPacket[], {}]);
    return { query } as unknown as Pool;
}
function makeApp(pool?: Pool): FastifyInstance {
    return buildServer({
        clock: new WorldClock({ tickRateMs: 100_000 }),
        space: new SpatialMap(), logos: new LogosEngine(), audit: new AuditChain(),
        gridName: 'genesis', pool: pool as never,
    });
}
const sample = {
    object_id: 'o1', grid_name: 'genesis', owner_did: 'did:civic:noesis:treasury', builder_did: 'w',
    build_cost_wei: '4000', function_type: 'Energy', output_rate: '120',
    physics_spec: JSON.stringify({ mass_kg: 1000, altitude_km: 420 }), provenance_contract_id: 'c1', zone: 'infrastructure', status: 'active',
};

describe('GET /api/v1/orbital/objects', () => {
    let app: FastifyInstance;
    beforeAll(() => { app = makeApp(mockPool([sample])); });
    afterAll(async () => { await app.close(); });

    it('returns active objects with parsed physics_spec', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/orbital/objects?grid=genesis' });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.count).toBe(1);
        expect(body.objects[0]).toMatchObject({ object_id: 'o1', function_type: 'Energy', zone: 'infrastructure', build_cost_wei: '4000' });
        expect(body.objects[0].physics_spec).toMatchObject({ mass_kg: 1000, altitude_km: 420 }); // parsed object, not string
    });

    it('503 when the pool is not wired', async () => {
        const bare = makeApp(undefined);
        const res = await bare.inject({ method: 'GET', url: '/api/v1/orbital/objects?grid=genesis' });
        expect(res.statusCode).toBe(503);
        await bare.close();
    });
});
