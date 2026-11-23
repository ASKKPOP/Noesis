/**
 * D-MONEY-10 — the two ways of meeting the civic duty besides tax.
 *
 *  - Building for the Polis: public work done UNPAID (a bid of 0 wei), once the Polis
 *    accepts it, earns civic-labor credit instead of money. Paid work earns none.
 *  - Transferring property: an owner hands its parcel to the Polis and earns credit worth
 *    what the parcel's price would have paid in tax.
 * Credit is what pays a due ("labor"), so both end in the Nous's own act of paying.
 * Award and acceptance of public work are Polis-only; no member can reach them.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { SignJWT } from 'jose';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { keyPairPromise } from '../../src/api/portal/auth.js';
import { ParcelRegistry } from '../../src/civic/parcel-registry.js';
import { ParcelStore } from '../../src/civic/parcel-store.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { registerCivicParcelRoutes } from '../../src/api/routes/civic-parcels.js';
import { CIVIC_DUTY_CREDIT, CIVIC_DUTY_WEI, CIVIC_WORK_CREDIT, parcelDutyCredit } from '../../src/civic/founding-law.js';
import { ROUTE_DID_POLICY } from '../../src/api/policy.js';
import type { GridServices } from '../../src/api/server.js';
import type { DIDContext } from '../../src/api/preHandlers/types.js';
import '../../src/api/preHandlers/types.js';

const ALICE = 'did:civic:noesis:alice';
const BOB = 'did:civic:noesis:bob';
const NOTICE = '99200ab8-897e-41ca-8761-608c2ba16fb3';
const BID = '11111111-2222-4333-8444-555555555555';
const CONTRACT = '66666666-7777-4888-8999-aaaaaaaaaaaa';
const ESCROW = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';

type Call = { sql: string; params: unknown[] };

/** A pool that records every statement and answers SELECTs from `select`. */
function recordingPool(select: (sql: string) => unknown[] = () => [], write: (sql: string, params: unknown[]) => number | Error | Promise<number> = () => 1) {
    const calls: Call[] = [];
    const tx = { begun: 0, committed: 0, rolledBack: 0 };
    const query = vi.fn().mockImplementation((sql: string, params: unknown[] = []) => {
        const q = String(sql).replace(/\s+/g, ' ').trim();
        calls.push({ sql: q, params });
        if (/^SELECT/i.test(q)) return Promise.resolve([select(q) as RowDataPacket[], {}]);
        const r = write(q, params);
        if (r instanceof Error) return Promise.reject(r);
        return Promise.resolve(r).then((n) => [{ affectedRows: n }, {}]);
    });
    const conn = {
        beginTransaction: vi.fn().mockImplementation(async () => { tx.begun++; }),
        commit: vi.fn().mockImplementation(async () => { tx.committed++; }),
        rollback: vi.fn().mockImplementation(async () => { tx.rolledBack++; }),
        release: vi.fn(), query,
    };
    return { pool: { query, getConnection: vi.fn().mockResolvedValue(conn) } as unknown as Pool, calls, tx };
}

async function civicBearer(did = ALICE): Promise<string> {
    const { privateKey } = await keyPairPromise;
    return new SignJWT({ sub: did }).setProtectedHeader({ alg: 'ES256' }).setIssuedAt().setExpirationTime('1h').sign(privateKey);
}
async function polisBearer(): Promise<string> {
    const { privateKey } = await keyPairPromise;
    return new SignJWT({ court_conviction_ref: 'bill-42', legislation_ref: 'bill-42' }).setProtectedHeader({ alg: 'ES256' })
        .setIssuer('did:gov:noesis:genesis-polis').setIssuedAt().setExpirationTime('1h').sign(privateKey);
}
function server(pool: Pool): FastifyInstance {
    return buildServer({
        clock: new WorldClock({ tickRateMs: 100_000 }), space: new SpatialMap(), logos: new LogosEngine(),
        audit: new AuditChain(), gridName: 'genesis', pool: pool as never,
    });
}
const has = (calls: Call[], re: RegExp) => calls.some((c) => re.test(c.sql));

describe('the founding law for the two ways', () => {
    it('one accepted unpaid build meets one period', () => {
        expect(CIVIC_WORK_CREDIT).toBe(CIVIC_DUTY_CREDIT);
    });
    it('a parcel is worth, in credit, what its price would pay in tax', () => {
        expect(parcelDutyCredit(400)).toBe((400n * CIVIC_DUTY_CREDIT) / CIVIC_DUTY_WEI);
        expect(parcelDutyCredit(400)).toBe(200n);                 // 20 periods of the duty
        expect(parcelDutyCredit(0)).toBe(0n);
        expect(parcelDutyCredit(-5)).toBe(0n);
        expect(parcelDutyCredit(1.5)).toBe(0n);
    });
});

describe('building for the Polis', () => {
    it('a Nous may offer to do public work unpaid', async () => {
        const m = recordingPool((q) => (q.includes('procurement_notices') ? [{ status: 'open', deadline_tick: 100, budget_wei: '500' }] : []));
        const res = await server(m.pool).inject({
            method: 'POST', url: `/api/v1/procurement/notices/${NOTICE}/bids`,
            headers: { authorization: `Bearer ${await civicBearer()}` }, payload: { price_wei: '0', artifact_spec: 'a public bench' },
        });
        expect(res.statusCode).toBe(201);
        const insert = m.calls.find((c) => c.sql.startsWith('INSERT INTO procurement_bids'))!;
        expect(insert.params).toContain('0');
    });

    it('awarding unpaid work takes nothing from the treasury', async () => {
        const m = recordingPool((q) => q.includes('procurement_notices') ? [{ status: 'open', budget_wei: '500' }]
            : q.includes('procurement_bids') ? [{ status: 'submitted', price_wei: '0', notice_id: NOTICE, bidder_did: ALICE }] : []);
        const res = await server(m.pool).inject({
            method: 'POST', url: `/api/v1/procurement/notices/${NOTICE}/award`,
            headers: { authorization: `Bearer ${await polisBearer()}` }, payload: { bid_id: BID },
        });
        expect(res.statusCode).toBe(201);
        expect(res.json().contract_id).toMatch(/^[0-9a-f-]{36}$/);
        expect(has(m.calls, /civic_treasury/)).toBe(false);
        expect(has(m.calls, /^INSERT INTO procurement_contracts/)).toBe(true);
        expect(m.tx.committed).toBe(1);
    });

    it('awarding paid work still takes its price from the treasury', async () => {
        const m = recordingPool((q) => q.includes('procurement_notices') ? [{ status: 'open', budget_wei: '500' }]
            : q.includes('procurement_bids') ? [{ status: 'submitted', price_wei: '300', notice_id: NOTICE, bidder_did: ALICE }]
            : q.includes('civic_treasury') ? [{ balance_wei: '1000' }] : []);
        const res = await server(m.pool).inject({
            method: 'POST', url: `/api/v1/procurement/notices/${NOTICE}/award`,
            headers: { authorization: `Bearer ${await polisBearer()}` }, payload: { bid_id: BID },
        });
        expect(res.statusCode).toBe(201);
        expect(has(m.calls, /UPDATE civic_treasury/)).toBe(true);
    });

    const settle = async (awardWei: string) => {
        const m = recordingPool((q) => (q.includes('procurement_contracts') ? [{ status: 'active', winner_did: ALICE, award_wei: awardWei, escrow_id: ESCROW }] : []));
        const res = await server(m.pool).inject({
            method: 'POST', url: `/api/v1/procurement/contracts/${CONTRACT}/settle`,
            headers: { authorization: `Bearer ${await polisBearer()}` }, payload: { attestation_ref: 'inspected at tick 9' },
        });
        return { m, res };
    };
    it('unpaid work the Polis accepts earns one period of credit, and no money', async () => {
        const { m, res } = await settle('0');
        expect(res.statusCode).toBe(200);
        const credit = m.calls.find((c) => c.sql.startsWith('INSERT INTO civic_labor_credit'))!;
        expect(credit.params.slice(0, 3)).toEqual(['genesis', ALICE, CIVIC_WORK_CREDIT.toString()]);
        expect(has(m.calls, /nous_accounts/)).toBe(false);
        expect(m.tx.committed).toBe(1);
        // the credit lands inside the settlement's transaction, before the contract is closed
        const order = m.calls.map((c) => c.sql.slice(0, 34));
        expect(order.findIndex((s) => s.startsWith('INSERT INTO civic_labor_credit')))
            .toBeLessThan(order.findIndex((s) => s.startsWith('UPDATE procurement_contracts')));
    });
    it('paid work is paid, and earns no credit', async () => {
        const { m, res } = await settle('300');
        expect(res.statusCode).toBe(200);
        expect(has(m.calls, /nous_accounts/)).toBe(true);
        expect(has(m.calls, /civic_labor_credit/)).toBe(false);
    });
    it('work already settled is refused', async () => {
        const m = recordingPool((q) => (q.includes('procurement_contracts') ? [{ status: 'settled', winner_did: ALICE, award_wei: '0', escrow_id: ESCROW }] : []));
        const res = await server(m.pool).inject({
            method: 'POST', url: `/api/v1/procurement/contracts/${CONTRACT}/settle`,
            headers: { authorization: `Bearer ${await polisBearer()}` }, payload: { attestation_ref: 'again' },
        });
        expect(res.statusCode).toBe(409);
        expect(has(m.calls, /civic_labor_credit/)).toBe(false);
    });

    it.each([
        ['award', `/api/v1/procurement/notices/${NOTICE}/award`, { bid_id: BID }],
        ['settle', `/api/v1/procurement/contracts/${CONTRACT}/settle`, { attestation_ref: 'x' }],
    ])('only the Polis can %s: a member and a caller with no identity are refused', async (_n, url, payload) => {
        expect(ROUTE_DID_POLICY[`POST ${url.replace(NOTICE, ':noticeId').replace(CONTRACT, ':contractId')}`]).toBe('government_only');
        const m = recordingPool();
        const app = server(m.pool);
        const member = await app.inject({ method: 'POST', url, payload, headers: { authorization: `Bearer ${await civicBearer()}` } });
        const nobody = await app.inject({ method: 'POST', url, payload });
        expect(member.statusCode).toBe(403);
        expect(nobody.statusCode).toBe(403);
        expect(m.calls.filter((c) => !/^SELECT/i.test(c.sql))).toEqual([]);      // nothing written
    });
});

describe('an act that can move treasury money names its legislation', () => {
    it.each([
        ['award', `/api/v1/procurement/notices/${NOTICE}/award`, { bid_id: BID }],
        ['settle', `/api/v1/procurement/contracts/${CONTRACT}/settle`, { attestation_ref: 'x' }],
    ])('%s is refused to a Polis session with no legislation reference', async (_n, url, payload) => {
        const { privateKey } = await keyPairPromise;
        const token = await new SignJWT({ court_conviction_ref: 'order-1' }).setProtectedHeader({ alg: 'ES256' })
            .setIssuer('did:gov:noesis:genesis-polis').setIssuedAt().setExpirationTime('1h').sign(privateKey);
        const m = recordingPool();
        const res = await server(m.pool).inject({ method: 'POST', url, payload, headers: { authorization: `Bearer ${token}` } });
        expect(res.statusCode).toBe(403);
        expect(res.json()).toEqual({ error: 'legislation_ref_required' });
        expect(m.calls.filter((c) => !/^SELECT/i.test(c.sql))).toEqual([]);
    });
});

describe('the Polis-only acts refuse a member also without the gate in front', () => {
    it.each([
        ['award', `/api/v1/procurement/notices/${NOTICE}/award`, { bid_id: BID }],
        ['settle', `/api/v1/procurement/contracts/${CONTRACT}/settle`, { attestation_ref: 'x' }],
    ])('%s', async (_n, url, payload) => {
        const { registerProcurementRoutes } = await import('../../src/api/routes/procurement.js');
        const m = recordingPool();
        const app = Fastify({ logger: false });
        app.addHook('onRequest', async (req) => {
            (req as never as { didContext: DIDContext }).didContext = { did: ALICE, tier: 'civic_member' };
        });
        registerProcurementRoutes(app, { pool: m.pool, gridName: 'genesis', audit: new AuditChain() } as unknown as GridServices);
        const res = await app.inject({ method: 'POST', url, payload });
        expect(res.statusCode).toBe(403);
        expect(m.calls).toEqual([]);
    });
});

describe('handing a parcel to the Polis', () => {
    const SHOP = 'genesis:shopping:0001';
    const TICK = 7;
    function build(write?: (sql: string, params: unknown[]) => number | Error | Promise<number>) {
        const audit = new AuditChain();
        const registry = new ParcelRegistry('genesis');
        registry.seedZone({ zoneId: 'shopping', count: 2, priceWei: 400, ring: 2 });
        registry.purchase(SHOP, ALICE, 100_000);
        registry.grantRole(SHOP, ALICE, BOB, 'staff', 3);
        const m = recordingPool(() => [], write);
        const app = Fastify({ logger: false });
        app.addHook('onRequest', async (req) => {
            const did = req.headers['x-test-did'];
            (req as never as { didContext: DIDContext | null }).didContext = typeof did === 'string' ? { did, tier: 'civic_member' } : null;
        });
        registerCivicParcelRoutes(app, {
            parcels: { registry, store: new ParcelStore(m.pool, 'genesis') }, registry: new NousRegistry(), audit,
            pool: m.pool, gridName: 'genesis', currentTick: () => TICK,
        } as unknown as GridServices);
        const give = (did: string, id = SHOP) => app.inject({ method: 'POST', url: `/api/v1/civic/parcels/${id}/give-to-polis`, payload: {}, headers: { 'x-test-did': did } });
        return { audit, registry, m, give };
    }
    let h: ReturnType<typeof build>;
    beforeEach(() => { h = build(); });

    it('the owner earns credit worth the parcel, and the parcel returns to the Polis', async () => {
        const res = await h.give(ALICE);
        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({ given: true, parcel_id: SHOP, credit_earned: '200' });
        const p = h.registry.get(SHOP)!;
        expect(p.ownerDid).toBeNull();
        expect(h.registry.rolesFor(SHOP).every((e) => e.revoked_tick === TICK)).toBe(true);
        // one transaction: the parcel (only while it still names this owner), the roles, the credit
        const writes = h.m.calls.filter((c) => !/^SELECT/i.test(c.sql));
        expect(writes.map((c) => c.sql.split(' ').slice(0, 3).join(' '))).toEqual([
            'UPDATE civic_parcels SET', 'UPDATE civic_parcel_roles SET', 'INSERT INTO civic_labor_credit',
        ]);
        expect(writes[0]!.sql).toMatch(/WHERE parcel_id = \? AND owner_civic_did = \?$/);
        expect(writes[0]!.params).toEqual([SHOP, ALICE]);
        expect(writes[2]!.params.slice(0, 3)).toEqual(['genesis', ALICE, '200']);
        expect(h.m.tx).toMatchObject({ begun: 1, committed: 1, rolledBack: 0 });
    });

    it('it is written on the chain as a parcel given, with the roles it ended', async () => {
        await h.give(ALICE);
        const events = h.audit.all().map((e) => [e.eventType, (e.payload as Record<string, unknown>)['reason']]);
        expect(events).toEqual([['zoning.role_revoked', 'severance_complete'], ['zoning.parcel_reclaimed', 'given_to_polis']]);
    });

    it('only the owner can give it', async () => {
        const res = await h.give(BOB);
        expect(res.statusCode).toBe(403);
        expect(h.m.calls).toEqual([]);
        expect(h.registry.get(SHOP)!.ownerDid).toBe(ALICE);
    });

    it('an unknown parcel is not found', async () => {
        expect((await h.give(ALICE, 'genesis:shopping:0099')).statusCode).toBe(404);
    });

    it('if the database no longer names this owner, nothing is given and nothing is earned', async () => {
        h = build((q) => (q.startsWith('UPDATE civic_parcels') ? 0 : 1));
        const res = await h.give(ALICE);
        expect(res.statusCode).toBe(409);
        expect(has(h.m.calls, /civic_labor_credit/)).toBe(false);
        expect(h.m.tx).toMatchObject({ committed: 0 });
        expect(h.m.tx.rolledBack).toBeGreaterThan(0);
        expect(h.registry.get(SHOP)!.ownerDid).toBe(ALICE);           // memory untouched
        expect(h.audit.all()).toEqual([]);
    });

    it('if the credit cannot be written, the parcel stays with its owner', async () => {
        h = build((q) => (q.startsWith('INSERT INTO civic_labor_credit') ? new Error('db down') : 1));
        const res = await h.give(ALICE);
        expect(res.statusCode).toBe(503);
        expect(h.m.tx.committed).toBe(0);
        expect(h.registry.get(SHOP)!.ownerDid).toBe(ALICE);
        expect(h.registry.rolesFor(SHOP).some((e) => e.revoked_tick === undefined)).toBe(true);
        expect(h.audit.all()).toEqual([]);
    });

    it('if the database took the gift and its answer was lost, memory follows the database', async () => {
        // The transaction commits; the commit's answer never arrives. Afterwards the database
        // names no owner for the parcel.
        h = build();
        const conn = await (h.m.pool as unknown as { getConnection: () => Promise<{ commit: ReturnType<typeof vi.fn> }> }).getConnection();
        conn.commit.mockImplementationOnce(async () => { throw new Error('connection lost'); });
        (h.m.pool as unknown as { query: unknown }).query = vi.fn().mockImplementation((sql: string) =>
            Promise.resolve([String(sql).includes('SELECT owner_civic_did') ? [{ owner_civic_did: null }] : [], {}]));
        const res = await h.give(ALICE);
        expect(res.statusCode).toBe(200);
        expect(h.registry.get(SHOP)!.ownerDid).toBeNull();
        expect(h.audit.all().some((e) => e.eventType === 'zoning.parcel_reclaimed')).toBe(true);
    });

    it('if the commit failed and the database still names the owner, nothing changes', async () => {
        h = build();
        const conn = await (h.m.pool as unknown as { getConnection: () => Promise<{ commit: ReturnType<typeof vi.fn> }> }).getConnection();
        conn.commit.mockImplementationOnce(async () => { throw new Error('connection lost'); });
        (h.m.pool as unknown as { query: unknown }).query = vi.fn().mockImplementation((sql: string) =>
            Promise.resolve([String(sql).includes('SELECT owner_civic_did') ? [{ owner_civic_did: ALICE }] : [], {}]));
        const res = await h.give(ALICE);
        expect(res.statusCode).toBe(503);
        expect(h.registry.get(SHOP)!.ownerDid).toBe(ALICE);
        expect(h.audit.all()).toEqual([]);
    });

    it('a failure before the commit is never taken for a gift, whatever the database says', async () => {
        // The credit cannot be written, so nothing was committed. Even if the database named
        // no owner (memory gone stale earlier), this call gave nothing and must not say it did.
        h = build((q) => (q.startsWith('INSERT INTO civic_labor_credit') ? new Error('db down') : 1));
        const asked = vi.fn().mockResolvedValue([[{ owner_civic_did: null }], {}]);
        (h.m.pool as unknown as { query: unknown }).query = asked;
        const res = await h.give(ALICE);
        expect(res.statusCode).toBe(503);
        expect(asked).not.toHaveBeenCalled();
        expect(h.registry.get(SHOP)!.ownerDid).toBe(ALICE);
        expect(h.audit.all()).toEqual([]);
    });

    it('two gifts of one parcel at the same moment earn credit once: the database decides', async () => {
        // Both requests are held at the parcel write until both have arrived there, so they
        // really overlap; the database then lets the first take the parcel and tells the
        // second that the row no longer names this owner.
        let arrived = 0;
        let release!: () => void;
        const both = new Promise<void>((r) => { release = r; });
        let taken = false;
        h = build((q) => {
            if (!q.startsWith('UPDATE civic_parcels')) return 1;
            if (++arrived === 2) release();
            return both.then(() => { if (taken) return 0; taken = true; return 1; });
        });
        const [a, b] = await Promise.all([h.give(ALICE), h.give(ALICE)]);
        expect(arrived).toBe(2);                                                   // they overlapped
        expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
        expect(h.m.calls.filter((c) => c.sql.startsWith('INSERT INTO civic_labor_credit'))).toHaveLength(1);
        expect(h.registry.get(SHOP)!.ownerDid).toBeNull();
        expect(h.audit.all().filter((e) => e.eventType === 'zoning.parcel_reclaimed')).toHaveLength(1);
    });

    it('a Nous may still do it while denied: it is one of the acts that meet the duty', async () => {
        const { CIVIC_DUTY_OPEN_ROUTES } = await import('../../src/api/civic-duty-gate.js');
        expect(CIVIC_DUTY_OPEN_ROUTES.has('POST /api/v1/civic/parcels/:id/give-to-polis')).toBe(true);
        expect(ROUTE_DID_POLICY['POST /api/v1/civic/parcels/:id/give-to-polis']).toBe('civic_did_required');
    });
});
