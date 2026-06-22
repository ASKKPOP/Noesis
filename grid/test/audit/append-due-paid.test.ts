/**
 * L1b D-MONEY-08 — appendDuePaid emitter unit tests.
 * Verifies closed 4-key payload, all guards, and allowlist membership.
 */
import { describe, expect, it } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendDuePaid } from '../../src/audit/append-due-paid.js';
import { ALLOWLIST_MEMBERS } from '../../src/audit/broadcast-allowlist.js';

const HASH = 'b'.repeat(64);
const DUE_ID = '12345678-1234-1234-1234-123456789012';

function validPayload() {
    return {
        civic_did_hash: HASH,
        due_id: DUE_ID,
        paid_in: 'wei' as const,
        tick: 7,
    };
}

describe('appendDuePaid — emitter', () => {
    it('emits due.paid with paid_in wei', () => {
        const chain = new AuditChain();
        const entry = appendDuePaid(chain, validPayload());
        expect(entry.eventType).toBe('due.paid');
        expect(entry.actorDid).toBe(HASH);
        expect(entry.payload).toEqual(validPayload());
    });

    it('emits due.paid with paid_in labor', () => {
        const chain = new AuditChain();
        const entry = appendDuePaid(chain, { ...validPayload(), paid_in: 'labor' });
        expect(entry.eventType).toBe('due.paid');
        expect(entry.payload.paid_in).toBe('labor');
    });

    it('due.paid is in the frozen allowlist', () => {
        expect((ALLOWLIST_MEMBERS as readonly string[]).includes('due.paid')).toBe(true);
    });

    it('rejects bad civic_did_hash (not HEX64)', () => {
        const chain = new AuditChain();
        expect(() => appendDuePaid(chain, { ...validPayload(), civic_did_hash: 'short' }))
            .toThrow(TypeError);
    });

    it('rejects bad due_id (not UUID)', () => {
        const chain = new AuditChain();
        expect(() => appendDuePaid(chain, { ...validPayload(), due_id: 'not-a-uuid' }))
            .toThrow(TypeError);
    });

    it('rejects invalid paid_in value', () => {
        const chain = new AuditChain();
        // @ts-expect-error — intentional bad value
        expect(() => appendDuePaid(chain, { ...validPayload(), paid_in: 'bitcoin' }))
            .toThrow(TypeError);
    });

    it('rejects negative tick', () => {
        const chain = new AuditChain();
        expect(() => appendDuePaid(chain, { ...validPayload(), tick: -1 }))
            .toThrow(TypeError);
    });

    it('refuses an extra key (closed-tuple)', () => {
        const chain = new AuditChain();
        // @ts-expect-error — intentional extra key
        expect(() => appendDuePaid(chain, { ...validPayload(), amount: 999 }))
            .toThrow(TypeError);
    });

    it('refuses a missing key (closed-tuple)', () => {
        const chain = new AuditChain();
        const { paid_in: _omit, ...noPaidIn } = validPayload();
        // @ts-expect-error — intentionally missing key
        expect(() => appendDuePaid(chain, noPaidIn))
            .toThrow(TypeError);
    });
});
