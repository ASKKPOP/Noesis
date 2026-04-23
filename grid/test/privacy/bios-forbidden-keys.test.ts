/**
 * Phase 10b Wave 0 RED stub — D-10b-10 bios privacy matrix extension.
 *
 * Clones grid/test/privacy/drive-forbidden-keys.test.ts shape.
 *
 * Extends Phase 6 + Phase 10a FORBIDDEN_KEY_PATTERN with the 4 bios
 * forbidden keys:
 *   { 'energy', 'sustenance', 'need_value', 'bios_value' }.
 *
 * Guarantees:
 *  - Every bios forbidden key rejected at the regex (flat + nested + array).
 *  - Phase 6 + 10a forbidden keys remain rejected — NO REGRESSION.
 *  - Case-insensitivity preserved (Energy === energy).
 *  - Innocuous keys ({did, tick, psyche_hash, cause}) pass.
 *
 * Mitigates D-10b-10 (numeric bios leak across the wire).
 *
 * RED at Wave 0: BIOS_FORBIDDEN_KEYS does not yet exist in
 * broadcast-allowlist.ts; the import of BIOS_FORBIDDEN_KEYS fails.
 */
import { describe, expect, it } from 'vitest';
import {
    BIOS_FORBIDDEN_KEYS,
    FORBIDDEN_KEY_PATTERN,
    payloadPrivacyCheck,
} from '../../src/audit/broadcast-allowlist.js';

describe('BIOS_FORBIDDEN_KEYS privacy matrix extension (D-10b-10)', () => {
    it('BIOS_FORBIDDEN_KEYS contains exactly the 4 expected keys', () => {
        expect([...BIOS_FORBIDDEN_KEYS].sort()).toEqual(
            ['bios_value', 'energy', 'need_value', 'sustenance'],
        );
    });

    it.each([...BIOS_FORBIDDEN_KEYS])('rejects bios forbidden key %s at regex level', (key) => {
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

    it('detects nested bios key (energy_score inside metadata)', () => {
        const r = payloadPrivacyCheck({ metadata: { energy_score: 0.7 } });
        expect(r.ok).toBe(false);
        expect(r.offendingPath).toBe('metadata.energy_score');
        expect(r.offendingKeyword).toBe('energy');
    });

    it('walks arrays (need_value inside data[0])', () => {
        const r = payloadPrivacyCheck({ data: [{ need_value: 0.3 }] });
        expect(r.ok).toBe(false);
        expect(r.offendingPath).toBe('data.0.need_value');
        expect(r.offendingKeyword).toBe('need_value');
    });

    it('case-insensitive — Energy matches energy', () => {
        const r = payloadPrivacyCheck({ Energy: 0.5 });
        expect(r.ok).toBe(false);
        expect(r.offendingKeyword).toBe('energy');
    });

    it.each(['energy', 'sustenance', 'need_value', 'bios_value'])(
        'detects flat bios forbidden key %s',
        (key) => {
            const r = payloadPrivacyCheck({ [key]: 0.5 });
            expect(r.ok).toBe(false);
        },
    );

    it('detects bios keys at depth 2 inside bios.birth-shaped payload', () => {
        const r = payloadPrivacyCheck({
            metadata: { snapshot: { bios_value: 0.42 } },
        });
        expect(r.ok).toBe(false);
        expect(r.offendingKeyword).toBe('bios_value');
    });

    it('does not flag innocuous bios.birth/death payload keys', () => {
        expect(
            payloadPrivacyCheck({
                did: 'did:noesis:x',
                tick: 1,
                psyche_hash: 'a'.repeat(64),
                cause: 'starvation',
                final_state_hash: 'b'.repeat(64),
            }).ok,
        ).toBe(true);
    });
});
