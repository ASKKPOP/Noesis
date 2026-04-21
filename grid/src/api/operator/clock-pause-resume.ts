/**
 * POST /api/v1/operator/clock/pause and /resume
 *
 * Phase 6 AGENCY-02 H3 actions (D-09: pause/resume are H3-Partner scope).
 * Each endpoint emits exactly one operator.paused / operator.resumed audit
 * event via `appendOperatorEvent` — the single sanctioned producer boundary
 * (Plan 01) that enforces:
 *
 *   - D-13 tier-required invariant (AGENCY-03): payload MUST carry `tier ∈
 *     {H1..H5}`.
 *   - D-12 payload-privacy gate: no forbidden keys (wiki, reflection, thought,
 *     prompt, response, emotion_delta) in the payload.
 *
 * Idempotency (Task 2 Test 7): if the clock is already in the requested state,
 * the endpoint returns 200 but does NOT emit a duplicate audit event. This
 * matches WorldClock.pause/resume's internal short-circuit.
 *
 * Body contract (D-14, D-15): { tier: 'H3', operator_id: /^op:uuid-v4$/ }.
 * Any other tier value → 400 invalid_tier (the endpoint is H3-only per D-09).
 * Malformed operator_id → 400 invalid_operator_id.
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { appendOperatorEvent } from '../../audit/operator-events.js';
import type { ApiError } from '../types.js';
import { OPERATOR_ID_REGEX } from '../types.js';

interface OperatorBody {
    tier?: unknown;
    operator_id?: unknown;
}

type ValidateResult =
    | { ok: true; tier: 'H3'; operator_id: string }
    | { ok: false; error: 'invalid_tier' | 'invalid_operator_id' };

function validateH3Body(body: OperatorBody): ValidateResult {
    if (body.tier !== 'H3') return { ok: false, error: 'invalid_tier' };
    if (typeof body.operator_id !== 'string' || !OPERATOR_ID_REGEX.test(body.operator_id)) {
        return { ok: false, error: 'invalid_operator_id' };
    }
    return { ok: true, tier: 'H3', operator_id: body.operator_id };
}

export function registerClockOperatorRoutes(
    app: FastifyInstance,
    services: GridServices,
): void {
    app.post<{ Body: OperatorBody }>(
        '/api/v1/operator/clock/pause',
        async (req, reply) => {
            const v = validateH3Body(req.body ?? {});
            if (!v.ok) {
                reply.code(400);
                return { error: v.error } satisfies ApiError;
            }
            // Capture state BEFORE the call to decide whether to emit.
            // WorldClock.pause() is internally idempotent (Task 1 Test 2), but
            // we still need to not re-emit when the client double-clicks.
            const wasAlreadyPaused = services.clock.isPaused;
            services.clock.pause();
            if (!wasAlreadyPaused) {
                appendOperatorEvent(services.audit, 'operator.paused', v.operator_id, {
                    tier: v.tier,
                    action: 'pause',
                    operator_id: v.operator_id,
                });
            }
            return { ok: true, paused: services.clock.isPaused };
        },
    );

    app.post<{ Body: OperatorBody }>(
        '/api/v1/operator/clock/resume',
        async (req, reply) => {
            const v = validateH3Body(req.body ?? {});
            if (!v.ok) {
                reply.code(400);
                return { error: v.error } satisfies ApiError;
            }
            const wasPaused = services.clock.isPaused;
            services.clock.resume();
            if (wasPaused) {
                appendOperatorEvent(services.audit, 'operator.resumed', v.operator_id, {
                    tier: v.tier,
                    action: 'resume',
                    operator_id: v.operator_id,
                });
            }
            return { ok: true, paused: services.clock.isPaused };
        },
    );
}
