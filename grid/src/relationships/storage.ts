/**
 * Phase 9 Plan 03 — RelationshipStorage
 *
 * Sole writer of the `relationships` MySQL table (D-9-05 gate 2).
 * All writes go through snapshot() / scheduleSnapshot().
 * No other file may execute INSERT/UPDATE/REPLACE/DELETE against `relationships`.
 * Enforced by producer-boundary.test.ts grep gate (SQL_WRITE_PATTERN).
 *
 * Key design decisions:
 *   - snapshot(): batched REPLACE INTO (full-table rewrite per OQ-7, ≤100ms at 5K rows)
 *   - scheduleSnapshot(): fire-and-forget via setImmediate (OQ-2 — tick is never blocked)
 *   - loadSnapshot(): read-all for startup rebuild sanity (no wall-clock needed)
 *   - Errors are logged with console.warn and swallowed — audit chain is truth, snapshots are cache
 *   - No wall-clock access, randomness, or timer calls (D-9-12)
 *   - setImmediate is allowed: not in the D-9-12 forbidden list
 *
 * Pool injection: Caller (launcher) provides mysql2/promise Pool. No pool construction here.
 * Pattern source: grid/src/db/persistent-chain.ts (fire-and-forget), grid/src/db/stores/audit-store.ts (parameterized SQL)
 */

import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { Edge } from './types.js';

export class RelationshipStorage {
    constructor(public readonly pool: Pool) {}

    /**
     * Batched full rewrite of the `relationships` table.
     *
     * Collects all edges from the iterator into a single batched REPLACE INTO statement.
     * If the iterator is empty, returns immediately (empty VALUES clause is a MySQL syntax error).
     * Errors are logged and swallowed — snapshot loss is recoverable via rebuildFromChain() (OQ-2).
     *
     * @param edges - IterableIterator<Edge> from RelationshipListener.allEdges()
     * @param snapshotTick - current authoritative tick at time of snapshot
     */
    async snapshot(edges: IterableIterator<Edge>, snapshotTick: number): Promise<void> {
        // Collect all edges into rows first (iterator is single-pass).
        const rows: Edge[] = [];
        for (const edge of edges) {
            rows.push(edge);
        }

        if (rows.length === 0) {
            return;  // Empty VALUES clause would be a MySQL syntax error.
        }

        // Build batched REPLACE INTO with N value-tuple placeholders.
        // Columns: edge_key, did_a, did_b, valence, weight, recency_tick, last_event_hash, snapshot_tick
        const valuePlaceholders = rows.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        const sql = `REPLACE INTO relationships (edge_key, did_a, did_b, valence, weight, recency_tick, last_event_hash, snapshot_tick) VALUES ${valuePlaceholders}`;

        const params: unknown[] = [];
        for (const edge of rows) {
            // edge_key is the sorted DID pair joined by '|' (listener already sorted did_a < did_b)
            const edgeKey = `${edge.did_a}|${edge.did_b}`;
            params.push(
                edgeKey,
                edge.did_a,
                edge.did_b,
                edge.valence,   // mysql2 DECIMAL(4,3) binds numeric literals correctly
                edge.weight,
                edge.recency_tick,
                edge.last_event_hash,
                snapshotTick,
            );
        }

        try {
            await this.pool.query(sql, params);
        } catch (err) {
            // Fire-and-forget: snapshot failure is recoverable via rebuildFromChain (OQ-2).
            // Do NOT rethrow — this is a cache write, not the source of truth.
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(JSON.stringify({ msg: 'relationships_snapshot_failed', tick: snapshotTick, err: msg }));
        }
    }

    /**
     * Read all edges from the `relationships` table for startup rebuild sanity.
     *
     * Returns an empty array on first boot (no rows yet).
     * DECIMAL(4,3) columns come back as strings from mysql2; parseFloat preserves
     * 3-decimal precision because all values were produced by .toFixed(3) at the
     * canonical layer (P-9-03 pitfall: avoid raw float equality, use canonicalEdge).
     *
     * BIGINT UNSIGNED (recency_tick, snapshot_tick) may come back as string or number
     * depending on mysql2 config; coerce with Number() — safe up to 2^53.
     */
    async loadSnapshot(): Promise<Edge[]> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            'SELECT edge_key, did_a, did_b, valence, weight, recency_tick, last_event_hash FROM relationships',
        );

        return rows.map((row) => ({
            did_a: row['did_a'] as string,
            did_b: row['did_b'] as string,
            valence: parseFloat(row['valence'] as string),
            weight: parseFloat(row['weight'] as string),
            recency_tick: Number(row['recency_tick']),
            last_event_hash: row['last_event_hash'] as string,
        }));
    }

    /**
     * Non-blocking wrapper around snapshot() for use by Plan 04's launcher wiring.
     *
     * Schedules the snapshot via setImmediate so the current tick completes without
     * waiting. If snapshot() rejects (already caught internally), the catch here is
     * defense-in-depth — we are inside a setImmediate callback and must not rethrow.
     *
     * setImmediate is NOT in the D-9-12 forbidden list (wall-clock access, randomness,
     * and blocking timer calls are forbidden; setImmediate is allowed).
     * Verified: determinism-source.test.ts grep gate does not flag setImmediate.
     */
    scheduleSnapshot(edges: IterableIterator<Edge>, snapshotTick: number): void {
        setImmediate(() => {
            this.snapshot(edges, snapshotTick).catch(() => {
                // Already caught inside snapshot(); this is defense-in-depth.
                // Do NOT rethrow — we are in a setImmediate callback.
            });
        });
    }
}
