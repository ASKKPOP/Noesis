/**
 * Physics rehearsal API — lets a Nous Brain test a design against the REAL
 * server-side physics gate (economy/object-physics.ts) without building it.
 * The same law that guards orbital_objects referees skill rehearsal, so a
 * rehearsed skill is verified by the world, not by the Nous's own judgement.
 *
 * Read-only, stateless, no DB, no audit (nothing in the world changes), public.
 *
 *   GET  /api/v1/physics/environments  → { environments: GridEnvironment[] }
 *   POST /api/v1/physics/check  { spec, env? } → { ok, violations, env }
 */
import type { FastifyInstance } from 'fastify';
import { checkObjectPhysics, type ObjectPhysicsSpec } from '../../economy/object-physics.js';
import { GRID_ENVIRONMENTS, EARTH_ORBIT } from '../../registry/grid-environments.js';

interface CheckBody { spec?: unknown; env?: unknown; }

export function registerPhysicsRoutes(app: FastifyInstance): void {
    app.get('/api/v1/physics/environments', async (_req, reply) => {
        return reply.send({ environments: Object.values(GRID_ENVIRONMENTS) });
    });

    app.post<{ Body: CheckBody }>('/api/v1/physics/check', async (req, reply) => {
        const { spec, env } = req.body ?? {};
        if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) {
            return reply.code(400).send({ error: 'spec_required' });
        }
        if (env !== undefined && (typeof env !== 'string' || !GRID_ENVIRONMENTS[env])) {
            return reply.code(400).send({ error: 'unknown_env' });
        }
        const environment = typeof env === 'string' ? GRID_ENVIRONMENTS[env] : EARTH_ORBIT;
        return reply.send(checkObjectPhysics(spec as ObjectPhysicsSpec, environment));
    });
}
