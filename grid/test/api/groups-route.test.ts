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
    group_id: 'grp-helix', grid_name: 'genesis', kind: 'business', domain: 'biotech',
    display_name: 'Helix', crest_path: null, ring: 2, sector_deg: '48', status: 'active',
};

describe('GET /api/v1/groups (W-B4 — Nous join-sight)', () => {
    let app: FastifyInstance;
    beforeAll(() => { app = makeApp(mockPool([sample])); });
    afterAll(async () => { await app.close(); });

    it('returns the founding groups in wire shape', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/groups' });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.count).toBe(1);
        expect(body.groups[0]).toMatchObject({
            group_id: 'grp-helix', kind: 'business', domain: 'biotech',
            display_name: 'Helix', ring: 2, sector_deg: 48, status: 'active',
        });
    });

    it('503 when the pool is not wired', async () => {
        const bare = makeApp(undefined);
        const res = await bare.inject({ method: 'GET', url: '/api/v1/groups' });
        expect(res.statusCode).toBe(503);
        await bare.close();
    });
});
