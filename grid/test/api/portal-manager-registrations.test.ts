/**
 * Portal Manager v1 — reviewer-queue READ endpoint tests (production-hardened).
 *
 * GET /api/v1/portal-manager/registrations[?status=]
 *   - TWO server-trusted gates:
 *       (a) attack-surface gate GRID_PORTAL_MANAGER_ENABLED (dedicated, decoupled
 *           from GRID_ADMIN_ENABLED) — 503 portal_manager_disabled when off;
 *       (b) portal_session_required policy + in-handler operatorScope — a valid
 *           Portal session cookie is mandatory (401/403 without one). A spoofed
 *           x-operator-tier/-id header alone can NEVER pass (regression below).
 *   - the legacy x-operator-tier (>=5) + x-operator-id checks remain as a SECONDARY
 *     intent signal AFTER operatorScope (defense-in-depth, never the sole gate).
 *   - READ-ONLY over human_civic_applications; emits zero audit events.
 *   - privacy: returns human_did_hash (SHA-256) NOT the raw DID, and never the
 *     statement plaintext (FORBIDDEN_KEY_PATTERN preserved).
 *
 * Mock-Pool pattern (no DB) per test/portal/nous-endpoints.test.ts.
 * Portal-session injection mirrors operator-me-quota.test.ts (signed ES256 cookie).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { SignJWT } from 'jose';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { COOKIE_NAME, keyPairPromise } from '../../src/api/portal/auth.js';
import type { FastifyInstance } from 'fastify';

const OP_ID = 'op:12345678-1234-4234-8234-1234567890ab';

// QA fix: tryDid.ts's portal-cookie path now correctly uses DID_RE
// (did:noesis:*), matching the real shape SIWE/email signup issue.
const OPERATOR_DID = 'did:noesis:human:operator-a';

type MockPool = { query: ReturnType<typeof vi.fn> };

function makePool(queryFn: (sql: string, params: unknown[]) => [unknown[], unknown]): MockPool {
    return {
        query: vi.fn().mockImplementation((sql: string, params: unknown[]) =>
            Promise.resolve(queryFn(sql, params)),
        ),
    };
}

function buildApp(humanPool?: MockPool): FastifyInstance {
    return buildServer({
        clock: new WorldClock({ tickRateMs: 100_000 }),
        space: new SpatialMap(),
        logos: new LogosEngine(),
        audit: new AuditChain(),
        gridName: 'genesis',
        humanPool,
    });
}

/** A signed ES256 Portal-session cookie — populates req.didContext.operatorDid. */
async function makePortalCookie(did = OPERATOR_DID): Promise<string> {
    const { privateKey } = await keyPairPromise;
    return new SignJWT({ did, eth_address: '0xaabb', grid_name: 'genesis' })
        .setProtectedHeader({ alg: 'ES256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKey);
}

const ROWS = [
    {
        application_id: 'a1', grid_name: 'genesis', human_did: 'did:noesis:human:0xaaa',
        status: 'approved', reason_code: null, civic_did: 'did:civic:noesis:human:c1',
        requested_at_tick: 10, decided_at_tick: 11,
    },
    {
        application_id: 'a2', grid_name: 'genesis', human_did: 'did:noesis:human:0xbbb',
        status: 'pending', reason_code: null, civic_did: null,
        requested_at_tick: 12, decided_at_tick: null,
    },
    {
        application_id: 'a3', grid_name: 'genesis', human_did: 'did:noesis:human:0xccc',
        status: 'rejected', reason_code: 'oath_mismatch', civic_did: null,
        requested_at_tick: 13, decided_at_tick: 14,
    },
];

const COUNT_ROWS = [
    { status: 'pending', n: 1, issued: 0 },
    { status: 'approved', n: 1, issued: 1 },
    { status: 'rejected', n: 1, issued: 0 },
];

/** Route the two SELECTs (list + counts) by inspecting the SQL. */
function defaultQueryFn(rows = ROWS) {
    return (sql: string, _params: unknown[]): [unknown[], unknown] => {
        if (/GROUP BY/i.test(sql)) return [COUNT_ROWS, undefined];
        return [rows, undefined];
    };
}

// All suites below exercise the REAL handler, which only registers when the
// attack-surface gate is enabled. (The admin-disabled and spoof regressions
// manage the flag themselves.)
describe('Portal Manager — attack-surface gate (GRID_PORTAL_MANAGER_ENABLED)', () => {
    const PRIOR_PM = process.env.GRID_PORTAL_MANAGER_ENABLED;
    const PRIOR_ADMIN = process.env.GRID_ADMIN_ENABLED;
    afterAll(() => {
        process.env.GRID_PORTAL_MANAGER_ENABLED = PRIOR_PM;
        process.env.GRID_ADMIN_ENABLED = PRIOR_ADMIN;
    });

    it('503 portal_manager_disabled when the flag is unset/false (even with spoofed headers + cookie)', async () => {
        delete process.env.GRID_PORTAL_MANAGER_ENABLED;
        const app = buildApp(makePool(defaultQueryFn()));
        await app.ready();
        const cookie = await makePortalCookie();
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal-manager/registrations',
            headers: { 'x-operator-tier': '5', 'x-operator-id': OP_ID },
            cookies: { [COOKIE_NAME]: cookie },
        });
        expect(res.statusCode).toBe(503);
        expect(res.json().error).toBe('portal_manager_disabled');
        // No queue body leaks.
        expect(res.json().applications).toBeUndefined();
        await app.close();
    });

    it('DECOUPLED: GRID_ADMIN_ENABLED=true alone does NOT open the console', async () => {
        delete process.env.GRID_PORTAL_MANAGER_ENABLED;
        process.env.GRID_ADMIN_ENABLED = 'true';
        const app = buildApp(makePool(defaultQueryFn()));
        await app.ready();
        const cookie = await makePortalCookie();
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal-manager/registrations',
            headers: { 'x-operator-tier': '5', 'x-operator-id': OP_ID },
            cookies: { [COOKIE_NAME]: cookie },
        });
        // The admin .env kill-switch must not enable the read-only console.
        expect(res.statusCode).toBe(503);
        expect(res.json().error).toBe('portal_manager_disabled');
        await app.close();
    });
});

// --- Suites that need the REAL handler: enable the gate for all of them. ---
describe('Portal Manager — production-gated handler', () => {
    const PRIOR = process.env.GRID_PORTAL_MANAGER_ENABLED;
    beforeAll(() => { process.env.GRID_PORTAL_MANAGER_ENABLED = 'true'; });
    afterAll(() => { process.env.GRID_PORTAL_MANAGER_ENABLED = PRIOR; });

    describe('REGRESSION — spoofed-headers-only is rejected (the closed hole)', () => {
        it('401 portal_session_required when ONLY x-operator-tier:5 + x-operator-id are sent (no session cookie)', async () => {
            const app = buildApp(makePool(defaultQueryFn()));
            await app.ready();
            const res = await app.inject({
                method: 'GET',
                url: '/api/v1/portal-manager/registrations',
                headers: { 'x-operator-tier': '5', 'x-operator-id': OP_ID },
            });
            // The central hook rejects BEFORE the handler runs.
            expect(res.statusCode).toBe(401);
            expect(res.json().error).toBe('portal_session_required');
            // Critically: not 200, and no reviewer-queue body leaked.
            expect(res.statusCode).not.toBe(200);
            expect(res.json().applications).toBeUndefined();
            expect(res.json().counts).toBeUndefined();
            await app.close();
        });
    });

    describe('auth ladder (secondary header checks behind a valid session)', () => {
        let app: FastifyInstance;
        let cookie: string;
        beforeAll(async () => {
            app = buildApp(makePool(defaultQueryFn()));
            await app.ready();
            cookie = await makePortalCookie();
        });
        afterAll(async () => { await app.close(); });

        it('401 tier_missing when x-operator-tier absent (session present)', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/api/v1/portal-manager/registrations',
                headers: { 'x-operator-id': OP_ID },
                cookies: { [COOKIE_NAME]: cookie },
            });
            expect(res.statusCode).toBe(401);
            expect(res.json().error).toBe('tier_missing');
        });

        it('403 tier_too_low when tier < 5 (session present)', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/api/v1/portal-manager/registrations',
                headers: { 'x-operator-tier': '4', 'x-operator-id': OP_ID },
                cookies: { [COOKIE_NAME]: cookie },
            });
            expect(res.statusCode).toBe(403);
            expect(res.json().error).toBe('tier_too_low');
        });

        it('400 invalid_operator_id when x-operator-id malformed (session present)', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/api/v1/portal-manager/registrations',
                headers: { 'x-operator-tier': '5', 'x-operator-id': 'not-an-op-id' },
                cookies: { [COOKIE_NAME]: cookie },
            });
            expect(res.statusCode).toBe(400);
            expect(res.json().error).toBe('invalid_operator_id');
        });
    });

    describe('503 db_unavailable', () => {
        it('503 db_unavailable when humanPool absent (session + headers present)', async () => {
            const app = buildApp(undefined);
            await app.ready();
            const cookie = await makePortalCookie();
            const res = await app.inject({
                method: 'GET',
                url: '/api/v1/portal-manager/registrations',
                headers: { 'x-operator-tier': '5', 'x-operator-id': OP_ID },
                cookies: { [COOKIE_NAME]: cookie },
            });
            expect(res.statusCode).toBe(503);
            expect(res.json().error).toBe('db_unavailable');
            await app.close();
        });
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

        it('200 returns rows + counts + activity summary', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/api/v1/portal-manager/registrations',
                headers: { 'x-operator-tier': '5', 'x-operator-id': OP_ID },
                cookies: { [COOKIE_NAME]: cookie },
            });
            expect(res.statusCode).toBe(200);
            const body = res.json();
            expect(body.applications).toHaveLength(3);
            expect(body.counts).toEqual({ pending: 1, approved: 1, rejected: 1, total: 3 });
            expect(body.activity).toEqual({ registrations_total: 3, civic_dids_issued: 1 });
            expect(body.grid_name).toBe('genesis');
        });

        it('each row carries application_id, status, civic_did, reason_code, ticks + grid_name', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/api/v1/portal-manager/registrations',
                headers: { 'x-operator-tier': '5', 'x-operator-id': OP_ID },
                cookies: { [COOKIE_NAME]: cookie },
            });
            const row = res.json().applications[0];
            expect(row.application_id).toBe('a1');
            expect(row.status).toBe('approved');
            expect(row.civic_did).toBe('did:civic:noesis:human:c1');
            expect(row.reason_code).toBeNull();
            expect(row.requested_at_tick).toBe(10);
            expect(row.decided_at_tick).toBe(11);
            expect(row.grid_name).toBe('genesis');
        });

        it('PRIVACY: returns human_did_hash (SHA-256) and NEVER the raw human_did or statement', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/api/v1/portal-manager/registrations',
                headers: { 'x-operator-tier': '5', 'x-operator-id': OP_ID },
                cookies: { [COOKIE_NAME]: cookie },
            });
            const raw = res.payload;
            expect(raw).not.toContain('did:noesis:human:0xaaa');
            expect(raw).not.toContain('statement');
            const row = res.json().applications[0];
            expect(row.human_did).toBeUndefined();
            expect(row.statement).toBeUndefined();
            expect(row.human_did_hash).toBe(
                createHash('sha256').update('did:noesis:human:0xaaa').digest('hex'),
            );
        });
    });

    describe('status filter (session-backed)', () => {
        it('?status=pending parameterizes the SQL (no interpolation) and filters', async () => {
            const seen: { sql: string; params: unknown[] }[] = [];
            const pool: MockPool = {
                query: vi.fn().mockImplementation((sql: string, params: unknown[]) => {
                    seen.push({ sql, params });
                    if (/GROUP BY/i.test(sql)) return Promise.resolve([COUNT_ROWS, undefined]);
                    return Promise.resolve([[ROWS[1]], undefined]);
                }),
            };
            const app = buildApp(pool);
            await app.ready();
            const cookie = await makePortalCookie();
            const res = await app.inject({
                method: 'GET',
                url: '/api/v1/portal-manager/registrations?status=pending',
                headers: { 'x-operator-tier': '5', 'x-operator-id': OP_ID },
                cookies: { [COOKIE_NAME]: cookie },
            });
            expect(res.statusCode).toBe(200);
            expect(res.json().applications).toHaveLength(1);
            expect(res.json().applications[0].status).toBe('pending');

            // The list SELECT must bind status as a parameter, not interpolate it.
            const listCall = seen.find(c => !/GROUP BY/i.test(c.sql));
            expect(listCall).toBeDefined();
            expect(listCall!.params).toContain('pending');
            expect(listCall!.sql).not.toContain("'pending'");
            // reserved identifier `status` is backticked in the WHERE clause, and the
            // WHERE leads with grid_name then status — the idx_civic_app_status order.
            expect(listCall!.sql).toContain('`status`');
            expect(listCall!.sql).toMatch(/WHERE grid_name = \?\s+AND `status` = \?/);
            await app.close();
        });

        it('400 invalid_status on a bogus status value', async () => {
            const app = buildApp(makePool(defaultQueryFn()));
            await app.ready();
            const cookie = await makePortalCookie();
            const res = await app.inject({
                method: 'GET',
                url: '/api/v1/portal-manager/registrations?status=bogus',
                headers: { 'x-operator-tier': '5', 'x-operator-id': OP_ID },
                cookies: { [COOKIE_NAME]: cookie },
            });
            expect(res.statusCode).toBe(400);
            expect(res.json().error).toBe('invalid_status');
            await app.close();
        });
    });

    describe('read-only (no audit emission)', () => {
        it('a 200 read appends ZERO entries to the audit chain', async () => {
            const audit = new AuditChain();
            const before = audit.length;
            const app = buildServer({
                clock: new WorldClock({ tickRateMs: 100_000 }),
                space: new SpatialMap(),
                logos: new LogosEngine(),
                audit,
                gridName: 'genesis',
                humanPool: makePool(defaultQueryFn()),
            });
            await app.ready();
            const cookie = await makePortalCookie();
            await app.inject({
                method: 'GET',
                url: '/api/v1/portal-manager/registrations',
                headers: { 'x-operator-tier': '5', 'x-operator-id': OP_ID },
                cookies: { [COOKIE_NAME]: cookie },
            });
            expect(audit.length).toBe(before);
            await app.close();
        });
    });
});
