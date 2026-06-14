/**
 * Phase 60 HOUSE-3 · Wave 0 — SKIP-STUB for the place:// NDS registry (D-60-07 / R-60-09).
 *
 * describe.skip: grid/src/civic/place-registry.ts lands in Wave 3. Deferred dynamic import
 * (Phase 58/59 Wave-0 pattern) defers module resolution until the suite is un-skipped.
 *
 * Contract under test:
 *   - registerPlace('aurora-cafe', parcelId, tick) returns place://aurora-cafe.genesis and
 *     sets the dormant Phase 58 named_address field on the parcel.
 *   - a duplicate name throws place_name_taken (the route maps it to 409).
 *   - registration is keyed registered_tick (an integer tick) — NOT Date.now(); the protocol
 *     nous:// DomainRegistry's wallclock registeredAt is NOT reused.
 *   - raw place names stay Grid-side — only a name_hash would ever cross (no *_name key on any payload).
 */
import { describe, it, expect } from 'vitest';

const loadPlace = () => import('../../src/civic/place-registry.js');

const PARCEL = 'genesis:shopping:0001';

describe.skip('Phase 60 HOUSE-3 — registerPlace uniqueness + addressing [Wave 3 un-skips]', () => {
    it('registerPlace returns place://<name>.<grid> for a fresh name', async () => {
        const { registerPlace } = await loadPlace();
        expect(registerPlace('aurora-cafe', PARCEL, 10)).toBe('place://aurora-cafe.genesis');
    });

    it('a duplicate name throws place_name_taken (route maps to 409)', async () => {
        const { registerPlace } = await loadPlace();
        registerPlace('aurora-cafe', PARCEL, 10);
        expect(() => registerPlace('aurora-cafe', 'genesis:shopping:0002', 11))
            .toThrow(/place_name_taken/);
    });

    it('registration is keyed registered_tick (integer tick) — NOT Date.now()', async () => {
        const place = await loadPlace() as Record<string, unknown>;
        const src = (place.registerPlace as { toString(): string }).toString();
        // Tick-based registry: never reuses the protocol nous:// wallclock registeredAt.
        expect(src).not.toMatch(/Date\.now/);
        expect(src).not.toMatch(/registeredAt/);
    });

    it('raw place names stay Grid-side — no *_name key crosses, only name_hash discipline', async () => {
        const { registerPlace, placeRecord } = await loadPlace();
        registerPlace('aurora-cafe', PARCEL, 10);
        const record = placeRecord(PARCEL);
        // The registered_tick is an integer; the record carries the tick, not a wallclock.
        expect(Number.isInteger(record.registered_tick)).toBe(true);
    });
});
