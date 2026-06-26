/**
 * Phase 51 Type Mobility (Plan 1) — abandon + adopt. The abandoning operator is the human
 * who owns the Nous (the Join-a-Grid nous_sponsors pairing); on adoption the ownership is
 * transferred to the new human and the Nous stays Type A. Raw DIDs in the tables; the audit
 * chain carries only hashes (the sole-producer append functions).
 */
import { createHash } from 'node:crypto';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { AuditChain } from '../audit/chain.js';
import { appendMobilityOperatorAbandoned } from '../audit/append-mobility-operator-abandoned.js';
import { appendMobilityAdoptionAttempted } from '../audit/append-mobility-adoption-attempted.js';
import { appendMobilityAdoptionSucceeded } from '../audit/append-mobility-adoption-succeeded.js';
import { appendMobilityConvertedToTypeB } from '../audit/append-mobility-converted-to-type-b.js';
import { appendMobilityDormancyEntered } from '../audit/append-mobility-dormancy-entered.js';
import { autoTypeBCivicDid } from './types.js';

const sha256Hex = (s: string): string => createHash('sha256').update(s).digest('hex');

export interface MobilityRow {
    nous_did: string; status: string; abandoned_by_human_did: string; window_end_tick: number;
}

export class MobilityStore {
    constructor(private readonly pool: Pool, private readonly audit: AuditChain) {}

    /** The owning operator declares it will stop hosting → open the adoption window. */
    async abandon(p: { gridName: string; nousDid: string; operatorDid: string; windowEndTick: number; tick: number }): Promise<void> {
        await this.pool.query(
            `INSERT INTO mobility_records (grid_name, nous_did, status, abandoned_by_human_did, abandoned_tick, window_end_tick)
             VALUES (?, ?, 'adoption_pending', ?, ?, ?)
             ON DUPLICATE KEY UPDATE status = 'adoption_pending', abandoned_by_human_did = VALUES(abandoned_by_human_did),
               abandoned_tick = VALUES(abandoned_tick), window_end_tick = VALUES(window_end_tick), adopted_by_human_did = NULL, resolved_tick = NULL`,
            [p.gridName, p.nousDid, p.operatorDid, p.tick, p.windowEndTick],
        );
        appendMobilityOperatorAbandoned(this.audit, {
            nous_did_hash: sha256Hex(p.nousDid), operator_did_hash: sha256Hex(p.operatorDid), tick: p.tick, window_end_tick: p.windowEndTick,
        });
    }

    async getRecord(gridName: string, nousDid: string): Promise<MobilityRow | null> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT nous_did, status, abandoned_by_human_did, window_end_tick FROM mobility_records WHERE grid_name = ? AND nous_did = ? LIMIT 1`,
            [gridName, nousDid],
        );
        const r = rows as unknown as MobilityRow[];
        return r.length ? r[0] : null;
    }

    /** Adopt an abandoned Nous. ALWAYS emits mobility.adoption_attempted (transparency).
     *  On success (record pending + within window) it transfers ownership in nous_sponsors,
     *  marks the record adopted, and emits mobility.adoption_succeeded. Returns the outcome. */
    async adopt(p: { gridName: string; nousDid: string; adopterDid: string; tick: number }): Promise<{ ok: true } | { ok: false; reason: 'not_adoptable' | 'window_expired' | 'forbidden_in_v3.0' }> {
        appendMobilityAdoptionAttempted(this.audit, { adopter_did_hash: sha256Hex(p.adopterDid), nous_did_hash: sha256Hex(p.nousDid), tick: p.tick });
        const rec = await this.getRecord(p.gridName, p.nousDid);
        // B→A is blocked (D-V3-28): a converted Type B Nous can never be adopted back to Type A.
        if (rec && rec.status === 'converted') return { ok: false, reason: 'forbidden_in_v3.0' };
        if (!rec || rec.status !== 'adoption_pending') return { ok: false, reason: 'not_adoptable' };
        if (p.tick > rec.window_end_tick) return { ok: false, reason: 'window_expired' };

        // Transfer ownership: drop the abandoning operator's pairing, seat the adopter.
        await this.pool.query(`DELETE FROM nous_sponsors WHERE grid_name = ? AND human_did = ? AND nous_did = ?`, [p.gridName, rec.abandoned_by_human_did, p.nousDid]);
        await this.pool.query(
            `INSERT INTO nous_sponsors (grid_name, human_did, nous_did, created_at) VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE created_at = VALUES(created_at)`,
            [p.gridName, p.adopterDid, p.nousDid, p.tick],
        );
        await this.pool.query(
            `UPDATE mobility_records SET status = 'adopted', adopted_by_human_did = ?, resolved_tick = ? WHERE grid_name = ? AND nous_did = ?`,
            [p.adopterDid, p.tick, p.gridName, p.nousDid],
        );
        appendMobilityAdoptionSucceeded(this.audit, { adopter_did_hash: sha256Hex(p.adopterDid), nous_did_hash: sha256Hex(p.nousDid), tick: p.tick });
        return { ok: true };
    }

    /** Window expired with no adopter → convert to Foundation-hosted Type B. The Existence-DID
     *  is preserved; a new auto Civic-DID is issued; the Nous enters dormancy awaiting its Type B
     *  endowment. Emits mobility.converted_to_type_b + mobility.dormancy_entered. Returns the new
     *  Civic-DID, or null if the record isn't an expired pending abandonment. */
    async convertToTypeB(p: { gridName: string; nousDid: string; tick: number }): Promise<string | null> {
        const rec = await this.getRecord(p.gridName, p.nousDid);
        if (!rec || rec.status !== 'adoption_pending' || p.tick <= rec.window_end_tick) return null;
        const autoCivicDid = autoTypeBCivicDid(p.nousDid, sha256Hex(p.nousDid).slice(0, 16));
        await this.pool.query(
            `UPDATE mobility_records SET status = 'converted', resolved_tick = ? WHERE grid_name = ? AND nous_did = ?`,
            [p.tick, p.gridName, p.nousDid],
        );
        appendMobilityConvertedToTypeB(this.audit, { auto_civic_did_hash: sha256Hex(autoCivicDid), nous_did_hash: sha256Hex(p.nousDid), tick: p.tick });
        appendMobilityDormancyEntered(this.audit, { nous_did_hash: sha256Hex(p.nousDid), tick: p.tick });
        return autoCivicDid;
    }
}
