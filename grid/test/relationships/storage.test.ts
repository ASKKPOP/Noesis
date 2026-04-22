/**
 * Phase 9 Plan 03 Task 2 — RelationshipStorage round-trip tests.
 *
 * MOCK PATH CHOSEN: No real-MySQL integration harness exists in this repo's test suite.
 * The established pattern (grid/test/db/persistent-audit.test.ts, snapshot-restore.test.ts)
 * uses InMemoryGridStore — not a live MySQL pool. Following the same approach,
 * this file mocks the mysql2/promise Pool with a minimal in-memory implementation
 * that parses the SQL string and routes to a Map<string, Row> store.
 *
 * The mock validates:
 *   - REPLACE INTO relationships: writes/overwrites rows keyed by edge_key (1st param)
 *   - SELECT ... FROM relationships: returns all stored rows
 *   - Query call count: verifiable for empty-iterator assertion
 *
 * All test scenarios exercise the real RelationshipStorage code — only the Pool
 * transport is mocked. Shape equivalence at the canonical-edge level is verified
 * using canonicalEdge() — not raw float equality (P-9-03 pitfall).
 *
 * Covers:
 *   Group 1 — Empty-table loadSnapshot returns []
 *   Group 2 — Snapshot → load round-trip (canonical byte-identity, D-9-10)
 *   Group 3 — Idempotent re-snapshot (REPLACE INTO semantics, no duplicate rows)
 *   Group 4 — Updated-edge snapshot (new valence/weight/recency_tick reflects correctly)
 *   Group 5 — Empty-iterator snapshot (no query issued)
 *   Group 6 — Fire-and-forget error swallow (scheduleSnapshot does not throw)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { AuditChain } from '../../src/audit/chain.js';
import { RelationshipListener } from '../../src/relationships/listener.js';
import { RelationshipStorage } from '../../src/relationships/storage.js';
import { DEFAULT_RELATIONSHIP_CONFIG } from '../../src/relationships/config.js';
import { canonicalEdge, sortedPairKey } from '../../src/relationships/canonical.js';
import type { Edge } from '../../src/relationships/types.js';

// ─── In-memory Pool mock ─────────────────────────────────────────────────────

/**
 * Minimal in-memory Pool mock.
 * - REPLACE INTO relationships (...) VALUES ...: writes rows keyed by edge_key (first param per tuple)
 * - SELECT ... FROM relationships: returns all stored rows as RowDataPacket[]
 * - All other SQL: no-op
 */
function makeInMemoryPool(): { pool: Pool; getRows: () => Map<string, Record<string, unknown>>; queryCalls: () => number } {
    const rows = new Map<string, Record<string, unknown>>();
    let queryCalls = 0;

    const pool = {
        query: vi.fn(async (sql: string, params?: unknown[]) => {
            queryCalls++;
            const sqlNorm = sql.replace(/\s+/g, ' ').trim();

            if (/^REPLACE INTO relationships/i.test(sqlNorm)) {
                // Params are flat: [edgeKey, did_a, did_b, valence, weight, recency_tick, last_event_hash, snapshot_tick, ...]
                // 8 params per row
                const COLS_PER_ROW = 8;
                const p = params as unknown[];
                for (let i = 0; i < p.length; i += COLS_PER_ROW) {
                    const edgeKey        = p[i + 0] as string;
                    const did_a          = p[i + 1] as string;
                    const did_b          = p[i + 2] as string;
                    const valence        = p[i + 3] as number;
                    const weight         = p[i + 4] as number;
                    const recency_tick   = p[i + 5] as number;
                    const last_event_hash = p[i + 6] as string;
                    const snapshot_tick  = p[i + 7] as number;
                    rows.set(edgeKey, { edge_key: edgeKey, did_a, did_b, valence, weight, recency_tick, last_event_hash, snapshot_tick });
                }
                return [{ affectedRows: rows.size }, []];
            }

            if (/^SELECT .+ FROM relationships/i.test(sqlNorm)) {
                // Return all rows as RowDataPacket[]-style array
                const result = [...rows.values()].map(r => ({
                    edge_key: r['edge_key'],
                    did_a: r['did_a'],
                    did_b: r['did_b'],
                    // DECIMAL(4,3) comes back as string from real mysql2 — mirror that behavior
                    valence: String((r['valence'] as number).toFixed(3)),
                    weight: String((r['weight'] as number).toFixed(3)),
                    recency_tick: r['recency_tick'],
                    last_event_hash: r['last_event_hash'],
                }));
                return [result as RowDataPacket[], []];
            }

            return [[], []];
        }),
    } as unknown as Pool;

    return {
        pool,
        getRows: () => rows,
        queryCalls: () => queryCalls,
    };
}

// ─── Fixture helpers ─────────────────────────────────────────────────────────

const DID_A = 'did:noesis:alpha';
const DID_B = 'did:noesis:beta';
const DID_C = 'did:noesis:gamma';
const DID_D = 'did:noesis:delta';

function appendSpoke(chain: AuditChain, fromDid: string, toDid: string, tick = 1): void {
    chain.append('nous.spoke', fromDid, { name: fromDid, channel: 'agora', text: 'hello', tick, to_did: toDid });
}

function appendTradeSettled(chain: AuditChain, proposer: string, counterparty: string, tick = 1): void {
    chain.append('trade.settled', proposer, { counterparty, amount: 10, nonce: 'n1', tick });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('RelationshipStorage', () => {

    describe('Group 1: empty-table loadSnapshot', () => {
        it('returns [] when no rows exist', async () => {
            const { pool } = makeInMemoryPool();
            const storage = new RelationshipStorage(pool);
            const result = await storage.loadSnapshot();
            expect(result).toEqual([]);
        });
    });

    describe('Group 2: snapshot → load round-trip', () => {
        it('round-trip: canonical byte-identity after snapshot + load (D-9-10 / P-9-03)', async () => {
            const { pool } = makeInMemoryPool();
            const storage = new RelationshipStorage(pool);
            const chain = new AuditChain();
            const listener = new RelationshipListener(chain, DEFAULT_RELATIONSHIP_CONFIG);

            // Append 10 nous.spoke + 5 trade.settled across 4 DIDs
            for (let i = 1; i <= 5; i++) {
                appendSpoke(chain, DID_A, DID_B, i);
                appendSpoke(chain, DID_C, DID_D, i);
            }
            for (let i = 1; i <= 5; i++) {
                appendTradeSettled(chain, DID_A, DID_C, i + 10);
            }

            const currentTick = 100;
            await storage.snapshot(listener.allEdges(), currentTick);

            const loaded = await storage.loadSnapshot();

            expect(loaded.length).toBe(listener.size);

            // For each loaded edge, verify canonical byte-identity against the live Map
            for (const loadedEdge of loaded) {
                const key = sortedPairKey(loadedEdge.did_a, loadedEdge.did_b);
                const liveEdge = listener.getEdge(loadedEdge.did_a, loadedEdge.did_b);
                expect(liveEdge).toBeDefined();
                expect(canonicalEdge(loadedEdge)).toBe(canonicalEdge(liveEdge as Edge));
                // Also validate recency_tick coercion
                expect(typeof loadedEdge.recency_tick).toBe('number');
                expect(typeof loadedEdge.valence).toBe('number');
                expect(typeof loadedEdge.weight).toBe('number');
            }
        });
    });

    describe('Group 3: idempotent re-snapshot', () => {
        it('re-snapshot produces same row count — no duplicates (REPLACE INTO semantics)', async () => {
            const { pool, getRows } = makeInMemoryPool();
            const storage = new RelationshipStorage(pool);
            const chain = new AuditChain();
            const listener = new RelationshipListener(chain, DEFAULT_RELATIONSHIP_CONFIG);

            appendSpoke(chain, DID_A, DID_B, 1);
            appendTradeSettled(chain, DID_B, DID_C, 2);

            await storage.snapshot(listener.allEdges(), 50);
            const rowCountAfterFirst = getRows().size;

            // Snapshot again with identical data
            await storage.snapshot(listener.allEdges(), 51);
            const rowCountAfterSecond = getRows().size;

            expect(rowCountAfterFirst).toBe(rowCountAfterSecond);
            expect(rowCountAfterSecond).toBe(listener.size);
        });
    });

    describe('Group 4: updated-edge snapshot', () => {
        it('after a new bump, re-snapshot reflects new valence/weight/recency_tick', async () => {
            const { pool } = makeInMemoryPool();
            const storage = new RelationshipStorage(pool);
            const chain = new AuditChain();
            const listener = new RelationshipListener(chain, DEFAULT_RELATIONSHIP_CONFIG);

            appendSpoke(chain, DID_A, DID_B, 1);
            await storage.snapshot(listener.allEdges(), 10);
            const beforeLoaded = await storage.loadSnapshot();
            const beforeEdge = beforeLoaded.find(e =>
                sortedPairKey(e.did_a, e.did_b) === sortedPairKey(DID_A, DID_B)
            )!;
            expect(beforeEdge).toBeDefined();

            // Add another bump — weight and recency_tick change
            appendSpoke(chain, DID_A, DID_B, 50);
            await storage.snapshot(listener.allEdges(), 60);
            const afterLoaded = await storage.loadSnapshot();

            // Still one row per edge (REPLACE INTO: no duplicates)
            expect(afterLoaded.length).toBe(1);

            const afterEdge = afterLoaded.find(e =>
                sortedPairKey(e.did_a, e.did_b) === sortedPairKey(DID_A, DID_B)
            )!;
            expect(afterEdge).toBeDefined();
            expect(afterEdge.recency_tick).toBe(50);   // updated tick from second spoke
            expect(afterEdge.valence).toBeGreaterThan(beforeEdge.valence);
            expect(afterEdge.weight).toBeGreaterThan(beforeEdge.weight);

            // Canonical byte-identity holds for the updated edge too
            const liveEdge = listener.getEdge(DID_A, DID_B)!;
            expect(canonicalEdge(afterEdge)).toBe(canonicalEdge(liveEdge));
        });
    });

    describe('Group 5: empty-iterator snapshot', () => {
        it('empty iterator: returns early without issuing a query', async () => {
            const { pool, queryCalls } = makeInMemoryPool();
            const storage = new RelationshipStorage(pool);

            const emptyIter = (function* (): IterableIterator<Edge> {})();
            await storage.snapshot(emptyIter, 200);

            expect(queryCalls()).toBe(0);  // no SQL issued for empty iterator
        });
    });

    describe('Group 6: fire-and-forget error swallow', () => {
        it('scheduleSnapshot: does not throw when pool.query rejects', async () => {
            const { pool } = makeInMemoryPool();
            // Force pool.query to reject
            vi.spyOn(pool, 'query').mockRejectedValue(new Error('DB down'));
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            const storage = new RelationshipStorage(pool);
            const chain = new AuditChain();
            const listener = new RelationshipListener(chain, DEFAULT_RELATIONSHIP_CONFIG);
            appendSpoke(chain, DID_A, DID_B, 1);

            // scheduleSnapshot is fire-and-forget — must return immediately without throw
            expect(() => storage.scheduleSnapshot(listener.allEdges(), 300)).not.toThrow();

            // Wait for setImmediate to fire + snapshot() to settle
            await new Promise<void>(r => setImmediate(r));

            // Error was logged (console.warn) and swallowed — no unhandled rejection
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('relationships_snapshot_failed'),
            );

            warnSpy.mockRestore();
        });
    });
});
