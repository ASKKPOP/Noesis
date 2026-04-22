/**
 * Phase 9 Plan 01 Task 3 — canonical.ts unit tests (D-9-10 canonical round-trip).
 *
 * Tests:
 *   - canonicalEdge: deterministic 6-key JSON shape with toFixed(3) precision
 *   - edgeHash: stable hex digest, different edge → different hash
 *   - decayedWeight: exponential decay formula, guard branches for paused/future tick
 *   - warmthBucket: cold/warm/hot bucket thresholds from config
 *   - sortedPairKey: lexicographic sort (not self-loop — covered in self-edge-rejection.test.ts)
 *
 * Pattern mirrors grid/test/dialogue/dialogue-id.test.ts.
 */

import { describe, it, expect } from 'vitest';
import {
    canonicalEdge,
    edgeHash,
    decayedWeight,
    warmthBucket,
    sortedPairKey,
} from '../../src/relationships/index.js';
import { DEFAULT_RELATIONSHIP_CONFIG } from '../../src/relationships/index.js';
import type { Edge } from '../../src/relationships/index.js';

const BASE_EDGE: Edge = {
    did_a: 'did:noesis:a',
    did_b: 'did:noesis:b',
    valence: 0.12345,
    weight: 0.98765,
    recency_tick: 42,
    last_event_hash: 'f0'.repeat(32),
};

describe('canonicalEdge', () => {
    it('produces deterministic JSON with 6-key locked order and toFixed(3) precision (D-9-10)', () => {
        const result = canonicalEdge(BASE_EDGE);
        const expected = JSON.stringify({
            did_a: 'did:noesis:a',
            did_b: 'did:noesis:b',
            valence: '0.123',
            weight: '0.988',
            recency_tick: 42,
            last_event_hash: 'f0'.repeat(32),
        });
        expect(result).toBe(expected);
    });

    it('is pure: same input → same output across multiple calls', () => {
        const first = canonicalEdge(BASE_EDGE);
        const second = canonicalEdge(BASE_EDGE);
        expect(first).toBe(second);
    });

    it('changes when valence changes', () => {
        const modified: Edge = { ...BASE_EDGE, valence: 0.5 };
        expect(canonicalEdge(modified)).not.toBe(canonicalEdge(BASE_EDGE));
    });
});

describe('edgeHash', () => {
    it('returns same hex for same edge (hash stability)', () => {
        const h1 = edgeHash(BASE_EDGE);
        const h2 = edgeHash(BASE_EDGE);
        expect(h1).toBe(h2);
    });

    it('returns 64-character hex string', () => {
        const h = edgeHash(BASE_EDGE);
        expect(h).toMatch(/^[0-9a-f]{64}$/);
    });

    it('returns different hex for different edge', () => {
        const other: Edge = { ...BASE_EDGE, valence: 0.5 };
        expect(edgeHash(other)).not.toBe(edgeHash(BASE_EDGE));
    });
});

describe('decayedWeight', () => {
    it('applies exponential decay: weight × exp(-Δ/τ) at currentTick = recency_tick + τ', () => {
        const edge: Edge = { ...BASE_EDGE, weight: 1.0, recency_tick: 0 };
        const result = decayedWeight(edge, 1000, 1000);
        // Math.exp(-1) ≈ 0.367879441
        expect(result).toBeCloseTo(Math.exp(-1), 5);
    });

    it('returns edge.weight exactly when currentTick === edge.recency_tick (guard branch)', () => {
        const edge: Edge = { ...BASE_EDGE, weight: 0.75, recency_tick: 100 };
        const result = decayedWeight(edge, 100, 1000);
        expect(result).toBe(0.75);
    });

    it('returns edge.weight exactly when currentTick < edge.recency_tick (paused-tick guard)', () => {
        const edge: Edge = { ...BASE_EDGE, weight: 0.75, recency_tick: 200 };
        const result = decayedWeight(edge, 100, 1000);
        expect(result).toBe(0.75);
    });

    it('returns half-weight at currentTick = recency_tick + τ×ln(2) ≈ 693 ticks', () => {
        const edge: Edge = { ...BASE_EDGE, weight: 1.0, recency_tick: 0 };
        const halfLife = Math.log(2) * 1000;
        const result = decayedWeight(edge, halfLife, 1000);
        expect(result).toBeCloseTo(0.5, 5);
    });
});

describe('warmthBucket', () => {
    const cfg = DEFAULT_RELATIONSHIP_CONFIG;

    it('returns cold for weight < warmthColdMax (0.20)', () => {
        expect(warmthBucket(0.15, cfg)).toBe('cold');
    });

    it('returns warm for weight === warmthColdMax (0.20 is NOT cold — strict <)', () => {
        expect(warmthBucket(0.20, cfg)).toBe('warm');
    });

    it('returns warm for weight between thresholds', () => {
        expect(warmthBucket(0.59, cfg)).toBe('warm');
    });

    it('returns hot for weight === warmthWarmMax (0.60 is NOT warm — strict <)', () => {
        expect(warmthBucket(0.60, cfg)).toBe('hot');
    });

    it('returns hot for weight well above warmthWarmMax', () => {
        expect(warmthBucket(0.95, cfg)).toBe('hot');
    });
});

describe('sortedPairKey', () => {
    it('returns smaller DID first for already-sorted pair', () => {
        const result = sortedPairKey('did:noesis:a', 'did:noesis:b');
        expect(result).toBe('did:noesis:a|did:noesis:b');
    });

    it('sorts reversed pair so smaller DID is always first', () => {
        const result = sortedPairKey('did:noesis:b', 'did:noesis:a');
        expect(result).toBe('did:noesis:a|did:noesis:b');
    });

    it('produces the same key regardless of argument order', () => {
        const forward = sortedPairKey('did:noesis:x', 'did:noesis:y');
        const reversed = sortedPairKey('did:noesis:y', 'did:noesis:x');
        expect(forward).toBe(reversed);
    });
});
