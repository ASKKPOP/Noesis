/**
 * Portal Grid discovery — spec §2 "search the service portal for currently
 * active Grids — what kind of organizations and Nous Houses exist there."
 *
 *   GET /api/v1/portal/grids?q=<name>
 *     → { grids: [...], count }
 *
 * The meta-layer index of active Grids. v3.0 returns one (Genesis); the shape
 * supports federation later. Read-only, no audit, public.
 *
 * D-V3-41 — public / private Grids. Every active Grid is listed (the Portal map
 * shows both). A private Grid is returned to a non-member as name + lock only;
 * a member (a signed-in human holding an active Civic-DID in that Grid) gets the
 * full entry. Each entry carries `visibility`, `member` and `locked`; a full entry also
 * carries `human_members`, the number of humans holding an active Civic-DID there.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { jwtVerify } from 'jose';
import type { GridServices } from '../server.js';
import { COOKIE_NAME, keyPairPromise } from './auth.js';

interface GridsQuery {
    q?: string;
}

/** The signed-in human's DID from the Portal session cookie, or null (anonymous /
 *  invalid token). Never rejects — this route is public and only redacts. */
async function sessionDid(req: FastifyRequest): Promise<string | null> {
    const token = (req.cookies as Record<string, string | undefined> | undefined)?.[COOKIE_NAME];
    if (!token) return null;
    try {
        const { publicKey } = await keyPairPromise;
        const { payload } = await jwtVerify(token, publicKey);
        return typeof payload['did'] === 'string' ? payload['did'] : null;
    } catch {
        return null;
    }
}

export function registerPortalGridsRoutes(app: FastifyInstance, services: GridServices): void {
    app.get<{ Querystring: GridsQuery }>('/api/v1/portal/grids', async (req, reply) => {
        const registry = services.gridRegistry;
        if (!registry) {
            return reply.code(503).send({ error: 'grid_registry_unavailable' });
        }

        const q = (req.query.q ?? '').trim().toLowerCase();
        let grids = registry.active();
        if (q) grids = grids.filter((g) => g.name.toLowerCase().includes(q));

        const did = await sessionDid(req);
        // The civic registry is keyed by Grid NAME (e.g. "Genesis"), not the lowercase id.
        const isMember = async (gridName: string): Promise<boolean> => {
            if (!did || !services.civicDidStore) return false;
            try {
                const civic = await services.civicDidStore.getByExistenceDid(gridName, did);
                return !!civic && civic.status === 'active';
            } catch {
                return false; // fail closed: a lookup failure never unlocks a private Grid
            }
        };

        // Human members: humans holding an active Civic-DID in the Grid. Left out when
        // the count cannot be read, never guessed.
        const humanMembers = async (gridName: string): Promise<number | undefined> => {
            if (!services.civicDidStore) return undefined;
            try {
                return await services.civicDidStore.countActiveHumans(gridName);
            } catch {
                return undefined;
            }
        };

        const out = await Promise.all(grids.map(async (g) => {
            const visibility = g.visibility ?? 'public';
            const member = await isMember(g.name);
            const locked = visibility === 'private' && !member;
            const base = {
                grid_id: g.gridId,
                name: g.name,
                status: g.status,
                visibility,
                member,
                locked,
                celestial_body: g.environment.name,
            };
            if (locked) return base;
            return {
                ...base,
                human_members: await humanMembers(g.name),
                grid_domain: g.gridDomain,
                polis: g.polisName,
                description: g.description,
                environment: g.environment,
            };
        }));

        return reply.send({ grids: out, count: out.length });
    });
}
