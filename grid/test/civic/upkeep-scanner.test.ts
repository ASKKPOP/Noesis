/**
 * Phase 59 HOUSE-2 · tick-driven upkeep scanner — money path RETARGETED in Phase 62.6-02.
 *
 * Upkeep now collects owner → treasury by an ATOMIC Ledger-A charge
 * (`NousAccountStore.chargeToTreasury`: owner nous_accounts → civic_treasury in one
 * transaction), NOT the legacy in-memory registry money-move into the
 * `did:noesis:system:treasury` Ledger-B record. These tests assert the money moves on the
 * unified ledger via the stateful `makeAccountsPool()` fake (the 62.5-02 pattern), the
 * underfunded decay path (chargeToTreasury throws `insufficient_balance` → decay ladder),
 * and per-parcel isolation (a charge throw on one parcel does not abort the sweep).
 *
 * Contract under test:
 *   - Founding-law constants: UPKEEP_PERIOD_TICKS=10080, UPKEEP_RATE_BPS=200;
 *     upkeepDue(parcel) = floor(price_wei * UPKEEP_RATE_BPS / 10000).
 *   - On a period boundary (last_upkeep_tick a full UPKEEP_PERIOD_TICKS behind), an owned
 *     non-commons parcel debits upkeepDue owner nous_accounts → civic_treasury and emits
 *     treasury.upkeep_collected; last_upkeep_tick advances.
 *   - Underfunded owner (balance < due): NO charge commits (rollback), the decay ladder
 *     advances (worn→derelict→reclaimed) and emits zoning.condition_changed / .parcel_reclaimed.
 *   - Polis Commons (rings 0–1, owner_civic_did NULL) are SKIPPED — never debited.
 *   - SINGLE-onTick invariant (R-H-03): onUpkeepTick is a plain function called from the
 *     EXISTING clock.onTick; the scanner module adds NO new clock.onTick subscription.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeAccountsPool } from '../helpers/accounts-pool.js';
import { NousAccountStore } from '../../src/economy/nous-account-store.js';

const loadScanner = () => import('../../src/civic/upkeep-scanner.js');
const loadFoundingLaw = () => import('../../src/civic/founding-law.js');

const TREASURY_DID = 'did:noesis:system:treasury';
const GRID = 'genesis';
const OWNER = 'did:civic:noesis:alice';
const OWNED = 'genesis:residential:0001';

/** A ring-3 residential parcel owed 8 wei/period (price 400 × 2% = 8). */
const parcelOwed8 = (id: string, ownerDid: string) =>
    ({ id, ownerDid, priceWei: 400, lastUpkeepTick: 0, ring: 3, condition: 'maintained', missedPeriods: 0 }) as never;

describe('Phase 59 HOUSE-2 — upkeep founding-law constants', () => {
    it('UPKEEP_PERIOD_TICKS is 10080 (1 week @ 1 tick/min)', async () => {
        const { UPKEEP_PERIOD_TICKS } = await loadFoundingLaw();
        expect(UPKEEP_PERIOD_TICKS).toBe(10080);
    });

    it('UPKEEP_RATE_BPS is 200 (2% of price_wei per period)', async () => {
        const { UPKEEP_RATE_BPS } = await loadFoundingLaw();
        expect(UPKEEP_RATE_BPS).toBe(200);
    });

    it('upkeepDue = floor(price_wei * UPKEEP_RATE_BPS / 10000) — a 400-wei parcel owes 8', async () => {
        const { upkeepDue } = await loadFoundingLaw();
        expect(upkeepDue({ priceWei: 400 } as never)).toBe(8);
        expect(upkeepDue({ priceWei: 900 } as never)).toBe(18);
    });
});

describe('Phase 62.6-02 — upkeep period-boundary charge on the unified ledger', () => {
    it('debits upkeepDue owner nous_accounts → civic_treasury and emits treasury.upkeep_collected', async () => {
        const { onUpkeepTick } = await loadScanner();
        const accts = makeAccountsPool();
        accts.seedAccount(OWNER, 10_000);
        const append = vi.fn();
        const deps = {
            registry: {
                list: () => [parcelOwed8(OWNED, OWNER)],
                advanceCondition: vi.fn(),
                resetCondition: vi.fn(),
                persistUpkeep: vi.fn(),
            },
            audit: { append },
            treasuryDid: TREASURY_DID,
            gridName: GRID,
            accountStore: new NousAccountStore(accts.pool),
        };
        // last_upkeep_tick=0, tick=10080 → exactly one full period behind.
        await onUpkeepTick(10080, deps as never);
        // Money moved on Ledger A: owner debited 8, civic_treasury credited 8.
        expect(accts.balanceOf(OWNER)).toBe(10_000n - 8n);
        expect(accts.treasuryOf()).toBe(8n);
        expect(append).toHaveBeenCalledWith(
            'treasury.upkeep_collected', OWNED, expect.objectContaining({ amount_wei: 8, parcel_id: OWNED }),
        );
    });

    it('advances last_upkeep_tick and resets condition after a successful collection', async () => {
        const { onUpkeepTick } = await loadScanner();
        const accts = makeAccountsPool();
        accts.seedAccount(OWNER, 10_000);
        const persistUpkeep = vi.fn();
        const resetCondition = vi.fn();
        const deps = {
            registry: {
                list: () => [parcelOwed8(OWNED, OWNER)],
                advanceCondition: vi.fn(),
                resetCondition,
                persistUpkeep,
            },
            audit: { append: vi.fn() },
            treasuryDid: TREASURY_DID,
            gridName: GRID,
            accountStore: new NousAccountStore(accts.pool),
        };
        await onUpkeepTick(10080, deps as never);
        expect(resetCondition).toHaveBeenCalledWith(OWNED);
        expect(persistUpkeep).toHaveBeenCalledWith(
            expect.objectContaining({ lastUpkeepTick: 10080, missedPeriods: 0, condition: 'maintained' }),
        );
    });

    it('does NOTHING before a full period elapses (lazy boundary assessment)', async () => {
        const { onUpkeepTick } = await loadScanner();
        const accts = makeAccountsPool();
        accts.seedAccount(OWNER, 10_000);
        const deps = {
            registry: {
                list: () => [parcelOwed8(OWNED, OWNER)],
                advanceCondition: vi.fn(),
                resetCondition: vi.fn(),
                persistUpkeep: vi.fn(),
            },
            audit: { append: vi.fn() },
            treasuryDid: TREASURY_DID,
            gridName: GRID,
            accountStore: new NousAccountStore(accts.pool),
        };
        await onUpkeepTick(5000, deps as never);
        expect(accts.balanceOf(OWNER)).toBe(10_000n); // untouched
        expect(accts.treasuryOf()).toBe(0n);
    });

    it('Polis Commons (rings 0–1, owner_civic_did NULL) are EXEMPT — never debited', async () => {
        const { onUpkeepTick } = await loadScanner();
        const accts = makeAccountsPool();
        const advanceCondition = vi.fn();
        const deps = {
            registry: {
                list: () => [
                    { id: 'genesis:government_quarter:0001', ownerDid: null, priceWei: 0, lastUpkeepTick: 0, ring: 0, condition: 'maintained' },
                    { id: 'genesis:infrastructure:0001', ownerDid: null, priceWei: 0, lastUpkeepTick: 0, ring: 1, condition: 'maintained' },
                ],
                advanceCondition,
                resetCondition: vi.fn(),
                persistUpkeep: vi.fn(),
            },
            audit: { append: vi.fn() },
            treasuryDid: TREASURY_DID,
            gridName: GRID,
            accountStore: new NousAccountStore(accts.pool),
        };
        await onUpkeepTick(10080, deps as never);
        expect(accts.treasuryOf()).toBe(0n);
        expect(advanceCondition).not.toHaveBeenCalled();
    });
});

describe('Phase 62.6-02 — underfunded owner rolls back and decays (insufficient_balance path)', () => {
    it('an owner who cannot cover is NOT charged (rollback) and the ladder advances to worn', async () => {
        const { onUpkeepTick } = await loadScanner();
        const accts = makeAccountsPool();
        accts.seedAccount(OWNER, 5); // < due (8)
        const append = vi.fn();
        const advanceCondition = vi.fn().mockReturnValue('worn');
        const persistUpkeep = vi.fn();
        const deps = {
            registry: {
                list: () => [parcelOwed8(OWNED, OWNER)],
                advanceCondition,
                resetCondition: vi.fn(),
                persistUpkeep,
            },
            audit: { append },
            treasuryDid: TREASURY_DID,
            gridName: GRID,
            accountStore: new NousAccountStore(accts.pool),
        };
        await onUpkeepTick(10080, deps as never);
        // No money moved — the debit failed and rolled back.
        expect(accts.balanceOf(OWNER)).toBe(5n);
        expect(accts.treasuryOf()).toBe(0n);
        // Decay ladder advanced + emitted the new condition (actor = owner hash).
        expect(advanceCondition).toHaveBeenCalledWith(OWNED);
        expect(append).toHaveBeenCalledWith(
            'zoning.condition_changed',
            expect.stringMatching(/^[0-9a-f]{64}$/),
            expect.objectContaining({ condition: 'worn', parcel_id: OWNED }),
        );
        expect(append).not.toHaveBeenCalledWith('treasury.upkeep_collected', expect.anything(), expect.anything());
    });

    it('reclaims to treasury when advanceCondition returns reclaimed', async () => {
        const { onUpkeepTick } = await loadScanner();
        const accts = makeAccountsPool();
        accts.seedAccount(OWNER, 0);
        const append = vi.fn();
        const advanceCondition = vi.fn().mockReturnValue('reclaimed');
        const persistReclaim = vi.fn();
        const deps = {
            registry: {
                list: () => [parcelOwed8(OWNED, OWNER)],
                advanceCondition,
                resetCondition: vi.fn(),
                persistReclaim,
            },
            audit: { append },
            treasuryDid: TREASURY_DID,
            gridName: GRID,
            accountStore: new NousAccountStore(accts.pool),
        };
        await onUpkeepTick(10080, deps as never);
        expect(append).toHaveBeenCalledWith(
            'zoning.parcel_reclaimed', OWNED, expect.objectContaining({ reason: 'upkeep_default' }),
        );
        expect(persistReclaim).toHaveBeenCalledWith(expect.objectContaining({ ownerDid: TREASURY_DID, structure: null }));
    });
});

describe('Phase 62.6-02 — per-parcel isolation (a charge throw does not abort the sweep)', () => {
    it('an underfunded parcel decays while a funded parcel in the same sweep still collects', async () => {
        const { onUpkeepTick } = await loadScanner();
        const POOR = 'did:civic:noesis:poor';
        const RICH = 'did:civic:noesis:rich';
        const POOR_PARCEL = 'genesis:residential:0009';
        const RICH_PARCEL = 'genesis:residential:0010';
        const accts = makeAccountsPool();
        accts.seedAccount(POOR, 0);
        accts.seedAccount(RICH, 10_000);
        const append = vi.fn();
        const advanceCondition = vi.fn().mockReturnValue('worn');
        const deps = {
            registry: {
                list: () => [parcelOwed8(POOR_PARCEL, POOR), parcelOwed8(RICH_PARCEL, RICH)],
                advanceCondition,
                resetCondition: vi.fn(),
                persistUpkeep: vi.fn(),
            },
            audit: { append },
            treasuryDid: TREASURY_DID,
            gridName: GRID,
            accountStore: new NousAccountStore(accts.pool),
        };
        await onUpkeepTick(10080, deps as never);
        // Poor parcel: insufficient_balance → decayed.
        expect(advanceCondition).toHaveBeenCalledWith(POOR_PARCEL);
        // Rich parcel: STILL assessed and funded despite the earlier failure.
        expect(accts.balanceOf(RICH)).toBe(10_000n - 8n);
        expect(accts.treasuryOf()).toBe(8n);
        expect(append).toHaveBeenCalledWith(
            'treasury.upkeep_collected', RICH_PARCEL, expect.objectContaining({ amount_wei: 8 }),
        );
    });

    it('a non-affordability charge throw skips the parcel WITHOUT decaying it, and the sweep continues', async () => {
        const { onUpkeepTick } = await loadScanner();
        const FAIL = 'did:civic:noesis:fail';
        const RICH = 'did:civic:noesis:rich';
        const FAIL_PARCEL = 'genesis:residential:0011';
        const RICH_PARCEL = 'genesis:residential:0012';
        const accts = makeAccountsPool();
        accts.seedAccount(RICH, 10_000);
        const realStore = new NousAccountStore(accts.pool);
        const append = vi.fn();
        const advanceCondition = vi.fn().mockReturnValue('worn');
        // A transient (non-affordability) fault on FAIL_PARCEL's owner; RICH delegates to the real store.
        const accountStore = {
            chargeToTreasury: vi.fn((p: { civicDid: string }) =>
                p.civicDid === FAIL ? Promise.reject(new Error('db_timeout')) : realStore.chargeToTreasury(p as never),
            ),
        };
        const deps = {
            registry: {
                list: () => [parcelOwed8(FAIL_PARCEL, FAIL), parcelOwed8(RICH_PARCEL, RICH)],
                advanceCondition,
                resetCondition: vi.fn(),
                persistUpkeep: vi.fn(),
            },
            audit: { append },
            treasuryDid: TREASURY_DID,
            gridName: GRID,
            accountStore,
        };
        await onUpkeepTick(10080, deps as never);
        // Transient fault → the parcel is skipped, NOT decayed (no false eviction on a DB blip).
        expect(advanceCondition).not.toHaveBeenCalledWith(FAIL_PARCEL);
        // The sweep continued: RICH still collected.
        expect(accts.balanceOf(RICH)).toBe(10_000n - 8n);
        expect(append).toHaveBeenCalledWith(
            'treasury.upkeep_collected', RICH_PARCEL, expect.objectContaining({ amount_wei: 8 }),
        );
    });
});

describe('Phase 59 HOUSE-2 — single-onTick invariant (R-H-03)', () => {
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
