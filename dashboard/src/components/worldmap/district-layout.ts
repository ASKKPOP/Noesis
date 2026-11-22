/**
 * district-layout — where each lot of a district stands inside its ring (D-V3-44).
 *
 * The district level of the Grid Station View shows one zone as a city along the
 * inside of its ring: a street following the ring's curve, lots on both sides,
 * buildings standing with their roofs toward the centre. This file is the layout
 * only (no drawing): lots in id order, two to a column, the columns centred on the
 * middle of the district. Everything shown comes from the Grid's lot feed.
 */
import type { ParcelFeedEntry } from './OrbitalGenesisMap';

/** Radius of the ring's floor, measured from the station's centre line. */
export const FLOOR_RADIUS = 170;
/** Distance between neighbouring lots along the street. */
export const LOT_PITCH = 17;
/** How far each row of lots stands from the middle of the street. */
export const ROW_OFFSET = 17;

export type LotKind = 'empty' | 'owned' | 'home' | 'shop' | 'workshop' | 'venue' | 'building';
export type LotCondition = 'maintained' | 'worn' | 'derelict';

export interface DistrictLot {
    id: string;
    /** Position along the street, as an angle around the ring; 0 is the district's middle. */
    angle: number;
    /** Which side of the street: -1 or 1. */
    side: -1 | 1;
    kind: LotKind;
    condition: LotCondition;
    /** Someone is inside right now. */
    occupied: boolean;
}

const BUILDINGS = new Set(['home', 'shop', 'workshop', 'venue']);

function kindOf(p: ParcelFeedEntry): LotKind {
    if (p.structure) return BUILDINGS.has(p.structure.type) ? (p.structure.type as LotKind) : 'building';
    return p.status === 'owned' ? 'owned' : 'empty';
}

/** The lots of one zone, placed along its street. */
export function layoutDistrict(parcels: readonly ParcelFeedEntry[], zoneId: string): DistrictLot[] {
    const lots = parcels.filter((p) => p.zone === zoneId).sort((a, b) => a.id.localeCompare(b.id));
    const columns = Math.ceil(lots.length / 2);
    return lots.map((p, i) => ({
        id: p.id,
        angle: ((Math.floor(i / 2) - (columns - 1) / 2) * LOT_PITCH) / FLOOR_RADIUS,
        side: i % 2 === 0 ? -1 : 1,
        kind: kindOf(p),
        condition: p.condition ?? 'maintained',
        occupied: p.occupant_count > 0,
    }));
}

/** How much of the ring the district covers, as an angle (at least one lot's width). */
export function districtSpan(lots: readonly DistrictLot[]): number {
    if (lots.length === 0) return LOT_PITCH / FLOOR_RADIUS;
    const angles = lots.map((l) => l.angle);
    return Math.max(...angles) - Math.min(...angles) + LOT_PITCH / FLOOR_RADIUS;
}

/** What the district holds, for the heading: lots in all, buildings, and lots someone is in. */
export function districtCounts(lots: readonly DistrictLot[]): { lots: number; buildings: number; occupied: number } {
    return {
        lots: lots.length,
        buildings: lots.filter((l) => l.kind !== 'empty' && l.kind !== 'owned').length,
        occupied: lots.filter((l) => l.occupied).length,
    };
}
