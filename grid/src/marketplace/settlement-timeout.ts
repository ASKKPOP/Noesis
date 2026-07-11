/**
 * Phase 44 D-44-05b — Settlement Timeout Sweep.
 *
 * Identifies escrow rows where accepted_at_tick + market_settlement_timeout_ticks < currentTick
 * and escrow_status='held'. For each, auto-disputes on buyer's behalf, freezes escrow,
 * inserts police_investigations row, emits market.disputed audit event.
 *
 * Default timeout: 7 ticks (grid_config key 'market_settlement_timeout_ticks').
 *
 * MUST be called from setInterval in launcher.start(), NOT clock.onTick
 * (single-onTick-subscription constraint per launcher.ts line 461 comment).
 *
 * Revision iter 1: moved here from Plan 02 to satisfy depends_on chain — imports
 * appendMarketDisputed which is created in Plan 03 (parallel wave 1 with old Plan 02).
 */
import type { Pool } from 'mysql2/promise';
import { randomUUID, createHash } from 'node:crypto';
import type { AuditChain } from '../audit/chain.js';
import { appendMarketDisputed } from '../audit/append-market-disputed.js';
import { MarketplaceStore } from './marketplace-store.js';
import { logger } from '../util/logger.js';

const DEFAULT_TIMEOUT_TICKS = 7;

function sha256Hex(input: string): string {
    return createHash('sha256').update(input).digest('hex');
}

/**
 * Sweep open escrow rows whose settlement window has expired.
 *
 * For each expired escrow (accepted_at_tick + timeoutTicks < currentTick):
 *  1. Calls store.dispute() — freezes escrow + inserts marketplace_disputes row (DB tx).
 *  2. Emits market.disputed audit event AFTER DB commit (Pitfall 4 from RESEARCH.md).
 *  3. Inserts a police_investigations row directly (no HTTP self-call — T-44-04-08).
 *
 * Idempotent: if escrow is already 'frozen' (dispute already filed), dispute() throws
 * 'escrow_not_disputable' — caught and skipped silently.
 *
 * Returns {disputed, errors} for test/observability.
 */
export async function checkSettlementTimeouts(
    pool: Pool,
    audit: AuditChain,
    currentTick: number,
    gridName: string,
): Promise<{ disputed: number; errors: number }> {
    const log = logger.child({ module: 'settlement-timeout', tick: currentTick });
    const store = new MarketplaceStore(pool);

    // Read configured timeout OUTSIDE any transaction (Pitfall 1 from RESEARCH.md).
    const raw = await store.getConfigValue(gridName, 'market_settlement_timeout_ticks');
    const parsed = raw !== null ? Number.parseInt(raw, 10) : DEFAULT_TIMEOUT_TICKS;
    const effectiveTimeout = Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_TICKS;
    if (raw !== null && (!Number.isInteger(parsed) || parsed <= 0)) {
        log.warn({ raw, parsed }, 'invalid_market_settlement_timeout_ticks_using_default');
    }

    const expired = await store.listExpiredEscrows({
        gridName,
        currentTick,
        timeoutTicks: effectiveTimeout,
    });
    if (expired.length === 0) return { disputed: 0, errors: 0 };

    let disputed = 0;
    let errors = 0;

    for (const e of expired) {
        try {
            // Auto-dispute on buyer's behalf (buyer is the at-risk party — they paid into escrow).
            // WR-03 STRANDED-WEI INVARIANT: this only freezes the escrow (escrow_status via dispute)
            // and opens a Police investigation — it does NOT refund the buyer. The buyer's wei stays
            // debited-into-escrow (conserved, never minted/burned) until the Phase 47 Police pipeline
            // adjudicates a settle-or-refund. `escrow_status='refunded'` + buyer credit-back is
            // intentionally UNIMPLEMENTED here (see marketplace-store.acceptBid debit site) — a blind
            // timeout refund could wrongly reverse a delivered trade. DO NOT auto-refund before Phase 47.
            const { disputeId } = await store.dispute({
                gridName,
                listingId: e.listingId,
                complainantCivicDid: e.buyerCivicDid,
                currentTick,
            });

            // Emit market.disputed audit event AFTER DB commit (Pitfall 4).
            appendMarketDisputed(audit, {
                complainant_civic_did_hash: sha256Hex(e.buyerCivicDid),
                dispute_id: disputeId,
                listing_id: e.listingId,
                tick: currentTick,
            });

            // Insert police investigation row directly (T-44-04-08: no HTTP self-call).
            const investigationId = randomUUID();
            await pool.query(
                `INSERT INTO police_investigations
                    (investigation_id, grid_name, source_type, source_ref, status, opened_at_tick)
                 VALUES (?, ?, 'marketplace_dispute', ?, 'pending', ?)`,
                [investigationId, gridName, disputeId, currentTick],
            );

            disputed += 1;
            log.info({
                listing_id: e.listingId,
                dispute_id: disputeId,
                investigation_id: investigationId,
            }, 'settlement_timeout_auto_disputed');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'unknown';
            // Idempotent: already disputed or escrow gone — skip silently.
            if (message === 'escrow_not_disputable' || message === 'escrow_not_found') {
                log.debug({ listing_id: e.listingId, reason: message }, 'settlement_timeout_skip');
            } else {
                errors += 1;
                log.warn({ listing_id: e.listingId, err: message }, 'settlement_timeout_error');
            }
        }
    }

    return { disputed, errors };
}
