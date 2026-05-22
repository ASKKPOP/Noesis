/**
 * Phase 26 ONBOARD-04 — GET /api/v1/portal/auth/me: onboarded field
 *
 * Tests that GET /me returns `onboarded: boolean` based on the DB query result.
 * The pool is injected via GridServices.humanPool so no real DB is needed.
 *
 * Test matrix:
 *   - onboarding_goal = null → onboarded: false
 *   - onboarding_goal = 'some text' → onboarded: true
 *   - DB query throws → onboarded: false (fail-safe, no 503)
 *   - No humanPool → onboarded: false (fail-safe default)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SignJWT } from 'jose';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { HumanRegistry } from '../../src/human/HumanRegistry.js';
import { keyPairPromise, COOKIE_NAME } from '../../src/api/portal/auth.js';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../../src/api/server.js';

const TEST_DID = 'did:noesis:human:0xaabbccddeeff00112233445566778899aabbccdd';

async function makeJwt(did = TEST_DID): Promise<string> {
    const { privateKey } = await keyPairPromise;
    return new SignJWT({ did, eth_address: '0xaabb', grid_name: 'genesis', region: 'agora' })
        .setProtectedHeader({ alg: 'ES256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(privateKey);
}

function makePool(goal: string | null | 'THROW'): GridServices['humanPool'] {
    return {
        async query(_sql: string, _values?: unknown[]) {
            if (goal === 'THROW') throw new Error('DB connection lost');
            const rows = goal === null
                ? [{ onboarding_goal: null }]
                : [{ onboarding_goal: goal }];
            return [rows, []];
        },
    };
}

let token: string;

// Suites share a token but each needs a different pool — we create apps per suite.

describe('GET /api/v1/portal/auth/me — onboarded: false when goal is null', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        token = await makeJwt();
        const clock = new WorldClock({ tickRateMs: 100_000 });
        app = buildServer({
            clock,
            space: new SpatialMap(),
            logos: new LogosEngine(),
            audit: new AuditChain(),
            gridName: 'genesis',
            humanRegistry: new HumanRegistry(),
            humanPool: makePool(null),
        });
        await app.ready();
    });

    afterAll(async () => { await app.close(); });

    it('returns onboarded: false when DB row has onboarding_goal = null', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal/auth/me',
            cookies: { [COOKIE_NAME]: token },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().onboarded).toBe(false);
    });
});

describe('GET /api/v1/portal/auth/me — onboarded: true when goal is set', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        const clock = new WorldClock({ tickRateMs: 100_000 });
        app = buildServer({
            clock,
            space: new SpatialMap(),
            logos: new LogosEngine(),
            audit: new AuditChain(),
            gridName: 'genesis',
            humanRegistry: new HumanRegistry(),
            humanPool: makePool('learn about AI'),
        });
        await app.ready();
    });

    afterAll(async () => { await app.close(); });

    it('returns onboarded: true when DB row has onboarding_goal = some text', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal/auth/me',
            cookies: { [COOKIE_NAME]: token },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().onboarded).toBe(true);
    });
});

describe('GET /api/v1/portal/auth/me — fail-safe on DB error', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        const clock = new WorldClock({ tickRateMs: 100_000 });
        app = buildServer({
            clock,
            space: new SpatialMap(),
            logos: new LogosEngine(),
            audit: new AuditChain(),
            gridName: 'genesis',
            humanRegistry: new HumanRegistry(),
            humanPool: makePool('THROW'),
        });
        await app.ready();
    });

    afterAll(async () => { await app.close(); });

    it('returns onboarded: false (fail-safe) when DB query throws — no 503', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal/auth/me',
            cookies: { [COOKIE_NAME]: token },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().onboarded).toBe(false);
    });
});

describe('GET /api/v1/portal/auth/me — fail-safe when no humanPool', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        const clock = new WorldClock({ tickRateMs: 100_000 });
        app = buildServer({
            clock,
            space: new SpatialMap(),
            logos: new LogosEngine(),
            audit: new AuditChain(),
            gridName: 'genesis',
            humanRegistry: new HumanRegistry(),
        });
        await app.ready();
    });

    afterAll(async () => { await app.close(); });

    it('returns onboarded: false when no humanPool is configured', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal/auth/me',
            cookies: { [COOKIE_NAME]: token },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().onboarded).toBe(false);
    });
});
