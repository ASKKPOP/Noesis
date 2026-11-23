/**
 * Phase 59 HOUSE-2 · Wave 0 — SKIP-STUB for the closed v1 furniture catalog (D-59-04 / R-59-02).
 *
 * describe.skip: the catalog symbols land in Wave 1 (grid/src/civic/furniture.ts).
 * The not-yet-existing symbols are imported lazily INSIDE the skipped suite via a
 * deferred dynamic import (the Phase 58 Wave-0 pattern) so module resolution never
 * runs before Wave 1 ships the file. Wave 1 un-skips this block.
 *
 * Contract under test:
 *   - FURNITURE_CATALOG = the placeable Genesis kinds; the 6 mirror + 7 functional v1 kinds are unchanged.
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
    // ── catalog shape: the v1 kinds stay, catalog v2 adds more (Grid House Objects §14) ──
    it('FURNITURE_CATALOG still holds every v1 mirror kind as mirror', async () => {
        const { FURNITURE_CATALOG } = await loadFurniture();
        for (const k of MIRROR_KINDS) expect(FURNITURE_CATALOG[k]?.class, k).toBe('mirror');
    });

    it('FURNITURE_CATALOG still holds every v1 functional kind as functional', async () => {
        const { FURNITURE_CATALOG } = await loadFurniture();
        for (const k of FUNCTIONAL_KINDS) expect(FURNITURE_CATALOG[k]?.class, k).toBe('functional');
    });

    it('the catalog is the 51 placeable Genesis kinds (18 mirror + 33 functional) — and nothing else', async () => {
        const { FURNITURE_CATALOG } = await loadFurniture();
        const { KINDS } = await import('../../src/civic/genesis-catalog.js');
        expect(Object.keys(FURNITURE_CATALOG).sort()).toEqual(KINDS.filter(k => k.placeable).map(k => k.id).sort());
        expect(Object.keys(FURNITURE_CATALOG)).toHaveLength(51);
        expect(Object.values(FURNITURE_CATALOG).filter(e => e.class === 'mirror')).toHaveLength(18);
    });

    it('a kind that is seeded but not placeable yet (link_box) is not in the catalog and fails the gate', async () => {
        const { FURNITURE_CATALOG, isValidFurniture } = await loadFurniture();
        expect(Object.hasOwn(FURNITURE_CATALOG, 'link_box')).toBe(false);
        expect(isValidFurniture('link_box', 'home')).toBe(false);
        expect(isValidFurniture('display_case', 'shop')).toBe(false);
    });

    it('a new mirror kind (lamp) is valid only in a home; a new functional kind (bookshelf) anywhere', async () => {
        const { isValidFurniture } = await loadFurniture();
        expect(isValidFurniture('lamp', 'home')).toBe(true);
        expect(isValidFurniture('lamp', 'shop')).toBe(false);
        expect(isValidFurniture('bookshelf', 'venue')).toBe(true);
    });

    it('inherited object keys are not kinds (constructor, toString, __proto__)', async () => {
        const { isValidFurniture } = await loadFurniture();
        for (const k of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
            expect(isValidFurniture(k, 'home'), k).toBe(false);
            expect(isValidFurniture(k, 'shop'), k).toBe(false);
        }
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
