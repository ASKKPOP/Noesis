/**
 * L2b D-MONEY-08 — appendProcurementSettled emitter unit tests.
 * Verifies closed 4-key payload, all guards, and allowlist membership.
 */
import { describe, expect, it } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendProcurementSettled } from '../../src/audit/append-procurement-settled.js';
import { ALLOWLIST_MEMBERS } from '../../src/audit/broadcast-allowlist.js';

const HASH = 'f'.repeat(64);
const CONTRACT_ID = '33345678-1234-1234-1234-123456789abc';

function validPayload() {
    return {
        award_wei: '4000',
        contract_id: CONTRACT_ID,
        tick: 9,
        winner_did_hash: HASH,
    };
}

describe('appendProcurementSettled — emitter', () => {
    it('emits procurement.settled with a closed 4-key payload', () => {
        const chain = new AuditChain();
        const entry = appendProcurementSettled(chain, validPayload());
        expect(entry.eventType).toBe('procurement.settled');
        expect(entry.actorDid).toBe(HASH);
        expect(entry.payload).toEqual(validPayload());
    });

    it('procurement.settled is in the frozen allowlist', () => {
        expect((ALLOWLIST_MEMBERS as readonly string[]).includes('procurement.settled')).toBe(true);
    });

    it('rejects bad winner_did_hash (not HEX64)', () => {
        const chain = new AuditChain();
        expect(() => appendProcurementSettled(chain, { ...validPayload(), winner_did_hash: 'nothex' }))
            .toThrow(TypeError);
    });

    it('rejects bad contract_id (not UUID)', () => {
        const chain = new AuditChain();
        expect(() => appendProcurementSettled(chain, { ...validPayload(), contract_id: 'not-a-uuid' }))
            .toThrow(TypeError);
    });

    it('rejects award_wei with non-decimal chars', () => {
        const chain = new AuditChain();
        expect(() => appendProcurementSettled(chain, { ...validPayload(), award_wei: '4000.5' }))
            .toThrow(TypeError);
    });

    it('rejects negative tick', () => {
        const chain = new AuditChain();
        expect(() => appendProcurementSettled(chain, { ...validPayload(), tick: -1 }))
            .toThrow(TypeError);
    });

    it('refuses an extra key (closed-tuple)', () => {
        const chain = new AuditChain();
        // @ts-expect-error — intentional extra key
        expect(() => appendProcurementSettled(chain, { ...validPayload(), extra: 'leak' }))
            .toThrow(TypeError);
    });

    it('refuses a missing key (closed-tuple)', () => {
        const chain = new AuditChain();
        const { award_wei: _omit, ...noAward } = validPayload();
        // @ts-expect-error — intentionally missing key
        expect(() => appendProcurementSettled(chain, noAward))
            .toThrow(TypeError);
    });
});
