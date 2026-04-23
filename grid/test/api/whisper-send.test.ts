/**
 * Tests for POST /api/v1/nous/:did/whisper/send
 *
 * Phase 11 Wave 3 — WHISPER-01 / D-11-18 / D-11-19.
 *
 * Cases:
 *   - Happy path → 202 { envelope_id, ciphertext_hash }
 *   - Bad to_did → 400 { error: 'invalid_did' }
 *   - Recipient tombstoned → 202 with synthetic envelope_id (silent-drop D-11-18)
 *   - Self tombstoned → 410 { error: 'self_tombstoned' }
 *   - Non-loopback request → 403 { error: 'loopback_only' }
 *   - Router returns false (rate-limited) → 429 { error: 'rate_limited' }
 *   - Missing ciphertext_blob_b64 → 400 { error: 'invalid_ciphertext' }
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

const ALICE = 'did:noesis:alice000000000000000000000000000000';
const BOB   = 'did:noesis:bob0000000000000000000000000000000';

// A valid 64-byte buffer base64-encoded (used as fake ciphertext).
const FAKE_CT_B64 = Buffer.alloc(80).toString('base64');

function makeDeps(overrides: {
    aliceTombstoned?: boolean;
    bobTombstoned?: boolean;
    rateLimitReject?: boolean;
} = {}) {
    const audit = new AuditChain();
    const pendingStore = new PendingStore(audit);
    const rateLimiter = new TickRateLimiter();
    const metricsCounter = new WhisperMetricsCounter();

    const registry = {
        isTombstoned: vi.fn((did: string) => {
            if (did === ALICE && overrides.aliceTombstoned) return true;
            if (did === BOB   && overrides.bobTombstoned)   return true;
            return false;
        }),
    };

    if (overrides.rateLimitReject) {
        vi.spyOn(rateLimiter, 'tryConsume').mockReturnValue(false);
    }

    const router = new WhisperRouter({ audit, registry, rateLimiter, pendingStore, metricsCounter });
    const worldClock = { currentTick: () => 42 };

    return { audit, pendingStore, router, registry, worldClock, metricsCounter };
}

async function buildApp(deps: ReturnType<typeof makeDeps>): Promise<FastifyInstance> {
    const app = Fastify({ logger: false });
    // @fastify/rate-limit MUST be registered at top level, not inside whisperRoutes plugin.
    await app.register(fastifyRateLimit, {
        max: 1000,  // high limit — @fastify/rate-limit rate-limit tests use this suite only for TickRateLimiter
        timeWindow: '1 minute',
        keyGenerator: (req) => (req.params as { did?: string }).did ?? req.ip,
    });
    await app.register(whisperRoutes, {
        deps: {
            whisperRouter: deps.router,
            pendingStore: deps.pendingStore,
            registry: deps.registry,
            worldClock: deps.worldClock,
            metricsCounter: deps.metricsCounter,
        },
    });
    await app.ready();
    return app;
}

describe('POST /api/v1/nous/:did/whisper/send', () => {
    let app: FastifyInstance;
    let deps: ReturnType<typeof makeDeps>;

    afterEach(async () => {
        await app.close();
        deps.pendingStore.dispose();
    });

    it('happy path — 202 with envelope_id and ciphertext_hash', async () => {
        deps = makeDeps();
        app = await buildApp(deps);

        const resp = await app.inject({
            method: 'POST',
            url: `/api/v1/nous/${ALICE}/whisper/send`,
            remoteAddress: '127.0.0.1',
            payload: { to_did: BOB, ciphertext_blob_b64: FAKE_CT_B64 },
        });

        expect(resp.statusCode).toBe(202);
        const body = resp.json();
        expect(typeof body.envelope_id).toBe('string');
        expect(body.envelope_id.length).toBeGreaterThan(0);
        expect(typeof body.ciphertext_hash).toBe('string');
        expect(body.ciphertext_hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('missing to_did → 400 invalid_did', async () => {
        deps = makeDeps();
        app = await buildApp(deps);

        const resp = await app.inject({
            method: 'POST',
            url: `/api/v1/nous/${ALICE}/whisper/send`,
            remoteAddress: '127.0.0.1',
            payload: { ciphertext_blob_b64: FAKE_CT_B64 },
        });

        expect(resp.statusCode).toBe(400);
        expect(resp.json().error).toBe('invalid_did');
    });

    it('invalid to_did shape → 400 invalid_did', async () => {
        deps = makeDeps();
        app = await buildApp(deps);

        const resp = await app.inject({
            method: 'POST',
            url: `/api/v1/nous/${ALICE}/whisper/send`,
            remoteAddress: '127.0.0.1',
            payload: { to_did: 'not-a-did', ciphertext_blob_b64: FAKE_CT_B64 },
        });

        expect(resp.statusCode).toBe(400);
        expect(resp.json().error).toBe('invalid_did');
    });

    it('missing ciphertext_blob_b64 → 400 invalid_ciphertext', async () => {
        deps = makeDeps();
        app = await buildApp(deps);

        const resp = await app.inject({
            method: 'POST',
            url: `/api/v1/nous/${ALICE}/whisper/send`,
            remoteAddress: '127.0.0.1',
            payload: { to_did: BOB },
        });

        expect(resp.statusCode).toBe(400);
        expect(resp.json().error).toBe('invalid_ciphertext');
    });

    it('recipient tombstoned → 202 silent-drop with synthetic envelope_id (D-11-18)', async () => {
        deps = makeDeps({ bobTombstoned: true });
        app = await buildApp(deps);

        const resp = await app.inject({
            method: 'POST',
            url: `/api/v1/nous/${ALICE}/whisper/send`,
            remoteAddress: '127.0.0.1',
            payload: { to_did: BOB, ciphertext_blob_b64: FAKE_CT_B64 },
        });

        expect(resp.statusCode).toBe(202);
        const body = resp.json();
        expect(body.envelope_id).toMatch(/^silent-drop-/);
        expect(body.ciphertext_hash).toBe('0'.repeat(64));
        // Confirm no envelope was queued.
        expect(deps.pendingStore.drainFor(BOB).length).toBe(0);
    });

    it('sender (self) tombstoned → 410 self_tombstoned', async () => {
        deps = makeDeps({ aliceTombstoned: true });
        app = await buildApp(deps);

        const resp = await app.inject({
            method: 'POST',
            url: `/api/v1/nous/${ALICE}/whisper/send`,
            remoteAddress: '127.0.0.1',
            payload: { to_did: BOB, ciphertext_blob_b64: FAKE_CT_B64 },
        });

        expect(resp.statusCode).toBe(410);
        expect(resp.json().error).toBe('self_tombstoned');
    });

    it('TickRateLimiter rejects → 429 rate_limited', async () => {
        deps = makeDeps({ rateLimitReject: true });
        app = await buildApp(deps);

        const resp = await app.inject({
            method: 'POST',
            url: `/api/v1/nous/${ALICE}/whisper/send`,
            remoteAddress: '127.0.0.1',
            payload: { to_did: BOB, ciphertext_blob_b64: FAKE_CT_B64 },
        });

        expect(resp.statusCode).toBe(429);
        expect(resp.json().error).toBe('rate_limited');
    });

    it('non-loopback request → 403 loopback_only', async () => {
        deps = makeDeps();
        app = await buildApp(deps);

        const resp = await app.inject({
            method: 'POST',
            url: `/api/v1/nous/${ALICE}/whisper/send`,
            remoteAddress: '192.168.1.100',
            payload: { to_did: BOB, ciphertext_blob_b64: FAKE_CT_B64 },
        });

        expect(resp.statusCode).toBe(403);
        expect(resp.json().error).toBe('loopback_only');
    });

    it('response body does not contain plaintext (privacy check)', async () => {
        deps = makeDeps();
        app = await buildApp(deps);

        const resp = await app.inject({
            method: 'POST',
            url: `/api/v1/nous/${ALICE}/whisper/send`,
            remoteAddress: '127.0.0.1',
            payload: { to_did: BOB, ciphertext_blob_b64: FAKE_CT_B64 },
        });

        const bodyStr = resp.body;
        // No base64 ciphertext blob in response — base64 uses +/= beyond hex chars.
        // The ciphertext_hash is a 64-char hex string (a-f0-9 only), which is fine.
        // This regex matches strings that contain the base64-specific chars + or /.
        expect(bodyStr).not.toMatch(/[A-Za-z0-9+/]{60,}=[^"]/);
        // No raw base64 with padding either.
        expect(bodyStr).not.toMatch(/[A-Za-z0-9+/=]{80,}/);
        // Only envelope_id and ciphertext_hash keys.
        const body = JSON.parse(bodyStr);
        expect(Object.keys(body).sort()).toEqual(['ciphertext_hash', 'envelope_id']);
    });
});
