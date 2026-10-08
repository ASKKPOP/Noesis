/**
 * Phase 56 (PORTAL-07/08) — the Portal user's account overview.
 *
 *   GET /api/v1/portal/me/overview
 *     → { human_did, nous[], grids[], wallet{ total_wei, by_grid[] }, registrations[] }
 *
 * One read that backs the Portal dashboard: the Nous the signed-in human owns
 * (NousSponsorStore), each one's Civic-DID status + presence + wei balance, the
 * Grids those Nous live in, and Nous registrations still in the pipeline.
 * Auth is the Portal session cookie; a human only ever sees their own account.
 *
 * Money is wei (D-MONEY-01) and travels as a decimal string. v3.0 runs one Grid
 * (D-V3-30), so `grids` / `by_grid` hold at most this Grid; the shape is the
 * multi-Grid one so v3.1 only adds rows. Read-only — no audit events.
 */
import { jwtVerify } from 'jose';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import type { GridServices } from '../server.js';
import { COOKIE_NAME, keyPairPromise } from '../portal/auth.js';
import { NousSponsorStore } from '../../economy/nous-sponsor-store.js';
import { NousAccountStore } from '../../economy/nous-account-store.js';
import { CivicDidStore } from '../../civic-registry/civic-did-store.js';

/** Resolve the human DID from the Portal session cookie, or send 401 and return null. */
async function humanFromSession(req: FastifyRequest, reply: FastifyReply): Promise<string | null> {
    const token = (req.cookies as Record<string, string | undefined>)[COOKIE_NAME];
    if (!token) { await reply.code(401).send({ error: 'not_authenticated' }); return null; }
    try {
        const { publicKey } = await keyPairPromise;
        const { payload } = await jwtVerify(token, publicKey);
        const did = payload['did'];
        if (typeof did !== 'string' || !did.startsWith('did:noesis:')) { await reply.code(401).send({ error: 'invalid_token' }); return null; }
        return did;
    } catch { await reply.code(401).send({ error: 'invalid_token' }); return null; }
}

export function registerPortalOverviewRoute(app: FastifyInstance, services: GridServices): void {
    const grid = services.gridName ?? 'genesis';

    app.get('/api/v1/portal/me/overview', async (req, reply) => {
        const humanDid = await humanFromSession(req, reply);
        if (!humanDid) return;
        const pool = services.pool;
        if (!pool) return reply.code(503).send({ error: 'db_unavailable' });

        const owned = await new NousSponsorStore(pool).sponsorsOf(grid, humanDid);
        const civicStore = services.civicDidStore ?? new CivicDidStore(pool);
        const accounts = new NousAccountStore(pool);

        let total = 0n;
        const nous = await Promise.all(owned.map(async (nousDid) => {
            const civic = await civicStore.getByExistenceDid(grid, nousDid);
            const balance = civic ? await accounts.getBalance(grid, civic.civicDid) : 0n;
            total += balance;
            return {
                nous_did: nousDid,
                grid_id: grid,
                civic_status: civic ? civic.status : 'none',
                presence: civic?.presenceStatus ?? null,
                last_seen_tick: civic?.lastSeenTick ?? null,
                balance_wei: balance.toString(),
            };
        }));

        // Registrations the caller filed, or that concern a Nous they own.
        const marks = owned.map(() => '?').join(',');
        const [regs] = await pool.query<RowDataPacket[]>(
            `SELECT request_id, nous_type, nous_did, target_grid, status, reason_code, filed_tick
               FROM nous_registrations
              WHERE registrant_did = ?${owned.length ? ` OR nous_did IN (${marks})` : ''}
              ORDER BY filed_tick DESC LIMIT 100`,
            [humanDid, ...owned],
        );

        return reply.send({
            human_did: humanDid,
            nous,
            grids: nous.length ? [{ grid_id: grid, nous_count: nous.length }] : [],
            wallet: {
                total_wei: total.toString(),
                by_grid: nous.length ? [{ grid_id: grid, balance_wei: total.toString() }] : [],
            },
            registrations: regs.map((r) => ({
                request_id: r['request_id'], nous_did: r['nous_did'], nous_type: r['nous_type'],
                target_grid: r['target_grid'], status: r['status'], reason_code: r['reason_code'] ?? null,
                filed_tick: Number(r['filed_tick']),
            })),
        });
    });
}
