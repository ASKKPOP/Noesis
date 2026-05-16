/**
 * Phase 19 Plan 03 — NormDetector unit tests
 *
 * Covers: sliding window, threshold detection, Set deduplication,
 * stale eviction, rebuildFromChain (no emitter calls), crystallization.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { NormDetector } from '../../src/norms/NormDetector.js';
import { DEFAULT_NORM_CONFIG } from '../../src/norms/types.js';
import { RelationshipListener } from '../../src/relationships/listener.js';
import { DEFAULT_RELATIONSHIP_CONFIG } from '../../src/relationships/config.js';
import * as candidateModule from '../../src/norms/appendNormCandidate.js';
import * as crystallizedModule from '../../src/norms/appendNormCrystallized.js';

function makeChain() {
    return new AuditChain();
}

function makeDetector(chain: AuditChain) {
    const rel = new RelationshipListener(chain, DEFAULT_RELATIONSHIP_CONFIG);
    return new NormDetector(chain, rel, DEFAULT_NORM_CONFIG);
}

/** Append a nous.self_model_revised event directly to the chain. */
function appendSMR(
    chain: AuditChain,
    nousDid: string,
    fingerprint: string,
    tick: number,
) {
    return chain.append('nous.self_model_revised', nousDid, {
        nous_did: nousDid,
        revision_hash: fingerprint,
        tick,
    });
}

describe('NormDetector — threshold detection', () => {
    it('fires appendNormCandidate once when 3 different DIDs share a fingerprint within window', () => {
        const chain = makeChain();
        const candidateSpy = vi.spyOn(candidateModule, 'appendNormCandidate');
        makeDetector(chain);

        appendSMR(chain, 'did:noesis:alpha', 'a1b2c3', 1);
        appendSMR(chain, 'did:noesis:beta',  'a1b2c3', 2);
        appendSMR(chain, 'did:noesis:gamma', 'a1b2c3', 3);

        expect(candidateSpy).toHaveBeenCalledTimes(1);
        expect(candidateSpy.mock.calls[0]![2].fingerprint).toBe('a1b2c3');
        expect(candidateSpy.mock.calls[0]![2].participating_count).toBe(3);
        candidateSpy.mockRestore();
    });

    it('does NOT fire when only 2 DIDs share a fingerprint (below threshold)', () => {
        const chain = makeChain();
        const candidateSpy = vi.spyOn(candidateModule, 'appendNormCandidate');
        makeDetector(chain);

        appendSMR(chain, 'did:noesis:alpha', 'a1b2c3', 1);
        appendSMR(chain, 'did:noesis:beta',  'a1b2c3', 2);

        expect(candidateSpy).not.toHaveBeenCalled();
        candidateSpy.mockRestore();
    });

    it('does NOT fire when 1 DID writes the same fingerprint 5 times (Set deduplication)', () => {
        const chain = makeChain();
        const candidateSpy = vi.spyOn(candidateModule, 'appendNormCandidate');
        makeDetector(chain);

        for (let i = 0; i < 5; i++) {
            appendSMR(chain, 'did:noesis:alpha', 'a1b2c3', i + 1);
        }

        expect(candidateSpy).not.toHaveBeenCalled();
        candidateSpy.mockRestore();
    });

    it('fires only once even when a 4th DID joins later (candidate already fired)', () => {
        const chain = makeChain();
        const candidateSpy = vi.spyOn(candidateModule, 'appendNormCandidate');
        makeDetector(chain);

        appendSMR(chain, 'did:noesis:alpha', 'a1b2c3', 1);
        appendSMR(chain, 'did:noesis:beta',  'a1b2c3', 2);
        appendSMR(chain, 'did:noesis:gamma', 'a1b2c3', 3);
        appendSMR(chain, 'did:noesis:delta', 'a1b2c3', 4);

        expect(candidateSpy).toHaveBeenCalledTimes(1);
        candidateSpy.mockRestore();
    });
});

describe('NormDetector — sliding window eviction', () => {
    it('evicts stale DIDs whose contribution is outside the window', () => {
        const chain = makeChain();
        const candidateSpy = vi.spyOn(candidateModule, 'appendNormCandidate');
        // Use default config: windowTicks=10
        makeDetector(chain);

        // alpha contributes at tick 1 — will be stale at tick 12 (cutoff = 12 - 10 = 2, but 1 < 2)
        appendSMR(chain, 'did:noesis:alpha', 'a1b2c3', 1);
        appendSMR(chain, 'did:noesis:beta',  'a1b2c3', 2);
        // At tick 12: alpha's lastTick=1, cutoff=12-10=2, 1 < 2 → alpha evicted
        appendSMR(chain, 'did:noesis:gamma', 'a1b2c3', 12);

        // After eviction: only beta (tick=2 >= cutoff=2) and gamma (tick=12) remain → 2 DIDs < threshold
        expect(candidateSpy).not.toHaveBeenCalled();
        candidateSpy.mockRestore();
    });

    it('fires when 3 DIDs all contribute within the window', () => {
        const chain = makeChain();
        const candidateSpy = vi.spyOn(candidateModule, 'appendNormCandidate');
        makeDetector(chain);

        // All within 10 ticks of each other
        appendSMR(chain, 'did:noesis:alpha', 'a1b2c3', 5);
        appendSMR(chain, 'did:noesis:beta',  'a1b2c3', 6);
        appendSMR(chain, 'did:noesis:gamma', 'a1b2c3', 7);

        expect(candidateSpy).toHaveBeenCalledTimes(1);
        candidateSpy.mockRestore();
    });
});

describe('NormDetector — rebuildFromChain does NOT call emitters', () => {
    it('rebuildFromChain populates candidateMap without calling appendNormCandidate', () => {
        const chain = makeChain();
        // Pre-populate the chain with SMR events (no detector attached yet)
        appendSMR(chain, 'did:noesis:alpha', 'a1b2c3', 1);
        appendSMR(chain, 'did:noesis:beta',  'a1b2c3', 2);
        appendSMR(chain, 'did:noesis:gamma', 'a1b2c3', 3);

        // Now attach detector and rebuild
        const candidateSpy = vi.spyOn(candidateModule, 'appendNormCandidate');
        const rel = new RelationshipListener(chain, DEFAULT_RELATIONSHIP_CONFIG);
        const detector = new NormDetector(chain, rel, DEFAULT_NORM_CONFIG);
        detector.rebuildFromChain(0);

        // rebuildFromChain must NOT call emitters
        expect(candidateSpy).not.toHaveBeenCalled();
        candidateSpy.mockRestore();
    });

    it('after rebuildFromChain, live events can still trigger candidate emission', () => {
        const chain = makeChain();
        appendSMR(chain, 'did:noesis:alpha', 'a1b2c3', 1);
        appendSMR(chain, 'did:noesis:beta',  'a1b2c3', 2);

        const candidateSpy = vi.spyOn(candidateModule, 'appendNormCandidate');
        const rel = new RelationshipListener(chain, DEFAULT_RELATIONSHIP_CONFIG);
        const detector = new NormDetector(chain, rel, DEFAULT_NORM_CONFIG);
        detector.rebuildFromChain(0);

        // Still below threshold — add third DID live
        appendSMR(chain, 'did:noesis:gamma', 'a1b2c3', 3);

        // handleEntry fires on the live append → candidate emitted
        expect(candidateSpy).toHaveBeenCalledTimes(1);
        candidateSpy.mockRestore();
    });
});

describe('NormDetector — crystallization', () => {
    it('fires appendNormCrystallized when cluster stable for adoptionTicks', () => {
        const chain = makeChain();
        const candidateSpy = vi.spyOn(candidateModule, 'appendNormCandidate');
        const crystallizedSpy = vi.spyOn(crystallizedModule, 'appendNormCrystallized');
        makeDetector(chain);

        // Fire candidate at tick 20 (all 3 DIDs contribute within the window)
        appendSMR(chain, 'did:noesis:alpha', 'a1b2c3', 20);
        appendSMR(chain, 'did:noesis:beta',  'a1b2c3', 21);
        appendSMR(chain, 'did:noesis:gamma', 'a1b2c3', 22);
        expect(candidateSpy).toHaveBeenCalledTimes(1);

        // candidateFiredTick=22. Need currentTick - 22 >= 20, so currentTick >= 42.
        // Refresh all 3 DIDs to stay in window at tick 43 (cutoff=43-10=33)
        appendSMR(chain, 'did:noesis:alpha', 'a1b2c3', 34); // 34 >= cutoff(33) ✓
        appendSMR(chain, 'did:noesis:beta',  'a1b2c3', 35);
        appendSMR(chain, 'did:noesis:gamma', 'a1b2c3', 36);
        // Trigger crystallization: tick=43, 43-22=21 >= adoptionTicks(20) → fires
        appendSMR(chain, 'did:noesis:delta', 'a1b2c3', 43);

        expect(crystallizedSpy).toHaveBeenCalledTimes(1);
        expect(crystallizedSpy.mock.calls[0]![2].fingerprint).toBe('a1b2c3');

        candidateSpy.mockRestore();
        crystallizedSpy.mockRestore();
    });

    it('does NOT fire crystallized if not enough ticks have passed', () => {
        const chain = makeChain();
        const crystallizedSpy = vi.spyOn(crystallizedModule, 'appendNormCrystallized');
        makeDetector(chain);

        // Fire candidate at tick 3
        appendSMR(chain, 'did:noesis:alpha', 'a1b2c3', 3);
        appendSMR(chain, 'did:noesis:beta',  'a1b2c3', 4);
        appendSMR(chain, 'did:noesis:gamma', 'a1b2c3', 5);
        // Only 10 ticks later — not enough (need 20), and all DIDs still in window
        appendSMR(chain, 'did:noesis:delta', 'a1b2c3', 13);

        expect(crystallizedSpy).not.toHaveBeenCalled();
        crystallizedSpy.mockRestore();
    });
});

describe('NormDetector — different fingerprints are tracked independently', () => {
    it('tracks two fingerprints separately, fires candidate for each at threshold', () => {
        const chain = makeChain();
        const candidateSpy = vi.spyOn(candidateModule, 'appendNormCandidate');
        makeDetector(chain);

        // Fingerprint A
        appendSMR(chain, 'did:noesis:alpha', 'aaaaaa', 1);
        appendSMR(chain, 'did:noesis:beta',  'aaaaaa', 2);
        appendSMR(chain, 'did:noesis:gamma', 'aaaaaa', 3);

        // Fingerprint B
        appendSMR(chain, 'did:noesis:delta',   'bbbbbb', 4);
        appendSMR(chain, 'did:noesis:epsilon',  'bbbbbb', 5);
        appendSMR(chain, 'did:noesis:zeta',     'bbbbbb', 6);

        expect(candidateSpy).toHaveBeenCalledTimes(2);
        const fps = candidateSpy.mock.calls.map(c => c[2].fingerprint).sort();
        expect(fps).toEqual(['aaaaaa', 'bbbbbb']);
        candidateSpy.mockRestore();
    });
});
