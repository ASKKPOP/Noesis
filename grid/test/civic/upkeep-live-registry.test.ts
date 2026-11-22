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
import { onUpkeepTick, createUpkeepRegistryFacade, ticksRecorded } from '../../src/civic/upkeep-scanner.js';
import { recordIou, outstandingBetween, _resetLedger } from '../../src/civic/credit-ledger.js';
import { UPKEEP_PERIOD_TICKS } from '../../src/civic/founding-law.js';
import { ParcelStore } from '../../src/civic/parcel-store.js';

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

describe('upkeep — a reclaim ends the former owner\'s roles', () => {
    const STAFF = 'did:civic:noesis:staffer';
    const GUEST = 'did:civic:noesis:visitor';
    const RECLAIM_TICK = 1 + 2 * UPKEEP_PERIOD_TICKS;

    async function reclaimWithRoles() {
        const w = world({ funded: false });
        w.registry.grantRole(ADDR, STAFF, 'staff', OWNER, 0);
        w.registry.grantRole(ADDR, GUEST, 'guest', OWNER, 0);
        await onUpkeepTick(1, w.deps);
        await onUpkeepTick(1 + UPKEEP_PERIOD_TICKS, w.deps);
        await onUpkeepTick(RECLAIM_TICK, w.deps);
        return w;
    }

    it('staff and guests hold no role on the reclaimed parcel, nor under its next owner', async () => {
        const { registry } = await reclaimWithRoles();
        expect(registry.roleOf(ADDR, STAFF)).toBeNull();
        expect(registry.roleOf(ADDR, GUEST)).toBeNull();
        expect(registry.purchase(ADDR, 'did:civic:noesis:bob', 10_000).ok).toBe(true);
        expect(registry.roleOf(ADDR, STAFF)).toBeNull();
    });

    it('the edges are kept as history, stamped with the tick of the reclaim — never deleted', async () => {
        const { registry } = await reclaimWithRoles();
        const edges = registry.rolesFor(ADDR);
        expect(edges.map((e) => e.holder_civic_did).sort()).toEqual([STAFF, GUEST].sort());
        for (const e of edges) expect(e.revoked_tick).toBe(RECLAIM_TICK);
    });

    it('each role that ended is on the chain, before the reclaim itself', async () => {
        const { events } = await reclaimWithRoles();
        const types = events.map((e) => e.type);
        const revoked = events.filter((e) => e.type === 'zoning.role_revoked');
        expect(revoked).toHaveLength(2);
        for (const e of revoked) {
            expect(e.payload.reason).toBe('severance_complete');
            expect(e.payload.parcel_id).toBe(ADDR);
            expect(e.payload.tick).toBe(RECLAIM_TICK);
        }
        expect(types.lastIndexOf('zoning.role_revoked')).toBeLessThan(types.indexOf('zoning.parcel_reclaimed'));
    });

    it('a role the owner had already ended is not announced a second time', async () => {
        const w = world({ funded: false });
        w.registry.grantRole(ADDR, STAFF, 'staff', OWNER, 0);
        w.registry.revokeRole(ADDR, STAFF, 'owner_revoked', 5);
        await onUpkeepTick(1, w.deps);
        await onUpkeepTick(1 + UPKEEP_PERIOD_TICKS, w.deps);
        await onUpkeepTick(RECLAIM_TICK, w.deps);
        expect(w.events.filter((e) => e.type === 'zoning.role_revoked')).toHaveLength(0);
        expect(w.registry.rolesFor(ADDR)[0].revoked_tick).toBe(5);
    });

    it('what the former owner owed its staff is still owed', async () => {
        _resetLedger();
        const w = world({ funded: false });
        w.registry.grantRole(ADDR, STAFF, 'staff', OWNER, 0);
        recordIou(STAFF, OWNER, 25, 'cowork:probe', 0);
        await onUpkeepTick(1, w.deps);
        await onUpkeepTick(1 + UPKEEP_PERIOD_TICKS, w.deps);
        await onUpkeepTick(RECLAIM_TICK, w.deps);
        expect(outstandingBetween(OWNER, STAFF)).toHaveLength(1);
        _resetLedger();
    });

    it('a parcel that only slips a rung keeps its roles', async () => {
        const w = world({ funded: false });
        w.registry.grantRole(ADDR, STAFF, 'staff', OWNER, 0);
        await onUpkeepTick(1, w.deps);
        expect(w.registry.roleOf(ADDR, STAFF)).toBe('staff');
        expect(w.events.filter((e) => e.type === 'zoning.role_revoked')).toHaveLength(0);
    });
});

describe('upkeep — a period is counted in ticks the Grid has run, across restarts', () => {
    it('a restart does not postpone the next period', async () => {
        const first = world({ funded: true });
        await onUpkeepTick(1, first.deps);                       // paid at lifetime tick 1
        expect(first.charge).toHaveBeenCalledTimes(1);

        // The Grid ran 6000 ticks and restarted: its clock counts from 1 again.
        const after = { ...first.deps, ticksBeforeStart: 6000 };
        await onUpkeepTick(UPKEEP_PERIOD_TICKS - 6000, after);   // lifetime 10080: one short
        expect(first.charge).toHaveBeenCalledTimes(1);
        await onUpkeepTick(UPKEEP_PERIOD_TICKS - 5999, after);   // lifetime 10081: a full period
        expect(first.charge).toHaveBeenCalledTimes(2);
    });

    it('a restart does not bring the next period forward either', async () => {
        const first = world({ funded: true });
        await onUpkeepTick(5000, first.deps);
        const after = { ...first.deps, ticksBeforeStart: 5000 };
        for (let tick = 1; tick <= 200; tick++) await onUpkeepTick(tick, after);
        expect(first.charge).toHaveBeenCalledTimes(1);
    });

    it('the stamp is kept in lifetime ticks; the chain and the ledger keep the clock\'s tick', async () => {
        const w = world({ funded: true });
        const deps = { ...w.deps, ticksBeforeStart: 6000 };
        await onUpkeepTick(7, deps);
        expect(w.registry.get(ADDR)!.lastUpkeepTick).toBe(6007);
        expect(w.events.find((e) => e.type === 'treasury.upkeep_collected')!.payload.tick).toBe(7);
        expect((w.charge.mock.calls[0] as unknown as [{ currentTick: number }])[0].currentTick).toBe(7);
    });

    it('ticksRecorded counts the tick events of every earlier run', () => {
        const entries = [
            { eventType: 'grid.started' }, { eventType: 'tick' }, { eventType: 'tick' },
            { eventType: 'grid.stopped' }, { eventType: 'grid.started' }, { eventType: 'tick' },
            { eventType: 'zoning.parcel_purchased' },
        ];
        expect(ticksRecorded(entries)).toBe(3);
        expect(ticksRecorded([])).toBe(0);
    });
});


describe('upkeep — through the store and back: what a restart keeps', () => {
    /** One parcel row kept the way the database keeps it: UPDATEs change it, SELECT returns it. */
    function fakeDatabase() {
        const row: Record<string, unknown> = {
            parcel_id: ADDR, grid_name: 'genesis', zone_id: 'residential', ring: 3, sector_deg: '0',
            level: 0, owner_civic_did: OWNER, price_wei: '400', acquired_at_tick: 0,
            structure_name: null, structure_type: null, visibility: null, built_at_tick: null,
            named_address: null, entry_policy: 'open', entry_allowlist: null, structure_interior: null,
            condition: 'maintained', last_upkeep_tick: null, missed_periods: 0, bound_shop_id: null,
        };
        const query = vi.fn(async (sql: string, params: unknown[] = []) => {
            const flat = sql.replace(/\s+/g, ' ').trim();
            if (/^SELECT \* FROM civic_parcels /.test(flat)) return [[{ ...row }], []];
            if (/^SELECT/.test(flat)) return [[], []];
            const set = /^UPDATE civic_parcels SET (.+) WHERE parcel_id = \?$/.exec(flat);
            if (!set) throw new Error(`fakeDatabase: unexpected statement: ${flat}`);
            if (params[params.length - 1] !== ADDR) throw new Error(`fakeDatabase: wrong row: ${String(params[params.length - 1])}`);
            const cols = set[1].split(',').map((c) => c.trim());
            let i = 0;
            for (const c of cols) {
                const [name, value] = c.split('=').map((x) => x.trim());
                const col = name.replace(/`/g, '');
                if (value === '?') row[col] = params[i++];
                else if (value === 'NULL') row[col] = null;
                else row[col] = /^\d+$/.test(value) ? Number(value) : value.replace(/'/g, '');
            }
            return [{ affectedRows: 1 }, []];
        });
        return { row, pool: { query } as never };
    }

    function depsFor(registry: ParcelRegistry, store: ParcelStore, ticksBeforeStart: number) {
        const events: string[] = [];
        return {
            events,
            deps: {
                registry: createUpkeepRegistryFacade(registry, store),
                audit: { append: (type: string) => { events.push(type); } },
                treasuryDid: TREASURY, gridName: 'genesis', ticksBeforeStart,
                accountStore: { chargeToTreasury: vi.fn(async () => { throw new Error('insufficient_balance'); }) },
            },
        };
    }

    it('a worn parcel is still worn after a restart, and its period runs on', async () => {
        const db = fakeDatabase();
        const store = new ParcelStore(db.pool, 'genesis');

        // First run: the owner cannot pay at tick 1 and the parcel slips to worn.
        const first = new ParcelRegistry('genesis');
        await store.hydrate(first);
        await onUpkeepTick(1, depsFor(first, store, 0).deps);
        expect(first.get(ADDR)!.condition).toBe('worn');
        expect(db.row).toMatchObject({ condition: 'worn', missed_periods: 1, last_upkeep_tick: 1 });

        // The Grid ran 6000 ticks, stopped and started again: a fresh registry, hydrated.
        const second = new ParcelRegistry('genesis');
        await store.hydrate(second);
        expect(second.get(ADDR)!).toMatchObject({ condition: 'worn', missedPeriods: 1, lastUpkeepTick: 1 });

        const run2 = depsFor(second, store, 6000);
        await onUpkeepTick(UPKEEP_PERIOD_TICKS - 6000, run2.deps);    // lifetime 10080: one short
        expect(second.get(ADDR)!.condition).toBe('worn');
        await onUpkeepTick(UPKEEP_PERIOD_TICKS - 5999, run2.deps);    // lifetime 10081: the next period
        expect(second.get(ADDR)!.condition).toBe('derelict');
        expect(db.row).toMatchObject({ condition: 'derelict', missed_periods: 2, last_upkeep_tick: 10081 });
    });

    it('a reclaim writes one statement and leaves the row ownerless and maintained', async () => {
        const db = fakeDatabase();
        Object.assign(db.row, { condition: 'derelict', missed_periods: 2, last_upkeep_tick: 1 });
        const store = new ParcelStore(db.pool, 'genesis');
        const registry = new ParcelRegistry('genesis');
        await store.hydrate(registry);
        const before = (db.pool as unknown as { query: ReturnType<typeof vi.fn> }).query.mock.calls.length;

        await onUpkeepTick(1 + UPKEEP_PERIOD_TICKS, depsFor(registry, store, 0).deps);

        const writes = (db.pool as unknown as { query: ReturnType<typeof vi.fn> }).query.mock.calls.length - before;
        expect(writes).toBe(1);
        expect(db.row).toMatchObject({ owner_civic_did: null, condition: 'maintained', missed_periods: 0, last_upkeep_tick: null });
    });
});

describe('upkeep — the sweep survives what goes wrong around it', () => {
    it('a stamp ahead of the lifetime count restarts the period: no charge, no decay, and a warning', async () => {
        const w = world({ funded: false });
        w.registry.stampUpkeep(ADDR, 500_000);                    // written when the chain was longer
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        await onUpkeepTick(10, { ...w.deps, ticksBeforeStart: 100 });
        expect(w.charge).not.toHaveBeenCalled();
        expect(w.registry.get(ADDR)!).toMatchObject({ lastUpkeepTick: 110, condition: 'maintained', missedPeriods: 0 });
        expect(warn.mock.calls.some((c) => String(c[0]).includes('upkeep_stamp_ahead'))).toBe(true);
        // From there a period is a period again.
        await onUpkeepTick(10 + UPKEEP_PERIOD_TICKS, { ...w.deps, ticksBeforeStart: 100 });
        expect(w.registry.get(ADDR)!.condition).toBe('worn');
        warn.mockRestore();
    });

    it('a ladder write that fails does not reject out of the sweep, and memory keeps the rung', async () => {
        const w = world({ funded: false });
        w.store.persistUpkeep.mockRejectedValue(new Error('db down'));
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        await expect(onUpkeepTick(1, w.deps)).resolves.toBeUndefined();
        expect(w.registry.get(ADDR)!).toMatchObject({ condition: 'worn', lastUpkeepTick: 1 });
        for (let tick = 2; tick <= 20; tick++) await onUpkeepTick(tick, w.deps);     // not assessed again
        expect(w.registry.get(ADDR)!.condition).toBe('worn');
        expect(warn.mock.calls.filter((c) => String(c[0]).includes('ladder_persist_failed'))).toHaveLength(1);
        warn.mockRestore();
    });

    it('a reclaim the database refuses does not happen, and is tried again on the next tick', async () => {
        const w = world({ funded: false });
        const T3 = 1 + 2 * UPKEEP_PERIOD_TICKS;
        await onUpkeepTick(1, w.deps);
        await onUpkeepTick(1 + UPKEEP_PERIOD_TICKS, w.deps);
        w.store.persistReclaim.mockRejectedValueOnce(new Error('db down'));
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await expect(onUpkeepTick(T3, w.deps)).resolves.toBeUndefined();
        // Nothing moved: same owner, same rung, nothing on the chain.
        expect(w.registry.get(ADDR)!).toMatchObject({ ownerDid: OWNER, condition: 'derelict', missedPeriods: 2 });
        expect(w.events.filter((e) => e.type === 'zoning.parcel_reclaimed')).toHaveLength(0);
        expect(warn.mock.calls.some((c) => String(c[0]).includes('reclaim_persist_failed'))).toBe(true);

        await onUpkeepTick(T3 + 1, w.deps);                      // the database is back
        expect(w.registry.get(ADDR)!.ownerDid).toBeNull();
        expect(w.events.filter((e) => e.type === 'zoning.parcel_reclaimed')).toHaveLength(1);
        expect(w.store.persistReclaim).toHaveBeenCalledTimes(2);
        warn.mockRestore();
    });
});
