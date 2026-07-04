/**
 * W4 (D-MONEY-09) — POST /api/v1/portal/account/endow route tests.
 *
 * Operator-gated model-first endowment (the live wei source). Hardened auth mirrors
 * portal-manager.ts:
 *   - attack-surface gate GRID_ENDOWMENT_ENABLED (off by default → 503, handler
 *     never wired);
 *   - portal_session_required policy → requirePortalSession in the central hook
 *     (401 for anonymous) + in-handler operatorScope (server-trusted operatorDid);
 *   - secondary x-operator-tier >= 5 defense-in-depth.
 * On success it credits the account, ledgers the endowment, and emits
 * portal.account_endowed.
 *
 * Mock-Pool + signed ES256 Portal cookie, mirrors portal-manager-registrations.test.ts.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { SignJWT } from 'jose';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { COOKIE_NAME, keyPairPromise } from '../../src/api/portal/auth.js';
import type { FastifyInstance } from 'fastify';

// QA fix: was 'did:portal:noesis:operator-a' — a shape that happens to satisfy
// tryDid.ts's (formerly buggy) ANY_DID_RE but that no real code path ever
// issues. A real portal session cookie's `did` claim is always a human
// existence-DID (did:noesis:human:*, from SIWE or email signup) — use that
// real shape so this test actually exercises the contract tryDid.ts enforces.
const OPERATOR_DID = 'did:noesis:human:operator-a';
const RECIPIENT = 'did:civic:noesis:alice';
const ENDOW_URL = '/api/v1/portal/account/endow';

async function makePortalCookie(did = OPERATOR_DID): Promise<string> {
    const { privateKey } = await keyPairPromise;
    return new SignJWT({ did, eth_address: '0xaabb', grid_name: 'genesis' })
        .setProtectedHeader({ alg: 'ES256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKey);
}

/** Mock pool that satisfies EndowmentStore.endow's transaction (SUM → insert → credit → read). */
function makePool(newBalance = 1000n): Pool {
    const conn = {
        beginTransaction: vi.fn().mockResolvedValue(undefined),
        commit: vi.fn().mockResolvedValue(undefined),
        rollback: vi.fn().mockResolvedValue(undefined),
        release: vi.fn(),
        query: vi.fn().mockImplementation((sql: string) => {
            if (/SUM\(amount_wei\)/i.test(sql)) return Promise.resolve([[{ total: '0' }] as RowDataPacket[], {}]);
            if (/SELECT balance_wei FROM nous_accounts/i.test(sql)) return Promise.resolve([[{ balance_wei: newBalance.toString() }] as RowDataPacket[], {}]);
            return Promise.resolve([{}, {}]);
        }),
    };
    return { getConnection: vi.fn().mockResolvedValue(conn), query: vi.fn().mockResolvedValue([[], {}]) } as unknown as Pool;
}

function makeApp(pool?: Pool, audit = new AuditChain()): FastifyInstance {
    return buildServer({
        clock: new WorldClock({ tickRateMs: 100_000 }),
        space: new SpatialMap(),
        logos: new LogosEngine(),
        audit,
        gridName: 'genesis',
        pool: pool as never,
        currentTick: () => 7,
    });
}

const PRIOR = process.env.GRID_ENDOWMENT_ENABLED;
afterEach(() => {
    if (PRIOR === undefined) delete process.env.GRID_ENDOWMENT_ENABLED;
    else process.env.GRID_ENDOWMENT_ENABLED = PRIOR;
});

describe('POST /api/v1/portal/account/endow — attack-surface gate', () => {
    it('503 endowment_disabled when the flag is off (even with a valid cookie)', async () => {
        delete process.env.GRID_ENDOWMENT_ENABLED;
        const app = makeApp(makePool());
        await app.ready();
        const cookie = await makePortalCookie();
        const res = await app.inject({
            method: 'POST', url: ENDOW_URL,
            headers: { 'x-operator-tier': '5' },
            cookies: { [COOKIE_NAME]: cookie },
            payload: { civic_did: RECIPIENT, amount_wei: '1000' },
        });
        expect(res.statusCode).toBe(503);
        expect(res.json().error).toBe('endowment_disabled');
        await app.close();
    });
});

describe('POST /api/v1/portal/account/endow — enabled', () => {
    const enable = () => { process.env.GRID_ENDOWMENT_ENABLED = 'true'; };

    it('401 for an anonymous caller (no portal session)', async () => {
        enable();
        const app = makeApp(makePool());
        await app.ready();
        const res = await app.inject({
            method: 'POST', url: ENDOW_URL,
            headers: { 'x-operator-tier': '5' },
            payload: { civic_did: RECIPIENT, amount_wei: '1000' },
        });
        expect(res.statusCode).toBe(401);
        await app.close();
    });

    it('403 tier_too_low when the secondary tier signal is below 5', async () => {
        enable();
        const app = makeApp(makePool());
        await app.ready();
        const cookie = await makePortalCookie();
        const res = await app.inject({
            method: 'POST', url: ENDOW_URL,
            headers: { 'x-operator-tier': '4' },
            cookies: { [COOKIE_NAME]: cookie },
            payload: { civic_did: RECIPIENT, amount_wei: '1000' },
        });
        expect(res.statusCode).toBe(403);
        await app.close();
    });

    it('200 credits the account, returns endowment_id + new_balance_wei, and emits the audit event', async () => {
        enable();
        const audit = new AuditChain();
        const app = makeApp(makePool(1000n), audit);
        await app.ready();
        const cookie = await makePortalCookie();
        const res = await app.inject({
            method: 'POST', url: ENDOW_URL,
            headers: { 'x-operator-tier': '5' },
            cookies: { [COOKIE_NAME]: cookie },
            payload: { civic_did: RECIPIENT, amount_wei: '1000', reason: 'seed' },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.civic_did).toBe(RECIPIENT);
        expect(body.new_balance_wei).toBe('1000');
        expect(body.source).toBe('model_first');
        expect(body.endowment_id).toMatch(/^[0-9a-f]{8}-/i);
        expect(audit.query({ eventType: 'portal.account_endowed' })).toHaveLength(1);
        await app.close();
    });

    it('400 invalid_civic_did for a malformed recipient', async () => {
        enable();
        const app = makeApp(makePool());
        await app.ready();
        const cookie = await makePortalCookie();
        const res = await app.inject({
            method: 'POST', url: ENDOW_URL,
            headers: { 'x-operator-tier': '5' },
            cookies: { [COOKIE_NAME]: cookie },
            payload: { civic_did: 'not-a-did', amount_wei: '1000' },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('invalid_civic_did');
        await app.close();
    });

    it('400 invalid_amount for a non-positive / non-numeric amount', async () => {
        enable();
        const app = makeApp(makePool());
        await app.ready();
        const cookie = await makePortalCookie();
        for (const amount_wei of ['0', '-5', 'abc', '']) {
            const res = await app.inject({
                method: 'POST', url: ENDOW_URL,
                headers: { 'x-operator-tier': '5' },
                cookies: { [COOKIE_NAME]: cookie },
                payload: { civic_did: RECIPIENT, amount_wei },
            });
            expect(res.statusCode).toBe(400);
            expect(res.json().error).toBe('invalid_amount');
        }
        await app.close();
    });

    it('422 endowment_exceeds_cap when the amount is above the per-call cap', async () => {
        enable();
        const app = makeApp(makePool());
        await app.ready();
        const cookie = await makePortalCookie();
        const res = await app.inject({
            method: 'POST', url: ENDOW_URL,
            headers: { 'x-operator-tier': '5' },
            cookies: { [COOKIE_NAME]: cookie },
            payload: { civic_did: RECIPIENT, amount_wei: '2000000000000000000' }, // 2e18 > 1e18 cap
        });
        expect(res.statusCode).toBe(422);
        expect(res.json().error).toBe('endowment_exceeds_cap');
        await app.close();
    });

    it('503 db_unavailable when no pool is wired', async () => {
        enable();
        const app = makeApp(undefined);
        await app.ready();
        const cookie = await makePortalCookie();
        const res = await app.inject({
            method: 'POST', url: ENDOW_URL,
            headers: { 'x-operator-tier': '5' },
            cookies: { [COOKIE_NAME]: cookie },
            payload: { civic_did: RECIPIENT, amount_wei: '1000' },
        });
        expect(res.statusCode).toBe(503);
        expect(res.json().error).toBe('db_unavailable');
        await app.close();
    });
});
