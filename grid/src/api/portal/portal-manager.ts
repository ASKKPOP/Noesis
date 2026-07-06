/**
 * Portal Manager v1 — Tier-3 (Henry-side meta-ops) READ-ONLY monitoring surfaces.
 *
 * GET /api/v1/portal-manager/registrations[?status=pending|approved|rejected]
 * GET /api/v1/portal-manager/did-issuance
 * GET /api/v1/portal-manager/audit-chain
 *
 * (1) registrations — lists civic registration applications from
 *     human_civic_applications for services.gridName, newest first, with
 *     per-status counts and a derived registration/Civic-DID activity summary.
 * (2) did-issuance — recently issued (PUBLIC) Civic-DIDs from civic_did_registry
 *     + grid-wide counts (+ an aggregate nous_active count from nous_registry).
 *     existence_did / credential_json / nous did+human_owner are NEVER selected.
 * (3) audit-chain — recent registration/portal/registry audit events projected to
 *     { event_type, tick } ONLY (no payload / actor / target / hash) + chain
 *     integrity copied verbatim from the canonical watchdog snapshot (the SAME
 *     divergence-based signal /health/detailed + system-map.ts use; verify() is
 *     NEVER called). All three slices are the MONITORING surface of the Tier-3
 *     Portal Manager (docs/spec/portal-manager.html).
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

/** civic_did_registry list row — ONLY the three PII-free columns are selected. */
interface CivicDidRow {
    civic_did: string;
    status: 'active' | 'revoked';
    issued_at_tick: number;
}

/** Grouped civic_did_registry count row. */
interface CivicCountRow {
    status: 'active' | 'revoked';
    n: number;
}

/**
 * Runs the IDENTICAL auth ladder as the registrations handler:
 *   0. operatorScope — server-trusted operatorDid (403 operator_scope_required)
 *   1. x-operator-tier >= 5 secondary signal (401 tier_missing / 403 tier_too_low)
 *   1b. x-operator-id OPERATOR_ID_REGEX secondary signal (400 invalid_operator_id)
 * Returns true when every gate passed (the caller may proceed), false when a
 * response has already been sent.
 */
async function passOperatorLadder(
    req: import('fastify').FastifyRequest,
    reply: import('fastify').FastifyReply,
): Promise<boolean> {
    const operatorDid = await operatorScope(req, reply);
    if (!operatorDid) return false;

    const tierHeader = req.headers['x-operator-tier'];
    if (typeof tierHeader !== 'string') {
        reply.code(401);
        void reply.send({ error: 'tier_missing' } satisfies ApiError);
        return false;
    }
    const tierNum = parseInt(tierHeader, 10);
    if (!Number.isFinite(tierNum)) {
        reply.code(401);
        void reply.send({ error: 'tier_missing' } satisfies ApiError);
        return false;
    }
    if (tierNum < 5) {
        reply.code(403);
        void reply.send({ error: 'tier_too_low' } satisfies ApiError);
        return false;
    }

    const opIdHeader = req.headers['x-operator-id'];
    if (typeof opIdHeader !== 'string' || !OPERATOR_ID_REGEX.test(opIdHeader)) {
        reply.code(400);
        void reply.send({ error: 'invalid_operator_id' } satisfies ApiError);
        return false;
    }
    return true;
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
        app.get('/api/v1/portal-manager/did-issuance', async (_req, reply) => {
            reply.code(503);
            return { error: 'portal_manager_disabled' };
        });
        app.get('/api/v1/portal-manager/audit-chain', async (_req, reply) => {
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

    // ── DID-issuance tracker ────────────────────────────────────────────────
    // Recently issued PUBLIC Civic-DIDs + grid-wide counts. Reads services.pool
    // (civic_did_registry + nous_registry). SELECT-only, emits zero audit events.
    // existence_did / credential_json / nous did+human_owner are NEVER selected —
    // the only identity-bearing value returned is the intentionally-public civic_did.
    app.get('/api/v1/portal-manager/did-issuance', async (req, reply) => {
        // 0/1/1b — identical operator auth ladder as the registrations handler.
        if (!(await passOperatorLadder(req, reply))) return;

        // DB gate — this slice reads the MAIN grid pool (NOT humanPool).
        const pool = services.pool;
        if (!pool) {
            reply.code(503);
            return { error: 'db_unavailable' } satisfies ApiError;
        }

        // List SELECT — newest-first, hard cap 50. `status` is reserved-adjacent so
        // it is backticked; grid_name binds as a parameter. ONLY the three PII-free
        // columns are selected (existence_did / credential_json deliberately omitted).
        const [listRows] = await pool.query(
            'SELECT civic_did, `status`, issued_at_tick ' +
            'FROM civic_did_registry WHERE grid_name = ? ' +
            'ORDER BY issued_at_tick DESC, civic_did DESC LIMIT 50',
            [services.gridName],
        ) as [CivicDidRow[], unknown];

        // Grouped counts SELECT — grid-wide (folded into {active,revoked,total}).
        const [countRows] = await pool.query(
            'SELECT `status`, COUNT(*) AS n FROM civic_did_registry ' +
            'WHERE grid_name = ? GROUP BY `status`',
            [services.gridName],
        ) as [CivicCountRow[], unknown];

        // Aggregate nous_active count — 'active' binds as a parameter (no interpolation).
        const [nousRows] = await pool.query(
            "SELECT COUNT(*) AS n FROM nous_registry WHERE grid_name = ? AND `status` = ?",
            [services.gridName, 'active'],
        ) as [{ n: number }[], unknown];

        const counts = { active: 0, revoked: 0, total: 0, nous_active: 0 };
        for (const c of countRows) {
            const n = Number(c.n) || 0;
            if (c.status === 'active') counts.active = n;
            else if (c.status === 'revoked') counts.revoked = n;
            counts.total += n;
        }
        counts.nous_active = Number(nousRows[0]?.n) || 0;

        // kind is a JS-side literal 'civic' (there is no discriminator column;
        // v3.0 civic_did_registry holds human Civic-DIDs).
        const issued = listRows.map((r) => ({
            civic_did: r.civic_did,
            status: r.status,
            issued_at_tick: r.issued_at_tick,
            kind: 'civic' as const,
        }));

        return reply.send({ grid_name: services.gridName, issued, counts });
    });

    // ── Audit-chain viewer ──────────────────────────────────────────────────
    // Recent registration/portal/registry audit events projected to { event_type,
    // tick } ONLY (no payload / actor / target / hash) + chain integrity copied
    // verbatim from the canonical watchdog snapshot (divergence-based; the SAME
    // signal /health/detailed + system-map.ts use). verify() is NEVER called.
    app.get('/api/v1/portal-manager/audit-chain', async (req, reply) => {
        // 0/1/1b — identical operator auth ladder as the registrations handler.
        if (!(await passOperatorLadder(req, reply))) return;

        // Integrity — copy the four counters verbatim from the watchdog snapshot.
        // Absent launcher/watchdog → nulls + healthy:false (optional-chaining
        // tolerance, mirroring system-map.ts). No throw.
        const snapAudit = services.launcher?.healthWatchdog?.snapshot().audit;
        const integrity = snapAudit
            ? {
                  in_memory_length: snapAudit.in_memory_length,
                  persisted_max_id: snapAudit.persisted_max_id,
                  divergence: snapAudit.divergence,
                  divergence_threshold: snapAudit.divergence_threshold,
                  // Exact rule system-map.ts:99 uses.
                  healthy:
                      snapAudit.divergence === null ||
                      snapAudit.divergence <= snapAudit.divergence_threshold,
              }
            : {
                  in_memory_length: null,
                  persisted_max_id: null,
                  divergence: null,
                  divergence_threshold: 0,
                  healthy: false,
              };

        // Sliding-window slice (mirror visitor-audit-trail.ts:88-90). N=30.
        const N = 30;
        const total = services.audit.length;
        const offset = Math.max(0, total - N);
        const raw = services.audit.query({ limit: N, offset });

        // Filter to civic-relevant families, then project to { event_type, tick }
        // ONLY — payload / actorDid / targetDid / eventHash / prevHash are dropped
        // before the entry ever reaches the response. Cap at 30 after filtering.
        const ALLOWED_PREFIXES = ['portal', 'registry'];
        const recent = raw
            .filter((e) => {
                if (e.eventType.startsWith('polis.registration_')) return true;
                return ALLOWED_PREFIXES.includes(e.eventType.split('.')[0] ?? '');
            })
            .map((e) => ({ event_type: e.eventType, tick: e.id ?? 0 }))
            .slice(-N);

        return reply.send({ integrity, recent });
    });
}
