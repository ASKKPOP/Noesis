/**
 * L2b D-MONEY-08 — appendProcurementNoticeIssued emitter unit tests.
 * Verifies closed 6-key payload, all guards, and allowlist membership.
 */
import { describe, expect, it } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendProcurementNoticeIssued } from '../../src/audit/append-procurement-notice-issued.js';
import { ALLOWLIST_MEMBERS } from '../../src/audit/broadcast-allowlist.js';

const HASH = 'b'.repeat(64);
const NOTICE_ID = '12345678-1234-1234-1234-123456789abc';

function validPayload() {
    return {
        budget_wei: '5000',
        function_type: 'power',
        notice_id: NOTICE_ID,
        polis_authorization_ref_hash: HASH,
        tick: 10,
        zone: 'infrastructure',
    };
}

describe('appendProcurementNoticeIssued — emitter', () => {
    it('emits procurement.notice_issued with a closed 6-key payload', () => {
        const chain = new AuditChain();
        const entry = appendProcurementNoticeIssued(chain, validPayload());
        expect(entry.eventType).toBe('procurement.notice_issued');
        expect(entry.actorDid).toBe(HASH);
        expect(entry.payload).toEqual(validPayload());
    });

    it('procurement.notice_issued is in the frozen allowlist', () => {
        expect((ALLOWLIST_MEMBERS as readonly string[]).includes('procurement.notice_issued')).toBe(true);
    });

    it('rejects bad polis_authorization_ref_hash (not HEX64)', () => {
        const chain = new AuditChain();
        expect(() => appendProcurementNoticeIssued(chain, { ...validPayload(), polis_authorization_ref_hash: 'nothex' }))
            .toThrow(TypeError);
    });

    it('rejects bad notice_id (not UUID)', () => {
        const chain = new AuditChain();
        expect(() => appendProcurementNoticeIssued(chain, { ...validPayload(), notice_id: 'not-a-uuid' }))
            .toThrow(TypeError);
    });

    it('rejects budget_wei with non-decimal chars', () => {
        const chain = new AuditChain();
        expect(() => appendProcurementNoticeIssued(chain, { ...validPayload(), budget_wei: '5000.5' }))
            .toThrow(TypeError);
    });

    it('rejects empty function_type', () => {
        const chain = new AuditChain();
        expect(() => appendProcurementNoticeIssued(chain, { ...validPayload(), function_type: '' }))
            .toThrow(TypeError);
    });

    it('rejects empty zone', () => {
        const chain = new AuditChain();
        expect(() => appendProcurementNoticeIssued(chain, { ...validPayload(), zone: '' }))
            .toThrow(TypeError);
    });

    it('rejects negative tick', () => {
        const chain = new AuditChain();
        expect(() => appendProcurementNoticeIssued(chain, { ...validPayload(), tick: -1 }))
            .toThrow(TypeError);
    });

    it('refuses an extra key (closed-tuple)', () => {
        const chain = new AuditChain();
        // @ts-expect-error — intentional extra key
        expect(() => appendProcurementNoticeIssued(chain, { ...validPayload(), extra: 'leak' }))
            .toThrow(TypeError);
    });

    it('refuses a missing key (closed-tuple)', () => {
        const chain = new AuditChain();
        const { zone: _omit, ...noZone } = validPayload();
        // @ts-expect-error — intentionally missing key
        expect(() => appendProcurementNoticeIssued(chain, noZone))
            .toThrow(TypeError);
    });
});
