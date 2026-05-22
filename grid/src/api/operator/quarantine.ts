/**
 * Operator quarantine: POST /api/v1/operator/nous/:did/quarantine.
 *
 * Phase 25b SANCTION-03 — H4 Moderator action (D-25b-NEW-1, D-25b-09).
 * Quarantines a Nous by setting quarantineFlag=true on its registry record,
 * which causes peer-discovery (inRegion) to exclude the Nous from nearby-list
 * queries (D-25b-NEW-3). The Nous remains physically in its region per the
 * quarantine spec — only peer visibility is affected.
 *
 * Operator-side registry queries (all(), active()) still return quarantined
 * records so operators retain full visibility.
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
 *   403 — tier_too_low (x-operator-tier < 4)
 *   404 — unknown Nous (no runner for DID)
 *   410 — tombstoned DID
 *   200 — success with { ok: true }
 *
 * SOLE-PRODUCER INVARIANT (Pitfall 4): appendOperatorQuarantined is called EXACTLY
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
import { appendOperatorQuarantined } from '../../audit/append-operator-quarantined.js';
import { createHash } from 'node:crypto';

interface QuarantineBody {
    reason?: unknown;  // plaintext; NEVER enters audit payload (D-25b-11)
}

export function registerQuarantineRoute(app: FastifyInstance, services: GridServices): void {
    app.post<{ Params: { did: string }; Body: QuarantineBody }>(
        '/api/v1/operator/nous/:did/quarantine',
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
            if (tierNum < 4) {
                reply.code(403);
                return { error: 'tier_too_low' } satisfies ApiError;
            }

            // 1b. Operator-id gate — read from server-trusted x-operator-id header.
            const opIdHeader = req.headers['x-operator-id'];
            if (typeof opIdHeader !== 'string' || !OPERATOR_ID_REGEX.test(opIdHeader)) {
                reply.code(400);
                return { error: 'invalid_operator_id' } satisfies ApiError;
            }
            const resolvedTier: 'H4' = 'H4';
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
                    event_type: 'operator.quarantined',
                    target_did: targetDid,
                    tick: services.clock.state.tick,
                });
            }

            // 7. Apply sanction — set quarantineFlag on registry record (D-25b-NEW-3).
            //    Peer-discovery (inRegion) filters records with quarantineFlag=true.
            //    The Nous is NOT physically moved — only peer visibility is affected.
            if (services.registry) {
                const record = services.registry.get(targetDid);
                if (record) {
                    (record as unknown as { quarantineFlag: boolean }).quarantineFlag = true;
                }
            }

            // 8. Emit operator.quarantined — ONLY on success path (sole-producer invariant, Pitfall 4).
            appendOperatorQuarantined(services.audit, resolvedOperatorId, {
                tier: resolvedTier,
                action: 'quarantine',
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
