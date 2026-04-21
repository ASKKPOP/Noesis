import { describe, it, expect } from 'vitest';
import { VALID_REVIEW_FAILURE_CODES, type ReviewFailureCode } from '../../src/review/types.js';

describe('REV-02: ReviewFailureCode closed enum (codes.test.ts)', () => {
    const EXPECTED: readonly ReviewFailureCode[] = [
        'insufficient_balance',
        'invalid_counterparty_did',
        'non_positive_amount',
        'malformed_memory_refs',
        'malformed_telos_hash',
    ];

    it('VALID_REVIEW_FAILURE_CODES has exactly 5 members', () => {
        expect(VALID_REVIEW_FAILURE_CODES.size).toBe(5);
    });

    it.each(EXPECTED)('contains %s', (code) => {
        expect(VALID_REVIEW_FAILURE_CODES.has(code)).toBe(true);
    });

    it('contains NO extra members beyond the 5 expected', () => {
        for (const code of VALID_REVIEW_FAILURE_CODES) {
            expect(EXPECTED).toContain(code);
        }
    });
});
