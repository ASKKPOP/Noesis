import { describe, expect, it } from 'vitest';
import { FLOOR_RADIUS, LOT_PITCH, districtCounts, districtSpan, layoutDistrict } from '../district-layout';
import type { ParcelFeedEntry } from '../OrbitalGenesisMap';

const lot = (id: string, over: Partial<ParcelFeedEntry> = {}): ParcelFeedEntry => ({
    id, zone: 'business', ring: 2, sector: 0, level: 0, status: 'available', price_bios: 900,
    owner_civic_did_hash: null, structure: null, occupant_count: 0, ...over,
});

describe('district layout', () => {
    it('places a zone\'s lots two to a column, in id order, centred on the district', () => {
        const lots = layoutDistrict([lot('b:0003'), lot('b:0001'), lot('x:0001', { zone: 'shopping' }), lot('b:0002'), lot('b:0004')], 'business');
        expect(lots.map((l) => l.id)).toEqual(['b:0001', 'b:0002', 'b:0003', 'b:0004']);
        expect(lots.map((l) => l.side)).toEqual([-1, 1, -1, 1]);
        const step = LOT_PITCH / FLOOR_RADIUS;
        expect(lots[0].angle).toBeCloseTo(-step / 2);
        expect(lots[1].angle).toBeCloseTo(-step / 2);
        expect(lots[2].angle).toBeCloseTo(step / 2);
        expect(lots[0].angle + lots[3].angle).toBeCloseTo(0); // centred
    });

    it('shows what the Grid says stands on each lot', () => {
        const lots = layoutDistrict([
            lot('b:1'),
            lot('b:2', { status: 'owned', owner_civic_did_hash: 'a'.repeat(64) }),
            lot('b:3', { status: 'owned', structure: { type: 'shop', visibility: 'public' }, occupant_count: 2, condition: 'worn' }),
            lot('b:4', { status: 'owned', structure: { type: 'observatory', visibility: 'public' }, condition: 'derelict' }),
        ], 'business');
        expect(lots.map((l) => l.kind)).toEqual(['empty', 'owned', 'shop', 'building']);
        expect(lots[2]).toMatchObject({ condition: 'worn', occupied: true });
        expect(lots[3]).toMatchObject({ condition: 'derelict', occupied: false });
        expect(lots[0].condition).toBe('maintained');
        expect(districtCounts(lots)).toEqual({ lots: 4, buildings: 2, occupied: 1 });
    });

    it('a district with no lots still has a width, and nothing in it', () => {
        expect(layoutDistrict([lot('b:1')], 'residential')).toEqual([]);
        expect(districtSpan([])).toBeCloseTo(LOT_PITCH / FLOOR_RADIUS);
        expect(districtCounts([])).toEqual({ lots: 0, buildings: 0, occupied: 0 });
    });

    it('the district grows along the ring with its lots', () => {
        const eight = layoutDistrict(Array.from({ length: 8 }, (_, i) => lot(`b:${i}`)), 'business');
        const twentyFour = layoutDistrict(Array.from({ length: 24 }, (_, i) => lot(`b:${String(i).padStart(2, '0')}`)), 'business');
        expect(districtSpan(eight)).toBeCloseTo((4 * LOT_PITCH) / FLOOR_RADIUS);
        expect(districtSpan(twentyFour)).toBeCloseTo((12 * LOT_PITCH) / FLOOR_RADIUS);
    });
});
