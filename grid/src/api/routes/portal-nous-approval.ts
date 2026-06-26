/**
 * Phase 54 Portal Nous Approval Workflow (NOUS track) — routes.
 *
 *   POST /portal/api/v1/nous/request              — a Nous registration enters the pipeline
 *   POST /portal/api/v1/nous/:requestId/prescreen — Portal pre-screen (forward to Polis / reject)
 *   POST /api/v1/gov/charter/review/:requestId    — target-Grid Polis charter decision
 *
 * Every Nous registration is Portal-gated (D-V3-33).
 */
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { NousRegistrationStore } from '../../portal-workflows/nous-registration-store.js';
import { NOUS_REJECT_REASONS, type NousRejectReason } from '../../portal-workflows/nous-registration-types.js';

const DID_RE = /^did:(?:civic:)?noesis:[a-z0-9_:\-]+$/i;

export function registerPortalNousApprovalRoutes(app: FastifyInstance, services: GridServices): void {
    const grid = services.gridName ?? 'genesis';
    const tick = (): number => (services.currentTick ? services.currentTick() : 0);

    app.post<{ Body: { type?: unknown; nous_did?: unknown; operator_did?: unknown; ceremony_ref?: unknown; target_grid_id?: unknown; civic_oath_signature?: unknown } }>(
        '/portal/api/v1/nous/request',
        async (req, reply) => {
            if (!req.didContext?.did) return reply.code(401).send({ error: 'civic_did_required' });
            const pool = services.pool; const audit = services.audit;
            if (!pool || !audit) return reply.code(503).send({ error: 'portal_unavailable' });
            const type = req.body?.type;
            if (type !== 'A' && type !== 'B') return reply.code(400).send({ error: 'invalid_type' });
            const nousDid = typeof req.body?.nous_did === 'string' ? req.body.nous_did.trim() : '';
            if (!DID_RE.test(nousDid)) return reply.code(400).send({ error: 'invalid_nous_did' });
            // Type A needs operator_did; Type B needs ceremony_ref. Plus a civic oath signature.
            const registrant = type === 'A' ? (typeof req.body?.operator_did === 'string' ? req.body.operator_did.trim() : '') : (typeof req.body?.ceremony_ref === 'string' ? req.body.ceremony_ref.trim() : '');
            if (!registrant) return reply.code(400).send({ error: type === 'A' ? 'missing_operator_did' : 'missing_ceremony_ref' });
            if (typeof req.body?.civic_oath_signature !== 'string' || req.body.civic_oath_signature.length === 0) return reply.code(400).send({ error: 'missing_oath' });
            const targetGrid = typeof req.body?.target_grid_id === 'string' && req.body.target_grid_id.trim() ? req.body.target_grid_id.trim() : grid;
            const r = await new NousRegistrationStore(pool, audit).request({ type, registrantDid: registrant, nousDid, targetGrid, tick: tick() });
            return reply.code(201).send({ status: 'requested', request_id: r.requestId });
        },
    );

    app.post<{ Params: { requestId: string }; Body: { pass?: unknown; reason?: unknown } }>(
        '/portal/api/v1/nous/:requestId/prescreen',
        async (req, reply) => {
            if (req.didContext?.tier !== 'government') return reply.code(403).send({ error: 'portal_reviewer_only' });
            const pool = services.pool; const audit = services.audit;
            if (!pool || !audit) return reply.code(503).send({ error: 'portal_unavailable' });
            const pass = req.body?.pass === true;
            const reason = NOUS_REJECT_REASONS.includes(req.body?.reason as NousRejectReason) ? (req.body?.reason as NousRejectReason) : undefined;
            const r = await new NousRegistrationStore(pool, audit).preScreen({ requestId: req.params.requestId, pass, reason, tick: tick() });
            if (!r.ok) return reply.code(r.reason === 'not_found' ? 404 : 409).send({ error: r.reason });
            return reply.code(201).send({ status: r.forwarded ? 'polis_pending' : 'rejected' });
        },
    );

    app.post<{ Params: { requestId: string }; Body: { decision?: unknown; reason?: unknown } }>(
        '/api/v1/gov/charter/review/:requestId',
        async (req, reply) => {
            if (req.didContext?.tier !== 'government') return reply.code(403).send({ error: 'government_required' });
            const pool = services.pool; const audit = services.audit;
            if (!pool || !audit) return reply.code(503).send({ error: 'portal_unavailable' });
            const decision = req.body?.decision;
            if (decision !== 'approve' && decision !== 'reject') return reply.code(400).send({ error: 'invalid_decision' });
            const reason = NOUS_REJECT_REASONS.includes(req.body?.reason as NousRejectReason) ? (req.body?.reason as NousRejectReason) : undefined;
            const r = await new NousRegistrationStore(pool, audit).polisReview({ requestId: req.params.requestId, decision, reason, tick: tick() });
            if (!r.ok) return reply.code(r.reason === 'not_found' ? 404 : 409).send({ error: r.reason });
            return reply.code(201).send({ status: decision === 'approve' ? 'approved' : 'rejected', residence_id: r.residenceId });
        },
    );
}
