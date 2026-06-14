/**
 * Phase 60 HOUSE-3 · Wave 0 — SKIP-STUB for the Council ring-expansion bill TEMPLATE
 * (D-60-08 / D-NH-09/13 / R-60-10).
 *
 * describe.skip: grid/src/civic/ring-expansion.ts lands in Wave 5. Deferred dynamic import
 * (Phase 58/59 Wave-0 pattern) defers module resolution until the suite is un-skipped.
 *
 * Contract under test:
 *   - onLawEnacted consumes an EXISTING Phase 46 gov.law_enacted event; a bill body matching
 *     {action:'seed_ring', ring:N} (parsed Grid-side) seeds ring N at frontier prices via the
 *     Phase 58 seedZone + gravity formula.
 *   - the seeder is idempotent (INSERT IGNORE — re-running enacts no duplicate parcels) and
 *     emits NO audit event (world-creation per Phase 58); NO new allowlist member is added.
 *   - the SAME body-parse hook supports a Polis amendment of UPKEEP_RATE_BPS/ZONE_TAX_BPS
 *     (constants remain the default fallback — single patch point).
 *   - VOTE-05 Nous-only + the bill pipeline are reused verbatim (NOT a new governance path).
 */
import { describe, it, expect } from 'vitest';

const loadRing = () => import('../../src/civic/ring-expansion.js');

describe('Phase 60 HOUSE-3 — ring-expansion template consumes gov.law_enacted [Wave 5 un-skips]', () => {
    it('a {action:seed_ring, ring:N} bill body seeds ring N via seedZone + gravity formula', async () => {
        const { onLawEnacted } = await loadRing();
        const seeded: number[] = [];
        onLawEnacted({ action: 'seed_ring', ring: 4 }, {
            seedZone: (ring: number) => { seeded.push(ring); },
        } as never);
        expect(seeded).toEqual([4]);
    });

    it('the seeder is idempotent (INSERT IGNORE) — re-running enacts no duplicate parcels', async () => {
        const { onLawEnacted } = await loadRing();
        let inserted = 0;
        const deps = { seedZone: () => { inserted += 1; }, alreadySeeded: (ring: number) => ring === 4 } as never;
        onLawEnacted({ action: 'seed_ring', ring: 4 }, deps);
        // Second enactment of the same ring is a no-op (already seeded).
        expect(inserted).toBe(0);
    });

    it('seeding emits NO audit event (world-creation per Phase 58) — NO new allowlist member', async () => {
        const { onLawEnacted } = await loadRing();
        const { AuditChain } = await import('../../src/audit/chain.js');
        const audit = new AuditChain();
        const before = audit.all().length;
        onLawEnacted({ action: 'seed_ring', ring: 4 }, { seedZone: () => {}, audit } as never);
        expect(audit.all().length).toBe(before);
    });

    it('the SAME body-parse hook supports a Polis amendment of ZONE_TAX_BPS / UPKEEP_RATE_BPS', async () => {
        const { onLawEnacted } = await loadRing();
        const amended: Record<string, number> = {};
        onLawEnacted({ action: 'amend_constant', key: 'ZONE_TAX_BPS.business', value: 1300 }, {
            amendConstant: (k: string, v: number) => { amended[k] = v; },
        } as never);
        expect(amended['ZONE_TAX_BPS.business']).toBe(1300);
    });

    it('a non-template bill body is ignored (the template is NOT a new governance path)', async () => {
        const { onLawEnacted } = await loadRing();
        const seeded: number[] = [];
        onLawEnacted({ action: 'something_else' }, { seedZone: (r: number) => seeded.push(r) } as never);
        expect(seeded).toEqual([]);
    });
});
