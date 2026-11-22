import { describe, it, expect } from 'vitest';
import { TEMPLATE_ZONES, zoneColor, zoneLegend, zoneSign, landCounts, parcelZoneKind, zoneLabel, parseZones, type GridZoneView } from '../zone-view';

const HARBOR: GridZoneView = { zone_id: 'harbor', label: 'Harbor', kind: 'business' };

describe('zone-view (D-V3-40)', () => {
    it('an unmodified template reads exactly as the six-zone map always did', () => {
        expect(zoneLegend(TEMPLATE_ZONES)).toEqual([
            ['#8e54b8', 'Government Core · gravity center'],
            ['#8a98ac', 'Infrastructure · commons shell'],
            ['#c2a878', 'Business · equatorial ring'],
            ['#3fa6bd', 'Shopping · equatorial ring'],
            ['#9a5a44', 'Manufacture · equatorial ring'],
            ['#5a84c4', 'Residential · inclined orbit'],
        ]);
        expect(TEMPLATE_ZONES.map(zoneSign)).toEqual(['GOVERNMENT CORE', 'COMMONS', 'BUSINESS', 'SHOPPING', 'MANUFACTURE', 'RESIDENTIAL']);
    });

    it('a zone the Polis added gets a legend line, a sign and its own stable colour', () => {
        const legend = zoneLegend([...TEMPLATE_ZONES, HARBOR]);
        expect(legend).toHaveLength(7);
        expect(legend[6][1]).toBe('Harbor · business zone');
        expect(zoneSign(HARBOR)).toBe('HARBOR');
        expect(zoneColor('harbor')).toBe(zoneColor('harbor'));
        expect(TEMPLATE_ZONES.map((z) => zoneColor(z.zone_id))).not.toContain(zoneColor('harbor'));
    });

    it('a relabeled template zone shows the Polis\'s label', () => {
        const z = { zone_id: 'infrastructure', label: 'Docks', kind: 'civic' } as const;
        expect(zoneSign(z)).toBe('DOCKS');
        expect(zoneLegend([z])[0][1]).toBe('Docks · commons shell');
    });

    it('a removed zone drops out of the legend', () => {
        expect(zoneLegend(TEMPLATE_ZONES.filter((z) => z.zone_id !== 'shopping')).map(([, l]) => l)).not.toContain('Shopping · equatorial ring');
    });

    it('counts land by zone kind, not by zone name', () => {
        const parcels = [
            { zone: 'harbor' }, { zone: 'residential' }, { zone: 'government_quarter' },
            { zone: 'green', zone_kind: 'civic' }, { zone: 'gone' },
        ];
        expect(landCounts(parcels, [...TEMPLATE_ZONES, HARBOR])).toEqual({ purchasable: 2, civic: 2 });
    });

    it('prefers the feed\'s kind and falls back to the zone set', () => {
        expect(parcelZoneKind({ zone: 'x', zone_kind: 'home' }, [])).toBe('home');
        expect(parcelZoneKind({ zone: 'harbor' }, [HARBOR])).toBe('business');
        expect(parcelZoneKind({ zone: 'x' }, [])).toBeNull();
        expect(zoneLabel({ zone: 'harbor' }, [HARBOR])).toBe('Harbor');
        expect(zoneLabel({ zone: 'old_town', zone_label: null }, [])).toBe('old town');
    });

    it('parses the zones feed and rejects a malformed one', () => {
        expect(parseZones({ zones: [{ zone_id: 'harbor', label: 'Harbor', kind: 'business', for_sale: true }] })).toEqual([HARBOR]);
        expect(parseZones({ zones: [{ zone_id: 'x', label: 'X', kind: 'park' }] })).toBeNull();
        expect(parseZones({})).toBeNull();
    });
});
