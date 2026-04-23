/**
 * Tests for @fastify/rate-limit on POST /api/v1/nous/:did/whisper/send
 *
 * Phase 11 Wave 3 — WHISPER-01 / D-11-08.
 *
 * The @fastify/rate-limit plugin is the wall-clock DDoS belt (secondary).
 * The TickRateLimiter inside WhisperRouter is the tick-indexed primary.
 *
 * Cases:
 *   - 60 requests from same DID in under 1 minute → all 202
 *   - 61st request from same DID → 429 with @fastify/rate-limit response shape
 *   - Distinct DID → independent budget (separate counter)
 */

import { describe, it, expect, afterEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { AuditChain } from '../../src/audit/chain.js';
import { PendingStore } from '../../src/whisper/pending-store.js';
import { WhisperRouter } from '../../src/whisper/router.js';
import { TickRateLimiter } from '../../src/whisper/rate-limit.js';
import { WhisperMetricsCounter } from '../../src/whisper/metrics-counter.js';
import { whisperRoutes } from '../../src/api/whisper/routes.js';

const ALICE = 'did:noesis:alice000000000000000000000000000000';
const BOB   = 'did:noesis:bob0000000000000000000000000000000';
const CAROL = 'did:noesis:carol00000000000000000000000000000';

// Large tick budget so TickRateLimiter never rejects.
const UNLIMITED_TICK_BUDGET = 10_000;
const FAKE_CT_B64 = Buffer.alloc(80).toString('base64');

async function buildApp(): Promise<{ app: FastifyInstance; pendingStore: PendingStore }> {
    const audit = new AuditChain();
    const pendingStore = new PendingStore(audit);
    const rateLimiter = new TickRateLimiter({ rateBudget: UNLIMITED_TICK_BUDGET, rateWindowTicks: 100_000, envelopeVersion: 1 });
    const metricsCounter = new WhisperMetricsCounter();
    const registry = { isTombstoned: (_did: string) => false };
    const router = new WhisperRouter({ audit, registry, rateLimiter, pendingStore, metricsCounter });
    const worldClock = { currentTick: () => 1 };

    const app = Fastify({ logger: false });
    await app.register(whisperRoutes, {
        deps: { whisperRouter: router, pendingStore, registry, worldClock, metricsCounter },
    });
    await app.ready();

    return { app, pendingStore };
}

describe('@fastify/rate-limit on /whisper/send', () => {
    let app: FastifyInstance;
    let pendingStore: PendingStore;

    afterEach(async () => {
        await app.close();
        pendingStore.dispose();
    });

    it('60 requests from same DID all succeed (202)', async () => {
        ({ app, pendingStore } = await buildApp());

        const results: number[] = [];
        for (let i = 0; i < 60; i++) {
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/nous/${ALICE}/whisper/send`,
                remoteAddress: '127.0.0.1',
                payload: { to_did: BOB, ciphertext_blob_b64: FAKE_CT_B64 },
            });
            results.push(resp.statusCode);
        }

        expect(results.every(s => s === 202)).toBe(true);
    });

    it('61st request from same DID → 429 with @fastify/rate-limit shape', async () => {
        ({ app, pendingStore } = await buildApp());

        // Drain 60 accepted requests.
        for (let i = 0; i < 60; i++) {
            await app.inject({
                method: 'POST',
                url: `/api/v1/nous/${ALICE}/whisper/send`,
                remoteAddress: '127.0.0.1',
                payload: { to_did: BOB, ciphertext_blob_b64: FAKE_CT_B64 },
            });
        }

        // 61st should be rate-limited by @fastify/rate-limit.
        const resp = await app.inject({
            method: 'POST',
            url: `/api/v1/nous/${ALICE}/whisper/send`,
            remoteAddress: '127.0.0.1',
            payload: { to_did: BOB, ciphertext_blob_b64: FAKE_CT_B64 },
        });

        expect(resp.statusCode).toBe(429);
        const body = resp.json();
        // @fastify/rate-limit returns statusCode + error + message shape.
        expect(body.statusCode).toBe(429);
        expect(typeof body.message).toBe('string');
    });

    it('distinct DID has independent budget', async () => {
        ({ app, pendingStore } = await buildApp());

        // Drain ALICE budget.
        for (let i = 0; i < 60; i++) {
            await app.inject({
                method: 'POST',
                url: `/api/v1/nous/${ALICE}/whisper/send`,
                remoteAddress: '127.0.0.1',
                payload: { to_did: BOB, ciphertext_blob_b64: FAKE_CT_B64 },
            });
        }

        // CAROL (different DID) should still have a full budget.
        const resp = await app.inject({
            method: 'POST',
            url: `/api/v1/nous/${CAROL}/whisper/send`,
            remoteAddress: '127.0.0.1',
            payload: { to_did: BOB, ciphertext_blob_b64: FAKE_CT_B64 },
        });

        expect(resp.statusCode).toBe(202);
    });
});
