/**
 * Phase 28 SPAWN-01..06 — POST /api/v1/portal/nous/spawn + related GET endpoints
 *
 * TDD RED scaffold — tests reference contracts that Plan 03 must implement.
 * Tests will FAIL until grid/src/api/portal/spawn.ts is created.
 *
 * Test matrix:
 *   POST /api/v1/portal/nous/spawn:
 *     - 503 spawn_not_enabled when ALLOW_HUMAN_SPAWNED_NOUS unset
 *     - 401 not_authenticated when cookie absent
 *     - 401 invalid_token when cookie malformed
 *     - 400 invalid_body — name too short (< 3 chars)
 *     - 400 invalid_body — name too long (> 32 chars)
 *     - 400 invalid_body — name with hyphen
 *     - 400 invalid_body — name with space
 *     - 400 invalid_body — seed not in enum
 *     - 400 invalid_body — missing region
 *     - 400 payment_not_confirmed — confirmTxPaid returns {confirmed: false}
 *     - 409 already_owns_nous — queryHasNous returns true (SPAWN-06)
 *     - 409 name_taken — queryNameTaken returns true
 *     - 409 payment_already_claimed — isPaymentClaimed returns true
 *     - 200 happy path — returns nous_did matching DID scheme (SPAWN-02)
 *     - 200 happy path — spawnNous called with personalitySeed param
 *     - 200 happy path — recordPayment called with correct args
 *   GET /api/v1/portal/nous/spawn/status/:txHash:
 *     - 200 { confirmed: boolean }
 *     - 401 without auth
 *   GET /api/v1/portal/nous/spawn/config:
 *     - 200 { cost_usdt, treasury_address }
 *   GET /api/v1/portal/nous/spawn/check-name:
 *     - 200 { available: true } when name not taken
 *     - 200 { available: false } when name taken
 *   GET /api/v1/portal/human/me/nous (SPAWN-05):
 *     - 200 { nous: null } when human has no Nous
 *     - 200 { nous: <record> } when human owns a Nous
 */

import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SignJWT } from 'jose';
import {
    registerSpawnRoutes,
    type SpawnHumanNousDeps,
    type NousRecord,
} from '../../src/api/portal/spawn.js';
import { COOKIE_NAME, keyPairPromise } from '../../src/api/portal/auth.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_HUMAN_DID = 'did:noesis:human:0xabcd1234abcd1234abcd1234abcd1234abcd1234';

async function makeToken(did = VALID_HUMAN_DID): Promise<string> {
    const { privateKey } = await keyPairPromise;
    return new SignJWT({ did, eth_address: '0xabcd1234', grid_name: 'genesis' })
        .setProtectedHeader({ alg: 'ES256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKey);
}

function makeStubDeps(overrides: Partial<SpawnHumanNousDeps> = {}): SpawnHumanNousDeps {
    return {
        spawnNous: vi.fn(),
        queryHasNous: vi.fn().mockResolvedValue(false),
        confirmTxPaid: vi.fn().mockResolvedValue({
            confirmed: true,
            amountUsdt: '50',
            from: '0xabc1234',
        }),
        recordPayment: vi.fn().mockResolvedValue(undefined),
        isPaymentClaimed: vi.fn().mockResolvedValue(false),
        queryNameTaken: vi.fn().mockResolvedValue(false),
        getOwnedNous: vi.fn().mockResolvedValue(null),
        ...overrides,
    };
}

async function buildApp(deps: SpawnHumanNousDeps): Promise<FastifyInstance> {
    const app = Fastify({ logger: false });
    await app.register(cookie);
    await registerSpawnRoutes(app, deps);
    return app;
}

const VALID_TX_HASH = '0x' + 'a'.repeat(64);
const VALID_BODY = {
    name: 'eidolon',
    seed: 'Explorer',
    region: 'agora',
    tx_hash: VALID_TX_HASH,
};

// ---------------------------------------------------------------------------
// POST /api/v1/portal/nous/spawn
// ---------------------------------------------------------------------------

describe('POST /api/v1/portal/nous/spawn', () => {
    beforeEach(() => {
        process.env['ALLOW_HUMAN_SPAWNED_NOUS'] = 'true';
    });
    afterEach(() => {
        delete process.env['ALLOW_HUMAN_SPAWNED_NOUS'];
        delete process.env['SPAWN_COST_USDT'];
        delete process.env['GRID_TREASURY_ADDRESS'];
        vi.restoreAllMocks();
    });

    it('returns 503 spawn_not_enabled when ALLOW_HUMAN_SPAWNED_NOUS unset', async () => {
        delete process.env['ALLOW_HUMAN_SPAWNED_NOUS'];
        const app = await buildApp(makeStubDeps());
        const token = await makeToken();
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/portal/nous/spawn',
            cookies: { [COOKIE_NAME]: token },
            payload: VALID_BODY,
        });
        expect(res.statusCode).toBe(503);
        expect(res.json()).toEqual({ error: 'spawn_not_enabled' });
    });

    it('returns 401 not_authenticated when cookie absent', async () => {
        const app = await buildApp(makeStubDeps());
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/portal/nous/spawn',
            payload: VALID_BODY,
        });
        expect(res.statusCode).toBe(401);
        expect(res.json()).toEqual({ error: 'not_authenticated' });
    });

    it('returns 401 invalid_token when cookie is malformed', async () => {
        const app = await buildApp(makeStubDeps());
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/portal/nous/spawn',
            cookies: { [COOKIE_NAME]: 'not.a.valid.jwt.at.all' },
            payload: VALID_BODY,
        });
        expect(res.statusCode).toBe(401);
        expect(res.json()).toEqual({ error: 'invalid_token' });
    });

    // ---------------------------------------------------------------------------
    // Name validation (SPAWN-02)
    // ---------------------------------------------------------------------------

    describe('name validation (SPAWN-02)', () => {
        it('rejects name shorter than 3 chars (returns 400 invalid_body)', async () => {
            const app = await buildApp(makeStubDeps());
            const token = await makeToken();
            const res = await app.inject({
                method: 'POST',
                url: '/api/v1/portal/nous/spawn',
                cookies: { [COOKIE_NAME]: token },
                payload: { ...VALID_BODY, name: 'ab' },
            });
            expect(res.statusCode).toBe(400);
            expect(res.json().error).toBe('invalid_body');
        });

        it('rejects name longer than 32 chars (returns 400 invalid_body)', async () => {
            const app = await buildApp(makeStubDeps());
            const token = await makeToken();
            const res = await app.inject({
                method: 'POST',
                url: '/api/v1/portal/nous/spawn',
                cookies: { [COOKIE_NAME]: token },
                payload: { ...VALID_BODY, name: 'a'.repeat(33) },
            });
            expect(res.statusCode).toBe(400);
            expect(res.json().error).toBe('invalid_body');
        });

        it('rejects name with hyphen (returns 400 invalid_body)', async () => {
            const app = await buildApp(makeStubDeps());
            const token = await makeToken();
            const res = await app.inject({
                method: 'POST',
                url: '/api/v1/portal/nous/spawn',
                cookies: { [COOKIE_NAME]: token },
                payload: { ...VALID_BODY, name: 'hello-world' },
            });
            expect(res.statusCode).toBe(400);
            expect(res.json().error).toBe('invalid_body');
        });

        it('rejects name with space (returns 400 invalid_body)', async () => {
            const app = await buildApp(makeStubDeps());
            const token = await makeToken();
            const res = await app.inject({
                method: 'POST',
                url: '/api/v1/portal/nous/spawn',
                cookies: { [COOKIE_NAME]: token },
                payload: { ...VALID_BODY, name: 'hello world' },
            });
            expect(res.statusCode).toBe(400);
            expect(res.json().error).toBe('invalid_body');
        });

        it('accepts name matching /^[a-zA-Z0-9_]{3,32}$/ (returns 200)', async () => {
            const app = await buildApp(makeStubDeps());
            const token = await makeToken();
            const res = await app.inject({
                method: 'POST',
                url: '/api/v1/portal/nous/spawn',
                cookies: { [COOKIE_NAME]: token },
                payload: { ...VALID_BODY, name: 'eidolon' },
            });
            expect(res.statusCode).toBe(200);
        });
    });

    // ---------------------------------------------------------------------------
    // Seed enum validation (SPAWN-02)
    // ---------------------------------------------------------------------------

    describe('seed enum validation (SPAWN-02)', () => {
        it('rejects unknown seed (returns 400 invalid_body)', async () => {
            const app = await buildApp(makeStubDeps());
            const token = await makeToken();
            const res = await app.inject({
                method: 'POST',
                url: '/api/v1/portal/nous/spawn',
                cookies: { [COOKIE_NAME]: token },
                payload: { ...VALID_BODY, seed: 'Wizard' },
            });
            expect(res.statusCode).toBe(400);
            expect(res.json().error).toBe('invalid_body');
        });

        it.each(['Explorer', 'Scholar', 'Merchant', 'Guardian'])(
            'accepts seed %s (returns 200)',
            async (seed) => {
                const app = await buildApp(makeStubDeps());
                const token = await makeToken();
                const res = await app.inject({
                    method: 'POST',
                    url: '/api/v1/portal/nous/spawn',
                    cookies: { [COOKIE_NAME]: token },
                    payload: { ...VALID_BODY, seed },
                });
                expect(res.statusCode).toBe(200);
            },
        );
    });

    // ---------------------------------------------------------------------------
    // Region validation
    // ---------------------------------------------------------------------------

    it('returns 400 invalid_body when region is missing', async () => {
        const app = await buildApp(makeStubDeps());
        const token = await makeToken();
        const { region: _r, ...bodyWithoutRegion } = VALID_BODY;
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/portal/nous/spawn',
            cookies: { [COOKIE_NAME]: token },
            payload: bodyWithoutRegion,
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('invalid_body');
    });

    // ---------------------------------------------------------------------------
    // Payment confirmation (SPAWN-01)
    // ---------------------------------------------------------------------------

    describe('payment confirmation (SPAWN-01)', () => {
        it('returns 400 payment_not_confirmed when confirmTxPaid returns false', async () => {
            const deps = makeStubDeps({
                confirmTxPaid: vi.fn().mockResolvedValue({ confirmed: false }),
            });
            const app = await buildApp(deps);
            const token = await makeToken();
            const res = await app.inject({
                method: 'POST',
                url: '/api/v1/portal/nous/spawn',
                cookies: { [COOKIE_NAME]: token },
                payload: VALID_BODY,
            });
            expect(res.statusCode).toBe(400);
            expect(res.json()).toEqual({ error: 'payment_not_confirmed' });
        });

        it('returns 200 when payment is confirmed', async () => {
            const app = await buildApp(makeStubDeps());
            const token = await makeToken();
            const res = await app.inject({
                method: 'POST',
                url: '/api/v1/portal/nous/spawn',
                cookies: { [COOKIE_NAME]: token },
                payload: VALID_BODY,
            });
            expect(res.statusCode).toBe(200);
            expect(res.json().ok).toBe(true);
        });

        it('returns 409 payment_already_claimed on replay attack', async () => {
            const deps = makeStubDeps({
                isPaymentClaimed: vi.fn().mockResolvedValue(true),
            });
            const app = await buildApp(deps);
            const token = await makeToken();
            const res = await app.inject({
                method: 'POST',
                url: '/api/v1/portal/nous/spawn',
                cookies: { [COOKIE_NAME]: token },
                payload: VALID_BODY,
            });
            expect(res.statusCode).toBe(409);
            expect(res.json()).toEqual({ error: 'payment_already_claimed' });
        });

        it('calls recordPayment after successful spawn', async () => {
            const deps = makeStubDeps();
            const app = await buildApp(deps);
            const token = await makeToken();
            await app.inject({
                method: 'POST',
                url: '/api/v1/portal/nous/spawn',
                cookies: { [COOKIE_NAME]: token },
                payload: VALID_BODY,
            });
            expect(deps.recordPayment).toHaveBeenCalledWith(
                VALID_TX_HASH,
                VALID_HUMAN_DID,
                expect.stringMatching(/^did:noesis:human-nous:/),
            );
        });
    });

    // ---------------------------------------------------------------------------
    // One-Nous cap (SPAWN-06)
    // ---------------------------------------------------------------------------

    describe('one-Nous cap (SPAWN-06)', () => {
        it('returns 409 already_owns_nous when queryHasNous returns true', async () => {
            const deps = makeStubDeps({
                queryHasNous: vi.fn().mockResolvedValue(true),
            });
            const app = await buildApp(deps);
            const token = await makeToken();
            const res = await app.inject({
                method: 'POST',
                url: '/api/v1/portal/nous/spawn',
                cookies: { [COOKIE_NAME]: token },
                payload: VALID_BODY,
            });
            expect(res.statusCode).toBe(409);
            expect(res.json()).toEqual({ error: 'already_owns_nous' });
        });
    });

    // ---------------------------------------------------------------------------
    // Name uniqueness
    // ---------------------------------------------------------------------------

    describe('name uniqueness', () => {
        it('returns 409 name_taken when queryNameTaken returns true', async () => {
            const deps = makeStubDeps({
                queryNameTaken: vi.fn().mockResolvedValue(true),
            });
            const app = await buildApp(deps);
            const token = await makeToken();
            const res = await app.inject({
                method: 'POST',
                url: '/api/v1/portal/nous/spawn',
                cookies: { [COOKIE_NAME]: token },
                payload: VALID_BODY,
            });
            expect(res.statusCode).toBe(409);
            expect(res.json()).toEqual({ error: 'name_taken' });
        });
    });

    // ---------------------------------------------------------------------------
    // DID scheme (SPAWN-02)
    // ---------------------------------------------------------------------------

    describe('DID scheme (SPAWN-02)', () => {
        it('generates nous_did matching did:noesis:human-nous:<addr-prefix>-<name>', async () => {
            const deps = makeStubDeps();
            const app = await buildApp(deps);
            const token = await makeToken();
            const res = await app.inject({
                method: 'POST',
                url: '/api/v1/portal/nous/spawn',
                cookies: { [COOKIE_NAME]: token },
                payload: VALID_BODY,
            });
            expect(res.statusCode).toBe(200);
            const body = res.json() as { ok: boolean; nous_did: string };
            expect(body.nous_did).toMatch(/^did:noesis:human-nous:[a-f0-9]{6,8}-eidolon$/);
        });

        it('passes personalitySeed to spawnNous (SPAWN-02)', async () => {
            const deps = makeStubDeps();
            const app = await buildApp(deps);
            const token = await makeToken();
            await app.inject({
                method: 'POST',
                url: '/api/v1/portal/nous/spawn',
                cookies: { [COOKIE_NAME]: token },
                payload: { ...VALID_BODY, seed: 'Scholar' },
            });
            expect(deps.spawnNous).toHaveBeenCalledWith(
                'eidolon',
                expect.stringMatching(/^did:noesis:human-nous:/),
                expect.any(String),
                'agora',
                VALID_HUMAN_DID,
                'Scholar',
            );
        });
    });
});

// ---------------------------------------------------------------------------
// GET /api/v1/portal/nous/spawn/status/:txHash
// ---------------------------------------------------------------------------

describe('GET /api/v1/portal/nous/spawn/status/:txHash', () => {
    afterEach(() => {
        delete process.env['ALLOW_HUMAN_SPAWNED_NOUS'];
        vi.restoreAllMocks();
    });

    it('returns { confirmed: boolean } for a valid txHash', async () => {
        process.env['ALLOW_HUMAN_SPAWNED_NOUS'] = 'true';
        const deps = makeStubDeps({
            confirmTxPaid: vi.fn().mockResolvedValue({ confirmed: true, amountUsdt: '50' }),
        });
        const app = await buildApp(deps);
        const token = await makeToken();
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/portal/nous/spawn/status/${VALID_TX_HASH}`,
            cookies: { [COOKIE_NAME]: token },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as { confirmed: boolean };
        expect(typeof body.confirmed).toBe('boolean');
    });

    it('returns 401 without authentication', async () => {
        process.env['ALLOW_HUMAN_SPAWNED_NOUS'] = 'true';
        const app = await buildApp(makeStubDeps());
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/portal/nous/spawn/status/${VALID_TX_HASH}`,
        });
        expect(res.statusCode).toBe(401);
    });
});

// ---------------------------------------------------------------------------
// GET /api/v1/portal/nous/spawn/config
// ---------------------------------------------------------------------------

describe('GET /api/v1/portal/nous/spawn/config', () => {
    afterEach(() => {
        delete process.env['ALLOW_HUMAN_SPAWNED_NOUS'];
        delete process.env['SPAWN_COST_USDT'];
        delete process.env['GRID_TREASURY_ADDRESS'];
        vi.restoreAllMocks();
    });

    it('returns { cost_usdt, treasury_address } from env vars', async () => {
        process.env['ALLOW_HUMAN_SPAWNED_NOUS'] = 'true';
        process.env['SPAWN_COST_USDT'] = '50';
        process.env['GRID_TREASURY_ADDRESS'] = '0x' + '1'.repeat(40);
        const app = await buildApp(makeStubDeps());
        const token = await makeToken();
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal/nous/spawn/config',
            cookies: { [COOKIE_NAME]: token },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({
            cost_usdt: '50',
            treasury_address: '0x' + '1'.repeat(40),
        });
    });
});

// ---------------------------------------------------------------------------
// GET /api/v1/portal/nous/spawn/check-name
// ---------------------------------------------------------------------------

describe('GET /api/v1/portal/nous/spawn/check-name', () => {
    afterEach(() => {
        delete process.env['ALLOW_HUMAN_SPAWNED_NOUS'];
        vi.restoreAllMocks();
    });

    it('returns { available: true } when name not taken', async () => {
        process.env['ALLOW_HUMAN_SPAWNED_NOUS'] = 'true';
        const app = await buildApp(makeStubDeps({ queryNameTaken: vi.fn().mockResolvedValue(false) }));
        const token = await makeToken();
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal/nous/spawn/check-name?name=eidolon',
            cookies: { [COOKIE_NAME]: token },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({ available: true });
    });

    it('returns { available: false } when queryNameTaken returns true', async () => {
        process.env['ALLOW_HUMAN_SPAWNED_NOUS'] = 'true';
        const app = await buildApp(makeStubDeps({ queryNameTaken: vi.fn().mockResolvedValue(true) }));
        const token = await makeToken();
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal/nous/spawn/check-name?name=eidolon',
            cookies: { [COOKIE_NAME]: token },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({ available: false });
    });
});

// ---------------------------------------------------------------------------
// GET /api/v1/portal/human/me/nous (SPAWN-05)
// ---------------------------------------------------------------------------

describe('GET /api/v1/portal/human/me/nous (SPAWN-05)', () => {
    afterEach(() => {
        delete process.env['ALLOW_HUMAN_SPAWNED_NOUS'];
        vi.restoreAllMocks();
    });

    it('returns { nous: null } when human has no Nous', async () => {
        process.env['ALLOW_HUMAN_SPAWNED_NOUS'] = 'true';
        const app = await buildApp(makeStubDeps({ getOwnedNous: vi.fn().mockResolvedValue(null) }));
        const token = await makeToken();
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal/human/me/nous',
            cookies: { [COOKIE_NAME]: token },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({ nous: null });
    });

    it('returns { nous: <record> } when human owns a Nous', async () => {
        process.env['ALLOW_HUMAN_SPAWNED_NOUS'] = 'true';
        const fakeNous: NousRecord = {
            did: 'did:noesis:human-nous:0xabcd12-eidolon',
            name: 'eidolon',
            region: 'agora',
            personality_seed: 'Explorer',
            spawned_at_tick: 1234,
        };
        const app = await buildApp(makeStubDeps({ getOwnedNous: vi.fn().mockResolvedValue(fakeNous) }));
        const token = await makeToken();
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal/human/me/nous',
            cookies: { [COOKIE_NAME]: token },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({ nous: fakeNous });
    });

    it('returns 401 without authentication', async () => {
        process.env['ALLOW_HUMAN_SPAWNED_NOUS'] = 'true';
        const app = await buildApp(makeStubDeps());
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal/human/me/nous',
        });
        expect(res.statusCode).toBe(401);
    });
});
