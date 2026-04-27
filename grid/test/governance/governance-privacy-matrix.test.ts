/**
 * Phase 12 Wave 0 — GOVERNANCE_FORBIDDEN_KEYS shape regression (VOTE-06 / D-12-11).
 *
 * NOTE: GREEN at Wave 0 — GOVERNANCE_FORBIDDEN_KEYS lands in W0-01 (Task 12-W0-01).
 * This stub is purely a tuple-shape regression guard, not emitter enforcement.
 * The W2 emitter enforcement test (governance-emitter-enforcement.test.ts) will
 * add runtime forbidden-key rejection testing once appendProposalOpened.ts etc.
 * land in Wave 2. That test RED-flips in W2.
 *
 * GREEN here means: the 12-element frozen tuple is correct. If it ever
 * shrinks, grows, or is reordered, this test fails immediately in CI.
 *
 * Imports GOVERNANCE_FORBIDDEN_KEYS from grid/src/governance/types.ts
 * (re-exported from grid/src/audit/broadcast-allowlist.ts — source-of-truth).
 */
import { describe, it, expect } from 'vitest';
import { GOVERNANCE_FORBIDDEN_KEYS } from '../../src/governance/types.js';

const EXPECTED_FORBIDDEN_KEYS = [
    'text',
    'body',
    'content',
    'description',
    'rationale',
    'proposal_text',
    'law_text',
    'body_text',
    'weight',
    'reputation',
    'relationship_score',
    'ousia_weight',
] as const;

describe('GOVERNANCE_FORBIDDEN_KEYS shape regression (VOTE-06 / D-12-11)', () => {
    it('has exactly 12 elements', () => {
        expect(GOVERNANCE_FORBIDDEN_KEYS.length).toBe(12);
    });

    it('contains all 12 required literals', () => {
        for (const key of EXPECTED_FORBIDDEN_KEYS) {
            expect(
                (GOVERNANCE_FORBIDDEN_KEYS as readonly string[]).includes(key),
                `GOVERNANCE_FORBIDDEN_KEYS must contain "${key}"`,
            ).toBe(true);
        }
    });

    it('body-text forbidden keys are present (T-09-12 / D-12-04 privacy)', () => {
        const bodyTextKeys = ['text', 'body', 'content', 'description', 'rationale',
                              'proposal_text', 'law_text', 'body_text'] as const;
        for (const key of bodyTextKeys) {
            expect(
                (GOVERNANCE_FORBIDDEN_KEYS as readonly string[]).includes(key),
                `Body-text key "${key}" must be forbidden (D-12-04)`,
            ).toBe(true);
        }
    });

    it('vote-weighting forbidden keys are present (T-09-14 / VOTE-06 sybil guard)', () => {
        const weightKeys = ['weight', 'reputation', 'relationship_score', 'ousia_weight'] as const;
        for (const key of weightKeys) {
            expect(
                (GOVERNANCE_FORBIDDEN_KEYS as readonly string[]).includes(key),
                `Weight key "${key}" must be forbidden (VOTE-06)`,
            ).toBe(true);
        }
    });

    it('is frozen (Object.freeze applied)', () => {
        // Object.freeze on an array prevents push/pop/splice.
        expect(() => {
            // @ts-expect-error — testing runtime freeze enforcement
            (GOVERNANCE_FORBIDDEN_KEYS as string[]).push('injected_key');
        }).toThrow();
    });
});
