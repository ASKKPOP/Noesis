/**
 * Operator cognitive snapshot: POST /api/v1/operator/nous/:did/cognitive-snapshot.
 *
 * Phase 25a OBS-COGNITIVE-INSPECTOR — H3 Reviewer action (D-25a-04).
 * Proxies a Brain HTTP cognitive-snapshot fetch via fetchCognitiveSnapshot,
 * merges Grid-computed creed_violation_count, and emits exactly ONE
 * operator.inspected audit event via appendOperatorEvent — the sanctioned
 * producer boundary from Phase 6 that enforces tier-required (D-13) and
 * payload-privacy (D-12) at a single chokepoint.
 *
 * PRIVACY INVARIANT: the audit payload is a closed tuple
 * {tier: 'H3', action: 'cognitive_snapshot', operator_id, target_did}.
 * Cognitive state (drive levels, reflexion count, skill titles) NEVER appears
 * in the audit payload; it is returned to the operator via HTTP response only.
 *
 * SOLE-PRODUCER INVARIANT (Pitfall 4): appendOperatorEvent is called EXACTLY
 * ONCE in this file, on the SUCCESS path only. Error paths MUST NOT emit.
 *
 * AUTH MODEL (GAP-25a-1 fix, Phase 25a-07):
 *   tier and operator_id are derived from server-trusted request headers
 *   (x-operator-tier, x-operator-id) — NOT from the request body. Mirrors
 *   the canonical validateTierAtLeast pattern from grid/src/api/governance/
 *   _validation.ts. Request body is unused.
 *
 * ERROR LADDER (no 500s — mirrors memory-query.ts discipline):
 *   400 — malformed DID or x-operator-id header (invalid_did / invalid_operator_id)
 *   401 — tier_missing (x-operator-tier header absent / non-numeric)
 *   403 — tier_too_low (x-operator-tier < 3)
 *   404 — unknown Nous (no runner for DID)
 *   410 — tombstoned DID
 *   503 — Brain unavailable (unreachable, timeout, malformed response)
 *   200 — success with 6-key response
 *
 * See: .planning/phases/25a-observer-surfaces/25a-CONTEXT.md D-25a-02, D-25a-04, D-25a-05
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { DID_REGEX } from '../server.js';
import type { ApiError } from '../types.js';
import { OPERATOR_ID_REGEX } from '../types.js';
import { appendOperatorEvent } from '../../audit/operator-events.js';
import { tombstoneCheck, TombstonedDidError } from '../../registry/tombstone-check.js';
import {
    fetchCognitiveSnapshot,
    type BrainCognitiveSnapshot,
} from './cognitive-snapshot-client.js';
import {
    BrainUnreachableError,
    BrainUnknownDidError,
    BrainMalformedResponseError,
} from './brain-http-errors.js';

export interface CognitiveSnapshotResponse extends BrainCognitiveSnapshot {
    creed_violation_count: number;
}

export function registerCognitiveSnapshotRoute(
    app: FastifyInstance,
    services: GridServices,
): void {
    app.post<{ Params: { did: string }; Body: never }>(
        '/api/v1/operator/nous/:did/cognitive-snapshot',
        async (req, reply) => {
            // 1. Tier gate — read from server-trusted x-operator-tier header (D-25a-04).
            //    Mirrors grid/src/api/governance/_validation.ts validateTierAtLeast.
            //    GAP-25a-1 fix: body fields tier/operator_id are NOT trusted.
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

            // 2. DID shape gate.
            const targetDid = req.params.did;
            if (!DID_REGEX.test(targetDid)) {
                reply.code(400);
                return { error: 'invalid_did' } satisfies ApiError;
            }

            // 3. Tombstone check — 410 if DID already deleted (AGENCY-05 D-28).
            if (services.registry) {
                try {
                    tombstoneCheck(services.registry, targetDid);
                } catch (err) {
                    if (err instanceof TombstonedDidError) {
                        reply.code(410);
                        return { error: 'tombstoned' } satisfies ApiError;
                    }
                    throw err;
                }
            }

            // 4. Runner lookup — 404 on unknown Nous (no audit emit).
            const runner = services.getRunner ? services.getRunner(targetDid) : undefined;
            if (!runner) {
                reply.code(404);
                return { error: 'unknown_nous' } satisfies ApiError;
            }

            // 5. Brain HTTP proxy via fetchCognitiveSnapshot.
            //    brainBaseUrl: from services.brainBaseUrl (test injection) or env.
            //    brainFetch: from services.brainFetch (test injection) or global fetch.
            const brainBaseUrl =
                services.brainBaseUrl ?? process.env.BRAIN_HTTP_BASE_URL ?? 'http://brain:8090';
            const brainFetch = services.brainFetch ?? fetch;

            let brainSnapshot: BrainCognitiveSnapshot;
            try {
                brainSnapshot = await fetchCognitiveSnapshot(brainBaseUrl, targetDid, brainFetch);
            } catch (err) {
                // Brain errors → 503 brain_unavailable, no audit emit (D-25a-04 / T-25a-05-07).
                if (
                    err instanceof BrainUnreachableError ||
                    err instanceof BrainUnknownDidError ||
                    err instanceof BrainMalformedResponseError
                ) {
                    reply.code(503);
                    return { error: 'brain_unavailable' } satisfies ApiError;
                }
                throw err;
            }

            // 6. Grid-computed creed_violation_count — count nous.creed_violation events for DID.
            const creedViolationCount = services.audit.query({
                eventType: 'nous.creed_violation',
                actorDid: targetDid,
            }).length;

            // 7. Emit operator.inspected — ONLY on success path (sole-producer invariant, Pitfall 4).
            //    Closed payload tuple: no cognitive state content in audit.
            //    GAP-25a-1 fix: operator_id sourced from header, never from body.
            appendOperatorEvent(
                services.audit,
                'operator.inspected',
                resolvedOperatorId,
                {
                    tier: resolvedTier,
                    action: 'cognitive_snapshot',
                    operator_id: resolvedOperatorId,
                    target_did: targetDid,
                },
                targetDid,
            );

            // 8. Return merged 6-key response.
            return { ...brainSnapshot, creed_violation_count: creedViolationCount } satisfies CognitiveSnapshotResponse;
        },
    );
}
