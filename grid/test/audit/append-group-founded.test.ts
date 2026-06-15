/**
 * Groups & Holdings · Phase 1 — sole-producer for group.founded.
 *
 * Verifies: valid event lands with group_id as actor, allowlist membership,
 * closed-tuple rejection, domain/kind enum + id regex validation, and that NO
 * plaintext display name crosses the boundary (closed 4-key tuple only).
 */
import { describe, it, expect } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { ALLOWLIST } from '../../src/audit/broadcast-allowlist.js';
import { appendGroupFounded } from '../../src/audit/append-group-founded.js';

const GROUP = 'genesis:group:aegis';
const valid = { domain: 'defense', group_id: GROUP, kind: 'business', tick: 7 };

describe('group.founded — allowlist + producer', () => {
    it('group.founded is allowlisted', () => {
        expect(ALLOWLIST.has('group.founded')).toBe(true);
    });

    it('lands a valid event with the group_id as actor', () => {
        const audit = new AuditChain();
        const entry = appendGroupFounded(audit, { ...valid });
        expect(entry.eventType).toBe('group.founded');
        expect(entry.actorDid).toBe(GROUP);
    });

    it('rejects an extra key (closed-tuple — no plaintext name leaks)', () => {
        const audit = new AuditChain();
        expect(() =>
            appendGroupFounded(audit, { ...valid, display_name: 'Aegis' } as never),
        ).toThrow(/closed-tuple/);
    });

    it('rejects a missing key (field validator fires before the closed-tuple check)', () => {
        const audit = new AuditChain();
        const { tick, ...missing } = valid;
        expect(() => appendGroupFounded(audit, missing as never)).toThrow(/tick/);
    });

    it('rejects an unknown domain', () => {
        const audit = new AuditChain();
        expect(() => appendGroupFounded(audit, { ...valid, domain: 'crypto' } as never)).toThrow(/domain/);
    });

    it('rejects a non-business/nonprofit kind', () => {
        const audit = new AuditChain();
        expect(() => appendGroupFounded(audit, { ...valid, kind: 'guild' } as never)).toThrow(/kind/);
    });

    it('rejects a malformed group_id', () => {
        const audit = new AuditChain();
        expect(() => appendGroupFounded(audit, { ...valid, group_id: 'genesis:residential:0007' } as never)).toThrow(/group_id/);
    });

    it('rejects a negative tick', () => {
        const audit = new AuditChain();
        expect(() => appendGroupFounded(audit, { ...valid, tick: -1 } as never)).toThrow(/tick/);
    });
});
