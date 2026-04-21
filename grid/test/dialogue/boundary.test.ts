/**
 * Phase 7 Plan 01 Task 3 — DIALOG-01 SC#5 boundary + D-04 pause-drain tests
 * (RED-first).
 *
 * Covers:
 *   - SC#5: bidirectional utterances at tick T and T+windowTicks-1 emit a
 *     context; utterances at T and T+windowTicks+1 do NOT (crosses the window
 *     boundary).
 *   - D-04: WorldClock.pause() → aggregator.reset() so a dialogue window
 *     cannot bridge the pause boundary.
 *   - GenesisLauncher exposes `aggregator` publicly so coordinator + tests
 *     can reach it (the wiring seam for Plan 03 handler + test harness).
 *
 * Imports GenesisLauncher (exists) + DialogueAggregator (exists after Task 1).
 * The launcher.aggregator field does not yet exist → RED.
 */

import { describe, it, expect } from 'vitest';
import { GenesisLauncher } from '../../src/genesis/launcher.js';
import { DialogueAggregator } from '../../src/dialogue/index.js';
import type { GenesisConfig } from '../../src/genesis/types.js';

const DID_A = 'did:noesis:alpha';
const DID_B = 'did:noesis:beta';

function minimalConfig(dialogue?: { windowTicks: number; minExchanges: number }): GenesisConfig & { dialogue?: { windowTicks: number; minExchanges: number } } {
    return {
        gridName: 'test-grid',
        gridDomain: 'test.noesis',
        tickRateMs: 100_000, // effectively stopped for unit tests
        ticksPerEpoch: 100,
        regions: [{ id: 'agora', name: 'Agora', description: 'test region' }],
        connections: [],
        laws: [],
        economy: {},
        seedNous: [],
        ...(dialogue ? { dialogue } : {}),
    } as GenesisConfig & { dialogue?: { windowTicks: number; minExchanges: number } };
}

describe('DialogueAggregator — boundary & pause-drain (Phase 7 SC#5 + D-04)', () => {
    it('GenesisLauncher.aggregator is a live DialogueAggregator instance', () => {
        const launcher = new GenesisLauncher(minimalConfig());
        launcher.bootstrap({ skipSeedNous: true });

        expect(launcher.aggregator).toBeInstanceOf(DialogueAggregator);
    });

    it.each([3, 5, 7])(
        'windowTicks=%i: utterances at T and T+windowTicks-1 emit (within window)',
        (windowTicks) => {
            const launcher = new GenesisLauncher(
                minimalConfig({ windowTicks, minExchanges: 2 }),
            );
            launcher.bootstrap({ skipSeedNous: true });

            const T = 10;
            launcher.audit.append('nous.spoke', DID_A, {
                name: 'alpha', channel: 'agora', text: 'hi', tick: T,
            });
            launcher.audit.append('nous.spoke', DID_B, {
                name: 'beta', channel: 'agora', text: 'hi back', tick: T + windowTicks - 1,
            });

            const ctx = launcher.aggregator.drainPending(DID_A, T + windowTicks);
            expect(ctx).toHaveLength(1);
            expect(ctx[0].channel).toBe('agora');
            expect(ctx[0].counterparty_did).toBe(DID_B);
        },
    );

    it.each([3, 5, 7])(
        'windowTicks=%i: utterances at T and T+windowTicks+1 do NOT emit (outside window)',
        (windowTicks) => {
            const launcher = new GenesisLauncher(
                minimalConfig({ windowTicks, minExchanges: 2 }),
            );
            launcher.bootstrap({ skipSeedNous: true });

            const T = 10;
            launcher.audit.append('nous.spoke', DID_A, {
                name: 'alpha', channel: 'agora', text: 'hi', tick: T,
            });
            launcher.audit.append('nous.spoke', DID_B, {
                name: 'beta', channel: 'agora', text: 'too late', tick: T + windowTicks + 1,
            });

            const ctx = launcher.aggregator.drainPending(DID_A, T + windowTicks + 2);
            expect(ctx).toHaveLength(0);
        },
    );

    it('pause-drain (D-04): WorldClock pause resets aggregator so windows cannot span the pause', () => {
        const launcher = new GenesisLauncher(
            minimalConfig({ windowTicks: 5, minExchanges: 2 }),
        );
        launcher.bootstrap({ skipSeedNous: true });

        // Pre-pause: A speaks on agora.
        launcher.audit.append('nous.spoke', DID_A, {
            name: 'alpha', channel: 'agora', text: 'pre', tick: 1,
        });

        // Operator pauses the clock. The launcher wiring MUST drain the aggregator.
        launcher.clock.start(); // otherwise pause() no-ops per ticker.ts:52
        launcher.drainDialogueOnPause();

        // Post-pause-resume: B speaks within 5 ticks of A's pre-pause utterance.
        launcher.audit.append('nous.spoke', DID_B, {
            name: 'beta', channel: 'agora', text: 'post', tick: 3,
        });

        // A dialogue must NOT have formed across the pause boundary.
        const ctxA = launcher.aggregator.drainPending(DID_A, 4);
        const ctxB = launcher.aggregator.drainPending(DID_B, 4);
        expect(ctxA).toHaveLength(0);
        expect(ctxB).toHaveLength(0);
    });
});
