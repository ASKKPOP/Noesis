/**
 * W2 — the civic-due driver: the tick-driven heartbeat that makes the loop's first
 * station ALIVE on a running grid. Each period boundary the grid assesses one due
 * per active member (emitting due.assessed via CivicDueStore's audit dep); a
 * separate sweep marks overdue pending dues delinquent. Both are fire-and-forget
 * and NEVER throw — the clock is never blocked, a DB hiccup is non-fatal.
 *
 * Model-first amounts (Polis-legislated later, D-V3-34). Idempotent: the
 * civic_dues UNIQUE(grid,civic_did,period) makes a re-run a no-op (dup tolerated).
 */
import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { AuditChain } from '../audit/chain.js';
import { CivicDueStore } from './civic-due-store.js';
import { randomUUID } from 'node:crypto';

/** Model-first defaults (a Polis can legislate these per-Grid later). */
export const DUE_PERIOD_TICKS = 10_080;           // ~1 week at 1 tick/min
export const DUE_AMOUNT_WEI = 1_000_000_000_000n; // 1e12 wei (model-first)
export const DUE_AMOUNT_CREDIT = 10n;              // 10 civic-labor credits
export const DUE_DEADLINE_TICKS = 10_080;          // due within one period

function periodKey(tick: number): string {
    return `p${Math.floor(tick / DUE_PERIOD_TICKS)}`;
}

/** Assess one due per active member for the current period. Never throws. */
export async function runDueAssessment(
    pool: Pool,
    audit: AuditChain,
    memberDids: readonly string[],
    tick: number,
    cfg: { gridName: string },
): Promise<void> {
    const store = new CivicDueStore(pool, audit);
    const period = periodKey(tick);
    for (const civicDid of memberDids) {
        try {
            await store.assess({
                gridName: cfg.gridName,
                dueId: randomUUID(),
                civicDid,
                period,
                amountWei: DUE_AMOUNT_WEI,
                amountCredit: DUE_AMOUNT_CREDIT,
                dueTick: tick + DUE_DEADLINE_TICKS,
                currentTick: tick,
            });
        } catch {
            // Duplicate (already assessed this period) or transient error — non-fatal.
        }
    }
}

/** Mark pending dues past their deadline delinquent. Never throws. */
export async function runDueDelinquencySweep(
    pool: Pool,
    audit: AuditChain,
    tick: number,
    gridName: string,
): Promise<void> {
    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT due_id FROM civic_dues WHERE grid_name = ? AND status = 'assessed' AND due_tick < ? LIMIT 500`,
            [gridName, tick],
        );
        const store = new CivicDueStore(pool, audit);
        for (const r of rows as unknown as { due_id: string }[]) {
            try {
                await store.markDelinquent({ gridName, dueId: r.due_id, currentTick: tick });
            } catch {
                /* already resolved / transient — non-fatal */
            }
        }
    } catch {
        // SELECT failed (DB hiccup) — non-fatal; next sweep retries.
    }
}
