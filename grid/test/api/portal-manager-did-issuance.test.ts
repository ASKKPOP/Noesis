/**
 * Portal Manager v1 — DID-issuance tracker READ endpoint tests.
 *
 * GET /api/v1/portal-manager/did-issuance
 *   - SAME two server-trusted gates as the registrations slice:
 *       (a) attack-surface gate GRID_PORTAL_MANAGER_ENABLED — 503
 *           portal_manager_disabled when off (real handler never registered);
 *       (b) portal_session_required policy + in-handler operatorScope — a valid
 *           Portal session cookie is mandatory (401/403 without one).
 *   - READ-ONLY over civic_did_registry + nous_registry; emits zero audit events.
 *   - PII: returns the PUBLIC civic_did as-is; never selects existence_did,
 *     credential_json, or nous_registry.did/human_owner into the response.
 *
 * Mock-Pool pattern mirrors portal-manager-registrations.test.ts. This slice reads
 * services.pool (the main grid pool), NOT services.humanPool.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { SignJWT } from 'jose';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { COOKIE_NAME, keyPairPromise } from '../../src/api/portal/auth.js';
import type { FastifyInstance } from 'fastify';

const OP_ID = 'op:12345678-1234-4234-8234-1234567890ab';
const OPERATOR_DID = 'did:noesis:human:operator-a';

type MockPool = { query: ReturnType<typeof vi.fn> };

function makePool(queryFn: (sql: string, params: unknown[]) => [unknown[], unknown]): MockPool {
    return {
        query: vi.fn().mockImplementation((sql: string, params: unknown[]) =>
            Promise.resolve(queryFn(sql, params)),
        ),
    };
}

function buildApp(pool?: MockPool): FastifyInstance {
    return buildServer({
        clock: new WorldClock({ tickRateMs: 100_000 }),
        space: new SpatialMap(),
        logos: new LogosEngine(),
        audit: new AuditChain(),
        gridName: 'genesis',
        pool: pool as unknown as import('mysql2/promise').Pool | undefined,
    });
}

async function makePortalCookie(did = OPERATOR_DID): Promise<string> {
    const { privateKey } = await keyPairPromise;
    return new SignJWT({ did, eth_address: '0xaabb', grid_name: 'genesis' })
        .setProtectedHeader({ alg: 'ES256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKey);
}

/** civic_did_registry list rows (only the 3 selected columns). */
const CIVIC_ROWS = [
    { civic_did: 'did:civic:noesis:human:c3', status: 'active', issued_at_tick: 30 },
    { civic_did: 'did:civic:noesis:human:c2', status: 'revoked', issued_at_tick: 20 },
    { civic_did: 'did:civic:noesis:human:c1', status: 'active', issued_at_tick: 10 },
];

const COUNT_ROWS = [
    { status: 'active', n: 2 },
    { status: 'revoked', n: 1 },
];

const NOUS_ACTIVE = 7;

/** Route the three SELECTs (list / grouped counts / nous count) by SQL shape. */
function defaultQueryFn(civicRows = CIVIC_ROWS, nousActive = NOUS_ACTIVE) {
    return (sql: string, _params: unknown[]): [unknown[], unknown] => {
        if (/FROM nous_registry/i.test(sql)) return [[{ n: nousActive }], undefined];
        if (/GROUP BY/i.test(sql)) return [COUNT_ROWS, undefined];
        return [civicRows, undefined];
    };
}

describe('Portal Manager DID-issuance — attack-surface gate', () => {
    const PRIOR = process.env.GRID_PORTAL_MANAGER_ENABLED;
    afterAll(() => { process.env.GRID_PORTAL_MANAGER_ENABLED = PRIOR; });

    it('503 portal_manager_disabled when the flag is off', async () => {
        delete process.env.GRID_PORTAL_MANAGER_ENABLED;
        const app = buildApp(makePool(defaultQueryFn()));
        await app.ready();
        const cookie = await makePortalCookie();
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal-manager/did-issuance',
            headers: { 'x-operator-tier': '5', 'x-operator-id': OP_ID },
            cookies: { [COOKIE_NAME]: cookie },
        });
        expect(res.statusCode).toBe(503);
        expect(res.json().error).toBe('portal_manager_disabled');
        expect(res.json().issued).toBeUndefined();
        await app.close();
    });
});

describe('Portal Manager DID-issuance — production-gated handler', () => {
    const PRIOR = process.env.GRID_PORTAL_MANAGER_ENABLED;
    beforeAll(() => { process.env.GRID_PORTAL_MANAGER_ENABLED = 'true'; });
    afterAll(() => { process.env.GRID_PORTAL_MANAGER_ENABLED = PRIOR; });

    it('401 portal_session_required with no session cookie (operatorScope gate)', async () => {
        const app = buildApp(makePool(defaultQueryFn()));
        await app.ready();
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal-manager/did-issuance',
            headers: { 'x-operator-tier': '5', 'x-operator-id': OP_ID },
        });
        expect([401, 403]).toContain(res.statusCode);
        expect(res.json().issued).toBeUndefined();
        await app.close();
    });

    it('403 operator_scope_required is enforced before the handler body', async () => {
        // A malformed/absent session yields the operatorScope 403 or the hook 401.
        const app = buildApp(makePool(defaultQueryFn()));
        await app.ready();
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal-manager/did-issuance',
        });
        expect([401, 403]).toContain(res.statusCode);
        await app.close();
    });

    describe('read shape (session-backed)', () => {
        let app: FastifyInstance;
        let cookie: string;
        beforeAll(async () => {
            app = buildApp(makePool(defaultQueryFn()));
            await app.ready();
            cookie = await makePortalCookie();
        });
        afterAll(async () => { await app.close(); });

        it('200 returns grid_name, issued rows, and counts', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/api/v1/portal-manager/did-issuance',
                headers: { 'x-operator-tier': '5', 'x-operator-id': OP_ID },
                cookies: { [COOKIE_NAME]: cookie },
            });
            expect(res.statusCode).toBe(200);
            const body = res.json();
            expect(body.grid_name).toBe('genesis');
            expect(body.issued).toHaveLength(3);
            expect(body.counts).toEqual({ active: 2, revoked: 1, total: 3, nous_active: 7 });
        });

        it('each issued row carries civic_did, status, issued_at_tick, kind:civic', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/api/v1/portal-manager/did-issuance',
                headers: { 'x-operator-tier': '5', 'x-operator-id': OP_ID },
                cookies: { [COOKIE_NAME]: cookie },
            });
            const row = res.json().issued[0];
            expect(row.civic_did).toBe('did:civic:noesis:human:c3');
            expect(row.status).toBe('active');
            expect(row.issued_at_tick).toBe(30);
            expect(row.kind).toBe('civic');
        });
    });

    it('values flow from the fixtures, not hardcoded (change fixture → response changes)', async () => {
        const alt = [
            { civic_did: 'did:civic:noesis:human:zz', status: 'active', issued_at_tick: 99 },
        ];
        const app = buildApp(makePool(defaultQueryFn(alt, 3)));
        await app.ready();
        const cookie = await makePortalCookie();
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal-manager/did-issuance',
            headers: { 'x-operator-tier': '5', 'x-operator-id': OP_ID },
            cookies: { [COOKIE_NAME]: cookie },
        });
        const body = res.json();
        expect(body.issued).toHaveLength(1);
        expect(body.issued[0].civic_did).toBe('did:civic:noesis:human:zz');
        expect(body.counts.nous_active).toBe(3);
        await app.close();
    });

    it('SELECT-only — every query() SQL begins with SELECT', async () => {
        const seen: string[] = [];
        const pool: MockPool = {
            query: vi.fn().mockImplementation((sql: string, _params: unknown[]) => {
                seen.push(sql);
                return Promise.resolve(defaultQueryFn()(sql, _params));
            }),
        };
        const app = buildApp(pool);
        await app.ready();
        const cookie = await makePortalCookie();
        await app.inject({
            method: 'GET',
            url: '/api/v1/portal-manager/did-issuance',
            headers: { 'x-operator-tier': '5', 'x-operator-id': OP_ID },
            cookies: { [COOKIE_NAME]: cookie },
        });
        expect(seen.length).toBeGreaterThan(0);
        for (const sql of seen) expect(sql).toMatch(/^\s*SELECT/i);
        await app.close();
    });

    it('parameterizes grid_name + the nous_active status (no interpolation)', async () => {
        const seen: { sql: string; params: unknown[] }[] = [];
        const pool: MockPool = {
            query: vi.fn().mockImplementation((sql: string, params: unknown[]) => {
                seen.push({ sql, params });
                return Promise.resolve(defaultQueryFn()(sql, params));
            }),
        };
        const app = buildApp(pool);
        await app.ready();
        const cookie = await makePortalCookie();
        await app.inject({
            method: 'GET',
            url: '/api/v1/portal-manager/did-issuance',
            headers: { 'x-operator-tier': '5', 'x-operator-id': OP_ID },
            cookies: { [COOKIE_NAME]: cookie },
        });
        for (const c of seen) expect(c.params).toContain('genesis');
        const nousCall = seen.find(c => /FROM nous_registry/i.test(c.sql));
        expect(nousCall).toBeDefined();
        expect(nousCall!.params).toContain('active');
        expect(nousCall!.sql).not.toContain("'active'");
        expect(nousCall!.sql).toContain('`status`');
        await app.close();
    });

    it('NO PII: the response never contains existence_did / credential_json / human_owner / nous did', async () => {
        const app = buildApp(makePool(defaultQueryFn()));
        await app.ready();
        const cookie = await makePortalCookie();
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal-manager/did-issuance',
            headers: { 'x-operator-tier': '5', 'x-operator-id': OP_ID },
            cookies: { [COOKIE_NAME]: cookie },
        });
        const raw = res.payload;
        expect(raw).not.toContain('existence_did');
        expect(raw).not.toContain('credential_json');
        expect(raw).not.toContain('human_owner');
        expect(raw).not.toMatch(/did:noesis:nous/);
        await app.close();
    });

    it('503 db_unavailable when services.pool is absent', async () => {
        const app = buildApp(undefined);
        await app.ready();
        const cookie = await makePortalCookie();
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal-manager/did-issuance',
            headers: { 'x-operator-tier': '5', 'x-operator-id': OP_ID },
            cookies: { [COOKIE_NAME]: cookie },
        });
        expect(res.statusCode).toBe(503);
        expect(res.json().error).toBe('db_unavailable');
        await app.close();
    });

    it('a 200 read appends ZERO entries to the audit chain', async () => {
        const audit = new AuditChain();
        const before = audit.length;
        const app = buildServer({
            clock: new WorldClock({ tickRateMs: 100_000 }),
            space: new SpatialMap(),
            logos: new LogosEngine(),
            audit,
            gridName: 'genesis',
            pool: makePool(defaultQueryFn()) as unknown as import('mysql2/promise').Pool,
        });
        await app.ready();
        const cookie = await makePortalCookie();
        await app.inject({
            method: 'GET',
            url: '/api/v1/portal-manager/did-issuance',
            headers: { 'x-operator-tier': '5', 'x-operator-id': OP_ID },
            cookies: { [COOKIE_NAME]: cookie },
        });
        expect(audit.length).toBe(before);
        await app.close();
    });
});
