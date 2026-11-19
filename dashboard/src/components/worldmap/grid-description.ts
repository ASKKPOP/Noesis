/**
 * grid-description — the full description of a Grid shown when the map zooms to it.
 *
 * Every line comes from the Grid itself: its registry entry (GET /api/v1/portal/grids,
 * which also counts its human members: humans holding an active Civic-DID there),
 * its status and clock (GET /api/v1/grid/status, /api/v1/grid/clock) — the clock starts again each time the Grid is restarted, so "Running since" is the last start, not the founding, its identity
 * profile (GET /api/v1/grid/profile — needs a signed-in member) and its zone set. A line
 * whose source did not answer is left out, never filled in.
 */
import type { PortalGrid } from './grid-picker';
import { percent, type GridProfile } from '@/lib/grid-profile';
import { translator, type Translate } from './map-i18n';

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

/** `name` is the Grid as the map knows it (also the title of a frontier world).
 *  `t` words the labels and notes in the viewer's language (English by default). */
export function describeGrid(name: string, f: GridFacts, now: number, t: Translate = translator('en')): GridDescription {
    if (!f.grid && !f.registryLoaded) {
        return { title: name, purpose: null, rows: [], note: t('registryNote') };
    }
    if (!f.grid) {
        return {
            title: t('gridTitle', { name }), purpose: null, rows: [{ label: t('rowStatus'), value: t('emptyAwaiting') }],
            note: t('emptyNote'),
        };
    }
    const g = f.grid;
    if (g.locked) {
        return {
            title: g.name, purpose: null,
            rows: [{ label: t('rowAccess'), value: t('privateMembersOnly') }, { label: t('rowStatus'), value: g.status }],
            note: t('membersOnlyNote'),
        };
    }
    const rows: DescriptionRow[] = [];
    const add = (label: string, value: string | null | undefined): void => { if (value) rows.push({ label, value }); };

    if (f.profile && f.profile.activities.length > 0) {
        add(t('rowDoesNow'), f.profile.activities.slice(0, 3).map((a) => `${a.activity} ${percent(a.share)}`).join(' · '));
    } else if (f.profileNeedsSignIn) {
        add(t('rowDoesNow'), t('signInToSee'));
    }
    add(t('rowGovernment'), g.polis);
    add(t('rowWhere'), g.celestial_body);
    add(t('rowAccess'), g.visibility === 'private' ? t('privateMembersOnly') : t('public'));
    add(t('rowStatus'), g.status);
    if (isNum(g.human_members)) add(t('rowHumans'), count(g.human_members));
    if (f.status) {
        add(t('rowNous'), count(f.status.nousCount));
        add(t('rowLaws'), count(f.status.activeLaws));
        add(t('rowRegions'), count(f.status.regionCount));
    }
    if (f.zoneLabels.length > 0) add(t('rowZones'), `${f.zoneLabels.length}: ${f.zoneLabels.join(', ')}`);
    if (f.land) add(t('rowLand'), t('landValue', { p: count(f.land.purchasable), c: count(f.land.civic) }));
    if (f.clock) {
        const d = Math.floor(Math.max(0, now - f.clock.startedAt) / 86_400_000);
        const s = f.clock.tickRateMs / 1000;
        add(t('rowRunningSince'), `${new Date(f.clock.startedAt).toISOString().slice(0, 10)} (${d === 1 ? t('dayOne') : t('dayMany', { n: count(d) })})`);
        add(t('rowPace'), s === 1 ? t('paceOne') : t('paceMany', { n: count(s) }));
    }
    if (f.status) {
        add(t('rowGridTime'), t('gridTimeValue', { t: count(f.status.tick), e: count(f.status.epoch) }));
        add(t('rowActions'), count(f.status.auditEntries));
    }
    add(t('rowAddress'), g.grid_domain);
    return { title: g.name, purpose: g.description ?? null, rows, note: null };
}
