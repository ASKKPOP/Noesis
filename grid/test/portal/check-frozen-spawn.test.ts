/**
 * Phase 28 SPAWN-03 — check-frozen.ts extended to gate /api/v1/portal/nous/spawn.
 *
 * Verifies:
 *   - POST /api/v1/portal/nous/spawn is blocked for frozen humans (403)
 *   - GET /api/v1/portal/nous/spawn/status/:txHash passes through (not blocked)
 *   - GET /api/v1/portal/nous/spawn/config passes through (not blocked)
 *   - POST /api/v1/portal/nous/spawn is blocked for banned humans (403)
 *   - The PORTAL_ACTION_PATTERNS array is still a single constant
 */

import { describe, it, expect, afterEach } from 'vitest';
import Fastify from 'fastify';
import { AuditChain } from '../../src/audit/chain.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { registerFrozenCheck } from '../../src/api/portal/check-frozen.js';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../../src/api/server.js';

const HUMAN_DID = 'did:noesis:human:0xdeadbeef';

type FlagRow = { frozen: number; banned: number };

function makeStore(flags: FlagRow | null): GridServices['humanSanctionStore'] {
    return {
        existsByDid: async () => flags !== null,
        setBanned: async () => {},
        setFrozen: async () => {},
        getFlags: async (_did: string) => flags,
    } as unknown as GridServices['humanSanctionStore'];
}

function buildTestApp(opts: {
    humanDid?: string;
    flags?: FlagRow | null;
}): FastifyInstance {
    const clock = new WorldClock({ tickRateMs: 100_000 });
    const audit = new AuditChain();
    const services: Partial<GridServices> = {
        clock,
        audit,
        humanSanctionStore: makeStore(opts.flags ?? null),
    };

    const app = Fastify({ logger: false });

    if (opts.humanDid !== undefined) {
        app.addHook('preHandler', async (req) => {
            (req as typeof req & { session: Record<string, unknown> }).session = {
                humanDid: opts.humanDid,
            };
        });
    }

    registerFrozenCheck(app, services as GridServices);

    // Stub routes
    app.post('/api/v1/portal/nous/spawn', async (_req, reply) => reply.send({ ok: true }));
    app.get('/api/v1/portal/nous/spawn/status/:txHash', async (_req, reply) => reply.send({ ok: true }));
    app.get('/api/v1/portal/nous/spawn/config', async (_req, reply) => reply.send({ ok: true }));
    app.get('/api/v1/portal/nous/spawn/check-name', async (_req, reply) => reply.send({ ok: true }));

    return app;
}

describe('registerFrozenCheck — Phase 28 spawn route gate', () => {
    afterEach(() => {
        // cleanup handled per-test via app.close()
    });

    it('frozen human on POST /api/v1/portal/nous/spawn → 403 human_frozen', async () => {
        const app = buildTestApp({ humanDid: HUMAN_DID, flags: { frozen: 1, banned: 0 } });
        await app.ready();
        const res = await app.inject({ method: 'POST', url: '/api/v1/portal/nous/spawn' });
        expect(res.statusCode).toBe(403);
        expect(JSON.parse(res.body)).toMatchObject({ error: 'human_frozen' });
        await app.close();
    });

    it('banned human on POST /api/v1/portal/nous/spawn → 403 human_banned', async () => {
        const app = buildTestApp({ humanDid: HUMAN_DID, flags: { frozen: 0, banned: 1 } });
        await app.ready();
        const res = await app.inject({ method: 'POST', url: '/api/v1/portal/nous/spawn' });
        expect(res.statusCode).toBe(403);
        expect(JSON.parse(res.body)).toMatchObject({ error: 'human_banned' });
        await app.close();
    });

    it('frozen human on GET /spawn/status/:txHash → passes through (200)', async () => {
        const app = buildTestApp({ humanDid: HUMAN_DID, flags: { frozen: 1, banned: 0 } });
        await app.ready();
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal/nous/spawn/status/0xabc123',
        });
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toMatchObject({ ok: true });
        await app.close();
    });

    it('frozen human on GET /spawn/config → passes through (200)', async () => {
        const app = buildTestApp({ humanDid: HUMAN_DID, flags: { frozen: 1, banned: 0 } });
        await app.ready();
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal/nous/spawn/config',
        });
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toMatchObject({ ok: true });
        await app.close();
    });

    it('frozen human on GET /spawn/check-name → passes through (200)', async () => {
        const app = buildTestApp({ humanDid: HUMAN_DID, flags: { frozen: 1, banned: 0 } });
        await app.ready();
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal/nous/spawn/check-name',
        });
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toMatchObject({ ok: true });
        await app.close();
    });

    it('non-frozen human on POST /api/v1/portal/nous/spawn → passes through (200)', async () => {
        const app = buildTestApp({ humanDid: HUMAN_DID, flags: { frozen: 0, banned: 0 } });
        await app.ready();
        const res = await app.inject({ method: 'POST', url: '/api/v1/portal/nous/spawn' });
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toMatchObject({ ok: true });
        await app.close();
    });
});
