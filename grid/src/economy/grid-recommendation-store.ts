/**
 * Join-a-Grid S3 — a User recommends a Grid to their owned Nous (from the world map).
 * ADVISORY only: the Nous reads pending recommendations as part of its world-model
 * sight and decides on its own whether to join (the User proposes, the Nous disposes).
 *
 * PRIVATE portal record, no audit events, allowlist +0. grid_join_recommendations, v56.
 */
import { randomUUID } from 'node:crypto';
import type { Pool, RowDataPacket } from 'mysql2/promise';

export interface GridRecommendationRow {
    recommendation_id: string; nous_did: string; target_grid_id: string; status: 'pending' | 'seen';
}

export class GridRecommendationStore {
    constructor(private readonly pool: Pool) {}

    /** A human recommends a target Grid to one of their owned Nous. Idempotent per
     *  (human, nous, grid): a repeat re-arms it to 'pending'. Returns the id. */
    async recommend(p: { gridName: string; humanDid: string; nousDid: string; targetGridId: string; tick: number }): Promise<string> {
        const id = randomUUID();
        await this.pool.query(
            `INSERT INTO grid_join_recommendations
               (recommendation_id, grid_name, human_did, nous_did, target_grid_id, status, created_at)
             VALUES (?, ?, ?, ?, ?, 'pending', ?)
             ON DUPLICATE KEY UPDATE status = 'pending', created_at = VALUES(created_at)`,
            [id, p.gridName, p.humanDid, p.nousDid, p.targetGridId, p.tick],
        );
        return id;
    }

    /** Pending recommendations for a Nous (by its existence-DID) — what it reads as sight. */
    async pendingForNous(gridName: string, nousDid: string): Promise<GridRecommendationRow[]> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT recommendation_id, nous_did, target_grid_id, status
               FROM grid_join_recommendations
              WHERE grid_name = ? AND nous_did = ? AND status = 'pending'
              ORDER BY created_at DESC LIMIT 50`,
            [gridName, nousDid],
        );
        return rows as unknown as GridRecommendationRow[];
    }

    /** Mark a recommendation seen (the Nous has noted it). */
    async markSeen(gridName: string, recommendationId: string): Promise<void> {
        await this.pool.query(
            `UPDATE grid_join_recommendations SET status = 'seen' WHERE grid_name = ? AND recommendation_id = ?`,
            [gridName, recommendationId],
        );
    }
}
