/**
 * SpaceStore — MySQL persistence for SpatialMap positions.
 *
 * Stores NousPosition rows in `nous_positions` keyed by (grid_name, nous_did).
 * Upsert keeps the latest position on conflict.
 */

import type { NousPosition } from '../../space/types.js';
import type { ISpaceStore } from '../types.js';
import type { DatabaseConnection } from '../connection.js';

export class SpaceStore implements ISpaceStore {
    constructor(private readonly db: DatabaseConnection) {}

    async upsertPosition(gridName: string, pos: NousPosition): Promise<void> {
        await this.db.execute(
            `INSERT INTO nous_positions (grid_name, nous_did, region_id, arrived_at)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                region_id  = VALUES(region_id),
                arrived_at = VALUES(arrived_at)`,
            [gridName, pos.nousDid, pos.regionId, pos.arrivedAt],
        );
    }

    async loadPositions(gridName: string): Promise<NousPosition[]> {
        const rows = await this.db.query<{
            nous_did: string;
            region_id: string;
            arrived_at: number;
        }>(
            `SELECT nous_did, region_id, arrived_at
             FROM nous_positions
             WHERE grid_name = ?`,
            [gridName],
        );

        return rows.map(r => ({
            nousDid: r.nous_did,
            regionId: r.region_id,
            arrivedAt: Number(r.arrived_at),
        }));
    }
}
