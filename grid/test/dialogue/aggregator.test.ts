/**
 * Phase 7 Plan 01 Task 1 — DialogueAggregator behavioural tests (RED-first).
 *
 * Exercises D-01 (bidirectional trigger), D-02 (pair_key), D-04 (reset),
 * D-05 (channel gating + 5-utterance cap), D-08 (single dialogue_id per window),
 * D-11 (both participants see the same context).
 *
 * Production code does not yet exist → RED.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { DialogueAggregator } from '../../src/dialogue/index.js';

const DID_A = 'did:noesis:alpha';
const DID_B = 'did:noesis:beta';
const DID_C = 'did:noesis:gamma';

function appendSpoke(
    chain: AuditChain,
    speaker: string,
    tick: number,
    channel: string,
    text: string,
    name?: string,
): void {
    chain.append('nous.spoke', speaker, {
        name: name ?? speaker.split(':').pop(),
        channel,
        text,
        tick,
    });
}

describe('DialogueAggregator', () => {
    let chain: AuditChain;
    let aggregator: DialogueAggregator;

    beforeEach(() => {
        chain = new AuditChain();
        aggregator = new DialogueAggregator(chain, { windowTicks: 5, minExchanges: 2 });
    });

    it('emits 0 contexts when only 1 utterance observed', () => {
        appendSpoke(chain, DID_A, 1, 'agora', 'hello');
        expect(aggregator.drainPending(DID_A, 2)).toHaveLength(0);
        expect(aggregator.drainPending(DID_B, 2)).toHaveLength(0);
    });

    it('emits 1 DialogueContext to both participants when ≥minExchanges bidirectional utterances occur within windowTicks', () => {
        appendSpoke(chain, DID_A, 1, 'agora', 'hello');
        appendSpoke(chain, DID_B, 2, 'agora', 'hi there');

        const ctxForA = aggregator.drainPending(DID_A, 3);
        const ctxForB = aggregator.drainPending(DID_B, 3);

        expect(ctxForA).toHaveLength(1);
        expect(ctxForB).toHaveLength(1);

        const fromA = ctxForA[0];
        const fromB = ctxForB[0];

        expect(fromA.dialogue_id).toBe(fromB.dialogue_id);
        expect(fromA.dialogue_id).toMatch(/^[0-9a-f]{16}$/);
        expect(fromA.channel).toBe('agora');
        // Each participant sees the other as counterparty.
        expect(fromA.counterparty_did).toBe(DID_B);
        expect(fromB.counterparty_did).toBe(DID_A);
        expect(fromA.window_start_tick).toBe(1);
        expect(fromA.utterances.length).toBeGreaterThanOrEqual(2);
        expect(fromA.utterances.length).toBeLessThanOrEqual(5);
    });

    it('emits 0 contexts for unidirectional stream (same speaker repeating)', () => {
        appendSpoke(chain, DID_A, 1, 'agora', 'one');
        appendSpoke(chain, DID_A, 2, 'agora', 'two');
        appendSpoke(chain, DID_A, 3, 'agora', 'three');
        expect(aggregator.drainPending(DID_A, 4)).toHaveLength(0);
    });

    it('treats different channels as distinct dialogues (D-05 channel gating)', () => {
        appendSpoke(chain, DID_A, 1, 'channel-x', 'x1');
        appendSpoke(chain, DID_B, 2, 'channel-y', 'y1');
        // Cross-channel → no bidirectional pair on either channel.
        expect(aggregator.drainPending(DID_A, 3)).toHaveLength(0);
        expect(aggregator.drainPending(DID_B, 3)).toHaveLength(0);
    });

    it('does not emit beyond the window boundary (D-01 sliding window)', () => {
        appendSpoke(chain, DID_A, 1, 'agora', 'first');
        // Second utterance OUTSIDE the window (tick 1 + windowTicks=5 → must be <= tick 5 inclusive to be "within window";
        // tick 7 is beyond)
        appendSpoke(chain, DID_B, 8, 'agora', 'too late');

        expect(aggregator.drainPending(DID_A, 9)).toHaveLength(0);
        expect(aggregator.drainPending(DID_B, 9)).toHaveLength(0);
    });

    it('reset() drops all buffered state (D-04 pause drain)', () => {
        appendSpoke(chain, DID_A, 1, 'agora', 'pre');
        appendSpoke(chain, DID_B, 2, 'agora', 'pre-response');
        aggregator.reset();
        // After reset, even if we drain, no context should surface.
        expect(aggregator.drainPending(DID_A, 3)).toHaveLength(0);
        expect(aggregator.drainPending(DID_B, 3)).toHaveLength(0);
    });

    it('caps utterances at 5 (D-09 MAX 5 entries)', () => {
        // 10 alternating bidirectional utterances well within window
        for (let i = 0; i < 5; i++) {
            appendSpoke(chain, DID_A, i * 2 + 1, 'agora', `a-${i}`);
            appendSpoke(chain, DID_B, i * 2 + 2, 'agora', `b-${i}`);
        }
        const ctx = aggregator.drainPending(DID_A, 100);
        expect(ctx).toHaveLength(1);
        expect(ctx[0].utterances.length).toBeLessThanOrEqual(5);
    });

    it('truncates utterance text to 200 chars (D-09)', () => {
        const longText = 'x'.repeat(500);
        appendSpoke(chain, DID_A, 1, 'agora', longText);
        appendSpoke(chain, DID_B, 2, 'agora', 'short reply');
        const ctx = aggregator.drainPending(DID_A, 3);
        expect(ctx).toHaveLength(1);
        for (const u of ctx[0].utterances) {
            expect(u.text.length).toBeLessThanOrEqual(200);
        }
    });

    it('does not emit the same dialogue_id twice for the same window (D-08)', () => {
        appendSpoke(chain, DID_A, 1, 'agora', 'hi');
        appendSpoke(chain, DID_B, 2, 'agora', 'hello');
        const first = aggregator.drainPending(DID_A, 3);
        expect(first).toHaveLength(1);

        // Immediately drain again → no duplicate emission for the same window.
        const second = aggregator.drainPending(DID_A, 4);
        expect(second).toHaveLength(0);
    });

    it('does not emit for unrelated DID (third party)', () => {
        appendSpoke(chain, DID_A, 1, 'agora', 'hi');
        appendSpoke(chain, DID_B, 2, 'agora', 'hello');
        expect(aggregator.drainPending(DID_C, 3)).toHaveLength(0);
    });
});
