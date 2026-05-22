/**
 * Operator mute: POST /api/v1/operator/nous/:did/mute.
 *
 * Phase 25b SANCTION-01 — H3 Reviewer action (D-25b-NEW-1, D-25b-09).
 * Mutes a Nous by setting muteFlag=true on its NousRunner, which suppresses
 * all broadcast audit emissions (nous.spoke, nous.direct_message, nous.whispered,
 * skill teaching) at the runner's emit boundary (D-25b-NEW-3).
 *
 * AUTH MODEL (born header-auth per D-25b-NEW-1):
 *   tier and operator_id are derived from server-trusted request headers
 *   (x-operator-tier, x-operator-id) — NOT from the request body.
 *
 * REASON DISCIPLINE (D-25b-11):
 *   reason plaintext is written to the sanction_reasons table (via services.sanctionReasonStore).
 *   Only reason_hash (SHA-256 of plaintext) crosses the audit boundary.
 *   Audit payload NEVER contains plaintext.
 *
 * ERROR LADDER (no 500s):
 *   400 — malformed DID or x-operator-id header (invalid_did / invalid_operator_id)
 *   401 — tier_missing (x-operator-tier header absent / non-numeric)
 *   403 — tier_too_low (x-operator-tier < 3)
 *   404 — unknown Nous (no runner for DID)
 *   410 — tombstoned DID
 *   200 — success with { ok: true }
 *
 * SOLE-PRODUCER INVARIANT (Pitfall 4): appendOperatorMuted is called EXACTLY
 * ONCE in this file, on the SUCCESS path only. Error paths MUST NOT emit.
 *
 * See: 25b-CONTEXT D-25b-07, D-25b-09, D-25b-11, D-25b-NEW-3.
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { DID_REGEX } from '../server.js';
import type { ApiError } from '../types.js';
import { OPERATOR_ID_REGEX } from '../types.js';
import { tombstoneCheck, TombstonedDidError } from '../../registry/tombstone-check.js';
import { appendOperatorMuted } from '../../audit/append-operator-muted.js';
import { createHash } from 'node:crypto';

interface MuteBody {
    reason?: unknown;  // plaintext; NEVER enters audit payload (D-25b-11)
}

export function registerMuteBroadcastRoute(app: FastifyInstance, services: GridServices): void {
    app.post<{ Params: { did: string }; Body: MuteBody }>(
        '/api/v1/operator/nous/:did/mute',
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

            // 2. DID shape gate.
            const targetDid = req.params.did;
            if (!DID_REGEX.test(targetDid)) {
                reply.code(400);
                return { error: 'invalid_did' } satisfies ApiError;
            }

            // 3. Tombstone check — 410 if DID already deleted.
            if (services.registry) {
                try {
                    tombstoneCheck(services.registry, targetDid);
                } catch (err) {
                    if (err instanceof TombstonedDidError) {
                        reply.code(410);
                        return { error: 'gone' } satisfies ApiError;
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

            // 5. Reason hash — SHA-256(plaintext). Plaintext stored in sanction_reasons; hash in audit.
            const reasonPlain = typeof req.body?.reason === 'string' ? req.body.reason : '';
            const reasonHash = createHash('sha256').update(reasonPlain).digest('hex');

            // 6. Persist reason plaintext to sanction_reasons table (fire-and-forget on DB absence).
            //    D-25b-11: plaintext stays Grid-side; only reason_hash crosses the audit boundary.
            if (services.sanctionReasonStore) {
                await services.sanctionReasonStore.insert({
                    reason_hash: reasonHash,
                    plaintext: reasonPlain,
                    operator_id: resolvedOperatorId,
                    event_type: 'operator.muted',
                    target_did: targetDid,
                    tick: services.clock.state.tick,
                });
            }

            // 7. Apply sanction — set muteFlag on runner (D-25b-NEW-3).
            //    NousRunner exposes muteFlag as a public boolean field (InspectorRunner.muteFlag).
            (runner as unknown as { muteFlag: boolean }).muteFlag = true;

            // 8. Emit operator.muted — ONLY on success path (sole-producer invariant, Pitfall 4).
            appendOperatorMuted(services.audit, resolvedOperatorId, {
                tier: resolvedTier,
                action: 'mute',
                operator_id: resolvedOperatorId,
                target_did: targetDid,
                tick: services.clock.state.tick,
                reason_hash: reasonHash,
            });

            // 9. Return success.
            return { ok: true };
        },
    );
}
