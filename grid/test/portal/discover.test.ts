/**
 * Portal discovery (spec §2) — GET /api/v1/portal/discover.
 * Search organizations (Groups) + pointer to the Houses feed.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import type { FastifyInstance } from 'fastify';

const FAKE_GROUPS = [
    { groupId: 'g-aegis', kind: 'business', domain: 'defense', displayName: 'Aegis', crestPath: null, ring: 2, sectorDeg: 10, status: 'active' },
    { groupId: 'g-helix', kind: 'business', domain: 'biotech', displayName: 'Helix', crestPath: null, ring: 2, sectorDeg: 80, status: 'active' },
];

function makeApp(groupStore?: unknown): FastifyInstance {
    return buildServer({
        clock: new WorldClock({ tickRateMs: 100_000 }),
        space: new SpatialMap(),
        logos: new LogosEngine(),
        audit: new AuditChain(),
        gridName: 'genesis',
        groupStore: groupStore as never,
    });
}

const fakeStore = { listGroups: async () => FAKE_GROUPS };

describe('GET /api/v1/portal/discover (spec §2)', () => {
    let app: FastifyInstance;
    beforeAll(() => { app = makeApp(fakeStore); });
    afterAll(async () => { await app.close(); });

    it('lists organizations + a pointer to the Houses feed', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/portal/discover' });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.count).toBe(2);
        expect(body.organizations.map((o: { name: string }) => o.name)).toEqual(['Aegis', 'Helix']);
        expect(body.organizations[0].group_id).toBe('g-aegis');
        expect(body.houses_feed).toBe('/api/v1/civic/parcels');
    });

    it('?q= filters organizations by name (case-insensitive)', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/portal/discover?q=helix' });
        const body = res.json();
        expect(body.organizations.map((o: { name: string }) => o.name)).toEqual(['Helix']);
    });

    it('?domain= filters by domain', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/portal/discover?domain=defense' });
        const body = res.json();
        expect(body.count).toBe(1);
        expect(body.organizations[0].name).toBe('Aegis');
    });

    it('503 when the group store is not wired', async () => {
        const bare = makeApp(undefined);
        const res = await bare.inject({ method: 'GET', url: '/api/v1/portal/discover' });
        expect(res.statusCode).toBe(503);
        await bare.close();
    });
});
