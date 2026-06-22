/**
 * L2b D-MONEY-08 — appendProcurementCancelled emitter unit tests.
 * Verifies closed 3-key payload, all guards, and allowlist membership.
 */
import { describe, expect, it } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendProcurementCancelled } from '../../src/audit/append-procurement-cancelled.js';
import { ALLOWLIST_MEMBERS } from '../../src/audit/broadcast-allowlist.js';

const NOTICE_ID = '12345678-1234-1234-1234-123456789abc';

function validPayload() {
    return {
        notice_id: NOTICE_ID,
        reason: 'withdrawn',
        tick: 10,
    };
}

describe('appendProcurementCancelled — emitter', () => {
    it('emits procurement.cancelled with a closed 3-key payload', () => {
        const chain = new AuditChain();
        const entry = appendProcurementCancelled(chain, validPayload());
        expect(entry.eventType).toBe('procurement.cancelled');
        expect(entry.actorDid).toBe(NOTICE_ID);
        expect(entry.payload).toEqual(validPayload());
    });

    it('procurement.cancelled is in the frozen allowlist', () => {
        expect((ALLOWLIST_MEMBERS as readonly string[]).includes('procurement.cancelled')).toBe(true);
    });

    it('rejects bad notice_id (not UUID)', () => {
        const chain = new AuditChain();
        expect(() => appendProcurementCancelled(chain, { ...validPayload(), notice_id: 'not-a-uuid' }))
            .toThrow(TypeError);
    });

    it('rejects empty reason', () => {
        const chain = new AuditChain();
        expect(() => appendProcurementCancelled(chain, { ...validPayload(), reason: '' }))
            .toThrow(TypeError);
    });

    it('rejects negative tick', () => {
        const chain = new AuditChain();
        expect(() => appendProcurementCancelled(chain, { ...validPayload(), tick: -1 }))
            .toThrow(TypeError);
    });

    it('rejects non-integer tick', () => {
        const chain = new AuditChain();
        expect(() => appendProcurementCancelled(chain, { ...validPayload(), tick: 2.5 }))
            .toThrow(TypeError);
    });

    it('refuses an extra key (closed-tuple)', () => {
        const chain = new AuditChain();
        // @ts-expect-error — intentional extra key
        expect(() => appendProcurementCancelled(chain, { ...validPayload(), extra: 'leak' }))
            .toThrow(TypeError);
    });

    it('refuses a missing key (closed-tuple)', () => {
        const chain = new AuditChain();
        const { reason: _omit, ...noReason } = validPayload();
        // @ts-expect-error — intentionally missing key
        expect(() => appendProcurementCancelled(chain, noReason))
            .toThrow(TypeError);
    });
});
