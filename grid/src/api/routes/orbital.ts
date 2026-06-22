/**
 * L4 — Orbital objects read API. Exposes the real, economy-built, physics-gated
 * orbital_objects (L3) so Grid-Viz can render them instead of inventing cosmetic
 * ones. Read-only, no audit, public. Mirrors the irs/portal-grids 503-on-no-pool idiom.
 *
 *   GET /api/v1/orbital/objects?grid=<name>  → { objects: [...], count }
 */
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { OrbitalObjectStore } from '../../economy/orbital-object-store.js';

interface OrbitalQuery { grid?: string; }

export function registerOrbitalRoutes(app: FastifyInstance, services: GridServices): void {
    app.get<{ Querystring: OrbitalQuery }>('/api/v1/orbital/objects', async (req, reply) => {
        const pool = services.pool;
        if (!pool) return reply.code(503).send({ error: 'db_unavailable' });
        const gridName = (req.query.grid ?? services.gridName ?? 'genesis').trim();
        const store = new OrbitalObjectStore(pool);
        const rows = await store.listObjects(gridName);
        const objects = rows.map((o) => ({
            object_id: o.object_id,
            owner_did: o.owner_did,
            builder_did: o.builder_did,
            build_cost_wei: o.build_cost_wei,
            function_type: o.function_type,
            output_rate: o.output_rate,
            zone: o.zone,
            status: o.status,
            physics_spec: safeParse(o.physics_spec),
        }));
        return reply.send({ objects, count: objects.length });
    });
}

function safeParse(s: string): unknown {
    try { return JSON.parse(s); } catch { return null; }
}
