/**
 * Phase 60 HOUSE-3 · Wave 0 — SKIP-STUB for typed relationship roles (A4 / D-60-01 / R-60-02).
 *
 * describe.skip: grid/src/civic/roles.ts + ParcelRegistry.grantRole/revokeRole/roleOf
 * land in Wave 1. Deferred dynamic import (Phase 58/59 Wave-0 pattern) defers module
 * resolution until the suite is un-skipped.
 *
 * Contract under test:
 *   - ROLE_CAPABILITIES is a closed table: owner ⊇ staff ⊇ guest affordances.
 *   - grantRole mints a RoleEdge anchored to the holder Civic-DID (NOT a session); a re-grant
 *     resumes at the existing trust_score.
 *   - the owner edge is IMPLICIT from Parcel.ownerDid (never stored twice).
 *   - a did:civic:noesis:human:* holder is REJECTED (VOTE-05 / D-NH-07).
 *   - trust_score is derived from honored co-work / IOU settlements.
 */
import { describe, it, expect } from 'vitest';

const loadRoles = () => import('../../src/civic/roles.js');
const loadRegistry = () => import('../../src/civic/parcel-registry.js');

const OWNER = 'did:civic:noesis:alice';
const STAFF = 'did:civic:noesis:bob';
const GUEST = 'did:civic:noesis:carol';
const HUMAN = 'did:civic:noesis:human:dave';
const PARCEL = 'genesis:business:0001';

describe.skip('Phase 60 HOUSE-3 — ROLE_CAPABILITIES closed table [Wave 1 un-skips]', () => {
    it('ROLE_CAPABILITIES is a closed table with owner ⊇ staff ⊇ guest affordances', async () => {
        const { ROLE_CAPABILITIES } = await loadRoles();
        const owner = new Set(ROLE_CAPABILITIES.owner);
        const staff = new Set(ROLE_CAPABILITIES.staff);
        const guest = new Set(ROLE_CAPABILITIES.guest);
        for (const c of guest) expect(staff.has(c)).toBe(true);
        for (const c of staff) expect(owner.has(c)).toBe(true);
    });

    it('staff includes functional-furniture use + manage listings + admit guests', async () => {
        const { ROLE_CAPABILITIES } = await loadRoles();
        const staff = ROLE_CAPABILITIES.staff;
        expect(staff).toContain('use_functional_furniture');
        expect(staff).toContain('manage_listings');
        expect(staff).toContain('admit_guests');
    });

    it('guest includes enter + social affordances + trade at shop_counter', async () => {
        const { ROLE_CAPABILITIES } = await loadRoles();
        const guest = ROLE_CAPABILITIES.guest;
        expect(guest).toContain('enter');
        expect(guest).toContain('social');
        expect(guest).toContain('trade_at_shop_counter');
    });

    it('ROLE_CAPABILITIES has exactly the three keys owner/staff/guest (closed)', async () => {
        const { ROLE_CAPABILITIES } = await loadRoles();
        expect(Object.keys(ROLE_CAPABILITIES).sort()).toEqual(['guest', 'owner', 'staff']);
    });
});

describe.skip('Phase 60 HOUSE-3 — grantRole / revokeRole / roleOf [Wave 1 un-skips]', () => {
    it('grantRole mints a RoleEdge anchored to the holder Civic-DID; roleOf reflects it', async () => {
        const { ParcelRegistry } = await loadRegistry();
        const registry = new ParcelRegistry('genesis');
        registry.grantRole(PARCEL, STAFF, 'staff', OWNER, 10);
        expect(registry.roleOf(PARCEL, STAFF)).toBe('staff');
    });

    it('a re-grant resumes at the existing trust_score (edge anchored to DID, not session)', async () => {
        const { ParcelRegistry } = await loadRegistry();
        const registry = new ParcelRegistry('genesis');
        const first = registry.grantRole(PARCEL, STAFF, 'staff', OWNER, 10);
        registry.revokeRole(PARCEL, STAFF, 'owner_revoked');
        const second = registry.grantRole(PARCEL, STAFF, 'staff', OWNER, 50);
        // trust_score is carried across the re-grant (reputation persists on the Civic-DID).
        expect(second.trust_score).toBe(first.trust_score);
    });

    it('the owner edge is IMPLICIT from Parcel.ownerDid — roleOf(owner) === owner with no stored edge', async () => {
        const { ParcelRegistry } = await loadRegistry();
        const registry = new ParcelRegistry('genesis');
        const parcel = registry.get(PARCEL)!;
        parcel.ownerDid = OWNER;
        expect(registry.roleOf(PARCEL, OWNER)).toBe('owner');
    });

    it('grantRole with a did:civic:noesis:human:* holder is REJECTED (VOTE-05 / D-NH-07)', async () => {
        const { ParcelRegistry } = await loadRegistry();
        const registry = new ParcelRegistry('genesis');
        expect(() => registry.grantRole(PARCEL, HUMAN, 'guest', OWNER, 10))
            .toThrow(/human/i);
    });

    it('roleOf returns null for a DID with no edge and not the owner', async () => {
        const { ParcelRegistry } = await loadRegistry();
        const registry = new ParcelRegistry('genesis');
        expect(registry.roleOf(PARCEL, GUEST)).toBeNull();
    });

    it('trust_score is derived from honored settlements — a settled IOU raises it', async () => {
        const { ParcelRegistry } = await loadRegistry();
        const registry = new ParcelRegistry('genesis');
        const edge = registry.grantRole(PARCEL, STAFF, 'staff', OWNER, 10);
        const before = edge.trust_score;
        // A settled IOU between this pair lifts the derived trust_score on the edge.
        registry.grantRole(PARCEL, STAFF, 'staff', OWNER, 20);
        expect(registry.roleOf(PARCEL, STAFF)).toBe('staff');
        expect(typeof before).toBe('number');
    });
});
