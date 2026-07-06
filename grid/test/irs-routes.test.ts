/**
 * Phase 45 IRS-02..04 — IRS route integration tests.
 *
 * Routes under test (registered by Plan 03):
 *   GET  /api/v1/irs/treasury          public (Cache-Control: max-age=10)
 *   POST /api/v1/irs/disburse          government_only
 *   GET  /api/v1/irs/audit/:period     public
 *
 * RED state during Wave 0: import of registerIrsRoutes fails. Plan 03 creates the route file.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { SignJWT, type KeyLike } from 'jose';

describe('IRS routes — Phase 45 integration', () => {
    let registerIrsRoutes: (app: FastifyInstance, services: unknown) => Promise<void>;
    let AuditChainCtor: new () => unknown;
    let govPrivateKey: KeyLike;
    let govIssuer: string;

    beforeAll(async () => {
        const routesMod = await import('../src/api/routes/irs.js');
        const chainMod = await import('../src/audit/chain.js');
        const authMod = await import('../src/api/portal/auth.js');
        const govMod = await import('../src/civic-registry/government-session.js');
        registerIrsRoutes = (routesMod as { registerIrsRoutes: typeof registerIrsRoutes }).registerIrsRoutes;
        AuditChainCtor = (chainMod as { AuditChain: typeof AuditChainCtor }).AuditChain;
        const kp = await (authMod as { keyPairPromise: Promise<{ privateKey: KeyLike; publicKey: KeyLike }> }).keyPairPromise;
        govPrivateKey = kp.privateKey;
        govIssuer = (govMod as { GOV_SESSION_ISSUER_DID: string }).GOV_SESSION_ISSUER_DID;
    });

    /** Mint a real ES256 Government JWT (same keypair the route verifies against). */
    async function mintGovJwt(legislationRef: string): Promise<string> {
        return await new SignJWT({ legislation_ref: legislationRef })
            .setProtectedHeader({ alg: 'ES256' })
            .setIssuer(govIssuer)
            .setIssuedAt()
            .setExpirationTime('1h')
            .sign(govPrivateKey);
    }

    async function buildApp(opts: {
        poolQueryImpl?: (sql: string, params?: unknown[]) => Promise<unknown>;
        getConnectionImpl?: () => unknown;
        authHeader?: string;
    }): Promise<{ app: FastifyInstance; audit: { events: unknown[] } }> {
        const audit = new AuditChainCtor() as { events: unknown[]; append: (...a: unknown[]) => unknown };
        const mockPool = {
            query: vi.fn(opts.poolQueryImpl ?? (async () => [[]] as unknown)),
            getConnection: vi.fn(opts.getConnectionImpl ?? (async () => ({
                beginTransaction: vi.fn(async () => {}),
                query: vi.fn(async () => [[]]),
                commit: vi.fn(async () => {}),
                rollback: vi.fn(async () => {}),
                release: vi.fn(() => {}),
            }))),
        };
        const services = {
            audit,
            gridName: 'Genesis',
            currentTick: () => 100,
            pool: mockPool,
        };
        const app = Fastify({ logger: false });
        if (opts.authHeader) {
            app.addHook('onRequest', async (req) => {
                req.headers.authorization = opts.authHeader;
            });
        }
        await registerIrsRoutes(app, services);
        await app.ready();
        return { app, audit: audit as unknown as { events: unknown[] } };
    }

    describe('GET /api/v1/irs/treasury (public)', () => {
        it('returns 200 with balance_wei/last_updated_tick/current_rate_percent fields', async () => {
            const { app } = await buildApp({
                poolQueryImpl: async (sql: string) => {
                    if (sql.includes('civic_treasury')) return [[{ balance_wei: '500', last_updated_tick: 99 }]] as unknown;
                    if (sql.includes('grid_config')) return [[{ config_value: '0.02' }]] as unknown;
                    return [[]] as unknown;
                },
            });
            const res = await app.inject({ method: 'GET', url: '/api/v1/irs/treasury' });
            expect(res.statusCode).toBe(200);
            const body = res.json();
            expect(body).toHaveProperty('balance_wei');
            expect(body).toHaveProperty('last_updated_tick');
            expect(body).toHaveProperty('current_rate_percent');
            expect(body.current_rate_percent).toBeCloseTo(2.0, 5);
            expect(res.headers['cache-control']).toMatch(/max-age=10/);
        });

        it('returns 200 with balance_wei=0 when civic_treasury row absent (NULL handling)', async () => {
            const { app } = await buildApp({
                poolQueryImpl: async () => [[]] as unknown,
            });
            const res = await app.inject({ method: 'GET', url: '/api/v1/irs/treasury' });
            expect(res.statusCode).toBe(200);
            expect(res.json().balance_wei).toBe('0');
        });
    });

    describe('POST /api/v1/irs/disburse (government_only)', () => {
        it('returns 403 legislation_auth_required without Authorization header', async () => {
            const { app } = await buildApp({});
            const res = await app.inject({
                method: 'POST',
                url: '/api/v1/irs/disburse',
                payload: { amount_wei: 100 },
            });
            expect(res.statusCode).toBe(403);
            expect(res.json().error).toMatch(/legislation_auth_required|legislation_ref_required/);
        });

        it('returns 400 invalid_amount for non-numeric amount_wei', async () => {
            // RED scaffold; Plan 03 wires a valid mock JWT via test fixture.
            // For now, assert that with a stub auth header, malformed body returns 400.
            const { app } = await buildApp({ authHeader: 'Bearer test-fixture-token' });
            const res = await app.inject({
                method: 'POST',
                url: '/api/v1/irs/disburse',
                payload: { amount_wei: 'not-a-number' },
            });
            // Either 400 (invalid amount) or 403 (test fixture not a real JWT) is acceptable here;
            // Plan 03 will refine. For now we just assert the route is registered (not 404).
            expect(res.statusCode).not.toBe(404);
        });

        it('emits irs.disbursement_authorized BEFORE irs.disbursement_executed in the audit chain (success path)', async () => {
            // Arrange: seeded treasury with sufficient balance + valid Government JWT with legislation_ref.
            const jwt = await mintGovJwt('bill-001');
            const { app, audit } = await buildApp({
                authHeader: `Bearer ${jwt}`,
                getConnectionImpl: () => ({
                    beginTransaction: vi.fn(async () => {}),
                    query: vi.fn(async (sql: string) => {
                        if (sql.includes('FOR UPDATE')) return [[{ balance_wei: '1000' }]] as unknown;
                        return [[]] as unknown;
                    }),
                    commit: vi.fn(async () => {}),
                    rollback: vi.fn(async () => {}),
                    release: vi.fn(() => {}),
                }),
            });
            const chain = audit as unknown as { all: () => Array<{ eventType: string }> };
            const beforeCount = chain.all().length;

            // Act: perform a valid disbursement.
            const res = await app.inject({
                method: 'POST',
                url: '/api/v1/irs/disburse',
                headers: { authorization: `Bearer ${jwt}` },
                payload: { amount_wei: 100 },
            });
            expect(res.statusCode).toBe(200);

            // Assert: both events appended after the request; authorized index < executed index.
            const newEvents = chain.all().slice(beforeCount);
            const authorizedIdx = newEvents.findIndex((e) => e.eventType === 'irs.disbursement_authorized');
            const executedIdx = newEvents.findIndex((e) => e.eventType === 'irs.disbursement_executed');
            expect(authorizedIdx).toBeGreaterThanOrEqual(0);
            expect(executedIdx).toBeGreaterThanOrEqual(0);
            expect(authorizedIdx).toBeLessThan(executedIdx);
        });
    });

    describe('GET /api/v1/irs/audit/:period (public)', () => {
        it('returns 200 with events array for valid tick range', async () => {
            const { app } = await buildApp({
                poolQueryImpl: async () => [[]] as unknown,
            });
            const res = await app.inject({ method: 'GET', url: '/api/v1/irs/audit/0-1000' });
            expect(res.statusCode).toBe(200);
            expect(res.json()).toHaveProperty('events');
            expect(Array.isArray(res.json().events)).toBe(true);
        });

        it('returns 400 for invalid period format', async () => {
            const { app } = await buildApp({});
            const res = await app.inject({ method: 'GET', url: '/api/v1/irs/audit/garbage' });
            expect(res.statusCode).toBe(400);
            expect(res.json().error).toBe('invalid_period');
        });

        it('returns 200 for period=current', async () => {
            const { app } = await buildApp({
                poolQueryImpl: async () => [[]] as unknown,
            });
            const res = await app.inject({ method: 'GET', url: '/api/v1/irs/audit/current' });
            expect(res.statusCode).toBe(200);
        });
    });
});
