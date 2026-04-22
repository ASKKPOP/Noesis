/**
 * Phase 10a DRIVE-05, D-10a-07 — Privacy matrix extension.
 *
 * Extends Phase 6 FORBIDDEN_KEY_PATTERN with the 6 drive-leaf keys:
 *   {hunger, curiosity, safety, boredom, loneliness, drive_value}.
 *
 * Guarantees:
 *  - Every drive-leaf key rejected at the regex (flat + nested + array walks).
 *  - Phase 6 forbidden keys (prompt|response|wiki|reflection|thought|emotion_delta)
 *    remain rejected — NO REGRESSION.
 *  - Case-insensitivity preserved (Hunger === hunger).
 *  - Innocuous keys ({did, tick, drive, level, direction}) pass.
 *
 * Mitigates T-10a-06 (numeric drive leak across the wire).
 */
import { describe, expect, it } from 'vitest';
import {
    FORBIDDEN_KEY_PATTERN,
    DRIVE_FORBIDDEN_KEYS,
    payloadPrivacyCheck,
} from '../../src/audit/broadcast-allowlist.js';

describe('DRIVE_FORBIDDEN_KEYS privacy matrix extension (D-10a-07)', () => {
    it.each([...DRIVE_FORBIDDEN_KEYS])('rejects drive-leaf key %s', (key) => {
        expect(FORBIDDEN_KEY_PATTERN.test(key)).toBe(true);
    });

    it('DRIVE_FORBIDDEN_KEYS contains exactly the 6 expected keys', () => {
        expect([...DRIVE_FORBIDDEN_KEYS].sort()).toEqual(
            ['boredom', 'curiosity', 'drive_value', 'hunger', 'loneliness', 'safety'],
        );
    });

    it.each(['prompt', 'response', 'wiki', 'reflection', 'thought', 'emotion_delta'])(
        'preserves Phase 6 forbidden key %s (regression)',
        (key) => {
            expect(FORBIDDEN_KEY_PATTERN.test(key)).toBe(true);
        },
    );

    it('detects nested drive-leaf keys (hunger_score inside metadata)', () => {
        const r = payloadPrivacyCheck({ metadata: { hunger_score: 0.7 } });
        expect(r.ok).toBe(false);
        expect(r.offendingPath).toBe('metadata.hunger_score');
        expect(r.offendingKeyword).toBe('hunger');
    });

    it('walks arrays (drive_value inside data[0])', () => {
        const r = payloadPrivacyCheck({ data: [{ drive_value: 0.3 }] });
        expect(r.ok).toBe(false);
        expect(r.offendingPath).toBe('data.0.drive_value');
        expect(r.offendingKeyword).toBe('drive_value');
    });

    it('case-insensitive — Hunger matches hunger', () => {
        const r = payloadPrivacyCheck({ Hunger: 0.5 });
        expect(r.ok).toBe(false);
        expect(r.offendingKeyword).toBe('hunger');
    });

    it.each(['curiosity', 'safety', 'boredom', 'loneliness'])(
        'detects flat drive-name key %s',
        (key) => {
            const r = payloadPrivacyCheck({ [key]: 0.5 });
            expect(r.ok).toBe(false);
        },
    );

    it('does not flag innocuous keys', () => {
        expect(
            payloadPrivacyCheck({
                did: 'did:noesis:x',
                tick: 1,
                drive: 'hunger',
                level: 'med',
                direction: 'rising',
            }).ok,
        ).toBe(true);
    });
});
