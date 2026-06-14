/**
 * Phase 60 HOUSE-3 · Wave 0 — SKIP-STUB for the zoning.role_revoked sole producer
 * (D-60-09.2 / R-60-11). Allowlist position 97.
 *
 * describe.skip: grid/src/audit/append-zoning-role-revoked.ts lands in Wave 4 (clones the
 * append-treasury-parcel-revenue triad). Deferred dynamic import (Phase 58/59 Wave-0 pattern)
 * defers module resolution until the suite is un-skipped.
 *
 * Closed 4-tuple {holder_civic_did_hash, parcel_id, reason, tick}:
 *   - holder_civic_did_hash HEX64; parcel_id PARCEL_ID_RE;
 *   - reason ∈ {owner_revoked, for_cause, severance_complete}; tick non-negative int;
 *   - actorDid = parcel_id; a 5th key throws (closed tuple); no FORBIDDEN_KEY_PATTERN key; no raw DID/name.
 */
import { describe, it, expect } from 'vitest';

const loadProducer = () => import('../../src/audit/append-zoning-role-revoked.js');
const loadChain = () => import('../../src/audit/chain.js');

const PARCEL = 'genesis:business:0001';
const valid = {
    holder_civic_did_hash: 'a'.repeat(64),
    parcel_id: PARCEL,
    reason: 'owner_revoked' as const,
    tick: 7,
};

describe.skip('Phase 60 — appendZoningRoleRevoked sole producer [Wave 4 un-skips]', () => {
    it('lands a valid event with the parcel_id as actor', async () => {
        const { appendZoningRoleRevoked } = await loadProducer();
        const { AuditChain } = await loadChain();
        const entry = appendZoningRoleRevoked(new AuditChain(), valid);
        expect(entry.eventType).toBe('zoning.role_revoked');
        expect(entry.actorDid).toBe(PARCEL);
        expect(entry.payload).toEqual(valid);
    });

    it('keys are exactly the closed 4-tuple {holder_civic_did_hash, parcel_id, reason, tick}', async () => {
        const { appendZoningRoleRevoked } = await loadProducer();
        const { AuditChain } = await loadChain();
        const entry = appendZoningRoleRevoked(new AuditChain(), valid);
        expect(Object.keys(entry.payload as object).sort())
            .toEqual(['holder_civic_did_hash', 'parcel_id', 'reason', 'tick']);
    });

    it('accepts each reason in {owner_revoked, for_cause, severance_complete}', async () => {
        const { appendZoningRoleRevoked } = await loadProducer();
        const { AuditChain } = await loadChain();
        for (const reason of ['owner_revoked', 'for_cause', 'severance_complete'] as const) {
            const entry = appendZoningRoleRevoked(new AuditChain(), { ...valid, reason });
            expect(entry.payload.reason).toBe(reason);
        }
    });

    it('rejects a reason outside the closed enum', async () => {
        const { appendZoningRoleRevoked } = await loadProducer();
        const { AuditChain } = await loadChain();
        expect(() => appendZoningRoleRevoked(new AuditChain(), { ...valid, reason: 'whim' as never }))
            .toThrow(/reason/);
    });

    it('rejects a non-HEX64 holder hash', async () => {
        const { appendZoningRoleRevoked } = await loadProducer();
        const { AuditChain } = await loadChain();
        expect(() => appendZoningRoleRevoked(new AuditChain(), { ...valid, holder_civic_did_hash: 'nope' }))
            .toThrow(/hash|HEX/i);
    });

    it('rejects a malformed parcel_id (PARCEL_ID_RE)', async () => {
        const { appendZoningRoleRevoked } = await loadProducer();
        const { AuditChain } = await loadChain();
        expect(() => appendZoningRoleRevoked(new AuditChain(), { ...valid, parcel_id: 'bad-id' }))
            .toThrow(/PARCEL_ID/);
    });

    it('rejects a negative tick', async () => {
        const { appendZoningRoleRevoked } = await loadProducer();
        const { AuditChain } = await loadChain();
        expect(() => appendZoningRoleRevoked(new AuditChain(), { ...valid, tick: -1 }))
            .toThrow(/tick/);
    });

    it('rejects a 5th key (closed-tuple)', async () => {
        const { appendZoningRoleRevoked } = await loadProducer();
        const { AuditChain } = await loadChain();
        // @ts-expect-error — intentional extra key
        expect(() => appendZoningRoleRevoked(new AuditChain(), { ...valid, dispute_route: 'police' }))
            .toThrow(/closed-tuple/);
    });

    it('carries no raw DID/name and no FORBIDDEN_KEY_PATTERN key (privacy walker)', async () => {
        const { appendZoningRoleRevoked } = await loadProducer();
        const { AuditChain } = await loadChain();
        const entry = appendZoningRoleRevoked(new AuditChain(), valid);
        const serialized = JSON.stringify(entry.payload);
        expect(serialized).not.toContain('did:civic:');
        expect(serialized).not.toMatch(/name|content|body|text/i);
    });
});
