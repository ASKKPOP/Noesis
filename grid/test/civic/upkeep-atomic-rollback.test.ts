/**
 * Phase 62.6-05 (D-12) — upkeep atomic-rollback proof.
 *
 * A failing upkeep charge (owner cannot cover the due amount) must leave NO partial state:
 * the owner's nous_accounts balance is unchanged, the civic_treasury is unchanged, and the
 * parcel is routed to the decay ladder (no phantom collection, no treasury.upkeep_collected).
 * `NousAccountStore.chargeToTreasury` does SELECT … FOR UPDATE → debit → treasury credit in
 * one transaction and throws `insufficient_balance`; the fake pool's begin/rollback snapshot
 * restores both maps, mirroring the real rails' atomicity.
 */
import { describe, it, expect, vi } from 'vitest';
import { onUpkeepTick } from '../../src/civic/upkeep-scanner.js';
import { NousAccountStore } from '../../src/economy/nous-account-store.js';
import { makeAccountsPool } from '../helpers/accounts-pool.js';

const TREASURY_DID = 'did:noesis:system:treasury';
const GRID = 'genesis';
const OWNER = 'did:civic:noesis:owner';
const PARCEL = 'genesis:residential:0007';

/** A ring-3 residential parcel owed 8 wei/period (price 400 × 2% = 8). */
const parcelOwed8 = () =>
    ({ id: PARCEL, ownerDid: OWNER, priceWei: 400, lastUpkeepTick: 0, ring: 3, condition: 'maintained', missedPeriods: 0 }) as never;

describe('Phase 62.6-05 — upkeep charge atomic rollback (insufficient owner balance)', () => {
    it('an owner who cannot cover the due leaves nous_accounts AND civic_treasury unchanged and decays instead', async () => {
        const accts = makeAccountsPool();
        accts.seedAccount(OWNER, 5); // 5 < due (8) → chargeToTreasury throws insufficient_balance
        accts.seedTreasury(0);
        const append = vi.fn();
        const advanceCondition = vi.fn().mockReturnValue('worn');
        const deps = {
            registry: {
                list: () => [parcelOwed8()],
                advanceCondition,
                resetCondition: vi.fn(),
                persistUpkeep: vi.fn(),
            },
            audit: { append },
            treasuryDid: TREASURY_DID,
            gridName: GRID,
            accountStore: new NousAccountStore(accts.pool),
        };

        // last_upkeep_tick=0, tick=10080 → exactly one full period behind → charge attempted.
        await onUpkeepTick(10080, deps as never);

        // No partial state: the debit failed and rolled back — owner and treasury both unchanged.
        expect(accts.balanceOf(OWNER)).toBe(5n);
        expect(accts.treasuryOf()).toBe(0n);
        // The parcel routed to the decay ladder — no phantom collection.
        expect(advanceCondition).toHaveBeenCalledWith(PARCEL);
        expect(append).not.toHaveBeenCalledWith('treasury.upkeep_collected', expect.anything(), expect.anything());
    });
});
