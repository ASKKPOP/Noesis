/**
 * Track B — QA-guide contract suite.
 *
 * The executable form of the Track B checklist at https://noesiis.com/qa (the 8 civic
 * institutions). One describe per B-01..B-10, asserting the black-box contract a tester
 * hits at api.noesiis.com / localhost:8080. Built via buildServer(...) so the REAL
 * did-policy onRequest hook, routing, and Cache-Control run — not the isolated per-route
 * harness. Stores/pool are mocked so the suite is hermetic (no MySQL).
 *
 * Where the published guide is stale, this suite follows the Grid decision log and says so:
 *   - B-08: offline peers return HTTP 404 {error:'peer_offline'} per D-42-02 — NOT
 *     200 {status:'offline'} as the guide's expected-result column claims. The code is
 *     correct; the guide is the thing to fix.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { NousRegistry } from '../../src/registry/registry.js';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'mysql2/promise';
import type { CivicDidRecord } from '../../src/civic-registry/index.js';

const GRID = 'genesis';
const REAL_CIVIC_DID = 'did:civic:noesis:track-b-known-001';
const FAKE_CIVIC_DID = 'did:civic:noesis:00000000-0000-0000-0000-000000000000';

/** Map-backed civic-DID store mock (same shape as registry-lookup.test.ts). */
function makeCivicStore(seed: CivicDidRecord) {
    const m = new Map<string, CivicDidRecord>();
    m.set(`${seed.gridName}:${seed.civicDid}`, seed);
    return {
        async insert(r: CivicDidRecord) { m.set(`${r.gridName}:${r.civicDid}`, r); },
        async get(g: string, d: string) { return m.get(`${g}:${d}`) ?? null; },
        async getByExistenceDid() { return null; },
        async markRevoked() { return false; },
    };
}

const SEED: CivicDidRecord = {
    gridName: GRID,
    civicDid: REAL_CIVIC_DID,
    existenceDid: 'did:noesis:nous:track-b-existence',
    credentialJson: { type: ['VerifiableCredential', 'CivicDIDCredential'], id: 'urn:test:vc:trackb' },
    status: 'active',
    issuedAtTick: 1,
};

describe('Track B — the 8 civic institutions (QA-guide contract)', () => {
    let app: FastifyInstance;
    const get = (url: string) => app.inject({ method: 'GET', url });

    beforeAll(async () => {
        const clock = new WorldClock({ tickRateMs: 100_000 });
        const space = new SpatialMap();
        const logos = new LogosEngine();
        const audit = new AuditChain();
        const registry = new NousRegistry();

        // Empty mock pool → every DB-backed list endpoint returns its empty-but-200 shape.
        const pool = { query: vi.fn(async () => [[], {}]) } as unknown as Pool;

        // B-09 presence snapshot: one awake Nous.
        const presenceService = {
            async listAllPresence() {
                return [{ civicDid: REAL_CIVIC_DID, presenceStatus: 'awake', lastSeenAt: null }];
            },
        } as unknown as import('../../src/civic-presence/presence-service.js').PresenceService;

        // B-08 peer store: the seeded civic-DID is registered but OFFLINE → route must 404 (D-42-02).
        const p2pService = {
            peerStore: { getStatus: () => ({ status: 'offline' as const }) },
        } as unknown as import('../../src/p2p/types.js').P2PService;

        app = buildServer({
            clock, space, logos, audit, gridName: GRID, registry,
            currentTick: () => 1,
            civicDidStore: makeCivicStore(SEED) as unknown as import('../../src/civic-registry/civic-did-store.js').CivicDidStore,
            pool,
            presenceService,
            p2pService,
        });
        await app.ready();
    });

    afterAll(async () => { await app.close(); });

    // ── B-01 · DID Registry ──────────────────────────────────────────────────
    describe('B-01 · DID Registry — GET /api/v1/registry/civic-did/:did', () => {
        it('200 + active + credential for a real Civic-DID', async () => {
            const res = await get(`/api/v1/registry/civic-did/${REAL_CIVIC_DID}`);
            expect(res.statusCode).toBe(200);
            const b = res.json();
            expect(b.status).toBe('active');
            expect(b.credential).toBeTruthy();
        });
        it('404 not_found for a well-formed but unknown Civic-DID', async () => {
            const res = await get(`/api/v1/registry/civic-did/${FAKE_CIVIC_DID}`);
            expect(res.statusCode).toBe(404);
            expect(res.json()).toMatchObject({ error: 'not_found' });
        });
        it('404 not_found for a malformed DID (no crash)', async () => {
            const res = await get('/api/v1/registry/civic-did/garbage-not-a-did');
            expect(res.statusCode).toBe(404);
        });
    });

    // ── B-02 · Polis (law) ───────────────────────────────────────────────────
    describe('B-02 · Polis — GET /api/v1/polis/bills', () => {
        it('200 with a bills array (public, may be empty)', async () => {
            const res = await get('/api/v1/polis/bills');
            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.json().bills)).toBe(true);
        });
    });

    // ── B-03 · Police (enforce) ──────────────────────────────────────────────
    describe('B-03 · Police — GET /api/v1/police/complaints', () => {
        it('401 did_required without auth — the civic-DID gate holds (with a reason code, not an empty body)', async () => {
            const res = await get('/api/v1/police/complaints');
            expect(res.statusCode).toBe(401);
            expect(res.json().error).toBe('did_required');
        });
    });

    // ── B-04 · IRS / Treasury ────────────────────────────────────────────────
    describe('B-04 · IRS/Treasury — GET /api/v1/irs/treasury', () => {
        it('200 with balance_wei + current_rate_percent (the fields the map mirrors)', async () => {
            const res = await get('/api/v1/irs/treasury');
            expect(res.statusCode).toBe(200);
            const b = res.json();
            expect(b).toHaveProperty('balance_wei');
            expect(b).toHaveProperty('current_rate_percent');
        });
    });

    // ── B-05 · Marketplace ───────────────────────────────────────────────────
    describe('B-05 · Marketplace — GET /api/v1/market/listings', () => {
        it('200 with a listings array', async () => {
            const res = await get('/api/v1/market/listings');
            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.json().listings)).toBe(true);
        });
    });

    // ── B-06 · Library ───────────────────────────────────────────────────────
    describe('B-06 · Library — GET /api/v1/library/entries', () => {
        it('200 with entries array + count', async () => {
            const res = await get('/api/v1/library/entries');
            expect(res.statusCode).toBe(200);
            const b = res.json();
            expect(Array.isArray(b.entries)).toBe(true);
            expect(b).toHaveProperty('count');
        });
        it('clamps hostile pagination (limit=99999 → ≤100, page=-1 → ≥0) without crashing', async () => {
            const res = await get('/api/v1/library/entries?page=-1&limit=99999');
            expect(res.statusCode).toBe(200);
            const b = res.json();
            expect(b.limit).toBeLessThanOrEqual(100);
            expect(b.page).toBeGreaterThanOrEqual(0);
        });
        it('falls back to a default limit on non-numeric input (no crash)', async () => {
            const res = await get('/api/v1/library/entries?limit=abc');
            expect(res.statusCode).toBe(200);
            expect(typeof res.json().limit).toBe('number');
        });
    });

    // ── B-07 · Communities ───────────────────────────────────────────────────
    describe('B-07 · Communities — GET /api/v1/community/:id + write gates', () => {
        it('404 unknown_community for an unknown community id', async () => {
            const res = await get('/api/v1/community/00000000-0000-0000-0000-000000000000');
            expect(res.statusCode).toBe(404);
            expect(res.json()).toMatchObject({ error: 'unknown_community' });
        });
        it('401 on the found write-path without a Civic-DID (deny-by-default)', async () => {
            const res = await app.inject({ method: 'POST', url: '/api/v1/community/found', payload: {} });
            expect(res.statusCode).toBe(401);
        });
    });

    // ── B-08 · P2P Infra (D-42-02) ───────────────────────────────────────────
    describe('B-08 · P2P — GET /api/v1/p2p/peers/:civicDid', () => {
        it('404 peer_offline for a registered-but-offline peer — NOT 200 {status:offline} (D-42-02)', async () => {
            const res = await get(`/api/v1/p2p/peers/${REAL_CIVIC_DID}`);
            expect(res.statusCode).toBe(404);
            expect(res.json()).toMatchObject({ error: 'peer_offline' });
        });
        it('400 invalid_civic_did for a malformed DID', async () => {
            const res = await get('/api/v1/p2p/peers/garbage');
            expect(res.statusCode).toBe(400);
            expect(res.json()).toMatchObject({ error: 'invalid_civic_did' });
        });
    });

    // ── B-09 · Grid presence ─────────────────────────────────────────────────
    describe('B-09 · Grid presence — GET /api/v1/civic/presence', () => {
        it('200 with a nous presence snapshot', async () => {
            const res = await get('/api/v1/civic/presence');
            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.json().nous)).toBe(true);
        });
    });

    // ── B-10 · System Map cross-check ────────────────────────────────────────
    describe('B-10 · System Map — GET /api/v1/system/map', () => {
        it('200 and exposes all 8 institutions (the counts a tester cross-checks against each endpoint)', async () => {
            const res = await get('/api/v1/system/map');
            expect(res.statusCode).toBe(200);
            const inst = res.json().institutions;
            for (const k of ['registry', 'polis', 'police', 'irs', 'marketplace', 'library', 'communities', 'p2p']) {
                expect(inst).toHaveProperty(k);
            }
        });
    });
});
