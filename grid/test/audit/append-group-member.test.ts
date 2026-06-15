/**
 * Groups & Holdings · Phase 63 — sole-producers for group.member_joined / left.
 *
 * Verifies allowlist membership, valid events with the HASHED member DID as actor,
 * closed-tuple rejection, enum + regex validation, and that NO raw member DID
 * crosses the boundary (member_civic_did_hash is HEX64 only).
 */
import { describe, it, expect } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { ALLOWLIST } from '../../src/audit/broadcast-allowlist.js';
import { appendGroupMemberJoined } from '../../src/audit/append-group-member-joined.js';
import { appendGroupMemberLeft } from '../../src/audit/append-group-member-left.js';

const GROUP = 'genesis:group:aegis';
const HEX64 = 'a'.repeat(64);

describe('group.member_joined', () => {
    const valid = { group_id: GROUP, member_civic_did_hash: HEX64, role: 'member', tick: 12 };

    it('is allowlisted', () => {
        expect(ALLOWLIST.has('group.member_joined')).toBe(true);
    });

    it('lands a valid event with the member hash as actor', () => {
        const audit = new AuditChain();
        const entry = appendGroupMemberJoined(audit, { ...valid });
        expect(entry.eventType).toBe('group.member_joined');
        expect(entry.actorDid).toBe(HEX64);
    });

    it('accepts founder / member / affiliate roles', () => {
        for (const role of ['founder', 'member', 'affiliate']) {
            const audit = new AuditChain();
            expect(() => appendGroupMemberJoined(audit, { ...valid, role })).not.toThrow();
        }
    });

    it('rejects an unknown role', () => {
        const audit = new AuditChain();
        expect(() => appendGroupMemberJoined(audit, { ...valid, role: 'staff' } as never)).toThrow(/role/);
    });

    it('rejects a raw (non-hashed) member DID', () => {
        const audit = new AuditChain();
        expect(() => appendGroupMemberJoined(audit, { ...valid, member_civic_did_hash: 'did:noesis:alice' } as never)).toThrow(/member_civic_did_hash/);
    });

    it('rejects an extra key (closed tuple)', () => {
        const audit = new AuditChain();
        expect(() => appendGroupMemberJoined(audit, { ...valid, member_civic_did: 'did:noesis:alice' } as never)).toThrow(/closed-tuple/);
    });
});

describe('group.member_left', () => {
    const valid = { group_id: GROUP, member_civic_did_hash: HEX64, reason: 'voluntary', tick: 20 };

    it('is allowlisted', () => {
        expect(ALLOWLIST.has('group.member_left')).toBe(true);
    });

    it('lands a valid event with the member hash as actor', () => {
        const audit = new AuditChain();
        const entry = appendGroupMemberLeft(audit, { ...valid });
        expect(entry.eventType).toBe('group.member_left');
        expect(entry.actorDid).toBe(HEX64);
    });

    it('accepts voluntary / removed reasons', () => {
        for (const reason of ['voluntary', 'removed']) {
            const audit = new AuditChain();
            expect(() => appendGroupMemberLeft(audit, { ...valid, reason })).not.toThrow();
        }
    });

    it('rejects an unknown reason', () => {
        const audit = new AuditChain();
        expect(() => appendGroupMemberLeft(audit, { ...valid, reason: 'fired' } as never)).toThrow(/reason/);
    });

    it('rejects a malformed group_id', () => {
        const audit = new AuditChain();
        expect(() => appendGroupMemberLeft(audit, { ...valid, group_id: 'genesis:residential:0007' } as never)).toThrow(/group_id/);
    });
});
