/**
 * Phase 59 HOUSE-2 · Wave 0 — SKIP-STUB for the closed v1 furniture catalog (D-59-04 / R-59-02).
 *
 * describe.skip: the catalog symbols land in Wave 1 (grid/src/civic/furniture.ts).
 * The not-yet-existing symbols are imported lazily INSIDE the skipped suite via a
 * deferred dynamic import (the Phase 58 Wave-0 pattern) so module resolution never
 * runs before Wave 1 ships the file. Wave 1 un-skips this block.
 *
 * Contract under test:
 *   - FURNITURE_CATALOG = EXACTLY 6 mirror + 7 functional kinds.
 *   - mirror entries: class 'mirror', (near-)empty affordances, render-only, home-only.
 *   - functional entries: class 'functional', non-empty affordances (work_desk → billing/accounting).
 *   - isValidFurniture(kind, structureType): mirror only in 'home'; functional anywhere it fits;
 *     unknown kind → false.
 */
import { describe, it, expect } from 'vitest';

const MIRROR_KINDS = ['bed', 'closet', 'shelf', 'kitchen', 'bathroom', 'decor'] as const;
const FUNCTIONAL_KINDS = [
    'work_desk', 'sim_board', 'meeting_table', 'game_table', 'task_board', 'skill_terminal', 'shop_counter',
] as const;

// Deferred dynamic import — never resolved while the suite is skipped (Wave 1 ships the module).
const loadFurniture = () => import('../../src/civic/furniture.js');

describe('Phase 59 HOUSE-2 — furniture catalog (closed v1) [Wave 1 un-skips]', () => {
    // ── catalog shape: 6 mirror + 7 functional (13 total) ──────────────────────
    it('FURNITURE_CATALOG has EXACTLY the 6 mirror kinds', async () => {
        const { FURNITURE_CATALOG } = await loadFurniture();
        const mirrors = Object.values(FURNITURE_CATALOG).filter(e => e.class === 'mirror').map(e => e.kind).sort();
        expect(mirrors).toEqual([...MIRROR_KINDS].sort());
    });

    it('FURNITURE_CATALOG has EXACTLY the 7 functional kinds', async () => {
        const { FURNITURE_CATALOG } = await loadFurniture();
        const functional = Object.values(FURNITURE_CATALOG).filter(e => e.class === 'functional').map(e => e.kind).sort();
        expect(functional).toEqual([...FUNCTIONAL_KINDS].sort());
    });

    it('the catalog is closed at 13 entries (6 mirror + 7 functional) — no extra kinds', async () => {
        const { FURNITURE_CATALOG } = await loadFurniture();
        expect(Object.keys(FURNITURE_CATALOG)).toHaveLength(13);
    });

    it('every catalog entry key matches its entry.kind (no aliasing)', async () => {
        const { FURNITURE_CATALOG } = await loadFurniture();
        for (const [key, entry] of Object.entries(FURNITURE_CATALOG)) {
            expect(entry.kind).toBe(key);
        }
    });

    it('FURNITURE_CATALOG is frozen (closed v1 — runtime mutation throws)', async () => {
        const { FURNITURE_CATALOG } = await loadFurniture();
        expect(() => { (FURNITURE_CATALOG as Record<string, unknown>)['castle'] = {}; }).toThrow(TypeError);
    });

    // ── class invariants: mirror render-only vs functional affordances ──────────
    it('every mirror entry declares class:mirror with (near-)empty affordances (render-only)', async () => {
        const { FURNITURE_CATALOG } = await loadFurniture();
        for (const k of MIRROR_KINDS) {
            expect(FURNITURE_CATALOG[k].class).toBe('mirror');
            expect(FURNITURE_CATALOG[k].affordances).toHaveLength(0);
        }
    });

    // ── functional affordance declarations (7) ─────────────────────────────────
    it('every functional entry declares class:functional with non-empty affordances; work_desk → billing/accounting', async () => {
        const { FURNITURE_CATALOG } = await loadFurniture();
        for (const k of FUNCTIONAL_KINDS) {
            expect(FURNITURE_CATALOG[k].class).toBe('functional');
            expect(FURNITURE_CATALOG[k].affordances.length).toBeGreaterThan(0);
        }
        expect([...FURNITURE_CATALOG['work_desk'].affordances].sort()).toEqual(['accounting', 'billing']);
    });

    it('isValidFurniture: a mirror kind (bed) is valid ONLY in a home', async () => {
        const { isValidFurniture } = await loadFurniture();
        expect(isValidFurniture('bed', 'home')).toBe(true);
    });

    it('isValidFurniture: a mirror kind (bed) is REJECTED outside a home (mirror-only-in-home)', async () => {
        const { isValidFurniture } = await loadFurniture();
        expect(isValidFurniture('bed', 'shop')).toBe(false);
        expect(isValidFurniture('decor', 'workshop')).toBe(false);
    });

    it('isValidFurniture: a functional kind (work_desk) is valid in a non-home structure', async () => {
        const { isValidFurniture } = await loadFurniture();
        expect(isValidFurniture('work_desk', 'shop')).toBe(true);
        expect(isValidFurniture('shop_counter', 'shop')).toBe(true);
    });

    it('isValidFurniture: an unknown kind is always invalid', async () => {
        const { isValidFurniture } = await loadFurniture();
        expect(isValidFurniture('throne', 'home')).toBe(false);
        expect(isValidFurniture('throne', 'shop')).toBe(false);
    });

    it('FurnitureClass is the closed union {mirror, functional} — no third class in the catalog', async () => {
        const { FURNITURE_CATALOG } = await loadFurniture();
        const classes = new Set(Object.values(FURNITURE_CATALOG).map(e => e.class));
        expect([...classes].sort()).toEqual(['functional', 'mirror']);
    });

    it('functional furniture is also valid in a home (a home may host a functional desk)', async () => {
        const { isValidFurniture } = await loadFurniture();
        expect(isValidFurniture('work_desk', 'home')).toBe(true);
    });
});
