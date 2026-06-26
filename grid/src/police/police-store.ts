/**
 * Phase 47 Police v3 (Plan 1 — POL-01/02). Complaint-driven enforcement: a Civic-DID
 * holder files a complaint; Police open an investigation. Raw DIDs are stored in the
 * tables; the audit chain carries only hashed DIDs (the sole-producer append functions).
 *
 * Constitutional: Police cannot sanction here — a complaint and an investigation carry
 * NO punitive power. Sanctions require Government conviction (Plan 2), never a Police-
 * direct or operator-direct path (D-V3-18).
 */
import { randomUUID, createHash } from 'node:crypto';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { AuditChain } from '../audit/chain.js';
import { appendPoliceComplaintFiled } from '../audit/append-police-complaint-filed.js';
import { appendPoliceInvestigationOpened } from '../audit/append-police-investigation-opened.js';
import { appendPoliceChargesFiled } from '../audit/append-police-charges-filed.js';
import { appendPoliceSanctionExecuted } from '../audit/append-police-sanction-executed.js';
import type { SanctionType } from './types.js';

const sha256Hex = (s: string): string => createHash('sha256').update(s).digest('hex');

export interface ComplaintRow {
    complaint_id: string; accused_civic_did: string; cited_law_id: string; status: string; filed_at_tick: number;
}
export interface ChargeRow {
    charge_id: string; investigation_id: string; accused_civic_did: string; alleged_law_id: string;
    recommended_sanction: SanctionType; status: string; gov_session_id: string | null;
}

export class PoliceStore {
    constructor(private readonly pool: Pool, private readonly audit: AuditChain) {}

    /** POL-01 — file a complaint. Inserts the row, emits police.complaint_filed (hashed
     *  DIDs), returns the complaint_id. */
    async fileComplaint(p: {
        gridName: string; complainantDid: string; accusedDid: string; citedLawId: string;
        evidenceChainHash: string; tick: number;
    }): Promise<string> {
        const complaintId = randomUUID();
        await this.pool.query(
            `INSERT INTO police_complaints
               (complaint_id, grid_name, complainant_civic_did, accused_civic_did, cited_law_id, evidence_chain_hash, status, filed_at_tick)
             VALUES (?, ?, ?, ?, ?, ?, 'filed', ?)`,
            [complaintId, p.gridName, p.complainantDid, p.accusedDid, p.citedLawId, p.evidenceChainHash, p.tick],
        );
        appendPoliceComplaintFiled(this.audit, {
            accused_did_hash: sha256Hex(p.accusedDid),
            cited_law_id: p.citedLawId,
            complainant_did_hash: sha256Hex(p.complainantDid),
            complaint_id: complaintId,
            evidence_chain_hash: p.evidenceChainHash,
            tick: p.tick,
        });
        return complaintId;
    }

    /** POL-02 — open an investigation from a complaint OR a marketplace dispute (exactly
     *  one). Inserts police_investigations, marks the complaint 'investigating', emits
     *  police.investigation_opened. Returns the investigation_id. */
    async openInvestigation(p: {
        gridName: string; complaintId?: string | null; disputeId?: string | null; tick: number;
    }): Promise<string> {
        const complaintId = p.complaintId ?? null;
        const disputeId = p.disputeId ?? null;
        if ((complaintId === null) === (disputeId === null)) {
            throw new Error('exactly one of complaintId / disputeId required');
        }
        const investigationId = randomUUID();
        const sourceType = complaintId !== null ? 'complaint' : 'marketplace_dispute';
        const sourceRef = (complaintId ?? disputeId) as string;
        await this.pool.query(
            `INSERT INTO police_investigations
               (investigation_id, grid_name, source_type, source_ref, status, opened_at_tick)
             VALUES (?, ?, ?, ?, 'open', ?)`,
            [investigationId, p.gridName, sourceType, sourceRef, p.tick],
        );
        if (complaintId !== null) {
            await this.pool.query(
                `UPDATE police_complaints SET status = 'investigating' WHERE grid_name = ? AND complaint_id = ? AND status = 'filed'`,
                [p.gridName, complaintId],
            );
        }
        appendPoliceInvestigationOpened(this.audit, {
            complaint_id: complaintId, dispute_id: disputeId, investigation_id: investigationId, tick: p.tick,
        });
        return investigationId;
    }

    /** Look up a complaint (for ownership / existence checks). */
    async getComplaint(gridName: string, complaintId: string): Promise<ComplaintRow | null> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT complaint_id, accused_civic_did, cited_law_id, status, filed_at_tick
               FROM police_complaints WHERE grid_name = ? AND complaint_id = ? LIMIT 1`,
            [gridName, complaintId],
        );
        const r = rows as unknown as ComplaintRow[];
        return r.length ? r[0] : null;
    }

    /** POL-03 — file formal charges with the Government court (after an investigation).
     *  Inserts police_charges (status 'filed'), emits police.charges_filed. Returns charge_id. */
    async fileCharges(p: {
        gridName: string; investigationId: string; accusedDid: string; allegedLawId: string;
        evidenceSummaryHash: string; recommendedSanction: SanctionType; tick: number;
    }): Promise<string> {
        const chargeId = randomUUID();
        await this.pool.query(
            `INSERT INTO police_charges
               (charge_id, grid_name, investigation_id, accused_civic_did, alleged_law_id, evidence_summary_hash, recommended_sanction, status, filed_at_tick)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'filed', ?)`,
            [chargeId, p.gridName, p.investigationId, p.accusedDid, p.allegedLawId, p.evidenceSummaryHash, p.recommendedSanction, p.tick],
        );
        appendPoliceChargesFiled(this.audit, {
            accused_did_hash: sha256Hex(p.accusedDid),
            alleged_law_id: p.allegedLawId,
            charge_id: chargeId,
            evidence_summary_hash: p.evidenceSummaryHash,
            investigation_id: p.investigationId,
            recommended_sanction: p.recommendedSanction,
            tick: p.tick,
        });
        return chargeId;
    }

    async getCharge(gridName: string, chargeId: string): Promise<ChargeRow | null> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT charge_id, investigation_id, accused_civic_did, alleged_law_id, recommended_sanction, status, gov_session_id
               FROM police_charges WHERE grid_name = ? AND charge_id = ? LIMIT 1`,
            [gridName, chargeId],
        );
        const r = rows as unknown as ChargeRow[];
        return r.length ? r[0] : null;
    }

    /** Government conviction (or acquittal). Called only from the government_only route.
     *  Marks the charge; NO broadcast event (a Government decision, not a Police act). */
    async resolveCharge(gridName: string, chargeId: string, convicted: boolean, govSessionId: string, tick: number): Promise<void> {
        await this.pool.query(
            `UPDATE police_charges SET status = ?, gov_session_id = ?, resolved_at_tick = ?
               WHERE grid_name = ? AND charge_id = ? AND status = 'filed'`,
            [convicted ? 'convicted' : 'acquitted', govSessionId, tick, gridName, chargeId],
        );
    }

    /** POL-04 — record an executed sanction (the material effect — freeze/fine — is applied
     *  by the route BEFORE this call). Inserts police_sanctions, marks the charge 'executed',
     *  emits police.sanction_executed. Returns sanction_id. The caller MUST have verified the
     *  charge is 'convicted'. */
    async recordSanction(p: {
        gridName: string; chargeId: string; accusedDid: string; sanctionType: SanctionType;
        durationTicks?: number | null; communityId?: string | null; amountWei?: bigint | null; tick: number;
    }): Promise<string> {
        const sanctionId = randomUUID();
        await this.pool.query(
            `INSERT INTO police_sanctions
               (sanction_id, grid_name, charge_id, accused_civic_did, sanction_type, duration_ticks, community_id, amount_wei, executed_at_tick)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [sanctionId, p.gridName, p.chargeId, p.accusedDid, p.sanctionType,
             p.durationTicks ?? null, p.communityId ?? null, p.amountWei != null ? p.amountWei.toString() : null, p.tick],
        );
        await this.pool.query(
            `UPDATE police_charges SET status = 'executed', resolved_at_tick = ? WHERE grid_name = ? AND charge_id = ?`,
            [p.tick, p.gridName, p.chargeId],
        );
        appendPoliceSanctionExecuted(this.audit, {
            accused_did_hash: sha256Hex(p.accusedDid),
            charge_id: p.chargeId,
            sanction_id: sanctionId,
            sanction_type: p.sanctionType,
            tick: p.tick,
        });
        return sanctionId;
    }

    /** List complaints, newest first — optionally filtered by accused DID or status. */
    async listComplaints(gridName: string, opts: { accusedDid?: string; status?: string } = {}): Promise<ComplaintRow[]> {
        const where = ['grid_name = ?']; const params: unknown[] = [gridName];
        if (opts.accusedDid) { where.push('accused_civic_did = ?'); params.push(opts.accusedDid); }
        if (opts.status) { where.push('status = ?'); params.push(opts.status); }
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT complaint_id, accused_civic_did, cited_law_id, status, filed_at_tick
               FROM police_complaints WHERE ${where.join(' AND ')} ORDER BY filed_at_tick DESC LIMIT 100`,
            params,
        );
        return rows as unknown as ComplaintRow[];
    }
}
