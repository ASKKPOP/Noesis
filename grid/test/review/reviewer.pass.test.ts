import { describe, it, expect, beforeEach } from 'vitest';
import { Reviewer } from '../../src/review/Reviewer.js';
import { AuditChain } from '../../src/audit/chain.js';
import { NousRegistry } from '../../src/registry/registry.js';
import type { ReviewContext } from '../../src/review/types.js';

describe('REV-01: Reviewer.review() happy path — all 5 checks pass', () => {
    let reviewer: Reviewer;

    beforeEach(() => {
        Reviewer.resetForTesting();
        reviewer = new Reviewer(new AuditChain(), new NousRegistry());
    });

    const ctx: ReviewContext = {
        proposerDid: 'did:noesis:alpha',
        proposerBalance: 100,
        counterparty: 'did:noesis:beta',
        amount: 42,
        memoryRefs: ['mem:1', 'mem:7'],
        telosHash: 'f'.repeat(64),
    };

    it('returns { verdict: "pass" } and no extra keys', () => {
        const result = reviewer.review(ctx);
        expect(result).toEqual({ verdict: 'pass' });
        expect(Object.keys(result)).toEqual(['verdict']);
    });

    it('large balance + minimum valid amount also passes', () => {
        expect(reviewer.review({ ...ctx, proposerBalance: 1_000_000, amount: 1 })).toEqual({ verdict: 'pass' });
    });
});
