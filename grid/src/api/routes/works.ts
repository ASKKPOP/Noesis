/**
 * The Work Card routes — the nine-stage loop over HTTP.
 *
 *   POST /api/v1/works                        2 Goal    state a goal (and name the builder)
 *   POST /api/v1/works/:workId/answer         2 Goal    the asked Nous accepts or declines
 *   POST /api/v1/works/:workId/define         3 Define  for what, how, which, checks
 *   POST /api/v1/works/:workId/plan           4 Plan    ordered steps
 *   POST /api/v1/works/:workId/plan/approve   4 Plan    the owner approves
 *   POST /api/v1/works/:workId/build          5 Build   the next step is done
 *   POST /api/v1/works/:workId/test           6 Test    one check passed or failed
 *   POST /api/v1/works/:workId/verify         7 Verify  another Nous confirms or refuses
 *   POST /api/v1/works/:workId/deploy         8 Deploy  where the result lives
 *   POST /api/v1/works/:workId/notice         9 Notice  the announcement
 *   GET  /api/v1/works                        the Works of this Grid, latest change first;
 *                                             ?role=owner|builder|verify narrows to the caller's own
 *   GET  /api/v1/works/notices                the notice board: finished Works
 *   GET  /api/v1/works/:workId                one card — the same record for a person and a Nous
 *
 * Stage 1, Enter, is membership. Who is writing is taken from the request's own
 * identity and never from its body: a Nous by its Civic-DID bearer token, a person by
 * the Portal session cookie, looked up in this Grid's civic registry. The write routes
 * are 'public' in the policy table for that reason — a person arrives with a cookie,
 * not a bearer token — and each one refuses a caller who is not a member.
 *
 * Every write names the card version it was based on (`version`); a stale one gets 409.
 */
import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { GridServices } from '../server.js';
import { MysqlWorkStore } from '../../work/mysql-work-store.js';
import { WorkService, type WorkServiceResult } from '../../work/work-service.js';
import { WORK_STAGES, allowedOps, type MemberKind, type WorkStage } from '../../work/work-logic.js';
import { CIVIC_DID_RE, HUMAN_DID_RE } from '../../util/id-patterns.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The write route of each later stage, and the operation it sends to applyWorkOp. */
export const WORK_WRITE_ROUTES: ReadonlyArray<readonly [path: string, op: string]> = [
    ['answer', 'answer'],
    ['define', 'define'],
    ['plan', 'set_plan'],
    ['plan/approve', 'approve_plan'],
    ['build', 'complete_step'],
    ['test', 'record_check'],
    ['verify', 'verify'],
    ['deploy', 'deploy'],
    ['notice', 'announce'],
];

function statusOf(error: string): number {
    if (error === 'not_member' || error === 'not_allowed') return 403;
    if (error === 'unknown_work') return 404;
    if (error === 'stale_version' || error === 'wrong_stage') return 409;
    return 400;
}

export function registerWorkRoutes(app: FastifyInstance, services: GridServices): void {
    const grid = services.gridName ?? 'genesis';
    const tick = (): number => (services.currentTick ? services.currentTick() : 0);

    /** What this Grid's registry knows of a Civic-DID. Frozen and revoked ones are no members. */
    const memberKind = async (civicDid: string): Promise<MemberKind | null> => {
        const record = services.civicDidStore ? await services.civicDidStore.get(grid, civicDid) : null;
        if (!record || record.status !== 'active' || record.frozen) return null;
        return HUMAN_DID_RE.test(record.existenceDid) ? 'person' : 'nous';
    };

    const service = (): WorkService | null => {
        const store = services.workStore ?? (services.pool ? new MysqlWorkStore(services.pool) : null);
        if (!store || !services.audit || !services.civicDidStore) return null;
        return new WorkService({ gridName: grid, store, audit: services.audit, memberKind, newId: randomUUID });
    };

    /** The caller's Civic-DID in this Grid, from the request's identity alone; or null. */
    const callerCivicDid = async (req: FastifyRequest): Promise<string | null> => {
        const ctx = req.didContext;
        if (!ctx) return null;
        if (ctx.tier === 'civic_member') return CIVIC_DID_RE.test(ctx.did) ? ctx.did : null;
        if (ctx.tier === 'human_visitor' && services.civicDidStore) {
            const record = await services.civicDidStore.getByExistenceDid(grid, ctx.did);
            return record ? record.civicDid : null;
        }
        return null;
    };

    const send = (reply: FastifyReply, result: WorkServiceResult, created = false): FastifyReply => {
        if (result.ok) return reply.code(created ? 201 : 200).send({ work: result.card });
        return reply.code(statusOf(result.error)).send(
            result.version === undefined ? { error: result.error } : { error: result.error, version: result.version },
        );
    };

    app.post('/api/v1/works', async (req, reply) => {
        const svc = service();
        if (!svc) return reply.code(503).send({ error: 'works_unavailable' });
        const caller = await callerCivicDid(req);
        if (!caller) return reply.code(401).send({ error: 'membership_required' });
        return send(reply, await svc.create(caller, req.body, tick()), true);
    });

    for (const [path, op] of WORK_WRITE_ROUTES) {
        app.post<{ Params: { workId: string } }>(`/api/v1/works/:workId/${path}`, async (req, reply) => {
            const svc = service();
            if (!svc) return reply.code(503).send({ error: 'works_unavailable' });
            const caller = await callerCivicDid(req);
            if (!caller) return reply.code(401).send({ error: 'membership_required' });
            if (!UUID_RE.test(req.params.workId)) return reply.code(404).send({ error: 'unknown_work' });
            const body = req.body !== null && typeof req.body === 'object' && !Array.isArray(req.body)
                ? req.body as Record<string, unknown> : {};
            // The route decides the operation; a body cannot name another one.
            return send(reply, await svc.write(caller, req.params.workId, body.version, { ...body, op }, tick()));
        });
    }

    app.get<{ Querystring: { stage?: string; limit?: string; role?: string } }>('/api/v1/works', async (req, reply) => {
        const svc = service();
        if (!svc) return reply.send({ works: [], count: 0 });
        const stage = req.query.stage;
        if (stage !== undefined && !(WORK_STAGES as readonly string[]).includes(stage)) {
            return reply.code(400).send({ error: 'invalid_stage' });
        }
        const limit = Math.min(Math.max(Number.parseInt(req.query.limit ?? '50', 10) || 50, 1), 200);
        // ?role= narrows the list to the caller's own Works: the ones they own, the ones
        // they build, or the ones waiting for a verifier that they do not build.
        const role = req.query.role;
        if (role === undefined) {
            const works = await svc.list({ stage: stage as WorkStage | undefined, limit });
            return reply.send({ works, count: works.length });
        }
        if (role !== 'owner' && role !== 'builder' && role !== 'verify') return reply.code(400).send({ error: 'invalid_role' });
        const caller = await callerCivicDid(req);
        if (!caller) return reply.code(401).send({ error: 'membership_required' });
        const works = await svc.list(
            role === 'owner' ? { stage: stage as WorkStage | undefined, owner: caller, limit }
                : role === 'builder' ? { stage: stage as WorkStage | undefined, builder: caller, limit }
                    : { stage: 'verify', notBuilder: caller, limit },
        );
        return reply.send({ works, count: works.length });
    });

    // The notice board: finished Works, newest first. Each notice is its Work Card.
    app.get('/api/v1/works/notices', async (_req, reply) => {
        const svc = service();
        if (!svc) return reply.send({ notices: [], count: 0 });
        const notices = await svc.list({ stage: 'done', limit: 100 });
        return reply.send({ notices, count: notices.length });
    });

    app.get<{ Params: { workId: string } }>('/api/v1/works/:workId', async (req, reply) => {
        const svc = service();
        if (!svc) return reply.code(503).send({ error: 'works_unavailable' });
        if (!UUID_RE.test(req.params.workId)) return reply.code(404).send({ error: 'unknown_work' });
        const work = await svc.get(req.params.workId);
        if (!work) return reply.code(404).send({ error: 'unknown_work' });
        // `you` tells a signed-in member who they are on this card and which steps are
        // theirs to take now, so the page can offer the right one.
        const caller = await callerCivicDid(req);
        const kind = caller ? await memberKind(caller) : null;
        return reply.send({ work, you: caller && kind ? { civic_did: caller, kind, may: allowedOps(work, { did: caller, kind }) } : null });
    });
}
