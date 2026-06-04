/**
 * Phase 45 (IRS-02..04) — IRS Treasury routes.
 *
 * Routes:
 *   GET  /api/v1/irs/treasury          public  (Cache-Control: max-age=10)
 *   POST /api/v1/irs/disburse          government_only  (verifyDisbursementAuth)
 *   GET  /api/v1/irs/audit/:period     public  (period = "<fromTick>-<toTick>" or "current")
 *
 * Emit ordering (RESEARCH Anti-Patterns + Pitfall 6):
 *   - irs.disbursement_authorized fires at JWT-verification time, BEFORE the DB transaction.
 *   - irs.disbursement_executed fires AFTER commit succeeds.
 *   - Both call the sole-producer FUNCTION (not audit.append directly) — sole-producer
 *     CI gate (check-sole-producer-discipline.mjs) only counts call sites of audit.append('irs.…', …).
 *
 * DEVIATION FROM PLAN (045-03 STEP A step 5): the plan specified
 *   civic_did: GOV_SESSION_ISSUER_DID for the executed event, but
 *   appendIrsDisbursementExecuted validates civic_did against
 *   CIVIC_DID_RE = /^did:civic:noesis:.../i (Phase 41, Pitfall 3 — must not change).
 *   GOV_SESSION_ISSUER_DID is a did:gov: identifier and FAILS that regex, which would
 *   throw out of the handler (500). The disbursement source is the civic treasury, so
 *   we emit a valid treasury Civic-DID (TREASURY_CIVIC_DID) as the executed event's civic_did.
 *   The Government authorizer is still captured (hashed) on the irs.disbursement_authorized event.
 */
import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import { createHash } from 'node:crypto';
import type { GridServices } from '../server.js';
import { appendIrsDisbursementAuthorized } from '../../audit/append-irs-disbursement-authorized.js';
import { appendIrsDisbursementExecuted } from '../../audit/append-irs-disbursement-executed.js';
import {
    verifyDisbursementAuth,
    GOV_SESSION_ISSUER_DID,
} from '../../civic-registry/government-session.js';
import { IrsStore } from '../../irs/irs-store.js';

function sha256Hex(input: string): string {
    return createHash('sha256').update(input).digest('hex');
}

/**
 * Civic-DID representing the Grid's civic treasury — the source of a Government
 * disbursement. Satisfies CIVIC_DID_RE (did:civic:noesis:*) required by the
 * irs.disbursement_executed sole-producer.
 */
const TREASURY_CIVIC_DID = 'did:civic:noesis:treasury';

export async function registerIrsRoutes(
    app: FastifyInstance,
    services: GridServices,
): Promise<void> {

    // ── GET /api/v1/irs/treasury (public, Cache-Control: max-age=10) ───────────
    app.get('/api/v1/irs/treasury', async (_req, reply) => {
        const pool = services.pool;
        if (!pool) return reply.code(503).send({ error: 'db_unavailable' });

        const [balanceRows] = await pool.query<RowDataPacket[]>(
            `SELECT balance_bios, last_updated_tick FROM civic_treasury WHERE grid_name = ?`,
            [services.gridName],
        );
        const [rateRows] = await pool.query<RowDataPacket[]>(
            `SELECT config_value FROM grid_config WHERE grid_name = ? AND config_key = 'irs_fee_rate'`,
            [services.gridName],
        );
        const rateRaw = rateRows[0]?.config_value ?? '0.02';
        const currentRatePercent = Number.parseFloat(String(rateRaw)) * 100;

        void reply.header('Cache-Control', 'public, max-age=10');
        return reply.code(200).send({
            balance_bios: String(balanceRows[0]?.balance_bios ?? 0),
            last_updated_tick: Number(balanceRows[0]?.last_updated_tick ?? 0),
            current_rate_percent: currentRatePercent,
        });
    });

    // ── POST /api/v1/irs/disburse (government_only) ────────────────────────────
    app.post<{ Body: { amount_bios?: unknown } }>(
        '/api/v1/irs/disburse',
        async (req, reply) => {
            const pool = services.pool;
            const tickFn = services.currentTick;
            const audit = services.audit;
            if (!pool || !tickFn || !audit) {
                return reply.code(503).send({ error: 'service_unavailable' });
            }

            // 1. Government authorization (Plan 02 verifier).
            const authResult = await verifyDisbursementAuth(req.headers.authorization);
            if (!authResult.ok) {
                return reply.code(403).send({ error: authResult.reason });
            }
            const { legislationRef } = authResult;

            // 2. Parse + validate amount.
            const body = req.body ?? {};
            let amountBios: bigint;
            try {
                amountBios = BigInt(body.amount_bios as string | number);
            } catch {
                return reply.code(400).send({ error: 'invalid_amount' });
            }
            if (amountBios <= 0n) return reply.code(400).send({ error: 'invalid_amount' });

            const currentTick = tickFn();

            // 3. Emit AUTHORIZED before DB write (authorization is the signing event).
            appendIrsDisbursementAuthorized(audit, {
                amount_bios: Number(amountBios),
                authorized_by_civic_did_hash: sha256Hex(GOV_SESSION_ISSUER_DID),
                grid_name: services.gridName,
                legislation_ref_hash: sha256Hex(legislationRef),
                tick: currentTick,
            });

            // 4. Atomic DB disbursement.
            const store = new IrsStore(pool);
            let newBalance: bigint;
            try {
                ({ newBalance } = await store.disburse({
                    gridName: services.gridName,
                    amountBios,
                    legislationRef,
                    currentTick,
                }));
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'unknown';
                if (msg === 'insufficient_treasury_balance') {
                    return reply.code(402).send({ error: 'insufficient_treasury_balance' });
                }
                req.log.error({ err: msg }, 'irs_disburse_unhandled');
                return reply.code(500).send({ error: 'internal' });
            }

            // 5. Emit EXECUTED after commit (cause='government_disbursement').
            //    civic_did = TREASURY_CIVIC_DID (the civic source) — see DEVIATION note above.
            appendIrsDisbursementExecuted(audit, {
                amount_bios: Number(amountBios),
                cause: 'government_disbursement',
                civic_did: TREASURY_CIVIC_DID,
                grid_name: services.gridName,
                tick: currentTick,
            });

            return reply.code(200).send({
                disbursed: true,
                new_balance_bios: newBalance.toString(),
            });
        },
    );

    // ── GET /api/v1/irs/audit/:period (public) ─────────────────────────────────
    // period format: "<fromTick>-<toTick>"  OR  "current" (last 1000 ticks)
    app.get<{ Params: { period: string } }>(
        '/api/v1/irs/audit/:period',
        async (req, reply) => {
            const pool = services.pool;
            if (!pool) return reply.code(503).send({ error: 'db_unavailable' });

            const { period } = req.params;
            let fromTick: number;
            let toTick: number;
            if (period === 'current') {
                toTick = services.currentTick ? services.currentTick() : 0;
                fromTick = Math.max(0, toTick - 1000);
            } else {
                // Expect tick-range format <from>-<to> (Open Question 2 resolved: tick range only).
                const m = /^(\d+)-(\d+)$/.exec(period);
                if (!m) return reply.code(400).send({ error: 'invalid_period' });
                fromTick = Number.parseInt(m[1], 10);
                toTick = Number.parseInt(m[2], 10);
                if (!Number.isFinite(fromTick) || !Number.isFinite(toTick) || fromTick > toTick) {
                    return reply.code(400).send({ error: 'invalid_period' });
                }
            }

            const store = new IrsStore(pool);
            const events = await store.getAuditHistory({
                gridName: services.gridName,
                fromTick,
                toTick,
            });
            return reply.code(200).send({ events });
        },
    );
}
