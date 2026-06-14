/**
 * Phase 59 HOUSE-2 · Wave 0 — SKIP-STUB for the tick-driven upkeep scanner
 * (D-NH-03 / D-59-05/06/09 / R-59-05/06).
 *
 * describe.skip: onUpkeepTick + the founding-law upkeep constants land in Wave 1/4.
 * Deferred dynamic import (Phase 58 Wave-0 pattern) defers module resolution.
 *
 * Contract under test:
 *   - Founding-law constants: UPKEEP_PERIOD_TICKS=10080, UPKEEP_RATE_BPS=200;
 *     upkeepDue(parcel) = floor(price_bios * UPKEEP_RATE_BPS / 10000).
 *   - On a period boundary (last_upkeep_tick a full UPKEEP_PERIOD_TICKS behind), an owned
 *     non-commons parcel is debited upkeepDue owner → TREASURY_DID via registry.transferOusia
 *     and emits treasury.upkeep_collected; last_upkeep_tick advances.
 *   - Polis Commons (rings 0–1, owner_civic_did NULL) are SKIPPED — never debited.
 *   - SINGLE-onTick invariant (R-H-03): onUpkeepTick is a plain function called from the
 *     EXISTING clock.onTick; the scanner module adds NO new clock.onTick subscription.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const loadScanner = () => import('../../src/civic/upkeep-scanner.js');
const loadFoundingLaw = () => import('../../src/civic/founding-law.js');

const TREASURY_DID = 'did:noesis:system:treasury';
const OWNER = 'did:civic:noesis:alice';
const OWNED = 'genesis:residential:0001';

describe.skip('Phase 59 HOUSE-2 — upkeep founding-law constants [Wave 1 un-skips]', () => {
    it('UPKEEP_PERIOD_TICKS is 10080 (1 week @ 1 tick/min)', async () => {
        const { UPKEEP_PERIOD_TICKS } = await loadFoundingLaw();
        expect(UPKEEP_PERIOD_TICKS).toBe(10080);
    });

    it('UPKEEP_RATE_BPS is 200 (2% of price_bios per period)', async () => {
        const { UPKEEP_RATE_BPS } = await loadFoundingLaw();
        expect(UPKEEP_RATE_BPS).toBe(200);
    });

    it('upkeepDue = floor(price_bios * UPKEEP_RATE_BPS / 10000) — a 400-Bios parcel owes 8', async () => {
        const { upkeepDue } = await loadFoundingLaw();
        expect(upkeepDue({ priceBios: 400 } as never)).toBe(8);
        expect(upkeepDue({ priceBios: 900 } as never)).toBe(18);
    });
});

describe.skip('Phase 59 HOUSE-2 — upkeep scanner period-boundary debit [Wave 4 un-skips]', () => {
    it('on a period boundary it debits upkeepDue owner → TREASURY_DID and emits treasury.upkeep_collected', async () => {
        const { onUpkeepTick } = await loadScanner();
        const transferOusia = vi.fn().mockReturnValue({ ok: true });
        const append = vi.fn();
        const registry = {
            list: () => [{ id: OWNED, ownerDid: OWNER, priceBios: 400, lastUpkeepTick: 0, ring: 3, condition: 'maintained' }],
            transferOusia,
            get: () => ({ ousia: 10_000 }),
        };
        // last_upkeep_tick=0, tick=10080 → exactly one full period behind.
        await onUpkeepTick(10080, { registry, audit: { append }, treasuryDid: TREASURY_DID } as never);
        expect(transferOusia).toHaveBeenCalledWith(OWNER, TREASURY_DID, 8);
        expect(append).toHaveBeenCalledWith(
            'treasury.upkeep_collected', OWNED, expect.objectContaining({ amount_bios: 8, parcel_id: OWNED }),
        );
    });

    it('advances last_upkeep_tick after a successful collection', async () => {
        const { onUpkeepTick } = await loadScanner();
        const persistUpkeep = vi.fn();
        const registry = {
            list: () => [{ id: OWNED, ownerDid: OWNER, priceBios: 400, lastUpkeepTick: 0, ring: 3, condition: 'maintained' }],
            transferOusia: vi.fn().mockReturnValue({ ok: true }),
            persistUpkeep,
            get: () => ({ ousia: 10_000 }),
        };
        await onUpkeepTick(10080, { registry, audit: { append: vi.fn() }, treasuryDid: TREASURY_DID } as never);
        expect(persistUpkeep).toHaveBeenCalled();
    });

    it('does NOTHING before a full period elapses (lazy boundary assessment)', async () => {
        const { onUpkeepTick } = await loadScanner();
        const transferOusia = vi.fn();
        const registry = {
            list: () => [{ id: OWNED, ownerDid: OWNER, priceBios: 400, lastUpkeepTick: 0, ring: 3, condition: 'maintained' }],
            transferOusia,
            get: () => ({ ousia: 10_000 }),
        };
        await onUpkeepTick(5000, { registry, audit: { append: vi.fn() }, treasuryDid: TREASURY_DID } as never);
        expect(transferOusia).not.toHaveBeenCalled();
    });

    it('Polis Commons (rings 0–1, owner_civic_did NULL) are EXEMPT — never debited', async () => {
        const { onUpkeepTick } = await loadScanner();
        const transferOusia = vi.fn();
        const registry = {
            list: () => [
                { id: 'genesis:government_quarter:0001', ownerDid: null, priceBios: 0, lastUpkeepTick: 0, ring: 0, condition: 'maintained' },
                { id: 'genesis:infrastructure:0001', ownerDid: null, priceBios: 0, lastUpkeepTick: 0, ring: 1, condition: 'maintained' },
            ],
            transferOusia,
            get: () => ({ ousia: 0 }),
        };
        await onUpkeepTick(10080, { registry, audit: { append: vi.fn() }, treasuryDid: TREASURY_DID } as never);
        expect(transferOusia).not.toHaveBeenCalled();
    });
});

describe.skip('Phase 59 HOUSE-2 — single-onTick invariant (R-H-03) [Wave 4 un-skips]', () => {
    it('onUpkeepTick is a plain exported function (called from the EXISTING clock.onTick)', async () => {
        const { onUpkeepTick } = await loadScanner();
        expect(typeof onUpkeepTick).toBe('function');
    });

    it('the scanner module source registers NO clock.onTick subscription of its own', () => {
        const src = readFileSync(
            fileURLToPath(new URL('../../src/civic/upkeep-scanner.ts', import.meta.url)),
            'utf8',
        );
        expect(src).not.toMatch(/clock\.onTick/);
    });
});
