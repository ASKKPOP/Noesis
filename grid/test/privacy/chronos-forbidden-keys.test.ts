/**
 * Phase 10b Wave 0 RED stub — D-10b-10 chronos privacy matrix extension.
 *
 * Clones grid/test/privacy/drive-forbidden-keys.test.ts shape.
 *
 * Extends FORBIDDEN_KEY_PATTERN with the 3 chronos forbidden keys:
 *   { 'subjective_multiplier', 'chronos_multiplier', 'subjective_tick' }.
 *
 * Guarantees:
 *  - Every chronos forbidden key rejected at the regex (flat + nested + array).
 *  - Phase 6 + 10a + 10b-bios forbidden keys remain rejected (regression).
 *  - Case-insensitivity preserved.
 *  - Innocuous keys (did, tick, level, multiplier_kind) pass.
 *
 * Mitigates D-10b-10 (chronos multiplier leak across the wire).
 *
 * RED at Wave 0: CHRONOS_FORBIDDEN_KEYS does not yet exist in
 * broadcast-allowlist.ts.
 */
import { describe, expect, it } from 'vitest';
import {
    CHRONOS_FORBIDDEN_KEYS,
    FORBIDDEN_KEY_PATTERN,
    payloadPrivacyCheck,
} from '../../src/audit/broadcast-allowlist.js';

describe('CHRONOS_FORBIDDEN_KEYS privacy matrix extension (D-10b-10)', () => {
    it('CHRONOS_FORBIDDEN_KEYS contains exactly the 3 expected keys', () => {
        expect([...CHRONOS_FORBIDDEN_KEYS].sort()).toEqual([
            'chronos_multiplier',
            'subjective_multiplier',
            'subjective_tick',
        ]);
    });

    it.each([...CHRONOS_FORBIDDEN_KEYS])('rejects chronos forbidden key %s at regex level', (key) => {
        expect(FORBIDDEN_KEY_PATTERN.test(key)).toBe(true);
    });

    it.each(['prompt', 'response', 'wiki', 'reflection', 'thought', 'emotion_delta'])(
        'preserves Phase 6 forbidden key %s (regression)',
        (key) => {
            expect(FORBIDDEN_KEY_PATTERN.test(key)).toBe(true);
        },
    );

    it.each(['hunger', 'curiosity', 'safety', 'boredom', 'loneliness', 'drive_value'])(
        'preserves Phase 10a forbidden key %s (regression)',
        (key) => {
            expect(FORBIDDEN_KEY_PATTERN.test(key)).toBe(true);
        },
    );

    it.each(['energy', 'sustenance', 'need_value', 'bios_value'])(
        'preserves Phase 10b-bios forbidden key %s (regression)',
        (key) => {
            expect(FORBIDDEN_KEY_PATTERN.test(key)).toBe(true);
        },
    );

    it('detects nested chronos key (subjective_multiplier inside metadata)', () => {
        const r = payloadPrivacyCheck({ metadata: { subjective_multiplier: 2.5 } });
        expect(r.ok).toBe(false);
        expect(r.offendingPath).toBe('metadata.subjective_multiplier');
        expect(r.offendingKeyword).toBe('subjective_multiplier');
    });

    it('walks arrays (chronos_multiplier inside data[0])', () => {
        const r = payloadPrivacyCheck({ data: [{ chronos_multiplier: 1.0 }] });
        expect(r.ok).toBe(false);
        expect(r.offendingPath).toBe('data.0.chronos_multiplier');
        expect(r.offendingKeyword).toBe('chronos_multiplier');
    });

    it('detects subjective_tick anywhere in payload', () => {
        const r = payloadPrivacyCheck({ subjective_tick: 100 });
        expect(r.ok).toBe(false);
        expect(r.offendingKeyword).toBe('subjective_tick');
    });

    it('case-insensitive — Subjective_Multiplier matches subjective_multiplier', () => {
        const r = payloadPrivacyCheck({ Subjective_Multiplier: 2.0 });
        expect(r.ok).toBe(false);
        expect(r.offendingKeyword).toBe('subjective_multiplier');
    });

    it('detects chronos keys at depth 3', () => {
        const r = payloadPrivacyCheck({
            outer: { middle: { inner: { chronos_multiplier: 0.5 } } },
        });
        expect(r.ok).toBe(false);
        expect(r.offendingKeyword).toBe('chronos_multiplier');
    });

    it('does not flag innocuous chronos-adjacent keys (tick, did)', () => {
        expect(
            payloadPrivacyCheck({
                did: 'did:noesis:x',
                tick: 1,
            }).ok,
        ).toBe(true);
    });
});
