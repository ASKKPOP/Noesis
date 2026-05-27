/**
 * Phase 37 / REG-01..04 — MySQL-backed Civic-DID persistence layer.
 *
 * Persists to civic_did_registry (migration v23).
 * All SQL uses parameterised queries (? placeholders, no string concatenation).
 * T-37-03: parameterised queries mitigate SQL injection.
 * T-37-04: markRevoked only updates status='active' rows (idempotency guard).
 */

import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { CivicDidRecord, CivicDidStatus } from './types.js';

interface CivicDidRow extends RowDataPacket {
    grid_name: string;
    civic_did: string;
    existence_did: string;
    credential_json: string | object;
    status: CivicDidStatus;
    issued_at_tick: number;
    revoked_at_tick: number | null;
    court_conviction_ref: string | null;
    presence_status?: 'awake' | 'away' | 'absent' | 'presumed_departed';
    last_seen_at?: Date | null;
    last_seen_tick?: number | null;
    away_grace_expires_at?: Date | null;
    frozen?: 0 | 1;
}

function rowToRecord(row: CivicDidRow): CivicDidRecord {
    const credentialJson = typeof row.credential_json === 'string'
        ? JSON.parse(row.credential_json)
        : row.credential_json;
    return {
        gridName: row.grid_name,
        civicDid: row.civic_did,
        existenceDid: row.existence_did,
        credentialJson,
        status: row.status,
        issuedAtTick: row.issued_at_tick,
        revokedAtTick: row.revoked_at_tick ?? undefined,
        courtConvictionRef: row.court_conviction_ref ?? undefined,
        presenceStatus: row.presence_status,
        lastSeenAt: row.last_seen_at ?? null,
        lastSeenTick: row.last_seen_tick ?? null,
        awayGraceExpiresAt: row.away_grace_expires_at ?? null,
        frozen: row.frozen === 1,
    };
}

export class CivicDidStore {
    constructor(private readonly pool: Pool) {}

    async insert(record: CivicDidRecord): Promise<void> {
        await this.pool.query(
            `INSERT INTO civic_did_registry
                (grid_name, civic_did, existence_did, credential_json, status, issued_at_tick)
             VALUES (?, ?, ?, ?, 'active', ?)`,
            [
                record.gridName,
                record.civicDid,
                record.existenceDid,
                JSON.stringify(record.credentialJson),
                record.issuedAtTick,
            ],
        );
    }

    async get(gridName: string, civicDid: string): Promise<CivicDidRecord | null> {
        const [rows] = await this.pool.query<CivicDidRow[]>(
            `SELECT * FROM civic_did_registry WHERE grid_name = ? AND civic_did = ?`,
            [gridName, civicDid],
        );
        return rows[0] ? rowToRecord(rows[0]) : null;
    }

    async getByExistenceDid(gridName: string, existenceDid: string): Promise<CivicDidRecord | null> {
        const [rows] = await this.pool.query<CivicDidRow[]>(
            `SELECT * FROM civic_did_registry WHERE grid_name = ? AND existence_did = ?`,
            [gridName, existenceDid],
        );
        return rows[0] ? rowToRecord(rows[0]) : null;
    }

    async markRevoked(
        gridName: string,
        civicDid: string,
        revokedAtTick: number,
        courtConvictionRef: string,
    ): Promise<boolean> {
        const [result] = await this.pool.query<ResultSetHeader>(
            `UPDATE civic_did_registry
             SET status='revoked', revoked_at_tick = ?, court_conviction_ref = ?
             WHERE grid_name = ? AND civic_did = ? AND status = 'active'`,
            [revokedAtTick, courtConvictionRef, gridName, civicDid],
        );
        return result.affectedRows === 1;
    }

    /**
     * Phase 41 / SLEEP-05 — set frozen=1 on presumed_departed escalation.
     * T-41-04 mitigation: requireCivicDid preHandler checks frozen on every write route.
     */
    async markFrozen(gridName: string, civicDid: string, frozenAtTick: number): Promise<boolean> {
        const [result] = await this.pool.query<ResultSetHeader>(
            `UPDATE civic_did_registry
             SET frozen = 1, presence_status = 'presumed_departed', last_seen_tick = ?
             WHERE grid_name = ? AND civic_did = ?`,
            [frozenAtTick, gridName, civicDid],
        );
        return result.affectedRows === 1;
    }
}
