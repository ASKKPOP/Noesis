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

describe('GET /api/v1/groups/:groupId (Phase 71 — Group detail)', () => {
    function detailPool(): Pool {
        const query = vi.fn().mockImplementation((sql: string) => {
            if (sql.includes('civic_group_members')) {
                return Promise.resolve([[
                    { group_id: 'grp-helix', member_civic_did: 'did:civic:noesis:sophia', role: 'founder', joined_at_tick: 7, status: 'active' },
                ], {}]);
            }
            if (sql.includes('civic_group_projects')) {
                return Promise.resolve([[
                    { project_id: 'p-1', group_id: 'grp-helix', title: 'Protein folding', status: 'completed',
                      produced_blueprint_hash: 'ab'.repeat(32), started_at_tick: 10, completed_at_tick: 20 },
                ], {}]);
            }
            return Promise.resolve([[sample], {}]);
        });
        return { query } as unknown as Pool;
    }
    let app: FastifyInstance;
    beforeAll(() => { app = makeApp(detailPool()); });
    afterAll(async () => { await app.close(); });

    it('returns the group with members and projects', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/groups/grp-helix' });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.group).toMatchObject({ group_id: 'grp-helix', display_name: 'Helix', domain: 'biotech' });
        expect(body.member_count).toBe(1);
        expect(body.members[0]).toMatchObject({ role: 'founder', joined_at_tick: 7 });
        expect(body.projects[0]).toMatchObject({ project_id: 'p-1', title: 'Protein folding', status: 'completed', completed_at_tick: 20 });
    });

    it('never exposes a raw member Civic-DID — hash only', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/groups/grp-helix' });
        expect(res.payload).not.toContain('did:civic:noesis:sophia');
        expect(res.json().members[0].member_hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('404 for an unknown group', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/groups/grp-nope' });
        expect(res.statusCode).toBe(404);
    });
});
