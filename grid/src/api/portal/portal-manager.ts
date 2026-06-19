/**
 * Portal Manager v1 — Tier-3 (Henry-side meta-ops) READ-ONLY reviewer queue.
 *
 * GET /api/v1/portal-manager/registrations[?status=pending|approved|rejected]
 *
 * Lists civic registration applications from human_civic_applications for
 * services.gridName, newest first, with per-status counts and a derived
 * registration/Civic-DID activity summary. This is the MONITORING slice of the
 * Tier-3 Portal Manager surface (docs/spec/portal-manager.html).
 *
 * INVARIANTS (HARNESS / CLAUDE.md):
 *   - D-V3-36 MANAGEMENT != GOVERNANCE: observe-only. No approve/reject action.
 *   - VOTE-05: grants the operator NO governance power (read-only).
 *   - Audit/allowlist FROZEN: this handler performs only SELECTs and emits
 *     ZERO audit-chain entries. No portal.* event is added.
 *   - Privacy: human_did is SHA-256 hashed in the response (human_did_hash);
 *     the statement plaintext is never selected or returned.
 *
 * AUTH (production-hardened — TWO required server-trusted layers):
 *   1. Attack-surface gate GRID_PORTAL_MANAGER_ENABLED (dedicated flag, decoupled
 *      from GRID_ADMIN_ENABLED): when not 'true' the route returns 503
 *      portal_manager_disabled and the real handler is never registered (pattern
 *      mirrors admin/config.ts). This read-only console can run in prod without
 *      also enabling the admin .env read/write routes.
 *   2. Server-trusted identity: ROUTE_DID_POLICY marks this 'portal_session_required',
 *      so the central onRequest hook runs requirePortalSession (401
 *      portal_session_required for anonymous callers) BEFORE the handler. Inside the
 *      handler operatorScope() then yields req.didContext.operatorDid or 403
 *      operator_scope_required. A spoofed header alone can NEVER satisfy this — the
 *      operatorDid comes from the validated Portal session, not from request headers.
 *   The legacy x-operator-tier (>=5) / x-operator-id checks survive ONLY as a
 *   secondary intent signal AFTER operatorScope passes — never the sole boundary.
 *
 *   Error ladder (after the admin gate + portal session pass):
 *     403 operator_scope_required — no server-trusted operatorDid
 *     401 tier_missing     — x-operator-tier absent / non-numeric (secondary)
 *     403 tier_too_low     — x-operator-tier < 5 (secondary)
 *     400 invalid_operator_id — x-operator-id fails OPERATOR_ID_REGEX (secondary)
 *     400 invalid_status   — ?status= not one of pending|approved|rejected
 *     503 db_unavailable   — services.humanPool absent
 */

import type { FastifyInstance } from 'fastify';
import { createHash } from 'node:crypto';
import type { GridServices } from '../server.js';
import type { ApiError } from '../types.js';
import { OPERATOR_ID_REGEX } from '../types.js';
import { operatorScope } from '../preHandlers/operatorScope.js';

const VALID_STATUS = ['pending', 'approved', 'rejected'] as const;
type ApplicationStatus = (typeof VALID_STATUS)[number];

/** Row shape selected from human_civic_applications (statement deliberately omitted). */
interface QueueRow {
    application_id: string;
    grid_name: string;
    human_did: string;
    status: ApplicationStatus;
    reason_code: string | null;
    civic_did: string | null;
    requested_at_tick: number;
    decided_at_tick: number | null;
}

interface CountRow {
    status: ApplicationStatus;
    n: number;
    /** Count of rows in this status group that carry a non-null civic_did. */
    issued: number;
}

export function registerPortalManagerRoutes(
    app: FastifyInstance,
    services: GridServices,
): void {
    // Layer 2 — attack-surface gate (pattern mirrors admin/config.ts). Tier-3
    // meta-ops has its OWN dedicated flag, decoupled from GRID_ADMIN_ENABLED: this
    // read-only console can run in prod WITHOUT also enabling the admin .env
    // read/write routes (which stay on GRID_ADMIN_ENABLED). When disabled the route
    // 503s and the real handler is never wired.
    const portalManagerEnabled = process.env.GRID_PORTAL_MANAGER_ENABLED === 'true';
    if (!portalManagerEnabled) {
        app.get('/api/v1/portal-manager/registrations', async (_req, reply) => {
            reply.code(503);
            return { error: 'portal_manager_disabled' };
        });
        return;
    }

    app.get<{ Querystring: { status?: string } }>(
        '/api/v1/portal-manager/registrations',
        async (req, reply) => {
            // 0. Server-trusted identity — operatorDid comes from the validated Portal
            //    session (requirePortalSession ran in the central hook), NOT from headers.
            //    A spoofed x-operator-* header alone can never satisfy this (403 otherwise).
            const operatorDid = await operatorScope(req, reply);
            if (!operatorDid) return;

            // 1. Tier signal — SECONDARY intent only (defense-in-depth, never the sole gate).
            const tierHeader = req.headers['x-operator-tier'];
            if (typeof tierHeader !== 'string') {
                reply.code(401);
                return { error: 'tier_missing' } satisfies ApiError;
            }
            const tierNum = parseInt(tierHeader, 10);
            if (!Number.isFinite(tierNum)) {
                reply.code(401);
                return { error: 'tier_missing' } satisfies ApiError;
            }
            if (tierNum < 5) {
                reply.code(403);
                return { error: 'tier_too_low' } satisfies ApiError;
            }

            // 1b. Operator-id signal — SECONDARY (header is not the boundary now).
            const opIdHeader = req.headers['x-operator-id'];
            if (typeof opIdHeader !== 'string' || !OPERATOR_ID_REGEX.test(opIdHeader)) {
                reply.code(400);
                return { error: 'invalid_operator_id' } satisfies ApiError;
            }

            // 2. Status filter — reject anything outside the ENUM (no interpolation).
            const statusRaw = req.query.status;
            let statusFilter: ApplicationStatus | undefined;
            if (statusRaw !== undefined) {
                if (!VALID_STATUS.includes(statusRaw as ApplicationStatus)) {
                    reply.code(400);
                    return { error: 'invalid_status' } satisfies ApiError;
                }
                statusFilter = statusRaw as ApplicationStatus;
            }

            // 3. DB gate.
            const pool = services.humanPool;
            if (!pool) {
                reply.code(503);
                return { error: 'db_unavailable' } satisfies ApiError;
            }

            // 4. List SELECT — newest first. `status` is a reserved-word-adjacent
            //    identifier so it is backticked; the filter binds as a parameter.
            //    Uses the (grid_name, status) leading columns of idx_civic_app_status.
            const listParams: unknown[] = [services.gridName];
            let listSql =
                'SELECT application_id, grid_name, human_did, `status`, reason_code, ' +
                'civic_did, requested_at_tick, decided_at_tick ' +
                'FROM human_civic_applications ' +
                'WHERE grid_name = ?';
            if (statusFilter) {
                listSql += ' AND `status` = ?';  // idx_civic_app_status (grid_name, status)
                listParams.push(statusFilter);
            }
            listSql += ' ORDER BY requested_at_tick DESC, application_id DESC';
            const [rows] = await pool.query(listSql, listParams) as [QueueRow[], unknown];

            // 5. Counts SELECT — always grid-wide (unaffected by the status filter).
            //    The same grouped query also yields the issued-Civic-DID tally
            //    (rows whose civic_did is non-null), so no extra round-trip is needed.
            const [countRows] = await pool.query(
                'SELECT `status`, COUNT(*) AS n, ' +
                'COUNT(civic_did) AS issued ' +
                'FROM human_civic_applications WHERE grid_name = ? GROUP BY `status`',
                [services.gridName],
            ) as [CountRow[], unknown];

            const counts = { pending: 0, approved: 0, rejected: 0, total: 0 };
            let civicDidsIssued = 0;
            for (const c of countRows) {
                const n = Number(c.n) || 0;
                if (c.status in counts) counts[c.status] = n;
                counts.total += n;
                civicDidsIssued += Number(c.issued) || 0;
            }

            // 7. Privacy-preserving projection — hash the DID, drop the statement.
            const applications = rows.map((r) => ({
                application_id: r.application_id,
                grid_name: r.grid_name,
                status: r.status,
                civic_did: r.civic_did,
                reason_code: r.reason_code,
                requested_at_tick: r.requested_at_tick,
                decided_at_tick: r.decided_at_tick,
                human_did_hash: createHash('sha256').update(r.human_did).digest('hex'),
            }));

            return reply.send({
                grid_name: services.gridName,
                applications,
                counts,
                activity: {
                    registrations_total: counts.total,
                    civic_dids_issued: civicDidsIssued,
                },
            });
        },
    );
}
