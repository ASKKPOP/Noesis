/**
 * DB layer types — interfaces and configuration for persistent storage.
 */

import type { AuditEntry } from '../audit/types.js';
import type { NousRecord } from '../registry/types.js';
import type { NousPosition } from '../space/types.js';

// ── Database configuration ────────────────────────────────────

export interface DbConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    connectionLimit?: number;
}

// ── Store interfaces ──────────────────────────────────────────

export interface IAuditStore {
    append(gridName: string, entry: AuditEntry): Promise<void>;
    loadAll(gridName: string): Promise<AuditEntry[]>;
}

export interface IRegistryStore {
    upsert(gridName: string, record: NousRecord): Promise<void>;
    loadAll(gridName: string): Promise<NousRecord[]>;
}

export interface ISpaceStore {
    upsertPosition(gridName: string, pos: NousPosition): Promise<void>;
    loadPositions(gridName: string): Promise<NousPosition[]>;
}

export interface IGridStore {
    readonly audit: IAuditStore;
    readonly registry: IRegistryStore;
    readonly space: ISpaceStore;
    close(): Promise<void>;
}
