/**
 * L2b D-MONEY-08 — appendProcurementAttested emitter unit tests.
 * Verifies closed 3-key payload, all guards, and allowlist membership.
 */
import { describe, expect, it } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendProcurementAttested } from '../../src/audit/append-procurement-attested.js';
import { ALLOWLIST_MEMBERS } from '../../src/audit/broadcast-allowlist.js';

const HASH = 'e'.repeat(64);
const CONTRACT_ID = '33345678-1234-1234-1234-123456789abc';

function validPayload() {
    return {
        attestation_ref_hash: HASH,
        contract_id: CONTRACT_ID,
        tick: 9,
    };
}

describe('appendProcurementAttested — emitter', () => {
    it('emits procurement.attested with a closed 3-key payload', () => {
        const chain = new AuditChain();
        const entry = appendProcurementAttested(chain, validPayload());
        expect(entry.eventType).toBe('procurement.attested');
        expect(entry.actorDid).toBe(HASH);
        expect(entry.payload).toEqual(validPayload());
    });

    it('procurement.attested is in the frozen allowlist', () => {
        expect((ALLOWLIST_MEMBERS as readonly string[]).includes('procurement.attested')).toBe(true);
    });

    it('rejects bad attestation_ref_hash (not HEX64)', () => {
        const chain = new AuditChain();
        expect(() => appendProcurementAttested(chain, { ...validPayload(), attestation_ref_hash: 'nothex' }))
            .toThrow(TypeError);
    });

    it('rejects bad contract_id (not UUID)', () => {
        const chain = new AuditChain();
        expect(() => appendProcurementAttested(chain, { ...validPayload(), contract_id: 'not-a-uuid' }))
            .toThrow(TypeError);
    });

    it('rejects negative tick', () => {
        const chain = new AuditChain();
        expect(() => appendProcurementAttested(chain, { ...validPayload(), tick: -1 }))
            .toThrow(TypeError);
    });

    it('rejects non-integer tick', () => {
        const chain = new AuditChain();
        expect(() => appendProcurementAttested(chain, { ...validPayload(), tick: 1.5 }))
            .toThrow(TypeError);
    });

    it('refuses an extra key (closed-tuple)', () => {
        const chain = new AuditChain();
        // @ts-expect-error — intentional extra key
        expect(() => appendProcurementAttested(chain, { ...validPayload(), extra: 'leak' }))
            .toThrow(TypeError);
    });

    it('refuses a missing key (closed-tuple)', () => {
        const chain = new AuditChain();
        const { contract_id: _omit, ...noContract } = validPayload();
        // @ts-expect-error — intentionally missing key
        expect(() => appendProcurementAttested(chain, noContract))
            .toThrow(TypeError);
    });
});
