/**
 * W — procurement member routes: members see open RFPs + place bids.
 *   GET  /api/v1/procurement/notices?status=open  — list notices (public-readable)
 *   GET  /api/v1/procurement/notices/:noticeId    — one notice + its bids
 *   POST /api/v1/procurement/notices/:noticeId/bids — place a bid (civic_member)
 *
 * Issuance and award are NOT exposed here — those are Polis-only (VOTE-05 / D-V3-21).
 * Members read + bid; no wei moves in this slice.
 */
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { ProcurementStore } from '../../economy/procurement-store.js';

const CIVIC_DID_RE = /^did:civic:noesis:[a-z0-9_:\-]+$/i;

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
}
