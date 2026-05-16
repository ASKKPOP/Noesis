import { describe, it, expect } from 'vitest';
import {
    SKILL_FORBIDDEN_KEYS,
    FORBIDDEN_KEY_PATTERN,
    payloadPrivacyCheck,
} from '../../src/audit/broadcast-allowlist.js';

describe('SKILL_FORBIDDEN_KEYS — Phase 18 D-18-08', () => {
    it('exports exactly 3 forbidden keys', () => {
        expect(SKILL_FORBIDDEN_KEYS).toHaveLength(3);
        expect(SKILL_FORBIDDEN_KEYS).toContain('skill_body');
        expect(SKILL_FORBIDDEN_KEYS).toContain('skill_text');
        expect(SKILL_FORBIDDEN_KEYS).toContain('rule_text');
    });

    it.each([...SKILL_FORBIDDEN_KEYS])(
        'FORBIDDEN_KEY_PATTERN matches forbidden key "%s"',
        (key) => {
            expect(FORBIDDEN_KEY_PATTERN.test(key)).toBe(true);
        },
    );

    it.each([...SKILL_FORBIDDEN_KEYS])(
        'payloadPrivacyCheck rejects payload containing "%s"',
        (key) => {
            const result = payloadPrivacyCheck({ [key]: 'some_content', tick: 1 });
            expect(result.ok).toBe(false);
        },
    );

    it('payloadPrivacyCheck allows legitimate skill payload keys', () => {
        const result = payloadPrivacyCheck({
            learner_did: 'did:noesis:learner',
            skill_hash: 'a'.repeat(64),
            teacher_did: 'did:noesis:teacher',
            parent_hash: 'b'.repeat(64),
            tick: 1,
        });
        expect(result.ok).toBe(true);
    });

    it('payloadPrivacyCheck allows skill_inferred payload keys', () => {
        const result = payloadPrivacyCheck({
            learner_did: 'did:noesis:learner',
            skill_hash: 'a'.repeat(64),
            source_event_hash: 'c'.repeat(64),
            tick: 1,
        });
        expect(result.ok).toBe(true);
    });
});
