/**
 * W4 capstone — the Economic Reality Loop moves money END-TO-END and CONSERVES.
 *
 * Now that live wei exists (model-first endowment, D-MONEY-09), this drives the
 * WHOLE chain through the REAL stores against a single stateful in-memory ledger
 * and asserts wei conservation at every hop:
 *
 *   endow → account ──pay due──▶ treasury ──RFP award──▶ escrow ──settle──▶ worker
 *
 * Conservation invariant (the endowment is the sole source):
 *   Σ account balances + treasury + escrow-held  ==  total endowed   (always)
 *
 * Unlike the per-store unit tests (canned-row mocks), this uses a fake Pool that
 * maintains actual numeric balances by interpreting the exact SQL each store emits
 * (wei-ops / credit rails). It also asserts the full event sequence lands on the
 * audit chain — so "money moves" is demonstrated, not asserted.
 */
import { describe, it, expect } from 'vitest';
import type { Pool } from 'mysql2/promise';
import { AuditChain } from '../../src/audit/chain.js';
import { EndowmentStore } from '../../src/economy/endowment-store.js';
import { CivicDueStore } from '../../src/economy/civic-due-store.js';
import { ProcurementStore } from '../../src/economy/procurement-store.js';

const GRID = 'genesis';
const ALICE = 'did:civic:noesis:alice';     // member who is endowed + pays a due
const BUILDER = 'did:civic:noesis:builder';  // Nous who wins the RFP and gets paid

// Audit emitters require UUID-format ids (due_id / notice_id / bid_id / contract_id).
const DUE = '11111111-1111-4111-8111-111111111111';
const NOTICE = '22222222-2222-4222-8222-222222222222';
const BID = '33333333-3333-4333-8333-333333333333';
const CONTRACT = '44444444-4444-4444-8444-444444444444';
const ESCROW = '55555555-5555-4555-8555-555555555555';

// ── A stateful in-memory ledger that the real stores drive ───────────────────
interface LedgerState {
    accounts: Map<string, bigint>;       // nous_accounts.balance_wei
    treasury: bigint;                    // civic_treasury.balance_wei
    endowments: Array<{ civic_did: string; amount_wei: bigint }>;
    dues: Map<string, { status: string; amount_wei: string; civic_did: string }>;
    notices: Map<string, { status: string; budget_wei: string }>;
    bids: Map<string, { status: string; price_wei: string; notice_id: string; bidder_did: string }>;
    contracts: Map<string, { status: string; winner_did: string; award_wei: string; escrow_id: string }>;
    escrows: Map<string, { status: string; amount_wei: bigint }>;
}

function makeLedgerPool(): { pool: Pool; s: LedgerState; totalWei: () => bigint; escrowHeld: () => bigint } {
    const s: LedgerState = {
        accounts: new Map(), treasury: 0n, endowments: [], dues: new Map(),
        notices: new Map(), bids: new Map(), contracts: new Map(), escrows: new Map(),
    };
    const acc = (did: string): bigint => s.accounts.get(did) ?? 0n;
    const statusOf = (sql: string): string => /SET status = '(\w+)'/.exec(sql)?.[1] ?? '';

    const run = (rawSql: string, params: unknown[] = []): [unknown[], unknown] => {
        const sql = rawSql.replace(/\s+/g, ' ').trim();
        const p = params.map((x) => (x === null || x === undefined ? x : String(x)));

        // ── Endowment ledger ──
        if (/SUM\(amount_wei\) AS total FROM account_endowments/i.test(sql)) {
            const did = p[1] as string;
            const total = s.endowments.filter((e) => e.civic_did === did).reduce((a, e) => a + e.amount_wei, 0n);
            return [[{ total: total.toString() }], {}];
        }
        if (/^INSERT INTO account_endowments/i.test(sql)) {
            s.endowments.push({ civic_did: p[2] as string, amount_wei: BigInt(p[3] as string) });
            return [{}, {}];
        }
        // ── nous_accounts (wei-ops account rail) ──
        if (/^INSERT INTO nous_accounts/i.test(sql)) {
            const did = p[1] as string; s.accounts.set(did, acc(did) + BigInt(p[2] as string));
            return [{}, {}];
        }
        if (/SELECT balance_wei FROM nous_accounts/i.test(sql)) {
            return [[{ balance_wei: acc(p[1] as string).toString() }], {}];
        }
        if (/^UPDATE nous_accounts SET balance_wei = balance_wei -/i.test(sql)) {
            const did = p[3] as string; s.accounts.set(did, acc(did) - BigInt(p[0] as string));
            return [{}, {}];
        }
        // ── civic_treasury (wei-ops treasury rail) ──
        if (/^INSERT INTO civic_treasury/i.test(sql)) { s.treasury += BigInt(p[1] as string); return [{}, {}]; }
        if (/SELECT balance_wei FROM civic_treasury/i.test(sql)) {
            return [[{ balance_wei: s.treasury.toString() }], {}];
        }
        if (/^UPDATE civic_treasury SET balance_wei = balance_wei -/i.test(sql)) {
            s.treasury -= BigInt(p[0] as string); return [{}, {}];
        }
        // ── civic_dues ──
        if (/^INSERT INTO civic_dues/i.test(sql)) {
            s.dues.set(p[0] as string, { status: 'assessed', amount_wei: p[4] as string, civic_did: p[2] as string });
            return [{}, {}];
        }
        if (/FROM civic_dues WHERE due_id = \? AND grid_name = \? FOR UPDATE/i.test(sql)) {
            const d = s.dues.get(p[0] as string);
            return [d ? [{ status: d.status, amount_wei: d.amount_wei, civic_did: d.civic_did }] : [], {}];
        }
        if (/^UPDATE civic_dues SET status/i.test(sql)) {
            const d = s.dues.get(p[1] as string); if (d) d.status = 'paid'; return [{}, {}];
        }
        // ── procurement_notices ──
        if (/^INSERT INTO procurement_notices/i.test(sql)) {
            s.notices.set(p[0] as string, { status: 'open', budget_wei: p[5] as string }); return [{}, {}];
        }
        if (/SELECT status, deadline_tick FROM procurement_notices/i.test(sql)) {
            const n = s.notices.get(p[0] as string);
            return [n ? [{ status: n.status, deadline_tick: 0 }] : [], {}];
        }
        if (/SELECT status, budget_wei FROM procurement_notices/i.test(sql)) {
            const n = s.notices.get(p[0] as string);
            return [n ? [{ status: n.status, budget_wei: n.budget_wei }] : [], {}];
        }
        if (/^UPDATE procurement_notices SET status/i.test(sql)) {
            const n = s.notices.get(p[p.length - 1] as string); if (n) n.status = statusOf(sql); return [{}, {}];
        }
        // ── procurement_bids ──
        if (/^INSERT INTO procurement_bids/i.test(sql)) {
            s.bids.set(p[0] as string, { status: 'submitted', price_wei: p[4] as string, notice_id: p[1] as string, bidder_did: p[3] as string });
            return [{}, {}];
        }
        if (/FROM procurement_bids WHERE bid_id = \? AND grid_name = \? FOR UPDATE/i.test(sql)) {
            const b = s.bids.get(p[0] as string);
            return [b ? [{ status: b.status, price_wei: b.price_wei, notice_id: b.notice_id, bidder_did: b.bidder_did }] : [], {}];
        }
        if (/^UPDATE procurement_bids SET status/i.test(sql)) {
            const b = s.bids.get(p[0] as string); if (b) b.status = 'awarded'; return [{}, {}];
        }
        // ── labor_escrow ──
        if (/^INSERT INTO labor_escrow/i.test(sql)) {
            s.escrows.set(p[0] as string, { status: 'funded', amount_wei: BigInt(p[4] as string) }); return [{}, {}];
        }
        if (/^UPDATE labor_escrow SET status/i.test(sql)) {
            const e = s.escrows.get(p[p.length - 1] as string); if (e) e.status = 'released'; return [{}, {}];
        }
        // ── procurement_contracts ──
        if (/^INSERT INTO procurement_contracts/i.test(sql)) {
            s.contracts.set(p[0] as string, { status: 'active', winner_did: p[3] as string, award_wei: p[4] as string, escrow_id: p[5] as string });
            return [{}, {}];
        }
        if (/FROM procurement_contracts WHERE contract_id = \? AND grid_name = \? FOR UPDATE/i.test(sql)) {
            const c = s.contracts.get(p[0] as string);
            return [c ? [{ status: c.status, winner_did: c.winner_did, award_wei: c.award_wei, escrow_id: c.escrow_id }] : [], {}];
        }
        if (/^UPDATE procurement_contracts SET status/i.test(sql)) {
            const c = s.contracts.get(p[p.length - 1] as string); if (c) c.status = 'settled'; return [{}, {}];
        }
        return [[], {}];
    };

    const conn = {
        beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {},
        query: async (sql: string, params: unknown[] = []) => run(sql, params),
    };
    const pool = {
        query: async (sql: string, params: unknown[] = []) => run(sql, params),
        getConnection: async () => conn,
    } as unknown as Pool;

    const totalWei = (): bigint =>
        [...s.accounts.values()].reduce((a, b) => a + b, 0n) + s.treasury +
        [...s.escrows.values()].filter((e) => e.status === 'funded').reduce((a, e) => a + e.amount_wei, 0n);
    const escrowHeld = (): bigint =>
        [...s.escrows.values()].filter((e) => e.status === 'funded').reduce((a, e) => a + e.amount_wei, 0n);

    return { pool, s, totalWei, escrowHeld };
}

describe('Economic Reality Loop — end-to-end money movement + conservation (D-MONEY-09)', () => {
    it('endow → due → treasury → RFP award → escrow → worker, conserving wei at every hop', async () => {
        const { pool, s, totalWei, escrowHeld } = makeLedgerPool();
        const audit = new AuditChain();
        const endow = new EndowmentStore(pool, audit);
        const dues = new CivicDueStore(pool, audit);
        const rfp = new ProcurementStore(pool, audit);

        const X = 1000n, D = 500n, BUDGET = 400n, PRICE = 300n;
        const TOTAL = X;

        // 1. ENDOW — the sole source. Alice's account goes 0 → 1000.
        const { newBalance } = await endow.endow({ gridName: GRID, civicDid: ALICE, amountWei: X, currentTick: 1 });
        expect(newBalance).toBe(X);
        expect(s.accounts.get(ALICE)).toBe(X);
        expect(s.treasury).toBe(0n);
        expect(totalWei()).toBe(TOTAL);

        // 2. CIVIC DUE — assessed, then paid in wei: account → treasury.
        await dues.assess({ gridName: GRID, dueId: DUE, civicDid: ALICE, period: '2026-W25', amountWei: D, amountCredit: 10n, dueTick: 100, currentTick: 2 });
        await dues.payWithWei({ gridName: GRID, dueId: DUE, currentTick: 3 });
        expect(s.accounts.get(ALICE)).toBe(X - D);   // 500
        expect(s.treasury).toBe(D);                   // 500
        expect(totalWei()).toBe(TOTAL);

        // 3. RFP — Polis issues a notice; the builder bids (no money moves yet).
        await rfp.issueNotice({ gridName: GRID, noticeId: NOTICE, polisAuthorizationRef: 'law-7', title: 'Solar array', spec: 'spec', budgetWei: BUDGET, zone: 'infrastructure', functionType: 'energy', deadlineTick: 200, currentTick: 4 });
        await rfp.placeBid({ gridName: GRID, bidId: BID, noticeId: NOTICE, bidderDid: BUILDER, priceWei: PRICE, artifactSpec: 'artifact', currentTick: 5 });
        expect(s.treasury).toBe(D);                   // unchanged
        expect(totalWei()).toBe(TOTAL);

        // 4. AWARD — treasury funds the escrow: treasury → escrow (held).
        await rfp.award({ gridName: GRID, noticeId: NOTICE, bidId: BID, contractId: CONTRACT, escrowId: ESCROW, currentTick: 6 });
        expect(s.treasury).toBe(D - PRICE);           // 200
        expect(escrowHeld()).toBe(PRICE);             // 300 held in escrow
        expect(s.accounts.get(BUILDER) ?? 0n).toBe(0n); // not paid yet
        expect(totalWei()).toBe(TOTAL);

        // 5. SETTLE — Grid attests; escrow releases to the builder: escrow → worker.
        await rfp.settleContract({ gridName: GRID, contractId: CONTRACT, attestationRef: 'oracle-att-1', currentTick: 7 });
        expect(escrowHeld()).toBe(0n);                // escrow drained
        expect(s.accounts.get(BUILDER)).toBe(PRICE);  // builder paid 300

        // Final ledger — every wei accounted for, none conjured or lost.
        expect(s.accounts.get(ALICE)).toBe(X - D);    // 500
        expect(s.accounts.get(BUILDER)).toBe(PRICE);  // 300
        expect(s.treasury).toBe(D - PRICE);           // 200
        expect(s.accounts.get(ALICE)! + s.accounts.get(BUILDER)! + s.treasury).toBe(TOTAL); // 1000
        expect(totalWei()).toBe(TOTAL);

        // The whole loop is on the audit chain, in order.
        const events = audit.query({}).map((e) => e.eventType);
        expect(events).toEqual([
            'portal.account_endowed',
            'due.assessed',
            'due.paid',
            'procurement.notice_issued',
            'procurement.bid_placed',
            'procurement.awarded',
            'procurement.attested',
            'procurement.settled',
        ]);
    });

    it('without the endowment, money cannot move — paying a due on a zero account fails', async () => {
        const { pool, s } = makeLedgerPool();
        const dues = new CivicDueStore(pool);
        await dues.assess({ gridName: GRID, dueId: DUE, civicDid: ALICE, period: '2026-W25', amountWei: 500n, amountCredit: 10n, dueTick: 100, currentTick: 1 });

        // No endowment → Alice's account is zero → the wei rail refuses the debit.
        await expect(dues.payWithWei({ gridName: GRID, dueId: DUE, currentTick: 2 })).rejects.toThrow('insufficient_balance');
        expect(s.treasury).toBe(0n); // nothing moved
    });
});
