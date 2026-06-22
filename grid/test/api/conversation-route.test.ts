/**
 * W — Conversation route tests.
 *
 * Auth: civic_did_required (onRequest hook). Tests that need to reach a route
 * handler inject a valid ES256 Civic-DID JWT (mirroring civic-dues-route.test.ts).
 *
 * DID conventions used:
 *   HUMAN_DID  — did:civic:noesis:human:alice  (matches HUMAN_DID_RE)
 *   NOUS_DID   — did:civic:noesis:nous1        (does NOT match HUMAN_DID_RE)
 */
import { describe, it, expect, vi } from 'vitest';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { SignJWT } from 'jose';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { keyPairPromise } from '../../src/api/portal/auth.js';
import type { FastifyInstance } from 'fastify';

const HUMAN_DID = 'did:civic:noesis:human:alice';
const NOUS_DID = 'did:civic:noesis:nous1';
const OTHER_NOUS_DID = 'did:civic:noesis:nous2';

/** Mint a valid ES256 Civic-DID bearer token for the given DID. */
async function makeCivicBearer(did: string): Promise<string> {
    const { privateKey } = await keyPairPromise;
    return new SignJWT({ sub: did })
        .setProtectedHeader({ alg: 'ES256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKey);
}

function poolReturning(rows: unknown[]): Pool {
    const conn = {
        beginTransaction: vi.fn().mockResolvedValue(undefined),
        commit: vi.fn().mockResolvedValue(undefined),
        rollback: vi.fn().mockResolvedValue(undefined),
        release: vi.fn(),
        query: vi.fn().mockResolvedValue([rows as RowDataPacket[], {}]),
    };
    return {
        query: vi.fn().mockResolvedValue([rows as RowDataPacket[], {}]),
        getConnection: vi.fn().mockResolvedValue(conn),
    } as unknown as Pool;
}

function makeApp(pool?: Pool): FastifyInstance {
    return buildServer({
        clock: new WorldClock({ tickRateMs: 100_000 }),
        space: new SpatialMap(),
        logos: new LogosEngine(),
        audit: new AuditChain(),
        gridName: 'genesis',
        pool: pool as never,
    });
}

// ---------------------------------------------------------------------------
// POST /api/v1/civic/conversation/:partnerDid/messages
// ---------------------------------------------------------------------------

describe('POST /api/v1/civic/conversation/:partnerDid/messages', () => {
    it('human posts to nous → 201 with message_id', async () => {
        const app = makeApp(poolReturning([]));
        const token = await makeCivicBearer(HUMAN_DID);
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/civic/conversation/${NOUS_DID}/messages`,
            headers: { authorization: `Bearer ${token}` },
            payload: { text: 'should we sell 5 ETH of compute?' },
        });
        expect(res.statusCode).toBe(201);
        const body = res.json();
        expect(body.ok).toBe(true);
        expect(typeof body.message_id).toBe('string');
        await app.close();
    });

    it('nous posts to human → 201 (sender inferred as nous)', async () => {
        const app = makeApp(poolReturning([]));
        const token = await makeCivicBearer(NOUS_DID);
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/civic/conversation/${HUMAN_DID}/messages`,
            headers: { authorization: `Bearer ${token}` },
            payload: { text: 'I recommend we wait for a better price.' },
        });
        expect(res.statusCode).toBe(201);
        const body = res.json();
        expect(body.ok).toBe(true);
        expect(typeof body.message_id).toBe('string');
        await app.close();
    });

    it('empty text → 400 empty_text', async () => {
        const app = makeApp(poolReturning([]));
        const token = await makeCivicBearer(HUMAN_DID);
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/civic/conversation/${NOUS_DID}/messages`,
            headers: { authorization: `Bearer ${token}` },
            payload: { text: '   ' },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('empty_text');
        await app.close();
    });

    it('no human party (nous↔nous) → 400 no_human_party', async () => {
        const app = makeApp(poolReturning([]));
        const token = await makeCivicBearer(NOUS_DID);
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/civic/conversation/${OTHER_NOUS_DID}/messages`,
            headers: { authorization: `Bearer ${token}` },
            payload: { text: 'hello?' },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('no_human_party');
        await app.close();
    });

    it('503 without a pool', async () => {
        const app = makeApp(undefined);
        const token = await makeCivicBearer(HUMAN_DID);
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/civic/conversation/${NOUS_DID}/messages`,
            headers: { authorization: `Bearer ${token}` },
            payload: { text: 'hello' },
        });
        expect(res.statusCode).toBe(503);
        await app.close();
    });

    it('401 without auth header', async () => {
        const app = makeApp(poolReturning([]));
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/civic/conversation/${NOUS_DID}/messages`,
            payload: { text: 'hello' },
        });
        expect(res.statusCode).toBe(401);
        await app.close();
    });
});

// ---------------------------------------------------------------------------
// GET /api/v1/civic/conversation/:partnerDid
// ---------------------------------------------------------------------------

describe('GET /api/v1/civic/conversation/:partnerDid', () => {
    it('returns thread messages and count', async () => {
        const app = makeApp(
            poolReturning([
                { message_id: 'm1', sender: 'human', text: 'hi', tick: 1 },
                { message_id: 'm2', sender: 'nous', text: 'hello', tick: 2 },
            ]),
        );
        const token = await makeCivicBearer(HUMAN_DID);
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/civic/conversation/${NOUS_DID}`,
            headers: { authorization: `Bearer ${token}` },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.count).toBe(2);
        expect(body.messages[0]).toMatchObject({ message_id: 'm1', sender: 'human' });
        await app.close();
    });

    it('nous caller reads thread (partner is human) → 200', async () => {
        const app = makeApp(poolReturning([{ message_id: 'm3', sender: 'nous', text: 'hi', tick: 5 }]));
        const token = await makeCivicBearer(NOUS_DID);
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/civic/conversation/${HUMAN_DID}`,
            headers: { authorization: `Bearer ${token}` },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().messages).toHaveLength(1);
        await app.close();
    });

    it('no human party → 400 no_human_party', async () => {
        const app = makeApp(poolReturning([]));
        const token = await makeCivicBearer(NOUS_DID);
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/civic/conversation/${OTHER_NOUS_DID}`,
            headers: { authorization: `Bearer ${token}` },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('no_human_party');
        await app.close();
    });

    it('503 without a pool', async () => {
        const app = makeApp(undefined);
        const token = await makeCivicBearer(HUMAN_DID);
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/civic/conversation/${NOUS_DID}`,
            headers: { authorization: `Bearer ${token}` },
        });
        expect(res.statusCode).toBe(503);
        await app.close();
    });
});
