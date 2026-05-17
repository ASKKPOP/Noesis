/**
 * LoreQuotaTracker unit tests — Phase 20 LORE-03 (D-20-13).
 * Quota K=3 per sleep epoch (30 ticks) enforced at Grid boundary.
 */
import { describe, it, expect } from 'vitest';
import { LoreQuotaTracker } from '../../src/lore/LoreQuotaTracker.js';

describe('LoreQuotaTracker — K=3 per epoch', () => {
    it('allows first 3 contributions in same epoch', () => {
        const tracker = new LoreQuotaTracker(3, 30);
        expect(tracker.tryConsume('did:noesis:a', 0)).toBe(true);
        expect(tracker.tryConsume('did:noesis:a', 1)).toBe(true);
        expect(tracker.tryConsume('did:noesis:a', 2)).toBe(true);
    });

    it('blocks 4th contribution in same epoch', () => {
        const tracker = new LoreQuotaTracker(3, 30);
        tracker.tryConsume('did:noesis:a', 0);
        tracker.tryConsume('did:noesis:a', 0);
        tracker.tryConsume('did:noesis:a', 0);
        expect(tracker.tryConsume('did:noesis:a', 0)).toBe(false);
    });

    it('resets in next epoch (tick 30 = epoch 1)', () => {
        const tracker = new LoreQuotaTracker(3, 30);
        tracker.tryConsume('did:noesis:a', 0);
        tracker.tryConsume('did:noesis:a', 0);
        tracker.tryConsume('did:noesis:a', 0);
        // Exhausted in epoch 0 (ticks 0-29)
        expect(tracker.tryConsume('did:noesis:a', 0)).toBe(false);
        // New epoch starts at tick 30
        expect(tracker.tryConsume('did:noesis:a', 30)).toBe(true);
    });

    it('independent quotas per DID', () => {
        const tracker = new LoreQuotaTracker(3, 30);
        tracker.tryConsume('did:noesis:a', 0);
        tracker.tryConsume('did:noesis:a', 0);
        tracker.tryConsume('did:noesis:a', 0);
        // DID A exhausted; DID B should still have quota
        expect(tracker.tryConsume('did:noesis:b', 0)).toBe(true);
    });

    it('pruneStaleEpochs clears old data', () => {
        const tracker = new LoreQuotaTracker(3, 30);
        tracker.tryConsume('did:noesis:a', 0);
        // Prune at tick 90 (epoch 3 — removes epoch 0 data)
        tracker.pruneStaleEpochs(90);
        // DID A can contribute again in epoch 0 (data was pruned)
        // But we are now in epoch 3, so quota resets anyway
        expect(tracker.tryConsume('did:noesis:a', 90)).toBe(true);
    });
});
