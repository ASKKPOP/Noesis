/**
 * Phase 9 Plan 02 Task 2 — RelationshipListener unit tests.
 *
 * Covers:
 *   Group A — Bump-table correctness (D-9-02, all four event types)
 *   Group B — Clamping at ±1 / [0,1] boundaries (REL-01)
 *   Group C — Self-loop silent-reject (D-9-11, all four event types)
 *   Group D — Rebuild idempotency (REL-02, canonicalEdge byte-identity)
 *   Group E — Unrecognized event types silently ignored
 *   Group F — Zero audit emit: listener adds zero entries (REL-01 hard invariant)
 *
 * Fixture pattern: construct a fresh AuditChain per test, then a fresh
 * RelationshipListener(chain, DEFAULT_RELATIONSHIP_CONFIG).
 * Mirrors grid/test/dialogue/aggregator.test.ts (same-project analog).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { RelationshipListener } from '../../src/relationships/listener.js';
import { DEFAULT_RELATIONSHIP_CONFIG } from '../../src/relationships/config.js';
import { canonicalEdge, sortedPairKey } from '../../src/relationships/canonical.js';

// ─── stable test DIDs ───────────────────────────────────────────────────────

const DID_A = 'did:noesis:alpha';
const DID_B = 'did:noesis:beta';
const DID_C = 'did:noesis:gamma';
const DID_D = 'did:noesis:delta';
const DID_E = 'did:noesis:epsilon';

// ─── helper emitters ────────────────────────────────────────────────────────

/** Emit a nous.spoke entry with from_did / to_did in payload so listener can form a pair. */
function appendSpoke(chain: AuditChain, fromDid: string, toDid: string, tick = 1): void {
    chain.append('nous.spoke', fromDid, {
        name: fromDid.split(':').pop(),
        channel: 'agora',
        text: 'hello',
        tick,
        to_did: toDid,
    });
}

/** Emit a trade.settled entry: actorDid=proposer, payload.counterparty=counterparty. */
function appendTradeSettled(chain: AuditChain, proposer: string, counterparty: string, tick = 1): void {
    chain.append('trade.settled', proposer, {
        counterparty,
        amount: 10,
        nonce: 'nonce-1',
        tick,
    });
}

/**
 * Emit a trade.reviewed entry with both participant DIDs.
 * The listener extracts proposer_did + counterparty_did from the payload
 * (the Phase 5 production payload carries reviewer-only fields; the listener
 * requires test fixtures to inject participant DIDs for relationship coverage).
 */
function appendTradeReviewed(
    chain: AuditChain,
    proposerDid: string,
    counterpartyDid: string,
    verdict: 'pass' | 'fail' | 'reject',
    tick = 1,
): void {
    chain.append('trade.reviewed', 'did:noesis:reviewer', {
        trade_id: 'nonce-1',
        reviewer_did: 'did:noesis:reviewer',
        verdict,
        proposer_did: proposerDid,
        counterparty_did: counterpartyDid,
        tick,
    });
}

/** Emit a telos.refined entry with an explicit partner_did for relationship coverage. */
function appendTelosRefined(chain: AuditChain, nousDid: string, partnerDid: string, tick = 1): void {
    chain.append('telos.refined', nousDid, {
        did: nousDid,
        before_goal_hash: 'a'.repeat(64),
        after_goal_hash: 'b'.repeat(64),
        triggered_by_dialogue_id: 'abcd1234abcd1234',
        partner_did: partnerDid,
        tick,
    });
}

// ─── shared setup ────────────────────────────────────────────────────────────

let chain: AuditChain;
let listener: RelationshipListener;

beforeEach(() => {
    chain = new AuditChain();
    listener = new RelationshipListener(chain, DEFAULT_RELATIONSHIP_CONFIG);
});

// ─── Group A: Bump-table correctness ─────────────────────────────────────────

describe('Group A — Bump-table correctness (D-9-02)', () => {
    it('nous.spoke → valence +0.01, weight +0.02', () => {
        appendSpoke(chain, DID_A, DID_B, 1);
        const edge = listener.getEdge(DID_A, DID_B);
        expect(edge).toBeDefined();
        expect(edge!.valence).toBeCloseTo(0.01, 10);
        expect(edge!.weight).toBeCloseTo(0.02, 10);
        expect(edge!.recency_tick).toBe(1);
    });

    it('trade.settled → valence +0.10, weight +0.10', () => {
        appendTradeSettled(chain, DID_A, DID_B, 2);
        const edge = listener.getEdge(DID_A, DID_B);
        expect(edge).toBeDefined();
        expect(edge!.valence).toBeCloseTo(0.10, 10);
        expect(edge!.weight).toBeCloseTo(0.10, 10);
        expect(edge!.recency_tick).toBe(2);
    });

    it('trade.reviewed with reject verdict → valence -0.10, weight +0.05 (still counts as contact)', () => {
        appendTradeReviewed(chain, DID_A, DID_B, 'reject', 3);
        const edge = listener.getEdge(DID_A, DID_B);
        expect(edge).toBeDefined();
        expect(edge!.valence).toBeCloseTo(-0.10, 10);
        expect(edge!.weight).toBeCloseTo(0.05, 10);
        expect(edge!.recency_tick).toBe(3);
    });

    it('trade.reviewed with pass verdict → edge unchanged (no bump)', () => {
        appendTradeReviewed(chain, DID_A, DID_B, 'pass', 4);
        // Listener ignores 'pass' verdict — no edge created.
        const edge = listener.getEdge(DID_A, DID_B);
        expect(edge).toBeUndefined();
        expect(listener.size).toBe(0);
    });

    it('telos.refined → valence +0.05, weight +0.05', () => {
        appendTelosRefined(chain, DID_A, DID_B, 5);
        const edge = listener.getEdge(DID_A, DID_B);
        expect(edge).toBeDefined();
        expect(edge!.valence).toBeCloseTo(0.05, 10);
        expect(edge!.weight).toBeCloseTo(0.05, 10);
        expect(edge!.recency_tick).toBe(5);
    });

    it('mixed sequence: spoke + settled + refined → accumulated valence and weight', () => {
        appendSpoke(chain, DID_A, DID_B, 1);        // +0.01 valence, +0.02 weight
        appendTradeSettled(chain, DID_A, DID_B, 2); // +0.10 valence, +0.10 weight
        appendTelosRefined(chain, DID_A, DID_B, 3); // +0.05 valence, +0.05 weight
        // Total: 0.16 valence, 0.17 weight (all below clamping boundary)
        const edge = listener.getEdge(DID_A, DID_B);
        expect(edge).toBeDefined();
        expect(edge!.valence).toBeCloseTo(0.16, 10);
        expect(edge!.weight).toBeCloseTo(0.17, 10);
        expect(edge!.recency_tick).toBe(3);
    });
});

// ─── Group B: Clamping ────────────────────────────────────────────────────────

describe('Group B — Clamping (REL-01 + RESEARCH.md lines 624-628)', () => {
    it('valence caps at +1.0 after repeated trade.settled (15 × 0.10 = 1.5 → clamped)', () => {
        for (let i = 1; i <= 15; i++) {
            appendTradeSettled(chain, DID_A, DID_B, i);
        }
        const edge = listener.getEdge(DID_A, DID_B);
        expect(edge).toBeDefined();
        expect(edge!.valence).toBe(1.0);
        expect(edge!.weight).toBe(1.0);
    });

    it('valence caps at -1.0 after repeated trade.reviewed reject (15 × -0.10 = -1.5 → clamped)', () => {
        for (let i = 1; i <= 15; i++) {
            appendTradeReviewed(chain, DID_A, DID_B, 'reject', i);
        }
        const edge = listener.getEdge(DID_A, DID_B);
        expect(edge).toBeDefined();
        expect(edge!.valence).toBe(-1.0);
        // weight still rises via +0.05 contact bumps; after 15 → 0.75 (below 1.0)
        expect(edge!.weight).toBeLessThanOrEqual(1.0);
        expect(edge!.weight).toBeGreaterThan(0);
    });

    it('valence starts at 0 for a new edge (not pre-seeded at extremes)', () => {
        appendSpoke(chain, DID_A, DID_B, 1);
        const edge = listener.getEdge(DID_A, DID_B);
        // After one nous.spoke, valence = +0.01 (not pre-seeded to ±1)
        expect(edge!.valence).toBeCloseTo(0.01, 10);
        expect(edge!.weight).toBeCloseTo(0.02, 10);
    });
});

// ─── Group C: Self-loop silent-reject ─────────────────────────────────────────

describe('Group C — Self-loop silent-reject (D-9-11)', () => {
    it('nous.spoke self-loop → no edge created, no throw', () => {
        expect(() => appendSpoke(chain, DID_A, DID_A, 1)).not.toThrow();
        expect(listener.size).toBe(0);
        // Audit chain still recorded the entry — listener did not interfere.
        expect(chain.length).toBe(1);
    });

    it('trade.settled self-loop → no edge, no throw', () => {
        expect(() => chain.append('trade.settled', DID_A, {
            counterparty: DID_A, amount: 10, nonce: 'n', tick: 1,
        })).not.toThrow();
        expect(listener.size).toBe(0);
    });

    it('trade.reviewed self-loop → no edge, no throw', () => {
        expect(() => chain.append('trade.reviewed', 'did:noesis:reviewer', {
            trade_id: 'n', reviewer_did: 'did:noesis:reviewer', verdict: 'fail',
            proposer_did: DID_A, counterparty_did: DID_A, tick: 1,
        })).not.toThrow();
        expect(listener.size).toBe(0);
    });

    it('telos.refined self-loop → no edge, no throw', () => {
        expect(() => chain.append('telos.refined', DID_A, {
            did: DID_A, before_goal_hash: 'a'.repeat(64), after_goal_hash: 'b'.repeat(64),
            triggered_by_dialogue_id: 'abcd1234abcd1234',
            partner_did: DID_A, tick: 1,
        })).not.toThrow();
        expect(listener.size).toBe(0);
    });
});

// ─── Group D: Rebuild idempotency ─────────────────────────────────────────────

describe('Group D — Rebuild idempotency (REL-02)', () => {
    it('rebuildFromChain produces byte-identical Map to live listener', () => {
        // Build chain with 20 mixed events across 5 DIDs.
        const dids = [DID_A, DID_B, DID_C, DID_D, DID_E];
        let tick = 1;

        // Various event combinations across pairs.
        appendSpoke(chain, dids[0], dids[1], tick++);
        appendSpoke(chain, dids[1], dids[0], tick++);
        appendTradeSettled(chain, dids[0], dids[2], tick++);
        appendSpoke(chain, dids[2], dids[3], tick++);
        appendTelosRefined(chain, dids[1], dids[3], tick++);
        appendTradeReviewed(chain, dids[0], dids[4], 'reject', tick++);
        appendSpoke(chain, dids[3], dids[4], tick++);
        appendTradeSettled(chain, dids[2], dids[4], tick++);
        appendSpoke(chain, dids[0], dids[3], tick++);
        appendTelosRefined(chain, dids[2], dids[1], tick++);
        appendTradeSettled(chain, dids[1], dids[4], tick++);
        appendSpoke(chain, dids[4], dids[2], tick++);
        appendTradeReviewed(chain, dids[3], dids[1], 'fail', tick++);
        appendSpoke(chain, dids[0], dids[2], tick++);
        appendTradeSettled(chain, dids[3], dids[4], tick++);
        appendSpoke(chain, dids[1], dids[2], tick++);
        appendTelosRefined(chain, dids[0], dids[4], tick++);
        appendTradeSettled(chain, dids[2], dids[3], tick++);
        appendSpoke(chain, dids[4], dids[0], tick++);
        appendSpoke(chain, dids[3], dids[2], tick++);

        // Capture live listener's Map using canonicalEdge for byte-identity comparison.
        const liveSnapshot = new Map<string, string>();
        for (const edge of listener.allEdges()) {
            const key = sortedPairKey(edge.did_a, edge.did_b);
            liveSnapshot.set(key, canonicalEdge(edge));
        }

        // Construct a fresh listener on the SAME chain and rebuild.
        const rebuild = new RelationshipListener(chain, DEFAULT_RELATIONSHIP_CONFIG);
        rebuild.rebuildFromChain();

        const rebuiltSnapshot = new Map<string, string>();
        for (const edge of rebuild.allEdges()) {
            const key = sortedPairKey(edge.did_a, edge.did_b);
            rebuiltSnapshot.set(key, canonicalEdge(edge));
        }

        // Assert byte-identical Maps.
        expect(rebuiltSnapshot.size).toBe(liveSnapshot.size);
        for (const [key, canonical] of liveSnapshot) {
            expect(rebuiltSnapshot.get(key)).toBe(canonical);
        }
    });
});

// ─── Group E: Unrecognized event types ────────────────────────────────────────

describe('Group E — Unrecognized event types silently ignored', () => {
    it('nous.spawned (not in bump table) → no edge, no throw', () => {
        expect(() => chain.append('nous.spawned', DID_A, { tick: 1 })).not.toThrow();
        expect(listener.size).toBe(0);
    });

    it('operator.inspected (Phase 6 event) → no edge, no throw', () => {
        expect(() => chain.append('operator.inspected', DID_A, { tick: 1 })).not.toThrow();
        expect(listener.size).toBe(0);
    });
});

// ─── Group F: Zero audit emit ─────────────────────────────────────────────────

describe('Group F — Zero audit emit (REL-01 hard invariant, D-9-13)', () => {
    it('listener adds zero entries to the audit chain after 100 events', () => {
        const events = 100;

        // Emit 100 entries via test helper calls — each causes a bump.
        for (let i = 1; i <= events; i++) {
            // Alternate between event types to exercise all code paths.
            const tick = i;
            if (i % 4 === 0) {
                appendTelosRefined(chain, DID_A, DID_B, tick);
            } else if (i % 3 === 0) {
                appendTradeReviewed(chain, DID_A, DID_B, 'fail', tick);
            } else if (i % 2 === 0) {
                appendTradeSettled(chain, DID_A, DID_B, tick);
            } else {
                appendSpoke(chain, DID_A, DID_B, tick);
            }
        }

        // The chain should have exactly `events` entries — the listener added zero.
        expect(chain.length).toBe(events);
        // And edges were created (listener is active).
        expect(listener.size).toBeGreaterThan(0);
    });
});
