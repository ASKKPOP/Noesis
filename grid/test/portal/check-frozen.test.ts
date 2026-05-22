/**
 * Phase 25b SANCTION-13 — tests for portal preHandler: check-frozen middleware.
 *
 * Test matrix:
 *   - Frozen human + portal action URL → 403 human_frozen
 *   - Banned human + portal action URL → 403 human_banned (priority over frozen)
 *   - Both banned and frozen → 403 human_banned (ban takes priority)
 *   - Frozen human + SIWE login URL → not intercepted (passes through to handler → 404 from stub)
 *   - Non-frozen human + portal action URL → middleware passes through
 *   - No session (no humanDid) → middleware passes through
 *   - humanSanctionStore absent → middleware passes through (no crash)
 */

import { describe, it, expect, afterEach } from 'vitest';
import Fastify from 'fastify';
import { AuditChain } from '../../src/audit/chain.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { registerFrozenCheck } from '../../src/api/portal/check-frozen.js';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../../src/api/server.js';

const HUMAN_DID = 'did:noesis:human:0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
const PORTAL_ACTION_URL = '/api/v1/portal/wallet/transfer';
const SIWE_URL = '/api/v1/portal/auth/verify';

type FlagRow = { frozen: number; banned: number };

/** Stub humanSanctionStore with getFlags support. */
function makeStore(flags: FlagRow | null): GridServices['humanSanctionStore'] {
    return {
        existsByDid: async () => flags !== null,
        setBanned: async () => {},
        setFrozen: async () => {},
        getFlags: async (_did: string) => flags,
    } as unknown as GridServices['humanSanctionStore'];
}

function buildTestApp(opts: {
    humanDid?: string;          // if set, session.humanDid is set on every request
    flags?: FlagRow | null;     // null = human not found in DB
    noStore?: boolean;          // simulate missing humanSanctionStore
}): FastifyInstance {
    const clock = new WorldClock({ tickRateMs: 100_000 });
    const audit = new AuditChain();

    const services: Partial<GridServices> = {
        clock,
        audit,
        humanSanctionStore: opts.noStore ? undefined : makeStore(opts.flags ?? null),
    };

    const app = Fastify({ logger: false });

    // Simulate session injection before preHandler
    if (opts.humanDid !== undefined) {
        app.addHook('preHandler', async (req) => {
            (req as typeof req & { session: Record<string, unknown> }).session = { humanDid: opts.humanDid };
        });
    }

    registerFrozenCheck(app, services as GridServices);

    // Stub route that returns 200 if middleware passes through
    app.post(PORTAL_ACTION_URL, async (_req, reply) => {
        return reply.send({ ok: true });
    });
    app.post(SIWE_URL, async (_req, reply) => {
        return reply.send({ ok: true });
    });

    return app;
}

describe('registerFrozenCheck — portal preHandler', () => {
    it('frozen human on portal action route → 403 human_frozen', async () => {
        const app = buildTestApp({ humanDid: HUMAN_DID, flags: { frozen: 1, banned: 0 } });
        await app.ready();
        const res = await app.inject({ method: 'POST', url: PORTAL_ACTION_URL });
        expect(res.statusCode).toBe(403);
        expect(JSON.parse(res.body)).toMatchObject({ error: 'human_frozen' });
        await app.close();
    });

    it('banned human on portal action route → 403 human_banned (priority)', async () => {
        const app = buildTestApp({ humanDid: HUMAN_DID, flags: { frozen: 0, banned: 1 } });
        await app.ready();
        const res = await app.inject({ method: 'POST', url: PORTAL_ACTION_URL });
        expect(res.statusCode).toBe(403);
        expect(JSON.parse(res.body)).toMatchObject({ error: 'human_banned' });
        await app.close();
    });

    it('banned AND frozen human → 403 human_banned (ban wins)', async () => {
        const app = buildTestApp({ humanDid: HUMAN_DID, flags: { frozen: 1, banned: 1 } });
        await app.ready();
        const res = await app.inject({ method: 'POST', url: PORTAL_ACTION_URL });
        expect(res.statusCode).toBe(403);
        expect(JSON.parse(res.body)).toMatchObject({ error: 'human_banned' });
        await app.close();
    });

    it('frozen human on SIWE sign-in URL → passes through (200)', async () => {
        const app = buildTestApp({ humanDid: HUMAN_DID, flags: { frozen: 1, banned: 0 } });
        await app.ready();
        const res = await app.inject({ method: 'POST', url: SIWE_URL });
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toMatchObject({ ok: true });
        await app.close();
    });

    it('non-frozen human on portal action route → passes through (200)', async () => {
        const app = buildTestApp({ humanDid: HUMAN_DID, flags: { frozen: 0, banned: 0 } });
        await app.ready();
        const res = await app.inject({ method: 'POST', url: PORTAL_ACTION_URL });
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toMatchObject({ ok: true });
        await app.close();
    });

    it('no session (unauthenticated) on portal action route → passes through (200)', async () => {
        // humanDid not set → no session
        const app = buildTestApp({ flags: { frozen: 1, banned: 0 } });
        await app.ready();
        const res = await app.inject({ method: 'POST', url: PORTAL_ACTION_URL });
        expect(res.statusCode).toBe(200);
        await app.close();
    });

    it('humanSanctionStore absent → passes through without crash', async () => {
        const app = buildTestApp({ humanDid: HUMAN_DID, noStore: true });
        await app.ready();
        const res = await app.inject({ method: 'POST', url: PORTAL_ACTION_URL });
        expect(res.statusCode).toBe(200);
        await app.close();
    });
});
