/**
 * D-V3-41 — the private-Grid gate. A private Grid's public READS are for members
 * only; the Portal layer (sign-in, the Grid list, a person's own account) and health
 * stay open so a non-member can still see the lock and apply.
 */
import { describe, it, expect, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { SignJWT } from 'jose';
import { buildServer } from '../../src/api/server.js';
import { GridRegistry, type GridVisibility } from '../../src/registry/grid-registry.js';
import { EARTH_ORBIT } from '../../src/registry/grid-environments.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { COOKIE_NAME, keyPairPromise } from '../../src/api/portal/auth.js';
import { isPrivateGateExempt } from '../../src/api/preHandlers/privateGridGate.js';

const MEMBER = 'did:noesis:member-human';
const OUTSIDER = 'did:noesis:outsider-human';
const OPERATOR = 'did:noesis:operator-human';

async function cookie(did: string): Promise<Record<string, string>> {
    const { privateKey } = await keyPairPromise;
    const jwt = await new SignJWT({ did, eth_address: '0xaabb', grid_name: 'Genesis' })
        .setProtectedHeader({ alg: 'ES256' }).setIssuedAt().setExpirationTime('1h').sign(privateKey);
    return { [COOKIE_NAME]: jwt };
}

let app: FastifyInstance | undefined;
afterEach(async () => { await app?.close(); app = undefined; });

function make(visibility: GridVisibility, opts: { civicThrows?: boolean } = {}): FastifyInstance {
    const registry = new GridRegistry();
    registry.register({
        gridId: 'genesis', name: 'Genesis', gridDomain: 'genesis.noesis', polisName: 'Genesis Polis',
        description: 'The first Grid.', status: 'active', environment: EARTH_ORBIT, visibility,
    });
    app = buildServer({
        clock: new WorldClock({ tickRateMs: 100_000 }),
        space: new SpatialMap(),
        logos: new LogosEngine(),
        audit: new AuditChain(),
        gridName: 'Genesis',
        gridRegistry: registry as never,
        civicDidStore: {
            async getByExistenceDid(grid: string, did: string) {
                if (opts.civicThrows) throw new Error('db down');
                return grid === 'Genesis' && did === MEMBER ? { civicDid: 'did:noesis:civic-1', status: 'active' } : null;
            },
        } as never,
        operatorAllowlist: new Map([[OPERATOR, { tier: 5, operatorId: 'op-1' }]]) as never,
    });
    return app;
}

const READ = '/api/v1/grid/status';

describe('private-Grid gate (D-V3-41)', () => {
    it('a public Grid stays open to anonymous reads', async () => {
        const res = await make('public').inject({ method: 'GET', url: READ });
        expect(res.statusCode).toBe(200);
    });

    it('a private Grid refuses an anonymous read', async () => {
        const res = await make('private').inject({ method: 'GET', url: READ });
        expect(res.statusCode).toBe(403);
        expect(res.json()).toEqual({ error: 'private_grid_members_only' });
    });

    it('a private Grid refuses a signed-in non-member', async () => {
        const res = await make('private').inject({ method: 'GET', url: READ, cookies: await cookie(OUTSIDER) });
        expect(res.statusCode).toBe(403);
    });

    it('a private Grid admits a member (active Civic-DID)', async () => {
        const res = await make('private').inject({ method: 'GET', url: READ, cookies: await cookie(MEMBER) });
        expect(res.statusCode).toBe(200);
    });

    it('a private Grid admits an allowlisted operator', async () => {
        const res = await make('private').inject({ method: 'GET', url: READ, cookies: await cookie(OPERATOR) });
        expect(res.statusCode).toBe(200);
    });

    it('fails closed when the membership lookup errors', async () => {
        const res = await make('private', { civicThrows: true }).inject({ method: 'GET', url: READ, cookies: await cookie(MEMBER) });
        expect(res.statusCode).toBe(403);
    });

    it('keeps health, sign-in and the Grid list open on a private Grid', async () => {
        const a = make('private');
        expect((await a.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
        expect((await a.inject({ method: 'GET', url: '/api/v1/portal/grids' })).statusCode).toBe(200);
        // not signed in → the route's own 401, never the gate's 403
        expect((await a.inject({ method: 'GET', url: '/api/v1/portal/auth/me' })).statusCode).toBe(401);
    });

    it('gates the map feeds the orbital view reads', async () => {
        const a = make('private');
        expect((await a.inject({ method: 'GET', url: '/api/v1/civic/parcels' })).statusCode).toBe(403);
        expect((await a.inject({ method: 'GET', url: '/api/v1/orbital/objects' })).statusCode).toBe(403);
    });
});

describe('isPrivateGateExempt', () => {
    it('exempts the Portal layer a non-member needs, and nothing Grid-internal', () => {
        for (const p of ['/health', '/health/detailed', '/api/v1/portal/grids', '/api/v1/portal/auth/me', '/api/v1/portal/auth/nonce', '/api/v1/portal/me/overview', '/api/v1/portal/civic/application', '/api/v1/portal/human/me/nous']) {
            expect(isPrivateGateExempt(p), p).toBe(true);
        }
        for (const p of ['/api/v1/grid/status', '/api/v1/civic/parcels', '/api/v1/portal/discover', '/api/v1/portal/community/x', '/api/v1/audit/trail', '/ws', '/api/v1/portal/gridsX']) {
            expect(isPrivateGateExempt(p), p).toBe(false);
        }
    });
});
