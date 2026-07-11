/**
 * Phase 62 (D-MONEY-02) — append-portal-account-linked validation locks.
 *
 * The sole producer for portal.account_linked enforces a closed 4-key payload
 * { civic_did_hash, nous_account, owner_address_hash, tick } with per-field
 * regex guards, the privacy gate, and an actorDid of civic_did_hash.
 */
import { describe, it, expect } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendPortalAccountLinked } from '../../src/audit/append-portal-account-linked.js';
import { ALLOWLIST } from '../../src/audit/broadcast-allowlist.js';

const HASH = 'a'.repeat(64);
const OWNER_HASH = 'b'.repeat(64);
const ACCOUNT = '0x' + 'c'.repeat(40);

function good() {
    return { civic_did_hash: HASH, nous_account: ACCOUNT, owner_address_hash: OWNER_HASH, tick: 7 };
}

describe('appendPortalAccountLinked', () => {
    it('appends a portal.account_linked entry with actorDid = civic_did_hash', () => {
        const audit = new AuditChain();
        const entry = appendPortalAccountLinked(audit, good());
        expect(entry.eventType).toBe('portal.account_linked');
        expect(entry.actorDid).toBe(HASH);
        expect(entry.payload).toEqual(good());
    });

    it('portal.account_linked is on the broadcast allowlist', () => {
        expect(ALLOWLIST.has('portal.account_linked')).toBe(true);
    });

    it('rejects a non-HEX64 civic_did_hash', () => {
        const audit = new AuditChain();
        expect(() => appendPortalAccountLinked(audit, { ...good(), civic_did_hash: 'did:civic:noesis:sophia' }))
            .toThrow(/civic_did_hash/);
    });

    it('rejects a non-HEX64 owner_address_hash', () => {
        const audit = new AuditChain();
        expect(() => appendPortalAccountLinked(audit, { ...good(), owner_address_hash: '0xdeadbeef' }))
            .toThrow(/owner_address_hash/);
    });

    it('rejects a malformed nous_account address', () => {
        const audit = new AuditChain();
        expect(() => appendPortalAccountLinked(audit, { ...good(), nous_account: 'not-an-address' }))
            .toThrow(/nous_account/);
    });

    it('rejects a negative tick', () => {
        const audit = new AuditChain();
        expect(() => appendPortalAccountLinked(audit, { ...good(), tick: -1 })).toThrow(/tick/);
    });

    it('rejects an extra key (closed-tuple violation)', () => {
        const audit = new AuditChain();
        // @ts-expect-error — extra key on purpose
        expect(() => appendPortalAccountLinked(audit, { ...good(), signature: '0xabc' }))
            .toThrow(/closed-tuple/);
    });
});
