/**
 * L2b D-MONEY-08 — appendProcurementAwarded emitter unit tests.
 * Verifies closed 5-key payload, all guards, and allowlist membership.
 */
import { describe, expect, it } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendProcurementAwarded } from '../../src/audit/append-procurement-awarded.js';
import { ALLOWLIST_MEMBERS } from '../../src/audit/broadcast-allowlist.js';

const HASH = 'd'.repeat(64);
const CONTRACT_ID = '33345678-1234-1234-1234-123456789abc';
const NOTICE_ID = '12345678-1234-1234-1234-123456789abc';

function validPayload() {
    return {
        award_wei: '4000',
        contract_id: CONTRACT_ID,
        notice_id: NOTICE_ID,
        tick: 7,
        winner_did_hash: HASH,
    };
}

describe('appendProcurementAwarded — emitter', () => {
    it('emits procurement.awarded with a closed 5-key payload', () => {
        const chain = new AuditChain();
        const entry = appendProcurementAwarded(chain, validPayload());
        expect(entry.eventType).toBe('procurement.awarded');
        expect(entry.actorDid).toBe(HASH);
        expect(entry.payload).toEqual(validPayload());
    });

    it('procurement.awarded is in the frozen allowlist', () => {
        expect((ALLOWLIST_MEMBERS as readonly string[]).includes('procurement.awarded')).toBe(true);
    });

    it('rejects bad winner_did_hash (not HEX64)', () => {
        const chain = new AuditChain();
        expect(() => appendProcurementAwarded(chain, { ...validPayload(), winner_did_hash: 'nothex' }))
            .toThrow(TypeError);
    });

    it('rejects bad contract_id (not UUID)', () => {
        const chain = new AuditChain();
        expect(() => appendProcurementAwarded(chain, { ...validPayload(), contract_id: 'not-a-uuid' }))
            .toThrow(TypeError);
    });

    it('rejects bad notice_id (not UUID)', () => {
        const chain = new AuditChain();
        expect(() => appendProcurementAwarded(chain, { ...validPayload(), notice_id: 'not-a-uuid' }))
            .toThrow(TypeError);
    });

    it('rejects award_wei with non-decimal chars', () => {
        const chain = new AuditChain();
        expect(() => appendProcurementAwarded(chain, { ...validPayload(), award_wei: '-4000' }))
            .toThrow(TypeError);
    });

    it('rejects negative tick', () => {
        const chain = new AuditChain();
        expect(() => appendProcurementAwarded(chain, { ...validPayload(), tick: -1 }))
            .toThrow(TypeError);
    });

    it('refuses an extra key (closed-tuple)', () => {
        const chain = new AuditChain();
        // @ts-expect-error — intentional extra key
        expect(() => appendProcurementAwarded(chain, { ...validPayload(), extra: 'leak' }))
            .toThrow(TypeError);
    });

    it('refuses a missing key (closed-tuple)', () => {
        const chain = new AuditChain();
        const { award_wei: _omit, ...noAward } = validPayload();
        // @ts-expect-error — intentionally missing key
        expect(() => appendProcurementAwarded(chain, noAward))
            .toThrow(TypeError);
    });
});
