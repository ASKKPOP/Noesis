/**
 * AGENCY-03 / D-12 enumerator — payload privacy gate across all 5 operator.* events.
 *
 * Distinct from operator-event-invariant.test.ts (D-13 tier gate). Keeping the
 * two contracts in separate files makes failures precise to attribute:
 *   - D-13 breakage → tier-required check regressed
 *   - D-12 breakage → privacy gate regressed
 *
 * Every positive case mirrors the D-11 payload shape exactly (no extra fields
 * beyond what CONTEXT.md §D-11 prescribes). The negative case enumerates the
 * six FORBIDDEN_KEY_PATTERN keywords — mitigates T-6-03 (broadcast leak) and
 * T-6-07 (Telos plaintext exfiltration).
 *
 * See: .planning/phases/06-operator-agency-foundation-h1-h4/06-CONTEXT.md
 *      §D-11 (event-specific payload extensions), §D-12 (privacy enumerator).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendOperatorEvent } from '../../src/audit/operator-events.js';
import { payloadPrivacyCheck } from '../../src/audit/broadcast-allowlist.js';

const VALID_OP_ID = 'op:00000000-0000-4000-8000-000000000000';
const VALID_ACTOR = 'did:noesis:test';
const VALID_TARGET = 'did:noesis:alpha';

describe('AGENCY-03 / D-12: payload privacy gate enumerated across all 5 operator.* events', () => {
    let chain: AuditChain;
    beforeEach(() => { chain = new AuditChain(); });

    // ── Positive cases: each D-11 payload shape passes privacy + append ──

    it('operator.inspected (H2): passes privacy with {tier, action, operator_id, target_did}', () => {
        const payload = {
            tier: 'H2' as const,
            action: 'inspect',
            operator_id: VALID_OP_ID,
            target_did: VALID_TARGET,
        };
        expect(payloadPrivacyCheck(payload).ok).toBe(true);
        expect(() =>
            appendOperatorEvent(chain, 'operator.inspected', VALID_ACTOR, payload, VALID_TARGET),
        ).not.toThrow();
    });

    it('operator.paused (H3): passes privacy with {tier, action, operator_id}', () => {
        const payload = { tier: 'H3' as const, action: 'pause', operator_id: VALID_OP_ID };
        expect(payloadPrivacyCheck(payload).ok).toBe(true);
        expect(() =>
            appendOperatorEvent(chain, 'operator.paused', VALID_ACTOR, payload),
        ).not.toThrow();
    });

    it('operator.resumed (H3): passes privacy with {tier, action, operator_id}', () => {
        const payload = { tier: 'H3' as const, action: 'resume', operator_id: VALID_OP_ID };
        expect(payloadPrivacyCheck(payload).ok).toBe(true);
        expect(() =>
            appendOperatorEvent(chain, 'operator.resumed', VALID_ACTOR, payload),
        ).not.toThrow();
    });

    it('operator.law_changed (H3): passes privacy with {tier, action, operator_id, law_id, change_type} — NO law_body/content', () => {
        const payload = {
            tier: 'H3' as const,
            action: 'amend_law',
            operator_id: VALID_OP_ID,
            law_id: 'law-001',
            change_type: 'amended' as const,
        };
        expect(payloadPrivacyCheck(payload).ok).toBe(true);
        expect(() =>
            appendOperatorEvent(chain, 'operator.law_changed', VALID_ACTOR, payload),
        ).not.toThrow();
        // Shape convention: the broadcast payload MUST NOT carry law content.
        // Law body remains accessible via GET /api/v1/governance/laws/:id.
        expect(Object.keys(payload)).not.toContain('law_body');
        expect(Object.keys(payload)).not.toContain('law_content');
    });

    it('operator.telos_forced (H4): passes privacy with {tier, action, operator_id, target_did, telos_hash_before, telos_hash_after} — HASH ONLY', () => {
        const payload = {
            tier: 'H4' as const,
            action: 'force_telos',
            operator_id: VALID_OP_ID,
            target_did: VALID_TARGET,
            telos_hash_before: 'a'.repeat(64),
            telos_hash_after: 'b'.repeat(64),
        };
        expect(payloadPrivacyCheck(payload).ok).toBe(true);
        expect(() =>
            appendOperatorEvent(chain, 'operator.telos_forced', VALID_ACTOR, payload, VALID_TARGET),
        ).not.toThrow();
        // T-6-07: goal contents MUST stay in Brain. Payload carries hashes only.
        expect(Object.keys(payload)).not.toContain('new_telos');
        expect(Object.keys(payload)).not.toContain('goal');
        expect(Object.keys(payload)).not.toContain('telos');
    });

    // ── Negative cases: forbidden keywords trip the privacy gate ──

    it.each([
        ['prompt', { tier: 'H2', action: 'inspect', operator_id: VALID_OP_ID, prompt: 'leak' }],
        ['response', { tier: 'H2', action: 'inspect', operator_id: VALID_OP_ID, response: 'leak' }],
        ['wiki', { tier: 'H4', action: 'force', operator_id: VALID_OP_ID, wiki: 'leak' }],
        ['reflection', { tier: 'H4', action: 'force', operator_id: VALID_OP_ID, reflection: 'leak' }],
        ['thought', { tier: 'H3', action: 'pause', operator_id: VALID_OP_ID, thought: 'leak' }],
        ['emotion_delta', { tier: 'H4', action: 'force', operator_id: VALID_OP_ID, emotion_delta: 0.5 }],
    ])('rejects payload with forbidden key "%s" (T-6-03 / T-6-07 privacy invariant)', (_key, payload) => {
        expect(payloadPrivacyCheck(payload as Record<string, unknown>).ok).toBe(false);
        expect(() =>
            appendOperatorEvent(
                chain,
                'operator.telos_forced',
                VALID_ACTOR,
                payload as never,
            ),
        ).toThrow(/privacy|leak/i);
    });

    it('rejects nested-path forbidden key (e.g. `meta.prompt`)', () => {
        const payload = {
            tier: 'H3' as const,
            action: 'pause',
            operator_id: VALID_OP_ID,
            meta: { prompt: 'nested leak' },
        };
        expect(payloadPrivacyCheck(payload).ok).toBe(false);
        expect(() =>
            appendOperatorEvent(chain, 'operator.paused', VALID_ACTOR, payload as never),
        ).toThrow(/privacy|leak/i);
    });

    it('side-effect guarantee: a rejected payload never commits to the chain', () => {
        const headBefore = chain.head;
        expect(() =>
            appendOperatorEvent(chain, 'operator.telos_forced', VALID_ACTOR, {
                tier: 'H4',
                action: 'force',
                operator_id: VALID_OP_ID,
                wiki: 'leak',
            } as never),
        ).toThrow();
        expect(chain.head).toBe(headBefore);
        expect(chain.length).toBe(0);
    });
});
