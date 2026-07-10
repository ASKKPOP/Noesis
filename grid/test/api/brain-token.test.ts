/**
 * Phase 38 WIRE-02 — POST /api/v1/brain/token/{register,revoke}
 *
 * 8 test cases:
 *   1. register: valid existence-signed payload registers the JWK (first-registration)
 *   2. register: invalid signature → 401
 *   3. register: civic_did not in registry → 403
 *   4. register: malformed body (missing public_key_jwk) → 400
 *   5. revoke: government_only — without government tier returns 401/403
 *   6. revoke: with stub government session marks row revoked → 200
 *   7. SECURITY (D-SEC-05): public re-register cannot overwrite the key or un-revoke
 *   8. ROUTE_DID_POLICY has explicit entries for both new routes
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { generateKeyPairSync, sign as cryptoSign, createPrivateKey, createPublicKey } from 'node:crypto';
import { SignJWT } from 'jose';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { NousRegistry } from '../../src/registry/registry.js';
import type { FastifyInstance } from 'fastify';
import type { BrainTokenRecord } from '../../src/db/stores/brain-token-store.js';
import { ROUTE_DID_POLICY } from '../../src/api/policy.js';
import { keyPairPromise } from '../../src/api/portal/auth.js';
import { GOV_SESSION_ISSUER_DID } from '../../src/civic-registry/index.js';
import type { CivicDidRecord } from '../../src/civic-registry/index.js';

const GRID_NAME = 'genesis';
const BRAIN_DID = 'did:noesis:nous:brain-test-001';
const CIVIC_DID = 'did:civic:noesis:brain-civic-001';

// ── In-memory BrainTokenStore stub ───────────────────────────────────────────

function makeMockBrainTokenStore() {
    const store = new Map<string, BrainTokenRecord>();

    return {
        async insert(rec: BrainTokenRecord): Promise<void> {
            const key = rec.brainDid;
            if (!store.has(key)) {
                store.set(key, { ...rec });
            }
        },
        async upsert(rec: BrainTokenRecord): Promise<void> {
            store.set(rec.brainDid, { ...rec });
        },
        async getByDid(brainDid: string): Promise<BrainTokenRecord | null> {
            return store.get(brainDid) ?? null;
        },
        async revoke(brainDid: string, _atTick: number): Promise<boolean> {
            const rec = store.get(brainDid);
            if (!rec || rec.revoked) return false;
            rec.revoked = true;
            return true;
        },
        async isRevoked(brainDid: string): Promise<boolean> {
            const rec = store.get(brainDid);
            if (!rec) return false;
            return rec.revoked;
        },
        _store: store,
    };
}

// ── In-memory CivicDidStore stub ──────────────────────────────────────────────

function makeMockCivicStore(activeDids: string[] = [CIVIC_DID]) {
    return {
        async get(_gridName: string, civicDid: string): Promise<CivicDidRecord | null> {
            if (activeDids.includes(civicDid)) {
                return {
                    gridName: GRID_NAME,
                    civicDid,
                    existenceDid: BRAIN_DID,
                    credentialJson: {},
                    status: 'active',
                    issuedAtTick: 1,
                } as CivicDidRecord;
            }
            return null;
        },
        async insert(_record: CivicDidRecord): Promise<void> {},
        async getByExistenceDid(_gridName: string, _existenceDid: string): Promise<CivicDidRecord | null> { return null; },
        async markRevoked(_gridName: string, _civicDid: string, _tick: number, _ref: string): Promise<boolean> { return false; },
    } as unknown as import('../../src/civic-registry/civic-did-store.js').CivicDidStore;
}

// ── Government session JWT helper ─────────────────────────────────────────────

async function mintGovJwt(): Promise<string> {
    const { privateKey } = await keyPairPromise;
    const jwt = await new SignJWT({ court_conviction_ref: 'CONVICTION-2026-BRAIN-001' })
        .setProtectedHeader({ alg: 'ES256' })
        .setIssuer(GOV_SESSION_ISSUER_DID)
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKey);
    return `Bearer ${jwt}`;
}

// ── Ed25519 keypair + signing helpers ─────────────────────────────────────────

function generateBrainKeyPair() {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const jwk = publicKey.export({ format: 'jwk' });
    // Build our JWK format: { kty, crv, x, alg }
    const publicKeyJwk = { kty: 'OKP', crv: 'Ed25519', x: (jwk as Record<string,string>)['x'], alg: 'EdDSA' };

    function signCanonical(brain_did: string, civic_did: string, pkJwk: Record<string, unknown>, issued_at: number, expires_at: number): string {
        const msg = Buffer.from(
            JSON.stringify({ brain_did, civic_did, public_key_jwk: pkJwk, issued_at, expires_at }),
            'utf8',
        );
        const sig = cryptoSign(null, msg, privateKey);
        return sig.toString('base64url');
    }

    return { publicKeyJwk, signCanonical };
}

// ── Test app builder ──────────────────────────────────────────────────────────

function buildTestApp(opts: {
    withBrainStore?: ReturnType<typeof makeMockBrainTokenStore>;
    activeCivicDids?: string[];
}) {
    const clock = new WorldClock({ tickRateMs: 100_000 });
    const space = new SpatialMap();
    const logos = new LogosEngine();
    const audit = new AuditChain();
    const registry = new NousRegistry();

    const brainTokenStore = opts.withBrainStore ?? makeMockBrainTokenStore();

    const app = buildServer({
        clock, space, logos, audit, gridName: GRID_NAME, registry,
        brainTokenStore: brainTokenStore as unknown as import('../../src/db/stores/brain-token-store.js').BrainTokenStore,
        civicDidStore: makeMockCivicStore(opts.activeCivicDids),
    });

    return { app, brainTokenStore };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/v1/brain/token/register — happy path', () => {
    let app: FastifyInstance;
    let store: ReturnType<typeof makeMockBrainTokenStore>;

    beforeAll(async () => {
        const built = buildTestApp({});
        app = built.app;
        store = built.brainTokenStore;
        await app.ready();
    });

    afterAll(async () => { await app.close(); });

    it('valid existence-signed payload upserts the JWK and returns 200', async () => {
        const now = Math.floor(Date.now() / 1000);
        const { publicKeyJwk, signCanonical } = generateBrainKeyPair();
        const issued_at = now;
        const expires_at = now + 86400;
        const signature = signCanonical(BRAIN_DID, CIVIC_DID, publicKeyJwk, issued_at, expires_at);

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/brain/token/register',
            payload: { brain_did: BRAIN_DID, civic_did: CIVIC_DID, public_key_jwk: publicKeyJwk, issued_at, expires_at, signature },
        });

        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ ok: true, brain_did: BRAIN_DID, expires_at });

        // Verify the store was updated
        const rec = await store.getByDid(BRAIN_DID);
        expect(rec).not.toBeNull();
        expect(rec?.publicKeyJwk).toMatchObject(publicKeyJwk);
        expect(rec?.revoked).toBe(false);
    });
});

describe('POST /api/v1/brain/token/register — error cases', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        ({ app } = buildTestApp({}));
        await app.ready();
    });

    afterAll(async () => { await app.close(); });

    it('invalid signature → 401', async () => {
        const now = Math.floor(Date.now() / 1000);
        const { publicKeyJwk, signCanonical } = generateBrainKeyPair();
        const issued_at = now;
        const expires_at = now + 86400;
        const signature = signCanonical(BRAIN_DID, CIVIC_DID, publicKeyJwk, issued_at, expires_at);

        // Corrupt a LEADING (significant) base64url char. Flipping the *last* char only
        // toggles padding bits of a 64-byte Ed25519 signature ('A'/'B' decode identically),
        // which leaves the signature valid — so corrupt the first char instead.
        const badSig = (signature[0] === 'A' ? 'B' : 'A') + signature.slice(1);

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/brain/token/register',
            payload: { brain_did: BRAIN_DID, civic_did: CIVIC_DID, public_key_jwk: publicKeyJwk, issued_at, expires_at, signature: badSig },
        });

        expect(res.statusCode).toBe(401);
        expect(res.json()).toMatchObject({ error: 'invalid_signature' });
    });

    it('civic_did not in registry → 403', async () => {
        const unknownCivicDid = 'did:civic:noesis:not-registered-xyz';
        const now = Math.floor(Date.now() / 1000);
        const { publicKeyJwk, signCanonical } = generateBrainKeyPair();
        const issued_at = now;
        const expires_at = now + 86400;
        // Sign with the correct (unknown) civic_did
        const signature = signCanonical(BRAIN_DID, unknownCivicDid, publicKeyJwk, issued_at, expires_at);

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/brain/token/register',
            payload: { brain_did: BRAIN_DID, civic_did: unknownCivicDid, public_key_jwk: publicKeyJwk, issued_at, expires_at, signature },
        });

        expect(res.statusCode).toBe(403);
        expect(res.json()).toMatchObject({ error: 'civic_did_not_active' });
    });

    it('malformed body (missing public_key_jwk) → 400', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/brain/token/register',
            payload: { brain_did: BRAIN_DID, civic_did: CIVIC_DID, issued_at: 1000, expires_at: 2000, signature: 'abc' },
        });

        expect(res.statusCode).toBe(400);
        expect(res.json()).toMatchObject({ error: 'invalid_request' });
    });
});

describe('POST /api/v1/brain/token/revoke', () => {
    let appNoAuth: FastifyInstance;
    let appGov: FastifyInstance;
    let govStore: ReturnType<typeof makeMockBrainTokenStore>;

    beforeAll(async () => {
        // App for the no-auth test
        appNoAuth = buildTestApp({}).app;
        await appNoAuth.ready();

        // App for the gov-session test (pre-seeded store)
        govStore = makeMockBrainTokenStore();
        await govStore.upsert({
            brainDid: BRAIN_DID,
            publicKeyJwk: { kty: 'OKP', crv: 'Ed25519', x: 'AAAA', alg: 'EdDSA' },
            issuedAt: 1000,
            expiresAt: 2000,
            revoked: false,
        });
        appGov = buildTestApp({ withBrainStore: govStore }).app;
        await appGov.ready();
    });

    afterAll(async () => {
        await appNoAuth.close();
        await appGov.close();
    });

    it('without government tier returns 403', async () => {
        const res = await appNoAuth.inject({
            method: 'POST',
            url: '/api/v1/brain/token/revoke',
            payload: { brain_did: BRAIN_DID },
            // No Authorization header → policy hook sends 403
        });

        expect(res.statusCode).toBe(403);
    });

    it('with valid government session marks row revoked → 200', async () => {
        const govToken = await mintGovJwt();

        const res = await appGov.inject({
            method: 'POST',
            url: '/api/v1/brain/token/revoke',
            payload: { brain_did: BRAIN_DID },
            headers: { authorization: govToken },
        });

        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ ok: true, brain_did: BRAIN_DID, revoked: true });
        expect(await govStore.isRevoked(BRAIN_DID)).toBe(true);
    });
});

describe('POST /api/v1/brain/token — SECURITY (D-SEC-05): public register cannot overwrite or un-revoke', () => {
    let app: FastifyInstance;
    let store: ReturnType<typeof makeMockBrainTokenStore>;

    beforeAll(async () => {
        const built = buildTestApp({});
        app = built.app;
        store = built.brainTokenStore;
        await app.ready();
    });

    afterAll(async () => { await app.close(); });

    it('re-register of a REVOKED brain_did with a DIFFERENT key: revocation is NOT cleared and the key is NOT overwritten', async () => {
        const now = Math.floor(Date.now() / 1000);
        const brainDid = 'did:noesis:nous:rotation-test-001';
        const civicDid = CIVIC_DID;

        // Step 1: legitimate first registration with key A.
        const keyA = generateBrainKeyPair();
        const sigA = keyA.signCanonical(brainDid, civicDid, keyA.publicKeyJwk, now, now + 86400);
        const reg1 = await app.inject({
            method: 'POST',
            url: '/api/v1/brain/token/register',
            payload: { brain_did: brainDid, civic_did: civicDid, public_key_jwk: keyA.publicKeyJwk, issued_at: now, expires_at: now + 86400, signature: sigA },
        });
        expect(reg1.statusCode).toBe(200);
        expect(await store.isRevoked(brainDid)).toBe(false);
        expect((await store.getByDid(brainDid))?.publicKeyJwk).toMatchObject(keyA.publicKeyJwk);

        // Step 2: government revokes the token (court-order path, D-V3-18).
        expect(await store.revoke(brainDid, 42)).toBe(true);
        expect(await store.isRevoked(brainDid)).toBe(true);

        // Step 3: attacker re-registers the SAME brain_did with a DIFFERENT key B.
        // Pre-fix this cleared revoked=0 (un-revoke) AND overwrote the key (hijack).
        // Post-fix (insert / INSERT IGNORE): the row is untouched.
        const keyB = generateBrainKeyPair();
        const sigB = keyB.signCanonical(brainDid, civicDid, keyB.publicKeyJwk, now + 1, now + 86401);
        const reg2 = await app.inject({
            method: 'POST',
            url: '/api/v1/brain/token/register',
            payload: { brain_did: brainDid, civic_did: civicDid, public_key_jwk: keyB.publicKeyJwk, issued_at: now + 1, expires_at: now + 86401, signature: sigB },
        });
        expect(reg2.statusCode).toBe(200); // idempotent no-op — no error oracle

        // The revocation MUST still hold and the key MUST still be A (not the attacker's B).
        expect(await store.isRevoked(brainDid)).toBe(true);
        expect((await store.getByDid(brainDid))?.publicKeyJwk).toMatchObject(keyA.publicKeyJwk);
    });
});

describe('ROUTE_DID_POLICY entries for brain token routes', () => {
    it('register is public and revoke is government_only', () => {
        expect(ROUTE_DID_POLICY['POST /api/v1/brain/token/register']).toBe('public');
        expect(ROUTE_DID_POLICY['POST /api/v1/brain/token/revoke']).toBe('government_only');
    });
});
