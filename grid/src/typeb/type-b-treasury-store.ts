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
import { ENDOWMENT_RUNWAY_MONTHS, REVIVAL_THRESHOLD_BIOS } from './types.js';

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
}
