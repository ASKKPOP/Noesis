/**
 * Operator slash-coin: POST /api/v1/operator/nous/:did/slash.
 *
 * Phase 25b SANCTION-02 — H4 Moderator action (D-25b-NEW-1, D-25b-09).
 * Slashes a Nous by fining its wei balance to the commons.
 *
 * FINE→TREASURY STRATEGY (Phase 62.5-04):
 *   The slash always completes, even if the amount exceeds the current balance.
 *   Rationale: slash is punitive; blocking on insufficient funds would allow
 *   a Nous to evade sanctions by pre-spending its wallet. Ledger B (the legacy
 *   nous_registry.balance_wei) was retired, so the punitive debit now targets the
 *   target's real civic-keyed account (nous_accounts, Ledger A) and CREDITS
 *   civic_treasury — a fine to the commons. Money moves, never vanishes: this
 *   preserves the no-mint/no-burn conservation invariant. The clamp is intact —
 *   fine = min(amount, balance), so a slash beyond the balance takes only what is
 *   there (no 409). A target with no civic-DID / no account has no money to fine.
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
 * AMOUNT VALIDATION:
 *   amount must be a positive integer. Non-positive or non-integer → 400 invalid_amount.
 *
 * ERROR LADDER (no 500s):
 *   400 — malformed DID, x-operator-id header, or invalid amount (invalid_did / invalid_operator_id / invalid_amount)
 *   401 — tier_missing (x-operator-tier header absent / non-numeric)
 *   403 — tier_too_low (x-operator-tier < 4)
 *   404 — unknown Nous (no runner for DID)
 *   410 — tombstoned DID
 *   200 — success with { ok: true }
 *
 * SOLE-PRODUCER INVARIANT (Pitfall 4): appendOperatorSlashed is called EXACTLY
 * ONCE in this file, on the SUCCESS path only. Error paths MUST NOT emit.
 *
 * See: 25b-CONTEXT D-25b-07, D-25b-09, D-25b-11, D-25b-NEW-3.
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { DID_REGEX } from '../server.js';
import type { ApiError } from '../types.js';
import { tombstoneCheck, TombstonedDidError } from '../../registry/tombstone-check.js';
import { appendOperatorSlashed } from '../../audit/append-operator-slashed.js';
import { CivicDidStore } from '../../civic-registry/civic-did-store.js';
import { NousAccountStore } from '../../economy/nous-account-store.js';
import { createHash } from 'node:crypto';

interface SlashBody {
    amount?: unknown;  // must be positive integer; validated below
    reason?: unknown;  // plaintext; NEVER enters audit payload (D-25b-11)
}

export function registerSlashCoinRoute(app: FastifyInstance, services: GridServices): void {
    app.post<{ Params: { did: string }; Body: SlashBody }>(
        '/api/v1/operator/nous/:did/slash',
        async (req, reply) => {
            // 1. Tier gate — server-trusted operator context (set by the operator_only gate).
            const tier = req.didContext?.operatorTier ?? 0;
            if (tier < 4) {
                reply.code(403);
                return { error: 'tier_too_low' } satisfies ApiError;
            }
            const resolvedTier: 'H4' = 'H4';
            const resolvedOperatorId = req.didContext?.operatorId;
            if (!resolvedOperatorId) {
                reply.code(403);
                return { error: 'not_operator' } satisfies ApiError;
            }

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

            // 5. Amount validation — must be a positive integer.
            const rawAmount = req.body?.amount;
            if (!Number.isInteger(rawAmount) || (rawAmount as number) <= 0) {
                reply.code(400);
                return { error: 'invalid_amount' } satisfies ApiError;
            }
            const amount = rawAmount as number;

            // 6. Reason hash — SHA-256(plaintext). Plaintext stored in sanction_reasons; hash in audit.
            //    WR-02 fix: enforce minimum reason length server-side (UI minLength is bypassable).
            const reasonPlain = typeof req.body?.reason === 'string' ? req.body.reason : '';
            if (reasonPlain.length < 10) {
                reply.code(400);
                return { error: 'reason_required' } satisfies ApiError;
            }
            const reasonHash = createHash('sha256').update(reasonPlain).digest('hex');

            // 7. Persist reason plaintext to sanction_reasons table (fire-and-forget on DB absence).
            //    D-25b-11: plaintext stays Grid-side; only reason_hash crosses the audit boundary.
            if (services.sanctionReasonStore) {
                await services.sanctionReasonStore.insert({
                    reason_hash: reasonHash,
                    plaintext: reasonPlain,
                    operator_id: resolvedOperatorId,
                    event_type: 'operator.slashed',
                    target_did: targetDid,
                    tick: services.clock.state.tick,
                });
            }

            // 8a. WR-01 fix: re-check record presence before emitting to avoid a false
            //     audit event if the Nous was tombstoned between step 3 and here.
            if (services.registry) {
                const record = services.registry.get(targetDid);
                if (!record || (record as unknown as { status?: string }).status === 'deleted') {
                    reply.code(410);
                    return { error: 'gone' } satisfies ApiError;
                }
            }

            // 8b. Apply the sanction as a FINE to the commons (Phase 62.5-04). Ledger B
            //     (nous_registry.balance_wei) was retired, so the punitive debit now targets
            //     the target's real civic-keyed account (nous_accounts, Ledger A) and CREDITS
            //     civic_treasury — money moves, never vanishes (preserves the no-mint/no-burn
            //     conservation invariant). Punitive clamp is intact: fine = min(amount, balance),
            //     so a slash beyond the balance takes only what is there (never negative, no 409).
            //     Resolve the target existence-DID → civic-DID; if it has no civic-DID / no
            //     account (or no DB pool in tests), no money moves — the sanction still emits.
            if (services.pool) {
                const civic = await new CivicDidStore(services.pool).getByExistenceDid(services.gridName, targetDid);
                if (civic) {
                    const accounts = new NousAccountStore(services.pool);
                    const balance = await accounts.getBalance(services.gridName, civic.civicDid);
                    const requested = BigInt(amount);
                    const fine = requested < balance ? requested : balance;
                    if (fine > 0n) {
                        await accounts.chargeToTreasury({
                            gridName: services.gridName,
                            civicDid: civic.civicDid,
                            amountWei: fine,
                            currentTick: services.clock.state.tick,
                        });
                    }
                }
            }

            // 9. Emit operator.slashed — ONLY on success path (sole-producer invariant, Pitfall 4).
            appendOperatorSlashed(services.audit, resolvedOperatorId, {
                tier: resolvedTier,
                action: 'slash',
                operator_id: resolvedOperatorId,
                target_did: targetDid,
                tick: services.clock.state.tick,
                reason_hash: reasonHash,
                amount,
            });

            // 10. Return success.
            return { ok: true };
        },
    );
}
