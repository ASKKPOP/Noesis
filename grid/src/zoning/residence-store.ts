/**
 * Phase 57 Grid Zoning (Plan 2) — residential slot assignment. A new Civic-DID is given a
 * residence in the Residential zone (deterministic id) and zoning.residence_assigned fires.
 * Phase 54 calls this on issuance; idempotent per (grid, civic_did).
 */
import { createHash } from 'node:crypto';
import type { Pool } from 'mysql2/promise';
import type { AuditChain } from '../audit/chain.js';
import { appendZoningResidenceAssigned } from '../audit/append-zoning-residence-assigned.js';

const sha256Hex = (s: string): string => createHash('sha256').update(s).digest('hex');

export class ResidenceStore {
    constructor(private readonly pool: Pool, private readonly audit: AuditChain) {}

    /** Assign (or re-confirm) a residential slot for a Civic-DID. Returns the residence id. */
    async assignResidence(p: { gridName: string; civicDid: string; tick: number }): Promise<{ residenceId: string }> {
        const residenceId = `res-${sha256Hex(p.civicDid).slice(0, 12)}`;
        await this.pool.query(
            `INSERT INTO residence_assignments (grid_name, civic_did, residence_id, assigned_tick) VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE residence_id = VALUES(residence_id)`,
            [p.gridName, p.civicDid, residenceId, p.tick],
        );
        appendZoningResidenceAssigned(this.audit, { civic_did_hash: sha256Hex(p.civicDid), residence_id: residenceId, tick: p.tick });
        return { residenceId };
    }
}
