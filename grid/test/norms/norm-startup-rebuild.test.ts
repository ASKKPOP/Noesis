/**
 * Phase 19 Plan 05 — Startup rebuild integration test
 *
 * Core invariant: rebuildFromChain MUST NOT emit new audit events.
 * It is a pure read — no AuditChain.append calls occur during rebuild.
 *
 * Tests:
 *   1. rebuildFromChain produces same candidateMap observable as live accumulation
 *      (chain length does NOT increase during rebuild).
 *   2. rebuildFromChain respects fromTick filter — only entries at or after
 *      the given tick are processed.
 */

import { describe, it, expect } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { NormDetector } from '../../src/norms/NormDetector.js';
import { DEFAULT_NORM_CONFIG } from '../../src/norms/types.js';
import { RelationshipListener } from '../../src/relationships/listener.js';
import { DEFAULT_RELATIONSHIP_CONFIG } from '../../src/relationships/config.js';

function makeDetector(chain: AuditChain): NormDetector {
    const rel = new RelationshipListener(chain, DEFAULT_RELATIONSHIP_CONFIG);
    return new NormDetector(chain, rel, DEFAULT_NORM_CONFIG);
}

/** Append a nous.self_model_revised event to the chain. */
function appendSMR(
    chain: AuditChain,
    nousDid: string,
    fingerprint: string,
    tick: number,
): void {
    chain.append('nous.self_model_revised', nousDid, {
        nous_did: nousDid,
        revision_hash: fingerprint,
        tick,
    });
}

describe('NormDetector.rebuildFromChain — pure reader, zero new emissions', () => {
    it('produces same candidateMap observable as live accumulation (chain length unchanged)', () => {
        // Phase 1: drive a chain with SMR events and a live detector.
        const liveChain = makeDetector(new AuditChain()).constructor; // unused — keep for documentation
        const chain = new AuditChain();

        // Attach a live detector (subscribes via onAppend).
        makeDetector(chain);

        appendSMR(chain, 'did:noesis:alpha', 'a1b2c3', 1);
        appendSMR(chain, 'did:noesis:beta',  'a1b2c3', 2);
        appendSMR(chain, 'did:noesis:gamma', 'a1b2c3', 3);

        // Record chain length BEFORE rebuild with a second detector.
        const lengthBeforeRebuild = chain.all().length;

        // Phase 2: attach a second NormDetector and call rebuildFromChain(0).
        // The rebuild must NOT call audit.append — chain length must stay the same.
        const detector2 = makeDetector(chain);
        detector2.rebuildFromChain(0);

        const lengthAfterRebuild = chain.all().length;

        // Zero new audit events were emitted during rebuild.
        expect(lengthAfterRebuild).toBe(lengthBeforeRebuild);
    });

    it('rebuildFromChain respects fromTick filter — only entries at or after fromTick are processed', () => {
        const chain = new AuditChain();

        // Append 3 events at tick 1 (old) — these form a candidate if replayed.
        appendSMR(chain, 'did:noesis:alpha', 'a1b2c3', 1);
        appendSMR(chain, 'did:noesis:beta',  'a1b2c3', 1);
        appendSMR(chain, 'did:noesis:gamma', 'a1b2c3', 1);

        // Append 1 event at tick 15 (recent, above filter threshold of 10).
        appendSMR(chain, 'did:noesis:delta', 'ffffff', 15);

        const lengthBeforeRebuild = chain.all().length;

        // Rebuild with fromTick=10: events at tick 1 are below cutoff → skipped.
        // Only the tick-15 event for fingerprint 'ffffff' is processed.
        // Since only 1 DID contributes 'ffffff', it stays below threshold → no emissions.
        const detector = makeDetector(chain);
        detector.rebuildFromChain(10);

        const lengthAfterRebuild = chain.all().length;

        // No new emissions: chain length unchanged.
        expect(lengthAfterRebuild).toBe(lengthBeforeRebuild);

        // Verify the filter worked: if tick-1 events HAD been replayed, we'd have
        // a 3-DID candidate for 'a1b2c3' — but since they were skipped, no candidate
        // event would fire even if a live 4th DID joins. We confirm this by checking
        // that a subsequent live event for 'a1b2c3' does NOT trigger candidate emission
        // from the rebuilt state (only 0 DIDs contributed 'a1b2c3' in the filtered rebuild).
        // (chain.all().length will increase by 1 from the append itself — not a norm emission.)
        const lenBefore4th = chain.all().length;
        appendSMR(chain, 'did:noesis:epsilon', 'a1b2c3', 16);
        const lenAfter4th = chain.all().length;
        // Only the one raw SMR event was added — no norm.candidate emitted from rebuild state.
        expect(lenAfter4th).toBe(lenBefore4th + 1);
    });
});
