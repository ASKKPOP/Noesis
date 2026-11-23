/**
 * Records the orbital map's layout answers from the TypeScript — the three.js renderer's
 * source of truth — into viz-rs/fixtures/layout-parity.json, which `cargo test` in viz-rs/
 * replays against the Bevy port (option C). The fixture is checked in; this test fails when
 * the TypeScript and the fixture disagree. After a deliberate layout change, re-record with
 * `UPDATE_VIZ_PARITY=1 npx vitest run test/orbital-layout-parity.test.ts` and change
 * viz-rs/src/layout.rs in the same PR.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GENESIS_SEED, type ParcelFeedEntry } from '@/components/worldmap/OrbitalGenesisMap';
import { layoutParcels, renderStatus } from '@/components/worldmap/orbital-layout';
import { TEMPLATE_ZONES, zoneColor, zoneSign, type GridZoneView } from '@/components/worldmap/zone-view';
import { fitDistance } from '@/components/worldmap/grid-focus';

const FIXTURE = path.resolve(__dirname, '../../viz-rs/fixtures/layout-parity.json');

const p = (id: string, zone: string, ring: number, sector: number, extra: Partial<ParcelFeedEntry> = {}): ParcelFeedEntry => ({
    id, zone, ring, sector, level: 0, status: 'available', price_bios: 0, owner_civic_did_hash: null, structure: null, occupant_count: 0, ...extra,
});

/** Edge cases beyond the founding seed: outer rings a Polis opened, fractional and negative
 *  sectors, rounding halves, added zones, owners by hash only, an empty hash. */
const EXTRA: ParcelFeedEntry[] = [
    p('x:r4a', 'harbor', 4, 10, { zone_kind: 'business', zone_label: 'Harbor' }),
    p('x:r5a', 'research_lab', 5, 200, { zone_kind: 'business' }),
    p('x:r4b', 'harbor', 4, 100, { zone_kind: 'business', owner_civic_did_hash: 'ab'.repeat(32) }),
    p('x:r4c', 'harbor', 4, 190.5, { zone_kind: 'business', status: 'owned' }),
    p('x:r6', 'quiet_homes', 6, -45, { zone_kind: 'home' }),
    p('x:r3half', 'residential', 3, 7.5),
    p('x:r3neg', 'residential', 3, -7.5),
    p('x:r2half', 'business', 2, 12.5),
    p('x:r2neg', 'shopping', 2, -0.5),
    p('x:r1odd', 'infrastructure', 1, 45),
    p('x:r1frac', 'infrastructure', 1, 135.25),
    p('x:r35', 'harbor', 3.5, 30, { zone_kind: 'business' }),
    p('x:r0', 'government_quarter', 0, 0),
    p('x:rneg', 'harbor', -1, 0),
    p('x:emptyhash', 'business', 2, 30, { owner_civic_did_hash: '' }),
    p('x:feedkind', 'mystery', 2, 60, { zone_kind: 'civic' }),
];

const CUSTOM_ZONES: GridZoneView[] = [
    { zone_id: 'government_quarter', label: 'Senate Hill', kind: 'civic' },
    { zone_id: 'business', label: 'Business', kind: 'business' },
    { zone_id: 'residential', label: 'Residential', kind: 'home' },
    { zone_id: 'harbor', label: 'Harbor', kind: 'business' },
    { zone_id: 'quiet_homes', label: 'Quiet Homes', kind: 'home' },
    { zone_id: 'infrastructure', label: 'Ünïcode Commons', kind: 'civic' },
];

const COLOR_IDS = ['government_quarter', 'infrastructure', 'business', 'shopping', 'manufacture', 'residential',
    'harbor', 'research_lab', 'quiet_homes', 'a', '', 'Ünïcode zone', 'zone_with_a_very_long_name_0123456789', '한국어'];

const FIT = [[94, 50, 16 / 9], [92, 50, 0.46], [58, 50, 1], [58, 50, 2.4], [10, 75, 1.333]];

function record(): unknown {
    const parcels = [...GENESIS_SEED, ...EXTRA];
    return {
        parcels: parcels.map((q) => ({ id: q.id, zone: q.zone, zone_kind: q.zone_kind ?? null, zone_label: q.zone_label ?? null, ring: q.ring, sector: q.sector, status: q.status, owner_civic_did_hash: q.owner_civic_did_hash, occupant_count: q.occupant_count })),
        layout: layoutParcels(parcels).map(({ parcel, place }) => ({ id: parcel.id, ...place })),
        status_template: parcels.map((q) => renderStatus(q, TEMPLATE_ZONES)),
        status_custom: parcels.map((q) => renderStatus(q, CUSTOM_ZONES)),
        custom_zones: CUSTOM_ZONES,
        colors: COLOR_IDS.map((id) => ({ id, color: zoneColor(id) })),
        signs_template: TEMPLATE_ZONES.map(zoneSign),
        signs_custom: CUSTOM_ZONES.map(zoneSign),
        fit: FIT.map(([r, fov, aspect]) => ({ radius: r, fov, aspect, distance: fitDistance(r, fov, aspect) })),
    };
}

describe('orbital layout parity fixture (viz-rs)', () => {
    it('matches the recorded TypeScript answers', () => {
        const now = JSON.stringify(record(), null, 1) + '\n';
        if (process.env.UPDATE_VIZ_PARITY === '1') fs.writeFileSync(FIXTURE, now);
        expect(fs.readFileSync(FIXTURE, 'utf8')).toBe(now);
    });
});
