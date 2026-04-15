/**
 * RegistryStore — MySQL persistence for NousRegistry records.
 *
 * Uses INSERT … ON DUPLICATE KEY UPDATE so upsert is idempotent.
 */

import type { NousRecord } from '../../registry/types.js';
import type { IRegistryStore } from '../types.js';
import type { DatabaseConnection } from '../connection.js';

export class RegistryStore implements IRegistryStore {
    constructor(private readonly db: DatabaseConnection) {}

    async upsert(gridName: string, record: NousRecord): Promise<void> {
        await this.db.execute(
            `INSERT INTO nous_registry
                (grid_name, did, name, nds_address, public_key, human_owner, region,
                 lifecycle_phase, reputation, ousia, spawned_at_tick, last_active_tick, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                name             = VALUES(name),
                nds_address      = VALUES(nds_address),
                region           = VALUES(region),
                lifecycle_phase  = VALUES(lifecycle_phase),
                reputation       = VALUES(reputation),
                ousia            = VALUES(ousia),
                last_active_tick = VALUES(last_active_tick),
                status           = VALUES(status)`,
            [
                gridName,
                record.did,
                record.name,
                record.ndsAddress,
                record.publicKey,
                record.humanOwner ?? null,
                record.region,
                record.lifecyclePhase,
                record.reputation,
                record.ousia,
                record.spawnedAtTick,
                record.lastActiveTick,
                record.status,
            ],
        );
    }

    async loadAll(gridName: string): Promise<NousRecord[]> {
        const rows = await this.db.query<{
            did: string;
            name: string;
            nds_address: string;
            public_key: string;
            human_owner: string | null;
            region: string;
            lifecycle_phase: string;
            reputation: number;
            ousia: number;
            spawned_at_tick: number;
            last_active_tick: number;
            status: string;
        }>(
            `SELECT did, name, nds_address, public_key, human_owner, region,
                    lifecycle_phase, reputation, ousia,
                    spawned_at_tick, last_active_tick, status
             FROM nous_registry
             WHERE grid_name = ?
             ORDER BY spawned_at_tick ASC`,
            [gridName],
        );

        return rows.map(r => ({
            did: r.did,
            name: r.name,
            ndsAddress: r.nds_address,
            publicKey: r.public_key,
            humanOwner: r.human_owner ?? undefined,
            region: r.region,
            lifecyclePhase: r.lifecycle_phase as NousRecord['lifecyclePhase'],
            reputation: Number(r.reputation),
            ousia: Number(r.ousia),
            spawnedAtTick: r.spawned_at_tick,
            lastActiveTick: r.last_active_tick,
            status: r.status as NousRecord['status'],
        }));
    }
}
