/**
 * Phase 26 ONBOARD-04 — PATCH /api/v1/portal/auth/me
 *
 * Tests the new PATCH /me endpoint that stores onboarding_goal to DB.
 *
 * Test matrix:
 *   - No cookie → 401 not_authenticated
 *   - Invalid JWT → 401 invalid_token
 *   - Missing onboarding_goal → 400 invalid_request
 *   - Empty string onboarding_goal → 400 invalid_request
 *   - Valid JWT + non-empty goal → 200 { ok: true }
 *   - Goal exceeding 2000 chars → 200 { ok: true } (truncated at 2000)
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

async function makeJwt(): Promise<string> {
    const { privateKey } = await keyPairPromise;
    return new SignJWT({ did: TEST_DID, eth_address: '0xaabb', grid_name: 'genesis' })
        .setProtectedHeader({ alg: 'ES256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(privateKey);
}

function makePool(): GridServices['humanPool'] & { lastUpdate: { did: string; goal: string } | null } {
    const store: { lastUpdate: { did: string; goal: string } | null } = { lastUpdate: null };
    const pool = {
        lastUpdate: store.lastUpdate,
        async query(sql: string, values?: unknown[]) {
            if (sql.includes('UPDATE')) {
                store.lastUpdate = { did: (values as string[])[1], goal: (values as string[])[0] };
                pool.lastUpdate = store.lastUpdate;
            }
            return [[], []];
        },
    };
    return pool;
}

function buildApp(humanPool?: GridServices['humanPool']): FastifyInstance {
    const clock = new WorldClock({ tickRateMs: 100_000 });
    return buildServer({
        clock,
        space: new SpatialMap(),
        logos: new LogosEngine(),
        audit: new AuditChain(),
        gridName: 'genesis',
        humanRegistry: new HumanRegistry(),
        humanPool,
    });
}

describe('PATCH /api/v1/portal/auth/me — store onboarding_goal', () => {
    let validToken: string;
    let app: FastifyInstance;

    beforeAll(async () => {
        validToken = await makeJwt();
        app = buildApp(makePool());
        await app.ready();
    });

    afterAll(async () => { await app.close(); });

    it('returns 401 when no cookie is set', async () => {
        const res = await app.inject({
            method: 'PATCH',
            url: '/api/v1/portal/auth/me',
            payload: { onboarding_goal: 'learn AI' },
        });
        expect(res.statusCode).toBe(401);
        expect(res.json().error).toBe('not_authenticated');
    });

    it('returns 401 when JWT is invalid', async () => {
        const res = await app.inject({
            method: 'PATCH',
            url: '/api/v1/portal/auth/me',
            cookies: { [COOKIE_NAME]: 'not.a.valid.jwt' },
            payload: { onboarding_goal: 'learn AI' },
        });
        expect(res.statusCode).toBe(401);
        expect(res.json().error).toBe('invalid_token');
    });

    it('returns 400 when onboarding_goal is missing from body', async () => {
        const res = await app.inject({
            method: 'PATCH',
            url: '/api/v1/portal/auth/me',
            cookies: { [COOKIE_NAME]: validToken },
            payload: {},
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('invalid_request');
    });

    it('returns 400 when onboarding_goal is an empty string', async () => {
        const res = await app.inject({
            method: 'PATCH',
            url: '/api/v1/portal/auth/me',
            cookies: { [COOKIE_NAME]: validToken },
            payload: { onboarding_goal: '' },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('invalid_request');
    });

    it('returns 400 when onboarding_goal is whitespace-only', async () => {
        const res = await app.inject({
            method: 'PATCH',
            url: '/api/v1/portal/auth/me',
            cookies: { [COOKIE_NAME]: validToken },
            payload: { onboarding_goal: '   ' },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('invalid_request');
    });

    it('returns 200 { ok: true } when authenticated with valid non-empty goal', async () => {
        const res = await app.inject({
            method: 'PATCH',
            url: '/api/v1/portal/auth/me',
            cookies: { [COOKIE_NAME]: validToken },
            payload: { onboarding_goal: 'I want to learn about AI minds' },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().ok).toBe(true);
    });

    it('truncates goal at 2000 chars and still returns 200', async () => {
        const longGoal = 'x'.repeat(3000);
        const res = await app.inject({
            method: 'PATCH',
            url: '/api/v1/portal/auth/me',
            cookies: { [COOKIE_NAME]: validToken },
            payload: { onboarding_goal: longGoal },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().ok).toBe(true);
    });
});
