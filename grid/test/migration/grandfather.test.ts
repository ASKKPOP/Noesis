/**
 * Phase 50 (MIG-03) — grandfathering v2.6 metrics → v3.0 opening reputation.
 * Pure, deterministic, total. Mirrors the formula published in PHILOSOPHY §12.
 */
import { describe, it, expect } from 'vitest';
import { grandfatherReputation } from '../../src/migration/grandfather.js';

describe('grandfatherReputation (MIG-03)', () => {
    it('a clean, productive Nous keeps neutral standing + its earned scores', () => {
        expect(grandfatherReputation({ sanctionCount: 0, skillTeachCount: 7, tradeSuccessRate: 0.9 }))
            .toEqual({ civicStanding: 0, libraryContributionScore: 7, marketplaceReputation: 90 });
    });

    it('a sanctioned Nous carries negative civic standing across the boundary', () => {
        expect(grandfatherReputation({ sanctionCount: 3, skillTeachCount: 0, tradeSuccessRate: 0 }))
            .toEqual({ civicStanding: -3, libraryContributionScore: 0, marketplaceReputation: 0 });
    });

    it('trade success rate maps onto a 0–100 marketplace reputation (rounded, clamped)', () => {
        expect(grandfatherReputation({ sanctionCount: 0, skillTeachCount: 0, tradeSuccessRate: 0.555 }).marketplaceReputation).toBe(56);
        expect(grandfatherReputation({ sanctionCount: 0, skillTeachCount: 0, tradeSuccessRate: 2 }).marketplaceReputation).toBe(100); // clamp high
        expect(grandfatherReputation({ sanctionCount: 0, skillTeachCount: 0, tradeSuccessRate: -1 }).marketplaceReputation).toBe(0);  // clamp low
    });

    it('is total — malformed / negative metrics collapse to neutral, never throwing', () => {
        expect(grandfatherReputation({ sanctionCount: -5, skillTeachCount: -2, tradeSuccessRate: NaN }))
            .toEqual({ civicStanding: 0, libraryContributionScore: 0, marketplaceReputation: 0 });
        // @ts-expect-error — exercising the total/defensive path with missing fields
        expect(grandfatherReputation({})).toEqual({ civicStanding: 0, libraryContributionScore: 0, marketplaceReputation: 0 });
    });

    it('is deterministic (same input → same output)', () => {
        const m = { sanctionCount: 1, skillTeachCount: 4, tradeSuccessRate: 0.5 };
        expect(grandfatherReputation(m)).toEqual(grandfatherReputation(m));
    });
});
