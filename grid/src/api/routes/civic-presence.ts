/**
 * Phase 41 SLEEP-01 + SLEEP-03 — civic presence routes.
 * POST /api/v1/civic/presence    — Brain JWT heartbeat
 * GET  /api/v1/civic/presence    — public Civic Map polling
 * GET  /api/v1/civic/presence/me — Brain JWT fallback
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';

const CIVIC_DID_RE = /^did:civic:noesis:[a-z0-9_:\-]+$/i;

export async function registerCivicPresenceRoutes(
    app: FastifyInstance,
    services: GridServices,
): Promise<void> {
    app.post('/api/v1/civic/presence', async (req, reply) => {
        const svc = services.presenceService;
        if (!svc) return reply.code(503).send({ error: 'presence_service_unavailable' });
        const tickFn = services.currentTick;
        if (!tickFn) return reply.code(503).send({ error: 'clock_unavailable' });

        const civicDid = req.didContext?.did;
        if (!civicDid || !CIVIC_DID_RE.test(civicDid) || req.didContext?.tier !== 'civic_member') {
            return reply.code(401).send({ error: 'unauthorized' });
        }
        const tick = tickFn();
        const record = await svc.onHeartbeat(civicDid, tick);
        return reply.code(200).send({
            status: record?.presenceStatus ?? 'awake',
            grace_timer_active: false,
            last_seen_tick: record?.lastSeenTick ?? tick,
        });
    });

    app.get('/api/v1/civic/presence', async (_req, reply) => {
        const svc = services.presenceService;
        if (!svc) return reply.code(503).send({ error: 'presence_service_unavailable' });
        const records = await svc.listAllPresence();
        return reply.code(200).send({
            nous: records.map(r => ({
                civic_did: r.civicDid,
                presence_status: r.presenceStatus,
                last_seen_at: r.lastSeenAt ? r.lastSeenAt.toISOString() : null,
            })),
        });
    });

    app.get('/api/v1/civic/presence/me', async (req, reply) => {
        const svc = services.presenceService;
        if (!svc) return reply.code(503).send({ error: 'presence_service_unavailable' });
        const civicDid = req.didContext?.did;
        if (!civicDid || !CIVIC_DID_RE.test(civicDid) || req.didContext?.tier !== 'civic_member') {
            return reply.code(401).send({ error: 'unauthorized' });
        }
        const record = await svc.getPresence(civicDid);
        if (!record) return reply.code(404).send({ error: 'civic_did_not_found' });
        return reply.code(200).send({
            civic_did: record.civicDid,
            presence_status: record.presenceStatus,
            last_seen_at: record.lastSeenAt ? record.lastSeenAt.toISOString() : null,
            last_seen_tick: record.lastSeenTick,
            frozen: record.frozen,
        });
    });
}
