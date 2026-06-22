/**
 * W4 (D-MONEY-09) — model-first endowment route: the live wei source.
 *
 *   POST /api/v1/portal/account/endow  — operator endows a member account with wei.
 *
 * This is the SINGLE inflow that lets the loop's money move (account → dues →
 * treasury → RFP award → escrow → worker). It is the documented, bounded, temporary
 * bend of D-MONEY-01 "no internal mint" — kept honest by EndowmentStore (ledger +
 * caps + audit) and by hardened operator auth here.
 *
 * AUTH (mirrors portal-manager.ts — two server-trusted layers):
 *   1. Attack-surface gate GRID_ENDOWMENT_ENABLED (off by default): when not 'true'
 *      the route 503s endowment_disabled and the real handler is never registered.
 *   2. Server-trusted identity: ROUTE_DID_POLICY marks this 'portal_session_required',
 *      so the central hook runs requirePortalSession (401 for anonymous) BEFORE the
 *      handler; operatorScope() then yields the session operatorDid or 403. A spoofed
 *      header alone can never satisfy this. The x-operator-tier >= 5 check survives
 *      ONLY as a secondary intent signal AFTER operatorScope.
 */
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { EndowmentStore } from '../../economy/endowment-store.js';
import { operatorScope } from '../preHandlers/operatorScope.js';

const CIVIC_DID_RE = /^did:civic:noesis:[a-z0-9_:\-]+$/i;
const DECIMAL_RE = /^[0-9]+$/;

interface EndowBody {
    civic_did?: unknown;
    amount_wei?: unknown;
    reason?: unknown;
}

export function registerAccountEndowmentRoute(app: FastifyInstance, services: GridServices): void {
    // Layer 1 — attack-surface gate. When disabled, wire a 503 stub and never
    // register the real handler (pattern mirrors portal-manager.ts / admin/config.ts).
    if (process.env.GRID_ENDOWMENT_ENABLED !== 'true') {
        app.post('/api/v1/portal/account/endow', async (_req, reply) => {
            reply.code(503);
            return { error: 'endowment_disabled' };
        });
        return;
    }

    app.post<{ Body: EndowBody }>('/api/v1/portal/account/endow', async (req, reply) => {
        // Layer 2 — server-trusted identity (requirePortalSession already ran in the hook).
        const operatorDid = await operatorScope(req, reply);
        if (!operatorDid) return;

        // Secondary tier signal — defense-in-depth, never the sole gate.
        const tierHeader = req.headers['x-operator-tier'];
        const tierNum = typeof tierHeader === 'string' ? parseInt(tierHeader, 10) : NaN;
        if (!Number.isFinite(tierNum)) return reply.code(401).send({ error: 'tier_missing' });
        if (tierNum < 5) return reply.code(403).send({ error: 'tier_too_low' });

        const pool = services.pool;
        if (!pool) return reply.code(503).send({ error: 'db_unavailable' });

        // Body validation.
        const body = req.body ?? {};
        const civicDid = body.civic_did;
        if (typeof civicDid !== 'string' || !CIVIC_DID_RE.test(civicDid)) {
            return reply.code(400).send({ error: 'invalid_civic_did' });
        }
        const amountRaw = body.amount_wei;
        if (typeof amountRaw !== 'string' || !DECIMAL_RE.test(amountRaw) || amountRaw === '' || BigInt(amountRaw) <= 0n) {
            return reply.code(400).send({ error: 'invalid_amount' });
        }
        const reason = typeof body.reason === 'string' ? body.reason.slice(0, 255) : undefined;
        const tick = services.currentTick ? services.currentTick() : 0;

        try {
            const store = new EndowmentStore(pool, services.audit);
            const { endowmentId, newBalance } = await store.endow({
                gridName: services.gridName,
                civicDid,
                amountWei: BigInt(amountRaw),
                reason,
                operatorDid,
                currentTick: tick,
            });
            return reply.send({
                endowment_id: endowmentId,
                civic_did: civicDid,
                new_balance_wei: newBalance.toString(),
                source: 'model_first',
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'endow_failed';
            if (msg === 'invalid_amount') return reply.code(400).send({ error: 'invalid_amount' });
            if (msg === 'endowment_exceeds_cap' || msg === 'endowment_account_cap_exceeded') {
                return reply.code(422).send({ error: msg });
            }
            throw err;
        }
    });
}
