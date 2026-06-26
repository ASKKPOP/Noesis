/**
 * Phase 53 Portal Grid Approval Workflow — routes (grid-side portal pipeline).
 *
 *   POST /portal/api/v1/grid/request          — a Nous or operator proposes a new Grid
 *   POST /portal/api/v1/grid/:requestId/decision — reviewer panel approves/rejects (≤2 approvals/quarter)
 *
 * v3.0 ships the workflow; no Grid is actually instantiated (only Genesis exists).
 */
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { GridApprovalStore } from '../../portal-workflows/grid-approval-store.js';
import { GRID_REJECT_REASONS, type GridRejectReason } from '../../portal-workflows/grid-approval-types.js';

const NAME_RE = /^[A-Za-z][A-Za-z0-9 \-]{1,62}$/;

export function registerPortalGridApprovalRoutes(app: FastifyInstance, services: GridServices): void {
    const tick = (): number => (services.currentTick ? services.currentTick() : 0);

    app.post<{ Body: { proposed_name?: unknown; founding_capital?: unknown } }>(
        '/portal/api/v1/grid/request',
        async (req, reply) => {
            const requester = req.didContext?.did;
            if (!requester) return reply.code(401).send({ error: 'civic_did_required' });
            const pool = services.pool; const audit = services.audit;
            if (!pool || !audit) return reply.code(503).send({ error: 'portal_unavailable' });
            const name = typeof req.body?.proposed_name === 'string' ? req.body.proposed_name.trim() : '';
            if (!NAME_RE.test(name)) return reply.code(400).send({ error: 'invalid_proposed_name' });
            const capital = typeof req.body?.founding_capital === 'number' ? Math.max(0, Math.floor(req.body.founding_capital)) : 0;
            const r = await new GridApprovalStore(pool, audit).request({ proposedName: name, requesterDid: requester, foundingCapital: capital, tick: tick() });
            return reply.code(201).send({ status: 'pending_review', request_id: r.requestId });
        },
    );

    app.post<{ Params: { requestId: string }; Body: { decision?: unknown; reason?: unknown } }>(
        '/portal/api/v1/grid/:requestId/decision',
        async (req, reply) => {
            const reviewer = req.didContext?.did;
            if (req.didContext?.tier !== 'government' || !reviewer) return reply.code(403).send({ error: 'reviewer_panel_only' });
            const pool = services.pool; const audit = services.audit;
            if (!pool || !audit) return reply.code(503).send({ error: 'portal_unavailable' });
            const decision = req.body?.decision;
            if (decision !== 'approve' && decision !== 'reject') return reply.code(400).send({ error: 'invalid_decision' });
            const reason = GRID_REJECT_REASONS.includes(req.body?.reason as GridRejectReason) ? (req.body?.reason as GridRejectReason) : undefined;
            const r = await new GridApprovalStore(pool, audit).decide({ requestId: req.params.requestId, reviewerDid: reviewer, decision, reason, tick: tick() });
            if (!r.ok) return reply.code(r.reason === 'quarter_limit' ? 429 : r.reason === 'not_found' ? 404 : 409).send({ error: r.reason });
            return reply.code(201).send({ status: decision === 'approve' ? 'approved' : 'rejected', request_id: req.params.requestId });
        },
    );
}
