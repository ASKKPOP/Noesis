/**
 * W — procurement member routes: members see open RFPs + place bids.
 *   GET  /api/v1/procurement/notices?status=open  — list notices (public-readable)
 *   GET  /api/v1/procurement/notices/:noticeId    — one notice + its bids
 *   POST /api/v1/procurement/notices/:noticeId/bids — place a bid (civic_member)
 *
 * Issuance is NOT exposed over HTTP at all: a notice comes only from a passed bill
 * (VOTE-05 / D-V3-21). Award and settlement are Polis-only acts (government_only in
 * ROUTE_DID_POLICY, plus a legislation reference like every treasury act): no member,
 * visitor or operator can reach them.
 *   POST /api/v1/procurement/notices/:noticeId/award        — the Polis awards a bid
 *   POST /api/v1/procurement/contracts/:contractId/settle   — the Polis accepts the work
 * A bid of 0 wei is work offered unpaid; when it is accepted it earns civic-labor credit
 * instead of money (D-MONEY-10 — the civic duty met by building).
 */
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { ProcurementStore } from '../../economy/procurement-store.js';
import { verifyDisbursementAuth } from '../../civic-registry/government-session.js';
import { CIVIC_DID_RE } from '../../util/id-patterns.js';

export function registerProcurementRoutes(app: FastifyInstance, services: GridServices): void {
    // GET /api/v1/procurement/notices?status=open
    // Public-readable: anyone (including visitors) can browse open RFPs.
    app.get<{ Querystring: { status?: string } }>(
        '/api/v1/procurement/notices',
        async (req, reply) => {
            const pool = services.pool;
            if (!pool) return reply.code(503).send({ error: 'db_unavailable' });
            const status = req.query.status ?? 'open';
            const gridName = services.gridName ?? 'genesis';
            const store = new ProcurementStore(pool, services.audit);
            const notices = await store.listNotices(gridName, status);
            return reply.send({ notices, count: notices.length });
        },
    );

    // GET /api/v1/procurement/notices/:noticeId
    // Returns the notice plus its bids. Public-readable.
    app.get<{ Params: { noticeId: string } }>(
        '/api/v1/procurement/notices/:noticeId',
        async (req, reply) => {
            const pool = services.pool;
            if (!pool) return reply.code(503).send({ error: 'db_unavailable' });
            const gridName = services.gridName ?? 'genesis';
            const store = new ProcurementStore(pool, services.audit);
            const notice = await store.getNotice(gridName, req.params.noticeId);
            if (!notice) return reply.code(404).send({ error: 'notice_not_found' });
            const bids = await store.listBids(gridName, req.params.noticeId);
            return reply.send({ notice, bids });
        },
    );

    // POST /api/v1/procurement/notices/:noticeId/bids
    // Place a bid on an open notice. Requires civic_member tier.
    app.post<{
        Params: { noticeId: string };
        Body: { price_wei?: unknown; artifact_spec?: unknown };
    }>(
        '/api/v1/procurement/notices/:noticeId/bids',
        async (req, reply) => {
            const pool = services.pool;
            if (!pool) return reply.code(503).send({ error: 'db_unavailable' });

            const civicDid = req.didContext?.did;
            if (!civicDid || !CIVIC_DID_RE.test(civicDid) || req.didContext?.tier !== 'civic_member') {
                return reply.code(401).send({ error: 'unauthorized' });
            }

            const { price_wei, artifact_spec } = req.body ?? {};

            // Validate price_wei: must be a non-empty digit string
            if (
                typeof price_wei !== 'string' ||
                !/^\d+$/.test(price_wei) ||
                price_wei.length === 0
            ) {
                return reply.code(400).send({ error: 'invalid_price_wei' });
            }

            // Validate artifact_spec: must be a non-empty string
            if (typeof artifact_spec !== 'string' || artifact_spec.trim().length === 0) {
                return reply.code(400).send({ error: 'invalid_artifact_spec' });
            }

            const gridName = services.gridName ?? 'genesis';
            const bidId = randomUUID();
            const tick = services.currentTick ? services.currentTick() : 0;

            let priceWeiBigint: bigint;
            try {
                priceWeiBigint = BigInt(price_wei);
            } catch {
                return reply.code(400).send({ error: 'invalid_price_wei' });
            }

            const store = new ProcurementStore(pool, services.audit);
            try {
                await store.placeBid({
                    gridName,
                    bidId,
                    noticeId: req.params.noticeId,
                    bidderDid: civicDid,
                    priceWei: priceWeiBigint,
                    artifactSpec: artifact_spec,
                    currentTick: tick,
                });
            } catch (err) {
                const msg = (err as Error).message;
                if (msg === 'notice_not_open') {
                    return reply.code(409).send({ error: msg });
                }
                if (msg === 'invalid_amount') {
                    return reply.code(400).send({ error: msg });
                }
                throw err;
            }

            return reply.code(201).send({ ok: true, bid_id: bidId });
        },
    );

    // POST /api/v1/procurement/notices/:noticeId/award — Polis only.
    app.post<{ Params: { noticeId: string }; Body: { bid_id?: unknown } }>(
        '/api/v1/procurement/notices/:noticeId/award',
        async (req, reply) => {
            const pool = services.pool;
            if (!pool) return reply.code(503).send({ error: 'db_unavailable' });
            // The same authorization as every act that can move treasury money (D-V3-21):
            // a Polis session that names the legislation it acts under.
            const auth = await verifyDisbursementAuth(req.headers.authorization);
            if (!auth.ok) return reply.code(403).send({ error: auth.reason });
            const bidId = req.body?.bid_id;
            if (typeof bidId !== 'string' || bidId.length === 0) return reply.code(400).send({ error: 'invalid_bid_id' });
            const contractId = randomUUID();
            const store = new ProcurementStore(pool, services.audit);
            try {
                await store.award({
                    gridName: services.gridName ?? 'genesis', noticeId: req.params.noticeId, bidId,
                    contractId, escrowId: randomUUID(), currentTick: services.currentTick ? services.currentTick() : 0,
                });
            } catch (err) {
                const msg = (err as Error).message;
                if (msg === 'notice_not_open' || msg === 'bid_not_eligible' || msg === 'bid_exceeds_budget') {
                    return reply.code(409).send({ error: msg });
                }
                if (msg === 'insufficient_treasury_wei') return reply.code(402).send({ error: msg });
                throw err;
            }
            return reply.code(201).send({ ok: true, contract_id: contractId });
        },
    );

    // POST /api/v1/procurement/contracts/:contractId/settle — Polis only: the work is accepted.
    app.post<{ Params: { contractId: string }; Body: { attestation_ref?: unknown } }>(
        '/api/v1/procurement/contracts/:contractId/settle',
        async (req, reply) => {
            const pool = services.pool;
            if (!pool) return reply.code(503).send({ error: 'db_unavailable' });
            // The same authorization as every act that can move treasury money (D-V3-21):
            // a Polis session that names the legislation it acts under.
            const auth = await verifyDisbursementAuth(req.headers.authorization);
            if (!auth.ok) return reply.code(403).send({ error: auth.reason });
            const attestationRef = req.body?.attestation_ref;
            if (typeof attestationRef !== 'string' || attestationRef.trim().length === 0) {
                return reply.code(400).send({ error: 'invalid_attestation_ref' });
            }
            const store = new ProcurementStore(pool, services.audit);
            try {
                await store.settleContract({
                    gridName: services.gridName ?? 'genesis', contractId: req.params.contractId,
                    attestationRef, currentTick: services.currentTick ? services.currentTick() : 0,
                });
            } catch (err) {
                if ((err as Error).message === 'contract_not_active') return reply.code(409).send({ error: 'contract_not_active' });
                throw err;
            }
            return reply.send({ ok: true, settled: true });
        },
    );
}
