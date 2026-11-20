/**
 * nous-places — where each Nous is on the station (D-V3-43, D-V3-44).
 *
 * The Grid records a Nous's position as one of its named regions. The Grid Station
 * View stands that Nous in a district. The operator approved this placing on
 * 2026-11-20:
 *
 *   Council Chamber  → the government core
 *   Agora Central    → the Infrastructure ring (the guest hall)
 *   Great Library    → the Infrastructure ring (the archive)
 *   Market District  → the streets of the Business and Shopping districts
 *   Maker's Workshop → the street of the Manufacture district
 *
 * Zones belong to each Grid's Polis (D-V3-40), so a placing names the zone it prefers
 * and the KIND of zone it falls back to when the Grid no longer has that zone. A
 * region this table does not know is placed nowhere: the Nous is listed, not drawn.
 */
import type { GridZoneView, ZoneKind } from './zone-view';
import type { SceneEvent } from './scene-events';

export interface NousView {
    did: string;
    name: string;
    /** The Grid's region id for where this Nous is. */
    region: string;
    /** Known only from events seen since the page opened. */
    asleep: boolean;
}

const PLACING: Readonly<Record<string, { zones: readonly string[]; kind: ZoneKind }>> = {
    council: { zones: ['government_quarter'], kind: 'civic' },
    agora: { zones: ['infrastructure'], kind: 'civic' },
    library: { zones: ['infrastructure'], kind: 'civic' },
    market: { zones: ['business', 'shopping'], kind: 'business' },
    workshop: { zones: ['manufacture'], kind: 'business' },
};

/** A small stable number from a DID: the same Nous always gets the same colour and spot. */
export function hashOf(did: string): number {
    let h = 2166136261;
    for (let i = 0; i < did.length; i++) { h ^= did.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
}

/** The colour a Nous is drawn in, as 0xRRGGBB: bright, and its own. */
export function nousColor(did: string): number {
    const hue = (hashOf(did) % 360) / 360;
    const f = (n: number): number => { const k = (n + hue * 12) % 12; return Math.round(255 * (0.68 - 0.3 * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
    return (f(0) << 16) | (f(8) << 8) | f(4);
}

/** The zone a Nous in `region` stands in, or null when the region has no place on this station. */
export function placeOf(n: Pick<NousView, 'did' | 'region'>, zones: readonly GridZoneView[]): string | null {
    const placing = PLACING[n.region];
    if (!placing) return null;
    const preferred = placing.zones.filter((id) => zones.some((z) => z.zone_id === id));
    if (preferred.length > 0) return preferred[hashOf(n.did) % preferred.length];
    return zones.find((z) => z.kind === placing.kind)?.zone_id ?? null;
}

/** Read the Grid's public list of Nous. Balances are not in it and are not looked for. */
export function parseRoster(payload: unknown): NousView[] | null {
    const p = payload as { nous?: unknown } | null;
    if (!p || !Array.isArray(p.nous)) return null;
    const out: NousView[] = [];
    for (const raw of p.nous as Array<Record<string, unknown>>) {
        if (typeof raw?.['did'] === 'string' && typeof raw['name'] === 'string' && typeof raw['region'] === 'string') {
            out.push({ did: raw['did'], name: raw['name'], region: raw['region'], asleep: false });
        }
    }
    return out;
}

/** Bring the list up to date with what the scene feed reported. Returns whether a Nous
 *  appeared that the list does not have (the caller then re-reads the list). */
export function applySceneEvents(nous: readonly NousView[], events: readonly SceneEvent[]): { nous: NousView[]; unknown: boolean } {
    const next = nous.map((n) => ({ ...n }));
    let unknown = false;
    for (const e of events) {
        if (!e.actor) continue;
        const who = next.find((n) => n.did === e.actor!.did);
        if (!who) { unknown = true; continue; }
        if (e.kind === 'moved' && e.region) who.region = e.region;
        else if (e.kind === 'slept') who.asleep = true;
        else if (e.kind === 'woke') who.asleep = false;
    }
    return { nous: next, unknown };
}
