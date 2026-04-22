/**
 * Phase 9 Plan 06 Task 2 — REL-01 strict mode (chain-length delta).
 *
 * Proves RelationshipListener never calls audit.append — the chain length
 * before attaching the listener equals the chain length after arbitrary
 * listener activity (rebuild + 1000 getTopNFor calls).
 *
 * Two complementary approaches:
 *   1. Chain-length delta assertion (robust to mocking)
 *   2. Spy-based assertion (listener added zero append calls)
 *
 * Reference: D-9-13, SC#5, T-09-32.
 */

import { describe, it, expect, vi } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { RelationshipListener } from '../../src/relationships/listener.js';
import { DEFAULT_RELATIONSHIP_CONFIG } from '../../src/relationships/config.js';

// ─── Shared event sequence ───────────────────────────────────────────────────

interface FixedEvent {
    type: string;
    actorDid: string;
    payload: Record<string, unknown>;
    targetDid?: string;
}

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

    for (let i = 0; i < 100 && events.length < count; i++) {
        const fromDid = dids[i % dids.length];
        const toDid   = i === 0 ? fromDid : dids[(i + 1) % dids.length];
        events.push({
            type: 'nous.spoke',
            actorDid: fromDid,
            payload: {
                name: fromDid.split(':').pop(),
                channel: 'agora',
                text: `utterance-${i}`,
                tick,
                to_did: toDid,
            },
        });
        tick++;
    }

    for (let i = 0; i < 50 && events.length < count; i++) {
        events.push({
            type: 'trade.settled',
            actorDid: dids[i % dids.length],
            payload: {
                counterparty: dids[(i + 2) % dids.length],
                amount: i + 1,
                nonce: `nonce-${i}`,
                tick,
            },
        });
        tick++;
    }

    for (let i = 0; i < 50 && events.length < count; i++) {
        const verdict: 'pass' | 'fail' | 'reject' = i % 3 === 0 ? 'fail' : i % 3 === 1 ? 'reject' : 'pass';
        events.push({
            type: 'trade.reviewed',
            actorDid: 'did:noesis:reviewer',
            payload: {
                trade_id: `nonce-${i}`,
                reviewer_did: 'did:noesis:reviewer',
                verdict,
                proposer_did:     dids[i % dids.length],
                counterparty_did: dids[(i + 1) % dids.length],
                tick,
            },
        });
        tick++;
    }

    for (let i = 0; i < 50 && events.length < count; i++) {
        const nousDid    = dids[i % dids.length];
        const partnerDid = dids[(i + 3) % dids.length];
        events.push({
            type: 'telos.refined',
            actorDid: nousDid,
            payload: {
                did: nousDid,
                before_goal_hash: 'a'.repeat(64),
                after_goal_hash:  'b'.repeat(64),
                triggered_by_dialogue_id: 'abcd1234abcd1234',
                partner_did: partnerDid,
                tick,
            },
        });
        tick++;
    }

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

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('REL-01 no audit emit from relationships', () => {
    it('chain length is unchanged by listener activity', () => {
        const audit  = new AuditChain();
        const events = makeFixedEventSequence(500);
        for (const e of events) {
            audit.append(e.type, e.actorDid, e.payload, e.targetDid);
        }

        const chainLengthBeforeListener = audit.all().length;

        const listener = new RelationshipListener(audit, DEFAULT_RELATIONSHIP_CONFIG);
        listener.rebuildFromChain();

        // Simulate 1000 ticks of read activity — getTopNFor, no append.
        const firstDid = events.find(e => e.type === 'nous.spoke')?.actorDid ?? 'did:noesis:alpha';
        for (let tick = 0; tick < 1000; tick++) {
            listener.getTopNFor(firstDid, 5, tick);
        }

        const chainLengthAfterActivity = audit.all().length;
        expect(chainLengthAfterActivity).toBe(chainLengthBeforeListener);
    });

    it('audit.append is never called from within grid/src/relationships/** (spy-based)', () => {
        const audit = new AuditChain();
        const spy   = vi.spyOn(audit, 'append');

        // Emit 100 events from "test code" (legitimate callers).
        const events = makeFixedEventSequence(100);
        for (const e of events) {
            audit.append(e.type, e.actorDid, e.payload, e.targetDid);
        }
        const externalCount = spy.mock.calls.length;

        // Attach listener and drive all read-path activity.
        const listener = new RelationshipListener(audit, DEFAULT_RELATIONSHIP_CONFIG);
        listener.rebuildFromChain();
        for (let t = 0; t < 500; t++) {
            listener.getTopNFor('did:noesis:alpha', 5, t);
        }

        const totalCount = spy.mock.calls.length;
        // The listener must have contributed zero calls to audit.append.
        expect(totalCount).toBe(externalCount);

        spy.mockRestore();
    });
});
