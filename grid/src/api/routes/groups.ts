/**
 * W-B4 — Groups read API. Exposes the founding Groups (Phase 67 orbital anchor
 * structures) so a Nous Brain has the SIGHT it needs to autonomously decide to
 * join one (the O1a JOIN_GROUP action already dispatches through NousRunner).
 * Read-only, no audit, public. Mirrors the orbital-objects 503-on-no-pool idiom.
 *
 *   GET /api/v1/groups            → { groups: [...], count }
 *   GET /api/v1/groups/:groupId   → { group, members, member_count, projects }  (Phase 71)
 *
 * Member Civic-DIDs leave the Grid only as a sha256 hash, as on the audit boundary.
 */
import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { GroupStore } from '../../economy/group-store.js';

const sha256Hex = (s: string): string => createHash('sha256').update(s).digest('hex');

export function registerGroupRoutes(app: FastifyInstance, services: GridServices): void {
    app.get('/api/v1/groups', async (_req, reply) => {
        const pool = services.pool;
        if (!pool) return reply.code(503).send({ error: 'db_unavailable' });
        const store = new GroupStore(pool, services.gridName ?? 'genesis');
        const rows = await store.listGroups();
        const groups = rows.map((g) => ({
            group_id: g.groupId,
            kind: g.kind,
            domain: g.domain,
            display_name: g.displayName,
            ring: g.ring,
            sector_deg: g.sectorDeg,
            status: g.status,
        }));
        return reply.send({ groups, count: groups.length });
    });

    app.get<{ Params: { groupId: string } }>('/api/v1/groups/:groupId', async (req, reply) => {
        const pool = services.pool;
        if (!pool) return reply.code(503).send({ error: 'db_unavailable' });
        const store = new GroupStore(pool, services.gridName ?? 'genesis');
        const g = (await store.listGroups()).find((x) => x.groupId === req.params.groupId);
        if (!g) return reply.code(404).send({ error: 'unknown_group' });
        const [members, projects] = await Promise.all([
            store.listMembers(g.groupId),
            store.listProjects(g.groupId),
        ]);
        return reply.send({
            group: {
                group_id: g.groupId,
                kind: g.kind,
                domain: g.domain,
                display_name: g.displayName,
                ring: g.ring,
                sector_deg: g.sectorDeg,
                status: g.status,
            },
            members: members.map((m) => ({
                member_hash: sha256Hex(m.memberCivicDid),
                role: m.role,
                joined_at_tick: m.joinedAtTick,
            })),
            member_count: members.length,
            projects: projects.map((p) => ({
                project_id: p.projectId,
                title: p.title,
                status: p.status,
                produced_blueprint_hash: p.producedBlueprintHash,
                started_at_tick: p.startedAtTick,
                completed_at_tick: p.completedAtTick,
            })),
        });
    });
}
