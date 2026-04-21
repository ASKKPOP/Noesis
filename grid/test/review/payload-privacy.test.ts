// grid/test/review/payload-privacy.test.ts — Phase 5 D-12 regression.
//
// Invariant: every possible trade.reviewed payload shape (pass + 5 fail variants)
// passes payloadPrivacyCheck with ok:true. No reason-code literal, DID, trade_id,
// or verdict value can match FORBIDDEN_KEY_PATTERN (prompt|response|wiki|reflection|
// thought|emotion_delta).
//
// Purpose: if a future ReviewFailureCode is added that happens to contain a
// forbidden substring (e.g. 'bad_prompt_hash'), this test turns red at author time
// BEFORE the sovereignty leak ever reaches the AuditChain producer boundary.

import { describe, it, expect } from 'vitest';
import { payloadPrivacyCheck, FORBIDDEN_KEY_PATTERN } from '../../src/audit/broadcast-allowlist.js';
import { VALID_REVIEW_FAILURE_CODES } from '../../src/review/types.js';

describe('D-12: trade.reviewed payload passes payloadPrivacyCheck', () => {
    const REVIEWER_DID = 'did:noesis:reviewer';

    const passPayload = {
        trade_id: 'nonce-123',
        reviewer_did: REVIEWER_DID,
        verdict: 'pass',
    };

    const failPayloadFor = (code: string) => ({
        trade_id: 'nonce-123',
        reviewer_did: REVIEWER_DID,
        verdict: 'fail',
        failed_check: code,
        failure_reason: code,
    });

    it('pass payload has no forbidden keys', () => {
        expect(payloadPrivacyCheck(passPayload)).toEqual({ ok: true });
    });

    it.each(Array.from(VALID_REVIEW_FAILURE_CODES))(
        'fail payload with %s reason passes privacy check',
        (code) => {
            expect(payloadPrivacyCheck(failPayloadFor(code))).toEqual({ ok: true });
        },
    );

    it('no ReviewFailureCode literal contains a FORBIDDEN_KEY_PATTERN substring (static regression)', () => {
        for (const code of VALID_REVIEW_FAILURE_CODES) {
            expect(FORBIDDEN_KEY_PATTERN.test(code)).toBe(false);
        }
    });

    it('reviewer DID does not match FORBIDDEN_KEY_PATTERN', () => {
        expect(FORBIDDEN_KEY_PATTERN.test(REVIEWER_DID)).toBe(false);
    });

    it('verdict literal strings do not match FORBIDDEN_KEY_PATTERN', () => {
        expect(FORBIDDEN_KEY_PATTERN.test('pass')).toBe(false);
        expect(FORBIDDEN_KEY_PATTERN.test('fail')).toBe(false);
    });
});
