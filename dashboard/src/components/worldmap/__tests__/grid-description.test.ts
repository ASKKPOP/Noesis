import { describe, expect, it } from 'vitest';
import { describeGrid, parseGridClock, parseGridStatus, type GridFacts } from '../grid-description';
import type { PortalGrid } from '../grid-picker';

const genesis: PortalGrid = {
    grid_id: 'genesis', name: 'Genesis', status: 'active', visibility: 'public', member: false, locked: false,
    polis: 'Genesis Polis', description: 'The first persistent Grid.', grid_domain: 'genesis.noesis', celestial_body: 'Earth-orbit',
};
const facts = (over: Partial<GridFacts> = {}): GridFacts => ({
    grid: genesis,
    registryLoaded: true,
    status: { name: 'genesis', tick: 106756, epoch: 1067, nousCount: 3, regionCount: 5, activeLaws: 2, auditEntries: 469146 },
    clock: { tickRateMs: 30000, startedAt: Date.UTC(2026, 9, 13) },
    profile: { window_size: 500, actions: 500, previous: null, activities: [{ activity: 'knowledge', count: 205, share: 0.41 }, { activity: 'trade', count: 95, share: 0.19 }] },
    profileNeedsSignIn: false,
    zoneLabels: ['Business', 'Residential'],
    land: { purchasable: 48, civic: 5 },
    ...over,
});
const now = Date.UTC(2026, 10, 19);
const row = (d: ReturnType<typeof describeGrid>, label: string): string | undefined => d.rows.find((r) => r.label === label)?.value;

describe('describeGrid', () => {
    it('describes a Grid from what the Grid itself reports', () => {
        const d = describeGrid('Genesis', facts(), now);
        expect(d.title).toBe('Genesis');
        expect(d.purpose).toBe('The first persistent Grid.');
        expect(row(d, 'What it does now')).toBe('knowledge 41% · trade 19%');
        expect(row(d, 'Government')).toBe('Genesis Polis');
        expect(row(d, 'Access')).toBe('Public');
        expect(row(d, 'Nous living here')).toBe('3');
        expect(row(d, 'Laws in force')).toBe('2');
        expect(row(d, 'Zones')).toBe('2: Business, Residential');
        expect(row(d, 'Land')).toBe('48 purchasable, 5 civic');
        expect(row(d, 'Active since')).toBe('2026-10-13 (37 days)');
        expect(row(d, 'Pace')).toBe('one tick every 30 seconds');
        expect(row(d, 'Grid time')).toBe('tick 106,756 · epoch 1,067');
        expect(row(d, 'Recorded actions')).toBe('469,146');
    });

    it('leaves out what did not answer instead of filling it in', () => {
        const d = describeGrid('Genesis', facts({ status: null, clock: null, profile: null, land: null, zoneLabels: [] }), now);
        expect(d.rows.map((r) => r.label)).toEqual(['Government', 'Where', 'Access', 'Status', 'Address']);
    });

    it('says the activity profile needs a sign-in when it was refused', () => {
        const d = describeGrid('Genesis', facts({ profile: null, profileNeedsSignIn: true }), now);
        expect(row(d, 'What it does now')).toBe('Sign in to see');
    });

    it('shows only name and lock for a private Grid the viewer is not in', () => {
        const d = describeGrid('Vault', facts({ grid: { grid_id: 'vault', name: 'Vault', status: 'active', visibility: 'private', member: false, locked: true } }), now);
        expect(d.rows).toEqual([{ label: 'Access', value: 'Private, members only' }, { label: 'Status', value: 'active' }]);
        expect(d.purpose).toBeNull();
    });

    it('claims nothing while the registry has not answered', () => {
        const d = describeGrid('Genesis', facts({ grid: null, registryLoaded: false }), now);
        expect(d.rows).toEqual([]);
        expect(d.note).toMatch(/has not answered/);
    });

    it('describes a frontier world as empty', () => {
        const d = describeGrid('Moon', facts({ grid: null }), now);
        expect(d.title).toBe('Moon Grid');
        expect(d.rows).toEqual([{ label: 'Status', value: 'Empty, awaiting charter' }]);
    });
});

describe('parsing', () => {
    it('accepts the status and clock the Grid sends and refuses anything else', () => {
        expect(parseGridStatus({ name: 'genesis', tick: 1, epoch: 0, nousCount: 3, regionCount: 5, activeLaws: 2, auditEntries: 9, uptime: 5 })?.nousCount).toBe(3);
        expect(parseGridStatus({ name: 'genesis', tick: '1' })).toBeNull();
        expect(parseGridClock({ tick: 1, epoch: 0, tickRateMs: 30000, startedAt: 5 })).toEqual({ tickRateMs: 30000, startedAt: 5 });
        expect(parseGridClock({ error: 'x' })).toBeNull();
    });
});
