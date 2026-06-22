/**
 * W4 (D-MONEY-09) — append-portal-account-endowed validation locks.
 *
 * The sole producer for portal.account_endowed enforces a closed 5-key payload
 * { amount_wei, civic_did_hash, endowment_id, source, tick } with per-field
 * regex/enum guards, the privacy gate, and an actorDid of civic_did_hash.
 */
import { describe, it, expect } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendPortalAccountEndowed } from '../../src/audit/append-portal-account-endowed.js';
import { ALLOWLIST } from '../../src/audit/broadcast-allowlist.js';

const HASH = 'a'.repeat(64);
const UUID = '99200ab8-897e-41ca-8761-608c2ba16fb3';

function good() {
    return { amount_wei: '1000', civic_did_hash: HASH, endowment_id: UUID, source: 'model_first' as const, tick: 7 };
}

describe('appendPortalAccountEndowed', () => {
    it('appends a portal.account_endowed entry with actorDid = civic_did_hash', () => {
        const audit = new AuditChain();
        const entry = appendPortalAccountEndowed(audit, good());
        expect(entry.eventType).toBe('portal.account_endowed');
        expect(entry.actorDid).toBe(HASH);
        expect(entry.payload).toEqual(good());
    });

    it('portal.account_endowed is on the broadcast allowlist', () => {
        expect(ALLOWLIST.has('portal.account_endowed')).toBe(true);
    });

    it('rejects a non-HEX64 civic_did_hash', () => {
        const audit = new AuditChain();
        expect(() => appendPortalAccountEndowed(audit, { ...good(), civic_did_hash: 'did:civic:noesis:alice' }))
            .toThrow(/civic_did_hash/);
    });

    it('rejects a non-UUID endowment_id', () => {
        const audit = new AuditChain();
        expect(() => appendPortalAccountEndowed(audit, { ...good(), endowment_id: 'not-a-uuid' }))
            .toThrow(/endowment_id/);
    });

    it('rejects amount_wei that is not a positive decimal string', () => {
        const audit = new AuditChain();
        expect(() => appendPortalAccountEndowed(audit, { ...good(), amount_wei: '0' })).toThrow(/amount_wei/);
        expect(() => appendPortalAccountEndowed(audit, { ...good(), amount_wei: '-5' })).toThrow(/amount_wei/);
        // @ts-expect-error — wrong type on purpose
        expect(() => appendPortalAccountEndowed(audit, { ...good(), amount_wei: 1000 })).toThrow(/amount_wei/);
    });

    it('rejects a source outside the enum', () => {
        const audit = new AuditChain();
        // @ts-expect-error — invalid enum on purpose
        expect(() => appendPortalAccountEndowed(audit, { ...good(), source: 'on_chain' })).toThrow(/source/);
    });

    it('rejects an extra key (closed-tuple violation)', () => {
        const audit = new AuditChain();
        // @ts-expect-error — extra key on purpose
        expect(() => appendPortalAccountEndowed(audit, { ...good(), operator_did: 'did:portal:noesis:op' }))
            .toThrow(/closed-tuple/);
    });
});
