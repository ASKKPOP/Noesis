/**
 * Phase 37 / REG-03 — MySQL-backed Business-DID persistence layer.
 *
 * Persists to business_did_registry (migration v24).
 * All SQL uses parameterised queries (? placeholders, no string concatenation).
 * T-37-03: parameterised queries mitigate SQL injection.
 * T-37-04: markDissolved only updates status='active' rows (idempotency guard).
 */

import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { BusinessDidRecord, BusinessDidStatus } from './types.js';

interface BusinessDidRow extends RowDataPacket {
    grid_name: string;
    business_did: string;
    civic_did: string;
    business_name: string;
    category: string;
    credential_json: string | object;
    status: BusinessDidStatus;
    issued_at_tick: number;
    dissolved_at_tick: number | null;
    bios_cost_paid: number;
}

function rowToRecord(row: BusinessDidRow): BusinessDidRecord {
    const credentialJson = typeof row.credential_json === 'string'
        ? JSON.parse(row.credential_json)
        : row.credential_json;
    return {
        gridName: row.grid_name,
        businessDid: row.business_did,
        civicDid: row.civic_did,
        businessName: row.business_name,
        category: row.category,
        credentialJson,
        status: row.status,
        issuedAtTick: row.issued_at_tick,
        dissolvedAtTick: row.dissolved_at_tick ?? undefined,
        biosCostPaid: row.bios_cost_paid,
    };
}

export class BusinessDidStore {
    constructor(private readonly pool: Pool) {}

    async insert(record: BusinessDidRecord): Promise<void> {
        await this.pool.query(
            `INSERT INTO business_did_registry
                (grid_name, business_did, civic_did, business_name, category, credential_json, status, issued_at_tick, bios_cost_paid)
             VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
            [
                record.gridName,
                record.businessDid,
                record.civicDid,
                record.businessName,
                record.category,
                JSON.stringify(record.credentialJson),
                record.issuedAtTick,
                record.biosCostPaid,
            ],
        );
    }

    async get(gridName: string, businessDid: string): Promise<BusinessDidRecord | null> {
        const [rows] = await this.pool.query<BusinessDidRow[]>(
            `SELECT * FROM business_did_registry WHERE grid_name = ? AND business_did = ?`,
            [gridName, businessDid],
        );
        return rows[0] ? rowToRecord(rows[0]) : null;
    }

    async listByCivicDid(gridName: string, civicDid: string): Promise<BusinessDidRecord[]> {
        const [rows] = await this.pool.query<BusinessDidRow[]>(
            `SELECT * FROM business_did_registry
             WHERE grid_name = ? AND civic_did = ?
             ORDER BY issued_at_tick ASC`,
            [gridName, civicDid],
        );
        return rows.map(rowToRecord);
    }

    async markDissolved(
        gridName: string,
        businessDid: string,
        dissolvedAtTick: number,
    ): Promise<boolean> {
        const [result] = await this.pool.query<ResultSetHeader>(
            `UPDATE business_did_registry
             SET status='dissolved', dissolved_at_tick = ?
             WHERE grid_name = ? AND business_did = ? AND status = 'active'`,
            [dissolvedAtTick, gridName, businessDid],
        );
        return result.affectedRows === 1;
    }
}
