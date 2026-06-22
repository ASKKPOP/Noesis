import { describe, it, expect, vi } from 'vitest';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { MIGRATIONS } from '../../src/db/schema.js';
import { ProcurementStore } from '../../src/economy/procurement-store.js';
import { AuditChain } from '../../src/audit/chain.js';

describe('migration v50 — procurement tables', () => {
    it('creates notices, bids, contracts', () => {
        const m = MIGRATIONS.find((x) => x.version === 50);
        expect(m, 'v50 must exist').toBeDefined();
        expect(m!.name).toBe('create_procurement');
        expect(m!.up).toContain('CREATE TABLE IF NOT EXISTS procurement_notices');
        expect(m!.up).toContain('CREATE TABLE IF NOT EXISTS procurement_bids');
        expect(m!.up).toContain('CREATE TABLE IF NOT EXISTS procurement_contracts');
        expect(m!.up).toContain('budget_wei');
        expect(m!.up).toContain('DECIMAL(65,0)');
        expect(m!.down).toContain('DROP TABLE IF EXISTS procurement_contracts');
    });
    it('migration v50 has a unique version number', () => {
        expect(MIGRATIONS.filter((x) => x.version === 50)).toHaveLength(1);
    });
});

function makeMockPool(responses: Array<[unknown, unknown]> = []): { pool: Pool; conn: PoolConnection; calls: () => string[] } {
    let i = 0; const sql: string[] = [];
    const query = vi.fn().mockImplementation((q: string) => { sql.push(String(q)); return Promise.resolve(responses[i++] ?? [[], {}]); });
    const conn = { beginTransaction: vi.fn().mockResolvedValue(undefined), commit: vi.fn().mockResolvedValue(undefined), rollback: vi.fn().mockResolvedValue(undefined), release: vi.fn(), query } as unknown as PoolConnection;
    const pool = { query, getConnection: vi.fn().mockResolvedValue(conn) } as unknown as Pool;
    return { pool, conn, calls: () => sql };
}
const rows = (r: unknown): [RowDataPacket[], unknown] => [r as RowDataPacket[], {}];

describe('ProcurementStore', () => {
    it('issueNotice rejects a non-positive budget', async () => {
        await expect(new ProcurementStore(makeMockPool().pool).issueNotice({ gridName: 'g', noticeId: 'n1', polisAuthorizationRef: 'law:1', title: 'Energy module', spec: 's', budgetWei: 0n, zone: 'infrastructure', functionType: 'power', deadlineTick: 100, currentTick: 1 })).rejects.toThrow('invalid_amount');
    });
    it('issueNotice inserts an open notice with the Polis authorization ref', async () => {
        const m = makeMockPool([[{}, {}]]);
        await new ProcurementStore(m.pool).issueNotice({ gridName: 'g', noticeId: 'n1', polisAuthorizationRef: 'law:1', title: 'Energy module', spec: 's', budgetWei: 5000n, zone: 'infrastructure', functionType: 'power', deadlineTick: 100, currentTick: 1 });
        const sql = m.calls()[0];
        expect(sql).toContain('INSERT INTO procurement_notices');
        expect(sql).toContain("'open'");
    });
    it('placeBid inserts a submitted bid when the notice is open', async () => {
        const m = makeMockPool([rows([{ status: 'open', deadline_tick: 100 }]), [{}, {}]]);
        await new ProcurementStore(m.pool).placeBid({ gridName: 'g', bidId: 'b1', noticeId: 'n1', bidderDid: 'w', priceWei: 4000n, artifactSpec: '{}', currentTick: 5 });
        expect(m.calls().join('\n')).toContain('INSERT INTO procurement_bids');
    });
    it('placeBid refuses a closed notice', async () => {
        const m = makeMockPool([rows([{ status: 'awarded', deadline_tick: 100 }])]);
        await expect(new ProcurementStore(m.pool).placeBid({ gridName: 'g', bidId: 'b1', noticeId: 'n1', bidderDid: 'w', priceWei: 4000n, artifactSpec: '{}', currentTick: 5 })).rejects.toThrow('notice_not_open');
    });
    it('award debits treasury, funds escrow from treasury, writes contract, marks awarded (atomic)', async () => {
        // notice FOR UPDATE (open, budget 5000); bid (submitted, price 4000, notice n1); treasury debit SELECT FOR UPDATE (8000); treasury UPDATE; escrow INSERT; contract INSERT; notice UPDATE; bid UPDATE
        const m = makeMockPool([
            rows([{ status: 'open', budget_wei: '5000' }]),
            rows([{ status: 'submitted', price_wei: '4000', notice_id: 'n1', bidder_did: 'w' }]),
            rows([{ balance_wei: '8000' }]), [{}, {}], [{}, {}], [{}, {}], [{}, {}], [{}, {}],
        ]);
        await new ProcurementStore(m.pool).award({ gridName: 'g', noticeId: 'n1', bidId: 'b1', contractId: 'c1', escrowId: 'e1', currentTick: 7 });
        const sql = m.calls().join('\n');
        expect(sql).toContain('civic_treasury');           // treasury debited
        expect(sql).toContain('INSERT INTO labor_escrow');  // escrow funded from treasury
        expect(sql).toContain('INSERT INTO procurement_contracts');
        expect(sql).toContain("status = 'awarded'");
        expect(m.conn.commit).toHaveBeenCalled();
    });
    it('award rejects a bid above budget', async () => {
        const m = makeMockPool([rows([{ status: 'open', budget_wei: '3000' }]), rows([{ status: 'submitted', price_wei: '4000', notice_id: 'n1', bidder_did: 'w' }])]);
        await expect(new ProcurementStore(m.pool).award({ gridName: 'g', noticeId: 'n1', bidId: 'b1', contractId: 'c1', escrowId: 'e1', currentTick: 7 })).rejects.toThrow('bid_exceeds_budget');
        expect(m.conn.rollback).toHaveBeenCalled();
    });
    it('award refuses a non-open notice', async () => {
        const m = makeMockPool([rows([{ status: 'awarded', budget_wei: '5000' }])]);
        await expect(new ProcurementStore(m.pool).award({ gridName: 'g', noticeId: 'n1', bidId: 'b1', contractId: 'c1', escrowId: 'e1', currentTick: 7 })).rejects.toThrow('notice_not_open');
    });
    it('settleContract releases escrow to the builder and marks settled', async () => {
        // contract FOR UPDATE (active, winner w, award 4000, escrow e1); credit builder (INSERT acct); escrow UPDATE released; contract UPDATE settled
        const m = makeMockPool([rows([{ status: 'active', winner_did: 'w', award_wei: '4000', escrow_id: 'e1' }]), [{}, {}], [{}, {}], [{}, {}]]);
        await new ProcurementStore(m.pool).settleContract({ gridName: 'g', contractId: 'c1', attestationRef: 'att:1', currentTick: 9 });
        const sql = m.calls().join('\n');
        expect(sql).toContain('nous_accounts');             // builder credited
        expect(sql).toContain("status = 'released'");        // escrow released
        expect(sql).toContain("status = 'settled'");         // contract settled
        expect(m.conn.commit).toHaveBeenCalled();
    });
    it('settleContract refuses a non-active contract', async () => {
        const m = makeMockPool([rows([{ status: 'settled', winner_did: 'w', award_wei: '4000', escrow_id: 'e1' }])]);
        await expect(new ProcurementStore(m.pool).settleContract({ gridName: 'g', contractId: 'c1', attestationRef: 'att:1', currentTick: 9 })).rejects.toThrow('contract_not_active');
        expect(m.conn.rollback).toHaveBeenCalled();
    });
    it('cancelNotice flips an open notice to cancelled', async () => {
        const m = makeMockPool([rows([{ status: 'open' }]), [{}, {}]]);
        await new ProcurementStore(m.pool).cancelNotice({ gridName: 'g', noticeId: 'n1', currentTick: 10 });
        expect(m.calls().join('\n')).toContain("status = 'cancelled'");
        expect(m.conn.commit).toHaveBeenCalled();
    });
});

describe('ProcurementStore — audit emit wiring (L2b)', () => {
    const NOTICE_ID = '12345678-1234-1234-1234-123456789abc';
    const BID_ID = '22345678-1234-1234-1234-123456789abc';
    const CONTRACT_ID = '33345678-1234-1234-1234-123456789abc';
    const ESCROW_ID = '44345678-1234-1234-1234-123456789abc';

    it('issueNotice emits procurement.notice_issued when audit is wired', async () => {
        const m = makeMockPool([[{}, {}]]);
        const chain = new AuditChain();
        const spy = vi.spyOn(chain, 'append');
        await new ProcurementStore(m.pool, chain).issueNotice({
            gridName: 'g', noticeId: NOTICE_ID, polisAuthorizationRef: 'law:1',
            title: 'Energy module', spec: 's', budgetWei: 5000n,
            zone: 'infrastructure', functionType: 'power', deadlineTick: 100, currentTick: 1,
        });
        expect(spy).toHaveBeenCalledWith('procurement.notice_issued', expect.any(String), expect.objectContaining({ notice_id: NOTICE_ID, budget_wei: '5000' }));
    });

    it('issueNotice does NOT emit when audit is absent', async () => {
        const m = makeMockPool([[{}, {}]]);
        // no audit → no throw, no spyable chain
        await expect(new ProcurementStore(m.pool).issueNotice({
            gridName: 'g', noticeId: NOTICE_ID, polisAuthorizationRef: 'law:1',
            title: 'T', spec: 's', budgetWei: 1n, zone: 'z', functionType: 'f', deadlineTick: 10, currentTick: 1,
        })).resolves.toBeUndefined();
    });

    it('placeBid emits procurement.bid_placed when audit is wired', async () => {
        const m = makeMockPool([rows([{ status: 'open', deadline_tick: 100 }]), [{}, {}]]);
        const chain = new AuditChain();
        const spy = vi.spyOn(chain, 'append');
        await new ProcurementStore(m.pool, chain).placeBid({
            gridName: 'g', bidId: BID_ID, noticeId: NOTICE_ID,
            bidderDid: 'did:noesis:nous:alice', priceWei: 4000n, artifactSpec: '{}', currentTick: 5,
        });
        expect(spy).toHaveBeenCalledWith('procurement.bid_placed', expect.any(String), expect.objectContaining({ bid_id: BID_ID, notice_id: NOTICE_ID }));
    });

    it('award emits procurement.awarded when audit is wired', async () => {
        const m = makeMockPool([
            rows([{ status: 'open', budget_wei: '5000' }]),
            rows([{ status: 'submitted', price_wei: '4000', notice_id: NOTICE_ID, bidder_did: 'did:noesis:nous:builder' }]),
            rows([{ balance_wei: '8000' }]), [{}, {}], [{}, {}], [{}, {}], [{}, {}], [{}, {}],
        ]);
        const chain = new AuditChain();
        const spy = vi.spyOn(chain, 'append');
        await new ProcurementStore(m.pool, chain).award({
            gridName: 'g', noticeId: NOTICE_ID, bidId: BID_ID,
            contractId: CONTRACT_ID, escrowId: ESCROW_ID, currentTick: 7,
        });
        expect(spy).toHaveBeenCalledWith('procurement.awarded', expect.any(String), expect.objectContaining({ contract_id: CONTRACT_ID, notice_id: NOTICE_ID, award_wei: '4000' }));
    });

    it('settleContract emits procurement.attested then procurement.settled when audit is wired', async () => {
        const m = makeMockPool([rows([{ status: 'active', winner_did: 'did:noesis:nous:builder', award_wei: '4000', escrow_id: ESCROW_ID }]), [{}, {}], [{}, {}], [{}, {}]]);
        const chain = new AuditChain();
        const spy = vi.spyOn(chain, 'append');
        await new ProcurementStore(m.pool, chain).settleContract({
            gridName: 'g', contractId: CONTRACT_ID, attestationRef: 'att:1', currentTick: 9,
        });
        const calls = spy.mock.calls.map((c) => c[0]);
        expect(calls).toContain('procurement.attested');
        expect(calls).toContain('procurement.settled');
        expect(calls.indexOf('procurement.attested')).toBeLessThan(calls.indexOf('procurement.settled'));
    });

    it('cancelNotice emits procurement.cancelled when audit is wired', async () => {
        const m = makeMockPool([rows([{ status: 'open' }]), [{}, {}]]);
        const chain = new AuditChain();
        const spy = vi.spyOn(chain, 'append');
        await new ProcurementStore(m.pool, chain).cancelNotice({
            gridName: 'g', noticeId: NOTICE_ID, currentTick: 10,
        });
        expect(spy).toHaveBeenCalledWith('procurement.cancelled', NOTICE_ID, expect.objectContaining({ notice_id: NOTICE_ID, reason: 'withdrawn' }));
    });
});
