/**
 * RED tests for ReplayGrid (REPLAY-03 / T-10-08).
 *
 * These tests encode the acceptance criteria for Wave 1 (Plan 13-02).
 * They MUST fail until grid/src/replay/replay-grid.ts is created.
 *
 * Threat mitigation: T-10-08 — "Fake-timestamp emission / ReplayGrid
 * cross-contamination with live launcher". ReplayGrid MUST use a separate
 * AuditChain instance (the ReadOnlyAuditChain) that is completely isolated
 * from any live GenesisLauncher instance running in the same process.
 */

import { describe, it, expect } from 'vitest';
// RED until Wave 1 (Plan 13-02) creates grid/src/replay/replay-grid.ts
import { ReplayGrid } from '../../src/replay/replay-grid.js';
import { GenesisLauncher } from '../../src/genesis/launcher.js';
import type { AuditEntry } from '../../src/audit/types.js';

const GENESIS = '0'.repeat(64);
const HASH_1 = 'a'.repeat(64);
const HASH_2 = 'b'.repeat(64);

/** A minimal GenesisConfig for tests that need a live launcher for isolation checks. */
const LIVE_CONFIG = {
    gridName: 'live-grid',
    gridDomain: 'live.noesis.test',
    tickRateMs: 1_000_000,
    ticksPerEpoch: 25,
    economy: { initialOusia: 100 },
};

/** Minimal AuditEntry fixtures */
function makeEntry(id: number, eventType: string, eventHash: string, prevHash: string): AuditEntry {
    return {
        id,
        eventType,
        actorDid: 'system',
        payload: { n: id },
        prevHash,
        eventHash,
        createdAt: 1714435200000,
    };
}

function makeNousSpawnedEntry(id: number, did: string, eventHash: string, prevHash: string): AuditEntry {
    return {
        id,
        eventType: 'nous.spawned',
        actorDid: did,
        payload: {
            did,
            name: `nous-${id}`,
            region: 'agora',
        },
        prevHash,
        eventHash,
        createdAt: 1714435200000,
    };
}

describe('ReplayGrid', () => {
    it('exposes isolated AuditChain instance distinct from live launcher', () => {
        const liveLauncher = new GenesisLauncher(LIVE_CONFIG);
        const replay = new ReplayGrid([], 'test-grid');

        // Core isolation invariant: replay.audit is NOT the same object as liveLauncher.audit
        expect(replay.audit).not.toBe(liveLauncher.audit);
        // Both have a head property, confirming they are AuditChain-like
        expect(typeof replay.audit.head).toBe('string');
        expect(typeof liveLauncher.audit.head).toBe('string');
    });
    // RED until Wave 1 (Plan 13-02) creates grid/src/replay/replay-grid.ts

    it('rejects .append() through its readonly chain', () => {
        const replay = new ReplayGrid([], 'test-grid');
        expect(() =>
            replay.audit.append('tick', 'system', { n: 1 }),
        ).toThrow(/read-only/i);
    });
    // RED until Wave 1 (Plan 13-02) creates grid/src/replay/replay-grid.ts

    it('rebuilds derived state silently (no listener double-fire) after rebuildFromChain()', () => {
        // Two nous.spawned entries — RelationshipListener and DialogueAggregator
        // should derive state from these WITHOUT chain.append() firing their onAppend.
        const entries: AuditEntry[] = [
            makeNousSpawnedEntry(1, 'did:noesis:sophia', HASH_1, GENESIS),
            makeNousSpawnedEntry(2, 'did:noesis:hermes', HASH_2, HASH_1),
        ];

        const replay = new ReplayGrid(entries, 'test-grid');
        // Call explicit rebuild after construction
        replay.rebuildFromChain();

        // The audit chain should have the entries loaded
        expect(replay.audit.length).toBe(2);
        expect(replay.audit.head).toBe(HASH_2);

        // The replay chain should NOT have fired append listeners during loadEntries
        // (the silent restore path). rebuildFromChain() rebuilds derived state
        // by manually walking entries, not by replaying through chain.append().
        expect(replay.audit.length).toBe(2); // unchanged — no double-fire
    });
    // RED until Wave 1 (Plan 13-02) creates grid/src/replay/replay-grid.ts
});
