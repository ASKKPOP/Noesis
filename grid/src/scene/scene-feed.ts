/**
 * scene-feed — the public, privacy-safe view of what is happening in a Grid (D-V3-43).
 *
 * A pure projection over the Grid's record: each recorded action that is a PUBLIC act
 * becomes one scene event saying what happened, where, and — only where the record
 * itself already carries the actor's own identity — who did it.
 *
 * What never leaves through this feed:
 *   - any free text (speech text, names of places, statements);
 *   - any amount, price or balance;
 *   - private acts (whispers, direct messages, approvals, operator actions);
 *   - the owner behind a land event: land events are recorded against a hash of the
 *     owner's Civic-DID (D-58-08), and this feed does not undo that — they are placed
 *     on the map without a name;
 *   - who cast a ballot.
 *
 * Nothing is stored and nothing is added to the record: no new audit event, allowlist +0.
 */
import type { AuditEntry } from '../audit/types.js';

export type SceneKind =
    | 'moved' | 'spoke' | 'traded' | 'proposed' | 'slept' | 'woke' | 'arrived' | 'used_tool'
    | 'bought_land' | 'built' | 'extended_interior' | 'condition_changed' | 'entered_place' | 'left_place'
    | 'orbital_built' | 'orbital_upgraded' | 'voted' | 'law_enacted' | 'zones_changed';

export interface SceneEvent {
    /** Position in the Grid's record; pass the last one back as `since`. */
    id: number;
    /** When it was recorded (ms since epoch). */
    at: number;
    kind: SceneKind;
    /** Present only for acts recorded under the Nous's own identity. */
    actor?: { did: string; name: string };
    parcel_id?: string;
    zone_id?: string;
    region?: string;
    from_region?: string;
    /** A value from a closed set (a structure kind, a condition), never free text. */
    detail?: string;
}

/** Looks up a Nous's public name from its own DID; undefined when it is not a citizen. */
export type NameOf = (did: string) => string | undefined;

const SLUG = /^[a-z0-9][a-z0-9_:.-]{0,62}$/i;
const slug = (v: unknown): string | undefined => (typeof v === 'string' && SLUG.test(v) ? v : undefined);

type Rule = { kind: SceneKind; named?: true; fields?: (p: Record<string, unknown>) => Partial<SceneEvent> };

const land = (p: Record<string, unknown>): Partial<SceneEvent> => ({ parcel_id: slug(p['parcel_id']), zone_id: slug(p['zone_id']) });

/** The closed list of public acts. An event type not listed here is never projected. */
const RULES: Readonly<Record<string, Rule>> = {
    'nous.moved': { kind: 'moved', named: true, fields: (p) => ({ region: slug(p['toRegion']), from_region: slug(p['fromRegion']) }) },
    'nous.spoke': { kind: 'spoke', named: true },
    'trade.settled': { kind: 'traded', named: true },
    'proposal.opened': { kind: 'proposed', named: true },
    'nous.sleep.entered': { kind: 'slept', named: true },
    'nous.sleep.completed': { kind: 'woke', named: true },
    'nous.spawned': { kind: 'arrived', named: true },
    'tool.invoked': { kind: 'used_tool', named: true },
    'zoning.parcel_purchased': { kind: 'bought_land', fields: land },
    'zoning.structure_built': { kind: 'built', fields: (p) => ({ ...land(p), detail: slug(p['structure_type']) }) },
    'zoning.interior_extended': { kind: 'extended_interior', fields: land },
    'zoning.condition_changed': { kind: 'condition_changed', fields: (p) => ({ ...land(p), detail: slug(p['condition']) }) },
    'zoning.structure_joined': { kind: 'entered_place', fields: land },
    'zoning.structure_left': { kind: 'left_place', fields: land },
    'orbital.object_built': { kind: 'orbital_built' },
    'orbital.object_upgraded': { kind: 'orbital_upgraded' },
    'ballot.committed': { kind: 'voted' },
    'gov.law_enacted': { kind: 'law_enacted' },
    'zoning.zone_set_changed': { kind: 'zones_changed' },
};

/** One recorded action as a scene event, or null when it is not a public act. */
export function projectSceneEvent(entry: AuditEntry, nameOf: NameOf): SceneEvent | null {
    const rule = RULES[entry.eventType];
    if (!rule || typeof entry.id !== 'number') return null;
    const event: SceneEvent = { id: entry.id, at: entry.createdAt, kind: rule.kind };
    if (rule.named) {
        // A named act with no known citizen behind it (a system account, a departed Nous)
        // is not shown at all: an act without its actor would mislead.
        const name = nameOf(entry.actorDid);
        if (!name) return null;
        event.actor = { did: entry.actorDid, name };
    }
    for (const [key, value] of Object.entries(rule.fields?.(entry.payload ?? {}) ?? {})) {
        if (value !== undefined) (event as unknown as Record<string, unknown>)[key] = value;
    }
    return event;
}

export interface SceneRecord {
    readonly length: number;
    at(index: number): AuditEntry | undefined;
}

export const SCENE_PAGE = 100;
/** How far back a request without a cursor looks for something to show. */
export const SCENE_LOOKBACK = 5000;
const RECENT = 30;

/**
 * Scene events recorded after `since`, oldest first, at most SCENE_PAGE. With no
 * `since`, the most recent few — so a page that has just opened has something to show.
 * `cursor` is where the next request should continue from.
 */
export function sceneEventsSince(record: SceneRecord, since: number | null, nameOf: NameOf): { events: SceneEvent[]; cursor: number } {
    const last = record.at(record.length - 1);
    const head = typeof last?.id === 'number' ? last.id : 0;
    const out: SceneEvent[] = [];
    if (since === null) {
        for (let i = record.length - 1; i >= Math.max(0, record.length - SCENE_LOOKBACK) && out.length < RECENT; i--) {
            const entry = record.at(i);
            const event = entry && projectSceneEvent(entry, nameOf);
            if (event) out.push(event);
        }
        return { events: out.reverse(), cursor: head };
    }
    // Entries are in id order; walk back to the first one after `since`.
    let start = record.length;
    while (start > 0 && (record.at(start - 1)?.id ?? 0) > since && record.length - start < SCENE_LOOKBACK) start--;
    let cursor = since;
    for (let i = start; i < record.length && out.length < SCENE_PAGE; i++) {
        const entry = record.at(i);
        if (!entry || typeof entry.id !== 'number') continue;
        cursor = entry.id;
        const event = projectSceneEvent(entry, nameOf);
        if (event) out.push(event);
    }
    return { events: out, cursor: Math.max(cursor, since) };
}
