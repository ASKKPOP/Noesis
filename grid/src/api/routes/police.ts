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
import { SANCTION_TYPES, type SanctionType } from '../../police/types.js';
import { TreasuryWeiStore } from '../../economy/treasury-wei-store.js';

const CIVIC_DID_RE = /^did:civic:noesis:[a-z0-9_:\-]+$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sha256Hex = (s: string): string => createHash('sha256').update(s).digest('hex');
const isSanction = (s: unknown): s is SanctionType => typeof s === 'string' && SANCTION_TYPES.includes(s as SanctionType);

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

    // POL-03 — Police file formal charges with the Government court (police_only).
    app.post<{ Body: { investigation_id?: unknown; accused_civic_did?: unknown; alleged_law_id?: unknown; evidence_event_ids?: unknown; recommended_sanction?: unknown } }>(
        '/api/v1/police/charge',
        async (req, reply) => {
            if (req.didContext?.tier !== 'civic_member') return reply.code(401).send({ error: 'police_required' });
            const pool = services.pool; const audit = services.audit;
            if (!pool || !audit) return reply.code(503).send({ error: 'police_unavailable' });
            const investigationId = typeof req.body?.investigation_id === 'string' ? req.body.investigation_id.trim() : '';
            const accused = typeof req.body?.accused_civic_did === 'string' ? req.body.accused_civic_did.trim() : '';
            const allegedLaw = typeof req.body?.alleged_law_id === 'string' ? req.body.alleged_law_id.trim() : '';
            if (!UUID_RE.test(investigationId)) return reply.code(400).send({ error: 'invalid_investigation_id' });
            if (!CIVIC_DID_RE.test(accused)) return reply.code(400).send({ error: 'invalid_accused_civic_did' });
            if (!UUID_RE.test(allegedLaw)) return reply.code(400).send({ error: 'invalid_alleged_law_id' });
            if (!isSanction(req.body?.recommended_sanction)) return reply.code(400).send({ error: 'invalid_recommended_sanction' });
            const evidence = Array.isArray(req.body?.evidence_event_ids) ? (req.body.evidence_event_ids as unknown[]).map(String) : [];
            const evidenceSummaryHash = sha256Hex([...evidence].sort().join(','));

            const chargeId = await new PoliceStore(pool, audit).fileCharges({
                gridName: grid, investigationId, accusedDid: accused, allegedLawId: allegedLaw,
                evidenceSummaryHash, recommendedSanction: req.body.recommended_sanction, tick: tick(),
            });
            return reply.code(201).send({ charge_id: chargeId, status: 'filed' });
        },
    );

    // Government conviction / acquittal — the ONLY path to punitive power (government_only).
    app.post<{ Params: { chargeId: string }; Body: { convicted?: unknown; gov_session_id?: unknown } }>(
        '/api/v1/police/charge/:chargeId/convict',
        async (req, reply) => {
            if (req.didContext?.tier !== 'government') return reply.code(403).send({ error: 'government_required' });
            const pool = services.pool; const audit = services.audit;
            if (!pool || !audit) return reply.code(503).send({ error: 'police_unavailable' });
            const chargeId = req.params.chargeId;
            if (!UUID_RE.test(chargeId)) return reply.code(400).send({ error: 'invalid_charge_id' });
            const govSessionId = typeof req.body?.gov_session_id === 'string' ? req.body.gov_session_id.trim() : '';
            if (!UUID_RE.test(govSessionId)) return reply.code(400).send({ error: 'invalid_gov_session_id' });
            if (typeof req.body?.convicted !== 'boolean') return reply.code(400).send({ error: 'convicted_must_be_boolean' });

            const store = new PoliceStore(pool, audit);
            const charge = await store.getCharge(grid, chargeId);
            if (!charge) return reply.code(404).send({ error: 'unknown_charge' });
            if (charge.status !== 'filed') return reply.code(409).send({ error: 'charge_not_open', status: charge.status });
            await store.resolveCharge(grid, chargeId, req.body.convicted, govSessionId, tick());
            return reply.send({ charge_id: chargeId, status: req.body.convicted ? 'convicted' : 'acquitted' });
        },
    );

    // POL-04 — execute a sanction, ONLY against a CONVICTED charge (police_only). The
    // conviction (government_only, above) is the constitutional gate; no operator/Police-
    // direct sanction path exists (D-V3-18).
    app.post<{ Params: { chargeId: string }; Body: { sanction_type?: unknown; duration_ticks?: unknown; community_id?: unknown; amount_wei?: unknown } }>(
        '/api/v1/police/charge/:chargeId/execute-sanction',
        async (req, reply) => {
            if (req.didContext?.tier !== 'civic_member') return reply.code(401).send({ error: 'police_required' });
            const pool = services.pool; const audit = services.audit;
            if (!pool || !audit) return reply.code(503).send({ error: 'police_unavailable' });
            const chargeId = req.params.chargeId;
            if (!UUID_RE.test(chargeId)) return reply.code(400).send({ error: 'invalid_charge_id' });
            if (!isSanction(req.body?.sanction_type)) return reply.code(400).send({ error: 'invalid_sanction_type' });
            const sanctionType = req.body.sanction_type;

            const store = new PoliceStore(pool, audit);
            const charge = await store.getCharge(grid, chargeId);
            if (!charge) return reply.code(404).send({ error: 'unknown_charge' });
            if (charge.status !== 'convicted') return reply.code(403).send({ error: 'no_conviction', status: charge.status });

            const accused = charge.accused_civic_did;
            let amountWei: bigint | null = null;
            const communityId = typeof req.body?.community_id === 'string' && UUID_RE.test(req.body.community_id) ? req.body.community_id : null;
            const durationTicks = Number.isInteger(req.body?.duration_ticks) ? (req.body.duration_ticks as number) : null;

            // Apply the material effect (freeze / fine) before recording the sanction.
            if (sanctionType === 'freeze') {
                if (services.civicDidStore) await services.civicDidStore.markFrozen(grid, accused, tick());
            } else if (sanctionType === 'fine') {
                try { amountWei = BigInt(String(req.body?.amount_wei ?? '0')); } catch { return reply.code(400).send({ error: 'invalid_amount_wei' }); }
                if (amountWei <= 0n) return reply.code(400).send({ error: 'invalid_amount_wei' });
                await new TreasuryWeiStore(pool).creditWei({ gridName: grid, amountWei, currentTick: tick() });
            }
            // 'warning' and 'exile' are recorded only (exile membership removal: follow-up).

            const sanctionId = await store.recordSanction({
                gridName: grid, chargeId, accusedDid: accused, sanctionType,
                durationTicks, communityId, amountWei, tick: tick(),
            });
            return reply.code(201).send({ sanction_id: sanctionId, sanction_type: sanctionType, charge_id: chargeId });
        },
    );

    // POL-04 appeals — the sanctioned party appeals their executed sanction (civic).
    // It routes to the Government; only the accused may appeal their own sanction.
    app.post<{ Body: { sanction_id?: unknown; grounds?: unknown } }>(
        '/api/v1/gov/appeal',
        async (req, reply) => {
            const caller = req.didContext?.did;
            if (!caller || req.didContext?.tier !== 'civic_member' || !CIVIC_DID_RE.test(caller)) {
                return reply.code(401).send({ error: 'civic_did_required' });
            }
            const pool = services.pool; const audit = services.audit;
            if (!pool || !audit) return reply.code(503).send({ error: 'police_unavailable' });
            const sanctionId = typeof req.body?.sanction_id === 'string' ? req.body.sanction_id.trim() : '';
            const grounds = typeof req.body?.grounds === 'string' ? req.body.grounds.trim() : '';
            if (!UUID_RE.test(sanctionId)) return reply.code(400).send({ error: 'invalid_sanction_id' });
            if (!grounds) return reply.code(400).send({ error: 'empty_grounds' });

            const store = new PoliceStore(pool, audit);
            const sanction = await store.getSanction(grid, sanctionId);
            if (!sanction) return reply.code(404).send({ error: 'unknown_sanction' });
            if (sanction.accused_civic_did !== caller) return reply.code(403).send({ error: 'not_your_sanction' });

            const appealId = await store.fileAppeal({ gridName: grid, sanctionId, appellantDid: caller, grounds, tick: tick() });
            return reply.code(201).send({ appeal_id: appealId, status: 'pending' });
        },
    );

    // Government resolves an appeal — uphold or overturn (government_only). On overturn the
    // material effect is reversed (a freeze is lifted). This is the appeal half of the
    // separation of powers: the same body that convicts also hears the appeal.
    app.post<{ Params: { appealId: string }; Body: { overturn?: unknown } }>(
        '/api/v1/gov/appeal/:appealId/resolve',
        async (req, reply) => {
            if (req.didContext?.tier !== 'government') return reply.code(403).send({ error: 'government_required' });
            const pool = services.pool; const audit = services.audit;
            if (!pool || !audit) return reply.code(503).send({ error: 'police_unavailable' });
            const appealId = req.params.appealId;
            if (!UUID_RE.test(appealId)) return reply.code(400).send({ error: 'invalid_appeal_id' });
            if (typeof req.body?.overturn !== 'boolean') return reply.code(400).send({ error: 'overturn_must_be_boolean' });

            const store = new PoliceStore(pool, audit);
            const appeal = await store.getAppeal(grid, appealId);
            if (!appeal) return reply.code(404).send({ error: 'unknown_appeal' });
            if (appeal.status !== 'pending') return reply.code(409).send({ error: 'appeal_not_pending', status: appeal.status });

            await store.resolveAppeal(grid, appealId, req.body.overturn, tick());
            // Reverse the material effect on a successful appeal (freeze is lifted).
            if (req.body.overturn) {
                const sanction = await store.getSanction(grid, appeal.sanction_id);
                if (sanction?.sanction_type === 'freeze' && services.civicDidStore) {
                    await services.civicDidStore.markUnfrozen(grid, sanction.accused_civic_did);
                }
            }
            return reply.send({ appeal_id: appealId, status: req.body.overturn ? 'overturned' : 'upheld' });
        },
    );
}
