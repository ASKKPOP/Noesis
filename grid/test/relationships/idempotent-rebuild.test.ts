/**
 * Phase 9 Plan 06 Task 1 — REL-02 idempotent rebuild gate.
 *
 * Proves two consecutive rebuildFromChain() calls produce byte-identical
 * canonical snapshots. Also proves a fresh listener's single rebuild matches.
 *
 * Uses canonicalEdge(edge) for byte-identity comparison (D-9-10: 6-key order +
 * toFixed(3) fixed-point floats). Asserts string equality — NOT deep equal —
 * so any float drift produces a failing test (P-9-03 float-drift guard).
 */

import { describe, it, expect, vi } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { RelationshipListener } from '../../src/relationships/listener.js';
import { DEFAULT_RELATIONSHIP_CONFIG } from '../../src/relationships/config.js';
import { canonicalEdge } from '../../src/relationships/canonical.js';
import type { Edge } from '../../src/relationships/types.js';

// ─── Shared helpers ──────────────────────────────────────────────────────────

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

    // nous.spoke events (some with to_did, one self-loop for D-9-11 path coverage)
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
        const proposer     = dids[i % dids.length];
        const counterparty = dids[(i + 2) % dids.length];
        events.push({
            type: 'trade.settled',
            actorDid: proposer,
            payload: { counterparty, amount: i + 1, nonce: `nonce-${i}`, tick },
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
        const nousDid   = dids[i % dids.length];
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

/**
 * Produce a canonical JSON string from all edges in a listener.
 * Sort by (did_a|did_b) key for deterministic ordering.
 */
function snapshotCanonical(listener: RelationshipListener): string {
    const edges: Edge[] = Array.from(listener.allEdges());
    edges.sort((a, b) => {
        const ka = `${a.did_a}|${a.did_b}`;
        const kb = `${b.did_a}|${b.did_b}`;
        return ka.localeCompare(kb);
    });
    return JSON.stringify(edges.map(e => canonicalEdge(e)));
}

// ─── REL-02 idempotent rebuild tests ─────────────────────────────────────────

describe('REL-02 idempotent rebuild', () => {
    it('two consecutive rebuildFromChain() calls produce byte-identical canonical snapshots', () => {
        const nowSpy = vi.spyOn(Date, 'now');
        let fakeNow = 1_700_000_000_000;
        nowSpy.mockImplementation(() => (fakeNow += 1, fakeNow));

        const audit = new AuditChain();
        const events = makeFixedEventSequence(500);
        for (const e of events) {
            audit.append(e.type, e.actorDid, e.payload, e.targetDid);
        }

        const listener = new RelationshipListener(audit, DEFAULT_RELATIONSHIP_CONFIG);
        listener.rebuildFromChain();
        const snapshotA = snapshotCanonical(listener);

        listener.rebuildFromChain();  // second rebuild — MUST NOT drift
        const snapshotB = snapshotCanonical(listener);

        // String equality — not deep equal — so any float drift fails this assertion.
        expect(snapshotB).toBe(snapshotA);

        nowSpy.mockRestore();
    });

    it('fresh listener single rebuild matches double rebuild result', () => {
        const nowSpy = vi.spyOn(Date, 'now');
        let fakeNow = 1_800_000_000_000;
        nowSpy.mockImplementation(() => (fakeNow += 1, fakeNow));

        const audit = new AuditChain();
        const events = makeFixedEventSequence(300);
        for (const e of events) {
            audit.append(e.type, e.actorDid, e.payload, e.targetDid);
        }

        // Double rebuild
        const listenerA = new RelationshipListener(audit, DEFAULT_RELATIONSHIP_CONFIG);
        listenerA.rebuildFromChain();
        listenerA.rebuildFromChain();
        const snapshotA = snapshotCanonical(listenerA);

        // Fresh listener, single rebuild
        const listenerB = new RelationshipListener(audit, DEFAULT_RELATIONSHIP_CONFIG);
        listenerB.rebuildFromChain();
        const snapshotB = snapshotCanonical(listenerB);

        expect(snapshotB).toBe(snapshotA);

        nowSpy.mockRestore();
    });

    it('rebuild is idempotent under P-9-03 float drift — canonicalEdge absorbs sub-3-decimal differences', () => {
        // Guard: canonicalEdge uses toFixed(3) so values differing only in the 4th+
        // decimal must produce identical strings.
        const edge1: Edge = {
            did_a: 'did:noesis:0001',
            did_b: 'did:noesis:0002',
            valence: 0.123456,
            weight:  0.567891,
            recency_tick: 100,
            last_event_hash: 'a'.repeat(64),
        };
        const edge2: Edge = {
            ...edge1,
            valence: 0.123499,  // rounds to same "0.123" at toFixed(3)
            weight:  0.567899,  // rounds to same "0.568" at toFixed(3)
        };
        // Both canonicalEdge strings should be the same — toFixed(3) absorbs the drift.
        expect(canonicalEdge(edge1)).toBe(canonicalEdge(edge2));
    });
});
