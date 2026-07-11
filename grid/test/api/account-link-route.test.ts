/**
 * Phase 62 (D-MONEY-02) — POST/GET /api/v1/portal/account/link route tests.
 *
 * Citizen self-service wallet-proof. Auth is server-trusted: the caller's Civic-DID
 * comes from the session (a civic bearer JWT resolved to tier=civic_member), NEVER the
 * body — so a caller can only link its OWN DID. Zero custody: the Grid recovers the
 * signer from the signature and stores the binding; it never holds a key.
 *
 *   POST valid proof   → 200 + link + portal.account_linked emitted once
 *   POST bad signature → 400 invalid_signature
 *   POST anon          → 401 (hook: portal_session_required)
 *   POST human civic   → 403 humans_cannot_link_accounts
 *   POST human_visitor → 401 (handler: not a civic_member)
 *   GET  before link   → 404 not_linked ; after → 200
 */
import { describe, it, expect, vi } from 'vitest';
import { Wallet, getAddress } from 'ethers';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { SignJWT } from 'jose';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { COOKIE_NAME, keyPairPromise } from '../../src/api/portal/auth.js';
import { accountLinkMessage } from '../../src/economy/account-link-store.js';
import type { FastifyInstance } from 'fastify';

const CIVIC_DID = 'did:civic:noesis:sophia';
const HUMAN_CIVIC_DID = 'did:civic:noesis:human:alice';
const HUMAN_DID = 'did:noesis:human:visitor-a';
const LINK_URL = '/api/v1/portal/account/link';

/** Mint an ES256 Civic-DID bearer token → tryDid resolves it to tier=civic_member. */
async function makeCivicBearer(sub = CIVIC_DID): Promise<string> {
    const { privateKey } = await keyPairPromise;
    return new SignJWT({ sub })
        .setProtectedHeader({ alg: 'ES256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKey);
}

/** A portal session cookie (human existence-DID) → tryDid resolves it to human_visitor. */
async function makePortalCookie(did = HUMAN_DID): Promise<string> {
    const { privateKey } = await keyPairPromise;
    return new SignJWT({ did, eth_address: '0xaabb', grid_name: 'genesis' })
        .setProtectedHeader({ alg: 'ES256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKey);
}

/** Mock pool: INSERT → affectedRows; SELECT → the configured rows. */
function makePool(selectRows: unknown[] = []): Pool {
    const query = vi.fn(async (sql: string) => {
        if (/^\s*select/i.test(sql)) return [selectRows as RowDataPacket[], []];
        return [{ affectedRows: 1 }, []];
    });
    return { query } as unknown as Pool;
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

describe('POST /api/v1/portal/account/link', () => {
    it('200 — verifies the proof, persists the link, emits portal.account_linked once', async () => {
        const owner = Wallet.createRandom();
        const account = Wallet.createRandom().address;
        const signature = await owner.signMessage(accountLinkMessage(CIVIC_DID, account));

        const audit = new AuditChain();
        const app = makeApp(makePool(), audit);
        await app.ready();
        const token = await makeCivicBearer();
        const res = await app.inject({
            method: 'POST', url: LINK_URL,
            headers: { authorization: `Bearer ${token}` },
            payload: { nous_account: account, signature },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.civic_did).toBe(CIVIC_DID);
        expect(body.nous_account).toBe(getAddress(account));
        expect(body.owner_address).toBe(owner.address);
        expect(body.verified_at_tick).toBe(7);
        expect(audit.query({ eventType: 'portal.account_linked' })).toHaveLength(1);
        await app.close();
    });

    it('400 invalid_signature for a malformed signature', async () => {
        const account = Wallet.createRandom().address;
        const app = makeApp(makePool());
        await app.ready();
        const token = await makeCivicBearer();
        const res = await app.inject({
            method: 'POST', url: LINK_URL,
            headers: { authorization: `Bearer ${token}` },
            payload: { nous_account: account, signature: '0xdeadbeef' },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('invalid_signature');
        await app.close();
    });

    it('400 invalid_account_address for a malformed account', async () => {
        const app = makeApp(makePool());
        await app.ready();
        const token = await makeCivicBearer();
        const res = await app.inject({
            method: 'POST', url: LINK_URL,
            headers: { authorization: `Bearer ${token}` },
            payload: { nous_account: 'not-an-address', signature: '0x00' },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('invalid_account_address');
        await app.close();
    });

    it('401 for an anonymous caller (no session)', async () => {
        const app = makeApp(makePool());
        await app.ready();
        const res = await app.inject({
            method: 'POST', url: LINK_URL,
            payload: { nous_account: Wallet.createRandom().address, signature: '0x00' },
        });
        expect(res.statusCode).toBe(401);
        await app.close();
    });

    it('401 for a human_visitor portal session (not a civic_member)', async () => {
        const app = makeApp(makePool());
        await app.ready();
        const cookie = await makePortalCookie();
        const res = await app.inject({
            method: 'POST', url: LINK_URL,
            cookies: { [COOKIE_NAME]: cookie },
            payload: { nous_account: Wallet.createRandom().address, signature: '0x00' },
        });
        expect(res.statusCode).toBe(401);
        expect(res.json().error).toBe('unauthorized');
        await app.close();
    });

    it('403 humans_cannot_link_accounts for a human Civic-DID', async () => {
        const owner = Wallet.createRandom();
        const account = Wallet.createRandom().address;
        const signature = await owner.signMessage(accountLinkMessage(HUMAN_CIVIC_DID, account));
        const app = makeApp(makePool());
        await app.ready();
        const token = await makeCivicBearer(HUMAN_CIVIC_DID);
        const res = await app.inject({
            method: 'POST', url: LINK_URL,
            headers: { authorization: `Bearer ${token}` },
            payload: { nous_account: account, signature },
        });
        expect(res.statusCode).toBe(403);
        expect(res.json().error).toBe('humans_cannot_link_accounts');
        await app.close();
    });

    it('503 db_unavailable when no pool is wired', async () => {
        const app = makeApp(undefined);
        await app.ready();
        const token = await makeCivicBearer();
        const res = await app.inject({
            method: 'POST', url: LINK_URL,
            headers: { authorization: `Bearer ${token}` },
            payload: { nous_account: Wallet.createRandom().address, signature: '0x00' },
        });
        expect(res.statusCode).toBe(503);
        await app.close();
    });
});

describe('GET /api/v1/portal/account/link', () => {
    it('404 not_linked before any link exists', async () => {
        const app = makeApp(makePool([]));
        await app.ready();
        const token = await makeCivicBearer();
        const res = await app.inject({
            method: 'GET', url: LINK_URL,
            headers: { authorization: `Bearer ${token}` },
        });
        expect(res.statusCode).toBe(404);
        expect(res.json().error).toBe('not_linked');
        await app.close();
    });

    it('200 returns the caller-own link after it exists', async () => {
        const account = getAddress(Wallet.createRandom().address);
        const owner = getAddress(Wallet.createRandom().address);
        const app = makeApp(makePool([
            { civic_did: CIVIC_DID, nous_account: account, owner_address: owner, verified_at_tick: 9 },
        ]));
        await app.ready();
        const token = await makeCivicBearer();
        const res = await app.inject({
            method: 'GET', url: LINK_URL,
            headers: { authorization: `Bearer ${token}` },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.civic_did).toBe(CIVIC_DID);
        expect(body.nous_account).toBe(account);
        expect(body.owner_address).toBe(owner);
        expect(body.verified_at_tick).toBe(9);
        await app.close();
    });

    it('401 for an anonymous caller', async () => {
        const app = makeApp(makePool());
        await app.ready();
        const res = await app.inject({ method: 'GET', url: LINK_URL });
        expect(res.statusCode).toBe(401);
        await app.close();
    });
});
