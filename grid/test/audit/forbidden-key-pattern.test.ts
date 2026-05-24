import { describe, it, expect } from 'vitest';
import { FORBIDDEN_KEY_PATTERN } from '../../src/audit/broadcast-allowlist.js';

describe('FORBIDDEN_KEY_PATTERN — Phase 25a extensions', () => {
    describe('MUST-MATCH: new Phase 25a keys', () => {
        it('matches reflexion_text', () => {
            expect(FORBIDDEN_KEY_PATTERN.test('reflexion_text')).toBe(true);
        });

        it('matches creed_text', () => {
            expect(FORBIDDEN_KEY_PATTERN.test('creed_text')).toBe(true);
        });

        it('matches whisper_plaintext', () => {
            expect(FORBIDDEN_KEY_PATTERN.test('whisper_plaintext')).toBe(true);
        });

        it('matches case-insensitive variants of new keys', () => {
            expect(FORBIDDEN_KEY_PATTERN.test('Reflexion_Text')).toBe(true);
            expect(FORBIDDEN_KEY_PATTERN.test('CREED_TEXT')).toBe(true);
        });
    });

    describe('MUST-NOT-MATCH: D-25a-05 explicit exemption', () => {
        it('does NOT match skill_title (D-25a-05 exemption)', () => {
            expect(FORBIDDEN_KEY_PATTERN.test('skill_title')).toBe(false);
        });
    });

    describe('MUST-NOT-MATCH: existing content_hash lookahead preserved', () => {
        it('does NOT match content_hash', () => {
            expect(FORBIDDEN_KEY_PATTERN.test('content_hash')).toBe(false);
        });
    });

    describe('MUST-MATCH: regression — existing forbidden keys still match', () => {
        it('matches skill_body', () => {
            expect(FORBIDDEN_KEY_PATTERN.test('skill_body')).toBe(true);
        });

        it('matches rule_text', () => {
            expect(FORBIDDEN_KEY_PATTERN.test('rule_text')).toBe(true);
        });

        it('matches lore_body', () => {
            expect(FORBIDDEN_KEY_PATTERN.test('lore_body')).toBe(true);
        });

        it('matches prompt', () => {
            expect(FORBIDDEN_KEY_PATTERN.test('prompt')).toBe(true);
        });

        it('matches summary_text', () => {
            expect(FORBIDDEN_KEY_PATTERN.test('summary_text')).toBe(true);
        });

        it('matches skill_text', () => {
            expect(FORBIDDEN_KEY_PATTERN.test('skill_text')).toBe(true);
        });
    });
});
