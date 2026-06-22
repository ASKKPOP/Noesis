/**
 * O2b — appendHumanApprovalRequested emitter unit tests.
 * Verifies closed 5-key payload, all guards, and allowlist membership.
 */
import { describe, expect, it } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendHumanApprovalRequested } from '../../src/audit/append-human-approval-requested.js';
import { ALLOWLIST_MEMBERS } from '../../src/audit/broadcast-allowlist.js';

const NOUS_HASH = 'a'.repeat(64);
const HUMAN_HASH = 'b'.repeat(64);
const APPROVAL_ID = '11145678-1234-1234-1234-123456789abc';

function validPayload() {
    return {
        approval_id: APPROVAL_ID,
        human_did_hash: HUMAN_HASH,
        kind: 'trade',
        nous_did_hash: NOUS_HASH,
        tick: 5,
    };
}

describe('appendHumanApprovalRequested — emitter', () => {
    it('emits human.approval_requested with a closed 5-key payload', () => {
        const chain = new AuditChain();
        const entry = appendHumanApprovalRequested(chain, validPayload());
        expect(entry.eventType).toBe('human.approval_requested');
        expect(entry.actorDid).toBe(NOUS_HASH);
        expect(entry.payload).toEqual(validPayload());
    });

    it('human.approval_requested is in the frozen allowlist', () => {
        expect((ALLOWLIST_MEMBERS as readonly string[]).includes('human.approval_requested')).toBe(true);
    });

    it('human.approval_requested is at position 118 (index 117)', () => {
        expect(ALLOWLIST_MEMBERS[117]).toBe('human.approval_requested');
    });

    it('rejects bad approval_id (not UUID)', () => {
        const chain = new AuditChain();
        expect(() => appendHumanApprovalRequested(chain, { ...validPayload(), approval_id: 'not-a-uuid' }))
            .toThrow(TypeError);
    });

    it('rejects bad human_did_hash (not HEX64)', () => {
        const chain = new AuditChain();
        expect(() => appendHumanApprovalRequested(chain, { ...validPayload(), human_did_hash: 'nothex' }))
            .toThrow(TypeError);
    });

    it('rejects empty kind', () => {
        const chain = new AuditChain();
        expect(() => appendHumanApprovalRequested(chain, { ...validPayload(), kind: '' }))
            .toThrow(TypeError);
    });

    it('rejects bad nous_did_hash (not HEX64)', () => {
        const chain = new AuditChain();
        expect(() => appendHumanApprovalRequested(chain, { ...validPayload(), nous_did_hash: 'nothex' }))
            .toThrow(TypeError);
    });

    it('rejects negative tick', () => {
        const chain = new AuditChain();
        expect(() => appendHumanApprovalRequested(chain, { ...validPayload(), tick: -1 }))
            .toThrow(TypeError);
    });

    it('refuses an extra key (closed-tuple)', () => {
        const chain = new AuditChain();
        // @ts-expect-error — intentional extra key
        expect(() => appendHumanApprovalRequested(chain, { ...validPayload(), extra: 'leak' }))
            .toThrow(TypeError);
    });

    it('refuses a missing key (closed-tuple)', () => {
        const chain = new AuditChain();
        const { kind: _omit, ...noKind } = validPayload();
        // @ts-expect-error — intentionally missing key
        expect(() => appendHumanApprovalRequested(chain, noKind))
            .toThrow(TypeError);
    });
});
