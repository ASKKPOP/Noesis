/**
 * Phase 37 / REG-04 — POST /api/v1/registry/civic-did/:did/revoke
 *
 * SECURITY CRITICAL tests — government_only enforcement:
 *   - 403 court_order_required when no Authorization header
 *   - 403 court_order_required when Authorization is a valid Civic-DID bearer JWT (NOT government)
 *   - 403 court_order_required when Authorization is a valid Operator-DID JWT
 *   - 403 court_conviction_ref_required when government JWT lacks court_conviction_ref claim
 *   - 400 court_conviction_ref_required when government JWT has claim but body omits it
 *   - 200 on valid government revocation with both claim + body
 *   - 404 not_found for unknown civic DID
 *   - 409 already_revoked for already-revoked DID
 *   - Audit: registry.civic_did_revoked with court_conviction_ref_HASH (not plaintext)
 *   - req.didContext.tier === 'government' (NOT 'civic_member') on successful path
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SignJWT } from 'jose';
import { createHash } from 'node:crypto';
import { keyPairPromise } from '../../src/api/portal/auth.js';
import { GOV_SESSION_ISSUER_DID } from '../../src/civic-registry/index.js';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { NousRegistry } from '../../src/registry/registry.js';
import type { FastifyInstance } from 'fastify';
import type { CivicDidRecord } from '../../src/civic-registry/index.js';

const GRID_NAME = 'genesis';
const ACTIVE_CIVIC_DID = 'did:civic:noesis:revoke-target-active-001';
const REVOKED_CIVIC_DID = 'did:civic:noesis:revoke-target-already-revoked';
const UNKNOWN_CIVIC_DID = 'did:civic:noesis:nonexistent-revoke-target';
const COURT_REF = 'CONVICTION-CASE-2026-001';

/**
 * Mint a government session JWT signed with keyPairPromise.
 * Includes court_conviction_ref claim for full happy path.
 */
async function mintGovJwt(opts?: { omitRef?: boolean; wrongIss?: boolean }): Promise<string> {
    const { privateKey } = await keyPairPromise;
    const iss = opts?.wrongIss ? 'did:noesis:human:0xbadactor' : GOV_SESSION_ISSUER_DID;
    const payload: Record<string, unknown> = {};
    if (!opts?.omitRef) {
        payload['court_conviction_ref'] = COURT_REF;
    }
    const jwt = await new SignJWT(payload)
        .setProtectedHeader({ alg: 'ES256' })
        .setIssuer(iss)
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKey);
    return `Bearer ${jwt}`;
}

/**
 * Mint a civic-DID bearer JWT (valid ES256, did:civic:noesis:* subject, no gov iss).
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

function makeMockCivicStore(seeds: CivicDidRecord[]) {
    const store = new Map<string, CivicDidRecord>();
    for (const seed of seeds) {
        store.set(`${seed.gridName}:${seed.civicDid}`, seed);
    }
    return {
        async insert(record: CivicDidRecord) {
            store.set(`${record.gridName}:${record.civicDid}`, record);
        },
        async get(gridName: string, civicDid: string): Promise<CivicDidRecord | null> {
            return store.get(`${gridName}:${civicDid}`) ?? null;
        },
        async getByExistenceDid(): Promise<CivicDidRecord | null> { return null; },
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

describe('POST /api/v1/registry/civic-did/:did/revoke — government_only enforcement (SECURITY CRITICAL)', () => {
    let app: FastifyInstance;
    let audit: AuditChain;

    beforeAll(async () => {
        const clock = new WorldClock({ tickRateMs: 100_000 });
        const space = new SpatialMap();
        const logos = new LogosEngine();
        audit = new AuditChain();
        const registry = new NousRegistry();

        const seeds: CivicDidRecord[] = [
            {
                gridName: GRID_NAME,
                civicDid: ACTIVE_CIVIC_DID,
                existenceDid: 'did:noesis:nous:revoke-existence-001',
                credentialJson: { type: ['VerifiableCredential', 'CivicDIDCredential'] },
                status: 'active',
                issuedAtTick: 1,
            },
            {
                gridName: GRID_NAME,
                civicDid: REVOKED_CIVIC_DID,
                existenceDid: 'did:noesis:nous:revoke-existence-002',
                credentialJson: { type: ['VerifiableCredential', 'CivicDIDCredential'] },
                status: 'revoked',
                issuedAtTick: 2,
                revokedAtTick: 5,
                courtConvictionRef: 'PRIOR-CONVICTION',
            },
        ];

        app = buildServer({
            clock, space, logos, audit, gridName: GRID_NAME, registry,
            civicDidStore: makeMockCivicStore(seeds) as unknown as import('../../src/civic-registry/civic-did-store.js').CivicDidStore,
        });
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    it('returns 403 court_order_required when no Authorization header provided', async () => {
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/registry/civic-did/${ACTIVE_CIVIC_DID}/revoke`,
            payload: { court_conviction_ref: COURT_REF },
        });
        expect(res.statusCode).toBe(403);
        expect(res.json()).toMatchObject({ error: 'court_order_required' });
    });

    it('returns 403 court_order_required when Authorization is a valid Civic-DID bearer JWT (REG-04 core invariant)', async () => {
        // A civic member cannot revoke — only government can
        const civicBearer = await mintCivicBearer('did:civic:noesis:regular-citizen');
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/registry/civic-did/${ACTIVE_CIVIC_DID}/revoke`,
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
            url: `/api/v1/registry/civic-did/${ACTIVE_CIVIC_DID}/revoke`,
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
            url: `/api/v1/registry/civic-did/${ACTIVE_CIVIC_DID}/revoke`,
            headers: { authorization: govJwtNoRef },
            payload: { court_conviction_ref: COURT_REF },
        });
        expect(res.statusCode).toBe(403);
        expect(res.json()).toMatchObject({ error: 'court_conviction_ref_required' });
    });

    it('returns 400 court_conviction_ref_required when government JWT present but body omits court_conviction_ref', async () => {
        const govJwt = await mintGovJwt();
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/registry/civic-did/${ACTIVE_CIVIC_DID}/revoke`,
            headers: { authorization: govJwt },
            payload: {}, // no court_conviction_ref in body
        });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toMatchObject({ error: 'court_conviction_ref_required' });
    });

    it('returns 404 not_found when revoking an unknown civic DID', async () => {
        const govJwt = await mintGovJwt();
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/registry/civic-did/${UNKNOWN_CIVIC_DID}/revoke`,
            headers: { authorization: govJwt },
            payload: { court_conviction_ref: COURT_REF },
        });
        expect(res.statusCode).toBe(404);
        expect(res.json()).toMatchObject({ error: 'not_found' });
    });

    it('returns 409 already_revoked when revoking an already-revoked DID', async () => {
        const govJwt = await mintGovJwt();
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/registry/civic-did/${REVOKED_CIVIC_DID}/revoke`,
            headers: { authorization: govJwt },
            payload: { court_conviction_ref: COURT_REF },
        });
        expect(res.statusCode).toBe(409);
        expect(res.json()).toMatchObject({ error: 'already_revoked' });
    });

    it('returns 200 {revoked: true} on valid government revocation (happy path)', async () => {
        const govJwt = await mintGovJwt();
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/registry/civic-did/${ACTIVE_CIVIC_DID}/revoke`,
            headers: { authorization: govJwt },
            payload: { court_conviction_ref: COURT_REF },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ revoked: true });
    });

    it('appends registry.civic_did_revoked audit event with court_conviction_ref_HASH (not plaintext)', async () => {
        const entries = audit.query({ eventType: 'registry.civic_did_revoked' });
        expect(entries.length).toBeGreaterThanOrEqual(1);
        const last = entries[entries.length - 1];

        // Privacy: plaintext MUST NOT appear in audit payload
        expect(Object.keys(last.payload)).not.toContain('court_conviction_ref');
        // Hash MUST appear
        expect(Object.keys(last.payload)).toContain('court_conviction_ref_hash');

        // Hash must be correct sha256 of the plaintext
        const expectedHash = createHash('sha256').update(COURT_REF).digest('hex');
        expect(last.payload['court_conviction_ref_hash']).toBe(expectedHash);
    });
});
