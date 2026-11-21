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

// ── D-V3-41: public / private Grids on the Portal map ───────────────────────────
import { SignJWT } from 'jose';
import { COOKIE_NAME, keyPairPromise } from '../../src/api/portal/auth.js';
import { gridRecordFromConfig } from '../../src/registry/grid-record-from-config.js';
import { GENESIS_CONFIG } from '../../src/genesis/presets.js';

const MEMBER_DID = 'did:noesis:member-human';
const OUTSIDER_DID = 'did:noesis:outsider-human';

async function portalCookie(did: string): Promise<string> {
    const { privateKey } = await keyPairPromise;
    return new SignJWT({ did, eth_address: '0xaabb', grid_name: 'genesis' })
        .setProtectedHeader({ alg: 'ES256' }).setIssuedAt().setExpirationTime('1h').sign(privateKey);
}

function registryWith(visibility: 'public' | 'private'): GridRegistry {
    const r = new GridRegistry();
    r.register({
        gridId: 'genesis', name: 'Genesis', gridDomain: 'genesis.noesis',
        polisName: 'Genesis Polis', description: 'The first Grid.', status: 'active',
        environment: EARTH_ORBIT, visibility,
    });
    return r;
}

/** Civic registry stub: only MEMBER_DID holds an active Civic-DID, and only in the
 *  Grid named 'Genesis' — the registry is keyed by Grid NAME, not the lowercase id. */
const civicDidStore = {
    async getByExistenceDid(grid: string, did: string) {
        return grid === 'Genesis' && did === MEMBER_DID ? { civicDid: 'did:noesis:civic-1', status: 'active' } : null;
    },
    async countActiveHumans(grid: string) {
        return grid === 'Genesis' ? 7 : 0;
    },
};

function makeVisApp(visibility: 'public' | 'private'): FastifyInstance {
    return buildServer({
        clock: new WorldClock({ tickRateMs: 100_000 }),
        space: new SpatialMap(),
        logos: new LogosEngine(),
        audit: new AuditChain(),
        gridName: 'genesis',
        gridRegistry: registryWith(visibility) as never,
        civicDidStore: civicDidStore as never,
    });
}

describe('gridRecordFromConfig visibility (D-V3-41)', () => {
    it('defaults to public', () => {
        expect(gridRecordFromConfig(GENESIS_CONFIG).visibility).toBe('public');
    });
    it('carries a private setting from the Grid config', () => {
        expect(gridRecordFromConfig({ ...GENESIS_CONFIG, visibility: 'private' }).visibility).toBe('private');
    });
});

describe('GET /api/v1/portal/grids — visibility + membership (D-V3-41)', () => {
    it('public Grid: anonymous sees full detail, not locked, not a member', async () => {
        const app = makeVisApp('public');
        const g = (await app.inject({ method: 'GET', url: '/api/v1/portal/grids' })).json().grids[0];
        expect(g).toMatchObject({ visibility: 'public', locked: false, member: false, description: 'The first Grid.' });
        expect(g.environment).toBeDefined();
        expect(g.human_members).toBe(7);
        await app.close();
    });

    it('private Grid: anonymous sees it listed with name + lock only', async () => {
        const app = makeVisApp('private');
        const body = (await app.inject({ method: 'GET', url: '/api/v1/portal/grids' })).json();
        expect(body.count).toBe(1);
        const g = body.grids[0];
        expect(g).toMatchObject({ grid_id: 'genesis', name: 'Genesis', visibility: 'private', locked: true, member: false });
        expect(g.description).toBeUndefined();
        expect(g.grid_domain).toBeUndefined();
        expect(g.environment).toBeUndefined();
        expect(g.polis).toBeUndefined();
        expect(g.human_members).toBeUndefined();
        await app.close();
    });

    it('private Grid: a signed-in non-member is still locked out', async () => {
        const app = makeVisApp('private');
        const res = await app.inject({ method: 'GET', url: '/api/v1/portal/grids', cookies: { [COOKIE_NAME]: await portalCookie(OUTSIDER_DID) } });
        expect(res.json().grids[0]).toMatchObject({ locked: true, member: false });
        expect(res.json().grids[0].description).toBeUndefined();
        await app.close();
    });

    it('private Grid: a member (active Civic-DID) sees full detail', async () => {
        const app = makeVisApp('private');
        const res = await app.inject({ method: 'GET', url: '/api/v1/portal/grids', cookies: { [COOKIE_NAME]: await portalCookie(MEMBER_DID) } });
        const g = res.json().grids[0];
        expect(g).toMatchObject({ visibility: 'private', locked: false, member: true, description: 'The first Grid.', polis: 'Genesis Polis' });
        expect(g.environment).toBeDefined();
        await app.close();
    });

    it('a forged session cookie is treated as anonymous', async () => {
        const app = makeVisApp('private');
        const res = await app.inject({ method: 'GET', url: '/api/v1/portal/grids', cookies: { [COOKIE_NAME]: 'not-a-jwt' } });
        expect(res.statusCode).toBe(200);
        expect(res.json().grids[0]).toMatchObject({ locked: true, member: false });
        await app.close();
    });
});
