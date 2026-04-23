/**
 * Tests for GET /api/v1/whispers/metrics
 *
 * Phase 11 Wave 3 — WHISPER-05 / D-11-08.
 *
 * Cases:
 *   - Empty store → all counts 0
 *   - 3 enqueues across 2 DIDs → total_pending=3, per_did_counts populated
 *   - After emit/rate-limit/tombstone-drop events → counters reflect each
 *   - Response body has zero HEX64 hashes and zero base64 fragments
 *   - Non-loopback → 403 loopback_only
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import Fastify from 'fastify';
import fastifyRateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import { AuditChain } from '../../src/audit/chain.js';
import { PendingStore } from '../../src/whisper/pending-store.js';
import { WhisperRouter } from '../../src/whisper/router.js';
import { TickRateLimiter } from '../../src/whisper/rate-limit.js';
import { WhisperMetricsCounter } from '../../src/whisper/metrics-counter.js';
import { whisperRoutes } from '../../src/api/whisper/routes.js';
import type { Envelope } from '../../src/whisper/types.js';

const ALICE = 'did:noesis:alice000000000000000000000000000000';
const BOB   = 'did:noesis:bob0000000000000000000000000000000';
const CAROL = 'did:noesis:carol00000000000000000000000000000';

function makeEnvelope(overrides: Partial<Envelope> = {}): Envelope {
    return {
        version: 1,
        from_did: ALICE,
        to_did: BOB,
        tick: 1,
        nonce_b64: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==',
        ephemeral_pub_b64: '',
        ciphertext_b64: Buffer.alloc(32).toString('base64'),
        ciphertext_hash: 'a'.repeat(64),
        envelope_id: `env-${Math.random().toString(36).slice(2)}`,
        ...overrides,
    };
}

interface SetupOpts {
    aliceTombstoned?: boolean;
    rateLimitReject?: boolean;
}

function makeSetup(opts: SetupOpts = {}) {
    const audit = new AuditChain();
    const pendingStore = new PendingStore(audit);
    const rateLimiter = new TickRateLimiter();
    const metricsCounter = new WhisperMetricsCounter();

    const registry = {
        isTombstoned: vi.fn((did: string) => {
            if (did === ALICE && opts.aliceTombstoned) return true;
            return false;
        }),
    };

    if (opts.rateLimitReject) {
        vi.spyOn(rateLimiter, 'tryConsume').mockReturnValue(false);
    }

    const router = new WhisperRouter({ audit, registry, rateLimiter, pendingStore, metricsCounter });
    const worldClock = { currentTick: () => 1 };
    return { audit, pendingStore, rateLimiter, metricsCounter, registry, router, worldClock };
}

async function buildApp(setup: ReturnType<typeof makeSetup>): Promise<FastifyInstance> {
    const app = Fastify({ logger: false });
    await app.register(fastifyRateLimit, {
        max: 1000,
        timeWindow: '1 minute',
        keyGenerator: (req) => (req.params as { did?: string }).did ?? req.ip,
    });
    await app.register(whisperRoutes, {
        deps: {
            whisperRouter: setup.router,
            pendingStore: setup.pendingStore,
            registry: setup.registry,
            worldClock: setup.worldClock,
            metricsCounter: setup.metricsCounter,
        },
    });
    await app.ready();
    return app;
}

describe('GET /api/v1/whispers/metrics', () => {
    let app: FastifyInstance;
    let setup: ReturnType<typeof makeSetup>;

    afterEach(async () => {
        await app.close();
        setup.pendingStore.dispose();
    });

    it('empty store → all counts 0, empty per_did_counts', async () => {
        setup = makeSetup();
        app = await buildApp(setup);

        const resp = await app.inject({
            method: 'GET',
            url: '/api/v1/whispers/metrics',
            remoteAddress: '127.0.0.1',
        });

        expect(resp.statusCode).toBe(200);
        const body = resp.json();
        expect(body.total_pending).toBe(0);
        expect(body.per_did_counts).toEqual({});
        expect(body.total_emitted).toBe(0);
        expect(body.total_rate_limited).toBe(0);
        expect(body.total_tombstone_dropped).toBe(0);
    });

    it('3 enqueues across 2 DIDs → total_pending=3, per_did_counts populated', async () => {
        setup = makeSetup();
        app = await buildApp(setup);

        setup.pendingStore.enqueue(makeEnvelope({ to_did: BOB, envelope_id: 'e1' }));
        setup.pendingStore.enqueue(makeEnvelope({ to_did: BOB, envelope_id: 'e2' }));
        setup.pendingStore.enqueue(makeEnvelope({ to_did: CAROL, envelope_id: 'e3' }));

        const resp = await app.inject({
            method: 'GET',
            url: '/api/v1/whispers/metrics',
            remoteAddress: '127.0.0.1',
        });

        expect(resp.statusCode).toBe(200);
        const body = resp.json();
        expect(body.total_pending).toBe(3);
        expect(body.per_did_counts[BOB]).toBe(2);
        expect(body.per_did_counts[CAROL]).toBe(1);
    });

    it('router emits 2 envelopes → total_emitted=2', async () => {
        setup = makeSetup();
        app = await buildApp(setup);

        const env1 = makeEnvelope({ from_did: ALICE, to_did: BOB, envelope_id: 'e1' });
        const env2 = makeEnvelope({ from_did: ALICE, to_did: CAROL, envelope_id: 'e2' });
        setup.router.route(env1, 1);
        setup.router.route(env2, 1);

        const resp = await app.inject({
            method: 'GET',
            url: '/api/v1/whispers/metrics',
            remoteAddress: '127.0.0.1',
        });

        const body = resp.json();
        expect(body.total_emitted).toBe(2);
        expect(body.total_rate_limited).toBe(0);
        expect(body.total_tombstone_dropped).toBe(0);
    });

    it('rate-limiter rejects 2 → total_rate_limited=2', async () => {
        setup = makeSetup({ rateLimitReject: true });
        app = await buildApp(setup);

        const env1 = makeEnvelope({ from_did: ALICE, to_did: BOB, envelope_id: 'r1' });
        const env2 = makeEnvelope({ from_did: ALICE, to_did: CAROL, envelope_id: 'r2' });
        setup.router.route(env1, 1);
        setup.router.route(env2, 1);

        const resp = await app.inject({
            method: 'GET',
            url: '/api/v1/whispers/metrics',
            remoteAddress: '127.0.0.1',
        });

        const body = resp.json();
        expect(body.total_rate_limited).toBe(2);
        expect(body.total_emitted).toBe(0);
    });

    it('tombstone drop → total_tombstone_dropped incremented', async () => {
        setup = makeSetup({ aliceTombstoned: true });
        app = await buildApp(setup);

        const env1 = makeEnvelope({ from_did: ALICE, to_did: BOB, envelope_id: 't1' });
        setup.router.route(env1, 1);

        const resp = await app.inject({
            method: 'GET',
            url: '/api/v1/whispers/metrics',
            remoteAddress: '127.0.0.1',
        });

        const body = resp.json();
        expect(body.total_tombstone_dropped).toBe(1);
        expect(body.total_emitted).toBe(0);
    });

    it('response body has zero HEX64 hashes and zero base64 ciphertext blobs', async () => {
        setup = makeSetup();
        app = await buildApp(setup);

        setup.pendingStore.enqueue(makeEnvelope({ to_did: BOB, envelope_id: 'privacy-e1' }));

        const resp = await app.inject({
            method: 'GET',
            url: '/api/v1/whispers/metrics',
            remoteAddress: '127.0.0.1',
        });

        const bodyStr = resp.body;
        // No 64-char hex hashes.
        expect(bodyStr).not.toMatch(/[0-9a-f]{64}/);
        // No long base64 ciphertext fragments.
        expect(bodyStr).not.toMatch(/[A-Za-z0-9+/]{40,}/);
    });

    it('non-loopback → 403 loopback_only', async () => {
        setup = makeSetup();
        app = await buildApp(setup);

        const resp = await app.inject({
            method: 'GET',
            url: '/api/v1/whispers/metrics',
            remoteAddress: '10.0.0.1',
        });

        expect(resp.statusCode).toBe(403);
        expect(resp.json().error).toBe('loopback_only');
    });

    it('response has exactly the 5 expected keys', async () => {
        setup = makeSetup();
        app = await buildApp(setup);

        const resp = await app.inject({
            method: 'GET',
            url: '/api/v1/whispers/metrics',
            remoteAddress: '127.0.0.1',
        });

        const body = resp.json();
        const keys = Object.keys(body).sort();
        expect(keys).toEqual([
            'per_did_counts',
            'total_emitted',
            'total_pending',
            'total_rate_limited',
            'total_tombstone_dropped',
        ]);
    });
});
