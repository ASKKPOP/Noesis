/**
 * Phase 38 WIRE-01 — POST /api/v1/brain/actions integration tests
 *
 * 8 test cases:
 *   1. Valid EdDSA bearer + known civic_did + well-formed body → 200, executeActions called
 *   2. No bearer → 401 (global onRequest civic_did_required gate)
 *   3. Valid bearer but no NousRunner for civic_did → 404
 *   4. Batch size > 500 → 413
 *   5. Malformed body (missing tick) → 400
 *   6. Audit chain head hash unchanged when dispatch raises (error isolation)
 *   7. Sole-producer parity: same actions dispatched through HTTP path and in-process path
 *      produce identical audit event tuples (R-31-01 guard across network boundary)
 *   8. ROUTE_DID_POLICY has POST /api/v1/brain/actions = civic_did_required
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { NousRunner } from '../../src/integration/nous-runner.js';
import { EconomyManager } from '../../src/economy/config.js';
import { ROUTE_DID_POLICY } from '../../src/api/policy.js';
import type { BrainTokenRecord } from '../../src/db/stores/brain-token-store.js';
import type { BrainAction } from '../../src/integration/types.js';
import type { WireCoordinator, WireRunner } from '../../src/api/routes/brain-wire.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const GRID_NAME = 'genesis';
const NOUS_DID = 'did:noesis:nous:wire-test-001';
const CIVIC_DID = 'did:civic:noesis:wire-civic-001';
const UNKNOWN_CIVIC_DID = 'did:civic:noesis:no-runner-999';

// ── BrainTokenStore stub ──────────────────────────────────────────────────────

function makeMockBrainTokenStore(rec: BrainTokenRecord | null) {
    return {
        async getByDid(brainDid: string) {
            if (rec && rec.brainDid === brainDid) return rec;
            return null;
        },
        async isRevoked(brainDid: string) {
            if (rec && rec.brainDid === brainDid && rec.revoked) return true;
            return false;
        },
        async upsert() {},
        async insert() {},
        async revoke() { return false; },
    } as unknown as import('../../src/db/stores/brain-token-store.js').BrainTokenStore;
}

// ── Stub WireRunner (captures executeActions calls) ───────────────────────────

interface StubRunner extends WireRunner {
    calls: Array<{ actions: BrainAction[]; tick: number }>;
    shouldThrow: boolean;
}

function makeStubRunner(): StubRunner {
    const stub: StubRunner = {
        calls: [],
        shouldThrow: false,
        async executeActions(actions: BrainAction[], tick: number) {
            if (stub.shouldThrow) throw new Error('stub throw');
            stub.calls.push({ actions: [...actions], tick });
        },
    };
    return stub;
}

// ── Shared test app with both "known" and "unknown" runner registrations ───────

let app: FastifyInstance;
let privateKey: CryptoKey;
let knownRunner: StubRunner;

async function buildWireTestApp(opts?: {
    coordinator?: WireCoordinator;
    tokenRecord?: BrainTokenRecord | null;
}): Promise<{ app: FastifyInstance; privateKey: CryptoKey; publicKeyJwk: Record<string, unknown> }> {
    const { privateKey: pk, publicKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
    const jwk = await exportJWK(publicKey);
    const publicKeyJwk: Record<string, unknown> = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, alg: 'EdDSA' };

    const tokenRec = opts?.tokenRecord ?? {
        brainDid: NOUS_DID,
        publicKeyJwk,
        issuedAt: Math.floor(Date.now() / 1000),
        expiresAt: Math.floor(Date.now() / 1000) + 86400,
        revoked: false,
    };

    const clock = new WorldClock({ tickRateMs: 100_000 });
    const space = new SpatialMap();
    const logos = new LogosEngine();
    const audit = new AuditChain();
    const registry = new NousRegistry();

    const srv = buildServer({
        clock, space, logos, audit, gridName: GRID_NAME, registry,
        brainTokenStore: makeMockBrainTokenStore(tokenRec),
        coordinator: opts?.coordinator,
    });

    return { app: srv, privateKey: pk, publicKeyJwk };
}

async function mintJwt(pk: CryptoKey, sub: string, iss: string = NOUS_DID): Promise<string> {
    return await new SignJWT({ sub })
        .setProtectedHeader({ alg: 'EdDSA' })
        .setIssuer(iss)
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(pk);
}

// ── Test suite — shared app ───────────────────────────────────────────────────

describe('POST /api/v1/brain/actions', () => {
    beforeAll(async () => {
        knownRunner = makeStubRunner();

        const coordinator: WireCoordinator = {
            getRunnerByCivicDid: (civicDid: string) =>
                civicDid === CIVIC_DID ? knownRunner : undefined,
        };

        const built = await buildWireTestApp({ coordinator });
        app = built.app;
        privateKey = built.privateKey;
        await app.ready();
    });

    afterAll(async () => { await app.close(); });

    // ── 1. Happy path ────────────────────────────────────────────────────────

    it('valid EdDSA bearer + known civic_did → 200, executeActions called', async () => {
        knownRunner.calls.length = 0;  // reset call log
        const jwt = await mintJwt(privateKey, CIVIC_DID);
        const actions: BrainAction[] = [{ action_type: 'noop', channel: '', text: '', metadata: {} }];

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/brain/actions',
            payload: { tick: 42, actions },
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ ok: true, accepted: 1 });
        expect(knownRunner.calls).toHaveLength(1);
        expect(knownRunner.calls[0].tick).toBe(42);
        expect(knownRunner.calls[0].actions[0].action_type).toBe('noop');
    });

    // ── 2. No bearer → 401 ───────────────────────────────────────────────────

    it('no bearer → 401', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/brain/actions',
            payload: { tick: 1, actions: [] },
        });
        expect(res.statusCode).toBe(401);
    });

    // ── 3. Unknown civic_did → 404 ────────────────────────────────────────────

    it('valid bearer but no NousRunner for civic_did → 404', async () => {
        const jwt = await mintJwt(privateKey, UNKNOWN_CIVIC_DID);

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/brain/actions',
            payload: { tick: 1, actions: [] },
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(404);
        expect(res.json()).toMatchObject({ error: 'nous_runner_not_found', civic_did: UNKNOWN_CIVIC_DID });
    });

    // ── 4. Batch size > 500 → 413 ─────────────────────────────────────────────

    it('batch size > 500 → 413', async () => {
        const jwt = await mintJwt(privateKey, CIVIC_DID);
        const bigBatch: BrainAction[] = Array.from({ length: 501 }, () => ({
            action_type: 'noop' as const,
            channel: '',
            text: '',
            metadata: {},
        }));

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/brain/actions',
            payload: { tick: 1, actions: bigBatch },
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(413);
        expect(res.json()).toMatchObject({ error: 'batch_too_large', max: 500 });
    });

    // ── 5. Malformed body → 400 ────────────────────────────────────────────────

    it('malformed body (missing tick) → 400', async () => {
        const jwt = await mintJwt(privateKey, CIVIC_DID);

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/brain/actions',
            // tick field missing
            payload: { actions: [{ action_type: 'noop', channel: '', text: '', metadata: {} }] },
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(400);
        expect(res.json()).toMatchObject({ error: 'invalid_request' });
    });
});

// ── Error isolation — separate app so throw stub doesn't bleed ────────────────

describe('POST /api/v1/brain/actions — error isolation', () => {
    let isolationApp: FastifyInstance;
    let isolationPrivKey: CryptoKey;
    let throwingRunner: StubRunner;
    let isolationAudit: AuditChain;

    beforeAll(async () => {
        throwingRunner = makeStubRunner();
        throwingRunner.shouldThrow = true;

        const coordinator: WireCoordinator = {
            getRunnerByCivicDid: (civicDid: string) =>
                civicDid === CIVIC_DID ? throwingRunner : undefined,
        };

        const { privateKey: pk, publicKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
        const jwk = await exportJWK(publicKey);
        const publicKeyJwk: Record<string, unknown> = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, alg: 'EdDSA' };
        isolationPrivKey = pk;

        const tokenRec: BrainTokenRecord = {
            brainDid: NOUS_DID,
            publicKeyJwk,
            issuedAt: Math.floor(Date.now() / 1000),
            expiresAt: Math.floor(Date.now() / 1000) + 86400,
            revoked: false,
        };

        isolationAudit = new AuditChain();
        const clock = new WorldClock({ tickRateMs: 100_000 });
        const space = new SpatialMap();
        const logos = new LogosEngine();
        const registry = new NousRegistry();

        isolationApp = buildServer({
            clock, space, logos, audit: isolationAudit, gridName: GRID_NAME, registry,
            brainTokenStore: makeMockBrainTokenStore(tokenRec),
            coordinator,
        });
        await isolationApp.ready();
    });

    afterAll(async () => { await isolationApp.close(); });

    it('audit chain head hash unchanged when dispatch raises', async () => {
        const headBefore = isolationAudit.head;
        const jwt = await mintJwt(isolationPrivKey, CIVIC_DID);

        const res = await isolationApp.inject({
            method: 'POST',
            url: '/api/v1/brain/actions',
            payload: { tick: 1, actions: [{ action_type: 'noop', channel: '', text: '', metadata: {} }] },
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(500);
        expect(isolationAudit.head).toBe(headBefore);
    });
});

// ── R-31-01 sole-producer parity ──────────────────────────────────────────────

describe('POST /api/v1/brain/actions — R-31-01 sole-producer parity', () => {
    it('noop actions: HTTP path and in-process path produce identical audit event tuples', async () => {
        // ── In-process baseline ───────────────────────────────────────────────
        const auditInProcess = new AuditChain();
        const spaceInProcess = new SpatialMap();
        const registryInProcess = new NousRegistry();
        const economyInProcess = new EconomyManager();

        spaceInProcess.addRegion({ id: 'Agora Central', name: 'Agora Central', description: '', regionType: 'public', capacity: 100, properties: {} });
        registryInProcess.spawn(
            { did: NOUS_DID, name: 'TestNous', publicKey: 'pk', region: 'Agora Central' },
            GRID_NAME, 0, 100,
        );
        spaceInProcess.placeNous(NOUS_DID, 'Agora Central');

        const stubBridge = {
            async sendTick() { return []; },
            async sendMessage() { return []; },
            async getState() { return {}; },
            async queryMemory() { return { entries: [] }; },
            async forceTelos() { return { telos_hash_before: '', telos_hash_after: '' }; },
        };

        const inProcessRunner = new NousRunner({
            nousDid: NOUS_DID,
            nousName: 'TestNous',
            bridge: stubBridge,
            space: spaceInProcess,
            audit: auditInProcess,
            registry: registryInProcess,
            economy: economyInProcess,
        });

        const noopActions: BrainAction[] = [
            { action_type: 'noop', channel: '', text: '', metadata: {} },
        ];

        await inProcessRunner.executeActions(noopActions, 99);
        const inProcessEntries = auditInProcess.query().map((e) => [
            e.eventType,
            e.actorDid,
            JSON.stringify(e.payload),
        ]);

        // ── HTTP path ─────────────────────────────────────────────────────────
        const auditHttp = new AuditChain();
        const spaceHttp = new SpatialMap();
        const registryHttp = new NousRegistry();
        const economyHttp = new EconomyManager();

        spaceHttp.addRegion({ id: 'Agora Central', name: 'Agora Central', description: '', regionType: 'public', capacity: 100, properties: {} });
        registryHttp.spawn(
            { did: NOUS_DID, name: 'TestNous2', publicKey: 'pk', region: 'Agora Central' },
            GRID_NAME, 0, 100,
        );
        spaceHttp.placeNous(NOUS_DID, 'Agora Central');

        const httpRunner = new NousRunner({
            nousDid: NOUS_DID,
            nousName: 'TestNous2',
            bridge: stubBridge,
            space: spaceHttp,
            audit: auditHttp,
            registry: registryHttp,
            economy: economyHttp,
        });

        const httpCoordinator: WireCoordinator = {
            getRunnerByCivicDid: (civicDid: string) =>
                civicDid === CIVIC_DID ? httpRunner : undefined,
        };

        const { privateKey: pk, publicKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
        const jwk = await exportJWK(publicKey);
        const publicKeyJwk: Record<string, unknown> = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, alg: 'EdDSA' };

        const tokenRec: BrainTokenRecord = {
            brainDid: NOUS_DID,
            publicKeyJwk,
            issuedAt: Math.floor(Date.now() / 1000),
            expiresAt: Math.floor(Date.now() / 1000) + 86400,
            revoked: false,
        };

        const clock = new WorldClock({ tickRateMs: 100_000 });
        const logos = new LogosEngine();
        const httpApp = buildServer({
            clock, space: spaceHttp, logos, audit: auditHttp, gridName: GRID_NAME,
            registry: registryHttp,
            brainTokenStore: makeMockBrainTokenStore(tokenRec),
            coordinator: httpCoordinator,
        });
        await httpApp.ready();

        const jwt = await mintJwt(pk, CIVIC_DID);
        const res = await httpApp.inject({
            method: 'POST',
            url: '/api/v1/brain/actions',
            payload: { tick: 99, actions: noopActions },
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(200);

        const httpEntries = auditHttp.query().map((e) => [
            e.eventType,
            e.actorDid,
            JSON.stringify(e.payload),
        ]);

        // R-31-01 sole-producer parity: noop actions emit no audit events via either path.
        // Both arrays should be empty — neither path adds spurious audit writes.
        expect(httpEntries).toEqual(inProcessEntries);

        // Close the test-local httpApp. Swallow WS server teardown error (pre-existing
        // ws-plugin issue: WS emits "not running" on non-listened-but-ready servers).
        await httpApp.close().catch(() => { /* WS cleanup noise */ });
    });
});

// ── Policy entry ──────────────────────────────────────────────────────────────

describe('ROUTE_DID_POLICY entry for brain actions', () => {
    it('POST /api/v1/brain/actions is civic_did_required', () => {
        expect(ROUTE_DID_POLICY['POST /api/v1/brain/actions']).toBe('civic_did_required');
    });
});
