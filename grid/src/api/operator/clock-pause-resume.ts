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
 * AUTH MODEL (Phase 25b-01 header-auth migration, D-25b-NEW-1):
 *   tier and operator_id are derived from server-trusted request headers
 *   (x-operator-tier, x-operator-id) — NOT from the request body. Mirrors
 *   the canonical pattern from cognitive-snapshot.ts (Phase 25a-07).
 *   Request body is unused (Body: never).
 *
 * ERROR LADDER (no 500s — mirrors cognitive-snapshot.ts discipline):
 *   400 — malformed x-operator-id header (invalid_operator_id)
 *   401 — tier_missing (x-operator-tier header absent / non-numeric)
 *   403 — tier_too_low (x-operator-tier < 3)
 *   200 — success; audit emit happens here, ONCE (sole-producer invariant)
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { appendOperatorEvent } from '../../audit/operator-events.js';
import type { ApiError } from '../types.js';
import { OPERATOR_ID_REGEX } from '../types.js';

export function registerClockOperatorRoutes(
    app: FastifyInstance,
    services: GridServices,
): void {
    app.post<{ Body: never }>(
        '/api/v1/operator/clock/pause',
        async (req, reply) => {
            // 1. Tier gate — read from server-trusted x-operator-tier header (D-25b-NEW-1).
            //    Body fields tier/operator_id are NOT trusted (header-auth migration).
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
            if (tierNum < 3) {
                reply.code(403);
                return { error: 'tier_too_low' } satisfies ApiError;
            }

            // 1b. Operator-id gate — read from server-trusted x-operator-id header.
            const opIdHeader = req.headers['x-operator-id'];
            if (typeof opIdHeader !== 'string' || !OPERATOR_ID_REGEX.test(opIdHeader)) {
                reply.code(400);
                return { error: 'invalid_operator_id' } satisfies ApiError;
            }
            const resolvedTier: 'H3' = 'H3';
            const resolvedOperatorId = opIdHeader;

            // Capture state BEFORE the call to decide whether to emit.
            // WorldClock.pause() is internally idempotent (Task 1 Test 2), but
            // we still need to not re-emit when the client double-clicks.
            const wasAlreadyPaused = services.clock.isPaused;
            services.clock.pause();
            // Phase 7 DIALOG-01 (D-04): drain the dialogue aggregator AFTER
            // pause so windows cannot bridge the pause boundary. Invoked even
            // when wasAlreadyPaused so repeat-pause stays idempotently empty.
            if (services.drainDialogueOnPause) {
                services.drainDialogueOnPause();
            }
            if (!wasAlreadyPaused) {
                appendOperatorEvent(services.audit, 'operator.paused', resolvedOperatorId, {
                    tier: resolvedTier,
                    action: 'pause',
                    operator_id: resolvedOperatorId,
                });
            }
            return { ok: true, paused: services.clock.isPaused };
        },
    );

    app.post<{ Body: never }>(
        '/api/v1/operator/clock/resume',
        async (req, reply) => {
            // 1. Tier gate — read from server-trusted x-operator-tier header (D-25b-NEW-1).
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
            if (tierNum < 3) {
                reply.code(403);
                return { error: 'tier_too_low' } satisfies ApiError;
            }

            // 1b. Operator-id gate — read from server-trusted x-operator-id header.
            const opIdHeader = req.headers['x-operator-id'];
            if (typeof opIdHeader !== 'string' || !OPERATOR_ID_REGEX.test(opIdHeader)) {
                reply.code(400);
                return { error: 'invalid_operator_id' } satisfies ApiError;
            }
            const resolvedTier: 'H3' = 'H3';
            const resolvedOperatorId = opIdHeader;

            const wasPaused = services.clock.isPaused;
            services.clock.resume();
            if (wasPaused) {
                appendOperatorEvent(services.audit, 'operator.resumed', resolvedOperatorId, {
                    tier: resolvedTier,
                    action: 'resume',
                    operator_id: resolvedOperatorId,
                });
            }
            return { ok: true, paused: services.clock.isPaused };
        },
    );
}
