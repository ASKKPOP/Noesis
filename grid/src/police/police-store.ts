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

const sha256Hex = (s: string): string => createHash('sha256').update(s).digest('hex');

export interface ComplaintRow {
    complaint_id: string; accused_civic_did: string; cited_law_id: string; status: string; filed_at_tick: number;
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
