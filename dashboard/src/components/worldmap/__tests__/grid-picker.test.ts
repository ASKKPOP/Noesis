import { describe, it, expect } from 'vitest';
import { pickerEntries, type PortalGrid } from '../grid-picker';

const genesis = (over: Partial<PortalGrid> = {}): PortalGrid => ({
    grid_id: 'genesis', name: 'Genesis', status: 'active', visibility: 'public', member: false, locked: false, ...over,
});

describe('pickerEntries (D-V3-41 — the Portal map lists Grids from the live registry)', () => {
    it('falls back to the scene\'s own Grids while the registry feed is unavailable', () => {
        expect(pickerEntries(null).map((e) => e.name)).toEqual(['Genesis', 'Moon', 'Mars']);
        expect(pickerEntries(null).every((e) => !e.locked)).toBe(true);
    });

    it('lists registry Grids first, then the frontier worlds not yet chartered', () => {
        const out = pickerEntries([genesis()]);
        expect(out.map((e) => e.name)).toEqual(['Genesis', 'Moon', 'Mars']);
        expect(out[0]).toMatchObject({ label: 'Genesis', gridId: 'genesis', registered: true, locked: false });
        expect(out[1].gridId).toBeUndefined();
        expect(out[1]).toMatchObject({ label: 'Moon Grid', registered: false, locked: false });
    });

    it('marks a private Grid the viewer is not a member of as locked', () => {
        const out = pickerEntries([genesis({ visibility: 'private', locked: true })]);
        expect(out[0]).toMatchObject({ name: 'Genesis', label: '🔒 Genesis', locked: true });
    });

    it('a member of a private Grid is not locked out', () => {
        const out = pickerEntries([genesis({ visibility: 'private', member: true, locked: false })]);
        expect(out[0]).toMatchObject({ label: 'Genesis', locked: false, member: true });
    });

    it('a chartered frontier Grid appears once, from the registry', () => {
        const moon: PortalGrid = { grid_id: 'moon', name: 'Moon', status: 'active', visibility: 'private', member: false, locked: true };
        const out = pickerEntries([genesis(), moon]);
        expect(out.map((e) => e.name)).toEqual(['Genesis', 'Moon', 'Mars']);
        expect(out[1]).toMatchObject({ label: '🔒 Moon Grid', registered: true, locked: true });
    });
});
