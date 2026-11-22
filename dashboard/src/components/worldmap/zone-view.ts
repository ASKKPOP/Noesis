/**
 * zone-view — how the orbital map reads a Grid's zones (D-V3-40).
 *
 * The zone set belongs to each Grid: the six-zone template, plus whatever its Polis adds,
 * relabels or removes (GET /api/v1/zoning/zones). The map therefore never assumes six
 * zones or their names — it keys on a zone's KIND (home / business / civic), shows the
 * Polis's label, and gives a zone the Polis added its own stable colour.
 */

export type ZoneKind = 'home' | 'business' | 'civic';

export interface GridZoneView {
    zone_id: string;
    label: string;
    kind: ZoneKind;
}

/** The six-zone template every Grid starts from — the offline fallback for the live feed. */
export const TEMPLATE_ZONES: readonly GridZoneView[] = [
    { zone_id: 'government_quarter', label: 'Government Quarter', kind: 'civic' },
    { zone_id: 'infrastructure', label: 'Infrastructure', kind: 'civic' },
    { zone_id: 'business', label: 'Business', kind: 'business' },
    { zone_id: 'shopping', label: 'Shopping', kind: 'business' },
    { zone_id: 'manufacture', label: 'Manufacture', kind: 'business' },
    { zone_id: 'residential', label: 'Residential', kind: 'home' },
];

const TEMPLATE_COLOR: Readonly<Record<string, number>> = {
    government_quarter: 0x8e54b8, infrastructure: 0x8a98ac, business: 0xc2a878,
    shopping: 0x3fa6bd, manufacture: 0x9a5a44, residential: 0x5a84c4,
};

/** Legend line + station sign of each template zone while it still carries its template label. */
const TEMPLATE_LEGEND: Readonly<Record<string, string>> = {
    government_quarter: 'Government Core · gravity center',
    infrastructure: 'Infrastructure · commons shell',
    business: 'Business · equatorial ring',
    shopping: 'Shopping · equatorial ring',
    manufacture: 'Manufacture · equatorial ring',
    residential: 'Residential · inclined orbit',
};
const TEMPLATE_SIGN: Readonly<Record<string, string>> = {
    government_quarter: 'GOVERNMENT CORE', infrastructure: 'COMMONS',
};
const TEMPLATE_PLACE: Readonly<Record<string, string>> = {
    government_quarter: 'gravity center', infrastructure: 'commons shell', business: 'equatorial ring',
    shopping: 'equatorial ring', manufacture: 'equatorial ring', residential: 'inclined orbit',
};
const KIND_WORD: Readonly<Record<ZoneKind, string>> = { home: 'home zone', business: 'business zone', civic: 'civic zone' };

function hslToHex(h: number, s: number, l: number): number {
    const a = s * Math.min(l, 1 - l);
    const ch = (n: number): number => {
        const k = (n + h / 30) % 12;
        return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    };
    return (ch(0) << 16) | (ch(8) << 8) | ch(4);
}

/** A zone's colour: the template palette, or a stable colour derived from an added zone's id. */
export function zoneColor(zoneId: string): number {
    const t = TEMPLATE_COLOR[zoneId];
    if (t !== undefined) return t;
    let h = 0;
    for (let i = 0; i < zoneId.length; i++) h = (h * 31 + zoneId.charCodeAt(i)) % 360;
    return hslToHex(h, 0.5, 0.6);
}

export const cssColor = (hex: number): string => '#' + hex.toString(16).padStart(6, '0');

const templateLabel = (zoneId: string): string | undefined => TEMPLATE_ZONES.find((z) => z.zone_id === zoneId)?.label;

/** The kind of the zone a parcel sits in — from the feed, else the Grid's zone set. */
export function parcelZoneKind(p: { zone: string; zone_kind?: string | null }, zones: readonly GridZoneView[]): ZoneKind | null {
    if (p.zone_kind === 'home' || p.zone_kind === 'business' || p.zone_kind === 'civic') return p.zone_kind;
    return zones.find((z) => z.zone_id === p.zone)?.kind ?? null;
}

/** The label a zone is shown under: the Polis's label, else the feed's, else its id. */
export function zoneLabel(p: { zone: string; zone_label?: string | null }, zones: readonly GridZoneView[]): string {
    return zones.find((z) => z.zone_id === p.zone)?.label ?? p.zone_label ?? p.zone.replace(/_/g, ' ');
}

/** The neon sign over a zone: its label, in the station's signage style. */
export function zoneSign(z: GridZoneView): string {
    if (z.label === templateLabel(z.zone_id) && TEMPLATE_SIGN[z.zone_id]) return TEMPLATE_SIGN[z.zone_id];
    return z.label.toUpperCase();
}

/** One legend line per zone of the Grid, in the Grid's order. */
export function zoneLegend(zones: readonly GridZoneView[]): [color: string, label: string][] {
    return zones.map((z) => {
        const color = cssColor(zoneColor(z.zone_id));
        if (z.label === templateLabel(z.zone_id)) return [color, TEMPLATE_LEGEND[z.zone_id]];
        return [color, `${z.label} · ${TEMPLATE_PLACE[z.zone_id] ?? KIND_WORD[z.kind]}`];
    });
}

/** Land counts by what the zone is for: lots Nous can buy, and civic land. */
export function landCounts(parcels: readonly { zone: string; zone_kind?: string | null }[], zones: readonly GridZoneView[]): { purchasable: number; civic: number } {
    let purchasable = 0; let civic = 0;
    for (const p of parcels) {
        const k = parcelZoneKind(p, zones);
        if (k === 'civic') civic++; else if (k) purchasable++;
    }
    return { purchasable, civic };
}

/** Narrow a GET /api/v1/zoning/zones payload to the zones the map can draw. */
export function parseZones(payload: unknown): GridZoneView[] | null {
    const zones = (payload as { zones?: unknown } | null)?.zones;
    if (!Array.isArray(zones)) return null;
    const out = zones.filter((z): z is GridZoneView =>
        !!z && typeof z.zone_id === 'string' && typeof z.label === 'string' && (z.kind === 'home' || z.kind === 'business' || z.kind === 'civic'))
        .map((z) => ({ zone_id: z.zone_id, label: z.label, kind: z.kind }));
    return out.length > 0 ? out : null;
}
