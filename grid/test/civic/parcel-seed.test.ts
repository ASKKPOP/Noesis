/**
 * Phase 58 HOUSE-1 · Wave 0 skip-stub — Genesis Core seed (exactly 53 parcels).
 *
 * Locks the D-58-03 (D-NH-04/09) seed contract BEFORE Wave 1 lands the seeder.
 * `describe.skip` so the suite reports SKIPPED, not failed. GENESIS_CORE_SEED_PLAN
 * lives in the not-yet-created grid/src/civic/founding-law.ts and is pulled in via a
 * dynamic import INSIDE the skipped suite so module resolution is deferred — the
 * block never runs under .skip. Wave 1 deletes the .skip and the import resolves.
 *
 * Covers: R-58-02 (Genesis Core seeded exactly 53 = 48 purchasable + 5 civic,
 *         idempotently, emitting no audit events).
 * Un-skipped by Wave 1 when the seeder + founding-law.ts ship.
 */
import { describe, it, expect, beforeAll } from 'vitest';

type FoundingLaw = typeof import('../../src/civic/founding-law.js');

describe.skip('Genesis Core seed — exactly 53 parcels (D-58-03 / R-58-02)', () => {
    let GENESIS_CORE_SEED_PLAN: FoundingLaw['GENESIS_CORE_SEED_PLAN'];
    beforeAll(async () => {
        ({ GENESIS_CORE_SEED_PLAN } = await import('../../src/civic/founding-law.js'));
    });

    it('the seed produces EXACTLY 53 parcels (48 purchasable + 5 civic)', () => {
        const total = GENESIS_CORE_SEED_PLAN.reduce((sum, e) => sum + e.count, 0);
        expect(total).toBe(53);
    });

    it('ring 0 government_quarter ×1', () => {
        const e = GENESIS_CORE_SEED_PLAN.find(p => p.ring === 0 && p.zone === 'government_quarter');
        expect(e?.count).toBe(1);
    });

    it('ring 1 infrastructure ×4 (civic commons)', () => {
        const e = GENESIS_CORE_SEED_PLAN.find(p => p.ring === 1 && p.zone === 'infrastructure');
        expect(e?.count).toBe(4);
    });

    it('ring 2 business ×8 + shopping ×8 + manufacture ×8 (24 purchasable)', () => {
        const sum = (zone: string) =>
            GENESIS_CORE_SEED_PLAN.filter(p => p.ring === 2 && p.zone === zone)
                .reduce((s, p) => s + p.count, 0);
        expect(sum('business')).toBe(8);
        expect(sum('shopping')).toBe(8);
        expect(sum('manufacture')).toBe(8);
    });

    it('ring 3 residential ×24 (purchasable homes)', () => {
        const e = GENESIS_CORE_SEED_PLAN.find(p => p.ring === 3 && p.zone === 'residential');
        expect(e?.count).toBe(24);
    });

    it('distribution sums to 1 + 4 + 24 + 24 = 53', () => {
        const ring = (n: number) =>
            GENESIS_CORE_SEED_PLAN.filter(p => p.ring === n).reduce((s, p) => s + p.count, 0);
        expect(ring(0)).toBe(1);
        expect(ring(1)).toBe(4);
        expect(ring(2)).toBe(24);
        expect(ring(3)).toBe(24);
    });
});

describe.skip('Genesis Core seed — pre-built commons venues + no audit (R-58-02)', () => {
    let GENESIS_CORE_SEED_PLAN: FoundingLaw['GENESIS_CORE_SEED_PLAN'];
    beforeAll(async () => {
        ({ GENESIS_CORE_SEED_PLAN } = await import('../../src/civic/founding-law.js'));
    });

    it('the 5 civic parcels (rings 0-1) carry pre-built venue/open commons structures', () => {
        // ring 1 ×4: guest hall, market floor, shared workshop, archive (type venue, visibility open).
        // ring 0 ×1: government_quarter monument. All pre-built at seed time.
        const civic = GENESIS_CORE_SEED_PLAN.filter(p => p.ring === 0 || p.ring === 1);
        expect(civic.every(p => p.prebuilt === 'venue')).toBe(true);
    });

    it('seeding emits NO audit events — a spy on any append-* is never called (world-creation, not commerce)', () => {
        // seeder MUST NOT call any audit producer; expect(appendSpy).not.toHaveBeenCalled().
    });
});
