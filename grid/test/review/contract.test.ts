import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    CHECKS,
    CHECK_ORDER,
    clearRegistryForTesting,
} from '../../src/review/registry.js';
import { VALID_REVIEW_FAILURE_CODES } from '../../src/review/types.js';
import type { ReviewCheckName } from '../../src/review/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Map check-name → checks/*.ts filename. (Names chosen so filenames read naturally; the MAP is the source of truth.)
const CHECK_FILES: Record<ReviewCheckName, string> = {
    insufficient_balance: 'balance.ts',
    invalid_counterparty_did: 'counterparty-did.ts',
    non_positive_amount: 'amount.ts',
    malformed_memory_refs: 'memory-refs.ts',
    malformed_telos_hash: 'telos-hash.ts',
};

const CHECKS_DIR = resolve(__dirname, '../../src/review/checks');
// REV-04: the 8 forbidden subjective keywords.
const FORBIDDEN = /\b(fairness|wisdom|taste|quality|novelty|good|bad|should)\b/i;

describe('REV-04: subjective-check lint gate (contract.test.ts)', () => {
    beforeAll(async () => {
        clearRegistryForTesting();
        await import('../../src/review/checks/balance.js');
        await import('../../src/review/checks/counterparty-did.js');
        await import('../../src/review/checks/amount.js');
        await import('../../src/review/checks/memory-refs.js');
        await import('../../src/review/checks/telos-hash.js');
    });

    it('every registered check name is a member of VALID_REVIEW_FAILURE_CODES', () => {
        for (const name of CHECKS.keys()) {
            expect(VALID_REVIEW_FAILURE_CODES.has(name)).toBe(true);
        }
    });

    it('CHECKS.size equals VALID_REVIEW_FAILURE_CODES.size (no ghost checks, no missing codes)', () => {
        expect(CHECKS.size).toBe(VALID_REVIEW_FAILURE_CODES.size);
    });

    it('CHECK_ORDER has no duplicates and matches CHECKS.keys()', () => {
        expect(new Set(CHECK_ORDER).size).toBe(CHECK_ORDER.length);
        expect(new Set(CHECK_ORDER)).toEqual(new Set(CHECKS.keys()));
    });

    describe('no subjective keywords in any handler source', () => {
        for (const [name, filename] of Object.entries(CHECK_FILES)) {
            it(`checks/${filename} contains no /\\b(fairness|wisdom|taste|quality|novelty|good|bad|should)\\b/i match`, () => {
                const src = readFileSync(resolve(CHECKS_DIR, filename), 'utf8');
                expect(src).not.toMatch(FORBIDDEN);
            });
        }
    });
});
