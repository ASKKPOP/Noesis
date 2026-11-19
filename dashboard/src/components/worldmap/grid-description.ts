/**
 * grid-description — the full description of a Grid shown when the map zooms to it.
 *
 * Every line comes from the Grid itself: its registry entry (GET /api/v1/portal/grids),
 * its status and clock (GET /api/v1/grid/status, /api/v1/grid/clock), its identity
 * profile (GET /api/v1/grid/profile — needs a signed-in member) and its zone set. A line
 * whose source did not answer is left out, never filled in.
 */
import type { PortalGrid } from './grid-picker';
import { percent, type GridProfile } from '@/lib/grid-profile';

export interface GridStatusView { name: string; tick: number; epoch: number; nousCount: number; regionCount: number; activeLaws: number; auditEntries: number }
export interface GridClockView { tickRateMs: number; startedAt: number }

export interface GridFacts {
    /** Registry entry; null for a frontier world not chartered yet. */
    grid: PortalGrid | null;
    /** The Grid registry answered. Until it does, a missing entry means nothing. */
    registryLoaded: boolean;
    status: GridStatusView | null;
    clock: GridClockView | null;
    profile: GridProfile | null;
    /** The profile was refused because nobody is signed in. */
    profileNeedsSignIn: boolean;
    zoneLabels: readonly string[];
    land: { purchasable: number; civic: number } | null;
}

export interface DescriptionRow { label: string; value: string }
export interface GridDescription { title: string; purpose: string | null; rows: DescriptionRow[]; note: string | null }

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function parseGridStatus(payload: unknown): GridStatusView | null {
    const p = payload as Partial<GridStatusView> | null;
    if (!p || typeof p.name !== 'string' || ![p.tick, p.epoch, p.nousCount, p.regionCount, p.activeLaws, p.auditEntries].every(isNum)) return null;
    return p as GridStatusView;
}

export function parseGridClock(payload: unknown): GridClockView | null {
    const p = payload as Partial<GridClockView> | null;
    return p && isNum(p.tickRateMs) && isNum(p.startedAt) ? { tickRateMs: p.tickRateMs, startedAt: p.startedAt } : null;
}

const count = (n: number): string => n.toLocaleString('en-US');
const days = (ms: number): string => { const d = Math.floor(ms / 86_400_000); return d === 1 ? '1 day' : `${count(d)} days`; };
const seconds = (ms: number): string => { const s = ms / 1000; return s === 1 ? '1 second' : `${count(s)} seconds`; };

/** `name` is the Grid as the map knows it (also the title of a frontier world). */
export function describeGrid(name: string, f: GridFacts, now: number): GridDescription {
    if (!f.grid && !f.registryLoaded) {
        return { title: name, purpose: null, rows: [], note: 'The Grid registry has not answered, so there is nothing to show about this Grid yet.' };
    }
    if (!f.grid) {
        return {
            title: `${name} Grid`, purpose: null, rows: [{ label: 'Status', value: 'Empty, awaiting charter' }],
            note: 'A defined, empty Grid on its own world. It has no members and no activity until Nous and their humans charter it.',
        };
    }
    const g = f.grid;
    if (g.locked) {
        return {
            title: g.name, purpose: null,
            rows: [{ label: 'Access', value: 'Private, members only' }, { label: 'Status', value: g.status }],
            note: 'The rest of this Grid is shown to its members only.',
        };
    }
    const rows: DescriptionRow[] = [];
    const add = (label: string, value: string | null | undefined): void => { if (value) rows.push({ label, value }); };

    if (f.profile && f.profile.activities.length > 0) {
        add('What it does now', f.profile.activities.slice(0, 3).map((a) => `${a.activity} ${percent(a.share)}`).join(' · '));
    } else if (f.profileNeedsSignIn) {
        add('What it does now', 'Sign in to see');
    }
    add('Government', g.polis);
    add('Where', g.celestial_body);
    add('Access', g.visibility === 'private' ? 'Private, members only' : 'Public');
    add('Status', g.status);
    if (f.status) {
        add('Nous living here', count(f.status.nousCount));
        add('Laws in force', count(f.status.activeLaws));
        add('Regions', count(f.status.regionCount));
    }
    if (f.zoneLabels.length > 0) add('Zones', `${f.zoneLabels.length}: ${f.zoneLabels.join(', ')}`);
    if (f.land) add('Land', `${count(f.land.purchasable)} purchasable, ${count(f.land.civic)} civic`);
    if (f.clock) {
        add('Active since', `${new Date(f.clock.startedAt).toISOString().slice(0, 10)} (${days(Math.max(0, now - f.clock.startedAt))})`);
        add('Pace', `one tick every ${seconds(f.clock.tickRateMs)}`);
    }
    if (f.status) {
        add('Grid time', `tick ${count(f.status.tick)} · epoch ${count(f.status.epoch)}`);
        add('Recorded actions', count(f.status.auditEntries));
    }
    add('Address', g.grid_domain);
    return { title: g.name, purpose: g.description ?? null, rows, note: null };
}
