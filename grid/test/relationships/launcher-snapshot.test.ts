/**
 * Phase 9 Gap Closure 09-07 — End-to-end launcher-level snapshot gate.
 *
 * HI-01 closure (09-VERIFICATION.md): proves the MySQL snapshot path is
 * REACHABLE in production code by exercising
 *   GenesisLauncher.bootstrap → attachRelationshipStorage → clock.onTick
 *   → scheduleSnapshot → pool.query
 * without bypassing the launcher (storage.test.ts constructs RelationshipStorage
 * directly and never goes through the launcher tick listener).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GenesisLauncher } from '../../src/genesis/launcher.js';
import type { Pool } from 'mysql2/promise';
import type { GenesisConfig } from '../../src/genesis/types.js';

function makeConfig(): GenesisConfig {
    return {
        gridName: 'test-grid',
        gridDomain: 'test.noesis',
        tickRateMs: 1_000_000,     // deterministic, no real wall-clock ticks
        ticksPerEpoch: 25,
        regions: [
            { id: 'agora', name: 'Agora', description: 'Test public square', regionType: 'public', capacity: 50, properties: {} },
        ],
        connections: [],
        laws: [],
        economy: {},
        seedNous: [],
        relationship: {
            tau: 1000,
            bumpSpokeValence: 0.01,
            bumpSpokeWeight: 0.02,
            bumpTradeSettledValence: 0.10,
            bumpTradeSettledWeight: 0.10,
            bumpTradeRejectedValence: -0.10,
            bumpTradeRejectedWeight: 0.05,
            bumpTelosRefinedValence: 0.05,
            bumpTelosRefinedWeight: 0.05,
            warmthColdMax: 0.20,
            warmthWarmMax: 0.60,
            snapshotCadenceTicks: 10,  // shrink cadence so test doesn't need 100 ticks
            topNDefault: 5,
            topNMax: 20,
        },
    };
}

/**
 * Advance the WorldClock N ticks. WorldClock.advance() is single-tick;
 * loop here to reach a snapshot cadence boundary deterministically without
 * wall-clock (D-9-12 forbids Date.now / setTimeout / setInterval / Math.random
 * in grid/src/relationships/**, but this is test code and uses the public
 * clock.advance() API — no wall-clock introduced).
 */
function advanceN(launcher: GenesisLauncher, n: number): void {
    for (let i = 0; i < n; i++) {
        launcher.clock.advance();
    }
}

describe('Launcher snapshot gate — HI-01 end-to-end (09-07)', () => {
    let launcher: GenesisLauncher;

    beforeEach(() => {
        launcher = new GenesisLauncher(makeConfig());
    });

    afterEach(() => {
        launcher.stop();
    });

    it('tick listener skips snapshot when no pool is attached (default/test path)', () => {
        launcher.bootstrap({ skipSeedNous: true });
        // No attachRelationshipStorage call.
        // Without an attached pool, the snapshot branch is a no-op and does
        // NOT throw — the launcher is operational in test-only mode.
        expect(() => advanceN(launcher, 10)).not.toThrow();
    });

    it('tick listener fires scheduleSnapshot on cadence boundary when pool is attached', async () => {
        launcher.bootstrap({ skipSeedNous: true });

        const queryMock = vi.fn(async () => [[], []] as never);
        const mockPool = { query: queryMock } as unknown as Pool;
        launcher.attachRelationshipStorage(mockPool);

        // Seed an edge via the audit chain so scheduleSnapshot has something
        // to write. Two nous.spoke events in opposite directions form a
        // bidirectional pair within the DialogueAggregator window (Phase 7),
        // which the RelationshipListener applies as a valence/weight bump.
        launcher.audit.append('nous.spoke', 'did:noesis:alpha', {
            name: 'alpha', channel: 'agora', text: 'hi', tick: 1, to_did: 'did:noesis:beta',
        });
        launcher.audit.append('nous.spoke', 'did:noesis:beta', {
            name: 'beta', channel: 'agora', text: 'hi back', tick: 2, to_did: 'did:noesis:alpha',
        });

        // Advance to a tick that is a multiple of snapshotCadenceTicks=10.
        advanceN(launcher, 10);

        // scheduleSnapshot → setImmediate → pool.query
        await new Promise<void>(resolve => setImmediate(resolve));
        await new Promise<void>(resolve => setImmediate(resolve));

        expect(queryMock).toHaveBeenCalled();
        const call = queryMock.mock.calls[0];
        expect(call[0]).toContain('REPLACE INTO relationships');
    });

    it('attachRelationshipStorage is idempotent for the same pool and throws for a different pool', () => {
        launcher.bootstrap({ skipSeedNous: true });
        const poolA = { query: async () => [[], []] as never } as unknown as Pool;
        const poolB = { query: async () => [[], []] as never } as unknown as Pool;
        launcher.attachRelationshipStorage(poolA);
        // same pool → no-op, no throw
        expect(() => launcher.attachRelationshipStorage(poolA)).not.toThrow();
        // different pool → throws
        expect(() => launcher.attachRelationshipStorage(poolB)).toThrow(/different pools/i);
    });
});
