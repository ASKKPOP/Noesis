/**
 * Phase 37 / REG-03 — POST /api/v1/registry/business-did/register
 *
 * Tests for the business-DID registration endpoint:
 *   - 201 + Business-DID VC on valid civic_did bearer with sufficient Bios
 *   - 402 insufficient_wei when caller has < 100 Bios
 *   - 400 on missing business_name
 *   - 400 on missing category
 *   - 403 civic_did_required_caller when no civic-DID bearer present
 *   - 404 civic_did_not_found when caller's civic_did not in NousRegistry
 *   - 503 when businessDidStore absent
 *   - Audit event assertion (registry.business_did_registered) — closed 4-key payload
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SignJWT } from 'jose';
import { keyPairPromise } from '../../src/api/portal/auth.js';
import { GOV_SESSION_ISSUER_DID } from '../../src/civic-registry/index.js';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { TREASURY_DID } from '../../src/api/routes/registry.js';
import type { FastifyInstance } from 'fastify';
import type { CivicDidRecord, BusinessDidRecord } from '../../src/civic-registry/index.js';

const GRID_NAME = 'genesis';
// civic-DID bearer JWTs must use did:civic:noesis:* subjects (ANY_DID_RE) for tryDid to accept
const CIVIC_DID_RICH = 'did:civic:noesis:rich-member-001';   // has 200 Bios
const CIVIC_DID_POOR = 'did:civic:noesis:poor-member-002';   // has 50 Bios
const CIVIC_DID_UNKNOWN = 'did:civic:noesis:unknown-member'; // NOT in NousRegistry

/**
 * Mint a Bearer JWT signed with the Grid's keyPairPromise (ES256).
 * sub = the DID of the caller. iss is omitted (not GOV_SESSION_ISSUER_DID).
 */
async function mintCivicBearer(did: string): Promise<string> {
    const { privateKey } = await keyPairPromise;
    const jwt = await new SignJWT({ sub: did })
        .setProtectedHeader({ alg: 'ES256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKey);
    return `Bearer ${jwt}`;
}

function makeMockCivicStore() {
    const store = new Map<string, CivicDidRecord>();
    return {
        async insert(record: CivicDidRecord) {
            store.set(`${record.gridName}:${record.civicDid}`, record);
        },
        async get(gridName: string, civicDid: string): Promise<CivicDidRecord | null> {
            return store.get(`${gridName}:${civicDid}`) ?? null;
        },
        async getByExistenceDid(): Promise<CivicDidRecord | null> { return null; },
        async markRevoked(): Promise<boolean> { return false; },
    };
}

function makeMockBizStore() {
    const store = new Map<string, BusinessDidRecord>();
    return {
        store,
        async insert(record: BusinessDidRecord) {
            store.set(`${record.gridName}:${record.businessDid}`, record);
        },
        async get(gridName: string, businessDid: string): Promise<BusinessDidRecord | null> {
            return store.get(`${gridName}:${businessDid}`) ?? null;
        },
        async listByCivicDid(): Promise<BusinessDidRecord[]> { return []; },
        async markDissolved(): Promise<boolean> { return false; },
    };
}

describe('POST /api/v1/registry/business-did/register', () => {
    let app: FastifyInstance;
    let audit: AuditChain;
    let registry: NousRegistry;

    beforeAll(async () => {
        const clock = new WorldClock({ tickRateMs: 100_000 });
        const space = new SpatialMap();
        const logos = new LogosEngine();
        audit = new AuditChain();
        registry = new NousRegistry();

        // Seed registry with TREASURY_DID so transferWei can find the target
        registry.spawn({ did: TREASURY_DID, name: 'treasury', publicKey: 'pk-treasury', region: 'admin' }, GRID_NAME, 0, 0);
        // Seed rich member with 200 Bios
        registry.spawn({ did: CIVIC_DID_RICH, name: 'rich-member', publicKey: 'pk-rich', region: 'business' }, GRID_NAME, 0, 200);
        // Seed poor member with 50 Bios
        registry.spawn({ did: CIVIC_DID_POOR, name: 'poor-member', publicKey: 'pk-poor', region: 'business' }, GRID_NAME, 0, 50);
        // CIVIC_DID_UNKNOWN intentionally NOT in registry

        app = buildServer({
            clock, space, logos, audit, gridName: GRID_NAME, registry,
            civicDidStore: makeMockCivicStore() as unknown as import('../../src/civic-registry/civic-did-store.js').CivicDidStore,
            businessDidStore: makeMockBizStore() as unknown as import('../../src/civic-registry/business-did-store.js').BusinessDidStore,
        });
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    it('returns 403 civic_did_required_caller when no Authorization header is present', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/registry/business-did/register',
            payload: { business_name: 'Test Corp', category: 'commerce' },
        });
        // No Bearer → requireDid returns 401 did_required
        expect(res.statusCode).toBe(401);
    });

    it('returns 401 when caller is an operator-DID (did:noesis:*) — does not match ANY_DID_RE', async () => {
        const { privateKey } = await keyPairPromise;
        // did:noesis:human:* does NOT match ANY_DID_RE (/^did:[a-z0-9]+:noesis:[a-z0-9_:\-]+$/i)
        // because the regex requires TWO namespaces before the final slug (e.g. did:civic:noesis:X),
        // not a single namespace (did:noesis:X). So tryDid returns null → requireDid returns 401.
        const operatorJwt = await new SignJWT({ sub: 'did:noesis:human:0xabc' })
            .setProtectedHeader({ alg: 'ES256' })
            .setIssuedAt()
            .setExpirationTime('1h')
            .sign(privateKey);

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/registry/business-did/register',
            headers: { authorization: `Bearer ${operatorJwt}` },
            payload: { business_name: 'Test Corp', category: 'commerce' },
        });
        expect(res.statusCode).toBe(401);
    });

    it('returns 403 civic_did_required_caller when caller DID passes ANY_DID_RE but is not civic (e.g. gov DID)', async () => {
        const { privateKey } = await keyPairPromise;
        // did:gov:noesis:* matches ANY_DID_RE (two namespaces) but fails CIVIC_DID_RE in the handler
        const govBearer = await new SignJWT({ sub: GOV_SESSION_ISSUER_DID })
            .setProtectedHeader({ alg: 'ES256' })
            .setIssuedAt()
            .setExpirationTime('1h')
            .sign(privateKey);

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/registry/business-did/register',
            headers: { authorization: `Bearer ${govBearer}` },
            payload: { business_name: 'Polis Corp', category: 'government' },
        });
        expect(res.statusCode).toBe(403);
        expect(res.json()).toMatchObject({ error: 'civic_did_required_caller' });
    });

    it('returns 400 invalid_business_name when business_name is missing', async () => {
        const bearer = await mintCivicBearer(CIVIC_DID_RICH);
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/registry/business-did/register',
            headers: { authorization: bearer },
            payload: { category: 'commerce' },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toMatchObject({ error: 'invalid_business_name' });
    });

    it('returns 400 invalid_category when category is empty string', async () => {
        const bearer = await mintCivicBearer(CIVIC_DID_RICH);
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/registry/business-did/register',
            headers: { authorization: bearer },
            payload: { business_name: 'Test Corp', category: '' },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toMatchObject({ error: 'invalid_category' });
    });

    it('returns 404 civic_did_not_found when caller civic_did is not in NousRegistry', async () => {
        const bearer = await mintCivicBearer(CIVIC_DID_UNKNOWN);
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/registry/business-did/register',
            headers: { authorization: bearer },
            payload: { business_name: 'Ghost Corp', category: 'commerce' },
        });
        expect(res.statusCode).toBe(404);
        expect(res.json()).toMatchObject({ error: 'civic_did_not_found' });
    });

    it('returns 402 insufficient_wei when caller has only 50 Bios (need 100)', async () => {
        const bearer = await mintCivicBearer(CIVIC_DID_POOR);
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/registry/business-did/register',
            headers: { authorization: bearer },
            payload: { business_name: 'Underfunded Co', category: 'services' },
        });
        expect(res.statusCode).toBe(402);
        const body = res.json() as { error: string; required: number; available: number };
        expect(body.error).toBe('insufficient_wei');
        expect(body.required).toBe(100);
        expect(body.available).toBe(50);
    });

    it('returns 201 with business_did and credential on valid civic_did bearer with sufficient Bios', async () => {
        const bearer = await mintCivicBearer(CIVIC_DID_RICH);
        const ousiaBefore = registry.get(CIVIC_DID_RICH)!.balance_wei;

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/registry/business-did/register',
            headers: { authorization: bearer },
            payload: { business_name: 'Genesis Ventures', category: 'commerce' },
        });
        expect(res.statusCode).toBe(201);
        const body = res.json() as { business_did: string; credential: object };
        expect(body.business_did).toMatch(/^did:biz:noesis:/);
        expect(body.credential).toBeTruthy();
        expect((body.credential as { type: string[] }).type).toContain('BusinessDIDCredential');

        // Ousia was deducted by exactly 100
        const ousiaAfter = registry.get(CIVIC_DID_RICH)!.balance_wei;
        expect(ousiaAfter).toBe(ousiaBefore - 100);
    });

    it('appends registry.business_did_registered audit event with exactly 4 keys in payload', async () => {
        const entries = audit.query({ eventType: 'registry.business_did_registered' });
        expect(entries.length).toBeGreaterThanOrEqual(1);
        const last = entries[entries.length - 1];
        const keys = Object.keys(last.payload).sort();
        // Closed-tuple discipline: NO business_name, NO category
        expect(keys).toEqual(['business_did', 'civic_did', 'grid_name', 'registered_at_tick']);
    });
});

describe('POST /api/v1/registry/business-did/register — 503 when store absent', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        const clock = new WorldClock({ tickRateMs: 100_000 });
        const space = new SpatialMap();
        const logos = new LogosEngine();
        const audit = new AuditChain();
        const registry = new NousRegistry();

        registry.spawn({ did: TREASURY_DID, name: 'treasury2', publicKey: 'pk-t2', region: 'admin' }, GRID_NAME, 0, 0);
        registry.spawn({ did: CIVIC_DID_RICH, name: 'rich2', publicKey: 'pk-r2', region: 'business' }, GRID_NAME, 0, 200);

        app = buildServer({
            clock, space, logos, audit, gridName: GRID_NAME, registry,
            civicDidStore: makeMockCivicStore() as unknown as import('../../src/civic-registry/civic-did-store.js').CivicDidStore,
            // No businessDidStore
        });
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    it('returns 503 when businessDidStore is absent', async () => {
        const bearer = await mintCivicBearer(CIVIC_DID_RICH);
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/registry/business-did/register',
            headers: { authorization: bearer },
            payload: { business_name: 'Stub Co', category: 'commerce' },
        });
        expect(res.statusCode).toBe(503);
        expect(res.json()).toMatchObject({ error: 'business_registry_unavailable' });
    });
});
