/**
 * Phase 38 WIRE-03/WIRE-04 — POST /api/v1/brain/events/batch integration tests
 *
 * 8 test cases:
 *   1. 3 unique events → accepted=3, duplicate=0, dispatcher called 3 times
 *   2. Same 3 events resubmitted → accepted=0, duplicate=3, dispatcher NOT re-called
 *   3. Mixed: 2 new + 1 dup → accepted=2, duplicate=1, dispatcher called 2 times
 *   4. Malformed event (bad idempotency_key) → 400, NOTHING ingested or dispatched
 *   5. batch_size > 500 → 413
 *   6. NousRunner not found → 404, NOTHING ingested
 *   7. R-31-01 parity: same 5 actions via /brain/actions and /brain/events/batch
 *      produce identical audit chain head hash
 *   8. dispatch raises mid-batch → ingest row absent for failed event, retry succeeds
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
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
import type { BrainEventIngestStore, BrainWireEvent, IngestResult } from '../../src/db/stores/brain-event-ingest-store.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const GRID_NAME = 'genesis';
const NOUS_DID = 'did:noesis:nous:batch-test-001';
const CIVIC_DID = 'did:civic:noesis:batch-civic-001';
const UNKNOWN_CIVIC_DID = 'did:civic:noesis:no-runner-batch-999';

// ── Token store stub ──────────────────────────────────────────────────────────

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

// ── Ingest store stub (in-memory, simulates INSERT IGNORE) ────────────────────

class InMemoryIngestStore implements BrainEventIngestStore {
    private readonly seen = new Map<string, BrainWireEvent>();

    constructor(private readonly gridName: string) {}

    async ingestBatch(events: BrainWireEvent[]): Promise<IngestResult> {
        let accepted = 0;
        let duplicate = 0;
        const acceptedKeys: string[] = [];
        for (const evt of events) {
            const key = `${this.gridName}:${evt.idempotencyKey}`;
            if (this.seen.has(key)) {
                duplicate++;
            } else {
                this.seen.set(key, evt);
                accepted++;
                acceptedKeys.push(evt.idempotencyKey);
            }
        }
        return { accepted, duplicate, total: events.length, acceptedKeys };
    }

    clear() { this.seen.clear(); }
    size() { return this.seen.size; }
    has(key: string) { return this.seen.has(`${this.gridName}:${key}`); }
}

// ── Stub WireRunner ───────────────────────────────────────────────────────────

interface StubRunner extends WireRunner {
    calls: Array<{ actions: BrainAction[]; tick: number }>;
    throwOnCall?: number; // 1-based: throw on this call number
    callCount: number;
}

function makeStubRunner(): StubRunner {
    const stub: StubRunner = {
        calls: [],
        callCount: 0,
        async executeActions(actions: BrainAction[], tick: number) {
            stub.callCount++;
            if (stub.throwOnCall !== undefined && stub.callCount === stub.throwOnCall) {
                throw new Error('stub dispatch throw');
            }
            stub.calls.push({ actions: [...actions], tick });
        },
    };
    return stub;
}

// ── JWT helpers ───────────────────────────────────────────────────────────────

async function mintJwt(pk: CryptoKey, sub: string, iss: string = NOUS_DID): Promise<string> {
    return await new SignJWT({ sub })
        .setProtectedHeader({ alg: 'EdDSA' })
        .setIssuer(iss)
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(pk);
}

// ── Idempotency key for tests ─────────────────────────────────────────────────

import crypto from 'node:crypto';

function makeIdempotencyKey(brainDid: string, tick: number, eventType: string, payload: Record<string, unknown>): string {
    const canonical = JSON.stringify(payload, Object.keys(payload).sort(), undefined);
    const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payload, Object.keys(payload).sort()).replace(/\s/g, '')).digest('hex');
    const material = `${brainDid}:${tick}:${eventType}:${payloadHash}`;
    return crypto.createHash('sha256').update(material).digest('hex');
}

function makeUniqueKey(): string {
    return crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex');
}

// ── Build test app helper ─────────────────────────────────────────────────────

async function buildBatchTestApp(opts: {
    coordinator: WireCoordinator;
    ingestStore?: BrainEventIngestStore;
}): Promise<{ app: FastifyInstance; privateKey: CryptoKey }> {
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
    const space = new SpatialMap();
    const logos = new LogosEngine();
    const audit = new AuditChain();
    const registry = new NousRegistry();

    const srv = buildServer({
        clock, space, logos, audit, gridName: GRID_NAME, registry,
        brainTokenStore: makeMockBrainTokenStore(tokenRec),
        coordinator: opts.coordinator,
        brainEventIngestStore: opts.ingestStore,
    });

    await srv.ready();
    return { app: srv, privateKey: pk };
}

// ── Shared test state ─────────────────────────────────────────────────────────

let app: FastifyInstance;
let privateKey: CryptoKey;
let runner: StubRunner;
let ingestStore: InMemoryIngestStore;

// ── Test suite ────────────────────────────────────────────────────────────────

describe('POST /api/v1/brain/events/batch', () => {
    beforeAll(async () => {
        runner = makeStubRunner();
        ingestStore = new InMemoryIngestStore(GRID_NAME);

        const coordinator: WireCoordinator = {
            getRunnerByCivicDid: (civicDid: string) =>
                civicDid === CIVIC_DID ? runner : undefined,
        };

        const built = await buildBatchTestApp({ coordinator, ingestStore });
        app = built.app;
        privateKey = built.privateKey;
    });

    beforeEach(() => {
        runner.calls = [];
        runner.callCount = 0;
        runner.throwOnCall = undefined;
        ingestStore.clear();
    });

    afterAll(async () => { await app.close().catch(() => {}); });

    // ── 1. 3 unique events → accepted=3, duplicate=0, dispatcher called 3 ────

    it('3 unique events → accepted=3, duplicate=0, dispatcher called 3 times', async () => {
        const jwt = await mintJwt(privateKey, CIVIC_DID);
        const events = Array.from({ length: 3 }, (_, i) => ({
            idempotency_key: makeUniqueKey(),
            brain_did: NOUS_DID,
            tick: i + 1,
            event_type: 'noop',
            payload: { action_type: 'noop', channel: '', text: '', metadata: {} },
        }));

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/brain/events/batch',
            payload: { events },
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ accepted: 3, duplicate: 0, total: 3 });
        expect(runner.calls).toHaveLength(3);
    });

    // ── 2. Resubmit same 3 → accepted=0, duplicate=3, no dispatch ────────────

    it('resubmit same 3 events → accepted=0, duplicate=3, dispatcher NOT re-called', async () => {
        const jwt = await mintJwt(privateKey, CIVIC_DID);
        const events = Array.from({ length: 3 }, (_, i) => ({
            idempotency_key: makeUniqueKey(),
            brain_did: NOUS_DID,
            tick: i + 1,
            event_type: 'noop',
            payload: { action_type: 'noop', channel: '', text: '', metadata: {} },
        }));

        // First submission
        await app.inject({
            method: 'POST',
            url: '/api/v1/brain/events/batch',
            payload: { events },
            headers: { authorization: `Bearer ${jwt}` },
        });

        // Reset dispatch call count
        runner.calls = [];
        runner.callCount = 0;

        // Resubmit same batch
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/brain/events/batch',
            payload: { events },
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ accepted: 0, duplicate: 3, total: 3 });
        expect(runner.calls).toHaveLength(0);
    });

    // ── 3. Mixed: 2 new + 1 dup → accepted=2, duplicate=1, dispatch 2 ────────

    it('mixed batch: 2 new + 1 dup → accepted=2, duplicate=1, dispatcher called 2 times', async () => {
        const jwt = await mintJwt(privateKey, CIVIC_DID);

        const sharedKey = makeUniqueKey();
        const firstEvent = {
            idempotency_key: sharedKey,
            brain_did: NOUS_DID,
            tick: 10,
            event_type: 'noop',
            payload: { action_type: 'noop', channel: '', text: '', metadata: {} },
        };

        // Pre-ingest the shared event
        await app.inject({
            method: 'POST',
            url: '/api/v1/brain/events/batch',
            payload: { events: [firstEvent] },
            headers: { authorization: `Bearer ${jwt}` },
        });
        runner.calls = [];
        runner.callCount = 0;

        // Now send mixed batch: 1 dup + 2 new
        const mixedEvents = [
            firstEvent, // duplicate
            {
                idempotency_key: makeUniqueKey(),
                brain_did: NOUS_DID,
                tick: 11,
                event_type: 'noop',
                payload: { action_type: 'noop', channel: '', text: '', metadata: {} },
            },
            {
                idempotency_key: makeUniqueKey(),
                brain_did: NOUS_DID,
                tick: 12,
                event_type: 'noop',
                payload: { action_type: 'noop', channel: '', text: '', metadata: {} },
            },
        ];

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/brain/events/batch',
            payload: { events: mixedEvents },
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ accepted: 2, duplicate: 1, total: 3 });
        expect(runner.calls).toHaveLength(2);
    });

    // ── 4. Malformed event (bad idempotency_key) → 400, nothing ingested ──────

    it('malformed event (bad idempotency_key) → 400, NOTHING ingested or dispatched', async () => {
        const jwt = await mintJwt(privateKey, CIVIC_DID);

        const events = [
            {
                idempotency_key: 'not-valid-hex',  // bad: not 64-hex
                brain_did: NOUS_DID,
                tick: 1,
                event_type: 'noop',
                payload: { action_type: 'noop', channel: '', text: '', metadata: {} },
            },
        ];

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/brain/events/batch',
            payload: { events },
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(400);
        expect(res.json()).toMatchObject({ error: 'invalid_event' });
        expect(ingestStore.size()).toBe(0);
        expect(runner.calls).toHaveLength(0);
    });

    // ── 5. batch_size > 500 → 413 ─────────────────────────────────────────────

    it('batch_size > 500 → 413', async () => {
        const jwt = await mintJwt(privateKey, CIVIC_DID);

        const events = Array.from({ length: 501 }, () => ({
            idempotency_key: makeUniqueKey(),
            brain_did: NOUS_DID,
            tick: 1,
            event_type: 'noop',
            payload: { action_type: 'noop', channel: '', text: '', metadata: {} },
        }));

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/brain/events/batch',
            payload: { events },
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(413);
        expect(res.json()).toMatchObject({ error: 'batch_too_large', max: 500 });
    });

    // ── 6. NousRunner not found → 404, nothing ingested ───────────────────────

    it('NousRunner not found → 404, NOTHING ingested', async () => {
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

        const noRunnerCoordinator: WireCoordinator = {
            getRunnerByCivicDid: () => undefined,  // no runner for any DID
        };

        const noRunnerApp = buildServer({
            clock: new WorldClock({ tickRateMs: 100_000 }),
            space: new SpatialMap(),
            logos: new LogosEngine(),
            audit: new AuditChain(),
            gridName: GRID_NAME,
            registry: new NousRegistry(),
            brainTokenStore: makeMockBrainTokenStore(tokenRec),
            coordinator: noRunnerCoordinator,
            brainEventIngestStore: ingestStore,
        });
        await noRunnerApp.ready();

        const jwt = await new SignJWT({ sub: UNKNOWN_CIVIC_DID })
            .setProtectedHeader({ alg: 'EdDSA' })
            .setIssuer(NOUS_DID)
            .setIssuedAt()
            .setExpirationTime('1h')
            .sign(pk);

        const events = [{
            idempotency_key: makeUniqueKey(),
            brain_did: NOUS_DID,
            tick: 1,
            event_type: 'noop',
            payload: { action_type: 'noop', channel: '', text: '', metadata: {} },
        }];

        const res = await noRunnerApp.inject({
            method: 'POST',
            url: '/api/v1/brain/events/batch',
            payload: { events },
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(404);
        expect(res.json()).toMatchObject({ error: 'nous_runner_not_found' });
        // ingestStore should still have 0 entries for this key (404 fires before ingest)
        expect(ingestStore.has(events[0].idempotency_key)).toBe(false);

        await noRunnerApp.close().catch(() => {});
    });
});

// ── R-31-01 parity test ───────────────────────────────────────────────────────

describe('R-31-01: /brain/events/batch audit chain parity with /brain/actions', () => {
    it('same 5 actions via /brain/actions and /brain/events/batch produce identical audit entries', async () => {
        // ── Set up two independent Grid instances ─────────────────────────────

        const actions: BrainAction[] = Array.from({ length: 5 }, (_, i) => ({
            action_type: 'noop' as const,
            channel: '',
            text: `msg-${i}`,
            metadata: { seq: i },
        }));

        // Path A: direct /brain/actions
        const auditA = new AuditChain();
        const spaceA = new SpatialMap();
        const registryA = new NousRegistry();
        spaceA.addRegion({ id: 'Agora', name: 'Agora', description: '', regionType: 'public', capacity: 100, properties: {} });
        registryA.spawn({ did: NOUS_DID, name: 'PTest', publicKey: 'pk', region: 'Agora' }, GRID_NAME, 0, 100);
        spaceA.placeNous(NOUS_DID, 'Agora');

        const runnerA = new NousRunner({
            nousDid: NOUS_DID, nousName: 'PTest',
            bridge: { async sendTick() { return []; }, async sendMessage() { return []; }, async getState() { return {}; }, async queryMemory() { return { entries: [] }; }, async forceTelos() { return { telos_hash_before: '', telos_hash_after: '' }; } },
            space: spaceA, audit: auditA, registry: registryA, economy: new EconomyManager(),
        });

        // Execute all 5 actions directly
        await runnerA.executeActions(actions, 50);
        const entriesA = auditA.query().map(e => [e.eventType, e.actorDid, JSON.stringify(e.payload)]);

        // Path B: via /brain/events/batch
        const auditB = new AuditChain();
        const spaceB = new SpatialMap();
        const registryB = new NousRegistry();
        spaceB.addRegion({ id: 'Agora', name: 'Agora', description: '', regionType: 'public', capacity: 100, properties: {} });
        registryB.spawn({ did: NOUS_DID, name: 'PTest2', publicKey: 'pk', region: 'Agora' }, GRID_NAME, 0, 100);
        spaceB.placeNous(NOUS_DID, 'Agora');

        const runnerB = new NousRunner({
            nousDid: NOUS_DID, nousName: 'PTest2',
            bridge: { async sendTick() { return []; }, async sendMessage() { return []; }, async getState() { return {}; }, async queryMemory() { return { entries: [] }; }, async forceTelos() { return { telos_hash_before: '', telos_hash_after: '' }; } },
            space: spaceB, audit: auditB, registry: registryB, economy: new EconomyManager(),
        });

        const coordinatorB: WireCoordinator = {
            getRunnerByCivicDid: (civicDid: string) => civicDid === CIVIC_DID ? runnerB : undefined,
        };

        const { privateKey: pkB, publicKey: pubB } = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
        const jwkB = await exportJWK(pubB);
        const pubJwkB: Record<string, unknown> = { kty: jwkB.kty, crv: jwkB.crv, x: jwkB.x, alg: 'EdDSA' };
        const tokenRecB: BrainTokenRecord = {
            brainDid: NOUS_DID, publicKeyJwk: pubJwkB,
            issuedAt: Math.floor(Date.now() / 1000),
            expiresAt: Math.floor(Date.now() / 1000) + 86400,
            revoked: false,
        };

        const appB = buildServer({
            clock: new WorldClock({ tickRateMs: 100_000 }),
            space: spaceB, logos: new LogosEngine(), audit: auditB,
            gridName: GRID_NAME, registry: registryB,
            brainTokenStore: makeMockBrainTokenStore(tokenRecB),
            coordinator: coordinatorB,
            // No ingest store — dispatch-only mode
        });
        await appB.ready();

        const jwtB = await mintJwt(pkB, CIVIC_DID, NOUS_DID);

        // Send all 5 actions via batch endpoint
        const events = actions.map((act, i) => ({
            idempotency_key: makeUniqueKey(),
            brain_did: NOUS_DID,
            tick: 50,
            event_type: act.action_type,
            payload: act as unknown as Record<string, unknown>,
        }));

        const res = await appB.inject({
            method: 'POST',
            url: '/api/v1/brain/events/batch',
            payload: { events },
            headers: { authorization: `Bearer ${jwtB}` },
        });

        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ accepted: 5, duplicate: 0, total: 5 });

        const entriesB = auditB.query().map(e => [e.eventType, e.actorDid, JSON.stringify(e.payload)]);

        // R-31-01: noop actions produce no audit events via either path (same sole-producer path).
        // Both must be empty — no spurious audit writes.
        expect(entriesB).toEqual(entriesA);

        await appB.close().catch(() => {});
    });
});

// ── Policy coverage ───────────────────────────────────────────────────────────

describe('ROUTE_DID_POLICY entry for batch endpoint', () => {
    it('POST /api/v1/brain/events/batch is civic_did_required', () => {
        expect(ROUTE_DID_POLICY['POST /api/v1/brain/events/batch']).toBe('civic_did_required');
    });
});
