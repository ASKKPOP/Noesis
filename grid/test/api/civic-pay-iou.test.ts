/**
 * A debt can be paid.
 *
 * The ledger remembered what was owed and gave the debtor no way to pay it: a debt ended
 * only when an opposite debt cancelled it or when a role was removed. These tests run the
 * real routes against a real ParcelStore over the shared fake database.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import { AuditChain } from '../../src/audit/chain.js';
import { ParcelRegistry } from '../../src/civic/parcel-registry.js';
import { ParcelStore } from '../../src/civic/parcel-store.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { registerCivicParcelRoutes, withLedger } from '../../src/api/routes/civic-parcels.js';
import { MIGRATIONS } from '../../src/db/schema.js';
import { ROUTE_DID_POLICY } from '../../src/api/policy.js';
import { makeCivicDb } from '../helpers/civic-db.js';
import { _resetCowork } from '../../src/civic/cowork.js';
import { _resetLedger, allIous, outstandingFor } from '../../src/civic/credit-ledger.js';
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

function buildApp() {
    const audit = new AuditChain();
    const registry = seededRegistry();
    const db = makeCivicDb();
    const store = new ParcelStore(db.pool, 'genesis');
    const app = Fastify({ logger: false });
    app.addHook('onRequest', async (req) => {
        const did = req.headers['x-test-did'];
        (req as never as { didContext: DIDContext | null }).didContext =
            typeof did === 'string' ? { did, tier: 'civic_member' } : null;
    });
    registerCivicParcelRoutes(app, {
        parcels: { registry, store }, registry: new NousRegistry(), audit,
        pool: db.pool, gridName: 'genesis', currentTick: () => TICK,
    } as unknown as GridServices);
    const post = (did: string, url: string, payload: Record<string, unknown> = {}) =>
        app.inject({ method: 'POST', url, payload, headers: { 'x-test-did': did } });
    const get = (did: string, url: string) => app.inject({ method: 'GET', url, headers: { 'x-test-did': did } });
    const restart = async () => {
        _resetCowork();
        _resetLedger();
        await store.hydrate(seededRegistry());
    };
    return { audit, registry, store, db, post, get, restart };
}

let h: ReturnType<typeof buildApp>;
beforeEach(() => {
    _resetCowork();
    _resetLedger();
    h = buildApp();
});

/** Alice posts on her shop, Bob takes it, Alice cannot pay: Alice owes Bob `amount`. Returns the debt's id. */
async function aliceOwesBob(amount = 50): Promise<string> {
    await h.post(ALICE, `/api/v1/civic/parcels/${SHOP}/roles`, { holder_civic_did: BOB, role: 'staff' });
    const task = (await h.post(ALICE, `/api/v1/civic/parcels/${SHOP}/board/post`, { task_ref: 'clean', pay_bios: amount })).json().task_id;
    await h.post(BOB, `/api/v1/civic/parcels/${SHOP}/board/claim`, { task_id: task });
    expect((await h.post(ALICE, `/api/v1/civic/parcels/${SHOP}/board/complete`, { task_id: task })).statusCode).toBe(200);
    const debt = allIous().find((e) => e.debtor_civic_did === ALICE && e.settled_tick === null);
    expect(debt?.amount_wei).toBe(amount);
    return debt!.iou_id;
}

describe('a mind can see what it owes and what it is owed', () => {
    it('the debtor sees the debt as owed by it, the creditor as owed to it, and nobody else sees it', async () => {
        const id = await aliceOwesBob(50);
        expect((await h.get(ALICE, '/api/v1/civic/ious')).json()).toEqual({
            i_owe: [{ iou_id: id, counterparty_civic_did: BOB, amount_wei: 50, created_tick: TICK }],
            owed_to_me: [],
        });
        expect((await h.get(BOB, '/api/v1/civic/ious')).json()).toEqual({
            i_owe: [],
            owed_to_me: [{ iou_id: id, counterparty_civic_did: ALICE, amount_wei: 50, created_tick: TICK }],
        });
        expect((await h.get(CAROL, '/api/v1/civic/ious')).json()).toEqual({ i_owe: [], owed_to_me: [] });
    });

    it('a caller without a civic identity is refused', async () => {
        const res = await h.get('', '/api/v1/civic/ious');
        expect(res.statusCode).toBe(401);
    });

    it('both routes are in the policy table as civic-only', () => {
        expect(ROUTE_DID_POLICY['GET /api/v1/civic/ious']).toBe('civic_did_required');
        expect(ROUTE_DID_POLICY['POST /api/v1/civic/ious/:id/pay']).toBe('civic_did_required');
    });
});

describe('a debtor can pay a debt', () => {
    it('paying moves the money to the creditor and ends the debt, in memory and in the database', async () => {
        const id = await aliceOwesBob(50);
        h.db.accts.seedAccount(ALICE, 80);
        const bobBefore = h.db.accts.balanceOf(BOB);
        const res = await h.post(ALICE, `/api/v1/civic/ious/${id}/pay`);
        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({ paid: true, iou_id: id, amount_wei: 50 });
        expect(h.db.accts.balanceOf(ALICE)).toBe(30n);
        expect(h.db.accts.balanceOf(BOB)).toBe(bobBefore + 50n);
        expect(outstandingFor(ALICE)).toBe(0);
        expect(h.db.iou(id)).toMatchObject({ settled_tick: TICK, paid_tick: TICK, amount_wei: 50 });
        expect((await h.get(ALICE, '/api/v1/civic/ious')).json()).toEqual({ i_owe: [], owed_to_me: [] });
    });

    it('a paid debt stays paid after a restart', async () => {
        const id = await aliceOwesBob(50);
        h.db.accts.seedAccount(ALICE, 80);
        await h.post(ALICE, `/api/v1/civic/ious/${id}/pay`);
        await h.restart();
        expect(outstandingFor(ALICE)).toBe(0);
        expect((await h.post(ALICE, `/api/v1/civic/ious/${id}/pay`)).statusCode).toBe(409);
        expect(h.db.accts.balanceOf(ALICE)).toBe(30n);
    });

    it('a debtor who cannot cover it pays nothing, and the debt stands', async () => {
        const id = await aliceOwesBob(50);
        h.db.accts.seedAccount(ALICE, 49);
        const res = await h.post(ALICE, `/api/v1/civic/ious/${id}/pay`);
        expect(res.statusCode).toBe(402);
        expect(res.json()).toEqual({ error: 'insufficient_funds' });
        expect(h.db.accts.balanceOf(ALICE)).toBe(49n);
        expect(outstandingFor(ALICE)).toBe(50);
        expect(h.db.iou(id)!.settled_tick).toBeNull();
    });

    it('only the debtor can pay: the creditor is refused, anyone else is told there is no such debt', async () => {
        const id = await aliceOwesBob(50);
        h.db.accts.seedAccount(BOB, 500);
        h.db.accts.seedAccount(CAROL, 500);
        expect((await h.post(BOB, `/api/v1/civic/ious/${id}/pay`)).statusCode).toBe(403);
        expect((await h.post(CAROL, `/api/v1/civic/ious/${id}/pay`)).statusCode).toBe(404);
        expect((await h.post(ALICE, '/api/v1/civic/ious/iou:999/pay')).statusCode).toBe(404);
        expect((await h.post(ALICE, '/api/v1/civic/ious/not-an-id/pay')).statusCode).toBe(400);
        expect(outstandingFor(ALICE)).toBe(50);
        expect(h.db.accts.balanceOf(CAROL)).toBe(500n);
    });

    it('a debt is paid once: a second payment is refused and moves nothing', async () => {
        const id = await aliceOwesBob(50);
        h.db.accts.seedAccount(ALICE, 500);
        const [x, y] = await Promise.all([h.post(ALICE, `/api/v1/civic/ious/${id}/pay`), h.post(ALICE, `/api/v1/civic/ious/${id}/pay`)]);
        expect([x.statusCode, y.statusCode].sort()).toEqual([200, 409]);
        expect(h.db.accts.balanceOf(ALICE)).toBe(450n);
        expect((await h.post(ALICE, `/api/v1/civic/ious/${id}/pay`)).statusCode).toBe(409);
        expect(h.db.accts.balanceOf(ALICE)).toBe(450n);
    });

    it('a payment the database cannot take moves nothing, and can be made afterwards', async () => {
        const id = await aliceOwesBob(50);
        h.db.accts.seedAccount(ALICE, 80);
        h.db.failNext(/^UPDATE civic_credit_ledger SET settled_tick/);
        expect((await h.post(ALICE, `/api/v1/civic/ious/${id}/pay`)).statusCode).toBe(500);
        expect(h.db.accts.balanceOf(ALICE)).toBe(80n);
        expect(outstandingFor(ALICE)).toBe(50);
        expect(h.db.iou(id)!.settled_tick).toBeNull();
        expect((await h.post(ALICE, `/api/v1/civic/ious/${id}/pay`)).statusCode).toBe(200);
        expect(h.db.accts.balanceOf(ALICE)).toBe(30n);
    });

    it('the database refuses a payment for a debt it holds differently, even when memory would allow it', async () => {
        const id = await aliceOwesBob(50);
        h.db.accts.seedAccount(ALICE, 80);
        h.db.iou(id)!.settled_tick = 3;                       // the database already has it settled
        const res = await h.post(ALICE, `/api/v1/civic/ious/${id}/pay`);
        expect(res.statusCode).toBe(409);
        expect(h.db.accts.balanceOf(ALICE)).toBe(80n);
    });

    it('a payment whose answer from the database is lost still counts: memory learns it was paid', async () => {
        const id = await aliceOwesBob(50);
        h.db.accts.seedAccount(ALICE, 80);
        h.db.loseNextCommitAnswer();
        const res = await h.post(ALICE, `/api/v1/civic/ious/${id}/pay`);
        expect(res.statusCode).toBe(200);
        expect(h.db.accts.balanceOf(ALICE)).toBe(30n);
        expect(outstandingFor(ALICE)).toBe(0);
        expect(h.db.iou(id)).toMatchObject({ settled_tick: TICK, paid_tick: TICK });
        expect((await h.post(ALICE, `/api/v1/civic/ious/${id}/pay`)).statusCode).toBe(409);
        expect(h.db.accts.balanceOf(ALICE)).toBe(30n);
    });

    it('when the answer was lost and the database could not be asked, the next attempt finds out it was paid', async () => {
        const id = await aliceOwesBob(50);
        h.db.accts.seedAccount(ALICE, 80);
        h.db.loseNextCommitAnswer();
        h.db.failNext(/^SELECT paid_tick FROM civic_credit_ledger/);
        expect((await h.post(ALICE, `/api/v1/civic/ious/${id}/pay`)).statusCode).toBe(500);
        expect(h.db.accts.balanceOf(ALICE)).toBe(30n);             // it was paid
        expect(outstandingFor(ALICE)).toBe(50);                    // and memory does not know yet
        const again = await h.post(ALICE, `/api/v1/civic/ious/${id}/pay`);
        expect(again.statusCode).toBe(409);
        expect(again.json()).toEqual({ error: 'iou_already_settled' });
        expect(outstandingFor(ALICE)).toBe(0);                     // now it does
        expect(h.db.accts.balanceOf(ALICE)).toBe(30n);             // and nothing was paid twice
    });

    it('the money goes only to the creditor the database names', async () => {
        const id = await aliceOwesBob(50);
        h.db.accts.seedAccount(ALICE, 80);
        h.db.iou(id)!.creditor_civic_did = CAROL;             // the row and memory disagree on who is owed
        const res = await h.post(ALICE, `/api/v1/civic/ious/${id}/pay`);
        expect(res.statusCode).toBe(409);
        expect(h.db.accts.balanceOf(ALICE)).toBe(80n);
        expect(h.db.accts.balanceOf(BOB)).toBe(0n);
        expect(h.db.accts.balanceOf(CAROL)).toBe(0n);
    });

    it('a debt closed by removing a role is not a paid debt, and cannot be paid afterwards', async () => {
        const id = await aliceOwesBob(50);
        h.db.accts.seedAccount(ALICE, 80);
        await h.post(ALICE, `/api/v1/civic/parcels/${SHOP}/roles/revoke`, { holder_civic_did: BOB });
        expect(h.db.iou(id)).toMatchObject({ settled_tick: TICK, paid_tick: null });
        expect((await h.post(ALICE, `/api/v1/civic/ious/${id}/pay`)).statusCode).toBe(409);
        expect(h.db.accts.balanceOf(ALICE)).toBe(80n);
    });

    it('paying emits nothing on the chain: a debt is bookkeeping between two', async () => {
        const id = await aliceOwesBob(50);
        h.db.accts.seedAccount(ALICE, 80);
        const before = h.audit.length;
        await h.post(ALICE, `/api/v1/civic/ious/${id}/pay`);
        expect(h.audit.length).toBe(before);
    });
});

describe('paying a debt and a debt changing at the same moment', () => {
    it('a payment waits for unpaid work that is cancelling part of the same debt, then pays what is left', async () => {
        const id = await aliceOwesBob(50);                                    // alice owes bob 50
        await h.post(BOB, `/api/v1/civic/parcels/${SHOP2}/roles`, { holder_civic_did: ALICE, role: 'guest' });
        const task = (await h.post(BOB, `/api/v1/civic/parcels/${SHOP2}/board/post`, { task_ref: 'paint', pay_bios: 30 })).json().task_id;
        await h.post(ALICE, `/api/v1/civic/parcels/${SHOP2}/board/claim`, { task_id: task });
        h.db.accts.seedAccount(ALICE, 80);
        // Hold bob's unpaid completion at the moment it is about to save the netted debts.
        const real = h.store.settleCowork.bind(h.store);
        let release!: () => void;
        const held = new Promise<void>((r) => { release = r; });
        let holding = false;
        h.store.settleCowork = async (p) => {
            if (!p.pay) { holding = true; await held; }
            return real(p);
        };
        const completion = h.post(BOB, `/api/v1/civic/parcels/${SHOP2}/board/complete`, { task_id: task });
        while (!holding) await new Promise((r) => setTimeout(r, 1));
        // In memory the debt is already 20; the database still says 50.
        const payment = h.post(ALICE, `/api/v1/civic/ious/${id}/pay`);
        await new Promise((r) => setTimeout(r, 20));
        release();
        const [c, p] = await Promise.all([completion, payment]);
        expect(c.statusCode).toBe(200);
        expect(p.statusCode).toBe(200);
        expect(p.json()).toMatchObject({ paid: true, amount_wei: 20 });
        expect(h.db.accts.balanceOf(ALICE)).toBe(60n);
        expect(outstandingFor(ALICE)).toBe(0);
        expect(outstandingFor(BOB)).toBe(0);
        expect(h.db.iou(id)).toMatchObject({ amount_wei: 20, settled_tick: TICK });
        await h.restart();
        expect(outstandingFor(ALICE)).toBe(0);
        expect(outstandingFor(BOB)).toBe(0);
    });
});

describe('the ledger lock', () => {
    it('runs one step at a time, in order', async () => {
        const order: string[] = [];
        let finishFirst!: () => void;
        const first = withLedger(() => new Promise<void>((r) => { finishFirst = () => { order.push('first done'); r(); }; }));
        const second = withLedger(async () => { order.push('second ran'); });
        await new Promise((r) => setTimeout(r, 10));
        expect(order).toEqual([]);                        // the second is waiting
        finishFirst();
        await Promise.all([first, second]);
        expect(order).toEqual(['first done', 'second ran']);
    });

    it('after one step stalls, the steps queued behind it still take their turns one at a time', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const order: string[] = [];
        void withLedger(() => new Promise<void>(() => {}), 40);                       // stalls for good
        const slow = withLedger(async () => {
            order.push('second starts');
            await new Promise((r) => setTimeout(r, 25));
            order.push('second ends');
        }, 40);
        const last = withLedger(async () => { order.push('third starts'); }, 40);
        await Promise.all([slow, last]);
        // Each waited longer than the limit in the queue; neither may be passed for that.
        expect(order).toEqual(['second starts', 'second ends', 'third starts']);
        warn.mockRestore();
    });

    it('a step that fails does not stop the next', async () => {
        await expect(withLedger(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
        await expect(withLedger(() => { throw new Error('not even a promise'); })).rejects.toThrow('not even a promise');
        await expect(withLedger(async () => 'ok')).resolves.toBe('ok');
    });

    it('a step that never returns stops holding the others after a while, and says so', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        void withLedger(() => new Promise<void>(() => {}), 25);         // never settles
        const started = Date.now();
        await expect(withLedger(async () => 'through')).resolves.toBe('through');
        expect(Date.now() - started).toBeGreaterThanOrEqual(20);
        expect(warn.mock.calls.some((c) => String(c[0]).includes('[ledger]'))).toBe(true);
        warn.mockRestore();
    });
});

describe('migration 80', () => {
    it('adds paid_tick to the ledger, nullable, and can be undone', () => {
        const m = MIGRATIONS.find((x) => x.version === 80);
        expect(m?.name).toBe('civic_credit_ledger_add_paid_tick');
        expect(m!.up).toMatch(/ALTER TABLE civic_credit_ledger ADD COLUMN paid_tick INT UNSIGNED NULL/);
        expect(m!.down).toMatch(/ALTER TABLE civic_credit_ledger DROP COLUMN paid_tick/);
        const sorted = [...MIGRATIONS].sort((a, b) => a.version - b.version);
        sorted.forEach((x, i) => expect(x.version).toBe(i + 1));
    });
});
