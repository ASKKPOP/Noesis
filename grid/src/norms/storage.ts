/**
 * Phase 19 Plan 03 — NormStorage
 *
 * Sole writer of the norm_candidates and norm_registry MySQL tables.
 * Errors in upsertCandidate and insertRegistry are swallowed with console.warn
 * (audit chain is truth, DB is cache). loadNorms propagates errors.
 *
 * Pool injection: Caller (launcher) provides mysql2/promise Pool.
 */

import type { Pool, RowDataPacket } from 'mysql2/promise';

export class NormStorage {
    constructor(public readonly pool: Pool) {}

    /**
     * Upsert a norm candidate record (REPLACE INTO norm_candidates).
     * participant_dids stored as JSON string of sorted array.
     * Errors are swallowed — candidate loss is recoverable via NormDetector.rebuildFromChain().
     */
    async upsertCandidate(
        fingerprint: string,
        gridName: string,
        participantDids: Set<string>,
        firstSeenTick: number,
        lastUpdatedTick: number,
    ): Promise<void> {
        const participantDidsJson = JSON.stringify(Array.from(participantDids).sort());
        const sql = `REPLACE INTO norm_candidates
            (fingerprint, grid_name, participant_dids, first_seen_tick, last_updated_tick)
            VALUES (?, ?, ?, ?, ?)`;
        try {
            await this.pool.query(sql, [
                fingerprint,
                gridName,
                participantDidsJson,
                firstSeenTick,
                lastUpdatedTick,
            ]);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(JSON.stringify({ msg: 'norm_candidate_upsert_failed', fingerprint, gridName, err: msg }));
        }
    }

    /**
     * Delete a norm candidate after crystallization.
     */
    async deleteCandidate(fingerprint: string, gridName: string): Promise<void> {
        const sql = `DELETE FROM norm_candidates WHERE fingerprint = ? AND grid_name = ?`;
        try {
            await this.pool.query(sql, [fingerprint, gridName]);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(JSON.stringify({ msg: 'norm_candidate_delete_failed', fingerprint, gridName, err: msg }));
        }
    }

    /**
     * Insert a crystallized norm into norm_registry.
     * Errors are swallowed — registry loss is recoverable via rebuildFromChain.
     */
    async insertRegistry(
        normId: string,
        fingerprint: string,
        crystallizedTick: number,
        participantCount: number,
        convergenceType: string,
        eventHash: string,
        gridName: string,
    ): Promise<void> {
        const sql = `INSERT INTO norm_registry
            (norm_id, fingerprint, crystallized_tick, participant_count, convergence_type, event_hash, grid_name)
            VALUES (?, ?, ?, ?, ?, ?, ?)`;
        try {
            await this.pool.query(sql, [
                normId,
                fingerprint,
                crystallizedTick,
                participantCount,
                convergenceType,
                eventHash,
                gridName,
            ]);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(JSON.stringify({ msg: 'norm_registry_insert_failed', fingerprint, gridName, err: msg }));
        }
    }

    /**
     * Load all norms for a grid from norm_registry.
     * Propagates errors (called by REST endpoint).
     */
    async loadNorms(gridName: string): Promise<RowDataPacket[]> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            'SELECT * FROM norm_registry WHERE grid_name = ? ORDER BY crystallized_tick ASC',
            [gridName],
        );
        return rows;
    }
}
