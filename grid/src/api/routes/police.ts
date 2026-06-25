/**
 * Phase 47 Police v3 — Plan 1 (POL-01/02): complaint + investigation.
 *
 *   POST /api/v1/police/complaint                       — a member files a complaint (POL-01)
 *   POST /api/v1/police/complaint/:complaintId/investigate — Police open an investigation (POL-02)
 *   GET  /api/v1/police/complaints                      — list complaints
 *
 * All civic_did_required. A complaint and an investigation carry NO punitive power —
 * sanctions require Government conviction (Plan 2). There is no operator-direct or
 * Police-direct sanction path anywhere in the routing table (D-V3-18).
 */
import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { PoliceStore } from '../../police/police-store.js';

const CIVIC_DID_RE = /^did:civic:noesis:[a-z0-9_:\-]+$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sha256Hex = (s: string): string => createHash('sha256').update(s).digest('hex');

export function registerPoliceRoutes(app: FastifyInstance, services: GridServices): void {
    const grid = services.gridName ?? 'genesis';
    const tick = (): number => (services.currentTick ? services.currentTick() : 0);

    // POL-01 — file a complaint (any civic member).
    app.post<{ Body: { accused_civic_did?: unknown; cited_law_id?: unknown; evidence_event_ids?: unknown } }>(
        '/api/v1/police/complaint',
        async (req, reply) => {
            const complainant = req.didContext?.did;
            if (!complainant || req.didContext?.tier !== 'civic_member' || !CIVIC_DID_RE.test(complainant)) {
                return reply.code(401).send({ error: 'civic_did_required' });
            }
            const pool = services.pool; const audit = services.audit;
            if (!pool || !audit) return reply.code(503).send({ error: 'police_unavailable' });

            const accused = typeof req.body?.accused_civic_did === 'string' ? req.body.accused_civic_did.trim() : '';
            const citedLaw = typeof req.body?.cited_law_id === 'string' ? req.body.cited_law_id.trim() : '';
            if (!CIVIC_DID_RE.test(accused)) return reply.code(400).send({ error: 'invalid_accused_civic_did' });
            if (accused === complainant) return reply.code(400).send({ error: 'cannot_accuse_self' });
            if (!UUID_RE.test(citedLaw)) return reply.code(400).send({ error: 'invalid_cited_law_id' });
            const evidence = Array.isArray(req.body?.evidence_event_ids) ? (req.body.evidence_event_ids as unknown[]).map(String) : [];
            const evidenceChainHash = sha256Hex([...evidence].sort().join(','));

            const complaintId = await new PoliceStore(pool, audit).fileComplaint({
                gridName: grid, complainantDid: complainant, accusedDid: accused,
                citedLawId: citedLaw, evidenceChainHash, tick: tick(),
            });
            return reply.code(201).send({ complaint_id: complaintId, status: 'filed' });
        },
    );

    // POL-02 — open an investigation from a filed complaint.
    app.post<{ Params: { complaintId: string } }>(
        '/api/v1/police/complaint/:complaintId/investigate',
        async (req, reply) => {
            const caller = req.didContext?.did;
            if (!caller || req.didContext?.tier !== 'civic_member') return reply.code(401).send({ error: 'civic_did_required' });
            const pool = services.pool; const audit = services.audit;
            if (!pool || !audit) return reply.code(503).send({ error: 'police_unavailable' });
            const complaintId = req.params.complaintId;
            if (!UUID_RE.test(complaintId)) return reply.code(400).send({ error: 'invalid_complaint_id' });

            const store = new PoliceStore(pool, audit);
            const complaint = await store.getComplaint(grid, complaintId);
            if (!complaint) return reply.code(404).send({ error: 'unknown_complaint' });
            if (complaint.status !== 'filed') return reply.code(409).send({ error: 'complaint_not_open', status: complaint.status });

            const investigationId = await store.openInvestigation({ gridName: grid, complaintId, tick: tick() });
            return reply.code(201).send({ investigation_id: investigationId, complaint_id: complaintId, status: 'open' });
        },
    );

    // List complaints (optionally ?accused=<civicDid> or ?status=<status>).
    app.get<{ Querystring: { accused?: string; status?: string } }>(
        '/api/v1/police/complaints',
        async (req, reply) => {
            if (req.didContext?.tier !== 'civic_member') return reply.code(401).send({ error: 'civic_did_required' });
            const pool = services.pool; const audit = services.audit;
            if (!pool || !audit) return reply.code(503).send({ error: 'police_unavailable' });
            const accused = typeof req.query.accused === 'string' && CIVIC_DID_RE.test(req.query.accused) ? req.query.accused : undefined;
            const status = typeof req.query.status === 'string' ? req.query.status : undefined;
            const complaints = await new PoliceStore(pool, audit).listComplaints(grid, { accusedDid: accused, status });
            return reply.send({ complaints, count: complaints.length });
        },
    );
}
