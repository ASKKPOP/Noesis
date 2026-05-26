/**
 * Phase 37 / REG-02 + REG-05 — GET /api/v1/registry/civic-did/:did
 *                             — GET /api/v1/registry/business-did/:did
 *
 * Tests for public lookup endpoints:
 *   - 200 + Cache-Control: max-age=60 for civic lookup
 *   - 200 + Cache-Control: max-age=60 for business lookup
 *   - 404 on not_found (civic)
 *   - 404 on not_found (business)
 *   - 503 when store absent
 *   - Public (no auth) — accepts calls with empty Authorization + Cookie
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { NousRegistry } from '../../src/registry/registry.js';
import type { FastifyInstance } from 'fastify';
import type { CivicDidRecord, BusinessDidRecord } from '../../src/civic-registry/index.js';

const GRID_NAME = 'genesis';
const KNOWN_CIVIC_DID = 'did:civic:noesis:lookup-test-123';
const KNOWN_BIZ_DID = 'did:biz:noesis:biz-lookup-test-456';
const KNOWN_CIVIC_DID_OWNER = 'did:civic:noesis:biz-owner-789';
const UNKNOWN_CIVIC_DID = 'did:civic:noesis:nonexistent-abc';
const UNKNOWN_BIZ_DID = 'did:biz:noesis:nonexistent-biz';

function makeMockCivicStore(seed?: CivicDidRecord) {
    const store = new Map<string, CivicDidRecord>();
    if (seed) {
        store.set(`${seed.gridName}:${seed.civicDid}`, seed);
    }
    return {
        async insert(record: CivicDidRecord) {
            store.set(`${record.gridName}:${record.civicDid}`, record);
        },
        async get(gridName: string, civicDid: string): Promise<CivicDidRecord | null> {
            return store.get(`${gridName}:${civicDid}`) ?? null;
        },
        async getByExistenceDid(_gridName: string, _existenceDid: string): Promise<CivicDidRecord | null> {
            return null;
        },
        async markRevoked(gridName: string, civicDid: string, revokedAtTick: number, courtConvictionRef: string): Promise<boolean> {
            const record = store.get(`${gridName}:${civicDid}`);
            if (!record || record.status !== 'active') return false;
            record.status = 'revoked';
            record.revokedAtTick = revokedAtTick;
            record.courtConvictionRef = courtConvictionRef;
            return true;
        },
    };
}

function makeMockBizStore(seed?: BusinessDidRecord) {
    const store = new Map<string, BusinessDidRecord>();
    if (seed) {
        store.set(`${seed.gridName}:${seed.businessDid}`, seed);
    }
    return {
        async insert(record: BusinessDidRecord) {
            store.set(`${record.gridName}:${record.businessDid}`, record);
        },
        async get(gridName: string, businessDid: string): Promise<BusinessDidRecord | null> {
            return store.get(`${gridName}:${businessDid}`) ?? null;
        },
        async listByCivicDid(_gridName: string, _civicDid: string): Promise<BusinessDidRecord[]> {
            return [];
        },
        async markDissolved(gridName: string, businessDid: string, dissolvedAtTick: number): Promise<boolean> {
            const record = store.get(`${gridName}:${businessDid}`);
            if (!record || record.status !== 'active') return false;
            record.status = 'dissolved';
            record.dissolvedAtTick = dissolvedAtTick;
            return true;
        },
    };
}

const CIVIC_SEED: CivicDidRecord = {
    gridName: GRID_NAME,
    civicDid: KNOWN_CIVIC_DID,
    existenceDid: 'did:noesis:nous:seed-existence',
    credentialJson: { type: ['VerifiableCredential', 'CivicDIDCredential'], id: 'urn:test:vc:civic1' },
    status: 'active',
    issuedAtTick: 42,
};

const BIZ_SEED: BusinessDidRecord = {
    gridName: GRID_NAME,
    businessDid: KNOWN_BIZ_DID,
    civicDid: KNOWN_CIVIC_DID_OWNER,
    businessName: 'Test Co',
    category: 'commerce',
    credentialJson: { type: ['VerifiableCredential', 'BusinessDIDCredential'], id: 'urn:test:vc:biz1' },
    status: 'active',
    issuedAtTick: 100,
    biosCostPaid: 100,
};

describe('GET /api/v1/registry/civic-did/:did — lookup', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        const clock = new WorldClock({ tickRateMs: 100_000 });
        const space = new SpatialMap();
        const logos = new LogosEngine();
        const audit = new AuditChain();
        const registry = new NousRegistry();

        app = buildServer({
            clock, space, logos, audit, gridName: GRID_NAME, registry,
            civicDidStore: makeMockCivicStore(CIVIC_SEED) as unknown as import('../../src/civic-registry/civic-did-store.js').CivicDidStore,
            businessDidStore: makeMockBizStore(BIZ_SEED) as unknown as import('../../src/civic-registry/business-did-store.js').BusinessDidStore,
        });
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    it('returns 200 with status, credential, revoked_at_tick for known civic DID', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/registry/civic-did/${KNOWN_CIVIC_DID}`,
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as { status: string; credential: object; revoked_at_tick: null };
        expect(body.status).toBe('active');
        expect(body.credential).toBeTruthy();
        expect(body.revoked_at_tick).toBeNull();
    });

    it('includes Cache-Control: max-age=60 header on civic lookup', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/registry/civic-did/${KNOWN_CIVIC_DID}`,
        });
        expect(res.statusCode).toBe(200);
        expect(res.headers['cache-control']).toBe('max-age=60');
    });

    it('returns 404 not_found for unknown civic DID', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/registry/civic-did/${UNKNOWN_CIVIC_DID}`,
        });
        expect(res.statusCode).toBe(404);
        expect(res.json()).toMatchObject({ error: 'not_found' });
    });

    it('accepts call with NO auth headers (visitor-public)', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/registry/civic-did/${KNOWN_CIVIC_DID}`,
            headers: {}, // no Authorization, no Cookie
        });
        expect(res.statusCode).toBe(200);
    });
});

describe('GET /api/v1/registry/business-did/:did — lookup', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        const clock = new WorldClock({ tickRateMs: 100_000 });
        const space = new SpatialMap();
        const logos = new LogosEngine();
        const audit = new AuditChain();
        const registry = new NousRegistry();

        app = buildServer({
            clock, space, logos, audit, gridName: GRID_NAME, registry,
            civicDidStore: makeMockCivicStore(CIVIC_SEED) as unknown as import('../../src/civic-registry/civic-did-store.js').CivicDidStore,
            businessDidStore: makeMockBizStore(BIZ_SEED) as unknown as import('../../src/civic-registry/business-did-store.js').BusinessDidStore,
        });
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    it('returns 200 with status, credential, dissolved_at_tick for known business DID', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/registry/business-did/${KNOWN_BIZ_DID}`,
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as { status: string; credential: object; dissolved_at_tick: null };
        expect(body.status).toBe('active');
        expect(body.credential).toBeTruthy();
        expect(body.dissolved_at_tick).toBeNull();
    });

    it('includes Cache-Control: max-age=60 header on business lookup', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/registry/business-did/${KNOWN_BIZ_DID}`,
        });
        expect(res.statusCode).toBe(200);
        expect(res.headers['cache-control']).toBe('max-age=60');
    });

    it('returns 404 not_found for unknown business DID', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/registry/business-did/${UNKNOWN_BIZ_DID}`,
        });
        expect(res.statusCode).toBe(404);
        expect(res.json()).toMatchObject({ error: 'not_found' });
    });

    it('accepts call with NO auth headers (visitor-public)', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/registry/business-did/${KNOWN_BIZ_DID}`,
            headers: {},
        });
        expect(res.statusCode).toBe(200);
    });
});

describe('Lookup routes — 503 when stores absent', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        const clock = new WorldClock({ tickRateMs: 100_000 });
        const space = new SpatialMap();
        const logos = new LogosEngine();
        const audit = new AuditChain();
        const registry = new NousRegistry();

        app = buildServer({
            clock, space, logos, audit, gridName: GRID_NAME, registry,
            // No stores wired
        });
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    it('returns 503 on GET civic-did when civicDidStore absent', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/registry/civic-did/did:civic:noesis:test',
        });
        expect(res.statusCode).toBe(503);
        expect(res.json()).toMatchObject({ error: 'civic_registry_unavailable' });
    });

    it('returns 503 on GET business-did when businessDidStore absent', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/registry/business-did/did:biz:noesis:test',
        });
        expect(res.statusCode).toBe(503);
        expect(res.json()).toMatchObject({ error: 'business_registry_unavailable' });
    });
});
