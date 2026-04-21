/**
 * Phase 7 Plan 01 Task 1 — Zero-diff determinism gate (RED-first).
 *
 * DIALOG-01 invariant: adding a DialogueAggregator listener to AuditChain
 * MUST NOT mutate any `entries[].eventHash`. Proof: run the SAME 100-append
 * nous.spoke scenario twice (0 vs 10 listeners, with one of the listeners
 * being the DialogueAggregator) and assert entries[].eventHash is byte-identical.
 *
 * Mirrors grid/test/audit.test.ts:253-281 (the canonical zero-diff template)
 * and extends it with a dialogue aggregator attached as one of the listeners.
 */

import { describe, it, expect, vi } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { DialogueAggregator } from '../../src/dialogue/index.js';

describe('dialogue — zero-diff determinism', () => {
    it('100 nous.spoke appends with 0 vs N aggregator+passive listeners produce byte-identical chain entries', () => {
        // Freeze Date.now so createdAt is deterministic across both runs.
        const nowSpy = vi.spyOn(Date, 'now');
        let fakeNow = 1_700_000_000_000;
        nowSpy.mockImplementation(() => {
            fakeNow += 1;
            return fakeNow;
        });

        const runSim = (listenerCount: number, withAggregator: boolean): string[] => {
            fakeNow = 1_700_000_000_000; // reset before each run
            const c = new AuditChain();
            if (withAggregator) {
                // Aggregator wires its own onAppend inside the constructor.
                void new DialogueAggregator(c, { windowTicks: 5, minExchanges: 2 });
            }
            for (let i = 0; i < listenerCount; i++) c.onAppend(() => {});

            // 100 nous.spoke appends alternating between two speakers on two channels.
            // Enough entries to traverse many dialogue windows & stress the aggregator.
            const dids = ['did:noesis:alpha', 'did:noesis:beta'];
            for (let i = 0; i < 100; i++) {
                const speaker = dids[i % 2];
                c.append('nous.spoke', speaker, {
                    name: speaker.split(':').pop(),
                    channel: i % 10 === 0 ? 'channel-b' : 'channel-a',
                    text: `utterance-${i}`,
                    tick: i + 1,
                });
            }
            return c.all().map(e => e.eventHash);
        };

        const withNone = runSim(0, false);
        const withAggOnly = runSim(0, true);
        const withTen = runSim(10, true);

        // Core invariant: adding listeners (including aggregator) is a pure observation.
        expect(withAggOnly).toEqual(withNone);
        expect(withTen).toEqual(withNone);
        expect(withTen).toHaveLength(100);

        nowSpy.mockRestore();
    });
});
