/**
 * POST /api/v1/operator/replay/export — H5 Sovereign export endpoint.
 *
 * Phase 13 REPLAY-02 / D-13-09 — The operator-facing entry point that:
 *   1. Validates H5 tier + operator_id (validateTierBody).
 *   2. Validates the tick range (non-negative integers, end ≥ start).
 *   3. Reads the audit slice from services.audit (live chain, READ-ONLY).
 *   4. Builds start + end ReplayState snapshots via ReplayGrid + buildStateAtTick.
 *   5. Builds the deterministic tarball (Wave 2 buildExportTarball).
 *   6. Emits ONE operator.exported audit event via appendOperatorExported (sole producer).
 *   7. Streams the tarball bytes back with X-Tarball-Hash + Content-Disposition headers.
 *
 * SECURITY PROPERTIES:
 *   T-13-04-01 (Spoofing): validateTierBody enforces tier === 'H5' by strict equality.
 *     Self-report invariant in appendOperatorExported prevents cross-operator attribution.
 *   T-13-04-03 (Elevation of Privilege): H5 is the maximum tier — no escalation surface.
 *   T-10-10 (Privacy): appendOperatorExported's closed-tuple + payloadPrivacyCheck are
 *     the last line of defense. The route only ever passes the closed 6-tuple — no
 *     payload-mediated leak.
 *   T-10-08 (Tampering): requested_at = Math.floor(Date.now()/1000) per D-13-09;
 *     appendOperatorExported rejects values ≥ 10_000_000_000.
 *
 * ORDER INVARIANT (mirrors D-30 from Phase 8):
 *   tarball build → audit append → response stream.
 *   Audit event is committed BEFORE bytes leave the system — non-repudiable trail.
 *   On any error before the audit append: NO audit event is emitted.
 *
 * Template: grid/src/api/operator/delete-nous.ts (registrar shape).
 *
 * See: REPLAY-02, D-13-09, T-10-08, T-10-10, T-13-04-01, T-13-04-03.
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import type { ApiError } from '../types.js';
import { validateTierBody, type OperatorBody } from './_validation.js';
import { appendOperatorExported, type OperatorExportedPayload } from '../../audit/append-operator-exported.js';
import { buildExportTarball } from '../../export/tarball-builder.js';
import { createManifest } from '../../export/manifest.js';
import { ReplayGrid } from '../../replay/replay-grid.js';
import { buildStateAtTick } from '../../replay/state-builder.js';

interface ExportReplayBody extends OperatorBody {
    start_tick?: unknown;
    end_tick?: unknown;
}

export function registerReplayExportRoute(
    app: FastifyInstance,
    services: GridServices,
): void {
    app.post<{ Body: ExportReplayBody }>('/api/v1/operator/replay/export', async (req, reply) => {
        const body = (req.body ?? {}) as ExportReplayBody;

        // 1. Tier + operator_id gate (H5).
        const v = validateTierBody(body, 'H5');
        if (!v.ok) {
            reply.code(400);
            return { error: v.error } satisfies ApiError;
        }

        // 2. Tick range validation.
        const startTick = body.start_tick;
        const endTick = body.end_tick;

        if (!Number.isInteger(startTick) || (startTick as number) < 0) {
            reply.code(400);
            return { error: 'invalid_start_tick' } satisfies ApiError;
        }
        if (!Number.isInteger(endTick) || (endTick as number) < (startTick as number)) {
            reply.code(400);
            return { error: 'invalid_end_tick' } satisfies ApiError;
        }

        const startTickN = startTick as number;
        const endTickN = endTick as number;

        // 3. Read ALL entries from live chain (READ-ONLY — never mutates).
        const allEntries = services.audit.all();

        // Filter the slice to [startTick, endTick] inclusive (using entry.id as tick proxy).
        // AuditChain entry.id is 1-based sequential; treat it as the tick index.
        const slice = allEntries.filter(
            (e) => (e.id ?? 0) >= startTickN && (e.id ?? 0) <= endTickN,
        );

        if (slice.length === 0) {
            reply.code(400);
            return { error: 'empty_slice' } satisfies ApiError;
        }

        const chainTailHash = slice[slice.length - 1].eventHash;

        // 4. Build start + end snapshots via isolated ReplayGrid + buildStateAtTick.
        //    Two separate ReplayGrid instances — each contains only its own slice.
        const startEntries = allEntries.filter((e) => (e.id ?? 0) <= startTickN);
        const endEntries = allEntries.filter((e) => (e.id ?? 0) <= endTickN);

        const startReplay = new ReplayGrid(startEntries, services.gridName);
        const endReplay = new ReplayGrid(endEntries, services.gridName);

        const startSnapshot = buildStateAtTick(startReplay, startTickN);
        const endSnapshot = buildStateAtTick(endReplay, endTickN);

        // 5. Build the deterministic manifest (Wave 2 output).
        const manifest = createManifest({
            startTick: startTickN,
            endTick: endTickN,
            entryCount: slice.length,
            chainTailHash,
        });

        // 6. Build the deterministic tarball (Wave 2 output). Wall-clock NOT read here.
        const { bytes, hash: tarballHash } = await buildExportTarball({
            chainSlice: slice,
            startSnapshot,
            endSnapshot,
            manifest,
        });

        // 7. Sole-producer audit event — emit BEFORE streaming response (D-30 order).
        //    requested_at = Unix SECONDS per D-13-09 (NOT Date.now() milliseconds).
        const requestedAt = Math.floor(Date.now() / 1000);

        const exportPayload: OperatorExportedPayload = {
            tier: 'H5',
            operator_id: v.operator_id,
            start_tick: startTickN,
            end_tick: endTickN,
            tarball_hash: tarballHash,
            requested_at: requestedAt,
        };

        try {
            appendOperatorExported(services.audit, v.operator_id, exportPayload);
        } catch (err) {
            // If the sole-producer rejects (should never happen with valid inputs),
            // log and refuse — never leak partial export without a recorded trail.
            req.log.warn({ err: String(err) }, 'appendOperatorExported rejected');
            reply.code(400);
            return { error: 'audit_emit_failed' } satisfies ApiError;
        }

        // 8. Stream tarball bytes back.
        reply.header('Content-Type', 'application/octet-stream');
        reply.header('X-Tarball-Hash', tarballHash);
        reply.header('Content-Disposition', `attachment; filename="replay-${startTickN}-${endTickN}.tar"`);
        reply.code(200);
        return reply.send(bytes);
    });
}
