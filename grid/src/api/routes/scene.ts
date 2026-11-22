/**
 * GET /api/v1/scene/events?since=<id> — the public scene feed (D-V3-43).
 *
 * Who did what, where, in this Grid, in privacy-safe form (see scene/scene-feed.ts for
 * exactly what is and is not shown). Public on a public Grid; on a private Grid the
 * members-only gate covers it like every other public read. Read-only.
 */
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { sceneEventsSince } from '../../scene/scene-feed.js';

export function registerSceneRoutes(app: FastifyInstance, services: GridServices): void {
    app.get<{ Querystring: { since?: string } }>('/api/v1/scene/events', async (req, reply) => {
        const raw = req.query.since;
        let since: number | null = null;
        if (raw !== undefined) {
            since = Number(raw);
            if (!Number.isInteger(since) || since < 0) return reply.code(400).send({ error: 'invalid_since' });
        }
        const registry = services.registry;
        const nameOf = (did: string): string | undefined => {
            if (did.startsWith('did:noesis:system:')) return undefined;
            return registry?.get(did)?.name;
        };
        return reply.send(sceneEventsSince(services.audit, since, nameOf));
    });
}
