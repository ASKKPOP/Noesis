/**
 * Phase 48b — ParcelRegistry unit tests.
 *
 * Covers seeding, purchase (happy path + all 5 failure reasons), the per-Nous
 * ≤1-home/≤1-business cap, build (type-fits-zone, one-per-parcel), join/leave,
 * and entry-policy (open / allowlist / private rejection).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ParcelRegistry } from '../../src/civic/parcel-registry.js';

const ALICE = 'did:noesis:nous:alice';
const BOB = 'did:noesis:nous:bob';

function seeded(): ParcelRegistry {
    const r = new ParcelRegistry('genesis');
    r.seedZone({ zoneId: 'residential', count: 3, priceBios: 100 });
    r.seedZone({ zoneId: 'business', count: 2, priceBios: 250 });
    r.seedZone({ zoneId: 'government_quarter', count: 1, priceBios: 1 });
    return r;
}

describe('ParcelRegistry — seeding', () => {
    it('seeds zero-padded slug ids per zone', () => {
        const r = seeded();
        expect(r.count).toBe(6);
        expect(r.get('genesis:residential:0001')).toBeDefined();
        expect(r.get('genesis:residential:0003')).toBeDefined();
        expect(r.get('genesis:business:0002')).toBeDefined();
        expect(r.get('genesis:residential:0004')).toBeUndefined();
    });

    it('parcels start unclaimed with an open entry policy', () => {
        const p = seeded().get('genesis:residential:0001')!;
        expect(p.ownerDid).toBeNull();
        expect(p.structure).toBeNull();
        expect(p.entryPolicy.policy).toBe('open');
        expect(p.priceBios).toBe(100);
    });

    it('rejects non-positive seed counts/prices', () => {
        const r = new ParcelRegistry();
        expect(() => r.seedZone({ zoneId: 'residential', count: 0, priceBios: 100 })).toThrow();
        expect(() => r.seedZone({ zoneId: 'residential', count: 2, priceBios: 0 })).toThrow();
    });
});

describe('ParcelRegistry — purchase', () => {
    let r: ParcelRegistry;
    beforeEach(() => { r = seeded(); });

    it('happy path: buyer with funds becomes owner', () => {
        const res = r.purchase('genesis:residential:0001', ALICE, 1000);
        expect(res.ok).toBe(true);
        if (res.ok) expect(res.parcel.ownerDid).toBe(ALICE);
        expect(r.get('genesis:residential:0001')!.ownerDid).toBe(ALICE);
    });

    it('parcel_not_found for an unknown address', () => {
        const res = r.purchase('genesis:residential:9999', ALICE, 1000);
        expect(res).toEqual({ ok: false, reason: 'parcel_not_found' });
    });

    it('already_owned when a parcel is taken', () => {
        r.purchase('genesis:residential:0001', ALICE, 1000);
        const res = r.purchase('genesis:residential:0001', BOB, 1000);
        expect(res).toEqual({ ok: false, reason: 'already_owned' });
    });

    it('zone_not_purchasable for civic land (government quarter)', () => {
        const res = r.purchase('genesis:government_quarter:0001', ALICE, 1000);
        expect(res).toEqual({ ok: false, reason: 'zone_not_purchasable' });
    });

    it('insufficient_funds when balance < price', () => {
        const res = r.purchase('genesis:business:0001', ALICE, 100); // price 250
        expect(res).toEqual({ ok: false, reason: 'insufficient_funds' });
    });

    it('cap_exceeded: at most one residential (home) parcel per Nous', () => {
        expect(r.purchase('genesis:residential:0001', ALICE, 1000).ok).toBe(true);
        const res = r.purchase('genesis:residential:0002', ALICE, 1000);
        expect(res).toEqual({ ok: false, reason: 'cap_exceeded' });
    });

    it('allows one home AND one business for the same Nous', () => {
        expect(r.purchase('genesis:residential:0001', ALICE, 1000).ok).toBe(true);
        expect(r.purchase('genesis:business:0001', ALICE, 1000).ok).toBe(true);
    });

    it('cap_exceeded: at most one business-class parcel per Nous', () => {
        expect(r.purchase('genesis:business:0001', ALICE, 1000).ok).toBe(true);
        const res = r.purchase('genesis:business:0002', ALICE, 1000);
        expect(res).toEqual({ ok: false, reason: 'cap_exceeded' });
    });

    it('stampAcquired records the tick once', () => {
        r.purchase('genesis:residential:0001', ALICE, 1000);
        r.stampAcquired('genesis:residential:0001', 42);
        expect(r.get('genesis:residential:0001')!.acquiredAtTick).toBe(42);
        r.stampAcquired('genesis:residential:0001', 99);
        expect(r.get('genesis:residential:0001')!.acquiredAtTick).toBe(42);
    });
});

describe('ParcelRegistry — build', () => {
    let r: ParcelRegistry;
    beforeEach(() => {
        r = seeded();
        r.purchase('genesis:residential:0001', ALICE, 1000);
        r.purchase('genesis:business:0001', ALICE, 1000);
    });

    it('owner builds a home on a residential parcel', () => {
        const res = r.build('genesis:residential:0001', ALICE, { name: 'Alice Home', type: 'home', visibility: 'private' }, 5);
        expect(res.ok).toBe(true);
        if (res.ok) {
            expect(res.parcel.structure?.type).toBe('home');
            expect(res.parcel.structure?.builtAtTick).toBe(5);
        }
    });

    it('not_owner when a non-owner builds', () => {
        const res = r.build('genesis:residential:0001', BOB, { name: 'x', type: 'home', visibility: 'open' }, 5);
        expect(res).toEqual({ ok: false, reason: 'not_owner' });
    });

    it('type_zone_mismatch: a home cannot be built in a business zone', () => {
        const res = r.build('genesis:business:0001', ALICE, { name: 'x', type: 'home', visibility: 'open' }, 5);
        expect(res).toEqual({ ok: false, reason: 'type_zone_mismatch' });
    });

    it('a shop can be built in a business zone', () => {
        const res = r.build('genesis:business:0001', ALICE, { name: 'Alice Shop', type: 'shop', visibility: 'open' }, 5);
        expect(res.ok).toBe(true);
    });

    it('already_built: only one structure per parcel', () => {
        r.build('genesis:residential:0001', ALICE, { name: 'Home', type: 'home', visibility: 'private' }, 5);
        const res = r.build('genesis:residential:0001', ALICE, { name: 'Home2', type: 'venue', visibility: 'open' }, 6);
        expect(res).toEqual({ ok: false, reason: 'already_built' });
    });
});

describe('ParcelRegistry — join / leave / entry policy', () => {
    let r: ParcelRegistry;
    beforeEach(() => {
        r = seeded();
        r.purchase('genesis:business:0001', ALICE, 1000);
    });

    it('anyone may join an OPEN structure', () => {
        r.build('genesis:business:0001', ALICE, { name: 'Cafe', type: 'venue', visibility: 'open' }, 1);
        const res = r.join('genesis:business:0001', BOB);
        expect(res.ok).toBe(true);
        expect(r.occupants('genesis:business:0001')).toContain(BOB);
    });

    it('no_structure when joining a bare parcel', () => {
        const res = r.join('genesis:business:0001', BOB);
        expect(res).toEqual({ ok: false, reason: 'no_structure' });
    });

    it('a PRIVATE structure rejects non-allowlisted visitors', () => {
        r.build('genesis:business:0001', ALICE, { name: 'Den', type: 'workshop', visibility: 'private' }, 1);
        const res = r.join('genesis:business:0001', BOB);
        expect(res).toEqual({ ok: false, reason: 'not_permitted' });
    });

    it('allowlist admits a named visitor to a private structure', () => {
        r.build('genesis:business:0001', ALICE, { name: 'Den', type: 'workshop', visibility: 'private' }, 1);
        r.setEntryPolicy('genesis:business:0001', ALICE, { policy: 'allowlist', allowlist: [BOB] });
        expect(r.join('genesis:business:0001', BOB).ok).toBe(true);
    });

    it('the owner may always join their own structure', () => {
        r.build('genesis:business:0001', ALICE, { name: 'Den', type: 'workshop', visibility: 'private' }, 1);
        expect(r.join('genesis:business:0001', ALICE).ok).toBe(true);
    });

    it('leave removes presence; not_present otherwise', () => {
        r.build('genesis:business:0001', ALICE, { name: 'Cafe', type: 'venue', visibility: 'open' }, 1);
        r.join('genesis:business:0001', BOB);
        expect(r.leave('genesis:business:0001', BOB).ok).toBe(true);
        expect(r.occupants('genesis:business:0001')).not.toContain(BOB);
        expect(r.leave('genesis:business:0001', BOB)).toEqual({ ok: false, reason: 'not_present' });
    });

    it('setEntryPolicy requires a built structure', () => {
        const res = r.setEntryPolicy('genesis:business:0001', ALICE, { policy: 'allowlist', allowlist: [] });
        expect(res).toEqual({ ok: false, reason: 'no_structure' });
    });
});
