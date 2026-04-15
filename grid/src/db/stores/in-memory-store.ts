/**
 * InMemoryGridStore — in-memory implementation of IGridStore.
 *
 * Used in tests and standalone scenarios where MySQL is not available.
 * Behaviour is identical to the MySQL stores: append-idempotent audit,
 * upsert registry, upsert positions.
 */

import type { AuditEntry } from '../../audit/types.js';
import type { NousRecord } from '../../registry/types.js';
import type { NousPosition } from '../../space/types.js';
import type { IAuditStore, IRegistryStore, ISpaceStore, IGridStore } from '../types.js';

// ── Internal store implementations ───────────────────────────

class MemAuditStore implements IAuditStore {
    /** gridName → ordered entries */
    private readonly data = new Map<string, AuditEntry[]>();

    async append(gridName: string, entry: AuditEntry): Promise<void> {
        if (!this.data.has(gridName)) this.data.set(gridName, []);
        const list = this.data.get(gridName)!;
        // Idempotent: skip if already present (same id)
        if (!list.find(e => e.id === entry.id)) {
            list.push({ ...entry });
        }
    }

    async loadAll(gridName: string): Promise<AuditEntry[]> {
        return (this.data.get(gridName) ?? []).map(e => ({ ...e }));
    }

    clear(gridName?: string): void {
        if (gridName) this.data.delete(gridName);
        else this.data.clear();
    }
}

class MemRegistryStore implements IRegistryStore {
    /** gridName → (did → record) */
    private readonly data = new Map<string, Map<string, NousRecord>>();

    async upsert(gridName: string, record: NousRecord): Promise<void> {
        if (!this.data.has(gridName)) this.data.set(gridName, new Map());
        this.data.get(gridName)!.set(record.did, { ...record });
    }

    async loadAll(gridName: string): Promise<NousRecord[]> {
        return [...(this.data.get(gridName)?.values() ?? [])].map(r => ({ ...r }));
    }

    clear(gridName?: string): void {
        if (gridName) this.data.delete(gridName);
        else this.data.clear();
    }
}

class MemSpaceStore implements ISpaceStore {
    /** gridName → (nousDid → position) */
    private readonly data = new Map<string, Map<string, NousPosition>>();

    async upsertPosition(gridName: string, pos: NousPosition): Promise<void> {
        if (!this.data.has(gridName)) this.data.set(gridName, new Map());
        this.data.get(gridName)!.set(pos.nousDid, { ...pos });
    }

    async loadPositions(gridName: string): Promise<NousPosition[]> {
        return [...(this.data.get(gridName)?.values() ?? [])].map(p => ({ ...p }));
    }

    clear(gridName?: string): void {
        if (gridName) this.data.delete(gridName);
        else this.data.clear();
    }
}

// ── Public class ──────────────────────────────────────────────

export class InMemoryGridStore implements IGridStore {
    readonly audit: MemAuditStore;
    readonly registry: MemRegistryStore;
    readonly space: MemSpaceStore;

    constructor() {
        this.audit    = new MemAuditStore();
        this.registry = new MemRegistryStore();
        this.space    = new MemSpaceStore();
    }

    /** Clear all data (optionally scoped to one grid). */
    clear(gridName?: string): void {
        this.audit.clear(gridName);
        this.registry.clear(gridName);
        this.space.clear(gridName);
    }

    async close(): Promise<void> {
        // no-op for in-memory store
    }
}
