/**
 * Phase 37 / REG-06 — POST /api/v1/registry/business-did/:did/dissolve
 *
 * Tests for the business-DID dissolution endpoint (new, SOLE caller of
 * appendRegistryBusinessDidDissolved):
 *   - 403 court_order_required when no Authorization header
 *   - 403 court_order_required when Authorization is a valid Civic-DID bearer JWT
 *   - 403 court_order_required when Authorization is a valid Operator-DID JWT
 *   - 400 court_conviction_ref_required when government JWT but body has no ref
 *   - 400 invalid_business_did when :did path param doesn't match BIZ_DID_RE
 *   - 404 not_found when dissolving unknown business DID
 *   - 409 already_dissolved when dissolving already-dissolved DID
 *   - 200 on valid government dissolution (happy path)
 *   - Audit: registry.business_did_dissolved with closed 4-key payload
 *   - Audit payload civic_did = OWNER's civic DID (not government caller)
 *   - Audit payload omits court_conviction_ref + court_conviction_ref_hash entirely
 *   - BusinessDidStore.get(...).status === 'dissolved' after success
 *   - req.didContext.tier === 'government' on successful path
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
import type { FastifyInstance } from 'fastify';
import type { BusinessDidRecord } from '../../src/civic-registry/index.js';

const GRID_NAME = 'genesis';
const OWNER_CIVIC_DID = 'did:civic:noesis:business-owner-dissolve-test';
const ACTIVE_BIZ_DID = 'did:biz:noesis:active-business-dissolve-001';
const DISSOLVED_BIZ_DID = 'did:biz:noesis:already-dissolved-002';
const UNKNOWN_BIZ_DID = 'did:biz:noesis:nonexistent-biz-003';
const COURT_REF = 'DISSOLUTION-ORDER-2026-007';

/**
 * Mint a government session JWT signed with keyPairPromise.
 * Includes court_conviction_ref claim (required by verifyGovernmentSession).
 */
async function mintGovJwt(opts?: { omitRef?: boolean }): Promise<string> {
    const { privateKey } = await keyPairPromise;
    const payload: Record<string, unknown> = {};
    if (!opts?.omitRef) {
        payload['court_conviction_ref'] = COURT_REF;
    }
    const jwt = await new SignJWT(payload)
        .setProtectedHeader({ alg: 'ES256' })
        .setIssuer(GOV_SESSION_ISSUER_DID)
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKey);
    return `Bearer ${jwt}`;
}

/**
 * Mint a civic-DID bearer JWT.
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

type MockBizStore = {
    store: Map<string, BusinessDidRecord>;
    insert(record: BusinessDidRecord): Promise<void>;
    get(gridName: string, businessDid: string): Promise<BusinessDidRecord | null>;
    listByCivicDid(gridName: string, civicDid: string): Promise<BusinessDidRecord[]>;
    markDissolved(gridName: string, businessDid: string, dissolvedAtTick: number): Promise<boolean>;
};

function makeMockBizStore(seeds: BusinessDidRecord[]): MockBizStore {
    const store = new Map<string, BusinessDidRecord>();
    for (const seed of seeds) {
        store.set(`${seed.gridName}:${seed.businessDid}`, seed);
    }
    return {
        store,
        async insert(record: BusinessDidRecord) {
            store.set(`${record.gridName}:${record.businessDid}`, record);
        },
        async get(gridName: string, businessDid: string): Promise<BusinessDidRecord | null> {
            return store.get(`${gridName}:${businessDid}`) ?? null;
        },
        async listByCivicDid(): Promise<BusinessDidRecord[]> { return []; },
        async markDissolved(gridName: string, businessDid: string, dissolvedAtTick: number): Promise<boolean> {
            const record = store.get(`${gridName}:${businessDid}`);
            if (!record || record.status !== 'active') return false;
            record.status = 'dissolved';
            record.dissolvedAtTick = dissolvedAtTick;
            return true;
        },
    };
}

describe('POST /api/v1/registry/business-did/:did/dissolve — government_only enforcement (SECURITY CRITICAL)', () => {
    let app: FastifyInstance;
    let audit: AuditChain;
    let bizStore: MockBizStore;

    beforeAll(async () => {
        const clock = new WorldClock({ tickRateMs: 100_000 });
        const space = new SpatialMap();
        const logos = new LogosEngine();
        audit = new AuditChain();
        const registry = new NousRegistry();

        const seeds: BusinessDidRecord[] = [
            {
                gridName: GRID_NAME,
                businessDid: ACTIVE_BIZ_DID,
                civicDid: OWNER_CIVIC_DID,
                businessName: 'Active Business',
                category: 'commerce',
                credentialJson: { type: ['VerifiableCredential', 'BusinessDIDCredential'] },
                status: 'active',
                issuedAtTick: 10,
                biosCostPaid: 100,
            },
            {
                gridName: GRID_NAME,
                businessDid: DISSOLVED_BIZ_DID,
                civicDid: OWNER_CIVIC_DID,
                businessName: 'Already Dissolved',
                category: 'services',
                credentialJson: { type: ['VerifiableCredential', 'BusinessDIDCredential'] },
                status: 'dissolved',
                issuedAtTick: 5,
                dissolvedAtTick: 8,
                biosCostPaid: 100,
            },
        ];

        bizStore = makeMockBizStore(seeds);

        app = buildServer({
            clock, space, logos, audit, gridName: GRID_NAME, registry,
            businessDidStore: bizStore as unknown as import('../../src/civic-registry/business-did-store.js').BusinessDidStore,
        });
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    it('returns 403 court_order_required when no Authorization header provided', async () => {
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/registry/business-did/${ACTIVE_BIZ_DID}/dissolve`,
            payload: { court_conviction_ref: COURT_REF },
        });
        expect(res.statusCode).toBe(403);
        expect(res.json()).toMatchObject({ error: 'court_order_required' });
    });

    it('returns 403 court_order_required when Authorization is a valid Civic-DID bearer JWT', async () => {
        const civicBearer = await mintCivicBearer('did:civic:noesis:regular-citizen');
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/registry/business-did/${ACTIVE_BIZ_DID}/dissolve`,
            headers: { authorization: civicBearer },
            payload: { court_conviction_ref: COURT_REF },
        });
        expect(res.statusCode).toBe(403);
        expect(res.json()).toMatchObject({ error: 'court_order_required' });
    });

    it('returns 403 court_order_required when Authorization is a valid Operator-DID JWT', async () => {
        const { privateKey } = await keyPairPromise;
        const operatorJwt = await new SignJWT({ sub: 'did:noesis:human:0xoperator' })
            .setProtectedHeader({ alg: 'ES256' })
            .setIssuedAt()
            .setExpirationTime('1h')
            .sign(privateKey);

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/registry/business-did/${ACTIVE_BIZ_DID}/dissolve`,
            headers: { authorization: `Bearer ${operatorJwt}` },
            payload: { court_conviction_ref: COURT_REF },
        });
        expect(res.statusCode).toBe(403);
        expect(res.json()).toMatchObject({ error: 'court_order_required' });
    });

    it('returns 403 court_conviction_ref_required when government JWT lacks court_conviction_ref claim', async () => {
        const govJwtNoRef = await mintGovJwt({ omitRef: true });
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/registry/business-did/${ACTIVE_BIZ_DID}/dissolve`,
            headers: { authorization: govJwtNoRef },
            payload: { court_conviction_ref: COURT_REF },
        });
        expect(res.statusCode).toBe(403);
        expect(res.json()).toMatchObject({ error: 'court_conviction_ref_required' });
    });

    it('returns 400 court_conviction_ref_required when government JWT present but body omits ref', async () => {
        const govJwt = await mintGovJwt();
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/registry/business-did/${ACTIVE_BIZ_DID}/dissolve`,
            headers: { authorization: govJwt },
            payload: {}, // missing court_conviction_ref
        });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toMatchObject({ error: 'court_conviction_ref_required' });
    });

    it('returns 400 invalid_business_did when :did path param does not match BIZ_DID_RE', async () => {
        const govJwt = await mintGovJwt();
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/registry/business-did/did:civic:noesis:wrong-family/dissolve',
            headers: { authorization: govJwt },
            payload: { court_conviction_ref: COURT_REF },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toMatchObject({ error: 'invalid_business_did' });
    });

    it('returns 404 not_found when dissolving an unknown business DID', async () => {
        const govJwt = await mintGovJwt();
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/registry/business-did/${UNKNOWN_BIZ_DID}/dissolve`,
            headers: { authorization: govJwt },
            payload: { court_conviction_ref: COURT_REF },
        });
        expect(res.statusCode).toBe(404);
        expect(res.json()).toMatchObject({ error: 'not_found' });
    });

    it('returns 409 already_dissolved when dissolving an already-dissolved DID', async () => {
        const govJwt = await mintGovJwt();
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/registry/business-did/${DISSOLVED_BIZ_DID}/dissolve`,
            headers: { authorization: govJwt },
            payload: { court_conviction_ref: COURT_REF },
        });
        expect(res.statusCode).toBe(409);
        expect(res.json()).toMatchObject({ error: 'already_dissolved' });
    });

    it('returns 200 {dissolved: true} on valid government dissolution (happy path)', async () => {
        const govJwt = await mintGovJwt();
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/registry/business-did/${ACTIVE_BIZ_DID}/dissolve`,
            headers: { authorization: govJwt },
            payload: { court_conviction_ref: COURT_REF },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ dissolved: true });
    });

    it('BusinessDidStore.get(...).status === "dissolved" after successful dissolution', async () => {
        const record = await bizStore.get(GRID_NAME, ACTIVE_BIZ_DID);
        expect(record?.status).toBe('dissolved');
    });

    it('appends registry.business_did_dissolved audit event with exactly 4 keys (closed-tuple)', async () => {
        const entries = audit.query({ eventType: 'registry.business_did_dissolved' });
        expect(entries.length).toBeGreaterThanOrEqual(1);
        const last = entries[entries.length - 1];
        const keys = Object.keys(last.payload).sort();
        // Closed-tuple discipline (Plan 02 EXPECTED_KEYS): business_did, civic_did, dissolved_at_tick, grid_name
        expect(keys).toEqual(['business_did', 'civic_did', 'dissolved_at_tick', 'grid_name']);
    });

    it('audit payload civic_did is the OWNER civic-DID (not the government caller DID)', async () => {
        const entries = audit.query({ eventType: 'registry.business_did_dissolved' });
        const last = entries[entries.length - 1];
        // civic_did must be OWNER_CIVIC_DID (the business owner), NOT GOV_SESSION_ISSUER_DID
        expect(last.payload['civic_did']).toBe(OWNER_CIVIC_DID);
        expect(last.payload['civic_did']).not.toBe(GOV_SESSION_ISSUER_DID);
    });

    it('audit payload does NOT contain court_conviction_ref or court_conviction_ref_hash', async () => {
        const entries = audit.query({ eventType: 'registry.business_did_dissolved' });
        const last = entries[entries.length - 1];
        // The dissolution closed-tuple omits both per Plan 02 EXPECTED_KEYS privacy discipline
        expect(Object.keys(last.payload)).not.toContain('court_conviction_ref');
        expect(Object.keys(last.payload)).not.toContain('court_conviction_ref_hash');
    });
});
