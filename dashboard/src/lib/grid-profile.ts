/**
 * grid-profile — reading a Grid's identity profile (D-V3-40).
 *
 * A Grid's identity is never assigned; GET /api/v1/grid/profile projects it from the audit
 * chain: the share of each kind of activity among the latest recorded actions, and the
 * same for the window before. This module only narrows and words that payload.
 */

export interface ActivityShare { activity: string; count: number; share: number }

export interface GridProfile {
    window_size: number;
    actions: number;
    activities: ActivityShare[];
    previous: ActivityShare[] | null;
}

export const ACTIVITY_COLOR: Readonly<Record<string, string>> = {
    trade: '#DD7B5A', knowledge: '#7FB2D1', making: '#B59AD0', civic: '#7BD89E', social: '#F0BA63', settling: '#9aa6c0',
};

const isShares = (v: unknown): v is ActivityShare[] =>
    Array.isArray(v) && v.every((a) => !!a && typeof a.activity === 'string' && typeof a.count === 'number' && typeof a.share === 'number');

/** Narrow the route payload; null when it is not a profile. */
export function parseGridProfile(payload: unknown): GridProfile | null {
    const p = payload as Partial<GridProfile> | null;
    if (!p || typeof p.window_size !== 'number' || typeof p.actions !== 'number' || !isShares(p.activities)) return null;
    return { window_size: p.window_size, actions: p.actions, activities: p.activities, previous: isShares(p.previous) ? p.previous : null };
}

export const percent = (share: number): string => `${Math.round(share * 100)}%`;

/** "Before: knowledge 41% · trade 19%" — the two largest activities of the previous window. */
export function driftLine(profile: GridProfile): string | null {
    if (!profile.previous || profile.previous.length === 0) return null;
    return 'Before: ' + profile.previous.slice(0, 2).map((a) => `${a.activity} ${percent(a.share)}`).join(' · ');
}
