/**
 * The upkeep scanner against the REAL ParcelRegistry, composed the way main.ts composes it.
 *
 * The scanner's own tests use a mock registry whose `list()` reflects whatever the test
 * hands it. In the running Grid the registry is the in-memory truth and the store writes
 * the database, and two things went wrong between them:
 *
 *   1. A paid (or missed) period was written to the database only. Memory never learned
 *      `lastUpkeepTick`, so the same parcel was due again on the very next tick: a funded
 *      owner paid 2% of the price every tick, and a broke one fell from maintained to
 *      reclaimed in three ticks instead of three periods.
 *   2. A reclaimed parcel was owned by the treasury in memory and by nobody in the
 *      database. In memory it stayed in the sweep (the treasury has no account, so it
 *      "defaulted" and was reclaimed again every tick, one audit event each time) and it
 *      could not be bought again until the Grid restarted.
 */
import { describe, it, expect, vi } from 'vitest';
import { ParcelRegistry } from '../../src/civic/parcel-registry.js';
import { onUpkeepTick, createUpkeepRegistryFacade } from '../../src/civic/upkeep-scanner.js';
import { UPKEEP_PERIOD_TICKS } from '../../src/civic/founding-law.js';
import type { ParcelStore } from '../../src/civic/parcel-store.js';

const OWNER = 'did:civic:noesis:alice';
const ADDR = 'genesis:residential:0001';
const TREASURY = 'did:noesis:system:treasury';

function world(opts: { funded: boolean }) {
    const registry = new ParcelRegistry('genesis');
    registry.seedZone({ zoneId: 'residential', count: 2, priceWei: 400, ring: 3 });
    const store = {
        persistUpkeep: vi.fn(async () => {}),
        persistReclaim: vi.fn(async () => {}),
    };
    const charge = vi.fn(async () => {
        if (!opts.funded) throw new Error('insufficient_balance');
        return { newBalance: 0n };
    });
    const events: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const deps = {
        registry: createUpkeepRegistryFacade(registry, store as unknown as ParcelStore),
        audit: { append: (type: string, _actor: string, payload: Record<string, unknown>) => { events.push({ type, payload }); } },
        treasuryDid: TREASURY,
        gridName: 'genesis',
        accountStore: { chargeToTreasury: charge },
    };
    expect(registry.purchase(ADDR, OWNER, 10_000).ok).toBe(true);
    registry.stampAcquired(ADDR, 0);
    return { registry, store, charge, events, deps };
}

describe('upkeep — a period is a period', () => {
    it('a funded owner is charged once per period, not once per tick', async () => {
        const { charge, deps, registry } = world({ funded: true });
        for (let tick = 1; tick <= 50; tick++) await onUpkeepTick(tick, deps);
        expect(charge).toHaveBeenCalledTimes(1);
        expect(registry.get(ADDR)!.lastUpkeepTick).toBe(1);

        await onUpkeepTick(UPKEEP_PERIOD_TICKS, deps);          // one tick short of a period
        expect(charge).toHaveBeenCalledTimes(1);
        await onUpkeepTick(1 + UPKEEP_PERIOD_TICKS, deps);      // a full period later
        expect(charge).toHaveBeenCalledTimes(2);
    });

    it('a broke owner loses one rung per period, not one per tick', async () => {
        const { deps, registry } = world({ funded: false });
        for (let tick = 1; tick <= 50; tick++) await onUpkeepTick(tick, deps);
        expect(registry.get(ADDR)!.condition).toBe('worn');
        expect(registry.get(ADDR)!.ownerDid).toBe(OWNER);

        await onUpkeepTick(1 + UPKEEP_PERIOD_TICKS, deps);
        expect(registry.get(ADDR)!.condition).toBe('derelict');
        await onUpkeepTick(1 + 2 * UPKEEP_PERIOD_TICKS, deps);
        expect(registry.get(ADDR)!.ownerDid).toBeNull();        // reclaimed in the third period
    });
});

describe('upkeep — a reclaimed parcel goes back to the pool', () => {
    async function reclaim() {
        const w = world({ funded: false });
        await onUpkeepTick(1, w.deps);
        await onUpkeepTick(1 + UPKEEP_PERIOD_TICKS, w.deps);
        await onUpkeepTick(1 + 2 * UPKEEP_PERIOD_TICKS, w.deps);
        return w;
    }

    it('it has no owner and no structure, in memory as in the database', async () => {
        const { registry, store } = await reclaim();
        const p = registry.get(ADDR)!;
        expect(p.ownerDid).toBeNull();
        expect(p.structure).toBeNull();
        expect(p.condition).toBe('maintained');
        expect(p.missedPeriods).toBe(0);
        expect(p.entryPolicy).toEqual({ policy: 'open', allowlist: [] });
        expect(store.persistReclaim).toHaveBeenCalledTimes(1);
        expect((store.persistReclaim.mock.calls[0] as unknown as [{ ownerDid: unknown }])[0].ownerDid).toBeNull();
    });

    it('it is reclaimed exactly once — later ticks leave it alone', async () => {
        const { deps, events, charge, store } = await reclaim();
        const reclaimedEvents = () => events.filter((e) => e.type === 'zoning.parcel_reclaimed').length;
        expect(reclaimedEvents()).toBe(1);
        const eventsBefore = events.length;
        const chargesBefore = charge.mock.calls.length;
        for (let i = 1; i <= 5; i++) await onUpkeepTick(1 + (2 + i) * UPKEEP_PERIOD_TICKS, deps);
        expect(events.length).toBe(eventsBefore);
        expect(charge.mock.calls.length).toBe(chargesBefore);
        expect(store.persistReclaim).toHaveBeenCalledTimes(1);
    });

    it('it can be bought again without a restart', async () => {
        const { registry } = await reclaim();
        const again = registry.purchase(ADDR, 'did:civic:noesis:bob', 10_000);
        expect(again.ok).toBe(true);
        expect(registry.get(ADDR)!.ownerDid).toBe('did:civic:noesis:bob');
    });

    it('the former owner keeps no way in: the next owner starts with an empty allowlist', async () => {
        const w = world({ funded: false });
        expect(w.registry.build(ADDR, OWNER, { name: 'Oikos', type: 'home', visibility: 'private' }, 0).ok).toBe(true);
        expect(w.registry.setEntryPolicy(ADDR, OWNER, { policy: 'allowlist', allowlist: ['did:civic:noesis:friend'] }).ok).toBe(true);
        await onUpkeepTick(1, w.deps);
        await onUpkeepTick(1 + UPKEEP_PERIOD_TICKS, w.deps);
        await onUpkeepTick(1 + 2 * UPKEEP_PERIOD_TICKS, w.deps);

        expect(w.registry.purchase(ADDR, 'did:civic:noesis:bob', 10_000).ok).toBe(true);
        expect(w.registry.build(ADDR, 'did:civic:noesis:bob', { name: 'Bob', type: 'home', visibility: 'private' }, 9).ok).toBe(true);
        expect(w.registry.join(ADDR, 'did:civic:noesis:friend').ok).toBe(false);
    });
});
