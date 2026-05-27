import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { PresenceRecord, PresenceStatus } from './types.js';

interface PresenceRow extends RowDataPacket {
    grid_name: string;
    civic_did: string;
    presence_status: PresenceStatus;
    last_seen_at: Date | null;
    last_seen_tick: number | null;
    away_grace_expires_at: Date | null;
    frozen: 0 | 1;
}

function rowToPresence(row: PresenceRow): PresenceRecord {
    return {
        gridName: row.grid_name,
        civicDid: row.civic_did,
        presenceStatus: row.presence_status,
        lastSeenAt: row.last_seen_at ?? null,
        lastSeenTick: row.last_seen_tick ?? null,
        awayGraceExpiresAt: row.away_grace_expires_at ?? null,
        frozen: row.frozen === 1,
    };
}

export class PresenceStore {
    constructor(private readonly pool: Pool) {}

    /**
     * SLEEP-01 — set status + update last_seen markers. Called by:
     *   - Heartbeat handler (sets status='awake', refreshes last_seen)
     *   - Grace timer expiry (sets status='away', keeps last_seen)
     *   - Escalation (sets status='absent' or 'presumed_departed')
     */
    async updatePresence(
        gridName: string,
        civicDid: string,
        status: PresenceStatus,
        lastSeenTick: number,
    ): Promise<boolean> {
        const setFrozen = status === 'presumed_departed' ? ', frozen = 1' : '';
        const setLastSeen = status === 'awake'
            ? ', last_seen_at = CURRENT_TIMESTAMP(3), last_seen_tick = ?'
            : '';
        const params = status === 'awake'
            ? [status, lastSeenTick, gridName, civicDid]
            : [status, gridName, civicDid];
        const [result] = await this.pool.query<ResultSetHeader>(
            `UPDATE civic_did_registry
             SET presence_status = ?${setLastSeen}${setFrozen}
             WHERE grid_name = ? AND civic_did = ?`,
            params,
        );
        return result.affectedRows === 1;
    }

    async getPresence(gridName: string, civicDid: string): Promise<PresenceRecord | null> {
        const [rows] = await this.pool.query<PresenceRow[]>(
            `SELECT grid_name, civic_did, presence_status, last_seen_at, last_seen_tick,
                    away_grace_expires_at, frozen
             FROM civic_did_registry
             WHERE grid_name = ? AND civic_did = ?`,
            [gridName, civicDid],
        );
        return rows[0] ? rowToPresence(rows[0]) : null;
    }

    /** Public Civic Map polling source — returns ALL rows for the Grid. */
    async listAll(gridName: string): Promise<PresenceRecord[]> {
        const [rows] = await this.pool.query<PresenceRow[]>(
            `SELECT grid_name, civic_did, presence_status, last_seen_at, last_seen_tick,
                    away_grace_expires_at, frozen
             FROM civic_did_registry WHERE grid_name = ?`,
            [gridName],
        );
        return rows.map(rowToPresence);
    }

    /**
     * Escalation source — returns rows whose last_seen_at is older than olderThan
     * AND whose current status is in inStatuses.
     */
    async listStaleSince(
        gridName: string,
        olderThan: Date,
        inStatuses: PresenceStatus[],
    ): Promise<PresenceRecord[]> {
        if (inStatuses.length === 0) return [];
        const placeholders = inStatuses.map(() => '?').join(',');
        const [rows] = await this.pool.query<PresenceRow[]>(
            `SELECT grid_name, civic_did, presence_status, last_seen_at, last_seen_tick,
                    away_grace_expires_at, frozen
             FROM civic_did_registry
             WHERE grid_name = ?
               AND last_seen_at IS NOT NULL
               AND last_seen_at < ?
               AND presence_status IN (${placeholders})`,
            [gridName, olderThan, ...inStatuses],
        );
        return rows.map(rowToPresence);
    }

    /**
     * T-41-04 mitigation — query for requireCivicDid preHandler.
     * Returns true if the DID is frozen=1 (any write should 409).
     */
    async isFrozen(gridName: string, civicDid: string): Promise<boolean> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT frozen FROM civic_did_registry WHERE grid_name = ? AND civic_did = ?`,
            [gridName, civicDid],
        );
        return rows[0]?.frozen === 1;
    }
}
