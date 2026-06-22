/**
 * L1b D-MONEY-08 — appendDueAssessed emitter unit tests.
 * Verifies closed 6-key payload, all guards, and allowlist membership.
 */
import { describe, expect, it } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendDueAssessed } from '../../src/audit/append-due-assessed.js';
import { ALLOWLIST_MEMBERS } from '../../src/audit/broadcast-allowlist.js';

const HASH = 'a'.repeat(64);
const DUE_ID = '12345678-1234-1234-1234-123456789012';

function validPayload() {
    return {
        amount_credit: '5',
        amount_wei: '1000',
        civic_did_hash: HASH,
        due_id: DUE_ID,
        period: '2026-06',
        tick: 42,
    };
}

describe('appendDueAssessed — emitter', () => {
    it('emits due.assessed with a closed 6-key payload', () => {
        const chain = new AuditChain();
        const entry = appendDueAssessed(chain, validPayload());
        expect(entry.eventType).toBe('due.assessed');
        expect(entry.actorDid).toBe(HASH);
        expect(entry.payload).toEqual(validPayload());
    });

    it('due.assessed is in the frozen allowlist', () => {
        expect((ALLOWLIST_MEMBERS as readonly string[]).includes('due.assessed')).toBe(true);
    });

    it('rejects bad civic_did_hash (not HEX64)', () => {
        const chain = new AuditChain();
        expect(() => appendDueAssessed(chain, { ...validPayload(), civic_did_hash: 'nothex' }))
            .toThrow(TypeError);
    });

    it('rejects bad due_id (not UUID)', () => {
        const chain = new AuditChain();
        expect(() => appendDueAssessed(chain, { ...validPayload(), due_id: 'not-a-uuid' }))
            .toThrow(TypeError);
    });

    it('rejects amount_wei with non-decimal chars', () => {
        const chain = new AuditChain();
        expect(() => appendDueAssessed(chain, { ...validPayload(), amount_wei: '10.5' }))
            .toThrow(TypeError);
    });

    it('rejects amount_credit with non-decimal chars', () => {
        const chain = new AuditChain();
        expect(() => appendDueAssessed(chain, { ...validPayload(), amount_credit: '-1' }))
            .toThrow(TypeError);
    });

    it('rejects empty period', () => {
        const chain = new AuditChain();
        expect(() => appendDueAssessed(chain, { ...validPayload(), period: '' }))
            .toThrow(TypeError);
    });

    it('rejects negative tick', () => {
        const chain = new AuditChain();
        expect(() => appendDueAssessed(chain, { ...validPayload(), tick: -1 }))
            .toThrow(TypeError);
    });

    it('rejects non-integer tick', () => {
        const chain = new AuditChain();
        expect(() => appendDueAssessed(chain, { ...validPayload(), tick: 1.5 }))
            .toThrow(TypeError);
    });

    it('refuses an extra key (closed-tuple)', () => {
        const chain = new AuditChain();
        // @ts-expect-error — intentional extra key
        expect(() => appendDueAssessed(chain, { ...validPayload(), extra: 'leak' }))
            .toThrow(TypeError);
    });

    it('refuses a missing key (closed-tuple)', () => {
        const chain = new AuditChain();
        const { period: _omit, ...noPeriod } = validPayload();
        // @ts-expect-error — intentionally missing key
        expect(() => appendDueAssessed(chain, noPeriod))
            .toThrow(TypeError);
    });
});
