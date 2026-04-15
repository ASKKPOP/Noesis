/**
 * GridStore — high-level persistence for the full Grid state.
 *
 * Wraps the three low-level stores (audit, registry, space) and adds:
 *   - snapshot(gridName, launcher) → write in-memory state to DB
 *   - restore(gridName, launcher)  → load DB state into in-memory objects
 *
 * The `launcher` parameter is typed structurally to avoid a circular import
 * on GenesisLauncher. Any object with the right subsystems works.
 */

import type { IGridStore } from './types.js';
import { AuditStore } from './stores/audit-store.js';
import { RegistryStore } from './stores/registry-store.js';
import { SpaceStore } from './stores/space-store.js';
import type { DatabaseConnection } from './connection.js';
import type { AuditChain } from '../audit/chain.js';
import type { NousRegistry } from '../registry/registry.js';
import type { SpatialMap } from '../space/map.js';

/** Structural type — anything with these three subsystems works. */
interface GridSubsystems {
    readonly audit: AuditChain;
    readonly registry: NousRegistry;
    readonly space: SpatialMap;
}

export class GridStore implements IGridStore {
    readonly audit: AuditStore;
    readonly registry: RegistryStore;
    readonly space: SpaceStore;

    constructor(private readonly db: DatabaseConnection) {
        this.audit    = new AuditStore(db);
        this.registry = new RegistryStore(db);
        this.space    = new SpaceStore(db);
    }

    /**
     * Take a full snapshot of a launcher's current in-memory state to the DB.
     * Safe to call repeatedly — all writes are idempotent (upsert / INSERT IGNORE).
     */
    async snapshot(gridName: string, launcher: GridSubsystems): Promise<void> {
        // Audit trail
        for (const entry of launcher.audit.all()) {
            await this.audit.append(gridName, entry);
        }

        // Registry
        for (const record of launcher.registry.all()) {
            await this.registry.upsert(gridName, record);
        }

        // Spatial positions
        for (const pos of launcher.space.allPositions()) {
            await this.space.upsertPosition(gridName, pos);
        }
    }

    /**
     * Restore a launcher's in-memory state from the DB.
     * Returns true if data was found; false if the DB has no state for this grid.
     *
     * Call this on a fresh launcher (before bootstrap seeding) to reload persisted state.
     */
    async restore(gridName: string, launcher: GridSubsystems): Promise<boolean> {
        const [entries, records, positions] = await Promise.all([
            this.audit.loadAll(gridName),
            this.registry.loadAll(gridName),
            this.space.loadPositions(gridName),
        ]);

        if (entries.length === 0 && records.length === 0) return false;

        launcher.audit.loadEntries(entries);
        launcher.registry.loadRecords(records);
        launcher.space.loadPositions(positions);

        return true;
    }

    async close(): Promise<void> {
        await this.db.close();
    }
}

// ── Convenience functions (for callers without a GridStore instance) ──

/**
 * Snapshot a launcher's state into any IGridStore implementation.
 * Works with both GridStore (MySQL) and InMemoryGridStore (tests).
 */
export async function snapshotGrid(
    gridName: string,
    launcher: GridSubsystems,
    store: IGridStore,
): Promise<void> {
    for (const entry of launcher.audit.all()) {
        await store.audit.append(gridName, entry);
    }
    for (const record of launcher.registry.all()) {
        await store.registry.upsert(gridName, record);
    }
    for (const pos of launcher.space.allPositions()) {
        await store.space.upsertPosition(gridName, pos);
    }
}

/**
 * Restore a launcher's state from any IGridStore implementation.
 * Returns true if data was found.
 */
export async function restoreGrid(
    gridName: string,
    launcher: GridSubsystems,
    store: IGridStore,
): Promise<boolean> {
    const [entries, records, positions] = await Promise.all([
        store.audit.loadAll(gridName),
        store.registry.loadAll(gridName),
        store.space.loadPositions(gridName),
    ]);

    if (entries.length === 0 && records.length === 0) return false;

    launcher.audit.loadEntries(entries);
    launcher.registry.loadRecords(records);
    launcher.space.loadPositions(positions);

    return true;
}
