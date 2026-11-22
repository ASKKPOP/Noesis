/**
 * Debts and tasks are saved.
 *
 * The ledger of IOUs and the task board lived in memory only: the store had the writers
 * (persistIou / persistCowork) and nothing called them, so a posted task, a task already
 * taken and every debt were gone after a Grid restart, and "work already taken is owed"
 * held only as long as the process ran. These tests run the real routes against a real
 * ParcelStore over a small fake of the two tables, then "restart": the module-level board
 * and ledger are emptied and loaded again from what was stored.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { AuditChain } from '../../src/audit/chain.js';
import { ParcelRegistry } from '../../src/civic/parcel-registry.js';
import { ParcelStore } from '../../src/civic/parcel-store.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { registerCivicParcelRoutes } from '../../src/api/routes/civic-parcels.js';
import { makeCivicDb } from '../helpers/civic-db.js';
import { _resetCowork, getAgreement, allAgreements } from '../../src/civic/cowork.js';
import { _resetLedger, allIous, outstandingFor } from '../../src/civic/credit-ledger.js';
import { MIGRATIONS } from '../../src/db/schema.js';
import type { GridServices } from '../../src/api/server.js';
import type { DIDContext } from '../../src/api/preHandlers/types.js';
import '../../src/api/preHandlers/types.js';

const ALICE = 'did:civic:noesis:alice';
const BOB = 'did:civic:noesis:bob';
const CAROL = 'did:civic:noesis:carol';
const SHOP = 'genesis:shopping:0001';      // alice's
const SHOP2 = 'genesis:shopping:0002';     // bob's
const TICK = 7;

function seededRegistry(): ParcelRegistry {
    const registry = new ParcelRegistry('genesis');
    registry.seedZone({ zoneId: 'shopping', count: 4, priceWei: 400, ring: 2 });
    registry.purchase(SHOP, ALICE, 100_000);
    registry.purchase(SHOP2, BOB, 100_000);
    return registry;
}

function buildApp(balances: { alice: number; bob: number }) {
    const audit = new AuditChain();
    const registry = seededRegistry();
    const tables = makeCivicDb();
    const store = new ParcelStore(tables.pool, 'genesis');
    const accts = tables.accts;
    accts.seedAccount(ALICE, balances.alice);
    accts.seedAccount(BOB, balances.bob);
    accts.seedAccount(CAROL, 0);
    let ctx: DIDContext | null = { did: ALICE, tier: 'civic_member' };
    const app = Fastify({ logger: false });
    app.addHook('onRequest', async (req) => {
        const own = req.headers['x-test-did'];
        (req as never as { didContext: DIDContext | null }).didContext =
            typeof own === 'string' ? { did: own, tier: 'civic_member' } : ctx;
    });
    registerCivicParcelRoutes(app, {
        parcels: { registry, store }, registry: new NousRegistry(), audit,
        pool: tables.pool, gridName: 'genesis', currentTick: () => TICK,
    } as unknown as GridServices);
    const as = (did: string) => { ctx = { did, tier: 'civic_member' }; };
    const post = (url: string, payload: Record<string, unknown>) => app.inject({ method: 'POST', url, payload });
    /** A request that carries its own caller, for requests made at the same time. */
    const inject = (did: string, url: string, payload: Record<string, unknown>) =>
        app.inject({ method: 'POST', url, payload, headers: { 'x-test-did': did } });
    /** A Grid restart, as far as the board and the ledger go: emptied, then loaded from the tables. */
    const restart = async () => {
        _resetCowork();
        _resetLedger();
        await store.hydrate(seededRegistry());
    };
    return { audit, registry, store, tables, accts, as, post, inject, restart };
}

let h: ReturnType<typeof buildApp>;
beforeEach(() => {
    _resetCowork();
    _resetLedger();
    h = buildApp({ alice: 100_000, bob: 100_000 });
});

/** Alice posts on her shop, Bob (her staff) takes it. Returns the task id. */
async function postedAndTaken(pay = 50): Promise<string> {
    h.as(ALICE);
    await h.post(`/api/v1/civic/parcels/${SHOP}/roles`, { holder_civic_did: BOB, role: 'staff' });
    const task = (await h.post(`/api/v1/civic/parcels/${SHOP}/board/post`, { task_ref: 'clean', pay_bios: pay })).json().task_id as string;
    h.as(BOB);
    expect((await h.post(`/api/v1/civic/parcels/${SHOP}/board/claim`, { task_id: task })).statusCode).toBe(200);
    return task;
}

describe('tasks are saved — a restart keeps the board', () => {
    it('a posted task is still on the board after a restart, and can be taken', async () => {
        await h.post(`/api/v1/civic/parcels/${SHOP}/roles`, { holder_civic_did: BOB, role: 'staff' });
        const task = (await h.post(`/api/v1/civic/parcels/${SHOP}/board/post`, { task_ref: 'clean', pay_bios: 50 })).json().task_id;
        expect(h.tables.task(task)).toMatchObject({ parcel_id: SHOP, host_civic_did: ALICE, worker_civic_did: null, status: 'posted', created_tick: TICK });
        await h.restart();
        expect(getAgreement(task)).toMatchObject({ parcel_id: SHOP, status: 'posted', settlement_amount_wei: 50 });
        h.as(BOB);
        expect((await h.post(`/api/v1/civic/parcels/${SHOP}/board/claim`, { task_id: task })).statusCode).toBe(200);
    });

    it('work already taken is still owed after a restart: it can be finished, and it pays', async () => {
        const task = await postedAndTaken(50);
        expect(h.tables.task(task)).toMatchObject({ worker_civic_did: BOB, status: 'claimed' });
        await h.restart();
        expect(getAgreement(task)).toMatchObject({ status: 'claimed', parties: [ALICE, BOB] });
        h.as(ALICE);
        const before = h.accts.balanceOf(BOB);
        expect((await h.post(`/api/v1/civic/parcels/${SHOP}/board/complete`, { task_id: task })).statusCode).toBe(200);
        expect(h.accts.balanceOf(BOB)).toBe(before + 50n);
    });

    it('a finished task stays finished after a restart: it cannot be paid twice', async () => {
        const task = await postedAndTaken(50);
        h.as(ALICE);
        await h.post(`/api/v1/civic/parcels/${SHOP}/board/complete`, { task_id: task });
        expect(h.tables.task(task)).toMatchObject({ status: 'completed', completed_tick: TICK });
        await h.restart();
        const before = h.accts.balanceOf(BOB);
        const again = await h.post(`/api/v1/civic/parcels/${SHOP}/board/complete`, { task_id: task });
        expect(again.statusCode).toBe(409);
        expect(h.accts.balanceOf(BOB)).toBe(before);
    });

    it('a task posted after a restart does not take the id of one posted before it', async () => {
        const first = (await h.post(`/api/v1/civic/parcels/${SHOP}/board/post`, { task_ref: 'one', pay_bios: 5 })).json().task_id;
        const second = (await h.post(`/api/v1/civic/parcels/${SHOP}/board/post`, { task_ref: 'two', pay_bios: 6 })).json().task_id;
        await h.restart();
        const third = (await h.post(`/api/v1/civic/parcels/${SHOP}/board/post`, { task_ref: 'three', pay_bios: 7 })).json().task_id;
        expect(new Set([first, second, third]).size).toBe(3);
        expect(h.tables.task(first)).toMatchObject({ scope_ref: 'one' });
        expect(h.tables.task(third)).toMatchObject({ scope_ref: 'three' });
        expect(allAgreements()).toHaveLength(3);
    });
});

describe('debts are saved — a restart keeps the ledger', () => {
    beforeEach(() => { h = buildApp({ alice: 0, bob: 0 }); });   // nobody can pay: every completion becomes an IOU

    it('a debt from unpaid work is still owed after a restart', async () => {
        const task = await postedAndTaken(50);
        h.as(ALICE);
        expect((await h.post(`/api/v1/civic/parcels/${SHOP}/board/complete`, { task_id: task })).statusCode).toBe(200);
        expect(outstandingFor(ALICE)).toBe(50);
        expect(h.tables.ious()).toEqual([
            expect.objectContaining({ creditor_civic_did: BOB, debtor_civic_did: ALICE, amount_wei: 50, settled_tick: null, grid_name: 'genesis' }),
        ]);
        await h.restart();
        expect(outstandingFor(ALICE)).toBe(50);
        expect(allIous()).toHaveLength(1);
    });

    it('two debts that cancel are saved as they stand after the netting', async () => {
        const first = await postedAndTaken(50);                       // alice will owe bob 50
        h.as(ALICE);
        await h.post(`/api/v1/civic/parcels/${SHOP}/board/complete`, { task_id: first });
        h.as(BOB);                                                    // bob posts on his shop, alice takes it
        await h.post(`/api/v1/civic/parcels/${SHOP2}/roles`, { holder_civic_did: ALICE, role: 'guest' });
        const second = (await h.post(`/api/v1/civic/parcels/${SHOP2}/board/post`, { task_ref: 'paint', pay_bios: 30 })).json().task_id;
        h.as(ALICE);
        await h.post(`/api/v1/civic/parcels/${SHOP2}/board/claim`, { task_id: second });
        h.as(BOB);
        expect((await h.post(`/api/v1/civic/parcels/${SHOP2}/board/complete`, { task_id: second })).statusCode).toBe(200);
        expect(outstandingFor(ALICE)).toBe(20);
        expect(outstandingFor(BOB)).toBe(0);
        await h.restart();
        expect(outstandingFor(ALICE)).toBe(20);
        expect(outstandingFor(BOB)).toBe(0);
    });

    it('a debt recorded after a restart does not take the id of one recorded before it', async () => {
        const first = await postedAndTaken(50);
        h.as(ALICE);
        await h.post(`/api/v1/civic/parcels/${SHOP}/board/complete`, { task_id: first });
        await h.restart();
        const second = (await h.post(`/api/v1/civic/parcels/${SHOP}/board/post`, { task_ref: 'again', pay_bios: 10 })).json().task_id;
        h.as(BOB);
        await h.post(`/api/v1/civic/parcels/${SHOP}/board/claim`, { task_id: second });
        h.as(ALICE);
        await h.post(`/api/v1/civic/parcels/${SHOP}/board/complete`, { task_id: second });
        expect(h.tables.ious()).toHaveLength(2);
        expect(outstandingFor(ALICE)).toBe(60);
    });

    it('what a revoke does to the debts between the two is what a restart finds', async () => {
        const task = await postedAndTaken(50);
        h.as(ALICE);
        await h.post(`/api/v1/civic/parcels/${SHOP}/board/complete`, { task_id: task });
        await h.post(`/api/v1/civic/parcels/${SHOP}/roles/revoke`, { holder_civic_did: BOB });
        const inMemory = outstandingFor(ALICE);
        expect(h.tables.ious()[0].settled_tick).toBe(allIous()[0].settled_tick);
        await h.restart();
        expect(outstandingFor(ALICE)).toBe(inMemory);
    });
});

describe('debts and tasks — what goes wrong does not leave memory and the database apart', () => {
    it('a task the database refuses is not posted', async () => {
        h.tables.failNext(/^INSERT INTO civic_cowork_agreements/);
        const res = await h.post(`/api/v1/civic/parcels/${SHOP}/board/post`, { task_ref: 'clean', pay_bios: 50 });
        expect(res.statusCode).toBe(500);
        expect(allAgreements()).toHaveLength(0);
    });

    it('a claim the database refuses does not happen', async () => {
        await h.post(`/api/v1/civic/parcels/${SHOP}/roles`, { holder_civic_did: BOB, role: 'staff' });
        const task = (await h.post(`/api/v1/civic/parcels/${SHOP}/board/post`, { task_ref: 'clean', pay_bios: 50 })).json().task_id;
        h.as(BOB);
        h.tables.failNext(/^UPDATE civic_cowork_agreements SET worker_civic_did/);
        const res = await h.post(`/api/v1/civic/parcels/${SHOP}/board/claim`, { task_id: task });
        expect(res.statusCode).toBe(500);
        expect(getAgreement(task)).toMatchObject({ status: 'posted', parties: [ALICE, ''] });
        expect(h.tables.task(task)).toMatchObject({ status: 'posted', worker_civic_did: null });
    });

    it('of two claims that arrive together one wins, and memory and the database agree on which', async () => {
        await h.post(`/api/v1/civic/parcels/${SHOP}/roles`, { holder_civic_did: BOB, role: 'staff' });
        await h.post(`/api/v1/civic/parcels/${SHOP}/roles`, { holder_civic_did: CAROL, role: 'guest' });
        const task = (await h.post(`/api/v1/civic/parcels/${SHOP}/board/post`, { task_ref: 'clean', pay_bios: 50 })).json().task_id;
        // The first write to reach the database wins there, but its answer comes back late:
        // the loser hears "no" first. Whoever the database chose must be who memory holds.
        const real = h.store.persistClaim.bind(h.store);
        let calls = 0;
        h.store.persistClaim = async (id, worker) => {
            const first = ++calls === 1;
            const won = await real(id, worker);
            if (first) await new Promise((r) => setTimeout(r, 30));
            return won;
        };
        const claimAs = (did: string) => h.inject(did, `/api/v1/civic/parcels/${SHOP}/board/claim`, { task_id: task });
        const [b, c] = await Promise.all([claimAs(BOB), claimAs(CAROL)]);
        expect([b.statusCode, c.statusCode].sort()).toEqual([200, 409]);
        const inDatabase = h.tables.task(task)!.worker_civic_did;
        expect(h.tables.task(task)!.status).toBe('claimed');
        expect(getAgreement(task)!.parties[1]).toBe(inDatabase);
        expect(inDatabase).toBe(b.statusCode === 200 ? BOB : CAROL);
    });

    it('a completion the database cannot take moves no money, and the task can still be finished once', async () => {
        const task = await postedAndTaken(50);
        h.as(ALICE);
        const before = h.accts.balanceOf(BOB);
        h.tables.failNext(/^UPDATE civic_cowork_agreements SET status = 'completed'/);
        const failed = await h.post(`/api/v1/civic/parcels/${SHOP}/board/complete`, { task_id: task });
        expect(failed.statusCode).not.toBe(200);
        expect(h.accts.balanceOf(BOB)).toBe(before);
        expect(getAgreement(task)!.status).toBe('claimed');
        expect(h.tables.task(task)!.status).toBe('claimed');
        expect((await h.post(`/api/v1/civic/parcels/${SHOP}/board/complete`, { task_id: task })).statusCode).toBe(200);
        expect(h.accts.balanceOf(BOB)).toBe(before + 50n);
        expect(h.tables.task(task)!.status).toBe('completed');
    });

    it('two completions that arrive together pay once', async () => {
        const task = await postedAndTaken(50);
        const before = h.accts.balanceOf(BOB);
        const complete = () => h.inject(ALICE, `/api/v1/civic/parcels/${SHOP}/board/complete`, { task_id: task });
        const [x, y] = await Promise.all([complete(), complete()]);
        expect([x.statusCode, y.statusCode].sort()).toEqual([200, 409]);
        expect(h.accts.balanceOf(BOB)).toBe(before + 50n);
        expect(h.audit.query({ eventType: 'zoning.cowork_session' })).toHaveLength(1);
    });

    it('a task is paid once, also when the Grid stops between the payment and the answer', async () => {
        const task = await postedAndTaken(50);
        const before = h.accts.balanceOf(BOB);
        // The database has the settlement; the process "dies" before memory hears of it.
        await h.store.settleCowork({ agreementId: task, tick: TICK, pay: { fromDid: ALICE, toDid: BOB, amountWei: 50n } });
        expect(getAgreement(task)!.status).toBe('claimed');
        await h.restart();
        expect(getAgreement(task)!.status).toBe('settled');
        h.as(ALICE);
        expect((await h.post(`/api/v1/civic/parcels/${SHOP}/board/complete`, { task_id: task })).statusCode).toBe(409);
        expect(h.accts.balanceOf(BOB)).toBe(before + 50n);
    });

    it('the database refuses a second settlement even while memory still says claimed', async () => {
        const task = await postedAndTaken(50);
        const before = h.accts.balanceOf(BOB);
        await h.store.settleCowork({ agreementId: task, tick: TICK, pay: { fromDid: ALICE, toDid: BOB, amountWei: 50n } });
        expect(getAgreement(task)!.status).toBe('claimed');           // memory has not heard
        h.as(ALICE);
        const res = await h.post(`/api/v1/civic/parcels/${SHOP}/board/complete`, { task_id: task });
        expect(res.statusCode).toBe(409);
        expect(res.json()).toEqual({ error: 'cowork_not_completable' });
        expect(h.accts.balanceOf(BOB)).toBe(before + 50n);            // paid once, by the first settlement
    });

    it('two completions of unpaid work that arrive together leave one debt, not two', async () => {
        h = buildApp({ alice: 0, bob: 0 });
        const task = await postedAndTaken(50);
        // Hold every attempt to pay until two have arrived (or a moment has passed), so that
        // two completions really are inside the settlement at the same time if both get in.
        const real = h.store.settleCowork.bind(h.store);
        let arrived = 0;
        let open!: () => void;
        const both = new Promise<void>((r) => { open = r; });
        h.store.settleCowork = async (p) => {
            if (p.pay) {
                if (++arrived >= 2) open();
                await Promise.race([both, new Promise((r) => setTimeout(r, 40))]);
            }
            return real(p);
        };
        const complete = () => h.inject(ALICE, `/api/v1/civic/parcels/${SHOP}/board/complete`, { task_id: task });
        const [x, y] = await Promise.all([complete(), complete()]);
        expect([x.statusCode, y.statusCode].sort()).toEqual([200, 409]);
        expect(arrived).toBe(1);                       // the second never got as far as paying
        expect(outstandingFor(ALICE)).toBe(50);
        expect(h.tables.ious()).toHaveLength(1);
    });

    it('a database fault while finishing is a server error, not a refusal', async () => {
        const task = await postedAndTaken(50);
        h.as(ALICE);
        h.tables.failNext(/^UPDATE civic_cowork_agreements SET status = 'completed'/);
        const res = await h.post(`/api/v1/civic/parcels/${SHOP}/board/complete`, { task_id: task });
        expect(res.statusCode).toBe(500);       // was a 409 whose error field carried the fault's own text
        expect(res.json().error).not.toBe('db down');
    });

    it('unpaid work whose debt could not be written is forgotten as a whole, not half: after a restart it can be finished again', async () => {
        h = buildApp({ alice: 0, bob: 0 });
        const task = await postedAndTaken(50);
        h.as(ALICE);
        h.tables.failNext(/^INSERT INTO civic_credit_ledger/);
        expect((await h.post(`/api/v1/civic/parcels/${SHOP}/board/complete`, { task_id: task })).statusCode).toBe(200);
        expect(h.tables.task(task)!.status).toBe('claimed');          // rolled back with the debt
        expect(h.tables.ious()).toHaveLength(0);
        // Nothing durable says the work was done, so no session and no saved trust yet.
        expect(h.audit.query({ eventType: 'zoning.cowork_session' })).toHaveLength(0);
        expect(h.tables.role(SHOP, BOB)!.trust_score).toBe(0);
        await h.restart();
        expect(getAgreement(task)!.status).toBe('claimed');
        expect(outstandingFor(ALICE)).toBe(0);
        expect((await h.post(`/api/v1/civic/parcels/${SHOP}/board/complete`, { task_id: task })).statusCode).toBe(200);
        expect(outstandingFor(ALICE)).toBe(50);
        expect(h.tables.task(task)!.status).toBe('completed');
        expect(h.tables.ious()).toHaveLength(1);
        expect(h.audit.query({ eventType: 'zoning.cowork_session' })).toHaveLength(1);    // once
    });

    it('a pay too large to be a whole number the database can hold is refused', async () => {
        const res = await h.post(`/api/v1/civic/parcels/${SHOP}/board/post`, { task_ref: 'clean', pay_bios: 1e30 });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toEqual({ error: 'invalid_pay_bios' });
    });

    it('a task text the database cannot hold is refused before anything is written', async () => {
        const res = await h.post(`/api/v1/civic/parcels/${SHOP}/board/post`, { task_ref: 'x'.repeat(256), pay_bios: 50 });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toEqual({ error: 'invalid_task_ref' });
        expect(allAgreements()).toHaveLength(0);
        expect((await h.post(`/api/v1/civic/parcels/${SHOP}/board/post`, { task_ref: 'x'.repeat(255), pay_bios: 50 })).statusCode).toBe(200);
    });
});

describe('ids are unique per Grid, not per database', () => {
    it('another Grid in the same database writing the same id does not touch this Grid\'s rows', async () => {
        const task = await postedAndTaken(50);
        const other = new ParcelStore(h.tables.pool, 'elsewhere');
        await other.persistCowork(
            { agreement_id: task, parcel_id: 'elsewhere:shopping:0001', parties: ['did:civic:noesis:x', ''], scope_ref: 'theirs', settlement_amount_wei: 1, term_ticks: 0, status: 'posted' },
            { created: 1 },
        );
        expect(h.tables.task(task)).toMatchObject({ host_civic_did: ALICE, status: 'claimed' });
        expect(h.tables.task(task, 'elsewhere')).toMatchObject({ scope_ref: 'theirs', status: 'posted' });
    });

    it('migration 79 keys both tables by Grid and id, and can be undone', () => {
        const m = MIGRATIONS.find((x) => x.version === 79);
        expect(m?.name).toBe('civic_ledger_and_cowork_keys_per_grid');
        const up = m!.up.replace(/\s+/g, ' ');
        expect(up).toContain('ALTER TABLE civic_credit_ledger DROP PRIMARY KEY, ADD PRIMARY KEY (grid_name, iou_id)');
        expect(up).toContain('ALTER TABLE civic_cowork_agreements DROP PRIMARY KEY, ADD PRIMARY KEY (grid_name, agreement_id)');
        const down = m!.down.replace(/\s+/g, ' ');
        expect(down).toContain('ALTER TABLE civic_credit_ledger DROP PRIMARY KEY, ADD PRIMARY KEY (iou_id)');
        expect(down).toContain('ALTER TABLE civic_cowork_agreements DROP PRIMARY KEY, ADD PRIMARY KEY (agreement_id)');
        const sorted = [...MIGRATIONS].sort((a, b) => a.version - b.version);
        expect(sorted[sorted.length - 1].version).toBe(79);
        sorted.forEach((x, i) => expect(x.version).toBe(i + 1));
    });
});
