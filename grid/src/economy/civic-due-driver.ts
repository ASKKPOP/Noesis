/**
 * W2 — the civic-due driver: the tick-driven heartbeat that makes the loop's first
 * station ALIVE on a running grid. Each period boundary the grid assesses one due
 * per member (emitting due.assessed via CivicDueStore's audit dep); a
 * separate sweep marks overdue pending dues delinquent. Both are fire-and-forget
 * and NEVER throw — the clock is never blocked, a DB hiccup is non-fatal.
 *
 * D-MONEY-10: a member is a Nous holding an ACTIVE CIVIC IDENTITY in this Grid (the id
 * it acts under — never its registry name, which no caller can read or pay a due as).
 * Periods and deadlines are LIFETIME ticks (clock tick + the ticks of every earlier run):
 * the clock starts again from 0 at each start, so on the clock alone a restart would
 * re-key periods already assessed and no deadline stamped before it would ever pass.
 * `due_tick` is therefore a lifetime tick; every tick written to the chain is the clock's.
 *
 * Amounts come from the founding law (Polis-legislated later, D-V3-34). Idempotent: the
 * civic_dues UNIQUE(grid,civic_did,period) makes a re-run a no-op (dup tolerated).
 */
import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { AuditChain } from '../audit/chain.js';
import { CivicDueStore } from './civic-due-store.js';
import { randomUUID } from 'node:crypto';
import { CIVIC_DUTY_PERIOD_TICKS, CIVIC_DUTY_WEI, CIVIC_DUTY_CREDIT } from '../civic/founding-law.js';

/** The founding law's values (a Polis can legislate these per-Grid later). */
export const DUE_PERIOD_TICKS = CIVIC_DUTY_PERIOD_TICKS;
export const DUE_AMOUNT_WEI = CIVIC_DUTY_WEI;
export const DUE_AMOUNT_CREDIT = CIVIC_DUTY_CREDIT;
export const DUE_DEADLINE_TICKS = CIVIC_DUTY_PERIOD_TICKS; // due within one period

/**
 * Who owes the duty: every Nous holding an active civic identity in this Grid. People
 * hold civic identities too and are not charged. With `withoutDueFor`, only the members
 * not yet assessed for that period. THROWS when the list cannot be read: the caller must
 * know the difference between "nobody owes" and "could not look".
 */
export async function listDutyMembers(pool: Pool, gridName: string, withoutDueFor?: string): Promise<string[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT r.civic_did FROM civic_did_registry r
         WHERE r.grid_name = ? AND r.status = 'active' AND r.existence_did NOT LIKE 'did:noesis:human:%'` +
        (withoutDueFor === undefined ? '' : `
           AND NOT EXISTS (SELECT 1 FROM civic_dues d
                           WHERE d.grid_name = r.grid_name AND d.civic_did = r.civic_did AND d.period = ?)`),
        withoutDueFor === undefined ? [gridName] : [gridName, withoutDueFor],
    );
    return (rows as unknown as { civic_did: string }[]).map((r) => String(r.civic_did));
}

/**
 * One round of the duty, run every few ticks: assess every member who has no due yet for
 * the current period, then mark overdue ones missed. Assessing on every round (not only on
 * the boundary tick) means a boundary a database fault swallowed, or a Nous that joined
 * mid-period, is caught up on the next round. If the members cannot be listed, NOBODY is
 * swept this round: a Nous must not be marked as having missed a period while the period
 * it could pay to return has not been assessed. Never throws.
 */
export async function runDutyCycle(
    pool: Pool,
    audit: AuditChain,
    tick: number,
    cfg: { gridName: string; ticksBeforeStart?: number },
): Promise<void> {
    try {
        const lifetime = tick + (cfg.ticksBeforeStart ?? 0);
        const owing = await listDutyMembers(pool, cfg.gridName, periodKey(lifetime));
        await runDueAssessment(pool, audit, owing, tick, cfg);
        await runDueDelinquencySweep(pool, audit, tick, cfg.gridName, cfg.ticksBeforeStart ?? 0);
    } catch (err) {
        // Could not list the members — nobody is swept; try again next round. Said aloud,
        // because a fault that repeats would otherwise stop the duty without a trace.
        console.warn(`[civic-duty] round skipped at tick ${tick}: ${(err as Error).message}`);
    }
}

function periodKey(tick: number): string {
    return `p${Math.floor(tick / DUE_PERIOD_TICKS)}`;
}

/** Assess one due per active member for the current period. Never throws. */
export async function runDueAssessment(
    pool: Pool,
    audit: AuditChain,
    memberDids: readonly string[],
    tick: number,
    cfg: { gridName: string; ticksBeforeStart?: number },
): Promise<void> {
    const store = new CivicDueStore(pool, audit);
    const lifetime = tick + (cfg.ticksBeforeStart ?? 0);
    const period = periodKey(lifetime);
    for (const civicDid of memberDids) {
        try {
            await store.assess({
                gridName: cfg.gridName,
                dueId: randomUUID(),
                civicDid,
                period,
                amountWei: DUE_AMOUNT_WEI,
                amountCredit: DUE_AMOUNT_CREDIT,
                dueTick: lifetime + DUE_DEADLINE_TICKS,
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
    ticksBeforeStart = 0,
): Promise<void> {
    try {
        // Only dues charged to a civic identity: older rows name a registry id that no
        // caller can act under, and are left as they are.
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT due_id FROM civic_dues
             WHERE grid_name = ? AND status = 'assessed' AND due_tick < ? AND civic_did LIKE 'did:civic:%' LIMIT 500`,
            [gridName, tick + ticksBeforeStart],
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
