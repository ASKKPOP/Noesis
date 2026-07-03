/**
 * Phase 37 / REG-01 — POST /api/v1/registry/civic-did/request
 *
 * Tests for the civic-DID request endpoint:
 *   - 400 on missing/invalid existence_did
 *   - 400 on missing civic_oath
 *   - 400 on missing JWK
 *   - 401 on invalid signature
 *   - 201 + VC on valid signed request (happy path)
 *   - 409 already_registered on duplicate existence_did
 *   - 503 when civicDidStore absent
 *   - Audit event assertion (registry.civic_did_issued)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { generateKeyPair, CompactSign, exportJWK } from 'jose';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { NousRegistry } from '../../src/registry/registry.js';
import type { FastifyInstance } from 'fastify';
import type { CivicDidRecord } from '../../src/civic-registry/index.js';

const GRID_NAME = 'genesis';
const EXISTENCE_DID = 'did:noesis:nous:alice-test-001';
const CIVIC_OATH = 'I pledge to uphold the Genesis Grid civic charter.';

// In-memory mock CivicDidStore using a Map
function makeMockCivicStore() {
    const store = new Map<string, CivicDidRecord>();
    const byExistence = new Map<string, CivicDidRecord>();

    return {
        async insert(record: CivicDidRecord) {
            if (byExistence.has(`${record.gridName}:${record.existenceDid}`)) {
                const err = new Error('ER_DUP_ENTRY') as Error & { code: string };
                err.code = 'ER_DUP_ENTRY';
                throw err;
            }
            store.set(`${record.gridName}:${record.civicDid}`, record);
            byExistence.set(`${record.gridName}:${record.existenceDid}`, record);
        },
        async get(gridName: string, civicDid: string): Promise<CivicDidRecord | null> {
            return store.get(`${gridName}:${civicDid}`) ?? null;
        },
        async getByExistenceDid(gridName: string, existenceDid: string): Promise<CivicDidRecord | null> {
            return byExistence.get(`${gridName}:${existenceDid}`) ?? null;
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

async function buildTestApp(opts: { withStore: boolean; coordinator?: unknown; approved?: boolean }) {
    const clock = new WorldClock({ tickRateMs: 100_000 });
    const space = new SpatialMap();
    const logos = new LogosEngine();
    const audit = new AuditChain();
    const registry = new NousRegistry();

    // D-V3-33 gate: when a pool is wired, the issuance route checks
    // NousRegistrationStore.isNousApproved (a `SELECT 1 … status='approved'`).
    // This mock pool answers only that query — approved → one row, else none.
    const pool = opts.approved === undefined ? undefined : ({
        query: async (sql: string) =>
            /status\s*=\s*'approved'/.test(sql) && opts.approved ? [[{ '1': 1 }], {}] : [[], {}],
    } as unknown as import('mysql2/promise').Pool);

    const app = buildServer({
        clock, space, logos, audit, gridName: GRID_NAME, registry,
        civicDidStore: opts.withStore ? (makeMockCivicStore() as unknown as import('../../src/civic-registry/civic-did-store.js').CivicDidStore) : undefined,
        ...(opts.coordinator ? { coordinator: opts.coordinator as import('../../src/api/routes/brain-wire.js').WireCoordinator } : {}),
        ...(pool ? { pool } : {}),
    });
    await app.ready();
    return { app, audit };
}

describe('POST /api/v1/registry/civic-did/request — validation', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        ({ app } = await buildTestApp({ withStore: true }));
    });

    afterAll(async () => {
        await app.close();
    });

    it('returns 400 invalid_existence_did when existence_did is missing', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/registry/civic-did/request',
            payload: { civic_oath: CIVIC_OATH, existence_public_key_jwk: {}, existence_key_signature: 'x' },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toMatchObject({ error: 'invalid_existence_did' });
    });

    it('returns 400 invalid_existence_did when existence_did uses wrong DID family', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/registry/civic-did/request',
            payload: {
                existence_did: 'did:civic:noesis:bad-family',
                civic_oath: CIVIC_OATH,
                existence_public_key_jwk: {},
                existence_key_signature: 'x',
            },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toMatchObject({ error: 'invalid_existence_did' });
    });

    it('returns 400 when civic_oath is missing', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/registry/civic-did/request',
            payload: {
                existence_did: EXISTENCE_DID,
                existence_public_key_jwk: {},
                existence_key_signature: 'x',
            },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toMatchObject({ error: 'invalid_civic_oath' });
    });

    it('returns 400 when existence_public_key_jwk is missing', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/registry/civic-did/request',
            payload: {
                existence_did: EXISTENCE_DID,
                civic_oath: CIVIC_OATH,
                existence_key_signature: 'x',
            },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toMatchObject({ error: 'invalid_public_key' });
    });

    it('returns 401 invalid_signature when signature does not verify against the JWK', async () => {
        // Generate a key pair for signing, but send a different key in the body
        const { privateKey } = await generateKeyPair('ES256');
        const { publicKey: otherPublicKey } = await generateKeyPair('ES256');
        const encoder = new TextEncoder();
        const signature = await new CompactSign(encoder.encode(CIVIC_OATH))
            .setProtectedHeader({ alg: 'ES256' })
            .sign(privateKey);
        const otherJwk = await exportJWK(otherPublicKey);

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/registry/civic-did/request',
            payload: {
                existence_did: EXISTENCE_DID,
                civic_oath: CIVIC_OATH,
                existence_public_key_jwk: otherJwk, // wrong key — won't verify
                existence_key_signature: signature,
            },
        });
        expect(res.statusCode).toBe(401);
        expect(res.json()).toMatchObject({ error: 'invalid_signature' });
    });

});

describe('POST /api/v1/registry/civic-did/request — happy path + audit', () => {
    let app: FastifyInstance;
    let audit: AuditChain;
    let publicKeyJwk: object;
    let privateKey: CryptoKey;

    beforeAll(async () => {
        ({ app, audit } = await buildTestApp({ withStore: true }));
        const keyPair = await generateKeyPair('ES256');
        privateKey = keyPair.privateKey;
        publicKeyJwk = await exportJWK(keyPair.publicKey);
    });

    afterAll(async () => {
        await app.close();
    });

    it('returns 201 with civic_did and credential on valid signed request', async () => {
        const encoder = new TextEncoder();
        const signature = await new CompactSign(encoder.encode(CIVIC_OATH))
            .setProtectedHeader({ alg: 'ES256' })
            .sign(privateKey);

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/registry/civic-did/request',
            payload: {
                existence_did: EXISTENCE_DID,
                civic_oath: CIVIC_OATH,
                existence_public_key_jwk: publicKeyJwk,
                existence_key_signature: signature,
            },
        });
        expect(res.statusCode).toBe(201);
        const body = res.json() as { civic_did: string; credential: { type: string[] } };
        expect(body.civic_did).toMatch(/^did:civic:noesis:/);
        expect(body.credential).toBeTruthy();
        expect((body.credential as { type: string[] }).type).toContain('CivicDIDCredential');
    });

    it('appends registry.civic_did_issued audit event on success', async () => {
        // Find the registry.civic_did_issued events
        const entries = audit.query({ eventType: 'registry.civic_did_issued' });
        expect(entries.length).toBeGreaterThanOrEqual(1);
        const last = entries[entries.length - 1];
        expect(last.payload).toHaveProperty('civic_did');
        expect(last.payload).toHaveProperty('existence_did');
        expect(last.payload).toHaveProperty('grid_name');
        expect(last.payload).toHaveProperty('issued_at_tick');
    });

    it('returns 409 already_registered when same existence_did is requested twice', async () => {
        const encoder = new TextEncoder();
        // Use a SINGLE key pair — both privateKey and publicKey must be from the same pair
        const keyPair2 = await generateKeyPair('ES256');
        const jwk2 = await exportJWK(keyPair2.publicKey);
        const sig2 = await new CompactSign(encoder.encode(CIVIC_OATH))
            .setProtectedHeader({ alg: 'ES256' })
            .sign(keyPair2.privateKey);
        const existenceDid2 = 'did:noesis:nous:bob-duplicate-test';

        // First request succeeds
        const first = await app.inject({
            method: 'POST',
            url: '/api/v1/registry/civic-did/request',
            payload: {
                existence_did: existenceDid2,
                civic_oath: CIVIC_OATH,
                existence_public_key_jwk: jwk2,
                existence_key_signature: sig2,
            },
        });
        expect(first.statusCode).toBe(201);
        const firstBody = first.json() as { civic_did: string };

        // Second request with same existence_did returns 409
        const second = await app.inject({
            method: 'POST',
            url: '/api/v1/registry/civic-did/request',
            payload: {
                existence_did: existenceDid2,
                civic_oath: CIVIC_OATH,
                existence_public_key_jwk: jwk2,
                existence_key_signature: sig2,
            },
        });
        expect(second.statusCode).toBe(409);
        const secondBody = second.json() as { error: string; civic_did: string };
        expect(secondBody.error).toBe('already_registered');
        // Original civic_did is returned in the conflict response
        expect(secondBody.civic_did).toBe(firstBody.civic_did);
    });
});

// D-V3-33: with a DB pool wired (production), a Civic-DID is issued ONLY after the
// Nous has a Portal→Polis-approved registration. The direct route is the issuance
// step that follows approval — not standalone self-service.
describe('POST /api/v1/registry/civic-did/request — D-V3-33 Portal-approval gate', () => {
    async function signedRequest() {
        const keyPair = await generateKeyPair('ES256');
        const jwk = await exportJWK(keyPair.publicKey);
        const signature = await new CompactSign(new TextEncoder().encode(CIVIC_OATH))
            .setProtectedHeader({ alg: 'ES256' })
            .sign(keyPair.privateKey);
        return {
            existence_did: EXISTENCE_DID,
            civic_oath: CIVIC_OATH,
            existence_public_key_jwk: jwk,
            existence_key_signature: signature,
        };
    }

    it('403 portal_approval_required when the Nous has no approved registration', async () => {
        const { app } = await buildTestApp({ withStore: true, approved: false });
        const res = await app.inject({ method: 'POST', url: '/api/v1/registry/civic-did/request', payload: await signedRequest() });
        expect(res.statusCode).toBe(403);
        expect(res.json()).toMatchObject({ error: 'portal_approval_required' });
        await app.close();
    });

    it('201 issues once a Portal→Polis-approved registration exists', async () => {
        const { app } = await buildTestApp({ withStore: true, approved: true });
        const res = await app.inject({ method: 'POST', url: '/api/v1/registry/civic-did/request', payload: await signedRequest() });
        expect(res.statusCode).toBe(201);
        expect((res.json() as { civic_did: string }).civic_did).toMatch(/^did:civic:noesis:/);
        await app.close();
    });
});

// WIRE-02 binding: on a successful issuance the registry route must bind the new
// Civic-DID to the Nous's live NousRunner (via coordinator.registerCivicDid), so
// /api/v1/brain/actions can then route the Nous's actions to its runner. Without
// this the whole external-Brain write-back path 404s (nous_runner_not_found).
// NOTE: the running Grid does not yet wire a GridCoordinator (main.ts getRunner
// returns undefined — a deferred sub-plan); this proves the binding fires the
// moment a coordinator IS present.
describe('POST /api/v1/registry/civic-did/request — WIRE-02 runner binding', () => {
    it('binds the issued Civic-DID to the runner keyed by existence_did', async () => {
        const fakeRunner = { nousDid: EXISTENCE_DID } as unknown;
        const index = new Map<string, unknown>();
        const runnersByNous = new Map<string, unknown>([[EXISTENCE_DID, fakeRunner]]);
        const coordinator = {
            getRunnerByCivicDid: (civicDid: string) => index.get(civicDid),
            registerCivicDid: (civicDid: string, nousDid: string) => {
                const r = runnersByNous.get(nousDid);
                if (r) index.set(civicDid, r);
            },
        };
        const { app } = await buildTestApp({ withStore: true, coordinator });

        const keyPair = await generateKeyPair('ES256');
        const jwk = await exportJWK(keyPair.publicKey);
        const signature = await new CompactSign(new TextEncoder().encode(CIVIC_OATH))
            .setProtectedHeader({ alg: 'ES256' })
            .sign(keyPair.privateKey);

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/registry/civic-did/request',
            payload: {
                existence_did: EXISTENCE_DID,
                civic_oath: CIVIC_OATH,
                existence_public_key_jwk: jwk,
                existence_key_signature: signature,
            },
        });
        expect(res.statusCode).toBe(201);
        const { civic_did } = res.json() as { civic_did: string };

        // the freshly-issued Civic-DID now resolves to the runner → brain actions can dispatch
        expect(coordinator.getRunnerByCivicDid(civic_did)).toBe(fakeRunner);
        await app.close();
    });
});

describe('POST /api/v1/registry/civic-did/request — 503 when store absent', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        ({ app } = await buildTestApp({ withStore: false }));
    });

    afterAll(async () => {
        await app.close();
    });

    it('returns 503 when civicDidStore is absent', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/registry/civic-did/request',
            payload: {
                existence_did: EXISTENCE_DID,
                civic_oath: CIVIC_OATH,
                existence_public_key_jwk: {},
                existence_key_signature: 'x',
            },
        });
        expect(res.statusCode).toBe(503);
        expect(res.json()).toMatchObject({ error: 'civic_registry_unavailable' });
    });
});
