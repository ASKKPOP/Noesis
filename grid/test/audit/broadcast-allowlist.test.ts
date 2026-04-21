import { describe, it, expect } from 'vitest';
import {
    ALLOWLIST,
    isAllowlisted,
    payloadPrivacyCheck,
    FORBIDDEN_KEY_PATTERN,
} from '../../src/audit/broadcast-allowlist.js';

describe('broadcast-allowlist: default-deny membership', () => {
    it('has exactly 17 locked v1+Phase 5+Phase 6+Phase 7 event types', () => {
        expect(ALLOWLIST.size).toBe(17);
    });

    it.each([
        'nous.spawned',
        'nous.moved',
        'nous.spoke',
        'nous.direct_message',
        'trade.proposed',
        'trade.reviewed',
        'trade.settled',
        'law.triggered',
        'tick',
        'grid.started',
        'grid.stopped',
        // Phase 6 (AGENCY-02, AGENCY-03) — D-10 tuple order locked.
        'operator.inspected',
        'operator.paused',
        'operator.resumed',
        'operator.law_changed',
        'operator.telos_forced',
        // Phase 7 (DIALOG-02) — position 17 hash-only refinement.
        'telos.refined',
    ])('allows %s', (eventType) => {
        expect(isAllowlisted(eventType)).toBe(true);
    });

    it.each([
        'brain.reflection.internal',
        'nous.thought',
        'wiki.updated',
        'unknown.event',
        '',
        'NOUS.MOVED', // case sensitive — must be exact
        'operator.unknown', // Phase 6: event-name namespace is allowlist-locked
    ])('denies %s', (eventType) => {
        expect(isAllowlisted(eventType)).toBe(false);
    });

    it('ALLOWLIST is frozen — runtime mutation throws', () => {
        expect(() => (ALLOWLIST as Set<string>).add('law.bypassed')).toThrow(TypeError);
        expect(() => (ALLOWLIST as Set<string>).delete('trade.reviewed')).toThrow(TypeError);
        expect(() => (ALLOWLIST as Set<string>).clear()).toThrow(TypeError);
        expect(ALLOWLIST.size).toBe(17);
    });

    it('Phase 6 operator.* tuple order: inspected < paused < resumed < law_changed < telos_forced', () => {
        // Iteration order of a Set preserves insertion order — used here as a
        // D-10 structural proof that the tuple was appended, not reshuffled.
        const members = Array.from(ALLOWLIST);
        const idx = (k: string): number => members.indexOf(k);
        expect(idx('grid.stopped')).toBeLessThan(idx('operator.inspected'));
        expect(idx('operator.inspected')).toBeLessThan(idx('operator.paused'));
        expect(idx('operator.paused')).toBeLessThan(idx('operator.resumed'));
        expect(idx('operator.resumed')).toBeLessThan(idx('operator.law_changed'));
        expect(idx('operator.law_changed')).toBeLessThan(idx('operator.telos_forced'));
    });
});

describe('broadcast-allowlist: Phase 6 operator.* payload privacy (representative cases)', () => {
    it('H3 pause payload passes privacy', () => {
        expect(
            payloadPrivacyCheck({ tier: 'H3', action: 'pause', operator_id: 'op:test-1' }).ok,
        ).toBe(true);
    });

    it('H4 force-Telos hash-only payload passes privacy', () => {
        expect(
            payloadPrivacyCheck({
                tier: 'H4',
                action: 'force_telos',
                operator_id: 'op:test-2',
                target_did: 'did:noesis:test',
                telos_hash_before: 'a'.repeat(64),
                telos_hash_after: 'b'.repeat(64),
            }).ok,
        ).toBe(true);
    });

    it('H4 force-Telos payload carrying wiki leak is rejected (T-6-03)', () => {
        expect(
            payloadPrivacyCheck({ tier: 'H4', action: 'force_telos', wiki: 'leak' }).ok,
        ).toBe(false);
    });
});

describe('broadcast-allowlist: payloadPrivacyCheck', () => {
    it('passes benign numeric/currency payload', () => {
        expect(payloadPrivacyCheck({ amount: 10, currency: 'ousia' })).toEqual({ ok: true });
    });

    it('passes empty object', () => {
        expect(payloadPrivacyCheck({})).toEqual({ ok: true });
    });

    it('passes null-valued allowed key', () => {
        expect(payloadPrivacyCheck({ amount: null })).toEqual({ ok: true });
    });

    it('flags top-level `prompt`', () => {
        const r = payloadPrivacyCheck({ prompt: 'You are Sophia' });
        expect(r.ok).toBe(false);
        expect(r.offendingPath).toBe('prompt');
        expect(r.offendingKeyword).toBe('prompt');
    });

    it('flags nested `response` with dotted path', () => {
        const r = payloadPrivacyCheck({ meta: { response: 'I want to trade' } });
        expect(r.ok).toBe(false);
        expect(r.offendingPath).toBe('meta.response');
        expect(r.offendingKeyword).toBe('response');
    });

    it('flags array-nested `thought`', () => {
        const r = payloadPrivacyCheck({ history: [{ thought: 'x' }] });
        expect(r.ok).toBe(false);
        expect(r.offendingPath).toBe('history.0.thought');
        expect(r.offendingKeyword).toBe('thought');
    });

    it('is case-insensitive', () => {
        expect(payloadPrivacyCheck({ Prompt: 'x' }).ok).toBe(false);
        expect(payloadPrivacyCheck({ RESPONSE: 'x' }).ok).toBe(false);
        expect(payloadPrivacyCheck({ WiKi: 'x' }).ok).toBe(false);
    });

    it('matches forbidden substring anywhere in key (user_prompt, prompting)', () => {
        expect(payloadPrivacyCheck({ user_prompt: 'x' }).ok).toBe(false);
        expect(payloadPrivacyCheck({ prompting: 'x' }).ok).toBe(false);
    });

    it('flags `wiki`', () => {
        const r = payloadPrivacyCheck({ wiki: 'page content' });
        expect(r.ok).toBe(false);
        expect(r.offendingKeyword).toBe('wiki');
    });

    it('flags `reflection`', () => {
        const r = payloadPrivacyCheck({ reflection: 'summary' });
        expect(r.ok).toBe(false);
        expect(r.offendingKeyword).toBe('reflection');
    });

    it('flags `emotion_delta`', () => {
        const r = payloadPrivacyCheck({ emotion_delta: { joy: 0.1 } });
        expect(r.ok).toBe(false);
        expect(r.offendingKeyword).toBe('emotion_delta');
    });

    it('FORBIDDEN_KEY_PATTERN covers all six forbidden keywords', () => {
        for (const kw of ['prompt', 'response', 'wiki', 'reflection', 'thought', 'emotion_delta']) {
            expect(FORBIDDEN_KEY_PATTERN.test(kw)).toBe(true);
        }
    });

    it('permits arrays of primitives with safe keys', () => {
        expect(payloadPrivacyCheck({ tags: ['a', 'b', 'c'] })).toEqual({ ok: true });
    });

    it('handles null and primitive payloads without throwing', () => {
        expect(payloadPrivacyCheck(null)).toEqual({ ok: true });
        expect(payloadPrivacyCheck('a string')).toEqual({ ok: true });
        expect(payloadPrivacyCheck(42)).toEqual({ ok: true });
    });
});
