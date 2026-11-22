/**
 * Grid identity profile (D-V3-40) — what a Grid IS, read from what its Nous DO.
 *
 * A Grid's identity and purpose are never assigned: no Grid is created as "the shop" or
 * "the library". This is a read-only projection over the audit chain — the share of each
 * kind of activity among the most recent recorded actions, and the same over the window
 * before it, so drift is visible. Nothing here is stored, and nothing can set it.
 *
 * Pure: counts only — no DID, payload or free text leaves this module. The window is a
 * number of recorded actions, not a span of wall-clock time.
 */
import type { AuditEntry } from '../audit/types.js';

export const ACTIVITIES = ['trade', 'knowledge', 'making', 'civic', 'social', 'settling'] as const;
export type Activity = typeof ACTIVITIES[number];

/** Events whose activity differs from (or is not implied by) their family prefix. */
const BY_EVENT: Readonly<Record<string, Activity>> = {
    'zoning.structure_built': 'making',
    'zoning.interior_extended': 'making',
    'zoning.cowork_session': 'making',
    'group.project_started': 'making',
    'group.project_completed': 'making',
    'zoning.zone_amended': 'civic',
    'zoning.zone_set_changed': 'civic',
    'nous.spoke': 'social',
    'nous.direct_message': 'social',
    'nous.whispered': 'social',
    'human.spoke': 'social',
    'group.founded': 'social',
    'group.member_joined': 'social',
    'group.member_left': 'social',
    'zoning.structure_joined': 'social',
    'zoning.structure_left': 'social',
    'zoning.parcel_purchased': 'settling',
    'zoning.residence_assigned': 'settling',
    'registry.civic_did_issued': 'settling',
    'registry.civic_did_issued_human': 'settling',
    'registry.business_did_registered': 'settling',
};

/** Event families that are one activity as a whole. */
const BY_FAMILY: Readonly<Record<string, Activity>> = {
    trade: 'trade', market: 'trade',
    library: 'knowledge', lore: 'knowledge', skill: 'knowledge',
    procurement: 'making', orbital: 'making',
    gov: 'civic', proposal: 'civic', ballot: 'civic', law: 'civic', norm: 'civic',
    police: 'civic', irs: 'civic', due: 'civic', polis: 'civic',
    community: 'social',
    mobility: 'settling',
};

/** The activity an audit event counts toward, or null for substrate bookkeeping
 *  (ticks, operator and Portal actions, treasury movements, inner-life events). */
export function activityOf(eventType: string): Activity | null {
    const exact = BY_EVENT[eventType];
    if (exact) return exact;
    const dot = eventType.indexOf('.');
    return (dot > 0 ? BY_FAMILY[eventType.slice(0, dot)] : undefined) ?? null;
}

export interface ActivityShare {
    readonly activity: Activity;
    readonly count: number;
    /** Share of the window, 0..1, rounded to 4 places. */
    readonly share: number;
}

export interface GridProfile {
    /** How many recorded actions each window holds at most. */
    readonly window_size: number;
    /** Actions counted in the current window (fewer than window_size on a young Grid). */
    readonly actions: number;
    /** Activities by share, largest first; activities with no actions are omitted. */
    readonly activities: readonly ActivityShare[];
    /** The window before the current one — null until the Grid has filled a whole window. */
    readonly previous: readonly ActivityShare[] | null;
}

export const DEFAULT_PROFILE_WINDOW = 2000;

function shares(counts: ReadonlyMap<Activity, number>, total: number): ActivityShare[] {
    return ACTIVITIES
        .filter((a) => (counts.get(a) ?? 0) > 0)
        .map((a) => ({ activity: a, count: counts.get(a)!, share: Math.round((counts.get(a)! / total) * 10000) / 10000 }))
        .sort((x, y) => y.count - x.count || ACTIVITIES.indexOf(x.activity) - ACTIVITIES.indexOf(y.activity));
}

/**
 * Project the profile from a chain. `chain` is read newest-first through `length` / `at`,
 * so only as many entries as the two windows need are visited.
 */
export function gridProfile(
    chain: { readonly length: number; at(index: number): Pick<AuditEntry, 'eventType'> | undefined },
    windowSize: number = DEFAULT_PROFILE_WINDOW,
): GridProfile {
    const current = new Map<Activity, number>(); const previous = new Map<Activity, number>();
    let nCurrent = 0; let nPrevious = 0;
    for (let i = chain.length - 1; i >= 0 && nPrevious < windowSize; i--) {
        const activity = activityOf(chain.at(i)?.eventType ?? '');
        if (!activity) continue;
        if (nCurrent < windowSize) { current.set(activity, (current.get(activity) ?? 0) + 1); nCurrent++; }
        else { previous.set(activity, (previous.get(activity) ?? 0) + 1); nPrevious++; }
    }
    return {
        window_size: windowSize,
        actions: nCurrent,
        activities: shares(current, nCurrent),
        previous: nPrevious === windowSize ? shares(previous, nPrevious) : null,
    };
}
