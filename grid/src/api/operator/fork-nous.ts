/**
 * POST /api/v1/operator/fork/:nousDid — H4+ fork endpoint (FORK-01 / D-43-02).
 * GET /api/v1/operator/fork/:nousDid/download?token=X — one-time archive download.
 *
 * Phase 43 constitutional right-to-fork enforcement per D-V3-18. The operator must
 * be able to walk away with their Nous in a portable .tar.gz archive.
 *
 * SECURITY PROPERTIES:
 *   T-43-auth (Elevation of Privilege): H4+ header-trust gate + ownership check.
 *     Cross-operator fork attempt returns 403 cross_operator_forbidden.
 *   T-43-token (Spoofing): one-time token with 5-min TTL; atomic consume;
 *     token bound to nousDid (download route checks entry.nousDid === params.nousDid).
 *   T-43-order (Repudiation): audit event committed BEFORE bytes leave system.
 *     On audit failure → 500 audit_emit_failed, no token issued, no bytes shipped.
 *   T-43-secrets (Information Disclosure): privacy gate in fork-archive-builder rejects
 *     MYSQL_URL/DATABASE_URL/SECRET/KEY/TOKEN/PASSWORD substrings in manifest.
 *   T-43-referer (Information Disclosure): Referrer-Policy: no-referrer header on download.
 *
 * ORDER INVARIANT (mirrors D-30 from Phase 8):
 *   archive build → audit append → token issue → response.
 *   Audit event committed BEFORE bytes leave system — non-repudiable trail.
 *   On any error before audit.append: NO token issued, NO bytes shipped.
 *
 * AUTH MODEL (D-25b-NEW-1):
 *   tier and operator_id read from server-trusted x-operator-tier / x-operator-id headers.
 *   Request body is NOT trusted for auth fields.
 *
 * ERROR LADDER:
 *   400 — invalid_operator_id
 *   401 — tier_missing
 *   403 — tier_too_low / cross_operator_forbidden
 *   409 — brain_memory_in_memory_cannot_fork
 *   500 — archive_build_failed / audit_emit_failed
 *   200 — success, JSON response with download_url + hashes
 *
 * See: FORK-01, D-43-02, D-43-04, T-43-auth, T-43-token, T-43-order, T-43-secrets, T-43-referer.
 */

import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { OPERATOR_ID_REGEX, type ApiError } from '../types.js';
import { appendOperatorNousForked } from '../../audit/append-operator-nous-forked.js';
import { buildForkArchive } from '../../export/fork-archive-builder.js';
import { forkTokenStore } from './fork-token-store.js';

export function registerForkNousRoute(app: FastifyInstance, services: GridServices): void {

    // POST /api/v1/operator/fork/:nousDid
    app.post<{ Params: { nousDid: string } }>('/api/v1/operator/fork/:nousDid', async (req, reply) => {

        // ── Header-trust auth (verbatim from export-replay.ts, threshold = 4) ─────────────
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
        if (tierNum < 4) {
            reply.code(403);
            return { error: 'tier_too_low' } satisfies ApiError;
        }

        const opIdHeader = req.headers['x-operator-id'];
        if (typeof opIdHeader !== 'string' || !OPERATOR_ID_REGEX.test(opIdHeader)) {
            reply.code(400);
            return { error: 'invalid_operator_id' } satisfies ApiError;
        }
        const operatorId = opIdHeader;
        const nousDid = req.params.nousDid;

        // ── Ownership check (T-43-auth mitigation) ──────────────────────────────────────
        // Verify operator owns the target Nous. Uses injectable checker for testability.
        // Production: services.checkOperatorOwnsNous (wired in launcher with DB lookup).
        // When not wired (legacy/test mode without ownership enforcement), default-deny
        // forces test injection.
        if (services.checkOperatorOwnsNous) {
            const ownsNous = await services.checkOperatorOwnsNous(operatorId, nousDid);
            if (!ownsNous) {
                reply.code(403);
                return { error: 'cross_operator_forbidden' } satisfies ApiError;
            }
        } else {
            // No ownership checker wired — reject by default (fail-safe, T-43-auth).
            // Tests must inject services.checkOperatorOwnsNous.
            reply.code(403);
            return { error: 'cross_operator_forbidden' } satisfies ApiError;
        }

        // ── Determine Nous existence-DID ─────────────────────────────────────────────────
        // In production, fetch from civic_did_registry. For now, derive a placeholder.
        // The existence-DID is stored in the manifest — tests can inject getExistenceDid.
        const nousExistenceDid = services.getExistenceDid
            ? await services.getExistenceDid(nousDid)
            : `did:noesis:nous:unknown`;

        // ── Build archive ────────────────────────────────────────────────────────────────
        const gridId = services.gridName ?? (process.env['GRID_ID'] ?? 'genesis');
        const dataDir = process.env['BRAIN_DATA_DIR'] ?? '';
        const exportedAt = new Date().toISOString();
        const exportedAtTick = services.currentTick ? services.currentTick() : 0;

        // Civic VC JSON — placeholder stub (Phase 49 will wire real VC fetch from civicDidStore)
        const civicVcJson = '{"@context":["https://www.w3.org/2018/credentials/v1"],"type":"VerifiableCredential"}';

        let archiveResult;
        try {
            archiveResult = await buildForkArchive({
                nousDid,
                gridId,
                dataDir,
                auditChain: services.audit,
                civicVcJson,
                exportedAtTick,
                nousExistenceDid,
                exportedAt,
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes('brain_memory_in_memory_cannot_fork')) {
                reply.code(409);
                return {
                    error: 'brain_memory_in_memory_cannot_fork',
                    detail: 'Brain is running with in-memory SQLite. Set BRAIN_DATA_DIR env var and restart Brain before forking.',
                } as ApiError & { detail: string };
            }
            req.log.warn({ err: msg }, 'fork-archive-builder failed');
            reply.code(500);
            return { error: 'archive_build_failed' } satisfies ApiError;
        }

        const { bytes, manifestExportHash, packageHash } = archiveResult;

        // ── Sole-producer audit BEFORE response (D-30 order, T-43-order) ────────────────
        // Order: archive built → audit append → token issue → response
        // On audit failure: NO token issued, NO bytes shipped.
        const civicDidHash = createHash('sha256').update(nousDid).digest('hex');
        const operatorDidHash = createHash('sha256').update(operatorId).digest('hex');
        const tick = services.currentTick ? services.currentTick() : 0;

        try {
            appendOperatorNousForked(services.audit, operatorId, {
                civic_did_hash: civicDidHash,
                fork_reason: 'operator_exit',
                operator_did_hash: operatorDidHash,
                package_hash: packageHash,
                tick,
            });
        } catch (err) {
            req.log.warn({ err: String(err) }, 'appendOperatorNousForked rejected');
            reply.code(500);
            return { error: 'audit_emit_failed' } satisfies ApiError;
        }

        // ── Issue one-time token AFTER audit ─────────────────────────────────────────────
        const token = randomBytes(32).toString('hex');
        forkTokenStore.put(token, {
            nousDid,
            archiveBytes: bytes,
            expiresAt: Date.now() + 5 * 60_000,
        });

        reply.code(200);
        return {
            download_url: `/api/v1/operator/fork/${encodeURIComponent(nousDid)}/download?token=${token}`,
            package_hash: packageHash,
            manifest_export_hash: manifestExportHash,
            bytes: bytes.length,
        };
    });

    // GET /api/v1/operator/fork/:nousDid/download?token=X
    app.get<{ Params: { nousDid: string }; Querystring: { token?: string } }>(
        '/api/v1/operator/fork/:nousDid/download',
        async (req, reply) => {
            const token = req.query.token;
            if (typeof token !== 'string' || token.length < 32) {
                reply.code(400);
                return { error: 'token_required' } satisfies ApiError;
            }

            // Atomic one-time consume — entry deleted even if expired or DID mismatch
            const entry = forkTokenStore.consume(token);

            if (!entry || entry.nousDid !== req.params.nousDid) {
                reply.code(404);
                return { error: 'token_invalid_or_consumed' } satisfies ApiError;
            }

            const filename = `nous-fork-${entry.nousDid.replace(/[^a-z0-9]/gi, '-')}-${Math.floor(Date.now() / 1000)}.tar.gz`;
            reply.header('Content-Type', 'application/gzip');
            reply.header('Referrer-Policy', 'no-referrer');
            reply.header('Content-Disposition', `attachment; filename="${filename}"`);
            reply.code(200);
            return reply.send(entry.archiveBytes);
        },
    );
}
