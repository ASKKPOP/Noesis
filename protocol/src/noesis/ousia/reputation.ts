/**
 * Trade Reputation — tracks trade outcomes and computes trust scores.
 *
 * 4 dimensions: Quality(35%) + Reliability(30%) + Responsiveness(20%) + Expertise(15%)
 * Temporal decay: each outcome weight = 0.95 ^ days_since_outcome
 * Tiers: unverified (<0.3 or <3 interactions) → bronze → silver → gold → platinum
 */

import type { TradeRating } from './types.js';

export type ReputationTier = 'unverified' | 'bronze' | 'silver' | 'gold' | 'platinum';

export interface ReputationScore {
    overall: number;        // 0.0 - 1.0
    tier: ReputationTier;
    totalInteractions: number;
    successfulTrades: number;
    failedTrades: number;
    ratings: TradeRating[];
}

const DECAY_RATE = 0.95;
const DECAY_WINDOW_DAYS = 90;

export class ReputationTracker {
    private readonly scores = new Map<string, ReputationScore>();

    /** Get or create reputation for a did. */
    get(did: string): ReputationScore {
        let score = this.scores.get(did);
        if (!score) {
            score = {
                overall: 0,
                tier: 'unverified',
                totalInteractions: 0,
                successfulTrades: 0,
                failedTrades: 0,
                ratings: [],
            };
            this.scores.set(did, score);
        }
        return score;
    }

    /** Record a successful trade completion. */
    recordSuccess(did: string): void {
        const score = this.get(did);
        score.totalInteractions++;
        score.successfulTrades++;
        this.recompute(did);
    }

    /** Record a failed trade (rejected, expired, cancelled). */
    recordFailure(did: string): void {
        const score = this.get(did);
        score.totalInteractions++;
        score.failedTrades++;
        this.recompute(did);
    }

    /** Add a peer rating after a completed trade. */
    addRating(rating: TradeRating): void {
        const score = this.get(rating.ratedDid);
        score.ratings.push(rating);
        this.recompute(rating.ratedDid);
    }

    /** Apply a sanction penalty to reputation. */
    applySanction(did: string, penalty: number): void {
        const score = this.get(did);
        score.overall = Math.max(0, score.overall - penalty);
        score.tier = ReputationTracker.tierFor(score.overall, score.totalInteractions);
    }

    /** Recompute score and tier for a did. */
    private recompute(did: string): void {
        const score = this.scores.get(did);
        if (!score) return;

        // Reliability component: success rate
        const reliability = score.totalInteractions > 0
            ? score.successfulTrades / score.totalInteractions
            : 0;

        // Quality component: average of ratings with decay
        let qualitySum = 0;
        let qualityWeight = 0;
        const now = Date.now();

        for (const r of score.ratings) {
            const daysAgo = (now - r.tick * 30000) / (1000 * 60 * 60 * 24);
            if (daysAgo > DECAY_WINDOW_DAYS) continue;
            const weight = Math.pow(DECAY_RATE, daysAgo);
            qualitySum += r.score * weight;
            qualityWeight += weight;
        }
        const quality = qualityWeight > 0 ? qualitySum / qualityWeight : reliability;

        // Weighted combination: Quality(35%) + Reliability(30%) + base(35%)
        // (Responsiveness and Expertise require more data — use reliability as proxy)
        score.overall = Math.min(1, Math.max(0,
            quality * 0.35 + reliability * 0.30 + reliability * 0.35,
        ));

        score.tier = ReputationTracker.tierFor(score.overall, score.totalInteractions);
    }

    /** Determine tier from score and interaction count. */
    static tierFor(score: number, interactions: number): ReputationTier {
        if (interactions < 3 || score < 0.3) return 'unverified';
        if (score >= 0.9) return 'platinum';
        if (score >= 0.7) return 'gold';
        if (score >= 0.5) return 'silver';
        return 'bronze';
    }

    /** List all tracked dids. */
    allDids(): string[] {
        return [...this.scores.keys()];
    }

    /** Total tracked Nous. */
    get count(): number {
        return this.scores.size;
    }
}
