/**
 * AuditStore — MySQL persistence for the AuditChain.
 *
 * Stores each AuditEntry row in `audit_trail` keyed by (grid_name, id).
 * Uses INSERT IGNORE to make appends idempotent.
 */

import type { AuditEntry } from '../../audit/types.js';
import type { IAuditStore } from '../types.js';
import type { DatabaseConnection } from '../connection.js';

export class AuditStore implements IAuditStore {
    constructor(private readonly db: DatabaseConnection) {}

    async append(gridName: string, entry: AuditEntry): Promise<void> {
        await this.db.execute(
            `INSERT IGNORE INTO audit_trail
                (grid_name, id, event_type, actor_did, target_did,
                 payload, prev_hash, event_hash, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                gridName,
                entry.id ?? 0,
                entry.eventType,
                entry.actorDid,
                entry.targetDid ?? null,
                JSON.stringify(entry.payload),
                entry.prevHash,
                entry.eventHash,
                entry.createdAt,
            ],
        );
    }

    async loadAll(gridName: string): Promise<AuditEntry[]> {
        const rows = await this.db.query<{
            id: number;
            event_type: string;
            actor_did: string;
            target_did: string | null;
            payload: string | Record<string, unknown>;
            prev_hash: string;
            event_hash: string;
            created_at: number;
        }>(
            `SELECT id, event_type, actor_did, target_did,
                    payload, prev_hash, event_hash, created_at
             FROM audit_trail
             WHERE grid_name = ?
             ORDER BY id ASC`,
            [gridName],
        );

        return rows.map(r => ({
            id: r.id,
            eventType: r.event_type,
            actorDid: r.actor_did,
            targetDid: r.target_did ?? undefined,
            payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload,
            prevHash: r.prev_hash,
            eventHash: r.event_hash,
            createdAt: Number(r.created_at),
        }));
    }
}
