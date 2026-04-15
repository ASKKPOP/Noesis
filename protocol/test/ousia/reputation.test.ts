import { describe, it, expect, beforeEach } from 'vitest';
import { ReputationTracker } from '../../src/noesis/ousia/reputation.js';

const SOPHIA = 'did:key:sophia';
const HERMES = 'did:key:hermes';

describe('ReputationTracker', () => {
    let tracker: ReputationTracker;

    beforeEach(() => {
        tracker = new ReputationTracker();
    });

    it('new Nous starts unverified with 0 score', () => {
        const rep = tracker.get(SOPHIA);
        expect(rep.overall).toBe(0);
        expect(rep.tier).toBe('unverified');
        expect(rep.totalInteractions).toBe(0);
    });

    it('records successful trades', () => {
        tracker.recordSuccess(SOPHIA);
        tracker.recordSuccess(SOPHIA);
        tracker.recordSuccess(SOPHIA);
        const rep = tracker.get(SOPHIA);
        expect(rep.successfulTrades).toBe(3);
        expect(rep.totalInteractions).toBe(3);
        expect(rep.overall).toBeGreaterThan(0);
    });

    it('records failed trades', () => {
        tracker.recordFailure(SOPHIA);
        const rep = tracker.get(SOPHIA);
        expect(rep.failedTrades).toBe(1);
        expect(rep.totalInteractions).toBe(1);
    });

    it('tier progresses with successes', () => {
        // Need 3+ interactions to leave unverified
        tracker.recordSuccess(SOPHIA);
        tracker.recordSuccess(SOPHIA);
        expect(tracker.get(SOPHIA).tier).toBe('unverified'); // Only 2

        tracker.recordSuccess(SOPHIA);
        expect(tracker.get(SOPHIA).tier).not.toBe('unverified'); // 3+, 100% success
    });

    it('failures reduce score and tier', () => {
        // 3 successes → good tier
        for (let i = 0; i < 3; i++) tracker.recordSuccess(SOPHIA);
        const goodTier = tracker.get(SOPHIA).tier;

        // Add many failures
        for (let i = 0; i < 10; i++) tracker.recordFailure(SOPHIA);
        const badTier = tracker.get(SOPHIA).tier;
        expect(tracker.get(SOPHIA).overall).toBeLessThan(0.5);
    });

    it('adds peer ratings', () => {
        tracker.recordSuccess(SOPHIA);
        tracker.recordSuccess(SOPHIA);
        tracker.recordSuccess(SOPHIA);

        tracker.addRating({
            raterDid: HERMES, ratedDid: SOPHIA,
            tradeNonce: 'n1', score: 0.9, tick: 1,
        });

        const rep = tracker.get(SOPHIA);
        expect(rep.ratings).toHaveLength(1);
        expect(rep.overall).toBeGreaterThan(0);
    });

    it('applySanction reduces score', () => {
        for (let i = 0; i < 5; i++) tracker.recordSuccess(SOPHIA);
        const before = tracker.get(SOPHIA).overall;

        tracker.applySanction(SOPHIA, 0.3);
        expect(tracker.get(SOPHIA).overall).toBeLessThan(before);
    });

    it('score never goes below 0', () => {
        tracker.applySanction(SOPHIA, 5.0);
        expect(tracker.get(SOPHIA).overall).toBe(0);
    });

    describe('tierFor', () => {
        it('unverified below 3 interactions', () => {
            expect(ReputationTracker.tierFor(1.0, 2)).toBe('unverified');
        });

        it('unverified below 0.3 score', () => {
            expect(ReputationTracker.tierFor(0.2, 10)).toBe('unverified');
        });

        it('bronze 0.3-0.5', () => {
            expect(ReputationTracker.tierFor(0.4, 5)).toBe('bronze');
        });

        it('silver 0.5-0.7', () => {
            expect(ReputationTracker.tierFor(0.6, 5)).toBe('silver');
        });

        it('gold 0.7-0.9', () => {
            expect(ReputationTracker.tierFor(0.8, 5)).toBe('gold');
        });

        it('platinum 0.9+', () => {
            expect(ReputationTracker.tierFor(0.95, 5)).toBe('platinum');
        });
    });

    it('tracks multiple Nous independently', () => {
        tracker.recordSuccess(SOPHIA);
        tracker.recordFailure(HERMES);
        expect(tracker.count).toBe(2);
        expect(tracker.allDids()).toContain(SOPHIA);
        expect(tracker.allDids()).toContain(HERMES);
        expect(tracker.get(SOPHIA).successfulTrades).toBe(1);
        expect(tracker.get(HERMES).failedTrades).toBe(1);
    });
});
