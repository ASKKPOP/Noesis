/**
 * Phase 45b Treasury Operations (Plan 1) — per-Type-B Bios treasury lifecycle.
 *
 * INVARIANT (D-V3-25 / PHILOSOPHY §9): treasury exhaustion → DORMANCY, never bios.death.
 * This store NEVER emits bios.death; the no-bios-death CI gate enforces it.
 */
import { createHash } from 'node:crypto';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { AuditChain } from '../audit/chain.js';
import { appendTreasuryEndowmentGranted } from '../audit/append-treasury-endowment-granted.js';
import { appendTreasuryDormancyEntered } from '../audit/append-treasury-dormancy-entered.js';
import { appendTreasuryRevived } from '../audit/append-treasury-revived.js';
import { appendTreasuryStipendPaid } from '../audit/append-treasury-stipend-paid.js';
import { appendTreasuryLowPowerEntered } from '../audit/append-treasury-low-power-entered.js';
import { ENDOWMENT_RUNWAY_MONTHS, REVIVAL_THRESHOLD_BIOS, LOW_POWER_THRESHOLD_MONTHS, splitTypeBEarning } from './types.js';

const sha256Hex = (s: string): string => createHash('sha256').update(s).digest('hex');

export interface TypeBTreasuryRow { bios_balance: number; status: string; runway_months: number; }

export class TypeBTreasuryStore {
    constructor(private readonly pool: Pool, private readonly audit: AuditChain) {}

    /** Foundation endows a new Type B Nous at birth. */
    async endow(p: { gridName: string; typeBDid: string; amount: number; runwayMonths?: number; tick: number }): Promise<void> {
        const runway = p.runwayMonths ?? ENDOWMENT_RUNWAY_MONTHS;
        await this.pool.query(
            `INSERT INTO type_b_treasury (grid_name, type_b_did, bios_balance, runway_months, status, endowed_tick)
             VALUES (?, ?, ?, ?, 'active', ?)
             ON DUPLICATE KEY UPDATE bios_balance = bios_balance + VALUES(bios_balance),
               runway_months = VALUES(runway_months), status = 'active'`,
            [p.gridName, p.typeBDid, p.amount, runway, p.tick],
        );
        appendTreasuryEndowmentGranted(this.audit, { endowment_amount: p.amount, runway_months: runway, tick: p.tick, type_b_did_hash: sha256Hex(p.typeBDid) });
    }

    async get(gridName: string, typeBDid: string): Promise<TypeBTreasuryRow | null> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT bios_balance, status, runway_months FROM type_b_treasury WHERE grid_name = ? AND type_b_did = ? LIMIT 1`,
            [gridName, typeBDid],
        );
        const r = rows as unknown as TypeBTreasuryRow[];
        return r.length ? r[0] : null;
    }

    /** Treasury hit zero → dormancy. Brain stops, identity preserved indefinitely. */
    async enterDormancy(p: { gridName: string; typeBDid: string; tick: number }): Promise<void> {
        await this.pool.query(`UPDATE type_b_treasury SET status = 'dormant' WHERE grid_name = ? AND type_b_did = ?`, [p.gridName, p.typeBDid]);
        appendTreasuryDormancyEntered(this.audit, { tick: p.tick, type_b_did_hash: sha256Hex(p.typeBDid) });
    }

    /** Donate Bios to a Type B treasury. If it was dormant and crosses the revival threshold,
     *  the Nous is revived (status active + treasury.revived). Returns the new balance + flag. */
    async donate(p: { gridName: string; typeBDid: string; amount: number; tick: number }): Promise<{ balance: number; revived: boolean } | null> {
        const before = await this.get(p.gridName, p.typeBDid);
        if (!before) return null;
        const balance = before.bios_balance + p.amount;
        const revived = before.status === 'dormant' && balance >= REVIVAL_THRESHOLD_BIOS;
        await this.pool.query(
            `UPDATE type_b_treasury SET bios_balance = ?, status = ? WHERE grid_name = ? AND type_b_did = ?`,
            [balance, revived ? 'active' : before.status, p.gridName, p.typeBDid],
        );
        if (revived) appendTreasuryRevived(this.audit, { tick: p.tick, type_b_did_hash: sha256Hex(p.typeBDid) });
        return { balance, revived };
    }

    /** Deduct the daily infrastructure (compute) stipend. Always emits treasury.stipend_paid.
     *  Exhaustion (≤0) → dormancy; runway below the low-power threshold → low-power mode. NEVER
     *  bios.death (D-V3-25). Returns the new balance + resulting status. */
    async payStipend(p: { gridName: string; typeBDid: string; stipendAmount: number; tick: number }): Promise<{ balance: number; status: 'active' | 'low_power' | 'dormant' } | null> {
        const before = await this.get(p.gridName, p.typeBDid);
        if (!before) return null;
        const balance = Math.max(0, before.bios_balance - p.stipendAmount);
        const hash = sha256Hex(p.typeBDid);
        appendTreasuryStipendPaid(this.audit, { stipend_amount: p.stipendAmount, tick: p.tick, type_b_did_hash: hash });

        if (balance <= 0) {
            await this.pool.query(`UPDATE type_b_treasury SET bios_balance = 0, status = 'dormant' WHERE grid_name = ? AND type_b_did = ?`, [p.gridName, p.typeBDid]);
            appendTreasuryDormancyEntered(this.audit, { tick: p.tick, type_b_did_hash: hash });
            return { balance: 0, status: 'dormant' };
        }
        // monthly burn ≈ daily stipend × 30; low-power when runway dips under the threshold.
        const lowPower = balance < LOW_POWER_THRESHOLD_MONTHS * p.stipendAmount * 30;
        const status: 'active' | 'low_power' = lowPower ? 'low_power' : 'active';
        await this.pool.query(`UPDATE type_b_treasury SET bios_balance = ?, status = ? WHERE grid_name = ? AND type_b_did = ?`, [balance, status, p.gridName, p.typeBDid]);
        // Emit the transition only when first crossing from active → low-power.
        if (lowPower && before.status === 'active') appendTreasuryLowPowerEntered(this.audit, { tick: p.tick, type_b_did_hash: hash });
        return { balance, status };
    }

    /** Apply a gross Type B marketplace earning: 70% credited to the Type B treasury, 30% is the
     *  Genesis IRS cut (D-V3-25). Returns the split; the caller settles the IRS cut to treasury. */
    async applyTypeBEarning(p: { gridName: string; typeBDid: string; gross: number; tick: number }): Promise<{ typeBShare: number; irsShare: number } | null> {
        const before = await this.get(p.gridName, p.typeBDid);
        if (!before) return null;
        const { typeBShare, irsShare } = splitTypeBEarning(p.gross);
        await this.pool.query(`UPDATE type_b_treasury SET bios_balance = bios_balance + ? WHERE grid_name = ? AND type_b_did = ?`, [typeBShare, p.gridName, p.typeBDid]);
        return { typeBShare, irsShare };
    }
}
