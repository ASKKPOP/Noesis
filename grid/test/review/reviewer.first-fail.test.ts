import { describe, it, expect, beforeEach } from 'vitest';
import { Reviewer } from '../../src/review/Reviewer.js';
import { AuditChain } from '../../src/audit/chain.js';
import { NousRegistry } from '../../src/registry/registry.js';
import type { ReviewContext, ReviewFailureCode } from '../../src/review/types.js';

function validCtx(): ReviewContext {
    return {
        proposerDid: 'did:noesis:alpha',
        proposerBalance: 100,
        counterparty: 'did:noesis:beta',
        amount: 10,
        memoryRefs: ['mem:1', 'mem:2'],
        telosHash: 'a'.repeat(64),
    };
}

describe('REV-01: Reviewer.review() first-fail-wins', () => {
    let reviewer: Reviewer;

    beforeEach(() => {
        Reviewer.resetForTesting();
        reviewer = new Reviewer(new AuditChain(), new NousRegistry());
    });

    it('insufficient_balance fires first when balance AND amount both fail', () => {
        // amount=0 (non_positive) AND proposerBalance < amount would require amount > 0; construct so balance fails first.
        // Balance check precedes amount in CHECK_ORDER; with proposerBalance=5, amount=10 => balance fails.
        // ALSO set counterparty invalid so multiple checks would fail if iterated past balance.
        const result = reviewer.review({ ...validCtx(), proposerBalance: 5, amount: 10, counterparty: 'not-a-did' });
        expect(result).toEqual({
            verdict: 'fail',
            failed_check: 'insufficient_balance',
            failure_reason: 'insufficient_balance',
        });
    });

    const cases: Array<[ReviewFailureCode, Partial<ReviewContext>]> = [
        ['insufficient_balance',      { proposerBalance: 1, amount: 100 }],
        ['invalid_counterparty_did',  { counterparty: 'not-a-did' }],
        ['non_positive_amount',       { amount: 0 }],
        ['malformed_memory_refs',     { memoryRefs: [] }],
        ['malformed_telos_hash',      { telosHash: 'abc' }],
    ];

    it.each(cases)('returns %s when only that check fails', (code, override) => {
        const result = reviewer.review({ ...validCtx(), ...override });
        expect(result).toEqual({ verdict: 'fail', failed_check: code, failure_reason: code });
    });

    it('review() never throws on structurally-valid input', () => {
        expect(() => reviewer.review(validCtx())).not.toThrow();
        expect(() => reviewer.review({ ...validCtx(), amount: 0 })).not.toThrow();
    });
});
