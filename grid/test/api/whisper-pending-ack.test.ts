/**
 * Tests for GET /api/v1/nous/:did/whispers/pending
 *           POST /api/v1/nous/:did/whispers/ack
 *
 * Phase 11 Wave 3 — WHISPER-06 / D-11-06.
 *
 * Cases:
 *   - Round-trip: 3 enqueue → drain → partial ack → drain → full ack → drain empty
 *   - Non-existent ack id → {deleted: 0}, no error
 *   - Empty list ack → {deleted: 0}
 *   - Bad body shape → 400 invalid_envelope_ids
 *   - Non-loopback → 403 loopback_only
 */

import { describe, it, expect, afterEach } from 'vitest';
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

async function buildApp(): Promise<{ app: FastifyInstance; pendingStore: PendingStore }> {
    const audit = new AuditChain();
    const pendingStore = new PendingStore(audit);
    const rateLimiter = new TickRateLimiter();
    const metricsCounter = new WhisperMetricsCounter();
    const registry = { isTombstoned: (_did: string) => false };
    const router = new WhisperRouter({ audit, registry, rateLimiter, pendingStore, metricsCounter });
    const worldClock = { currentTick: () => 1 };

    const app = Fastify({ logger: false });
    await app.register(fastifyRateLimit, {
        max: 1000,
        timeWindow: '1 minute',
        keyGenerator: (req) => (req.params as { did?: string }).did ?? req.ip,
    });
    await app.register(whisperRoutes, {
        deps: { whisperRouter: router, pendingStore, registry, worldClock, metricsCounter },
    });
    await app.ready();

    return { app, pendingStore };
}

describe('GET /whispers/pending + POST /whispers/ack', () => {
    let app: FastifyInstance;
    let pendingStore: PendingStore;

    afterEach(async () => {
        await app.close();
        pendingStore.dispose();
    });

    it('round-trip: 3 enqueue → drain 3 → partial ack 1 → drain 2 → full ack → drain empty', async () => {
        ({ app, pendingStore } = await buildApp());

        const env1 = makeEnvelope({ envelope_id: 'env-1' });
        const env2 = makeEnvelope({ envelope_id: 'env-2' });
        const env3 = makeEnvelope({ envelope_id: 'env-3' });
        pendingStore.enqueue(env1);
        pendingStore.enqueue(env2);
        pendingStore.enqueue(env3);

        // First drain — should see 3 envelopes.
        const drain1 = await app.inject({
            method: 'GET',
            url: `/api/v1/nous/${BOB}/whispers/pending`,
            remoteAddress: '127.0.0.1',
        });
        expect(drain1.statusCode).toBe(200);
        const body1 = drain1.json();
        expect(body1.envelopes).toHaveLength(3);
        const ids1 = body1.envelopes.map((e: Envelope) => e.envelope_id);
        expect(ids1).toContain('env-1');
        expect(ids1).toContain('env-2');
        expect(ids1).toContain('env-3');

        // Ack env-1 only.
        const ack1 = await app.inject({
            method: 'POST',
            url: `/api/v1/nous/${BOB}/whispers/ack`,
            remoteAddress: '127.0.0.1',
            payload: { envelope_ids: ['env-1'] },
        });
        expect(ack1.statusCode).toBe(200);
        expect(ack1.json().deleted).toBe(1);

        // Second drain — should see 2 remaining.
        const drain2 = await app.inject({
            method: 'GET',
            url: `/api/v1/nous/${BOB}/whispers/pending`,
            remoteAddress: '127.0.0.1',
        });
        expect(drain2.statusCode).toBe(200);
        const body2 = drain2.json();
        expect(body2.envelopes).toHaveLength(2);
        const ids2 = body2.envelopes.map((e: Envelope) => e.envelope_id);
        expect(ids2).toContain('env-2');
        expect(ids2).toContain('env-3');
        expect(ids2).not.toContain('env-1');

        // Ack remaining 2.
        const ack2 = await app.inject({
            method: 'POST',
            url: `/api/v1/nous/${BOB}/whispers/ack`,
            remoteAddress: '127.0.0.1',
            payload: { envelope_ids: ['env-2', 'env-3'] },
        });
        expect(ack2.statusCode).toBe(200);
        expect(ack2.json().deleted).toBe(2);

        // Third drain — should be empty.
        const drain3 = await app.inject({
            method: 'GET',
            url: `/api/v1/nous/${BOB}/whispers/pending`,
            remoteAddress: '127.0.0.1',
        });
        expect(drain3.statusCode).toBe(200);
        expect(drain3.json().envelopes).toHaveLength(0);
    });

    it('acking non-existent id → {deleted: 0}, no error', async () => {
        ({ app, pendingStore } = await buildApp());

        const ack = await app.inject({
            method: 'POST',
            url: `/api/v1/nous/${BOB}/whispers/ack`,
            remoteAddress: '127.0.0.1',
            payload: { envelope_ids: ['no-such-id'] },
        });

        expect(ack.statusCode).toBe(200);
        expect(ack.json().deleted).toBe(0);
    });

    it('acking with empty list → {deleted: 0}', async () => {
        ({ app, pendingStore } = await buildApp());

        pendingStore.enqueue(makeEnvelope({ envelope_id: 'env-x' }));

        const ack = await app.inject({
            method: 'POST',
            url: `/api/v1/nous/${BOB}/whispers/ack`,
            remoteAddress: '127.0.0.1',
            payload: { envelope_ids: [] },
        });

        expect(ack.statusCode).toBe(200);
        expect(ack.json().deleted).toBe(0);
        // Envelope still present.
        expect(pendingStore.drainFor(BOB)).toHaveLength(1);
    });

    it('bad body shape (non-array envelope_ids) → 400', async () => {
        ({ app, pendingStore } = await buildApp());

        const ack = await app.inject({
            method: 'POST',
            url: `/api/v1/nous/${BOB}/whispers/ack`,
            remoteAddress: '127.0.0.1',
            payload: { envelope_ids: 'not-an-array' },
        });

        expect(ack.statusCode).toBe(400);
        expect(ack.json().error).toBe('invalid_envelope_ids');
    });

    it('bad body shape (array with non-strings) → 400', async () => {
        ({ app, pendingStore } = await buildApp());

        const ack = await app.inject({
            method: 'POST',
            url: `/api/v1/nous/${BOB}/whispers/ack`,
            remoteAddress: '127.0.0.1',
            payload: { envelope_ids: [123, true] },
        });

        expect(ack.statusCode).toBe(400);
        expect(ack.json().error).toBe('invalid_envelope_ids');
    });

    it('non-loopback request → 403 loopback_only (pending)', async () => {
        ({ app, pendingStore } = await buildApp());

        const resp = await app.inject({
            method: 'GET',
            url: `/api/v1/nous/${BOB}/whispers/pending`,
            remoteAddress: '10.0.0.1',
        });

        expect(resp.statusCode).toBe(403);
        expect(resp.json().error).toBe('loopback_only');
    });

    it('non-loopback request → 403 loopback_only (ack)', async () => {
        ({ app, pendingStore } = await buildApp());

        const resp = await app.inject({
            method: 'POST',
            url: `/api/v1/nous/${BOB}/whispers/ack`,
            remoteAddress: '10.0.0.1',
            payload: { envelope_ids: [] },
        });

        expect(resp.statusCode).toBe(403);
        expect(resp.json().error).toBe('loopback_only');
    });

    it('pending returns empty array for unknown DID', async () => {
        ({ app, pendingStore } = await buildApp());

        const resp = await app.inject({
            method: 'GET',
            url: `/api/v1/nous/${CAROL}/whispers/pending`,
            remoteAddress: '127.0.0.1',
        });

        expect(resp.statusCode).toBe(200);
        expect(resp.json().envelopes).toHaveLength(0);
    });
});
