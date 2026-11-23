/**
 * POST /api/v1/operator/fork/:nousDid — the owner's fork endpoint (FORK-01 / D-43-02).
 * GET /api/v1/operator/fork/:nousDid/download?token=X — one-time archive download.
 *
 * Phase 43 constitutional right-to-fork enforcement per D-V3-18. The operator must
 * be able to walk away with their Nous in a portable .tar.gz archive.
 *
 * The Grid half of a fork: the archive holds what the Grid itself keeps about the Nous —
 * its civic credential, its slice of the audit chain and a manifest. The Brain's memory
 * lives on the owner's machine and is added there; the Grid never reads it.
 *
 * SECURITY PROPERTIES:
 *   T-43-auth: only the person who claimed the Nous's Brain (brain_tokens.operator_did,
 *     keyed by the existence-DID the civic registry binds to this Civic-DID) may fork it.
 *     Policy portal_session_required; anyone else → 403 cross_operator_forbidden.
 *   T-43-token: one-time token with 5-min TTL; atomic consume; bound to nousDid.
 *   T-43-order: audit event committed BEFORE bytes leave the system.
 *     On audit failure → 500 audit_emit_failed, no token issued, no bytes shipped.
 *   T-43-secrets: privacy gate in fork-archive-builder rejects credential-shaped
 *     substrings in the manifest.
 *   T-43-referer: Referrer-Policy: no-referrer on download.
 *
 * ERROR LADDER:
 *   403 — operator_scope_required (no Portal session) / cross_operator_forbidden (not the owner)
 *   404 — unknown_nous (no Civic-DID in this Grid's registry)
 *   500 — archive_build_failed / audit_emit_failed
 *   503 — db_unavailable / civic_registry_unavailable
 *   200 — success, JSON response with download_url + hashes
 *
 * See: FORK-01, D-43-02, D-43-04, T-43-auth, T-43-token, T-43-order, T-43-secrets, T-43-referer.
 */

import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import type { ApiError } from '../types.js';
import { appendOperatorNousForked } from '../../audit/append-operator-nous-forked.js';
import { buildForkArchive } from '../../export/fork-archive-builder.js';
import { forkTokenStore } from './fork-token-store.js';
import { ownsBrain } from '../../operator/data/operator-brain-store.js';
import { HUMAN_DID_RE } from '../../util/id-patterns.js';

export function registerForkNousRoute(app: FastifyInstance, services: GridServices): void {

    // POST /api/v1/operator/fork/:nousDid
    app.post<{ Params: { nousDid: string } }>('/api/v1/operator/fork/:nousDid', async (req, reply) => {

        const ownerDid = req.didContext?.operatorDid;
        if (!ownerDid) {
            reply.code(403);
            return { error: 'operator_scope_required' } satisfies ApiError;
        }
        const nousDid = req.params.nousDid;

        if (!services.pool) {
            reply.code(503);
            return { error: 'db_unavailable' } satisfies ApiError;
        }
        if (!services.civicDidStore) {
            reply.code(503);
            return { error: 'civic_registry_unavailable' } satisfies ApiError;
        }
        const civicRecord = await services.civicDidStore.get(services.gridName, nousDid);
        if (!civicRecord) {
            reply.code(404);
            return { error: 'unknown_nous' } satisfies ApiError;
        }

        if (!HUMAN_DID_RE.test(ownerDid)
            || !(await ownsBrain(services.pool, services.gridName, ownerDid, civicRecord.existenceDid))) {
            reply.code(403);
            return { error: 'cross_operator_forbidden' } satisfies ApiError;
        }

        const gridId = services.gridName ?? (process.env['GRID_ID'] ?? 'genesis');
        const exportedAt = new Date().toISOString();
        const exportedAtTick = services.currentTick ? services.currentTick() : 0;

        let archiveResult;
        try {
            archiveResult = await buildForkArchive({
                nousDid,
                gridId,
                auditChain: services.audit,
                civicVcJson: JSON.stringify(civicRecord.credentialJson),
                exportedAtTick,
                nousExistenceDid: civicRecord.existenceDid,
                exportedAt,
            });
        } catch (err) {
            req.log.warn({ err: err instanceof Error ? err.message : String(err) }, 'fork-archive-builder failed');
            reply.code(500);
            return { error: 'archive_build_failed' } satisfies ApiError;
        }

        const { bytes, manifestExportHash, packageHash } = archiveResult;

        // ── Sole-producer audit BEFORE response (D-30 order, T-43-order) ────────────────
        // Order: archive built → audit append → token issue → response
        // On audit failure: NO token issued, NO bytes shipped.
        const civicDidHash = createHash('sha256').update(nousDid).digest('hex');
        const operatorDidHash = createHash('sha256').update(ownerDid).digest('hex');
        const tick = services.currentTick ? services.currentTick() : 0;

        try {
            appendOperatorNousForked(services.audit, ownerDid, {
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
