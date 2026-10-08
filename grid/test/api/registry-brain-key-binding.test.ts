/**
 * D-V3-39 — an approved Nous registration is redeemable only by the Brain key its
 * sponsor enrolled at filing.
 *
 *   POST /api/v1/registry/civic-did/request — issues only to the enrolled key
 *   POST /api/v1/brain/token/register        — registers only the enrolled key
 *
 * The Nous existence DID is public, so without this binding anyone could redeem
 * an approval (or register the first Brain token) ahead of the real owner.
 */
import { describe, it, expect } from 'vitest';
import { generateKeyPairSync, sign as cryptoSign, type KeyObject } from 'node:crypto';
import { CompactSign, exportJWK, generateKeyPair } from 'jose';
import type { Pool } from 'mysql2/promise';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { NousRegistry } from '../../src/registry/registry.js';
import type { CivicDidRecord } from '../../src/civic-registry/index.js';

const NOUS = 'did:noesis:hermes';
const OATH = 'I pledge to uphold the Genesis Grid civic charter.';

function brainKey() {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const x = (publicKey.export({ format: 'jwk' }) as { x: string }).x;
    return { privateKey, x, jwk: { kty: 'OKP', crv: 'Ed25519', x, alg: 'EdDSA' } };
}

function makeApp(boundKey: string | null | undefined) {
    const records = new Map<string, CivicDidRecord>();
    const civicDidStore = {
        async insert(r: CivicDidRecord) { records.set(r.civicDid, r); },
        async get(_g: string, civicDid: string) { return records.get(civicDid) ?? null; },
        async getByExistenceDid(_g: string, did: string) { return [...records.values()].find((r) => r.existenceDid === did) ?? null; },
    };
    const tokens = new Map<string, unknown>();
    const brainTokenStore = { async insert(r: { brainDid: string }) { if (!tokens.has(r.brainDid)) tokens.set(r.brainDid, r); } };
    const pool = {
        query: async (sql: string) =>
            /status\s*=\s*'approved'/.test(sql) && boundKey !== undefined ? [[{ brain_key_x: boundKey }], {}] : [[], {}],
    } as unknown as Pool;
    const app = buildServer({
        clock: new WorldClock({ tickRateMs: 100_000 }), space: new SpatialMap(), logos: new LogosEngine(),
        audit: new AuditChain(), gridName: 'genesis', registry: new NousRegistry(), pool,
        civicDidStore: civicDidStore as never, brainTokenStore: brainTokenStore as never,
    });
    return { app, tokens };
}

async function requestCivicDid(app: ReturnType<typeof makeApp>['app'], key: { privateKey: KeyObject; jwk: object }) {
    const signature = await new CompactSign(new TextEncoder().encode(OATH)).setProtectedHeader({ alg: 'EdDSA' }).sign(key.privateKey);
    return app.inject({
        method: 'POST', url: '/api/v1/registry/civic-did/request',
        payload: { existence_did: NOUS, civic_oath: OATH, existence_public_key_jwk: key.jwk, existence_key_signature: signature },
    });
}

function registerToken(app: ReturnType<typeof makeApp>['app'], civicDid: string, key: { privateKey: KeyObject; jwk: object }) {
    const body = { brain_did: NOUS, civic_did: civicDid, public_key_jwk: key.jwk, issued_at: 1, expires_at: 2 };
    const signature = cryptoSign(null, Buffer.from(JSON.stringify(body), 'utf8'), key.privateKey).toString('base64url');
    return app.inject({ method: 'POST', url: '/api/v1/brain/token/register', payload: { ...body, signature } });
}

describe('Civic-DID issuance — Brain key binding', () => {
    it('issues to the enrolled Ed25519 Brain key', async () => {
        const key = brainKey();
        const { app } = makeApp(key.x);
        const res = await requestCivicDid(app, key);
        expect(res.statusCode).toBe(201);
        expect(res.json().civic_did).toMatch(/^did:civic:noesis:/);
        await app.close();
    });

    it('403 brain_key_not_enrolled for a different Ed25519 key', async () => {
        const { app } = makeApp(brainKey().x);
        const res = await requestCivicDid(app, brainKey());
        expect(res.statusCode).toBe(403);
        expect(res.json().error).toBe('brain_key_not_enrolled');
        await app.close();
    });

    it('403 brain_key_not_enrolled for an ES256 key when a Brain key is enrolled', async () => {
        const { app } = makeApp(brainKey().x);
        const { privateKey, publicKey } = await generateKeyPair('ES256');
        const signature = await new CompactSign(new TextEncoder().encode(OATH)).setProtectedHeader({ alg: 'ES256' }).sign(privateKey);
        const res = await app.inject({
            method: 'POST', url: '/api/v1/registry/civic-did/request',
            payload: { existence_did: NOUS, civic_oath: OATH, existence_public_key_jwk: await exportJWK(publicKey), existence_key_signature: signature },
        });
        expect(res.statusCode).toBe(403);
        expect(res.json().error).toBe('brain_key_not_enrolled');
        await app.close();
    });

    it('403 portal_approval_required with no approved registration, even with a valid key', async () => {
        const { app } = makeApp(undefined);
        const res = await requestCivicDid(app, brainKey());
        expect(res.statusCode).toBe(403);
        expect(res.json().error).toBe('portal_approval_required');
        await app.close();
    });

    it('an unbound approval (older civic route) still issues to any proven key', async () => {
        const { app } = makeApp(null);
        expect((await requestCivicDid(app, brainKey())).statusCode).toBe(201);
        await app.close();
    });
});

describe('Brain token registration — Brain key binding', () => {
    it('registers the enrolled key and refuses any other', async () => {
        const key = brainKey();
        const { app, tokens } = makeApp(key.x);
        const civicDid = (await requestCivicDid(app, key)).json().civic_did as string;

        const stranger = await registerToken(app, civicDid, brainKey());
        expect(stranger.statusCode).toBe(403);
        expect(stranger.json().error).toBe('brain_key_not_enrolled');
        expect(tokens.size).toBe(0);

        expect((await registerToken(app, civicDid, key)).statusCode).toBe(200);
        expect(tokens.has(NOUS)).toBe(true);
        await app.close();
    });
});
