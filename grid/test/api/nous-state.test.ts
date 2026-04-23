/**
 * Plan 04-03 Task 1: GET /api/v1/nous/:did/state — inspector proxy.
 *
 * Contract (D1/D5, CONTEXT 04):
 *   1. DID regex miss   → 400 { error: 'invalid_did' }
 *   2. Unknown DID      → 404 { error: 'unknown_nous' }
 *   3. Disconnected     → 503 { error: 'brain_unavailable' }
 *   4. RPC throws       → 503 { error: 'brain_unavailable' } (never leak err.message)
 *   5. Success          → 200 with raw Plan 02 widened state dict
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { ShopRegistry } from '../../src/economy/shop-registry.js';
import type { FastifyInstance } from 'fastify';

interface FakeRunner {
    connected: boolean;
    getState: () => Promise<Record<string, unknown>>;
}

const STATE_FIXTURE: Record<string, unknown> = {
    name: 'Sophia',
    archetype: 'The Philosopher',
    did: 'did:noesis:sophia',
    grid_name: 'genesis',
    location: 'Agora Central',
    mood: 'curious',
    active_goals: ['Learn about the Grid'],
    psyche: {
        openness: 0.8,
        conscientiousness: 0.5,
        extraversion: 0.5,
        agreeableness: 0.8,
        neuroticism: 0.5,
    },
    thymos: { mood: 'curious', emotions: { curiosity: 0.0 } },
    telos: { active_goals: [{ id: 'abc', description: 'Learn', priority: 0.8 }] },
    memory_highlights: [],
};

function seedServer(
    runnerMap: Map<string, FakeRunner>,
): { app: FastifyInstance; clock: WorldClock } {
    const clock = new WorldClock({ tickRateMs: 100_000 });
    const space = new SpatialMap();
    const logos = new LogosEngine();
    const audit = new AuditChain();
    const registry = new NousRegistry();
    const shops = new ShopRegistry();

    const getRunner = (did: string): FakeRunner | undefined => runnerMap.get(did);

    const app = buildServer({
        clock, space, logos, audit, gridName: 'genesis', registry, shops,
        getRunner: getRunner as unknown as (did: string) => { connected: boolean; getState: () => Promise<Record<string, unknown>> } | undefined,
    });
    return { app, clock };
}

describe('GET /api/v1/nous/:did/state — DID validation', () => {
    let app: FastifyInstance;
    let clock: WorldClock;

    beforeAll(async () => {
        ({ app, clock } = seedServer(new Map()));
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
        clock.stop();
    });

    it('rejects a malformed DID with 400 invalid_did', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/nous/not-a-did/state',
        });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toEqual({ error: 'invalid_did' });
    });

    it('rejects a DID with uppercase forbidden characters (special chars)', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/nous/did%3Akey%3Asophia/state', // did:noesis:sophia — wrong namespace
        });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toEqual({ error: 'invalid_did' });
    });

    it('returns 404 unknown_nous when DID is well-formed but not registered', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/nous/did:noesis:ghost/state',
        });
        expect(res.statusCode).toBe(404);
        expect(res.json()).toEqual({ error: 'unknown_nous' });
    });
});

describe('GET /api/v1/nous/:did/state — brain unavailable branches', () => {
    it('returns 503 brain_unavailable when runner.connected is false', async () => {
        const runners = new Map<string, FakeRunner>();
        runners.set('did:noesis:sophia', {
            connected: false,
            getState: async () => STATE_FIXTURE,
        });
        const { app, clock } = seedServer(runners);
        await app.ready();
        try {
            const res = await app.inject({
                method: 'GET',
                url: '/api/v1/nous/did:noesis:sophia/state',
            });
            expect(res.statusCode).toBe(503);
            expect(res.json()).toEqual({ error: 'brain_unavailable' });
        } finally {
            await app.close();
            clock.stop();
        }
    });

    it('returns 503 brain_unavailable when getState throws, never leaking err.message', async () => {
        const runners = new Map<string, FakeRunner>();
        const sensitiveErrorMessage = 'SECRET_BRAIN_INTERNAL_PATH_/tmp/leak.sock';
        runners.set('did:noesis:sophia', {
            connected: true,
            getState: vi.fn().mockRejectedValue(new Error(sensitiveErrorMessage)),
        });
        const { app, clock } = seedServer(runners);
        await app.ready();
        try {
            const res = await app.inject({
                method: 'GET',
                url: '/api/v1/nous/did:noesis:sophia/state',
            });
            expect(res.statusCode).toBe(503);
            expect(res.json()).toEqual({ error: 'brain_unavailable' });
            // Privacy invariant: raw error must never leak to client.
            expect(res.payload).not.toContain(sensitiveErrorMessage);
        } finally {
            await app.close();
            clock.stop();
        }
    });
});

describe('GET /api/v1/nous/:did/state — successful proxy', () => {
    it('returns 200 with the Plan 02 widened shape verbatim', async () => {
        const runners = new Map<string, FakeRunner>();
        runners.set('did:noesis:sophia', {
            connected: true,
            getState: async () => STATE_FIXTURE,
        });
        const { app, clock } = seedServer(runners);
        await app.ready();
        try {
            const res = await app.inject({
                method: 'GET',
                url: '/api/v1/nous/did:noesis:sophia/state',
            });
            expect(res.statusCode).toBe(200);
            const body = res.json() as Record<string, unknown>;
            // Plan 02 keys are present verbatim
            expect(body).toHaveProperty('psyche');
            expect(body).toHaveProperty('thymos');
            expect(body).toHaveProperty('telos');
            expect(body).toHaveProperty('memory_highlights');
            expect(body).toHaveProperty('did', 'did:noesis:sophia');
            expect(body).toHaveProperty('grid_name', 'genesis');
        } finally {
            await app.close();
            clock.stop();
        }
    });
});
