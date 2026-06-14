/**
 * Phase 60 HOUSE-3 · Wave 0 — SKIP-STUB for the zoning.role_granted sole producer
 * (D-60-09.1 / R-60-11). Allowlist position 96.
 *
 * describe.skip: grid/src/audit/append-zoning-role-granted.ts lands in Wave 4 (clones the
 * append-treasury-parcel-revenue triad). Deferred dynamic import (Phase 58/59 Wave-0 pattern)
 * defers module resolution until the suite is un-skipped.
 *
 * Closed 5-tuple {grantor_civic_did_hash, holder_civic_did_hash, parcel_id, role, tick}:
 *   - both hashes HEX64; role ∈ {staff, guest} (owner implicit, never granted);
 *   - parcel_id PARCEL_ID_RE; tick non-negative int; actorDid = grantor_civic_did_hash;
 *   - a 6th key throws (closed tuple); no FORBIDDEN_KEY_PATTERN key; no raw DID/name.
 */
import { describe, it, expect } from 'vitest';

const loadProducer = () => import('../../src/audit/append-zoning-role-granted.js');
const loadChain = () => import('../../src/audit/chain.js');

const PARCEL = 'genesis:business:0001';
const valid = {
    grantor_civic_did_hash: 'a'.repeat(64),
    holder_civic_did_hash: 'b'.repeat(64),
    parcel_id: PARCEL,
    role: 'staff' as const,
    tick: 7,
};

describe.skip('Phase 60 — appendZoningRoleGranted sole producer [Wave 4 un-skips]', () => {
    it('lands a valid event with grantor_civic_did_hash as actor', async () => {
        const { appendZoningRoleGranted } = await loadProducer();
        const { AuditChain } = await loadChain();
        const entry = appendZoningRoleGranted(new AuditChain(), valid);
        expect(entry.eventType).toBe('zoning.role_granted');
        expect(entry.actorDid).toBe(valid.grantor_civic_did_hash);
        expect(entry.payload).toEqual(valid);
    });

    it('keys are exactly the closed 5-tuple', async () => {
        const { appendZoningRoleGranted } = await loadProducer();
        const { AuditChain } = await loadChain();
        const entry = appendZoningRoleGranted(new AuditChain(), valid);
        expect(Object.keys(entry.payload as object).sort())
            .toEqual(['grantor_civic_did_hash', 'holder_civic_did_hash', 'parcel_id', 'role', 'tick']);
    });

    it('rejects a role outside {staff, guest} (owner is implicit, never granted)', async () => {
        const { appendZoningRoleGranted } = await loadProducer();
        const { AuditChain } = await loadChain();
        expect(() => appendZoningRoleGranted(new AuditChain(), { ...valid, role: 'owner' as never }))
            .toThrow(/role/);
    });

    it('rejects a non-HEX64 grantor/holder hash', async () => {
        const { appendZoningRoleGranted } = await loadProducer();
        const { AuditChain } = await loadChain();
        expect(() => appendZoningRoleGranted(new AuditChain(), { ...valid, holder_civic_did_hash: 'not-a-hash' }))
            .toThrow(/hash|HEX/i);
    });

    it('rejects a malformed parcel_id (PARCEL_ID_RE)', async () => {
        const { appendZoningRoleGranted } = await loadProducer();
        const { AuditChain } = await loadChain();
        expect(() => appendZoningRoleGranted(new AuditChain(), { ...valid, parcel_id: 'bad-id' }))
            .toThrow(/PARCEL_ID/);
    });

    it('rejects a negative tick', async () => {
        const { appendZoningRoleGranted } = await loadProducer();
        const { AuditChain } = await loadChain();
        expect(() => appendZoningRoleGranted(new AuditChain(), { ...valid, tick: -1 }))
            .toThrow(/tick/);
    });

    it('rejects a 6th key (closed-tuple)', async () => {
        const { appendZoningRoleGranted } = await loadProducer();
        const { AuditChain } = await loadChain();
        // @ts-expect-error — intentional extra key
        expect(() => appendZoningRoleGranted(new AuditChain(), { ...valid, holder_civic_did: 'did:civic:noesis:bob' }))
            .toThrow(/closed-tuple/);
    });

    it('carries no raw DID/name and no FORBIDDEN_KEY_PATTERN key (privacy walker)', async () => {
        const { appendZoningRoleGranted } = await loadProducer();
        const { AuditChain } = await loadChain();
        const entry = appendZoningRoleGranted(new AuditChain(), valid);
        const serialized = JSON.stringify(entry.payload);
        expect(serialized).not.toContain('did:civic:');
        expect(serialized).not.toMatch(/name|content|body|text/i);
    });
});
