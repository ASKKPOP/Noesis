// ZERO-CUSTODY INVARIANT (D-25b-NEW-4): This route sets a Grid-side flag ONLY.
// No on-chain action is taken — the user's EVM wallet remains entirely under their control.
// Portal middleware (plan 13) reads this flag to block portal actions; SIWE sign-in remains allowed.

/**
 * Operator freeze-wallet: POST /api/v1/operator/humans/:did/freeze.
 *
 * Phase 25b SANCTION-06 — H5 Sovereign Operations (D-25b-08, D-25b-NEW-4).
 * Freezes a human's portal access by setting human_users.frozen=1 (Grid-side flag).
 * Frozen-but-not-banned humans can still SIWE-authenticate to see their read-only status.
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
 *   401 — tier_missing (x-operator-tier header absent / non-numeric)
 *   403 — tier_too_low (x-operator-tier < 5)
 *   400 — malformed x-operator-id header (invalid_operator_id)
 *   400 — malformed DID (invalid_did)
 *   404 — unknown human (no human_users row for DID)
 *   200 — success with { ok: true }
 *
 * NOTE: No tombstone check — humans have no tombstones in v2.5 (PATTERNS.md).
 *
 * SOLE-PRODUCER INVARIANT (Pitfall 4): appendOperatorHumanFrozen is called EXACTLY
 * ONCE in this file, on the SUCCESS path only. Error paths MUST NOT emit.
 *
 * See: 25b-CONTEXT D-25b-08, D-25b-09, D-25b-11, D-25b-NEW-4, D-25b-NEW-5.
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import type { ApiError } from '../types.js';
import { OPERATOR_ID_REGEX } from '../types.js';
import { appendOperatorHumanFrozen } from '../../audit/append-operator-human-frozen.js';
import { createHash } from 'node:crypto';

/** Human DID regex — allows colon separators for did:noesis:human:0x... format. */
const HUMAN_DID_REGEX = /^did:noesis:[a-z0-9_:\-]+$/i;

interface FreezeWalletBody {
    reason?: unknown;  // plaintext; NEVER enters audit payload (D-25b-11)
}

export function registerFreezeWalletRoute(app: FastifyInstance, services: GridServices): void {
    app.post<{ Params: { did: string }; Body: FreezeWalletBody }>(
        '/api/v1/operator/humans/:did/freeze',
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
            if (tierNum < 5) {
                reply.code(403);
                return { error: 'tier_too_low' } satisfies ApiError;
            }

            // 1b. Operator-id gate — read from server-trusted x-operator-id header.
            const opIdHeader = req.headers['x-operator-id'];
            if (typeof opIdHeader !== 'string' || !OPERATOR_ID_REGEX.test(opIdHeader)) {
                reply.code(400);
                return { error: 'invalid_operator_id' } satisfies ApiError;
            }
            const resolvedTier: 'H5' = 'H5';
            const resolvedOperatorId = opIdHeader;

            // 2. DID shape gate — human DIDs include colons (did:noesis:human:0x...).
            const targetDid = req.params.did;
            if (!HUMAN_DID_REGEX.test(targetDid)) {
                reply.code(400);
                return { error: 'invalid_did' } satisfies ApiError;
            }

            // 3. Existence check — 404 on unknown human (no tombstone check; humans have none).
            if (!services.humanSanctionStore) {
                reply.code(503);
                return { error: 'human_sanction_store_unavailable' } satisfies ApiError;
            }
            const exists = await services.humanSanctionStore.existsByDid(targetDid);
            if (!exists) {
                reply.code(404);
                return { error: 'unknown_human' } satisfies ApiError;
            }

            // 3b. Idempotency — WR-03 fix: if the wallet is already frozen, return success
            //     without emitting a duplicate audit event. Repeated calls are safe.
            const currentFlags = await services.humanSanctionStore.getFlags(targetDid);
            if (currentFlags && currentFlags.frozen === 1) {
                return { ok: true };
            }

            // 4. Reason hash — SHA-256(plaintext). Plaintext stored in sanction_reasons; hash in audit.
            //    WR-02 fix: enforce minimum reason length server-side (UI minLength is bypassable).
            const reasonPlain = typeof req.body?.reason === 'string' ? req.body.reason : '';
            if (reasonPlain.length < 10) {
                reply.code(400);
                return { error: 'reason_required' } satisfies ApiError;
            }
            const reasonHash = createHash('sha256').update(reasonPlain).digest('hex');

            // 5. Persist reason plaintext to sanction_reasons table (fire-and-forget on DB absence).
            //    D-25b-11: plaintext stays Grid-side; only reason_hash crosses the audit boundary.
            if (services.sanctionReasonStore) {
                await services.sanctionReasonStore.insert({
                    reason_hash: reasonHash,
                    plaintext: reasonPlain,
                    operator_id: resolvedOperatorId,
                    event_type: 'operator.human_frozen',
                    target_did: targetDid,
                    tick: services.clock.state.tick,
                });
            }

            // 6. Apply sanction — set frozen=1 in human_users (D-25b-NEW-4, D-25b-NEW-5).
            //    frozen column added in migration v12 (plan 07). NOT the banned column.
            await services.humanSanctionStore.setFrozen(targetDid);

            // 7. Emit operator.human_frozen — ONLY on success path (sole-producer invariant, Pitfall 4).
            appendOperatorHumanFrozen(services.audit, resolvedOperatorId, {
                tier: resolvedTier,
                action: 'freeze_wallet',
                operator_id: resolvedOperatorId,
                human_did: targetDid,
                tick: services.clock.state.tick,
                reason_hash: reasonHash,
            });

            // 8. Return success.
            return { ok: true };
        },
    );
}
