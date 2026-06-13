/**
 * Phase 58 HOUSE-1 · Wave 0 skip-stub — gravity pricing + purchasable rings.
 *
 * Locks the D-58-04 founding-law contract BEFORE Wave 1 lands the implementation.
 * `describe.skip` so the suite reports SKIPPED, not failed. The Wave-1 symbols
 * (gravityPrice, PURCHASABLE_RINGS, GENESIS_CORE_SEED_PLAN) live in the not-yet-
 * created grid/src/civic/founding-law.ts; they are pulled in via a dynamic import
 * INSIDE the skipped suite so module resolution is deferred — the block never runs
 * under .skip, so the missing module is never loaded. Wave 1 deletes the .skip and
 * the import resolves against the real founding-law.ts.
 *
 * Covers: R-58-03 (gravity pricing, constants centralized in founding-law.ts).
 * Un-skipped by Wave 1 when founding-law.ts ships.
 */
import { describe, it, expect, beforeAll } from 'vitest';

type FoundingLaw = typeof import('../../src/civic/founding-law.js');

describe.skip('founding-law — gravity pricing (D-58-04 / R-58-03)', () => {
    let mod: FoundingLaw;
    beforeAll(async () => {
        mod = await import('../../src/civic/founding-law.js');
    });

    it('gravityPrice(3) === 400 (ring 3 residential home price)', () => {
        expect(mod.gravityPrice(3)).toBe(400);
    });

    it('gravityPrice(2) === 900 (ring 2 business/shopping/manufacture price)', () => {
        expect(mod.gravityPrice(2)).toBe(900);
    });

    it('gravityPrice(ring) === 100 * (5 - ring) ** 2 for rings 2 and 3', () => {
        expect(mod.gravityPrice(2)).toBe(100 * (5 - 2) ** 2);
        expect(mod.gravityPrice(3)).toBe(100 * (5 - 3) ** 2);
    });

    it('rings 0 and 1 are NOT in PURCHASABLE_RINGS (civic land, not for sale)', () => {
        expect(mod.PURCHASABLE_RINGS).not.toContain(0);
        expect(mod.PURCHASABLE_RINGS).not.toContain(1);
    });

    it('PURCHASABLE_RINGS is exactly [2, 3]', () => {
        expect([...mod.PURCHASABLE_RINGS]).toEqual([2, 3]);
    });
});

describe.skip('founding-law — GENESIS_CORE_SEED_PLAN shape (R-58-02 / R-58-03)', () => {
    let mod: FoundingLaw;
    beforeAll(async () => {
        mod = await import('../../src/civic/founding-law.js');
    });

    it('every plan entry uses a purchasable ring or a pre-built civic venue ring', () => {
        for (const entry of mod.GENESIS_CORE_SEED_PLAN) {
            const civic = entry.ring === 0 || entry.ring === 1;
            const purchasable = mod.PURCHASABLE_RINGS.includes(entry.ring);
            expect(civic || purchasable).toBe(true);
        }
    });

    it('plan totals to exactly 53 parcels (48 purchasable + 5 civic)', () => {
        const total = mod.GENESIS_CORE_SEED_PLAN.reduce((sum, e) => sum + e.count, 0);
        expect(total).toBe(53);
    });
});
