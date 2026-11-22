import { describe, it, expect } from 'vitest';
import { gridHostRewrite, gridEntryHref, gridEntryState } from './grid-host';

describe('gridHostRewrite — grid.<domain>/<grid> serves the Grid entry page', () => {
    it('rewrites a Grid name on the grid host', () => {
        expect(gridHostRewrite('grid.noesiis.com', '/genesis')).toBe('/g/genesis');
        expect(gridHostRewrite('grid.localhost:3001', '/Moon')).toBe('/g/moon');
    });
    it('leaves the Portal host alone', () => {
        expect(gridHostRewrite('noesiis.com', '/genesis')).toBeNull();
        expect(gridHostRewrite('www.noesiis.com', '/about')).toBeNull();
        expect(gridHostRewrite(null, '/genesis')).toBeNull();
    });
    it('never shadows the app\'s own routes or deeper paths on the grid host', () => {
        for (const p of ['/', '/grid', '/portal', '/about', '/g', '/api', '/worldmap', '/apply', '/genesis/economy', '/favicon.ico']) {
            expect(gridHostRewrite('grid.noesiis.com', p), p).toBeNull();
        }
    });
});

describe('gridEntryHref', () => {
    it('uses the Grid host when one is configured', () => {
        expect(gridEntryHref('genesis', 'grid.noesiis.com')).toBe('https://grid.noesiis.com/genesis');
    });
    it('falls back to the same-origin entry page', () => {
        expect(gridEntryHref('genesis', undefined)).toBe('/g/genesis');
        expect(gridEntryHref('genesis', '')).toBe('/g/genesis');
    });
});

describe('gridEntryState', () => {
    const g = (over: object = {}) => ({ grid_id: 'genesis', name: 'Genesis', status: 'active', visibility: 'public' as const, member: false, locked: false, ...over });
    it('loading until the registry answers; unreachable on failure', () => {
        expect(gridEntryState(undefined, 'genesis').kind).toBe('loading');
        expect(gridEntryState(null, 'genesis').kind).toBe('unreachable');
    });
    it('unknown Grid', () => {
        expect(gridEntryState([g()], 'atlantis').kind).toBe('unknown');
    });
    it('a public Grid, or a private one for a member, is open', () => {
        expect(gridEntryState([g()], 'genesis')).toMatchObject({ kind: 'open', grid: { name: 'Genesis' } });
        expect(gridEntryState([g({ visibility: 'private', member: true })], 'GENESIS').kind).toBe('open');
    });
    it('a private Grid is members-only for everyone else', () => {
        expect(gridEntryState([g({ visibility: 'private', locked: true })], 'genesis')).toMatchObject({ kind: 'members_only', grid: { name: 'Genesis' } });
    });
});
