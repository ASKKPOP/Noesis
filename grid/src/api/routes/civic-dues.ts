/**
 * W1 — civic-due routes: a member sees + pays its dues (D-MONEY-08).
 *   GET  /api/v1/civic/dues                 — the caller's dues
 *   POST /api/v1/civic/dues/:dueId/pay      — pay in wei | labor
 * Auth: civic_member (req.didContext). A member pays only its OWN due.
 */
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import type { RowDataPacket } from 'mysql2/promise';
import { CivicDueStore } from '../../economy/civic-due-store.js';

const CIVIC_DID_RE = /^did:civic:noesis:[a-z0-9_:\-]+$/i;

export function registerCivicDueRoutes(app: FastifyInstance, services: GridServices): void {
    app.get('/api/v1/civic/dues', async (req, reply) => {
        const pool = services.pool;
        if (!pool) return reply.code(503).send({ error: 'db_unavailable' });
        const civicDid = req.didContext?.did;
        if (!civicDid || !CIVIC_DID_RE.test(civicDid) || req.didContext?.tier !== 'civic_member') {
            return reply.code(401).send({ error: 'unauthorized' });
        }
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT due_id, period, amount_wei, amount_credit, status, paid_in, due_tick
             FROM civic_dues WHERE grid_name = ? AND civic_did = ? ORDER BY due_tick DESC LIMIT 200`,
            [services.gridName ?? 'genesis', civicDid],
        );
        return reply.send({ dues: rows, count: rows.length });
    });

    app.post<{ Params: { dueId: string }; Body: { method?: string } }>(
        '/api/v1/civic/dues/:dueId/pay',
        async (req, reply) => {
            const pool = services.pool;
            if (!pool) return reply.code(503).send({ error: 'db_unavailable' });
            const civicDid = req.didContext?.did;
            if (!civicDid || !CIVIC_DID_RE.test(civicDid) || req.didContext?.tier !== 'civic_member') {
                return reply.code(401).send({ error: 'unauthorized' });
            }
            const method = req.body?.method;
            if (method !== 'wei' && method !== 'labor') {
                return reply.code(400).send({ error: 'invalid_method' });
            }

            const gridName = services.gridName ?? 'genesis';

            // The caller may pay only its OWN due — fetch to verify ownership.
            const [rows] = await pool.query<RowDataPacket[]>(
                `SELECT civic_did, status FROM civic_dues WHERE grid_name = ? AND due_id = ?`,
                [gridName, req.params.dueId],
            );
            const due = rows[0];
            if (!due) return reply.code(404).send({ error: 'due_not_found' });
            if (String(due.civic_did) !== civicDid) return reply.code(403).send({ error: 'not_your_due' });

            const store = new CivicDueStore(pool, services.audit);
            const tick = services.currentTick ? services.currentTick() : 0;
            try {
                if (method === 'wei') {
                    await store.payWithWei({ gridName, dueId: req.params.dueId, currentTick: tick });
                } else {
                    await store.payWithCredit({ gridName, dueId: req.params.dueId, currentTick: tick });
                }
            } catch (err) {
                const msg = (err as Error).message;
                if (msg === 'insufficient_balance' || msg === 'insufficient_credit') {
                    return reply.code(402).send({ error: msg });
                }
                if (msg === 'due_not_payable') {
                    return reply.code(409).send({ error: msg });
                }
                throw err;
            }
            return reply.send({ ok: true, paid_in: method });
        },
    );
}
