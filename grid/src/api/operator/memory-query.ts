/**
 * Operator memory query: POST /api/v1/operator/nous/:did/memory/query.
 *
 * Phase 6 AGENCY-02 H2 Reviewer action (D-09). Proxies a query to the target
 * Nous's Brain via the InspectorRunner, returns the normalized entries
 * ({timestamp, kind, summary} only), and emits exactly ONE
 * operator.inspected audit event via appendOperatorEvent — the sanctioned
 * producer boundary from Plan 01 that enforces tier-required (D-13) and
 * payload-privacy (D-12) at a single chokepoint.
 *
 * PRIVACY INVARIANT (D-11, T-6-06 closure): the audit payload is a closed
 * tuple {tier: 'H2', action: 'inspect', operator_id, target_did}. Memory
 * content (summaries, timestamps, kinds) NEVER appears in the audit payload;
 * it is returned to the operator via the HTTP response body only. The grid-
 * side payload-privacy gate (payloadPrivacyCheck) plus the Python-side
 * normalization (handler.query_memory drops all fields beyond summary) form
 * the two halves of the sovereignty boundary.
 *
 * ERROR LADDER (no 500s):
 *   400  — malformed tier / operator_id / DID / query body
 *   404  — unknown Nous (no runner for DID)
 *   503  — Brain unavailable (bridge.connected === false OR RPC throws);
 *          NO audit event emitted on 503 (we only audit successful inspects).
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { DID_REGEX } from '../server.js';
import type { ApiError } from '../types.js';
import { appendOperatorEvent } from '../../audit/operator-events.js';
import { validateTierBody, type OperatorBody } from './_validation.js';
import { tombstoneCheck, TombstonedDidError } from '../../registry/tombstone-check.js';

interface QueryBody extends OperatorBody {
    query?: unknown;
    limit?: unknown;
}

export function registerMemoryQueryRoute(
    app: FastifyInstance,
    services: GridServices,
): void {
    app.post<{ Params: { did: string }; Body: QueryBody }>(
        '/api/v1/operator/nous/:did/memory/query',
        async (req, reply) => {
            const body = req.body ?? {};

            // 1. Tier + operator_id gate (D-13 + D-15).
            const v = validateTierBody(body, 'H2');
            if (!v.ok) {
                reply.code(400);
                return { error: v.error } satisfies ApiError;
            }

            // 2. DID shape gate (consistent with /api/v1/nous/:did/state from Plan 04).
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

            // 3. Query-body validation.
            const queryRaw = body.query;
            if (typeof queryRaw !== 'string') {
                reply.code(400);
                return { error: 'invalid_query' } satisfies ApiError;
            }
            // Limit is optional; reject only on wrong type. Out-of-range values
            // are clamped server-side (brain handler owns the [1,100] clamp).
            const limitRaw = body.limit;
            let limit: number | undefined;
            if (limitRaw !== undefined) {
                if (typeof limitRaw !== 'number' || !Number.isFinite(limitRaw)) {
                    reply.code(400);
                    return { error: 'invalid_limit' } satisfies ApiError;
                }
                limit = limitRaw;
            }

            // 4. Runner lookup — 404 on unknown Nous (no audit emit).
            const runner = services.getRunner ? services.getRunner(targetDid) : undefined;
            if (!runner) {
                reply.code(404);
                return { error: 'unknown_nous' } satisfies ApiError;
            }

            // 5. Bridge health — 503 on disconnect (no audit emit).
            if (!runner.connected) {
                reply.code(503);
                return { error: 'brain_unavailable' } satisfies ApiError;
            }
            if (typeof runner.queryMemory !== 'function') {
                // Legacy runner shape without the H2 extension — treat as unavailable.
                reply.code(503);
                return { error: 'brain_unavailable' } satisfies ApiError;
            }

            // 6. RPC call. Timeout/error → 503 + NO audit event (D-11 semantics:
            // we only log successful inspects; failures stay in the request log).
            let result: { entries: Array<{ timestamp: string; kind: string; summary: string }> };
            try {
                result = await runner.queryMemory({
                    query: queryRaw,
                    ...(limit !== undefined ? { limit } : {}),
                });
            } catch (err) {
                // Privacy invariant (T-6-03): never surface raw err.message.
                req.log.warn({ err, targetDid }, 'brain queryMemory failed');
                reply.code(503);
                return { error: 'brain_unavailable' } satisfies ApiError;
            }

            // 7. Emit operator.inspected — closed payload tuple, no memory content.
            appendOperatorEvent(
                services.audit,
                'operator.inspected',
                v.operator_id,
                {
                    tier: v.tier,
                    action: 'inspect',
                    operator_id: v.operator_id,
                    target_did: targetDid,
                },
                targetDid,
            );

            // 8. Return normalized entries in the HTTP body (NOT in the audit).
            return { entries: result.entries };
        },
    );
}
