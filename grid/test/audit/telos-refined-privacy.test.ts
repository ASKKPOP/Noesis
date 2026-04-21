/**
 * Phase 7 DIALOG-02 — telos.refined privacy matrix (D-21, D-22).
 *
 * 8-case matrix: 6 flat forbidden + 1 nested forbidden + 1 happy baseline.
 * Plus a coverage assertion that `'telos.refined'` is in the allowlist.
 *
 * The happy payload's 4 keys are natively privacy-clean per D-21
 * (no `prompt|response|wiki|reflection|thought|emotion_delta`). The
 * `appendTelosRefined` producer-boundary helper enforces both the
 * closed-tuple check AND the payloadPrivacyCheck gate — either guard
 * should catch the forbidden cases; we assert the rejection without
 * prescribing which guard fired.
 *
 * Mitigates T-07-25 (metadata leak from Brain), T-07-26 (nested leak).
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendTelosRefined } from '../../src/audit/append-telos-refined.js';
import { ALLOWLIST, payloadPrivacyCheck } from '../../src/audit/broadcast-allowlist.js';

const happy = {
    did: 'did:noesis:alpha',
    before_goal_hash: 'a'.repeat(64),
    after_goal_hash: 'b'.repeat(64),
    triggered_by_dialogue_id: 'c'.repeat(16),
};

/** 6 flat forbidden + 1 nested forbidden = 7 failure cases. +1 happy baseline = 8 total. */
const FORBIDDEN_CASES: Array<[string, Record<string, unknown>]> = [
    ['prompt',          { ...happy, prompt: 'leak' }],
    ['response',        { ...happy, response: 'leak' }],
    ['wiki',            { ...happy, wiki: 'leak' }],
    ['reflection',      { ...happy, reflection: 'leak' }],
    ['thought',         { ...happy, thought: 'leak' }],
    ['emotion_delta',   { ...happy, emotion_delta: 0.5 }],
    ['nested.prompt',   { ...happy, meta: { prompt: 'leak deep' } }],
];

describe('telos.refined — privacy matrix (D-21, D-22)', () => {
    let chain: AuditChain;
    beforeEach(() => { chain = new AuditChain(); });

    it('allowlist enumeration includes telos.refined (coverage assertion)', () => {
        expect(ALLOWLIST.has('telos.refined')).toBe(true);
    });

    it('happy baseline — well-formed payload appends successfully', () => {
        expect(() => appendTelosRefined(chain, happy.did, happy)).not.toThrow();
        const entries = chain.all();
        const last = entries[entries.length - 1];
        expect(last?.eventType).toBe('telos.refined');
        const payload = last?.payload as Record<string, unknown>;
        expect(Object.keys(payload).sort()).toEqual(
            ['after_goal_hash', 'before_goal_hash', 'did', 'triggered_by_dialogue_id'],
        );
    });

    it.each(FORBIDDEN_CASES)('rejects payload with forbidden key %s', (_label, bad) => {
        expect(() => appendTelosRefined(chain, happy.did, bad as typeof happy))
            .toThrow(/unexpected key|privacy violation/i);
    });

    it('payloadPrivacyCheck natively passes the 4-key closed tuple (D-21)', () => {
        expect(payloadPrivacyCheck(happy).ok).toBe(true);
    });
});
