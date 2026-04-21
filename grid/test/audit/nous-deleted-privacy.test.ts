/**
 * Phase 8 AGENCY-05 — operator.nous_deleted privacy matrix (D-25, D-27).
 *
 * 8-case matrix: 6 flat forbidden + 1 nested forbidden + 1 happy baseline.
 * Plus additional guards for tier/action literals and operator_id self-report.
 * Plus a coverage assertion that 'operator.nous_deleted' is in the allowlist.
 *
 * The happy payload's 5 keys are natively privacy-clean per D-27
 * (no prompt|response|wiki|reflection|thought|emotion_delta). The
 * appendNousDeleted producer-boundary helper enforces the closed-tuple
 * check AND the payloadPrivacyCheck gate — the forbidden cases hit the
 * closed-tuple check first (extra key).
 *
 * See: 08-CONTEXT D-25, D-27, D-31.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendNousDeleted } from '../../src/audit/append-nous-deleted.js';
import { ALLOWLIST, payloadPrivacyCheck } from '../../src/audit/broadcast-allowlist.js';

const OPERATOR = 'op:11111111-1111-4111-8111-111111111111';
const TARGET   = 'did:noesis:alpha';
const HASH     = 'a'.repeat(64);

const happy = {
    tier: 'H5' as const,
    action: 'delete' as const,
    operator_id: OPERATOR,
    target_did: TARGET,
    pre_deletion_state_hash: HASH,
};

/** 6 flat forbidden + 1 nested forbidden = 7 failure cases. */
const FORBIDDEN_CASES: Array<[string, Record<string, unknown>]> = [
    ['prompt',        { ...happy, prompt: 'leak' }],
    ['response',      { ...happy, response: 'leak' }],
    ['wiki',          { ...happy, wiki: 'leak' }],
    ['reflection',    { ...happy, reflection: 'leak' }],
    ['thought',       { ...happy, thought: 'leak' }],
    ['emotion_delta', { ...happy, emotion_delta: 0.5 }],
    ['nested.prompt', { ...happy, meta: { prompt: 'leak' } }],
];

describe('operator.nous_deleted — privacy matrix (D-25, D-27)', () => {
    let chain: AuditChain;
    beforeEach(() => { chain = new AuditChain(); });

    it('allowlist includes operator.nous_deleted (coverage)', () => {
        expect(ALLOWLIST.has('operator.nous_deleted')).toBe(true);
    });

    it('happy baseline — well-formed payload appends', () => {
        expect(() => appendNousDeleted(chain, OPERATOR, happy)).not.toThrow();
        const entries = chain.all();
        const last = entries[entries.length - 1];
        expect(last?.eventType).toBe('operator.nous_deleted');
        expect(Object.keys(last!.payload as Record<string, unknown>).sort()).toEqual(
            ['action', 'operator_id', 'pre_deletion_state_hash', 'target_did', 'tier'],
        );
    });

    it.each(FORBIDDEN_CASES)('rejects payload with forbidden key %s', (_label, bad) => {
        expect(() => appendNousDeleted(chain, OPERATOR, bad as typeof happy))
            .toThrow(/unexpected|privacy/i);
    });

    it('rejects tier !== H5', () => {
        expect(() => appendNousDeleted(chain, OPERATOR, { ...happy, tier: 'H4' } as unknown as typeof happy))
            .toThrow(/tier.*H5/i);
    });

    it('rejects action !== delete', () => {
        expect(() => appendNousDeleted(chain, OPERATOR, { ...happy, action: 'pause' } as unknown as typeof happy))
            .toThrow(/action.*delete/i);
    });

    it('rejects invalid pre_deletion_state_hash', () => {
        expect(() => appendNousDeleted(chain, OPERATOR, { ...happy, pre_deletion_state_hash: 'nothex' }))
            .toThrow(/hex64|pre_deletion_state_hash/i);
    });

    it('rejects invalid target_did', () => {
        expect(() => appendNousDeleted(chain, OPERATOR, { ...happy, target_did: 'not-a-did' }))
            .toThrow(/target_did|did/i);
    });

    it('rejects invalid operator_id (not op:uuid format)', () => {
        expect(() => appendNousDeleted(chain, 'bad-op-id', { ...happy, operator_id: 'bad-op-id' }))
            .toThrow(/operator_id/i);
    });

    it('rejects when payload.operator_id !== operatorId param (self-report)', () => {
        const other = 'op:22222222-2222-4222-8222-222222222222';
        expect(() => appendNousDeleted(chain, other, { ...happy }))
            .toThrow(/operator_id|self-report/i);
    });

    it('payloadPrivacyCheck natively passes 5-key closed tuple (D-27)', () => {
        expect(payloadPrivacyCheck(happy).ok).toBe(true);
    });
});
