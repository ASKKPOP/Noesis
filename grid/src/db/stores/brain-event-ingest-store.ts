/**
 * BrainEventIngestStore — MySQL persistence for the brain_event_ingest table.
 *
 * Phase 38 WIRE-03/WIRE-04 — Idempotency dedup gate for batch replay.
 *
 * INSERT IGNORE semantics (same as AuditStore.append):
 *   - First insert: affectedRows = 1 → accepted
 *   - Duplicate idempotency_key: affectedRows = 0 → duplicate
 *
 * The ingest table is the dedup gate; it is NOT the audit chain.
 * Accepted events must be forwarded to NousRunner.executeActions separately
 * (R-31-01 preserved — sole-producer path for all audit appends).
 */

import type { Pool } from 'mysql2/promise';

export interface BrainWireEvent {
    idempotencyKey: string;   // 64-char hex (sha256) — CHAR(64) in DB
    brainDid: string;
    tick: number;
    eventType: string;
    payload: Record<string, unknown>;
}

export interface IngestResult {
    accepted: number;
    duplicate: number;
    total: number;
    acceptedKeys: string[];  // idempotency_keys that landed (NOT duplicates)
}

export class BrainEventIngestStore {
    constructor(private readonly opts: { gridName: string; pool: Pool }) {}

    /**
     * INSERT IGNORE per event. Returns accepted/duplicate counts + the keys
     * that were newly accepted (useful for the dispatch loop).
     *
     * Uses a sequential loop rather than a bulk INSERT to allow per-row
     * affectedRows inspection — the same pattern as AuditStore.append.
     */
    async ingestBatch(events: BrainWireEvent[]): Promise<IngestResult> {
        let accepted = 0;
        let duplicate = 0;
        const acceptedKeys: string[] = [];
        const now = Date.now();

        for (const evt of events) {
            const [result] = await this.opts.pool.execute(
                `INSERT IGNORE INTO brain_event_ingest
                    (grid_name, idempotency_key, brain_did, tick, event_type, payload, received_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    this.opts.gridName,
                    evt.idempotencyKey,
                    evt.brainDid,
                    evt.tick,
                    evt.eventType,
                    JSON.stringify(evt.payload),
                    now,
                ],
            );

            const affected = (result as { affectedRows: number }).affectedRows;
            if (affected === 1) {
                accepted++;
                acceptedKeys.push(evt.idempotencyKey);
            } else {
                duplicate++;
            }
        }

        return { accepted, duplicate, total: events.length, acceptedKeys };
    }
}
