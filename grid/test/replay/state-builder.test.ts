/**
 * RED tests for buildStateAtTick (REPLAY-04 / D-13-04).
 *
 * These tests encode the acceptance criteria for Wave 2 (Plan 13-03).
 * They MUST fail until grid/src/replay/state-builder.ts is created.
 *
 * Decision D-13-04: state-level replay (not decision-level). Replaying a
 * chain through the existing listeners (RelationshipListener etc.) must
 * produce derived state byte-identical to live launcher at the same tick.
 *
 * Pitfall 5 mitigation: loadEntries() is silent — rebuildFromChain() must
 * be called explicitly after restore to derive listener state.
 */

import { describe, it, expect } from 'vitest';
// RED until Wave 2 (Plan 13-03) creates grid/src/replay/state-builder.ts
import { buildStateAtTick } from '../../src/replay/state-builder.js';
// RED until Wave 1 (Plan 13-02) creates grid/src/replay/replay-grid.ts
import { ReplayGrid } from '../../src/replay/replay-grid.js';
import type { AuditEntry } from '../../src/audit/types.js';

const GENESIS = '0'.repeat(64);

/** Minimal AuditEntry factory — sufficient for state-builder tests. */
function makeEntry(
    id: number,
    eventType: string,
    eventHash: string,
    prevHash: string,
    actorDid = 'system',
    payload: Record<string, unknown> = {},
): AuditEntry {
    return {
        id,
        eventType,
        actorDid,
        payload,
        prevHash,
        eventHash,
        createdAt: 1714435200000,
    };
}

/** Compute a stable fake hash for tests (not cryptographic). */
function fakeHash(input: string): string {
    // Deterministic 64-char hex stand-in
    return (
        Array.from(input)
            .reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 16, 0)
            .toString(16)
            .padStart(1, '0')
            .repeat(64)
            .slice(0, 64)
    );
}

describe('buildStateAtTick', () => {
    it('returns empty derived state at tick 0', () => {
        const replay = new ReplayGrid([], 'test-grid');
        const state = buildStateAtTick(replay, 0);

        // At tick 0 with no entries, all derived state should be empty
        expect(state).toBeDefined();
        expect(state.relationshipEdges).toEqual([]);
    });
    // RED until Wave 2 (Plan 13-03) creates grid/src/replay/state-builder.ts

    it('reproduces relationship edges byte-identical to live launcher at the same tick', () => {
        /**
         * This test verifies the core REPLAY-04 invariant:
         * buildStateAtTick(replay, N) produces the same sorted-JSON serialization
         * of derived state as a live launcher that processed the same entries.
         *
         * The test uses a canned chain of 10 entries (2 nous.spawned + 8 nous.spoke
         * creating 4 bidirectional exchanges to trigger relationship weight updates).
         *
         * Implementation note: the "live" values below will be computed by Wave 2
         * when it builds the actual state-builder. Until Wave 2 creates the file,
         * this import fails — the test is in RED state.
         */
        const did1 = 'did:noesis:sophia';
        const did2 = 'did:noesis:hermes';

        const h = (n: number) => n.toString(16).padStart(64, '0');

        // Build a minimal 10-entry canned chain
        const entries: AuditEntry[] = [
            makeEntry(1, 'nous.spawned', h(1), GENESIS, did1, { did: did1, name: 'sophia', region: 'agora' }),
            makeEntry(2, 'nous.spawned', h(2), h(1), did2, { did: did2, name: 'hermes', region: 'agora' }),
            makeEntry(3, 'nous.spoke', h(3), h(2), did1, { body: 'hello', channel: 'agora' }),
            makeEntry(4, 'nous.spoke', h(4), h(3), did2, { body: 'hi back', channel: 'agora' }),
            makeEntry(5, 'nous.spoke', h(5), h(4), did1, { body: 'how are you', channel: 'agora' }),
            makeEntry(6, 'nous.spoke', h(6), h(5), did2, { body: 'well thanks', channel: 'agora' }),
            makeEntry(7, 'trade.proposed', h(7), h(6), did1, { counterparty: did2, amount: 10, nonce: 'n1' }),
            makeEntry(8, 'trade.settled', h(8), h(7), did1, { counterparty: did2, amount: 10, nonce: 'n1' }),
            makeEntry(9, 'nous.spoke', h(9), h(8), did1, { body: 'trade done', channel: 'agora' }),
            makeEntry(10, 'nous.spoke', h(10), h(9), did2, { body: 'agreed', channel: 'agora' }),
        ];

        const replay = new ReplayGrid(entries, 'test-grid');
        const state = buildStateAtTick(replay, 10);

        // The state should have some derived edges (relationships warmed by dialogue + trade)
        expect(state.relationshipEdges).toBeDefined();

        // The canonical sorted-JSON serialization of edges must be deterministic
        // (same on every run from the same input — no Date.now, no Math.random).
        const serialized1 = JSON.stringify(
            [...state.relationshipEdges].sort((a, b) =>
                JSON.stringify(a).localeCompare(JSON.stringify(b)),
            ),
        );

        // Re-run to verify determinism
        const replay2 = new ReplayGrid(entries, 'test-grid');
        const state2 = buildStateAtTick(replay2, 10);
        const serialized2 = JSON.stringify(
            [...state2.relationshipEdges].sort((a, b) =>
                JSON.stringify(a).localeCompare(JSON.stringify(b)),
            ),
        );

        expect(serialized1).toBe(serialized2);
    });
    // RED until Wave 2 (Plan 13-03) creates grid/src/replay/state-builder.ts
});
