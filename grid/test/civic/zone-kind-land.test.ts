/**
 * D-V3-40 part 2 — land rules key on a zone's KIND (home / business / civic), never its
 * name, so a zone a Polis adds behaves like any other: its land sells, counts toward the
 * ownership caps, and takes the structures its kind allows.
 */
import { describe, it, expect } from 'vitest';
import { ParcelRegistry } from '../../src/civic/parcel-registry.js';
import { onLawEnacted } from '../../src/civic/ring-expansion.js';
import { layoutZones } from '../../src/api/routes/civic-map.js';
import { templateGridZones, type GridZone } from '../../src/zoning/zone-types.js';
import { getZoneTaxBps, recordPolisOverride, _resetPolisOverrides } from '../../src/civic/founding-law.js';

const ALICE = 'did:civic:noesis:alice';
const added = (zone_id: string, kind: GridZone['kind'], label = zone_id): GridZone => ({
    zone_id, label, kind, tax_modifier_bps: 0, allowed_activities: [], for_sale: kind !== 'civic', template: false, current_tax_modifier_bps: 0,
});

/** A Grid whose Polis added a business zone (Harbor), a home zone (Terraces) and a civic one (Commons Green). */
function grid() {
    const r = new ParcelRegistry('genesis');
    r.setZones([...templateGridZones(), added('harbor', 'business', 'Harbor'), added('terraces', 'home', 'Terraces'), added('green', 'civic', 'Commons Green')]);
    for (const zoneId of ['business', 'residential', 'harbor', 'terraces', 'green']) r.seedZone({ zoneId, count: 2, priceWei: 400, ring: 4 });
    return r;
}

describe('purchase keys on zone kind', () => {
    it('sells land in a zone the Polis added', () => {
        const r = grid();
        expect(r.purchase('genesis:harbor:0001', ALICE, 1000)).toMatchObject({ ok: true });
        expect(r.purchase('genesis:terraces:0001', ALICE, 1000)).toMatchObject({ ok: true });
    });

    it('never sells civic land, whatever the zone is called', () => {
        expect(grid().purchase('genesis:green:0001', ALICE, 1000)).toEqual({ ok: false, reason: 'zone_not_purchasable' });
    });

    it('never sells land in a zone the Grid no longer has', () => {
        const r = grid();
        r.setZones(templateGridZones());
        expect(r.purchase('genesis:harbor:0001', ALICE, 1000)).toEqual({ ok: false, reason: 'zone_not_purchasable' });
    });

    it('caps one business parcel across every business-kind zone', () => {
        const r = grid();
        r.purchase('genesis:business:0001', ALICE, 1000);
        expect(r.purchase('genesis:harbor:0001', ALICE, 1000)).toEqual({ ok: false, reason: 'cap_exceeded' });
    });

    it('caps one home across every home-kind zone, separately from business', () => {
        const r = grid();
        r.purchase('genesis:terraces:0001', ALICE, 1000);
        expect(r.purchase('genesis:residential:0001', ALICE, 1000)).toEqual({ ok: false, reason: 'cap_exceeded' });
        expect(r.purchase('genesis:harbor:0001', ALICE, 1000)).toMatchObject({ ok: true });
    });
});

describe('building keys on zone kind', () => {
    const build = (r: ParcelRegistry, id: string, type: 'home' | 'shop') => {
        r.purchase(id, ALICE, 1000);
        return r.build(id, ALICE, { name: 'x', type, visibility: 'open' }, 1);
    };
    it('a home fits an added home zone, a shop does not', () => {
        expect(build(grid(), 'genesis:terraces:0001', 'home')).toMatchObject({ ok: true });
        expect(build(grid(), 'genesis:terraces:0001', 'shop')).toEqual({ ok: false, reason: 'type_zone_mismatch' });
    });
    it('a shop fits an added business zone, a home does not', () => {
        expect(build(grid(), 'genesis:harbor:0001', 'shop')).toMatchObject({ ok: true });
        expect(build(grid(), 'genesis:harbor:0001', 'home')).toEqual({ ok: false, reason: 'type_zone_mismatch' });
    });
});

describe('opening and retiring land', () => {
    it('opening more land in a zone continues its numbering and never overwrites a parcel', () => {
        const r = grid();
        r.purchase('genesis:harbor:0001', ALICE, 1000);
        const opened = r.seedZone({ zoneId: 'harbor', count: 2, priceWei: 100, ring: 5 });
        expect(opened.map((p) => p.id)).toEqual(['genesis:harbor:0003', 'genesis:harbor:0004']);
        expect(r.get('genesis:harbor:0001')?.ownerDid).toBe(ALICE);
    });

    it('dropZone removes a removed zone\'s land from the registry', () => {
        const r = grid();
        r.dropZone('harbor');
        expect(r.list({ zoneId: 'harbor' })).toEqual([]);
        expect(r.list({ zoneId: 'business' })).toHaveLength(2);
    });

    it('a seed_ring bill carries its zone to the seeder; a malformed zone voids the bill', () => {
        const calls: [number, string | undefined][] = [];
        const deps = { seedZone: (ring: number, zone?: string) => { calls.push([ring, zone]); } };
        onLawEnacted({ action: 'seed_ring', ring: 4, zone_id: 'harbor' }, deps);
        onLawEnacted({ action: 'seed_ring', ring: 5 }, deps);
        onLawEnacted({ action: 'seed_ring', ring: 6, zone_id: 'Not A Zone' }, deps);
        onLawEnacted({ action: 'seed_ring', ring: 7, zone_id: 42 }, deps);
        expect(calls).toEqual([[4, 'harbor'], [5, undefined]]);
    });
});

describe('zone tax and the civic map follow the zone set', () => {
    it('an added zone is untaxed until the Polis legislates its rate', () => {
        _resetPolisOverrides();
        expect(getZoneTaxBps('harbor2')).toBe(0);
        recordPolisOverride('ZONE_TAX_BPS.harbor2', 700);
        expect(getZoneTaxBps('harbor2')).toBe(700);
        _resetPolisOverrides();
    });

    it('lays out however many zones the Grid has, with the Polis\'s labels', () => {
        const cells = layoutZones([...templateGridZones(), added('harbor', 'business', 'Harbor')]);
        expect(cells).toHaveLength(7);
        expect(cells[6]).toMatchObject({ id: 'harbor', label: 'Harbor', kind: 'business', polygon: '0,400 267,400 267,600 0,600' });
        expect(cells[0].polygon).toBe('0,0 267,0 267,200 0,200');
        expect(new Set(cells.map((c) => c.polygon)).size).toBe(7);
    });
});
