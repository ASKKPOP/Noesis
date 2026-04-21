/**
 * Operator telos force: POST /api/v1/operator/nous/:did/telos/force.
 *
 * Phase 6 AGENCY-02 H4 Driver action (D-09). Submits a new Telos to the
 * target Nous's Brain via the InspectorRunner; the Brain rebuilds its
 * active Telos and returns ONLY the SHA-256 hashes before/after. The grid
 * then emits exactly ONE operator.telos_forced audit event via
 * appendOperatorEvent — the sanctioned producer boundary from Plan 01.
 *
 * D-19 HASH-ONLY INVARIANT (T-6-06 closure):
 *   The operator.telos_forced payload is a closed tuple
 *       {tier: 'H4', action: 'force_telos', operator_id, target_did,
 *        telos_hash_before, telos_hash_after}
 *   Plaintext Telos (goal descriptions, priorities, progress) NEVER appears
 *   in the audit payload. The three-way enforcement:
 *     1. Brain side: force_telos returns ONLY hashes (handler.py).
 *     2. Handler side: closed payload literal below — no key spread.
 *     3. Privacy gate: payloadPrivacyCheck catches forbidden keys structurally.
 *
 * ERROR LADDER (no 500s):
 *   400  — malformed tier / operator_id / DID / new_telos body
 *   404  — unknown Nous (no runner for DID)
 *   503  — Brain unavailable (bridge.connected === false OR RPC throws);
 *          NO audit event emitted on 503.
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { DID_REGEX } from '../server.js';
import type { ApiError } from '../types.js';
import { appendOperatorEvent } from '../../audit/operator-events.js';
import { validateTierBody, type OperatorBody } from './_validation.js';
import { tombstoneCheck, TombstonedDidError } from '../../registry/tombstone-check.js';

interface ForceTelosBody extends OperatorBody {
    new_telos?: unknown;
}

/**
 * Narrow check: 64-hex SHA-256 — mirrors grid/src/audit/chain.ts hash format
 * and brain/src/noesis_brain/telos/hashing.py return contract. Runtime guard
 * to catch contract drift at the RPC boundary.
 */
const HEX64_RE = /^[a-f0-9]{64}$/;

export function registerTelosForceRoute(
    app: FastifyInstance,
    services: GridServices,
): void {
    app.post<{ Params: { did: string }; Body: ForceTelosBody }>(
        '/api/v1/operator/nous/:did/telos/force',
        async (req, reply) => {
            const body = req.body ?? {};

            // 1. Tier + operator_id gate.
            const v = validateTierBody(body, 'H4');
            if (!v.ok) {
                reply.code(400);
                return { error: v.error } satisfies ApiError;
            }

            // 2. DID shape gate.
            const targetDid = req.params.did;
            if (!DID_REGEX.test(targetDid)) {
                reply.code(400);
                return { error: 'invalid_did' } satisfies ApiError;
            }

            // 2a. Tombstone check — 410 if DID already deleted (AGENCY-05 D-28).
            if (services.registry) {
                try {
                    tombstoneCheck(services.registry, targetDid);
                } catch (err) {
                    if (err instanceof TombstonedDidError) {
                        reply.code(410);
                        return { error: 'gone', deleted_at_tick: err.deletedAtTick } as ApiError & { deleted_at_tick: number };
                    }
                    throw err;
                }
            }

            // 3. new_telos body validation — must be an object (dict of lists).
            //    We don't validate the interior shape here; TelosManager.from_yaml
            //    on the Python side is tolerant of missing keys + empty lists.
            const newTelosRaw = body.new_telos;
            if (
                newTelosRaw === undefined ||
                newTelosRaw === null ||
                typeof newTelosRaw !== 'object' ||
                Array.isArray(newTelosRaw)
            ) {
                reply.code(400);
                return { error: 'invalid_new_telos' } satisfies ApiError;
            }

            // 4. Runner lookup.
            const runner = services.getRunner ? services.getRunner(targetDid) : undefined;
            if (!runner) {
                reply.code(404);
                return { error: 'unknown_nous' } satisfies ApiError;
            }

            // 5. Bridge health.
            if (!runner.connected) {
                reply.code(503);
                return { error: 'brain_unavailable' } satisfies ApiError;
            }
            if (typeof runner.forceTelos !== 'function') {
                reply.code(503);
                return { error: 'brain_unavailable' } satisfies ApiError;
            }

            // 6. RPC call. Timeout/error → 503 + NO audit event.
            let result: { telos_hash_before: string; telos_hash_after: string };
            try {
                result = await runner.forceTelos(newTelosRaw as Record<string, unknown>);
            } catch (err) {
                req.log.warn({ err, targetDid }, 'brain forceTelos failed');
                reply.code(503);
                return { error: 'brain_unavailable' } satisfies ApiError;
            }

            // 7. Runtime guard on hash shape — closes contract drift at boundary.
            //    A malformed hash from the Brain MUST NOT enter the audit chain.
            if (
                typeof result.telos_hash_before !== 'string' ||
                typeof result.telos_hash_after !== 'string' ||
                !HEX64_RE.test(result.telos_hash_before) ||
                !HEX64_RE.test(result.telos_hash_after)
            ) {
                req.log.warn(
                    { targetDid, result },
                    'brain forceTelos returned non-hex64 hash — contract drift',
                );
                reply.code(503);
                return { error: 'brain_unavailable' } satisfies ApiError;
            }

            // 8. Emit operator.telos_forced — closed payload tuple, hashes only.
            //    This literal IS the D-19 enforcement: NO spread, NO plaintext.
            appendOperatorEvent(
                services.audit,
                'operator.telos_forced',
                v.operator_id,
                {
                    tier: v.tier,
                    action: 'force_telos',
                    operator_id: v.operator_id,
                    target_did: targetDid,
                    telos_hash_before: result.telos_hash_before,
                    telos_hash_after: result.telos_hash_after,
                },
                targetDid,
            );

            return {
                ok: true,
                telos_hash_before: result.telos_hash_before,
                telos_hash_after: result.telos_hash_after,
            };
        },
    );
}
