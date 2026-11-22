/**
 * scene-events — the Grid's public scene feed as the map uses it (D-V3-43).
 *
 * GET /api/v1/scene/events tells who did what, where, in privacy-safe form. The map
 * polls it, shows each event as one plain line, pulses the place it happened, and
 * re-reads the part of the Grid's state that the event changed. Nothing here is
 * invented: with no events, nothing moves and the list is empty.
 */
import type { Key, Translate } from './map-i18n';

export type SceneKind =
    | 'moved' | 'spoke' | 'traded' | 'proposed' | 'slept' | 'woke' | 'arrived' | 'used_tool'
    | 'bought_land' | 'built' | 'extended_interior' | 'condition_changed' | 'entered_place' | 'left_place'
    | 'orbital_built' | 'orbital_upgraded' | 'voted' | 'law_enacted' | 'zones_changed';

export interface SceneEvent {
    id: number;
    at: number;
    kind: SceneKind;
    actor?: { did: string; name: string };
    parcel_id?: string;
    zone_id?: string;
    region?: string;
    from_region?: string;
    detail?: string;
}

const LINE: Record<SceneKind, Key> = {
    moved: 'evMoved', spoke: 'evSpoke', traded: 'evTraded', proposed: 'evProposed', slept: 'evSlept', woke: 'evWoke',
    arrived: 'evArrived', used_tool: 'evUsedTool', bought_land: 'evBoughtLand', built: 'evBuilt',
    extended_interior: 'evExtended', condition_changed: 'evCondition', entered_place: 'evEntered', left_place: 'evLeft',
    orbital_built: 'evOrbitalBuilt', orbital_upgraded: 'evOrbitalUpgraded', voted: 'evVoted', law_enacted: 'evLaw',
    zones_changed: 'evZones',
};

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.length > 0 ? v : undefined);

/** Read the feed's answer; anything malformed is dropped, never guessed. */
export function parseSceneEvents(payload: unknown): { events: SceneEvent[]; cursor: number } | null {
    const p = payload as { events?: unknown; cursor?: unknown } | null;
    if (!p || !Array.isArray(p.events) || !isNum(p.cursor)) return null;
    const events: SceneEvent[] = [];
    for (const raw of p.events as Array<Record<string, unknown>>) {
        if (!raw || !isNum(raw['id']) || !isNum(raw['at']) || !(String(raw['kind']) in LINE)) continue;
        const actor = raw['actor'] as { did?: unknown; name?: unknown } | undefined;
        const name = str(actor?.name), did = str(actor?.did);
        events.push({
            id: raw['id'], at: raw['at'], kind: raw['kind'] as SceneKind,
            ...(name && did ? { actor: { did, name } } : {}),
            parcel_id: str(raw['parcel_id']), zone_id: str(raw['zone_id']), region: str(raw['region']),
            from_region: str(raw['from_region']), detail: str(raw['detail']),
        });
    }
    return { events, cursor: p.cursor };
}

export type Refresh = 'parcels' | 'objects' | 'zones';

const CHANGES: Partial<Record<SceneKind, Refresh>> = {
    bought_land: 'parcels', built: 'parcels', extended_interior: 'parcels', condition_changed: 'parcels',
    entered_place: 'parcels', left_place: 'parcels',
    orbital_built: 'objects', orbital_upgraded: 'objects', zones_changed: 'zones',
};

/** Which parts of the Grid's state these events changed, so the map re-reads only those. */
export function refreshNeeded(events: readonly SceneEvent[]): Set<Refresh> {
    const out = new Set<Refresh>();
    for (const e of events) { const part = CHANGES[e.kind]; if (part) out.add(part); }
    if (out.has('zones')) out.add('parcels'); // a zone change can open or retire land
    return out;
}

/** One event as one plain line in the viewer's language. `zoneOf` names the zone an
 *  event happened in (its Polis's label), or returns nothing when it is not known. */
export function sceneLine(e: SceneEvent, t: Translate, zoneOf: (e: SceneEvent) => string | undefined): string {
    const vars = { name: e.actor?.name ?? '', zone: zoneOf(e) ?? t('evSomewhere'), region: e.region ?? '', from: e.from_region ?? '', detail: e.detail ?? '' };
    if (e.kind === 'moved' && !e.from_region) return t('evMovedTo', vars);
    if (e.kind === 'built' && !e.detail) return t('evBuiltPlain', vars);
    return t(LINE[e.kind], vars);
}
