/**
 * L1b D-MONEY-08 — appendDueDelinquent emitter unit tests.
 * Verifies closed 3-key payload, all guards, and allowlist membership.
 */
import { describe, expect, it } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendDueDelinquent } from '../../src/audit/append-due-delinquent.js';
import { ALLOWLIST_MEMBERS } from '../../src/audit/broadcast-allowlist.js';

const HASH = 'c'.repeat(64);
const DUE_ID = '12345678-1234-1234-1234-123456789012';

function validPayload() {
    return {
        civic_did_hash: HASH,
        due_id: DUE_ID,
        tick: 200,
    };
}

describe('appendDueDelinquent — emitter', () => {
    it('emits due.delinquent with a closed 3-key payload', () => {
        const chain = new AuditChain();
        const entry = appendDueDelinquent(chain, validPayload());
        expect(entry.eventType).toBe('due.delinquent');
        expect(entry.actorDid).toBe(HASH);
        expect(entry.payload).toEqual(validPayload());
    });

    it('due.delinquent is in the frozen allowlist', () => {
        expect((ALLOWLIST_MEMBERS as readonly string[]).includes('due.delinquent')).toBe(true);
    });

    it('rejects bad civic_did_hash (not HEX64)', () => {
        const chain = new AuditChain();
        expect(() => appendDueDelinquent(chain, { ...validPayload(), civic_did_hash: 'bad' }))
            .toThrow(TypeError);
    });

    it('rejects bad due_id (not UUID)', () => {
        const chain = new AuditChain();
        expect(() => appendDueDelinquent(chain, { ...validPayload(), due_id: 'not-uuid' }))
            .toThrow(TypeError);
    });

    it('rejects negative tick', () => {
        const chain = new AuditChain();
        expect(() => appendDueDelinquent(chain, { ...validPayload(), tick: -5 }))
            .toThrow(TypeError);
    });

    it('rejects non-integer tick', () => {
        const chain = new AuditChain();
        expect(() => appendDueDelinquent(chain, { ...validPayload(), tick: 1.1 }))
            .toThrow(TypeError);
    });

    it('refuses an extra key (closed-tuple)', () => {
        const chain = new AuditChain();
        // @ts-expect-error — intentional extra key
        expect(() => appendDueDelinquent(chain, { ...validPayload(), reason: 'forgot' }))
            .toThrow(TypeError);
    });

    it('refuses a missing key (closed-tuple)', () => {
        const chain = new AuditChain();
        const { due_id: _omit, ...noDueId } = validPayload();
        // @ts-expect-error — intentionally missing key
        expect(() => appendDueDelinquent(chain, noDueId))
            .toThrow(TypeError);
    });
});
