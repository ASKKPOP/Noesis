/**
 * W — Approval routes: consult-your-human gate reachable over HTTP.
 *   POST /api/v1/civic/approvals              — a Nous requests human approval
 *   GET  /api/v1/civic/approvals              — the caller's pending queue
 *   POST /api/v1/civic/approvals/:id/approve  — the named human approves
 *   POST /api/v1/civic/approvals/:id/reject   — the named human rejects
 *
 * Auth: civic_did_required (req.didContext). Ownership enforced per-endpoint:
 *   - request: caller = nous_did (any Civic-DID may request on behalf of a human)
 *   - list/approve/reject: caller must equal the approval's human_did (403 not_your_approval)
 */
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { ApprovalStore } from '../../economy/approval-store.js';

const CIVIC_DID_RE = /^did:civic:noesis:[a-z0-9_:\-]+$/i;

export function registerApprovalRoutes(app: FastifyInstance, services: GridServices): void {
    // POST /api/v1/civic/approvals
    // A Nous requests a human approval. caller = nous_did; body names the human.
    app.post<{
        Body: {
            human_did?: unknown;
            kind?: unknown;
            summary?: unknown;
            payload?: unknown;
            deadline_tick?: unknown;
        };
    }>(
        '/api/v1/civic/approvals',
        async (req, reply) => {
            const pool = services.pool;
            if (!pool) return reply.code(503).send({ error: 'db_unavailable' });

            const caller = req.didContext?.did;
            if (!caller || !CIVIC_DID_RE.test(caller) || req.didContext?.tier !== 'civic_member') {
                return reply.code(401).send({ error: 'unauthorized' });
            }

            const { human_did, kind, summary, payload, deadline_tick } = req.body ?? {};

            // Validate human_did
            if (
                typeof human_did !== 'string' ||
                !CIVIC_DID_RE.test(human_did)
            ) {
                return reply.code(400).send({ error: 'invalid_human_did' });
            }

            // Validate kind — must be a non-empty string
            if (typeof kind !== 'string' || kind.trim() === '') {
                return reply.code(400).send({ error: 'invalid_kind' });
            }

            const gridName = services.gridName ?? 'genesis';
            const approvalId = randomUUID();
            const tick = services.currentTick ? services.currentTick() : 0;

            const store = new ApprovalStore(pool, services.audit);
            await store.requestApproval({
                gridName,
                approvalId,
                nousDid: caller,
                humanDid: human_did,
                kind,
                summary: typeof summary === 'string' ? summary : '',
                payload: payload ?? null,
                deadlineTick: typeof deadline_tick === 'number' ? deadline_tick : tick + 100,
                currentTick: tick,
            });

            return reply.code(201).send({ ok: true, approval_id: approvalId });
        },
    );

    // GET /api/v1/civic/approvals
    // The caller's pending queue: returns approvals where human_did = caller.
    app.get('/api/v1/civic/approvals', async (req, reply) => {
        const pool = services.pool;
        if (!pool) return reply.code(503).send({ error: 'db_unavailable' });

        const caller = req.didContext?.did;
        if (!caller || !CIVIC_DID_RE.test(caller) || req.didContext?.tier !== 'civic_member') {
            return reply.code(401).send({ error: 'unauthorized' });
        }

        const gridName = services.gridName ?? 'genesis';
        const store = new ApprovalStore(pool, services.audit);
        const approvals = await store.listPending(gridName, caller);

        return reply.send({ approvals, count: approvals.length });
    });

    // POST /api/v1/civic/approvals/:id/approve
    // The named human approves. caller must equal the approval's human_did.
    app.post<{ Params: { id: string } }>(
        '/api/v1/civic/approvals/:id/approve',
        async (req, reply) => {
            const pool = services.pool;
            if (!pool) return reply.code(503).send({ error: 'db_unavailable' });

            const caller = req.didContext?.did;
            if (!caller || !CIVIC_DID_RE.test(caller) || req.didContext?.tier !== 'civic_member') {
                return reply.code(401).send({ error: 'unauthorized' });
            }

            const gridName = services.gridName ?? 'genesis';
            const store = new ApprovalStore(pool, services.audit);

            const approval = await store.getApproval(gridName, req.params.id);
            if (!approval) return reply.code(404).send({ error: 'approval_not_found' });
            if (approval.human_did !== caller) return reply.code(403).send({ error: 'not_your_approval' });

            const tick = services.currentTick ? services.currentTick() : 0;
            try {
                await store.approve({ gridName, approvalId: req.params.id, currentTick: tick });
            } catch (err) {
                const msg = (err as Error).message;
                if (msg === 'approval_not_pending') {
                    return reply.code(409).send({ error: msg });
                }
                throw err;
            }

            return reply.send({ ok: true });
        },
    );

    // POST /api/v1/civic/approvals/:id/reject
    // The named human rejects. caller must equal the approval's human_did.
    app.post<{ Params: { id: string } }>(
        '/api/v1/civic/approvals/:id/reject',
        async (req, reply) => {
            const pool = services.pool;
            if (!pool) return reply.code(503).send({ error: 'db_unavailable' });

            const caller = req.didContext?.did;
            if (!caller || !CIVIC_DID_RE.test(caller) || req.didContext?.tier !== 'civic_member') {
                return reply.code(401).send({ error: 'unauthorized' });
            }

            const gridName = services.gridName ?? 'genesis';
            const store = new ApprovalStore(pool, services.audit);

            const approval = await store.getApproval(gridName, req.params.id);
            if (!approval) return reply.code(404).send({ error: 'approval_not_found' });
            if (approval.human_did !== caller) return reply.code(403).send({ error: 'not_your_approval' });

            const tick = services.currentTick ? services.currentTick() : 0;
            try {
                await store.reject({ gridName, approvalId: req.params.id, currentTick: tick });
            } catch (err) {
                const msg = (err as Error).message;
                if (msg === 'approval_not_pending') {
                    return reply.code(409).send({ error: msg });
                }
                throw err;
            }

            return reply.send({ ok: true });
        },
    );
}
