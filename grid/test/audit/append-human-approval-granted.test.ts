/**
 * O2b — appendHumanApprovalGranted emitter unit tests.
 * Verifies closed 3-key payload, all guards, and allowlist membership.
 */
import { describe, expect, it } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendHumanApprovalGranted } from '../../src/audit/append-human-approval-granted.js';
import { ALLOWLIST_MEMBERS } from '../../src/audit/broadcast-allowlist.js';

const HUMAN_HASH = 'c'.repeat(64);
const APPROVAL_ID = '22245678-1234-1234-1234-123456789abc';

function validPayload() {
    return {
        approval_id: APPROVAL_ID,
        human_did_hash: HUMAN_HASH,
        tick: 10,
    };
}

describe('appendHumanApprovalGranted — emitter', () => {
    it('emits human.approval_granted with a closed 3-key payload', () => {
        const chain = new AuditChain();
        const entry = appendHumanApprovalGranted(chain, validPayload());
        expect(entry.eventType).toBe('human.approval_granted');
        expect(entry.actorDid).toBe(HUMAN_HASH);
        expect(entry.payload).toEqual(validPayload());
    });

    it('human.approval_granted is in the frozen allowlist', () => {
        expect((ALLOWLIST_MEMBERS as readonly string[]).includes('human.approval_granted')).toBe(true);
    });

    it('human.approval_granted is at position 119 (index 118)', () => {
        expect(ALLOWLIST_MEMBERS[118]).toBe('human.approval_granted');
    });

    it('rejects bad approval_id (not UUID)', () => {
        const chain = new AuditChain();
        expect(() => appendHumanApprovalGranted(chain, { ...validPayload(), approval_id: 'not-a-uuid' }))
            .toThrow(TypeError);
    });

    it('rejects bad human_did_hash (not HEX64)', () => {
        const chain = new AuditChain();
        expect(() => appendHumanApprovalGranted(chain, { ...validPayload(), human_did_hash: 'nothex' }))
            .toThrow(TypeError);
    });

    it('rejects negative tick', () => {
        const chain = new AuditChain();
        expect(() => appendHumanApprovalGranted(chain, { ...validPayload(), tick: -1 }))
            .toThrow(TypeError);
    });

    it('refuses an extra key (closed-tuple)', () => {
        const chain = new AuditChain();
        // @ts-expect-error — intentional extra key
        expect(() => appendHumanApprovalGranted(chain, { ...validPayload(), extra: 'leak' }))
            .toThrow(TypeError);
    });

    it('refuses a missing key (closed-tuple)', () => {
        const chain = new AuditChain();
        const { human_did_hash: _omit, ...noHash } = validPayload();
        // @ts-expect-error — intentionally missing key
        expect(() => appendHumanApprovalGranted(chain, noHash))
            .toThrow(TypeError);
    });
});
