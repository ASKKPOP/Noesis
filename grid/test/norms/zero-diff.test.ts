/**
 * RED stub — will fail with 'Cannot find module' until Plan 03 ships grid/src/norms/NormDetector.ts
 *
 * Phase 19 Plan 01 — NORM-01 pure-observer gate.
 *
 * Proves that attaching a NormDetector to AuditChain does NOT mutate
 * any entries[].eventHash. Clone of grid/test/relationships/zero-diff.test.ts
 * substituting NormDetector for RelationshipListener.
 *
 * NormDetector observes 'nous.self_model_revised' events (pos 29) and fires
 * norm.candidate / norm.crystallized via sole-producer emitters. It must be a
 * pure observer — registering its onAppend callback must never alter eventHashes.
 *
 * Reference: D-19-06 (pure-observer), D-19-11 (allowlist baseline).
 */

import { describe, it, expect, vi } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
// RED: These imports fail until Plan 03 ships NormDetector + types
import { NormDetector } from '../../src/norms/NormDetector.js';
import { DEFAULT_NORM_CONFIG } from '../../src/norms/types.js';
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
 * Generate a deterministic fixed sequence of events including nous.self_model_revised
 * events with 6-char hex revision_hash payloads (the events NormDetector observes).
 *
 * Sequence:
 *   100 nous.self_model_revised  (distributed across 5 DIDs, 3 fingerprints)
 *    50 trade.settled
 *    50 nous.spoke
 *   300 unrelated events
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

    // 3 sample fingerprints (6-char hex, matching compute_norm_fingerprint output format)
    const fingerprints = ['7c5507', 'a3b2c1', 'f1e2d3'];

    // 100 nous.self_model_revised events — the events NormDetector watches
    for (let i = 0; i < 100 && events.length < count; i++) {
        const actorDid = dids[i % dids.length];
        const fingerprint = fingerprints[i % fingerprints.length];
        events.push({
            type: 'nous.self_model_revised',
            actorDid,
            payload: {
                nous_did: actorDid,
                tick,
                revision_hash: fingerprint,
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

    // 50 nous.spoke events
    for (let i = 0; i < 50 && events.length < count; i++) {
        const fromDid = dids[i % dids.length];
        events.push({
            type: 'nous.spoke',
            actorDid: fromDid,
            payload: {
                name: fromDid.split(':').pop(),
                channel: 'agora',
                text: `utterance-${i}`,
                tick,
                to_did: dids[(i + 1) % dids.length],
            },
        });
        tick++;
    }

    // 300 unrelated events
    const unrelated = ['nous.spawned', 'nous.moved', 'operator.inspected', 'tick', 'grid.started'];
    for (let i = 0; i < 300 && events.length < count; i++) {
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

describe('NORM-01 zero-diff — NormDetector attach does not alter chain', () => {
    it('entries[].eventHash is byte-identical with and without NormDetector (≥500 events)', () => {
        // Freeze Date.now so both chains produce identical hashes.
        const nowSpy = vi.spyOn(Date, 'now');
        let fakeNow = 1_700_000_000_000;
        nowSpy.mockImplementation(() => (fakeNow += 1, fakeNow));

        const events = makeFixedEventSequence(500);

        const runSim = (withDetector: boolean, extraListeners: number): string[] => {
            fakeNow = 1_700_000_000_000;
            const chain = new AuditChain();
            // RelationshipListener needed for NormDetector constructor (causal lineage)
            const relListener = withDetector
                ? new RelationshipListener(chain, DEFAULT_RELATIONSHIP_CONFIG)
                : undefined;
            if (withDetector && relListener) {
                // NormDetector wires its own onAppend inside the constructor (D-19-06)
                void new NormDetector(chain, relListener, DEFAULT_NORM_CONFIG);
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
        const withDetector = runSim(true, 0);
        const withTen      = runSim(true, 10);

        // Core invariant: NormDetector is a pure observer — attaching it must not change any hash.
        expect(withDetector.length).toBe(events.length);
        expect(withDetector).toEqual(withNone);
        expect(withTen).toEqual(withNone);

        nowSpy.mockRestore();
    });

    it('prevHash chain is byte-identical with and without NormDetector', () => {
        const nowSpy = vi.spyOn(Date, 'now');
        let fakeNow = 2_000_000_000_000;
        nowSpy.mockImplementation(() => (fakeNow += 1, fakeNow));

        const events = makeFixedEventSequence(100);

        const run = (withDetector: boolean) => {
            fakeNow = 2_000_000_000_000;
            const chain = new AuditChain();
            const relListener = withDetector
                ? new RelationshipListener(chain, DEFAULT_RELATIONSHIP_CONFIG)
                : undefined;
            if (withDetector && relListener) {
                void new NormDetector(chain, relListener, DEFAULT_NORM_CONFIG);
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
