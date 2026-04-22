/**
 * Phase 9 Plan 06 Task 1 — REL-01 pure-observer gate.
 *
 * Proves that attaching a RelationshipListener to AuditChain does NOT mutate
 * any entries[].eventHash. Clone of grid/test/dialogue/zero-diff.test.ts
 * substituting RelationshipListener for DialogueAggregator.
 *
 * Event mix includes: nous.spoke (bidirectional), trade.settled, trade.reviewed,
 * telos.refined, and unrelated events (nous.spawned, operator.inspected) to
 * exercise all code paths including the D-9-11 self-loop silent-reject.
 *
 * Reference: D-9-04, D-9-13, RESEARCH.md §Zero-diff.
 */

import { describe, it, expect, vi } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { RelationshipListener } from '../../src/relationships/listener.js';
import { DEFAULT_RELATIONSHIP_CONFIG } from '../../src/relationships/config.js';

// ─── Fixed deterministic event sequence ──────────────────────────────────────

interface FixedEvent {
    type: string;
    actorDid: string;
    payload: Record<string, unknown>;
    targetDid?: string;
}

/**
 * Generate a deterministic fixed sequence of events.
 *
 * Sequence contains (per plan requirement):
 *   100 nous.spoke  (some with to_did, some self-loops for D-9-11 exercise)
 *    50 trade.settled
 *    50 trade.reviewed
 *    50 telos.refined
 *   250 unrelated (nous.spawned, nous.moved, operator.inspected, etc.)
 *
 * Total ≥ 500 events. All ticks are monotonically increasing integers.
 */
function makeFixedEventSequence(count: number): FixedEvent[] {
    const events: FixedEvent[] = [];
    let tick = 1;

    const dids = [
        'did:noesis:alpha',
        'did:noesis:beta',
        'did:noesis:gamma',
        'did:noesis:delta',
        'did:noesis:epsilon',
    ];

    // 100 nous.spoke events (interleave pairs + one self-loop at index 0 for D-9-11 coverage)
    for (let i = 0; i < 100 && events.length < count; i++) {
        const fromDid = dids[i % dids.length];
        // Self-loop once at i===0 to exercise D-9-11 silent-reject without failing chain
        const toDid = i === 0 ? fromDid : dids[(i + 1) % dids.length];
        events.push({
            type: 'nous.spoke',
            actorDid: fromDid,
            payload: {
                name: fromDid.split(':').pop(),
                channel: i % 3 === 0 ? 'channel-b' : 'agora',
                text: `utterance-${i}`,
                tick,
                to_did: toDid,
            },
        });
        tick++;
    }

    // 50 trade.settled events
    for (let i = 0; i < 50 && events.length < count; i++) {
        const proposer = dids[i % dids.length];
        const counterparty = dids[(i + 2) % dids.length];
        events.push({
            type: 'trade.settled',
            actorDid: proposer,
            payload: {
                counterparty,
                amount: i + 1,
                nonce: `nonce-${i}`,
                tick,
            },
        });
        tick++;
    }

    // 50 trade.reviewed events (mix of pass and fail verdicts)
    for (let i = 0; i < 50 && events.length < count; i++) {
        const verdict: 'pass' | 'fail' | 'reject' = i % 3 === 0 ? 'fail' : i % 3 === 1 ? 'reject' : 'pass';
        events.push({
            type: 'trade.reviewed',
            actorDid: 'did:noesis:reviewer',
            payload: {
                trade_id: `nonce-${i}`,
                reviewer_did: 'did:noesis:reviewer',
                verdict,
                proposer_did: dids[i % dids.length],
                counterparty_did: dids[(i + 1) % dids.length],
                tick,
            },
        });
        tick++;
    }

    // 50 telos.refined events
    for (let i = 0; i < 50 && events.length < count; i++) {
        const nousDid = dids[i % dids.length];
        const partnerDid = dids[(i + 3) % dids.length];
        events.push({
            type: 'telos.refined',
            actorDid: nousDid,
            payload: {
                did: nousDid,
                before_goal_hash: 'a'.repeat(64),
                after_goal_hash: 'b'.repeat(64),
                triggered_by_dialogue_id: 'abcd1234abcd1234',
                partner_did: partnerDid,
                tick,
            },
        });
        tick++;
    }

    // 250 unrelated events (nous.spawned, nous.moved, operator.inspected, etc.)
    const unrelated = ['nous.spawned', 'nous.moved', 'operator.inspected', 'tick', 'grid.started'];
    for (let i = 0; i < 250 && events.length < count; i++) {
        events.push({
            type: unrelated[i % unrelated.length],
            actorDid: dids[i % dids.length],
            payload: { tick, info: `unrelated-${i}` },
        });
        tick++;
    }

    return events.slice(0, count);
}

// ─── Zero-diff test ───────────────────────────────────────────────────────────

describe('REL-01 zero-diff — listener attach does not alter chain', () => {
    it('entries[].eventHash is byte-identical with and without listener (≥500 events)', () => {
        // Freeze Date.now so both chains produce identical hashes.
        const nowSpy = vi.spyOn(Date, 'now');
        let fakeNow = 1_700_000_000_000;
        nowSpy.mockImplementation(() => (fakeNow += 1, fakeNow));

        const events = makeFixedEventSequence(500);

        const runSim = (withListener: boolean, extraListeners: number): string[] => {
            // Reset deterministic time to the same origin for each run.
            fakeNow = 1_700_000_000_000;
            const chain = new AuditChain();
            if (withListener) {
                // RelationshipListener wires its own onAppend inside the constructor.
                void new RelationshipListener(chain, DEFAULT_RELATIONSHIP_CONFIG);
            }
            for (let i = 0; i < extraListeners; i++) {
                chain.onAppend(() => {});
            }
            for (const e of events) {
                chain.append(e.type, e.actorDid, e.payload, e.targetDid);
            }
            return chain.all().map(entry => entry.eventHash);
        };

        const withNone     = runSim(false, 0);
        const withListener = runSim(true,  0);
        const withTen      = runSim(true,  10);

        // Core invariant: adding listeners (including RelationshipListener) is pure observation.
        expect(withListener.length).toBe(events.length);
        expect(withListener).toEqual(withNone);
        expect(withTen).toEqual(withNone);

        nowSpy.mockRestore();
    });

    it('prevHash chain is byte-identical with and without listener', () => {
        const nowSpy = vi.spyOn(Date, 'now');
        let fakeNow = 2_000_000_000_000;
        nowSpy.mockImplementation(() => (fakeNow += 1, fakeNow));

        const events = makeFixedEventSequence(100);

        const run = (withListener: boolean) => {
            fakeNow = 2_000_000_000_000;
            const chain = new AuditChain();
            if (withListener) {
                void new RelationshipListener(chain, DEFAULT_RELATIONSHIP_CONFIG);
            }
            for (const e of events) {
                chain.append(e.type, e.actorDid, e.payload, e.targetDid);
            }
            return chain.all().map(entry => ({ eventHash: entry.eventHash, prevHash: entry.prevHash }));
        };

        const plain    = run(false);
        const observed = run(true);

        for (let i = 0; i < plain.length; i++) {
            expect(observed[i].eventHash).toBe(plain[i].eventHash);
            expect(observed[i].prevHash).toBe(plain[i].prevHash);
        }

        nowSpy.mockRestore();
    });
});
