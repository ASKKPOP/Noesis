/**
 * orbital-layout — where each parcel module sits on the Genesis Core station, and how
 * it is drawn (zone KIND + ownership). Pure numbers, no renderer.
 *
 * Shared by both renderers of the orbital map: the three.js scene (the fallback) and the
 * Bevy/WASM scene in viz-rs/ (option C). The Rust port must give the same answers; the
 * fixture viz-rs/fixtures/layout-parity.json is recorded from THIS file (see
 * test/orbital-layout-parity.test.ts) and replayed by `cargo test` in viz-rs/.
 */
import type { ParcelFeedEntry } from './OrbitalGenesisMap';
import { parcelZoneKind, type GridZoneView } from './zone-view';

/** Radius of each Genesis Core ring. */
export const RING_R: Readonly<Record<number, number>> = { 1: 30, 2: 56, 3: 84 };
/** Tilt of the residential (ring 3) orbit. */
export const INCL = 0.42;

/** Radius of a ring a Polis opened beyond the Genesis Core (ring 4+). */
export const outerRadius = (ring: number): number => RING_R[3] + 24 * (ring - 3);

export type RenderStatus = 'civic' | 'commons' | 'owned' | 'unsold';

/** Map a live feed parcel to the canonical render status (zone KIND + ownership — never the zone's name). */
export function renderStatus(p: ParcelFeedEntry, zones: readonly GridZoneView[]): RenderStatus {
    if (parcelZoneKind(p, zones) === 'civic') return p.ring === 0 ? 'civic' : 'commons';
    return p.status === 'owned' || p.owner_civic_did_hash ? 'owned' : 'unsold';
}

/** Which part of the station a module hangs on: the station itself, the spinning
 *  residential orbit, or the shell of an outer ring a Polis opened. */
export type ParcelParent = 'station' | 'r3spin' | 'shell';

export interface ParcelPlace {
    parent: ParcelParent;
    /** For a shell: its ring. */
    ring: number;
    /** Position inside the parent. */
    pos: [number, number, number];
    /** Module size (capsule scale). */
    size: number;
}

/**
 * Where a parcel's module goes. `indexInRing` counts only for outer rings (ring > 3): the
 * parcel's position among that ring's parcels, in feed order (it alternates the lift).
 * Rings 0 and below, and rings that are not 1, 2, 3 or beyond 3, have no module.
 */
export function parcelPlace(p: { ring: number; sector: number }, indexInRing: number): ParcelPlace | null {
    const th = p.sector * Math.PI / 180;
    if (p.ring === 1) {
        return { parent: 'station', ring: 1, size: 4.2, pos: [Math.cos(th) * RING_R[1], ((p.sector / 90) % 2 ? 5 : -5), Math.sin(th) * RING_R[1]] };
    }
    if (p.ring === 2) {
        const lift = Math.round(p.sector) % 2 ? 6 : -6;
        return { parent: 'station', ring: 2, size: 3.6, pos: [Math.cos(th) * RING_R[2], lift, Math.sin(th) * RING_R[2]] };
    }
    if (p.ring === 3) {
        const lift = Math.round(p.sector * 24 / 360) % 2 ? 4 : -4;
        return { parent: 'r3spin', ring: 3, size: 3.0, pos: [Math.cos(th) * RING_R[3], lift, Math.sin(th) * RING_R[3]] };
    }
    if (p.ring > 3) {
        const rad = outerRadius(p.ring);
        return { parent: 'shell', ring: p.ring, size: 3.0, pos: [Math.cos(th) * rad, indexInRing % 2 ? 4 : -4, Math.sin(th) * rad] };
    }
    return null;
}

/** Every module of a feed, in feed order, with the outer-ring index counted per ring. */
export function layoutParcels<P extends { ring: number; sector: number }>(parcels: readonly P[]): { parcel: P; place: ParcelPlace }[] {
    const seen = new Map<number, number>();
    const out: { parcel: P; place: ParcelPlace }[] = [];
    for (const p of parcels) {
        let i = 0;
        if (p.ring > 3) { i = seen.get(p.ring) ?? 0; seen.set(p.ring, i + 1); }
        const place = parcelPlace(p, i);
        if (place) out.push({ parcel: p, place });
    }
    return out;
}
